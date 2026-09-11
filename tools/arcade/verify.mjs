import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../public/arcade/', import.meta.url));
export async function auditAssets(rootPath = root) {
  const root = rootPath;
  const catalog = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
  const files = {};
  for (const folder of ['roms', 'bios']) {
    for (const name of await readdir(path.join(root, folder))) {
      if (!name.endsWith('.zip')) continue;
      const location = path.join(root, folder, name);
      const data = await readFile(location);
      if (data.subarray(0, 80).toString().startsWith('version https://git-lfs.github.com/spec/')) throw new Error(`${folder}/${name}: Git LFS pointer; run git lfs pull before building.`);
      if (data.length < 22 || data.readUInt32LE(0) !== 0x04034b50) throw new Error(`${folder}/${name}: not a ZIP archive.`);
      files[`${folder}/${name}`] = { bytes: (await stat(location)).size, sha256: createHash('sha256').update(data).digest('hex') };
    }
  }
  return { runtime: 'EmulatorJS 4.2.3 / FBNeo 4.2.3', files, games: Object.fromEntries(catalog.map(game => {
    const required = [`roms/${game.id}.zip`, ...(game.bios ? [`bios/${game.bios}.zip`] : [])];
    return [game.id, { available: required.every(file => files[file]), missing: required.filter(file => !files[file]) }];
  })) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await auditAssets();
  const ready = Object.values(result.games).filter(game => game.available).length;
  console.log(`Arcade: ${ready}/15 ROM sets present; ZIP and LFS integrity checked. Core compatibility still requires a boot test.`);
  if (process.argv.includes('--require-all') && ready !== 15) throw new Error('All 15 game sets are required for release acceptance.');
}
