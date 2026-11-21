// The Solstice Spire: the waterfront tower on Solano Key's east shore (it looks at the old town, the Halcyon
// Causeway, the bay and the sunset, which goes down over the old town). This builds what stands in the world:
// the lit name crown, the upgraded lobby front, and the Solstice Terrace on the roof (a timber deck behind a
// glass balustrade, loungers and benches facing the view, the Afterglow Bar under a pergola, planters, string
// lights, the lift hut). Everything solid is merged into the key's one solid mesh (no extra draw calls); the
// glass and the warm light pools on the deck at night are one mesh each. What happens up there (the lift, the
// guests, the bartender, sitting and waiting for the sunset) is game/spire.js.
//
// Terrace coordinates: x along the building (east +), z (south +), both from the building's centre.
import * as THREE from 'three';
import { box, cyl, merge, rng, PI, nightU, fogU, FOG_PARS } from '../core/util.js';

export const SPIRE_NAME = 'The Solstice Spire';
const INK = '#1d1630', CREAM = '#fbf7f0', STEEL = '#b9bcc8', BRASS = '#d9b45a', TEAK = ['#a8744e', '#9a6a44', '#b4825a', '#a06e48'];
const AMBER = '#ffb35a', WARM = '#ffd9a0';

// the layout (terrace-local metres); game/spire.js reads the same numbers through b.terrace
export const TERRACE = {
  gx: 24.4, gz: 18.4,                       // the glass line
  walk: { x0: -23.9, x1: 23.9, z0: -17.9, z1: 17.9 },   // where a person's centre can be (inside the glass)
  hut: { x0: -23.8, x1: -18.2, z0: -3, z1: 3, h: 3.6, door: 0.8 },   // the lift hut, doors on its east face
  cab: { x: -19.6, z: 0 },                  // standing in the lift car
  lift: { x: -16.9, z: 0, r: 1.3 },         // E: ride down
  bar: { x0: -16.5, x1: -9.5, z0: -12.5, z1: -11.7, back: [-16.2, -15.4] },
  barUse: { x: -12.7, z: -10.85, r: 1.2 },
  barman: { x: -12.7, z: -13.9 },
};

