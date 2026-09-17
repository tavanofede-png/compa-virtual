import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = ['design/personal-spaces-v1/models/pergola.glb'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = [];

for (const path of paths) {
  const original = await readFile(resolve(root, path));
  const packed = await promisify(gzip)(original, { level: 9 });
  if (packed.length >= 100 * 1024 * 1024) {
    throw new Error(`${path}: compressed asset still exceeds GitHub's file limit.`);
  }
  const digest = sha256(original);
  const restored = await promisify(gunzip)(packed, { maxOutputLength: original.length });
  if (restored.length !== original.length || sha256(restored) !== digest) {
    throw new Error(`${path}: lossless compression verification failed.`);
  }
  const archive = `${path}.gz`;
  await writeFile(resolve(root, `${archive}.tmp`), packed);
  await rename(resolve(root, `${archive}.tmp`), resolve(root, archive));
  files.push({ path, archive, bytes: original.length, sha256: digest });
  console.log(`${path}: ${original.length} -> ${packed.length} bytes, SHA-256 verified.`);
}

await writeFile(resolve(root, 'scripts/large-assets.json'), `${JSON.stringify({ version: 1, files }, null, 2)}\n`);
