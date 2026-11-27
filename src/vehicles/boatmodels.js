// The craft on the water: the four you can own (sold at Seaglass Marine on the Starboard Marina boardwalk), the
// rental jet skis, and the bay's own traffic (the ferry, two sailboats, a fishing boat). All original low-poly
// designs in the refined blocky style, built in code: a lofted hull (keel, chine, a boot stripe at the waterline,
// a sheer band, a flat deck or a cockpit well) plus boxes. Local frame: +z is the bow, +x is port (left), y = 0 is
// the design waterline, so the part below y = 0 sits under the sea.
//
// Each type is data: its handling (vehicles/boats.js reads it), its engine sound (audio/audio.js ENGINES), its deck
// (rectangles you can walk on, at their heights, ramps for stairs, blocks for furniture), its seats, the helm, the
// boarding spot and the swim-platform ladder, and the use spots (the cabin to sleep in, the bar).
import * as THREE from 'three';
import { box, cyl, tint, merge, PI } from '../core/util.js';

const W = '#f6f1e7', INK = '#22203a', TEAK = '#c8945e', GLASS = '#3f6f8f', CHROME = '#d9d6e6';

// ---------------------------------------------------------------- the hull
// L length, B beam, D draft at the keel, F sheer at the stern, Fb at the bow, floor: the cockpit well's floor
// (or null: flush deck at the sheer) as far forward as tFore, then a foredeck at the sheer
function hull(o) {
  const { L, B, D, F, Fb } = o, T = [0, 0.1, 0.25, 0.42, 0.56, 0.68, 0.79, 0.88, 0.95, 1];
  const top = new THREE.Color(o.top || W), bot = new THREE.Color(o.bottom || '#2a4a7a'), boot = new THREE.Color(o.boot || '#ff4fa3'), band = new THREE.Color(o.band || o.top || W), deck = new THREE.Color(o.deck || TEAK);
  const sec = T.map((t) => {
    const z = -L / 2 + t * L;
    const w = Math.max(0.025, (B / 2) * (t < 0.5 ? 0.92 + 0.16 * t : Math.pow(Math.cos(((t - 0.5) / 0.5) * PI / 2), 0.72)));
    const ys = F + (Fb - F) * Math.pow(t, 1.5);
    const yk = t < 0.62 ? -D : -D + (D + 0.12 * Fb) * Math.pow((t - 0.62) / 0.38, 1.5);
    const pts = [[0, yk], [w * 0.8, yk * 0.38], [w * 0.93, 0], [w * 0.955, 0.1], [w * 0.99, ys - (o.bandH ?? 0.16)], [w, ys]];
    for (let i = 1; i < pts.length; i++) if (pts[i][1] < pts[i - 1][1] + 0.01) pts[i][1] = pts[i - 1][1] + 0.01;
    return { z, w, ys, yk, pts };
  });
  const pos = [], col = [];
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k.r, k.g, k.b); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(b, d, c, k); };
  const segCol = [bot, bot, boot, top, band];
  for (let s = 0; s < sec.length - 1; s++) {
    const A = sec[s], Bs = sec[s + 1];
    for (const sx of [1, -1]) for (let j = 0; j < 5; j++) {
      const a = [A.pts[j][0] * sx, A.pts[j][1], A.z], b = [A.pts[j + 1][0] * sx, A.pts[j + 1][1], A.z], c = [Bs.pts[j][0] * sx, Bs.pts[j][1], Bs.z], d = [Bs.pts[j + 1][0] * sx, Bs.pts[j + 1][1], Bs.z];
      quad(a, b, c, d, segCol[j]);
    }
    // the deck: the cockpit well's floor, then the foredeck at the sheer; a cap along the gunwale
    const tA = s / (sec.length - 1), aft = o.floor != null && T[s + 1] <= (o.tFore ?? 0.6) + 1e-6;
    if (aft) {
      const y = o.floor, wa = A.w * 0.9, wb = Bs.w * 0.9;
      quad([-wa, y, A.z], [wa, y, A.z], [-wb, y, Bs.z], [wb, y, Bs.z], deck);
      for (const sx of [1, -1]) quad([A.w * sx, A.ys + 0.005, A.z], [(A.w - 0.14) * sx, A.ys + 0.005, A.z], [Bs.w * sx, Bs.ys + 0.005, Bs.z], [(Bs.w - 0.14) * sx, Bs.ys + 0.005, Bs.z], top);
    } else quad([-A.w, A.ys, A.z], [A.w, A.ys, A.z], [-Bs.w, Bs.ys, Bs.z], [Bs.w, Bs.ys, Bs.z], o.floor != null ? (o.fore ? new THREE.Color(o.fore) : top) : deck);
    void tA;
  }
  // the transom: a fan from its centre, painted above and below the waterline
  { const S = sec[0], c = [0, (S.yk + S.ys) / 2, S.z], ring = [...S.pts.map((p) => [p[0], p[1]]), ...S.pts.slice().reverse().map((p) => [-p[0], p[1]])];
    for (let i = 0; i < ring.length - 1; i++) { const a = ring[i], b = ring[i + 1], k = (a[1] + b[1]) / 2 < 0.02 ? bot : (a[1] + b[1]) / 2 < 0.12 ? boot : top; tri(c, [a[0], a[1], S.z], [b[0], b[1], S.z], k); } }
  // the cockpit well's front wall (where the foredeck steps up)
  if (o.floor != null) { const i = T.findIndex((t) => t >= (o.tFore ?? 0.6) - 1e-6), S = sec[i]; quad([-S.w * 0.9, o.floor, S.z], [S.w * 0.9, o.floor, S.z], [-S.w, S.ys, S.z], [S.w, S.ys, S.z], top); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return { g, sec, at: (t) => { const z = -L / 2 + t * L; let i = 0; while (i < sec.length - 2 && sec[i + 1].z < z) i++; const a = sec[i], b = sec[i + 1], k = (z - a.z) / (b.z - a.z || 1); return { w: a.w + (b.w - a.w) * k, ys: a.ys + (b.ys - a.ys) * k }; } };
}
const torus = (r, t, x, y, z, hex, rx = 0, ry = 0) => { const g = new THREE.TorusGeometry(r, t, 5, 14); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return tint(g, hex); };
// a rail on posts from (x0, z0) to (x1, z1) at height h over y
function rail(S, x0, z0, x1, z1, y, h = 0.7, n = 4, hex = CHROME) {
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
  S.push(box(0.05, 0.05, len, (x0 + x1) / 2, y + h, (z0 + z1) / 2, hex, 0, yaw));
  for (let i = 0; i <= n; i++) { const k = i / n; S.push(box(0.04, h, 0.04, x0 + (x1 - x0) * k, y + h / 2, z0 + (z1 - z0) * k, hex)); }
}
const wheel = (S, x, y, z) => { S.push(torus(0.19, 0.025, x, y, z, INK, -0.6), box(0.04, 0.04, 0.3, x, y - 0.05, z - 0.12, INK, -0.6)); };
const ladder = (S, x, z, y0, y1) => { for (const o of [-0.18, 0.18]) S.push(box(0.04, y1 - y0, 0.04, x + o, (y0 + y1) / 2, z, CHROME)); for (let y = y0 + 0.15; y < y1; y += 0.3) S.push(box(0.36, 0.03, 0.05, x, y, z, CHROME)); };

