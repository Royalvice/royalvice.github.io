import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {auditAssets} from '../tools/arcade/verify.mjs';

test('LFS pointer files cannot enter a deployed game bundle',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'arcade-assets-'));
  try {
    await mkdir(path.join(root,'roms'));await mkdir(path.join(root,'bios'));
    await writeFile(path.join(root,'catalog.json'),JSON.stringify([{id:'mslug',bios:'neogeo'}]));
    const missing=await auditAssets(root);assert.equal(missing.games.mslug.available,false);
    await writeFile(path.join(root,'roms/mslug.zip'),'version https://git-lfs.github.com/spec/v1\noid sha256:missing\nsize 99\n');
    await assert.rejects(auditAssets(root),/Git LFS pointer/);
    await writeFile(path.join(root,'roms/mslug.zip'),'<html>SPA fallback</html>');
    await assert.rejects(auditAssets(root),/not a ZIP/);
  } finally {await rm(root,{recursive:true,force:true});}
});
