import { it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  CloudflareAIProvider,
  OpenAIProvider,
  createAIProvider,
  estimateUsageCost,
  isAIProviderConfigured,
} from "../packages/server/src/ai";
import { createRequire } from "node:module";
import { dueReminders, demoSnapshot, transition, resolveNotificationIntent, resolveNotificationLaunch } from "../packages/domain/src/index";
afterEach(() => vi.unstubAllGlobals());
it("keeps Expo's namespace URL API compatible after the security update", () => {
  const mobileRequire = createRequire(
    new URL("../apps/mobile/package.json", import.meta.url),
  );
  const routerRequire = createRequire(
    mobileRequire.resolve("expo-router/package.json"),
  );
  const query = routerRequire("query-string");
  expect(query.parse("view=study&topic=c%C3%A9lula")).toEqual({
    view: "study",
    topic: "célula",
  });
  expect(query.stringify({ view: "study" })).toBe("view=study");
  expect(typeof query.parse("topic=" + "%C0".repeat(1000)).topic).toBe(
    "string",
  );
});
it("records unknown prices as null and uses a separate embedding rate", () => {
  const usage = { purpose: "embedding", input_tokens: 1000, output_tokens: 0 };
  expect(
    estimateUsageCost(usage, {
      AI_INPUT_USD_PER_MILLION: "5",
      AI_OUTPUT_USD_PER_MILLION: "20",
    }),
  ).toBeNull();
  expect(
    estimateUsageCost(usage, { AI_EMBEDDING_USD_PER_MILLION: "0.02" }),
  ).toBeCloseTo(0.00002);
});
it("uses Responses structured outputs without provider conversation persistence", async () => {
  let captured: Record<string, unknown> = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      captured = JSON.parse(options.body);
      return Response.json({
        status: "completed",
        output: [
          {
            content: [{ type: "output_text", text: '{"answer":"Una pista"}' }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    }),
  );
  const usage = vi.fn(async () => {}),
    ai = new OpenAIProvider({
      key: "unit-test-only",
      model: "gpt-6-astra",
      embeddingModel: "text-embedding-3-small",
      safetyIdentifier: "anonymous-user-hash",
      onUsage: usage,
    });
  expect(
    await ai.structured("test", "Tutor", {}, z.object({ answer: z.string() })),
  ).toEqual({ answer: "Una pista" });
  expect(captured.store).toBe(false);
  expect(captured.model).toBe("gpt-6-astra");
  expect(captured.safety_identifier).toBe("anonymous-user-hash");
  expect(captured.prompt_cache_key).toBe("anonymous-user-hash");
  expect(captured).not.toHaveProperty("conversation");
  expect(usage).toHaveBeenCalledOnce();
});
it("rejects incomplete or refused provider output instead of inventing content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ status: "incomplete", output: [] })),
  );
  const ai = new OpenAIProvider({
    key: "unit-test-only",
    model: "gpt-6-astra",
    embeddingModel: "text-embedding-3-small",
  });
  await expect(
    ai.structured("test", "Tutor", {}, z.object({ answer: z.string() })),
  ).rejects.toThrow("incompleta");
});
it("uses one server-side Cloudflare token for structured output", async () => {
  let url = "",
    authorization = "",
    captured: Record<string, unknown> = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, options) => {
      url = String(input);
      authorization = new Headers(options.headers).get("authorization") ?? "";
      captured = JSON.parse(options.body);
      return Response.json({
        choices: [{ message: { content: '{"answer":"Probemos juntos"}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      });
    }),
  );
  const usage = vi.fn(async () => {});
  const ai = new CloudflareAIProvider({
    accountId: "account-for-test",
    token: "shared-server-token",
    model: "@cf/zai-org/glm-4.7-flash",
    embeddingModel: "@cf/baai/bge-m3",
    visionModel: "@cf/meta/llama-3.2-11b-vision-instruct",
    onUsage: usage,
  });
  expect(
    await ai.structured("chat", "Tutor", {}, z.object({ answer: z.string() })),
  ).toEqual({ answer: "Probemos juntos" });
  expect(url).toContain("/accounts/account-for-test/ai/v1/chat/completions");
  expect(authorization).toBe("Bearer shared-server-token");
  expect(captured.response_format).toMatchObject({ type: "json_schema" });
  expect(usage).toHaveBeenCalledOnce();
});
it("pads multilingual Cloudflare embeddings to the database dimension", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: [{ index: 0, embedding: [0.25, 0.75] }],
        usage: { prompt_tokens: 2, total_tokens: 2 },
      }),
    ),
  );
  const ai = new CloudflareAIProvider({
    accountId: "account-for-test",
    token: "shared-server-token",
    model: "@cf/zai-org/glm-4.7-flash",
    embeddingModel: "@cf/baai/bge-m3",
    visionModel: "@cf/meta/llama-3.2-11b-vision-instruct",
    vectorDimensions: 4,
  });
  expect(await ai.embed(["biología celular"])).toEqual([[0.25, 0.75, 0, 0]]);
});
it("selects Cloudflare only when its shared server credentials are complete", () => {
  const env = {
    AI_PROVIDER: "cloudflare",
    CLOUDFLARE_ACCOUNT_ID: "account-for-test",
    CLOUDFLARE_API_TOKEN: "shared-server-token",
  };
  expect(isAIProviderConfigured(env)).toBe(true);
  expect(createAIProvider(env)).toBeInstanceOf(CloudflareAIProvider);
  expect(isAIProviderConfigured({ ...env, CLOUDFLARE_API_TOKEN: "" })).toBe(
    false,
  );
});
it("respects local quiet time, weekends and occupied schedules for reminders", () => {
  const s = demoSnapshot();
  s.preferences.checkin_enabled = true;
  expect(dueReminders(s, "2026-09-07T21:00:00Z").map((x) => x.id)).toContain(
    "checkin",
  );
  expect(dueReminders(s, "2026-09-06T21:00:00Z")).toHaveLength(0);
  expect(dueReminders(s, "2026-09-08T02:00:00Z")).toHaveLength(0);
  s.blocks.push({
    id: "busy",
    label: "Inglés",
    kind: "BUSY",
    day_of_week: 1,
    start_minute: 1050,
    end_minute: 1200,
  });
  expect(dueReminders(s, "2026-09-07T21:00:00Z")).toHaveLength(0);
  expect(dueReminders(s, "2026-09-07T23:00:00Z").map((x) => x.id)).toContain(
    "checkin",
  );
});
it("offers an opted-in daily study reminder only before studying that local day", () => {
  const s = demoSnapshot();
  s.preferences.daily_study_enabled = true;
  s.preferences.daily_study_minute = 1020;
  s.preferences.checkin_enabled = true;
  const instant = "2026-09-07T20:05:00Z";
  expect(dueReminders(s, instant).map((reminder) => reminder.id)).toContain(
    "daily-study",
  );
  expect(dueReminders(s, instant).map((reminder) => reminder.id)).not.toContain(
    "checkin",
  );
  s.sessions.push({
    id: "completed-today",
    method_id: "retrieval",
    duration_minutes: 20,
    reflection: "",
    completed_at: "2026-09-07T19:00:00Z",
  });
  expect(dueReminders(s, instant).map((reminder) => reminder.id)).not.toContain(
    "daily-study",
  );
});
it("snoozes an explicit notice once and keeps it due on a weekend", () => {
  const s = demoSnapshot();
  s.preferences.weekends = false;
  s.notifications.push({
    id: "daily-study:2026-09-06",
    title: "Tu momento de estudio",
    body: "Podés empezar un repaso libre.",
    route: "study",
    created_at: "2026-09-06T17:00:00Z",
  });
  const first = transition(s, {
    type: "notification.snooze",
    payload: { id: "daily-study:2026-09-06", minutes: 30 },
  }, "2026-09-06T17:00:00Z");
  expect(first.notifications.at(-1)?.read_at).toBeTruthy();
  const reminder = first.studyReminders.find((r) => r.snoozed_from === "daily-study:2026-09-06");
  expect(reminder?.date).toBe("2026-09-06");
  expect(reminder?.minute).toBe(14 * 60 + 30);
  expect(dueReminders(first, "2026-09-06T17:30:00Z").map((r) => r.id)).toContain(`custom:${reminder?.id}`);
  const second = transition(first, {
    type: "notification.snooze",
    payload: { id: "daily-study:2026-09-06", minutes: 60 },
  }, "2026-09-06T17:00:00Z");
  expect(second.studyReminders.filter((r) => r.snoozed_from === "daily-study:2026-09-06")).toHaveLength(1);
  expect(second.studyReminders.find((r) => r.id === reminder?.id)?.minute).toBe(15 * 60);
});
it("moves a snoozed notice past quiet hours instead of losing it", () => {
  const s = demoSnapshot();
  s.preferences.quiet_start = 22 * 60;
  s.preferences.quiet_end = 8 * 60;
  s.notifications.push({
    id: "late-notice",
    title: "Repaso",
    body: "Podés volver cuando quieras.",
    route: "study",
    created_at: "2026-09-07T00:45:00Z",
  });
  const next = transition(s, {
    type: "notification.snooze",
    payload: { id: "late-notice", minutes: 30 },
  }, "2026-09-07T00:45:00Z");
  const reminder = next.studyReminders.find((r) => r.snoozed_from === "late-notice");
  expect(reminder?.date).toBe("2026-09-07");
  expect(reminder?.minute).toBeGreaterThanOrEqual(8 * 60);
  expect(dueReminders(next, "2026-09-07T11:00:00Z").map((r) => r.id)).toContain(`custom:${reminder?.id}`);
});
it("opens a push destination only while its server-side activity is still pending", () => {
  const s = demoSnapshot();
  const item = s.items[0];
  item.status = "PENDING";
  item.due_date = "2026-09-07";
  const id = `item:${item.id}:2026-09-07`;
  s.notifications.push({
    id,
    title: "Tu agenda",
    body: "Se acerca una actividad.",
    route: "agenda",
    created_at: "2026-09-07T20:00:00Z",
  });
  expect(resolveNotificationIntent(s, id, "agenda", "2026-09-07T20:10:00Z")).toBe("agenda");
  expect(resolveNotificationIntent(s, id, "study", "2026-09-07T20:10:00Z")).toBeNull();
  expect(resolveNotificationIntent(s, id, "agenda", "2026-09-09T20:10:00Z")).toBeNull();
  item.status = "DONE";
  expect(resolveNotificationIntent(s, id, "agenda", "2026-09-07T20:10:00Z")).toBeNull();
});
it("opens daily and scheduled reminders in a prepared study session", () => {
  const s = demoSnapshot(), now = "2026-09-07T20:10:00Z";
  s.notifications.push({ id: "daily-study:2026-09-07", title: "Estudiar", body: "Repasar",
    route: "study", created_at: "2026-09-07T20:00:00Z" });
  expect(resolveNotificationLaunch(s, "daily-study:2026-09-07", "study", now))
    .toMatchObject({ target: "study", focus: true });
  const slot = { id: crypto.randomUUID(), academic_item_id: "item-1", date: "2026-09-07",
    start_minute: 17 * 60, duration_minutes: 25, method_id: "retrieval",
    objective: "Repasar límites", status: "PENDING" as const };
  s.plans.push({ id: crypto.randomUUID(), status: "ACCEPTED", version: 1, slots: [slot],
    unscheduled: [], created_at: now });
  const id = `session:${slot.id}:2026-09-07`;
  s.notifications.push({ id, title: "Tu bloque", body: "Repasar",
    route: "today", created_at: "2026-09-07T20:00:00Z" });
  expect(resolveNotificationLaunch(s, id, "today", now))
    .toMatchObject({ target: "study", focus: true, slot });
  s.plans.at(-1)!.slots[0].status = "COMPLETE";
  expect(resolveNotificationLaunch(s, id, "today", now)).toBeNull();
});
