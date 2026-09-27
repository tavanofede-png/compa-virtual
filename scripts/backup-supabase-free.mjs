import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encryptToFile, verifyEncryptedFile } from "./backup-crypto.mjs";
import { readPassphraseTwice } from "./backup-prompt.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireWorker = createRequire(pathToFileURL(resolve(root, "apps/worker/package.json")));
const { createClient } = requireWorker("@supabase/supabase-js");

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

async function findCli(explicit) {
  if (explicit) {
    if (!isAbsolute(explicit) || !(await stat(explicit)).isFile()) throw Error("La ruta de la CLI no es un archivo absoluto válido.");
    return explicit;
  }
  const cache = resolve(root, "work/npm-cache/_npx");
  const entries = await readdir(cache, { withFileTypes: true }).catch(() => []);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = resolve(cache, entry.name, "node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
    if (await stat(candidate).then((item) => item.isFile()).catch(() => false)) matches.push(candidate);
  }
  if (matches.length !== 1) throw Error("No se encontró una única CLI de Supabase en el caché; indicá --cli RUTA_ABSOLUTA.");
  return matches[0];
}

function runCli(cli, args, { pipeOutput = false } = {}) {
  const child = spawn(cli, args, { cwd: root,
    stdio: ["inherit", "pipe", pipeOutput ? "inherit" : "pipe"], windowsHide: true });
  let stderr = "";
  if (child.stderr) {
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (text) => {
      stderr += text;
      if (stderr.length > 500_000) child.kill();
    });
  }
  const exit = new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", (code) => {
      if (code === 0) resolveExit();
      else rejectExit(Error("La CLI de Supabase no pudo completar esta etapa. Revisá la conexión o la contraseña de base; no se aplicaron cambios remotos."));
    });
  });
  exit.catch(() => {});
  if (pipeOutput) return { child, exit };
  return (async () => {
    const chunks = [];
    let length = 0;
    for await (const chunk of child.stdout) {
      length += chunk.length;
      if (length > 2_000_000) { child.kill(); throw Error("La respuesta de Supabase excedió el límite esperado."); }
      chunks.push(chunk);
    }
    await exit;
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  })();
}

async function encryptedCliDump(cli, args, destination, passphrase) {
  const partial = `${destination}.partial`;
  const { child, exit } = runCli(cli, args, { pipeOutput: true });
  try {
    const source = await encryptToFile(child.stdout, partial, passphrase);
    await exit;
    if (source.bytes < 20) throw Error("El dump SQL llegó vacío o incompleto.");
    await verifyEncryptedFile(partial, passphrase, source);
    await rename(partial, destination);
    return source;
  } catch (error) {
    child.kill();
    await unlink(partial).catch(() => {});
    throw error;
  }
}

async function encryptedBytes(readable, destination, passphrase) {
  const partial = `${destination}.partial`;
  try {
    const source = await encryptToFile(readable, partial, passphrase);
    await verifyEncryptedFile(partial, passphrase, source);
    await rename(partial, destination);
    return source;
  } catch (error) {
    await unlink(partial).catch(() => {});
    throw error;
  }
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}

