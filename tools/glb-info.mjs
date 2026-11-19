#!/usr/bin/env node
// glb-info: parse a GLB and report stats. Plain Node, no deps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseGLB(buf) {
  if (buf.length < 20) throw new Error('GLB too small');
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('Bad GLB magic');
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error('Unsupported GLB version ' + version);
  const total = buf.readUInt32LE(8);
  if (total !== buf.length) throw new Error(`Header length ${total} != file length ${buf.length}`);
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (data.length !== len) throw new Error('Truncated chunk');
    if (type === 0x4e4f534a && !json) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942 && !bin) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error('No JSON chunk');
  return { json, bin };
}

function nodeMatrix(n) {
  // returns {t:[3], s:[3]} (translation/scale only; rotation ignored)
  if (n.matrix) { const m = n.matrix; return { t: [m[12], m[13], m[14]], s: [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])] }; }
  return { t: n.translation || [0, 0, 0], s: n.scale || [1, 1, 1] };
}

export function glbInfo(input) {
  const buf = typeof input === 'string' ? fs.readFileSync(input) : input;
  const { json: g, bin } = parseGLB(buf);
  const acc = g.accessors || [];
  const info = {
    size: buf.length,
    meshes: (g.meshes || []).length,
    primitives: 0,
    triangles: 0,
    materials: (g.materials || []).map((m, i) => m.name || `material${i}`),
    images: (g.images || []).map((im, i) => ({
      name: im.name || `image${i}`,
      kind: im.uri !== undefined ? 'uri' : 'embedded',
      uri: im.uri !== undefined ? (im.uri.startsWith('data:') ? 'data:...' : im.uri) : undefined,
      mimeType: im.mimeType,
    })),
    animations: [],
    skins: (g.skins || []).length,
    nodes: (g.nodes || []).length,
    bbox: null,
    binLength: bin ? bin.length : 0,
  };
  const meshTris = [], meshBox = [];
  (g.meshes || []).forEach((m) => {
    let tris = 0, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const p of m.primitives) {
      info.primitives++;
      const mode = p.mode === undefined ? 4 : p.mode;
      const cnt = p.indices !== undefined ? acc[p.indices].count : (p.attributes.POSITION !== undefined ? acc[p.attributes.POSITION].count : 0);
      if (mode === 4) tris += cnt / 3; else if (mode === 5 || mode === 6) tris += Math.max(0, cnt - 2);
      const pa = acc[p.attributes.POSITION];
      if (pa && pa.min && pa.max) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], pa.min[i]); max[i] = Math.max(max[i], pa.max[i]); }
    }
    meshTris.push(Math.floor(tris)); meshBox.push(isFinite(min[0]) ? { min, max } : null);
  });
  // walk scene graph (translation + scale only) to combine bboxes and count instanced tris
  const nodes = g.nodes || [];
  let bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  let tris = 0, visited = false;
  const walk = (idx, T, S) => {
    const n = nodes[idx]; const m = nodeMatrix(n);
    const s = [S[0] * m.s[0], S[1] * m.s[1], S[2] * m.s[2]];
    const t = [T[0] + S[0] * m.t[0], T[1] + S[1] * m.t[1], T[2] + S[2] * m.t[2]];
    if (n.mesh !== undefined) {
      tris += meshTris[n.mesh]; const b = meshBox[n.mesh];
      if (b) for (let i = 0; i < 3; i++) {
        const a = b.min[i] * s[i] + t[i], c = b.max[i] * s[i] + t[i];
        bmin[i] = Math.min(bmin[i], a, c); bmax[i] = Math.max(bmax[i], a, c);
      }
    }
    (n.children || []).forEach((c) => walk(c, t, s));
  };
  const scene = (g.scenes || [])[g.scene || 0];
  if (scene && nodes.length) { scene.nodes.forEach((i) => walk(i, [0, 0, 0], [1, 1, 1])); visited = true; }
  if (!visited || !isFinite(bmin[0])) {
    tris = meshTris.reduce((a, b) => a + b, 0);
    bmin = [Infinity, Infinity, Infinity]; bmax = [-Infinity, -Infinity, -Infinity];
    meshBox.forEach((b) => b && [0, 1, 2].forEach((i) => { bmin[i] = Math.min(bmin[i], b.min[i]); bmax[i] = Math.max(bmax[i], b.max[i]); }));
  }
  info.triangles = tris;
  if (isFinite(bmin[0])) info.bbox = { min: bmin, max: bmax, size: bmax.map((v, i) => v - bmin[i]) };
  (g.animations || []).forEach((a, i) => {
    let d = 0;
    for (const s of a.samplers) { const mx = acc[s.input] && acc[s.input].max; if (mx) d = Math.max(d, mx[0]); }
    info.animations.push({ name: a.name || `animation${i}`, duration: +d.toFixed(4) });
  });
  return info;
}

const r = (v) => v.map((x) => +x.toFixed(3));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node tools/glb-info.mjs <file.glb> [...]'); process.exit(1); }
  for (const f of files) {
    try {
      const i = glbInfo(f);
      console.log(`${f}\n  size: ${(i.size / 1024).toFixed(1)} KB (bin ${i.binLength} B)\n  meshes: ${i.meshes}, primitives: ${i.primitives}, triangles: ${i.triangles}, skins: ${i.skins}, nodes: ${i.nodes}`);
      console.log(`  materials (${i.materials.length}): ${i.materials.join(', ')}`);
      console.log(`  images (${i.images.length}): ${i.images.map((im) => `${im.name} [${im.kind}${im.uri ? ' ' + im.uri : ''}]`).join(', ')}`);
      console.log(`  animations (${i.animations.length}): ${i.animations.map((a) => `${a.name} ${a.duration}s`).join(', ')}`);
      if (i.bbox) console.log(`  bbox: min ${r(i.bbox.min)} max ${r(i.bbox.max)} size ${r(i.bbox.size)}`);
    } catch (e) { console.error(`${f}: ERROR ${e.message}`); process.exitCode = 1; }
  }
}
