// Coral Beach, the old town's sand (Solano Key has a seawall all round, so this is the only beach):
// where things stand, the zones nothing may stand in, the beach props and a check that enforces it.
//
//   planBeach(props)       palms in a few groves, umbrellas in rental clusters, towels, the kiosk, the rental
//                          stand, showers, bins, the fire pit, sandcastles, kayaks ... registered as colliders
//                          and seats (layout.js calls it while it builds the props grid)
//   beachGeometry(B, S)    their low-poly geometry, pushed into the city's merged solid mesh (no draw call)
//   createBeachFx(...)     the fire pit's flames (one small additive mesh, drawn at night only)
//   checkBeach(L)          everything on the sand against BEACH_ZONES: [] when nothing stands where it must not
//
// Pure data at the top (no imports from layout.js, which imports this file).
import * as THREE from 'three';
import { box, cyl, tint, rng, PI, nightU, timeU } from '../core/util.js';
import { APIER } from './pier.js';

export const SAND = { x0: -288, x1: 288, z0: 78, z1: 150 };
export const COURT = { x0: -49, x1: -31, z0: 98, z1: 107, net: -40 };
export const KIOSK = { x: -92, z: 86, name: 'COCONUT SHACK' };            // the counter faces the sea (+z)
export const KIOSK_SPOT = { x: KIOSK.x - 1.3, z: KIOSK.z + 2.55 };         // stand here and press F (the queue is to the right)
export const RENTAL = { x: 64, z: 87 };
export const FIRE = { x: -8, z: 128 };
export const BOARDWALKS = [{ x: -172, z0: 78, z1: 108 }, { x: -15, z0: 78, z1: 114 }, { x: 182, z0: 78, z1: 110 }, { x: APIER.cx, z0: 78, z1: APIER.z0 }];
export const SHOWERS = [[-36, 81.5], [128, 81.5], [236, 81.5]];
export const SWIM = { x0: -140, x1: -20, z: 180 };                          // the buoy line marks the swimming area
export const SANDCASTLES = [[-140, 136], [-133.5, 138.5], [60, 136]];
export const YOGA = { x: -215, z: 127 };
// umbrella clusters: [x, z, cols, rows, colour]
const CLUSTERS = [[-240, 103, 2, 2, '#ff5fa8'], [-88, 106, 2, 2, '#27d8cf'], [70, 106, 3, 1, '#ffd447'], [205, 108, 2, 2, '#ff8a4c']];
// palm groves near the promenade and the dunes: [x, z, palms]
const GROVES = [[-262, 87, 3], [-196, 85, 2], [-133, 86, 3], [-58, 88, 2], [150, 86, 3], [216, 88, 2], [287, 86, 2]];
const TOWELS = [[-205, 119, 0.15], [-160, 126, -0.2], [-70, 127, 0.1], [-24, 121, -0.1], [132, 123, 0.25], [176, 126, -0.15], [239, 134, 0.05], [-255, 129, -0.1]];
const KAYAKS = [[112, 142.6, 0.06, 'kayak', '#ff6a3d'], [115.6, 142.4, -0.04, 'kayak', '#27d8cf'], [119.2, 142.7, 0.05, 'sup', '#ffd447'], [122.4, 142.5, 0, 'sup', '#ff4fa3'], [126, 142.6, -0.06, 'kayak', '#9b7bff']];
const BOARDS = [[-205, 98], [-203.6, 98.4], [-202.2, 98.1], [165, 118], [166.3, 118.4]];
const BINS = [[-168.6, 80.4], [-11.6, 80.4], [185.6, 80.4], [-96.5, 84.6], [68.5, 84.6]];

