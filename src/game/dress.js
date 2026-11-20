// Set dressing shared by every interior: the room shell, stools, painted boards (signs, menus, posters,
// shelf fronts, fake mirror reflections) packed into ONE canvas atlas per room, baked vertex lighting,
// soft additive light pools and light shafts, and a few small animated pieces (ceiling fan, flickering
// tube, fish tank, pulsing glow). Everything static stays merged so a room is a handful of draw calls.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng } from '../core/util.js';

// ---- geometry ------------------------------------------------------------------------------------
// a box split into panels (so baked light can grade across a wall instead of only at its corners)
export function pbox(w, h, d, x, y, z, hex, step = 1) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / step)), Math.max(1, Math.round(h / step)), Math.max(1, Math.round(d / step)));
  g.translate(x, y, z);
  return tint(g, hex);
}
export function shell(g, hx, hz, h, tileA, tileB, walls, ceil, doorNeon, gap = null) {
  for (let x = -hx; x < hx; x += 1.5) for (let z = -hz; z < hz; z += 1.5) {
    g.push(box(1.5, 0.1, 1.5, x + 0.75, -0.05, z + 0.75, (Math.round(x / 1.5) + Math.round(z / 1.5)) % 2 ? tileA : tileB));
  }
  g.push(pbox(hx * 2 + 0.4, h + 0.2, 0.2, 0, h / 2, -hz - 0.1, walls[0]), pbox(hx * 2 + 0.4, h + 0.2, 0.2, 0, h / 2, hz + 0.1, walls[1]),
    pbox(0.2, h + 0.2, hz * 2, -hx - 0.1, h / 2, 0, walls[2]), pbox(hx * 2 + 0.4, 0.2, hz * 2 + 0.4, 0, h + 0.1, 0, ceil, 1.5));
  if (!gap) g.push(pbox(0.2, h + 0.2, hz * 2, hx + 0.1, h / 2, 0, walls[2]));
  else {
    // the right wall with a doorway (gap = [z0, z1], 2.8 m high) through to a side room
    const [a, b] = gap;
    g.push(pbox(0.2, h + 0.2, a + hz, hx + 0.1, h / 2, (a - hz) / 2, walls[2]), pbox(0.2, h + 0.2, hz - b, hx + 0.1, h / 2, (b + hz) / 2, walls[2]),
      box(0.2, h - 2.8, b - a, hx + 0.1, (h + 2.8) / 2, (a + b) / 2, walls[2]));
  }
  // the way out: a doorway full of sunset with a neon frame
  g.push(box(1.7, 2.7, 0.08, 0, 1.35, hz - 0.02, '#ffa64a'), box(1.7, 0.9, 0.09, 0, 0.45, hz - 0.02, '#ff6a8a'), box(1.9, 0.1, 0.1, 0, 2.75, hz - 0.06, doorNeon),
    box(0.1, 2.8, 0.1, -0.9, 1.4, hz - 0.06, doorNeon), box(0.1, 2.8, 0.1, 0.9, 1.4, hz - 0.06, doorNeon), box(0.8, 0.22, 0.05, 0, 3.05, hz - 0.05, '#8dff5a'));
}
export const stool = (g, x, z, hex) => g.push(cyl(0.27, 0.27, 0.09, 10, x, 0.78, z, hex), cyl(0.05, 0.09, 0.76, 6, x, 0.38, z, '#c9c0d8'), cyl(0.22, 0.24, 0.04, 8, x, 0.02, z, '#c9c0d8'));
// a potted plant: a pot and a fan of leaves (a palm-ish one or a round shrub)
export function plant(g, x, z, s = 1, pot = '#e07a5f', leaf = '#2f9f6a', kind = 0) {
  g.push(cyl(0.26 * s, 0.2 * s, 0.5 * s, 10, x, 0.25 * s, z, pot), cyl(0.27 * s, 0.27 * s, 0.05 * s, 10, x, 0.5 * s, z, shadeHex(pot, 0.8)), cyl(0.22 * s, 0.22 * s, 0.02, 10, x, 0.49 * s, z, '#4a3020'));
  if (kind === 0) {
    g.push(cyl(0.035 * s, 0.05 * s, 1.3 * s, 6, x, 1.1 * s, z, '#8a6a3a'));
    for (let i = 0; i < 7; i++) { const a = i * 0.9; g.push(box(0.9 * s, 0.03, 0.2 * s, x + Math.cos(a) * 0.38 * s, 1.68 * s - (i % 2) * 0.06, z + Math.sin(a) * 0.38 * s, i % 2 ? leaf : shadeHex(leaf, 1.2), 0, -a, -0.45)); }
  } else {
    for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.12 * s + (i % 3) * 0.06 * s; g.push(box(0.26 * s, 0.26 * s, 0.26 * s, x + Math.cos(a) * rr, 0.68 * s + (i % 4) * 0.1 * s, z + Math.sin(a) * rr, i % 2 ? leaf : shadeHex(leaf, 1.2), 0.3, a, 0.2)); }
  }
}
export const shadeHex = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// a run of round pipe along x or z with brackets
export function pipe(g, x0, z0, x1, z1, y, r, hex) {
  const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  g.push(cyl(r, r, len, 8, (x0 + x1) / 2, y, (z0 + z1) / 2, hex, alongX ? 0 : PI / 2, alongX ? PI / 2 : 0));
  for (let t = 0.5; t < len; t += 1.6) { const k = t / len; g.push(box(alongX ? 0.05 : r * 2.6, 0.3, alongX ? r * 2.6 : 0.05, x0 + (x1 - x0) * k, y + 0.16, z0 + (z1 - z0) * k, '#6a6478')); }
}
// a rug: a border, a field and a simple repeating motif (zigzag | stripes | diamonds | dots)
export function rug(g, w, d, x, z, a, b, c, motif = 'stripes', ry = 0) {
  const y = 0.006, put = (ww, dd, lx, lz, hex, yy = y) => { const cs = Math.cos(ry), sn = Math.sin(ry); g.push(box(ww, 0.012, dd, x + lx * cs + lz * sn, yy, z - lx * sn + lz * cs, hex, 0, ry)); };
  put(w, d, 0, 0, a); put(w - 0.24, d - 0.24, 0, 0, b, y + 0.004);
  if (motif === 'stripes') for (let i = -d / 2 + 0.4; i < d / 2 - 0.3; i += 0.45) put(w - 0.5, 0.1, 0, i, c, y + 0.008);
  else if (motif === 'zigzag') for (let i = 0; i < Math.floor((w - 0.6) / 0.42); i++) put(0.46, 0.08, -w / 2 + 0.5 + i * 0.42, 0, c, y + 0.008), put(0.08, 0.08, -w / 2 + 0.5 + i * 0.42, (i % 2 ? 0.25 : -0.25), c, y + 0.008);
  else if (motif === 'diamonds') for (let i = -w / 2 + 0.6; i < w / 2 - 0.4; i += 0.6) for (let j = -d / 2 + 0.6; j < d / 2 - 0.4; j += 0.6) { const cs = Math.cos(ry), sn = Math.sin(ry); g.push(box(0.22, 0.012, 0.22, x + i * cs + j * sn, y + 0.008, z - i * sn + j * cs, c, 0, ry + PI / 4)); }
  else for (let i = -w / 2 + 0.5; i < w / 2 - 0.3; i += 0.5) for (let j = -d / 2 + 0.5; j < d / 2 - 0.3; j += 0.5) put(0.1, 0.1, i, j, c, y + 0.008);
}

