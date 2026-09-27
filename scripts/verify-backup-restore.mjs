import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { decryptEncryptedFile, verifyEncryptedFile } from "./backup-crypto.mjs";
import { readPassphraseTwice } from "./backup-prompt.mjs";
import { createApplicationDataFilter } from "./backup-restore-filter.mjs";

const image = "public.ecr.aws/supabase/postgres:17.6.1.166";
const databaseFiles = ["roles.sql.enc", "schema.sql.enc", "data.sql.enc",
  "migration-schema.sql.enc", "migration-data.sql.enc"];

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function decryptedJson(path, passphrase) {
  const chunks = [];
  let size = 0;
  for await (const chunk of decryptEncryptedFile(path, passphrase)) {
    size += chunk.length;
    if (size > 1_000_000) throw Error("El manifiesto excede el tamaño esperado.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runDocker(args, source) {
  const child = spawn("docker", args, { stdio: [source ? "pipe" : "ignore", "pipe", "pipe"], windowsHide: true });
  const stdout = [];
  const stderr = [];
  let outputBytes = 0;
  for (const [stream, chunks] of [[child.stdout, stdout], [child.stderr, stderr]]) {
    stream.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 100_000) child.kill();
      else chunks.push(chunk);
    });
  }
  const completed = new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", (code) => resolveExit(code));
  });
  return (async () => {
    let uploadError;
    if (source) await pipeline(source, child.stdin).catch((error) => { uploadError = error; });
    const code = await completed;
    return { code, stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"), uploadError };
  })();
}

async function mustRunDocker(args, source, phase) {
  const result = await runDocker(args, source);
  if (result.code !== 0 || result.uploadError) {
    const error = result.stderr;
    const sqlState = error.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1];
    const hint = sqlState === "42P01" ? "relación ausente en la imagen local" :
      sqlState === "42703" ? "columna ausente en la imagen local" :
      sqlState === "23505" ? "dato duplicado" :
      sqlState === "42501" ? "permiso insuficiente en el contenedor" :
      /role\s+.+\s+does not exist/i.test(error) ? "falta un rol de plataforma" :
      /column\s+.+\s+does not exist/i.test(error) ? "diferencia de esquema de plataforma" :
      /permission denied/i.test(error) ? "permiso insuficiente en el contenedor" :
      /already exists|duplicate key/i.test(error) ? "objeto o dato duplicado" :
      /database system is shutting down/i.test(error) ? "PostgreSQL aún se estaba iniciando" :
      "error de PostgreSQL o Docker";
    throw Error(`Falló ${phase} en el contenedor aislado (${hint}${sqlState ? `, SQLSTATE ${sqlState}` : ""}). La base remota no se modificó.`);
  }
  return result.stdout.trim();
}

