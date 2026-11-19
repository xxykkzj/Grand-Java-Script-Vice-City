// Neon Coast characters: procedural, skinned figures for Skye and the story cast, and a cheap rounded
// body-part set for the instanced crowds. No asset files: every surface is generated here at load time.
//
//  * Limbs, neck and fingers are swept tubes (elliptical sections along smooth curves, radius profiles).
//    The torso is lofted from hip / waist / chest / shoulder profile curves with superelliptic sections.
//  * Heads, hair masses, ears and shoes are star-shaped surfaces: rays from a centre are marched onto a
//    signed-distance blend of ellipsoids, capsules and spheres (cranium, jaw, cheekbones, chin, brow,
//    nose bridge and tip, lips). Normals come from the distance field, so the shading is smooth.
//  * Clothing is offset shells over the same parametric surfaces (so it rides the skin under skinning)
//    with rolled hems, ribbed cuffs and collars, zips, straps, laces; skirts are draped on the CPU.
//  * One SkinnedMesh per material (skin, cloth, hair, eyes), plus the draped skirt while one is worn,
//    all bound to one skeleton that keeps the game's pivot names, nesting and rotation conventions:
//
//    root (Group)                game: position, yaw (ride: pitch / roll too), visible, layers
//      body      (0, 0, 0)       game: bob (position.y), lean, applyPose rotation about the hips
//        torso   (0, 0, 0)       game: breathing scale. A leaf, like the old torso mesh
//        head    top of neck     game: rotation (hx nod, hy turn, hz tilt)
//          jaw eyeL eyeR lidUL lidLL lidUR lidLR browL browR mouthL mouthR hair   (driven here)
//          eyes, mouth           Object3D hooks: scale.y = 0.12 closes the lids, scale.y > 1 opens the jaw
//        armL / armR  shoulder   game: rotation (0 hangs down, -rx swings forward, +rz lifts the left arm out)
//          foreL / foreR  elbow   (auto bend, override fig.bend)   handL / handR  wrist   (gripL / gripR)
//        legL / legR  hip joint  game: rotation (rx, 0, rz)
//          shinL / shinR knee    game: legL.shin.rotation.x knee bend   footL / footR  ankle (auto level)
//        bag             messenger bag sway
//        skirt (Mesh)    draped from the thigh angles every frame (drape(aL, zL, aR, zR) kept for the game)
import * as THREE from 'three';

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (n > 1 ? i / (n - 1) : 0));
const around = (n) => Array.from({ length: n }, (_, i) => i / n);
const gs = (d, r) => Math.exp(-(d * d) / (r * r));
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _c = new THREE.Color();
const hex = (h) => { _c.set(h); return [_c.r, _c.g, _c.b]; };
const tone = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// smooth (cubic Hermite) lookup in [x, y] keys sorted by x
function skeys(K, x) {
  const n = K.length;
  if (x <= K[0][0]) return K[0][1];
  if (x >= K[n - 1][0]) return K[n - 1][1];
  let i = 0;
  while (x > K[i + 1][0]) i++;
  const m = (j) => (j <= 0 ? (K[1][1] - K[0][1]) / (K[1][0] - K[0][0]) : j >= n - 1 ? (K[n - 1][1] - K[n - 2][1]) / (K[n - 1][0] - K[n - 2][0]) : (K[j + 1][1] - K[j - 1][1]) / (K[j + 1][0] - K[j - 1][0]));
  const [x0, y0] = K[i], [x1, y1] = K[i + 1], h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m(i) * h + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m(i + 1) * h;
}
const keyLin = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x <= K[i][0]) { const [a, b] = K[i - 1], [c, d] = K[i]; return b + (d - b) * (x - a) / (c - a); } return K[K.length - 1][1]; };

// ---------------------------------------------------------------------------------------------- SDF
function sdE(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / rx, qy = py / ry, qz = pz / rz, k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
const sdS = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
function sdC(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const ux = bx - ax, uy = by - ay, uz = bz - az, px = x - ax, py = y - ay, pz = z - az;
  const t = clamp((px * ux + py * uy + pz * uz) / (ux * ux + uy * uy + uz * uz), 0, 1);
  return Math.hypot(px - ux * t, py - uy * t, pz - uz * t) - (ra + (rb - ra) * t);
}
function sdB(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
// the outermost crossing of f along c + r d (r from rMax down), or null
function march(f, c, d, rMax, rMin = 0.001) {
  let r = rMax, v = f(c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r);
  if (v <= 0) return rMax;
  for (let it = 0; it < 600 && r > rMin; it++) {
    const r2 = r - Math.max(v * 0.6, 0.0003), v2 = f(c[0] + d[0] * r2, c[1] + d[1] * r2, c[2] + d[2] * r2);
    if (v2 <= 0) {
      let a = r2, b = r;
      for (let k = 0; k < 18; k++) { const m = (a + b) * 0.5; if (f(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m) <= 0) a = m; else b = m; }
      return (a + b) * 0.5;
    }
    r = r2; v = v2;
  }
  return null;
}
const grad = (f, p, h = 0.0004) => norm([f(p[0] + h, p[1], p[2]) - f(p[0] - h, p[1], p[2]), f(p[0], p[1] + h, p[2]) - f(p[0], p[1] - h, p[2]), f(p[0], p[1], p[2] + h) - f(p[0], p[1], p[2] - h)]);
const dirOf = (th, ph) => [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];

// ---------------------------------------------------------------------------------------------- rig
// [name, parent]. The first ten names are the game's pivots (see the header).
export const BONES = [
  ['body', null], ['torso', 'body'], ['head', 'body'], ['jaw', 'head'], ['eyeL', 'head'], ['eyeR', 'head'],
  ['lidUL', 'head'], ['lidLL', 'head'], ['lidUR', 'head'], ['lidLR', 'head'], ['browL', 'head'], ['browR', 'head'],
  ['mouthL', 'head'], ['mouthR', 'head'], ['hair', 'head'],
  ['armL', 'body'], ['foreL', 'armL'], ['handL', 'foreL'], ['armR', 'body'], ['foreR', 'armR'], ['handR', 'foreR'],
  ['legL', 'body'], ['shinL', 'legL'], ['footL', 'shinL'], ['legR', 'body'], ['shinR', 'legR'], ['footR', 'shinR'],
  ['bag', 'body'],
];
const BI = Object.fromEntries(BONES.map(([n], i) => [n, i]));
const MIR = BONES.map(([n], i) => { const m = n.endsWith('L') ? n.slice(0, -1) + 'R' : n.endsWith('R') ? n.slice(0, -1) + 'L' : n; return BI[m] ?? i; });
// the game's pivots and where they live in the new rig (stage two reads this)
export const PIVOTS = {
  root: 'Group (moved by the game)', body: 'bone body', torso: 'bone torso (leaf)', head: 'bone head', armL: 'bone armL', armR: 'bone armR',
  legL: 'bone legL', legR: 'bone legR', 'legL.shin': 'bone shinL', 'legR.shin': 'bone shinR', eyes: 'Object3D hook on head', mouth: 'Object3D hook on head',
  skirt: 'Mesh on body', thighs: 'proxy -> legL + legR', shins: 'proxy -> shinL + shinR', g: 'alias of root (NPC)',
};

// ---------------------------------------------------------------------------------------------- geometry
const NOA = {}, Z3 = [0, 0, 0];
function packW(w) {
  const acc = [];
  for (let i = 0; i < w.length; i += 2) {
    const b = w[i], v = w[i + 1];
    if (!(v > 1e-5)) continue;
    const e = acc.find((q) => q[0] === b);
    if (e) e[1] += v; else acc.push([b, v]);
  }
  const out = [0, 0, 0, 0, 1, 0, 0, 0];
  if (!acc.length) return out;
  acc.sort((a, b) => b[1] - a[1]);
  const n = Math.min(4, acc.length);
  let s = 0;
  for (let k = 0; k < n; k++) s += acc[k][1];
  for (let k = 0; k < 4; k++) { out[k] = k < n ? acc[k][0] : 0; out[4 + k] = k < n ? acc[k][1] / s : 0; }
  return out;
}
// vertices with skin weights, colour, an outfit role (-1 keeps its own colour), roughness / metalness /
// sparkle, and one extra vec3 (hair tangent or eyeball direction)
class Geo {
  constructor() { this.P = []; this.N = []; this.C = []; this.W = []; this.A = []; this.X = []; this.I = []; this.n = 0; }
  v(p, n, c, w, a) {
    const o = a || NOA, x = o.x || Z3;
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]);
    this.W.push(packW(w));
    this.A.push(o.role ?? -1, o.shade ?? 1, o.rough ?? 0.78, o.metal ?? 0, o.spark ?? 0);
    this.X.push(x[0], x[1], x[2]);
    return this.n++;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  add(o, mirror = false) {
    const base = this.n, s = mirror ? -1 : 1;
    for (let i = 0; i < o.n; i++) {
      this.P.push(o.P[i * 3] * s, o.P[i * 3 + 1], o.P[i * 3 + 2]); this.N.push(o.N[i * 3] * s, o.N[i * 3 + 1], o.N[i * 3 + 2]);
      this.C.push(o.C[i * 3], o.C[i * 3 + 1], o.C[i * 3 + 2]); this.X.push(o.X[i * 3] * s, o.X[i * 3 + 1], o.X[i * 3 + 2]);
      const w = o.W[i];
      this.W.push(mirror ? [MIR[w[0]], MIR[w[1]], MIR[w[2]], MIR[w[3]], w[4], w[5], w[6], w[7]] : w);
      for (let k = 0; k < 5; k++) this.A.push(o.A[i * 5 + k]);
    }
    for (let i = 0; i < o.I.length; i += 3) {
      if (mirror) this.I.push(base + o.I[i], base + o.I[i + 2], base + o.I[i + 1]);
      else this.I.push(base + o.I[i], base + o.I[i + 1], base + o.I[i + 2]);
    }
    this.n += o.n;
    return this;
  }
  get tris() { return this.I.length / 3; }
  build(kind) {
    const g = new THREE.BufferGeometry(), n = this.n;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const w = this.W[i]; for (let k = 0; k < 4; k++) { si[i * 4 + k] = w[k]; sw[i * 4 + k] = w[4 + k]; } }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (kind === 'cloth') {
      const role = new Float32Array(n), shade = new Float32Array(n), rm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { role[i] = this.A[i * 5]; shade[i] = this.A[i * 5 + 1]; rm[i * 3] = this.A[i * 5 + 2]; rm[i * 3 + 1] = this.A[i * 5 + 3]; rm[i * 3 + 2] = this.A[i * 5 + 4]; }
      g.setAttribute('aRole', new THREE.BufferAttribute(role, 1)); g.setAttribute('aShade', new THREE.BufferAttribute(shade, 1)); g.setAttribute('aRM', new THREE.BufferAttribute(rm, 3));
    }
    if (kind === 'hair') g.setAttribute('aHT', new THREE.Float32BufferAttribute(this.X, 3));
    if (kind === 'eye') g.setAttribute('aEye', new THREE.Float32BufferAttribute(this.X, 3));
    g.setIndex(this.I);
    return g;
  }
}
// smooth vertex normals (area weighted) for vertices from v0 using triangles from i0
function meshNormals(g, v0, i0) {
  const n = g.n - v0, acc = new Float64Array(n * 3), P = g.P;
  for (let i = i0; i < g.I.length; i += 3) {
    const a = g.I[i], b = g.I[i + 1], c = g.I[i + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) if (k >= v0) { const o = (k - v0) * 3; acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz; }
  }
  for (let k = 0; k < n; k++) {
    const l = Math.hypot(acc[k * 3], acc[k * 3 + 1], acc[k * 3 + 2]);
    if (l > 1e-20) for (let j = 0; j < 3; j++) g.N[(v0 + k) * 3 + j] = acc[k * 3 + j] / l;
  }
}
// a parametric surface over the sample arrays us × vs. pos(u, v) -> point; normals by finite
// differences (or o.normal); attr(u, v, p, n, i, j) -> { c, w, role, shade, rough, metal, spark, x }
function surf(g, us, vs, wrap, pos, attr, o = {}) {
  const nu = us.length, nv = vs.length, base = g.n, e = o.eps || 1e-4;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const u = us[i], v = vs[j], p = pos(u, v);
    let n;
    if (o.normal) n = o.normal(u, v, p);
    else {
      const vA = Math.max(vs[0], v - e), vB = Math.min(vs[nv - 1], v + e);
      let c = cross(sub(pos(u + e, v), pos(u - e, v)), sub(pos(u, vB), pos(u, vA)));
      if (vlen(c) < 1e-14) { const vi = j === 0 ? lerp(vs[0], vs[1], 0.15) : lerp(vs[nv - 1], vs[nv - 2], 0.15); c = cross(sub(pos(u + e, vi), pos(u - e, vi)), sub(pos(u, vi + e), pos(u, vi - e))); }
      n = norm(c);
    }
    if (o.flip) n = mul(n, -1);
    const a = attr(u, v, p, n, i, j);
    g.v(p, n, a.c, a.w, a);
  }
  const cols = wrap ? nu : nu - 1;
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < cols; i++) {
    if (o.keep && !o.keep(i, j)) continue;
    const i1 = (i + 1) % nu, a = base + j * nu + i, b = base + j * nu + i1, c = base + (j + 1) * nu + i1, d = base + (j + 1) * nu + i;
    if (o.flip) { g.tri(a, c, b); g.tri(a, d, c); } else { g.tri(a, b, c); g.tri(a, c, d); }
  }
  return base;
}
// a smooth curve through points (cubic Hermite, chord-length parameter t in [0, 1])
function spline(pts) {
  const n = pts.length, Ls = [0];
  for (let i = 1; i < n; i++) Ls.push(Ls[i - 1] + vlen(sub(pts[i], pts[i - 1])));
  const tot = Ls[n - 1] || 1, T = Ls.map((l) => l / tot);
  const M = pts.map((_, i) => (i === 0 ? mul(sub(pts[1], pts[0]), 1 / (T[1] - T[0] || 1)) : i === n - 1 ? mul(sub(pts[n - 1], pts[n - 2]), 1 / (T[n - 1] - T[n - 2] || 1))
    : mul(sub(pts[i + 1], pts[i - 1]), 1 / (T[i + 1] - T[i - 1] || 1))));
  const at = (t) => {
    t = clamp(t, 0, 1);
    let i = 0;
    while (i < n - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i] || 1e-9, s = (t - T[i]) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * h, c = -2 * s3 + 3 * s2, d = (s3 - s2) * h;
    return [0, 1, 2].map((k) => a * pts[i][k] + b * M[i][k] + c * pts[i + 1][k] + d * M[i + 1][k]);
  };
  return { at, T, len: tot };
}
// a swept tube: elliptical sections (rad(t, a) -> [rN, rB], a measured from N towards B) along a curve
// through pts, parallel-transported frames starting from the hint n0. rings: [{ t, dr }]
function tube(g, pts, o) {
  const cv = o.curve || spline(pts), segs = o.segs || 10, rings = o.rings, L = cv.len, base = g.n;
  let N = o.n0 || [0, 0, 1];
  const fr = [];
  for (const R of rings) {
    const t = R.t, T = norm(sub(cv.at(Math.min(1, t + 2e-3)), cv.at(Math.max(0, t - 2e-3))));
    let Nn = sub(N, mul(T, dot(N, T)));
    if (vlen(Nn) < 1e-6) Nn = Math.abs(T[0]) < 0.9 ? cross(T, [1, 0, 0]) : cross(T, [0, 1, 0]);
    Nn = norm(Nn);
    fr.push({ p: cv.at(t), T, N: Nn, B: cross(T, Nn) });
    N = Nn;
  }
  for (let j = 0; j < rings.length; j++) {
    const R = rings[j], t = R.t, F = fr[j], d = Math.min(0.01, 0.003 / L);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a), r = o.rad(t, a), rN = Math.max(0, r[0] + (R.dr || 0)), rB = Math.max(0, r[1] + (R.dr || 0));
      const p = [F.p[0] + F.N[0] * rN * ca + F.B[0] * rB * sa, F.p[1] + F.N[1] * rN * ca + F.B[1] * rB * sa, F.p[2] + F.N[2] * rN * ca + F.B[2] * rB * sa];
      const ip = norm([F.N[0] * rB * ca + F.B[0] * rN * sa, F.N[1] * rB * ca + F.B[1] * rN * sa, F.N[2] * rB * ca + F.B[2] * rN * sa]);
      const rr = (tt) => { const q = o.rad(clamp(tt, 0, 1), a); return Math.hypot(q[0] * ca, q[1] * sa); };
      const slope = (rr(t + d) - rr(t - d)) / ((Math.min(1, t + d) - Math.max(0, t - d)) * L || 1);
      const n = norm(sub(ip, mul(F.T, slope)));
      const at = o.attr(t, a, p, n, j, i, F);
      g.v(p, n, at.c, at.w, at);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segs; i++) {
    const i1 = (i + 1) % segs, A = base + j * segs + i, B = base + j * segs + i1, C = base + (j + 1) * segs + i1, D = base + (j + 1) * segs + i;
    g.tri(A, B, C); g.tri(A, C, D);
  }
  return base;
}
const ringsOf = (ts) => ts.map((t) => ({ t }));
// a star-shaped mesh: rays from c (directions over longitudes us × latitudes vs, plus poles) with radius
// r(th, ph) (null leaves a hole), normals from the SDF f if given, else from the mesh
function starMesh(g, c, us, vs, r, attr, o = {}) {
  const nu = us.length, nv = vs.length, base = g.n, i0 = g.I.length, R = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) R.push(r(us[i], vs[j], i, j));
  const ok = (i, j) => R[j * nu + i] !== null && R[j * nu + i] !== undefined;
  const vert = (th, ph, rr, i, j) => {
    const d = dirOf(th, ph), p = mad(c, d, rr), n = o.f ? grad(o.f, p) : d, a = attr(th, ph, p, n, i, j);
    return g.v(o.out ? o.out(p) : p, n, a.c, a.w, a);
  };
  const id = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) id.push(ok(i, j) ? vert(us[i], vs[j], R[j * nu + i], i, j) : -1);
  const keep = (i, j) => !o.keep || o.keep(i, j);
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) {
    if (!o.wrap && i === nu - 1) continue;
    const i1 = (i + 1) % nu, a = id[j * nu + i], b = id[j * nu + i1], cc = id[(j + 1) * nu + i1], d = id[(j + 1) * nu + i];
    if (a < 0 || b < 0 || cc < 0 || d < 0 || !keep(i, j)) continue;
    g.tri(a, b, cc); g.tri(a, cc, d);
  }
  if (o.top) {
    const rt = r(0, PI / 2, -1, nv);
    if (rt !== null) {
      const pv = vert(0, PI / 2, rt, -1, nv);
      for (let i = 0; i < nu; i++) { const a = id[(nv - 1) * nu + i], b = id[(nv - 1) * nu + ((i + 1) % nu)]; if (a >= 0 && b >= 0 && (o.wrap || i < nu - 1)) g.tri(a, b, pv); }
    }
  }
  if (o.bottom) {
    const rb = r(0, -PI / 2, -1, -1);
    if (rb !== null) {
      const pv = vert(0, -PI / 2, rb, -1, -1);
      for (let i = 0; i < nu; i++) { const a = id[i], b = id[(i + 1) % nu]; if (a >= 0 && b >= 0 && (o.wrap || i < nu - 1)) g.tri(pv, b, a); }
    }
  }
  if (!o.f) meshNormals(g, base, i0);
  return id;
}
// a lathe: profile [[radius, height], ...] revolved around axis through c
function lathe(g, c, axis, prof, segs, attr, o = {}) {
  const ax = norm(axis), e1 = norm(Math.abs(ax[1]) < 0.9 ? cross(ax, [0, 1, 0]) : cross(ax, [1, 0, 0])), e2 = cross(ax, e1);
  const base = g.n, i0 = g.I.length;
  for (let j = 0; j < prof.length; j++) for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TAU, [rr, h] = prof[j], rd = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
    const p = add(mad(c, ax, h), mul(rd, rr)), at = attr(j, a, p);
    g.v(p, rd, at.c, at.w, at);
  }
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < segs; i++) {
    const i1 = (i + 1) % segs, A = base + j * segs + i, B = base + j * segs + i1, C = base + (j + 1) * segs + i1, D = base + (j + 1) * segs + i;
    if (o.flip) { g.tri(A, C, B); g.tri(A, D, C); } else { g.tri(A, B, C); g.tri(A, C, D); }
  }
  meshNormals(g, base, i0);
}
// a rounded box (superellipsoid) at c with half sizes h, axes ex / ey / ez
function rbox(g, c, h, attr, o = {}) {
  const ex = o.ex || [1, 0, 0], ey = o.ey || [0, 1, 0], ez = o.ez || [0, 0, 1], e = o.e || 0.35, base = g.n, i0 = g.I.length;
  const sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;
  surf(g, around(o.segs || 12), lin(-PI / 2 + 0.02, PI / 2 - 0.02, o.rows || 8), true, (u, v) => {
    const th = u * TAU, x = sp(Math.cos(v), e) * sp(Math.sin(th), e), y = sp(Math.sin(v), e), z = sp(Math.cos(v), e) * sp(Math.cos(th), e);
    return add(c, add(add(mul(ex, x * h[0]), mul(ey, y * h[1])), mul(ez, z * h[2])));
  }, (u, v, p, n) => attr(p, n, u, v));
  // close the ends
  const nu = o.segs || 12, rows = o.rows || 8, top = g.v(add(c, mul(ey, h[1])), ey, attr(add(c, mul(ey, h[1])), ey, 0, 1).c, attr(c, ey, 0, 1).w, attr(c, ey, 0, 1));
  const bot = g.v(add(c, mul(ey, -h[1])), mul(ey, -1), attr(add(c, mul(ey, -h[1])), mul(ey, -1), 0, -1).c, attr(c, ey, 0, -1).w, attr(c, ey, 0, -1));
  for (let i = 0; i < nu; i++) { const i1 = (i + 1) % nu; g.tri(base + (rows - 1) * nu + i, base + (rows - 1) * nu + i1, top); g.tri(bot, base + i1, base + i); }
  meshNormals(g, base, i0);
}