// ---- painted boards: one canvas atlas per room -----------------------------------------------------
// add(w, h, x, y, z, ry, draw(ctx, W, H)) puts a w x h quad at (x, y, z) facing +z turned by ry, painted
// by draw() into its own cell of the room's canvas. mesh() packs them into one mesh (one draw call).
export function boards(px = 1024) {
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  const quads = [];
  let sx = 0, sy = 0, rowH = 0;
  const api = {
    ctx,
    add(w, h, x, y, z, ry, draw, res = 110, rx = 0) {
      let W = Math.min(px, Math.round(w * res)), H = Math.min(px, Math.round(h * res));
      if (W > px / 2 || H > px / 2) { const k = Math.min(px / 2 / W, px / 2 / H); W = Math.floor(W * k); H = Math.floor(H * k); }
      if (sx + W > px) { sx = 0; sy += rowH + 2; rowH = 0; }
      if (sy + H > px) { console.warn('board atlas full'); return; }
      ctx.save(); ctx.translate(sx, sy); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); draw(ctx, W, H); ctx.restore();
      const q = new THREE.PlaneGeometry(w, h); const uv = q.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (sx + uv.getX(i) * W) / px, 1 - (sy + (1 - uv.getY(i)) * H) / px);
      if (rx) q.rotateX(rx);
      q.rotateY(ry); q.translate(x, y, z);
      quads.push(q);
      sx += W + 2; rowH = Math.max(rowH, H);
    },
    mesh() {
      if (!quads.length) return null;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const m = new THREE.Mesh(merge(quads), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, fog: false }));
      m.renderOrder = 1;
      return m;
    },
  };
  return api;
}
// canvas painting helpers
export const P = {
  fill(c, W, H, col) { c.fillStyle = col; c.fillRect(0, 0, W, H); },
  grad(c, W, H, a, b, vertical = true) { const g = vertical ? c.createLinearGradient(0, 0, 0, H) : c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); },
  text(c, s, x, y, size, col, { font = 'Trebuchet MS, Verdana, sans-serif', weight = 900, align = 'center', glow = 0, italic = false, max = 0 } = {}) {
    c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
    if (glow) { c.shadowColor = col; c.shadowBlur = glow; }
    c.fillStyle = col;
    if (max) c.fillText(s, x, y, max); else c.fillText(s, x, y);
    if (glow) { c.fillText(s, x, y); c.shadowBlur = 0; }
  },
  frame(c, W, H, col, t) { c.strokeStyle = col; c.lineWidth = t; c.strokeRect(t / 2, t / 2, W - t, H - t); },
  // a neon script piece: a dark backboard (or none) with glowing text
  neon(c, W, H, s, col, { back = null, size = 0.55, font, italic = true } = {}) {
    if (back) P.fill(c, W, H, back); else c.clearRect(0, 0, W, H);
    P.text(c, s, W / 2, H / 2, H * size, '#ffffff', { glow: H * 0.35, font, italic });
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.65; P.fill(c, W, H, col); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    P.text(c, s, W / 2, H / 2, H * size, col, { glow: H * 0.5, font, italic });
    P.text(c, s, W / 2, H / 2, H * size * 0.98, '#fff8ff', { font, italic });
  },
  // a cheap mirror: a dark tinted glass with soft blurred colour blobs (the room behind you) and sheen streaks
  mirror(c, W, H, tint, blobs, seed = 1) {
    const r = rng(seed);
    P.grad(c, W, H, tint[0], tint[1]);
    c.filter = `blur(${Math.round(Math.max(2, H * 0.05))}px)`;
    for (const [col, n] of blobs) for (let i = 0; i < n; i++) { c.globalAlpha = 0.25 + r() * 0.3; c.fillStyle = col; const w = W * (0.03 + r() * 0.08), h = H * (0.15 + r() * 0.5); c.fillRect(r() * W, H * (0.25 + r() * 0.5) - h / 2, w, h); }
    c.filter = 'none'; c.globalAlpha = 1;
    c.save(); c.globalAlpha = 0.14; c.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) { const x = W * (0.1 + i * 0.27 + r() * 0.05); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + W * 0.06, 0); c.lineTo(x - W * 0.08, H); c.lineTo(x - W * 0.14, H); c.fill(); }
    c.restore();
    P.frame(c, W, H, 'rgba(255,255,255,.35)', 2);
  },
  // a shelf front: rows of little product packs with invented labels
  products(c, W, H, seed, { rows = 3, palette = ['#ff4fa3', '#27d8cf', '#ffd447', '#7a5cff', '#ff8a3d', '#8dff5a', '#f6f1e7', '#ff3f6a'], names = ['CRUNCH', 'POP', 'ZING', 'WAVE', 'O-BITS', 'GLO', 'SUN', 'MEGA'], shelf = '#d9d4e6', bg = '#2a2440' } = {}) {
    const r = rng(seed); P.fill(c, W, H, bg);
    const rh = H / rows;
    for (let row = 0; row < rows; row++) {
      let x = 2;
      const y1 = (row + 1) * rh - rh * 0.1;
      while (x < W - 6) {
        const w = rh * (0.28 + r() * 0.32), h = rh * (0.5 + r() * 0.36), col = palette[Math.floor(r() * palette.length)], kind = r();
        if (x + w > W - 2) break;
        if (kind < 0.25) { c.fillStyle = col; c.beginPath(); c.roundRect(x, y1 - h, w, h, w * 0.35); c.fill(); c.fillStyle = '#fff8'; c.fillRect(x + w * 0.2, y1 - h * 0.7, w * 0.6, h * 0.25); }
        else if (kind < 0.45) { c.fillStyle = col; c.fillRect(x + w * 0.3, y1 - h, w * 0.4, h * 0.25); c.fillRect(x, y1 - h * 0.78, w, h * 0.78); c.fillStyle = '#ffffffaa'; c.fillRect(x, y1 - h * 0.5, w, h * 0.18); }
        else { c.fillStyle = col; c.fillRect(x, y1 - h, w, h); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + w * 0.8, y1 - h, w * 0.2, h); c.fillStyle = '#fff'; c.fillRect(x + w * 0.1, y1 - h * 0.62, w * 0.8, h * 0.2); }
        P.text(c, names[Math.floor(r() * names.length)], x + w / 2, y1 - h * (kind < 0.45 && kind >= 0.25 ? 0.41 : 0.52), Math.max(6, w * 0.22), '#22203a', { weight: 900, max: w * 0.8 });
        x += w + 1 + r() * 2;
      }
      c.fillStyle = shelf; c.fillRect(0, y1, W, rh * 0.1);
      c.fillStyle = '#ff4fa3'; for (let x2 = 8; x2 < W; x2 += 46) c.fillRect(x2, y1 + rh * 0.02, 14, rh * 0.06);
    }
  },
};

