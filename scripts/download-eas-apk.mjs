import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
  console.error("Uso: node scripts/download-eas-apk.mjs URL_EAS ARCHIVO.apk");
  process.exit(2);
}
const url = new URL(source);
if (
  url.protocol !== "https:" ||
  url.hostname !== "expo.dev" ||
  !url.pathname.startsWith("/artifacts/eas/") ||
  !url.pathname.endsWith(".apk") ||
  !destination.toLowerCase().endsWith(".apk")
) {
  throw Error("Se requiere un APK oficial de Expo EAS y un destino .apk.");
}

const output = resolve(destination);
const partial = `${output}.partial`;
const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
if (!response.ok || !response.body)
  throw Error(`No se pudo descargar el APK: HTTP ${response.status}.`);
if (new URL(response.url).hostname !== "wf-artifacts.eascdn.net")
  throw Error("EAS redirigió el APK a un origen inesperado.");

await mkdir(dirname(output), { recursive: true });
const hash = createHash("sha256");
let bytes = 0;
try {
  await pipeline(
    Readable.fromWeb(response.body),
    new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > 300 * 1024 * 1024)
          return callback(Error("El APK supera el límite de 300 MiB."));
        hash.update(chunk);
        callback(null, chunk);
      },
    }),
    createWriteStream(partial, { flags: "wx" }),
  );
  if (bytes < 40 * 1024 * 1024)
    throw Error("El APK descargado es demasiado pequeño para Kusiy.");
  await rename(partial, output);
} catch (error) {
  await rm(partial, { force: true });
  throw error;
}
console.log(
  JSON.stringify({ file: output, bytes, sha256: hash.digest("hex") }, null, 2),
);