// ---------------------------------------------------------------------------------------------- body plan
// Proportions for a figure `height` m tall from sole to crown (about 6.8 heads), standing `lift` m up
// (skate plates, shoe soles). Skye: 1.77 on skates puts the hips at exactly 0.96 like the old rig.
function makePlan(spec) {
  const H = spec.height || 1.77, lift = spec.lift ?? (spec.skates ? 0.075 : 0.022), k = H / 1.77;
  const b = Object.assign({ shoulders: 1, chest: 1, waist: 1, hips: 1, depth: 1, belly: 0, bust: 0, limbs: 1, legs: 1, neck: 1, hands: 1, slouch: 0 }, spec.build);
  const Y = (u) => lift + u * H;
  const P = { H, lift, k, b, Y };
  P.hipY = Y(0.5); P.kneeY = Y(0.276); P.ankleY = Y(0.041); P.waistY = Y(0.612); P.chestY = Y(0.72);
  P.hipX = 0.095 * k * (0.55 + 0.45 * b.hips);
  P.S = [0.175 * k * b.shoulders, Y(0.815), -0.006 * k];
  P.E = add(P.S, [0.03 * k, -0.178 * H, -0.008 * k]);
  P.W = add(P.E, [0.024 * k, -0.146 * H, 0.014 * k]);
  P.Hp = [P.hipX, P.hipY, 0];
  P.K = [P.hipX + 0.004 * k, P.kneeY, 0.006 * k];
  P.A = [P.hipX + 0.006 * k, P.ankleY, -0.012 * k];
  P.head = [0, Y(0.893), (-0.012 + 0.03 * b.slouch) * k];
  P.hs = ((0.146 * H) / 0.255) * ((spec.face && spec.face.size) || 1);
  return P;
}
// torso profile for a 1.77 m figure: [u (height fraction), half width, front depth, back depth, centre z, superellipse exponent]
const TORSO = [
  [0.462, 0.034, 0.034, 0.034, -0.002, 2.0], [0.472, 0.094, 0.064, 0.07, -0.005, 2.2], [0.49, 0.148, 0.081, 0.097, -0.008, 2.4],
  [0.51, 0.166, 0.083, 0.101, -0.01, 2.5], [0.54, 0.162, 0.082, 0.093, -0.008, 2.5], [0.575, 0.147, 0.079, 0.08, -0.004, 2.4],
  [0.612, 0.132, 0.077, 0.072, 0, 2.3], [0.645, 0.134, 0.081, 0.074, 0.002, 2.3], [0.685, 0.145, 0.09, 0.08, 0.004, 2.4],
  [0.72, 0.154, 0.096, 0.086, 0.004, 2.5], [0.755, 0.161, 0.091, 0.09, 0, 2.6], [0.785, 0.178, 0.08, 0.086, -0.006, 2.6],
  [0.806, 0.188, 0.068, 0.076, -0.01, 2.5], [0.822, 0.166, 0.058, 0.066, -0.012, 2.3], [0.835, 0.108, 0.052, 0.058, -0.012, 2.2],
  [0.846, 0.055, 0.047, 0.05, -0.01, 2.0],
];
function torsoSec(P, s) {
  const n = TORSO.length, f = clamp(s, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i;
  const cr = (c) => { const p0 = TORSO[Math.max(0, i - 1)][c], p1 = TORSO[i][c], p2 = TORSO[i + 1][c], p3 = TORSO[Math.min(n - 1, i + 2)][c]; return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t); };
  const u = cr(0), b = P.b, k = P.k;
  const wH = 1 - sstep(0.55, 0.6, u), wS = sstep(0.75, 0.8, u), wC = Math.max(0, 1 - wH - wS);
  let fw = b.hips * wH + lerp(b.waist, b.chest, sstep(0.62, 0.7, u)) * wC + b.shoulders * wS;
  fw = lerp(fw, b.neck, sstep(0.826, 0.846, u));
  const belly = b.belly * 0.035 * k * gs(u - 0.585, 0.045);
  return { u, y: P.Y(u), w: cr(1) * k * fw, df: cr(2) * k * b.depth * lerp(1, b.chest, sstep(0.64, 0.7, u) * (1 - sstep(0.76, 0.8, u))) + belly, db: cr(3) * k * b.depth, zc: cr(4) * k, e: cr(5) };
}
function torsoPt(P, s, th) {
  const S = torsoSec(P, s), sn = Math.sin(th), cs = Math.cos(th), ex = 2 / S.e, k = P.k, u = S.u;
  const x = S.w * Math.sign(sn) * Math.abs(sn) ** ex;
  let z = S.zc + (cs >= 0 ? S.df : S.db) * Math.sign(cs) * Math.abs(cs) ** ex;
  const ax = Math.abs(x);
  if (cs > 0) z += (0.005 + 0.016 * P.b.bust) * k * gs(u - 0.716, 0.03) * gs(ax - 0.064 * k, 0.042 * k) * cs;
  else {
    z -= 0.007 * k * gs(u - 0.495, 0.028) * gs(ax - 0.07 * k, 0.05 * k) * -cs;
    z -= 0.004 * k * gs(u - 0.77, 0.03) * gs(ax - 0.075 * k, 0.035 * k) * -cs;
    z += 0.004 * k * gs(x, 0.012 * k) * sstep(0.56, 0.62, u) * (1 - sstep(0.8, 0.83, u)) * -cs;
  }
  return [x, S.y, z];
}
function torsoN(P, s, th) {
  const e = 1e-3, du = sub(torsoPt(P, s, th + e), torsoPt(P, s, th - e)), dv = sub(torsoPt(P, Math.min(1, s + e), th), torsoPt(P, Math.max(0, s - e), th));
  return norm(cross(du, dv));
}
const sOfU = (u) => { let a = 0, b = 1; for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (torsoSecU(m) < u) a = m; else b = m; } return (a + b) / 2; };
function torsoSecU(s) { const n = TORSO.length, f = clamp(s, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i; return lerp(TORSO[i][0], TORSO[i + 1][0], t); }

// weights of a point on (or over) the torso
function wTorso(P, p) {
  const ax = Math.abs(p[0]), y = p[1], k = P.k;
  const wa = 0.85 * sstep(P.S[0] - 0.065 * k, P.S[0] + 0.01 * k, ax) * sstep(P.S[1] - 0.15 * k, P.S[1] - 0.035 * k, y);
  let wl = 0.7 * sstep(P.hipY + 0.06 * k, P.hipY - 0.08 * k, y);
  if (p[2] < 0) wl *= lerp(1, 0.6, sstep(0, -0.07 * k, p[2]));
  const lr = sstep(-0.03 * k, 0.03 * k, p[0]), up = sstep(P.waistY - 0.03 * k, P.chestY, y), rest = Math.max(0, 1 - wa - wl);
  return [p[0] >= 0 ? BI.armL : BI.armR, wa, BI.legL, wl * lr, BI.legR, wl * (1 - lr), BI.torso, rest * up, BI.body, rest * (1 - up)];
}
// arm and leg chains (left side; the right is mirrored)
function armCurve(P) {
  const k = P.k, top = add(P.S, [0.004 * k, 0.042 * k, 0]), end = mad(P.W, norm(sub(P.W, P.E)), 0.012 * k);
  return spline([top, P.S, mixv(P.S, P.E, 0.5), P.E, mixv(P.E, P.W, 0.5), P.W, end]);
}
function legCurve(P) {
  const k = P.k;
  return spline([add(P.Hp, [0, 0.075 * k, -0.005 * k]), P.Hp, mixv(P.Hp, P.K, 0.5), P.K, mixv(P.K, P.A, 0.5), P.A, add(P.A, [0, -0.03 * k, 0.012 * k])]);
}
function armShape(P) {
  const cv = armCurve(P), L = cv.len, dS = cv.T[1] * L, dE = cv.T[3] * L, dW = cv.T[5] * L, k = P.k, kl = k * P.b.limbs;
  const R = [[0, 0.012], [dS * 0.5, 0.036], [dS, 0.044], [dS + 0.05 * k, 0.0455], [dS + 0.14 * k, 0.04], [dE - 0.05 * k, 0.0345], [dE, 0.0325], [dE + 0.06 * k, 0.036], [dW - 0.07 * k, 0.028], [dW, 0.0225], [L, 0.019]];
  const rad = (t, a, off = 0) => {
    const d = t * L, r = skeys(R, d) * kl, wr = sstep(dW - 0.1 * k, dW, d), elb = 0.005 * kl * gs(d - dE, 0.03 * k) * Math.max(0, -Math.cos(a));
    return [r * (1 + 0.12 * wr) + elb + off, r * (1 - 0.14 * wr) + off];
  };
  const w = (t) => {
    const d = t * L, tor = 0.45 * (1 - sstep(dS - 0.01 * k, dS + 0.06 * k, d)), fore = sstep(dE - 0.045 * k, dE + 0.045 * k, d), hand = sstep(dW - 0.012 * k, dW + 0.02 * k, d);
    return [BI.torso, tor, BI.armL, (1 - tor) * (1 - fore), BI.foreL, (1 - tor) * fore * (1 - hand), BI.handL, (1 - tor) * fore * hand];
  };
  return { cv, L, dS, dE, dW, rad, w, tE: cv.T[3], tW: cv.T[5] };
}
function legShape(P) {
  const cv = legCurve(P), L = cv.len, dH = cv.T[1] * L, dK = cv.T[3] * L, dA = cv.T[5] * L, k = P.k, kl = k * P.b.limbs * P.b.legs;
  const R = [[0, 0.03], [dH * 0.6, 0.074], [dH, 0.085], [dH + 0.08 * k, 0.081], [dH + 0.2 * k, 0.068], [dK - 0.06 * k, 0.053], [dK, 0.049], [dK + 0.07 * k, 0.051],
    [dK + 0.14 * k, 0.05], [dA - 0.09 * k, 0.034], [dA - 0.03 * k, 0.029], [dA, 0.0295], [L, 0.026]];
  const rad = (t, a, off = 0) => {
    const d = t * L, r = skeys(R, d) * kl, ca = Math.cos(a);
    const calf = 0.009 * kl * gs(d - (dK + 0.11 * k), 0.06 * k) * Math.max(0, -ca), cap = 0.006 * kl * gs(d - dK, 0.025 * k) * Math.max(0, ca) ** 2;
    return [r + calf + cap + off, r * (1 - 0.04 * sstep(dH, dK, d)) + off];
  };
  const w = (t) => {
    const d = t * L, bod = 0.5 * (1 - sstep(dH - 0.03 * k, dH + 0.05 * k, d)), shin = sstep(dK - 0.05 * k, dK + 0.05 * k, d), foot = 0.85 * sstep(dA - 0.015 * k, dA + 0.025 * k, d);
    return [BI.body, bod, BI.legL, (1 - bod) * (1 - shin), BI.shinL, (1 - bod) * shin * (1 - foot), BI.footL, (1 - bod) * shin * foot];
  };
  const tOfY = (y) => { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (cv.at(m)[1] > y) a = m; else b = m; } return (a + b) / 2; };
  return { cv, L, dH, dK, dA, rad, w, tOfY, tK: cv.T[3], tA: cv.T[5] };
}
// t samples between t0 and t1, denser near the joints
function limbTs(t0, t1, n, joints = []) {
  const s = new Set(lin(t0, t1, n).map((v) => +v.toFixed(5)));
  for (const j of joints) for (const o of [-0.03, 0, 0.03]) { const v = j + o; if (v > t0 + 0.004 && v < t1 - 0.004) s.add(+v.toFixed(5)); }
  return [...s].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------- materials
const MATS = new WeakMap();
const DEF_RIM = { value: new THREE.Color(0) };
export function figureMaterials(opts = {}) {
  const rimU = opts.rimU || DEF_RIM;
  if (MATS.has(rimU)) return MATS.get(rimU);
  const wrapChunk = (w) => THREE.ShaderChunk.lights_physical_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
    `float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${w.toFixed(2)} ) / ${(1 + w).toFixed(2)} );`);
  const patch = (mat, key, wrap, vx, fx, after) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = rimU;
      sh.vertexShader = (vx ? vx.decl : '') + sh.vertexShader;
      if (vx) for (const [a, b] of vx.rep) sh.vertexShader = sh.vertexShader.replace(a, b);
      let f = 'uniform vec3 uRim;\n' + (fx ? fx.decl : '') + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', wrapChunk(wrap));
      if (fx) for (const [a, b] of fx.rep) f = f.replace(a, b);
      sh.fragmentShader = f.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  totalEmissiveRadiance += uRim * pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 2.5 );\n' + (after || ''));
    };
    mat.customProgramCacheKey = () => 'neon-figure-' + key;
    return mat;
  };
  const skin = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), 'skin', 0.38);
  const cloth = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), 'cloth', 0.18,
    { decl: 'attribute vec3 aRM;\nvarying vec3 vRM;\nvarying vec3 vSP;\n', rep: [['#include <begin_vertex>', '#include <begin_vertex>\n  vRM = aRM; vSP = position;']] },
    { decl: 'varying vec3 vRM;\nvarying vec3 vSP;\n', rep: [['#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vRM.x;'], ['#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = vRM.y;']] },
    // sequins: tiny view-dependent glints
    'if ( vRM.z > 0.0 ) { vec3 sq = floor( vSP * 180.0 ); float sh = fract( sin( dot( sq, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );'
    + ' float sf = fract( sh * 7.0 + dot( normal, vec3( 2.3, 3.1, 1.7 ) ) * 1.6 ); totalEmissiveRadiance += vRM.z * vec3( 1.0, 0.93, 1.0 ) * smoothstep( 0.9, 1.0, sf ) * 1.8; }');
  const hair = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }), 'hair', 0.25,
    { decl: 'attribute vec3 aHT;\nvarying vec3 vHT;\n', rep: [['#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n  vec3 hT = aHT;\n  #ifdef USE_SKINNING\n  hT = ( skinMatrix * vec4( hT, 0.0 ) ).xyz;\n  #endif\n  vHT = normalMatrix * hT;']] },
    { decl: 'varying vec3 vHT;\n', rep: [] },
    // a soft anisotropic sheen along the strands (two shifted lobes)
    'if ( length( vHT ) > 1e-4 ) { vec3 hV = normalize( vViewPosition ); vec3 hH = normalize( normalize( vec3( 0.25, 0.85, 0.45 ) ) + hV );'
    + ' vec3 hTa = normalize( vHT - normal * dot( vHT, normal ) + vec3( 1e-5 ) ); float t1 = dot( normalize( hTa - normal * 0.12 ), hH ), t2 = dot( normalize( hTa + normal * 0.3 ), hH );'
    + ' totalEmissiveRadiance += vec3( pow( sqrt( max( 0.0, 1.0 - t1 * t1 ) ), 110.0 ) ) * 0.14 + diffuseColor.rgb * pow( sqrt( max( 0.0, 1.0 - t2 * t2 ) ), 28.0 ) * 0.28; }');
  const eye = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0 }), 'eye', 0.2,
    { decl: 'attribute vec3 aEye;\nvarying vec3 vEye;\n', rep: [['#include <begin_vertex>', '#include <begin_vertex>\n  vEye = aEye;']] },
    { decl: 'varying vec3 vEye;\n', rep: [['#include <color_fragment>', `#include <color_fragment>
  {
    vec3 e = normalize( vEye );
    float ang = acos( clamp( e.z, -1.0, 1.0 ) ), az = atan( e.y, e.x );
    vec3 iris = diffuseColor.rgb;
    float fib = 0.8 + 0.2 * sin( az * 23.0 + ang * 11.0 ) * sin( az * 7.0 - ang * 5.0 );
    vec3 ic = iris * fib * mix( 1.35, 0.75, smoothstep( 0.16, 0.56, ang ) );
    ic = mix( ic, iris * 0.28, smoothstep( 0.46, 0.56, ang ) );
    vec3 scl = mix( vec3( 0.92, 0.9, 0.87 ), vec3( 0.82, 0.68, 0.66 ), smoothstep( 0.9, 1.7, ang ) );
    vec3 col = mix( ic, scl, smoothstep( 0.545, 0.575, ang ) );
    col = mix( vec3( 0.012 ), col, smoothstep( 0.19, 0.225, ang ) );
    col *= mix( 1.0, 0.62, smoothstep( 0.15, 0.75, e.y ) );
    diffuseColor.rgb = col;
  }`]] },
    '{ vec3 cV = normalize( vViewPosition ); vec3 cR = reflect( -cV, normal ); float cl = smoothstep( 0.982, 0.994, dot( cR, normalize( vec3( -0.35, 0.45, 1.0 ) ) ) ); totalEmissiveRadiance += vec3( cl ) * 1.4; }');
  const m = { skin, cloth, hair, eye, rimU };
  MATS.set(rimU, m);
  return m;
}

