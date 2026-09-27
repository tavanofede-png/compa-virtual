import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const student = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const operator = "10000000-0000-4000-8000-000000000003";
const rpc = async <T = any>(name: string, args: unknown[]) => {
  const slots = args.map((_, index) => `$${index + 1}`).join(",");
  return (await db.query<{ value: T }>(`select public.${name}(${slots}) value`, args)).rows[0].value;
};

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema private; create table auth.users(id uuid primary key); grant usage on schema public,auth,private to service_role;");
  await db.exec(await readFile(new URL("../supabase/migrations/20260927010000_support_tickets.sql", import.meta.url), "utf8"));
  for (const id of [student, other, operator]) await db.query("insert into auth.users(id) values($1)", [id]);
}, 30000);
afterAll(() => db.close());

describe("support tickets", () => {
  it("creates an idempotent private ticket and lets only its owner read or reply", async () => {
    const operation = crypto.randomUUID();
    const first = await rpc<{ id: string }>("support_create", [student, operation, "study", "No puedo estudiar", "La pantalla no abre la sesión."]);
    const same = await rpc<{ id: string }>("support_create", [student, operation, "study", "No puedo estudiar", "La pantalla no abre la sesión."]);
    expect(same.id).toBe(first.id);
    const owner = await rpc<any[]>("support_read", [student]);
    expect(owner[0].messages).toHaveLength(1);
    expect(owner[0].messages[0].body).toBe("La pantalla no abre la sesión.");
    expect(await rpc("support_read", [other])).toEqual([]);
    await expect(rpc("support_reply", [other, first.id, crypto.randomUUID(), "Respuesta ajena."])).rejects.toThrow("SUPPORT_NOT_FOUND");
    const replyOp = crypto.randomUUID();
    const reply = await rpc<{ id: string }>("support_reply", [student, first.id, replyOp, "Sigue ocurriendo al entrar de nuevo."]);
    expect((await rpc<{ id: string }>("support_reply", [student, first.id, replyOp, "Sigue ocurriendo al entrar de nuevo."])).id).toBe(reply.id);
    expect((await rpc<any[]>("support_read", [student]))[0].messages).toHaveLength(2);
    expect((await rpc<any[]>("support_export", [student, 0]))[0].messages).toHaveLength(2);
    expect(await rpc("support_export", [other, 0])).toEqual([]);
  });

  it("routes safety tickets to the urgent queue and audits operator decisions", async () => {
    const ticket = await rpc<{ id: string }>("support_create", [other, crypto.randomUUID(), "safety", "Problema de seguridad", "Necesito que revisen un encuentro."]);
    const queue = await rpc<any[]>("operator_support_queue", ["open"]);
    expect(queue[0].id).toBe(ticket.id);
    expect(queue[0].priority).toBe("urgent");
    const op = crypto.randomUUID();
    await rpc("operator_support_update", [operator, ticket.id, "waiting_student", op, "Estamos revisando el caso. ¿Podés indicar el encuentro?"]);
    await rpc("operator_support_update", [operator, ticket.id, "waiting_student", op, "Estamos revisando el caso. ¿Podés indicar el encuentro?"]);
    const owner = await rpc<any[]>("support_read", [other]);
    expect(owner[0].status).toBe("waiting_student");
    expect(owner[0].messages).toHaveLength(2);
    const audit = await db.query<{ from_status: string; to_status: string }>("select from_status,to_status from private.support_ticket_audit where ticket_id=$1", [ticket.id]);
    expect(audit.rows).toEqual([{ from_status: "open", to_status: "waiting_student" }]);
    await rpc("support_reply", [other, ticket.id, crypto.randomUUID(), "El encuentro era el de Matemática."]);
    expect((await rpc<any[]>("support_read", [other]))[0].status).toBe("open");
  });

  it("limits spam, validates content, blocks direct client reads, and erases on account deletion", async () => {
    await expect(rpc("support_create", [student, crypto.randomUUID(), "study", "x", "Mensaje válido"])).rejects.toThrow("SUPPORT_INVALID");
    for (let index = 0; index < 4; index++)
      await rpc("support_create", [student, crypto.randomUUID(), "other", `Consulta ${index}`, "Detalle de la consulta."]);
    await expect(rpc("support_create", [student, crypto.randomUUID(), "other", "Consulta extra", "Detalle de la consulta."])).rejects.toThrow("SUPPORT_RATE_LIMIT");
    await db.exec("set role authenticated");
    await expect(db.query("select * from private.support_tickets")).rejects.toThrow();
    await expect(db.query("select public.support_read($1)", [student])).rejects.toThrow();
    await expect(db.query("select public.operator_support_queue(null)")).rejects.toThrow();
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [student]);
    expect((await db.query("select count(*)::int n from private.support_tickets where user_id=$1", [student])).rows[0].n).toBe(0);
  });

  it("pages the operator queue without hiding older cases", async () => {
    for (let index = 0; index < 55; index++)
      await db.query("insert into private.support_tickets(user_id,operation_id,category,subject,created_at,updated_at) values($1,$2,'other',$3,now() - ($4::int * interval '1 minute'),now() - ($4::int * interval '1 minute'))", [other, crypto.randomUUID(), `Consulta ${index}`, index]);
    const first = await rpc<any[]>("operator_support_queue", ["open"]);
    expect(first).toHaveLength(51);
    const cursor = first[49];
    const next = await rpc<any[]>("operator_support_queue", ["open", cursor.priority, cursor.updated_at, cursor.id]);
    expect(next.length).toBeGreaterThan(0);
    expect(next.some((ticket) => first.slice(0, 50).some((old) => old.id === ticket.id))).toBe(false);
    const own = await rpc<any[]>("support_read", [other]);
    expect(own).toHaveLength(51);
    const ownCursor = own[49];
    const ownNext = await rpc<any[]>("support_read", [other, ownCursor.updated_at, ownCursor.id]);
    expect(ownNext.length).toBeGreaterThan(0);
    expect(ownNext.some((ticket) => own.slice(0, 50).some((old) => old.id === ticket.id))).toBe(false);
  });
});
