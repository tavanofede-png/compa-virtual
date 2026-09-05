import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("../..");
for (const name of ["api", "reminders"]) {
  const directory = resolve(root, "supabase/functions", name);
  await mkdir(directory, { recursive: true });
  await build({
    stdin: {
      contents: `import {create${name === "api" ? "Handler" : "ReminderHandler"}} from './src/${name === "api" ? "handler" : "reminders"}'; Deno.serve(create${name === "api" ? "Handler" : "ReminderHandler"}(Deno.env.toObject()));`,
      resolveDir: process.cwd(),
      sourcefile: "entry.ts",
      loader: "ts",
    },
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