async function waitForPostgres(name) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const logs = await runDocker(["logs", "--tail", "100", name]);
    if (logs.code === 0 && `${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.")) {
      const probe = await runDocker(["exec", name, "pg_isready", "-U", "postgres"]);
      if (probe.code === 0) return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
  throw Error("El PostgreSQL aislado no inició a tiempo.");
}

async function main() {
  const source = option("--source");
  if (!source || !isAbsolute(source))
    throw Error("Uso: node scripts/verify-backup-restore.mjs --source DIRECTORIO_ABSOLUTO");
  const directory = resolve(source);
  const receipt = JSON.parse(await readFile(join(directory, "COMPLETE.json"), "utf8"));
  if (receipt.format !== 1 || receipt.databaseFiles !== 5 ||
      receipt.manifest !== "manifest.json.enc" || !Number.isSafeInteger(receipt.storageObjects))
    throw Error("El recibo del respaldo no tiene el formato esperado.");
  if (await sha256File(join(directory, receipt.manifest)) !== receipt.manifestSha256)
    throw Error("El manifiesto cifrado no coincide con el recibo.");

  const [first, second] = await readPassphraseTwice();
  if (first.length < 16 || first !== second) throw Error("La frase de cifrado es corta o no coincide.");
  const passphrase = first;
  if ((await verifyEncryptedFile(join(directory, receipt.manifest), passphrase)).sha256 !== receipt.manifestPlaintextSha256)
    throw Error("El contenido del manifiesto no coincide con el recibo.");
  const manifest = await decryptedJson(join(directory, receipt.manifest), passphrase);
  if (manifest.format !== 1 || manifest.projectRef !== receipt.projectRef ||
      manifest.database?.length !== databaseFiles.length ||
      manifest.objects?.length !== receipt.storageObjects ||
      databaseFiles.some((name, index) => manifest.database[index]?.file !== name))
    throw Error("El manifiesto no coincide con el recibo.");

  const filenames = new Set(databaseFiles);
  for (let index = 0; index < manifest.objects.length; index++) {
    const item = manifest.objects[index];
    const expected = `object-${String(index + 1).padStart(5, "0")}.enc`;
    if (item.file !== expected || typeof item.path !== "string" || !item.path)
      throw Error("El inventario cifrado de Storage contiene un objeto inesperado.");
    filenames.add(expected);
  }
  for (const item of [...manifest.database, ...manifest.objects]) {
    if (!filenames.has(item.file) || !Number.isSafeInteger(item.bytes) ||
        !/^[a-f0-9]{64}$/.test(item.sha256) || !(await stat(join(directory, item.file))).isFile())
      throw Error("El manifiesto contiene un archivo inválido.");
    await verifyEncryptedFile(join(directory, item.file), passphrase, item);
  }
  console.info("Cifrado y hashes verificados. Iniciando restauración local sin red ni volúmenes.");

  const name = `kusiy-restore-${randomBytes(4).toString("hex")}`;
  let started = false;
  try {
    await mustRunDocker(["run", "-d", "--rm", "--name", name, "--network", "none",
      "-e", "POSTGRES_PASSWORD=local-only", image], null, "el inicio de PostgreSQL");
    started = true;
    await waitForPostgres(name);
    await mustRunDocker(["exec", name, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
      "-U", "supabase_admin", "-d", "postgres", "-c",
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOLOGIN; END IF; END $$"],
    null, "la preparación de los roles de plataforma locales");
    for (const file of databaseFiles) {
      const isData = file === "data.sql.enc" || file === "migration-data.sql.enc";
      const args = ["exec", "-i", name, "psql", "-X", "-q", "--single-transaction",
        "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-U", "supabase_admin", "-d", "postgres"];
      if (isData)
        args.push("-c", "SET session_replication_role = replica");
      args.push("-f", "-");
      const appDataFilter = file === "data.sql.enc" ? createApplicationDataFilter() : null;
      const source = Readable.from(decryptEncryptedFile(join(directory, file), passphrase));
      await mustRunDocker(args, appDataFilter ? source.pipe(appDataFilter) : source,
        `la restauración de ${file}`);
      console.info(`${file}: restaurado${appDataFilter ? ` (se omitieron ${appDataFilter.skippedPlatformTables()} tablas gestionadas por Auth/Storage/pgmq)` : ""}.`);
    }

    const studentRows = await mustRunDocker(["exec", name, "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres", "-c", "SELECT count(*) FROM public.student_states"],
    null, "la consulta de alumnos");
    if (!/^\d+$/.test(studentRows))
      throw Error("La consulta del respaldo restaurado no devolvió resultados válidos.");

    for (let index = 0; index < manifest.objects.length; index++) {
      const item = manifest.objects[index];
      const target = `/tmp/kusiy-object-${String(index + 1).padStart(5, "0")}`;
      await mustRunDocker(["exec", "-i", name, "sh", "-c", `cat > ${target}`],
        Readable.from(decryptEncryptedFile(join(directory, item.file), passphrase)),
        `la restauración del objeto ${index + 1}`);
      const restored = await mustRunDocker(["exec", name, "sha256sum", target], null,
        `la verificación del objeto ${index + 1}`);
      if (restored.slice(0, 64) !== item.sha256)
        throw Error(`El objeto ${index + 1} no coincide tras la restauración.`);
    }
    console.info(`Ensayo local completado: ${studentRows} estados académicos y ${manifest.objects.length} archivos originales recuperados.`);
    console.info("Auth, metadatos de Storage y colas pgmq requieren un ensayo posterior en otro proyecto Supabase; este ensayo local no aprueba por sí solo G8.");
  } finally {
    if (started) await runDocker(["stop", name]).catch(() => {});
  }
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