// ---------------------------------------------------------------- the jet ski: Zipfin
function jetskiGeo(p = {}) {
  const c = p.color || '#ff3f9a', a = p.accent || '#27d8cf';
  const h = hull({ L: 3.2, B: 1.16, D: 0.22, F: 0.4, Fb: 0.48, top: W, bottom: '#3a3550', boot: a, band: c, bandH: 0.14, deck: '#3a3550', floor: null });
  const S = [h.g];
  S.push(box(0.5, 0.18, 1.3, 0, 0.53, -0.4, INK), box(0.46, 0.07, 1.24, 0, 0.65, -0.4, '#2e2b48'), box(0.48, 0.04, 0.2, 0, 0.7, -0.1, c));
  S.push(box(0.9, 0.26, 1.0, 0, 0.55, 0.72, c, -0.28), box(0.74, 0.08, 0.5, 0, 0.74, 0.5, a, -0.4));
  S.push(box(0.5, 0.18, 0.04, 0, 0.88, 0.5, GLASS, -0.5));
  S.push(box(0.1, 0.32, 0.1, 0, 0.76, 0.22, INK), box(0.72, 0.045, 0.045, 0, 0.94, 0.2, CHROME), box(0.12, 0.06, 0.06, 0.37, 0.94, 0.2, INK), box(0.12, 0.06, 0.06, -0.37, 0.94, 0.2, INK));
  S.push(box(0.2, 0.05, 1.5, 0.45, 0.43, -0.45, '#4a4566'), box(0.2, 0.05, 1.5, -0.45, 0.43, -0.45, '#4a4566'));
  S.push(cyl(0.1, 0.12, 0.3, 8, 0, 0.0, -1.62, INK, PI / 2), box(1.18, 0.06, 2.0, 0, 0.27, 0.0, c));
  S.push(box(0.7, 0.06, 0.4, 0, 0.18, -1.72, '#3a3550'));
  return merge(S);
}
// ---------------------------------------------------------------- the runabout: Glintwave 19
function runaboutGeo() {
  const h = hull({ L: 6.0, B: 2.3, D: 0.38, F: 0.84, Fb: 1.02, top: W, bottom: '#1f6f8f', boot: '#ff6a8a', band: '#ff6a8a', bandH: 0.16, deck: '#e8ddc8', floor: 0.32, tFore: 0.62, fore: '#f6f1e7' });
  const S = [h.g], PK = '#ff6a8a';
  // the wrap-round windscreen with a walk-through in the middle, the two consoles
  S.push(box(0.86, 0.4, 0.05, 0.62, 1.12, 0.76, GLASS, 0.4), box(0.86, 0.4, 0.05, -0.62, 1.12, 0.76, GLASS, 0.4), box(0.05, 0.36, 0.5, 1.04, 1.08, 0.52, GLASS), box(0.05, 0.36, 0.5, -1.04, 1.08, 0.52, GLASS));
  S.push(box(0.9, 0.04, 0.06, 0.62, 1.32, 0.68, CHROME), box(0.9, 0.04, 0.06, -0.62, 1.32, 0.68, CHROME));
  S.push(box(0.7, 0.62, 0.5, -0.58, 0.63, 0.38, W), box(0.68, 0.06, 0.36, -0.58, 0.96, 0.42, INK, -0.35), box(0.7, 0.55, 0.5, 0.58, 0.6, 0.38, W));
  wheel(S, -0.58, 1.06, 0.14);
  // bucket seats at the helm, the stern bench, the outboard on the transom with swim pods either side
  for (const x of [-0.58, 0.58]) S.push(box(0.5, 0.36, 0.5, x, 0.5, -0.52, PK), box(0.5, 0.46, 0.1, x, 0.86, -0.8, PK), box(0.4, 0.06, 0.4, x, 0.7, -0.5, '#ff8aa4'));
  S.push(box(2.0, 0.38, 0.56, 0, 0.51, -2.28, PK), box(2.0, 0.36, 0.12, 0, 0.88, -2.58, PK), box(1.9, 0.06, 0.5, 0, 0.71, -2.26, '#ff8aa4'));
  S.push(box(0.46, 0.7, 0.5, 0, 0.62, -3.26, INK), box(0.52, 0.42, 0.62, 0, 1.12, -3.3, W), box(0.54, 0.06, 0.64, 0, 1.0, -3.3, PK), box(0.14, 0.9, 0.22, 0, -0.08, -3.3, '#3a3550'));
  for (const x of [-0.72, 0.72]) S.push(box(0.6, 0.07, 0.42, x, 0.2, -3.2, TEAK));
  ladder(S, 0.72, -3.42, -0.5, 0.2);
  // a bow rail and the sun pad on the foredeck
  rail(S, 0.8, 1.2, 0.2, 2.8, 0.95, 0.32, 3); rail(S, -0.8, 1.2, -0.2, 2.8, 0.95, 0.32, 3);
  S.push(box(1.4, 0.1, 1.2, 0, 1.0, 1.55, '#fff6ec'));
  S.push(box(0.06, 0.9, 0.06, 0.95, 1.25, -2.9, CHROME));
  return merge(S);
}
// ---------------------------------------------------------------- the sport yacht: Coralyne 34
function sportGeo() {
  const h = hull({ L: 10.6, B: 3.5, D: 0.72, F: 1.25, Fb: 1.75, top: W, bottom: '#22305a', boot: '#27d8cf', band: '#1f8aa0', bandH: 0.22, deck: TEAK, floor: 0.7, tFore: 0.42, fore: '#f6f1e7' });
  const S = [h.g], CUSH = '#efe6d2', AQ = '#27d8cf';
  // the cabin trunk with its window band, the raked windscreen, a hardtop over the helm on slim posts
  S.push(box(2.9, 0.75, 3.0, 0, 1.75, 1.2, W), box(2.94, 0.26, 2.4, 0, 1.86, 1.2, GLASS), box(2.92, 0.06, 3.0, 0, 2.15, 1.2, AQ));
  S.push(box(2.8, 0.06, 1.3, 0, 2.38, -0.6, GLASS, 0.55), box(2.9, 0.08, 2.4, 0, 2.86, -1.5, W), box(2.92, 0.05, 2.42, 0, 2.81, -1.5, AQ));
  for (const x of [-1.36, 1.36]) S.push(box(0.07, 1.95, 0.07, x, 1.85, -2.6, CHROME));
  // the helm: a double seat and the console, the companionway door down to the cabin
  S.push(box(1.3, 0.42, 0.6, -0.55, 0.92, -1.3, CUSH), box(1.3, 0.5, 0.14, -0.55, 1.35, -1.62, CUSH), box(1.0, 0.85, 0.5, -0.6, 1.12, -0.32, W), box(0.96, 0.06, 0.4, -0.6, 1.56, -0.3, INK, -0.4));
  wheel(S, -0.6, 1.66, -0.56);
  S.push(box(0.7, 1.2, 0.06, 0.62, 1.3, -0.22, '#8a5a3a'), box(0.08, 0.08, 0.08, 0.36, 1.3, -0.26, '#ffd166'));
  // the aft cockpit: a U of sofas round a teak table
  S.push(box(2.8, 0.42, 0.62, 0, 0.91, -4.42, CUSH), box(2.8, 0.5, 0.15, 0, 1.33, -4.76, CUSH));
  for (const x of [-1.12, 1.12]) S.push(box(0.6, 0.42, 1.5, x, 0.91, -3.4, CUSH));
  S.push(box(0.9, 0.06, 0.7, 0, 1.38, -3.4, TEAK), box(0.1, 0.62, 0.1, 0, 1.05, -3.4, CHROME));
  // the swim platform, its ladder, a step in the transom
  S.push(box(3.1, 0.12, 0.92, 0, 0.25, -5.75, TEAK), box(0.62, 0.12, 0.6, -1.2, 0.48, -5.05, TEAK));
  ladder(S, 1.0, -6.2, -0.75, 0.25);
  // the foredeck: two sun pads with bolsters, a bow rail, an anchor
  for (const x of [-0.55, 0.55]) S.push(box(1.0, 0.16, 1.9, x, 1.76, 3.55, '#fff6ec'), box(1.0, 0.16, 0.25, x, 1.9, 4.45, AQ));
  rail(S, 1.4, 2.8, 0.25, 5.1, 1.62, 0.55, 4); rail(S, -1.4, 2.8, -0.25, 5.1, 1.62, 0.55, 4);
  S.push(box(0.2, 0.12, 0.3, 0, 1.72, 5.05, CHROME));
  // a radar dome and a light mast on the hardtop
  S.push(cyl(0.3, 0.3, 0.2, 10, 0, 3.0, -1.4, W), box(0.06, 0.7, 0.06, 0.5, 3.25, -2.3, CHROME));
  return merge(S);
}
// ---------------------------------------------------------------- the motor yacht: Halcyon Grande 52
function motorGeo() {
  const h = hull({ L: 16, B: 4.9, D: 1.1, F: 1.75, Fb: 2.5, top: W, bottom: '#1b2350', boot: '#ffd166', band: '#1b2350', bandH: 0.3, deck: TEAK, floor: 1.15, tFore: 0.68, fore: '#efe6d2' });
  const S = [h.g], CUSH = '#efe6d2', NAVY = '#1b2350', GOLD = '#ffd166';
  // the saloon: a bulwark, tinted glass all round, the aft wall with a wide door
  for (const x of [-2.27, 2.27]) S.push(box(0.12, 0.55, 5.9, x, 1.45, -0.45, W), box(0.08, 1.45, 5.9, x, 2.45, -0.45, GLASS));
  S.push(box(4.6, 0.55, 0.12, 0, 1.45, 2.5, W), box(4.6, 1.45, 0.1, 0, 2.45, 2.5, GLASS, -0.25));
  for (const x of [-1.5, 1.5]) S.push(box(1.5, 2.0, 0.1, x, 2.17, -3.4, GLASS));
  S.push(box(1.5, 0.12, 0.12, 0, 3.12, -3.4, W));
  // the flybridge deck over it (with an overhang), its rail, a radar arch
  S.push(box(4.7, 0.16, 6.6, 0, 3.2, -0.75, W), box(4.72, 0.06, 6.62, 0, 3.12, -0.75, NAVY));
  rail(S, 2.3, -4.0, 2.3, 2.4, 3.28, 0.85, 6, W); rail(S, -2.3, -4.0, -2.3, 2.4, 3.28, 0.85, 6, W); rail(S, -2.3, 2.4, 2.3, 2.4, 3.28, 0.85, 5, W);
  rail(S, -2.3, -4.0, 1.2, -4.0, 3.28, 0.85, 4, W);
  for (const x of [-1.9, 1.9]) S.push(box(0.14, 1.8, 0.14, x, 4.2, -1.0, W));
  S.push(box(3.94, 0.18, 0.5, 0, 5.1, -1.0, W), box(0.5, 0.2, 0.5, 0, 5.3, -1.0, CHROME), cyl(0.06, 0.06, 1.0, 6, 0.9, 5.7, -1.0, CHROME));
  // up top: the helm (console, wheel, a bench seat), the hot tub, two loungers
  S.push(box(1.4, 0.9, 0.5, -1.0, 3.73, 1.95, W), box(1.36, 0.06, 0.4, -1.0, 4.2, 1.9, INK, -0.4), box(1.4, 0.42, 0.6, -1.0, 3.5, 1.0, CUSH), box(1.4, 0.5, 0.14, -1.0, 3.95, 0.68, CUSH));
  wheel(S, -1.0, 4.28, 1.64);
  S.push(box(2.1, 0.7, 2.1, 0.8, 3.62, -2.6, W), box(1.85, 0.03, 1.85, 0.8, 3.92, -2.6, '#5fd8e8'), box(2.14, 0.06, 2.14, 0.8, 3.98, -2.6, TEAK));
  for (const z of [-1.3, -0.1]) S.push(box(0.75, 0.28, 1.9, -1.4, 3.42, z - 0.2, '#fff6ec'), box(0.75, 0.28, 0.4, -1.4, 3.62, z - 1.05, CUSH, -0.5));
  // the saloon inside: a bar with stools, an L-sofa round a coffee table, the stair down to the cabins
  S.push(box(0.6, 1.05, 1.9, -1.75, 1.67, 1.25, '#7a4a2a'), box(0.72, 0.06, 2.0, -1.72, 2.22, 1.25, CUSH), box(0.5, 0.5, 1.6, -2.05, 2.6, 1.25, '#5a3a2a'));
  for (const z of [0.7, 1.25, 1.8]) S.push(cyl(0.18, 0.18, 0.06, 8, -1.1, 1.82, z, GOLD), cyl(0.04, 0.04, 0.65, 5, -1.1, 1.5, z, CHROME));
  for (let i = 0; i < 6; i++) S.push(cyl(0.05, 0.05, 0.22, 6, -2.1, 2.98, 0.7 + i * 0.22, ['#7fe0ff', '#ffd166', '#ff6a8a', '#8dff5a', '#fff6ec', '#b388ff'][i]));
  S.push(box(0.8, 0.45, 2.6, 1.7, 1.37, -0.6, CUSH), box(0.18, 0.5, 2.6, 2.05, 1.75, -0.6, CUSH), box(1.8, 0.45, 0.8, 0.95, 1.37, -1.6, CUSH));
  S.push(box(1.0, 0.38, 0.7, 0.75, 1.34, -0.4, TEAK));
  S.push(box(0.95, 0.05, 1.05, -1.6, 1.17, -2.6, '#3a2a20'), box(0.05, 0.8, 1.05, -1.1, 1.55, -2.6, CHROME));
  // the aft deck: a sofa across the stern, the stair up to the flybridge, steps down to the swim platform
  S.push(box(3.4, 0.45, 0.7, 0, 1.37, -7.4, CUSH), box(3.4, 0.5, 0.16, 0, 1.82, -7.78, CUSH), box(1.2, 0.06, 0.8, 0, 1.75, -6.3, TEAK), box(0.12, 0.55, 0.12, 0, 1.45, -6.3, CHROME));
  for (let i = 0; i < 8; i++) { const k = (i + 0.5) / 8; S.push(box(0.68, 0.06, 0.34, 1.8, 1.15 + k * 2.13, -6.8 + k * 2.8, TEAK)); }
  rail(S, 1.42, -6.8, 1.42, -4.0, 1.15, 0.9, 3, CHROME);
  for (const x of [-1.85, 1.85]) S.push(box(0.7, 0.12, 0.6, x, 0.75, -7.72, TEAK));
  S.push(box(4.8, 0.14, 1.4, 0, 0.35, -8.7, TEAK));
  ladder(S, 1.6, -9.38, -0.8, 0.35);
  // the foredeck: sun pads, a bow rail, an anchor, the name in gold on the band
  for (const x of [-0.8, 0.8]) S.push(box(1.5, 0.18, 2.4, x, 2.32, 4.6, '#fff6ec'), box(1.5, 0.18, 0.3, x, 2.48, 5.7, NAVY));
  rail(S, 2.1, 3.0, 0.3, 7.6, 2.25, 0.7, 5, CHROME); rail(S, -2.1, 3.0, -0.3, 7.6, 2.25, 0.7, 5, CHROME);
  S.push(box(0.25, 0.15, 0.35, 0, 2.5, 7.7, CHROME));
  for (const x of [-2.46, 2.46]) S.push(box(0.02, 0.12, 2.6, x, 1.55, -5.5, GOLD));
  return merge(S);
}
// ---------------------------------------------------------------- the bay's own boats
function ferryGeo() {
  const h = hull({ L: 22, B: 7, D: 1.4, F: 2.0, Fb: 2.6, top: '#fff6ec', bottom: '#2a2a4a', boot: '#ff6a3d', band: '#19b8b0', bandH: 0.45, deck: '#9aa4b0', floor: null });
  const S = [h.g];
  S.push(box(6.2, 2.2, 13, 0, 3.1, -1.5, '#fff6ec'), box(6.24, 0.8, 12.6, 0, 3.3, -1.5, GLASS), box(6.3, 0.12, 13.2, 0, 4.25, -1.5, '#19b8b0'));
  S.push(box(5.2, 1.8, 6.5, 0, 5.2, -2.5, '#fff6ec'), box(5.24, 0.7, 6.2, 0, 5.35, -2.5, GLASS), box(3.4, 1.5, 2.8, 0, 6.6, 1.2, '#fff6ec'), box(3.44, 0.6, 0.1, 0, 6.8, 2.62, GLASS));
  S.push(cyl(0.7, 0.85, 2.6, 10, 0, 7.4, -4.6, '#ff6a3d'), cyl(0.72, 0.72, 0.5, 10, 0, 8.5, -4.6, INK));
  rail(S, 3.3, -9, 3.3, 6, 2.0, 1.0, 8, W); rail(S, -3.3, -9, -3.3, 6, 2.0, 1.0, 8, W);
  for (let i = 0; i < 4; i++) S.push(torus(0.34, 0.09, 3.32, 3.2, -6 + i * 3, '#ff6a3d', 0, PI / 2));
  return merge(S);
}
function sailGeo(sail = '#ff9ad5') {
  const h = hull({ L: 9, B: 2.9, D: 0.5, F: 0.95, Fb: 1.25, top: W, bottom: '#2a4a7a', boot: sail, band: W, bandH: 0.1, deck: TEAK, floor: 0.6, tFore: 0.35 });
  const S = [h.g];
  S.push(box(2.0, 0.6, 3.0, 0, 1.25, 0.6, W), box(2.04, 0.2, 2.4, 0, 1.3, 0.6, GLASS), cyl(0.07, 0.09, 11, 6, 0, 6.6, 1.2, CHROME), box(0.06, 0.06, 4.2, 0, 2.0, -0.9, CHROME));
  const s1 = new THREE.BufferGeometry();
  s1.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.95, 1.05, 0, 11.8, 1.05, 0, 1.95, -3.0, 0, 1.95, 1.35, 0, 1.4, 4.3, 0, 10.6, 1.35], 3));
  s1.computeVertexNormals();
  S.push(tint(s1, '#fff6ec'), box(0.02, 1.2, 2.6, 0.01, 3.0, -0.8, sail));
  wheel(S, 0, 1.2, -3.0);
  return merge(S);
}
function fisherGeo() {
  const h = hull({ L: 11, B: 3.6, D: 0.9, F: 1.3, Fb: 1.9, top: '#2a6a8a', bottom: '#a8382e', boot: W, band: '#ffd447', bandH: 0.18, deck: '#9a8a70', floor: null });
  const S = [h.g];
  S.push(box(2.6, 2.0, 2.8, 0, 2.3, 1.2, W), box(2.64, 0.6, 2.2, 0, 2.7, 1.2, GLASS), box(2.8, 0.12, 3.0, 0, 3.35, 1.2, '#ff6a3d'));
  S.push(cyl(0.08, 0.1, 6, 6, 0, 4.3, -0.6, INK), box(7.5, 0.08, 0.08, 0, 5.4, -0.6, INK, 0, 0, 0.1));
  for (const x of [-3.5, 3.5]) S.push(box(0.03, 5.0, 0.03, x * 0.98, 3.0, -1.8, INK, -0.3));
  S.push(box(1.6, 0.8, 1.2, 0, 1.7, -3.2, '#ffd447'), torus(0.45, 0.12, 0, 2.2, -4.3, '#ff6a3d', PI / 2));
  return merge(S);
}

