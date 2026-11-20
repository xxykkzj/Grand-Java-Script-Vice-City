// Pure data: where everything on the island goes. No rendering in here, so the
// ground painter, the city builder, collision and the minimap all read one source.
import { rng, clamp } from '../core/util.js';
import { createProps } from './props.js';
import { createSurfaces, registerRamps } from './surfaces.js';
import { planBeach } from './beach.js';
import { KEY, MPIER, makeKey, KEY_ROAD_RECTS, KEY_JUNCTIONS, inKey, onMarinaPier, keyZone } from './key.js';
export { KEY, MPIER };

export const HX = 300, HZ = 150;                          // island half extents
export const PIER = { x0: 34, x1: 46, z0: 150, z1: 250 };
export const SIDE_X = [-200, -100, 0, 100, 200];           // side streets (run along z)
export const ROADS = {
  blvd: { z: 53, w: 18 },                                  // Lumina Boulevard
  back1: { z: -4, w: 12 },
  back2: { z: -68, w: 12 },
  sideW: 12, sideZ0: -140, sideZ1: 44,
};

const BLOCK_PAL = [
  ['#f7b3c6', '#ffc7a0', '#ffd6e0', '#f9b8a8', '#fde2c8'], ['#a5e6cf', '#8fe3d9', '#c9f2e3', '#b8e8f0', '#e0f7ec'],
  ['#fff0b3', '#ffe5a0', '#fdf6d0', '#ffd9a8', '#f6f1e7'], ['#d8c0f2', '#e6d4fa', '#c9c3f5', '#f2d0ec', '#b3d9f7'],
  ['#b3d9f7', '#a8e0f0', '#d0e8fb', '#9fd6e8', '#f6f1e7'], ['#ffc7a0', '#ffb8a8', '#ffe0c4', '#f7b3c6', '#fff0b3'],
];
const PASTEL = ['#f7b3c6', '#a5e6cf', '#fff0b3', '#b3d9f7', '#ffc7a0', '#d8c0f2', '#f6f1e7', '#8fe3d9'];
const ACCENT = ['#ff4fa3', '#19c9bd', '#ffc93f', '#7a5cff', '#ff8a3d', '#ffffff'];
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
export const SIGN_NAMES = [
  'Coral Palms Hotel', 'Sunset Strip Diner', 'The Velvet Flamingo', 'Blue Manatee Hotel',
  'Club Prism', 'Volt & Spark Supply', 'Pelican Pantry 24', 'Seahorse Cinema',
  'Tidewater Records', 'Coast Patrol Station', 'Cabana Royale', 'Pink Heron Hotel',
  'Zigzag Threads', 'Seabreeze Clinic', 'Hotel Lumina', 'Aqua Deco Suites', 'Driftwood Pier',
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
  arms: { name: 'Volt & Spark Supply', title: 'VOLT & SPARK SUPPLY', color: '#3ad6ff' },
};
// More places to walk into (game/venues.js). They hang off existing buildings but leave the street as it
// is (no new signs or neon): only their door ring and a minimap blip. `face` is the way the door looks
// (0 = +z, the old town's boulevard side), `along` slides the door along that face, `out` is how far
// in front of the wall the ring stands.
export const VENUE_DEFS = {
  diner: { name: 'Sunset Strip Diner', title: 'SUNSET STRIP DINER', color: '#ff6a3d', at: 'Sunset Strip Diner', face: 0, along: 0, out: 5.2 },
  arcade: { name: 'Seahorse Arcade', title: 'SEAHORSE ARCADE', color: '#ffe14a', at: 'Seahorse Cinema', face: 0, along: 3, out: 5.2 },
  motel: { name: 'Moonlite Motor Inn', title: 'MOONLITE MOTOR INN · ROOM 7', color: '#ff8fc4', at: 'Moonlite Motor Inn', isle: 'key', face: Math.PI / 2, along: 0, out: 5.2 },
  mall: { name: 'Seafoam Galleria', title: 'SEAFOAM GALLERIA', color: '#27d8cf', at: 'Seafoam Galleria', isle: 'key', face: Math.PI, along: 5, out: 4.6 },
  lounge: { name: 'The Blue Pelican Lounge', title: 'THE BLUE PELICAN LOUNGE', color: '#4f8dff', at: 'Tidewater Records', face: 0, along: 2, out: 5.2 },
  bait: { name: 'Starboard Bait & Tackle', title: 'STARBOARD BAIT & TACKLE', color: '#8dff5a', at: 'Starboard Marina', isle: 'key', face: -Math.PI / 2, along: 0, out: 5.2 },
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
  // Each block has its own pastel palette (corals, mints, lemons, lilacs, skies, peaches) and neighbours never
  // share a colour, so a street reads as a row of different buildings. Separate random stream: everything
  // else keeps its place.
  { const pr = rng(2186);
    blocks.forEach(([a, b], bi) => {
      for (const ri of [0, 1, 2]) {
        const pal = BLOCK_PAL[(bi * 2 + ri * 3) % BLOCK_PAL.length];
        let prev = null;
        for (const k of buildings.filter((q) => q.row === ri && q.cx > a && q.cx < b).sort((p, q) => p.cx - q.cx)) {
          let c = pal[Math.floor(pr() * pal.length)];
          if (c === prev) c = pal[(pal.indexOf(c) + 1 + Math.floor(pr() * (pal.length - 1))) % pal.length];
          k.color = c; prev = c;
          if (k.accent === c) k.accent = ACCENT[(ACCENT.indexOf(k.accent) + 1) % ACCENT.length];
        }
      }
    }); }
  // the 4 m gaps between neighbouring buildings in a block: the alleys (world/streetscape.js dresses them)
  const alleys = [];
  for (const ri of [0, 1, 2]) {
    const row = buildings.filter((q) => q.row === ri).sort((p, q) => p.x0 - q.x0);
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1], b = row[i];
      if (b.x0 - a.x1 > 3.5 && b.x0 - a.x1 < 4.5) alleys.push({ x0: a.x1, x1: b.x0, x: (a.x1 + b.x0) / 2, z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1), row: ri, a, b });
    }
  }

  const nearSide = (x, m) => SIDE_X.some((s) => Math.abs(x - s) < m);
  // Street lamps: { x, z, yaw } where yaw points the arm at the road.
  for (let x = -285; x <= 285; x += 30) if (!nearSide(x, 10)) lamps.push({ x, z: 42.6, yaw: 0 });
  for (let x = -270; x <= 285; x += 30) lamps.push({ x, z: 63.4, yaw: Math.PI });
  for (let x = -280; x <= 285; x += 40) if (!nearSide(x, 10)) lamps.push({ x, z: 3.4, yaw: Math.PI });
  for (let x = -260; x <= 285; x += 50) if (!nearSide(x, 10)) lamps.push({ x, z: -60.6, yaw: Math.PI });
  for (let z = 165; z <= 240; z += 25) lamps.push({ x: PIER.x0 + 0.6, z, yaw: Math.PI / 2 });
  // the inner city used to go dark at night: lamps down both side-street sidewalks (between the palms)
  // and on the far side of the two back avenues
  const onAve = (z) => [ROADS.back1, ROADS.back2].some((rd) => Math.abs(z - rd.z) < rd.w / 2 + 3);
  for (const s of SIDE_X) for (let z = -125; z <= 30; z += 31) {
    if (!onAve(z + 15) && z + 15 < 36) lamps.push({ x: s - 7.3, z: z + 15, yaw: Math.PI / 2 });
    if (!onAve(z + 1) && z + 1 < 36) lamps.push({ x: s + 7.3, z: z + 1, yaw: -Math.PI / 2 });
  }
  for (let x = -245; x <= 285; x += 40) if (!nearSide(x, 10)) lamps.push({ x, z: -10.75, yaw: 0 });
  for (let x = -235; x <= 285; x += 50) if (!nearSide(x, 10)) lamps.push({ x, z: -74.9, yaw: 0 });

  // Palms: { x, z, s (scale), yaw }
  const palm = (x, z) => { const s = 0.85 + r() * 0.45, yaw = r() * 6.283, at = offRoad(x, z, 0.3 * s); if (at && !inJunction(at[0], at[1], 0.6)) palms.push({ x: at[0], z: at[1], s, yaw }); };
  for (let x = -292; x <= 292; x += 12) palm(x + (r() - 0.5) * 2, 70 + (r() - 0.5) * 3);
  for (let x = -270; x <= 285; x += 30) if (!nearSide(x, 10)) palm(x, 40.2);
  // (the sand used to get 34 palms scattered at random; they now stand in a few groves, see world/beach.js.
  // The random draws stay so everything placed after them keeps its spot.)
  for (let i = 0; i < 34; i++) { r(); r(); r(); r(); }
  for (let x = -290; x <= 290; x += 18) palm(x + (r() - 0.5) * 6, -143 + r() * 5);
  // side-street palms, skipping the stretches where the back avenues cross (they used to grow in the road)
  const onAvenue = (z) => [ROADS.back1, ROADS.back2].some((rd) => Math.abs(z - rd.z) < rd.w / 2 + 2.5);
  for (const s of SIDE_X) for (let z = -125; z <= 30; z += 31) {
    if (!onAvenue(z)) palm(s - 7.6, z);
    if (!onAvenue(z + 15)) palm(s + 7.6, z + 15);
  }

  // Parked cars: { x, z, yaw }
  const spots = [];
  // right-hand traffic: every parked car faces the way its side of the road flows
  for (let x = -270; x <= 270; x += 9) if (!nearSide(x, 14)) spots.push({ x, z: 46.8, yaw: -Math.PI / 2 });
  for (let x = -265; x <= 270; x += 13) if (!nearSide(x, 14)) spots.push({ x, z: 59.2, yaw: Math.PI / 2 });
  for (let x = -270; x <= 270; x += 17) if (!nearSide(x, 16)) spots.push({ x, z: 0.8, yaw: Math.PI / 2 });
  for (const s of SIDE_X) spots.push({ x: s - 4.8, z: 22, yaw: 0 }, { x: s + 4.8, z: -38, yaw: Math.PI });
  parking.push({ x: 6, z: 59.2, yaw: Math.PI / 2, spawn: true });         // one right next to the spawn
  const taken = new Set();
  let guard = 0;
  while (parking.length < 18 && guard++ < 400) {
    const i = Math.floor(r() * spots.length);
    if (taken.has(i) || Math.abs(spots[i].x - 6) < 8 && spots[i].z > 55) continue;
    taken.add(i);
    parking.push(spots[i]);
  }

  // Beach furniture
  // umbrellas and loungers now come in grouped rental clusters (world/beach.js, added with the props below)
  // keep the stunt runs on the beach clear (see A_RAMPS)
  const inRun = (x, z, m) => A_RAMPS.some((k) => x > k.clear.x0 - m && x < k.clear.x1 + m && z > k.clear.z0 - m && z < k.clear.z1 + m);
  for (let i = umbrellas.length - 1; i >= 0; i--) if (inRun(umbrellas[i].x, umbrellas[i].z, 2.5)) umbrellas.splice(i, 1);
  for (let i = palms.length - 1; i >= 0; i--) if (inRun(palms[i].x, palms[i].z, 0.8)) palms.splice(i, 1);
  huts.push({ x: -120, z: 100, color: '#ffd447', accent: '#ff4fa3' }, { x: 150, z: 104, color: '#8fe3d9', accent: '#ff8a3d' });
  // street trees in pits on the back avenues' wide sidewalks (between the lamps, never in a junction or on a
  // road, clear of the palms)
  const streetTrees = [];
  { const tr = rng(3131);
    const tree = (x, z) => {
      if (onRoad(x, z, 0.9) || inJunction(x, z, 2.5) || lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 3) || palms.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) return;
      streetTrees.push({ x, z, s: 0.85 + tr() * 0.35, yaw: tr() * 6.28, kind: tr() < 0.5 ? 0 : 1 });
    };
    for (let x = -260; x <= 280; x += 40) tree(x, 4.7);
    for (let x = -260; x <= 280; x += 50) tree(x, -76.7);
  }

  // Small solid props (spatial grid, see props.js) and the seats around town.
  const props = createProps();
  // the beach (world/beach.js): palm groves, rental clusters, towels, the kiosk, showers, the fire pit...
  const beach = planBeach(props);
  for (const p of beach.palms) palms.push(p);
  for (const u of beach.umbrellas) umbrellas.push(u);
  palms.forEach((p, i) => { p.col = props.circle(p.x, p.z, 0.3 * p.s, 8); p.col.tag = 'palm'; p.col.i = i; });
  for (const t of streetTrees) props.circle(t.x, t.z, 0.28, 6).tag = 'tree';
  lamps.forEach((l, i) => { l.col = props.circle(l.x, l.z, 0.2, 6.4); l.col.tag = 'lamp'; l.col.i = i; });
  const rot = (u, lx, lz) => [u.x + lx * Math.cos(u.yaw) + lz * Math.sin(u.yaw), u.z - lx * Math.sin(u.yaw) + lz * Math.cos(u.yaw)];
  for (const u of umbrellas) {
    props.circle(u.x, u.z, 0.12, 2.6);
    const [lx, lz] = rot(u, -1.05, -0.1), [tx, tz] = rot(u, 0.9, -0.1);
    u.lounger = props.seat(lx, lz, u.yaw, 0.36, 'lounger');
    u.towel = props.seat(tx, tz, u.yaw, 0.06, 'towel');
  }
  // café tables on the sidewalk outside the Sunset Strip Diner
  const diner = buildings.find((k) => k.name === 'Sunset Strip Diner'), cafe = [];
  for (const ox of [-6, -2, 2, 6]) {
    const x = diner.cx + ox, z = 38.6;
    const bm = ((x + 265) % 60 + 60) % 60;
    if (bm < 2.8 || bm > 57.2 || SIDE_X.some((sx) => Math.abs(x - sx - 13.5) < 2.4)) continue;   // keep clear of the benches and phone booths
    cafe.push({ x, z });                                 // tables and chairs are loose props (world/loose.js)
  }
  // the seawall: sit on the coping with your back to the railing
  const sw = HX - 1.05;
  props.line(sw, -HZ + 1.6, sw, 76, -Math.PI / 2, 0.92, 'wall');
  props.line(-sw, -HZ + 1.6, -sw, CAUSEWAY.z0 - 1.5, Math.PI / 2, 0.92, 'wall');
  props.line(-sw, CAUSEWAY.z1 + 1.5, -sw, 76, Math.PI / 2, 0.92, 'wall');
  props.line(-HX + 1.6, -(HZ - 1.05), HX - 1.6, -(HZ - 1.05), 0, 0.92, 'wall');
  // the pier: sit on the deck by the rail and look out to sea
  props.line(PIER.x0 + 0.75, PIER.z0 + 4, PIER.x0 + 0.75, PIER.z1 - 9, -Math.PI / 2, 0, 'ground');
  props.line(PIER.x1 - 0.75, PIER.z0 + 4, PIER.x1 - 0.75, PIER.z1 - 9, Math.PI / 2, 0, 'ground');
  props.line(PIER.x0 + 1.5, PIER.z1 - 0.75, PIER.x0 + 3.2, PIER.z1 - 0.75, 0, 0, 'ground');
  props.line(PIER.x1 - 3.2, PIER.z1 - 0.75, PIER.x1 - 1.5, PIER.z1 - 0.75, 0, 0, 'ground');

  // Collision boxes (xz) with a height so the helicopter can fly over them.
  // h is the cornice top: anything higher (a helicopter, someone walking the roof) is over it
  const solids = buildings.map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: b.h + 0.45, b }));
  // flat roofs you can walk and land on: the cornice ring and the raised parapet step inside it, with a
  // stair door in one corner (world/details.js builds the hut and the rooftop clutter)
  const surf = createSurfaces();
  for (const b of buildings) {
    b.roofY = b.h + 1.4;
    surf.rect(b.x0, b.x1, b.z0, b.z1, b.h + 0.5, 'roof', { b });
    surf.rect(b.cx - (b.w - 3) / 2, b.cx + (b.w - 3) / 2, b.cz - (b.d - 3) / 2, b.cz + (b.d - 3) / 2, b.roofY, 'roof', { b });
    b.door = surf.door(b.x0 + 3, b.z0 + 3, b.roofY, { x: b.x0 + 3.2, z: b.z1 + 2.4, yaw: 0 }, b);
  }
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
    // scooters parked at the kerb of the back avenues (rideable: vehicles/types.js)
    { x: -215, z: 2.9, yaw: Math.PI / 2, type: 'scooter' }, { x: -45, z: 2.9, yaw: Math.PI / 2, type: 'scooter' },
    { x: 115, z: -73.2, yaw: Math.PI / 2, type: 'scooter' }, { x: 225, z: 2.9, yaw: Math.PI / 2, type: 'scooter' },
  ];
  // phone booths stand on the Deco Row sidewalk and are solid
  const booths = [];
  for (const s of SIDE_X) booths.push({ x: s + 13.5, z: 38.2 });
  booths.push({ x: -60, z: 76.4 }, { x: 80, z: 76.4 });
  // and three more on the inner streets
  booths.push({ x: -150, z: -12.2 }, { x: 150, z: -12.2 }, { x: -30, z: -76.6 });
  for (const b of booths) solids.push({ x0: b.x - 0.6, x1: b.x + 0.6, z0: b.z - 0.6, z1: b.z + 0.6, h: 2.8 });

  // the edge: sawhorses in front of the causeway closure, bollards where the side streets stop
  for (const s of SIDE_X) solids.push({ x0: s - 5.3, x1: s + 5.3, z0: ROADS.sideZ0 - 0.8, z1: ROADS.sideZ0 - 0.4, h: 1 });

  // Solano Key, across the causeway (world/key.js): its own buildings, lamps and palms, but one collision
  // list, one prop grid and one fleet of parked cars
  const key = makeKey(props, solids, surf);
  for (const p of key.parking) parking.push(p);
  const ramps = [...A_RAMPS, ...key.ramps];
  registerRamps(surf, ramps, solids);
  // the venues: door ring position from the building face
  const venues = {};
  for (const k in VENUE_DEFS) {
    const d = VENUE_DEFS[k], b = (d.isle === 'key' ? key.buildings : buildings).find((q) => q.name === d.at), f = d.face;
    const nx = Math.round(Math.sin(f)), nz = Math.round(Math.cos(f));
    const fx = nx ? (nx > 0 ? b.x1 : b.x0) : b.cx + d.along, fz = nz ? (nz > 0 ? b.z1 : b.z0) : b.cz + d.along;
    venues[k] = { key: k, ...d, b, x: fx + nx * d.out, z: fz + nz * d.out, nx, nz, venue: true };
  }
  return { alleys, streetTrees, buildings, lamps, palms, parking, umbrellas, huts, beach, solids, bar, station, clinic, places, venues, bikes, booths, props, cafe, loose: [], planters: [], key, ramps, surf };
}