// ---- baked lighting --------------------------------------------------------------------------------
// Darken / tint every vertex by an ambient term plus point lights (wrapped Lambert, smooth falloff).
// Bright saturated colours (neon, lit signs) are left alone so they still read as glowing.
export function bake(geo, lights, amb = 0.62, ambCol = '#ffffff') {
  const pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color, n = pos.count;
  const L = lights.map((l) => ({ ...l, c: new THREE.Color(l.hex || '#ffffff') })), A = new THREE.Color(ambCol).multiplyScalar(amb);
  for (let i = 0; i < n; i++) {
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 0.85 && mx - mn > 0.8) continue;                                   // neon
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let lr = A.r, lg = A.g, lb = A.b;
    for (const l of L) {
      const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz) || 1;
      if (d > l.r) continue;
      const w = Math.max(0, ((dx * nx + dy * ny + dz * nz) / d + 0.35) / 1.35), f = 1 - d / l.r, k = l.k * w * f * f;
      lr += l.c.r * k; lg += l.c.g * k; lb += l.c.b * k;
    }
    col.setXYZ(i, Math.min(1, r * lr), Math.min(1, g * lg), Math.min(1, b * lb));
  }
  col.needsUpdate = true;
  return geo;
}

// ---- soft additive light: floor / wall pools and light shafts in one mesh -------------------------------
// items: { disc: [x, y, z, r, hex, k, axis?] } a round pool (axis 'y' floor / 'z' or 'x' on a wall),
//        { cone: [x, y, z, rTop, rBottom, h, hex, k] } a light shaft hanging down from (x, y, z)
export function glow(items) {
  const parts = [];
  const attr = (q, fn) => { const p = q.attributes.position, a = new Float32Array(p.count); for (let i = 0; i < p.count; i++) a[i] = fn(p.getX(i), p.getY(i), p.getZ(i)); q.setAttribute('aR', new THREE.BufferAttribute(a, 1)); };
  const kAttr = (q, k, f) => { const n = q.attributes.position.count; q.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); q.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(n).fill(f || 0), 1)); };
  for (const it of items) {
    if (it.disc) {
      const [x, y, z, r, hex, k, axis = 'y', f = 0] = it.disc;
      const q = new THREE.CircleGeometry(r, 20).toNonIndexed();
      attr(q, (px, py) => Math.hypot(px, py) / r);
      if (axis === 'y') q.rotateX(-PI / 2); else if (axis === 'x') q.rotateY(PI / 2); else if (axis === '-x') q.rotateY(-PI / 2); else if (axis === '-z') q.rotateY(PI);
      q.translate(x, y, z);
      q.deleteAttribute('uv'); q.deleteAttribute('normal');
      kAttr(q, k, f); parts.push(tint(q, hex));
    } else if (it.cone) {
      const [x, y, z, rt, rb, h, hex, k, f = 0] = it.cone;
      const q = new THREE.CylinderGeometry(rt, rb, h, 16, 1, true).toNonIndexed();
      attr(q, (px, py) => 0.5 - py / h);           // 0 at the lamp, 1 at the bottom
      q.translate(x, y - h / 2, z);
      q.deleteAttribute('uv'); q.deleteAttribute('normal');
      kAttr(q, k * 0.5, f); parts.push(tint(q, hex));
    }
  }
  if (!parts.length) return null;
  const U = { uT: { value: 0 }, uK: { value: 1 } };
  const m = new THREE.Mesh(merge(parts), new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexColors: true,
    vertexShader: 'attribute float aR, aK, aF; varying vec3 vC; varying float vR, vK; uniform float uT; void main(){ vC = color; vR = aR; vK = aK * (1.0 + aF * (0.12 * sin(uT * 9.0 + position.x * 2.0) + 0.06 * sin(uT * 23.0))); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying vec3 vC; varying float vR, vK; void main(){ float a = 1.0 - smoothstep(0.0, 1.0, vR); gl_FragColor = vec4(vC * vK * uK * a * a * 0.6, 1.0); }',
  }));
  m.renderOrder = 3; m.frustumCulled = false;
  m.userData.U = U;
  return m;
}