// ---------------------------------------------------------------------------------------------- head
// In "reference head" units: a head 0.255 m tall, the pivot (head bone) at the top of the neck, +x is
// the figure's left. Scaled into the body by P.hs.
function faceOf(spec) {
  return Object.assign({ w: 1, jaw: 1, chin: 1, chinY: 0, cheek: 1, cheekW: 1, nose: 1, noseW: 1, tip: 1, bridge: 1, lips: 1, lipW: 1, eye: 1, gap: 1, eyeY: 0,
    tilt: 0.05, lidUp: 0.4, lidLo: -0.43, brow: 1, arch: 1, browY: 0, ears: 1, forehead: 1, crown: 1, size: 1 }, spec.face);
}
function headSDF(F) {
  const re = 0.0138 * F.eye, ex = 0.0315 * F.gap, ey = 0.074 + F.eyeY, ez = 0.066, yM = -0.003, nl = F.nose, nw = F.noseW, lf = F.lips, lw = F.lipW;
  const lipU = (x, y, z) => sdE(x, y, z, 0, 0.0036, 0.0915, 0.0205 * lw, 0.0055 * lf, 0.0068 * lf);
  const lipL = (x, y, z) => sdE(x, y, z, 0, -0.0098, 0.0895, 0.018 * lw, 0.0062 * lf, 0.007 * lf);
  const f = (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdE(x, y, z, 0, 0.103, -0.012, 0.0745 * F.w, 0.089 * F.crown, 0.095);
    d = smin(d, sdE(x, y, z, 0, 0.098, 0.028, 0.066 * F.w, 0.06, 0.058 * F.forehead), 0.02);
    d = smin(d, sdE(x, y, z, 0, 0.042, 0.03, 0.06 * F.cheekW, 0.058, 0.064), 0.024);
    d = smin(d, sdE(x, y, z, 0, 0.003, 0.028, 0.0485 * F.jaw, 0.044, 0.058), 0.02);
    d = smin(d, sdE(ax, y, z, 0.046 * F.jaw, 0.0, -0.022, 0.018, 0.026, 0.026), 0.022);
    d = smin(d, sdE(x, y, z, 0, -0.034 + F.chinY, 0.072, 0.021 * F.chin, 0.019 * F.chin, 0.016 * F.chin), 0.016);
    d = smin(d, sdE(ax, y, z, 0.046 * F.cheekW, 0.06, 0.052, 0.022 * F.cheek, 0.014, 0.022), 0.02);
    d = smin(d, sdE(x, y, z, 0, 0.006, 0.074, 0.028 * lw, 0.026, 0.02), 0.012);
    d = smin(d, sdC(ax, y, z, 0.006, 0.091 + F.browY, 0.078, 0.046, 0.092 + F.browY, 0.068, 0.0095 * F.brow, 0.008 * F.brow), 0.012);
    d = smax(d, -sdE(ax, y, z, ex, ey, ez + 0.0113 * F.eye, 0.0208 * F.eye, 0.0094 * F.eye, 0.0057 * F.eye), 0.008);
    d = smax(d, -(Math.hypot(ax - ex, y - ey, z - ez) - (re + 0.0008)), 0.002);
    let n = sdC(x, y, z, 0, 0.086, 0.079, 0, 0.04, 0.079 + 0.024 * nl, 0.0062 * F.bridge, 0.0085 * nw);
    n = smin(n, sdS(x, y, z, 0, 0.032, 0.08 + 0.024 * nl, 0.0102 * F.tip), 0.008);
    n = smin(n, sdS(ax, y, z, 0.0118 * nw, 0.029, 0.069 + 0.024 * nl, 0.0072 * nw), 0.006);
    d = smin(d, n, 0.008);
    d = smin(d, lipU(x, y, z), 0.006);
    return smin(d, lipL(x, y, z), 0.006);
  };
  return { f, re, ex, ey, ez, yM, lipU, lipL, C: [0, 0.06, -0.005] };
}
// insert v into the sorted array a (replacing a sample closer than tol)
function snapIn(a, v, tol) {
  let bi = 0;
  for (let i = 1; i < a.length; i++) if (Math.abs(a[i] - v) < Math.abs(a[bi] - v)) bi = i;
  if (Math.abs(a[bi] - v) < tol) a[bi] = v; else { a.push(v); a.sort((x, y) => x - y); }
}
// the head: a deformed sphere (rays onto the SDF) with a mouth slit along one latitude row so the jaw can
// open, lips, nostrils, blush and shadow in the vertex colours; mouth bag, teeth, ears and the neck
function buildHead(g, P, spec) {
  const F = faceOf(spec), S = headSDF(F), C = S.C, hs = P.hs;
  const toB = (p) => [P.head[0] + p[0] * hs, P.head[1] + p[1] * hs, P.head[2] + p[2] * hs];
  const skin = hex(spec.skin), lipC = hex(spec.lip || '#a8555a'), blushC = mixv(skin, hex('#e0606a'), 0.55), dark = tone(skin, 0.42);
  const phM = Math.atan2(S.yM - C[1], 0.1 - C[2]), thM = Math.atan2(0.0215 * F.lipW, 0.094);
  const NU = 40, us = [];
  for (let i = 0; i < NU; i++) { const u = -1 + (2 * i) / NU; us.push(PI * (0.3 * u + 0.7 * u * u * u)); }
  for (const v of [-thM, thM, 0, -thM * 0.5, thM * 0.5]) snapIn(us, v, 0.02);
  const vs = [];
  const NV = 25, c0 = -0.3;
  for (let j = 0; j < NV; j++) { const w = -1 + (2 * j) / (NV - 1), q = 0.45 * w + 0.55 * w * w * w; vs.push(w < 0 ? c0 + (c0 + 1.5) * q : c0 + (1.5 - c0) * q); }
  for (const v of [phM, phM + 0.018, phM - 0.02, phM + 0.04, phM - 0.045]) snapIn(vs, v, 0.008);
  const jm = vs.indexOf(phM), nu = us.length, nv = vs.length;
  const rCache = new Map();
  const rHead = (th, ph) => { const key = Math.round(th * 4000) * 1e5 + Math.round(ph * 4000); let r = rCache.get(key); if (r === undefined) { r = march(S.f, C, dirOf(th, ph), 0.24) ?? 0.06; rCache.set(key, r); } return r; };
  const R = vs.map((ph) => us.map((th) => rHead(th, ph)));
  const inSlit = (i) => Math.abs(us[i]) < thM - 1e-6;
  const corner = (i) => Math.abs(Math.abs(us[i]) - thM) < 1e-6;
  // weights: jaw below the mouth line (rising towards the jaw hinge), brows, mouth corners
  const wOf = (p, j, i, lower) => {
    const ax = Math.abs(p[0]), lipZone = Math.abs(us[i]) < thM + 0.07 && Math.abs(vs[j] - phM) < 0.065;
    let wj;
    if (lower !== undefined) wj = lower ? 1 : 0;
    else if (lipZone) wj = vs[j] < phM - 1e-6 ? 1 : vs[j] > phM + 1e-6 ? 0 : 0.5;
    else { const back = sstep(0.085, -0.025, p[2]), yL = lerp(S.yM, 0.03, back); wj = sstep(yL + 0.008, yL - 0.014, p[1]) * sstep(-0.065, -0.03, p[2]); }
    const wc = 0.75 * gs(Math.hypot(ax - 0.0215 * F.lipW, p[1] - S.yM, p[2] - 0.088), 0.011);
    const wb = 0.9 * gs(Math.hypot(ax - (S.ex + 0.004), p[1] - (0.097 + F.browY), (p[2] - 0.08) * 0.6), 0.017) * sstep(0.076, 0.09, p[1]);
    const L = p[0] >= 0, rest = Math.max(0, 1 - wc - wb);
    return [BI.jaw, wj * rest, L ? BI.mouthL : BI.mouthR, wc, L ? BI.browL : BI.browR, wb, BI.head, (1 - wj) * rest];
  };
  const colOf = (p) => {
    const ax = Math.abs(p[0]);
    let c = skin.slice();
    c = mixv(c, blushC, gs(Math.hypot(ax - 0.046, p[1] - 0.045, (p[2] - 0.072) * 0.7), 0.021) * (spec.blush ?? 0.14));
    c = mixv(c, blushC, gs(Math.hypot(p[0], p[1] - 0.034, p[2] - 0.104), 0.011) * 0.12);
    const dl = Math.min(S.lipU(p[0], p[1], p[2]), S.lipL(p[0], p[1], p[2]));
    c = mixv(c, lipC, (1 - sstep(-0.0008, 0.0026, dl)) * sstep(0.08, 0.088, p[2]) * 0.9);
    c = mixv(c, dark, gs(Math.hypot(ax - 0.0085 * F.noseW, p[1] - 0.0245, p[2] - (0.068 + 0.024 * F.nose)), 0.0034) * 0.85);
    c = tone(c, 1 - 0.13 * sstep(-0.028, -0.056, p[1]) * sstep(0.075, 0.02, p[2]));
    c = tone(c, 1 - 0.09 * gs(Math.hypot(ax - S.ex, p[1] - (S.ey - 0.003), (p[2] - 0.074) * 0.8), 0.017));
    return c;
  };
  const eyeFix = (d, p) => {
    const E = [Math.sign(p[0]) * S.ex, S.ey, S.ez];
    if (vlen(sub(p, E)) > S.re + 0.0014) return null;
    const Ri = S.re - 0.002, oc = sub(C, E), b = dot(oc, d), cc = dot(oc, oc) - Ri * Ri, disc = b * b - cc;
    if (disc > 0) return mad(C, d, -b + Math.sqrt(disc));
    return add(E, mul(norm(sub(mad(C, d, -b), E)), Ri));
  };
  const id = [], lo = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    let r = R[j][i];
    if (j === jm && (inSlit(i) || corner(i))) r -= inSlit(i) ? 0.0024 : 0.0015;
    const d = dirOf(us[i], vs[j]), q = mad(C, d, R[j][i]), fixed = eyeFix(d, q), p = fixed || mad(C, d, r), n = fixed ? norm(sub(p, [Math.sign(p[0]) * S.ex, S.ey, S.ez])) : grad(S.f, q), c = fixed ? tone(skin, 0.8) : colOf(p);
    const sl = j === jm && inSlit(i);
    id.push(g.v(toB(p), n, sl ? mixv(c, lipC, 0.5) : c, wOf(p, j, i, sl ? false : undefined)));
    lo.push(sl ? g.v(toB(p), n, mixv(c, lipC, 0.5), wOf(p, j, i, true)) : -1);
  }
  const at = (i, j, below) => (below && j === jm && lo[j * nu + i] >= 0 ? lo[j * nu + i] : id[j * nu + i]);
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) {
    const i1 = (i + 1) % nu;
    // cells under the slit row use its lower copies
    const a = at(i, j, false), b = at(i1, j, false), c = at(i1, j + 1, true), d = at(i, j + 1, true);
    g.tri(a, b, c); g.tri(a, c, d);
  }
  for (const [ph, flip] of [[PI / 2, false], [-PI / 2, true]]) {
    const r = rHead(0, ph), p = mad(C, [0, Math.sign(ph), 0], r), pv = g.v(toB(p), [0, Math.sign(ph), 0], colOf(p), [BI.head, 1]);
    const j = flip ? 0 : nv - 1;
    for (let i = 0; i < nu; i++) { const a = id[j * nu + i], b = id[j * nu + ((i + 1) % nu)]; if (flip) g.tri(pv, b, a); else g.tri(a, b, pv); }
  }
  // inside the mouth: a dark bag (seen from inside), teeth and a tongue; only visible when the jaw opens
  const mc = [0, S.yM, 0.074], mw = (p) => (p[1] < S.yM ? [BI.jaw, 1] : [BI.head, 1]);
  surf(g, around(8), lin(-PI / 2 + 0.15, PI / 2 - 0.15, 5), true, (u, v) => toB([mc[0] + 0.021 * F.lipW * Math.cos(v) * Math.sin(u * TAU), mc[1] + 0.012 * Math.sin(v), mc[2] + 0.019 * Math.cos(v) * Math.cos(u * TAU)]),
    (u, v) => ({ c: hex('#3a1216'), w: mw([0, S.yM + 0.012 * Math.sin(v), 0]) }), { flip: true });
  for (const [y0, y1, rr, w] of [[S.yM + 0.0018, S.yM - 0.0045, 0.0184, [BI.head, 1]], [S.yM - 0.006, S.yM - 0.0105, 0.0172, [BI.jaw, 1]]]) {
    const row = (y) => lin(-0.9, 0.9, 7).map((a) => toB([Math.sin(a) * rr * F.lipW, y, 0.073 + Math.cos(a) * rr]));
    sheet(g, [row(y0), row(y1)], () => ({ c: hex('#f1ebe0'), w }), () => [0, 0, 1]);
  }
  surf(g, around(6), lin(-1.2, 1.2, 3), true, (u, v) => toB([0.013 * Math.cos(v) * Math.sin(u * TAU), S.yM - 0.0095 + 0.004 * Math.sin(v), 0.071 + 0.015 * Math.cos(v) * Math.cos(u * TAU)]), () => ({ c: hex('#b4505a'), w: [BI.jaw, 1] }));
  // ears (left, mirrored)
  const ear = new Geo(), E = earSDF(F);
  starMesh(ear, E.c, around(10).map((u) => u * TAU - PI), lin(-1.4, 1.4, 8), (th, ph) => march(E.f, E.c, dirOf(th, ph), 0.07) ?? 0.004,
    (th, ph, p) => ({ c: tone(mixv(skin, blushC, 0.18), 1 - 0.18 * sstep(0.002, -0.002, E.bowl(p))), w: [BI.head, 1] }), { f: E.f, wrap: true, top: true, bottom: true, out: toB });
  g.add(ear).add(ear, true);
  // the neck, from inside the collar to inside the head
  const k = P.k, nb = P.b.neck;
  const neck = spline([[0, P.Y(0.824), -0.017 * k], [0, P.Y(0.846), -0.013 * k], toB([0, -0.01, -0.012]), toB([0, 0.05, -0.008])]);
  P.neck = neck;
  P.neckR = (t) => [lerp(0.052, 0.045, t) * k * nb, lerp(0.056, 0.047, t) * k * nb];
  tube(g, null, { curve: neck, segs: 12, rings: ringsOf(lin(0, 1, 6)), n0: [0, 0, 1], rad: (t) => P.neckR(t),
    attr: (t, a) => ({ c: tone(skin, 0.96 - 0.06 * Math.max(0, Math.cos(a)) * sstep(0.5, 1, t)), w: [BI.torso, 1 - sstep(0.3, 0.85, t), BI.head, sstep(0.3, 0.85, t)] }) });
  const H = { F, S, C, hs, toB, rHead, P, spec, skin };
  H.massR = null;
  return H;
}
function earSDF(F) {
  const c = [0.0715 * F.w, 0.05, -0.012], ry = -0.38, rx = 0.18, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), e = F.ears;
  const loc = (x, y, z) => { const px = x - c[0], py = y - c[1], pz = z - c[2], qx = px * cy - pz * sy, qz = px * sy + pz * cy; return [qx, py * cx - qz * sx, py * sx + qz * cx]; };
  const bowl = (p) => { const [a, b, d] = loc(p[0], p[1], p[2]); return sdE(a, b, d, 0.0128, 0.004, 0.0015, 0.0066, 0.0215 * e, 0.0112 * e); };
  const f = (x, y, z) => {
    const [a, b, d] = loc(x, y, z);
    let v = sdE(a, b, d, 0.006, 0.002, 0, 0.0088, 0.031 * e, 0.0185 * e);
    v = smax(v, -sdE(a, b, d, 0.0128, 0.004, 0.0015, 0.0066, 0.0215 * e, 0.0112 * e), 0.0035);
    v = smin(v, sdS(a, b, d, 0.004, -0.0245 * e, 0.003, 0.0075), 0.006);
    return smin(v, sdE(a, b, d, -0.004, 0, 0.002, 0.0085, 0.019, 0.012), 0.006);
  };
  return { c: [c[0] + 0.002, c[1], c[2]], f, bowl };
}
// a sheet from a grid of points [row][col], oriented to face `want(p)`
function sheet(g, pts, attr, want, wrapCols = false) {
  const R = pts.length, Cn = pts[0].length, base = g.n, i0 = g.I.length;
  for (let j = 0; j < R; j++) for (let i = 0; i < Cn; i++) { const a = attr(j, i, pts[j][i]); g.v(pts[j][i], [0, 1, 0], a.c, a.w, a); }
  let flip = false;
  const jm = Math.floor((R - 1) / 2), order = [jm, ...Array.from({ length: R - 1 }, (_, j) => j)];
  outer: for (const j of order) for (let i = Math.floor((Cn - 1) / 2); i < Cn - 1; i++) {
    const p0 = pts[j][i], fn = cross(sub(pts[j][i + 1], p0), sub(pts[j + 1][i + 1], p0));
    if (vlen(fn) > 1e-12) { flip = dot(fn, want(p0)) < 0; break outer; }
  }
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < (wrapCols ? Cn : Cn - 1); i++) {
    const i1 = (i + 1) % Cn, a = base + j * Cn + i, b = base + j * Cn + i1, c = base + (j + 1) * Cn + i1, d = base + (j + 1) * Cn + i;
    if (flip) { g.tri(a, c, b); g.tri(a, d, c); } else { g.tri(a, b, c); g.tri(a, c, d); }
  }
  meshNormals(g, base, i0);
}
// eyes: eyeballs (iris drawn in the shader), eyelid shells that rotate about the eyeball centre to blink,
// a lash fringe and brows. Built for the left eye and mirrored.
function buildEyes(gS, gE, gH, H) {
  const { S, F, toB, spec, skin } = H, re = S.re, E = [S.ex, S.ey, S.ez];
  const eS = new Geo(), eE = new Geo(), eH = new Geo();
  const iris = hex(spec.iris || '#6a4a2a'), lashC = hex(spec.lash || '#1a1218');
  const at = (d, r) => toB(add(E, mul(d, r)));
  surf(eE, around(12), lin(0, 1.95, 8), true, (u, v) => at([Math.sin(v) * Math.cos(u * TAU), Math.sin(v) * Math.sin(u * TAU), Math.cos(v)], re),
    (u, v) => { const d = [Math.sin(v) * Math.cos(u * TAU), Math.sin(v) * Math.sin(u * TAU), Math.cos(v)]; return { c: iris, w: [BI.eyeL, 1], x: d }; },
    { normal: (u, v) => [Math.sin(v) * Math.cos(u * TAU), Math.sin(v) * Math.sin(u * TAU), Math.cos(v)] });
  const bIn = -1.2, bOut = 1.12, aCi = -0.03, aCo = 0.03 + F.tilt;
  const cornerA = (b) => lerp(aCi, aCo, clamp((b - bIn) / (bOut - bIn), 0, 1));
  const shp = (b, c0, p) => { const c = (bIn + bOut) / 2 + c0, h = (bOut - bIn) / 2, q = clamp((b - c) / h, -1, 1); return Math.max(0, 1 - q * q) ** p; };
  const aU = (b) => cornerA(b) + (F.lidUp - cornerA(0)) * shp(b, -0.08, 0.55);
  const aL = (b) => cornerA(b) + (F.lidLo - cornerA(0)) * shp(b, 0.12, 0.7);
  const dAB = (a, b) => [Math.sin(b) * Math.cos(a), Math.sin(a), Math.cos(b) * Math.cos(a)];
  const rl = re + 0.0016, rlL = re + 0.0012, bs = lin(bIn - 0.4, bOut + 0.4, 11);
  const lidC = mixv(tone(skin, 0.95), hex('#d07070'), 0.06), liner = hex('#2a1a1c'), shadowC = spec.shadow ? hex(spec.shadow) : null;
  const up = [[0.03, re + 0.0003], [-0.008, re + 0.001], [0.006, rl], [0.09, rl + 0.0002], [0.25, rl + 0.0004], [0.55, rl + 0.0004], [0.95, rl + 0.0002]];
  sheet(eS, up.map(([da, r]) => bs.map((b) => at(dAB(Math.min(1.5, aU(b) + da), b), r))), (j) => {
    let c = j <= 2 ? mixv(lidC, liner, j === 2 ? 0.45 : 0.6) : lidC;
    if (shadowC && j >= 3) c = mixv(c, shadowC, j === 3 ? 0.75 : j === 4 ? 0.55 : 0.15);
    return { c, w: [BI.lidUL, 1] };
  }, (p) => sub(p, toB(E)));
  const lw = [[-0.85, rlL + 0.0002], [-0.45, rlL + 0.0004], [-0.18, rlL + 0.0003], [-0.006, rlL], [0.008, re + 0.0009], [-0.03, re + 0.0003]];
  sheet(eS, lw.map(([da, r]) => bs.map((b) => at(dAB(Math.max(-1.5, aL(b) + da), b), r))), (j) => ({ c: j >= 3 ? mixv(lidC, liner, 0.25) : tone(lidC, 0.98), w: [BI.lidLL, 1] }), (p) => sub(p, toB(E)));
  // lashes: a fringe off the upper lid margin, longer towards the outer corner, curled up
  const lb = lin(bIn + 0.12, bOut - 0.02, 11), L0 = 0.0042 * (spec.lashes ?? 1), L1 = 0.0085 * (spec.lashes ?? 1);
  const lash = [0, 0.5, 1].map((s) => lb.map((b) => {
    const f = (b - bIn) / (bOut - bIn), d = dAB(aU(b) + 0.004, b), len = lerp(L0, L1, f ** 1.6) * s;
    const dir = norm(add(mul(d, 0.55), [0.18 * f, 0.6 + 0.3 * s, 0]));
    return at(add(mul(d, rl + 0.0003), mul(dir, len / 1)), 1);
  }));
  // (at() scales by r: pass r = 1 with an absolute offset)
  sheet(eH, lash, () => ({ c: lashC, w: [BI.lidUL, 1], x: [0, 1, 0] }), () => [0, 0, 1]);
  // brows: a soft ridge of hair lying on the brow, tapering outwards
  const browC = hex(spec.brow || '#2a2140'), bsS = lin(0, 1, 12), pts = [[], [], []];
  const onHead = (q) => { const d = norm(sub(q, H.C)), r = march(S.f, H.C, d, 0.24) ?? 0.1; return mad(H.C, d, r); };
  const bp = bsS.map((s) => onHead([lerp(0.011, 0.058, s) * F.gap, 0.0915 + F.browY + 0.009 * F.arch * Math.sin(PI * s ** 0.8) - 0.004 * s, 0.09]));
  bsS.forEach((s, i) => {
    const p = bp[i], n = grad(S.f, p), tg = norm(sub(bp[Math.min(11, i + 1)], bp[Math.max(0, i - 1)]));
    let sd = norm(cross(n, tg)); if (sd[1] < 0) sd = mul(sd, -1);
    const w = lerp(0.0085, 0.0032, s ** 1.2) * F.brow;
    pts[0].push(toB(add(p, add(mul(sd, w * 0.55), mul(n, -0.0002)))));
    pts[1].push(toB(add(p, mul(n, 0.0014 * F.brow))));
    pts[2].push(toB(add(p, add(mul(sd, -w * 0.45), mul(n, -0.0002)))));
  });
  sheet(eH, pts, (j, i) => ({ c: tone(browC, j === 1 ? 1.08 : 0.9), w: [BI.browL, 1], x: norm(sub(pts[1][Math.min(11, i + 1)], pts[1][Math.max(0, i - 1)])) }), (p) => [0, 0, 1]);
  gS.add(eS).add(eS, true); gE.add(eE).add(eE, true); gH.add(eH).add(eH, true);
  H.lid = { up: F.lidUp, lo: F.lidLo };
}

