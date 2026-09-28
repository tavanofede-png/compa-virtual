import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [apkPath, receiptPath] = process.argv.slice(2);
if (!apkPath || !receiptPath) {
  console.error("Uso: pnpm android:verify-artifact ARCHIVO.apk RECIBO.json");
  process.exit(2);
}

const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const firstReceipt = JSON.parse(
  await readFile(
    new URL("../docs/releases/android-preview-0.1.0.json", import.meta.url),
    "utf8",
  ),
);
const failures = [];
const size = (await stat(apkPath)).size;
if (size !== receipt.bytes) failures.push("El tamaño difiere del recibo.");

const digest = createHash("sha256");
for await (const chunk of createReadStream(apkPath)) digest.update(chunk);
const actualHash = digest.digest("hex");
if (actualHash !== receipt.sha256)
  failures.push("El SHA-256 difiere del recibo.");

const inspector = fileURLToPath(
  new URL("./inspect-apk-certificate.mjs", import.meta.url),
);
const result = spawnSync(process.execPath, [inspector, apkPath], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
});
if (result.status !== 0) {
  failures.push(`No se pudo leer la firma v2: ${result.stderr.trim()}`);
} else {
  const signature = JSON.parse(result.stdout);
  if (signature.bytes !== size)
    failures.push("El inspector leyó un tamaño distinto.");
  if (
    signature.certificateSha256 !== receipt.certificateSha256 ||
    signature.certificateSha256 !== firstReceipt.certificateSha256
  )
    failures.push("El certificado no coincide con el primer APK y el recibo.");
  if (!signature.signatureV2Detected)
    failures.push("Falta el bloque de firma v2.");
}

if (receipt.status !== "FINISHED" || receipt.productionGateG9 !== "pending")
  failures.push("El recibo no identifica un build interno pendiente de G9.");
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      bytes: size,
      sha256: actualHash,
      certificateSha256: receipt.certificateSha256,
      signatureCryptographicallyVerified: false,
      physicalInstallationTested: false,
    },
    null,
    2,
  ),
);
