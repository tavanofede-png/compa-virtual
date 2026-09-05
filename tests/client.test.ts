import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRepository,
  type AsyncStorage,
} from "../packages/client/src/index";
import { demoSnapshot } from "../packages/domain/src/index";
function memory(): AsyncStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
    removeItem: async (k) => {
      values.delete(k);
    },
  };
}
it("reuses the original operation after a lost response and application restart", async () => {
  const bodies: Record<string, unknown>[] = [],
    cache = memory();
  const invoke = vi.fn(async (_name, { body }) => {
    bodies.push(body);
    return bodies.length === 1
      ? { data: null, error: new Error("network") }
      : { data: { state: demoSnapshot(), version: 4 }, error: null };
  });
  const client = { functions: { invoke } } as unknown as SupabaseClient;
  const command = {
    type: "subject.save",
    payload: { name: "Historia", color: "#456789" },
  };
  await expect(
    createRepository(client, cache, "adult-test").command(command, 3),
  ).rejects.toThrow("confirmar");
  await createRepository(client, cache, "adult-test").command(command, 4);
  expect(bodies[1].operationId).toBe(bodies[0].operationId);
  expect(bodies[1].version).toBe(3);
  await createRepository(client, cache, "adult-test").command(command, 4);
  expect(bodies[2].operationId).not.toBe(bodies[0].operationId);
  expect(await cache.getItem("compa-cache:adult-test:pending")).toBe("[]");
});
it("discards a rejected version only after a definitive conflict", async () => {
  const cache = memory(),
    bodies: Record<string, unknown>[] = [];
  const client = {
    functions: {
      invoke: async (
        _name: string,
        { body }: { body: Record<string, unknown> },
      ) => {
        bodies.push(body);
        return bodies.length === 1
          ? {
              data: null,
              error: {
                context: {
                  status: 409,
                  json: async () => ({ error: "Actualizá" }),
                },
              },
            }
          : { data: { state: demoSnapshot(), version: 9 }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  const repo = createRepository(client, cache, "adult-test");
  const command = {
    type: "subject.save",
    payload: { name: "Historia", color: "#456789" },
  };
  await expect(repo.command(command, 3)).rejects.toThrow("Actualizá");
  await repo.command(command, 8);
  expect(bodies[1].version).toBe(8);
  expect(bodies[1].operationId).not.toBe(bodies[0].operationId);
});
