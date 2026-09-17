import { describe, it, expect, vi } from "vitest";
import {
  normalizeMeetUrl,
  collaborationCommandSchema,
  sessionLocalStart,
} from "../packages/domain/src/collaboration";
import { createCollaborationRepository } from "../packages/client/src/collaboration";
import { createDemo } from "../packages/client/src/index";
import { handleCollaboration } from "../packages/server/src/collaboration";
import type { SupabaseClient } from "@supabase/supabase-js";
const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
};
describe("collaboration boundaries", () => {
  it("accepts only canonical Google Meet meeting URLs", () => {
    expect(
      normalizeMeetUrl(" https://meet.google.com/abc-defg-hij?authuser=1#x "),
    ).toBe("https://meet.google.com/abc-defg-hij");
    for (const url of [
      "javascript:alert(1)",
      "https://meet.google.com.evil.test/abc-defg-hij",
      "http://meet.google.com/abc-defg-hij",
      "https://user@meet.google.com/abc-defg-hij",
      "https://meet.google.com/lookup/secret",
      "https://meet.google.com/abc-defg-hij/evil",
    ])
      expect(() => normalizeMeetUrl(url)).toThrow();
  });
  it("rejects forged actor fields", () => {
    expect(
      collaborationCommandSchema.safeParse({
        action: "group.create",
        name: "Grupo",
        user_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejects impossible days and daylight-saving gaps or overlaps", () => {
    expect(
      sessionLocalStart("2026-09-12", "18:00", "America/Buenos_Aires"),
    ).toBe("2026-09-12T21:00:00Z");
    expect(() => sessionLocalStart("2026-02-30", "10:00", "UTC")).toThrow();
    expect(() =>
      sessionLocalStart("2026-03-08", "02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      sessionLocalStart("2026-11-01", "01:30", "America/New_York"),
    ).toThrow();
  });
  it("uses the authenticated actor and keeps social eligibility independent of AI flags", async () => {
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status });
    const profile = {
      onboarding_complete: true,
      nickname: "Ana",
      birth_date: "2012-01-01",
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { state: { profile } }, error: null }),
    };
    const rpc = vi.fn(async () => ({ data: { enabled: true }, error: null }));
    const db = { from: () => chain, rpc } as unknown as SupabaseClient;
    const flags = {
      COLLABORATION_ENABLED: "true",
      MINOR_BETA_APPROVED: "true",
      SOCIAL_MINOR_BETA_APPROVED: "true",
    };
    const blocked = await handleCollaboration(
      db,
      flags,
      "verified-user",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect((await blocked.json()).enabled).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    profile.birth_date = "1990-01-01";
    await handleCollaboration(
      db,
      flags,
      "verified-user",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect(rpc).toHaveBeenLastCalledWith("collaboration_read", {
      p_user: "verified-user",
    });
    await expect(
      handleCollaboration(
        db,
        flags,
        "verified-user",
        {
          type: "collaboration.command",
          operationId: crypto.randomUUID(),
          payload: {
            action: "group.create",
            name: "Grupo",
            user_id: crypto.randomUUID(),
          },
        },
        json,
      ),
    ).rejects.toThrow();
  });
  it("retains idempotency across a lost response and a client restart", async () => {
    const cache = memory(),
      bodies: Record<string, unknown>[] = [];
    const request = vi.fn(async (body: Record<string, unknown>) => {
      bodies.push(body);
      if (bodies.length === 1) throw Error("offline");
      return { group_id: "saved" };
    });
    const input = { action: "group.create" as const, name: "Equipo" };
    await expect(
      createCollaborationRepository(request, cache, "a").command(input),
    ).rejects.toThrow();
    await createCollaborationRepository(request, cache, "a").command(input);
    expect(bodies[0].operationId).toBe(bodies[1].operationId);
    await createCollaborationRepository(request, cache, "a").command(input);
    expect(bodies[2].operationId).not.toBe(bodies[0].operationId);
    expect(await cache.getItem("compa-collaboration:a:pending")).toBe("[]");
    expect(createDemo(cache).collaboration).toBeUndefined();
  });
  it("fails closed without contacting the database when the flag is off", async () => {
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status });
    const result = await handleCollaboration(
      {} as SupabaseClient,
      {},
      "a",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect((await result.json()).enabled).toBe(false);
    const mutation = await handleCollaboration(
      {} as SupabaseClient,
      {},
      "a",
      { type: "collaboration.command", payload: {} },
      json,
    );
    expect(mutation.status).toBe(403);
  });
});
