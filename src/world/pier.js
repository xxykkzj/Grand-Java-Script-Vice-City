// Starlight Pier: the boardwalk amusement pier at the east end of Coral Beach. A wide wooden deck from the
// dunes out over the surf, a lit arch with its name, the Starlight Wheel (a rideable Ferris wheel, see
// game/pier.js), a carousel, a wave-swinger, three game booths, a candy-floss and popcorn stand, a photo
// cut-out board, string lights, lamps, benches and railings all round.
//
//   APIER ...              pure data (layout.js, sea.js, beach.js and the minimap read it)
//   planPier(props, L)     colliders (rails, rides, booths, stand) and the deck lamps (layout.js)
//   pierDetails(L, S, N, glows, put)   the static geometry, merged into the town's one solid mesh and its
//                          neon mesh (no extra draw call), plus the benches (loose props)
//   createPierFx(scene, L) what moves or lights up: the wheel (structure, gondolas, bulbs), the carousel
//                          (canopy, horses, bulbs), the swing seats, the string-light bulbs and the arch sign.
//                          About ten draw calls, only drawn while the camera is within reach of the pier.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng, timeU, nightU, fogU, FOG_PARS, reducedMotion, clamp } from '../core/util.js';

export const APIER = { x0: 250, x1: 294, z0: 106, z1: 214, cx: 272, name: 'STARLIGHT PIER' };
export const ARCH = { x: 272, z: 106, gap0: 268.4, gap1: 275.6 };
// the gondolas hang outboard of the north rim (off: their offset along z), so the view from them is open
export const WHEEL = { x: 272, y: 22, z: 196, R: 19, N: 16, hang: 2.75, half: 1.45, off: -2.6, name: 'STARLIGHT WHEEL' };
export const BOARD = { x: 272, z: 191.4 };              // stand here and press E (the gondola door faces -z)
export const CAROUSEL = { x: 261, z: 141, r: 5.6 };
export const SWING = { x: 284, z: 167, r: 3.0, chain: 6.2, top: 8.6, n: 12 };
export const BOOTHS = [{ z: 117.5, kind: 'ring', name: 'RING-A-TOSS' }, { z: 124.5, kind: 'duck', name: 'DUCK DERBY' }, { z: 131.5, kind: 'pop', name: 'BALLOON POP' }];
export const BOOTH_X = 252.9;
export const CANDY = { x: 290.4, z: 126, name: 'SUGAR TIDE' };      // the counter faces -x
export const CANDY_SPOT = { x: CANDY.x - 2.3, z: CANDY.z };
export const PHOTO = { x: 287, z: 111.5 };
export const FISH_SPOTS = [[255.5, 212.6], [262.5, 212.6], [286.5, 212.6]];
export const BENCHES = [[251.6, 150, PI / 2], [251.6, 163, PI / 2], [251.6, 178, PI / 2], [292.4, 141, -PI / 2], [292.4, 152, -PI / 2], [292.4, 184, -PI / 2], [292.4, 204, -PI / 2], [251.6, 204, PI / 2]];
export const onAPier = (x, z, m = 0) => x > APIER.x0 - m && x < APIER.x1 + m && z > APIER.z0 - m && z < APIER.z1 + m;
const RAIL = '#fbf7f0', WOOD = '#c09060', WOOD2 = '#a87a4e', DARK = '#3a3150', CREAM = '#fff6ec';
const STR_X = [265.6, 278.4], STR_Z = [];
for (let z = 112; z <= 186; z += 12.3) STR_Z.push(z);

// ---- colliders, lamps (layout.js, before the props grid is built)
export function planPier(props, L) {
  const P = props, A = APIER, own = (o, tag) => { o.own = 'pier'; o.tag = tag; return o; };
  // Sealed all round: solid rails down both sides and across the end, the landward end either side of the arch
  // (the only way on and off). 2.2 m tall colliders so a sprint-jump at the rail can't sail over it; the part out
  // over the water stands on the deck (y0 = 0), so a swimmer underneath can still pass between the piles. The
  // deck edge is also a hard clamp in player/player.js (like the Solstice Terrace's glass).
  const sz1 = 162.5, szc = (A.z0 + sz1) / 2, slen = sz1 - A.z0, wz = (sz1 + A.z1) / 2, wlen = A.z1 - sz1 + 0.3, T = 0.5, H = 2.2;
  own(P.box(A.x0 + 0.12, szc, T, slen, H), 'rail'); own(P.box(A.x1 - 0.12, szc, T, slen, H), 'rail');
  own(P.box(A.x0 + 0.12, wz, T, wlen, H, 0, 0), 'rail'); own(P.box(A.x1 - 0.12, wz, T, wlen, H, 0, 0), 'rail');
  own(P.box(A.cx, A.z1 - 0.12, A.x1 - A.x0 + 0.3, T, H, 0, 0), 'end rail');
  own(P.box((A.x0 + ARCH.gap0) / 2 - 0.15, A.z0 + 0.12, ARCH.gap0 - A.x0 + 0.3, T, H), 'rail');
  own(P.box((ARCH.gap1 + A.x1) / 2 + 0.15, A.z0 + 0.12, A.x1 - ARCH.gap1 + 0.3, T, H), 'rail');
  for (const x of [268.95, 270.85, 273.15, 275.05]) own(P.circle(x, A.z0 + 0.8, 0.14, 1.0), "bollard");
  // the wheel: four legs, and its lowest gondolas (nobody walks into a passing cabin)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) own(P.circle(WHEEL.x + sx * 10, WHEEL.z + (sz < 0 ? -6.6 : 4.6), 0.55, 30), 'wheel leg');
  own(P.box(WHEEL.x, WHEEL.z - 0.75, 16, 5.9, 4.5), 'wheel');
  own(P.box(266.2, 191, 1.8, 1.8, 2.8), 'ticket booth');
  own(P.box(268.3, 188.5, 0.12, 5, 1.0), 'queue rail'); own(P.box(275.7, 188.5, 0.12, 5, 1.0), 'queue rail');
  own(P.circle(CAROUSEL.x, CAROUSEL.z, CAROUSEL.r, 4.5), 'carousel');
  own(P.circle(SWING.x, SWING.z, SWING.r + SWING.chain * 0.6, 3.6), 'swing ride');
  for (const b of BOOTHS) own(P.box(BOOTH_X, b.z, 3.2, 5.2, 2.9), 'game booth');
  own(P.box(CANDY.x + 0.4, CANDY.z, 2.6, 3.4, 2.8), 'candy stand');
  own(P.box(PHOTO.x, PHOTO.z, 2.8, 0.35, 2.3), 'photo board');
  for (const [x, z] of [[266.6, ARCH.z], [277.4, ARCH.z]]) own(P.box(x, z + 0.2, 1.1, 1.1, 8), 'arch');
  for (const x of STR_X) for (const z of STR_Z) own(P.circle(x, z, 0.12, 4.4), 'light pole');
  for (const [x, z] of [[259, 160], [288, 196], [257, 188]]) own(P.box(x, z, 0.62, 0.62, 1.0), 'bin');
  // lamps on both rails (drawn, lit and pooled with the town's: city.js / lamplight)
  for (let z = 116; z <= 206; z += 18) { L.lamps.push({ x: A.x0 + 0.75, z, yaw: PI / 2, pier: true }, { x: A.x1 - 0.75, z: z + 9 > 210 ? z : z + 9, yaw: -PI / 2, pier: true }); }
}

