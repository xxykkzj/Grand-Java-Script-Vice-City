// Pure data: where everything on the island goes. No rendering in here, so the
// ground painter, the city builder, collision and the minimap all read one source.
import { rng, clamp } from '../core/util.js';

export const HX = 300, HZ = 150;                          // island half extents
export const PIER = { x0: 34, x1: 46, z0: 150, z1: 250 };
export const SIDE_X = [-200, -100, 0, 100, 200];           // side streets (run along z)
export const ROADS = {
  blvd: { z: 53, w: 18 },                                  // Lumina Boulevard
  back1: { z: -4, w: 12 },
  back2: { z: -68, w: 12 },
  sideW: 12, sideZ0: -140, sideZ1: 44,
};

const PASTEL = ['#f7b3c6', '#a5e6cf', '#fff0b3', '#b3d9f7', '#ffc7a0', '#d8c0f2', '#f6f1e7', '#8fe3d9'];
const ACCENT = ['#ff4fa3', '#19c9bd', '#ffc93f', '#7a5cff', '#ff8a3d', '#ffffff'];
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
export const SIGN_NAMES = [
  'Coral Palms Hotel', 'Sunset Strip Diner', 'The Velvet Flamingo', 'Blue Manatee Hotel',
  'Club Prism', 'Aqua Deco Suites', 'Pelican Pantry 24', 'Seahorse Cinema',
  'Tidewater Records', 'Coast Patrol Station', 'Cabana Royale', 'Pink Heron Hotel',
  'Zigzag Threads', 'Seabreeze Clinic', 'Hotel Lumina', 'Driftwood Pier',
];
// Rooftop and beach billboards share the sign atlas (slots 16 to 23). All brands are made up.
export const ADS = [
  'Flamingo Fizz: The Pink Drink', 'Wave 86 FM', 'Sunny Side Suntan Oil', 'Comet 500: Ride the Tail',
  'Dance-Off Saturday!', 'Pelican Pop', 'Turbo Crunch Bars', 'Eight Wheels Skate Hire',
];
// The places you can walk into. Ring colour, building name, sign colour.
export const PLACE_DEFS = {
  bar: { name: 'The Velvet Flamingo', title: 'THE VELVET FLAMINGO', color: '#ff3fb4' },
  club: { name: 'Club Prism', title: 'CLUB PRISM', color: '#a98bff' },
  wear: { name: 'Zigzag Threads', title: 'ZIGZAG THREADS', color: '#ff9a3d' },
  mart: { name: 'Pelican Pantry 24', title: 'PELICAN PANTRY 24', color: '#5dff9a' },
};

