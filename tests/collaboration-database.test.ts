import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const users = Array.from(
  { length: 10 },
  (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const [a, b, c] = users;
async function command(
  user: string,
  payload: Record<string, unknown>,
  op = crypto.randomUUID(),
) {
  const { rows } = await db.query<{ result: Record<string, string> }>(
    "select public.collaboration_command($1,$2,$3::jsonb) result",
    [user, op, JSON.stringify(payload)],
  );
  return rows[0].result;
}
async function overview(user: string, session?: string) {
  const { rows } = await db.query<{ result: any }>(
    "select public.collaboration_read($1,$2) result",
    [user, session ?? null],
  );
  return rows[0].result;
}
async function invite(host: string, peer: string, scope: string, id: string) {
  const code = (await overview(peer)).contact_code;
  return command(host, {
    action: "invite.create",
    scope,
    target_id: id,
    contact_code: code,
  });
}
async function join(host: string, peer: string, scope: string, id: string) {
  const { invite_id } = await invite(host, peer, scope, id);
  await command(peer, { action: "invite.respond", invite_id, accept: true });
}
const sessionInput = (group_id: string | null = null) => ({
  action: "session.create",
  group_id,
  title: "Repaso",
  objective: "Resolver dos ejercicios",
  session_type: "review",
  space_template_id: "study",
  scheduled_start_at: new Date(Date.now() + 60000).toISOString(),
  timezone: "America/Argentina/Buenos_Aires",
  planned_duration: 45,
  meeting_url: "https://meet.google.com/abc-defg-hij",
});
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public,auth to service_role,authenticated,anon;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const file = (await readdir(directory)).find((x) =>
    x.endsWith("_private_collaboration.sql"),
  );
  await db.exec(
    await readFile(
      file
        ? new URL(file, directory)
        : new URL("../work/collaboration.sql", import.meta.url),
      "utf8",
    ),
  );
  for (let i = 0; i < users.length; i++) {
    await db.query("insert into auth.users values($1)", [users[i]]);
    await db.query("select public.collaboration_identity($1,$2)", [
      users[i],
      `Persona ${i + 1}`,
    ]);
  }
  await db.exec("set role service_role");
}, 60000);
afterAll(() => db.close());
describe("private shared groups and sessions in real PostgreSQL", () => {
  it("requires two accepted participants to start and lets members leave archived groups", async () => {
    const { session_id } = await command(a, sessionInput());
    await expect(
      command(a, { action: "session.start", session_id, revision: 0 }),
    ).rejects.toThrow("COLLAB_TOO_FEW");
    const { group_id } = await command(b, {
      action: "group.create",
      name: "Archivo",
    });
    await join(b, c, "group", group_id);
    const rev = (await overview(b)).groups.find(
      (g: any) => g.id === group_id,
    ).revision;
    await command(b, { action: "group.archive", group_id, revision: rev });
    await command(c, { action: "group.leave", group_id, revision: rev + 1 });
    expect((await overview(c)).groups.some((g: any) => g.id === group_id)).toBe(
      false,
    );
  });
  it("denies all direct REST access and RPC execution to authenticated/anonymous roles", async () => {
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(
        db.query("select * from public.group_study_sessions"),
      ).rejects.toThrow("permission denied");
      await expect(overview(a)).rejects.toThrow("permission denied");
      await expect(
        db.query("select * from private.collaboration_identities"),
      ).rejects.toThrow("permission denied");
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
  });
  it("binds an invitation to its recipient and hides Meet/roster until acceptance", async () => {
    const { session_id } = await command(a, sessionInput());
    const { invite_id } = await invite(a, b, "session", session_id);
    await expect(overview(b, session_id)).rejects.toThrow("COLLAB_NOT_FOUND");
    expect(JSON.stringify((await overview(b)).invitations)).not.toContain(
      "meet.google",
    );
    await expect(
      command(c, { action: "invite.respond", invite_id, accept: true }),
    ).rejects.toThrow("COLLAB_NOT_FOUND");
    await command(b, { action: "invite.respond", invite_id, accept: true });
    const detail = await overview(b, session_id);
    expect(detail.participants).toHaveLength(2);
    expect(detail.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
    expect((await overview(c)).sessions).toHaveLength(0);
    await expect(
      command(b, {
        action: "session.start",
        session_id,
        revision: detail.session.revision,
      }),
    ).rejects.toThrow("COLLAB_FORBIDDEN");
    await command(a, {
      action: "session.remove",
      session_id,
      user_id: b,
      revision: detail.session.revision,
    });
    await expect(overview(b, session_id)).rejects.toThrow("COLLAB_NOT_FOUND");
  });
  it("replays lost responses once and detects a reused operation with a different payload", async () => {
    const op = crypto.randomUUID(),
      input = { action: "group.create", name: "Equipo" };
    const first = await command(a, input, op);
    expect(await command(a, input, op)).toEqual(first);
    await expect(command(a, { ...input, name: "Otro" }, op)).rejects.toThrow(
      "COLLAB_CONFLICT",
    );
    expect(
      (await overview(a)).groups.filter((g: any) => g.id === first.group_id),
    ).toHaveLength(1);
  });
  it("keeps group membership distinct from session access and removes both on eviction", async () => {
    const { group_id } = await command(a, {
      action: "group.create",
      name: "Grupo privado",
    });
    await join(a, b, "group", group_id);
    const { session_id } = await command(a, sessionInput(group_id));
    await expect(overview(b, session_id)).rejects.toThrow("COLLAB_NOT_FOUND");
    await expect(invite(a, c, "session", session_id)).rejects.toThrow(
      "COLLAB_GROUP_MEMBER",
    );
    await join(a, b, "session", session_id);
    const rev = (await overview(a)).groups.find(
      (g: any) => g.id === group_id,
    ).revision;
    await command(a, {
      action: "group.remove",
      group_id,
      user_id: b,
      revision: rev,
    });
    await expect(overview(b, session_id)).rejects.toThrow("COLLAB_NOT_FOUND");
    expect((await overview(b)).groups.some((g: any) => g.id === group_id)).toBe(
      false,
    );
  });
  it("reserves the six seats including pending invites and rejects expired/revoked invites", async () => {
    const host = users[3],
      { session_id } = await command(host, sessionInput());
    const invites = [];
    for (const peer of users.slice(4, 9))
      invites.push(await invite(host, peer, "session", session_id));
    await expect(invite(host, users[9], "session", session_id)).rejects.toThrow(
      "COLLAB_FULL",
    );
    await command(host, {
      action: "invite.revoke",
      invite_id: invites[0].invite_id,
    });
    await expect(
      command(users[4], {
        action: "invite.respond",
        invite_id: invites[0].invite_id,
        accept: true,
      }),
    ).rejects.toThrow("COLLAB_INVITE_CLOSED");
    await db.query(
      "update private.collaboration_invitations set expires_at=now()-interval '1 second' where id=$1",
      [invites[1].invite_id],
    );
    await expect(
      command(users[5], {
        action: "invite.respond",
        invite_id: invites[1].invite_id,
        accept: true,
      }),
    ).rejects.toThrow("COLLAB_INVITE_CLOSED");
    await join(host, users[9], "session", session_id);
    expect((await overview(host, session_id)).participants).toHaveLength(2);
  });
  it("checks revisions, host transfer and legal lifecycle transitions", async () => {
    const { session_id } = await command(c, sessionInput());
    await join(c, b, "session", session_id);
    await expect(
      command(c, { action: "session.start", session_id, revision: 0 }),
    ).rejects.toThrow("COLLAB_CONFLICT");
    let detail = await overview(c, session_id);
    await expect(
      command(c, {
        action: "session.leave",
        session_id,
        revision: detail.session.revision,
      }),
    ).rejects.toThrow("COLLAB_HOST");
    await command(c, {
      action: "session.transfer",
      session_id,
      user_id: b,
      revision: detail.session.revision,
    });
    detail = await overview(b, session_id);
    await command(b, {
      action: "session.start",
      session_id,
      revision: detail.session.revision,
    });
    detail = await overview(b, session_id);
    expect(detail.session.started_at).toBeTruthy();
    await command(b, {
      action: "session.complete",
      session_id,
      revision: detail.session.revision,
    });
    detail = await overview(b, session_id);
    await expect(
      command(b, {
        action: "session.start",
        session_id,
        revision: detail.session.revision,
      }),
    ).rejects.toThrow("COLLAB_STATE");
  });
  it("closes sessions on host account deletion without deleting peer history", async () => {
    const host = users[8],
      { session_id } = await command(host, sessionInput());
    await join(host, users[9], "session", session_id);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [host]);
    await db.exec("set role service_role");
    const detail = await overview(users[9], session_id);
    expect(detail.session.status).toBe("cancelled");
    expect(detail.session.host_id).toBeNull();
    expect(detail.participants).toHaveLength(1);
  });
});