// ---- the tower itself: a signature landmark among the blue-grey glass of Glasswater downtown. Champagne-gold glass
// behind bronze fins, art-deco bronze pilasters that step in at the corners, two bronze setback cornices, amber light
// strips up every face (they glow from dusk), and on the roof's west edge, behind the terrace, a bronze-and-neon
// sunburst rising like the sun with a slim mast and a sky-blue beacon on top (the tallest point on the skyline).
// Same footprint and roof height as before, so the terrace, the lobby and every check stay as they were.
export const SPIRE_GOLD = '#c9a86e';
export function addSpireBody({ b, S, N, glows, bx, cy }) {
  const { cx, cz, w, d, h } = b, BRONZE = '#8a6236', BRZ2 = '#a87a44', CHAMP = '#efe2c4';
  S.push(bx(w, h, d, cx, h / 2, cz, SPIRE_GOLD, 2));
  S.push(bx(w + 1.2, 5, d + 1.2, cx, 2.5, cz, CHAMP, 3));                                 // lobby podium (as before)
  // corner pilasters: full height, with deco steps that narrow towards the top
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * (w / 2), z = cz + sz * (d / 2);
    S.push(bx(1, h + 1, 1, x, (h + 1) / 2, z, CHAMP));
    for (const [s, y0, y1] of [[2.6, 5.2, h * 0.55], [1.9, h * 0.55, h * 0.8], [1.4, h * 0.8, h + 2.4]]) S.push(bx(s, y1 - y0, s, x, (y0 + y1) / 2, z, BRZ2));
    N.push(bx(0.14, h - 7, 0.14, x + sx * 1.36, 5.4 + (h - 7) / 2, z + sz * 1.36, AMBER));
  }
  // bronze fins down every face, every 3.2 m, from the podium to under the crown's name boards (and clear of the
  // lobby's name sign over the north door)
  const top = h - 8, y0f = (x, north) => (north && Math.abs(x) < 8 ? 9.8 : 5.2);
  const fin = (x, y0, z, fx) => S.push(bx(fx ? 0.5 : 0.26, top - y0, fx ? 0.26 : 0.5, x, (y0 + top) / 2, z, BRONZE));
  for (const sz of [-1, 1]) for (let x = -w / 2 + 3.2; x < w / 2 - 1.5; x += 3.2) fin(cx + x, y0f(x, sz < 0), cz + sz * (d / 2 + 0.22), false);
  for (const sx of [-1, 1]) for (let z = -d / 2 + 3.2; z < d / 2 - 1.5; z += 3.2) fin(cx + sx * (w / 2 + 0.22), 5.2, cz + z, true);
  // setback cornices (bronze, with an amber line under each)
  for (const y of [h * 0.55, h * 0.8]) {
    S.push(bx(w + 2, 0.8, d + 2, cx, y, cz, BRZ2), bx(w + 1.2, 0.5, d + 1.2, cx, y + 0.65, cz, CHAMP));
    N.push(bx(w + 2.1, 0.12, 0.12, cx, y - 0.5, cz - d / 2 - 1.02, AMBER), bx(w + 2.1, 0.12, 0.12, cx, y - 0.5, cz + d / 2 + 1.02, AMBER), bx(0.12, 0.12, d + 2.1, cx - w / 2 - 1.02, y - 0.5, cz, AMBER), bx(0.12, 0.12, d + 2.1, cx + w / 2 + 1.02, y - 0.5, cz, AMBER));
  }
  // vertical light strips: three up each face, between the fins
  const strip = (x, y0, z, fx) => N.push(bx(fx ? 0.1 : 0.16, top - y0, fx ? 0.16 : 0.1, x, (y0 + top) / 2, z, WARM));
  for (const o of [-7.6, 0, 7.6]) for (const sz of [-1, 1]) strip(cx + o + 1.6, y0f(o + 1.6, sz < 0), cz + sz * (d / 2 + 0.06), false);
  for (const o of [-6, 0, 6]) for (const sx of [-1, 1]) strip(cx + sx * (w / 2 + 0.06), 5.4, cz + o + 1.6, true);
  // a warm wash on the faces at night, strongest on the side that looks at the old town (east)
  glows.push([b.x1 + 3, h * 0.5, cz, '#ffc070', 34, 0], [b.x1 + 3, h * 0.82, cz, '#ffb35a', 26, 0], [cx, h * 0.6, b.z1 + 3, '#ffc070', 26, 0], [cx, h * 0.6, b.z0 - 3, '#ffc070', 26, 0]);

  // ---- the sunburst on the roof's west edge (outside the terrace glass, behind the lift hut), facing the old town
  const R0 = b.roofY, sx0 = b.x0 + 0.3, sy = R0 + 1.2, RAYS = 13;
  S.push(cy(4.2, 4.2, 0.5, 24, sx0, sy, cz, BRZ2, 0, PI / 2));
  N.push(cy(3.4, 3.4, 0.2, 24, sx0 + 0.32, sy, cz, '#ffd27a', 0, PI / 2));
  for (let i = 0; i < RAYS; i++) {
    const a = (i + 0.5) / RAYS * PI, long = i % 2 === 0, L = long ? 14.2 : 10.4, r0 = 4.8, dy = Math.sin(a), dz = Math.cos(a);
    const mx = r0 + L / 2;
    S.push(bx(0.36, L, long ? 0.9 : 0.7, sx0, sy + dy * mx, cz + dz * mx, BRONZE, PI / 2 - a));
    N.push(bx(0.12, L - 0.6, 0.16, sx0 + 0.26, sy + dy * mx, cz + dz * mx, long ? AMBER : '#ff8a5a', PI / 2 - a));
  }
  // the halo arc round the rays' tips
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * PI, r = 19.6, seg = r * PI / 24 + 0.15;
    N.push(bx(0.14, seg, 0.18, sx0 + 0.3, sy + Math.sin(a) * r, cz + Math.cos(a) * r, '#ffe3a0', -a));
  }
  // the mast and the beacon: the highest point downtown
  S.push(cy(0.22, 0.6, 30, 8, sx0, sy + 19.6 + 15, cz, BRZ2), cy(0.9, 0.9, 0.5, 10, sx0, sy + 19.6 + 0.3, cz, BRZ2));
  N.push(cy(0.32, 0.32, 0.9, 8, sx0, sy + 19.6 + 30.4, cz, '#8fe3ff'));
  glows.push([sx0, sy + 19.6 + 30.6, cz, '#8fe3ff', 16, 0.55], [sx0 + 2, sy + 9, cz, '#ffc070', 30, 0.05], [sx0, sy + 19.6, cz, '#ffe3a0', 10, 0.2]);
}

