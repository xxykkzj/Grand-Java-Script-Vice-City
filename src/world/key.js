// Solano Key: the district across the Halcyon Causeway, as pure data (like layout.js for the old town).
// Downtown glass towers with rooftop helipads (Glasswater), the Sunbowl stadium and its car park,
// the Mango Grove suburban street, Fernwood Park, Starboard Marina and the Tradewind Docks, plus the
// art-deco hotels, a motel, a pastel mall and apartment blocks along Halcyon Avenue.
// World units are metres; the key sits west of the old town: x from -1080 to -480.
import { rng, clamp } from '../core/util.js';

export const KEY = { x0: -1080, x1: -480, z0: -150, z1: 150 };
export const KEY_CX = (KEY.x0 + KEY.x1) / 2;
// the marina pier runs out to sea from the south shore (a stunt ramp at its end)
export const MPIER = { x0: -796, x1: -784, z0: KEY.z1, z1: 236 };
// roads: two avenues along x and four streets along z (w = carriageway width)
export const KH = [
  { name: 'Halcyon Avenue', z: 53, w: 18, hw: 9, off: 2.3, hz: 13.8, x0: -1066, x1: KEY.x1 },
  { name: 'Stadium Way', z: -46, w: 12, hw: 6, off: 2, hz: 10.2, x0: -1066, x1: -494 },
];
export const KV = [
  { name: 'Glasswater Street', x: -560, z0: -136, z1: 53 },
  { name: 'Marina Street', x: -700, z0: -136, z1: 128 },
  { name: 'Dockside Road', x: -880, z0: -46, z1: 128 },
  { name: 'Mango Grove', x: -1000, z0: -136, z1: 53 },
];
export const KV_W = 12;
export const KEY_JUNCTIONS = [];
for (const v of KV) for (const h of KH) if (h.z >= v.z0 && h.z <= v.z1) KEY_JUNCTIONS.push({ x: v.x, z: h.z, h, v });

const PASTEL = ['#f7b3c6', '#a5e6cf', '#fff0b3', '#b3d9f7', '#ffc7a0', '#d8c0f2', '#f6f1e7', '#8fe3d9'];
const ACCENT = ['#ff4fa3', '#19c9bd', '#ffc93f', '#7a5cff', '#ff8a3d', '#27d8cf'];
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
const GLASS = ['#3d7f9e', '#4a6fa8', '#2f8f8a', '#6a5aa8', '#3a8fb0'];
// venue names in the key (all invented)
export const KEY_SIGNS = [
  'Hotel Mirabel', 'The Azure Palms', 'Moonlite Motor Inn', 'Seafoam Galleria', 'Starboard Marina', 'Tradewind Docks',
  'Sunbowl Stadium', 'Fernwood Park', 'Glasswater Tower', 'Halcyon Trust', 'Pelican Point Lofts', 'Mango Grove',
];
// 80s billboards and wall ads (all brands made up)
export const KEY_ADS = [
  'Hyperwave Cassettes', 'Glo-Cola: Taste the Glow', 'Laser Lanes Bowling', 'Radvision VHS', 'Sunset Sneakers',
  'Mega Byte Arcade', 'Tropic Tan Lotion', 'Starlite Drive-In', 'Synthwave 99.1', 'Turbo Jet Ski Rental',
  'Cosmic Cola Zero', 'Neon Nights Cruises',
];
// the scoreboard: invented teams
export const TEAMS = { home: 'STINGRAYS', away: 'PILOTS' };

