import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, stat, unlink } from "node:fs/promises";

const magic = Buffer.from("KUSIYB1\n", "ascii");
const saltBytes = 16;
const ivBytes = 12;
const tagBytes = 16;
const headerBytes = magic.length + saltBytes + ivBytes;

async function writeAll(file, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset);
    if (!bytesWritten) throw Error("No se pudo escribir el respaldo cifrado.");
    offset += bytesWritten;
  }
}

export async function encryptToFile(source, path, passphrase) {
  const salt = randomBytes(saltBytes);
  const iv = randomBytes(ivBytes);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = createHash("sha256");
  let size = 0;
  const file = await open(path, "wx", 0o600);
  try {
    await writeAll(file, Buffer.concat([magic, salt, iv]));
    for await (const chunk of source) {
      const bytes = Buffer.from(chunk);
      plaintext.update(bytes);
      size += bytes.length;
      await writeAll(file, cipher.update(bytes));
    }
    await writeAll(file, cipher.final());
    await writeAll(file, cipher.getAuthTag());
    await file.sync();
    return { bytes: size, sha256: plaintext.digest("hex") };
  } catch (error) {
    await file.close();
    await unlink(path).catch(() => {});
    throw error;
  } finally {
    key.fill(0);
    await file.close().catch(() => {});
  }
}

export async function verifyEncryptedFile(path, passphrase, expected) {
  const info = await stat(path);
  if (info.size < headerBytes + tagBytes) throw Error("Respaldo cifrado incompleto.");
  const file = await open(path, "r");
  let header;
  let tag;
  try {
    header = Buffer.alloc(headerBytes);
    tag = Buffer.alloc(tagBytes);
    if ((await file.read(header, 0, headerBytes, 0)).bytesRead !== headerBytes ||
        (await file.read(tag, 0, tagBytes, info.size - tagBytes)).bytesRead !== tagBytes)
      throw Error("Respaldo cifrado incompleto.");
  } finally { await file.close(); }
  if (!header.subarray(0, magic.length).equals(magic)) throw Error("Formato de respaldo desconocido.");
  const salt = header.subarray(magic.length, magic.length + saltBytes);
  const iv = header.subarray(magic.length + saltBytes);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = createHash("sha256");
  let size = 0;
  try {
    if (info.size > headerBytes + tagBytes) {
      for await (const chunk of createReadStream(path, { start: headerBytes, end: info.size - tagBytes - 1 })) {
        const bytes = decipher.update(chunk);
        plaintext.update(bytes);
        size += bytes.length;
      }
    }
    const tail = decipher.final();
    plaintext.update(tail);
    size += tail.length;
    const actual = { bytes: size, sha256: plaintext.digest("hex") };
    if (expected && (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256))
      throw Error("La integridad del respaldo no coincide con su origen.");
    return actual;
  } finally { key.fill(0); }
}

export async function* decryptEncryptedFile(path, passphrase) {
  const info = await stat(path);
  if (info.size < headerBytes + tagBytes) throw Error("Respaldo cifrado incompleto.");
  const file = await open(path, "r");
  const header = Buffer.alloc(headerBytes);
  const tag = Buffer.alloc(tagBytes);
  try {
    if ((await file.read(header, 0, headerBytes, 0)).bytesRead !== headerBytes ||
        (await file.read(tag, 0, tagBytes, info.size - tagBytes)).bytesRead !== tagBytes)
      throw Error("Respaldo cifrado incompleto.");
  } finally { await file.close(); }
  if (!header.subarray(0, magic.length).equals(magic)) throw Error("Formato de respaldo desconocido.");

  const salt = header.subarray(magic.length, magic.length + saltBytes);
  const iv = header.subarray(magic.length + saltBytes);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    if (info.size > headerBytes + tagBytes) {
      for await (const chunk of createReadStream(path, { start: headerBytes, end: info.size - tagBytes - 1 })) {
        const bytes = decipher.update(chunk);
        if (bytes.length) yield bytes;
      }
    }
    const final = decipher.final();
    if (final.length) yield final;
  } finally { key.fill(0); }
}
