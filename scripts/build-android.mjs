import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyAndroidConfig } from "./verify-android-config.mjs";

const mobileDir = fileURLToPath(new URL("../apps/mobile/", import.meta.url));
const windows = process.platform === "win32";
const env = { ...process.env, EXPO_NO_TELEMETRY: "1" };
if (windows && !env.SHELL) env.SHELL = "powershell.exe";

function eas(...args) {
  // All arguments are fixed strings; no credentials are accepted or logged here.
  const result = spawnSync(
    windows ? "npx.cmd" : "npx",
    ["--yes", "eas-cli@23.2.0", ...args],
    { cwd: mobileDir, env, stdio: "inherit", shell: windows },
  );
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) {
    console.error("No se completo el paso. Corregi el error indicado y volve a ejecutar este archivo.");
    process.exit(result.status || 1);
  }
}

const local = await verifyAndroidConfig();
if (!local.ok) {
  for (const error of local.errors) console.error(error);
  process.exit(1);
}
console.log("Kusiy: APK de prueba conectado al backend.");
console.log("Inicia sesion en Expo en el navegador. No compartas tu contrasena por chat.");
eas("login", "--browser");
eas("init");
const linked = await verifyAndroidConfig({ requireProjectId: true });
if (!linked.ok) {
  for (const error of linked.errors) console.error(error);
  process.exit(1);
}
console.log("Si EAS pide una clave de firma Android nueva, acepta que la genere y la guarde.");
eas("build", "--platform", "android", "--profile", "preview", "--wait");
console.log("Abri el enlace de instalacion de EAS en Android y descarga el APK.");
