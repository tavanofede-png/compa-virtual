import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const names = [
  "AI_PROVIDER",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AI_MODEL",
  "CLOUDFLARE_AI_EMBEDDING_MODEL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "EXPO_ACCESS_TOKEN",
];

function present(name) {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

function failClosed(source, text) {
  if (
    !/^MINOR_BETA_APPROVED=false$/m.test(text) &&
    !/value:\s*"false"/.test(text)
  ) {
    throw new Error(source + " no deja MINOR_BETA_APPROVED=false");
  }
  if (/^MINOR_BETA_APPROVED=true$/m.test(text)) {
    throw new Error(
      source + " tiene MINOR_BETA_APPROVED=true; Gate 0 lo prohibe",
    );
  }
}

const example = readFileSync(resolve(root, ".env.example"), "utf8");
const render = readFileSync(resolve(root, "render.yaml"), "utf8");
failClosed(".env.example", example);
if (!/key:\s*MINOR_BETA_APPROVED\s*\n\s*value:\s*"false"/.test(render)) {
  throw new Error("render.yaml no fija MINOR_BETA_APPROVED=false");
}
if (!/key:\s*AI_PROVIDER\s*\n\s*value:\s*cloudflare/.test(render)) {
  throw new Error("render.yaml no fija AI_PROVIDER=cloudflare");
}

const localEnvFiles = [
  resolve(root, ".env"),
  resolve(root, "apps/worker/.env"),
];
const localEnvExists = localEnvFiles
  .filter((path) => existsSync(path))
  .map((path) => path.slice(root.length + 1));

console.log(
  JSON.stringify(
    {
      gate: "0",
      status: "LOCAL_STATIC_CHECKS_PASSED_REMOTE_AND_LEGAL_UNVERIFIED",
      minor_beta_approved: false,
      ai_provider: "cloudflare",
      local_env_files_present: localEnvExists,
      process_env_present: Object.fromEntries(
        names.map((name) => [name, present(name)]),
      ),
      user_actions_required: [
        "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Supabase Edge secrets and Render (never in EXPO_PUBLIC_/NEXT_PUBLIC_)",
        "Create Render worker from render.yaml (Virginia, Docker, secrets listed in docs/GATE0.md)",
        "Set Vault secrets and run supabase/schedule.sql, then POST /functions/v1/reminders",
        "eas login --browser, then node scripts/build-android.mjs for the internal APK",
        "Keep MINOR_BETA_APPROVED=false until explicit authorization",
      ],
    },
    null,
    2,
  ),
);
