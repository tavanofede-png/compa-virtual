import { describe, expect, it, vi } from "vitest";
import { checkLocalWorkerRemote } from "../scripts/worker-local.mjs";

const url = "https://example.supabase.co";
const key = "test-only";
const now = Date.parse("2026-09-27T12:00:00Z");
const reply = (body: unknown, status = 200) => vi.fn().mockResolvedValue({
  ok: status === 200, status, json: async () => body,
});

describe("local worker startup gate", () => {
  it("refuses to start without credentials", async () => {
    const result = await checkLocalWorkerRemote({ url: "", key: "", fetchImpl: reply({}) });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("refuses an outdated schema", async () => {
    const result = await checkLocalWorkerRemote({ url, key, now,
      fetchImpl: reply({ schema_contract: "20260926020551", worker: null }) });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("esquema");
  });

  it("refuses to overlap a current worker", async () => {
    const result = await checkLocalWorkerRemote({ url, key, now,
      fetchImpl: reply({ schema_contract: "20260927020000",
        worker: { state: "processing", last_seen_at: "2026-09-27T11:59:00Z" } }) });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("activo");
  });

  it("allows a stale worker heartbeat after the schema is current", async () => {
    const result = await checkLocalWorkerRemote({ url, key, now,
      fetchImpl: reply({ schema_contract: "20260927020000",
        worker: { state: "idle", last_seen_at: "2026-09-27T11:50:00Z" } }) });
    expect(result).toEqual({ ok: true, errors: [] });
  });
});