async function main() {
  const target = option("--dest");
  const expectedRef = option("--project-ref");
  if (!target || !expectedRef || !isAbsolute(target))
    throw Error("Uso: node scripts/backup-supabase-free.mjs --dest DIRECTORIO_ABSOLUTO_NUEVO --project-ref REF [--cli RUTA_ABSOLUTA]");
  const cli = await findCli(option("--cli"));
  const destination = resolve(target);
  const insideRepo = relative(root, destination);
  if (!insideRepo || (!insideRepo.startsWith("..") && !isAbsolute(insideRepo)))
    throw Error("El destino cifrado debe estar fuera del repositorio.");
  const linkedRef = (await readFile(resolve(root, "supabase/.temp/project-ref"), "utf8")).trim();
  if (linkedRef !== expectedRef) throw Error("El proyecto vinculado no coincide con el indicado.");

  const [first, second] = await readPassphraseTwice();
  if (first.length < 16 || first !== second) throw Error("La frase de cifrado es corta o no coincide.");
  const passphrase = first;
  await mkdir(destination, { recursive: false, mode: 0o700 });
  console.info("Destino creado. Comenzando la copia cifrada; puede solicitar la contraseña de la base en esta terminal.");

  const database = [];
  const dumps = [
    ["roles", ["db", "dump", "--linked", "--role-only"]],
    ["schema", ["db", "dump", "--linked"]],
    ["data", ["db", "dump", "--linked", "--data-only", "--use-copy", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes"]],
    ["migration-schema", ["db", "dump", "--linked", "--schema", "supabase_migrations"]],
    ["migration-data", ["db", "dump", "--linked", "--data-only", "--use-copy", "--schema", "supabase_migrations"]],
  ];
  for (const [name, args] of dumps) {
    console.info(`Cifrando ${name}...`);
    const file = `${name}.sql.enc`;
    const source = await encryptedCliDump(cli, args, resolve(destination, file), passphrase);
    database.push({ file, ...source });
  }

  const listed = await runCli(cli, ["storage", "ls", "-r", "--linked", "--experimental", "--output-format", "json", "ss:///materials"]);
  if (!Array.isArray(listed?.paths)) throw Error("La CLI no devolvió un inventario de Storage válido.");
  const prefix = "/materials/";
  const paths = [...new Set(listed.paths)].sort();
  if (paths.some((path) => typeof path !== "string" || !path.startsWith(prefix) || path.length === prefix.length))
    throw Error("El inventario de Storage contiene una ruta inesperada.");
  const keys = await runCli(cli, ["projects", "api-keys", "--project-ref", expectedRef, "--reveal", "--output-format", "json"]);
  const serviceKey = keys?.keys?.find((item) => item.type === "legacy" && item.name === "service_role")?.api_key;
  if (!serviceKey || !serviceKey.startsWith("eyJ")) throw Error("No se obtuvo la clave de servicio existente para respaldar Storage.");
  const db = createClient(`https://${expectedRef}.supabase.co`, serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } });

  const objects = [];
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index].slice(prefix.length);
    const { data: blob, error } = await db.storage.from("materials").download(path);
    if (error || !blob) throw Error(`No se pudo leer el objeto ${index + 1} de ${paths.length}.`);
    const file = `object-${String(index + 1).padStart(5, "0")}.enc`;
    const source = await encryptedBytes(Readable.fromWeb(blob.stream()), resolve(destination, file), passphrase);
    if (source.bytes !== blob.size) throw Error("El tamaño del objeto respaldado no coincide.");
    objects.push({ path, file, ...source });
    console.info(`Objeto ${index + 1}/${paths.length} cifrado y verificado.`);
  }
  const listedAgain = await runCli(cli, ["storage", "ls", "-r", "--linked", "--experimental", "--output-format", "json", "ss:///materials"]);
  if (JSON.stringify([...new Set(listedAgain?.paths ?? [])].sort()) !== JSON.stringify(paths))
    throw Error("El inventario de Storage cambió durante la copia; conservá este directorio como incompleto y repetí el respaldo.");

  const manifest = { format: 1, projectRef: expectedRef, createdAt: new Date().toISOString(), database, objects };
  const manifestSource = await encryptedBytes(Readable.from([Buffer.from(JSON.stringify(manifest))]),
    resolve(destination, "manifest.json.enc"), passphrase);
  const receipt = { format: 1, projectRef: expectedRef, createdAt: manifest.createdAt,
    databaseFiles: database.length, storageObjects: objects.length, manifest: "manifest.json.enc",
    manifestSha256: await hashFile(resolve(destination, "manifest.json.enc")),
    manifestPlaintextSha256: manifestSource.sha256 };
  await writeFile(resolve(destination, "COMPLETE.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
  console.info(`Copia cifrada completa: ${database.length} archivos de base y ${objects.length} objetos de Storage. No se mostró ni guardó ninguna clave.`);
  console.info("Falta ensayar un restore aislado antes de declarar aprobado el respaldo productivo.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
