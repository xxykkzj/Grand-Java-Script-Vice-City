// The few licensed models the game embeds (Kenney Car Kit and City Kit Suburban, Quaternius Street
// Pack; all CC0, see README "Credits"). tools/bake-models.mjs flattens them into one binary blob at
// build time; here each one is expanded into a flat-shaded, vertex-coloured, non-indexed geometry
// (position, normal, color, aFlag) that merges and instances exactly like the procedural town.
//   aFlag: 1 = car paint (takes the instance colour), 2 = glass, 4 = lamp
import * as THREE from 'three';
import blob from 'kits:models';

let lib = null;
function load() {
  if (lib) return lib;
  lib = {};
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  let o = 4;
  const n = dv.getUint16(o, true); o += 2;
  for (let m = 0; m < n; m++) {
    const il = dv.getUint8(o++); let id = '';
    for (let i = 0; i < il; i++) id += String.fromCharCode(dv.getUint8(o++));
    const pn = dv.getUint8(o++), pal = [];
    for (let i = 0; i < pn; i++) { pal.push([dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3)]); o += 4; }
    const V = dv.getUint32(o, true), I = dv.getUint32(o + 4, true); o += 8;
    const min = [0, 1, 2].map((k) => dv.getFloat32(o + k * 4, true)), size = [0, 1, 2].map((k) => dv.getFloat32(o + 12 + k * 4, true)); o += 24;
    const pos = new Float32Array(V * 3);
    for (let i = 0; i < V * 3; i++) pos[i] = min[i % 3] + dv.getUint16(o + i * 2, true) / 65535 * size[i % 3];
    o += V * 6;
    const col = new Uint8Array(blob.buffer, blob.byteOffset + o, V).slice(); o += V + (V % 2);
    const idx = new Uint16Array(I);
    for (let i = 0; i < I; i++) idx[i] = dv.getUint16(o + i * 2, true);
    o += I * 2;
    lib[id] = { id, pal, pos, col, idx, min, size };
  }
  return lib;
}

const _c = new THREE.Color();
// A model as a merge-ready geometry.
//   opts.len / opts.height: uniform scale so the model is this long (z) / tall (y); opts.scale: plain factor
//   opts.recolor(r, g, b, flags, i) -> '#hex' | null: swap palette entries (r, g, b are 0..255 sRGB)
//   opts.only(flags) -> bool: keep only these palette entries (e.g. the glass on its own)
//   The model is centred on x/z and stands on y = 0, facing +z; then rotated by yaw and moved to x, y, z.
export function kitGeometry(id, opts = {}) {
  const M = load()[id];
  if (!M) throw new Error('no model ' + id);
  const s = opts.scale || (opts.len ? opts.len / M.size[2] : opts.height ? opts.height / M.size[1] : 1);
  const cx = M.min[0] + M.size[0] / 2, cz = M.min[2] + M.size[2] / 2, y0 = M.min[1];
  const pc = M.pal.map((p, i) => {
    const hex = opts.recolor ? opts.recolor(p[0], p[1], p[2], p[3], i) : null;
    if (hex) _c.set(hex); else _c.setRGB(p[0] / 255, p[1] / 255, p[2] / 255, THREE.SRGBColorSpace);
    return [_c.r, _c.g, _c.b];
  });
  const keep = [];
  for (let t = 0; t < M.idx.length; t += 3) {
    const f = M.pal[M.col[M.idx[t]]][3];
    if (!opts.only || opts.only(f)) keep.push(t);
  }
  const n = keep.length * 3, P = new Float32Array(n * 3), C = new Float32Array(n * 3), F = new Float32Array(n);
  let k = 0;
  for (const t of keep) for (let j = 0; j < 3; j++) {
    const v = M.idx[t + j], c = pc[M.col[v]];
    P[k * 3] = (M.pos[v * 3] - cx) * s; P[k * 3 + 1] = (M.pos[v * 3 + 1] - y0) * s; P[k * 3 + 2] = (M.pos[v * 3 + 2] - cz) * s;
    C[k * 3] = c[0]; C[k * 3 + 1] = c[1]; C[k * 3 + 2] = c[2];
    F[k] = M.pal[M.col[M.idx[t]]][3];
    k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (opts.flags) g.setAttribute('aFlag', new THREE.BufferAttribute(F, 1));
  if (opts.yaw) g.rotateY(opts.yaw);
  if (opts.x || opts.y || opts.z) g.translate(opts.x || 0, opts.y || 0, opts.z || 0);
  g.computeVertexNormals();
  return g;
}
// size of a model after scaling (for laying things out)
export function kitSize(id, opts = {}) {
  const M = load()[id];
  const s = opts.scale || (opts.len ? opts.len / M.size[2] : opts.height ? opts.height / M.size[1] : 1);
  return { x: M.size[0] * s, y: M.size[1] * s, z: M.size[2] * s };
}
export const kitIds = () => Object.keys(load());
// the original body paint of a Car Kit vehicle (the palette entry flagged as paint), as '#rrggbb'
export function kitPaint(id) {
  const M = load()[id], p = M.pal.find((e) => e[3] & 1) || [255, 255, 255];
  return '#' + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
}
