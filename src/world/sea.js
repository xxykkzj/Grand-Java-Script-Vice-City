// The sea as data: the water level, the seabed height, where swimmers may go and the pier ladders.
// Pure functions (no rendering) so swimming, sinking, marine life and the underwater scene share one truth.
//
//   surface   WL = -0.6   (the ocean plane)
//   the beach slopes from the waterline: depth grows ~0.085 m per metre, so you wade, then swim past 1.14 m
//   reef flat out to ~125 m from the island, then the bed drops away into the dark
//   swimmers are nudged back by a "strong current" past SAFE_D metres from the island
import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { HX, HZ, PIER, CAUSEWAY } from './layout.js';

export const WL = -0.6;
export const FLOAT_Y = WL - 1.14;        // feet-level of a swimmer treading at the surface (hips ~0.18 under)
export const WADE_MAX = 1.14;            // deeper than this and you swim
export const SAFE_D = 150;               // the current starts here (metres from the island's edge)
export const LIMIT_D = 205;              // nobody gets past this
export const DEEP_SHARK = 2.0;           // sharks never come into water shallower than this

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// distance from the island's rectangle (0 inside it)
export function islandDist(x, z) {
  const qx = Math.abs(x) - HX, qz = Math.abs(z) - HZ;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
function profile(d, beach) {
  if (beach) {
    if (d < 5) return -0.12 * d;
    if (d < 28) return -0.6 - (d - 5) * 0.085;
    if (d < 45) return -2.555 - (d - 28) * 0.038;
  } else if (d < 45) return -2.0 - d * 0.0267;
  if (d < 100) return -3.2 - (d - 45) * 0.012;
  if (d < 125) return -3.86 - (d - 100) * 0.02;
  const e = d - 125;
  return Math.max(-4.36 - e * e * 0.05 - e * 0.4, -80);        // the drop beyond the reef
}
// reef mounds: [x, z, radius, height]
export const MOUNDS = [
  [-150, 232, 26, 1.7], [-62, 268, 22, 1.5], [92, 246, 24, 1.6], [184, 214, 18, 1.3], [64, 207, 11, 1.2], [15, 232, 11, 1.1],
  [-212, 190, 16, 1.1], [252, 262, 22, 1.5], [-22, 214, 14, 1.0], [130, 196, 12, 0.9],
];
export function bedAt(x, z) {
  const d = Math.max(0, islandDist(x, z));
  const w = sstep(HZ - 40, HZ, z) * (1 - sstep(HX + 2, HX + 12, Math.abs(x)));
  let b = profile(d, true) * w + profile(d, false) * (1 - w);
  for (let i = 0; i < MOUNDS.length; i++) {
    const m = MOUNDS[i], dx = x - m[0], dz = z - m[1], q = (dx * dx + dz * dz) / (m[2] * m[2]);
    if (q < 6) b += m[3] * Math.exp(-q * 1.1);
  }
  return b;
}
export const onDeck = (x, z) => x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1;
// water depth at a point (0 on land: the island, the pier deck, the causeway deck)
export function depthAt(x, z) {
  if (Math.abs(x) <= HX && Math.abs(z) <= HZ) return 0;
  const C = CAUSEWAY;
  if (x < -HX && x > C.x0 - 2 && z > C.z0 - 1 && z < C.z1 + 1) return 0;
  return Math.max(0, WL - bedAt(x, z));
}
// the water's surface height with a hint of the swell (used by splashes, floating things)
export const surfaceAt = () => WL;

// ---- the pier ladders: on the outside of the pier, reaching from the water to the deck
export const LADDERS = [
  { x: PIER.x0, z: 175, s: -1 }, { x: PIER.x1, z: 200, s: 1 }, { x: PIER.x0, z: 227, s: -1 },
];
export const LADDER_GAP = 1.0;           // the rail opens this far each side of a ladder
export function nearLadder(x, z, reach = 2.2) {
  for (const l of LADDERS) if (Math.abs(z - l.z) < reach && Math.abs(x - (l.x + l.s * 0.95)) < reach) return l;
  return null;
}

// push a swimmer (or anything in the water) out of what is solid out there: the seawall, the pier
// footprint (below the deck), the causeway. Returns true when it moved.
const WALLR = { x0: -HX - 0.8, x1: HX + 0.8, z0: -HZ - 0.8, z1: HZ };
export function pushFromSolids(p, r, feetY = -2) {
  let hit = false;
  const out = (x0, x1, z0, z1) => {
    if (p.x <= x0 - r || p.x >= x1 + r || p.z <= z0 - r || p.z >= z1 + r) return;
    const l = p.x - (x0 - r), rt = x1 + r - p.x, n = p.z - (z0 - r), f = z1 + r - p.z, m = Math.min(l, rt, n, f);
    if (m === l) p.x = x0 - r; else if (m === rt) p.x = x1 + r; else if (m === n) p.z = z0 - r; else p.z = z1 + r;
    hit = true;
  };
  out(WALLR.x0, WALLR.x1, WALLR.z0, WALLR.z1);
  if (feetY < -0.25) out(PIER.x0 - 0.15, PIER.x1 + 0.15, PIER.z0 - 1, PIER.z1 + 0.2);
  const C = CAUSEWAY;
  out(C.x0 - 1, -HX, C.z0 - 0.5, C.z1 + 0.5);
  return hit;
}

// ---- the sand shelf where the beach runs into the sea: dry-ish sand that sinks below the surface.
// Returned as a vertex-coloured, non-indexed geometry (position, normal, color) to be merged into the city
// mesh, so it costs no extra draw call. It sits 2 cm under the real bed so the seabed shader wins underwater.
export function shelfGeometry() {
  const xs = [], zs = [HZ, HZ + 2.5, HZ + 5, HZ + 7.5, HZ + 10, HZ + 14];
  for (let x = -HX - 12; x <= HX + 12.01; x += 10) xs.push(x);
  const nx = xs.length, nz = zs.length, pos = [], col = [], idx = [];
  const dry = new THREE.Color('#ead7ab'), wet = new THREE.Color('#bda57c'), c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const y = bedAt(xs[i], zs[j]) - 0.02;
    pos.push(xs[i], j === 0 ? Math.min(y, -0.0) : y, zs[j]);
    c.copy(dry).lerp(wet, clamp(-y / 0.7, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  return g;
}