export function makeLayout() {
  const r = rng(1986);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const buildings = [], lamps = [], palms = [], parking = [], umbrellas = [], huts = [];

  const blocks = [[-288, -210], [-190, -110], [-90, -10], [10, 90], [110, 190], [210, 288]];
  const rows = [
    { z0: 7, z1: 36, fMin: 5, fMax: 10, wMin: 22, wMax: 34, hotel: true },
    { z0: -56, z1: -14, fMin: 3, fMax: 8, wMin: 18, wMax: 30 },
    { z0: -128, z1: -79, fMin: 2, fMax: 5, wMin: 16, wMax: 28 },
  ];
  rows.forEach((row, ri) => {
    for (const [a, b] of blocks) {
      let x = a;
      while (b - x >= 14) {
        let w = row.wMin + r() * (row.wMax - row.wMin);
        if (b - x - w - 4 < 14) w = b - x;
        if (w > 42) w = (b - x - 4) / 2;
        const d = (row.z1 - row.z0) * (0.7 + r() * 0.3);
        const floors = row.fMin + Math.floor(r() * (row.fMax - row.fMin + 1));
        const cx = x + w / 2, cz = row.z1 - d / 2;
        const color = pick(PASTEL);
        let accent = pick(ACCENT);
        if (accent === '#ffffff' && color === '#f6f1e7') accent = '#19c9bd';
        buildings.push({
          cx, cz, w, d, floors, h: floors * 3.2, r: clamp(Math.min(w, d) * 0.16, 1.5, 4),
          color, accent, neon: pick(NEON), hotel: !!row.hotel, row: ri, ribbon: r() < 0.4,
          litBias: 0.6 + r() * 0.8, name: null,
          x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2,
        });
        x += w + 4;
      }
    }
  });
  // Give the hotels nearest the spawn point the headline names.
  const front = buildings.filter((b) => b.row === 0).sort((p, q) => Math.abs(p.cx) - Math.abs(q.cx));
  const rest = buildings.filter((b) => b.row === 1).sort((p, q) => Math.abs(p.cx) - Math.abs(q.cx));
  [...front, ...rest].slice(0, SIGN_NAMES.length - 1).forEach((b, i) => { b.name = SIGN_NAMES[i]; });

  const nearSide = (x, m) => SIDE_X.some((s) => Math.abs(x - s) < m);
  // Street lamps: { x, z, yaw } where yaw points the arm at the road.
  for (let x = -285; x <= 285; x += 30) if (!nearSide(x, 10)) lamps.push({ x, z: 42.6, yaw: 0 });
  for (let x = -270; x <= 285; x += 30) lamps.push({ x, z: 63.4, yaw: Math.PI });
  for (let x = -280; x <= 285; x += 40) if (!nearSide(x, 10)) lamps.push({ x, z: 3.4, yaw: Math.PI });
  for (let x = -260; x <= 285; x += 50) if (!nearSide(x, 10)) lamps.push({ x, z: -60.6, yaw: Math.PI });
  for (let z = 165; z <= 240; z += 25) lamps.push({ x: PIER.x0 + 0.6, z, yaw: Math.PI / 2 });

  // Palms: { x, z, s (scale), yaw }
  const palm = (x, z) => palms.push({ x, z, s: 0.85 + r() * 0.45, yaw: r() * 6.283 });
  for (let x = -292; x <= 292; x += 12) palm(x + (r() - 0.5) * 2, 70 + (r() - 0.5) * 3);
  for (let x = -270; x <= 285; x += 30) if (!nearSide(x, 10)) palm(x, 40.2);
  for (let i = 0; i < 34; i++) palm(-290 + r() * 580, 84 + r() * 40);
  for (let x = -290; x <= 290; x += 18) palm(x + (r() - 0.5) * 6, -143 + r() * 5);
  for (const s of SIDE_X) for (let z = -125; z <= 30; z += 31) { palm(s - 7.6, z); palm(s + 7.6, z + 15); }

  // Parked cars: { x, z, yaw }
  const spots = [];
  // right-hand traffic: every parked car faces the way its side of the road flows
  for (let x = -270; x <= 270; x += 9) if (!nearSide(x, 14)) spots.push({ x, z: 46.8, yaw: -Math.PI / 2 });
  for (let x = -265; x <= 270; x += 13) if (!nearSide(x, 14)) spots.push({ x, z: 59.2, yaw: Math.PI / 2 });
  for (let x = -270; x <= 270; x += 17) if (!nearSide(x, 16)) spots.push({ x, z: 0.8, yaw: Math.PI / 2 });
  for (const s of SIDE_X) spots.push({ x: s - 4.8, z: 22, yaw: 0 }, { x: s + 4.8, z: -38, yaw: Math.PI });
  parking.push({ x: 6, z: 59.2, yaw: Math.PI / 2 });         // one right next to the spawn
  const taken = new Set();
  let guard = 0;
  while (parking.length < 18 && guard++ < 400) {
    const i = Math.floor(r() * spots.length);
    if (taken.has(i) || Math.abs(spots[i].x - 6) < 8 && spots[i].z > 55) continue;
    taken.add(i);
    parking.push(spots[i]);
  }

  // Beach furniture
  const UMB = ['#ff5fa8', '#27d8cf', '#ffd447', '#ffffff', '#ff8a4c', '#9b7bff'];
  for (let i = 0; i < 34; i++) umbrellas.push({ x: -285 + r() * 570, z: 90 + r() * 38, color: pick(UMB), yaw: r() * 6.283 });
  huts.push({ x: -120, z: 100, color: '#ffd447', accent: '#ff4fa3' }, { x: 150, z: 104, color: '#8fe3d9', accent: '#ff8a3d' });

  // Collision boxes (xz) with a height so the helicopter can fly over them.
  const solids = buildings.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: b.h + 1 }));
  for (const h of huts) solids.push({ x0: h.x - 2, x1: h.x + 2, z0: h.z - 2, z1: h.z + 2, h: 6 });
  solids.push({ x0: 37, x1: 43, z0: 239, z1: 245, h: 5 });   // kiosk at the end of the pier

  // Story places hang off named buildings: the bar door, the patrol station and the clinic.
  const door = (name, out) => { const b = buildings.find((k) => k.name === name); return { x: b.cx, z: b.z1 + out, b }; };
  const places = {};
  for (const key in PLACE_DEFS) {
    const d = PLACE_DEFS[key], p = places[key] = { key, ...d, ...door(d.name, 5.2) };
    p.b.place = key; p.b.neon = key === 'bar' ? '#ff2bd1' : d.color;
  }
  const bar = places.bar;
  bar.b.bar = true;
  const station = door('Coast Patrol Station', 5.4), clinic = door('Seabreeze Clinic', 5.4);

  // Comet bikes parked on the sidewalk: Gus's outside the Pantry, one by the club, one near the spawn, one at the pier
  const bikes = [
    { x: places.mart.x + 4.6, z: 43.2, yaw: -Math.PI / 2, home: 'mart' },
    { x: places.club.x - 4.6, z: 43.2, yaw: -Math.PI / 2 },
    { x: -16, z: 64.6, yaw: Math.PI / 2 },
    { x: 31, z: 146, yaw: 0 },
  ];
  // phone booths stand on the Deco Row sidewalk and are solid
  const booths = [];
  for (const s of SIDE_X) booths.push({ x: s + 13.5, z: 38.2 });
  booths.push({ x: -60, z: 76.4 }, { x: 80, z: 76.4 });
  for (const b of booths) solids.push({ x0: b.x - 0.6, x1: b.x + 0.6, z0: b.z - 0.6, z1: b.z + 0.6, h: 2.8 });

  // the edge: sawhorses in front of the causeway closure, bollards where the side streets stop
  for (const z of [ROADS.blvd.z - 5.5, ROADS.blvd.z, ROADS.blvd.z + 5.5]) solids.push({ x0: CAUSEWAY.bar + 2.8, x1: CAUSEWAY.bar + 3.4, z0: z - 1.6, z1: z + 1.6, h: 1.3 });
  for (const s of SIDE_X) solids.push({ x0: s - 5.3, x1: s + 5.3, z0: ROADS.sideZ0 - 0.8, z1: ROADS.sideZ0 - 0.4, h: 1 });

  return { buildings, lamps, palms, parking, umbrellas, huts, solids, bar, station, clinic, places, bikes, booths };
}

