// Builds Solano Key (world/key.js has the data): its painted ground, every building, the Sunbowl stadium,
// Fernwood Park, the Mango Grove houses (Kenney City Kit Suburban), the marina and the docks, Quaternius
// street lights and road signs, palms, the seawall and the stunt ramps. Like the old town it is a handful
// of draw calls: one solid mesh (all walls get their windows from one shader, so a 110 m glass tower
// costs the same as a motel), one neon mesh, the ground, two lamp meshes (the street-light glass is
// see-through), the palms and one set of glow sprites. All of it lives in one group that
// world/districts.js swaps for a silhouette when the camera is far away.
import * as THREE from 'three';
import { box, cyl, tint, merge, rng, PI, nightU, reflU, VIEW } from '../core/util.js';
import { KEY, KH, KV, KV_W, KEY_JUNCTIONS, MPIER, KEY_ADS } from './key.js';
import { VENUE_DEFS, DOORS } from './layout.js';
import { kitGeometry } from './kits.js';
import { groundMaterial, palmMesh } from './city.js';
import { setLampMap } from './lamplight.js';
import { addSpire, addSpireBody } from './spire.js';
import { addKeyscape, KEY_SHOPS } from './keyscape.js';
import { streetAtlasMesh } from './streetscape.js';
import { createStreetTrees } from './streettrees.js';
import { createGlow } from './glow.js';
import { rampParts } from './rampGeo.js';
import { neonPools } from './neonpools.js';
import { quality } from '../core/quality.js';
import { LADDERS, LADDER_GAP } from './sea.js';
import { footprint, footBox } from './layout.js';

const W = KEY.x1 - KEY.x0, H = KEY.z1 - KEY.z0;
const INK = '#1d1630', CREAM = '#fbf7f0', STEEL = '#b9bcc8', ASPH = '#3b3548', WALL_C = '#e9d8c4', COPING = '#27c9bf';

// every part of the solid mesh carries aWin: 0 plain, 1 punched windows, 2 curtain glass, 3 ribbon windows
const withWin = (g, k = 0) => { g.setAttribute('aWin', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };

// ---------------------------------------------------------------- the painted ground
function paintKeyGround(K) {
  const CW = 2048, CH = 1024, s = CW / W;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d'), r = rng(91);
  const X = (x) => (x - KEY.x0) * s, Z = (z) => (z - KEY.z0) * s;
  const rect = (x0, z0, x1, z1, c) => { g.fillStyle = c; g.fillRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s); };
  const speckle = (x0, z0, x1, z1, n, cols, a) => { g.globalAlpha = a; for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(X(x0 + r() * (x1 - x0)), Z(z0 + r() * (z1 - z0)), 1 + r() * 2, 1 + r() * 2); } g.globalAlpha = 1; };
  // pavement everywhere, pink-grey like the old town
  rect(KEY.x0, KEY.z0, KEY.x1, KEY.z1, '#d2bfcb');
  speckle(KEY.x0, KEY.z0, KEY.x1, KEY.z1, 9000, ['#bfaab8', '#e2d2dc'], 0.5);
  // downtown plazas: pale stone tiles
  for (let x = -690; x < -484; x += 3) for (let z = -146; z < 40; z += 3) if (((x + z) / 3) % 2 === 0) { g.globalAlpha = 0.35; rect(x, z, x + 3, z + 3, '#efe4ea'); g.globalAlpha = 1; }
  // hotel row and the galleria plaza: two-tone pink tiles with a fountain basin
  g.fillStyle = '#f4bfd0';
  for (let x = -578; x < -484; x += 2) for (let z = 68; z < 146; z += 2) if (((x + 578) / 2 + (z - 68) / 2) % 2 === 0) g.fillRect(X(x), Z(z), 2 * s, 2 * s);
  // the stadium: concourse, pitch with stripes and lines, the car park with bays
  const st = K.stadium;
  rect(st.x0 - 4, st.z0 - 2, st.x1 + 4, st.z1 + 4, '#c8b8c4');
  const px0 = st.cx - st.pw / 2 - 3, pz0 = st.cz - st.pd / 2 - 3;
  rect(px0, pz0, px0 + st.pw + 6, pz0 + st.pd + 6, '#3f9c58');
  for (let i = 0; i < 12; i++) if (i % 2) rect(px0 + 3 + i * st.pw / 12, pz0 + 3, px0 + 3 + (i + 1) * st.pw / 12, pz0 + 3 + st.pd, '#4aab63');
  g.strokeStyle = '#f4fff4'; g.lineWidth = 0.35 * s;
  g.strokeRect(X(st.cx - st.pw / 2), Z(st.cz - st.pd / 2), st.pw * s, st.pd * s);
  g.beginPath(); g.moveTo(X(st.cx), Z(st.cz - st.pd / 2)); g.lineTo(X(st.cx), Z(st.cz + st.pd / 2)); g.stroke();
  g.beginPath(); g.arc(X(st.cx), Z(st.cz), 7 * s, 0, 6.3); g.stroke();
  for (const sx of [-1, 1]) { g.strokeRect(X(st.cx + sx * st.pw / 2 - (sx > 0 ? 12 : 0)), Z(st.cz - 11), 12 * s, 22 * s); g.strokeRect(X(st.cx + sx * st.pw / 2 - (sx > 0 ? 4.5 : 0)), Z(st.cz - 5), 4.5 * s, 10 * s); }
  const cp = K.carpark;
  rect(cp.x0, cp.z0, cp.x1, cp.z1, '#4a4458');
  speckle(cp.x0, cp.z0, cp.x1, cp.z1, 1600, ['#5a5468', '#3a3448'], 0.4);
  for (let x = cp.x0 + 2; x < cp.x1 - 2; x += 3.2) for (const [z0, z1] of [[cp.z0 + 2, cp.z0 + 13], [cp.z1 - 13, cp.z1 - 2], [-108, -92]]) rect(x, z0, x + 0.18, z1, '#f4eef7');
  g.fillStyle = '#ffd35c'; for (let x = cp.x0 + 6; x < cp.x1 - 6; x += 9) { g.save(); g.translate(X(x), Z(-100)); g.beginPath(); g.moveTo(0, -1.4 * s); g.lineTo(2 * s, 0); g.lineTo(0, 1.4 * s); g.fill(); g.restore(); }
  // Fernwood Park: lawns, paths, the pond
  const pk = K.park;
  rect(pk.x0, pk.z0, pk.x1, pk.z1, '#6cc294');
  speckle(pk.x0, pk.z0, pk.x1, pk.z1, 2400, ['#4fa77a', '#8fdcae', '#5fb886'], 0.6);
  g.strokeStyle = '#ead7ab'; g.lineWidth = 3.2 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(pk.x0), Z(2)); g.lineTo(X(pk.x1), Z(2)); g.stroke();
  g.beginPath(); g.moveTo(X(-790), Z(pk.z0)); g.bezierCurveTo(X(-760), Z(-10), X(-820), Z(16), X(-790), Z(pk.z1)); g.stroke();
  g.beginPath(); g.ellipse(X(-742), Z(0), 22 * s, 16 * s, 0, 0, 6.3); g.stroke();
  g.fillStyle = '#3b8fb5'; g.beginPath(); g.ellipse(X(pk.pond.x), Z(pk.pond.z), pk.pond.rx * s, pk.pond.rz * s, 0, 0, 6.3); g.fill();
  g.fillStyle = '#5fb0d0'; g.beginPath(); g.ellipse(X(pk.pond.x - 1), Z(pk.pond.z - 1), pk.pond.rx * 0.7 * s, pk.pond.rz * 0.6 * s, 0, 0, 6.3); g.fill();
  // Mango Grove: lawns either side of the street, driveways and paths to the doors
  for (const [x0, x1] of [[-1074, -1008], [-992, -888]]) rect(x0, -34, x1, 38, '#7ccf8a');
  speckle(-1074, -34, -888, 38, 2000, ['#5fb886', '#9be0a8'], 0.5);
  for (const hz of K.houses) {
    if (Math.abs(hz.x + 1000) < 30) { const sx = Math.sign(hz.x + 1000); rect(Math.min(-1000 + sx * 6, hz.x - sx * 5), hz.z + 2, Math.max(-1000 + sx * 6, hz.x - sx * 5), hz.z + 5.6, '#cdbfae'); }
    else rect(hz.x - 1.6, 27.5, hz.x + 1.6, 38, '#cdbfae');
  }
  // the marina: boardwalk planks; the docks: concrete with yellow lines
  rect(-868, 104, -712, 150, '#c99a68');
  g.globalAlpha = 0.5; for (let x = -868; x < -712; x += 1.2) rect(x, 104, x + 0.12, 150, '#8f6a46'); g.globalAlpha = 1;
  rect(-1076, 100, -890, 150, '#a9a6ad');
  speckle(-1076, 100, -890, 150, 2400, ['#8f8c94', '#c2bfc6'], 0.45);
  for (const z of [104, 121, 136, 147]) rect(-1076, z, -940, z + 0.3, '#ffd35c');
  rect(-1076, 66, -890, 100, '#b5b0b8');
  // roads, kerbs, markings, crossings
  for (const h of KH) rect(h.x0 - 4, h.z - h.w / 2, Math.min(h.x1, KEY.x1), h.z + h.w / 2, ASPH);
  for (const v of KV) rect(v.x - KV_W / 2, v.z0 - 4, v.x + KV_W / 2, v.z1 + 4, ASPH);
  speckle(KEY.x0, -140, KEY.x1, 130, 6000, ['#4a4458', '#2f2a3a'], 0.18);
  const KERB = '#efe6ee', WH = '#f4eef7';
  for (const h of KH) { rect(h.x0 - 4, h.z - h.w / 2 - 0.3, h.x1, h.z - h.w / 2, KERB); rect(h.x0 - 4, h.z + h.w / 2, h.x1, h.z + h.w / 2 + 0.3, KERB); }
  for (const v of KV) { rect(v.x - KV_W / 2 - 0.3, v.z0 - 4, v.x - KV_W / 2, v.z1 + 4, KERB); rect(v.x + KV_W / 2, v.z0 - 4, v.x + KV_W / 2 + 0.3, v.z1 + 4, KERB); }
  for (const h of KH) {
    for (let x = h.x0; x < h.x1; x += 8) if (!KEY_JUNCTIONS.some((j) => j.h === h && Math.abs(x - j.x) < 12)) rect(x, h.z - 0.12, x + 3, h.z + 0.12, WH);
    if (h.w > 14) { rect(h.x0, h.z - 0.45, h.x1, h.z - 0.2, '#ffd35c'); rect(h.x0, h.z + 0.2, h.x1, h.z + 0.45, '#ffd35c'); rect(h.x0, h.z - 8.9, h.x1, h.z - 8.6, '#ff8fc4'); rect(h.x0, h.z + 8.6, h.x1, h.z + 8.9, '#ff8fc4'); }
  }
  for (const v of KV) for (let z = v.z0; z < v.z1; z += 8) if (!KEY_JUNCTIONS.some((j) => j.v === v && Math.abs(z - j.z) < j.h.hz)) rect(v.x - 0.12, z, v.x + 0.12, z + 3, WH);
  for (const j of KEY_JUNCTIONS) {
    const hw = j.h.hw;
    for (const cx of [j.x - 8.8, j.x + 8.8]) for (let z = j.z - hw + 0.4; z < j.z + hw - 0.5; z += 1.6) rect(cx - 1.6, z, cx + 1.6, z + 0.8, WH);
    for (const zz of [j.z - j.h.hz + 2.2, j.z + j.h.hz - 2.2]) for (let x = j.x - 5.6; x < j.x + 5.5; x += 1.6) rect(x, zz - 1.6, x + 0.8, zz + 1.6, WH);
    rect(j.x - KV_W / 2, j.z - hw, j.x + KV_W / 2, j.z + hw, ASPH);
  }
  // the ramps' run-ups: chevrons on the ground
  for (const rp of K.ramps) {
    const fx = Math.sin(rp.yaw), fz = Math.cos(rp.yaw);
    for (let k = 1; k <= 3; k++) {
      const x = rp.x - fx * (rp.len / 2 + k * 3.5), z = rp.z - fz * (rp.len / 2 + k * 3.5);
      g.save(); g.translate(X(x), Z(z)); g.rotate(-rp.yaw); g.fillStyle = '#ffd35c';
      g.beginPath(); g.moveTo(-2 * s, -0.6 * s); g.lineTo(0, 0.9 * s); g.lineTo(2 * s, -0.6 * s); g.lineTo(2 * s, 0.2 * s); g.lineTo(0, 1.7 * s); g.lineTo(-2 * s, 0.2 * s); g.fill(); g.restore();
    }
  }
  g.strokeStyle = 'rgba(160,125,95,0.5)'; g.lineWidth = 10; g.strokeRect(0, 0, CW, CH);
  return cv;
}