export function addSpire({ b, S, N, glows, P, bx, cy, sign, group }) {
  const T = TERRACE, X = b.cx, Z = b.cz, Y = b.deckY, R0 = b.roofY, r = rng(7171);
  const W = (lx, lz) => [X + lx, Z + lz];
  // local helpers: a box / cylinder in terrace coordinates, y from the deck
  const B = (w, h, d, lx, y, lz, hex, ry = 0) => bx(w, h, d, X + lx, Y + y, Z + lz, hex, 0, 0, ry);
  const C = (rt, rb, h, seg, lx, y, lz, hex) => cy(rt, rb, h, seg, X + lx, Y + y, Z + lz, hex);
  const col = (lx, lz, w, d, top, y0 = -0.3) => P.box(X + lx, Z + lz, w, d, Y + top, 0, Y + y0);
  const post = (lx, lz, rr, top) => P.circle(X + lx, Z + lz, rr, Y + top, Y - 0.3);
  const glowAt = (lx, y, lz, hex, s, base = 0) => glows.push([X + lx, Y + y, Z + lz, hex, s, base]);
  const seats = [], spots = [];
  const seat = (lx, lz, y, yaw, kind) => { const s = { x: X + lx, z: Z + lz, y, yaw, kind, floorY: Y, taken: null }; seats.push(s); return s; };

  // ---------------------------------------------------------------- the crown: name boards on all four faces
  // just under the roof, amber neon bands round the top, corner fins with lit tips, a mast on the lift hut
  const h = b.h, faces = [[b.x1 + 0.16, Z, PI / 2, b.d], [b.x0 - 0.16, Z, -PI / 2, b.d], [X, b.z0 - 0.16, PI, b.w], [X, b.z1 + 0.16, 0, b.w]];
  for (const [x, z, yaw, along] of faces) sign(SPIRE_NAME, x, h - 4.2, z, yaw, Math.min(along * 0.62, 24));
  for (const y of [h - 0.9, h - 7.6]) {
    N.push(bx(b.w + 0.5, 0.16, 0.16, X, y, b.z0 - 0.2, AMBER), bx(b.w + 0.5, 0.16, 0.16, X, y, b.z1 + 0.2, AMBER), bx(0.16, 0.16, b.d + 0.5, b.x0 - 0.2, y, Z, AMBER), bx(0.16, 0.16, b.d + 0.5, b.x1 + 0.2, y, Z, AMBER));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = X + sx * b.w / 2, z = Z + sz * b.d / 2;
    S.push(bx(1.1, 6.2, 1.1, x, R0 + 3.1, z, '#e4e8f0'), bx(1.3, 0.3, 1.3, x, R0 + 6.3, z, BRASS));
    N.push(bx(0.12, 12, 0.12, x + sx * 0.58, h - 4.6, z + sz * 0.58, AMBER));
    glows.push([x, R0 + 6.6, z, AMBER, 6, 0.15]);
  }
  // glow over the boards so the crown reads from across the bay at night
  for (const [x, z, yaw] of faces) glows.push([x + Math.sin(yaw) * 1.5, h - 4.2, z + Math.cos(yaw) * 1.5, '#ffc070', 26, 0]);

  // ---------------------------------------------------------------- the lobby front (north face, on Stadium Way)
  // the name in lights over the canopy, amber neon up the podium either side of the door, lamps on the piers
  {
    const fz = b.z0 - 0.62;
    sign(SPIRE_NAME, X, 7.7, b.z0 - 0.14, PI, 13);
    for (const sx of [-1, 1]) {
      N.push(bx(0.12, 4.2, 0.08, X + sx * 6.3, 2.6, fz - 0.05, AMBER));
      S.push(bx(0.5, 0.5, 0.25, X + sx * 6.3, 4.85, fz - 0.12, BRASS));
      glows.push([X + sx * 6.3, 2.6, fz - 0.6, AMBER, 4, 0.1]);
    }
    glows.push([X, 7.7, b.z0 - 1.6, '#ffc070', 12, 0]);
  }

  // ---------------------------------------------------------------- the deck
  S.push(bx(T.gx * 2 + 0.2, 0.03, T.gz * 2 + 0.2, X, R0 + 0.015, Z, '#3a2a20'));
  for (let z = -T.gz + 0.125, i = 0; z < T.gz; z += 0.25, i++) S.push(bx(T.gx * 2, 0.07, 0.225, X, R0 + 0.045, Z + z, TEAK[(i * 7 + (i >> 2)) % TEAK.length]));
  // a stone border under the glass
  for (const sz of [-1, 1]) S.push(B(T.gx * 2 + 0.6, 0.12, 0.5, 0, 0.0, sz * T.gz, '#d8d0c4'));
  for (const sx of [-1, 1]) S.push(B(0.5, 0.12, T.gz * 2 + 0.6, sx * T.gx, 0.0, 0, '#d8d0c4'));

  // ---------------------------------------------------------------- the glass balustrade (solid all round)
  // posts every ~2.4 m, a steel top rail and a base channel; the panes are one see-through mesh
  const GH = 1.15, glass = [];
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 2.4), alongX = Math.abs(x1 - x0) > 0.1;
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; S.push(B(0.07, GH + 0.05, 0.07, x, 0.06 + (GH + 0.05) / 2, z, STEEL)); }
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    S.push(B(alongX ? len + 0.1 : 0.09, 0.07, alongX ? 0.09 : len + 0.1, mx, GH + 0.12, mz, STEEL), B(alongX ? len : 0.1, 0.08, alongX ? 0.1 : len, mx, 0.1, mz, '#5a5f6a'));
    glass.push(box(alongX ? len : 0.025, GH - 0.06, alongX ? 0.025 : len, X + mx, Y + 0.12 + (GH - 0.06) / 2, Z + mz, '#cfeaff'));
  };
  run(-T.gx, -T.gz, T.gx, -T.gz); run(-T.gx, T.gz, T.gx, T.gz); run(-T.gx, -T.gz, -T.gx, T.gz); run(T.gx, -T.gz, T.gx, T.gz);
  // the colliders stand much taller than the glass, so no jump gets you over (game/spire.js also clamps)
  col(T.gx + 0.2, 0, 0.6, T.gz * 2 + 1.2, 4); col(-T.gx - 0.2, 0, 0.6, T.gz * 2 + 1.2, 4);
  col(0, T.gz + 0.2, T.gx * 2 + 1.2, 0.6, 4); col(0, -T.gz - 0.2, T.gx * 2 + 1.2, 0.6, 4);
  const glassMesh = new THREE.Mesh(merge(glass), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false }));
  glassMesh.renderOrder = 2; glassMesh.frustumCulled = false;
  group.add(glassMesh);

  // ---------------------------------------------------------------- the lift hut (doors on the east face)
  {
    const H = T.hut, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, w = H.x1 - H.x0, d = H.z1 - H.z0, dw = H.door;
    const wall = '#e9e2d6';
    S.push(B(0.25, H.h, d, H.x0 + 0.125, H.h / 2, cz, wall), B(w, H.h, 0.25, cx, H.h / 2, H.z0 + 0.125, wall), B(w, H.h, 0.25, cx, H.h / 2, H.z1 - 0.125, wall));
    // the front wall either side of the doorway, the lintel, a brass frame
    const side = (d / 2 - dw) / 1;
    for (const s of [-1, 1]) S.push(B(0.25, H.h, side, H.x1 - 0.125, H.h / 2, s * (dw + side / 2), wall), B(0.08, 2.5, 0.1, H.x1 + 0.02, 1.25, s * (dw + 0.05), BRASS));
    S.push(B(0.25, H.h - 2.45, dw * 2, H.x1 - 0.125, 2.45 + (H.h - 2.45) / 2, 0, wall), B(0.08, 0.1, dw * 2 + 0.2, H.x1 + 0.02, 2.5, 0, BRASS));
    // the roof with a deep amber-lit eave, the lit cab inside (warm walls, a brass rail, a mirror)
    S.push(B(w + 0.8, 0.3, d + 0.8, cx, H.h + 0.15, cz, '#3b3350'), B(w - 0.5, 0.05, d - 0.5, cx, 0.03, cz, '#c9a46a'));
    S.push(B(0.05, 2.4, 1.6, H.x0 + 0.3, 1.3, 0, '#f3dcb0'), B(1.6, 2.4, 0.05, -21.0, 1.3, -1.0, '#f0d6a8'), B(1.6, 2.4, 0.05, -21.0, 1.3, 1.0, '#f0d6a8'), B(1.7, 0.05, 2.0, -21.0, 2.45, 0, '#fff4dc'));
    S.push(B(0.04, 0.04, 1.6, H.x0 + 0.42, 0.95, 0, BRASS), B(0.03, 1.2, 1.0, H.x0 + 0.34, 1.5, 0, '#9fb8c8'));
    N.push(B(w + 0.84, 0.08, 0.08, cx, H.h + 0.02, H.z1 + 0.42, AMBER), B(w + 0.84, 0.08, 0.08, cx, H.h + 0.02, H.z0 - 0.42, AMBER), B(0.08, 0.08, d + 0.84, H.x1 + 0.42, H.h + 0.02, cz, AMBER));
    // the floor indicator over the doors and a call button
    S.push(B(0.06, 0.3, 0.9, H.x1 + 0.03, 2.95, 0, INK), B(0.06, 0.24, 0.12, H.x1 + 0.03, 1.2, dw + 0.32, BRASS));
    N.push(B(0.07, 0.12, 0.5, H.x1 + 0.06, 2.95, 0, '#ffb35a'), B(0.07, 0.06, 0.06, H.x1 + 0.07, 1.22, dw + 0.32, '#8dff5a'));
    glowAt(H.x1 + 0.6, 2.9, 0, AMBER, 3, 0.1);
    // the mast on top: a slim spire with a red light (the building's name, after all)
    S.push(C(0.12, 0.32, 13, 6, cx, H.h + 6.8, cz, STEEL), C(0.4, 0.4, 0.4, 8, cx, H.h + 0.5, cz, BRASS));
    N.push(C(0.05, 0.05, 11, 4, cx + 0.3, H.h + 6.5, cz, AMBER));
    glowAt(cx, H.h + 13.6, cz, '#ff3040', 4, 0.35);
    col(cx, cz, w + 0.2, d + 0.2, H.h + 1);
  }

  // ---------------------------------------------------------------- the Afterglow Bar under a pergola (north-west)
  {
    const Bb = T.bar, cx = (Bb.x0 + Bb.x1) / 2, len = Bb.x1 - Bb.x0, bz = (Bb.z0 + Bb.z1) / 2, [k0, k1] = Bb.back, kz = (k0 + k1) / 2;
    S.push(B(len, 1.04, Bb.z1 - Bb.z0, cx, 0.52, bz, '#2e2a3c'), B(len + 0.2, 0.07, Bb.z1 - Bb.z0 + 0.3, cx, 1.08, bz + 0.05, '#e8e0d0'));
    for (let x = Bb.x0 + 0.35; x < Bb.x1; x += 0.5) S.push(B(0.06, 0.9, 0.03, x, 0.5, Bb.z1 + 0.02, '#c9a46a'));
    N.push(B(len, 0.05, 0.05, cx, 0.95, Bb.z1 + 0.05, AMBER), B(len, 0.05, 0.05, cx, 0.12, Bb.z1 + 0.05, '#ff6a8a'));
    col(cx, bz, len + 0.2, Bb.z1 - Bb.z0 + 0.3, 1.2);
    // the back bar: a cabinet, two shelves of bottles, a mirror strip, the name board over it
    S.push(B(len, 1.0, k1 - k0, cx, 0.5, kz, '#3b3350'), B(len, 0.05, 0.5, cx, 1.55, k0 + 0.25, '#c9a46a'), B(len, 0.05, 0.5, cx, 2.05, k0 + 0.25, '#c9a46a'), B(len, 1.3, 0.05, cx, 1.75, k0 - 0.02, '#4a5a78'));
    const BOT = ['#2fbf6a', '#ffb35a', '#ff5fa8', '#e8f4ff', '#7a5cff', '#ffd447', '#c0303a'];
    for (const y of [1.08, 1.58, 2.08]) for (let x = Bb.x0 + 0.3; x < Bb.x1 - 0.2; x += 0.32 + r() * 0.12) S.push(C(0.045, 0.05, 0.26 + r() * 0.08, 6, x, y + 0.14, k0 + 0.2 + r() * 0.15, BOT[Math.floor(r() * BOT.length)]));
    sign('Afterglow Bar', X + cx, Y + 2.95, Z + k0 + 0.02, 0, 4.4);
    col(cx, kz, len + 0.2, k1 - k0 + 0.3, 2.4);
    // the pergola: four posts, beams, slats, string lights along the beams
    const px0 = Bb.x0 - 0.6, px1 = Bb.x1 + 0.6, pz0 = k0 - 0.4, pz1 = Bb.z1 + 1.4;
    for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) { S.push(B(0.18, 3.0, 0.18, x, 1.5, z, '#8a5a3a')); post(x, z, 0.14, 3.1); }
    S.push(B(px1 - px0 + 0.4, 0.2, 0.15, (px0 + px1) / 2, 3.0, pz0, '#8a5a3a'), B(px1 - px0 + 0.4, 0.2, 0.15, (px0 + px1) / 2, 3.0, pz1, '#8a5a3a'));
    for (let x = px0 + 0.2; x < px1; x += 0.55) S.push(B(0.08, 0.12, pz1 - pz0 + 0.4, x, 3.16, (pz0 + pz1) / 2, '#a8744e'));
    for (const z of [pz0, pz1]) for (let x = px0 + 0.3; x < px1; x += 0.6) N.push(B(0.09, 0.09, 0.09, x, 2.82 + Math.sin((x - px0) * 0.9) * 0.04, z, WARM));
    for (let x = px0 + 0.8; x < px1; x += 1.8) { glowAt(x, 2.8, pz0, WARM, 2.6, 0); glowAt(x, 2.8, pz1, WARM, 2.6, 0); }
    // stools along the front
    for (const x of [-15.6, -14.5, -10.9, -9.9]) { S.push(C(0.22, 0.22, 0.07, 10, x, 0.78, -11.0, '#ff8a3d'), C(0.04, 0.07, 0.75, 6, x, 0.38, -11.0, STEEL), C(0.18, 0.2, 0.03, 8, x, 0.02, -11.0, STEEL)); post(x, -11.0, 0.2, 0.85); seat(x, -11.0 + 0.02, 0.83, PI, 'stool'); }
  }

  // ---------------------------------------------------------------- loungers along the east edge, facing the old town
  const lounger = (lx, lz) => {
    // frame, cushion, a raised back at the west end; a towel in a stripe colour
    const c = ['#f6f1e7', '#27d8cf', '#ff8a8a', '#ffd447'][Math.abs(Math.round(lz)) % 4];
    S.push(B(2.0, 0.08, 0.72, lx + 0.1, 0.34, lz, '#8a5a3a'), B(1.5, 0.1, 0.66, lx + 0.35, 0.43, lz, CREAM), B(0.62, 0.02, 0.6, lx + 0.4, 0.49, lz, c));
    S.push(bx(0.72, 0.1, 0.66, X + lx - 0.6, Y + 0.64, Z + lz, CREAM, 0, 0, 0, -0.55));
    for (const [ox, oz] of [[-0.8, -0.3], [-0.8, 0.3], [1.0, -0.3], [1.0, 0.3]]) S.push(B(0.06, 0.32, 0.06, lx + ox, 0.16, lz + oz, '#6a4228'));
    col(lx + 0.1, lz, 2.0, 0.74, 0.7);
    return seat(lx - 0.15, lz, 0.45, PI / 2, 'lounger');
  };
  const LZ = [-14, -9.5, -5, 5, 9.5, 14], loungers = LZ.map((z) => lounger(20.4, z));
  for (const z of [-11.75, -7.25, 7.25, 11.75]) { S.push(C(0.26, 0.26, 0.04, 10, 20.0, 0.5, z, CREAM), C(0.04, 0.06, 0.48, 6, 20.0, 0.25, z, STEEL), C(0.03, 0.03, 0.14, 6, 20.05, 0.6, z, '#ff5fa8')); post(20.0, z, 0.27, 0.6); }

  // ---------------------------------------------------------------- benches along the south edge, facing the sea
  const bench = (lx, lz, yaw) => {
    // a teak bench with a back on the inland side (local frame: faces +z when yaw = 0)
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (ax, az) => [lx + ax * c + az * s, lz - ax * s + az * c];
    const q = (w, hh, d, ax, y, az, hex) => { const [px, pz] = at(ax, az); S.push(bx(w, hh, d, X + px, Y + y, Z + pz, hex, 0, 0, yaw)); };
    q(1.9, 0.07, 0.5, 0, 0.45, 0, '#b4825a'); q(1.9, 0.38, 0.06, 0, 0.72, -0.24, '#a06e48');
    for (const ax of [-0.85, 0.85]) q(0.08, 0.45, 0.5, ax, 0.22, 0, '#5a5f6a');
    const quarter = Math.abs(s) > 0.7;
    col(lx, lz, quarter ? 0.62 : 1.95, quarter ? 1.95 : 0.62, 0.95);
    const a = seat(lx, lz, 0.48, yaw, 'bench');
    return a;
  };
  const benches = [-14, -8, -2, 4, 10, 15.6].map((x) => bench(x, 16.4, 0));
  // the sofa corner round a low fire table in the middle, facing east
  const sofas = [bench(6.6, -1.3, PI / 2), bench(6.6, 1.3, PI / 2)];
  S.push(B(2.6, 0.42, 1.1, 9.2, 0.21, 0, '#3b3350'), B(2.4, 0.04, 0.9, 9.2, 0.43, 0, '#d8d0c4'));
  N.push(B(1.8, 0.06, 0.18, 9.2, 0.47, 0, '#ff8a3d'), B(1.6, 0.04, 0.08, 9.2, 0.52, 0, '#ffd447'));
  glowAt(9.2, 0.8, 0, '#ff9a4a', 5, 0.25);
  col(9.2, 0, 2.7, 1.2, 0.6);
  // two standing tables in the south-west
  for (const [x, z] of [[-13, 9], [-7.5, 5.5]]) { S.push(C(0.42, 0.42, 0.05, 12, x, 1.08, z, CREAM), C(0.05, 0.05, 1.05, 6, x, 0.53, z, STEEL), C(0.3, 0.32, 0.04, 10, x, 0.02, z, STEEL), C(0.04, 0.04, 0.12, 6, x + 0.12, 1.17, z, '#ffe7b0')); post(x, z, 0.45, 1.2); glowAt(x + 0.12, 1.3, z, '#ffd9a0', 1.6, 0.05); }

  // ---------------------------------------------------------------- planters: corners, along the north edge, between benches
  const planter = (lx, lz, w, d, tall) => {
    S.push(B(w, 0.6, d, lx, 0.3, lz, '#e8e0d4'), B(w - 0.12, 0.05, d - 0.12, lx, 0.6, lz, '#4a3626'));
    const n = Math.max(2, Math.round(w * d * 1.4));
    for (let i = 0; i < n; i++) {
      const x = lx + (r() - 0.5) * (w - 0.4), z = lz + (r() - 0.5) * (d - 0.4), s = 0.28 + r() * 0.22;
      S.push(bx(s * 2, s * 1.6, s * 2, X + x, Y + 0.75 + s * 0.6, Z + z, r() < 0.5 ? '#2f8f4f' : '#3fae6a', 0, 0.3, r() * 3, 0.2));
      if (r() < 0.3) S.push(B(0.12, 0.12, 0.12, x + 0.1, 1.0 + s, z, ['#ff5fa8', '#ffd447', '#f6f1e7'][i % 3]));
    }
    if (tall) {
      // a small olive-ish tree
      S.push(C(0.06, 0.09, 1.6, 6, lx, 1.4, lz, '#7a5a3a'));
      for (let k = 0; k < 6; k++) { const a = k * 1.05; S.push(bx(0.9, 0.7, 0.9, X + lx + Math.cos(a) * 0.45, Y + 2.3 + (k % 2) * 0.3, Z + lz + Math.sin(a) * 0.45, k % 2 ? '#5f9a5a' : '#4f8a4a', 0, 0.4, a, 0.3)); }
    }
    col(lx, lz, w + 0.05, d + 0.05, tall ? 2.8 : 0.9);
  };
  // (the corner planters leave a 1.4 m path along the glass)
  for (const sz of [-1, 1]) planter(21.9, sz * 16.1, 1.4, 1.4, true);
  planter(-21.9, 16.1, 1.4, 1.4, true); planter(-21.9, -16.3, 1.4, 1.2, false);
  for (const x of [-4, 3.5, 11]) planter(x, -16.9, 2.6, 0.9, x === 3.5);
  for (const x of [-11, 1, 13]) planter(x, 16.6, 0.9, 0.6, false);
  planter(-16.5, 4.6, 1.6, 1.0, false); planter(13.6, 0, 1.0, 2.4, false);

  // ---------------------------------------------------------------- string lights: two zigzag chains on poles
  // (the poles stand on the glass line, inside its collider, so nothing on the deck snags on them)
  const gx = T.gx, gz = T.gz, POLE = [[-gx, -gz], [-8, -gz], [8, -gz], [gx, -gz], [gx, 0], [gx, gz], [8, gz], [-8, gz], [-gx, gz]];
  for (const [x, z] of POLE) S.push(C(0.07, 0.09, 3.4, 6, x, 1.7, z, '#3b3350'), C(0.1, 0.1, 0.1, 6, x, 3.42, z, BRASS));
  const strings = [[[-gx, -gz], [-8, gz]], [[-8, gz], [8, -gz]], [[8, -gz], [gx, gz]], [[-gx, gz], [-8, -gz]], [[-8, -gz], [8, gz]], [[8, gz], [gx, -gz]], [[gx, -gz], [gx, gz]]];
  const BULB = ['#ffd9a0', '#ffe7b0', '#ffc890', '#ffb35a'];
  let nb = 0;
  for (const [[x0, z0], [x1, z1]] of strings) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.1), yaw = Math.atan2(x1 - x0, z1 - z0);
    const yAt = (t) => 3.35 - 0.75 * 4 * t * (1 - t);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, xa = x0 + (x1 - x0) * t0, za = z0 + (z1 - z0) * t0, xb = x0 + (x1 - x0) * t1, zb = z0 + (z1 - z0) * t1, ya = yAt(t0), yb = yAt(t1);
      S.push(bx(0.025, 0.025, Math.hypot(len / n, yb - ya), X + (xa + xb) / 2, Y + (ya + yb) / 2, Z + (za + zb) / 2, '#3b3350', 0, -Math.atan2(yb - ya, len / n), yaw));
      const tm = (t0 + t1) / 2, xm = x0 + (x1 - x0) * tm, zm = z0 + (z1 - z0) * tm, ym = yAt(tm) - 0.08;
      N.push(C(0.035, 0.05, 0.12, 6, xm, ym, zm, BULB[nb % BULB.length]));
      if (nb % 3 === 0) glowAt(xm, ym, zm, BULB[nb % BULB.length], 2.2, 0);
      nb++;
    }
  }

  // ---------------------------------------------------------------- warm light pools on the deck at night (one mesh)
  const pools = [];
  const poolAt = (lx, lz, rr, k, hex = '#ffb870') => pools.push([X + lx, Z + lz, rr, k, new THREE.Color(hex)]);
  for (const [[x0, z0], [x1, z1]] of strings) for (let t = 0.12; t < 0.95; t += 0.19) poolAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 3.6, 0.32);
  poolAt(-12.7, -12.5, 5.5, 0.55); poolAt(9.2, 0, 3.2, 0.5, '#ff9a4a'); poolAt(-17.2, 0, 2.6, 0.45);
  for (const [x, z] of [[-13, 9], [-7.5, 5.5]]) poolAt(x, z, 1.6, 0.4);
  const poolMesh = deckPools(pools, Y + 0.012);
  group.add(poolMesh);

  // ---------------------------------------------------------------- where the guests go (game/spire.js), best spots first
  const lean = (lx, lz, yaw) => spots.push({ kind: 'lean', x: X + lx, z: Z + lz, yaw, y: 0 });
  const sitAt = (s, ox = 0) => spots.push({ kind: s.kind === 'lounger' ? 'lounger' : 'sit', x: s.x + Math.cos(s.yaw) * ox, z: s.z - Math.sin(s.yaw) * ox, yaw: s.yaw, y: s.y, seat: s });
  lean(23.3, -1.6, PI / 2); sitAt(seats.find((s) => s.kind === 'stool' && s.x === X - 15.6)); sitAt(loungers[1]); lean(23.3, 1.4, PI / 2);
  sitAt(sofas[0]); sitAt(sofas[1]); sitAt(benches[2], -0.45); sitAt(benches[2], 0.45); sitAt(loungers[4]);
  spots.push({ kind: 'stand', x: X - 13, z: Z + 9.8, yaw: PI, y: 0 }, { kind: 'stand', x: X - 13.7, z: Z + 8.5, yaw: PI * 0.75, y: 0 });
  lean(-3, 17.3, 0); lean(-2.2, 17.3, 0.2); sitAt(seats.find((s) => s.kind === 'stool' && s.x === X - 9.9)); sitAt(benches[4], 0.4);
  spots.push({ kind: 'stand', x: X - 7.5, z: Z + 6.3, yaw: PI, y: 0 });
  lean(16, -17.3, PI);

  b.terrace = { X, Z, Y, T, seats, spots, glass: glassMesh, pools: poolMesh, bulbs: nb };
  return b.terrace;
}

