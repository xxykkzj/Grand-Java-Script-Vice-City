// Refined blocky characters: small chamfered blocks with a tiny pixel texture (weave, ribbing, denim,
// hair strands, tread…), pixel-art faces with blink / talk / expression states, and rigid skinning so a
// whole character is ONE draw call while the familiar pivot groups (head, armL, legL.shin…) still move it.
//
// Every piece carries the same attributes so anything can be merged:
//   position, normal, color   flat-shaded block, colour (white for roles / instance colours)
//   aTex                      texel coordinates (tiles in world units; 0..1 on faces and decals)
//   aCell                     (cell x, cell y, mode): mode 0 tiles a fabric cell, 1 is the face (state
//                             picked in the shader), 2 is a decal (clamped, its own colours on top)
//   aAlt                      0 = instance colour, 1 / 2 = the instance's second / third colour, 3 = own colour;
//                             plus 4 x (hair slot + 1) (see HAIR below: packed in, an instanced head is near the attribute limit)
//   aRole                     outfit role index (the courier's outfits recolour by role), -1 = fixed
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { timeU } from '../core/util.js';
import { lampPatch } from '../world/lamplight.js';

export const CELL = 16, COLS = 8;
export const PX = 0.02;                                   // world size of one fabric pixel
const TILE = PX * CELL;
// fabric and decal cells (in the atlas' last two rows)
export const PAT = { plain: 0, weave: 1, rib: 2, denim: 3, seam: 4, hair: 5, sequin: 6, tread: 7, leather: 8, stripe: 9, check: 10, knit: 11, bolt: 12, star: 13, badge: 14, heart: 15, curl: 16, braid: 17, fuzz: 18 };
const PAT_N = 24;                                         // three rows of eight cells
const DECAL = new Set([12, 13, 14, 15]);
// face states (atlas columns)
export const FACE = { neutral: 0, blink: 1, talkA: 2, talkB: 3, smile: 4, think: 5, wow: 6, sure: 7 };
// cutscene gestures -> expression
const EXPR = { wave: FACE.smile, nod: FACE.smile, shrug: FACE.wow, think: FACE.think, point: FACE.sure };

// ---- pixel art -------------------------------------------------------------------------------------
const rgb = (hex) => { const c = new THREE.Color(hex); c.convertLinearToSRGB(); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const g = (v) => [v, v, v];

// A face (16 x 16, y down). Skin pixels are tinted (they take the head's colour), the rest are absolute.
// f: { iris, brow, lash, lip, blush, freckles, beard, stache, glasses, shades, thick, stubble }
function drawFace(put, st, f) {
  const T = (x, y, v) => put(x, y, Array.isArray(v) ? v : g(v), false), A = (x, y, c) => put(x, y, c, true);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) T(x, y, 255 - (y > 13 ? 10 : 0) - (x === 0 || x === 15 ? 8 : 0));
  const brow = rgb(f.brow || '#2a2140'), iris = rgb(f.iris || '#3a2a1a'), pupil = iris.map((v) => Math.round(v * 0.45)), white = [250, 248, 242], hi = [255, 255, 255];
  const lid = [38, 26, 40], mouth = rgb(f.lip || '#8a3a48'), dark = [64, 20, 32];
  // brows (raised for "wow", one up for "think", angled in for "sure")
  const browRow = (x0, x1, y) => { for (let x = x0; x <= x1; x++) A(x, y, brow); };
  const w = f.thick ? 1 : 0;
  if (st === FACE.sure) { A(3, 4, brow); A(4, 4, brow); A(5, 5, brow); A(6 - 1 + w, 5, brow); A(12, 4, brow); A(11, 4, brow); A(10, 5, brow); A(9 + 1 - w, 5, brow); }
  else {
    const yl = st === FACE.wow || st === FACE.think ? 4 : 5, yr = st === FACE.wow ? 4 : 5;
    browRow(3, 5 + w, yl); browRow(10 - w, 12, yr);
    if (f.thick) { A(4, yl + 1, brow); A(11, yr + 1, brow); }
  }
  // eyes
  if (st === FACE.blink) { for (const x of [4, 5, 6, 9, 10, 11]) A(x, 8, lid); if (f.lash) { A(3, 8, lid); A(12, 8, lid); } }
  else {
    const rows = st === FACE.wow ? [6, 7, 8] : [7, 8];
    for (const y of rows) for (const x of [4, 5, 6, 9, 10, 11]) A(x, y, white);
    // irises: two by two, looking ahead (up and aside when thinking)
    const iy = st === FACE.think ? [7] : [7, 8], dx = st === FACE.think ? 1 : 0;
    for (const y of iy) { A(5 + dx, y, iris); A(6 + dx, y, iris); A(9 + dx, y, iris); A(10 + dx, y, iris); }
    if (st !== FACE.think) { A(6, 8, pupil); A(9, 8, pupil); }
    A(5 + dx, 7, hi); A(9 + dx, 7, hi);
    if (st === FACE.smile) { A(4, 8, lid); A(5, 8, lid); A(6, 8, lid); A(9, 8, lid); A(10, 8, lid); A(11, 8, lid); }
    if (f.lash) { for (const x of [4, 5, 6, 9, 10, 11]) A(x, rows[0] - 1, lid); A(3, rows[0] - 1, lid); A(12, rows[0] - 1, lid); }
  }
  if (f.glasses) {
    const c = rgb(f.glasses);
    for (let x = 3; x <= 7; x++) { A(x, 6, c); A(x, 9, c); } for (let x = 8; x <= 12; x++) { A(x, 6, c); A(x, 9, c); }
    for (let y = 6; y <= 9; y++) { A(3, y, c); A(12, y, c); } A(7, 7, c); A(8, 7, c);
  }
  if (f.shades) {
    const c = rgb(f.shades);
    for (let x = 3; x <= 12; x++) { A(x, 7, c); A(x, 8, c); } A(4, 7, [120, 200, 230]); A(10, 7, [120, 200, 230]); for (let x = 3; x <= 12; x++) A(x, 6, [30, 24, 36]);
  }
  // nose shade, cheeks, freckles
  T(7, 10, 212); T(8, 10, 212); T(7, 9, 236);
  if (f.blush) { const b = [255, 196, 200]; T(3, 10, b); T(4, 10, b); T(11, 10, b); T(12, 10, b); }
  if (f.freckles) { T(4, 9, 196); T(3, 11, 200); T(5, 11, 204); T(11, 9, 196); T(12, 11, 200); T(10, 11, 204); }
  // stubble: darker speckles of skin round the jaw and the upper lip (the mouth is drawn over it)
  if (f.stubble) for (let y = 11; y < 16; y++) for (let x = 2; x < 14; x++) { const edge = x < 4 || x > 11 || y > 12; if ((edge || (y === 11 && x > 4 && x < 11)) && hash(x, y, 31) < 0.62) T(x, y, 150 + Math.round(hash(x, y, 5) * 40)); }
  // beard / moustache
  if (f.beard) { const c = rgb(f.beard); for (let x = 3; x <= 12; x++) { A(x, 15, c); if (x < 6 || x > 9) A(x, 14, c); } for (let y = 9; y < 14; y++) { A(2, y, c); A(13, y, c); if (y > 11) { A(3, y, c); A(12, y, c); } } T(7, 14, 200); T(8, 14, 200); }
  if (f.stache) { const c = rgb(f.stache); for (let x = 5; x <= 10; x++) A(x, 11, c); A(4, 12, c); A(11, 12, c); }
  // mouth
  if (st === FACE.talkA) { A(6, 12, mouth); A(7, 12, white); A(8, 12, white); A(9, 12, mouth); for (let x = 6; x <= 9; x++) A(x, 13, dark); A(7, 13, [200, 90, 100]); A(8, 13, [200, 90, 100]); }
  else if (st === FACE.talkB) { A(7, 12, dark); A(8, 12, dark); A(7, 13, mouth); A(8, 13, mouth); }
  else if (st === FACE.smile) { A(5, 11, mouth); A(10, 11, mouth); for (let x = 6; x <= 9; x++) A(x, 12, mouth); A(7, 12, white); A(8, 12, white); }
  else if (st === FACE.think) { A(8, 12, mouth); A(9, 12, mouth); A(10, 12, mouth); }
  else if (st === FACE.wow) { A(7, 11, mouth); A(8, 11, mouth); A(7, 12, dark); A(8, 12, dark); A(7, 13, dark); A(8, 13, dark); A(6, 12, mouth); A(9, 12, mouth); }
  else if (st === FACE.sure) { A(6, 12, mouth); A(7, 12, mouth); A(8, 12, mouth); A(9, 11, mouth); }
  else { for (let x = 6; x <= 9; x++) A(x, 12, mouth); if (f.lip) { A(7, 13, mouth.map((v) => Math.min(255, v + 30))); A(8, 13, mouth.map((v) => Math.min(255, v + 30))); } }
}

