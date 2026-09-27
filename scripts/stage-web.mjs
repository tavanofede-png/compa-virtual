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
// The app loads the six reduced GLBs. Keep the detailed originals in the
// repository, but do not upload duplicate unused copies with the public site.
for (const id of ['living', 'study', 'library', 'projects', 'patio', 'terrace']) {
  await rm(resolve(target, 'selection/shared-spaces', `${id}.glb`), { force: true });
}
console.info('Export web preparado para Sites.');
