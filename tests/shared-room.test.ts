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
  it("exports only authored goals and removes them when the account is deleted", async () => {
    const exported=await db.query<{r:{authored_goals:unknown[]}}>("select public.shared_room_export($1) r",[a]);
    expect(exported.rows[0].r.authored_goals).toHaveLength(1);
    const other=await db.query<{r:{authored_goals:unknown[]}}>("select public.shared_room_export($1) r",[c]);
    expect(other.rows[0].r.authored_goals).toHaveLength(0);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1",[a]);
    expect((await db.query("select * from private.shared_room_goals")).rows).toHaveLength(0);
  });
});