// decals: '.' keeps the block's colour, the letters are their own colours
const DECALS = {
  [PAT.bolt]: ['................', '.........kkkk...', '........kyyk....', '.......kyyk.....', '......kyyk......', '.....kyykkkk....', '....kyyyyyyk....',
    '....kkkkyyk.....', '.......kyyk.....', '......kyyk......', '......kyk.......', '.....kyk........', '.....kk.........', '................', '................', '................'],
  [PAT.star]: ['................', '.......mm.......', '.......mm.......', '......mmmm......', 'mmmmmmmwwmmmmmm.', '.mmmmmwwwwmmmm..', '...mmmmwwmmmm...', '....mmmmmmmm....',
    '....mmmmmmmm....', '...mmmm..mmmm...', '...mmm....mmm...', '..mm........mm..', '................', '................', '................', '................'],
  [PAT.badge]: ['................', '................', '.wwwwwwwwwwwwww.', '.wkkkkwkkkwkkkw.', '.wwwwwwwwwwwwww.', '.wkkwkkkkkwkkkw.', '.wwwwwwwwwwwwww.', '................',
    '................', '................', '................', '................', '................', '................', '................', '................'],
  [PAT.heart]: ['................', '................', '...mmm...mmm....', '..mmwmm.mmmmm...', '..mwmmmmmmmmm...', '..mmmmmmmmmmm...', '...mmmmmmmmm....', '....mmmmmmm.....',
    '.....mmmmm......', '......mmm.......', '.......m........', '................', '................', '................', '................', '................'],
};
const DCOL = { k: [34, 32, 58], y: [255, 225, 74], m: [255, 63, 180], w: [255, 250, 240] };

function drawPattern(put, i) {
  const T = (x, y, v) => put(x, y, g(Math.max(0, Math.min(255, Math.round(v)))), false);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = hash(x, y, i);
    let v = 255;
    if (i === PAT.weave) v = 242 + n * 13 - ((x + y) % 2 ? 0 : 3);
    else if (i === PAT.rib) v = x % 2 ? 250 : 226;
    else if (i === PAT.denim) v = ((x + y) % 4 === 0 ? 222 : 246) - n * 8;
    else if (i === PAT.seam) v = y === 15 ? 206 : y === 13 && x % 4 < 2 ? 255 : 240 - n * 6;
    else if (i === PAT.hair) { const c = hash(x, 0, 99); v = 214 + c * 41 - (hash(x, y >> 2, 7) > 0.8 ? 24 : 0); }
    else if (i === PAT.sequin) v = (x + (y % 2)) % 2 ? 255 : 200 + n * 30;
    else if (i === PAT.tread) v = y % 3 === 0 ? 150 : 236;
    else if (i === PAT.leather) v = 238 + n * 14 - (hash(x >> 1, y, 5) > 0.88 ? 22 : 0);
    else if (i === PAT.stripe) v = y % 8 < 2 ? 206 : 250;
    else if (i === PAT.check) v = (((x >> 2) + (y >> 2)) % 2 ? 252 : 222) - (x % 4 === 0 || y % 4 === 0 ? 10 : 0);
    else if (i === PAT.knit) v = (x + (y % 2)) % 2 ? 250 : 230;
    else if (i === PAT.curl) { const cx = (x + (y >> 2) * 2) % 4 - 1.5, cy = y % 4 - 1.5, d = cx * cx + cy * cy; v = d < 1.2 ? 252 : d < 2.6 ? 228 : 196; }
    else if (i === PAT.braid) v = x % 8 === 0 ? 168 : ((x % 8 < 4) === ((y >> 1) % 2 === 0) ? 250 : 212) - n * 10;
    else if (i === PAT.fuzz) v = n > 0.45 ? 250 : 214;
    T(x, y, v);
  }
  const D = DECALS[i];
  if (D) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = D[y][x]; if (ch !== '.') put(x, y, DCOL[ch], true); }
}

