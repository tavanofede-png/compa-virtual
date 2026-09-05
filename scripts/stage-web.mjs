import { cp, lstat, realpath, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const target = resolve(root, 'out');
const source = resolve(root, 'apps/web/out');
if (dirname(target) !== root || (await lstat(target).catch(() => null))?.isSymbolicLink()) {
  throw new Error('La salida web debe ser una carpeta normal dentro del proyecto.');
}
await lstat(resolve(source, 'index.html'));
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true, dereference: false });
console.info('Export web preparado para Sites.');
