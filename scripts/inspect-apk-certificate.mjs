import { createHash, X509Certificate } from "node:crypto";
import { open, stat } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("Uso: node scripts/inspect-apk-certificate.mjs ARCHIVO.apk");
  process.exit(2);
}

function field(bytes, offset) {
  if (offset + 4 > bytes.length) throw Error("Campo APK truncado.");
  const length = bytes.readUInt32LE(offset);
  const end = offset + 4 + length;
  if (end > bytes.length) throw Error("Longitud APK inválida.");
  return { bytes: bytes.subarray(offset + 4, end), end };
}

const size = (await stat(path)).size;
const file = await open(path, "r");
try {
  const tailSize = Math.min(size, 65_557);
  const tail = Buffer.alloc(tailSize);
  await file.read(tail, 0, tailSize, size - tailSize);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== 0x06054b50) continue;
    if (i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw Error("No se encontró el directorio ZIP del APK.");
  const centralDirectory = tail.readUInt32LE(eocd + 16);
  const footer = Buffer.alloc(24);
  await file.read(footer, 0, 24, centralDirectory - 24);
  if (footer.subarray(8).toString("ascii") !== "APK Sig Block 42")
    throw Error("El APK no contiene el bloque de firma v2.");
  const blockSize = Number(footer.readBigUInt64LE(0));
  if (blockSize < 24 || blockSize > 16 * 1024 * 1024)
    throw Error("Tamaño del bloque de firma inválido.");
  const start = centralDirectory - blockSize - 8;
  const block = Buffer.alloc(blockSize + 8);
  await file.read(block, 0, block.length, start);
  if (Number(block.readBigUInt64LE(0)) !== blockSize)
    throw Error("El bloque de firma tiene longitudes distintas.");

  let v2;
  for (let cursor = 8; cursor < block.length - 24; ) {
    if (cursor + 12 > block.length - 24)
      throw Error("Par de firmas APK truncado.");
    const length = Number(block.readBigUInt64LE(cursor));
    const end = cursor + 8 + length;
    if (length < 4 || end > block.length - 24)
      throw Error("Par de firmas APK inválido.");
    if (block.readUInt32LE(cursor + 8) === 0x7109871a)
      v2 = block.subarray(cursor + 12, end);
    cursor = end;
  }
  if (!v2) throw Error("Falta la firma APK v2.");
  const signerSequence = field(v2, 0).bytes;
  const signer = field(signerSequence, 0).bytes;
  const signedData = field(signer, 0).bytes;
  const digests = field(signedData, 0);
  const certificates = field(signedData, digests.end).bytes;
  const certificate = field(certificates, 0).bytes;
  const x509 = new X509Certificate(certificate);
  console.log(
    JSON.stringify(
      {
        file: path,
        bytes: size,
        signatureV2Detected: true,
        certificateSha256: createHash("sha256").update(certificate).digest("hex"),
        certificateSubject: x509.subject,
        signatureCryptographicallyVerified: false,
      },
      null,
      2,
    ),
  );
} finally {
  await file.close();
}
