// The edge of the island, built so the collision line is always something you can see:
// a seawall with a railing and lamps around the city, riprap rocks where the beach meets the sides,
// a closed causeway stub where Lumina Boulevard leaves the island to the west (barriers, cones,
// flashing amber lamps, a sign, a repair barge in the gap) and dead-end boards and bollards where
// the other streets stop. Everything is pushed into the city's merged meshes: no extra draw calls.
import * as THREE from 'three';
import { box, cyl, tint, rng, PI } from '../core/util.js';
import { HX, HZ, SIDE_X, ROADS, CAUSEWAY, EDGE_SIGNS } from './layout.js';

const WALL_C = '#e9d8c4', COPING = '#27c9bf', RAIL = '#fbf7f0', INK = '#1d1630', ASPH = '#3b3548';
const ROCK = ['#9a8f86', '#b0a497', '#857a72', '#a89a88'];

export function addEdges(S, N, glows, signs) {
  const r = rng(1312);
  const blink = [];                                         // flashing amber lamps (animated by the horizon lights)
  const C = CAUSEWAY, BZ = ROADS.blvd.z;

  // ---- seawall: a run of wall along x (alongX) or along z, centred on the island edge line
  const T = 1.2, TOP = 0.85;
  function wall(alongX, fixed, a0, a1) {
    const len = a1 - a0, mid = (a0 + a1) / 2;
    const at = (a, y, w, h, d, hex) => (alongX ? box(len + w, h, d, mid, y, fixed, hex) : box(d, h, len + w, fixed, y, mid, hex));
    S.push(at(0, (TOP - 3) / 2, 0, TOP + 3, T, WALL_C), at(0.2, TOP + 0.07, 0.2, 0.14, T + 0.25, COPING));
    // railing: two rails on posts
    S.push(at(0, TOP + 0.55, 0, 0.06, 0.07, RAIL), at(0, TOP + 0.95, 0, 0.07, 0.09, RAIL));
    for (let a = a0 + 1; a < a1; a += 2.5) S.push(alongX ? box(0.09, 1, 0.09, a, TOP + 0.5, fixed, RAIL) : box(0.09, 1, 0.09, fixed, TOP + 0.5, a, RAIL));
    // a lamp every 40 m, on the inner side
    for (let a = a0 + 12; a < a1 - 4; a += 40) {
      const inward = alongX ? (fixed < 0 ? 1 : -1) : (fixed < 0 ? 1 : -1);
      const x = alongX ? a : fixed + inward * 0.2, z = alongX ? fixed + inward * 0.2 : a;
      S.push(cyl(0.07, 0.1, 4.2, 6, x, TOP + 2.1, z, '#3b3350'), box(0.45, 0.16, 0.45, x, TOP + 4.25, z, '#fff2c8'));
      glows.push([x, TOP + 4.1, z, '#ffcf8a', 5.5, 0]);
    }
    // riprap at the foot, out in the water
    for (let a = a0; a < a1; a += 2.4) {
      const o = 1.2 + r() * 2.2, s = 0.8 + r() * 0.9;
      const sgn = alongX ? Math.sign(fixed) : Math.sign(fixed);
      rock(alongX ? a + r() : fixed + sgn * o, -0.5 + r() * 0.3, alongX ? fixed + sgn * o : a + r(), s);
    }
  }
  function rock(x, y, z, s) {
    const g = new THREE.IcosahedronGeometry(s, 0);
    g.scale(1 + r() * 0.5, 0.55 + r() * 0.3, 1 + r() * 0.5); g.rotateY(r() * 6.28); g.translate(x, y, z);
    S.push(tint(g, ROCK[Math.floor(r() * ROCK.length)]));
  }
  const E = HX - 0.2;                                       // wall centre: from HX - 0.8 (inner face) to HX + 0.4
  wall(false, E, -HZ - 0.4, 78);                            // east, behind the city and the promenade
  wall(false, -E, -HZ - 0.4, C.z0 - 0.3);                   // west, south of the causeway
  wall(false, -E, C.z1 + 0.3, 78);                          // west, north of the causeway
  wall(true, -(HZ - 0.2), -HX - 0.4, HX + 0.4);             // north, behind Back Bay
  // the beach meets the sides of the island at a bank of big rocks (a groyne running into the surf)
  for (const sx of [-1, 1]) {
    for (let z = 78; z < HZ + 8; z += 1.7) {
      for (let k = 0; k < 3; k++) rock(sx * (HX - 0.4 + k * 2 + r()), -0.2 + (k === 0 ? 0.45 : 0) + r() * 0.3, z + r(), 0.9 + r() * 0.8);
    }
  }

  // ---- dead ends: chevron boards and bollards
  function chevrons(x, z, yaw, w) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    S.push(box(w, 0.9, 0.08, x, 1.25, z, '#ffd447', 0, yaw));
    for (let k = -w / 2 + 0.45; k < w / 2 - 0.2; k += 0.7) {
      for (const d of [-1, 1]) S.push(box(0.12, 0.5, 0.1, x + c * k + s * 0.02, 1.25 + d * 0.13, z - s * k + c * 0.02, INK, 0, yaw, d * 0.6));
    }
    S.push(box(0.1, 0.8, 0.1, x - c * (w / 2 - 0.3), 0.4, z + s * (w / 2 - 0.3), '#3b3350', 0, yaw), box(0.1, 0.8, 0.1, x + c * (w / 2 - 0.3), 0.4, z - s * (w / 2 - 0.3), '#3b3350', 0, yaw));
  }
  const bollards = (x0, z0, x1, z1, n) => {
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      S.push(cyl(0.16, 0.18, 0.9, 7, x, 0.45, z, '#fbf7f0'), cyl(0.17, 0.17, 0.14, 7, x, 0.62, z, '#ff4f6a'));
    }
  };
  for (const rd of [ROADS.back1, ROADS.back2]) for (const sx of [-1, 1]) chevrons(sx * (HX - 1.4), rd.z, sx * -PI / 2, 4.2);
  for (const s of SIDE_X) { bollards(s - 5, ROADS.sideZ0 - 0.6, s + 5, ROADS.sideZ0 - 0.6, 6); chevrons(s, -HZ + 1.6, 0, 4.2); }
  // east end of the boulevard: a turnaround at the wall, with a sign
  chevrons(HX - 1.4, BZ - 4.5, -PI / 2, 4.2); chevrons(HX - 1.4, BZ + 4.5, -PI / 2, 4.2);
  const sign = (name, x, y, z, yaw, w, color) => {
    const h = w / 4, s = Math.sin(yaw), c = Math.cos(yaw);
    signs.push({ name, color, x: x + s * 0.13, y, z: z + c * 0.13, yaw, w, h });
    S.push(box(w + 0.4, h + 0.3, 0.2, x, y, z, INK, 0, yaw));
    for (const o of [-w * 0.38, w * 0.38]) S.push(box(0.2, y, 0.2, x + c * o - s * 0.15, y / 2, z - s * o - c * 0.15, '#3b3350'));
    glows.push([x + s * 0.8, y, z + c * 0.8, color, w * 1.1, 0.1]);
  };
  sign(EDGE_SIGNS[1], HX - 0.9, 3.4, BZ, -PI / 2, 9, '#18f0ff');

  // ---- the causeway stub to the west, closed for storm repairs
  const len = -HX - C.x0, cx = (-HX + C.x0) / 2, wz = C.z1 - C.z0;
  S.push(box(len, 1.3, wz, cx, -0.65, BZ, ASPH));
  S.push(box(len, 0.02, 0.25, cx, 0.012, BZ - 0.32, '#ffd35c'), box(len, 0.02, 0.25, cx, 0.012, BZ + 0.32, '#ffd35c'));
  S.push(box(len, 0.02, 0.3, cx, 0.012, BZ - 8.75, '#ff8fc4'), box(len, 0.02, 0.3, cx, 0.012, BZ + 8.75, '#ff8fc4'));
  for (let x = -HX - 2; x > C.x0 + 1; x -= 7) for (const o of [-4.4, 4.4]) S.push(box(3, 0.02, 0.22, x - 1.5, 0.012, BZ + o, '#f4eef7'));
  for (const z of [C.z0 + 0.25, C.z1 - 0.25]) {
    S.push(box(len, 0.9, 0.5, cx, 0.45, z, WALL_C), box(len, 0.08, 0.6, cx, 0.92, z, COPING), box(len, 0.07, 0.08, cx, 1.5, z, RAIL));
    for (let x = -HX - 1; x > C.x0; x -= 2.5) S.push(box(0.09, 0.6, 0.09, x, 1.2, z, RAIL));
    for (let x = -HX - 14; x > C.x0 + 2; x -= 24) {
      S.push(cyl(0.08, 0.12, 6, 6, x, 3.4, z, '#3b3350'), box(0.1, 0.1, 1.4, x, 6.3, z + (z < BZ ? 0.6 : -0.6), '#3b3350'));
      glows.push([x, 6.1, z + (z < BZ ? 1.2 : -1.2), '#ffcf8a', 6.5, 0]);
    }
  }
  for (const x of [-HX - 10, -HX - 26, C.x0 + 9]) S.push(box(3, 9, wz - 4, x, -5.6, BZ, '#cbbfb0'));
  // the broken end: a ragged lip and rebar sticking out over the gap
  for (let z = C.z0 + 1; z < C.z1 - 1; z += 1.4) {
    S.push(box(0.8 + r() * 1.2, 1.1, 1.3, C.x0 - 0.3, -0.6 - r() * 0.3, z, '#5a5468', 0, r() * 0.4, (r() - 0.5) * 0.4));
    S.push(box(1.8 + r() * 1.6, 0.06, 0.06, C.x0 - 1.2, -0.3 - r() * 0.5, z + 0.5, '#7a4a2e', 0, (r() - 0.5) * 0.5, -0.2 - r() * 0.4));
  }
  // the closure: a line of orange-and-white water barriers, sawhorses, cones and amber lamps
  const bx = C.bar;
  for (let z = C.z0 + 0.9; z < C.z1 - 0.8; z += 2.1) {
    S.push(box(0.8, 0.95, 1.95, bx, 0.48, z + 0.95, '#ff6a3d'), box(0.82, 0.22, 1.97, bx, 0.62, z + 0.95, '#fbf7f0'));
    N.push(box(0.2, 0.2, 0.2, bx, 1.08, z + 0.95, '#ffb000'));
    blink.push([bx, 1.12, z + 0.95]);
  }
  for (const z of [BZ - 5.5, BZ, BZ + 5.5]) {
    const x = bx + 3.2;
    S.push(box(0.1, 1.1, 0.1, x, 0.55, z - 1.4, '#fbf7f0', 0, 0, 0.25), box(0.1, 1.1, 0.1, x, 0.55, z + 1.4, '#fbf7f0', 0, 0, 0.25));
    S.push(box(0.1, 1.1, 0.1, x - 0.4, 0.55, z - 1.4, '#fbf7f0', 0, 0, -0.25), box(0.1, 1.1, 0.1, x - 0.4, 0.55, z + 1.4, '#fbf7f0', 0, 0, -0.25));
    S.push(box(0.08, 0.36, 3.4, x - 0.2, 0.95, z, '#fbf7f0'));
    for (let k = -1.4; k <= 1.4; k += 0.7) S.push(box(0.09, 0.34, 0.26, x - 0.2, 0.95, z + k, '#ff6a3d', 0.6));
    N.push(box(0.18, 0.18, 0.18, x - 0.2, 1.24, z, '#ffb000'));
    blink.push([x - 0.2, 1.28, z]);
  }
  for (let i = 0; i < 9; i++) {
    const x = bx + 5 + i * 2.2, z = C.z0 + 3 + ((i * 7) % 12) + r();
    S.push(tint(new THREE.ConeGeometry(0.26, 0.75, 8).translate(x, 0.375, z), '#ff6a3d'), cyl(0.2, 0.22, 0.1, 8, x, 0.32, z, '#fbf7f0'), box(0.5, 0.04, 0.5, x, 0.02, z, '#ff6a3d'));
  }
  sign(EDGE_SIGNS[0], bx - 0.6, 3.6, BZ, PI / 2, 12, '#ffb000');
  // a repair barge with a crane, moored in the gap
  const gx = C.x0 - 22;
  S.push(box(16, 2, 9, gx, -0.3, BZ, '#5a6a7a'), box(16.2, 0.3, 9.2, gx, 0.75, BZ, '#ffd447'), box(4, 2.6, 4, gx + 4, 2, BZ + 1.5, '#fbf7f0'));
  S.push(box(1.2, 9, 1.2, gx - 3, 5, BZ - 1.5, '#ffb000'), box(1, 0.8, 16, gx - 3, 9, BZ + 4, '#ffb000', -0.42));
  S.push(box(0.06, 6, 0.06, gx - 3, 9.3, BZ + 11.2, '#22203a'), box(0.8, 0.8, 0.8, gx - 3, 6.2, BZ + 11.2, '#3b3350'));
  blink.push([gx - 3, 9.9, BZ - 1.5]);
  return blink;
}