// the key's lamp light on the ground at night (1 px = 1 m), like the old town's
function keyLampMap(K) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let neon = [];
  const pool = (x, z, rad, a, rgb = '255,196,128') => { const gr = g.createRadialGradient(x, z, 0, x, z, rad); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.45, `rgba(${rgb},${a * 0.42})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - rad, z - rad, rad * 2, rad * 2); };
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const paint = () => {
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    for (const l of K.lamps) pool(l.x - KEY.x0 + Math.sin(l.yaw) * 1.2, l.z - KEY.z0 + Math.cos(l.yaw) * 1.2, 10, 0.85);
    const st = K.stadium;
    pool(st.cx - KEY.x0, st.cz - KEY.z0, 60, 0.75, '230,240,255');
    // lit shopfronts and windows spill warm light over the pavement in front of each street face
    for (const b of K.buildings) {
      if (b.style === 'warehouse') continue;
      const o = b.door ? b.door.out : { x: b.cx, z: b.z1 + 2.4, yaw: 0 }, sx = Math.sin(o.yaw), sz = Math.cos(o.yaw);
      const fw = Math.abs(sx) > 0.5 ? b.d : b.w, fx = o.x - sx * 2.4 - KEY.x0, fz = o.z - sz * 2.4 - KEY.z0;
      g.save(); g.translate(fx, fz); g.rotate(-o.yaw);
      const sp = g.createLinearGradient(0, 0, 0, 6);
      sp.addColorStop(0, 'rgba(255,214,160,0.5)'); sp.addColorStop(1, 'rgba(255,214,160,0)');
      g.fillStyle = sp; g.fillRect(-fw * 0.38, 0, fw * 0.76, 6);
      g.restore();
      pool(o.x - KEY.x0, o.z - KEY.z0, 7, 0.32, '255,214,160');
    }
    // the big neon signs throw a pool of their own colour (High quality)
    if (quality.high) for (const n of neon) pool(n.x - KEY.x0, n.z - KEY.z0, n.r, n.a, n.rgb);
    tex.needsUpdate = true;
    data = null;
  };
  let data = null;
  paint();
  // once the key's glow sprites are all placed: which of them are neon; and again when the quality changes
  return {
    tex, repaint: paint, setNeon(list) { neon = list; paint(); },
    // the lamp-light term (0..1+) the ground gets at (x, z) at full night, for checks
    sample(x, z) {
      if (!data) data = g.getImageData(0, 0, W, H).data;
      const i = (Math.floor(Math.min(H - 1, Math.max(0, z - KEY.z0))) * W + Math.floor(Math.min(W - 1, Math.max(0, x - KEY.x0)))) * 4;
      return (data[i] + data[i + 1] + data[i + 2]) / 765;
    },
  };
}

// ---------------------------------------------------------------- the key
export function buildKey(scene, L, renderer, adSigns) {
  const K = L.key, r = rng(5150), P = L.props;
  const group = new THREE.Group();
  scene.add(group);
  const S = [], N = [], glows = [];
  const bx = (w, h, d, x, y, z, hex, win = 0, rx = 0, ry = 0, rz = 0) => withWin(box(w, h, d, x, y, z, hex, rx, ry, rz), win);
  const cy = (rt, rb, h, seg, x, y, z, hex, rx = 0, rz = 0) => withWin(cyl(rt, rb, h, seg, x, y, z, hex, rx, rz));
  const kit = (id, o) => withWin(kitGeometry(id, o));
  const sign = (name, x, y, z, yaw, w) => { const h = w / 4, sx = Math.sin(yaw), sz = Math.cos(yaw); adSigns.push({ name, x: x + sx * 0.14, y, z: z + sz * 0.14, yaw, w, h }); S.push(bx(w + 0.4, h + 0.3, 0.22, x, y, z, INK, 0, 0, yaw)); };
  // a billboard on stilts on a roof (or the ground), facing yaw, lamps on arms above it
  const billboard = (name, x, y0, z, yaw, w) => {
    const h = w / 4, y = y0 + 1.6 + h / 2, sx = Math.sin(yaw), sz = Math.cos(yaw), c = Math.cos(yaw), sn = Math.sin(yaw);
    adSigns.push({ name, x: x + sx * 0.14, y, z: z + sz * 0.14, yaw, w, h });
    S.push(bx(w + 0.5, h + 0.4, 0.22, x, y, z, INK, 0, 0, yaw));
    for (const o of [-w * 0.32, w * 0.32]) {
      S.push(bx(0.22, y - y0, 0.22, x + c * o - sx * 0.2, y0 + (y - y0) / 2, z - sn * o - sz * 0.2, '#3b3350'));
      if (y0 < 1) footprint('billboard leg: ' + name, x + c * o - sx * 0.2, z - sn * o - sz * 0.2, 0.11);
      S.push(bx(0.08, 0.08, 1.2, x + c * o + sx * 0.5, y + h / 2 + 0.4, z - sn * o + sz * 0.5, '#3b3350', 0, yaw), bx(0.4, 0.14, 0.3, x + c * o + sx * 1.05, y + h / 2 + 0.35, z - sn * o + sz * 1.05, '#fff2c8', 0, yaw));
      glows.push([x + c * o + sx * 1.0, y + h / 2 + 0.2, z - sn * o + sz * 1.0, '#ffe7b0', 4.5, 0]);
    }
    if (y0 > 1) P.box(x, z, Math.abs(c) * w + 0.6, Math.abs(sn) * w + 0.6, y + h / 2, 0, y0 - 0.2);
  };
  let ad = 0;
  const nextAd = () => K_ADS[ad++ % K_ADS.length];

  // ---------------------------------------------------------------- buildings
  const front = (b) => b.door.out;
  const roofClutter = (b, n) => {
    for (let i = 0; i < n; i++) {
      const x = b.cx + (r() - 0.5) * (b.w - 8), z = b.cz + (r() - 0.5) * (b.d - 8);
      if (Math.hypot(x - b.door.x, z - b.door.z) < 4 || (b.pad && Math.hypot(x - b.pad.x, z - b.pad.z) < b.pad.r + 1.5)) continue;
      S.push(bx(1.8, 1, 1.3, x, b.roofY + 0.5, z, '#cfd3da'), cy(0.42, 0.42, 0.06, 8, x - 0.35, b.roofY + 1.03, z, '#4a4d5c'));
      P.box(x, z, 1.8, 1.3, b.roofY + 1, 0, b.roofY);
    }
  };
  const hut = (b) => {
    const { x, z } = b.door, y = b.roofY, o = front(b), fx = Math.sign(o.x - x) * (Math.abs(o.x - x) > Math.abs(o.z - z) ? 1 : 0), fz = fx ? 0 : Math.sign(o.z - z) || 1;
    S.push(bx(2.2, 2.6, 2.2, x, y + 1.3, z, CREAM), bx(2.5, 0.2, 2.5, x, y + 2.7, z, b.accent), bx(fx ? 0.08 : 1, 2, fz ? 0.08 : 1, x + fx * 1.12, y + 1, z + fz * 1.12, '#2b2440'));
    N.push(bx(fx ? 0.1 : 0.5, 0.1, fz ? 0.1 : 0.5, x + fx * 1.18, y + 2.25, z + fz * 1.18, '#ffe7b0'));
    glows.push([x + fx * 1.4, y + 2.2, z + fz * 1.4, '#ffe7b0', 2.5, 0.1]);
  };
  const slabRoof = (b, hex = '#cfd3da') => S.push(bx(b.w, 0.6, b.d, b.cx, b.h + 0.3, b.cz, hex));
  const roofline = (b, y, hex = b.neon) => N.push(bx(b.w + 0.3, 0.12, 0.12, b.cx, y, b.z0 - 0.1, hex), bx(b.w + 0.3, 0.12, 0.12, b.cx, y, b.z1 + 0.1, hex), bx(0.12, 0.12, b.d + 0.3, b.x0 - 0.1, y, b.cz, hex), bx(0.12, 0.12, b.d + 0.3, b.x1 + 0.1, y, b.cz, hex));
  const sideOf = (b) => { const o = front(b); return o.yaw === 0 ? [0, 1] : o.yaw === PI ? [0, -1] : o.yaw > 0 ? [1, 0] : [-1, 0]; };

  for (const b of K.buildings) {
    const s0 = S.length, n0 = N.length;
    const { cx, cz, w, d, h } = b, [fx, fz] = sideOf(b);
    const faceX = fx ? (fx > 0 ? b.x1 : b.x0) : cx, faceZ = fz ? (fz > 0 ? b.z1 : b.z0) : cz, along = fx ? d : w, yawF = Math.atan2(fx, fz);
    const onFace = (o, y, out, ww, hh, dd, hex, win = 0) => bx(fx ? dd : ww, hh, fx ? ww : dd, faceX + fx * out + (fx ? 0 : o), y, faceZ + fz * out + (fz ? 0 : o), hex, win);
    if (b.style === 'tower') {
      if (b.spire) addSpireBody({ b, S, N, glows, bx, cy });       // the Solstice Spire's own champagne-gold shaft (world/spire.js)
      else {
        S.push(bx(w, h, d, cx, h / 2, cz, b.color, 2));
        S.push(bx(w + 1.2, 5, d + 1.2, cx, 2.5, cz, '#ece6f0', 3));                                  // lobby podium
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(bx(1, h + 1, 1, cx + sx * (w / 2), (h + 1) / 2, cz + sz * (d / 2), '#e4e8f0'));
        for (let y = 20; y < h - 4; y += 20) S.push(bx(w + 0.5, 0.5, d + 0.5, cx, y, cz, '#e4e8f0'));
      }
      slabRoof(b, b.spire ? '#d8c49a' : '#bfc3cc');
      roofline(b, h + 0.66);
      if (b.pad) {
        const { x, z, r: pr } = b.pad, y = b.roofY;
        S.push(cy(pr + 0.4, pr + 0.4, 0.06, 24, x, y + 0.03, z, '#ffd447'), cy(pr, pr, 0.08, 24, x, y + 0.05, z, '#3b3548'));
        S.push(bx(0.9, 0.04, 5, x - 1.6, y + 0.1, z, CREAM), bx(0.9, 0.04, 5, x + 1.6, y + 0.1, z, CREAM), bx(2.3, 0.04, 0.9, x, y + 0.1, z, CREAM));
        for (let k = 0; k < 8; k++) { const a = k * PI / 4; glows.push([x + Math.cos(a) * (pr + 0.4), y + 0.25, z + Math.sin(a) * (pr + 0.4), k % 2 ? '#8dff5a' : '#ffffff', 1.6, 0.35]); N.push(bx(0.2, 0.15, 0.2, x + Math.cos(a) * (pr + 0.4), y + 0.1, z + Math.sin(a) * (pr + 0.4), '#8dff5a')); }
      }
      if (b.spire) {
        // the Solstice Spire: a lit name crown and the Solstice Terrace on the roof (world/spire.js)
        b.terrace = addSpire({ b, S, N, glows, P, bx, cy, sign, group });
      } else {
        const mz = b.cz + (b.cz > b.door.z ? 1 : -1) * (d / 2 - 2.5);
        S.push(bx(0.15, 9, 0.15, b.x0 + 2.5, b.roofY + 4.5, mz, STEEL)); glows.push([b.x0 + 2.5, b.roofY + 9.2, mz, '#ff3040', 3, 0.3]);
        P.circle(b.x0 + 2.5, mz, 0.2, b.roofY + 9, b.roofY);
      }
    } else if (b.style === 'office') {
      S.push(bx(w, h, d, cx, h / 2, cz, b.color, 3));
      for (let y = 3.4 * 3; y < h - 2; y += 3.4 * 3) S.push(bx(w + 0.4, 0.45, d + 0.4, cx, y, cz, b.accent));
      S.push(bx(w + 0.8, 1, d + 0.8, cx, h - 0.4, cz, b.accent));
      slabRoof(b); roofline(b, h + 0.1);
      roofClutter(b, 3);
      if (w > 30) billboard(nextAd(), cx, b.roofY, faceZ - fz * 4 || cz, yawF, Math.min(along * 0.6, 14));
    } else if (b.style === 'apart') {
      S.push(bx(w, h, d, cx, h / 2, cz, b.color, 1), bx(w + 0.6, 0.8, d + 0.6, cx, 0.4, cz, b.accent), bx(w + 0.6, 0.7, d + 0.6, cx, h - 0.2, cz, b.accent));
      slabRoof(b, '#e8e0d8');
      // balconies on both long faces: a slab and a railing per bay per floor
      const n = Math.floor((w - 4) / 4.6);
      for (const sz of [-1, 1]) for (let f = 1; f < b.floors; f++) for (let i = 0; i < n; i++) {
        if ((i + f) % 3 === 2) continue;
        const x = cx - (n - 1) * 2.3 + i * 4.6, y = f * 3.4, z = sz > 0 ? b.z1 : b.z0;
        S.push(bx(2.6, 0.18, 1.3, x, y, z + sz * 0.65, CREAM), bx(2.6, 0.9, 0.08, x, y + 0.5, z + sz * 1.28, b.accent), bx(0.08, 0.9, 1.3, x - 1.27, y + 0.5, z + sz * 0.65, b.accent), bx(0.08, 0.9, 1.3, x + 1.27, y + 0.5, z + sz * 0.65, b.accent));
      }
      roofClutter(b, 2);
      for (let k = 0; k < 2; k++) { const x = cx + (k ? 1 : -1) * w * 0.3, z = cz; S.push(cy(1.2, 1.2, 2, 10, x, b.roofY + 2.4, z, '#a8744e'), bx(2, 1.4, 2, x, b.roofY + 0.7, z, '#5a4a3a')); P.box(x, z, 2.4, 2.4, b.roofY + 3.4, 0, b.roofY); }
    } else if (b.style === 'deco') {
      S.push(bx(w, h, d, cx, h / 2, cz, b.color, 1), bx(w + 0.5, 0.7, d + 0.5, cx, 0.35, cz, b.accent));
      for (let f = 1; f < b.floors; f++) S.push(bx(w + 0.6, 0.28, d + 0.6, cx, f * 3.4 - 0.14, cz, CREAM));
      S.push(bx(w + 0.8, 0.7, d + 0.8, cx, h - 0.2, cz, b.accent));
      slabRoof(b, '#efe6ee'); roofline(b, h + 0.66);
      N.push(bx(fx ? 0.1 : w + 0.7, 0.1, fx ? d + 0.7 : 0.1, faceX + fx * 0.4 || cx, 3.5, faceZ + fz * 0.4 || cz, b.neon));
      // the stepped central fin on the street face with vertical neon, a canopy, the name on top
      S.push(onFace(0, (h + 4) / 2, 0.6, 6, h + 4, 1.6, CREAM), onFace(0, h + 5, 0.6, 3.6, 2.4, 1.6, b.accent), onFace(0, 1.6, 1.8, 8, 0.35, 3.4, b.accent), onFace(0, 1.35, 0.1, 3.2, 2.7, 0.25, '#2b2440'));
      for (const o of [-1.8, 0, 1.8]) N.push(onFace(o, 4.4 + (h - 9.4) / 2, 1.45, 0.16, h - 9.4, 0.12, b.neon));
      if (b.name) sign(b.name, faceX + fx * 1.6 || cx, h - 2.6, faceZ + fz * 1.6 || cz, yawF, Math.min(along * 0.55, 15));
      glows.push([faceX + fx * 2 || cx, h * 0.55, faceZ + fz * 2 || cz, b.neon, 16, 0]);
      P.box(cx, cz, 4, 4, b.roofY + 1.6, 0, b.roofY);
      roofClutter(b, 2);
      billboard(nextAd(), cx + (fx ? 0 : w * 0.2), b.roofY, cz + (fz ? 0 : d * 0.2), yawF, Math.min(along * 0.5, 12));
    } else if (b.style === 'motel') {
      // (everything runs along the street face: `along` is its length, whichever way the motel faces; the
      // walkway, stairs and doors used to run the building's x width, so the east-facing motels' 50 m
      // walkway poked out past the lot into Stadium Way)
      S.push(bx(w, h, d, cx, h / 2, cz, b.color, 1), bx(w + (fx ? 3.2 : 1.2), 0.5, d + (fz ? 3.2 : 1.2), cx + fx * 1, h + 0.1, cz + fz * 1, b.accent));
      // the open walkway along the upper floor, with a railing and a stair at each end
      S.push(onFace(0, 3.3, 1.2, along - 2, 0.25, 2.4, CREAM), onFace(0, 4.25, 2.35, along - 2, 0.9, 0.08, b.accent));
      for (const o of [-along / 2 + 1.4, along / 2 - 1.4]) S.push(onFace(o, 1.7, 1.2, 1.4, 3.4, 2.2, '#c8b8c4'));
      for (let i = -along / 2 + 3; i < along / 2 - 2; i += 4.2) { S.push(onFace(i, 1.1, 0.05, 1.1, 2.2, 0.12, '#2b2440'), onFace(i, 4.5, 0.05, 1.1, 2.2, 0.12, '#2b2440')); }
      slabRoof(b, '#f0e6dc'); roofClutter(b, 2);
      if (b.name) {
        // the roadside sign on a pole out front, at the street-side end of the face: name, and VACANCY in red neon
        const o = along / 2 - 4, px = fx ? faceX + fx * 5 : cx + o, pz = fz ? faceZ + fz * 5 : cz - o;
        S.push(cy(0.25, 0.3, 12, 8, px, 6, pz, '#3b3350'));
        sign(b.name, px, 11.5, pz, yawF, 9);
        sign('VACANCY', px, 8.6, pz, yawF, 5);
        glows.push([px + fx, 11.5, pz + fz, b.neon, 10, 0.05], [px + fx, 8.6, pz + fz, '#ff2a3a', 6, 0.1]);
        P.circle(px, pz, 0.3, 12);
        footprint('motel sign pole: ' + b.name, px, pz, 0.3);
      }
    } else if (b.style === 'warehouse') {
      S.push(bx(w, h, d, cx, h / 2, cz, b.color));
      for (let i = -w / 2 + 1.5; i < w / 2; i += 3) for (const sz of [-1, 1]) S.push(bx(0.18, h, 0.18, cx + i, h / 2, (sz > 0 ? b.z1 : b.z0) + sz * 0.09, '#9aa2ad'));
      S.push(bx(w - 4, 1.2, 0.12, cx, h - 1.6, faceZ + fz * 0.1 || cz, '#2c5f7a', 3));
      for (let i = -1; i <= 1; i++) S.push(onFace(i * w * 0.3, 2.7, 0.08, 6, 5.4, 0.15, '#6a6e78'), onFace(i * w * 0.3, 5.6, 0.2, 6.6, 0.4, 0.5, b.accent));
      slabRoof(b, '#9aa2ad');
      for (let i = -w / 2 + 6; i < w / 2 - 4; i += 9) S.push(bx(3, 0.5, d * 0.7, cx + i, b.roofY + 0.25, cz, '#2c5f7a', 2));
      if (b.name) sign(b.name, faceX + fx * 0.3 || cx, h - 3.6, faceZ + fz * 0.3 || cz, yawF, Math.min(along * 0.5, 14));
    } else if (b.style === 'mall') {
      S.push(bx(w, h, d, cx, h / 2, cz, b.color), bx(w + 0.4, 1.1, d + 0.4, cx, 3.6, cz, b.accent), bx(w + 0.4, 0.8, d + 0.4, cx, h - 0.6, cz, '#ffd447'));
      for (let i = -w / 2 + 4; i < w / 2 - 3; i += 8) if (Math.abs(i) > 12) S.push(onFace(i, 6.6, 0.06, 5, 2.6, 0.1, '#2c5f7a', 2));
      // glass atrium at the entrance under a pink arch, the name in neon over it
      S.push(onFace(0, 4.8, 2, 22, 9.6, 4, '#7fb8d0', 2), onFace(0, 10.2, 2.2, 24, 1.2, 4.4, '#ff5fa8'), onFace(-11.5, 5, 2.2, 1.2, 10, 4.4, '#ff5fa8'), onFace(11.5, 5, 2.2, 1.2, 10, 4.4, '#ff5fa8'));
      sign(b.name, faceX + fx * 4.4 || cx, 12.4, faceZ + fz * 4.4 || cz, yawF, 16);
      N.push(onFace(0, 10.9, 4.5, 24.4, 0.14, 0.14, '#ff2bd1'), onFace(0, 9.5, 4.5, 24.4, 0.14, 0.14, '#18f0ff'));
      glows.push([faceX + fx * 6 || cx, 9, faceZ + fz * 6 || cz, '#ff5fa8', 20, 0.05]);
      // the way in: automatic sliding glass doors in the atrium's front, a lit canopy over them, planters either side
      S.push(onFace(0, 1.45, 4.06, 5.6, 2.9, 0.1, '#bfe4f2'), onFace(-1.4, 1.45, 4.12, 0.06, 2.9, 0.1, '#c8c4d4'), onFace(1.4, 1.45, 4.12, 0.06, 2.9, 0.1, '#c8c4d4'), onFace(0, 1.45, 4.13, 0.1, 2.9, 0.12, '#a8a2b8'),
        onFace(-2.9, 1.5, 4.12, 0.3, 3.0, 0.25, '#f6f1e7'), onFace(2.9, 1.5, 4.12, 0.3, 3.0, 0.25, '#f6f1e7'), onFace(0, 3.05, 4.12, 6.1, 0.25, 0.25, '#f6f1e7'),
        onFace(0, 0.02, 4.7, 6.4, 0.04, 1.2, '#2a2140'), onFace(0, 0.03, 4.7, 5.8, 0.04, 1.0, '#27d8cf'),
        onFace(0, 3.45, 4.7, 7.4, 0.2, 1.3, '#27d8cf'), onFace(0, 3.62, 4.7, 7.6, 0.14, 1.4, '#f6f1e7'));
      for (const o of [-3.3, 3.3]) S.push(onFace(o, 3.0, 5.25, 0.08, 0.9, 0.08, '#c8c4d4'));
      N.push(onFace(0, 3.35, 5.37, 7.4, 0.07, 0.07, '#ff2bd1'), onFace(0, 3.56, 5.42, 7.6, 0.06, 0.06, '#18f0ff'), onFace(0, 2.92, 4.2, 5.4, 0.05, 0.05, '#ffe9b0'));
      for (const o of [-4.6, 4.6]) {
        S.push(onFace(o, 0.4, 5.0, 1.2, 0.8, 1.2, '#f6f1e7'), onFace(o, 0.82, 5.0, 1.26, 0.06, 1.26, '#27d8cf'), onFace(o, 1.25, 5.0, 0.9, 0.8, 0.9, '#3f9f6a', 0), onFace(o, 1.8, 5.0, 0.5, 0.5, 0.5, '#5fbf7a'));
        P.box(faceX + fx * 5.0 + (fx ? 0 : o), faceZ + fz * 5.0 + (fz ? 0 : o), 1.2, 1.2, 1.0);
      }
      glows.push([faceX + fx * 5.0 || cx, 3.1, faceZ + fz * 5.0 || cz, '#ffe9c0', 7, 0.25]); DOORS.push({ what: 'Seafoam Galleria sliding doors', x: faceX + fx * 4.1 || cx, z: faceZ + fz * 4.1 || cz });
      slabRoof(b, '#efe0ea');
      for (let i = -2; i <= 2; i++) S.push(bx(6, 0.8, 6, cx + i * 18, b.roofY + 0.4, cz, '#7fb8d0', 2));
      for (let i = -2; i <= 2; i++) P.box(cx + i * 18, cz, 6, 6, b.roofY + 0.8, 0, b.roofY);
      roofClutter(b, 4);
      billboard(nextAd(), cx - w * 0.3, b.roofY, cz, yawF, 14); billboard(nextAd(), cx + w * 0.3, b.roofY, cz, yawF, 14);
    }
    if (!b.spire) hut(b);
    // every part of the lot that stands at street level (below 5 m) goes on the footprint check (layout.js)
    for (const g of [...S.slice(s0), ...N.slice(n0)]) {
      g.computeBoundingBox(); const bb = g.boundingBox;
      if (bb.min.y < 5) footBox(`${b.style}: ${b.name || b.cx + ',' + b.cz}`, bb.min.x, bb.max.x, bb.min.z, bb.max.z);
    }
  }

  // ---------------------------------------------------------------- the venues' street doors
  // Every place you can walk into on the key gets a door that reads from the street: glass double doors in a
  // frame on the façade at its ring, a lit canopy with a neon edge, a lamp either side, a step and a mat.
  for (const k in VENUE_DEFS) {
    const d = VENUE_DEFS[k];
    if (d.isle !== 'key' || k === 'mall' || d.hidden) continue;
    const b = K.buildings.find((q) => q.name === d.at); if (!b) continue;
    const nx = Math.round(Math.sin(d.face)), nz = Math.round(Math.cos(d.face));
    const fxp = nx ? (nx > 0 ? b.x1 : b.x0) : b.cx + d.along, fzp = nz ? (nz > 0 ? b.z1 : b.z0) : b.cz + d.along;
    // a frame in façade coordinates: o along the wall, out from it
    const at = (o, out) => [fxp + nx * out + (nx ? 0 : o), fzp + nz * out + (nz ? 0 : o)];
    const pb = (o, y, out, ww, hh, dd, hex) => { const [x, z] = at(o, out); return bx(nx ? dd : ww, hh, nx ? ww : dd, x, y, z, hex); };
    const col = d.color;
    if (k !== 'spire') {
      S.push(pb(0, 1.4, 0.06, 2.6, 2.8, 0.1, '#9fd0e8'), pb(0, 1.4, 0.12, 0.08, 2.8, 0.1, '#c8c4d4'), pb(-1.38, 1.45, 0.12, 0.18, 2.95, 0.22, '#f6f1e7'), pb(1.38, 1.45, 0.12, 0.18, 2.95, 0.22, '#f6f1e7'),
        pb(0, 2.95, 0.12, 2.95, 0.2, 0.24, '#f6f1e7'), pb(-0.55, 1.2, 0.14, 0.05, 0.4, 0.06, '#d4d6de'), pb(0.55, 1.2, 0.14, 0.05, 0.4, 0.06, '#d4d6de'),
        pb(0, 0.06, 0.8, 3.0, 0.12, 1.4, '#e8e0d8'), pb(0, 0.125, 0.8, 1.8, 0.02, 0.9, '#2a2140'),
        pb(0, 3.35, 1.0, 3.8, 0.18, 1.9, col), pb(0, 3.5, 1.0, 3.9, 0.1, 2.0, '#f6f1e7'));
      N.push(pb(0, 3.26, 1.97, 3.8, 0.06, 0.06, col), pb(0, 2.98, 0.26, 2.6, 0.04, 0.04, '#ffe9b0'));
      for (const o of [-1.9, 1.9]) { S.push(pb(o, 2.2, 0.1, 0.18, 0.32, 0.18, '#2a2140')); N.push(pb(o, 2.2, 0.2, 0.14, 0.22, 0.06, '#ffe9b0')); const [gx, gz] = at(o, 0.5); glows.push([gx, 2.2, gz, '#ffe0b0', 3.2, 0.2]); }
      const [cx2, cz2] = at(0, 1.1); glows.push([cx2, 3.0, cz2, '#ffe9c0', 6, 0.2]);
      footBox(`door: ${d.name}`, ...(() => { const [ax, az] = at(-2, 0), [bx2, bz2] = at(2, 2.0); return [Math.min(ax, bx2), Math.max(ax, bx2), Math.min(az, bz2), Math.max(az, bz2)]; })());
    }
    const [dx, dz] = at(0, 0.1);
    DOORS.push({ what: d.name + (k === 'spire' ? ' revolving door' : ' glass doors'), x: dx, z: dz });
  }

  // ---------------------------------------------------------------- the Sunbowl
  {
    const st = K.stadium, SW = 13, TEAL = '#19c9bd', PINK = '#ff4fa3', CROWD = ['#ff5fa8', '#27d8cf', '#ffd447', '#f6f1e7', '#ff8a4c', '#9b7bff', '#7fe0ff', '#2a2140'];
    // stepped stands: six terraces rising away from the pitch, crowd dots on the steps, a back wall
    const stand = (x0, x1, z0, z1, alongX, inward) => {
      const len = alongX ? x1 - x0 : z1 - z0, depth = alongX ? z1 - z0 : x1 - x0, mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
      for (let k = 0; k < 6; k++) {
        const t = (k + 0.5) / 6, hh = 1.2 + k * 1.9, o = inward * (depth / 2 - t * depth);
        const c = k % 2 ? TEAL : PINK;
        if (alongX) S.push(bx(len, hh, depth / 6, mid, hh / 2, (z0 + z1) / 2 + o, c)); else S.push(bx(depth / 6, hh, len, (x0 + x1) / 2 + o, hh / 2, mid, c));
        for (let i = 0; i < len / 1.6; i++) if (r() < 0.55) {
          const a = -len / 2 + 0.8 + i * 1.6 + (r() - 0.5) * 0.4, cc = CROWD[Math.floor(r() * CROWD.length)];
          if (alongX) S.push(bx(0.55, 0.7, 0.45, mid + a, hh + 0.35, (z0 + z1) / 2 + o, cc)); else S.push(bx(0.45, 0.7, 0.55, (x0 + x1) / 2 + o, hh + 0.35, mid + a, cc));
        }
      }
      const back = -inward * depth / 2;
      if (alongX) S.push(bx(len, 14, 0.6, mid, 7, (z0 + z1) / 2 + back, '#e9d8c4')); else S.push(bx(0.6, 14, len, (x0 + x1) / 2 + back, 7, mid, '#e9d8c4'));
    };
    stand(st.x0, st.x1, st.z0, st.z0 + SW, true, 1);
    stand(st.x0, st.x1, st.z1 - SW, st.z1, true, -1);
    stand(st.x0, st.x0 + SW, st.z0 + SW + 6, st.z1 - SW - 6, false, 1);
    stand(st.x1 - SW, st.x1, st.z0 + SW + 6, st.z1 - SW - 6, false, -1);
    // canopies over the long stands, on white posts
    for (const z of [st.z0 + SW / 2 - 1, st.z1 - SW / 2 + 1]) {
      S.push(bx(st.w - 6, 0.4, SW + 2, st.cx, 16.5, z, '#f6f1e7'));
      N.push(bx(st.w - 6, 0.12, 0.12, st.cx, 16.2, z + (z < st.cz ? SW / 2 + 1 : -SW / 2 - 1), '#18f0ff'));
      for (let x = st.x0 + 6; x < st.x1 - 4; x += 16) S.push(bx(0.5, 16.5, 0.5, x, 8.25, z + (z < st.cz ? -SW / 2 : SW / 2), CREAM));
    }
    // floodlight masts at the corners: a bank of lamps that glares at dusk and night
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = st.cx + sx * (st.w / 2 + 2), z = st.cz + sz * (st.d / 2 + 2);
      S.push(cy(0.45, 0.7, 34, 8, x, 17, z, '#d8d8e0'));
      const yaw = Math.atan2(st.cx - x, st.cz - z);
      S.push(bx(6, 3.6, 0.6, x, 35, z, '#3b3350', -0.35, yaw));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const lx = (i - 1) * 1.8, ly = 34.2 + j * 1.6, px = x + Math.cos(yaw) * lx + Math.sin(yaw) * 0.4, pz = z - Math.sin(yaw) * lx + Math.cos(yaw) * 0.4;
        N.push(bx(1.4, 1.2, 0.12, px, ly, pz, '#fff8e0', -0.35, yaw));
        if (j === 0 && i !== 1) glows.push([px + Math.sin(yaw) * 0.6, ly + 0.8, pz + Math.cos(yaw) * 0.6, '#f4f8ff', 6.5, 0]);
      }
      P.circle(x, z, 0.75, 36);
    }
    // the scoreboard over the west stand, and the name over the south entrance
    const sbx = st.x0 + SW / 2, sbz = st.cz;
    S.push(bx(1.2, 9, 1.2, sbx - 0.5, 18, sbz - 7, '#3b3350'), bx(1.2, 9, 1.2, sbx - 0.5, 18, sbz + 7, '#3b3350'), bx(0.8, 6.6, 20.6, sbx, 24, sbz, INK));
    adSigns.push({ name: 'SCOREBOARD', x: sbx + 0.45, y: 24, z: sbz, yaw: PI / 2, w: 20, h: 5 });
    adSigns.push({ name: 'SCOREBOARD', x: sbx - 0.45, y: 24, z: sbz, yaw: -PI / 2, w: 20, h: 5 });
    glows.push([sbx + 2, 24, sbz, '#ffb000', 18, 0.15]);
    sign('Sunbowl Stadium', st.cx, 15, st.z1 + 0.5, 0, 22);
    glows.push([st.cx, 15, st.z1 + 2, '#ff2bd1', 22, 0]);
    // the car park: a pay booth, lamps (see the lamp list), and the kicker ramp's show cars are real cars
    S.push(bx(3, 2.6, 2.4, K.carpark.x1 - 4, 1.3, -64, '#ffd447'), bx(3.4, 0.25, 2.8, K.carpark.x1 - 4, 2.7, -64, '#ff4fa3'));
    P.box(K.carpark.x1 - 4, -64, 3, 2.4, 2.8);
    billboard(nextAd(), -930, 0, -143, 0, 14);
  }

  // ---------------------------------------------------------------- Fernwood Park: trees, the hill, a bandstand, benches
  for (const t of K.trees) S.push(kit(t.big ? 'treeL' : 'treeS', { scale: 8 * t.s, yaw: t.yaw, x: t.x, z: t.z, recolor: (rr, gg, bb) => (gg > 200 && rr < 170 ? (t.x > -900 ? '#3fae6a' : '#5fc27a') : null) }));
  {
    const pk = K.park;
    S.push(cy(4, 4, 0.5, 10, -742, 0.25, 22, CREAM), cy(4.6, 0.6, 2, 10, -742, 5.5, 22, '#ff8fb0'));
    for (let k = 0; k < 6; k++) { const a = k * PI / 3; S.push(cy(0.15, 0.15, 4.2, 6, -742 + Math.cos(a) * 3.6, 2.6, 22 + Math.sin(a) * 3.6, CREAM)); P.circle(-742 + Math.cos(a) * 3.6, 22 + Math.sin(a) * 3.6, 0.2, 4.5); }
    N.push(cy(4.65, 4.65, 0.12, 12, -742, 4.5, 22, '#ffe14a'));
    glows.push([-742, 4.2, 22, '#ffe7b0', 9, 0]);
    for (const bn of K.benches) S.push(bx(1.8, 0.1, 0.55, bn.x, 0.48, bn.z, '#c98a5e', 0, bn.yaw), bx(1.8, 0.5, 0.08, bn.x - Math.sin(bn.yaw) * 0.26, 0.8, bn.z - Math.cos(bn.yaw) * 0.26, '#c98a5e', 0, bn.yaw), bx(0.08, 0.48, 0.5, bn.x, 0.24, bn.z, '#3b3350', 0, bn.yaw));
    // low hedges round the park
    for (const [x0, x1, z0, z1] of [[pk.x0, pk.x1, pk.z0 - 1, pk.z0], [pk.x0, pk.x1, pk.z1, pk.z1 + 1]]) for (let x = x0; x < x1; x += 4) if (Math.abs(x + 2 + 790) > 4) S.push(bx(3.6, 0.9, z1 - z0, x + 2, 0.45, (z0 + z1) / 2, '#2f8f4f'));
  }

  // ---------------------------------------------------------------- Mango Grove: Kenney suburban houses, fences, trees
  for (const hs of K.houses) {
    const rec = (rr, gg, bb) => (rr === 250 && gg === 165 ? hs.color : rr === 157 && gg === 223 ? hs.roof : rr === 197 ? '#f6f1e7' : null);
    S.push(kit(hs.id, { scale: 8, yaw: hs.yaw, x: hs.x, z: hs.z, recolor: rec }));
    // a mailbox by the gate and a little porch light
    const fx = Math.sin(hs.yaw), fz = Math.cos(hs.yaw);
    glows.push([hs.x + fx * 4.6, 2.4, hs.z + fz * 4.6, '#ffe7b0', 3, 0]);
  }
  for (const f of K.fences) {
    const ax = Math.abs(Math.sin(f.yaw)) > 0.5;
    for (const o of [-4.2, -1.8, 1.8, 4.2]) S.push(kit('fenceS', { scale: 3, yaw: f.yaw, x: f.x + (ax ? 0 : o), z: f.z + (ax ? o : 0), recolor: () => '#fbf7f0' }));
  }

  // ---------------------------------------------------------------- the marina and the docks
  {
    const MP = MPIER, px = (MP.x0 + MP.x1) / 2, plen = MP.z1 - MP.z0;
    S.push(bx(12, 0.5, plen, px, -0.25, MP.z0 + plen / 2, '#b98a5e'));
    for (let z = MP.z0 + 2; z < MP.z1; z += 4) S.push(bx(11.6, 0.02, 0.18, px, 0.012, z, '#93683f'));
    for (const sx of [MP.x0 + 0.15, MP.x1 - 0.15]) {
      const gaps = LADDERS.filter((l) => l.pier === 'k' && (l.s < 0) === (sx < px)).map((l) => l.z);
      let a0 = MP.z0;
      for (const gz of [...gaps, MP.z1 + LADDER_GAP]) {
        const a1 = Math.min(gz - LADDER_GAP, MP.z1);
        if (a1 > a0 + 0.2) { S.push(bx(0.12, 0.12, a1 - a0, sx, 1.1, (a0 + a1) / 2, CREAM)); N.push(bx(0.07, 0.07, a1 - a0, sx, 1.2, (a0 + a1) / 2, sx < px ? '#18f0ff' : '#ff2bd1')); }
        a0 = gz + LADDER_GAP;
      }
      for (let z = MP.z0 + 6; z <= MP.z1; z += 12.5) S.push(bx(0.6, 4, 0.6, sx, -2, z, '#6b4a30'));
    }
    for (const l of LADDERS.filter((k) => k.pier === 'k')) {
      const sx = l.x + l.s * 0.22;
      for (const o of [-0.3, 0.3]) S.push(bx(0.07, 3.9, 0.07, sx, -0.75, l.z + o, '#cfd6dd'));
      for (let y = -2.5; y < 1.1; y += 0.33) S.push(bx(0.05, 0.05, 0.6, sx, y, l.z, '#b7c0c9'));
    }
    // pontoons and moored boats either side of the pier
    for (const sx of [-1, 1]) S.push(bx(2, 0.3, 76, px + sx * 9.5, -0.35, 196, '#c99a68'), bx(4, 0.3, 2, px + sx * 7.5, -0.35, 158, '#c99a68'));
    for (const bt of K.marina.boats) {
      const len = 7 * bt.s, g = new THREE.BoxGeometry(2.6 * bt.s, 1.2, len), a = g.attributes.position;
      for (let i = 0; i < a.count; i++) { const zz = a.getZ(i), y = a.getY(i); a.setX(i, a.getX(i) * (zz > 0 ? 0.25 : 0.85) * (y < 0 ? 0.6 : 1)); }
      g.computeVertexNormals(); g.rotateY(bt.yaw); g.translate(bt.x, -0.2, bt.z);
      S.push(withWin(tint(g, CREAM)), bx(2.2 * bt.s, 0.9, len * 0.35, bt.x - Math.sin(bt.yaw) * len * 0.1, 0.8, bt.z - Math.cos(bt.yaw) * len * 0.1, bt.c, 0, 0, bt.yaw));
      S.push(bx(0.12, 7 * bt.s, 0.12, bt.x, 3.5 * bt.s, bt.z, '#e8e0d0'));
    }
    // the marina gate sign at the foot of the pier
    S.push(bx(0.5, 5.6, 0.5, MP.x0 + 0.3, 2.8, MP.z0 + 1, '#a5e6cf'), bx(0.5, 5.6, 0.5, MP.x1 - 0.3, 2.8, MP.z0 + 1, '#a5e6cf'));
    sign('Starboard Marina', px, 5.6, MP.z0 + 1, PI, 11);
    glows.push([px, 5.6, MP.z0, '#18f0ff', 14, 0]);
    // the docks: containers, cranes, bollards on the quay
    for (const c of K.docks.containers) {
      const ax = c.yaw === 0;
      S.push(bx(ax ? 12.2 : 2.5, 2.55, ax ? 2.5 : 12.2, c.x, c.y + 1.28, c.z, c.c));
      for (let i = -5.4; i <= 5.4; i += 0.9) S.push(bx(ax ? 0.12 : 2.56, 2.3, ax ? 2.56 : 0.12, c.x + (ax ? i : 0), c.y + 1.28, c.z + (ax ? 0 : i), c.c === '#7a7f8c' ? '#6a6e78' : '#2a2433'));
    }
    for (const c of K.docks.cranes) {
      for (const sx of [-4.4, 4.4]) for (const sz of [-5, 5]) S.push(bx(0.9, 26, 0.9, c.x + sx, 13, c.z + sz, '#ffb000'));
      S.push(bx(10, 1.4, 1.4, c.x, 26, c.z - 5, '#ffb000'), bx(10, 1.4, 1.4, c.x, 26, c.z + 5, '#ffb000'), bx(2.2, 2.4, 46, c.x, 28, c.z - 4, '#ffb000'), bx(4, 3.4, 5, c.x, 25, c.z - 2, CREAM));
      S.push(bx(0.08, 14, 0.08, c.x, 21, c.z + 14, '#22203a'), bx(2.6, 0.6, 3, c.x, 14, c.z + 14, '#3b3350'));
      glows.push([c.x, 30, c.z - 26, '#ff3040', 4, 0.3], [c.x, 30, c.z + 18, '#ff3040', 4, 0.3]);
    }
    for (let x = KEY.x0 + 6; x < -892; x += 9) S.push(cy(0.3, 0.38, 0.8, 8, x, 0.4, KEY.z1 - 1.4, '#3b3350'));
  }

  // ---------------------------------------------------------------- the galleria fountain
  S.push(cy(4.2, 4.4, 0.7, 16, -561, 0.35, 136, CREAM), cy(3.7, 3.7, 0.1, 16, -561, 0.62, 136, '#6fc8e0'), cy(0.5, 0.7, 2.6, 8, -561, 1.3, 136, CREAM), cy(1.4, 1.4, 0.3, 12, -561, 2.6, 136, '#ff8fb0'));
  P.circle(-561, 136, 4.3, 0.9);
  glows.push([-561, 2, 136, '#7fe0ff', 8, 0]);

  // ---------------------------------------------------------------- the seawall round the key (gaps for the causeway and the marina pier)
  {
    const T = 1.2, TOP = 0.85, C = L.key && { z0: 44, z1: 62 };
    const wall = (alongX, fixed, a0, a1) => {
      const len = a1 - a0, mid = (a0 + a1) / 2;
      const at = (h, d, y, hex) => (alongX ? bx(len, h, d, mid, y, fixed, hex) : bx(d, h, len, fixed, y, mid, hex));
      S.push(at(TOP + 3, T, (TOP - 3) / 2, WALL_C), at(0.14, T + 0.25, TOP + 0.07, COPING), at(0.06, 0.07, TOP + 0.55, CREAM), at(0.07, 0.09, TOP + 0.95, CREAM));
      for (let a = a0 + 1; a < a1; a += 2.5) S.push(alongX ? bx(0.09, 1, 0.09, a, TOP + 0.5, fixed, CREAM) : bx(0.09, 1, 0.09, fixed, TOP + 0.5, a, CREAM));
      for (let a = a0; a < a1; a += 3) {
        const g = new THREE.IcosahedronGeometry(0.9 + r() * 0.8, 0), o = 1.6 + r() * 2;
        g.scale(1 + r() * 0.5, 0.55, 1 + r() * 0.5); g.translate(alongX ? a + r() : fixed + Math.sign(fixed - KEY.x0 - W / 2 || 1) * o, -0.4, alongX ? fixed + Math.sign(fixed) * o : a + r());
        S.push(withWin(tint(g, ['#9a8f86', '#b0a497', '#857a72'][Math.floor(r() * 3)])));
      }
    };
    const E = KEY.x1 + 0.2, Wx = KEY.x0 - 0.2, N0 = KEY.z0 - 0.2, S0 = KEY.z1 + 0.2;
    wall(false, E, KEY.z0, C.z0 - 0.3); wall(false, E, C.z1 + 0.3, KEY.z1);
    wall(false, Wx, KEY.z0, KEY.z1);
    wall(true, N0, KEY.x0, KEY.x1);
    wall(true, S0, KEY.x0, MPIER.x0 - 0.2); wall(true, S0, MPIER.x1 + 0.2, KEY.x1);
    // the causeway lands in a pair of pastel gate towers with the key's name
    for (const z of [C.z0 - 1.6, C.z1 + 1.6]) { footprint('causeway gate pylon', KEY.x1 + 1.5, z, 1.5); S.push(bx(3, 12, 3, KEY.x1 + 1.5, 6, z, '#a5e6cf'), bx(3.6, 1, 3.6, KEY.x1 + 1.5, 12.4, z, '#ff4fa3')); N.push(bx(3.7, 0.14, 3.7, KEY.x1 + 1.5, 11.8, z, '#18f0ff')); glows.push([KEY.x1 + 1.5, 13.5, z, '#ff2bd1', 8, 0.1]); }
    S.push(bx(2.4, 2.2, C.z1 - C.z0 + 6, KEY.x1 + 1.5, 10.6, (C.z0 + C.z1) / 2, '#f6f1e7'));
    S.push(bx(0.2, 4.4, 0.2, -1013.5, 2.2, 38.6, '#3b3350'), bx(0.2, 4.4, 0.2, -1007.5, 2.2, 38.6, '#3b3350'));
    footprint('sign leg: Mango Grove', -1013.5, 38.6, 0.1); footprint('sign leg: Mango Grove', -1007.5, 38.6, 0.1);
    sign('Mango Grove', -1010.5, 4.6, 38.6, 0, 6.6);
  }

  // ---------------------------------------------------------------- road signs (Quaternius): stop at the T-junctions, yield, no parking
  for (const j of KEY_JUNCTIONS) {
    const id = j.v.z0 === j.z ? 'stop' : 'yield';
    S.push(kit(id, { scale: 4.8, yaw: PI, x: j.x - 7.4, z: j.z + j.h.hw + 2.2 }), kit('nopark', { scale: 4.8, yaw: 0, x: j.x + 7.4, z: j.z - j.h.hw - 2.2 }));
    P.circle(j.x - 7.4, j.z + j.h.hw + 2.2, 0.1, 2.6); P.circle(j.x + 7.4, j.z - j.h.hw - 2.2, 0.1, 2.6);
  }

  // ---------------------------------------------------------------- stunt ramps (game/stunts.js)
  for (const rp of K.ramps) rampParts(rp, S, N, (g) => withWin(g));

  // ---------------------------------------------------------------- the downtown street level (world/keyscape.js)
  // lobbies, shops, metro entrances, kiosks, carts, steam, scaffolding, water towers, street furniture, trees
  const keyQuads = [], ks0 = S.length, kn0 = N.length;
  const ks = addKeyscape({ L, K, S, N, glows, quads: keyQuads, P, bx, ww: withWin, sign, kit });
  ks.stats.tris = Math.round([...S.slice(ks0), ...N.slice(kn0), ...keyQuads].reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0));
  const keyShops = streetAtlasMesh(keyQuads, KEY_SHOPS);
  if (keyShops) group.add(keyShops);
  if (ks.steam) group.add(ks.steam);
  // the street trees of both districts, one instanced mesh per species (world/streettrees.js)
  L.streetTreeMeshes = createStreetTrees(scene, L.treeInstances || []);

  // ---------------------------------------------------------------- the solid mesh: one material, windows from the shader
  const litU = { value: 0 }, glassU = { value: new THREE.Color('#2c5f7a') };
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uLit: litU, uNight: nightU, uGlass: glassU, uSky: reflU.sky });
    sh.vertexShader = 'attribute float aWin; varying float vWin; varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWin = aWin; vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = 'uniform float uLit, uNight; uniform vec3 uGlass, uSky; varying float vWin; varying vec3 vWP; varying vec3 vWN;\nfloat kh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
      if (vWin > 0.5 && abs(vWN.y) < 0.5) {
        float u = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
        float sp = vWin > 2.5 ? 3.0 : vWin > 1.5 ? 1.8 : 2.6;
        float fl = vWP.y / 3.4;
        vec2 cell = vec2(floor(u / sp), floor(fl)), f = vec2(fract(u / sp), fract(fl));
        float win = vWin > 2.5 ? step(0.38, f.y) * step(f.y, 0.82) * step(0.04, f.x)
                  : vWin > 1.5 ? step(0.07, f.x) * step(0.1, f.y)
                  : step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.86);
        win *= step(1.0, fl);
        float s = kh(vec3(cell, floor(dot(vWN.xz, vec2(1.3, 2.7)) * 3.0 + vWP.x * 0.013 + vWP.z * 0.017)));
        vec3 gl = vWin > 1.5 ? mix(diffuseColor.rgb, vec3(0.32, 0.6, 0.78), 0.45) * (0.7 + 0.4 * f.y) + uSky * 0.16 : uGlass * (0.55 + 0.7 * f.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, gl, win);
        float on = step(s, uLit * (vWin > 1.5 ? 0.75 : 1.0));
        vec3 warm = mix(vec3(1.0, 0.76, 0.38), vec3(0.4, 0.9, 1.0), step(0.78, fract(s * 7.3)));
        totalEmissiveRadiance += warm * win * on * 0.95;
      }`);
  };
  const body = new THREE.Mesh(merge(S), bodyMat);
  body.frustumCulled = false;
  group.add(body);
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const neon = new THREE.Mesh(merge(N.map((g) => { g.deleteAttribute('aWin'); return g; })), neonMat);
  neon.frustumCulled = false;
  group.add(neon);

  // ---------------------------------------------------------------- the ground
  const gc = paintKeyGround(K);
  const gtex = new THREE.CanvasTexture(gc);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const gg = new THREE.PlaneGeometry(W, H); gg.rotateX(-PI / 2); gg.translate(KEY.x0 + W / 2, 0, KEY.z0 + H / 2);
  const ground = new THREE.Mesh(gg, groundMaterial(gtex, (K.lampMap = keyLampMap(K)).tex, KEY.x0, KEY.z0, W, H, false));
  setLampMap('key', K.lampMap.tex, KEY.x0, KEY.z0, W, H);
  group.add(ground);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 3, H), new THREE.MeshLambertMaterial({ color: '#c9a878' }));
  // (its top sits 30 cm under the ground: at 2 cm the two fought for the depth buffer from high up, and roads
  // seen from the Solstice Terrace flickered between asphalt and the skirt's sand colour)
  skirt.position.set(KEY.x0 + W / 2, -1.8, KEY.z0 + H / 2);
  group.add(skirt);

  // ---------------------------------------------------------------- street lights (Quaternius) with see-through glass
  const LS = 6;
  const lampBody = kitGeometry('lamp1', { scale: LS, only: (f) => !(f & 2) });
  const lampGlass = kitGeometry('lamp1', { scale: LS, only: (f) => !!(f & 2), recolor: () => '#cfe8ff' });
  const lampMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  lampMat.onBeforeCompile = (sh) => {
    // the bulb (lamp-coloured faces) glows at night
    sh.uniforms.uNight = nightU;
    sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * step(0.5, vColor.r - vColor.b) * uNight * 1.6;');
  };
  const lamps = new THREE.InstancedMesh(lampBody, lampMat, K.lamps.length);
  const glass = new THREE.InstancedMesh(lampGlass, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false }), K.lamps.length);
  glass.instanceMatrix = lamps.instanceMatrix; glass.renderOrder = 2;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const top = lampBody.boundingBox || (lampBody.computeBoundingBox(), lampBody.boundingBox);
  K.lamps.forEach((l) => glows.push([l.x, top.max.y - 0.5, l.z, '#ffcf8a', 7, 0]));
  // the street lights are detailed models: only the ones near the camera are drawn (their glow sprites,
  // which carry them at night from far away, are always there); the list is refreshed twice a second
  let lodT = 0;
  const lampLod = (cam) => {
    if ((lodT -= 1) > 0) return;
    lodT = 20;
    let n = 0;
    for (const l of K.lamps) {
      if (Math.hypot(l.x - cam.position.x, l.z - cam.position.z) > 190 * VIEW.far) continue;
      lamps.setMatrixAt(n++, m4.compose(v3.set(l.x, 0, l.z), q.setFromAxisAngle(UP, l.yaw), one));
    }
    lamps.count = glass.count = n;
    lamps.instanceMatrix.needsUpdate = true;
  };
  lamps.frustumCulled = glass.frustumCulled = false;
  lamps.count = glass.count = 0;
  group.add(lamps, glass);

  // ---------------------------------------------------------------- palms and glow sprites
  const palms = palmMesh(K.palms);
  group.add(palms);
  const glow = createGlow(group, glows.length);
  for (const gw of glows) glow.add(gw[0], gw[1], gw[2], gw[3], gw[4], gw[5]);
  K.lampMap.setNeon(neonPools(glows));
  glow.commit();

  return {
    group, groundCanvas: gc, bodyMat,
    update(cam) { if (group.visible) lampLod(cam); if (L.streetTreeMeshes) L.streetTreeMeshes.lod(cam); },
    setLights(neonK, lit, glassC) { neonMat.color.setScalar(0.5 + neonK * 0.9); litU.value = lit; glassU.value.copy(glassC); if (keyShops) keyShops.userData.neonK.value = neonK * 0.9; },
  };
}
// the key's own billboards start from the far end of the ad list (the old town's wall ads start at the front)
const K_ADS = [...KEY_ADS].reverse();
