import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { createReminderHandler } from "../packages/server/src/reminders";

const exampleEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-not-used",
  CRON_SECRET: "cron-test-secret",
};

it("rejects reminder runs without the cron bearer", async () => {
  const handler = createReminderHandler(exampleEnv);
  const res = await handler(new Request("https://fn.example/reminders"));
  expect(res.status).toBe(401);
});

it("rejects reminder runs with the wrong bearer or a missing secret", async () => {
  const handler = createReminderHandler(exampleEnv);
  const wrong = await handler(
    new Request("https://fn.example/reminders", {
      method: "POST",
      headers: { Authorization: "Bearer other" },
    }),
  );
  expect(wrong.status).toBe(401);
  const unconfigured = createReminderHandler({
    ...exampleEnv,
    CRON_SECRET: "",
  });
  const empty = await unconfigured(
    new Request("https://fn.example/reminders", {
      method: "POST",
      headers: { Authorization: "Bearer cron-test-secret" },
    }),
  );
  expect(empty.status).toBe(401);
});

it("keeps MINOR_BETA_APPROVED fail-closed in deploy templates", () => {
  const example = readFileSync(".env.example", "utf8");
  expect(example).toMatch(/^MINOR_BETA_APPROVED=false$/m);
  expect(example).not.toMatch(/^MINOR_BETA_APPROVED=true$/m);
  const render = readFileSync("render.yaml", "utf8");
  expect(render).toMatch(/key:\s*MINOR_BETA_APPROVED\s*\n\s*value:\s*"false"/);
  expect(render).toMatch(/key:\s*OPENAI_ZDR_VERIFIED\s*\n\s*value:\s*"false"/);
  expect(render).toMatch(
    /key:\s*AI_MINOR_DATA_APPROVED\s*\n\s*value:\s*"false"/,
  );
  expect(render).toMatch(/key:\s*AI_PROVIDER\s*\n\s*value:\s*cloudflare/);
});

it("schedules reminders every five minutes with vault secrets", () => {
  const sql = readFileSync("supabase/schedule.sql", "utf8");
  expect(sql).toContain("compa-reminders");
  expect(sql).toContain("*/5 * * * *");
  expect(sql).toContain("compa_functions_url");
  expect(sql).toContain("compa_cron_secret");
  expect(sql).toContain("/functions/v1/reminders");
  expect(sql).toContain("compa-chat-retention");
});