export function makeKey(props, solids, surf) {
  const r = rng(4242);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const buildings = [], lamps = [], palms = [], trees = [], houses = [], fences = [], parking = [], signs = [], ramps = [];
  const B = (o) => {
    const b = {
      color: pick(PASTEL), accent: pick(ACCENT), neon: pick(NEON), floors: 3, style: 'deco', name: null, seed: r(), helipad: false,
      ...o,
    };
    b.h = b.h || b.floors * 3.4;
    b.x0 = b.cx - b.w / 2; b.x1 = b.cx + b.w / 2; b.z0 = b.cz - b.d / 2; b.z1 = b.cz + b.d / 2;
    buildings.push(b);
    return b;
  };

  // ---------------------------------------------------------------- Glasswater downtown (north-east)
  // two columns of towers between the seawall and Marina Street, north and south of Stadium Way
  const towers = [
    // [cx, cz, w, d, h, style]
    [-519, -118, 50, 38, 92, 'tower'], [-519, -74, 44, 26, 54, 'office'],
    [-650, -118, 64, 36, 112, 'tower'], [-600, -116, 32, 40, 64, 'office'], [-630, -72, 92, 22, 34, 'apart'],
    [-519, -12, 50, 38, 78, 'tower'], [-519, 26, 50, 22, 26, 'apart'],
    [-604, -10, 50, 40, 58, 'office'], [-664, -10, 36, 40, 96, 'tower'], [-630, 27, 100, 18, 22, 'apart'],
  ];
  towers.forEach(([cx, cz, w, d, h, style], i) => {
    const b = B({ cx, cz, w, d, h, style, floors: Math.round(h / 3.4), color: style === 'tower' ? GLASS[i % GLASS.length] : style === 'apart' ? PASTEL[(i * 3) % PASTEL.length] : ['#d9d4e6', '#e8ddd0', '#cfe0e6'][i % 3], district: 'downtown' });
    if (style === 'tower') b.helipad = true;
  });
  buildings.find((b) => b.cx === -650 && b.cz === -118).name = 'Glasswater Tower';
  buildings.find((b) => b.cx === -519 && b.cz === -12).name = 'Halcyon Trust';
  buildings.find((b) => b.cx === -630 && b.cz === 27).name = 'Pelican Point Lofts';

  // ---------------------------------------------------------------- south of Halcyon Avenue
  // art-deco hotels by the causeway, the pastel mall, a motel, marina apartments, dock warehouses
  B({ cx: -519, cz: 92, w: 52, d: 34, floors: 7, style: 'deco', name: 'Hotel Mirabel', hotel: true, district: 'deco' });
  B({ cx: -519, cz: 129, w: 46, d: 22, floors: 5, style: 'deco', name: 'The Azure Palms', hotel: true, district: 'deco' });
  B({ cx: -630, cz: 100, w: 104, d: 58, h: 11, floors: 3, style: 'mall', name: 'Seafoam Galleria', color: '#f9c6dc', accent: '#27d8cf', district: 'mall' });
  B({ cx: -744, cz: 88, w: 50, d: 24, floors: 5, style: 'apart', color: '#fff0b3', district: 'marina' });
  B({ cx: -838, cz: 88, w: 50, d: 24, floors: 4, style: 'apart', color: '#a5e6cf', district: 'marina' });
  B({ cx: -830, cz: 128, w: 24, d: 14, floors: 2, style: 'deco', name: 'Starboard Marina', color: '#f6f1e7', accent: '#19c9bd', district: 'marina' });
  // docks: a warehouse on the north side of the yard (the east side is the unfinished overpass)
  B({ cx: -1040, cz: 82, w: 54, d: 24, h: 10, floors: 2, style: 'warehouse', name: 'Tradewind Docks', color: '#c9b9a6', accent: '#27d8cf', district: 'docks' });
  B({ cx: -975, cz: 80, w: 40, d: 20, h: 9, floors: 2, style: 'warehouse', color: '#b9c2cc', accent: '#ff8a3d', district: 'docks' });
  // the motel by the stadium (north-west)
  B({ cx: -1042, cz: -118, w: 52, d: 30, floors: 2, style: 'motel', name: 'Moonlite Motor Inn', color: '#ffc7a0', accent: '#19c9bd', district: 'stadium' });
  B({ cx: -1042, cz: -74, w: 52, d: 20, floors: 2, style: 'motel', color: '#d8c0f2', accent: '#ff4fa3', district: 'stadium' });

  // ---------------------------------------------------------------- the Sunbowl (north middle)
  const stadium = { cx: -790, cz: -100, pw: 62, pd: 38, w: 108, d: 78 };
  stadium.x0 = stadium.cx - stadium.w / 2; stadium.x1 = stadium.cx + stadium.w / 2; stadium.z0 = stadium.cz - stadium.d / 2; stadium.z1 = stadium.cz + stadium.d / 2;
  // the stands are four solid blocks (a gap at each corner is the way in)
  const sw = 13;
  for (const [x0, x1, z0, z1] of [
    [stadium.x0, stadium.x1, stadium.z0, stadium.z0 + sw], [stadium.x0, stadium.x1, stadium.z1 - sw, stadium.z1],
    [stadium.x0, stadium.x0 + sw, stadium.z0 + sw + 6, stadium.z1 - sw - 6], [stadium.x1 - sw, stadium.x1, stadium.z0 + sw + 6, stadium.z1 - sw - 6],
  ]) solids.push({ x0, x1, z0, z1, h: 14, stand: true });
  // the car park west of it
  const carpark = { x0: -985, x1: -852, z0: -140, z1: -60 };
  for (let x = carpark.x0 + 8; x < carpark.x1 - 6; x += 13) for (const z of [carpark.z0 + 8, carpark.z1 - 8]) if (r() < 0.55) parking.push({ x, z, yaw: z < -100 ? 0 : Math.PI, lot: true, model: r() < 0.45 ? pick(['van', 'truck', 'delivery', 'taxi']) : undefined });

  // ---------------------------------------------------------------- Fernwood Park (middle)
  const park = { x0: -868, x1: -712, z0: -34, z1: 38, hill: { x: -790, z: 2, r: 16, h: 3.4 }, pond: { x: -742, z: 0, rx: 16, rz: 11 } };
  for (let i = 0; i < 26; i++) {
    const x = park.x0 + 4 + r() * (park.x1 - park.x0 - 8), z = park.z0 + 4 + r() * (park.z1 - park.z0 - 8);
    if (Math.hypot(x - park.pond.x, (z - park.pond.z) * 1.4) < 20 || Math.hypot(x - park.hill.x, z - park.hill.z) < 22 || Math.abs(z - 2) < 3.5 || Math.abs(x - -790) < 3) continue;
    (r() < 0.5 ? palms : trees).push({ x, z, s: 0.9 + r() * 0.5, yaw: r() * 6.28, big: r() < 0.6 });
  }

  // ---------------------------------------------------------------- Mango Grove (suburban, middle west)
  // houses face Mango Grove (x = -1000) from both sides, with front fences and a tree each
  const HOUSE = ['house1', 'house3', 'house5', 'house7', 'house9', 'house12', 'house15', 'house18'];
  let hi = 0;
  for (const side of [-1, 1]) for (let z = -26; z <= 30; z += 14) {
    const x = -1000 + side * 22, yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    houses.push({ id: HOUSE[hi % HOUSE.length], x, z, yaw, color: PASTEL[(hi * 5 + 1) % PASTEL.length], roof: ACCENT[(hi * 3) % ACCENT.length] });
    solids.push({ x0: x - 5.5, x1: x + 5.5, z0: z - 5, z1: z + 5, h: 6.5, house: true });
    fences.push({ x: -1000 + side * 13.4, z, yaw: Math.PI / 2, gate: true });
    trees.push({ x: -1000 + side * 15.5, z: z + 5.4, s: 1, yaw: r() * 6.28, big: hi % 2 === 0 });
    hi++;
  }
  // and along the north side of Halcyon Avenue between the grove and Dockside Road
  for (let x = -980; x <= -905; x += 15) {
    houses.push({ id: HOUSE[hi % HOUSE.length], x, z: 22, yaw: 0, color: PASTEL[(hi * 5 + 1) % PASTEL.length], roof: ACCENT[(hi * 3) % ACCENT.length] });
    solids.push({ x0: x - 5, x1: x + 5, z0: 17, z1: 27.5, h: 6.5, house: true });
    fences.push({ x, z: 32.6, yaw: 0, gate: true });
    trees.push({ x: x + 6.5, z: 33.5, s: 0.9, yaw: r() * 6.28, big: hi % 3 === 0 });
    hi++;
  }

  // ---------------------------------------------------------------- the marina and the docks (south coast)
  const marina = { x0: -868, x1: -712, z0: 104, z1: 150, boats: [] };
  for (let i = 0; i < 9; i++) marina.boats.push({ x: MPIER.x0 - 7 - (i % 3) * 0.5, z: 160 + i * 8, yaw: Math.PI / 2 + (r() - 0.5) * 0.2, s: 0.8 + r() * 0.5, c: pick(ACCENT) });
  for (let i = 0; i < 9; i++) marina.boats.push({ x: MPIER.x1 + 7 + (i % 3) * 0.5, z: 164 + i * 8, yaw: -Math.PI / 2 + (r() - 0.5) * 0.2, s: 0.8 + r() * 0.5, c: pick(ACCENT) });
  const docks = { x0: -1072, x1: -892, z0: 100, z1: 150, containers: [], cranes: [{ x: -1045, z: 143 }, { x: -985, z: 143 }] };
  const CC = ['#2f6f9a', '#d9643a', '#e0b040', '#4f8f5a', '#b04a6a', '#7a7f8c', '#27a7a0'];
  // containers lie along x (12.2 m x 2.5 m) in two rows on the quay; one stands across the yard (the Container Leap)
  for (const [z, hmax] of [[126, 2], [131, 3]]) for (let x = -1062; x < -900; x += 13) {
    if (x > -942 && x < -905) continue;                          // clear of the overpass's down ramp
    const n = 1 + Math.floor(r() * hmax);
    for (let k = 0; k < n; k++) docks.containers.push({ x, z, y: k * 2.6, c: CC[Math.floor(r() * CC.length)], yaw: 0 });
    solids.push({ x0: x - 6.1, x1: x + 6.1, z0: z - 1.25, z1: z + 1.25, h: n * 2.6 - 0.05, crate: true });
    surf.rect(x - 6.1, x + 6.1, z - 1.25, z + 1.25, n * 2.6, 'crate');
  }
  docks.containers.push({ x: -985, z: 110, y: 0, c: '#d9643a', yaw: Math.PI / 2 });
  solids.push({ x0: -986.25, x1: -983.75, z0: 103.9, z1: 116.1, h: 2.55, crate: true });
  surf.rect(-986.25, -983.75, 103.9, 116.1, 2.6, 'crate');
  for (const c of docks.cranes) solids.push({ x0: c.x - 5, x1: c.x - 3.8, z0: c.z - 6, z1: c.z + 6, h: 30 }, { x0: c.x + 3.8, x1: c.x + 5, z0: c.z - 6, z1: c.z + 6, h: 30 });

  // ---------------------------------------------------------------- street lamps (Quaternius street lights) and palms
  const onKeyRoad = (x, z, m = 0) => keyRoadAt(x, z, m);
  const lamp = (x, z, yaw) => { if (!onKeyRoad(x, z, 0.5)) lamps.push({ x, z, yaw }); };
  for (const h of KH) for (let x = h.x0 + 14; x < h.x1 - 8; x += 32) {
    if (KV.some((v) => Math.abs(x - v.x) < 13 && h.z >= v.z0 && h.z <= v.z1)) continue;
    lamp(x, h.z - h.hw - 1.6, 0); lamp(x + 16, h.z + h.hw + 1.6, Math.PI);
  }
  for (const v of KV) for (let z = v.z0 + 12; z < v.z1 - 6; z += 30) {
    if (KH.some((h) => Math.abs(z - h.z) < h.hw + 8)) continue;
    lamp(v.x - KV_W / 2 - 1.6, z, Math.PI / 2); lamp(v.x + KV_W / 2 + 1.6, z + 15, -Math.PI / 2);
  }
  for (let z = MPIER.z0 + 12; z < MPIER.z1 - 8; z += 24) lamps.push({ x: MPIER.x0 + 0.7, z, yaw: Math.PI / 2, pier: true });
  // palms along Halcyon Avenue (south side, between the lamps) and the causeway landing
  for (let x = -1050; x < -500; x += 32) if (!KV.some((v) => Math.abs(x - v.x) < 13)) palms.push({ x, z: 66.2, s: 0.9 + r() * 0.4, yaw: r() * 6.28 });
  for (let x = -1050; x < -500; x += 32) if (!KV.some((v) => Math.abs(x + 16 - v.x) < 13)) palms.push({ x: x + 16, z: 39.8, s: 0.9 + r() * 0.4, yaw: r() * 6.28 });

  // ---------------------------------------------------------------- parking on Halcyon Avenue (outer lanes)
  for (let x = -1040; x < -520; x += 23) if (!KV.some((v) => Math.abs(x - v.x) < 16) && r() < 0.4) parking.push({ x, z: x % 2 ? 46.8 : 59.2, yaw: x % 2 ? -Math.PI / 2 : Math.PI / 2 });

  // ---------------------------------------------------------------- colliders and seats
  for (const b of buildings) solids.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: b.h + 0.4, b });
  // flat roofs (a 0.6 m slab on top of every building), a helipad on each glass tower, a stair door in a
  // back corner that lets you out on the side nearest a street
  for (const b of buildings) {
    b.roofY = b.h + 0.6;
    surf.rect(b.x0, b.x1, b.z0, b.z1, b.roofY, 'roof', { b });
    if (b.helipad) b.pad = { x: b.cx, z: b.cz, r: Math.min(b.w, b.d) * 0.36 };
    const sides = [[b.cx, b.z1 + 2.4, 0], [b.cx, b.z0 - 2.4, Math.PI], [b.x1 + 2.4, b.cz, Math.PI / 2], [b.x0 - 2.4, b.cz, -Math.PI / 2]];
    const roadD = (x, z) => { let m = 1e9; for (const q of KEY_ROAD_RECTS) m = Math.min(m, Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.z0 - z, 0, z - q.z1))); return m; };
    const blocked = (x, z) => solids.some((o) => o !== b && x > o.x0 - 0.6 && x < o.x1 + 0.6 && z > o.z0 - 0.6 && z < o.z1 + 0.6);
    const out = sides.filter(([x, z]) => inKey(x, z, -2) && !blocked(x, z)).sort((p, q) => roadD(p[0], p[1]) - roadD(q[0], q[1]))[0] || sides[0];
    // the hut sits in the roof corner on the far side from the street door (or by it, if the roof is small)
    const dx = Math.sign(out[0] - b.cx) || 1, dz = Math.sign(out[1] - b.cz) || 1;
    const hx = b.cx - dx * (b.w / 2 - 3.2), hz = b.cz + (out[2] === 0 || out[2] === Math.PI ? dz : -dz) * (b.d / 2 - 3.2);
    b.door = surf.door(hx, hz, b.roofY, { x: out[0], z: out[1], yaw: out[2] }, b);
    props.box(hx, hz, 2.2, 2.2, b.roofY + 2.6, 0, b.roofY - 0.2);
  }
  palms.forEach((p) => { p.col = props.circle(p.x, p.z, 0.3 * p.s, 8); });
  trees.forEach((t) => { props.circle(t.x, t.z, 0.35, 6); });
  lamps.forEach((l) => { props.circle(l.x, l.z, 0.22, 6.5); });
  // park benches along the paths (seats you can use), facing the pond and the hill
  for (const [x, z, yaw] of [[-760, 5.2, Math.PI], [-770, 5.2, Math.PI], [-820, -1.2, 0], [-810, -1.2, 0], [-735, -16, 0], [-750, 18, Math.PI]]) {
    props.box(x, z, 1.8, 0.6, 0.9, yaw); props.seat(x, z, yaw, 0.48, 'bench');
    signs.push({ bench: true, x, z, yaw });
  }

  // ---------------------------------------------------------------- stunt ramps (see game/stunts.js)
  // each: a ramp (x, z = centre, yaw = the way you drive up it, len, w, h = rise, base = height of its foot),
  // the landing zone, and the speed you need going in (m/s). Raised decks are flat surfaces.
  ramps.push(
    { id: 'sunbowl', name: 'SUNBOWL KICKER', x: -965, z: -100, yaw: Math.PI / 2, len: 9, w: 5, h: 2.4, land: { x0: -950, x1: -922, z0: -110, z1: -90 }, vmin: 16 },
    { id: 'fernwood', name: 'FERNWOOD HILL', x: -816, z: 2, yaw: Math.PI / 2, len: 20, w: 6, h: 3.4, kick: { len: 8, h: 1.6 }, land: { x0: -787, x1: -764, z0: -10, z1: 14 }, vmin: 15 },
    { id: 'container', name: 'CONTAINER LEAP', x: -975, z: 110, yaw: -Math.PI / 2, len: 9, w: 5, h: 2.4, land: { x0: -1010, x1: -991, z0: 101, z1: 119 }, vmin: 17 },
    { id: 'overpass', name: 'OVERPASS GAP', x: -925, z: 76, yaw: 0, len: 20, w: 9, h: 4.2, deck: { z0: 86, z1: 98, lip: 6, lipH: 1.2 }, deck2: { z0: 104, z1: 120 }, w2: 15, down: { z0: 120, z1: 138 }, land: { x0: -932.5, x1: -917.5, z0: 104, z1: 138 }, vmin: 19 },
    { id: 'marina', name: 'MARINA SPLASH', x: -790, z: 226, yaw: 0, len: 9, w: 5, h: 2.2, land: { x0: -812, x1: -768, z0: 238, z1: 300 }, vmin: 15, sea: true },
    { id: 'galleria', name: 'GALLERIA HOP', x: -561, z: 76, yaw: 0, len: 9, w: 5, h: 2.4, land: { x0: -572, x1: -550, z0: 90, z1: 112 }, vmin: 15 },
  );
  // the parked show cars the Sunbowl Kicker jumps over
  for (const z of [-103, -97]) parking.push({ x: -955, z, yaw: 0, show: true });
  return { buildings, lamps, palms, trees, houses, fences, parking, stadium, carpark, park, marina, docks, ramps, benches: signs };
}