// Nothing may stand in these (the feature a zone is for, `own`, may). x0..x1 / z0..z1 in metres.
const Zr = (name, x0, x1, z0, z1, own = null) => ({ name, x0, x1, z0, z1, own });
export const BEACH_ZONES = [
  Zr('volleyball court', COURT.x0 - 3, COURT.x1 + 3, COURT.z0 - 3, COURT.z1 + 3, 'court'),   // the court and its run-off
  Zr('Dune Run ramp', 92, 108, 78, 134, 'ramp'),                                              // the run-up, the jump and the landing
  Zr('lifeguard hut', -124.5, -115.5, 94, 104.5, 'hut'), Zr('lifeguard hut', 145.5, 154.5, 98, 108.5, 'hut'),
  ...[20, -200, 230].map((x) => Zr('lifeguard chair', x - 3, x + 3, 121, 127, 'chair')),
  ...BOARDWALKS.map((b) => Zr('boardwalk', b.x - 1.7, b.x + 1.7, b.z0, b.z1 + 0.5, 'boardwalk')),
  Zr('fire pit', FIRE.x - 4, FIRE.x + 4, FIRE.z - 4, FIRE.z + 4, 'fire'),
  Zr('kiosk and its queue', KIOSK.x - 3.5, KIOSK.x + 3.5, KIOSK.z - 2.5, KIOSK.z + 10, 'kiosk'),
  // the wet sand at the waterline (the pier foot between them keeps its benches and planters)
  Zr('shoreline wet strip', -300, 27.5, 145, 162), Zr('shoreline wet strip', 52.5, APIER.x0 - 1.5, 145, 162), Zr('shoreline wet strip', APIER.x1 + 1.5, 300, 145, 162),
  // Starlight Pier (world/pier.js): nothing of the beach's on its deck, nothing of the pier's off it
  Zr('Starlight Pier', APIER.x0 - 1, APIER.x1 + 1, APIER.z0 - 1, 162, 'pier'),
];
export const zoneAt = (x, z, m = 0, own = null) => BEACH_ZONES.find((q) => q.own !== own && x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m) || null;
const onSand = (x, z) => z > SAND.z0 && z < 162 && Math.abs(x) < 300;

