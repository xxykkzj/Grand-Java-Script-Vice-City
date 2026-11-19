#!/usr/bin/env node
// Convert OBJ+MTL files to GLB using Cesium's obj2gltf (installed OUTSIDE the repo).
// usage: node tools/convert-obj.mjs <obj2gltf-install-dir> <out-dir> <a.obj> [b.obj ...]
// e.g.   node tools/convert-obj.mjs /home/claude/ext/tools assets/models/quaternius-street /path/*.obj
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const [dir, out, ...files] = process.argv.slice(2);
if (!dir || !out || !files.length) { console.error('usage: convert-obj.mjs <obj2gltf-dir> <out-dir> <obj...>'); process.exit(1); }
const obj2gltf = createRequire(path.join(path.resolve(dir), 'x.js'))('obj2gltf');
fs.mkdirSync(out, { recursive: true });
let fail = 0;
for (const f of files) {
  try {
    const glb = await obj2gltf(f, { binary: true });
    fs.writeFileSync(path.join(out, path.basename(f, '.obj') + '.glb'), glb);
    console.log('ok  ', path.basename(f));
  } catch (e) { fail++; console.error('FAIL', f, e.message); }
}
process.exit(fail ? 1 : 0);
