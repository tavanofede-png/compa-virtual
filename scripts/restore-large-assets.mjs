import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'scripts/large-assets.json'), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const verifyOnly = process.argv.includes('--verify');
const withinRoot = (path) => {
  const absolute = resolve(root, path);
  const local = relative(root, absolute);
  if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error(`Invalid asset path: ${path}`);
  return absolute;
};

if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported large-asset manifest.');

for (const asset of manifest.files) {
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error(`Invalid metadata: ${asset.path}`);
  }
  const target = withinRoot(asset.path);
  const archive = withinRoot(asset.archive);
  if (!verifyOnly) {
    const existing = await readFile(target).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) {
      if (existing.length === asset.bytes && sha256(existing) === asset.sha256) {
        console.log(`Already restored: ${asset.path}`);
        continue;
      }
      throw new Error(`Local model differs: ${asset.path}. Preserved your file; run pnpm assets:pack-large if the change is intentional.`);
    }
  }
  const bytes = await promisify(gunzip)(await readFile(archive), { maxOutputLength: asset.bytes });
  if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Asset checksum failed: ${asset.path}`);
  if (verifyOnly) {
    console.log(`Archive verified: ${asset.path} (${bytes.length} bytes)`);
    continue;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(`${target}.restore-tmp`, bytes, { flag: 'wx' });
  await rename(`${target}.restore-tmp`, target);
  console.log(`Restored: ${asset.path}`);
}