// The two stunt ramps in the old town (the key's are in world/key.js): off the promenade across the
// sand, and along the promenade past the planting beds. Same shape as the key's (see game/stunts.js).
export const A_RAMPS = [
  { id: 'dune', name: 'DUNE RUN', x: 100, z: 88, yaw: 0, len: 9, w: 5, h: 3.2, land: { x0: 88, x1: 112, z0: 102, z1: 130 }, vmin: 15, beach: true, clear: { x0: 94, x1: 106, z0: 62, z1: 132 } },
  { id: 'promenade', name: 'PROMENADE LEAP', x: -205, z: 70, yaw: Math.PI / 2, len: 9, w: 5, h: 2.4, land: { x0: -194, x1: -166, z0: 64, z1: 77 }, vmin: 16, clear: { x0: -262, x1: -160, z0: 66.5, z1: 73.5 } },
];

// The carriageways (lanes and parking lanes, crossings included): nothing may stand on them.
export const ROAD_RECTS = [
  ...KEY_ROAD_RECTS,
  { name: 'Lumina Boulevard', x0: KEY.x1 - 2, x1: HX, z0: ROADS.blvd.z - ROADS.blvd.w / 2, z1: ROADS.blvd.z + ROADS.blvd.w / 2 },
  { name: 'back avenue 1', x0: -HX, x1: HX, z0: ROADS.back1.z - ROADS.back1.w / 2, z1: ROADS.back1.z + ROADS.back1.w / 2 },
  { name: 'back avenue 2', x0: -HX, x1: HX, z0: ROADS.back2.z - ROADS.back2.w / 2, z1: ROADS.back2.z + ROADS.back2.w / 2 },
  ...SIDE_X.map((s) => ({ name: 'side street ' + s, x0: s - ROADS.sideW / 2, x1: s + ROADS.sideW / 2, z0: ROADS.sideZ0, z1: ROADS.blvd.z - ROADS.blvd.w / 2 })),
];
// Does a footprint (circle of radius r) touch a carriageway? Returns the road or null.
// The crossing and corner area of every side-street junction: palms and street furniture stay out of it.
const JUNCTIONS = [];
for (const sx of SIDE_X) for (const [rz, hz] of [[ROADS.blvd.z, 13.8], [ROADS.back1.z, 10.2], [ROADS.back2.z, 10.2]]) JUNCTIONS.push({ x0: sx - 12, x1: sx + 12, z0: rz - hz, z1: rz + hz });
for (const j of KEY_JUNCTIONS) JUNCTIONS.push({ x0: j.x - 12, x1: j.x + 12, z0: j.z - j.h.hz, z1: j.z + j.h.hz });
export function inJunction(x, z, r = 0) {
  return JUNCTIONS.some((j) => x > j.x0 - r && x < j.x1 + r && z > j.z0 - r && z < j.z1 + r);
}
export function onRoad(x, z, r = 0) {
  for (const b of ROAD_RECTS) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return b;
  return null;
}
// Move a footprint the shortest way off the road (onto the kerb side), or null if it cannot be done.
export function offRoad(x, z, r = 0, m = 0.3) {
  const b = onRoad(x, z, r);
  if (!b) return [x, z];
  const opts = [[b.x0 - r - m, z, x - b.x0 + r], [b.x1 + r + m, z, b.x1 - x + r], [x, b.z0 - r - m, z - b.z0 + r], [x, b.z1 + r + m, b.z1 - z + r]].sort((p, q) => p[2] - q[2]);
  for (const o of opts) if (!onRoad(o[0], o[1], r)) return [o[0], o[1]];
  return null;
}
// Footprints of what is built straight into the merged town meshes and stands on the ground: sign and
// billboard legs, gantry pylons, bus shelters, booths, café parasols, street furniture without a collider.
// Filled while the districts are built (city.js, details.js, edges.js, keyCity.js, streetscape.js) and
// checked against the carriageways (lanes, parking lanes, crossings, the causeway deck) like the props.
export const FOOTPRINTS = [];
export const footprint = (what, x, z, r = 0.15) => { FOOTPRINTS.push({ what, x, z, r }); };
// Ground-level boxes (x0..x1, z0..z1) of building bodies and their street-side parts (walkways, stairs,
// canopies, sign poles, fins) in Solano Key (keyCity.js): none may overlap a carriageway.
export const FOOTBOXES = [];
export const footBox = (what, x0, x1, z0, z1) => { FOOTBOXES.push({ what, x0, x1, z0, z1 }); };
// nothing on wheels gets within ~3 m of the old town's seawall (vehicles keep their noses off it), so the
// dead-end boards at the very ends of the avenues stand beyond the lanes
const pastLanes = (x) => Math.abs(x) > HX - 2.6 && Math.abs(x) < HX + 1;
export function footprintsOnRoad() {
  const bad = [];
  for (const f of FOOTPRINTS) {
    if (pastLanes(f.x)) continue;
    // the causeway: its lanes run between the two parapets (the parapets themselves are wall, not lane)
    const b = f.x < -HX && f.x > KEY.x1 ? (f.z + f.r > CAUSEWAY.z0 + 0.5 && f.z - f.r < CAUSEWAY.z1 - 0.5 ? { name: 'Halcyon Causeway deck' } : null) : onRoad(f.x, f.z, f.r);
    if (b) bad.push({ what: f.what, x: +f.x.toFixed(2), z: +f.z.toFixed(2), road: b.name });
    else if (inJunction(f.x, f.z, 0) && !/mast|signal/.test(f.what)) bad.push({ what: f.what, x: +f.x.toFixed(2), z: +f.z.toFixed(2), road: 'junction' });
  }
  for (const f of FOOTBOXES) {
    const b = ROAD_RECTS.find((q) => f.x0 < q.x1 - 0.05 && f.x1 > q.x0 + 0.05 && f.z0 < q.z1 - 0.05 && f.z1 > q.z0 + 0.05);
    if (b) bad.push({ what: f.what, x: +((f.x0 + f.x1) / 2).toFixed(2), z: +((f.z0 + f.z1) / 2).toFixed(2), box: [f.x0, f.x1, f.z0, f.z1].map((v) => +v.toFixed(2)), road: b.name });
  }
  return bad;
}
// Startup check: every prop, seat, lamp, palm, planter and loose prop must stand off the carriageways.
export function propsOnRoad(L) {
  const bad = footprintsOnRoad();
  const t = (what, x, z, r) => { const b = onRoad(x, z, r); if (b) bad.push({ what, x: +x.toFixed(2), z: +z.toFixed(2), road: b.name }); };
  for (const o of L.props.cols) {
    if (o.tag === 'mast') continue;                  // signal masts stand at the kerb on purpose
    if (o.c) t(o.tag || 'prop', o.x, o.z, o.r - 0.05); else t(o.tag || 'box', (o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, Math.min(o.x1 - o.x0, o.z1 - o.z0) / 2 - 0.05);
  }
  for (const s of L.props.seats) if (s.kind !== 'towel' && s.kind !== 'lounger') t('seat:' + s.kind, s.x, s.z, 0.2);
  for (const b of L.loose) t(b.kind, b.hx, b.hz, b.r || 0.3);
  for (const p of L.planters) t('planter', p.x, p.z, 0.4);
  for (const p of L.palms) { t('palm', p.x, p.z, 0.4); if (inJunction(p.x, p.z, 0.6)) bad.push({ what: 'palm', x: +p.x.toFixed(2), z: +p.z.toFixed(2), road: 'junction' }); }
  for (const b of L.loose) if (inJunction(b.hx, b.hz, 0)) bad.push({ what: b.kind, x: +b.hx.toFixed(2), z: +b.hz.toFixed(2), road: 'junction' });
  return bad;
}

// The edge of the island is a seawall (x = ±HX, z = -HZ) and the waterline on the beach (z = +HZ).
// Lumina Boulevard runs on past the west wall onto the Halcyon Causeway (reopened after the storm
// repairs) and lands on Solano Key (world/key.js), which has a seawall all round, broken only by the
// causeway and the marina pier.
export const WALL = 0.8;                                     // inner face of the seawall, from the island edge
export const CAUSEWAY = { x0: KEY.x1, z0: 44, z1: 62 };      // deck from the key's wall to the old town's, deck sides
// Helicopters (anything at sea) may roam out to this distance from the two islands' centre line; beyond it they are steered back.
export const SEA_R = 640;
const SEA_A = [0, 0], SEA_B = [(KEY.x0 + KEY.x1) / 2, 0];
// how far (x, z) is out past the soft boundary, and which way is home: { over, nx, nz } (over <= 0 inside)
export function seaPull(x, z) {
  const t = clamp((x - SEA_A[0]) / (SEA_B[0] - SEA_A[0]), 0, 1), cx = SEA_A[0] + (SEA_B[0] - SEA_A[0]) * t, cz = 0;
  const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
  return { over: d - SEA_R, nx: dx / d, nz: dz / d, cx, cz };
}
export const EDGE_SIGNS = ['Halcyon Causeway · Solano Key', 'Lumina Point · Road Ends'];
export const onIsland = (x, z) => Math.abs(x) <= HX && Math.abs(z) <= HZ;
export const onCauseway = (x, z, m = 0) => x < -HX + m && x > KEY.x1 - m && z > CAUSEWAY.z0 - m && z < CAUSEWAY.z1 + m;
// dry ground you can stand on: either island, the causeway, either pier
export const onLand = (x, z) => onIsland(x, z) || inKey(x, z) || onCauseway(x, z, 0.5) || onMarinaPier(x, z, 0.5) || (x > PIER.x0 - 1 && x < PIER.x1 + 1 && z > 0 && z < PIER.z1 + 1);

// Keep something inside the walkable world (both islands inside their seawalls, the piers and the causeway).
// w (default 0: stay dry) is a set of bits for things that may leave it by water:
//   1  the beach: walk or drive on into the sea (nothing stops you at the waterline)
//   2  a pier: hard enough, and you go through the rail over its sides and end
//   4  the seawall: fast enough, and you go through the railing
// The caller (swimming, sinking vehicles) decides what happens once something is out there.
export function clampToWorld(o, m, w = 0) {
  let hit = false;
  const x = m > 1 ? 1.4 : 0, e = WALL + m + x, C = CAUSEWAY;   // vehicles keep their noses off the wall
  const deck = o.z > C.z0 + m - 0.4 && o.z < C.z1 - m + 0.4;
  if (o.x < -HX + e && o.x > KEY.x1 - e) {
    // between the islands: the causeway, or the seawalls either side of it
    if (!deck) {
      if (o.x < -HX - 0.5 && o.x > KEY.x1 + 0.5) { o.z = clamp(o.z, C.z0 + m - 0.4, C.z1 - m + 0.4); hit = true; }
      else if (o.x >= -HX - 0.5) { if (w & 4) edgeHit = 'wall'; else { o.x = -HX + e; hit = true; } }
      else if (w & 4) edgeHit = 'wall'; else { o.x = KEY.x1 - e; hit = true; }
    }
    return hit;
  }
  if (o.x <= KEY.x1 - e) return clampKeyEdge(o, m, w, e);
  if (o.x > HX - e) { if (w & 4) edgeHit = 'wall'; else { o.x = HX - e; hit = true; } }
  if (o.z < -HZ + e) { if (w & 4) edgeHit = 'wall'; else { o.z = -HZ + e; hit = true; } }
  if (o.z > HZ - m) {
    const onPier = o.x > PIER.x0 + m - 0.4 && o.x < PIER.x1 - m + 0.4;
    if (!onPier) {
      if (o.z > HZ + 12) { if (w & 2) edgeHit = 'pier'; else { o.x = clamp(o.x, PIER.x0 + m - 0.4, PIER.x1 - m + 0.4); hit = true; } }   // off the side of the pier
      else if (w & 1) { /* the beach runs on into the sea */ }
      else if (o.z > HZ + 0.5) { o.x = clamp(o.x, PIER.x0 + m - 0.4, PIER.x1 - m + 0.4); hit = true; }
      else { o.z = HZ - m; hit = true; }
    } else if (o.z > PIER.z1 - m) { if (w & 2) edgeHit = 'pier'; else { o.z = PIER.z1 - m; hit = true; } }
  }
  return hit;
}
// the key: a seawall all round, the marina pier out of the south side
function clampKeyEdge(o, m, w, e) {
  let hit = false;
  if (o.x < KEY.x0 + e) { if (w & 4) edgeHit = 'wall'; else { o.x = KEY.x0 + e; hit = true; } }
  if (o.z < KEY.z0 + e) { if (w & 4) edgeHit = 'wall'; else { o.z = KEY.z0 + e; hit = true; } }
  if (o.z > KEY.z1 - e) {
    const onPier = o.x > MPIER.x0 + m - 0.4 && o.x < MPIER.x1 - m + 0.4;
    if (!onPier) {
      if (o.z > KEY.z1 + 0.5) { if (w & 2) edgeHit = 'pier'; else { o.x = clamp(o.x, MPIER.x0 + m - 0.4, MPIER.x1 - m + 0.4); hit = true; } }
      else if (w & 4) edgeHit = 'wall'; else { o.z = KEY.z1 - e; hit = true; }
    } else if (o.z > MPIER.z1 - m) { if (w & 2) edgeHit = 'pier'; else { o.z = MPIER.z1 - m; hit = true; } }
  }
  return hit;
}
// set by clampToWorld when a mover pushed through an edge it was allowed to break (see the w bits): 'pier' | 'wall'
export let edgeHit = null;
export const takeEdge = () => { const e = edgeHit; edgeHit = null; return e; };

export function zoneName(x, z) {
  if (onCauseway(x, z, 2)) return 'HALCYON CAUSEWAY';
  const k = keyZone(x, z);
  if (k) return k;
  if (z > HZ && x > PIER.x0 - 3 && x < PIER.x1 + 3 && z < PIER.z1 + 3) return 'DRIFTWOOD PIER';
  if (!onIsland(x, z)) return 'OPEN WATER';
  if (z > 78) return 'CORAL BEACH';
  if (z > 62) return 'THE PROMENADE';
  if (z > 44) return 'LUMINA BOULEVARD';
  if (z > 4) return 'DECO ROW';
  if (z > -62) return 'MIDTOWN';
  return 'BACK BAY';
}