// ---------------------------------------------------------------------------------------------- hair
const HL = [[0, 0.9], [0.55, 0.86], [0.95, 0.73], [1.25, 0.6], [1.45, 0.5], [1.68, 0.47], [1.95, 0.24], [2.3, -0.24], [2.75, -0.5], [PI, -0.58]];
// the hair mass: rays from the head centre onto max(scalp + thickness, volume SDF), faded into the skin
// at the hairline. Sets H.massR(th, ph) for clumps and hats.
function hairMass(g, H, o) {
  const C = H.C, K = o.hl || HL, soft = o.soft || 0.06, nu = o.nu || 32;
  const us = around(nu).map((u) => u * TAU - PI), vs = lin(o.phiMin ?? -1.0, 1.47, o.nv || 18);
  const mask = (th, ph) => { const h = keyLin(K, Math.abs(th)); return sstep(h - soft, h + soft, ph) * (o.mask ? o.mask(th, ph) : 1); };
  const rad = (th, ph) => {
    const rh = H.rHead(th, ph), m = mask(th, ph);
    let r = rh + o.thick(th, ph);
    if (o.vol && m > 0.001) { const rv = march(o.vol, C, dirOf(th, ph), 0.45); if (rv !== null) r = smax(r, rv, o.k || 0.012); }
    return { r: lerp(rh - 0.0035, r, m), m };
  };
  H.massR = (th, ph) => rad(th, ph).r;
  H.maskR = mask;
  const M = [], c0 = hex(o.col[0]), c1 = hex(o.col[1]);
  starMesh(g, C, us, vs, (th, ph, i, j) => { const q = rad(th, ph); if (i >= 0) M[j * nu + i] = q.m; return q.r; },
    (th, ph, p, n, i, j) => {
      const m = i >= 0 ? M[j * nu + i] : 1, band = 0.5 + 0.5 * Math.sin(th * 23 + ph * 7) * Math.sin(th * 9 - ph * 3);
      let c = mixv(c0, c1, clamp(0.25 + 0.5 * sstep(0.2, 1.3, ph) * band, 0, 1));
      c = tone(c, lerp(0.72, 1, m));
      const fl = o.flow ? o.flow(p) : [0, -1, -0.7], tg = norm(sub(fl, mul(n, dot(fl, n))));
      return { c, w: o.w ? o.w(p) : [BI.head, 1], x: tg };
    }, { wrap: true, top: true, out: H.toB, keep: (i, j) => Math.max(M[j * nu + i], M[j * nu + (i + 1) % nu], M[(j + 1) * nu + i], M[(j + 1) * nu + (i + 1) % nu]) > 0.02 });
}
// one clump: a flattened tapered tube grown from a root on the hair surface, kept outside the head
function clump(g, H, o) {
  const C = H.C, surfR = (th, ph) => Math.max(H.massR ? H.massR(th, ph) : 0, H.rHead(th, ph));
  const d0 = dirOf(o.th, o.ph);
  let p = mad(C, d0, surfR(o.th, o.ph) - (o.sink ?? 0.0025)), dir = norm(o.dir || [0, -1, 0]);
  dir = norm(sub(dir, mul(d0, dot(dir, d0) * (o.hug ?? 0.85))));
  const pts = [p.slice()], K = o.steps || 6, seg = o.len / K;
  for (let s = 0; s < K; s++) {
    p = mad(p, dir, seg);
    const q = sub(p, C), r = vlen(q), dd = mul(q, 1 / r), th = Math.atan2(dd[0], dd[2]), ph = Math.asin(clamp(dd[1], -1, 1));
    const rs = surfR(th, ph) + (o.clear ?? 0.0018);
    if (r < rs) p = mad(C, dd, rs);
    else if (o.stick && r > rs + o.stick) p = mad(C, dd, rs + o.stick);
    dir = norm(add(dir, [o.side || 0, -(o.grav ?? 0.22), o.fwd || 0]));
    if (o.curl) dir = norm(mad(dir, cross(dd, dir), o.curl));
    pts.push(p.slice());
  }
  const c0 = hex(o.c0), c1 = hex(o.c1), r0 = o.r * H.hs;
  tube(g, pts.map(H.toB), { segs: o.segs || 4, rings: ringsOf(lin(0, 1, o.rings || 6)), n0: d0,
    rad: (t) => { const r = r0 * (1 - t) ** 0.8 * (t < 0.15 ? lerp(0.75, 1, t / 0.15) : 1) + 0.00025; return [r * (o.flat ?? 0.55), r]; },
    attr: (t, a, pp, n, j, i, Fr) => ({ c: mixv(c0, c1, t ** 0.8), w: o.w ? o.w(t) : [BI.head, 1], x: Fr.T }) });
}
// hair styles. Each builds the mass and its clumps; r = prng for jitter
const STYLES = {
  // tousled shag under a backwards cap: a side-swept fringe out of the strap gap, tufts over the ears and at the nape
  shag(g, H, c, r) {
    hairMass(g, H, { col: c, thick: (th, ph) => 0.007 + 0.004 * sstep(0.4, 1.2, ph), hl: HL });
    for (let i = 0; i < 10; i++) { const th = -0.55 + i * 0.12 + (r() - 0.5) * 0.04; clump(g, H, { th, ph: 0.9 + r() * 0.04, len: 0.05 + r() * 0.015 + Math.max(0, -th) * 0.02, r: 0.009 + r() * 0.003, dir: [-0.55, -1, 0.15], grav: 0.2, side: -0.04, hug: 1, stick: 0.0035, clear: 0.0015, steps: 7, c0: c[0], c1: c[1] }); }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) clump(g, H, { th: s * (1.25 + i * 0.16), ph: 0.5 - i * 0.07 + r() * 0.04, len: 0.045 + r() * 0.02, r: 0.008, dir: [s * 0.25, -1, -0.3], grav: 0.25, hug: 1, stick: 0.004, c0: c[0], c1: c[1] });
    for (let i = 0; i < 7; i++) clump(g, H, { th: PI + (i - 3) * 0.28 + (r() - 0.5) * 0.08, ph: -0.18 + r() * 0.06, len: 0.05 + r() * 0.025, r: 0.009, dir: [0, -1, -0.25], grav: 0.3, hug: 1, stick: 0.006, c0: c[0], c1: c[1] });
  },
  // a tall pink beehive with a side-swept bang and two curled tendrils
  beehive(g, H, c, r) {
    const vol = (x, y, z) => smin(smin(sdE(x, y, z, 0, 0.205, -0.02, 0.082, 0.106, 0.088), sdE(x, y, z, 0, 0.15, 0.005, 0.088, 0.07, 0.1), 0.03), sdE(x, y, z, 0.01, 0.168, 0.052, 0.062, 0.042, 0.045), 0.02);
    hairMass(g, H, { col: c, thick: () => 0.009, vol, k: 0.02, nv: 20 });
    for (let i = 0; i < 6; i++) { const ph = 0.55 + i * 0.13; clump(g, H, { th: -2.6 + i * 0.5, ph, len: 0.16, r: 0.012, dir: [1, 0.05, 0.35], grav: -0.02, hug: 1, curl: 0.12, steps: 8, c0: c[0], c1: c[1], clear: 0.0015 }); }
    clump(g, H, { th: 0.55, ph: 0.98, len: 0.12, r: 0.016, dir: [-1, -0.3, 0.35], grav: 0.05, hug: 0.95, steps: 7, c0: c[0], c1: c[1] });
    for (const s of [-1, 1]) clump(g, H, { th: s * 1.02, ph: 0.62, len: 0.085, r: 0.006, dir: [s * 0.1, -1, 0.25], grav: 0.12, curl: 0.55 * s, steps: 8, c0: c[0], c1: c[1], rings: 9 });
  },
  // slicked back, a little pompadour lift at the front, comb lines
  slick(g, H, c, r) {
    hairMass(g, H, { col: c, thick: (th, ph) => 0.006 + 0.009 * gs(th, 0.7) * sstep(0.7, 1.05, ph) + 0.0006 * Math.sin(th * 30) * sstep(0.6, 1.0, ph), hl: [[0, 0.88], [0.6, 0.84], [1.0, 0.68], [1.3, 0.3], [1.45, 0.25], [1.62, 0.45], [1.95, 0.22], [2.3, -0.26], [2.75, -0.5], [PI, -0.56]], flow: () => [0, -0.2, -1] });
    for (let i = 0; i < 7; i++) clump(g, H, { th: -0.6 + i * 0.2, ph: 0.92, len: 0.13, r: 0.01, dir: [0, 0.15, -1], grav: 0.12, hug: 1, flat: 0.4, steps: 7, c0: c[0], c1: c[1], clear: 0.0008 });
  },
  // mousy and messy, poking out under a forward cap
  messy(g, H, c, r) {
    hairMass(g, H, { col: c, thick: () => 0.009 });
    for (let i = 0; i < 6; i++) clump(g, H, { th: -0.45 + i * 0.18, ph: 0.82, len: 0.035 + r() * 0.015, r: 0.008, dir: [(r() - 0.5) * 0.6, -1, 0.7], grav: 0.25, c0: c[0], c1: c[1] });
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) clump(g, H, { th: s * (1.3 + i * 0.25), ph: 0.42 - i * 0.12, len: 0.035 + r() * 0.02, r: 0.008, dir: [s * (0.6 + r() * 0.4), -0.6, -0.3], grav: 0.15, hug: 0.4, c0: c[0], c1: c[1] });
    for (let i = 0; i < 5; i++) clump(g, H, { th: PI + (i - 2) * 0.3, ph: -0.15, len: 0.035, r: 0.009, dir: [(r() - 0.5), -1, -0.6], grav: 0.2, hug: 0.5, c0: c[0], c1: c[1] });
  },
  // close fade under a cap, and a goatee
  fade(g, H, c, r) {
    hairMass(g, H, { col: c, thick: (th, ph) => 0.0035 + 0.003 * sstep(0.5, 1.2, ph), soft: 0.09 });
    for (let i = 0; i < 6; i++) { const th = (i - 2.5) * 0.12; clump(g, H, { th, ph: -0.62 - Math.abs(th) * 0.3, len: 0.022, r: 0.006, dir: [th * 0.5, -1, 0.35], grav: 0.2, hug: 0.9, sink: 0.0015, c0: c[0], c1: c[1] }); }
    for (const s of [-1, 1]) clump(g, H, { th: s * 0.2, ph: -0.4, len: 0.028, r: 0.0045, dir: [s, -0.35, 0.2], grav: 0.25, hug: 0.95, sink: 0.0012, c0: c[0], c1: c[1] });
  },
  // a big cloud of curls past the ears
  bigcurl(g, H, c, r) {
    const blobs = [];
    for (let i = 0; i < 26; i++) { const th = (i / 26) * TAU, ph = 0.35 + 0.75 * Math.sin(i * 2.4) ** 2; const d = dirOf(th, ph * (Math.abs(Math.cos(th / 2)) > 0.88 ? 1 : 0.65)); blobs.push([d[0] * 0.13, 0.08 + d[1] * 0.12, -0.03 + d[2] * 0.12, 0.024 + 0.006 * Math.sin(i * 1.7)]); }
    const vol = (x, y, z) => {
      let d = smin(sdS(x, y, z, 0, 0.14, -0.02, 0.118), smin(sdE(x, y, z, 0, 0.04, -0.045, 0.135, 0.11, 0.105), sdE(Math.abs(x), y, z, 0.08, -0.01, -0.035, 0.06, 0.07, 0.07), 0.04), 0.04);
      for (const b of blobs) d = smin(d, sdS(x, y, z, b[0], b[1], b[2], b[3]), 0.012);
      return smax(d, -sdE(x, y, z, 0, 0.03, 0.12, 0.075, 0.1, 0.07), 0.03);
    };
    hairMass(g, H, { col: c, thick: () => 0.01, vol, k: 0.02, nv: 20, phiMin: -1.05,
      hl: [[0, 0.88], [0.6, 0.82], [0.95, 0.6], [1.2, 0.15], [1.5, -0.4], [2.0, -0.7], [PI, -0.75]] });
    for (let i = 0; i < 18; i++) { const th = (r() - 0.5) * 2 * 2.9, ph = 0.2 + r() * 1.1; if (Math.abs(th) < 0.7 && ph < 0.85) continue; clump(g, H, { th, ph, len: 0.04, r: 0.009, dir: [Math.sin(th), 0.4, Math.cos(th)], grav: 0.0, hug: 0.2, curl: 0.9, steps: 7, c0: c[0], c1: c[1], rings: 8 }); }
  },
  // neat side part with a combed wave
  sidepart(g, H, c, r) {
    hairMass(g, H, { col: c, thick: (th, ph) => 0.007 + 0.006 * gs(th - 0.2, 0.5) * sstep(0.75, 1.0, ph) - 0.003 * gs(th + 0.35, 0.05) * sstep(0.8, 1.2, ph), flow: (p) => [p[0] > -0.02 ? 0.6 : -0.6, -0.3, -0.7] });
    for (let i = 0; i < 5; i++) clump(g, H, { th: -0.3 + i * 0.16, ph: 0.95, len: 0.1, r: 0.011, dir: [0.9, 0.1, -0.4], grav: 0.1, hug: 1, flat: 0.4, steps: 6, c0: c[0], c1: c[1], clear: 0.001 });
    for (let i = 0; i < 3; i++) clump(g, H, { th: -0.55 - i * 0.18, ph: 0.95, len: 0.08, r: 0.01, dir: [-0.9, 0.05, -0.4], grav: 0.1, hug: 1, flat: 0.4, c0: c[0], c1: c[1], clear: 0.001 });
  },
  // short and spiky on top, long at the back
  mullet(g, H, c, r) {
    const vol = (x, y, z) => smin(sdE(x, y, z, 0, -0.005, -0.075, 0.062, 0.075, 0.036), sdE(x, y, z, 0, 0.06, -0.08, 0.07, 0.05, 0.05), 0.03);
    hairMass(g, H, { col: c, thick: (th, ph) => 0.006 + 0.007 * sstep(0.7, 1.2, ph), vol, k: 0.02, phiMin: -1.25,
      hl: [[0, 0.88], [0.6, 0.85], [1.0, 0.7], [1.45, 0.5], [1.7, 0.45], [2.0, 0.1], [2.4, -0.8], [PI, -1.1]],
      w: (p) => { const k = sstep(0.0, -0.07, p[1]); return [BI.head, 1 - k, BI.hair, k]; } });
    for (let i = 0; i < 8; i++) clump(g, H, { th: (i - 3.5) * 0.24, ph: 1.0 + r() * 0.2, len: 0.04, r: 0.011, dir: [(i - 3.5) * 0.1, 0.9, -0.5], grav: -0.05, hug: 0.4, c0: c[0], c1: c[1] });
    for (let i = 0; i < 7; i++) clump(g, H, { th: PI + (i - 3) * 0.22, ph: -0.75, len: 0.07, r: 0.011, dir: [(i - 3) * 0.1, -1, -0.3], grav: 0.3, hug: 0.6, c0: c[0], c1: c[1], w: (t) => [BI.hair, 1] });
  },
  // a chunky teal bob with a heavy fringe
  bob(g, H, c, r) {
    const vol = (x, y, z) => smax(smin(sdE(x, y, z, 0, 0.1, -0.02, 0.098, 0.115, 0.112), sdE(x, y, z, 0, 0.02, -0.03, 0.094, 0.07, 0.095), 0.04), -sdE(x, y, z, 0, 0.04, 0.115, 0.07, 0.095, 0.07), 0.025);
    hairMass(g, H, { col: c, thick: () => 0.01, vol, k: 0.02, phiMin: -0.95, hl: [[0, 0.82], [0.6, 0.8], [0.95, 0.55], [1.2, 0.0], [1.6, -0.55], [PI, -0.65]] });
    for (let i = 0; i < 8; i++) clump(g, H, { th: -0.6 + i * 0.17, ph: 0.9, len: 0.05, r: 0.011, dir: [0, -1, 0.5], grav: 0.3, hug: 0.8, c0: c[0], c1: c[1] });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) clump(g, H, { th: s * (1.0 + i * 0.25), ph: 0.1 - i * 0.1, len: 0.05, r: 0.012, dir: [s * 0.2, -1, -0.1], grav: 0.3, hug: 0.8, c0: c[0], c1: c[1] });
  },
};

