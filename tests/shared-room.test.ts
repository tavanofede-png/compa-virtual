import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  sharedSeats,
  sharedSpaces,
  sharedTimerSeconds,
  collaborationCommandSchema,
} from "../packages/domain/src/index";
const db = new PGlite();
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  c = "10000000-0000-4000-8000-000000000003";
const ca = crypto.randomUUID(),
  cb = crypto.randomUUID();
let sid: string;
async function call(
  user: string,
  payload: Record<string, unknown>,
  op = crypto.randomUUID(),
) {
  const fn = String(payload.action).startsWith("room.")
    ? "shared_room_command"
    : "collaboration_command";
  return (
    await db.query<{ r: any }>(`select public.${fn}($1,$2,$3::jsonb) r`, [
      user,
      op,
      JSON.stringify(payload),
    ])
  ).rows[0].r;
}
async function read(user: string) {
  return (
    await db.query<{ r: any }>("select public.collaboration_read($1,$2) r", [
      user,
      sid,
    ])
  ).rows[0].r;
}
beforeAll(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public,auth to service_role;",
  );
  for (const name of [
    "20260912203428_private_collaboration.sql",
    "20260913015408_shared_room_runtime.sql",
    "20260913180735_shared_room_privacy_and_retention.sql",
    "20260926143000_group_session_join.sql",
    "20260926153000_one_active_shared_room.sql",
    "20260926160000_shared_room_host_recovery.sql",
    "20260926173000_private_meeting_chat.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  for (const [i, user] of [a, b, c].entries()) {
    await db.query("insert into auth.users values($1)", [user]);
    await db.query("select public.collaboration_identity($1,$2)", [
      user,
      "Prueba " + i,
    ]);
  }
  await db.exec("set role service_role");
  sid = (
    await call(a, {
      action: "session.create",
      group_id: null,
      title: "Repaso",
      objective: "Aprender",
      session_type: "review",
      space_template_id: "study",
      scheduled_start_at: new Date().toISOString(),
      timezone: "UTC",
      planned_duration: 45,
    })
  ).session_id;
  const peer = (
    await db.query<{ r: any }>("select public.collaboration_read($1) r", [b])
  ).rows[0].r;
  const inv = await call(a, {
    action: "invite.create",
    scope: "session",
    target_id: sid,
    contact_code: peer.contact_code,
  });
  await call(b, {
    action: "invite.respond",
    invite_id: inv.invite_id,
    accept: true,
  });
}, 60000);
afterAll(() => db.close());
describe("Shared room contracts", () => {
  it("has six distinct usable seat coordinates per room", () => {
    for (const s of sharedSpaces) {
      const seats = sharedSeats(s.id);
      expect(seats).toHaveLength(6);
      expect(new Set(seats.map((a) => a.position.join(","))).size).toBe(6);
    }
  });
  it("derives time from server deadlines without restarting after reconnect", () => {
    expect(
      sharedTimerSeconds(
        {
          phase: "focus",
          running: true,
          deadline: "2026-09-12T12:25:00Z",
          remaining_seconds: 1500,
          revision: 1,
        },
        Date.parse("2026-09-12T12:22:30Z"),
      ),
    ).toBe(150);
  });
  it("rejects supplied actor or arbitrary seat fields", () => {
    expect(
      collaborationCommandSchema.safeParse({
        action: "room.seat",
        session_id: a,
        connection_id: ca,
        seat_id: "SEAT_09",
        user_id: b,
      }).success,
    ).toBe(false);
  });
  it("reserves seats in PostgreSQL, supports takeover, and rejects stale controllers", async () => {
    await call(a, { action: "room.enter", session_id: sid, connection_id: ca });
    await call(b, { action: "room.enter", session_id: sid, connection_id: cb });
    expect((await read(a)).room.presence).toHaveLength(2);
    await expect(
      call(b, {
        action: "room.seat",
        session_id: sid,
        connection_id: cb,
        seat_id: "SEAT_01",
      }),
    ).rejects.toThrow("ROOM_SEAT_BUSY");
    await expect(
      call(c, {
        action: "room.enter",
        session_id: sid,
        connection_id: crypto.randomUUID(),
      }),
    ).rejects.toThrow("COLLAB_NOT_FOUND");
    await expect(
      call(a, {
        action: "room.enter",
        session_id: sid,
        connection_id: crypto.randomUUID(),
      }),
    ).rejects.toThrow("ROOM_CONTROLLED");
    const takeover = crypto.randomUUID();
    await call(a, {action:"room.enter",session_id:sid,connection_id:takeover,takeover:true});
    await expect(call(a,{action:"room.heartbeat",session_id:sid,connection_id:ca})).rejects.toThrow("ROOM_CONTROLLED");
    await call(a, {action:"room.enter",session_id:sid,connection_id:ca,takeover:true});
  });
  it("allows only one active room lease per account", async () => {
    const other = (await call(a, {
      action: "session.create", group_id: null, title: "Segundo repaso",
      objective: "Estudiar", session_type: "silent", space_template_id: "library",
      scheduled_start_at: new Date().toISOString(), timezone: "UTC", planned_duration: 30,
    })).session_id;
    const connection = crypto.randomUUID();
    await expect(call(a, { action: "room.enter", session_id: other, connection_id: connection }))
      .rejects.toThrow("ROOM_OTHER_SESSION");
    await call(a, { action: "room.leave", session_id: sid, connection_id: ca });
    await call(a, { action: "room.enter", session_id: other, connection_id: connection });
    await call(a, { action: "room.leave", session_id: other, connection_id: connection });
    await call(a, { action: "room.enter", session_id: sid, connection_id: ca });
  });
  it("keeps timer authority with host and deduplicates goals", async () => {
    const rev = (await read(a)).session.revision;
    await call(a, { action: "session.start", session_id: sid, revision: rev });
    await expect(
      call(b, {
        action: "room.timer",
        session_id: sid,
        revision: 0,
        operation: "focus",
      }),
    ).rejects.toThrow("COLLAB_FORBIDDEN");
    await call(a, {
      action: "room.timer",
      session_id: sid,
      revision: 0,
      operation: "focus",
    });
    expect((await read(b)).room.timer.running).toBe(true);
    const op = crypto.randomUUID(),
      cmd = {
        action: "room.goal.add",
        session_id: sid,
        title: "Explicar el ejercicio",
      };
    await call(a, cmd, op);
    await call(a, cmd, op);
    expect((await read(b)).room.goals).toHaveLength(1);
  });
  it("expires leases and revokes read and command retries immediately", async () => {
    const op = crypto.randomUUID(),
      cmd = {
        action: "room.hand",
        session_id: sid,
        connection_id: cb,
        raised: true,
      };
    await call(b, cmd, op);
    const rev = (await read(a)).session.revision;
    await call(a, {
      action: "session.remove",
      session_id: sid,
      user_id: b,
      revision: rev,
    });
    await expect(read(b)).rejects.toThrow("COLLAB_NOT_FOUND");
    await expect(call(b, cmd, op)).rejects.toThrow("COLLAB_NOT_FOUND");
    expect((await read(a)).room.presence).toHaveLength(1);
    await db.query(
      "update private.shared_room_presence set expires_at=now()-interval '1 second' where session_id=$1",
      [sid],
    );
    expect((await read(a)).room.presence).toHaveLength(0);
    await db.query("select private.cleanup_shared_room_presence()");
    expect((await db.query("select * from private.shared_room_presence")).rows).toHaveLength(0);
  });
  it("hands an active room to a present participant after its host lease expires", async () => {
    const other = (await call(a, {
      action: "session.create", group_id: null, title: "Continuidad",
      objective: "Resolver juntos", session_type: "review", space_template_id: "study",
      scheduled_start_at: new Date().toISOString(), timezone: "UTC", planned_duration: 30,
    })).session_id;
    const contact = (await db.query<{ r: any }>(
      "select public.collaboration_read($1) r", [c],
    )).rows[0].r.contact_code;
    const invite = await call(a, { action: "invite.create", scope: "session", target_id: other, contact_code: contact });
    await call(c, { action: "invite.respond", invite_id: invite.invite_id, accept: true });
    const bContact = (await db.query<{ r: any }>(
      "select public.collaboration_read($1) r", [b],
    )).rows[0].r.contact_code;
    const secondInvite = await call(a, { action: "invite.create", scope: "session", target_id: other, contact_code: bContact });
    await call(b, { action: "invite.respond", invite_id: secondInvite.invite_id, accept: true });
    await db.query(
      "update public.group_session_participants set joined_at = now() + interval '1 minute' where session_id = $1 and user_id = $2",
      [other, b],
    );
    const revision = (await db.query<{ r: any }>(
      "select public.collaboration_read($1,$2) r", [a, other],
    )).rows[0].r.session.revision;
    await call(a, { action: "session.start", session_id: other, revision });
    const hostConnection = crypto.randomUUID(), peerConnection = crypto.randomUUID();
    await call(a, { action: "room.enter", session_id: other, connection_id: hostConnection });
    await call(c, { action: "room.enter", session_id: other, connection_id: peerConnection });
    await call(b, { action: "room.enter", session_id: other, connection_id: crypto.randomUUID() });
    expect((await db.query<{ r: number }>(
      "select private.reconcile_shared_room_hosts() r",
    )).rows[0].r).toBe(0);
    await db.query(
      "update private.shared_room_presence set expires_at = now() - interval '1 second' where session_id = $1 and user_id = $2",
      [other, a],
    );
    await db.query(
      "update private.shared_room_host_leases set expires_at = now() - interval '1 second' where session_id = $1",
      [other],
    );
    expect((await db.query<{ r: number }>(
      "select private.reconcile_shared_room_hosts() r",
    )).rows[0].r).toBe(1);
    const room = (await db.query<{ r: any }>(
      "select public.collaboration_read($1,$2) r", [c, other],
    )).rows[0].r;
    expect(room.session.host_id).toBe(c);
    await expect(call(a, { action: "room.timer", session_id: other, revision: 0, operation: "focus" }))
      .rejects.toThrow("COLLAB_FORBIDDEN");
    await call(c, { action: "room.timer", session_id: other, revision: 0, operation: "focus" });
    await call(a, { action: "room.enter", session_id: other, connection_id: hostConnection });
    await call(c, { action: "room.leave", session_id: other, connection_id: peerConnection });
    const handedBack = (await db.query<{ r: any }>(
      "select public.collaboration_read($1,$2) r", [a, other],
    )).rows[0].r;
    expect(handedBack.session.host_id).toBe(a);
  });
  it("keeps host leases and recovery inaccessible to student database roles", async () => {
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from private.shared_room_host_leases"))
        .rejects.toThrow("permission denied");
      await expect(db.query("select private.reconcile_shared_room_hosts()"))
        .rejects.toThrow("permission denied");
      await expect(db.query("select * from private.group_chat_messages"))
        .rejects.toThrow("permission denied");
      await expect(db.query("select public.operator_chat_reports()"))
        .rejects.toThrow("permission denied");
      await expect(db.query("select public.social_chat_writable()"))
        .rejects.toThrow("permission denied");
      await expect(db.query("select public.operator_chat_control()"))
        .rejects.toThrow("permission denied");
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
  });
  it("keeps meeting chat private, idempotent, moderated and blocked", async () => {
    const chatSession = (await db.query<{ id: string }>(
      "select id from public.group_study_sessions where title='Continuidad'",
    )).rows[0].id;
    const op = crypto.randomUUID();
    const send = () => db.query<{ r: { message_id: string; status: string } }>(
      "select public.collaboration_chat_send($1,$2,$3,$4) r", [a, op, chatSession, "¿Repasamos juntos?"],
    );
    expect((await db.query<{ writable: boolean }>("select public.social_chat_writable() writable"))
      .rows[0].writable).toBe(false);
    await expect(send()).rejects.toThrow("CHAT_READ_ONLY");
    const control = (await db.query<{ r: { writable: boolean; audit: unknown[] } }>(
      "select public.operator_chat_set_writable($1,$2,$3) r",
      [c, true, "Operador de prueba disponible"],
    )).rows[0].r;
    expect(control.writable).toBe(true);
    expect(control.audit).toHaveLength(1);
    const first = (await send()).rows[0].r;
    expect(first.status).toBe("visible");
    expect((await send()).rows[0].r.message_id).toBe(first.message_id);
    const page = await db.query<{ r: { messages: { id: string; body: string }[] } }>(
      "select public.collaboration_chat_read($1,$2) r", [b, chatSession],
    );
    expect(page.rows[0].r.messages.some((m) => m.id === first.message_id)).toBe(true);
    await expect(db.query("select public.collaboration_chat_read($1,$2)", ["10000000-0000-4000-8000-000000000003", sid]))
      .rejects.toThrow("COLLAB_NOT_FOUND");
    await expect(db.query("select public.collaboration_chat_send($1,$2,$3,$4)",
      [a, crypto.randomUUID(), chatSession, "https://example.com"]))
      .rejects.toThrow("CHAT_LINK");
    const held = (await db.query<{ r: { message_id: string; status: string } }>(
      "select public.collaboration_chat_send($1,$2,$3,$4) r",
      [a, crypto.randomUUID(), chatSession, "Necesito hablar de autolesión"],
    )).rows[0].r;
    expect(held.status).toBe("held");
    expect((await db.query<{ r: { messages: { id: string }[] } }>(
      "select public.collaboration_chat_read($1,$2) r", [b, chatSession],
    )).rows[0].r.messages.some((m) => m.id === held.message_id)).toBe(false);
    const reported = (await db.query<{ r: { report_id: string } }>(
      "select public.collaboration_chat_report($1,$2,$3,$4,$5) r",
      [b, chatSession, first.message_id, "other", "Revisar contexto"],
    )).rows[0].r;
    expect((await db.query<{ r: { report_id: string } }>(
      "select public.collaboration_chat_report($1,$2,$3,$4,$5) r",
      [b, chatSession, first.message_id, "other", "Revisar contexto"],
    )).rows[0].r.report_id).toBe(reported.report_id);
    const reports = (await db.query<{ r: { id: string }[] }>(
      "select public.operator_chat_reports() r",
    )).rows[0].r;
    expect(reports.some((r) => r.id === reported.report_id)).toBe(true);
    await db.query("select public.operator_chat_decide($1,$2,$3,$4)",
      [c, reported.report_id, "hide", "Contenido reportado revisado"]);
    expect((await db.query<{ r: { messages: { id: string }[] } }>(
      "select public.collaboration_chat_read($1,$2) r", [b, chatSession],
    )).rows[0].r.messages.some((m) => m.id === first.message_id)).toBe(false);
    const group = await call(a, { action: "group.create", name: "Grupo con bloqueo" });
    const bCode = (await db.query<{ r: any }>(
      "select public.collaboration_read($1) r", [b],
    )).rows[0].r.contact_code;
    const groupInvite = await call(a, { action: "invite.create", scope: "group",
      target_id: group.group_id, contact_code: bCode });
    await call(b, { action: "invite.respond", invite_id: groupInvite.invite_id, accept: true });
    await db.query("select public.collaboration_chat_block($1,$2)", [b, a]);
    await expect(call(a, { action: "invite.create", scope: "session",
      target_id: chatSession, contact_code: bCode })).rejects.toThrow("CHAT_BLOCKED_PEER");
    const next = await call(a, { action: "session.create", group_id: group.group_id,
      title: "Bloqueada", objective: "Repasar", session_type: "review",
      space_template_id: "study", scheduled_start_at: new Date().toISOString(),
      timezone: "UTC", planned_duration: 30 });
    await expect(db.query("select public.collaboration_join_group_session($1,$2,$3::jsonb)",
      [b, crypto.randomUUID(), JSON.stringify({ action: "session.join", session_id: next.session_id, revision: 0 })]))
      .rejects.toThrow("CHAT_BLOCKED_PEER");
    const exported = (await db.query<{ r: { messages: { id: string }[] } }>(
      "select public.group_chat_export($1) r", [a],
    )).rows[0].r;
    expect(exported.messages.some((m) => m.id === first.message_id)).toBe(true);
    expect((await db.query<{ r: { messages: { id: string }[] } }>(
      "select public.group_chat_export($1) r", [b],
    )).rows[0].r.messages.some((m) => m.id === first.message_id)).toBe(false);
    await expect(db.query("select public.shared_room_command($1,$2,$3::jsonb,$4::jsonb)",
      [b, crypto.randomUUID(), JSON.stringify({ action: "room.enter", session_id: chatSession, connection_id: cb }), "{}"])).rejects.toThrow("CHAT_BLOCKED_PEER");
    await db.query("select public.operator_chat_set_writable($1,$2,$3)",
      [c, false, "Moderación de prueba pausada"]);
    await expect(db.query("select public.collaboration_chat_send($1,$2,$3,$4)",
      [a, crypto.randomUUID(), chatSession, "Otro mensaje"]))
      .rejects.toThrow("CHAT_READ_ONLY");
  });
  it("exports only authored goals and removes them when the account is deleted", async () => {
    const exported=await db.query<{r:{authored_goals:unknown[]}}>("select public.shared_room_export($1) r",[a]);
    expect(exported.rows[0].r.authored_goals).toHaveLength(1);
    const other=await db.query<{r:{authored_goals:unknown[]}}>("select public.shared_room_export($1) r",[c]);
    expect(other.rows[0].r.authored_goals).toHaveLength(0);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1",[a]);
    expect((await db.query("select * from private.shared_room_goals")).rows).toHaveLength(0);
    expect((await db.query("select * from private.group_chat_messages")).rows).toHaveLength(0);
  });
});
