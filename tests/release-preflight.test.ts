import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkLocal, checkRemote, requiredReleaseArtifacts } from "../scripts/release-preflight.mjs";

let base: string;
beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "kusiy-release-"));
  for (const name of requiredReleaseArtifacts) {
    const path = join(base, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, name === "vercel.json" ? JSON.stringify({ outputDirectory: "out", rewrites:
      ["admin", "family", "help"].map((route) => ({ source: `/${route}`, destination: `/${route}.html` })) }) : "artifact");
  }
});
afterAll(async () => { if (base) await rm(base, { recursive: true, force: true }); });

describe("release preflight", () => {
  it("rejects an absent asset or Vercel route without hiding the local failure", async () => {
    expect((await checkLocal(base)).ok).toBe(true);
    await rm(join(base, "out/help.html"));
    const missing = await checkLocal(base);
    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain("Falta el artefacto out/help.html.");
    await writeFile(join(base, "out/help.html"), "artifact");
    await writeFile(join(base, "vercel.json"), JSON.stringify({ outputDirectory: "out", rewrites: [] }));
    expect((await checkLocal(base)).errors).toContain("Falta el rewrite de Vercel para /help.");
  });

  it("accepts only a live v2 worker without active operational signals", async () => {
    const now = Date.parse("2026-09-27T12:00:00.000Z");
    const fetchImpl = async (url: URL, options: { headers: Record<string, string> }) => {
      expect(url.pathname).toBe("/rest/v1/rpc/operational_health_read");
      expect(options.headers.authorization).toBe("Bearer test-secret");
      return { ok: true, json: async () => ({ schema_contract: "20260927020000", worker: { pipeline_version: 2,
        state: "idle", last_seen_at: new Date(now - 30000).toISOString() }, alerts: [] }) };
    };
    const result = await checkRemote({ url: "https://sample.supabase.co", key: "test-secret", now, fetchImpl });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("blocks stale, mismatched or unhealthy remote deployments", async () => {
    const now = Date.parse("2026-09-27T12:00:00.000Z");
    const result = await checkRemote({ url: "https://sample.supabase.co", key: "test-secret", now,
      fetchImpl: async () => ({ ok: true, json: async () => ({ schema_contract: "20260927020000", worker: { pipeline_version: 1,
        state: "stopping", last_seen_at: new Date(now - 240000).toISOString() }, alerts: [{ code: "material_stalled" }] }) }) });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(4);
    const wrongSchema = await checkRemote({ url: "https://sample.supabase.co", key: "test-secret", now,
      fetchImpl: async () => ({ ok: true, json: async () => ({ schema_contract: "old", worker: {
        pipeline_version: 2, state: "idle", last_seen_at: new Date(now).toISOString() }, alerts: [] }) }) });
    expect(wrongSchema.errors).toContain("El esquema remoto no tiene el contrato de esta versión.");
    expect((await checkRemote({ url: "http://sample.supabase.co", key: "test-secret" })).ok).toBe(false);
    expect((await checkRemote({ url: "https://sample.supabase.co", key: "test-secret",
      fetchImpl: async () => ({ ok: false, status: 404 }) })).ok).toBe(false);
  });
});