// ---------------------------------------------------------------------------------------------- garments
// The wardrobe: garment builders that add to the cloth geometry and record which skin shows.
function makeWardrobe(P, H, gC, gS, look) {
  const k = P.k, A = armShape(P), L = legShape(P), W = { cover: { torso: null, arm: null, leg: null }, skirtCfg: null, A, L };
  const colr = (o, key = 'col', roleKey = 'role') => (o[roleKey] !== undefined ? { c: hex(look[o[roleKey]]), role: RI[o[roleKey]] } : { c: hex(o[key] || '#ffffff'), role: -1 });
  const mat = (o) => ({ rough: o.rough ?? 0.78, metal: o.metal ?? 0, spark: o.spark ?? 0 });
  // a shell over the torso between heights u0 and u1 (fractions of the figure height)
  W.top = (o) => {
    const base = colr(o), s0 = sOfU(o.u0), s1 = sOfU(o.u1 ?? 0.846), off = o.off ?? 0.012, rows = [];
    if (o.hem !== false) rows.push({ s: s0, off: off - 0.008, dy: 0.007 }, { s: s0, off: off - 0.002, dy: -0.002 });
    const ss = lin(s0, s1, o.rows || 13), crisp = [...(o.crisp || [])];
    if (o.hem && o.hem.h) crisp.push(o.u0 + o.hem.h);
    if (o.stripe) crisp.push(o.stripe.u - o.stripe.h / 2, o.stripe.u + o.stripe.h / 2, ...(o.stripe.line ? [o.stripe.u - o.stripe.h / 2 - 0.009] : []));
    for (const cu of crisp) { const cs = sOfU(cu); if (cs > s0 + 2e-3 && cs < s1 - 2e-3) ss.push(cs - 1e-5, cs + 1e-5); }
    ss.sort((a, b) => a - b).forEach((s) => rows.push({ s, off }));
    if (o.topEdge) rows.push({ s: s1, off: off - 0.004, dy: 0.003 }, { s: s1, off: off - 0.009, dy: 0 });
    const hemC = o.hem && (o.hem.role || o.hem.col) ? colr(o.hem) : null, stripe = o.stripe ? colr(o.stripe) : null, line = o.stripe && o.stripe.line ? { c: hex(look[o.stripe.line]), role: RI[o.stripe.line] } : null;
    const uHem = o.u0 + (o.hem && o.hem.h ? o.hem.h : 0);
    torsoShell(gC, P, { rows, segs: o.segs || 24, arc: o.arc, extra: (th, s, p) => {
      const u = torsoSecU(s), sh = o.pad ? o.pad * sstep(0.12, 0.17, Math.abs(p[0]) / k) * sstep(0.76, 0.81, u) : 0;
      const rib = o.hem && o.hem.rib && u < uHem ? 0.0012 * Math.sin(th * 26) - 0.002 : 0;
      return sh + rib + (o.puff || 0) * sstep(o.u0, o.u0 + 0.06, u) * (1 - sstep(0.8, 0.84, u)) + (o.belly ? 0 : 0);
    }, paint: (th, s, p) => {
      const u = torsoSecU(s);
      let c = base;
      if (hemC && u < uHem) c = hemC;
      if (stripe && Math.abs(u - o.stripe.u) < o.stripe.h / 2) c = stripe;
      if (line && u < o.stripe.u - o.stripe.h / 2 && u > o.stripe.u - o.stripe.h / 2 - 0.009) c = line;
      if (o.vee && Math.cos(th) > 0 && u > o.vee.u && Math.abs(p[0]) < ((u - o.vee.u) / (0.846 - o.vee.u)) * o.vee.w * k) c = colr(o.vee);
      if (o.paint) c = o.paint(th, u, p, c) || c;
      return { ...mat(o), c: c.c, role: c.role, shade: c.shade ?? (o.hem && o.hem.rib && u < uHem ? 0.94 + 0.06 * Math.sin(th * 26) : 1) };
    } });
  };
  W.sleeves = (o) => {
    const base = colr(o), cuff = o.cuff ? colr(o.cuff) : null, t1 = o.t1 ?? 1, off = o.off ?? 0.014, g1 = new Geo();
    const dCuff = o.cuff ? o.cuff.h * k / A.L : 0;
    const rings = limbTs(0, t1, o.n || 11, [A.tE]).map((t) => ({ t }));
    rings.push({ t: t1, dr: -0.004 * k }, { t: Math.max(0, t1 - 0.025), dr: -0.008 * k });
    tube(g1, null, { curve: A.cv, segs: 10, rings, n0: [0, 0, 1], rad: (t, a) => {
      const r = A.rad(t, a, off * k + (o.puff || 0) * k * Math.sin(PI * clamp(t / t1, 0, 1)) ** 0.7 + (o.roll ? 0.006 * k * sstep(t1 - 0.06, t1, t) : 0));
      const rib = cuff && o.cuff.rib && t > t1 - dCuff ? 0.0011 * Math.sin(a * 11) - 0.0015 : 0;
      return [r[0] + rib, r[1] + rib];
    }, attr: (t, a, p) => {
      let c = cuff && t > t1 - dCuff ? cuff : base;
      if (o.stripe && Math.abs(Math.cos(a)) < 0.25 && Math.sin(a) < 0) c = colr(o.stripe);
      return { ...mat(o), c: c.c, role: c.role, w: A.w(t), shade: cuff && o.cuff.rib && t > t1 - dCuff ? 0.94 + 0.06 * Math.sin(a * 11) : 1 };
    } });
    meshNormals(g1, 0, 0);
    gC.add(g1).add(g1, true);
  };
  // trousers / shorts: a pelvis shell up to the waistband and two leg shells down to t1
  W.pants = (o) => {
    const base = colr(o), legC = o.legRole ? colr(o, 'col', 'legRole') : base, shinC = o.shinRole ? colr(o, 'col', 'shinRole') : legC, off = o.off ?? 0.012;
    W.top({ ...o, u0: 0.462, u1: o.u1 ?? 0.585, off, hem: false, topEdge: true, rows: o.low ? 4 : 8, segs: o.low ? 16 : 24, paint: (th, u, p, c) => (o.paint ? o.paint(th, u, p, c) : c) });
    const g1 = new Geo(), t1 = o.t1 ?? 0.4;
    const rings = limbTs(0, t1, o.n || Math.max(5, Math.round(t1 * 13)), [L.tK]).map((t) => ({ t }));
    if (o.hem !== false) rings.push({ t: t1, dr: -0.004 * k }, { t: Math.max(0, t1 - 0.02), dr: -0.008 * k });
    tube(g1, null, { curve: L.cv, segs: o.low ? 10 : 12, rings, n0: [0, 0, 1], rad: (t, a) => L.rad(t, a, off * k + (o.flare || 0) * k * sstep(L.tK - 0.1, t1, t) + (o.baggy || 0) * k * Math.sin(PI * clamp(t / t1, 0, 1))),
      attr: (t, a, p) => { let c = t < L.tK ? legC : shinC; if (o.legPaint) c = o.legPaint(t, a, c) || c; return { ...mat(o), c: c.c, role: c.role, w: L.w(t) }; } });
    meshNormals(g1, 0, 0);
    gC.add(g1).add(g1, true);
  };
  W.skinTorso = (u0) => { W.cover.torso = u0; };
  W.skinArms = (t0) => { W.cover.arm = t0; };
  W.skinLegs = (t0, t1) => { W.cover.leg = [t0, t1]; };
  W.skirt = (o) => { W.skirtCfg = o; };
  // a ribbon lying on the torso surface along a path of [theta, u] points
  W.strip = (path, width, o) => {
    const c = colr(o), n = o.n || 14, pts = [[], [], []], cv = spline(path.map(([th, u]) => [th, u, 0]));
    const sp = (t) => { const q = cv.at(t), s = sOfU(q[1]); return mad(torsoPt(P, s, q[0]), torsoN(P, s, q[0]), (o.off ?? 0.02) * k); };
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), p = sp(t), q = cv.at(t), nn = torsoN(P, sOfU(q[1]), q[0]), tg = norm(sub(sp(Math.min(1, t + 0.01)), sp(Math.max(0, t - 0.01)))), sd = norm(cross(nn, tg));
      const w = (typeof width === 'function' ? width(t) : width) * k;
      pts[0].push(add(p, add(mul(sd, w / 2), mul(nn, -0.002 * k)))); pts[1].push(add(p, mul(nn, (o.raise ?? 0.0025) * k))); pts[2].push(add(p, add(mul(sd, -w / 2), mul(nn, -0.002 * k))));
    }
    sheet(gC, pts, (j, i, p) => ({ ...mat(o), c: c.c, role: c.role, w: wTorso(P, p), shade: j === 1 ? 1.04 : 0.94 }), (p) => [p[0], 0, p[2] + 0.02]);
  };
  W.zip = (o) => { W.strip([[0, o.u0 + 0.002], [0, 0.846]], 0.011, { ...o, off: (o.off ?? 0.017) + 0.0015, raise: 0.002, rough: 0.35, metal: 0.4 }); W.button([0, 0.836], 0.007, { ...o, off: (o.off ?? 0.017) + 0.004, rough: 0.3, metal: 0.5 }); };
  // a small rounded lump on the torso: buttons, badges, pocket flaps
  W.button = (at, size, o) => {
    const s = sOfU(at[1]), p = torsoPt(P, s, at[0]), n = torsoN(P, s, at[0]), c = colr(o);
    const ez = n, ex = norm(cross([0, 1, 0], ez)), ey = cross(ez, ex), h = o.h || [size, size, size * 0.45];
    rbox(gC, mad(p, n, (o.off ?? 0.02) * k), h.map((v) => v * k), (q) => ({ ...mat(o), c: c.c, role: c.role, w: wTorso(P, p) }), { ex, ey, ez, segs: o.segs || 8, rows: 5, e: o.e ?? 0.6 });
  };
  W.pockets = (o) => { for (const s of [-1, 1]) W.strip([[s * 0.62, 0.585], [s * 0.86, 0.6]], 0.022, { ...o, off: 0.019, n: 4 }); };
  // a stand-up collar (band), a polo / shirt collar (band + flared fall), or a wide flat collar
  W.collar = (o) => {
    const c = colr(o), g1 = new Geo(), h = (o.h ?? 0.032) * k, t0 = 0.12, cv = P.neck;
    const tAt = (dy) => { let a = 0, b = 1; const y0 = cv.at(t0)[1]; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (cv.at(m)[1] - y0 < dy) a = m; else b = m; } return (a + b) / 2; };
    const t1 = tAt(h), ts = lin(t0, t1, 4);
    const rings = ts.map((t) => ({ t }));
    rings.push({ t: t1, dr: -0.004 * k }, { t: lerp(t0, t1, 0.75), dr: -0.008 * k });
    const fall = o.kind === 'polo' || o.kind === 'shirt' ? 0.012 * k : 0;
    tube(g1, null, { curve: cv, segs: 18, rings, n0: [0, 0, 1], rad: (t, a) => {
      const r = P.neckR(t), base = (o.kind === 'wide' ? 0.018 : 0.012) * k + (t - t0) / (t1 - t0) * (o.kind === 'band' ? 0.003 : 0.008) * k, rib = o.rib ? 0.0011 * Math.sin(a * 16) : 0;
      return [r[0] + base + rib + fall * 0, r[1] + base + rib];
    }, attr: (t, a) => ({ ...mat(o), c: c.c, role: c.role, w: [BI.torso, 1], shade: o.rib ? 0.94 + 0.06 * Math.sin(a * 16) : 1 }) });
    meshNormals(g1, 0, 0);
    gC.add(g1);
    if (o.kind === 'polo' || o.kind === 'shirt' || o.kind === 'wide') {
      // the fall: a flared band lying on the shoulders, with points at the front
      const wide = o.kind === 'wide' ? 1.9 : 1;
      W.top({ ...o, u0: 0.826 - 0.012 * wide, u1: 0.8455, off: (o.off ?? 0.012) + 0.008, hem: false, rows: 3, segs: 24, rough: o.rough ?? 0.7,
        extra: undefined, arc: [0.12, TAU - 0.12] });
    }
  };
  // straps over the shoulders (dresses, overalls)
  W.straps = (o) => { for (const s of [-1, 1]) W.strip([[s * 0.42, o.u0 ?? 0.738], [s * 0.78, 0.8], [s * 1.25, 0.84], [s * 1.95, 0.83], [s * 2.55, o.uB ?? 0.74]], o.w ?? 0.016, { ...o, off: o.off ?? 0.008, n: 16 }); };
  W.belt = (o) => W.top({ ...o, u0: o.u ?? 0.578, u1: (o.u ?? 0.578) + 0.016, off: o.off ?? 0.016, hem: false, rows: 3, topEdge: false, rough: 0.5 });
  W.apron = (o) => {
    const c = colr(o), g1 = new Geo(), sW = sOfU(0.6);
    const rows = lin(0, 1, 7).map((v) => lin(-1, 1, 9).map((s) => {
      const top = torsoPt(P, sW, s * 0.9), n = torsoN(P, sW, s * 0.9), y = lerp(top[1], P.kneeY + 0.06, v), lx = top[0] * lerp(1, 1.12, v);
      const front = Math.max(top[2] + n[2] * 0.02, lerp(top[2], 0.105 * k, sstep(0, 0.4, v)) + 0.012 * k) + 0.012 * k * (1 - s * s) * v;
      return [lx, y, front];
    }));
    sheet(gC, rows, (j, i, p) => {
      const lr = sstep(-0.03, 0.03, p[0]), wl = sstep(P.hipY + 0.05, P.hipY - 0.1, p[1]) * 0.85;
      return { ...mat(o), c: j === 6 || i === 0 || i === 8 ? hex(o.trim || o.col) : c.c, role: -1, w: [BI.body, 1 - wl, BI.legL, wl * lr, BI.legR, wl * (1 - lr)] };
    }, (p) => [0, 0, 1]);
    W.belt({ col: o.trim || o.col, u: 0.598, off: 0.022 });
  };
  W.tie = (o) => { W.strip([[0, 0.835], [0, 0.78], [0, 0.71], [0, o.u0 ?? 0.672]], (t) => lerp(0.02, 0.045, sstep(0, 0.9, t)) * (t > 0.94 ? (1 - t) / 0.06 : 1) + 0.002, { ...o, off: 0.02, n: 12, rough: 0.4 }); W.button([0, 0.836], 0.012, { ...o, off: 0.024, h: [0.012, 0.01, 0.007] }); };
  W.bowtie = (o) => { W.button([0, 0.833], 0.012, { ...o, off: 0.03, h: [0.03, 0.014, 0.008], e: 0.45 }); W.button([0, 0.833], 0.008, { ...o, off: 0.036, h: [0.008, 0.009, 0.006] }); };
  W.lapels = (o) => { for (const s of [-1, 1]) W.strip([[s * 0.2, 0.84], [s * 0.36, 0.79], [s * 0.3, 0.72], [s * 0.1, 0.65]], (t) => lerp(0.055, 0.016, t), { ...o, off: (o.off ?? 0.02) + 0.003, n: 10 }); };
  W.bag = (o) => {
    const bc = colr(o), fc = o.flap ? colr({ role: o.flap }) : bc, sx = -(0.2 * k * P.b.hips + 0.035 * k), cy = P.Y(0.545), cz = -0.02 * k;
    rbox(gC, [sx, cy, cz], [0.034 * k, 0.1 * k, 0.135 * k], () => ({ c: bc.c, role: bc.role, w: [BI.bag, 1], rough: 0.7 }), { segs: 10, rows: 6, e: 0.32 });
    rbox(gC, [sx - 0.006 * k, cy + 0.045 * k, cz], [0.033 * k, 0.062 * k, 0.138 * k], () => ({ c: fc.c, role: fc.role, w: [BI.bag, 1], rough: 0.7 }), { segs: 10, rows: 5, e: 0.28 });
    rbox(gC, [sx - 0.041 * k, cy + 0.005 * k, cz], [0.004 * k, 0.012 * k, 0.022 * k], () => ({ c: hex('#c9c0d8'), w: [BI.bag, 1], rough: 0.3, metal: 0.6 }), { segs: 8, rows: 4, e: 0.5 });
    const strap = { col: o.strap || '#1b1830', off: (o.off ?? 0.017) + 0.006, n: 18, rough: 0.6 };
    W.strip([[1.25, 0.836], [0.9, 0.78], [0, 0.69], [-0.9, 0.6], [-1.28, 0.585]], 0.034, strap);
    W.strip([[1.95, 0.83], [2.4, 0.76], [PI, 0.69], [-2.3, 0.62], [-1.9, 0.585]], 0.034, strap);
    W.strip([[1.25, 0.836], [1.6, 0.845], [1.95, 0.83]], 0.034, { ...strap, n: 6 });
  };
  W.shoes = (o) => { const g1 = new Geo(); buildShoe(g1, P, L, o, look); gC.add(g1).add(g1, true); };
  W.skates = (o) => W.shoes({ ...o, type: 'skate' });
  W.cap = (o) => { buildCap(gC, H, o, look); };
  W.acc = (fn) => fn(gC, H, P, look);
  return W;
}
function torsoShell(g, P, o) {
  const k = P.k, rows = o.rows, nu = o.segs || 30, us = o.arc ? lin(o.arc[0], o.arc[1], nu).map((a) => a / TAU) : around(nu);
  const pos = (u, v) => {
    const f = clamp(v, 0, rows.length - 1), i = Math.min(rows.length - 2, Math.floor(f)), t = f - i, A = rows[i], B = rows[i + 1];
    const s = lerp(A.s, B.s, t), th = u * TAU, p = torsoPt(P, s, th), n = torsoN(P, s, th), off = (lerp(A.off, B.off, t) + (o.extra ? o.extra(th, s, p) : 0)) * k;
    return [p[0] + n[0] * off, p[1] + n[1] * off + lerp(A.dy || 0, B.dy || 0, t) * k, p[2] + n[2] * off];
  };
  const base = g.n, i0 = g.I.length;
  surf(g, us, rows.map((_, i) => i), !o.arc, pos, (u, v) => {
    const s = rows[v].s, th = u * TAU, bp = torsoPt(P, s, th), a = o.paint(th, s, bp);
    a.w = a.w || wTorso(P, bp);
    return a;
  }, { normal: () => [0, 1, 0] });
  meshNormals(g, base, i0);
}
// shoes and skates (left foot, mirrored by the caller)
const SHOES = {
  skate: { cuff: 0.215, cuffR: 0.05, toe: 0.163, heel: -0.066, w: 1.0, toeH: 0.034, rise: 0, sole: 0.012, laces: 6 },
  sneaker: { cuff: 0.085, cuffR: 0.047, toe: 0.17, heel: -0.064, w: 1.0, toeH: 0.033, rise: 0, sole: 0.018, laces: 4 },
  hightop: { cuff: 0.15, cuffR: 0.049, toe: 0.17, heel: -0.064, w: 1.03, toeH: 0.034, rise: 0, sole: 0.018, laces: 5 },
  boot: { cuff: 0.12, cuffR: 0.047, toe: 0.168, heel: -0.064, w: 1.0, toeH: 0.032, rise: 0, sole: 0.016, laces: 0 },
  heel: { cuff: 0.1, cuffR: 0.042, toe: 0.17, heel: -0.058, w: 0.88, toeH: 0.026, rise: 0.05, sole: 0.006, laces: 0 },
  loafer: { cuff: 0.06, cuffR: 0.044, toe: 0.178, heel: -0.064, w: 0.95, toeH: 0.028, rise: 0, sole: 0.01, laces: 0 },
};
function shoeSDF(S, Y) {
  return (x, y, z) => {
    const sy = Y + S.rise * sstep(S.toe - 0.08, S.heel + 0.06, z);
    let d = sdC(x, y, z, 0, sy + 0.033, S.heel + 0.034, 0, Y + 0.03, S.toe - 0.05, 0.035 * S.w, 0.04 * S.w);
    d = smin(d, sdE(x, y, z, 0, Y + 0.025, S.toe - 0.045, 0.043 * S.w, S.toeH, 0.05), 0.022);
    d = smin(d, sdC(x, y, z, 0, sy + 0.035, -0.008, 0, Y + S.cuff, -0.004, S.cuffR, S.cuffR * 0.96), 0.03);
    d = smax(d, sy - y, 0.005);
    if (S.rise) d = Math.min(d, sdB(x, y, z, 0, Y + S.rise * 0.5, S.heel + 0.024, 0.013, S.rise * 0.5, 0.015, 0.004));
    return d;
  };
}
function buildShoe(g, P, L, o, look) {
  const S = SHOES[o.type], k = P.k, Aj = P.A, soleY = o.type === 'skate' ? P.lift : 0, Y = (soleY - Aj[1]) / k, f = shoeSDF(S, Y);
  const toB = (p) => [Aj[0] + p[0] * k, Aj[1] + p[1] * k, Aj[2] + p[2] * k];
  const c = [0, Y + 0.05, (S.heel + S.toe) * 0.4];
  const roleC = (key) => (o[key] && RI[o[key]] !== undefined ? { c: hex(look[o[key]]), role: RI[o[key]] } : o[key] ? { c: hex(o[key]), role: -1 } : null);
  const up = roleC('role') || roleC('col') || { c: hex('#f4f2ee'), role: -1 }, stripe = roleC('stripe'), soleC = hex(o.sole || (o.type === 'skate' ? '#e8e4ee' : '#f4f2ee')), cuffC = roleC('cuffCol');
  const wOf = (p) => { const s = sstep(Y + S.cuff - 0.07, Y + S.cuff, p[1]) * 0.6; return [BI.footL, 1 - s, BI.shinL, s]; };
  starMesh(g, c, around(16).map((u) => u * TAU - PI), lin(-1.4, 1.42, 11), (th, ph) => march(f, c, dirOf(th, ph), 0.4) ?? 0.03, (th, ph, p) => {
    const sy = Y + S.rise * sstep(S.toe - 0.08, S.heel + 0.06, p[2]);
    let cc = up, shade = 1;
    if (p[1] < sy + S.sole) cc = { c: soleC, role: -1 };
    else if (stripe && Math.abs(p[0]) > 0.02 && Math.abs(p[1] - (Y + (o.type === 'skate' ? 0.13 : 0.045))) < 0.011) cc = stripe;
    else if (cuffC && p[1] > Y + S.cuff - 0.022) cc = cuffC;
    if (p[2] > S.toe - 0.045 && p[1] < Y + 0.04) shade = 0.93;
    return { c: tone(cc.c, shade), role: cc.role, shade, w: wOf(p), rough: o.rough ?? 0.6 };
  }, { f, wrap: true, top: true, bottom: true, out: toB });
  // laces criss-crossing the tongue
  if (S.laces) {
    const onShoe = (q) => { const d = norm(sub(q, c)), r = march(f, c, d, 0.4) ?? 0.05; return mad(c, d, r + 0.0022); };
    const lc = hex(o.lace || '#1b1830');
    for (let i = 0; i < S.laces - 1; i++) {
      const f0 = i / (S.laces - 1), f1 = (i + 1) / (S.laces - 1);
      const P0 = (fr, s) => onShoe([s * 0.014, Y + lerp(0.062, S.cuff - 0.03, fr), lerp(0.09, 0.03, fr) + 0.05]);
      for (const s of [-1, 1]) {
        const a = P0(f0, s), b = P0(f1, -s), dl = norm(sub(b, a)), sd = mul(norm(cross(dl, [0, 0, 1])), 0.0028);
        sheet(g, [[toB(sub(a, sd)), toB(sub(b, sd))], [toB(add(a, sd)), toB(add(b, sd))]], () => ({ c: lc, w: [BI.footL, 1], rough: 0.8 }), () => [0, 0.3, 1]);
      }
    }
  }
  if (o.type === 'skate') {
    const metal = { c: hex('#c9c0d8'), role: -1, w: [BI.footL, 1], rough: 0.3, metal: 0.7 };
    rbox(g, toB([0, Y - 0.006, (S.heel + S.toe) / 2]), [0.024 * k, 0.006 * k, ((S.toe - S.heel) / 2 - 0.012) * k], () => metal, { segs: 6, rows: 3, e: 0.3 });
    const wheel = roleC('wheel') || { c: hex(MAG), role: -1 };
    for (const z of [S.heel + 0.035, S.toe - 0.04]) {
      rbox(g, toB([0, Y - 0.019, z]), [0.04 * k, 0.008 * k, 0.012 * k], () => metal, { segs: 6, rows: 3, e: 0.4 });
      for (const x of [-0.045, 0.045]) lathe(g, toB([x, Y - 0.044, z]), [1, 0, 0], [[0.008, -0.0125], [0.026, -0.0125], [0.031, 0], [0.026, 0.0125], [0.008, 0.0125]].map(([r, h]) => [r * k, h * k]), 8,
        (j) => (j === 0 || j === 4 ? metal : { c: wheel.c, role: wheel.role, w: [BI.footL, 1], rough: 0.45 }));
    }
    lathe(g, toB([0, Y - 0.012, S.toe + 0.004]), [0, -0.5, 0.86], [[0.004, -0.012], [0.015, -0.012], [0.016, 0.006], [0.012, 0.014], [0.003, 0.015]].map(([r, h]) => [r * k, h * k]), 6, () => ({ c: hex('#2a2440'), w: [BI.footL, 1], rough: 0.7 }));
  }
}
// caps: a crown (head + hair offset above the band line) with seams and a band, a curved brim and a button
function buildCap(g, H, o, look) {
  const C = H.C, nu = 28, us = around(nu).map((u) => u * TAU - PI), vs = lin(-0.25, 1.47, 12);
  const rc = (key, def) => (o[key] && RI[o[key]] !== undefined ? { c: hex(look[o[key]]), role: RI[o[key]] } : { c: hex(o[key] || def), role: -1 });
  const crown = rc('crown', '#ffffff'), band = rc('band', o.crown || '#ffffff'), brimC = rc('brim', o.crown || '#ffffff');
  const yF = o.back ? 0.142 : 0.128, yB = o.back ? 0.098 : 0.094, bandY = (z) => lerp(yB, yF, sstep(-0.09, 0.09, z));
  const info = [];
  const capR = (th, ph) => {
    const d = dirOf(th, ph), rh = H.rHead(th, ph), ps = mad(C, d, rh), over = ps[1] - bandY(ps[2]), m = sstep(-0.003, 0.004, over);
    const base = Math.max(rh + 0.016, (H.massR ? H.massR(th, ph) : rh) + 0.0045) + 0.006 * sstep(0.03, 0.09, over);
    return { r: lerp(rh + 0.0015, base, m), m, over };
  };
  H.capR = (th, ph) => capR(th, ph).r;
  starMesh(g, C, us, vs, (th, ph, i, j) => { const q = capR(th, ph); if (i >= 0) info[j * nu + i] = q; return q.r; }, (th, ph, p, n, i, j) => {
    const q = i >= 0 ? info[j * nu + i] : { over: 1 };
    let c = q.over < 0.016 ? band : crown, shade = 1;
    const seam = Math.min(...[0, 1, 2, 3, 4, 5].map((s) => Math.abs(Math.atan2(Math.sin(th - (s * PI) / 3 - PI / 6), Math.cos(th - (s * PI) / 3 - PI / 6)))));
    if (q.over >= 0.016 && seam < 0.03) shade = 0.82;
    if (o.logo && Math.abs(th) < 0.32 && q.over > 0.024 && q.over < 0.06) c = { c: hex(o.logo), role: -1 };
    return { c: tone(c.c, shade), role: c.role, shade, w: [BI.head, 1], rough: 0.75 };
  }, { wrap: true, top: true, out: H.toB, keep: (i, j) => Math.max(info[j * nu + i].m, info[j * nu + (i + 1) % nu].m, info[(j + 1) * nu + i].m, info[(j + 1) * nu + (i + 1) % nu].m) > 0.02 });
  // brim
  const cen = o.back ? PI : 0, rootAt = (th) => {
    let lo = -0.4, hi = 1.3;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, ps = mad(C, dirOf(th, m), H.rHead(th, m)); if (ps[1] - bandY(ps[2]) > 0) hi = m; else lo = m; }
    return mad(C, dirOf(th, hi), H.rHead(th, hi) + 0.004);
  };
  const ss = lin(-1, 1, 9), ts = lin(0, 1, 4), tilt = o.back ? 0.08 : 0.2, len = o.brimLen ?? 0.072;
  const surfPt = (s, t, side) => {
    const th = cen + s * 1.05, root = rootAt(th), out = [Math.sin(th) * Math.cos(tilt), -Math.sin(tilt), Math.cos(th) * Math.cos(tilt)];
    const Lb = len * Math.max(0, 1 - s * s) ** 0.45 + 0.004, p = add(mad(root, out, Lb * t), [0, -0.014 * s * s * t, 0]);
    return H.toB(add(p, [0, side * 0.0028 * (1 - t * t * 0.85), 0]));
  };
  for (const side of [1, -1]) sheet(g, ts.map((t) => ss.map((s) => surfPt(s, t, side))), () => ({ c: side > 0 ? brimC.c : tone(brimC.c, 0.8), role: side > 0 ? brimC.role : -1, shade: side > 0 ? 1 : 0.8, w: [BI.head, 1], rough: 0.7 }), () => [0, side, 0]);
  // button on top
  const top = mad(C, [0, 1, 0], capR(0, PI / 2).r);
  rbox(g, H.toB(top), [0.009 * H.hs, 0.004 * H.hs, 0.009 * H.hs], () => ({ c: band.c, role: band.role, w: [BI.head, 1], rough: 0.6 }), { segs: 8, rows: 4, e: 0.6 });
}