// a cylinder from one point to another
const UP = new THREE.Vector3(0, 1, 0);
function beam(x0, y0, z0, x1, y1, z1, r, hex, seg = 6) {
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return tint(g, hex);
}

// ---- the static pier: deck, piles, rails, arch, the wheel's legs, booths, the stand, poles ...
export function pierDetails(L, S, N, glows, put) {
  const A = APIER, r = rng(7272), W = A.x1 - A.x0, len = A.z1 - A.z0, zc = (A.z0 + A.z1) / 2;
  S.push(box(W, 0.5, len, A.cx, -0.23, zc, WOOD));
  for (let z = A.z0 + 0.6; z < A.z1; z += 1.2) S.push(box(W - 0.4, 0.006, 0.07, A.cx, 0.024, z, WOOD2));
  // the promenade down the middle: paler planks, a painted star every few metres
  S.push(box(11, 0.008, len - 2, A.cx, 0.026, zc, '#d9ab78'));
  for (let z = 114; z < 186; z += 14) S.push(tint(new THREE.CircleGeometry(0.9, 5).rotateX(-PI / 2).rotateY(r()).translate(A.cx, 0.032, z), '#ffd447'));
  for (const x of [A.x0 + 0.3, 261, A.cx, 283, A.x1 - 0.3]) for (let z = 154; z <= A.z1; z += 10) S.push(cyl(0.34, 0.38, 5, 6, x, -2.7, z, '#6b4a30'));
  // rails: posts, two bars, a neon tube on top (cyan on the west side, pink on the east, gold at the end)
  const rail = (x0, z0, x1, z1, neon) => {
    const L2 = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let s = 0; s <= L2 + 0.01; s += 2.5) { const k = s / L2; S.push(box(0.16, 1.1, 0.16, x0 + (x1 - x0) * k, 0.57, z0 + (z1 - z0) * k, RAIL)); }
    S.push(alongX ? box(L2, 0.12, 0.12, cx, 1.1, cz, RAIL) : box(0.12, 0.12, L2, cx, 1.1, cz, RAIL));
    S.push(alongX ? box(L2, 0.08, 0.08, cx, 0.6, cz, RAIL) : box(0.08, 0.08, L2, cx, 0.6, cz, RAIL));
    N.push(alongX ? box(L2, 0.06, 0.06, cx, 1.2, cz, neon) : box(0.06, 0.06, L2, cx, 1.2, cz, neon));
  };
  rail(A.x0 + 0.12, A.z0, A.x0 + 0.12, A.z1, '#18f0ff'); rail(A.x1 - 0.12, A.z0, A.x1 - 0.12, A.z1, '#ff2bd1');
  rail(A.x0, A.z1 - 0.12, A.x1, A.z1 - 0.12, '#ffe14a');
  rail(A.x0, A.z0 + 0.12, ARCH.gap0 - 1.2, A.z0 + 0.12, '#18f0ff'); rail(ARCH.gap1 + 1.2, A.z0 + 0.12, A.x1, A.z0 + 0.12, '#ff2bd1');
  for (const x of [268.95, 270.85, 273.15, 275.05]) S.push(cyl(0.14, 0.16, 1.0, 8, x, 0.5, A.z0 + 0.8, "#ffd447"), cyl(0.15, 0.15, 0.12, 8, x, 0.78, A.z0 + 0.8, '#ff2bd1'));
  for (let z = 124; z < 210; z += 22) for (const x of [A.x0 + 0.05, A.x1 - 0.05]) S.push(tint(new THREE.TorusGeometry(0.34, 0.1, 5, 10).rotateY(PI / 2).translate(x, 0.82, z), '#ff6a3d'));
  // the arch: two candy-striped pylons, a crossbeam (the sign itself is in createPierFx), a sunburst on top
  for (const x of [266.6, 277.4]) {
    for (let i = 0; i < 10; i++) S.push(box(1.0, 0.76, 1.0, x, 0.38 + i * 0.76, ARCH.z + 0.2, i % 2 ? '#ff4fa3' : CREAM));
    S.push(box(1.3, 0.3, 1.3, x, 7.75, ARCH.z + 0.2, '#ffd447'), tint(new THREE.SphereGeometry(0.42, 10, 6).translate(x, 8.3, ARCH.z + 0.2), '#ffd447'));
  }
  S.push(box(11.6, 0.5, 0.6, A.cx, 7.3, ARCH.z + 0.2, '#2a2140'), box(9.4, 2.5, 0.3, A.cx, 5.6, ARCH.z + 0.2, '#2a2140'));
  for (let i = 0; i < 9; i++) { const a = PI * (0.1 + i * 0.1); N.push(box(0.12, 2.4, 0.08, A.cx + Math.cos(a) * 1.6, 7.6 + Math.sin(a) * 1.6, ARCH.z + 0.2, i % 2 ? '#ffe14a' : '#ff8a3d', 0, 0, a - PI / 2)); }
  glows.push([A.cx, 5.6, ARCH.z - 0.6, '#ff8fd0', 14, 0.05]);
  // the wheel's A-frame legs, cross braces and the axle bearings (the wheel itself turns: createPierFx)
  const Wx = WHEEL.x, Wy = WHEEL.y, Wz = WHEEL.z;
  // (the north frame stands further out: the gondolas hang between it and the north rim)
  for (const sz of [-1, 1]) {
    const zf = sz < 0 ? 6.6 : 4.6, zt = sz < 0 ? 4.5 : 2.05;
    for (const sx of [-1, 1]) S.push(beam(Wx + sx * 10, 0, Wz + sz * zf, Wx, Wy, Wz + sz * zt, 0.38, '#e8e4f0', 8));
    for (const y of [6, 13]) { const k = y / Wy; S.push(beam(Wx - 10 * (1 - k), y, Wz + sz * (zf - (zf - zt) * k), Wx + 10 * (1 - k), y, Wz + sz * (zf - (zf - zt) * k), 0.16, '#d0cadc')); }
    S.push(box(1.4, 1.4, 0.8, Wx, Wy, Wz + sz * zt, '#a8a2b8'));
    for (const sx of [-1, 1]) S.push(box(1.6, 0.4, 1.6, Wx + sx * 10, 0.2, Wz + sz * zf, '#8a8494'));
  }
  S.push(cyl(0.5, 0.5, 6.6, 10, Wx, Wy, Wz - 1.2, '#a8a2b8', PI / 2));
  // the boarding platform: a painted deck, queue rails, the ticket booth (RIDE $5) and its sign
  S.push(box(8.6, 0.05, 4.0, Wx, 0.05, 190.6, '#ff8fc4'), box(8.2, 0.055, 0.2, Wx, 0.055, 192.15, '#ffe14a'));
  for (const x of [268.3, 275.7]) { for (let z = 186; z <= 191; z += 1.25) S.push(cyl(0.05, 0.05, 1.0, 6, x, 0.5, z, '#d8c070')); S.push(box(0.06, 0.06, 5, x, 1.0, 188.5, '#ff2bd1')); }
  S.push(box(1.8, 2.3, 1.8, 266.2, 1.15, 191, '#27d8cf'), box(2.2, 0.25, 2.2, 266.2, 2.42, 191, '#ff4fa3'), box(1.2, 0.6, 0.05, 266.2, 1.5, 191.92, '#1a1530'));
  S.push(box(0.1, 3.4, 0.1, 277.2, 1.7, 190.4, RAIL), box(1.7, 0.9, 0.08, 277.2, 3.2, 190.4, '#2a2140'));
  N.push(box(1.5, 0.08, 0.04, 277.2, 3.62, 190.35, '#ffe14a'), box(1.5, 0.08, 0.04, 277.2, 2.78, 190.35, '#ffe14a'), box(0.9, 0.18, 0.03, 277.2, 3.2, 190.34, '#18f0ff'));
  // the carousel's plinth (the rest turns) and the swing ride's tower and crown
  S.push(cyl(CAROUSEL.r + 0.2, CAROUSEL.r + 0.3, 0.36, 24, CAROUSEL.x, 0.18, CAROUSEL.z, '#f7b3c6'));
  for (let i = 0; i < 3; i++) S.push(box(1.4, 0.12 + i * 0.12, 0.6, CAROUSEL.x, 0.06 * (i + 1), CAROUSEL.z - CAROUSEL.r - 0.3 - i * 0.0, '#e8a0b8'));
  S.push(cyl(0.5, 0.7, SWING.top, 10, SWING.x, SWING.top / 2, SWING.z, '#7a5cff'), cyl(1.6, 1.6, 0.5, 14, SWING.x, 0.25, SWING.z, '#5a3cb8'));
  S.push(cyl(SWING.r + 0.5, SWING.r + 0.2, 0.7, 18, SWING.x, SWING.top + 0.2, SWING.z, '#ffd447'), tint(new THREE.ConeGeometry(SWING.r + 0.6, 1.6, 18).translate(SWING.x, SWING.top + 1.35, SWING.z), '#ff4fa3'));
  N.push(cyl(SWING.r + 0.55, SWING.r + 0.55, 0.12, 18, SWING.x, SWING.top - 0.1, SWING.z, '#18f0ff'));
  for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; S.push(box(0.6, 0.9, 0.1, SWING.x + Math.cos(a) * 1.65, 0.6, SWING.z + Math.sin(a) * 1.65, i % 2 ? '#ffe14a' : '#27d8cf', 0, -a + PI / 2)); }
  // game booths along the west rail, open to the promenade (+x): counter, striped awning, prizes, targets
  const PRIZE = ['#ff5fa8', '#27d8cf', '#ffd447', '#9b7bff', '#8dff9a', '#ff8a4c'];
  BOOTHS.forEach((bt, bi) => {
    const x = BOOTH_X, z = bt.z, c = ['#ff4fa3', '#19c9bd', '#ffc93f'][bi];
    S.push(box(3.0, 2.6, 0.12, x, 1.3, z - 2.5, CREAM), box(3.0, 2.6, 0.12, x, 1.3, z + 2.5, CREAM), box(0.12, 2.6, 5.0, x - 1.45, 1.3, z, c));
    S.push(box(0.5, 1.0, 5.0, x + 1.3, 0.5, z, c), box(0.62, 0.08, 5.1, x + 1.3, 1.04, z, CREAM));
    for (let i = 0; i < 8; i++) S.push(box(1.2, 0.08, 0.64, x + 1.55, 2.75, z - 2.24 + i * 0.64, i % 2 ? CREAM : c, 0, 0, -0.35));
    S.push(box(0.1, 0.6, 4.2, x + 1.55, 3.25, z, '#2a2140'));
    N.push(box(0.04, 0.08, 3.8, x + 1.61, 3.52, z, '#ffe14a'), box(0.04, 0.08, 3.8, x + 1.61, 2.98, z, '#ffe14a'));
    // prizes on two shelves at the back: little plush blocks with ears
    for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) {
      const pc = PRIZE[(i + s * 2 + bi) % 6], pz = z - 1.9 + i * 0.76, py = 1.35 + s * 0.6;
      S.push(box(0.3, 0.06, 0.7, x - 1.25, py - 0.03, pz, '#8a6a4a'), box(0.3, 0.32, 0.3, x - 1.2, py + 0.16, pz, pc), box(0.2, 0.2, 0.2, x - 1.2, py + 0.42, pz, pc), box(0.06, 0.08, 0.06, x - 1.2, py + 0.56, pz - 0.07, pc), box(0.06, 0.08, 0.06, x - 1.2, py + 0.56, pz + 0.07, pc));
    }
    if (bt.kind === 'ring') for (let i = 0; i < 9; i++) S.push(cyl(0.03, 0.03, 0.3, 5, x - 0.2 + (i % 3) * 0.3, 1.2, z - 0.3 + Math.floor(i / 3) * 0.3, '#fbf7f0'), tint(new THREE.TorusGeometry(0.12, 0.025, 4, 10).rotateX(PI / 2).translate(x - 0.2 + (i % 3) * 0.3, 1.06, z - 0.3 + Math.floor(i / 3) * 0.3), PRIZE[i % 6]));
    if (bt.kind === 'duck') { S.push(box(0.5, 0.2, 4.2, x - 0.5, 0.95, z, '#2f8fd8')); for (let i = 0; i < 7; i++) S.push(box(0.2, 0.18, 0.28, x - 0.5, 1.14, z - 1.8 + i * 0.6, '#ffd447'), box(0.12, 0.12, 0.12, x - 0.5, 1.28, z - 1.7 + i * 0.6, '#ffd447'), box(0.05, 0.04, 0.08, x - 0.5, 1.28, z - 1.6 + i * 0.6, '#ff8a3d')); }
    if (bt.kind === 'pop') { S.push(box(0.08, 1.2, 3.8, x - 1.35, 1.9, z, '#c8a070')); for (let i = 0; i < 15; i++) S.push(tint(new THREE.SphereGeometry(0.13, 6, 4).scale(1, 1.2, 1).translate(x - 1.25, 1.45 + Math.floor(i / 5) * 0.4, z - 1.5 + (i % 5) * 0.75), PRIZE[(i * 2) % 6])); }
    glows.push([x + 1.6, 3.2, z, c, 6, 0.05]);
  });
  // Sugar Tide: candy floss and popcorn under a striped canopy, the counter facing the promenade (-x)
  { const { x, z } = CANDY;
    S.push(box(2.2, 1.05, 3.2, x + 0.4, 0.52, z, '#ff8fc4'), box(2.4, 0.08, 3.4, x + 0.4, 1.08, z, CREAM), box(0.12, 2.6, 3.2, x + 1.45, 1.3, z, '#fff0b3'));
    for (const oz of [-1.55, 1.55]) S.push(box(0.1, 2.9, 0.1, x - 0.65, 1.45, z + oz, RAIL));
    for (let i = 0; i < 7; i++) S.push(box(2.6, 0.1, 0.52, x + 0.4, 2.95, z - 1.56 + i * 0.52, i % 2 ? CREAM : '#27d8cf', 0, 0, 0.12));
    S.push(box(0.5, 0.75, 0.6, x + 0.6, 1.5, z - 0.9, '#ffe9a0'), box(0.52, 0.12, 0.62, x + 0.6, 1.92, z - 0.9, '#ff3f3a'));
    for (let i = 0; i < 10; i++) S.push(box(0.07, 0.07, 0.07, x + 0.45 + (i % 3) * 0.12, 1.2 + (i % 4) * 0.08, z - 1.05 + (i % 5) * 0.08, '#fff6dc'));
    S.push(cyl(0.34, 0.26, 0.3, 10, x + 0.5, 1.28, z + 0.7, '#c8d0dc'));
    for (let i = 0; i < 3; i++) { S.push(box(0.02, 0.4, 0.02, x - 0.2, 1.3, z + 0.3 + i * 0.32, '#fbf7f0')); S.push(tint(new THREE.SphereGeometry(0.16, 7, 5).scale(1, 1.15, 1).translate(x - 0.2, 1.58, z + 0.3 + i * 0.32), ['#ffb6d9', '#b6e8ff', '#ffb6d9'][i])); }
    S.push(box(0.08, 0.7, 2.6, x + 1.52, 2.25, z, '#2a2140'));
    N.push(box(0.04, 0.5, 0.06, x + 1.45, 2.25, z - 1.0, '#ff8fd0'), box(0.04, 0.06, 1.9, x + 1.45, 2.5, z, '#ff8fd0'), box(0.04, 0.06, 1.9, x + 1.45, 2.0, z, '#18f0ff'));
    glows.push([x - 0.4, 2.5, z, '#ff8fd0', 7, 0.05]);
  }
  // the photo cut-out: a strongman and a mermaid with holes for faces
  { const { x, z } = PHOTO;
    S.push(box(2.8, 2.2, 0.12, x, 1.25, z, '#27d8cf'), box(0.1, 0.3, 0.3, x - 1.2, 0.15, z, WOOD), box(0.1, 0.3, 0.3, x + 1.2, 0.15, z, WOOD));
    S.push(box(0.9, 1.1, 0.02, x - 0.65, 1.0, z - 0.07, '#ff6a6a'), box(1.1, 0.25, 0.02, x - 0.65, 1.35, z - 0.075, '#f1c9a5'), box(0.18, 0.5, 0.02, x - 0.65, 0.5, z - 0.075, '#22203a'));
    S.push(box(0.8, 0.8, 0.02, x + 0.65, 1.0, z - 0.07, '#9b7bff'), box(0.6, 0.4, 0.02, x + 0.65, 0.4, z - 0.075, '#27e8b0'), box(0.9, 0.2, 0.02, x + 0.65, 0.55, z - 0.08, '#8dff9a'));
    for (const ox of [-0.65, 0.65]) S.push(cyl(0.18, 0.18, 0.14, 10, x + ox, 1.85, z, '#1a1530', PI / 2));
    S.push(box(2.6, 0.32, 0.03, x, 2.2, z - 0.08, '#ffd447'));
  }
  // string-light poles down both sides of the promenade (the wires sag; the bulbs are in createPierFx)
  for (const x of STR_X) for (const z of STR_Z) S.push(cyl(0.07, 0.09, 4.4, 6, x, 2.2, z, '#3b3350'), box(0.3, 0.1, 0.1, x, 4.35, z, '#3b3350'));
  for (const [x0, z0, x1, z1] of stringRuns()) for (let k = 0; k < 8; k++) {
    const a = k / 8, b = (k + 1) / 8, ya = 4.3 - Math.sin(a * PI) * 0.7, yb = 4.3 - Math.sin(b * PI) * 0.7;
    S.push(beam(x0 + (x1 - x0) * a, ya, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, yb, z0 + (z1 - z0) * b, 0.012, DARK, 3));
  }
  // fishing rods leaning out over the end rail, a bucket by each
  for (const [x, z] of FISH_SPOTS) { S.push(beam(x + 0.3, 0.9, z - 0.2, x + 0.5, 3.4, z + 2.2, 0.02, '#2a2140', 4), beam(x + 0.5, 3.4, z + 2.2, x + 0.5, -0.6, z + 2.6, 0.004, '#e8e8f0', 3), cyl(0.18, 0.14, 0.3, 8, x - 0.5, 0.15, z - 0.5, '#2f8fd8')); }
  for (const [x, z] of [[259, 160], [288, 196], [257, 188]]) S.push(box(0.55, 0.9, 0.55, x, 0.45, z, '#2f6fb0'), box(0.6, 0.08, 0.6, x, 0.92, z, '#244f80'));
  // benches facing out to sea or along the deck
  for (const [x, z, yaw] of BENCHES) { const b = put.bench(x, z, yaw); if (b) { b.own = 'pier'; (L.pierSeats || (L.pierSeats = [])).push(...b.seats); } }
}
export function stringRuns() {
  const out = [];
  for (let i = 0; i < STR_Z.length; i++) {
    out.push([STR_X[0], STR_Z[i], STR_X[1], STR_Z[i]]);
    if (i < STR_Z.length - 1) out.push([STR_X[(i % 2)], STR_Z[i], STR_X[1 - (i % 2)], STR_Z[i + 1]]);
  }
  return out;
}

