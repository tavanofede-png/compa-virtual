import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLinkedServiceConfig } from "./supabase-linked-service.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const schemaContract = "20260927020000";

export async function checkLocalWorkerRemote({ url, key, now = Date.now(), fetchImpl = fetch }) {
  const errors = [];
  let endpoint;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) throw Error("invalid");
    endpoint = new URL("/rest/v1/rpc/operational_health_read", parsed);
  } catch {
    errors.push("Configurá SUPABASE_URL con el origen HTTPS del proyecto Supabase.");
  }
  if (!key) errors.push("Configurá SUPABASE_SERVICE_ROLE_KEY solo en el entorno local del worker.");
  if (errors.length) return { ok: false, errors };

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, errors: ["No se pudo consultar Supabase. Comprobá la conexión antes de iniciar el worker."] };
  }
  if (!response.ok) return { ok: false, errors: [`Supabase respondió HTTP ${response.status}; faltan migraciones o acceso.`] };
  let data;
  try { data = await response.json(); }
  catch { return { ok: false, errors: ["Supabase devolvió un estado operativo inválido."] }; }

  if (data?.schema_contract !== schemaContract)
    errors.push("El esquema remoto no tiene el contrato v2; no se inicia el worker.");
  const worker = data?.worker;
  if (worker) {
    const age = now - Date.parse(worker.last_seen_at);
    if (Number.isFinite(age) && age >= -30000 && age <= 180000 &&
        ["idle", "processing"].includes(worker.state))
      errors.push("Ya hay un worker de materiales activo. Detenelo antes de iniciar otro.");
  }
  return { ok: errors.length === 0, errors };
}

async function main() {
  if (process.argv.includes("--linked")) {
    const linked = await loadLinkedServiceConfig();
    process.env.SUPABASE_URL = linked.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = linked.key;
  }
  const status = await checkLocalWorkerRemote({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!status.ok) {
    for (const error of status.errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.info("Esquema v2 confirmado. Iniciando un worker local; mantené esta terminal abierta.");
  const require = createRequire(import.meta.url);
  const cli = require.resolve("tsx/cli");
  const child = spawn(process.execPath, [cli, resolve(root, "apps/worker/src/index.ts")], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("error", () => { console.error("No se pudo iniciar el worker local."); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
