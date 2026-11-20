#!/usr/bin/env node
// bake-models: turns the handful of licensed GLB models the game uses into one compact binary blob
// that build.mjs embeds in dist/index.html (esbuild "binary" loader). Plain Node, no dependencies.
//
// Every model is flattened (node transforms applied), its colours baked per vertex (material base
// colour, or a texel of Kenney's shared colormap for the Car Kit) into a small palette, and its
// positions quantised to 16 bits over the bounding box. At runtime src/world/kits.js expands a model
// into a non-indexed, flat-shaded, vertex-coloured BufferGeometry that merges and instances like the
// rest of the procedural town (so the models cost no extra draw calls when merged).
//
// Palette flags: 1 = car paint (takes the instance colour), 2 = glass (drawn see-through),
//                4 = lamp (glows at night).
//
// Blob layout (little endian):
//   u32 'NCMK', u16 count
//   per model: u8 idLen, id, u8 palN, palN x (r, g, b, flags), u32 V, u32 I, f32 min[3], f32 size[3],
//              u16 pos[V*3], u8 col[V], (pad to 2), u16 idx[I]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from './glb-info.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// What the game embeds (keep this list short: every entry adds to dist/index.html).
export const MODELS = [
  // Kenney Car Kit (CC0): traffic variety
  ['taxi', 'kenney-car-kit/taxi'], ['van', 'kenney-car-kit/van'], ['delivery', 'kenney-car-kit/delivery'],
  ['truck', 'kenney-car-kit/truck'], ['garbage', 'kenney-car-kit/garbage-truck'], ['ambulance', 'kenney-car-kit/ambulance'],
  ['hatch', 'kenney-car-kit/hatchback-sports'], ['suv', 'kenney-car-kit/suv'],
  // Kenney City Kit Suburban (CC0): the suburban street
  ['house1', 'kenney-city-suburban/house_type01'], ['house3', 'kenney-city-suburban/house_type03'], ['house5', 'kenney-city-suburban/house_type05'],
  ['house7', 'kenney-city-suburban/house_type07'], ['house9', 'kenney-city-suburban/house_type09'], ['house12', 'kenney-city-suburban/house_type12'],
  ['house15', 'kenney-city-suburban/house_type15'], ['house18', 'kenney-city-suburban/house_type18'],
  ['fence', 'kenney-city-suburban/fence_large'], ['fenceS', 'kenney-city-suburban/fence_small'],
  ['treeL', 'kenney-city-suburban/tree_large'], ['treeS', 'kenney-city-suburban/tree_small'],
  // Quaternius Street Pack (CC0): street lights and road signs
  ['lamp1', 'quaternius-street/Streetlight_Single'],
  ['stop', 'quaternius-street/Sign_Stop'], ['yield', 'quaternius-street/Sign_Triangle'], ['nopark', 'quaternius-street/Sign_NoParking'],
];

// ---- tiny PNG decoder (8-bit RGB / RGBA / palette, non-interlaced): enough for Kenney's colormap
function decodePNG(buf) {
  let off = 8, w = 0, h = 0, ct = 0, plte = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG'); ct = data[9]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1, stride = w * bpp, out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = (cur[i] + p) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ct === 3) { const k = cur[x]; out[o] = plte[k * 3]; out[o + 1] = plte[k * 3 + 1]; out[o + 2] = plte[k * 3 + 2]; out[o + 3] = 255; }
      else { out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2]; out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    }
    cur.copy(prev);
  }
  return { w, h, data: out };
}

// ---- 4x4 matrices (column-major, like glTF)
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const toSRGB = (c) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));

function readAccessor(g, bin, i) {
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const C = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * C.BYTES_PER_ELEMENT;
  const out = new Array(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) {
    const o = start + k * stride + j * C.BYTES_PER_ELEMENT;
    out[k * n + j] = C === Float32Array ? dv.getFloat32(o, true) : C === Uint16Array ? dv.getUint16(o, true) : C === Uint32Array ? dv.getUint32(o, true) : dv.getUint8(o);
  }
  return out;
}

