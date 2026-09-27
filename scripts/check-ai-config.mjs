import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const candidate of [resolve(".env"), resolve("apps/worker/.env")])
  if (existsSync(candidate)) process.loadEnvFile(candidate);

const provider = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();
if (!["openai", "cloudflare"].includes(provider)) {
  console.error("AI_PROVIDER debe ser openai o cloudflare.");
  process.exit(1);
}
const required = [
  "AI_INPUT_USD_PER_MILLION",
  "AI_OUTPUT_USD_PER_MILLION",
  "AI_EMBEDDING_USD_PER_MILLION",
  ...(provider === "cloudflare"
    ? [
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_AI_MODEL",
        "CLOUDFLARE_AI_EMBEDDING_MODEL",
        "CLOUDFLARE_AI_VISION_MODEL",
        "AI_VECTOR_DIMENSIONS",
      ]
    : ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMBEDDING_MODEL"]),
];
const missing = required.filter((name) => !process.env[name]?.trim());
const exposed = Object.keys(process.env).filter(
  (name) =>
    /^(NEXT_PUBLIC|EXPO_PUBLIC)_(OPENAI_API_KEY|CLOUDFLARE_API_TOKEN)$/.test(
      name,
    ) && process.env[name]?.trim(),
);
if (exposed.length) {
  console.error(
    "La clave del proveedor de IA no puede estar en variables públicas:",
    exposed.join(", "),
  );
  process.exit(1);
}
if (missing.length) {
  console.error("Configuración de IA incompleta:", missing.join(", "));
  console.error(
    "Copiá .env.example a .env y agregá la clave únicamente en el servidor.",
  );
  process.exit(1);
}
const budget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 50);
if (!Number.isFinite(budget) || budget <= 0) {
  console.error("AI_MONTHLY_BUDGET_USD debe ser un número positivo.");
  process.exit(1);
}
console.log(
  JSON.stringify({
    ready: true,
    provider,
    model:
      provider === "cloudflare"
        ? process.env.CLOUDFLARE_AI_MODEL
        : process.env.OPENAI_MODEL,
    embeddingModel:
      provider === "cloudflare"
        ? process.env.CLOUDFLARE_AI_EMBEDDING_MODEL
        : process.env.OPENAI_EMBEDDING_MODEL,
    monthlyBudgetUsd: budget,
    voiceProvider: process.env.VOICE_PROVIDER ?? "system",
    key: "configured",
  }),
);