// ---------------------------------------------------------------------------------------------- hands, body skin
// the left hand at the wrist: palm faces the thigh (-x), thumb forward, fingers relaxed and curled a little
function buildHand(g, P, skinC) {
  const k = P.k * P.b.hands, W0 = P.W, hp = (q) => [W0[0] + q[0] * k, W0[1] + q[1] * k, W0[2] + q[2] * k];
  const nailC = mixv(skinC, hex('#f6dcd6'), 0.5), palmC = mixv(skinC, hex('#f0b8a8'), 0.12);
  const SEC = [[0.012, 0.019, 0.0125, 0, 0], [-0.01, 0.025, 0.0145, 0.002, 0.001], [-0.035, 0.033, 0.0145, 0.004, 0], [-0.062, 0.038, 0.0128, 0.002, -0.001], [-0.082, 0.037, 0.0115, 0, -0.001], [-0.092, 0.03, 0.0095, -0.001, -0.001], [-0.097, 0.015, 0.006, -0.001, -0.001]];
  const K = [0, 1, 2, 3, 4].map((c) => SEC.map((s, i) => [i, s[c]])), sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;
  surf(g, around(8), lin(0, SEC.length - 1, 6), true, (u, v) => {
    const a = u * TAU;
    return hp([skeys(K[4], v) + skeys(K[2], v) * sp(Math.sin(a), 0.8), skeys(K[0], v), skeys(K[3], v) + skeys(K[1], v) * sp(Math.cos(a), 0.8)]);
  }, (u, v) => ({ c: Math.sin(u * TAU) < -0.3 ? palmC : skinC, w: v < 1 ? [BI.handL, 0.7 + 0.3 * v, BI.foreL, 0.3 * (1 - v)] : [BI.handL, 1] }), { flip: true });
  const FING = [[0.0245, 0.93, 0.8, 0.07, 0.97], [0.008, 1.0, 1.0, 0.01, 1.03], [-0.0085, 0.95, 1.08, -0.04, 0.97], [-0.0235, 0.76, 1.2, -0.1, 0.84]];
  const ts = ringsOf([0, 0.3, 0.62, 0.86, 0.96, 1]);
  for (const [z, ls, cs, spr, rs] of FING) {
    let p = [0, -0.086, z], ang = 0;
    const pts = [[0, -0.074, z], p.slice()];
    for (const [l, c] of [[0.045, 0.18], [0.027, 0.42], [0.021, 0.26]]) { ang += c * cs; p = mad(p, norm([-Math.sin(ang), -Math.cos(ang), spr * 0.35]), l * ls); pts.push(p.slice()); }
    tube(g, pts.map(hp), { segs: 4, rings: ts, n0: [-1, 0, 0], rad: (t) => { const r = lerp(0.0089, 0.0069, t) * rs * k, tip = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1; return [r * tip, r * 1.06 * tip]; },
      attr: (t, a) => ({ c: t > 0.78 && Math.cos(a) < -0.4 ? nailC : skinC, w: [BI.handL, 1] }) });
  }
  let p = [-0.004, -0.02, 0.026];
  const tp = [[-0.002, -0.006, 0.014], p.slice()];
  for (const [d, l] of [[[-0.22, -0.62, 0.75], 0.036], [[-0.38, -0.78, 0.5], 0.03], [[-0.5, -0.84, 0.22], 0.024]]) { p = mad(p, norm(d), l); tp.push(p.slice()); }
  tube(g, tp.map(hp), { segs: 4, rings: ts, n0: [-1, 0, 0], rad: (t) => { const r = lerp(0.0118, 0.0078, t) * k, tip = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1; return [r * tip, r * 1.08 * tip]; },
    attr: (t, a) => ({ c: t > 0.8 && Math.cos(a) < -0.4 ? nailC : skinC, w: [BI.handL, 1] }) });
}
function buildBodySkin(g, P, H, W) {
  const skinC = hex(H.spec.skin), A = W.A, L = W.L;
  if (W.cover.torso !== null) torsoShell(g, P, { rows: lin(sOfU(W.cover.torso), sOfU(0.846), 7).map((s) => ({ s, off: 0 })), segs: 24, paint: () => ({ c: skinC }) });
  if (W.cover.arm !== null) {
    const g1 = new Geo();
    tube(g1, null, { curve: A.cv, segs: 10, rings: ringsOf(limbTs(W.cover.arm, 1, 12, [A.tE, A.tW])), n0: [0, 0, 1], rad: (t, a) => A.rad(t, a), attr: (t) => ({ c: skinC, w: A.w(t) }) });
    g.add(g1).add(g1, true);
  }
  if (W.cover.leg) {
    const g1 = new Geo(), t1 = W.cover.leg[1] ?? W.legEnd;
    tube(g1, null, { curve: L.cv, segs: 12, rings: ringsOf(limbTs(W.cover.leg[0], t1, 11, [L.tK])), n0: [0, 0, 1], rad: (t, a) => L.rad(t, a), attr: (t) => ({ c: tone(skinC, 0.98), w: L.w(t) }) });
    g.add(g1).add(g1, true);
  }
}

// ---------------------------------------------------------------------------------------------- accessories
const onHair = (H, d) => { const th = Math.atan2(d[0], d[2]), ph = Math.asin(clamp(d[1], -1, 1)); return Math.max(H.capR ? H.capR(th, ph) : 0, H.massR ? H.massR(th, ph) : 0, H.rHead(th, ph)); };
const ACC = {
  hoops: (col, tri = false) => (g, H) => {
    const e = new Geo(), c = hex(col), R = tri ? 0.017 : 0.0155;
    lathe(e, H.toB([0.079, 0.024 - R, -0.006]), [1, 0, 0], lin(0, TAU, 7).map((b) => [(R + 0.0019 * Math.cos(b)) * H.hs, 0.0019 * Math.sin(b) * H.hs]), tri ? 3 : 12, () => ({ c, w: [BI.head, 1], rough: 0.25, metal: 0.85 }));
    g.add(e).add(e, true);
  },
  shades: (lens, frame) => (g, H) => {
    const { S, C } = H, rows = [];
    for (const [dy, dz] of [[0.013, 0.0125], [0.004, 0.0115], [-0.008, 0.0105], [-0.016, 0.009]]) rows.push(lin(-1, 1, 15).map((s) => {
      const x = s * 0.07, q = [x, S.ey + dy - 0.012 * s * s, 0.12], d = norm(sub(q, C)), r = march(S.f, C, d, 0.25) ?? 0.1;
      return H.toB(add(mad(C, d, r), [0, 0, dz + 0.006 * (1 - s * s)]));
    }));
    sheet(g, rows, (j) => ({ c: tone(hex(lens), 0.55 + 0.25 * j / 3), w: [BI.head, 1], rough: 0.08, metal: 0.75 }), () => [0, 0, 1]);
    sheet(g, rows.map((r) => r.map((p) => add(p, [0, 0, -0.0012 * H.hs]))), () => ({ c: hex('#101018'), w: [BI.head, 1], rough: 0.4 }), () => [0, 0, -1]);
    const fc = hex(frame), top = rows[0];
    sheet(g, [top.map((p) => add(p, [0, 0.0035 * H.hs, 0])), top.map((p) => add(p, [0, -0.0012 * H.hs, 0.002 * H.hs]))], () => ({ c: fc, w: [BI.head, 1], rough: 0.3, metal: 0.8 }), () => [0, 1, 0.5]);
    for (const s of [-1, 1]) { const a = top[s < 0 ? 0 : top.length - 1], b = H.toB([s * 0.074, S.ey + 0.012, -0.045]); sheet(g, [[a, b], [add(a, [0, -0.004 * H.hs, 0]), add(b, [0, -0.004 * H.hs, 0])]], () => ({ c: fc, w: [BI.head, 1], rough: 0.3, metal: 0.8 }), () => [s, 0, 0]); }
  },
  headphones: (cup, band) => (g, H) => {
    const cc = hex(cup), bc = hex(band), pts = [];
    for (const s of lin(-1, 1, 15)) { const a = s * 1.45, d = norm([Math.sin(a), Math.cos(a), -0.12]); pts.push(H.toB(mad(H.C, d, onHair(H, d) + 0.006))); }
    tube(g, pts, { segs: 6, rings: ringsOf(lin(0, 1, 16)), n0: [0, 0, 1], rad: () => [0.004 * H.hs, 0.009 * H.hs], attr: () => ({ c: bc, w: [BI.head, 1], rough: 0.4 }) });
    const e = new Geo();
    lathe(e, H.toB([0.083, 0.05, -0.012]), [1, 0, 0], [[0, -0.008], [0.03, -0.008], [0.036, 0.0], [0.034, 0.016], [0.026, 0.024], [0, 0.025]].map(([r, h]) => [r * H.hs, h * H.hs]), 14,
      (j) => ({ c: j < 2 ? bc : cc, w: [BI.head, 1], rough: 0.35, metal: j < 2 ? 0 : 0.15 }));
    g.add(e).add(e, true);
  },
  headband: (col, wide = 0.02, yF = 0.134, yB = 0.16) => (g, H) => {
    const c = hex(col), rows = [[], [], []];
    for (const u of around(36)) {
      const th = u * TAU - PI, yc = lerp(yB, yF, sstep(-1, 1, Math.cos(th)));
      for (const [k, dy, lift] of [[0, wide / 2, 0.003], [1, 0, 0.0045], [2, -wide / 2, 0.003]]) { const q = [Math.sin(th) * 0.1, yc + dy, -0.005 + Math.cos(th) * 0.1], d = norm(sub(q, H.C)); rows[k].push(H.toB(mad(H.C, d, onHair(H, d) + lift))); }
    }
    sheet(g, rows, () => ({ c, w: [BI.head, 1], rough: 0.6 }), (p) => sub(p, H.toB(H.C)), true);
  },
  alice: (col, bow) => (g, H) => {
    const c = hex(col), rows = [[], [], []];
    for (const s of lin(-1, 1, 17)) for (const [k, off] of [[0, -0.011], [1, 0], [2, 0.011]]) {
      const a = s * 1.5, d = norm([Math.sin(a), Math.cos(a) * Math.cos(0.42 + off * 6), Math.cos(a) * Math.sin(0.42 + off * 6)]);
      rows[k].push(H.toB(mad(H.C, d, onHair(H, d) + (k === 1 ? 0.005 : 0.003))));
    }
    sheet(g, rows, () => ({ c, w: [BI.head, 1], rough: 0.5 }), (p) => sub(p, H.toB(H.C)));
    const d = norm([0.5, 0.82, 0.3]), p = mad(H.C, d, onHair(H, d) + 0.006), bc = hex(bow);
    for (const s of [-1, 1]) rbox(g, H.toB(add(p, [s * 0.022, 0.004, 0])), [0.021 * H.hs, 0.013 * H.hs, 0.008 * H.hs], () => ({ c: bc, w: [BI.head, 1], rough: 0.5 }), { segs: 10, rows: 5, e: 0.7, ex: norm([1, -0.25 * s, 0]), ey: norm([0.25 * s, 1, 0]) });
    rbox(g, H.toB(add(p, [0, 0.004, 0.003])), [0.007 * H.hs, 0.008 * H.hs, 0.008 * H.hs], () => ({ c: tone(bc, 0.85), w: [BI.head, 1] }), { segs: 8, rows: 4, e: 0.7 });
  },
  goggles: (rim, lens, band) => (g, H) => {
    ACC.headband(band, 0.017, 0.142, 0.118)(g, H);
    for (const s of [-1, 1]) {
      const d = norm([s * 0.3, 0.6, 0.75]), p = mad(H.C, d, onHair(H, d) + 0.004), ax = norm([s * 0.25, 0.45, 1]);
      lathe(g, H.toB(p), ax, [[0, 0.016], [0.012, 0.016], [0.0185, 0.012], [0.02, 0.0], [0.0165, -0.002]].map(([r, h]) => [r * H.hs, h * H.hs]), 12,
        (j) => ({ c: j < 2 ? hex(lens) : hex(rim), w: [BI.head, 1], rough: j < 2 ? 0.1 : 0.4, metal: j < 2 ? 0.5 : 0 }));
    }
  },
  chain: (col) => (g, H, P) => {
    const pts = [];
    for (const u of around(28)) { const th = u * TAU, uu = 0.836 - 0.06 * Math.max(0, Math.cos(th)) ** 2, s = sOfU(uu); pts.push(mad(torsoPt(P, s, th), torsoN(P, s, th), 0.02 * P.k)); }
    pts.push(pts[0]);
    tube(g, pts, { segs: 5, rings: ringsOf(lin(0, 1, 30)), n0: [0, 1, 0], rad: () => [0.0032 * P.k, 0.0032 * P.k], attr: (t) => ({ c: hex(col), w: wTorso(P, pts[Math.round(t * 28)]), rough: 0.25, metal: 0.9 }) });
    const s = sOfU(0.765), p = mad(torsoPt(P, s, 0), torsoN(P, s, 0), 0.024 * P.k);
    rbox(g, p, [0.009 * P.k, 0.018 * P.k, 0.003 * P.k], () => ({ c: hex(col), w: wTorso(P, p), rough: 0.25, metal: 0.9 }), { segs: 6, rows: 4, e: 0.25, ex: norm([1, 0.4, 0]), ey: norm([-0.4, 1, 0]) });
  },
  bangles: (cols) => (g, H, P) => {
    const A = armShape(P);
    cols.forEach((col, i) => {
      const side = i % 2 ? -1 : 1, t = A.tW - 0.035 - Math.floor(i / 2) * 0.03, c = A.cv.at(t), T = norm(sub(A.cv.at(t + 0.01), A.cv.at(t - 0.01))), r = A.rad(t, 0)[0] + 0.006 * P.k;
      const e = new Geo();
      lathe(e, c, T, lin(0, TAU, 6).map((b) => [r + 0.0035 * P.k * Math.cos(b), 0.0035 * P.k * Math.sin(b)]), 12, () => ({ c: hex(col), w: [BI.foreL, 0.5, BI.handL, 0.5], rough: 0.3, metal: 0.4 }));
      if (side > 0) g.add(e); else g.add(e, true);
    });
  },
};
// small facial hair and the like, grown with the clump tool (hair material)
const EXTRA = {
  mustache: (g, H, c) => { const ph = Math.atan2(H.S.yM + 0.009 - H.C[1], 0.1 - H.C[2]); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) clump(g, H, { th: s * (0.03 + i * 0.07), ph, len: 0.022, r: 0.0055, dir: [s, -0.45, 0.25], grav: 0.15, hug: 0.95, sink: 0.001, clear: 0.0008, flat: 0.5, c0: c[0], c1: c[1], steps: 4, rings: 5 }); },
};