// soft additive pools of warm light on the deck, only at night (they follow the night uniform), fogged like the rest
function deckPools(list, y) {
  const parts = [];
  for (const [x, z, rr, k, c] of list) {
    const q = new THREE.CircleGeometry(rr, 18).toNonIndexed();
    q.rotateX(-PI / 2); q.translate(x, y, z);
    const n = q.attributes.position.count, a = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i] = Math.hypot(q.attributes.position.getX(i) - x, q.attributes.position.getZ(i) - z) / rr; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    q.setAttribute('aR', new THREE.BufferAttribute(a, 1)); q.setAttribute('color', new THREE.BufferAttribute(col, 3));
    q.deleteAttribute('uv'); q.deleteAttribute('normal');
    parts.push(q);
  }
  const m = new THREE.Mesh(merge(parts), new THREE.ShaderMaterial({
    uniforms: { uNight: nightU, ...fogU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true,
    vertexShader: `attribute float aR; varying vec3 vC; varying float vR; varying float vD; void main(){ vC = color; vR = aR; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${FOG_PARS} uniform float uNight; varying vec3 vC; varying float vR; varying float vD; void main(){ float a = 1.0 - smoothstep(0.0, 1.0, vR); gl_FragColor = vec4(vC * a * a * smoothstep(0.25, 0.8, uNight) * (1.0 - smoothstep(uFogNear, uFogFar, vD)), 1.0); }`,
  }));
  m.renderOrder = 1; m.frustumCulled = false;
  return m;
}