// ---- roads of the key as rectangles (nothing may stand on them)
export const KEY_ROAD_RECTS = [
  ...KH.map((h) => ({ name: h.name, x0: h.x0 - 4, x1: h.x1, z0: h.z - h.w / 2, z1: h.z + h.w / 2 })),
  ...KV.map((v) => ({ name: v.name, x0: v.x - KV_W / 2, x1: v.x + KV_W / 2, z0: v.z0 - 4, z1: v.z1 + 4 })),
];
export function keyRoadAt(x, z, r = 0) {
  for (const b of KEY_ROAD_RECTS) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return b;
  return null;
}
export const inKey = (x, z, m = 0) => x >= KEY.x0 - m && x <= KEY.x1 + m && z >= KEY.z0 - m && z <= KEY.z1 + m;
export const onMarinaPier = (x, z, m = 0) => x > MPIER.x0 - m && x < MPIER.x1 + m && z > KEY.z1 - 1 && z < MPIER.z1 + m;

export function keyZone(x, z) {
  if (onMarinaPier(x, z, 3) && z > KEY.z1) return 'STARBOARD MARINA';
  if (!inKey(x, z)) return null;
  if (z > 100 && x < -890) return 'TRADEWIND DOCKS';
  if (z > 100 && x < -706) return 'STARBOARD MARINA';
  if (z > 62 && x > -560) return 'HOTEL ROW';
  if (z > 62) return 'GALLERIA';
  if (z > 44) return 'HALCYON AVENUE';
  if (x > -706) return 'GLASSWATER';
  if (z < -52 && x > -1000) return 'SUNBOWL';
  if (z < -52) return 'MOONLITE';
  if (x > -880) return 'FERNWOOD PARK';
  return 'MANGO GROVE';
}
export const clampKey = (v) => clamp(v, KEY.x0, KEY.x1);
