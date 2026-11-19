#!/usr/bin/env node
// pack-glb: embed external image URIs into the GLB BIN chunk. Usage: node tools/pack-glb.mjs in.glb out.glb
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from './glb-info.mjs';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const pad4 = (n) => (n + 3) & ~3;

export function packGLB(inPath, outPath) {
  const buf = fs.readFileSync(inPath);
  const { json, bin } = parseGLB(buf);
  const dir = path.dirname(inPath);
  const chunks = []; // bin pieces in order
  let binLen = 0;
  if (bin) { const b = Buffer.from(bin); chunks.push(b); binLen = b.length; } // keep original BIN incl. any padding
  binLen = pad4(binLen); if (binLen > (bin ? bin.length : 0)) chunks.push(Buffer.alloc(binLen - (bin ? bin.length : 0)));
  json.bufferViews = json.bufferViews || [];
  let embedded = 0;
  for (const im of json.images || []) {
    if (im.uri === undefined) continue;
    let data, mime;
    if (im.uri.startsWith('data:')) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(im.uri);
      mime = m[1]; data = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'latin1');
    } else {
      const f = path.resolve(dir, decodeURIComponent(im.uri));
      data = fs.readFileSync(f); mime = MIME[path.extname(f).toLowerCase()];
      if (!mime) throw new Error('Unknown image type: ' + im.uri);
    }
    json.bufferViews.push({ buffer: 0, byteOffset: binLen, byteLength: data.length });
    im.bufferView = json.bufferViews.length - 1; im.mimeType = mime; delete im.uri;
    chunks.push(data); binLen += data.length;
    const p = pad4(binLen) - binLen; if (p) chunks.push(Buffer.alloc(p)); binLen += p;
    embedded++;
  }
  if (binLen) {
    json.buffers = json.buffers || [{}];
    json.buffers[0] = { ...json.buffers[0], byteLength: binLen }; delete json.buffers[0].uri;
  }
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  const jp = pad4(js.length) - js.length; if (jp) js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const binBuf = Buffer.concat(chunks);
  const total = 12 + 8 + js.length + (binLen ? 8 + binBuf.length : 0);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const parts = [h, jh, js];
  if (binLen) { const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004e4942, 4); parts.push(bh, binBuf); }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.concat(parts));
  return { embedded, size: total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [i, o] = process.argv.slice(2);
  if (!i || !o) { console.error('usage: node tools/pack-glb.mjs in.glb out.glb'); process.exit(1); }
  const r = packGLB(i, o); console.log(`${o}: embedded ${r.embedded} image(s), ${r.size} bytes`);
}
