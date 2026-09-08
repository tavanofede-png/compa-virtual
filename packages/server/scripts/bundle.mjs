import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../..");

for (const name of ["api", "reminders"]) {
  const directory = resolve(root, "supabase/functions", name);
  await mkdir(directory, { recursive: true });
  await build({
    entryPoints: [resolve(scriptDirectory, `${name}.entry.mjs`)],
    outfile: resolve(directory, "index.ts"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2022",
    alias: { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.115.0" },
    external: ["npm:*"],
    logLevel: "info",
  });
  await writeFile(
    resolve(directory, "deno.json"),
    JSON.stringify({ compilerOptions: { lib: ["deno.window"] } }),
  );
}
