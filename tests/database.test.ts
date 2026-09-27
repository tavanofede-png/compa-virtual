import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import {
  demoSnapshot,
  transition,
  type Snapshot,
} from "../packages/domain/src/index";
import { applyStudentAgentActions } from "../packages/server/src/agent";
const db = new PGlite({ extensions: { vector } });
const a = "10000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000002";
let stateA: Snapshot, stateB: Snapshot;
const commit = (
  user: string,
  version: number,
  state: Snapshot,
  op = crypto.randomUUID(),
) =>
  db.query("select public.commit_state($1,$2,$3,$4::jsonb,$5) as version", [
    user,
    version,
    op,
    JSON.stringify(state),
    "test",
  ]);
beforeAll(async () => {
  // Real PostgreSQL/WASM + vector + RLS. Only Supabase's surrounding auth/storage schemas
  // and unavailable pgmq transport are represented by fixtures; queue delivery is NOT certified here.
  await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create schema extensions;create schema pgmq;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage,extensions to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create function pgmq.create(text) returns void language sql as $$select$$;
 create table pgmq.sent(message jsonb);
 create table pgmq.q_materials(msg_id bigint generated always as identity primary key,message jsonb);
 create function pgmq.send(text,jsonb) returns bigint language plpgsql as $$declare id bigint;begin insert into pgmq.sent values($2);insert into pgmq.q_materials(message) values($2) returning msg_id into id;return id;end$$;
 create function pgmq.read(text,integer,integer) returns table(msg_id bigint,read_ct integer,message jsonb) language sql as $$select 1::bigint,1,'{}'::jsonb where false$$;
 create function pgmq.delete(text,bigint) returns boolean language plpgsql as $$begin delete from pgmq.q_materials where msg_id=$2;return found;end$$;
 create function pgmq.set_vt(text,bigint,integer) returns void language sql as $$select$$;
 `);
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260905043845_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    migration.replace(
      "create extension if not exists pgmq;",
      "-- pgmq transport fixture above",
    ),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [a, b]);
  // Additive migration must coexist with the personal state/projection functions.
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260912203428_private_collaboration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260924000000_material_single_pipeline.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
      "../supabase/migrations/20260925135057_family_operator_review.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(await readFile(new URL(
    "../supabase/migrations/20260926020551_family_capabilities.sql", import.meta.url,
  ), "utf8"));
  await db.exec(await readFile(new URL(
    "../supabase/migrations/20260926031249_material_recovery.sql", import.meta.url,
  ), "utf8"));
  await db.exec(await readFile(new URL(
    "../supabase/migrations/20260926041800_voice_quota.sql", import.meta.url,
  ), "utf8"));
  stateA = demoSnapshot();
  stateA.profile!.id = a;
  stateA.coins = 0;
  stateA.xp = 0;
  stateB = demoSnapshot();
  stateB.profile!.id = b;
  stateB.coins = 0;
  stateB.xp = 0;
  stateB.subjects[0].name = "Materia privada B";
  await commit(a, 0, stateA);
  await commit(b, 0, stateB);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('materials',$1),('materials',$2)",
    [a + "/test.pdf", b + "/test.pdf"],
  );
}, 60000);
afterAll(() => db.close());
it("fences material cancellation/deletion, preserves text checkpoints, and prevents stale leases from writing", async () => {
  const user = "90000000-0000-4000-8000-000000000009";
  await db.query("insert into auth.users(id) values($1)", [user]);
  const state = demoSnapshot(); state.profile!.id = user; state.profile!.birth_date = "2001-01-01";
  state.materials = [{ id: "recover-test", subject_id: state.subjects[0].id, title: "Material.txt", path: user + "/test.txt", mime_type: "text/plain", size: 100, status: "QUEUED" }];
  await commit(user, 0, state);
  const version = async () => (await db.query<{ version: number }>("select version from public.student_states where user_id=$1", [user])).rows[0].version;
  await db.query("select public.material_enqueue_v2($1,'recover-test',$2,$3)", [user, await version(), crypto.randomUUID()]);
  const generation = async () => (await db.query<{ generation: number }>("select generation from public.material_jobs where user_id=$1", [user])).rows[0].generation;
  const event = async (gen: number, lease: string, action: string, data: unknown = {}) =>
    (await db.query<{ result: { accepted: boolean } }>("select public.material_job_event($1,'recover-test',$2,$3,$4,$5::jsonb) as result", [user, gen, lease, action, JSON.stringify(data)])).rows[0].result.accepted;
  const first = crypto.randomUUID(), gen = await generation();
  expect(await event(gen, first, "CLAIM")).toBe(true);
  expect(await event(gen, crypto.randomUUID(), "CLAIM")).toBe(false);
  await event(gen, first, "PAGE", { ordinal: 0, label: "Página 1", text: "Contenido privado", needs_ocr: false });
  const text = { chunks: [{ ordinal: 0, label: "Página 1", content: "Contenido privado" }], complete: true, page_count: 1 };
  await event(gen, first, "TEXT", text);
  const cancel = crypto.randomUUID();
  await expect(db.query("select public.material_cancel_v2($1,'recover-test',999,$2)", [user, cancel])).rejects.toThrow("VERSION_CONFLICT");
  expect(await event(gen, first, "HEARTBEAT")).toBe(true);
  await db.query("select public.material_cancel_v2($1,'recover-test',$2,$3)", [user, await version(), cancel]);
  expect(await event(gen, first, "TEXT", { ...text, complete: false })).toBe(false);
  expect((await db.query("select content from public.material_page_checkpoints where user_id=$1", [user])).rows).toHaveLength(1);
  await asStudent(user, async () => {
    await expect(db.query("select * from public.material_page_checkpoints")).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.material_job_event($1,'recover-test',1,$2,'CLAIM')", [user, first])).rejects.toThrow(/permission denied/);
  });
  await db.query("select public.material_enqueue_v2($1,'recover-test',$2,$3)", [user, await version(), crypto.randomUUID()]);
  const nextGen = await generation(), second = crypto.randomUUID();
  expect(await event(nextGen, second, "CLAIM")).toBe(true);
  await db.query("update public.material_jobs set lease_expires_at=now()-interval '1 second' where user_id=$1", [user]);
  expect(await event(nextGen, second, "PAGE", { ordinal: 0, label: "Página 1", text: "Tarde", needs_ocr: false })).toBe(false);
  const third = crypto.randomUUID();
  expect(await event(nextGen, third, "CLAIM")).toBe(true);
  expect(await event(nextGen, second, "TEXT", text)).toBe(false);
  const chunk = (await db.query<{ id: string }>("select id from public.study_material_chunks where user_id=$1", [user])).rows[0];
  await event(nextGen, third, "VECTORS", { chunks: [{ id: chunk.id, embedding: Array(1536).fill(0.1) }] });
  expect(await event(nextGen, third, "DONE")).toBe(true);
  const deletion = crypto.randomUUID(), expected = await version();
  await db.query("select public.material_delete_v2($1,'recover-test',$2,$3)", [user, expected, deletion]);
  await db.query("select public.material_delete_v2($1,'recover-test',$2,$3)", [user, expected, deletion]);
  expect(await event(nextGen, third, "TEXT", text)).toBe(false);
  expect((await db.query("select * from public.study_material_chunks where user_id=$1", [user])).rows).toHaveLength(0);
  expect((await db.query("select * from public.material_object_deletions where user_id=$1", [user])).rows).toHaveLength(1);
});
async function asStudent<T>(user: string, action: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}
it("reserves shared voice quota atomically, rejects replay and never refunds uncertain calls", async () => {
  const user = "a0000000-0000-4000-8000-000000000010", other = "a0000000-0000-4000-8000-000000000011", account = "b".repeat(32), operation = crypto.randomUUID();
  await db.query("insert into auth.users(id) values($1),($2)", [user, other]);
  const state = demoSnapshot(); state.profile!.id = user; state.profile!.birth_date = "2000-01-01";
  await commit(user, 0, state);
  const otherState = structuredClone(state); otherState.profile!.id = other;
  await commit(other, 0, otherState);
  await asStudent(user, async () => {
    await expect(db.query("select * from public.voice_requests")).rejects.toThrow();
    await expect(db.query("select public.voice_reserve($1,$2,$3,$4,25)", [user, account, operation, "a".repeat(64)])).rejects.toThrow();
  });
  await db.exec("set role service_role");
  try {
    const reserve = async (id = crypto.randomUUID(), limit = 600) => (await db.query<{ result: string }>(
      "select public.voice_reserve($1,$2,$3,$4,25,$5) as result", [user, account, id, "a".repeat(64), limit])).rows[0].result;
    expect(await reserve()).toBe("BUDGET_UNVERIFIED");
    const verify = async (amount: number, id = crypto.randomUUID()) => db.query(
      "select public.voice_verify_budget($1,$2,$3,'Verified free balance for test',$4)", [user, account, amount, id]);
    await verify(100);
    expect(await reserve(operation)).toBe("RESERVED");
    const balance = async () => (await db.query<{ remaining_neurons: number }>("select remaining_neurons from public.voice_quota_pools where account_id=$1", [account])).rows[0].remaining_neurons;
    expect(await balance()).toBeLessThan(80);
    const afterReserve = await balance();
    expect(await reserve()).toBe("BUSY");
    await db.query("update public.voice_requests set status='FAILED' where operation_id=$1", [operation]);
    expect(await reserve(operation)).toBe("ALREADY_USED");
    expect(await balance()).toBe(afterReserve);
    await expect(db.query("select public.voice_reserve($1,$2,$3,$4,25)", [user, account, operation, "b".repeat(64)])).rejects.toThrow(/VOICE_OPERATION_CONFLICT/);
    expect(await reserve(crypto.randomUUID(), 25)).toBe("STUDENT_LIMIT");
    await verify(10000); expect(await balance()).toBe(afterReserve);
    await db.query("update public.voice_quota_pools set remaining_neurons=1 where account_id=$1", [account]);
    expect(await reserve()).toBe("GLOBAL_LIMIT");
    await db.query("update public.voice_quota_pools set valid_until=now()-interval '1 second' where account_id=$1", [account]);
    expect(await reserve()).toBe("BUDGET_UNVERIFIED");
    const lastSlot = "c".repeat(32);
    await db.query("select public.voice_verify_budget($1,$2,45,'Verified free balance for test',$3)", [user, lastSlot, crypto.randomUUID()]);
    const contenders = await Promise.all([user, other].map((id) => db.query<{ result: string }>(
      "select public.voice_reserve($1,$2,$3,$4,25) as result", [id, lastSlot, crypto.randomUUID(), "c".repeat(64)])));
    expect(contenders.map((result) => result.rows[0].result).sort()).toEqual(["GLOBAL_LIMIT", "RESERVED"]);
    await db.query("insert into public.account_controls(user_id,deleting) values($1,true)", [user]);
    expect(await reserve()).toBe("FORBIDDEN");
  } finally { await db.exec("reset role"); }
  await db.query("delete from auth.users where id=$1", [user]);
  expect((await db.query("select * from public.voice_requests where user_id=$1", [user])).rows).toHaveLength(0);
});
describe("PostgreSQL authorization and concurrency", () => {
  it("persists a new subject, its activity and the selected study space together", async () => {
    const user = "30000000-0000-4000-8000-000000000003";
    await db.query("insert into auth.users(id) values($1)", [user]);
    const initial = demoSnapshot();
    initial.profile!.id = user;
    initial.subjects = [];
    initial.items = [];
    const applied = applyStudentAgentActions(
      initial,
      [
        { type: "select_study_space", space_id: "loft" },
        {
          type: "create_task",
          item_id: null,
          subject_name: "Matemática",
          title: "Práctica de límites",
          description: "Ejercicios de la guía",
          kind: "TASK",
          due_date: "2026-09-22",
          due_time: "15:00",
          priority: 2,
          difficulty: 3,
          effort_minutes: 50,
          topics: ["Límites"],
        },
      ],
      "2026-09-21T15:00:00Z",
    );
    expect(
      applied.receipts.every((receipt) => receipt.status === "COMPLETED"),
    ).toBe(true);
    await commit(user, 0, applied.state);
    const persisted = await db.query<{ state: Snapshot }>(
      "select state from public.student_states where user_id=$1",
      [user],
    );
    expect(persisted.rows[0].state.activeStudySpaceId).toBe("loft");
    expect(persisted.rows[0].state.subjects).toHaveLength(1);
    expect(persisted.rows[0].state.items[0].subject_id).toBe(
      persisted.rows[0].state.subjects[0].id,
    );
    const projection = await db.query<{ count: number }>(
      "select count(*)::int as count from public.academic_items where user_id=$1",
      [user],
    );
    expect(projection.rows[0].count).toBe(1);
  });
  it("isolates relational rows and private storage paths", async () => {
    await asStudent(a, async () => {
      const rows = await db.query<{ user_id: string }>(
        "select user_id from public.subjects",
      );
      expect(rows.rows.every((x) => x.user_id === a)).toBe(true);
      const objects = await db.query<{ name: string }>(
        "select name from storage.objects",
      );
      expect(objects.rows).toEqual([{ name: a + "/test.pdf" }]);
    });
  });
  it("denies direct balance, snapshot, answer-key and foreign RPC access", async () => {
    await asStudent(a, async () => {
      await expect(
        db.query(
          "update public.point_transactions set amount=999 where user_id=$1",
          [a],
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select * from public.student_states"),
      ).rejects.toThrow("permission denied");
      await expect(db.query("select * from public.quiz_sets")).rejects.toThrow(
        "permission denied",
      );
      await expect(commit(b, 1, stateB)).rejects.toThrow();
      await expect(
        db.query("select public.read_material_job()"),
      ).rejects.toThrow();
    });
  });
  it("serializes versioned transitions and makes retries idempotent", async () => {
    stateA = transition(
      stateA,
      { type: "item.complete", payload: { id: stateA.items[0].id } },
      new Date().toISOString(),
    );
    const operation = crypto.randomUUID();
    await commit(a, 1, stateA, operation);
    await commit(a, 1, stateA, operation);
    const ledger = await db.query<{ count: number; sum: number }>(
      "select count(*)::int as count,sum(amount)::int as sum from public.point_transactions where user_id=$1",
      [a],
    );
    expect(ledger.rows[0]).toEqual({ count: 1, sum: 5 });
    await expect(commit(a, 1, stateA)).rejects.toThrow("VERSION_CONFLICT");
  });
  it("persists one device handoff and rejects a stale controller write", async () => {
    const user = "40000000-0000-4000-8000-000000000004";
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users(id) values($1)", [user]);
    const initial = demoSnapshot();
    initial.profile!.id = user;
    initial.coins = 0;
    initial.xp = 0;
    await commit(user, 0, initial);
    const started = transition(
      initial,
      { type: "session.start", payload: { objective: "Repasar", device_id: first } },
      "2026-09-07T12:00:00Z",
    );
    await commit(user, 1, started);
    const sessionId = started.activeSession!.id;
    const handedOff = transition(
      started,
      { type: "session.takeControl", payload: { id: sessionId, device_id: second } },
      "2026-09-07T12:06:00Z",
    );
    await commit(user, 2, handedOff);
    const stale = transition(
      started,
      { type: "session.pause", payload: { id: sessionId, device_id: first } },
      "2026-09-07T12:07:00Z",
    );
    await expect(commit(user, 2, stale)).rejects.toThrow("VERSION_CONFLICT");
    const resumed = transition(
      handedOff,
      { type: "session.resume", payload: { id: sessionId, device_id: second } },
      "2026-09-07T12:10:00Z",
    );
    await commit(user, 3, resumed);
    const finished = transition(
      resumed,
      { type: "session.finish", payload: { id: sessionId, device_id: second } },
      "2026-09-07T12:12:00Z",
    );
    const operation = crypto.randomUUID();
    await commit(user, 4, finished, operation);
    await commit(user, 4, finished, operation);
    const persisted = await db.query<{ state: Snapshot }>(
      "select state from public.student_states where user_id=$1",
      [user],
    );
    expect(persisted.rows[0].state.sessions).toHaveLength(initial.sessions.length + 1);
    expect(persisted.rows[0].state.sessions.at(-1)?.actual_seconds).toBe(480);
    const ledger = await db.query<{ count: number }>(
      "select count(*)::int as count from public.point_transactions where user_id=$1",
      [user],
    );
    expect(ledger.rows[0].count).toBe(1);
  });
  it("enforces same-owner references even when server code makes a mistake", async () => {
    const broken = structuredClone(stateA);
    broken.items[0].subject_id = "foreign-subject";
    await db.query(
      "insert into public.subjects(user_id,id,data) values($1,'foreign-subject','{}')",
      [b],
    );
    await expect(commit(a, 2, broken)).rejects.toThrow();
  });
  it("keeps one queue message per material and repairs only a missing stale message", async () => {
    stateB.materials.push({
      id: "queue-test",
      subject_id: stateB.subjects[0].id,
      title: "Prueba",
      path: b + "/queue.txt",
      mime_type: "text/plain",
      size: 2,
      status: "QUEUED",
    });
    await commit(b, 1, stateB);
    for (let i = 0; i < 2; i++)
      await db.query("select public.enqueue_material($1,'queue-test')", [b]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from pgmq.sent where message->>'material_id'='queue-test'",
        )
      ).rows[0].count,
    ).toBe(1);
    await db.query(
      "update public.material_jobs set updated_at=now()-interval '16 minutes' where user_id=$1 and material_id='queue-test'",
      [b],
    );
    await db.query("select public.enqueue_material($1,'queue-test')", [b]);
    expect(
      (await db.query<{ count: number }>("select count(*)::int as count from pgmq.sent where message->>'material_id'='queue-test'")).rows[0].count,
    ).toBe(1);
    await db.query("delete from pgmq.q_materials");
    await db.query("select public.enqueue_material($1,'queue-test')", [b]);
    expect(
      (await db.query<{ count: number }>("select count(*)::int as count from pgmq.sent where message->>'material_id'='queue-test'")).rows[0].count,
    ).toBe(2);
    await db.query(
      "update public.material_jobs set status='FAILED' where user_id=$1",
      [b],
    );
    for (let i = 0; i < 2; i++)
      await db.query("select public.enqueue_material($1,'queue-test')", [b]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from pgmq.sent where message->>'material_id'='queue-test'",
        )
      ).rows[0].count,
    ).toBe(3);
  });
  it("isolates vector retrieval, deletes chunks by cascade, and purges old chats", async () => {
    const mat = "material-a";
    stateA.materials.push({
      id: mat,
      subject_id: stateA.subjects[0].id,
      title: "A",
      path: a + "/a.txt",
      mime_type: "text/plain",
      size: 2,
      status: "READY",
    });
    stateA.messages = [
      {
        id: "old",
        role: "user",
        content: "OLD_PRIVATE",
        created_at: "2000-01-01T00:00:00Z",
      },
    ];
    await commit(a, 2, stateA);
    const vectorValue =
      "[" +
      Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)).join(",") +
      "]";
    await db.query(
      "insert into public.study_material_chunks(user_id,material_id,ordinal,label,content,embedding) values($1,$2,0,'Página 1','Contenido privado A',$3::extensions.vector)",
      [a, mat, vectorValue],
    );
    const result = await db.query(
      "select * from public.search_materials($1,null,$2,$3::extensions.vector)",
      [b, "Contenido", vectorValue],
    );
    expect(result.rows).toHaveLength(0);
    await db.query("select public.purge_chat_history()");
    const messages = await db.query(
      "select * from public.conversation_messages where user_id=$1",
      [a],
    );
    expect(messages.rows).toHaveLength(0);
    await db.query("delete from auth.users where id=$1", [a]);
    const chunks = await db.query(
      "select * from public.study_material_chunks where user_id=$1",
      [a],
    );
    expect(chunks.rows).toHaveLength(0);
  });
  it("lets students read own consents and denies client inserts", async () => {
    await db.query(
      "insert into public.consents(user_id,policy_version,basis,verified_at) values($1,'kusiy-beta-nov-2026','parental-guardian',now())",
      [b],
    );
    await asStudent(b, async () => {
      const rows = await db.query("select policy_version from public.consents");
      expect(rows.rows).toHaveLength(1);
      await expect(
        db.query(
          "insert into public.consents(user_id,policy_version,basis) values($1,'kusiy-beta-nov-2026','parental-guardian')",
          [b],
        ),
      ).rejects.toThrow();
    });
  });
  it("keeps family review service-only, auditable and revocable", async () => {
    const student = "50000000-0000-4000-8000-000000000005";
    const operator = "60000000-0000-4000-8000-000000000006";
    await db.query("insert into auth.users(id) values($1)", [student]);
    await db.query("insert into auth.users(id) values($1)", [operator]);
    const state = demoSnapshot();
    state.profile!.id = student;
    state.profile!.birth_date = "2011-01-01";
    await commit(student, 0, state);
    const inserted = await db.query<{ id: string }>(
      "insert into public.consents(user_id,policy_version,basis,evidence_reference) values($1,'kusiy-beta-nov-2026','parental-guardian','Ana Pérez') returning id",
      [student],
    );
    const consentId = inserted.rows[0].id;
    const second = await db.query<{ id: string }>(
      "insert into public.consents(user_id,policy_version,basis,evidence_reference) values($1,'kusiy-beta-nov-2026','parental-guardian','Ana Pérez') returning id",
      [student],
    );
    await asStudent(student, async () => {
      await expect(db.query(
        "select public.operator_consent_decision($1,$2,'VERIFY_FAMILY','independent-call','case-01',null)",
        [operator, consentId],
      )).rejects.toThrow();
    });
    await db.exec("set role service_role");
    try {
      const verified = await db.query<{ decision: { status: string } }>(
        "select public.operator_consent_decision($1,$2,'VERIFY_FAMILY','independent-call','case-01',null) as decision",
        [operator, consentId],
      );
      expect(verified.rows[0].decision.status).toBe("verified");
      const repeated = await db.query<{ decision: { status: string } }>(
        "select public.operator_consent_decision($1,$2,'VERIFY_FAMILY','independent-call','case-01',null) as decision",
        [operator, consentId],
      );
      expect(repeated.rows[0].decision.status).toBe("already_verified");
      await expect(db.query(
        "select public.operator_consent_decision($1,$2,'VERIFY_FAMILY','independent-call','case-02',null)",
        [operator, second.rows[0].id],
      )).rejects.toThrow(/CONSENT_ALREADY_ACTIVE/);
      const revoked = await db.query<{ decision: { status: string } }>(
        "select public.operator_consent_decision($1,$2,'REVOKE_FAMILY',null,null,'La familia revocó el permiso') as decision",
        [operator, consentId],
      );
      expect(revoked.rows[0].decision.status).toBe("revoked");
      const live = await db.query(
        "select id from public.consents where user_id=$1 and revoked_at is null",
        [student],
      );
      expect(live.rows).toHaveLength(0);
      const audit = await db.query<{ action: string }>(
        "select action from public.operator_audit where consent_id=$1 order by created_at",
        [consentId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "VERIFY_FAMILY", "REVOKE_FAMILY",
      ]);
    } finally {
      await db.exec("reset role");
    }
  });
  it("requires explicit family purposes, isolates links and revokes without restoring grants on replay", async () => {
    const student = "70000000-0000-4000-8000-000000000007";
    const operator = "80000000-0000-4000-8000-000000000008";
    await db.query("insert into auth.users(id) values($1),($2)", [student, operator]);
    const state = demoSnapshot();
    state.profile!.id = student;
    state.profile!.birth_date = "2011-01-01";
    await commit(student, 0, state);
    const consent = await db.query<{ id: string }>(
      "insert into public.consents(user_id,policy_version,basis,verified_at) values($1,'kusiy-beta-nov-2026','parental-guardian',now()) returning id", [student],
    );
    const consentId = consent.rows[0].id;
    await asStudent(student, async () => {
      await expect(db.query("select * from public.family_links")).rejects.toThrow();
      await expect(db.query("select public.family_access($1,'VIEW')", ["a".repeat(64)])).rejects.toThrow();
      await expect(db.query("insert into public.capability_grants(user_id,consent_id,policy_version,capability) values($1,$2,'kusiy-beta-nov-2026','ai')", [student, consentId])).rejects.toThrow();
    });
    await db.exec("set role service_role");
    try {
      const allowed = async (capability: string) => (await db.query<{ allowed: boolean }>(
        "select public.family_capability_allowed($1,'kusiy-beta-nov-2026',$2) as allowed", [student, capability],
      )).rows[0].allowed;
      expect(await allowed("service")).toBe(false);
      await db.query("select public.operator_family_link($1,$2,$3,'https://example.test/terms-v1','https://example.test/privacy-v1')", [operator, consentId, "a".repeat(64)]);
      await expect(db.query("select public.family_access($1,'ACCEPT',$2,$3::jsonb)", [
        "a".repeat(64), crypto.randomUUID(), JSON.stringify({ service: true, social: false, unrelated: true }),
      ])).rejects.toThrow(/FAMILY_PERMISSIONS_INVALID/);
      const acceptOp = crypto.randomUUID();
      const accept = async () => (await db.query<{ result: { permissions: Record<string, boolean> } }>(
        "select public.family_access($1,'ACCEPT',$2,$3::jsonb) as result", [
          "a".repeat(64), acceptOp, JSON.stringify({ service: true, ai: true, social: false }),
        ],
      )).rows[0].result;
      expect((await accept()).permissions).toEqual({ service: true, ai: true, social: false });
      expect((await accept()).permissions.ai).toBe(true);
      expect(await allowed("social")).toBe(false);
      await db.query("select public.family_access($1,'REVOKE',$2,null,$3::text[])", ["a".repeat(64), crypto.randomUUID(), ["ai"]]);
      expect(await allowed("ai")).toBe(false);
      expect(await allowed("service")).toBe(true);
      // A replay returns its receipt, but does not execute the old acceptance.
      expect((await accept()).permissions.ai).toBe(false);
      expect(await allowed("ai")).toBe(false);
      const revokeOp = crypto.randomUUID();
      await db.query("select public.family_access($1,'REVOKE',$2,null,$3::text[])", ["a".repeat(64), revokeOp, ["service"]]);
      expect(await allowed("service")).toBe(false);
      expect(await allowed("ai")).toBe(false);
      await db.query("select public.family_access($1,'REVOKE',$2,null,$3::text[])", ["a".repeat(64), revokeOp, ["service"]]);
      await expect(db.query("select public.family_access($1,'VIEW')", ["a".repeat(64)])).rejects.toThrow(/FAMILY_LINK_INVALID/);
      await expect(db.query("select public.operator_family_link($1,$2,$3,'https://example.test/terms-v1','https://example.test/privacy-v1')", [operator, consentId, "b".repeat(64)])).rejects.toThrow(/FAMILY_NOT_VERIFIED/);
    } finally { await db.exec("reset role"); }
    await asStudent(b, async () => {
      expect((await db.query("select * from public.capability_grants")).rows).toHaveLength(0);
    });
    await asStudent(student, async () => {
      expect((await db.query("select * from public.capability_grants")).rows).toHaveLength(2);
    });
  });
});