// ---- where everything goes (layout.js) ----------------------------------------------------------------------
export function planBeach(props) {
  const r = rng(8686);
  const B = { palms: [], umbrellas: [], items: [], towels: [], seats: { towel: [], log: [] }, decals: [], tufts: [], shells: [], wood: [] };
  // palms: a few groves, open sand between them
  for (const [gx, gz, n] of GROVES) {
    let made = 0;
    for (let k = 0; k < 30 && made < n; k++) {
      const a = r() * PI * 2, d = 1.2 + r() * 3.4, x = gx + Math.cos(a) * d, z = Math.min(94, Math.max(80.5, gz + Math.sin(a) * d));
      if (zoneAt(x, z, 1.2) || B.palms.some((p) => Math.hypot(p.x - x, p.z - z) < 2.6)) continue;
      B.palms.push({ x, z, s: 0.85 + r() * 0.45, yaw: r() * 6.283, grove: true }); made++;
    }
  }
  // umbrellas and loungers: grouped rental clusters in neat rows, all looking out to sea
  for (const [cx, cz, nc, nr, col] of CLUSTERS) for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
    const x = cx + (i - (nc - 1) / 2) * 6.2, z = cz + (j - (nr - 1) / 2) * 7.5;
    B.umbrellas.push({ x, z, color: col, yaw: (r() - 0.5) * 0.12, cluster: cx });
    B.decals.push([x + 0.9, z + 0.3, r() * 0.2 - 0.1]);
  }
  // towels with a bag and flip-flops (seats: people sunbathe on them, you can lie down on them)
  for (const [x, z, yaw] of TOWELS) { B.towels.push({ x, z, yaw, c: ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c', '#9b7bff', '#ffffff'][B.towels.length % 6] }); }
  // dune grass along the back of the beach, in clumps
  for (let i = 0; i < 46; i++) {
    const cx = -280 + r() * 560, cz = 79.2 + r() * 5.5;
    for (let k = 0; k < 3; k++) {
      const x = cx + (r() - 0.5) * 2.4, z = cz + (r() - 0.5) * 1.6;
      if (zoneAt(x, z, 0.3) || Math.abs(x - KIOSK.x) < 4 || Math.abs(x - RENTAL.x) < 6 || SHOWERS.some(([sx]) => Math.abs(x - sx) < 1.6) || BINS.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 1.2) || [-155.5, -148.5, 114.5, 121.5, 244.5, 251.5].some((sx) => Math.abs(x - sx) < 0.8)) continue;
      B.tufts.push([x, z, 0.6 + r() * 0.6, r() * 3]);
    }
  }
  // shells and driftwood just above the wet sand
  for (let i = 0; i < 46; i++) { const x = -280 + r() * 560, z = 136 + r() * 8.5; if (!zoneAt(x, z, 0.2) && Math.abs(x - 40) > 14) B.shells.push([x, z, r() * 3, ['#fff0e0', '#ffc7b8', '#f6e3c8', '#e8d0f0'][i % 4]]); }
  for (const [x, z, len, yaw] of [[-250, 141, 1.9, 0.4], [-178, 139, 1.3, -0.7], [-62, 143, 1.6, 1.2], [176, 140, 2.0, -0.3], [262, 142, 1.4, 0.9]]) B.wood.push([x, z, len, yaw]);

  // ---- colliders and seats
  const P = props, own = (o, tag) => { o.own = tag; return o; };
  const item = (kind, x, z, rad, o = {}) => { const it = { kind, x, z, r: rad, ...o }; B.items.push(it); return it; };
  item('kiosk', KIOSK.x, KIOSK.z, 2.5, { own: 'kiosk' }); own(P.box(KIOSK.x, KIOSK.z, 4.8, 3.4, 3.2), 'kiosk');
  item('rental', RENTAL.x, RENTAL.z, 1.3); P.box(RENTAL.x, RENTAL.z, 2.4, 2.2, 2.6);
  item('loungers', RENTAL.x + 3.4, RENTAL.z, 1.1); P.box(RENTAL.x + 3.4, RENTAL.z, 0.8, 2.0, 1.0);
  item('board rack', RENTAL.x - 3.2, RENTAL.z, 1.1); P.box(RENTAL.x - 3.2, RENTAL.z, 2.2, 0.5, 2.2);
  for (const [x, z] of SHOWERS) { item('shower', x, z, 0.7); P.circle(x, z, 0.16, 2.4); }
  for (const [x, z] of BINS) { item('bins', x, z, 0.6); P.box(x, z, 1.2, 0.6, 1.0); }
  item('fire pit', FIRE.x, FIRE.z, 1.0, { own: 'fire' }); own(P.circle(FIRE.x, FIRE.z, 0.95, 0.45), 'fire');
  // driftwood logs round the fire: north, east, south, west, each a seat looking at the flames
  for (const [dx, dz] of [[0, -2.3], [2.3, 0], [0, 2.3], [-2.3, 0]]) {
    const x = FIRE.x + dx, z = FIRE.z + dz, along = dz ? 0 : PI / 2;
    item('log seat', x, z, 0.9, { own: 'fire', yaw: along });
    own(P.box(x, z, dz ? 1.7 : 0.42, dz ? 0.42 : 1.7, 0.4), 'fire');
    const face = Math.atan2(-dx, -dz);
    for (const o of [-0.45, 0.45]) B.seats.log.push(P.seat(x + (dz ? o : 0) + Math.sin(face) * -0.06, z + (dx ? o : 0) + Math.cos(face) * -0.06, face, 0.36, 'log'));
  }
  for (const [x, z] of SANDCASTLES) { item('sandcastle', x, z, 0.65); P.circle(x, z, 0.55, 0.55); }
  for (const [x, z, , kind] of KAYAKS) { item(kind, x, z, 1.6); P.box(x, z, 0.75, 3.2, 0.4); }
  for (const [x, z] of BOARDS) { item('surfboard', x, z, 0.35); P.circle(x, z, 0.28, 2.3); }
  for (const t of B.towels) { item('towel', t.x, t.z, 0.9); B.seats.towel.push(t.seat = P.seat(t.x, t.z, t.yaw, 0.06, 'towel')); }
  B.kiosk = KIOSK; B.kioskSpot = KIOSK_SPOT; B.fire = FIRE; B.court = COURT; B.swim = SWIM; B.yoga = YOGA; B.castles = SANDCASTLES; B.kayaks = KAYAKS; B.boards = BOARDS; B.bins = BINS; B.walks = BOARDWALKS; B.showers = SHOWERS; B.rental = RENTAL;
  return B;
}

// ---- the check: nothing on the court, the paths, the ramp, the lifeguard spots or the wet sand -------------
export function checkBeach(L) {
  const bad = [];
  const t = (what, x, z, m, tag) => { if (!onSand(x, z) || (x > 30 && x < 50 && z > 149)) return; const q = zoneAt(x, z, m, tag); if (q) bad.push({ what, x: +x.toFixed(2), z: +z.toFixed(2), zone: q.name }); };
  for (const p of L.palms) t('palm', p.x, p.z, 0.3 * (p.s || 1));
  for (const u of L.umbrellas) t('umbrella + lounger', u.x, u.z, 1.9);
  for (const s of L.props.seats) if (s.kind === 'lounger' || s.kind === 'towel') t('seat:' + s.kind, s.x, s.z, 0.5);
  for (const o of L.props.cols) {
    if (o.tag === 'palm') continue;
    if (o.c) t(o.tag || 'prop', o.x, o.z, o.r, o.own); else t(o.tag || 'box', (o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, Math.min(o.x1 - o.x0, o.z1 - o.z0) / 2, o.own);
  }
  for (const b of L.loose) t(b.kind, b.hx, b.hz, b.r || 0.3, b.own);
  if (L.beach) for (const it of L.beach.items) t(it.kind, it.x, it.z, Math.min(it.r, 0.6), it.own);
  for (const s of L.solids) if (!s.b && !s.stand) t('solid', (s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, 0, (s.x1 - s.x0) < 5 && (s.z1 - s.z0) < 5 && s.h === 6 ? 'hut' : null);
  return bad;
}

// ---- geometry: pushed into the city's merged solid mesh -----------------------------------------------------
const WOOD = '#b98a5a', WOOD2 = '#a2744a', CREAM = '#fbf7f0', SANDC = '#e3c58c';
export function beachGeometry(B, S) {
  const r = rng(4321);
  // boardwalks across the dunes: planks on two runners
  for (const w of B.walks) {
    for (let z = w.z0 + 0.25; z < w.z1; z += 0.5) S.push(box(2.4, 0.06, 0.42, w.x, 0.05, z, (Math.floor(z * 2) % 2) ? WOOD : WOOD2, 0, (r() - 0.5) * 0.03));
    for (const o of [-1.05, 1.05]) S.push(box(0.12, 0.05, w.z1 - w.z0, w.x + o, 0.02, (w.z0 + w.z1) / 2, '#7a5236'));
    S.push(box(0.12, 0.7, 0.12, w.x - 1.3, 0.35, w.z0 + 0.4, '#7a5236'), box(0.12, 0.7, 0.12, w.x + 1.3, 0.35, w.z0 + 0.4, '#7a5236'));
  }
  // the Coconut Shack: a pastel hut with a thatched roof, a counter facing the sea, a blender and fruit
  {
    const { x, z } = B.kiosk;
    // floor, back and side walls, the counter wall in front and a lintel: the vendor serves through the window
    S.push(box(4.5, 0.25, 3.1, x, 0.12, z, '#e58aa8'), box(4.4, 2.3, 0.14, x, 1.15, z - 1.43, '#f7b3c6'), box(0.14, 2.3, 3.0, x - 2.13, 1.15, z, '#f7b3c6'), box(0.14, 2.3, 3.0, x + 2.13, 1.15, z, '#f7b3c6'),
      box(4.4, 1.05, 0.14, x, 0.52, z + 1.43, '#f7b3c6'), box(4.4, 0.42, 0.14, x, 2.1, z + 1.43, '#f7b3c6'), box(4.1, 2.2, 0.04, x, 1.15, z - 1.34, '#ffd9e6'),
      box(4.8, 0.12, 0.8, x, 1.12, z + 1.75, '#fbf7f0'), box(4.6, 0.9, 0.1, x, 0.55, z + 2.1, '#27d8cf'),
      box(4.6, 0.12, 0.12, x, 0.98, z + 2.12, '#ffd447'), box(3.6, 0.06, 0.5, x, 1.6, z - 1.1, '#fbf7f0'));
    for (let i = 0; i < 6; i++) S.push(cyl(0.05, 0.05, 0.22, 6, x - 1.4 + i * 0.55, 1.75, z - 1.1, ['#ff8a4c', '#ffd447', '#8dff9a', '#ff5fa8', '#27d8cf', '#ffd447'][i]));
    const roof = new THREE.ConeGeometry(3.7, 1.5, 4, 1).rotateY(PI / 4).translate(x, 3.05, z);
    S.push(tint(roof, '#d9b26a'), cyl(0.06, 0.06, 0.6, 5, x, 4.0, z, '#7a5236'), box(0.7, 0.35, 0.04, x + 0.38, 4.15, z, '#ff4fa3'));
    for (const o of [-1.6, 1.6]) S.push(box(0.16, 2.6, 0.16, x + o, 1.3, z + 1.95, WOOD));
    // the sign board over the counter: a pineapple and a sunset in blocks
    S.push(box(2.6, 0.62, 0.1, x, 2.65, z + 1.62, '#27d8cf'), box(2.4, 0.5, 0.02, x, 2.65, z + 1.68, '#ff8a4c'), box(0.9, 0.24, 0.02, x, 2.55, z + 1.7, '#ffd447'));
    S.push(cyl(0.12, 0.14, 0.26, 7, x - 0.9, 2.62, z + 1.72, '#ffc93f', PI / 2), box(0.04, 0.16, 0.04, x - 0.9, 2.84, z + 1.72, '#3fbf7a'));
    // on the counter: a blender, cups, a fruit bowl
    S.push(cyl(0.1, 0.12, 0.34, 8, x - 1.2, 1.36, z + 1.7, '#cfefff'), box(0.24, 0.12, 0.24, x - 1.2, 1.24, z + 1.7, '#3a3550'));
    for (let i = 0; i < 4; i++) S.push(cyl(0.05, 0.04, 0.14, 6, x - 0.4 + i * 0.16, 1.25, z + 1.65, ['#ff5fa8', '#ffd447', '#8dff9a', '#ff8a4c'][i]));
    S.push(cyl(0.22, 0.14, 0.12, 8, x + 1.1, 1.24, z + 1.7, '#7a5236'));
    for (let i = 0; i < 5; i++) S.push(box(0.12, 0.12, 0.12, x + 1.0 + (i % 3) * 0.1, 1.34 + (i > 2 ? 0.08 : 0), z + 1.65 + (i % 2) * 0.1, ['#ffd447', '#ff8a4c', '#8dff5a', '#ff4fa3', '#ffd447'][i]));
    // a chalk menu board on the side
    S.push(box(0.08, 1.1, 0.8, x + 2.3, 1.5, z + 0.6, '#2a2a30'), box(0.09, 0.08, 0.5, x + 2.32, 1.75, z + 0.6, '#fff6ec'), box(0.09, 0.06, 0.4, x + 2.32, 1.5, z + 0.6, '#ffd447'), box(0.09, 0.06, 0.45, x + 2.32, 1.3, z + 0.6, '#ff8fc4'));
  }
  // the rental stand: a striped booth, a stack of loungers, a rack of surfboards
  {
    const { x, z } = B.rental;
    S.push(box(2.2, 2.0, 2.0, x, 1.0, z, '#fff0b3'), box(2.4, 0.12, 2.3, x, 2.06, z, '#ff4fa3'));
    for (let i = 0; i < 6; i++) S.push(box(0.4, 0.06, 0.9, x - 1.0 + i * 0.4, 2.0, z + 1.4, i % 2 ? '#ffffff' : '#ff4fa3', -0.35));
    S.push(box(1.4, 0.5, 0.06, x, 2.45, z + 1.02, '#19c9bd'), box(1.2, 0.22, 0.02, x, 2.45, z + 1.06, '#fff6ec'));
    for (let i = 0; i < 5; i++) S.push(box(0.7, 0.07, 1.9, x + 3.4, 0.12 + i * 0.16, z, '#ffffff'), box(0.72, 0.03, 1.92, x + 3.4, 0.17 + i * 0.16, z, i % 2 ? '#27d8cf' : '#ffd447'));
    S.push(box(2.3, 0.08, 0.08, x - 3.2, 1.0, z, '#7a5236'), box(0.08, 1.1, 0.4, x - 4.3, 0.55, z, '#7a5236'), box(0.08, 1.1, 0.4, x - 2.1, 0.55, z, '#7a5236'));
    ['#ff6a3d', '#27d8cf', '#ffd447', '#9b7bff'].forEach((c, i) => S.push(box(0.46, 2.2, 0.07, x - 4.0 + i * 0.52, 1.1, z + 0.12, c, 0.12), box(0.08, 2.2, 0.075, x - 4.0 + i * 0.52, 1.1, z + 0.12, CREAM, 0.12)));
  }
  // rental cluster signs: a post with a board in the cluster's colour
  const seen = new Set();
  for (const u of B.umbrellas) if (!seen.has(u.cluster)) { seen.add(u.cluster); const x = u.x - 3.2, z = u.z - 2.6; S.push(box(0.1, 1.6, 0.1, x, 0.8, z, WOOD), box(0.9, 0.5, 0.06, x, 1.55, z, u.color), box(0.7, 0.12, 0.02, x, 1.6, z + 0.035, CREAM)); }
  // beach showers on a slatted platform
  for (const [x, z] of B.showers) {
    for (let i = 0; i < 5; i++) S.push(box(1.3, 0.06, 0.2, x, 0.05, z - 0.5 + i * 0.25, WOOD));
    S.push(cyl(0.06, 0.06, 2.4, 6, x, 1.2, z - 0.4, '#c9d6e0'), box(0.06, 0.06, 0.45, x, 2.38, z - 0.2, '#c9d6e0'), cyl(0.13, 0.05, 0.08, 8, x, 2.32, z, '#c9d6e0'), box(0.14, 0.1, 0.06, x, 1.2, z - 0.36, '#ff4f6a'));
  }
  // trash and recycling bins in pairs
  for (const [x, z] of B.bins) {
    S.push(box(0.52, 0.85, 0.52, x - 0.3, 0.43, z, '#2f6fb0'), box(0.56, 0.08, 0.56, x - 0.3, 0.89, z, '#244f80'), box(0.52, 0.85, 0.52, x + 0.3, 0.43, z, '#3a9a5a'), box(0.56, 0.08, 0.56, x + 0.3, 0.89, z, '#2a7444'));
    S.push(box(0.22, 0.16, 0.02, x - 0.3, 0.6, z + 0.27, CREAM), box(0.22, 0.16, 0.02, x + 0.3, 0.6, z + 0.27, CREAM));
  }
  // the fire pit: a ring of stones, crossed logs, ash; driftwood logs to sit on round it
  {
    const { x, z } = B.fire;
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; S.push(box(0.36, 0.26, 0.3, x + Math.cos(a) * 0.78, 0.13, z + Math.sin(a) * 0.78, i % 2 ? '#8a8490' : '#a8a0a8', 0, -a)); }
    S.push(cyl(0.66, 0.66, 0.04, 12, x, 0.02, z, '#3a3034'));
    for (const a of [0.3, 1.9, 3.4]) S.push(box(0.12, 0.12, 0.9, x, 0.12, z, '#5a3a24', 0.25, a));
    for (const [dx, dz] of [[0, -2.3], [2.3, 0], [0, 2.3], [-2.3, 0]]) S.push(cyl(0.2, 0.2, 1.7, 8, x + dx, 0.2, z + dz, '#8a6a4a', dz ? 0 : PI / 2, dz ? PI / 2 : 0));
  }
  // sandcastles: a keep, four towers with cone tops, a pink flag; a bucket and spade next to them
  for (const [x, z] of B.castles) {
    S.push(box(0.8, 0.26, 0.8, x, 0.13, z, SANDC), box(0.36, 0.28, 0.36, x, 0.4, z, SANDC));
    for (const [ox, oz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) S.push(cyl(0.13, 0.15, 0.34, 7, x + ox, 0.17, z + oz, SANDC), tint(new THREE.ConeGeometry(0.14, 0.18, 7).translate(x + ox, 0.43, z + oz), '#d6b67a'));
    S.push(box(0.02, 0.3, 0.02, x, 0.68, z, '#ffffff'), box(0.16, 0.1, 0.01, x + 0.08, 0.78, z, '#ff4fa3'), cyl(0.12, 0.09, 0.2, 8, x + 0.75, 0.1, z + 0.2, '#ff5fa8'), box(0.06, 0.02, 0.32, x + 0.6, 0.02, z - 0.3, '#27d8cf', 0, 0.6));
  }
  // kayaks and paddleboards drawn up at the waterline, a paddle beside them
  for (const [x, z, yaw, kind, c] of B.kayaks) {
    if (kind === 'kayak') {
      const h = new THREE.BoxGeometry(0.72, 0.32, 3.2, 1, 1, 4), p = h.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 - Math.pow(Math.abs(p.getZ(i)) / 1.6, 2) * 0.85; p.setX(i, p.getX(i) * k); if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.75); }
      h.computeVertexNormals(); h.rotateY(yaw); h.translate(x, 0.16, z); S.push(tint(h, c), box(0.4, 0.06, 0.8, x, 0.33, z, '#22203a', 0, yaw));
    } else S.push(box(0.76, 0.09, 3.0, x, 0.05, z, c, 0, yaw), box(0.5, 0.095, 0.9, x, 0.06, z, CREAM, 0, yaw));
    S.push(box(0.05, 0.05, 2.0, x + 0.62, 0.03, z, '#3a3550', 0, yaw + 0.1), box(0.18, 0.02, 0.4, x + 0.62 + Math.sin(yaw + 0.1), 0.03, z + 0.95, c, 0, yaw + 0.1));
  }
  // surfboards stuck in the sand
  for (const [x, z] of B.boards) { const c = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d'][Math.floor(Math.abs(x * 3)) % 5]; S.push(box(0.5, 2.3, 0.08, x, 1.05, z, c, 0.12 * (r() - 0.5), r() * 3, 0.08), box(0.09, 2.3, 0.09, x, 1.05, z, CREAM, 0, 0, 0.08)); }
  // towels with a bag, flip-flops and now and then a book
  for (const t of B.towels) {
    const s = Math.sin(t.yaw), c = Math.cos(t.yaw);
    S.push(box(0.95, 0.025, 1.85, t.x, 0.015, t.z, t.c, 0, t.yaw), box(0.95, 0.027, 0.3, t.x, 0.016, t.z, '#ffffff', 0, t.yaw));
    S.push(box(0.4, 0.28, 0.2, t.x + c * 0.8 + s * -0.6, 0.14, t.z - s * 0.8 + c * -0.6, ['#22203a', '#ff8a4c', '#2f8f86'][Math.floor(t.x) & 1 ? 1 : 0], 0, t.yaw + 0.3));
    for (const o of [-0.08, 0.08]) S.push(box(0.1, 0.03, 0.26, t.x + c * (0.7 + o) + s * 1.05, 0.015, t.z - s * (0.7 + o) + c * 1.05, '#ff4fa3', 0, t.yaw));
  }
  // dune grass tufts: three bent blades each
  for (const [x, z, h, a] of B.tufts) for (let k = 0; k < 3; k++) S.push(box(0.05, h, 0.025, x + Math.cos(a + k * 2.1) * 0.08, h / 2 - 0.02, z + Math.sin(a + k * 2.1) * 0.08, k % 2 ? '#9fb86a' : '#c9c27a', Math.cos(a + k * 2.1) * 0.3, a + k * 2.1, Math.sin(a + k * 2.1) * 0.3));
  for (const [x, z, a, c] of B.shells) S.push(box(0.13, 0.04, 0.1, x, 0.02, z, c, 0, a));
  for (const [x, z, len, yaw] of B.wood) S.push(cyl(0.09, 0.12, len, 6, x, 0.08, z, '#a89074', PI / 2, 0), box(0.04, 0.04, 0.5, x + Math.cos(yaw) * 0.3, 0.1, z, '#9a8064', 0.2, yaw + 0.8));
}

// ---- the fire pit's flames: crossed quads animated in the shader, at night only (one draw call) ---------------
export function createBeachFx(scene, B) {
  const g = [];
  for (let k = 0; k < 3; k++) {
    const q = new THREE.PlaneGeometry(0.9, 1.25, 1, 2).translate(0, 0.62, 0).rotateY(k * PI / 3);
    g.push(q);
  }
  const geo = new THREE.BufferGeometry();
  const parts = g.map((q) => q.toNonIndexed());
  const n = parts.reduce((a, q) => a + q.attributes.position.count, 0), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const q of parts) { pos.set(q.attributes.position.array, o * 3); uv.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const U = { uT: timeU, uK: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'uniform float uT; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.x += sin(uT * 7.0 + p.y * 5.0) * 0.06 * p.y; p.z += cos(uT * 6.0 + p.y * 4.0) * 0.05 * p.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform float uT, uK; varying vec2 vUv; void main(){ float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y; float w = (1.0 - y) * (0.75 + 0.25 * sin(uT * 11.0 + y * 9.0)); float a = smoothstep(w, w - 0.35, x) * smoothstep(1.0, 0.55, y); vec3 c = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.3, 0.05), y); gl_FragColor = vec4(c * a * uK * 1.4, 1.0); }',
  });
  const fire = new THREE.Mesh(geo, mat);
  fire.position.set(B.fire.x, 0.1, B.fire.z);
  fire.frustumCulled = false; fire.visible = false; fire.renderOrder = 4;
  scene.add(fire);
  return {
    mesh: fire,
    get lit() { return fire.visible; },
    tick(rain) {
      const k = Math.max(0, Math.min(1, (nightU.value - 0.35) * 2.5)) * (1 - Math.min(1, rain * 1.5));
      U.uK.value = k;
      fire.visible = k > 0.02;
    },
  };
}
