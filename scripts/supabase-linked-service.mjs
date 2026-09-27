import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function linkedServiceConfig(projectRef, response) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw Error("El proyecto Supabase vinculado no es válido.");
  const key = response?.keys?.find((item) => item.type === "legacy" && item.name === "service_role")?.api_key;
  if (typeof key !== "string" || !key.startsWith("eyJ"))
    throw Error("No se encontró la clave de servicio del proyecto vinculado.");
  return { url: `https://${projectRef}.supabase.co`, key };
}

async function findCli(base) {
  const cache = resolve(base, "work/npm-cache/_npx");
  const entries = await readdir(cache, { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = resolve(cache, entry.name, "node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
    if (await stat(candidate).then((item) => item.isFile()).catch(() => false)) matches.push(candidate);
  }
  if (matches.length !== 1) throw Error("No se encontró una única CLI de Supabase; configurá el worker con .env.");
  return matches[0];
}

export async function loadLinkedServiceConfig(base = root) {
  const projectRef = (await readFile(resolve(base, "supabase/.temp/project-ref"), "utf8")).trim();
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw Error("El proyecto Supabase vinculado no es válido.");
  const cli = await findCli(base);
  const result = spawnSync(cli, ["projects", "api-keys", "--project-ref", projectRef,
    "--reveal", "--output-format", "json"], { cwd: base, encoding: "utf8",
    maxBuffer: 200_000, timeout: 30_000, windowsHide: true });
  if (result.status !== 0 || result.error) throw Error("No se pudo leer la clave del proyecto Supabase vinculado.");
  let data;
  try { data = JSON.parse(result.stdout); }
  catch { throw Error("Supabase devolvió una respuesta inválida al leer la clave."); }
  return linkedServiceConfig(projectRef, data);
}