// An atlas: one row of eight face states per face spec, then three rows of fabrics, decals and hair.
export function makeAtlas(faces) {
  const rows = faces.length + 3, W = COLS * CELL, H = rows * CELL, data = new Uint8Array(W * H * 4);
  const at = (cx, cy) => (x, y, c, abs) => { const i = ((cy * CELL + 15 - y) * W + cx * CELL + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = abs ? 128 : 255; };
  faces.forEach((f, r) => { for (let s = 0; s < 8; s++) drawFace(at(s, r), s, f); });
  for (let i = 0; i < PAT_N; i++) drawPattern(at(i % 8, faces.length + (i >> 3)), i);
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return { tex, rows, patRow: faces.length };
}

// ---- geometry ----------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _nv = new THREE.Vector3();

// polygons of a chamfered box (half extents h, chamfer b), each with an approximate outward normal
function boxPolys(hx, hy, hz, b) {
  const h = [hx, hy, hz], S = [-1, 1], out = [];
  const pt = (s, a) => [0, 1, 2].map((k) => s[k] * (k === a ? h[k] : h[k] - b));
  for (let a = 0; a < 3; a++) for (const sa of S) {
    const pts = [], n = [0, 0, 0], o1 = (a + 1) % 3, o2 = (a + 2) % 3; n[a] = sa;
    for (const s1 of S) for (const s2 of S) { const s = [0, 0, 0]; s[a] = sa; s[o1] = s1; s[o2] = s2; pts.push(pt(s, a)); }
    out.push({ pts, n });
  }
  if (b > 0) {
    for (let a = 0; a < 3; a++) {
      const c = (a + 1) % 3, f = (a + 2) % 3;
      for (const sa of S) for (const sc of S) {
        const pts = [], n = [0, 0, 0]; n[a] = sa; n[c] = sc;
        for (const sf of S) { const s = [0, 0, 0]; s[a] = sa; s[c] = sc; s[f] = sf; pts.push(pt(s, a), pt(s, c)); }
        out.push({ pts, n });
      }
    }
    for (const sx of S) for (const sy of S) for (const sz of S) { const s = [sx, sy, sz]; out.push({ pts: [pt(s, 0), pt(s, 1), pt(s, 2)], n: s }); }
  }
  return out;
}
// order a convex polygon's points counter-clockwise around n
function order(pts, n) {
  const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  _nv.set(n[0], n[1], n[2]).normalize();
  _a.set(1, 0, 0); if (Math.abs(_nv.x) > 0.9) _a.set(0, 1, 0);
  _a.cross(_nv).normalize(); _b.copy(_nv).cross(_a);
  return pts.map((p) => { _p.set(p[0] - c[0], p[1] - c[1], p[2] - c[2]); return [Math.atan2(_p.dot(_b), _p.dot(_a)), p]; }).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
}

// Emit polygons as a non-indexed geometry with the full attribute set.
// o: { x, y, z, rx, ry, rz, col, pat, cell, mode, alt, role, shade, slot, uv (per-polygon fixed 0..1 uvs), atlas }
//   slot: a hair slot (shown or hidden by the character's hair mask, see HAIR below), -1 = always drawn
function emit(polys, o) {
  const P = [], N = [], C = [], U = [], CE = [], AL = [], RO = [];
  _m.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YZX')), _a.set(1, 1, 1));
  _n3.getNormalMatrix(_m);
  _c.set(o.col);
  const cell = o.cell, ox = o.x || 0, oy = o.y || 0, oz = o.z || 0;
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const poly of polys) {
    const pts = poly.ordered ? poly.pts : order(poly.pts, poly.n);
    // faces that end up inside a given box (a hair piece's side against the head) are never seen: left out
    if (o.inside) {
      const I = o.inside; v.set(0, 0, 0);
      for (const p of pts) v.x += p[0] / pts.length, v.y += p[1] / pts.length, v.z += p[2] / pts.length;
      v.applyMatrix4(_m);
      if (v.x > I[0] && v.x < I[1] && v.y > I[2] && v.y < I[3] && v.z > I[4] && v.z < I[5]) continue;
    }
    // flat normal (local), then the texel projection along its dominant axis
    e1.set(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]);
    e2.set(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]);
    nn.crossVectors(e1, e2).normalize();
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    const proj = (p) => (ax >= ay && ax >= az ? [(p[2] + oz) * Math.sign(nn.x), p[1] + oy] : ay >= az ? [p[0] + ox, p[2] + oz] : [(p[0] + ox) * Math.sign(nn.z), p[1] + oy]);
    const wn = nn.clone().applyMatrix3(_n3).normalize();
    const k = o.shade ? Math.min(1, Math.max(0.5, 0.8 + 0.2 * wn.y + 0.06 * wn.z)) : 1;
    for (let i = 1; i < pts.length - 1; i++) for (const j of [0, i, i + 1]) {
      const p = pts[j];
      v.set(p[0], p[1], p[2]).applyMatrix4(_m);
      P.push(v.x, v.y, v.z); N.push(wn.x, wn.y, wn.z); C.push(_c.r * k, _c.g * k, _c.b * k);
      if (poly.uv) U.push(poly.uv[j][0], poly.uv[j][1]); else { const t = proj(p); U.push(t[0] / TILE, t[1] / TILE); }
      CE.push(cell[0], cell[1], o.mode || 0); AL.push((o.alt || 0) + 4 * ((o.slot ?? -1) + 1)); RO.push(o.role === undefined ? -1 : o.role);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('aTex', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('aCell', new THREE.Float32BufferAttribute(CE, 3));
  geo.setAttribute('aAlt', new THREE.Float32BufferAttribute(AL, 1));
  geo.setAttribute('aRole', new THREE.Float32BufferAttribute(RO, 1));
  return geo;
}

// A kit of piece makers bound to an atlas (and, for the courier, an outfit role table).
//   K.B(w, h, d, x, y, z, col, pat, opts)   chamfered block (small ones stay sharp: cheaper)
//   K.C(rt, rb, h, seg, x, y, z, col, opts) cylinder (wheels)
//   K.face(w, h, x, y, z, col)              the face plate (+z)
//   K.decal(w, h, x, y, z, col, pat, opts)  a decal plate (+z, or opts.ry = PI for the back)
// col: a hex colour, or a role name when the kit has roles. opts: { rx, ry, rz, b, alt, slot }
export function kit(atlas, { roles = null, shade = false } = {}) {
  const cellOf = (pat) => { const i = typeof pat === 'number' ? pat : PAT[pat || 'plain']; return [i % 8, atlas.patRow + (i >> 3)]; };
  const colOf = (c) => (roles && roles[c] !== undefined ? { col: '#ffffff', role: roles[c] } : { col: c });
  const K = {
    B(w, h, d, x, y, z, c, pat, o = {}) {
      const m = Math.min(w, h, d), b = o.b !== undefined ? o.b : m < 0.045 ? 0 : Math.min(0.016, m * 0.16);
      return emit(boxPolys(w / 2, h / 2, d / 2, b), { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, ...colOf(c), cell: cellOf(pat), alt: o.alt, shade, slot: o.slot, inside: o.inside });
    },
    C(rt, rb, h, seg, x, y, z, c, o = {}) {
      const src = new THREE.CylinderGeometry(rt, rb, h, seg).toNonIndexed(), p = src.attributes.position, polys = [];
      for (let i = 0; i < p.count; i += 3) {
        const pts = [0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
        if (_a.set(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]).cross(_b.set(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2])).lengthSq() < 1e-12) continue;
        polys.push({ pts, ordered: true });
      }
      src.dispose();
      return emit(polys, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, ...colOf(c), cell: cellOf(o.pat), alt: o.alt, shade, slot: o.slot });
    },
    face(w, h, x, y, z, c, o = {}) {
      const pts = [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]];
      return emit([{ pts, ordered: true, uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }], { x, y, z, ...colOf(c), cell: [0, 0], mode: 1, alt: o.alt, shade });
    },
    decal(w, h, x, y, z, c, pat, o = {}) {
      const pts = [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]];
      return emit([{ pts, ordered: true, uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }], { x, y, z, ry: o.ry, rx: o.rx, rz: o.rz, ...colOf(c), cell: cellOf(pat), mode: DECAL.has(PAT[pat]) ? 2 : 0, alt: o.alt, shade });
    },
  };
  return K;
}