// The edge of the island is a seawall (x = ±HX, z = -HZ) and the waterline on the beach (z = +HZ).
// The boulevard runs on past the west wall onto a causeway stub that ends at the storm closure.
export const WALL = 0.8;                                     // inner face of the seawall, from the island edge
export const CAUSEWAY = { x0: -352, bar: -338, z0: 44, z1: 62 };   // deck end, barrier line, deck sides
// Helicopters (anything at sea) may roam out to this radius; beyond it they are steered back.
export const SEA_R = 700;
export const EDGE_SIGNS = ['Causeway Closed – Storm Repairs', 'Lumina Point · Road Ends'];
export const onIsland = (x, z) => Math.abs(x) <= HX && Math.abs(z) <= HZ;

// Keep something inside the walkable world (the island inside its seawall, the pier and the causeway stub).
export function clampToWorld(o, m) {
  let hit = false;
  const x = m > 1 ? 1.4 : 0, e = WALL + m + x, C = CAUSEWAY;   // vehicles keep their noses off the wall
  if (o.x > HX - e) { o.x = HX - e; hit = true; }
  if (o.x < -HX + e) {
    const onDeck = o.z > C.z0 + m - 0.4 && o.z < C.z1 - m + 0.4;
    if (!onDeck) {
      // already out on the causeway heading sideways: the parapets stop you; otherwise the seawall does
      if (o.x < -HX - 0.5) o.z = clamp(o.z, C.z0 + m - 0.4, C.z1 - m + 0.4);
      else o.x = -HX + e;
      hit = true;
    }
    if (o.x < C.bar + 0.5 + m + x) { o.x = C.bar + 0.5 + m + x; hit = true; }
  }
  if (o.z < -HZ + e) { o.z = -HZ + e; hit = true; }
  if (o.z > HZ - m) {
    const onPier = o.x > PIER.x0 + m - 0.4 && o.x < PIER.x1 - m + 0.4;
    if (!onPier) {
      // Either on the sand heading out to sea, or already out on the pier heading sideways.
      if (o.z > HZ + 0.5) o.x = clamp(o.x, PIER.x0 + m - 0.4, PIER.x1 - m + 0.4);
      else o.z = HZ - m;
      hit = true;
    }
    if (o.z > PIER.z1 - m) { o.z = PIER.z1 - m; hit = true; }
  }
  return hit;
}

export function zoneName(x, z) {
  if (x < -HX && z > CAUSEWAY.z0 - 2 && z < CAUSEWAY.z1 + 2 && x > CAUSEWAY.x0 - 4) return 'STORM CAUSEWAY';
  if (z > HZ && x > PIER.x0 - 3 && x < PIER.x1 + 3 && z < PIER.z1 + 3) return 'DRIFTWOOD PIER';
  if (!onIsland(x, z)) return 'OPEN WATER';
  if (z > 78) return 'CORAL BEACH';
  if (z > 62) return 'THE PROMENADE';
  if (z > 44) return 'LUMINA BOULEVARD';
  if (z > 4) return 'DECO ROW';
  if (z > -62) return 'MIDTOWN';
  return 'BACK BAY';
}
