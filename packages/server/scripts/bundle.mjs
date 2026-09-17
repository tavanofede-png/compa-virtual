import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "../../..");
// Resolve through Node so the Windows sandbox need not enumerate parent homes.
const sourceFiles = {
  name: "explicit-source-files",
  setup(context) {
    context.onResolve({ filter: /.*/ }, (args) => {
      if (args.path === "@supabase/supabase-js")
        return { path: "npm:@supabase/supabase-js@2.115.0", external: true };
      if (args.path.startsWith("npm:"))
        return { path: args.path, external: true };
      const from = args.importer || resolve(root, "package.json");
      const candidate = isAbsolute(args.path)
        ? args.path
        : args.path.startsWith(".")
          ? resolve(dirname(from), args.path)
          : args.path;
      const path =
        isAbsolute(candidate) &&
        !extname(candidate) &&
        existsSync(candidate + ".ts")
          ? candidate + ".ts"
          : createRequire(from).resolve(candidate);
      return { path, namespace: "source-files" };
    });
    context.onLoad(
      { filter: /.*/, namespace: "source-files" },
      async ({ path }) => ({
        contents: await readFile(path, "utf8"),
        loader:
          extname(path) === ".ts"
            ? "ts"
            : extname(path) === ".json"
              ? "json"
              : "js",
      }),
    );
  },
};

for (const name of ["api", "reminders"]) {
  const directory = resolve(root, "supabase/functions", name);
  await mkdir(directory, { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(scriptDirectory, `${name}.entry.mjs`)],
    tsconfigRaw: { compilerOptions: { target: "es2022" } },
    plugins: [sourceFiles],
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
