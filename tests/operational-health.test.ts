import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const boot = "10000000-0000-4000-8000-000000000001";
const scan = async () => (await db.query<{ value: any }>("select public.operational_scan() value")).rows[0].value;

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table public.material_jobs(phase text,updated_at timestamptz,attempts integer);
    create table public.material_object_deletions(created_at timestamptz);
    create table public.push_deliveries(status text,created_at timestamptz);
    create table private.support_tickets(priority text,status text);
    create table private.group_chat_reports(status text);
    grant usage on schema public,private to service_role;`);
  await db.exec(await readFile(new URL("../supabase/migrations/20260927020000_operational_health.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20260927030000_operational_material_failures.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(() => db.close());

describe("operational health", () => {
  it("records a worker heartbeat without exposing the private table", async () => {
    await db.query("select public.worker_heartbeat($1,$2,$3,$4)", ["materials", boot, 2, "idle"]);
    const initial = await scan();
    expect(initial.schema_contract).toBe("20260927020000");
    expect(initial.worker.pipeline_version).toBe(2);
    expect(initial.alerts).toEqual([]);
    await db.exec("set role authenticated");
    await expect(db.query("select * from private.worker_heartbeats")).rejects.toThrow();
    await expect(db.query("select public.operational_health_read()")).rejects.toThrow();
    await expect(db.query("select public.operational_scan()")).rejects.toThrow();
    await expect(db.query("select public.worker_heartbeat($1,$2,$3,$4)", ["materials", boot, 2, "idle"])).rejects.toThrow();
    await db.exec("reset role");
  });

  it("opens and resolves count-only alerts without duplicate transition events", async () => {
    await db.exec(`update private.worker_heartbeats set last_seen_at=now()-interval '4 minutes';
      insert into public.material_jobs values('WAITING',now()-interval '16 minutes',1);
      insert into public.material_object_deletions values(now()-interval '2 hours');
      insert into private.support_tickets values('urgent','open');
      insert into private.group_chat_reports values('open');`);
    const first = await scan();
    expect(first.alerts.map((alert: { code: string }) => alert.code).sort()).toEqual([
      "chat_reports", "material_stalled", "storage_cleanup_stale", "urgent_support", "worker_stale",
    ]);
    const opened = first.recent_events.length;
    expect((await scan()).recent_events).toHaveLength(opened);
    await db.exec(`update private.worker_heartbeats set last_seen_at=now();
      delete from public.material_jobs; delete from public.material_object_deletions;
      delete from private.support_tickets; delete from private.group_chat_reports;`);
    const resolved = await scan();
    expect(resolved.alerts).toEqual([]);
    expect(resolved.recent_events.filter((event: { event: string }) => event.event === "resolved")).toHaveLength(opened);
  });

  it("alerts only after the push failure threshold, then resolves", async () => {
    await db.exec(`insert into public.push_deliveries values
      ('FAILED',now()),('FAILED',now()),('FAILED',now()),('FAILED',now());`);
    expect((await scan()).alerts).toEqual([]);
    await db.exec("insert into public.push_deliveries values('FAILED',now())");
    const active = await scan();
    expect(active.alerts).toMatchObject([{ code: "push_failures", observed_count: 5 }]);
    await db.exec("delete from public.push_deliveries");
    expect((await scan()).alerts).toEqual([]);
  });

  it("excludes expected material errors but alerts on exhausted processing retries", async () => {
    await db.exec("insert into public.material_jobs values('FAILED',now(),1)");
    expect((await scan()).alerts).toEqual([]);
    await db.exec("insert into public.material_jobs values('FAILED',now(),3)");
    expect((await scan()).alerts).toMatchObject([{ code: "material_failed", observed_count: 1 }]);
    await db.exec("delete from public.material_jobs");
    expect((await scan()).alerts).toEqual([]);
  });
});