// ---------------------------------------------------------------- the types
// top m/s, acc m/s², rev (reverse top), turn rad/s at speed, turnLow (share of it at a crawl), resp (how fast the
// yaw rate follows the stick: inertia), grip (lateral damping: low slides), planeV (planes from here; 99: a
// displacement hull), hump (bow rise at the hump, rad), bank (lean into turns, rad), wave (how fast it follows
// the swell: high is twitchy, low is a big heavy hull riding it out), draft (m), mass (in collisions), hp
export const BOAT_TYPES = {
  jetski: { id: 'jetski', kind: 'jetski', name: 'ZIPFIN JET SKI', model: 'ZIPFIN 2-SEAT', price: 3500, tier: 'PERSONAL WATERCRAFT',
    features: 'Twitchy, quick, loud. Hops off wave crests (Space for a jump). Seats two if the second one holds on.',
    L: 3.2, B: 1.16, draft: 0.24, mass: 0.35, top: 29, acc: 15, rev: 4, turn: 2.7, turnLow: 0.5, resp: 9, grip: 2.0, planeV: 5.5, hump: 0.05, bank: 0.5, wave: 11, hp: 55,
    sound: 'jetski', cam: 0.72, eye: [1.38, 0.15], seat: [0, 0.66, -0.3], rider: 'straddle', geo: jetskiGeo, light: [0, 0.9, -1.4], ladder: [0, -1.85], knots: 56, sleeps: 0 },
  runabout: { id: 'runabout', kind: 'boat', name: 'GLINTWAVE 19 RUNABOUT', model: 'GLINTWAVE 19', price: 12000, tier: 'OPEN BOW RUNABOUT',
    features: 'An agile open-cockpit runabout with an outboard on the back: bucket seats, a stern bench, a sun pad on the bow, swim pods and a ladder.',
    L: 6.0, B: 2.3, draft: 0.38, mass: 1, top: 24, acc: 8, rev: 5, turn: 1.35, turnLow: 0.35, resp: 4.5, grip: 2.6, planeV: 8, hump: 0.13, bank: 0.24, wave: 6.5, hp: 90,
    sound: 'outboard', cam: 1.0, eye: [1.55, -0.3], seat: [-0.58, 0.74, -0.48], geo: runaboutGeo, light: [0.95, 1.7, -2.9], knots: 46, sleeps: 0,
    deck: [{ x0: -0.95, x1: 0.95, z0: -1.95, z1: 0.6, y: 0.32 }, { x0: -0.3, x1: 0.3, z0: 0.5, z1: 0.95, y: 0.32 }],
    blocks: [{ x0: -0.95, x1: -0.22, z0: 0.12, z1: 0.66 }, { x0: 0.22, x1: 0.95, z0: 0.12, z1: 0.66 }, { x0: -0.86, x1: -0.3, z0: -0.86, z1: -0.25 }, { x0: 0.3, x1: 0.86, z0: -0.86, z1: -0.25 }],
    helm: { x: -0.58, z: -0.05, r: 0.75 }, board: { x: 0, z: -1.6 }, ladder: [0.72, -3.55], plat: { x: 0, z: -1.7 },
    seats: [{ x: 0, z: -2.0, y: 0.38, yaw: 0, kind: 'stool' }, { x: 0.58, z: -0.5, y: 0.36, yaw: 0, kind: 'stool' }] },
  sport: { id: 'sport', kind: 'boat', name: 'CORALYNE 34 SPORT YACHT', model: 'CORALYNE 34', price: 45000, tier: 'SPORT YACHT',
    features: 'A cabin below with a double berth (sleep and save), a hardtop over the helm, a cockpit lounge round a teak table, sun pads on the bow and a swim platform with a ladder.',
    L: 10.6, B: 3.5, draft: 0.72, mass: 2.6, top: 19, acc: 4.4, rev: 4, turn: 0.75, turnLow: 0.3, resp: 2.4, grip: 2.2, planeV: 9, hump: 0.09, bank: 0.13, wave: 3.4, hp: 160,
    sound: 'inboard', cam: 1.45, eye: [2.25, -0.6], seat: [-0.8, 1.12, -1.25], geo: sportGeo, light: [0.5, 3.6, -2.3], knots: 37, sleeps: 2,
    deck: [{ x0: -1.5, x1: 1.5, z0: -4.1, z1: -0.25, y: 0.7 }, { x0: -1.5, x1: -0.9, z0: -5.35, z1: -4.0, y: 0.48 }, { x0: -1.55, x1: 1.55, z0: -6.15, z1: -5.3, y: 0.25 },
      { x0: 1.05, x1: 1.55, z0: -0.95, z1: -0.25, y: 1.08 }, { x0: 1.25, x1: 1.62, z0: -0.3, z1: 2.75, y: 1.48 }, { x0: -1.62, x1: -1.25, z0: -0.3, z1: 2.75, y: 1.48 },
      { x0: -1.55, x1: -1.05, z0: -0.95, z1: -0.25, y: 1.08 }, { x0: -1.42, x1: 1.42, z0: 2.7, z1: 4.6, y: 1.66 }],
    blocks: [{ x0: -1.25, x1: 0.15, z0: -1.66, z1: -0.98, y0: 0.5, y1: 1.0 }, { x0: -1.15, x1: -0.05, z0: -0.6, z1: -0.05, y0: 0.5, y1: 1.0 }, { x0: 0.8, x1: 1.5, z0: -4.2, z1: -2.62, y0: 0.5, y1: 0.95 },
      { x0: -1.5, x1: -0.8, z0: -4.2, z1: -2.62, y0: 0.5, y1: 0.95 }, { x0: -0.46, x1: 0.46, z0: -3.76, z1: -3.04, y0: 0.5, y1: 0.95 }],
    helm: { x: -0.55, z: -0.85, r: 0.8 }, board: { x: 0, z: -5.7 }, ladder: [1.0, -6.4], plat: { x: 0.2, z: -5.75 },
    seats: [{ x: 0, z: -4.38, y: 0.43, yaw: 0, kind: 'stool' }, { x: 1.12, z: -3.4, y: 0.43, yaw: -PI / 2, kind: 'stool' }, { x: -1.12, z: -3.4, y: 0.43, yaw: PI / 2, kind: 'stool' },
      { x: 0.55, z: 3.45, y: 0.28, yaw: PI, kind: 'lounger', view: true }, { x: -0.55, z: 3.45, y: 0.28, yaw: PI, kind: 'lounger', view: true }],
    uses: [{ x: 0.62, z: -0.75, r: 0.8, kind: 'cabin', hint: 'go below: the cabin (sleep, save)' }] },
  motor: { id: 'motor', kind: 'boat', name: 'HALCYON GRANDE 52 MOTOR YACHT', model: 'HALCYON GRANDE 52', price: 120000, tier: 'LUXURY MOTOR YACHT',
    features: 'Sixteen metres: a glass saloon with a bar and an L-sofa, cabins below (sleep and save), a flybridge with the helm, loungers and a hot tub, a big swim platform.',
    L: 16, B: 4.9, draft: 1.1, mass: 7, top: 14, acc: 2.2, rev: 3, turn: 0.45, turnLow: 0.25, resp: 1.25, grip: 1.7, planeV: 99, hump: 0.03, bank: 0.06, wave: 1.9, hp: 260,
    sound: 'inboard', cam: 2.1, eye: [4.6, 1.0], seat: [-1.0, 3.72, 1.0], geo: motorGeo, light: [0.9, 6.2, -1.0], knots: 27, sleeps: 6,
    deck: [{ x0: -2.2, x1: 2.2, z0: -7.05, z1: -3.45, y: 1.15 }, { x0: -2.15, x1: 2.15, z0: -3.45, z1: 2.4, y: 1.15 }, { x0: 1.5, x1: 2.2, z0: -8.0, z1: -7.0, y: 0.75 }, { x0: -2.2, x1: -1.5, z0: -8.0, z1: -7.0, y: 0.75 },
      { x0: -2.4, x1: 2.4, z0: -9.35, z1: -7.95, y: 0.35 }, { x0: 1.46, x1: 2.15, z0: -6.8, z1: -4.0, y: 1.15, y1: 3.28 }, { x0: -2.2, x1: 2.2, z0: -4.1, z1: 2.35, y: 3.28 }],
    blocks: [{ x0: -2.3, x1: -0.75, z0: -3.5, z1: -3.3, y0: 1.0, y1: 3.0 }, { x0: 0.75, x1: 2.3, z0: -3.5, z1: -3.3, y0: 1.0, y1: 3.0 }, { x0: -2.15, x1: -1.4, z0: 0.25, z1: 2.25, y0: 1.0, y1: 2.0 },
      { x0: 1.25, x1: 2.15, z0: -1.9, z1: 0.7, y0: 1.0, y1: 2.0 }, { x0: 0.0, x1: 1.9, z0: -2.0, z1: -1.2, y0: 1.0, y1: 2.0 }, { x0: 0.25, x1: 1.25, z0: -0.75, z1: -0.05, y0: 1.0, y1: 2.0 },
      { x0: 1.4, x1: 2.2, z0: -6.25, z1: -4.0, y0: 1.0, y1: 1.7 }, { x0: -1.7, x1: 1.7, z0: -7.78, z1: -7.05, y0: 1.0, y1: 1.7 }, { x0: -0.6, x1: 0.6, z0: -6.7, z1: -5.9, y0: 1.0, y1: 1.7 },
      { x0: -1.7, x1: -0.3, z0: 1.7, z1: 2.3, y0: 3.0, y1: 4.0 }, { x0: -0.25, x1: 1.85, z0: -3.65, z1: -1.55, y0: 3.0, y1: 4.0 }, { x0: -1.78, x1: -1.02, z0: -2.45, z1: 0.75, y0: 3.0, y1: 4.0 }],
    helm: { x: -1.0, z: 1.25, r: 0.85, y: 3.28 }, board: { x: 0, z: -8.6 }, ladder: [1.6, -9.6], plat: { x: -0.4, z: -8.7 },
    seats: [{ x: 1.7, z: -0.6, y: 0.4, yaw: -PI / 2, kind: 'stool', fy: 1.15 }, { x: 0.95, z: -1.6, y: 0.4, yaw: 0, kind: 'stool', fy: 1.15 }, { x: 0, z: -7.35, y: 0.42, yaw: 0, kind: 'stool', fy: 1.15 },
      { x: -1.4, z: -1.5, y: 0.3, yaw: PI, kind: 'lounger', view: true, fy: 3.28 }, { x: -1.4, z: -0.3, y: 0.3, yaw: PI, kind: 'lounger', view: true, fy: 3.28 },
      { x: 0.8, z: -2.6, y: 0.1, yaw: 0, kind: 'stool', tub: true, view: true, fy: 3.28 }],
    uses: [{ x: -1.6, z: -2.0, r: 0.9, kind: 'cabin', hint: 'down to the cabins (sleep, save)', y: 1.15 }, { x: -0.95, z: 1.25, r: 0.75, kind: 'bar', hint: 'mix a drink at the bar', y: 1.15 }] },
};
// the bay's traffic: not for sale, steered along their routes (vehicles/boats.js)
export const AI_TYPES = {
  ferry: { id: 'ferry', name: 'BAY FERRY', L: 22, B: 7, draft: 1.4, mass: 30, wave: 1.2, geo: ferryGeo, speed: 7, wake: 0.85 },
  sailA: { id: 'sailA', name: 'SAILBOAT', L: 9, B: 2.9, draft: 0.5, mass: 3, wave: 2.5, geo: () => sailGeo('#ff9ad5'), speed: 3.2, wake: 0.4, heel: 0.16 },
  sailB: { id: 'sailB', name: 'SAILBOAT', L: 9, B: 2.9, draft: 0.5, mass: 3, wave: 2.5, geo: () => sailGeo('#7fe0ff'), speed: 3.6, wake: 0.4, heel: 0.18 },
  fisher: { id: 'fisher', name: 'FISHING BOAT', L: 11, B: 3.6, draft: 0.9, mass: 5, wave: 2.2, geo: fisherGeo, speed: 2.6, wake: 0.5 },
};
export const BOAT_IDS = Object.keys(BOAT_TYPES);
// the routes (deep water, clear of the piers, the causeway and the stunt landings)
export const ROUTES = {
  ferry: [[-760, -218], [-420, -236], [-120, -214], [150, -226], [-120, -262], [-420, -278], [-760, -252]],
  sailA: [[-250, 300], [-60, 345], [120, 312], [-60, 282]],
  sailB: [[-1000, 285], [-880, 335], [-720, 325], [-880, 292]],
  fisher: [[-1150, -60], [-1180, 60], [-1140, 140], [-1122, 0]],
};