// ---- the light bulbs: one shader for all of them (patterns in the vertex colour channel, no textures)
//   aG group: 0 string lights (warm twinkle), 1 wheel rim (chase / wash / sparkle), 2 wheel spokes (pulses running
//   out from the hub), 3 carousel (alternate chase), 4 arch border (chase round), 5 gondola lamps; aP: 0..1 along it
export const lightU = { uMode: { value: 0 }, uOn: { value: 0 } };
export function lightMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: timeU, uNight: nightU, ...lightU, ...fogU },
    fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute float aP; attribute float aG;
      uniform float uT, uNight, uMode, uOn;
      ${FOG_PARS}
      varying vec3 vC;
      vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
      float hsh(float n){ return fract(sin(n * 91.7) * 43758.5); }
      void main(){
        float on = clamp(uOn, 0.0, 1.0), k = 1.0; vec3 c = aCol;
        if (aG < 0.5) k = 0.82 + 0.18 * sin(uT * 2.3 + aP * 61.0);
        else if (aG < 1.5) {
          float m = uMode;
          float chase = smoothstep(0.35, 0.6, fract(aP * 20.0 - uT * 0.9));
          vec3 rb = hue(aP + uT * 0.04);
          float spark = step(0.55, hsh(floor(uT * 5.0) + aP * 173.0));
          if (m < 0.5) { k = 0.25 + 0.75 * chase; c = rb; }
          else if (m < 1.5) { k = 0.75 + 0.25 * sin(uT * 3.0 + aP * 6.283 * 4.0); c = hue(uT * 0.06 + floor(aP * 4.0) * 0.25); }
          else { k = 0.2 + 0.8 * spark; c = mix(vec3(1.0, 0.9, 0.7), rb, 0.5); }
        } else if (aG < 2.5) { float w = fract(aP - uT * 0.45); k = 0.2 + 0.8 * smoothstep(0.75, 1.0, w); c = mix(aCol, hue(uT * 0.05), uMode > 1.5 ? 0.6 : 0.15); }
        else if (aG < 3.5) k = 0.3 + 0.7 * step(0.5, fract(aP * 12.0 + uT * 1.4));
        else if (aG < 4.5) k = 0.3 + 0.7 * smoothstep(0.3, 0.7, fract(aP * 14.0 - uT * 1.2));
        // by day: a pale unlit bulb; dusk and night: the pattern, kept under ~0.95 so the bloom never blows out
        float lit = smoothstep(0.15, 0.6, uNight) * on;
        vC = mix(vec3(0.92, 0.88, 0.8) * 0.55 + c * 0.12, c * k * 0.95, lit);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vC = mix(vC, uFogColor, smoothstep(uFogNear, uFogFar, -mv.z) * 0.85);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying vec3 vC;\nvoid main(){ gl_FragColor = vec4(vC, 1.0);\n#include <colorspace_fragment>\n}',
  });
}
// bulbs: [x, y, z, radius, hex, p, group] -> one non-indexed geometry with aCol / aP / aG
function bulbGeo(list) {
  const oct = new THREE.OctahedronGeometry(1, 0), base = oct.index ? oct.toNonIndexed() : oct, bp = base.attributes.position, n = bp.count;
  const pos = new Float32Array(list.length * n * 3), col = new Float32Array(list.length * n * 3), ap = new Float32Array(list.length * n), ag = new Float32Array(list.length * n);
  const c = new THREE.Color();
  list.forEach((b, i) => {
    c.set(b[4]);
    for (let k = 0; k < n; k++) {
      const o = (i * n + k);
      pos[o * 3] = b[0] + bp.getX(k) * b[3]; pos[o * 3 + 1] = b[1] + bp.getY(k) * b[3]; pos[o * 3 + 2] = b[2] + bp.getZ(k) * b[3];
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b; ap[o] = b[5]; ag[o] = b[6];
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aP', new THREE.BufferAttribute(ap, 1)); g.setAttribute('aG', new THREE.BufferAttribute(ag, 1));
  g.computeBoundingSphere();
  return g;
}

// the arch sign: its name in a painted canvas (both faces), framed by a row of bulbs
function signMesh() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#3a1660'); g.addColorStop(1, '#16102a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 128);
  x.font = 'bold 66px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = '#ff2bd1'; x.strokeText('STARLIGHT PIER', 256, 60);
  x.fillStyle = '#fff3c8'; x.fillText('STARLIGHT PIER', 256, 60);
  x.font = 'bold 18px sans-serif'; x.fillStyle = '#18f0ff'; x.fillText('RIDES · GAMES · CANDY FLOSS · EST. 1952', 256, 108);
  for (let i = 0; i < 5; i++) { x.fillStyle = '#ffe14a'; const sx = 40 + i * 108; x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2 - PI / 2, rr = k % 2 ? 3 : 7; x.lineTo(sx + Math.cos(a) * rr, 16 + Math.sin(a) * rr); } x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const f = new THREE.PlaneGeometry(9.2, 2.3).rotateY(PI).translate(APIER.cx, 5.6, ARCH.z + 0.03);
  const b = new THREE.PlaneGeometry(9.2, 2.3).translate(APIER.cx, 5.6, ARCH.z + 0.37);
  const m = new THREE.Mesh(merge([f, b].map((q) => q.toNonIndexed())), new THREE.MeshBasicMaterial({ map: tex }));
  return m;
}

// ---- what moves and what lights up
export function createPierFx(scene, L) {
  const lambert = new THREE.MeshLambertMaterial({ vertexColors: true }), lmat = lightMaterial();
  const root = new THREE.Group(); scene.add(root);
  const W = WHEEL, R = W.R, N = W.N, H = W.half;
  // ---------------- the wheel: hub, two rims, an inner ring, spokes, cross pins, all turning about z
  const wheel = new THREE.Group(); wheel.position.set(W.x, W.y, W.z); root.add(wheel);
  {
    const g = [];
    g.push(tint(new THREE.CylinderGeometry(1.1, 1.1, 4.0, 14).rotateX(PI / 2), '#d0cadc'), tint(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 14).rotateX(PI / 2), '#ff4fa3'));
    for (const sz of [-H, H]) {
      g.push(tint(new THREE.TorusGeometry(R, 0.24, 5, 72).translate(0, 0, sz), '#f6f1e7'), tint(new THREE.TorusGeometry(R - 1.3, 0.14, 4, 64).translate(0, 0, sz), '#ff8fc4'), tint(new THREE.TorusGeometry(9, 0.16, 4, 48).translate(0, 0, sz), '#f6f1e7'));
      for (let k = 0; k < N; k++) {
        const a = k / N * PI * 2, a2 = (k + 0.5) / N * PI * 2;
        g.push(beam(Math.cos(a) * 1.3, Math.sin(a) * 1.3, sz * 0.9, Math.cos(a) * R, Math.sin(a) * R, sz, 0.12, '#e8e4f0', 4));
        // diagonal bracing between the rims' spoke tips
        g.push(beam(Math.cos(a) * (R - 1.3), Math.sin(a) * (R - 1.3), sz, Math.cos(a2) * R, Math.sin(a2) * R, sz, 0.06, '#cfc6dc', 3));
      }
    }
    for (let k = 0; k < N; k++) { const a = k / N * PI * 2; g.push(beam(Math.cos(a) * R, Math.sin(a) * R, W.off - 0.85, Math.cos(a) * R, Math.sin(a) * R, H + 0.2, 0.1, '#a8a2b8', 5)); }
    wheel.add(new THREE.Mesh(merge(g), lambert));
    // bulbs: round both rims, along every spoke, round the inner ring; and a star on the hub
    const B = [];
    for (const sz of [-H - 0.28, H + 0.28]) {
      for (let i = 0; i < 96; i++) { const a = i / 96 * PI * 2; B.push([Math.cos(a) * (R + 0.05), Math.sin(a) * (R + 0.05), sz, 0.26, '#ffffff', i / 96, 1]); }
      for (let k = 0; k < N; k++) for (let j = 1; j <= 7; j++) { const a = k / N * PI * 2, rr = 1.6 + (R - 2) * j / 7; B.push([Math.cos(a) * rr, Math.sin(a) * rr, sz * 0.97, 0.2, k % 2 ? '#ff5fd0' : '#4ff0ff', j / 7, 2]); }
      for (let i = 0; i < 32; i++) { const a = i / 32 * PI * 2; B.push([Math.cos(a) * 9, Math.sin(a) * 9, sz, 0.13, '#ffd447', i / 32, 3]); }
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; B.push([Math.cos(a) * 1.55, Math.sin(a) * 1.55, H + 0.5, 0.17, '#ffe14a', i / 12, 4], [Math.cos(a) * 1.55, Math.sin(a) * 1.55, -H - 0.5, 0.17, '#ffe14a', i / 12, 4]); }
    const bulbs = new THREE.Mesh(bulbGeo(B), lmat); bulbs.frustumCulled = false; wheel.add(bulbs);
  }
  // gondolas: one instanced cabin, hung from each pivot and kept level, each in its own colour
  const gg = [];
  const fl = -W.hang;
  gg.push(box(1.9, 0.12, 2.0, 0, fl + 0.06, 0, '#ffffff'), box(1.9, 0.7, 0.08, 0, fl + 0.42, -0.96, '#ffffff'), box(1.9, 0.7, 0.08, 0, fl + 0.42, 0.96, '#ffffff'),
    box(0.08, 0.7, 2.0, -0.91, fl + 0.42, 0, '#ffffff'), box(0.08, 0.7, 2.0, 0.91, fl + 0.42, 0, '#ffffff'),
    box(1.95, 0.08, 2.05, 0, fl + 0.8, 0, '#f6f1e7'));
  for (const [ox, oz] of [[-0.9, -0.95], [0.9, -0.95], [-0.9, 0.95], [0.9, 0.95]]) gg.push(box(0.07, 1.2, 0.07, ox, fl + 1.4, oz, '#e8e4f0'));
  gg.push(box(2.1, 0.14, 2.2, 0, fl + 2.0, 0, '#ffffff'), tint(new THREE.ConeGeometry(1.3, 0.38, 4).rotateY(PI / 4).translate(0, fl + 2.26, 0), '#ffffff'));
  gg.push(box(0.1, 0.4, 0.1, 0, -0.2, -0.75, '#a8a2b8'), box(0.1, 0.4, 0.1, 0, -0.2, 0.75, '#a8a2b8'), box(0.1, 0.1, 1.6, 0, -0.05, 0, '#a8a2b8'), box(0.08, 0.1, 0.08, 0, fl + 2.38, 0, '#a8a2b8'));
  gg.push(box(0.5, 0.36, 1.7, -0.62, fl + 0.3, 0, '#e85a9a'), box(0.5, 0.36, 1.7, 0.62, fl + 0.3, 0, '#e85a9a'));     // two bench seats
  const gond = new THREE.InstancedMesh(merge(gg), lambert, N); gond.frustumCulled = false; root.add(gond);
  const GCOL = ['#ff5fa8', '#27d8cf', '#ffd447', '#9b7bff', '#ff8a4c', '#8dff9a', '#7fe0ff', '#ff3f6a'];
  const colr = new THREE.Color();
  for (let k = 0; k < N; k++) gond.setColorAt(k, colr.set(GCOL[k % GCOL.length]));
  // a lamp under each gondola roof (bulbs that follow the cabins: an instanced copy of one bulb per gondola)
  const gl = new THREE.InstancedMesh(bulbGeo([[0, fl + 1.86, -1.02, 0.12, '#ffe9b0', 0, 5], [0, fl + 1.86, 1.02, 0.12, '#ffe9b0', 0, 5]]), lmat, N); gl.frustumCulled = false; root.add(gl);

  // ---------------- the carousel: platform, centre drum, poles, canopy (turning) and the horses (bobbing)
  const car = new THREE.Group(); car.position.set(CAROUSEL.x, 0, CAROUSEL.z); root.add(car);
  const HR = 3.7, NH = 8;
  {
    const g = [], r0 = CAROUSEL.r;
    for (let i = 0; i < 16; i++) { const a0 = i / 16 * PI * 2; g.push(tint(new THREE.CylinderGeometry(r0, r0, 0.12, 4, 1, false, a0, PI / 8).translate(0, 0.42, 0), i % 2 ? '#fff0b3' : '#ff8fc4')); }
    g.push(cyl(1.3, 1.3, 3.6, 12, 0, 2.2, 0, '#7fe0ff'), cyl(1.36, 1.36, 0.25, 12, 0, 0.6, 0, '#ffd447'), cyl(1.36, 1.36, 0.25, 12, 0, 3.9, 0, '#ffd447'));
    for (let i = 0; i < 16; i++) { const a0 = i / 16 * PI * 2; g.push(tint(new THREE.ConeGeometry(r0 + 0.4, 1.7, 4, 1, true, a0, PI / 8).translate(0, 4.95, 0), i % 2 ? '#ff4fa3' : CREAM)); }
    g.push(cyl(r0 + 0.42, r0 + 0.42, 0.55, 24, 0, 4.0, 0, '#ffd447'), tint(new THREE.SphereGeometry(0.35, 8, 6).translate(0, 6.0, 0), '#ffd447'), cyl(0.05, 0.05, 0.8, 5, 0, 6.5, 0, '#fbf7f0'), box(0.6, 0.35, 0.02, 0.32, 6.7, 0, '#ff2bd1'));
    for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; g.push(box(0.6, 0.35, 0.05, Math.cos(a) * (r0 + 0.44), 3.55, Math.sin(a) * (r0 + 0.44), i % 2 ? '#ff4fa3' : '#27d8cf', 0, -a + PI / 2)); }
    for (let k = 0; k < NH; k++) { const a = k / NH * PI * 2; g.push(cyl(0.05, 0.05, 3.6, 6, Math.cos(a) * HR, 2.2, Math.sin(a) * HR, '#ffd88a')); }
    car.add(new THREE.Mesh(merge(g), lambert));
    const B = [];
    for (let i = 0; i < 36; i++) { const a = i / 36 * PI * 2; B.push([Math.cos(a) * (r0 + 0.5), 4.3, Math.sin(a) * (r0 + 0.5), 0.16, i % 3 ? '#ffe9b0' : '#ff8fd0', i / 36, 3]); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; B.push([Math.cos(a) * 1.4, 3.9, Math.sin(a) * 1.4, 0.1, '#ffe9b0', i / 16, 3]); }
    const cb = new THREE.Mesh(bulbGeo(B), lmat); cb.frustumCulled = false; car.add(cb);
  }
  const horse = merge([box(0.38, 0.42, 1.15, 0, 0, 0, '#ffffff'), box(0.3, 0.6, 0.3, 0, 0.35, 0.5, '#ffffff', -0.5), box(0.28, 0.26, 0.55, 0, 0.62, 0.78, '#ffffff', 0.2),
    box(0.1, 0.4, 0.42, 0, 0.62, 0.42, '#ffd447', -0.5), box(0.4, 0.08, 0.5, 0, 0.24, -0.05, '#ff4fa3'),
    ...[[-0.13, 0.4], [0.13, 0.4], [-0.13, -0.42], [0.13, -0.42]].map(([x, z]) => box(0.1, 0.55, 0.12, x, -0.42, z, '#ffffff', z > 0 ? -0.5 : 0.5)),
    box(0.1, 0.45, 0.1, 0, 0.05, -0.65, '#ffd447', 0.6)]);
  const horses = new THREE.InstancedMesh(horse, lambert, NH); horses.frustumCulled = false; car.add(horses);
  for (let k = 0; k < NH; k++) horses.setColorAt(k, colr.set(['#ffffff', '#ffd6e8', '#d6f4ff', '#fff3c0'][k % 4]));

  // ---------------- the wave-swinger: twelve seats on chains, flung out as it spins
  const seatG = merge([beam(0, 0, -0.18, 0, -SWING.chain, -0.18, 0.015, '#c8c4d4', 3), beam(0, 0, 0.18, 0, -SWING.chain, 0.18, 0.015, '#c8c4d4', 3),
    box(0.5, 0.08, 0.5, 0, -SWING.chain, 0, '#ffffff'), box(0.5, 0.5, 0.08, 0, -SWING.chain + 0.25, -0.22, '#ffffff'), box(0.06, 0.06, 0.5, 0.22, -SWING.chain + 0.3, 0, '#ffd447')]);
  const seats = new THREE.InstancedMesh(seatG, lambert, SWING.n); seats.frustumCulled = false; root.add(seats);
  for (let k = 0; k < SWING.n; k++) seats.setColorAt(k, colr.set(GCOL[(k * 3) % GCOL.length]));

  // ---------------- string lights over the promenade and the bulbs round the arch sign
  {
    const B = [];
    let n = 0;
    for (const [x0, z0, x1, z1] of stringRuns()) for (let k = 1; k < 12; k++) { const a = k / 12; B.push([x0 + (x1 - x0) * a, 4.25 - Math.sin(a * PI) * 0.7 - 0.1, z0 + (z1 - z0) * a, 0.12, ['#ffe9b0', '#ff8fd0', '#8ff0ff', '#ffe14a'][n % 4], (n++ % 97) / 97, 0]); }
    const sx0 = APIER.cx - 4.75, sx1 = APIER.cx + 4.75, sy0 = 4.3, sy1 = 6.9;
    const per = [];
    for (let i = 0; i <= 19; i++) per.push([sx0 + (sx1 - sx0) * i / 19, sy1]);
    for (let i = 1; i <= 5; i++) per.push([sx1, sy1 - (sy1 - sy0) * i / 5]);
    for (let i = 1; i <= 19; i++) per.push([sx1 - (sx1 - sx0) * i / 19, sy0]);
    for (let i = 1; i < 5; i++) per.push([sx0, sy0 + (sy1 - sy0) * i / 5]);
    per.forEach(([x, y], i) => { for (const z of [ARCH.z - 0.02, ARCH.z + 0.42]) B.push([x, y, z, 0.11, '#ffe9b0', i / per.length, 4]); });
    const s = new THREE.Mesh(bulbGeo(B), lmat); s.frustumCulled = false; root.add(s); var strings = s;
  }
  const sign = signMesh(); root.add(sign);

  // ---------------- animation
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), d = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), Y = new THREE.Vector3(0, 1, 0);
  const S = { angle: 0, held: false, carA: 0, carW: 0, swA: 0, swW: 0, swT: 0, open: 1, mode: 0, modeT: 0, sway: 0 };
  // the world position of gondola k's pivot, and of its cabin floor centre
  const pivot = (k, out = new THREE.Vector3()) => { const a = S.angle + k / N * PI * 2; return out.set(W.x + Math.cos(a) * R, W.y + Math.sin(a) * R, W.z); };
  function update(dt, cam, game) {
    const c = cam.position, dd = Math.hypot(c.x - APIER.cx, c.z - 160);
    // the wheel is a landmark from across the old town and from up high; the small rides, the string lights and the
    // sign are only drawn within ~220 m (three draw calls from far away, ten close up)
    root.visible = !game.inside && (game.districts ? game.districts.showA || c.y > 60 : true) && (dd < 520 || c.y > 60 && dd < 1100);
    if (!root.visible) return;
    const close = dd < 220;
    car.visible = seats.visible = strings.visible = sign.visible = gl.visible = close;
    const t = timeU.value, rm = reducedMotion ? 0.4 : 1;
    // the wheel turns slowly unless the ride is driving it (game/pier.js sets S.held and S.angle)
    if (!S.held) S.angle += dt * PI * 2 / 95 * S.open;
    wheel.rotation.z = S.angle;
    S.sway = Math.sin(t * 0.7) * 0.025 * rm;
    for (let k = 0; k < N; k++) {
      pivot(k, v); v.z += W.off;
      q.setFromAxisAngle(d.set(0, 0, 1), S.sway * Math.sin(k * 1.7 + t * 0.3));
      M.compose(v, q, one); gond.setMatrixAt(k, M); gl.setMatrixAt(k, M);
    }
    gond.instanceMatrix.needsUpdate = true; gl.instanceMatrix.needsUpdate = true;
    // carousel: turns while open, the horses bob up and down their poles
    S.carW += ((S.open ? 0.42 : 0) * rm - S.carW) * Math.min(1, dt * 0.4);
    S.carA += S.carW * dt; car.rotation.y = S.carA;
    for (let k = 0; k < NH; k++) {
      const a = k / NH * PI * 2, y = 1.35 + Math.sin(t * 2.2 + k * PI / 2) * 0.3 * Math.min(1, S.carW * 3);
      q.setFromAxisAngle(Y, -a); M.compose(v.set(Math.cos(a) * HR, y, Math.sin(a) * HR), q, one); horses.setMatrixAt(k, M);
    }
    horses.instanceMatrix.needsUpdate = true;
    // the swinger: a 46 s cycle (spin up, fly, slow down, rest); seats swing out with the speed
    S.swT = (S.swT + dt) % 46;
    const tw = S.open ? (S.swT < 6 ? S.swT / 6 : S.swT < 32 ? 1 : S.swT < 40 ? 1 - (S.swT - 32) / 8 : 0) : 0;
    S.swW += (tw * 1.05 * rm - S.swW) * Math.min(1, dt * 1.5);
    S.swA += S.swW * dt;
    const tilt = 0.62 * Math.pow(S.swW / 1.05, 1.6);
    for (let k = 0; k < SWING.n; k++) {
      const a = S.swA + k / SWING.n * PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      v.set(SWING.x + ca * SWING.r, SWING.top - 0.2, SWING.z + sa * SWING.r);
      d.set(ca * Math.sin(tilt), -Math.cos(tilt), sa * Math.sin(tilt));
      q.setFromUnitVectors(DOWN, d); qy.setFromAxisAngle(Y, -a); q.multiply(qy);
      M.compose(v, q, one); seats.setMatrixAt(k, M);
    }
    seats.instanceMatrix.needsUpdate = true;
    // the wheel's light show changes pattern every 14 s; everything is dark when the pier is closed (small hours)
    S.modeT += dt; if (S.modeT > 14) { S.modeT = 0; S.mode = (S.mode + 1) % 3; }
    lightU.uMode.value = S.mode; lightU.uOn.value += ((S.lightsOn ?? 1) - lightU.uOn.value) * Math.min(1, dt * 0.8);
  }
  return { root, wheel, gond, S, pivot, update, horses, seats, sign, meshes: () => { let n = 0; root.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; } };
}
export { clamp };
