import { mkdir, readFile, writeFile, cp, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transform } from 'esbuild';
import { auditAssets } from './verify.mjs';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const target = path.join(repo, 'public/arcade/runtime');
const cache = path.join(repo, 'node_modules/.cache/royalvice-arcade');
const packages = [
  ['emulatorjs', '7z3qaA4LwyurhuGvdMUDF9xJpEbxC3SNy9+E9tSaOsRo8FCS2QXam/0k/lc9kqHWRFIlLKWahNjPAStyL0rFnw=='],
  ['core-fbneo', '54Yx8Kcq8DH42caTakws3pMUZc6UkBNqtZgg7Q04lNmWWc/W0wPGN0gHxG90xmlOFGHHtxp9QnicBb1NXMjGWg==']
];
await mkdir(cache, { recursive: true });
for (const [name, digest] of packages) {
  const archive = path.join(cache, `${name}-4.2.3.tgz`);
  let data;
  try { data = await readFile(archive); } catch {
    console.log(`Preparing ${name} 4.2.3…`);
    const response = await fetch(`https://registry.npmjs.org/@emulatorjs/${name}/-/${name}-4.2.3.tgz`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha512').update(data).digest('base64') !== digest) throw new Error(`Integrity mismatch: ${name}`);
  await writeFile(archive, data);
  const destination = path.join(cache, name);
  try { await access(path.join(destination, 'package/package.json')); } catch {
    await mkdir(destination, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', destination]);
  }
}
const source = path.join(cache, 'emulatorjs/package');
await mkdir(target, { recursive: true });
await cp(path.join(source, 'data'), target, { recursive: true });
await cp(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
const scripts = ['emulator', 'nipplejs', 'shaders', 'storage', 'gamepad', 'GameManager', 'socket.io.min', 'compression'];
const js = (await Promise.all(scripts.map(name => readFile(path.join(source, `data/src/${name}.js`), 'utf8')))).join('\n;\n');
await writeFile(path.join(target, 'emulator.min.js'), (await transform(js, { minify: true, target: 'es2020', legalComments: 'inline' })).code);
await writeFile(path.join(target, 'emulator.min.css'), (await transform(await readFile(path.join(source, 'data/emulator.css'), 'utf8'), { loader: 'css', minify: true })).code);
const core = path.join(cache, 'core-fbneo/package');
for (const name of ['fbneo-wasm.data', 'fbneo-legacy-wasm.data', 'reports']) await cp(path.join(core, name), path.join(target, 'cores', name), { recursive: true });
await writeFile(path.join(repo, 'public/arcade/availability.json'), JSON.stringify(await auditAssets(), null, 2) + '\n');
console.log('Arcade runtime ready: pinned, self-hosted, single-thread FBNeo.');
