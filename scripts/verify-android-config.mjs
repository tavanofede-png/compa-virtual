import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mobile = resolve(root, "apps/mobile");

export async function verifyAndroidConfig({ requireProjectId = false } = {}) {
  const errors = [];
  const result = spawnSync(process.execPath, [resolve(mobile, "node_modules/expo/bin/cli"),
    "config", "--type", "public", "--json"], {
    cwd: mobile, encoding: "utf8", windowsHide: true,
    env: { ...process.env, EXPO_NO_TELEMETRY: "1" }, timeout: 30_000,
  });
  let config;
  try { config = JSON.parse(result.stdout); }
  catch { errors.push("Expo no pudo resolver la configuración nativa de Kusiy."); }
  if (result.status !== 0 || result.error) errors.push("La lectura de Expo terminó con error.");
  let eas;
  try { eas = JSON.parse(await readFile(resolve(mobile, "eas.json"), "utf8")); }
  catch { errors.push("Falta una configuración EAS válida."); }

  if (config) {
    if (config.slug !== "kusiy")
      errors.push("El proyecto Expo debe usar el slug kusiy.");
    if (config.android?.package !== "com.kusiy.estudio")
      errors.push("Android debe usar com.kusiy.estudio antes del primer build.");
    const schemes = Array.isArray(config.scheme) ? config.scheme : [config.scheme];
    if (!schemes.includes("kusiy") || !schemes.includes("compavirtual"))
      errors.push("Deben funcionar los enlaces kusiy y compavirtual.");
    if (config.runtimeVersion?.policy !== "appVersion")
      errors.push("Falta la política de runtime compatible con la versión nativa.");
    if (requireProjectId && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(config.extra?.eas?.projectId ?? ""))
      errors.push("EAS todavía no vinculó un proyecto Expo a esta app.");
  }
  if (eas) {
    if (eas.build?.preview?.android?.buildType !== "apk" || eas.build?.preview?.distribution !== "internal")
      errors.push("El perfil preview debe generar un APK de distribución interna.");
    if (eas.build?.beta?.distribution !== "store" || eas.build?.beta?.android?.buildType === "apk")
      errors.push("El perfil beta debe generar un AAB para Play.");
    if (eas.build?.preview?.channel !== "preview" || eas.build?.beta?.channel !== "beta")
      errors.push("Los canales de preview y beta deben quedar separados.");
    for (const profile of ["preview", "beta"]) {
      if (eas.build?.[profile]?.env?.EXPO_PUBLIC_DEMO_MODE !== "0" ||
          !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(eas.build?.[profile]?.env?.EXPO_PUBLIC_SUPABASE_URL ?? "") ||
          !eas.build?.[profile]?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY)
        errors.push(`El perfil ${profile} no tiene la configuración pública del backend.`);
    }
  }
  return { ok: errors.length === 0, errors, package: config?.android?.package ?? null,
    projectLinked: Boolean(config?.extra?.eas?.projectId) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyAndroidConfig({ requireProjectId: process.argv.includes("--eas") });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
