import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { decryptEncryptedFile, encryptToFile, verifyEncryptedFile } from "../scripts/backup-crypto.mjs";

describe("encrypted backup stream", () => {
  it("round-trips a stream without writing plaintext and detects tampering", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kusiy-crypto-"));
    const path = join(dir, "db.enc");
    const secret = Buffer.from("academic data\n".repeat(1000));
    try {
      const expected = await encryptToFile(Readable.from([secret]), path, "test-passphrase-long");
      expect(await verifyEncryptedFile(path, "test-passphrase-long", expected)).toEqual(expected);
      const restored = Buffer.concat(await Array.fromAsync(decryptEncryptedFile(path, "test-passphrase-long")));
      expect(restored).toEqual(secret);
      expect((await readFile(path)).includes(secret)).toBe(false);
      await expect(verifyEncryptedFile(path, "wrong-passphrase")).rejects.toThrow();
      const encrypted = await readFile(path);
      encrypted[50] ^= 1;
      await writeFile(path, encrypted);
      await expect(verifyEncryptedFile(path, "test-passphrase-long", expected)).rejects.toThrow();
    } finally { await unlink(path).catch(() => {}); await rmdir(dir); }
  });

  it("verifies files larger than one stream chunk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kusiy-crypto-"));
    const path = join(dir, "storage.enc");
    const source = join(dir, "source.bin");
    try {
      await writeFile(source, Buffer.alloc(200_000, 173));
      const expected = await encryptToFile(createReadStream(source), path, "test-passphrase-long");
      expect(await verifyEncryptedFile(path, "test-passphrase-long", expected)).toEqual(expected);
    } finally {
      await unlink(path).catch(() => {});
      await unlink(source).catch(() => {});
      await rmdir(dir);
    }
  });

  it("accepts an empty Storage object without weakening authentication", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kusiy-crypto-"));
    const path = join(dir, "empty.enc");
    try {
      const expected = await encryptToFile(Readable.from([]), path, "test-passphrase-long");
      expect(expected.bytes).toBe(0);
      expect(await verifyEncryptedFile(path, "test-passphrase-long", expected)).toEqual(expected);
    } finally { await unlink(path).catch(() => {}); await rmdir(dir); }
  });
});