function bakeOne(id, rel) {
  const buf = fs.readFileSync(path.join(root, 'assets/packed', rel + '.glb'));
  const { json: g, bin } = parseGLB(buf);
  let tex = null;
  if (g.images && g.images.length) {
    const im = g.images[0], bv = g.bufferViews[im.bufferView];
    tex = decodePNG(Buffer.from(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)));
  }
  const pos = [], col = [], idx = [], palKey = new Map(), pal = [], bodyVerts = [];
  const palOf = (r, gg, b, flags) => {
    const k = r + ',' + gg + ',' + b + ',' + flags;
    if (!palKey.has(k)) { palKey.set(k, pal.length); pal.push([r, gg, b, flags]); }
    return palKey.get(k);
  };
  const walk = (ni, M) => {
    const n = g.nodes[ni], W = mul(M, trs(n));
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        const P = readAccessor(g, bin, p.attributes.POSITION), base = pos.length / 3;
        const UV = p.attributes.TEXCOORD_0 !== undefined ? readAccessor(g, bin, p.attributes.TEXCOORD_0) : null;
        const mat = g.materials[p.material || 0] || {}, pbr = mat.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
        const mname = (mat.name || '').toLowerCase();
        const flags = /glass/.test(mname) ? 2 : /light/.test(mname) ? 4 : 0;
        const useTex = tex && pbr.baseColorTexture && UV;
        for (let k = 0; k < P.length / 3; k++) {
          const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
          pos.push(W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]);
          let r, gg, b;
          if (useTex) {
            const u = UV[k * 2] - Math.floor(UV[k * 2]), v = UV[k * 2 + 1] - Math.floor(UV[k * 2 + 1]);
            const tx = Math.min(tex.w - 1, Math.floor(u * tex.w)), ty = Math.min(tex.h - 1, Math.floor(v * tex.h)), o = (ty * tex.w + tx) * 4;
            r = tex.data[o]; gg = tex.data[o + 1]; b = tex.data[o + 2];
          } else { r = toSRGB(f[0]); gg = toSRGB(f[1]); b = toSRGB(f[2]); }
          col.push(palOf(r, gg, b, flags));
          if (n.name === 'body') bodyVerts.push(base + k);
        }
        const I = p.indices !== undefined ? readAccessor(g, bin, p.indices) : [...Array(P.length / 3).keys()];
        for (const i of I) idx.push(base + i);
      }
    }
    for (const c of n.children || []) walk(c, W);
  };
  const scene = g.scenes[g.scene || 0];
  for (const ni of scene.nodes) walk(ni, ident());
  // Car Kit: the commonest colour on the body is the paint (it takes the instance colour)
  if (bodyVerts.length) {
    const count = new Map();
    for (const v of bodyVerts) count.set(col[v], (count.get(col[v]) || 0) + 1);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0], p = pal[top];
    const paint = palOf(p[0], p[1], p[2], p[3] | 1);
    for (const v of bodyVerts) if (col[v] === top) col[v] = paint;
  }
  if (pal.length > 255) throw new Error(id + ': palette too big');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { min[i % 3] = Math.min(min[i % 3], pos[i]); max[i % 3] = Math.max(max[i % 3], pos[i]); }
  const size = max.map((m, i) => Math.max(m - min[i], 1e-6));
  // weld: identical quantised position + colour => one vertex (normals are rebuilt flat at runtime)
  const qpos = [], qcol = [], remap = new Map(), map = [];
  for (let v = 0; v < pos.length / 3; v++) {
    const a = [0, 1, 2].map((j) => Math.round((pos[v * 3 + j] - min[j]) / size[j] * 65535));
    const k = a.join(',') + ',' + col[v];
    if (!remap.has(k)) { remap.set(k, qcol.length); qpos.push(...a); qcol.push(col[v]); }
    map.push(remap.get(k));
  }
  for (let i = 0; i < idx.length; i++) idx[i] = map[idx[i]];
  // drop triangles that welded into slivers
  const tri = [];
  for (let i = 0; i < idx.length; i += 3) if (idx[i] !== idx[i + 1] && idx[i + 1] !== idx[i + 2] && idx[i] !== idx[i + 2]) tri.push(idx[i], idx[i + 1], idx[i + 2]);
  idx.length = 0; idx.push(...tri);
  col.length = 0; col.push(...qcol);
  const V = qcol.length, I = idx.length;
  if (V > 65535) throw new Error(id + ': too many vertices');
  const parts = [];
  const head = Buffer.alloc(1 + id.length + 1 + pal.length * 4 + 8 + 24);
  let o = 0;
  head.writeUInt8(id.length, o++); head.write(id, o, 'ascii'); o += id.length;
  head.writeUInt8(pal.length, o++);
  for (const p of pal) { head.writeUInt8(p[0], o++); head.writeUInt8(p[1], o++); head.writeUInt8(p[2], o++); head.writeUInt8(p[3], o++); }
  head.writeUInt32LE(V, o); o += 4; head.writeUInt32LE(I, o); o += 4;
  for (const m of min) { head.writeFloatLE(m, o); o += 4; }
  for (const s of size) { head.writeFloatLE(s, o); o += 4; }
  parts.push(head);
  const q = Buffer.alloc(V * 6);
  for (let i = 0; i < V * 3; i++) q.writeUInt16LE(qpos[i], i * 2);
  parts.push(q, Buffer.from(col));
  if (V % 2) parts.push(Buffer.alloc(1));
  const ib = Buffer.alloc(I * 2);
  idx.forEach((v, i) => ib.writeUInt16LE(v, i * 2));
  parts.push(ib);
  return { buf: Buffer.concat(parts), V, I, pal: pal.length };
}

export function bakeModels(list = MODELS, log = null) {
  const head = Buffer.alloc(6);
  head.write('NCMK', 0, 'ascii'); head.writeUInt16LE(list.length, 4);
  const parts = [head];
  for (const [id, rel] of list) {
    const m = bakeOne(id, rel);
    if (log) log(`  ${id.padEnd(10)} ${String(m.I / 3).padStart(5)} tris  ${String(m.pal).padStart(3)} colours  ${(m.buf.length / 1024).toFixed(1)} KB`);
    parts.push(m.buf);
  }
  return Buffer.concat(parts);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const b = bakeModels(MODELS, console.log);
  console.log(`total ${(b.length / 1024).toFixed(1)} KB`);
}
