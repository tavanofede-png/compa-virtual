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
    let granted = false;
    const rpc = vi.fn(async (name: string) => ({
      data: name === "family_capability_allowed" ? granted
        : name === "collaboration_group_sessions" ? []
        : { enabled: true, sessions: [] },
      error: null,
    }));
    const db = { from: () => chain, rpc } as unknown as SupabaseClient;
    const flags = {
      COLLABORATION_ENABLED: "true",
      MINOR_BETA_APPROVED: "true",
      SOCIAL_MINOR_BETA_APPROVED: "false",
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
    flags.SOCIAL_MINOR_BETA_APPROVED = "true";
    const awaitingFamily = await handleCollaboration(
      db,
      flags,
      "verified-user",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect((await awaitingFamily.json()).enabled).toBe(false);
    expect(rpc).toHaveBeenLastCalledWith("family_capability_allowed", {
      p_user: "verified-user",
      p_policy: "kusiy-beta-nov-2026",
      p_capability: "social",
    });
    granted = true;
    const permitted = await handleCollaboration(
      db,
      flags,
      "verified-user",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect((await permitted.json()).enabled).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("collaboration_group_sessions", { p_user: "verified-user" });
    granted = false;
    const revoked = await handleCollaboration(
      db, flags, "verified-user",
      { type: "collaboration.command", operationId: crypto.randomUUID(), payload: { action: "group.create", name: "Equipo" } },
      json,
    );
    expect(revoked.status).toBe(403);
    expect(rpc).toHaveBeenLastCalledWith("family_capability_allowed", {
      p_user: "verified-user", p_policy: "kusiy-beta-nov-2026", p_capability: "social",
    });
    profile.birth_date = "1990-01-01";
    await handleCollaboration(
      db,
      flags,
      "verified-user",
      { type: "collaboration.overview", payload: {} },
      json,
    );
    expect(rpc).toHaveBeenLastCalledWith("collaboration_group_sessions", {
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
  it("reuses a chat operation after a lost response without storing conversation content after confirmation", async () => {
    const cache = memory(), calls: Record<string, unknown>[] = [];
    const request = async (input: Record<string, unknown>) => {
      calls.push(input);
      if (calls.length === 1) throw Error("offline");
      return { message_id: crypto.randomUUID(), status: "visible" };
    };
    const session = crypto.randomUUID();
    await expect(createCollaborationRepository(request, cache, "chat-user")
      .chatSend(session, "¿Repasamos?")).rejects.toThrow("offline");
    await createCollaborationRepository(request, cache, "chat-user")
      .chatSend(session, "¿Repasamos?");
    expect(calls[0].operationId).toBe(calls[1].operationId);
    expect(await cache.getItem("compa-collaboration:chat-user:pending")).toBe("[]");
  });
  it("keeps chat read-only until moderation and minor approval are enabled", async () => {
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    const chain = { select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: { state: { profile: {
        onboarding_complete: true, nickname: "Ana", birth_date: "1990-01-01",
      } } }, error: null }),
    };
    const rpc = vi.fn(async (name: string) => ({ data: name === "collaboration_chat_read"
      ? { messages: [], next_cursor: null } : name === "social_chat_writable" ? true : {}, error: null }));
    const db = { from: () => chain, rpc } as unknown as SupabaseClient;
    const session = crypto.randomUUID();
    const env = { COLLABORATION_ENABLED: "true", SOCIAL_CHAT_ENABLED: "true",
      SOCIAL_CHAT_MODERATION_READY: "false" };
    const page = await handleCollaboration(db, env, "adult", {
      type: "collaboration.chat.page", payload: { session_id: session },
    }, json);
    expect((await page.json()).enabled).toBe(false);
    const blocked = await handleCollaboration(db, env, "adult", {
      type: "collaboration.chat.send", payload: { session_id: session, body: "Hola" },
      operationId: crypto.randomUUID(),
    }, json);
    expect(blocked.status).toBe(403);
    expect(rpc).not.toHaveBeenCalledWith("collaboration_chat_send", expect.anything());
    env.SOCIAL_CHAT_MODERATION_READY = "true";
    await handleCollaboration(db, env, "adult", {
      type: "collaboration.chat.send", payload: { session_id: session, body: "Hola" },
      operationId: crypto.randomUUID(),
    }, json);
    expect(rpc).toHaveBeenCalledWith("collaboration_chat_send", expect.objectContaining({
      p_session: session, p_body: "Hola", p_user: "adult",
    }));
  });
  it("keeps legacy call links out of student session responses and commands", async () => {
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status });
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { state: { profile: {
        onboarding_complete: true, nickname: "Ana", birth_date: "1990-01-01",
      } } }, error: null }),
    };
    const rpc = vi.fn(async (name: string) => ({
      data: name === "collaboration_read"
        ? { meeting_url: "https://meet.google.com/abc-defg-hij", session: { id: "one" } }
        : { session_id: "one" },
      error: null,
    }));
    const db = { from: () => chain, rpc } as unknown as SupabaseClient;
    const env = { COLLABORATION_ENABLED: "true" };
    const read = await handleCollaboration(db, env, "adult", {
      type: "collaboration.session", payload: { session_id: crypto.randomUUID() },
    }, json);
    expect((await read.json()).meeting_url).toBeNull();
    await handleCollaboration(db, env, "adult", {
      type: "collaboration.command", operationId: crypto.randomUUID(),
      payload: {
        action: "session.create", group_id: null, title: "Repaso", objective: "Practicar",
        session_type: "review", space_template_id: "study",
        scheduled_start_at: new Date(Date.now() + 60_000).toISOString(),
        timezone: "America/Argentina/Buenos_Aires", planned_duration: 45,
        meeting_url: "https://meet.google.com/abc-defg-hij",
      },
    }, json);
    expect(rpc).toHaveBeenLastCalledWith("collaboration_command", expect.objectContaining({
      p_command: expect.objectContaining({ meeting_url: null }),
    }));
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