export const mergeParts = (list) => { const m = mergeGeometries(list, false); list.forEach((x) => x.dispose()); return m; };

// One skinned mesh for a whole character: each entry is [pivot object, pieces in its local space].
// Every vertex follows exactly one pivot (rigid skinning), so the pivots animate it as before.
export function rig(entries, mat) {
  const list = [];
  entries.forEach(([, geos], bi) => {
    for (const gq of geos) {
      const n = gq.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      gq.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      gq.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      list.push(gq);
    }
  });
  const geo = mergeParts(list);
  const bones = entries.map((e) => e[0]);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
  mesh.frustumCulled = false;
  return mesh;
}

// ---- material ------------------------------------------------------------------------------------------
// Lambert (or unlit Basic) with vertex colours, the atlas on top and the face state picked in the shader.
//   inst: instanced, with per-instance second / third colours (aColB, aColC)
//   face: instanced heads pick their face row from aFaceI and blink on their own
//   rim:  a uniform { value: Color } for a soft rim light (indoors)
//   hair: the hair slots (in aAlt) are masked: per instance (aHairM, with inst) or by a uniform { value: Vector2 }
export function blockyMaterial({ atlas, basic = false, inst = false, face = false, row = 0, rim = null, hair = null } = {}) {
  const M = basic ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  const U = { uAtlas: { value: atlas.tex }, uGrid: { value: new THREE.Vector2(COLS, atlas.rows) }, uFace: { value: new THREE.Vector2(0, row) }, uTime: timeU };
  M.userData.face = U.uFace.value;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (rim) sh.uniforms.uRim = rim;
    if (hair && hair !== true) sh.uniforms.uHairM = hair;
    let vs = sh.vertexShader;
    // a hidden hair slot collapses to a point (its triangles vanish): bit (slot % 24) of mask x (slots 0-23) or y (24-47)
    if (hair) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float slot = floor(aAlt / 4.0) - 1.0;
          if (slot > -0.5) { vec2 hm = ${hair === true ? 'aHairM' : 'uHairM'}; float sb = slot < 23.5 ? slot : slot - 24.0, mk = slot < 23.5 ? hm.x : hm.y;
            if (mod(floor(mk / exp2(sb)), 2.0) < 0.5) transformed = vec3(0.0); } }`);
    sh.vertexShader = 'attribute vec2 aTex; attribute vec3 aCell; attribute float aAlt; varying vec2 vTex; varying vec3 vCell; uniform vec2 uFace; uniform float uTime;\n'
      + (inst ? 'attribute vec3 aColB; attribute vec3 aColC;\n' : '') + (face ? 'attribute float aFaceI;\n' : '')
      + (hair ? (hair === true ? 'attribute vec2 aHairM;\n' : 'uniform vec2 uHairM;\n') : '')
      + vs.replace('#include <color_vertex>', `#include <color_vertex>
        vTex = aTex; vCell = aCell;
        if (aCell.z > 0.5 && aCell.z < 1.5) vCell.xy = ${face ? 'vec2(step(0.975, fract(uTime * 0.23 + float(gl_InstanceID) * 0.618034)), aFaceI)' : 'uFace'};
        ${inst ? '{ float al = mod(aAlt, 4.0); if (al > 0.5) vColor.xyz = al > 2.5 ? color.xyz : color.xyz * (al > 1.5 ? aColC : aColB); }' : ''}`);
    sh.fragmentShader = 'uniform sampler2D uAtlas; uniform vec2 uGrid; varying vec2 vTex; varying vec3 vCell;\n' + (rim ? 'uniform vec3 uRim;\n' : '')
      + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 f = vCell.z > 0.5 ? clamp(vTex, 0.0, 0.999) : fract(vTex);
          f = (floor(f * 16.0) + 0.5) / 16.0;
          vec4 tx = texture2D(uAtlas, (vCell.xy + f) / uGrid);
          diffuseColor.rgb = tx.a > 0.75 ? diffuseColor.rgb * tx.rgb : tx.rgb;
        }`);
    if (!basic) lampPatch(sh);
    if (rim) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);');
  };
  M.customProgramCacheKey = () => `blocky-${basic ? 1 : 0}${inst ? 1 : 0}${face ? 1 : 0}${rim ? 1 : 0}${hair ? (hair === true ? 1 : 2) : 0}`;
  return M;
}

