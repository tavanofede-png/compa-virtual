import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import {
  demoSnapshot,
  transition,
  type Snapshot,
} from "../packages/domain/src/index";
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
 create function pgmq.send(text,jsonb) returns bigint language plpgsql as $$begin insert into pgmq.sent values($2);return 1;end$$;
 create function pgmq.read(text,integer,integer) returns table(msg_id bigint,read_ct integer,message jsonb) language sql as $$select 1::bigint,1,'{}'::jsonb where false$$;
 create function pgmq.delete(text,bigint) returns boolean language sql as $$select true$$;
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
  await db.exec(await readFile(new URL("../supabase/migrations/20260912203428_private_collaboration.sql",import.meta.url),"utf8"));
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
async function asStudent<T>(user: string, action: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}
describe("PostgreSQL authorization and concurrency", () => {
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
  it("enforces same-owner references even when server code makes a mistake", async () => {
    const broken = structuredClone(stateA);
    broken.items[0].subject_id = "foreign-subject";
    await db.query(
      "insert into public.subjects(user_id,id,data) values($1,'foreign-subject','{}')",
      [b],
    );
    await expect(commit(a, 2, broken)).rejects.toThrow();
  });
  it("enqueues one job per material and only requeues after a terminal failure", async () => {
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
          "select count(*)::int as count from pgmq.sent",
        )
      ).rows[0].count,
    ).toBe(1);
    await db.query(
      "update public.material_jobs set status='FAILED' where user_id=$1",
      [b],
    );
    for (let i = 0; i < 2; i++)
      await db.query("select public.enqueue_material($1,'queue-test')", [b]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from pgmq.sent",
        )
      ).rows[0].count,
    ).toBe(2);
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
});
