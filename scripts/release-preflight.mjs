import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLinkedServiceConfig } from "./supabase-linked-service.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedPipeline = 2;
const expectedSchemaContract = "20260927020000";
export const requiredReleaseArtifacts = [
  "out/index.html", "out/admin.html", "out/family.html", "out/help.html",
  "supabase/functions/api/index.ts", "supabase/functions/material-process/index.ts",
  "supabase/functions/reminders/index.ts", "supabase/functions/family-consent/index.ts",
  "supabase/functions/voice/index.ts", "apps/worker/Dockerfile", "apps/worker/src/index.ts",
  "supabase/migrations/20260926031249_material_recovery.sql",
  "supabase/migrations/20260926041800_voice_quota.sql",
  "supabase/migrations/20260926143000_group_session_join.sql",
  "supabase/migrations/20260926153000_one_active_shared_room.sql",
  "supabase/migrations/20260926160000_shared_room_host_recovery.sql",
  "supabase/migrations/20260926173000_private_meeting_chat.sql",
  "supabase/migrations/20260927010000_support_tickets.sql",
  "supabase/migrations/20260927020000_operational_health.sql",
  "supabase/migrations/20260927030000_operational_material_failures.sql",
  "render.yaml", "vercel.json", "package.json", "scripts/worker-local.mjs",
];

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function checkLocal(base = root) {
  const errors = [];
  const files = {};
  for (const name of requiredReleaseArtifacts) {
    try {
      const path = resolve(base, name);
      const info = await stat(path);
      if (!info.isFile() || info.size === 0) throw Error("missing");
      files[name] = digest(await readFile(path));
    } catch { errors.push(`Falta el artefacto ${name}.`); }
  }
  try {
    const config = JSON.parse(await readFile(resolve(base, "vercel.json"), "utf8"));
    if (config.outputDirectory !== "out") errors.push("Vercel debe publicar el export out.");
    for (const route of ["admin", "family", "help"])
      if (!config.rewrites?.some((rule) => rule.source === `/${route}` && rule.destination === `/${route}.html`))
        errors.push(`Falta el rewrite de Vercel para /${route}.`);
  } catch { errors.push("No se pudo leer la configuración de Vercel."); }
  const fingerprint = digest(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, hash]) => `${name}:${hash}`).join("\n"));
  return { ok: errors.length === 0, errors, fingerprint, files };
}

export async function checkRemote({ url, key, now = Date.now(), fetchImpl = fetch }) {
  if (!url || !key) return { ok: false, errors: ["Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."], worker: null, activeAlerts: null };
  let endpoint;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) throw Error("invalid");
    endpoint = new URL("/rest/v1/rpc/operational_health_read", parsed);
  } catch {
    return { ok: false, errors: ["SUPABASE_URL debe ser el origen HTTPS de un proyecto Supabase."], worker: null, activeAlerts: null };
  }
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, errors: ["No se pudo consultar el estado remoto de Supabase."], worker: null, activeAlerts: null };
  }
  if (!response.ok) return { ok: false, errors: [`La consulta remota respondió HTTP ${response.status}.`], worker: null, activeAlerts: null };
  let data;
  try { data = await response.json(); }
  catch { return { ok: false, errors: ["La consulta remota devolvió una respuesta inválida."], worker: null, activeAlerts: null }; }
  const errors = [];
  if (data?.schema_contract !== expectedSchemaContract) errors.push("El esquema remoto no tiene el contrato de esta versión.");
  const worker = data?.worker;
  if (!worker) errors.push("No hay latido del worker de materiales.");
  else {
    if (worker.pipeline_version !== expectedPipeline) errors.push("El worker remoto no ejecuta el pipeline v2.");
    const age = now - Date.parse(worker.last_seen_at);
    if (!Number.isFinite(age) || age < -30000 || age > 180000) errors.push("El latido del worker remoto no está vigente.");
    if (!["idle", "processing"].includes(worker.state)) errors.push("El worker remoto no está disponible.");
  }
  if (!Array.isArray(data?.alerts)) errors.push("No se pudo comprobar la lista de señales operativas.");
  else if (data.alerts.length) errors.push("Hay señales operativas activas que requieren revisión antes de promover la web.");
  return { ok: errors.length === 0, errors,
    worker: worker ? { pipelineVersion: worker.pipeline_version, state: worker.state, lastSeenAt: worker.last_seen_at } : null,
    activeAlerts: Array.isArray(data?.alerts) ? data.alerts.map((alert) => alert.code) : null };
}

async function main() {
  const remote = process.argv.includes("--remote");
  const local = await checkLocal();
  const linked = remote && process.argv.includes("--linked") ? await loadLinkedServiceConfig() : null;
  const result = remote ? await checkRemote({ url: linked?.url ?? process.env.SUPABASE_URL,
    key: linked?.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY }) : null;
  const summary = { ok: local.ok && (!remote || result?.ok), local, remote: result };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