// Per-instance second / third colours, face rows and hair masks for an InstancedMesh.
export function instExtras(mesh, face = false, hair = false) {
  const n = mesh.count, geo = mesh.geometry, c = new THREE.Color();
  const B = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3), C = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
  geo.setAttribute('aColB', B); geo.setAttribute('aColC', C);
  const F = face ? new THREE.InstancedBufferAttribute(new Float32Array(n), 1) : null;
  if (F) geo.setAttribute('aFaceI', F);
  const HM = hair ? new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2) : null;
  if (HM) geo.setAttribute('aHairM', HM);
  return {
    hair(i, m) { if (HM) { HM.setXY(i, m[0], m[1]); HM.needsUpdate = true; } },
    b(i, hex) { c.set(hex); B.setXYZ(i, c.r, c.g, c.b); B.needsUpdate = true; },
    c(i, hex) { c.set(hex); C.setXYZ(i, c.r, c.g, c.b); C.needsUpdate = true; },
    face(i, v) { if (F) { F.setX(i, v); F.needsUpdate = true; } },
  };
}

// Blink, talk and expressions for one character's face (u: the material's face vector; u.x = state).
export function faceDriver(u, reduced = false) {
  let bt = 1 + Math.random() * 3, bl = 0, tt = Math.random() * 9;
  return (dt, talking, expr) => {
    bt -= dt; tt += dt;
    if (bt <= 0) { bl = 0.13; bt = 2.2 + Math.random() * 3.5; }
    bl = Math.max(0, bl - dt);
    let s = EXPR[expr] || FACE.neutral;
    if (talking) {
      const k = reduced ? 1 : Math.sin(tt * 15) * (0.6 + 0.4 * Math.sin(tt * 4.7));
      s = k > 0.3 ? FACE.talkA : k > -0.25 ? FACE.talkB : s;
    } else if (bl > 0) s = FACE.blink;
    u.x = s;
    return s;
  };
}

// ---- shared atlases ---------------------------------------------------------------------------------------
// the story cast (row per character) and the city's crowd (eight face variants)
export const CAST_ROW = { SKYE: 0, DEE: 1, GLITZ: 2, GUS: 3, KILO: 4, TAPS: 5, ZIZI: 6, MIMI: 7, DOT: 8, TOKEN: 9, HAZEL: 10, KIKI: 11, RUDY: 12, BIRDIE: 13, LEO: 14, JUNE: 15, SKYE_STUBBLE: 16, DOLLY: 17, BRENDA: 18, VAUGHN: 19 };
const CAST_FACES = [
  { iris: '#1f7f86', brow: '#2a2140', freckles: true },                                   // Skye
  { iris: '#6a3a1a', brow: '#b02a6a', lash: true, lip: '#d42f6e', blush: true },           // Dee
  { iris: '#2a1a10', brow: '#22203a', thick: true, stache: '#22203a' },                     // Marty Glitz
  { iris: '#2f5f8a', brow: '#2a1a12', glasses: '#22203a' },                                 // Gus
  { iris: '#2a1a10', brow: '#2a1a10', beard: '#3a2418' },                                    // DJ Kilowatt
  { iris: '#3a2a1a', brow: '#1b1830', stache: '#1b1830' },                                  // Taps
  { iris: '#1f8f86', brow: '#178a82', lash: true, freckles: true, blush: true },            // Zizi Sparks
  { iris: '#3a1a0a', brow: '#22203a', lash: true, lip: '#e8235f', blush: true },            // Mimi
  { iris: '#2f6f5a', brow: '#c0401a', lash: true, lip: '#e0304a', blush: true, freckles: true },  // Dot, the diner
  { iris: '#2a1a10', brow: '#1b1410' },                                                     // Token, the arcade
  { iris: '#4a6a8a', brow: '#b8a8c8', lash: true, lip: '#c85a7a', glasses: '#c0407a' },    // Hazel, the motel
  { iris: '#3a2410', brow: '#3a2410', lash: true, lip: '#d0406a', blush: true },            // Kiki, the galleria
  { iris: '#2a5a8a', brow: '#d8d8d8', thick: true, beard: '#e4e4e8' },                       // Rudy, the bait shop
  { iris: '#5a3a20', brow: '#c8c8d0', lash: true, lip: '#b8405a', blush: true },            // Birdie, the Blue Pelican Lounge
  { iris: '#3a2a1a', brow: '#a8a8b0', thick: true, stache: '#b0b0b8' },                     // Leo, the Solstice Spire's concierge
  { iris: '#2a6a5a', brow: '#d0502a', lash: true, lip: '#d04050', blush: true, freckles: true },  // June, the Afterglow Bar
  { iris: '#1f7f86', brow: '#2a2140', freckles: true, stubble: true },                       // Skye with stubble (the salon)
  { iris: '#5a3a1a', brow: '#3a1a2a', lash: true, lip: '#e0306a', blush: true },            // Dolly, Fade & Fringe
  { iris: '#2f6fa8', brow: '#c8a860', lash: true, lip: '#ff6a8a', blush: true },            // Brenda, Coral Keys Realty
  { iris: '#3a2a1a', brow: '#8a8a94', thick: true },                                        // Vaughn, Skyline Estates
];
const CROWD_FACES = [
  { iris: '#4a2a14', brow: '#2a1a12' },                                         // 0  m
  { iris: '#2f6fa8', brow: '#5a3a1a', lash: true, lip: '#c8406a' },               // 1  f
  { iris: '#2f7a3a', brow: '#a0703a', freckles: true },                           // 2  m
  { iris: '#3a2a1a', brow: '#1b1410', glasses: '#2a2140' },                       // 3  m
  { iris: '#3a2410', brow: '#2a1a12', thick: true, stubble: true },               // 4  m, stubble
  { iris: '#4a3a2a', brow: '#8a8a90', thick: true },                              // 5  m, older
  { iris: '#2a1a10', brow: '#22203a', lash: true, blush: true, lip: '#b02a3a' },  // 6  f
  { iris: '#2a1a10', brow: '#3a2a1a', shades: '#1b1830' },                        // 7  m
  { iris: '#2f7a5a', brow: '#8a4a2a', lash: true, lip: '#e05a6a', freckles: true, blush: true },  // 8  f
  { iris: '#3a2a1a', brow: '#2a1a12', lash: true, lip: '#a8405a', glasses: '#c0407a' },          // 9  f
  { iris: '#2a1a10', brow: '#1b1410', lash: true, lip: '#d0306a', shades: '#2a1a3a' },           // 10 f
  { iris: '#2f5f8a', brow: '#4a3020', stubble: true },                            // 11 m, stubble
  { iris: '#4a5a6a', brow: '#a8a8b0', lash: true, lip: '#a85a6a', blush: true },  // 12 f, older
];
let castA = null, crowdA = null;
export const castAtlas = () => castA || (castA = makeAtlas(CAST_FACES));
export const crowdAtlas = () => crowdA || (crowdA = makeAtlas(CROWD_FACES));
export const CROWD_FACE_N = CROWD_FACES.length;