// ---------------------------------------------------------------------------------------------- outfits
const ROLES = ['jacket', 'trim', 'light', 'bag', 'sleeve', 'cuff', 'shorts', 'thigh', 'shin', 'zip', 'boot', 'collar'];
const RI = Object.fromEntries(ROLES.map((r, i) => [r, i]));
const TEAL = '#12b5a6', MAG = '#e6258f', WHITE = '#f7f5ef', BAGC = '#f2b63a';
// outfit (game/story.js OUTFITS entry) -> role colours, same mapping as the game's player.js
export function lookOf(o = {}, skin = '#c98d62') {
  const bottom = o.bottom || 'shorts', dress = bottom === 'dress', skirt = dress || bottom === 'skirt', trousers = bottom === 'trousers';
  return {
    jacket: o.jacket || TEAL, trim: o.trim || MAG, light: o.light || WHITE, bag: o.bag || BAGC,
    sleeve: o.sleeve || (dress ? skin : o.jacket || TEAL), cuff: o.cuff || (dress ? skin : o.trim || MAG),
    shorts: skirt ? o.skirt : trousers ? o.legs : o.light || WHITE, thigh: trousers ? o.legs : skin, shin: trousers ? o.legs : o.tights || skin,
    zip: dress ? o.jacket : o.light || WHITE, boot: o.boot || o.light || WHITE, collar: dress ? skin : o.trim || MAG,
    skirt: skirt ? o.skirt : null, pleat: o.pleat || o.skirt, len: o.len || 0.42, flare: o.flare || 0.26, sequin: !!o.sequin, bottom, tights: o.tights || null,
  };
}
// Skye: bomber jacket (or bodice), shorts / trousers / skirt / dress, messenger bag, backwards cap, quad skates
function skyeWear(W, look) {
  const dress = look.bottom === 'dress', skirt = look.bottom === 'skirt', trousers = look.bottom === 'trousers', sq = look.sequin ? { rough: 0.3, spark: 1 } : {};
  if (dress) {
    W.top({ u0: 0.598, u1: 0.742, off: 0.0065, role: 'jacket', rough: 0.5, ...sq, hem: false, topEdge: true });
    W.straps({ role: 'trim', w: 0.015 });
    W.skinTorso(0.72); W.skinArms(0);
  } else {
    const u0 = skirt ? 0.606 : 0.548;
    W.top({ u0, off: 0.017, role: 'jacket', rough: 0.72, puff: 0.004, hem: { h: 0.022, role: 'trim', rib: true }, stripe: { u: 0.752, h: 0.024, role: 'trim', line: 'light' }, topEdge: true });
    W.collar({ kind: 'band', role: 'collar', h: 0.034, rib: true, rough: 0.8 });
    W.zip({ role: 'zip', u0, off: 0.017 });
    W.pockets({ role: 'trim' });
    W.sleeves({ off: 0.016, role: 'sleeve', rough: 0.72, puff: 0.004, cuff: { h: 0.05, role: 'cuff', rib: true } });
    if (skirt) W.top({ u0: 0.552, u1: 0.64, off: 0.009, role: 'light', rough: 0.8, hem: false, rows: 4, segs: 20 });
  }
  if (trousers) W.pants({ u1: 0.585, t1: 0.86, role: 'shorts', legRole: 'thigh', shinRole: 'shin', flare: 0.034, off: 0.012, rough: 0.8 });
  else if (skirt || dress) {
    W.pants({ u1: 0.58, t1: 0.08, role: 'shorts', off: 0.006, low: true });
    W.skirt({ top: skirt ? 0.556 : 0.598, len: look.len * 0.95, flare: look.flare * 0.62, pleat: !!look.pleat && look.pleat !== look.skirt, hem: dress, sequin: look.sequin });
    W.skinLegs(0.1);
  } else { W.pants({ u1: 0.585, t1: 0.36, role: 'shorts', off: 0.012, rough: 0.8 }); W.skinLegs(0.32); }
  W.bag({ role: 'bag', flap: 'trim', off: dress ? 0.008 : 0.017 });
  W.skates({ role: 'boot', stripe: 'jacket', wheel: 'trim', cuffCol: 'trim' });
  W.cap({ back: true, crown: 'trim', band: 'jacket', brim: 'trim' });
}
const ANKLE = 0.84;
// The story cast (all original designs). height: sole to crown (m); lift: soles / heels / skate plates.
export const CAST = {
  SKYE: {
    key: 'SKYE', name: 'Skye', role: 'Courier on eight wheels', height: 1.77, skates: true, outfits: true, seed: 11,
    skin: '#c98d62', lip: '#a35a5c', iris: '#a2682a', brow: '#2a2140', lash: '#1b1428', hair: 'shag', hairCol: ['#2a2140', '#5e4c8c'], blush: 0.12, lashes: 0.95,
    build: { shoulders: 1.0, chest: 0.98, waist: 0.97, hips: 1.0, limbs: 0.96 },
    face: { w: 0.98, jaw: 0.95, chin: 0.94, cheek: 1.1, nose: 0.92, noseW: 0.92, tip: 0.94, lips: 0.97, eye: 1.06, tilt: 0.07, lidUp: 0.42, brow: 0.92, arch: 0.85 },
    dress: skyeWear,
  },
  DEE: {
    key: 'DEE', name: 'Dee Marlowe', role: 'Owner of the Velvet Flamingo', height: 1.71, lift: 0.052, seed: 21,
    skin: '#d9a072', lip: '#d0457a', iris: '#3d6a9a', brow: '#8a3a5a', lash: '#2a1420', hair: 'beehive', hairCol: ['#ff5fa8', '#ffb6da'], blush: 0.2, shadow: '#5a8cff', lashes: 1.35,
    build: { shoulders: 0.94, chest: 1.06, waist: 1.04, hips: 1.1, bust: 1, limbs: 0.98 },
    face: { w: 1.03, jaw: 0.98, chin: 0.93, cheek: 1.18, cheekW: 1.03, nose: 0.95, tip: 1.05, lips: 1.18, lipW: 1.06, eye: 1.04, tilt: 0.04, lidUp: 0.37, brow: 0.75, arch: 1.4 },
    dress(W) {
      W.top({ u0: 0.575, u1: 0.842, col: '#ffe14a', off: 0.011, rough: 0.62, hem: false, topEdge: true });
      W.collar({ kind: 'wide', col: '#fff6ec', h: 0.02, rough: 0.7 });
      W.sleeves({ t1: 0.3, col: '#ffe14a', off: 0.013, puff: 0.012, rough: 0.62, cuff: { col: '#fff6ec', h: 0.018 } });
      W.pants({ u1: 0.605, t1: 0.66, col: '#2e2448', off: 0.012, rough: 0.7 });
      W.apron({ col: '#ff4fa3', trim: '#fff6ec', rough: 0.75 });
      W.shoes({ type: 'heel', col: '#ff5fa8', sole: '#7a2050', rough: 0.4 });
      W.acc(ACC.hoops('#ffd166'));
      W.skinArms(0.26); W.skinLegs(0.62);
    },
  },
  GLITZ: {
    key: 'GLITZ', name: 'Marty Glitz', role: 'Club Prism promoter', height: 1.86, lift: 0.026, seed: 31,
    skin: '#e3ae84', lip: '#b46a62', iris: '#4a3020', brow: '#22203a', hair: 'slick', hairCol: ['#22203a', '#5a5a7c'], blush: 0.16,
    build: { shoulders: 1.12, chest: 1.08, waist: 1.1, hips: 1.02, belly: 0.5, neck: 1.18, limbs: 1.06, depth: 1.05 },
    face: { w: 1.04, jaw: 1.2, chin: 1.18, cheek: 0.95, nose: 1.1, noseW: 1.15, tip: 1.1, lips: 0.9, lipW: 1.05, eye: 0.95, lidUp: 0.33, brow: 1.25, arch: 0.6, browY: -0.002 },
    dress(W) {
      W.top({ u0: 0.53, col: '#6a3fb8', off: 0.02, rough: 0.5, pad: 0.018, hem: { h: 0.0 }, vee: { u: 0.665, w: 0.072, col: '#fff6ec' }, topEdge: true });
      W.lapels({ col: '#5a30a6', off: 0.02, rough: 0.45 });
      W.collar({ kind: 'shirt', col: '#fff6ec', h: 0.026, rough: 0.6 });
      W.tie({ col: '#ffd166', rough: 0.35, metal: 0.2 });
      for (const [x, u] of [[0.32, 0.62], [-0.32, 0.62], [0.32, 0.585], [-0.32, 0.585]]) W.button([x, u], 0.008, { col: '#ffd166', off: 0.022, rough: 0.25, metal: 0.85 });
      W.sleeves({ col: '#6a3fb8', off: 0.019, rough: 0.5, cuff: { col: '#fff6ec', h: 0.016 } });
      W.pants({ u1: 0.6, t1: ANKLE, col: '#6a3fb8', off: 0.015, flare: 0.012, rough: 0.5 });
      W.shoes({ type: 'loafer', col: '#fff6ec', sole: '#c9b38a', rough: 0.3 });
      W.acc(ACC.shades('#27e8ff', '#ffd166'));
    },
  },
  GUS: {
    key: 'GUS', name: 'Gus Pibble', role: 'Night clerk, Pelican Pantry 24', height: 1.73, lift: 0.024, seed: 41,
    skin: '#f1c9a5', lip: '#c07a74', iris: '#4f8a62', brow: '#7a5a3a', hair: 'messy', hairCol: ['#6e5034', '#a8865a'], blush: 0.3,
    build: { shoulders: 0.88, chest: 0.9, waist: 0.95, hips: 0.95, limbs: 0.9, neck: 0.9, slouch: 0.6 },
    face: { w: 0.95, jaw: 0.88, chin: 0.84, chinY: 0.003, cheek: 0.9, nose: 1.16, noseW: 0.92, tip: 1.06, lips: 0.88, eye: 1.13, gap: 0.98, lidUp: 0.66, lidLo: -0.5, tilt: -0.02, brow: 0.9, arch: 1.25, browY: 0.004, ears: 1.12 },
    dress(W) {
      W.top({ u0: 0.548, col: '#7a1838', off: 0.012, rough: 0.82, hem: { h: 0.012, col: '#661430' }, topEdge: true });
      W.collar({ kind: 'polo', col: '#5dff9a', h: 0.022, rough: 0.8 });
      W.strip([[0, 0.842], [0, 0.775]], 0.022, { col: '#661430', off: 0.013, n: 5 });
      for (const u of [0.81, 0.788]) W.button([0, u], 0.0045, { col: '#f4f0e8', off: 0.017 });
      W.button([0.42, 0.728], 0.02, { col: '#ffe14a', h: [0.023, 0.011, 0.003], e: 0.3, off: 0.015, rough: 0.4 });
      W.button([0.42, 0.728], 0.01, { col: '#22203a', h: [0.016, 0.0022, 0.0035], e: 0.3, off: 0.017 });
      W.sleeves({ t1: 0.33, col: '#7a1838', off: 0.014, rough: 0.82, cuff: { col: '#5dff9a', h: 0.012 } });
      W.belt({ col: '#3b2a1a', u: 0.585, off: 0.015 });
      W.pants({ u1: 0.6, t1: ANKLE, col: '#22203a', off: 0.013, rough: 0.8 });
      W.shoes({ type: 'sneaker', col: '#f4f2ee', stripe: '#5dff9a' });
      W.cap({ crown: '#7a1838', band: '#7a1838', brim: '#5dff9a', logo: '#5dff9a' });
      W.skinArms(0.3);
    },
  },
  KILO: {
    key: 'KILO', name: 'DJ Kilowatt', role: 'Club Prism DJ', height: 1.83, lift: 0.03, seed: 51,
    skin: '#6e4128', lip: '#5a3028', iris: '#3a2214', brow: '#1b1210', lash: '#120c0a', hair: 'fade', hairCol: ['#14100e', '#3a302a'], blush: 0.08,
    build: { shoulders: 1.06, chest: 1.02, waist: 1.0, limbs: 1.02 },
    face: { w: 1.0, jaw: 1.06, chin: 1.02, cheek: 1.08, nose: 0.98, noseW: 1.2, tip: 1.12, lips: 1.18, lipW: 1.08, eye: 1.0, tilt: 0.05, lidUp: 0.36, brow: 1.1, arch: 0.8 },
    dress(W) {
      W.top({ u0: 0.552, col: '#7a5cff', off: 0.016, rough: 0.5, hem: { h: 0.02, col: '#5a3fd8', rib: true }, stripe: { u: 0.735, h: 0.016, col: '#18f0ff' }, vee: { u: 0.79, w: 0.032, col: '#f6f1e7' }, topEdge: true });
      W.collar({ kind: 'band', col: '#7a5cff', h: 0.03, rib: true, rough: 0.6 });
      W.zip({ col: '#c9c0d8', u0: 0.552, off: 0.016 });
      W.sleeves({ col: '#7a5cff', off: 0.016, rough: 0.5, stripe: { col: '#18f0ff' }, cuff: { col: '#5a3fd8', h: 0.04, rib: true } });
      W.pants({ u1: 0.595, t1: ANKLE, col: '#22203a', off: 0.016, baggy: 0.008, rough: 0.85 });
      W.shoes({ type: 'hightop', col: '#f4f2ee', stripe: '#7a5cff', cuffCol: '#7a5cff' });
      W.cap({ crown: '#ffe14a', band: '#ffe14a', brim: '#ffd23a' });
      W.acc(ACC.headphones('#ff2bd1', '#22203a'));
      W.acc(ACC.chain('#ffd166'));
    },
  },
  MIMI: {
    key: 'MIMI', name: 'Mimi Zig', role: 'Owner of Zigzag Threads', height: 1.66, lift: 0.052, seed: 61,
    skin: '#a56b43', lip: '#c8402a', iris: '#3a2010', brow: '#1b1218', lash: '#140c10', hair: 'bigcurl', hairCol: ['#22203a', '#4c3a5c'], blush: 0.16, shadow: '#ff8a3d', lashes: 1.3,
    build: { shoulders: 0.92, chest: 1.0, waist: 0.92, hips: 1.1, bust: 0.8, limbs: 0.95 },
    face: { w: 0.98, jaw: 0.92, chin: 0.92, cheek: 1.25, cheekW: 1.02, nose: 0.9, noseW: 1.02, lips: 1.22, lipW: 1.05, eye: 1.05, tilt: 0.13, lidUp: 0.36, brow: 0.8, arch: 1.3 },
    dress(W) {
      const zig = (th, u, p, c) => (Math.abs(u - (0.705 + 0.012 * Math.abs(((th * 3 / PI) % 2 + 2) % 2 - 1))) < 0.007 ? { c: hex('#ffe14a'), role: -1 } : c);
      W.top({ u0: 0.598, u1: 0.742, col: '#ff8a3d', off: 0.0065, rough: 0.6, hem: false, topEdge: true, paint: zig });
      W.straps({ col: '#ff8a3d', w: 0.03 });
      W.pants({ u1: 0.59, t1: 0.12, col: '#ff8a3d', off: 0.008, low: true });
      W.skirt({ top: 0.598, len: 0.38, flare: 0.16, col: '#ff8a3d', zig: '#ffe14a', hemCol: '#ffe14a' });
      W.shoes({ type: 'heel', col: '#ff2bd1', sole: '#7a1050', rough: 0.4 });
      W.acc(ACC.hoops('#ffe14a', true));
      W.acc(ACC.bangles(['#ff2bd1', '#18f0ff', '#ffe14a']));
      W.acc(ACC.alice('#ff2bd1', '#ff2bd1'));
      W.skinTorso(0.72); W.skinArms(0); W.skinLegs(0.1);
    },
  },
  TAPS: {
    key: 'TAPS', name: 'Taps', role: 'Club Prism bartender', height: 1.8, lift: 0.024, seed: 71,
    skin: '#b98055', lip: '#8a5048', iris: '#4a3020', brow: '#1b1830', hair: 'sidepart', hairCol: ['#1b1830', '#4a4670'], blush: 0.1, extra: 'mustache',
    build: { shoulders: 1.02, chest: 1.0, waist: 0.96, limbs: 1.0 },
    face: { w: 0.99, jaw: 1.08, chin: 1.06, cheek: 1.0, nose: 1.02, noseW: 1.02, lips: 0.98, eye: 1.0, tilt: 0.02, lidUp: 0.4, brow: 1.05, arch: 0.7 },
    dress(W) {
      W.top({ u0: 0.548, col: '#f6f1e7', off: 0.009, rough: 0.7, hem: false, topEdge: true });
      W.collar({ kind: 'shirt', col: '#f6f1e7', h: 0.024, rough: 0.7 });
      W.top({ u0: 0.565, u1: 0.79, col: '#22203a', off: 0.016, rough: 0.55, hem: false, topEdge: true, vee: { u: 0.655, w: 0.075, col: '#f6f1e7' } });
      for (const u of [0.6, 0.623, 0.646]) W.button([0, u], 0.0045, { col: '#ffd166', off: 0.02, rough: 0.25, metal: 0.85 });
      W.bowtie({ col: '#ff2bd1', rough: 0.45 });
      W.sleeves({ t1: 0.62, col: '#f6f1e7', off: 0.016, puff: 0.004, roll: true, rough: 0.7 });
      W.pants({ u1: 0.6, t1: ANKLE, col: '#22203a', off: 0.013, rough: 0.6 });
      W.shoes({ type: 'loafer', col: '#1b1830', sole: '#14121e', rough: 0.3 });
      W.skinArms(0.58);
    },
  },
  CHIP: {
    key: 'CHIP', name: 'Chip Glitz', role: 'Rival dancer, Marty\'s nephew', height: 1.75, lift: 0.03, seed: 81,
    skin: '#eab792', lip: '#c07a70', iris: '#4a6aaa', brow: '#a07030', hair: 'mullet', hairCol: ['#b88a44', '#f0d488'], blush: 0.2,
    build: { shoulders: 1.0, chest: 0.96, waist: 0.94, limbs: 0.95 },
    face: { w: 1.0, jaw: 0.96, chin: 1.08, cheek: 1.02, nose: 0.96, tip: 0.95, lips: 1.0, eye: 1.0, tilt: 0.03, lidUp: 0.39, brow: 0.9, arch: 1.0 },
    dress(W) {
      W.top({ u0: 0.55, col: '#ffd166', off: 0.018, rough: 0.3, metal: 0.25, puff: 0.006, hem: { h: 0.022, col: '#6a3fb8', rib: true }, vee: { u: 0.74, w: 0.05, col: '#6a3fb8' }, topEdge: true });
      W.collar({ kind: 'band', col: '#6a3fb8', h: 0.028, rib: true });
      W.sleeves({ t1: 0.66, col: '#ffd166', off: 0.017, rough: 0.3, metal: 0.25, puff: 0.012, cuff: { col: '#6a3fb8', h: 0.03, rib: true } });
      W.pants({ u1: 0.6, t1: ANKLE, col: '#f4f0ff', off: 0.02, baggy: 0.02, rough: 0.35, legPaint: (t, a, c) => (Math.abs(Math.sin(a) + 0.95) < 0.09 && t > 0.08 && t < 0.42 ? { c: hex('#6a3fb8'), role: -1 } : c) });
      W.shoes({ type: 'hightop', col: '#f4f2ee', stripe: '#ffd166', cuffCol: '#ffd166' });
      W.acc(ACC.headband('#ffd166', 0.02));
      W.skinArms(0.62);
    },
  },
  ZIZI: {
    key: 'ZIZI', name: 'Zizi Sparks', role: 'Volt & Spark Supply', height: 1.69, lift: 0.03, seed: 91,
    skin: '#a56b43', lip: '#9a4a40', iris: '#5a3a1a', brow: '#14403c', hair: 'bob', hairCol: ['#1fa89f', '#7ff0dc'], blush: 0.18, lashes: 1.1,
    build: { shoulders: 0.95, chest: 0.98, waist: 0.98, hips: 1.04, limbs: 0.96 },
    face: { w: 1.0, jaw: 0.95, chin: 0.98, cheek: 1.12, nose: 0.9, noseW: 1.05, tip: 1.05, lips: 1.08, eye: 1.08, tilt: 0.06, lidUp: 0.45, brow: 0.95, arch: 1.1 },
    dress(W) {
      W.top({ u0: 0.552, col: '#2a2140', off: 0.009, rough: 0.82, hem: false, topEdge: true });
      W.sleeves({ col: '#2a2140', off: 0.012, rough: 0.82, cuff: { col: '#3a2f58', h: 0.03, rib: true } });
      W.pants({ u1: 0.62, t1: ANKLE, col: '#ff7a2f', off: 0.016, baggy: 0.008, rough: 0.75, hem: true });
      W.top({ u0: 0.6, u1: 0.742, col: '#ff7a2f', off: 0.018, rough: 0.75, hem: false, topEdge: true, arc: [-1.0, 1.0], segs: 14 });
      W.straps({ col: '#ffe14a', w: 0.024, u0: 0.74, uB: 0.62, off: 0.02 });
      for (const s of [-1, 1]) W.button([s * 0.36, 0.735], 0.008, { col: '#c9c0d8', off: 0.024, rough: 0.3, metal: 0.6 });
      W.button([0.2, 0.68], 0.03, { col: '#18f0ff', h: [0.03, 0.024, 0.004], e: 0.3, off: 0.021, rough: 0.6 });
      W.shoes({ type: 'boot', col: '#ffe14a', sole: '#2a2140', rough: 0.6 });
      W.acc(ACC.goggles('#ffe14a', '#27e8ff', '#22203a'));
    },
  },
};