// ---------------------------------------------------------------- the marina: private berths and the rental stands
// Owned boats lie stern-to the west pontoon of the Starboard Marina pier, bows pointing out to the west, each with
// a lit ring on the pier deck where you step aboard. The jet-ski rentals: two at the foot of the marina pier, two
// beside Driftwood Pier in the old town (stand on its deck).
export const PONTOON_X = -800.6;           // the west pontoon's outer edge (world/keyCity.js builds it)
const berth = (id, z) => { const T = BOAT_TYPES[id], back = T.deck ? Math.abs(Math.min(...T.deck.map((d) => d.z0))) : T.L / 2 + 0.3; return { id, x: PONTOON_X - 0.35 - back, z, yaw: -PI / 2, ring: { x: -794.7, z } }; };
export const BERTHS = { jetski: berth('jetski', 168), runabout: berth('runabout', 178), sport: berth('sport', 192), motor: berth('motor', 211.5) };
export const RENTAL_SITES = [
  { id: 'marina', name: 'STARBOARD MARINA', ring: { x: -794.7, z: 162.2 }, slots: [{ x: PONTOON_X - 2.1, z: 161, yaw: -PI / 2 }, { x: PONTOON_X - 2.1, z: 163.6, yaw: -PI / 2 }], stand: { x: -795.2, z: 160.2 } },
  { id: 'old', name: 'DRIFTWOOD PIER', ring: { x: 35.4, z: 165 }, slots: [{ x: 31.6, z: 164, yaw: 0 }, { x: 29.0, z: 164, yaw: 0 }], stand: { x: 34.7, z: 168.5 } },
];
export const RENT_FEE = 25;
export const TEST_SPOT = { x: -838, z: 168, yaw: 0 };
