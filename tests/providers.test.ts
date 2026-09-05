import { it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { OpenAIProvider, estimateUsageCost } from "../packages/server/src/ai";
import { createRequire } from "node:module";
import { dueReminders, demoSnapshot } from "../packages/domain/src/index";
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
      onUsage: usage,
    });
  expect(
    await ai.structured("test", "Tutor", {}, z.object({ answer: z.string() })),
  ).toEqual({ answer: "Una pista" });
  expect(captured.store).toBe(false);
  expect(captured.model).toBe("gpt-6-astra");
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
it("respects local quiet time, weekends and occupied schedules for reminders", () => {
  const s = demoSnapshot();
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