// ---------------------------------------------------------------------------------------------- skirt
// The skirt / dress hem: a ring of panels from the waist down whose hang direction follows the thigh
// swing (rx) and spread (rz) every frame (sitting folds it over the lap; the back panel stays behind).
// Outer layer, a rolled hem and an inner layer, so it reads from below too.
function makeSkirt(P, mat) {
  const NC = 32, NR = 6, ROWS = 2 * (NR + 1) + 1, n = NC * ROWS, k = P.k;
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), rm = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aRM', new THREE.BufferAttribute(rm, 3));
  const idx = [];
  for (let r = 0; r < ROWS - 1; r++) for (let i = 0; i < NC; i++) { const i1 = (i + 1) % NC, a = r * NC + i, b = r * NC + i1, c = (r + 1) * NC + i1, d = (r + 1) * NC + i; idx.push(a, c, b, a, d, c); }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'skirt'; mesh.visible = false; mesh.frustumCulled = false;
  let cfg = null;
  mesh.setup = (o) => {
    if (!o) { cfg = null; mesh.visible = false; return; }
    const sTop = sOfU(o.top), topY = P.Y(o.top), cols = [];
    for (let i = 0; i < NC; i++) {
      const a = (i / NC) * TAU, p = torsoPt(P, sTop, a), nn = torsoN(P, sTop, a), wx = p[0] + nn[0] * 0.012 * k, wz = p[2] + nn[2] * 0.012 * k + 0.005 * k;
      const minR = [];
      for (let r = 0; r <= NR; r++) { const u = (topY - o.len * (r / NR) - P.lift) / P.H; if (u > 0.47) { const q = torsoPt(P, sOfU(u), a); minR.push(Math.hypot(q[0], q[2] + 0.005 * k) + 0.024 * k); } else minR.push(0); }
      cols.push({ a, sx: Math.sin(a), cz: Math.cos(a), wx, wz, r0: Math.hypot(wx, wz), minR });
    }
    cfg = { ...o, topY, cols };
    mesh.visible = true;
    mesh.drape(0, 0, 0, 0);
  };
  mesh.paint = (o) => {
    if (!cfg) return;
    const base = hex(o.col), alt = o.alt ? hex(o.alt) : base, hemC = o.hemCol ? hex(o.hemCol) : null, zig = o.zig ? hex(o.zig) : null;
    for (let r = 0; r < ROWS; r++) for (let i = 0; i < NC; i++) {
      const outer = r <= NR, rr = outer ? r : r === NR + 1 ? NR : ROWS - 1 - r, t = rr / NR;
      let c = cfg.pleat && i % 2 ? alt : base;
      if (zig && Math.abs(t - (0.62 + 0.09 * Math.abs(((i / NC) * 12) % 2 - 1))) < 0.06) c = zig;
      if (hemC && t > 0.9) c = hemC;
      if (o.sequin) c = tone(c, 0.82 + ((i * 7 + r * 3) % 5) * 0.08);
      if (!outer) c = tone(c, r === NR + 1 ? 0.85 : 0.62);
      const q = (r * NC + i) * 3;
      col[q] = c[0]; col[q + 1] = c[1]; col[q + 2] = c[2];
      rm[q] = o.sequin ? 0.3 : 0.72; rm[q + 1] = 0; rm[q + 2] = o.sequin && outer ? 1 : 0;
    }
    geo.attributes.color.needsUpdate = true; geo.attributes.aRM.needsUpdate = true;
  };
  // aL, zL / aR, zR: the thighs' swing (rx) and spread (rz)
  mesh.drape = (aL, zL, aR, zR) => {
    if (!cfg) return;
    const len = cfg.len, fl = cfg.flare, spread = 1 + Math.abs(aL - aR) * 0.25;
    for (let i = 0; i < NC; i++) {
      const c = cfg.cols[i], wL = clamp(c.sx * 1.1 + 0.5, 0, 1);
      let ax = aL * wL + aR * (1 - wL), az = zL * wL + zR * (1 - wL);
      if (c.cz < 0 && ax < 0) ax *= 0.3;
      ax *= 0.85; az *= 0.9;
      const dx = Math.cos(ax) * Math.sin(az), dy = -Math.cos(ax) * Math.cos(az), dz = -Math.sin(ax), pl = cfg.pleat ? (i % 2 ? 1 : -1) : 0;
      let hx = 0, hy = 0, hz = 0, rx = 0, rz = 0;
      for (let r = 0; r <= NR; r++) {
        const t = r / NR;
        let R = c.r0 + fl * t ** 1.15 * spread;
        if (ax > -0.35) R = Math.max(R, c.minR[r]);
        R *= 1 + pl * 0.035 * t;
        const sc = R / c.r0, x = c.wx * sc + dx * len * t, y = cfg.topY + dy * len * t, z = c.wz * sc - 0.005 * k + dz * len * t;
        const l = Math.hypot(c.wx, c.wz) || 1;
        rx = c.wx / l; rz = c.wz / l;
        let q = (r * NC + i) * 3;
        pos[q] = x; pos[q + 1] = y; pos[q + 2] = z;
        q = ((ROWS - 1 - r) * NC + i) * 3;
        pos[q] = x - rx * 0.0045 * k; pos[q + 1] = y + 0.001; pos[q + 2] = z - rz * 0.0045 * k;
        if (r === NR) { hx = x; hy = y; hz = z; }
      }
      const q = ((NR + 1) * NC + i) * 3;
      pos[q] = hx - rx * 0.0025 * k; pos[q + 1] = hy - 0.003 * k; pos[q + 2] = hz - rz * 0.0025 * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return mesh;
}

// ---------------------------------------------------------------------------------------------- the figure
const ZERO_LOOK = lookOf({});
function hookObject(name, onY) {
  const o = new THREE.Object3D(), v = new THREE.Vector3(1, 1, 1);
  o.name = name;
  const prox = new Proxy(v, { set(t, key, val) { t[key] = val; if (key === 'y') onY(val); return true; } });
  Object.defineProperty(o, 'scale', { value: prox, configurable: true, enumerable: true });
  return o;
}
const pairRot = (a, b) => ({ rotation: {
  get x() { return a.rotation.x; }, set x(v) { a.rotation.x = v; b.rotation.x = v; },
  get y() { return a.rotation.y; }, set y(v) { a.rotation.y = v; b.rotation.y = -v; },
  get z() { return a.rotation.z; }, set z(v) { a.rotation.z = v; b.rotation.z = -v; },
  set(x, y, z) { a.rotation.set(x, y, z); b.rotation.set(x, -y, -z); return this; },
} });
const EXPR = {
  neutral: { smile: 0, brows: 0, squint: 0 }, smile: { smile: 0.8, brows: 0.1, squint: 0.15 }, grin: { smile: 1, brows: 0.25, squint: 0.3, open: 0.15 },
  surprised: { smile: 0, brows: 1, squint: -0.25, open: 0.35 }, worried: { smile: -0.4, brows: 0.6, browIn: 0.8 }, smug: { smile: 0.45, brows: -0.25, squint: 0.35, browL: 0.5 },
  cross: { smile: -0.5, brows: -0.7, browIn: -0.6, squint: 0.2 },
};
// Build a figure. spec: a CAST entry (or its key) or your own spec in the same shape.
// opts: { outfit (Skye: a story.js OUTFITS entry), rimU (shared rim uniform), autoSolve (default true) }
export function createFigure(specOrKey, opts = {}) {
  const spec = typeof specOrKey === 'string' ? CAST[specOrKey] : specOrKey;
  const P = makePlan(spec), M = figureMaterials(opts), rnd = prng(spec.seed || 1);
  // ---- skeleton (bind pose: every rotation zero, arms hanging, legs straight)
  const root = new THREE.Group();
  root.name = 'root';
  const head0 = headSDF(faceOf(spec)), hs = P.hs, toB = (p) => [P.head[0] + p[0] * hs, P.head[1] + p[1] * hs, P.head[2] + p[2] * hs];
  const F0 = faceOf(spec), brow0 = toB([head0.ex + 0.004, 0.097 + F0.browY, 0.08]), corner0 = toB([0.0215 * F0.lipW, head0.yM, 0.088]);
  const sx = -(0.2 * P.k * P.b.hips + 0.035 * P.k);
  const J = {
    body: [0, 0, 0], torso: [0, 0, 0], head: P.head, jaw: toB([0, 0.045, -0.02]), eyeL: toB([head0.ex, head0.ey, head0.ez]), lidUL: toB([head0.ex, head0.ey, head0.ez]), lidLL: toB([head0.ex, head0.ey, head0.ez]),
    browL: brow0, mouthL: corner0, hair: toB([0, 0.1, -0.03]), armL: P.S, foreL: P.E, handL: P.W, legL: P.Hp, shinL: P.K, footL: P.A, bag: [sx, P.Y(0.545) + 0.1 * P.k, -0.02 * P.k],
  };
  for (const n of ['eye', 'lidU', 'lidL', 'brow', 'mouth', 'arm', 'fore', 'hand', 'leg', 'shin', 'foot']) { const q = J[n + 'L']; J[n + 'R'] = [-q[0], q[1], q[2]]; }
  const bones = {}, list = [];
  for (const [name, parent] of BONES) {
    const b = new THREE.Bone(), q = J[name], pq = parent ? J[parent] : [0, 0, 0];
    b.name = name; b.position.set(q[0] - pq[0], q[1] - pq[1], q[2] - pq[2]);
    (parent ? bones[parent] : root).add(b);
    bones[name] = b; list.push(b);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  bones.legL.shin = bones.shinL; bones.legR.shin = bones.shinR;
  const rest = {};
  for (const n of ['browL', 'browR', 'mouthL', 'mouthR']) rest[n] = bones[n].position.clone();
  // ---- the parts that never change with the outfit: head, face, ears, neck, hands, hair, eyes
  const gHeadSkin = new Geo(), gEye = new Geo(), gHair = new Geo(), gFixedCloth = new Geo();
  const H = buildHead(gHeadSkin, P, spec);
  buildEyes(gHeadSkin, gEye, gHair, H);
  const hc = spec.hairCol || ['#2a2140', '#5a4a86'];
  if (STYLES[spec.hair]) STYLES[spec.hair](gHair, H, hc, rnd);
  if (spec.extra && EXTRA[spec.extra]) EXTRA[spec.extra](gHair, H, hc);
  { const gh = new Geo(); buildHand(gh, P, hex(spec.skin)); gHeadSkin.add(gh).add(gh, true); }
  // ---- meshes
  const mk = (name, mat) => {
    const m = new THREE.SkinnedMesh(new THREE.BufferGeometry(), mat);
    m.name = name; root.add(m); m.bind(skeleton, new THREE.Matrix4());
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, P.H * 0.55, 0), P.H * 0.95);
    return m;
  };
  const meshes = { skin: mk('skin', M.skin), cloth: mk('cloth', M.cloth), hair: mk('hair', M.hair), eye: mk('eyes', M.eye) };
  meshes.hair.geometry = gHair.build('hair'); meshes.eye.geometry = gEye.build('eye');
  const skirt = makeSkirt(P, M.cloth);
  bones.body.add(skirt);
  // ---- outfit-dependent parts (rebuilt when the garment set changes, repainted otherwise)
  let look = spec.outfits ? lookOf(opts.outfit || {}, spec.skin) : ZERO_LOOK, sig = null, W = null;
  const signature = (lk) => (spec.outfits ? lk.bottom : 'fixed');
  const rebuild = () => {
    const gS = new Geo(), gC = new Geo();
    W = makeWardrobe(P, H, gC, gS, look);
    (spec.dress || skyeWear)(W, look);
    W.legEnd = W.L.tOfY((spec.skates ? P.lift + 0.2 * P.k : 0.07 * P.k)) + 0.02;
    if (W.cover.leg && W.cover.leg[1] === undefined) W.cover.leg[1] = W.legEnd;
    buildBodySkin(gS, P, H, W);
    const skinAll = new Geo().add(gHeadSkin).add(gS), clothAll = new Geo().add(gFixedCloth).add(gC);
    for (const m of [meshes.skin, meshes.cloth]) m.geometry.dispose();
    meshes.skin.geometry = skinAll.build('skin'); meshes.cloth.geometry = clothAll.build('cloth');
    skirt.setup(W.skirtCfg);
  };
  const paint = () => {
    const g = meshes.cloth.geometry, ca = g.attributes.color, ra = g.attributes.aRole, sa = g.attributes.aShade, rm = g.attributes.aRM, cols = ROLES.map((r) => hex(look[r] || '#ffffff'));
    for (let i = 0; i < ca.count; i++) {
      const r = ra.getX(i);
      if (r < 0) continue;
      let c = tone(cols[r], sa.getX(i));
      if (look.sequin && (r === 0 || r === 6)) { c = tone(c, 0.8 + ((i * 13) % 7) * 0.07); rm.setXYZ(i, 0.3, 0, 1); }
      ca.setXYZ(i, c[0], c[1], c[2]);
    }
    ca.needsUpdate = true; rm.needsUpdate = true;
    if (W && W.skirtCfg) skirt.paint(spec.outfits ? { col: look.skirt, alt: W.skirtCfg.pleat ? look.pleat : null, hemCol: W.skirtCfg.hem ? look.trim : null, sequin: look.sequin } : W.skirtCfg);
  };
  // ---- face state; the game's hooks (eyes.scale.y blinks, mouth.scale.y talks) feed it
  const face = { blink: 0, open: 0, smile: 0, brows: 0, browL: 0, browR: 0, browIn: 0, squint: 0, hookLids: 0, hookOpen: 0, look: null, gaze: { yaw: 0, pitch: 0 }, sac: { yaw: 0, pitch: 0, t: 1 }, blinkT: 1 + rnd() * 2, blinkPh: -1, auto: true, expr: 'neutral', exprK: { ...EXPR.neutral } };
  const eyes = hookObject('eyes', (y) => { face.hookLids = clamp((1 - y) / 0.88, 0, 1); });
  const mouth = hookObject('mouth', (y) => { face.hookOpen = clamp((y - 1) / 2.6, 0, 1); });
  bones.head.add(eyes, mouth);
  const grip = (hand, s) => { const o = new THREE.Object3D(); o.name = 'grip' + s; o.position.set((s === 'L' ? -0.012 : 0.012) * P.k, -0.062 * P.k, 0.01 * P.k); hand.add(o); return o; };
  const fig = {
    key: spec.key, name: spec.name, spec, plan: P, root, g: root, skeleton, bones, meshes, materials: M, skirt, eyes, mouth, face,
    body: bones.body, torso: bones.torso, head: bones.head, jaw: bones.jaw, armL: bones.armL, armR: bones.armR, legL: bones.legL, legR: bones.legR,
    gripL: grip(bones.handL, 'L'), gripR: grip(bones.handR, 'R'),
    thighs: pairRot(bones.legL, bones.legR), shins: pairRot(bones.shinL, bones.shinR),
    bend: { L: null, R: null }, talking: false, breathe: !spec.outfits, autoSolve: opts.autoSolve !== false, reducedMotion: !!opts.reducedMotion,
    get look() { return look; },
    // Skye: any story.js OUTFITS entry (bottom: shorts / trousers / skirt / dress). Cast: role colours only.
    setOutfit(o) {
      look = spec.outfits ? lookOf(o || {}, spec.skin) : look;
      const s = signature(look);
      if (s !== sig) { sig = s; rebuild(); }
      paint();
    },
    setExpression(name, k = 1) { const e = EXPR[name] || EXPR.neutral; face.expr = name; for (const key of ['smile', 'brows', 'browL', 'browIn', 'squint', 'open']) face.exprK[key] = (e[key] || 0) * k; },
    // look at a world point (Vector3) or null to look ahead
    lookAt(v) { face.look = v ? v.clone() : null; },
    // life: blinks, little eye darts, talk (fig.talking), breathing (fig.breathe). Call every frame with dt;
    // { blink: false } leaves blinking to the game's eyes.scale hook.
    tick(dt, o = {}) {
      face.t = (face.t || 0) + dt;
      const t = face.t, rm = fig.reducedMotion;
      face.blinkT -= dt;
      if (o.blink === false) face.blinkT = Math.max(face.blinkT, 1);
      if (face.blinkT <= 0) { face.blinkPh = 0; face.blinkT = rnd() < 0.15 ? 0.3 : 2.2 + rnd() * 3.5; }
      if (face.blinkPh >= 0) { const p = (face.blinkPh += dt); face.blink = p < 0.06 ? p / 0.06 : p < 0.1 ? 1 : p < 0.24 ? 1 - (p - 0.1) / 0.14 : 0; if (p >= 0.24) face.blinkPh = -1; }
      face.sac.t -= dt;
      if (face.sac.t <= 0) { face.sac.t = 0.5 + rnd() * 2.2; face.sac.yaw = (rnd() - 0.5) * 0.16; face.sac.pitch = (rnd() - 0.5) * 0.08; }
      if (fig.talking) { face.open = rm ? 0.3 : 0.12 + Math.abs(Math.sin(t * 17)) * 0.7 * (0.6 + 0.4 * Math.sin(t * 5.3)); face.brows = 0.3 * Math.max(0, Math.sin(t * 2.1)) * (rm ? 0.3 : 1); }
      else { face.open = Math.max(0, face.open - dt * 6); face.brows *= Math.exp(-4 * dt); }
      if (fig.breathe) { const br = Math.sin(t * 1.7); bones.torso.scale.set(1 + br * 0.006, 1, 1 + br * 0.022); }
    },
    solve: null,
    stats() {
      let tris = 0, draws = 0;
      root.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && o.visible && o.geometry.index) { tris += o.geometry.index.count / 3; draws++; } });
      return { tris, draws, bones: skeleton.bones.length };
    },
    dispose() { for (const m of Object.values(meshes)) m.geometry.dispose(); skirt.geometry.dispose(); skeleton.dispose(); },
  };
  fig.dims = { hip: P.hipY, knee: P.kneeY, ankle: P.ankleY, shoulder: P.S[1], neck: P.head[1], eye: P.head[1] + head0.ey * hs, height: P.H + P.lift, headScale: hs };
  // ---- the per-frame rig solve: elbows, wrists, ankles, face bones, skirt, bag and hair sway.
  // Runs on its own just before the matrices update each frame (root.updateMatrixWorld).
  const B = bones, sp = { bag: [0, 0, 0, 0], hair: [0, 0, 0, 0] }, lid = H.lid, prevRoot = new THREE.Vector3(), prevV = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  let last = typeof performance !== 'undefined' ? performance.now() : 0, first = true;
  const spring = (s, target, dt, stiff = 40, damp = 7) => { for (let i = 0; i < 2; i++) { const a = (target[i] - s[i]) * stiff - s[i + 2] * damp; s[i + 2] += a * dt; s[i] += s[i + 2] * dt; } };
  fig.solve = (dtIn) => {
    const now = typeof performance !== 'undefined' ? performance.now() : last + 16, dt = dtIn ?? clamp((now - last) / 1000, 0, 0.1);
    last = now;
    for (const s of ['L', 'R']) {
      const arm = B['arm' + s], fwd = -arm.rotation.x, side = Math.abs(arm.rotation.z);
      let bend = 0.14 + 0.62 * Math.max(0, 1 - ((fwd - 0.72) / 0.6) ** 2) * (1 - sstep(1.0, 1.6, side)) + 0.1 * sstep(0.2, -0.5, arm.rotation.x);
      if (fig.bend[s] !== null && fig.bend[s] !== undefined) bend = fig.bend[s];
      B['fore' + s].rotation.set(-bend, 0, 0);
      B['hand' + s].rotation.set(-0.12 - bend * 0.1, 0, (s === 'L' ? 1 : -1) * 0.05);
    }
    const brx = B.body.rotation.x, brz = B.body.rotation.z;
    for (const s of ['L', 'R']) {
      const leg = B['leg' + s], shin = B['shin' + s];
      B['foot' + s].rotation.set(clamp(-(brx + leg.rotation.x + shin.rotation.x) * 0.9, -0.75, 0.6), 0, clamp(-(leg.rotation.z + brz) * 0.7, -0.35, 0.35));
    }
    // face
    const ex = face.exprK, close = clamp(Math.max(face.hookLids, face.blink) + (ex.squint || 0) * 0.25, -0.2, 1);
    let gy = face.sac.yaw, gp = face.sac.pitch;
    if (face.look) {
      B.head.updateWorldMatrix(true, false);
      tmpV.copy(face.look); B.head.worldToLocal(tmpV);
      const ey = J.eyeL[1] - J.head[1], ez = J.eyeL[2] - J.head[2];
      gy = clamp(Math.atan2(tmpV.x, tmpV.z - ez), -0.45, 0.45) + gy * 0.3; gp = clamp(Math.atan2(tmpV.y - ey, Math.hypot(tmpV.x, tmpV.z - ez)), -0.3, 0.3) + gp * 0.3;
    }
    face.gaze.yaw += (gy - face.gaze.yaw) * Math.min(1, dt * 22); face.gaze.pitch += (gp - face.gaze.pitch) * Math.min(1, dt * 22);
    for (const s of ['L', 'R']) {
      B['eye' + s].rotation.set(-face.gaze.pitch, face.gaze.yaw, 0);
      B['lidU' + s].rotation.x = (lid.up - lid.lo + 0.05) * Math.max(0, close) - face.gaze.pitch * 0.45 + Math.min(0, close) * 0.3;
      B['lidL' + s].rotation.x = -0.1 * Math.max(0, close) - 0.08 * (ex.smile || 0) - face.gaze.pitch * 0.12;
      const raise = (face.brows + (ex.brows || 0) + (s === 'L' ? face.browL + (ex.browL || 0) : face.browR)) * 0.0035 * hs;
      B['brow' + s].position.set(rest['brow' + s].x, rest['brow' + s].y + raise, rest['brow' + s].z);
      B['brow' + s].rotation.z = (s === 'L' ? 1 : -1) * ((ex.browIn || 0) * 0.12);
      const sm = (face.smile + (ex.smile || 0)) * hs, m0 = rest['mouth' + s];
      B['mouth' + s].position.set(m0.x + (s === 'L' ? 1 : -1) * 0.0014 * sm, m0.y + 0.0026 * sm, m0.z - 0.0012 * Math.abs(sm));
    }
    B.jaw.rotation.x = Math.max(face.hookOpen, face.open, ex.open || 0) * 0.2;
    if (skirt.visible) skirt.drape(B.legL.rotation.x, B.legL.rotation.z, B.legR.rotation.x, B.legR.rotation.z);
    // secondary sway: the bag and long hair lag behind the body's motion
    if (dt > 0) {
      root.getWorldPosition(tmpV);
      if (first) { prevRoot.copy(tmpV); first = false; }
      const vx = (tmpV.x - prevRoot.x) / dt, vz = (tmpV.z - prevRoot.z) / dt;
      prevRoot.copy(tmpV);
      const yaw = root.rotation.y, fv = clamp(vx * Math.sin(yaw) + vz * Math.cos(yaw), -15, 15), ax = clamp((fv - prevV.x) / dt, -60, 60);
      prevV.x = fv;
      spring(sp.bag, [clamp(-brx * 0.8 + ax * 0.004, -0.6, 0.6), clamp(-brz * 0.8, -0.5, 0.5)], dt);
      B.bag.rotation.set(sp.bag[0], 0, sp.bag[1]);
      spring(sp.hair, [clamp(-B.head.rotation.x * 0.6 + ax * 0.003 + brx * -0.3, -0.5, 0.5), clamp(-B.head.rotation.z * 0.5, -0.4, 0.4)], dt, 30, 6);
      B.hair.rotation.set(sp.hair[0], 0, sp.hair[1]);
    }
  };
  const baseUMW = root.updateMatrixWorld.bind(root);
  root.updateMatrixWorld = (force) => { if (fig.autoSolve) fig.solve(); baseUMW(force); };
  fig.setOutfit(opts.outfit || null);
  // everything else in the head / hair / eye meshes is fixed: done
  let top = 0;
  const pa = meshes.hair.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) top = Math.max(top, pa.getY(i));
  fig.dims.top = Math.max(top, P.head[1] + 0.19 * hs);
  return fig;
}
// The shape interiors.js expects from makeNPC(key): { g, head, armL, armR, thighs, shins, sit(seat), stand(), ... }
export function asNPC(fig, key = fig.key) {
  const n = {
    key, fig, g: fig.root, head: fig.head, armL: fig.armL, armR: fig.armR, thighs: fig.thighs, shins: fig.shins, x: 0, y: 0, z: 0, yaw: 0, home: 0, seated: false,
    // hips on the cushion (st.y is the seat height), knees bent, feet on the floor
    sit(st) {
      Object.assign(n, { seated: true, x: st.x, z: st.z, y: -0.42, yaw: st.yaw });
      fig.root.position.set(st.x, st.y - fig.dims.hip + 0.07, st.z); fig.root.rotation.y = st.yaw;
      fig.legL.rotation.set(-1.5, 0, 0.06); fig.legR.rotation.set(-1.5, 0, -0.06); fig.legL.shin.rotation.x = fig.legR.shin.rotation.x = 1.5;
      if (st.taken !== undefined) st.taken = true;
    },
    stand() {
      if (!n.seated) return;
      const h = n.homeAt;
      Object.assign(n, { seated: false, x: h[0], y: h[3] || 0, z: h[1], yaw: h[2] });
      fig.root.position.set(n.x, n.y, n.z); fig.root.rotation.y = n.yaw;
      fig.legL.rotation.set(0, 0, 0); fig.legR.rotation.set(0, 0, 0); fig.legL.shin.rotation.x = fig.legR.shin.rotation.x = 0;
    },
  };
  return n;
}

// ---------------------------------------------------------------------------------------------- crowd
// Rounded body parts for the instanced crowds, drop-in for the box parts (same origins and extents).
//  'street' (actors/peds.js): torso from the hips (y 0) to the neck (0.6); head from the neck (0) up to
//    the crown (~0.27); limb from the joint (0) down to about -0.62 with a foot / hand at the end (legs
//    are scaled 1.38 in y, arms 0.85 in x); hat on the head origin (brim at 0.26).
//  'club' (game/interiors.js): torso in body space (0.8 to 1.52), head from the neck (0), arm from the
//    shoulder (0) to -0.55, leg from the hip (0) to -0.9.
// White takes the instance colour; grey parts become a darker shade of it. position / normal / color.
export function crowdParts(scheme = 'street') {
  const plain = (g) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(g.N, 3)); b.setAttribute('color', new THREE.Float32BufferAttribute(g.C, 3)); b.setIndex(g.I); return b; };
  const W1 = hex('#ffffff'), sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;
  const loft = (g, secs, cf, segs = 12) => {
    const K = [0, 1, 2, 3].map((c) => secs.map((s, i) => [i, s[c]]));
    surf(g, around(segs), lin(0, secs.length - 1, secs.length * 2 - 1), true, (u, v) => { const a = u * TAU; return [skeys(K[1], v) * sp(Math.sin(a), 0.75), skeys(K[0], v), skeys(K[3], v) + skeys(K[2], v) * sp(Math.cos(a), 0.75)]; },
      (u, v, p) => ({ c: cf(p), w: [0, 1] }));
  };
  const capEnds = (g, base, segs, rows, cTop, cBot) => {
    const top = g.v([0, g.P[(base + (rows - 1) * segs) * 3 + 1], 0], [0, 1, 0], cTop, [0, 1]), bot = g.v([0, g.P[base * 3 + 1], 0], [0, -1, 0], cBot, [0, 1]);
    for (let i = 0; i < segs; i++) { const i1 = (i + 1) % segs; g.tri(base + (rows - 1) * segs + i, base + (rows - 1) * segs + i1, top); g.tri(bot, base + i1, base + i); }
  };
  const head = (y0) => {
    const g = new Geo(), hairC = hex('#3a3040'), C = [0, y0 + 0.125, 0.0];
    const f = (x, y, z) => smin(sdE(x, y, z, 0, y0 + 0.13, 0, 0.1, 0.125, 0.112), sdE(x, y, z, 0, y0 + 0.06, 0.035, 0.07, 0.065, 0.075), 0.03);
    starMesh(g, C, around(12).map((u) => u * TAU - PI), lin(-1.35, 1.35, 8), (th, ph) => march(f, C, dirOf(th, ph), 0.3) ?? 0.1, () => ({ c: W1, w: [0, 1] }), { f, wrap: true, top: true, bottom: true });
    // hair mass over the top and back
    const hl = (th) => keyLin([[0, 0.75], [1.0, 0.55], [1.6, 0.25], [2.4, -0.35], [PI, -0.5]], Math.abs(th));
    const id = starMesh(g, C, around(12).map((u) => u * TAU - PI), lin(-0.6, 1.4, 6), (th, ph) => { const r = march(f, C, dirOf(th, ph), 0.3) ?? 0.1; return ph < hl(th) - 0.05 ? null : r + 0.013 * sstep(hl(th) - 0.05, hl(th) + 0.12, ph); }, () => ({ c: hairC, w: [0, 1] }), { wrap: true, top: true });
    for (const s of [-1, 1]) rbox(g, [s * 0.04, y0 + 0.145, 0.102], [0.012, 0.016, 0.008], () => ({ c: hex('#202020'), w: [0, 1] }), { segs: 6, rows: 3, e: 0.7 });
    tube(g, [[0, y0 - 0.09, 0], [0, y0 + 0.05, 0.005]], { segs: 8, rings: ringsOf([0, 1]), rad: () => [0.045, 0.048], attr: () => ({ c: hex('#e8e8e8'), w: [0, 1] }) });
    return plain(g);
  };
  const limb = (len, r0, r1, end) => {
    const g = new Geo();
    tube(g, [[0, 0.04, 0], [0, 0, 0], [0, -len * 0.5, 0.004], [0, -len, 0]], { segs: 8, rings: ringsOf(lin(0, 1, 7)), rad: (t) => { const r = lerp(r0, r1, t) * (t < 0.08 ? 0.6 + 5 * t : 1); return [r, r]; }, attr: () => ({ c: W1, w: [0, 1] }) });
    if (end === 'foot') rbox(g, [0, -len - 0.055, 0.03], [r1 * 1.1, 0.05, 0.095], () => ({ c: hex('#4a4a4a'), w: [0, 1] }), { segs: 10, rows: 5, e: 0.45 });
    else if (end === 'hand') rbox(g, [0, -len - 0.045, 0.005], [r1 * 0.8, 0.05, r1 * 0.95], () => ({ c: hex(scheme === 'club' ? '#e8c8b0' : '#4a4a4a'), w: [0, 1] }), { segs: 8, rows: 5, e: 0.6 });
    return plain(g);
  };
  if (scheme === 'club') {
    const g = new Geo();
    loft(g, [[0.8, 0.12, 0.1, 0], [0.9, 0.2, 0.125, 0], [1.02, 0.18, 0.115, 0.005], [1.22, 0.2, 0.125, 0.01], [1.4, 0.22, 0.12, 0], [1.48, 0.17, 0.09, -0.005], [1.53, 0.06, 0.05, 0]],
      (p) => (p[1] < 0.97 ? hex('#c8c8c8') : p[1] < 1.0 ? hex('#9a9a9a') : W1), 12);
    capEnds(g, 0, 12, 13, W1, hex('#c8c8c8'));
    return { torso: plain(g), head: head(0.045), arm: limb(0.5, 0.062, 0.048, 'hand'), leg: limb(0.82, 0.08, 0.055, 'foot') };
  }
  const g = new Geo();
  loft(g, [[-0.02, 0.15, 0.1, 0], [0.04, 0.2, 0.12, 0], [0.18, 0.17, 0.11, 0.005], [0.36, 0.2, 0.12, 0.01], [0.5, 0.21, 0.115, 0], [0.57, 0.16, 0.09, -0.005], [0.62, 0.06, 0.05, 0]],
    (p) => (p[1] < 0.05 ? hex('#b8b8b8') : W1), 12);
  capEnds(g, 0, 12, 13, W1, hex('#b8b8b8'));
  const hat = new Geo();
  lathe(hat, [0, 0.255, 0.02], [0, 1, 0], [[0, -0.004], [0.2, -0.004], [0.205, 0.008], [0.135, 0.016], [0.13, 0.04], [0.125, 0.075], [0.105, 0.098], [0, 0.105]], 14, (j) => ({ c: j === 4 ? hex('#555555') : W1, w: [0, 1] }));
  return { torso: plain(g), head: head(0), limb: limb(0.5, 0.065, 0.05, 'foot'), arm: limb(0.5, 0.062, 0.046, 'hand'), leg: limb(0.5, 0.068, 0.05, 'foot'), hat: plain(hat) };
}
// debug / lab helpers
export const figureDebug = { headSDF, faceOf, makePlan, torsoPt, sOfU };