// ---- hair ------------------------------------------------------------------------------------------------
// Hairstyles are built from chamfer-free blocks in "slots" (a shared set of pieces round a unit head: the
// crowd's 0.26 x 0.26 x 0.24 head with its centre 0.13 up), scaled onto any head. A character's hair is a mask of
// slots: the crowd's heads carry every slot and pick theirs per instance (one draw call for everyone), Skye
// carries every slot with a uniform mask (the salon only changes the mask and a colour), the cast build just
// their own. Pieces marked `top` sit on the crown: a hat hides them (a hat flattens the top, ponytails, buns at
// the nape, long hair and braids still hang below it).
//   [w, h, d, x, y, z, { top, pat, rx, rz, ry }]
const HP = {
  cap: [0.272, 0.03, 0.25, 0, 0.262, -0.005], back: [0.272, 0.17, 0.022, 0, 0.17, -0.127], sideL: [0.018, 0.075, 0.17, 0.138, 0.212, -0.035], sideR: [0.018, 0.075, 0.17, -0.138, 0.212, -0.035],
  crew: [0.25, 0.035, 0.22, 0, 0.292, -0.005, { top: 1 }], fringe: [0.21, 0.03, 0.022, 0.015, 0.243, 0.125, { rz: -0.08 }],
  partTop: [0.2, 0.05, 0.23, 0.035, 0.295, 0.0, { top: 1 }], sweep: [0.13, 0.04, 0.07, -0.07, 0.28, 0.085, { top: 1, rz: 0.28 }],
  slick: [0.262, 0.05, 0.25, 0, 0.29, -0.02, { top: 1, rx: -0.1 }], pomp: [0.22, 0.09, 0.11, 0, 0.33, 0.075, { top: 1, rx: -0.3 }],
  nape: [0.22, 0.08, 0.04, 0, 0.06, -0.125], mullet: [0.24, 0.2, 0.035, 0, -0.01, -0.133],
  volTop: [0.32, 0.1, 0.3, 0, 0.31, -0.015, { top: 1, pat: 'curl' }], volL: [0.045, 0.29, 0.26, 0.158, 0.125, -0.025, { pat: 'curl' }], volR: [0.045, 0.29, 0.26, -0.158, 0.125, -0.025, { pat: 'curl' }],
  afroBack: [0.32, 0.25, 0.05, 0, 0.16, -0.145, { pat: 'curl' }], permBack: [0.32, 0.42, 0.055, 0, 0.06, -0.148, { pat: 'curl' }], permFringe: [0.27, 0.055, 0.04, 0, 0.245, 0.122, { pat: 'curl' }],
  curly: [0.27, 0.07, 0.25, 0, 0.3, -0.005, { top: 1, pat: 'curl' }], flat: [0.25, 0.11, 0.23, 0, 0.32, -0.005, { top: 1, pat: 'fuzz' }],
  longBack: [0.28, 0.44, 0.04, 0, 0.05, -0.135], hairL: [0.028, 0.21, 0.22, 0.142, 0.14, -0.012], hairR: [0.028, 0.21, 0.22, -0.142, 0.14, -0.012],
  bangs: [0.25, 0.045, 0.024, 0, 0.226, 0.126], ponyTie: [0.07, 0.06, 0.06, 0, 0.235, -0.15], ponyTail: [0.065, 0.24, 0.055, 0, 0.1, -0.175, { rx: 0.18 }],
  sideTie: [0.06, 0.06, 0.06, 0.13, 0.14, -0.1], sideTail: [0.055, 0.2, 0.055, 0.16, 0.02, -0.07, { rz: -0.12 }],
  bobBack: [0.28, 0.22, 0.04, 0, 0.13, -0.134], braidL: [0.11, 0.4, 0.04, 0.065, 0.04, -0.138, { pat: 'braid' }], braidR: [0.11, 0.4, 0.04, -0.065, 0.04, -0.138, { pat: 'braid' }],
  braidSL: [0.035, 0.3, 0.035, 0.14, 0.06, 0.03, { pat: 'braid' }], braidSR: [0.035, 0.3, 0.035, -0.14, 0.06, 0.03, { pat: 'braid' }],
  bun: [0.12, 0.1, 0.11, 0, 0.31, -0.07, { top: 1, pat: 'braid' }], bunL: [0.09, 0.09, 0.09, 0.1, 0.305, -0.02, { top: 1, pat: 'braid' }], bunR: [0.09, 0.09, 0.09, -0.1, 0.305, -0.02, { top: 1, pat: 'braid' }],
  crest: [0.06, 0.11, 0.26, 0, 0.31, -0.01, { top: 1 }], crestBack: [0.06, 0.16, 0.03, 0, 0.17, -0.133],
  under: [0.2, 0.06, 0.23, 0, 0.29, 0.0, { top: 1 }], horseB: [0.272, 0.1, 0.022, 0, 0.13, -0.127], horseL: [0.018, 0.06, 0.14, 0.138, 0.17, -0.045], horseR: [0.018, 0.06, 0.14, -0.138, 0.17, -0.045],
  // facial hair
  stache: [0.11, 0.024, 0.016, 0, 0.088, 0.127], chin: [0.14, 0.05, 0.03, 0, 0.03, 0.115], jawL: [0.03, 0.12, 0.07, 0.12, 0.07, 0.09], jawR: [0.03, 0.12, 0.07, -0.12, 0.07, 0.09],
};
export const HAIR_SLOTS = Object.keys(HP);                // slot index = position in this list (< 47)
export const CAP_SLOT = 47;                               // Skye's backwards cap (player.js)
const SI = Object.fromEntries(HAIR_SLOTS.map((k, i) => [k, i]));
const BASE = ['cap', 'back', 'sideL', 'sideR'];
// g: who wears it mostly (m / f / u), w: crowd weights [men, women], old: weight among the older crowd
export const HAIR_STYLES = [
  { id: 'shag', name: 'COURIER SHAG', note: 'Choppy layers, a short fringe, a tail at the nape. The original.', price: 45, s: [...BASE, 'crew', 'fringe', 'nape'], w: [3, 4] },
  { id: 'buzz', name: 'BUZZ CUT', note: 'Clippers all over. Five minutes, zero fuss.', price: 25, s: BASE, w: [10, 1], old: [4, 0] },
  { id: 'crew', name: 'CREW CUT', note: 'Short back and sides, a little length on top.', price: 30, s: [...BASE, 'crew'], w: [12, 1], old: [5, 0] },
  { id: 'sidepart', name: 'SIDE PART', note: 'A sharp parting and a comb in the back pocket.', price: 40, s: [...BASE, 'partTop', 'sweep'], w: [10, 2], old: [6, 1] },
  { id: 'slick', name: 'SLICKED BACK', note: 'Combed straight back with a shine. Boardroom by day.', price: 40, s: [...BASE, 'slick'], w: [7, 1], old: [4, 0] },
  { id: 'pomp', name: 'POMPADOUR', note: 'A tall rolled front. Hairspray sold separately.', price: 55, s: [...BASE, 'crew', 'pomp'], w: [5, 1], old: [1, 0] },
  { id: 'mullet', name: 'MULLET', note: 'Business up front, beach party at the back.', price: 45, s: [...BASE, 'crew', 'fringe', 'mullet'], w: [7, 1] },
  { id: 'curly', name: 'CURLY TOP', note: 'Tight curls on top, faded down the sides.', price: 45, s: [...BASE, 'curly'], w: [7, 2] },
  { id: 'afro', name: 'AFRO', note: 'Round, proud and picked out to perfection.', price: 60, s: ['cap', 'volTop', 'volL', 'volR', 'afroBack'], w: [5, 6] },
  { id: 'flattop', name: 'FLAT-TOP', note: 'Squared off with a spirit level. Very 1986.', price: 50, s: [...BASE, 'flat'], w: [5, 0] },
  { id: 'long', name: 'LONG STRAIGHT', note: 'Down past the shoulders, middle parting.', price: 50, s: ['cap', 'longBack', 'hairL', 'hairR'], w: [2, 14], old: [0, 2] },
  { id: 'perm', name: 'BIG PERM', note: 'Volume, waves and a cloud of setting spray. Peak 80s.', price: 70, s: ['cap', 'volTop', 'volL', 'volR', 'permBack', 'permFringe'], w: [1, 12], old: [0, 3] },
  { id: 'pony', name: 'HIGH PONYTAIL', note: 'Pulled up and swinging. Made for skating.', price: 40, s: [...BASE, 'fringe', 'ponyTie', 'ponyTail'], w: [1, 9] },
  { id: 'sidepony', name: 'SIDE PONYTAIL', note: 'Over one shoulder with a scrunchie. Totally rad.', price: 40, s: [...BASE, 'bangs', 'sideTie', 'sideTail'], w: [0, 5] },
  { id: 'bob', name: 'BOB', note: 'Jaw-length with straight bangs. Crisp.', price: 45, s: ['cap', 'bobBack', 'hairL', 'hairR', 'bangs'], w: [0, 10], old: [0, 5] },
  { id: 'pixie', name: 'PIXIE CUT', note: 'Cropped close with a swept fringe.', price: 40, s: [...BASE, 'crew', 'sweep'], w: [1, 6], old: [0, 3] },
  { id: 'braids', name: 'BOX BRAIDS', note: 'Long braids down the back and two at the front.', price: 80, s: ['cap', 'back', 'braidL', 'braidR', 'braidSL', 'braidSR'], w: [3, 7] },
  { id: 'bun', name: 'TOP BUN', note: 'Everything up in a neat knot on the crown.', price: 35, s: [...BASE, 'bun'], w: [1, 6], old: [0, 4] },
  { id: 'spacebuns', name: 'SPACE BUNS', note: 'Two buns, one galaxy.', price: 45, s: [...BASE, 'bunL', 'bunR'], w: [0, 3] },
  { id: 'mohawk', name: 'MOHAWK', note: 'Shaved sides, a crest down the middle. Loud.', price: 55, s: ['crest', 'crestBack'], w: [2, 1] },
  { id: 'undercut', name: 'SHAVED SIDES', note: 'Clippered sides, a block of length on top.', price: 45, s: ['under', 'sweep'], w: [5, 2] },
  { id: 'bald', name: 'CLEAN SHAVE', note: 'All of it, gone. Very aerodynamic.', price: 20, s: [], w: [2, 0], old: [3, 0] },
  { id: 'horseshoe', name: 'CLASSIC RECEDE', note: 'Bald on top, neat round the sides.', price: 25, s: ['horseB', 'horseL', 'horseR'], w: [0, 0], old: [8, 0] },
];
export const FACIAL = [
  { id: 'none', name: 'CLEAN-SHAVEN', note: 'Smooth as a fresh vinyl.', price: 10, s: [] },
  { id: 'stubble', name: 'STUBBLE', note: 'Three days of not bothering, on purpose.', price: 10, s: [], stubble: true },
  { id: 'stache', name: 'MOUSTACHE', note: 'A proper lip rug. Very detective.', price: 15, s: ['stache'] },
  { id: 'goatee', name: 'GOATEE', note: 'Chin and moustache, nothing else.', price: 15, s: ['stache', 'chin'] },
  { id: 'beard', name: 'FULL BEARD', note: 'Jaw to jaw. Comes with a deeper voice (it does not).', price: 20, s: ['stache', 'chin', 'jawL', 'jawR'] },
];
export const HAIR_COLORS = [
  { id: 'plum', name: 'MIDNIGHT PLUM', hex: '#2a2140', price: 35 }, { id: 'black', name: 'JET BLACK', hex: '#16110e', price: 35 },
  { id: 'dark', name: 'DARK BROWN', hex: '#3a2416', price: 35 }, { id: 'brown', name: 'CHESTNUT', hex: '#6a4022', price: 35 },
  { id: 'auburn', name: 'AUBURN', hex: '#8a301c', price: 35 }, { id: 'ginger', name: 'GINGER', hex: '#c8602a', price: 35 },
  { id: 'blonde', name: 'GOLDEN BLONDE', hex: '#dcb25e', price: 40 }, { id: 'platinum', name: 'PLATINUM', hex: '#efe4c4', price: 50 },
  { id: 'grey', name: 'STORM GREY', hex: '#8e8e96', price: 35 }, { id: 'silver', name: 'SILVER FOX', hex: '#cfcfd8', price: 40 },
  { id: 'pink', name: 'HOT PINK', hex: '#ff4fa8', price: 55, dye: 1 }, { id: 'teal', name: 'LAGOON TEAL', hex: '#1fc0b4', price: 55, dye: 1 },
  { id: 'purple', name: 'ULTRA PURPLE', hex: '#8a48d8', price: 55, dye: 1 },
];
export const hairStyle = (id) => HAIR_STYLES.find((h) => h.id === id) || HAIR_STYLES[0];
export const facialOf = (id) => FACIAL.find((f) => f.id === id) || FACIAL[0];
export const hairColor = (id) => HAIR_COLORS.find((c) => c.id === id) || HAIR_COLORS[0];
// slot lists -> the two 24-bit mask words; `hat` drops the crown pieces
const TOPS = HAIR_SLOTS.filter((k) => HP[k][6] && HP[k][6].top);
export function hairMask(slots, hat = false, extra = []) {
  const m = [0, 0];
  for (const k of slots) { if (hat && TOPS.includes(k)) continue; const i = SI[k]; m[i < 24 ? 0 : 1] += 2 ** (i % 24); }
  for (const i of extra) m[i < 24 ? 0 : 1] += 2 ** (i % 24);
  return m;
}
export const lookMask = (look, hat = false) => hairMask([...new Set([...hairStyle(look.style).s, ...facialOf(look.facial).s])], hat);
// The pieces for a head: { w, h, d, y } is the head block (centre y); col a hex colour (or a kit role), alt the
// instance colour slot. all: every slot, each tagged with its index (masked heads); otherwise only `slots`.
//   only: with all, just these slots (they keep their indices: drivers' heads carry fewer)
export function hairPieces(K, head, col, { all = false, slots = [], alt, only = null } = {}) {
  const sx = head.w / 0.26, sy = head.h / 0.26, sz = head.d / 0.24, out = [], e = 0.003;
  const inside = [-head.w / 2 + e, head.w / 2 - e, head.y - head.h / 2 + e, head.y + head.h / 2 - e, -head.d / 2 + e, head.d / 2 - e];
  for (const k of all ? (only || HAIR_SLOTS) : slots) {
    const [w, h, d, x, y, z, o = {}] = HP[k];
    out.push(K.B(w * sx, h * sy, d * sz, x * sx, head.y + (y - 0.13) * sy, z * sz, col, o.pat || 'hair', { b: 0, rx: o.rx, rz: o.rz, ry: o.ry, alt, slot: all ? SI[k] : undefined, inside }));
  }
  return out;
}
// The crowd: a hairstyle, colour and facial hair for a person, weighted so the street reads as a mix of men
// and women, young and old (grey on the older folk, dyes on the young). r: a 0..1 random source.
const wpick = (r, list, wf) => { let t = 0; for (const x of list) t += wf(x); let k = r() * t; for (const x of list) { k -= wf(x); if (k <= 0) return x; } return list[list.length - 1]; };
const NATURAL = ['black', 'black', 'dark', 'dark', 'dark', 'brown', 'brown', 'brown', 'auburn', 'ginger', 'blonde', 'blonde', 'blonde', 'platinum'];
// crowd face rows by who they are (CROWD_FACES below)
export const CROWD_F = [1, 6, 8, 9, 10], CROWD_M = [0, 2, 3, 4, 7, 11], CROWD_OLD = { m: 5, f: 12 };
// o.slots: only styles (and facial hair) made of these slots (the drivers' smaller heads)
export function pickHair(r = Math.random, o = {}) {
  const fem = o.fem ?? r() < 0.5, age = o.age ?? (r() < 0.2 ? 'old' : r() < 0.45 ? 'young' : 'adult'), gi = fem ? 1 : 0;
  const fits = (x) => !o.slots || x.s.every((k) => o.slots.includes(k));
  const style = wpick(r, HAIR_STYLES, (h) => (fits(h) ? (age === 'old' ? (h.old ? h.old[gi] : 0) : h.w[gi]) : 0));
  let color;
  if (age === 'old') color = r() < 0.75 ? (r() < 0.5 ? 'grey' : 'silver') : NATURAL[Math.floor(r() * NATURAL.length)];
  else if (r() < (age === 'young' ? 0.14 : 0.04)) color = ['pink', 'teal', 'purple'][Math.floor(r() * 3)];
  else color = NATURAL[Math.floor(r() * NATURAL.length)];
  const facial = fem ? 'none' : wpick(r, FACIAL, (f) => !fits(f) ? 0 : ({ none: age === 'young' ? 7 : 5, stubble: 2.4, stache: age === 'old' ? 2.2 : 1.2, goatee: 0.8, beard: age === 'old' ? 1.8 : 1.2 })[f.id]).id;
  const faces = age === 'old' ? [CROWD_OLD[fem ? 'f' : 'm']] : fem ? CROWD_F : CROWD_M;
  const face = facial === 'stubble' ? 4 + Math.floor(r() * 2) * 7 : faces[Math.floor(r() * faces.length)];
  return { style: style.id, color, hex: hairColor(color).hex, facial, fem, age, face };
}
// the raw pieces of a style (and facial hair), for painting it (the salon's posters, game/venuerooms.js)
export const stylePieces = (style, facial = 'none') => [...hairStyle(style).s, ...facialOf(facial).s].map((k) => HP[k]);