// ---- small animated pieces ---------------------------------------------------------------------------
// a ceiling fan: the motor and rod are static (add them to the room), the blades are their own mesh
export function fan(g, x, z, ceil, hex = '#3a3550', blade = '#e8dcc8') {
  const y = ceil - 0.55;
  g.push(cyl(0.03, 0.03, 0.5, 6, x, ceil - 0.25, z, hex), cyl(0.16, 0.12, 0.16, 10, x, y, z, hex), cyl(0.12, 0.12, 0.08, 10, x, y - 0.11, z, '#fff3c4'));
  const parts = [];
  for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5, q = box(0.75, 0.025, 0.16, Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5, blade, 0, a, 0.08); parts.push(q, box(0.12, 0.04, 0.06, Math.cos(a) * 0.14, 0.02, -Math.sin(a) * 0.14, hex, 0, a)); }
  const m = new THREE.Mesh(merge(parts));
  m.position.set(x, y + 0.02, z);
  return m;
}
// a fish tank's fish: little two-tone fish swimming lazy loops inside (x0..x1, y0..y1, z0..z1); tick(t)
export function fishTank(bounds, n = 7, seed = 3) {
  const r = rng(seed), COLS = ['#ff8a3d', '#ffe14a', '#27e8ff', '#ff4fa3', '#8dff5a', '#f6f1e7'];
  const parts = [], fish = [];
  for (let i = 0; i < n; i++) {
    const c = COLS[i % COLS.length], s = 0.6 + r() * 0.6;
    const q = merge([box(0.1 * s, 0.06 * s, 0.035 * s, 0, 0, 0, c), box(0.05 * s, 0.07 * s, 0.01, -0.07 * s, 0, 0, shadeHex(c, 0.7), 0, 0, 0.2), box(0.012, 0.012, 0.04 * s, 0.035 * s, 0.01 * s, 0, '#111')]);
    parts.push(q);
    fish.push({ s, p: r() * 6.28, sp: 0.3 + r() * 0.4, y: bounds.y0 + 0.1 + r() * (bounds.y1 - bounds.y0 - 0.2), zz: r() });
  }
  // one mesh per fish would be n draw calls: instead every fish is merged and moved in the vertex shader by its id
  const ids = [];
  parts.forEach((q, i) => { const k = q.attributes.position.count; for (let j = 0; j < k; j++) ids.push(i); });
  const geo = merge(parts);
  geo.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(ids), 1));
  const U = { uT: { value: 0 }, uB: { value: new THREE.Vector4(bounds.x0, bounds.x1, bounds.z0, bounds.z1) }, uY: { value: new THREE.Vector2(bounds.y0, bounds.y1) } };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aId; uniform float uT; uniform vec4 uB; uniform vec2 uY;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */`
      float ph = aId * 1.7 + uT * (0.25 + fract(aId * 0.37) * 0.3);
      float u = 0.5 + 0.45 * sin(ph), dir = cos(ph);
      vec3 transformed = position;
      transformed.x *= sign(dir) * (abs(dir) < 0.15 ? abs(dir) / 0.15 : 1.0);
      transformed.y += sin(uT * 6.0 + aId) * 0.004;
      float w = uB.y - uB.x, d = uB.w - uB.z;
      if (w >= d) transformed += vec3(uB.x + u * w, mix(uY.x + 0.12, uY.y - 0.12, fract(aId * 0.618)) + 0.03 * sin(uT * 0.7 + aId), mix(uB.z, uB.w, 0.2 + 0.6 * fract(aId * 0.43)));
      else { transformed = vec3(transformed.z, transformed.y, transformed.x); transformed += vec3(mix(uB.x, uB.y, 0.2 + 0.6 * fract(aId * 0.43)), mix(uY.x + 0.12, uY.y - 0.12, fract(aId * 0.618)) + 0.03 * sin(uT * 0.7 + aId), uB.z + u * d); }`);
  };
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return { mesh: m, tick(t) { U.uT.value = t; } };
}
// a mesh whose colour pulses (a flickering tube, a jukebox glow, a plasma globe): tick(t, still)
export function pulser(parts, mode = 'flicker', seed = 1) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const m = new THREE.Mesh(merge(parts), mat);
  const r = rng(seed);
  let on = 1, nextT = 0;
  m.userData.tick = (t, still) => {
    let k = 1;
    if (mode === 'flicker') {
      if (still) k = 0.9;
      else { if (t > nextT) { on = r() < 0.18 ? 0.25 + r() * 0.3 : 1; nextT = t + (on < 1 ? 0.05 + r() * 0.12 : 0.6 + r() * 3.5); } k = on; }
    } else if (mode === 'pulse') k = still ? 0.9 : 0.72 + 0.28 * Math.sin(t * 2.4);
    else if (mode === 'rainbow') { const h = (t * 0.08) % 1; mat.color.setHSL(h, 0.75, 0.62); return; }
    mat.color.setScalar(k);
  };
  return m;
}
