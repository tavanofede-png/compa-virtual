import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRepository,
  StateConflictError,
  type AsyncStorage,
} from "../packages/client/src/index";
import { demoSnapshot, transition } from "../packages/domain/src/index";
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
it("sends voice as binary with cancellation and never caches microphone audio", async () => {
  const cache = memory(), invoke = vi.fn(async () => ({ data: { text: "Repasar", seconds: 1 }, error: null }));
  const client = { functions: { invoke } } as unknown as SupabaseClient;
  const repo = createRepository(client, cache, "voice-test"), audio = new ArrayBuffer(32044), controller = new AbortController();
  await repo.transcribeVoice(audio, "operation", controller.signal);
  expect(invoke).toHaveBeenCalledWith("voice", { body: audio, signal: controller.signal, headers: { "Content-Type": "audio/wav", "x-operation-id": "operation" } });
  expect(await cache.getItem("compa-cache:voice-test:pending")).toBeNull();
});
it("reuses the original operation after a lost response and application restart", async () => {
  const bodies: Record<string, unknown>[] = [],
    cache = memory();
  const invoke = vi.fn(async (_name, { body }) => {
    bodies.push(body);
    return bodies.length <= 2
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
  expect(bodies[2].operationId).toBe(bodies[0].operationId);
  expect(bodies[2].version).toBe(3);
  await createRepository(client, cache, "adult-test").command(command, 4);
  expect(bodies[3].operationId).not.toBe(bodies[0].operationId);
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
  await repo.command(command, 3);
  expect(bodies[1].type).toBe("snapshot");
  expect(bodies[2].version).toBe(9);
  expect(bodies[2].operationId).not.toBe(bodies[0].operationId);
});

it("does not overwrite an existing activity after a version conflict", async () => {
  const bodies: Record<string, unknown>[] = [];
  const client = {
    functions: {
      invoke: async (
        _name: string,
        { body }: { body: Record<string, unknown> },
      ) => {
        bodies.push(body);
        return {
          data: null,
          error: {
            context: {
              status: 409,
              json: async () => ({
                error: "Los datos cambiaron. Revisá la actividad.",
              }),
            },
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  const repo = createRepository(client, memory(), "adult-test");
  await expect(
    repo.command(
      { type: "item.save", payload: { id: "existing", title: "Cambiar" } },
      3,
    ),
  ).rejects.toThrow("Revisá la actividad");
  expect(bodies.map((body) => body.type)).toEqual(["item.save", "snapshot"]);
});
it("refreshes a changed session without replaying a stale session command", async () => {
  const cache = memory();
  const bodies: Record<string, unknown>[] = [];
  const latest = { state: demoSnapshot(), version: 9 };
  const client = {
    functions: {
      invoke: async (
        _name: string,
        { body }: { body: Record<string, unknown> },
      ) => {
        bodies.push(body);
        return body.type === "snapshot"
          ? { data: latest, error: null }
          : {
              data: null,
              error: {
                context: {
                  status: 409,
                  json: async () => ({ error: "Los datos cambiaron." }),
                },
              },
            };
      },
    },
  } as unknown as SupabaseClient;
  const repo = createRepository(client, cache, "adult-test");
  let conflict: unknown;
  try {
    await repo.command(
      { type: "session.start", payload: { objective: "Repasar Biología" } },
      3,
    );
  } catch (error) {
    conflict = error;
  }
  expect(conflict).toBeInstanceOf(StateConflictError);
  expect(conflict).toMatchObject({ latest: { version: 9 } });
  expect(bodies.map((body) => body.type)).toEqual(["session.start", "snapshot"]);
  expect(JSON.parse((await cache.getItem("compa-cache:adult-test"))!).version).toBe(9);
  expect(await cache.getItem("compa-cache:adult-test:pending")).toBe("[]");
});
it("uses one persistent session device identity per installation", async () => {
  const firstCache = memory();
  const secondCache = memory();
  const bodies: Record<string, unknown>[] = [];
  const client = {
    functions: {
      invoke: async (
        _name: string,
        { body }: { body: Record<string, unknown> },
      ) => {
        bodies.push(body);
        return { data: { state: demoSnapshot(), version: 2 }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  const first = createRepository(client, firstCache, "student");
  const firstId = (await first.load()).deviceId;
  expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
  await first.command({ type: "session.start", payload: { objective: "Repaso" } }, 1);
  const sent = bodies.at(-1);
  expect(sent).toBeDefined();
  expect((sent!.payload as { device_id: string }).device_id).toBe(firstId);
  expect((await createRepository(client, firstCache, "student").load()).deviceId).toBe(firstId);
  expect((await createRepository(client, secondCache, "student").load()).deviceId).not.toBe(firstId);
});
it("keeps an offline finish pending across restart and confirms it once online", async () => {
  const cache = memory();
  const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const started = transition(
    demoSnapshot(),
    { type: "session.start", payload: { objective: "Repasar Biología" } },
    startedAt,
  );
  const id = started.activeSession!.id;
  await cache.setItem("compa-cache:student", JSON.stringify({ state: started, version: 5 }));
  const bodies: Record<string, unknown>[] = [];
  const client = {
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        bodies.push(body);
        if (body.type === "snapshot")
          return { data: { state: started, version: 5 }, error: null };
        const state = transition(
          started,
          { type: String(body.type), payload: body.payload },
          new Date(Date.now() + 10 * 60_000).toISOString(),
        );
        return { data: { state, version: 6 }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  try {
    vi.stubGlobal("navigator", { onLine: false });
    const pending = await createRepository(client, cache, "student").finishSession({ id }, 5);
    expect(pending.pendingSessionFinish?.status).toBe("pending");
    expect(pending.state.sessions.some((session) => session.id === id)).toBe(false);
    expect(bodies).toHaveLength(0);
    vi.stubGlobal("navigator", { onLine: true });
    const confirmed = await createRepository(client, cache, "student").load();
    expect(confirmed.pendingSessionFinish).toBeUndefined();
    expect(confirmed.state.sessions.filter((session) => session.id === id)).toHaveLength(1);
    expect(confirmed.state.sessions.at(-1)?.actual_seconds).toBeGreaterThanOrEqual(300);
    expect(confirmed.state.sessions.at(-1)?.actual_seconds).toBeLessThan(310);
    expect(bodies.map((body) => body.type)).toEqual(["snapshot", "session.finish"]);
    expect(await cache.getItem("compa-cache:student:session-finish")).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("retries an uncertain finish with the original operation and timestamp", async () => {
  const cache = memory();
  const started = transition(
    demoSnapshot(),
    { type: "session.start", payload: { objective: "Repasar" } },
    new Date(Date.now() - 60_000).toISOString(),
  );
  const id = started.activeSession!.id;
  await cache.setItem("compa-cache:student", JSON.stringify({ state: started, version: 3 }));
  const finishes: Record<string, unknown>[] = [];
  const client = {
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        if (body.type === "snapshot")
          return { data: { state: started, version: 3 }, error: null };
        finishes.push(body);
        return finishes.length < 3
          ? { data: null, error: new Error("connection lost") }
          : {
              data: {
                state: transition(started, { type: "session.finish", payload: body.payload }, new Date().toISOString()),
                version: 4,
              },
              error: null,
            };
      },
    },
  } as unknown as SupabaseClient;
  const repo = createRepository(client, cache, "student");
  const pending = await repo.finishSession({ id }, 3);
  expect(pending.pendingSessionFinish?.status).toBe("pending");
  const confirmed = await createRepository(client, cache, "student").load();
  expect(confirmed.pendingSessionFinish).toBeUndefined();
  expect(finishes).toHaveLength(3);
  expect(new Set(finishes.map((body) => body.operationId)).size).toBe(1);
  expect(new Set(finishes.map((body) => (body.payload as { finished_at: string }).finished_at)).size).toBe(1);
});
it("does not replay an offline finish after another device takes control", async () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const cache = memory();
  const started = transition(
    demoSnapshot(),
    { type: "session.start", payload: { objective: "Repasar", device_id: first } },
    new Date(Date.now() - 60_000).toISOString(),
  );
  const id = started.activeSession!.id;
  const handedOff = transition(
    started,
    { type: "session.takeControl", payload: { id, device_id: second } },
    new Date().toISOString(),
  );
  await cache.setItem("compa-cache:student", JSON.stringify({ state: started, version: 3 }));
  await cache.setItem("compa-cache:student:session-device", first);
  let finishCalls = 0;
  const client = {
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        if (body.type === "snapshot")
          return { data: { state: handedOff, version: 4 }, error: null };
        finishCalls++;
        return {
          data: null,
          error: {
            context: { status: 409, json: async () => ({ error: "Otra versión" }) },
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  try {
    vi.stubGlobal("navigator", { onLine: false });
    await createRepository(client, cache, "student").finishSession({ id }, 3);
    vi.stubGlobal("navigator", { onLine: true });
    const latest = await createRepository(client, cache, "student").load();
    expect(finishCalls).toBe(1);
    expect(latest.pendingSessionFinish?.status).toBe("conflict");
    expect(latest.state.activeSession?.controller_device_id).toBe(second);
    expect(latest.state.sessions.some((session) => session.id === id)).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
