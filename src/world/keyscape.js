// Solano Key's street level: the key is the dense, high-rise side of the coast (glass towers, offices and
// apartment blocks round the Sunbowl, Halcyon Avenue's hotels and the galleria), so its dressing is the
// downtown kind, not the old town's alleys: lobby canopies with a revolving door, a doorman's stand, planter
// boxes and flags; ground-floor shops behind deep sign bands (invented names on their own painted atlas);
// metro entrances with railings and globe lamps; newsstands and food carts; steam rising from utility covers;
// a sidewalk shed with scaffolding up one building; water towers on the roofs; ornate lamp posts, street
// clocks, mailboxes, fire hydrants, taxi stands, bike-share docks; a pocket park; loading bays with roller
// shutters on side walls; and, where they suit, bus shelters, café terraces, bike racks, planters, phone
// booths and newspaper boxes. Plus street trees of several species along every street (world/streettrees.js).
//
// Everything is merged into the key's solid / neon meshes (no extra draw calls) except the shop fascias (one
// atlas mesh) and the steam (one points mesh). Every spot is checked against the carriageways and junctions,
// the stadium and its approaches, the car park, the park, the stunt ramps with their run-ups and landings,
// the marina and the docks, doors, venue rings, parking slots and what already stands there; what stands on
// the ground is registered as a footprint (layout.js FOOTPRINTS / FOOTBOXES) for the road checks.
import * as THREE from 'three';
import { tint, rng, PI, timeU, pointScaleU, fogU, FOG_PARS } from '../core/util.js';
import { onRoad, inJunction, footprint, footBox, FOOTPRINTS } from './layout.js';
import { KEY, KH, KV, KV_W, inKey } from './key.js';
import { quad, shopCell, SHOP_C } from './streetscape.js';
import { pickSpecies, TRUNK } from './streettrees.js';
import { quality } from '../core/quality.js';

// ground-floor shops (all invented). `c`: food, may put tables out
export const KEY_SHOPS = [
  { n: 'Skyline Deli', c: 1 }, { n: 'Halcyon Hardware' }, { n: 'Uptown Optics' }, { n: 'Corner Bodega 24' },
  { n: 'Glasswater Bagels', c: 1 }, { n: 'Lucky Star Laundry' }, { n: 'Penthouse Pizza', c: 1 }, { n: 'Fifth Floor Fitness' },
  { n: 'Bluebird Books' }, { n: 'Midtown Shoe Repair' }, { n: 'Solano Savings' }, { n: 'Nightowl Diner', c: 1 },
  { n: 'Highrise Hats' }, { n: 'Metro Florist' }, { n: 'Copper Kettle Café', c: 1 }, { n: 'Silver Screen Video' },
  { n: 'Avenue Electronics' }, { n: 'Golden Wok', c: 1 }, { n: 'Steam & Bean', c: 1 }, { n: 'Marina Tailors' },
  { n: 'Starlight Jewelers' }, { n: 'Express Copy & Print' }, { n: 'Neon Noodle Bar', c: 1 }, { n: 'Atlas Travel' },
];
const INK = '#1d1630', CREAM = '#fbf7f0', STEEL = '#b9bcc8', DARK = '#3b3350', BRASS = '#d9b45a', IRON = '#2b2440';
// street-tree mixes per street: a dominant species and some variety ('kit' is the Kenney tree)
const MIX = {
  'Halcyon Avenue': [['royal', 0.6], ['fan', 0.25], ['coconut', 0.15]],
  'Stadium Way': [['royal', 0.5], ['fan', 0.3], ['cypress', 0.2]],
  'Glasswater Street': [['ficus', 0.55], ['cypress', 0.3], ['jacaranda', 0.15]],
  'Marina Street': [['jacaranda', 0.5], ['ficus', 0.25], ['seagrape', 0.25]],
  'Dockside Road': [['seagrape', 0.45], ['coconut', 0.35], ['fan', 0.2]],
  'Mango Grove': [['kit', 0.4], ['jacaranda', 0.3], ['ficus', 0.3]],
};

export function addKeyscape(ctx) {
  const { L, K, S, N, glows, quads, P, bx, ww, sign, kit } = ctx;
  const r = rng(2468), stats = {};
  const count = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };
  const cyl = (rt, rb, h, seg, x, y, z, hex, rx = 0, rz = 0, ry = 0) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return ww(tint(g, hex)); };
  const ball = (rad, x, y, z, hex) => tint(new THREE.SphereGeometry(rad, 8, 6).translate(x, y, z), hex);
  const neonBox = (w, h, d, x, y, z, hex, ry = 0) => { const g = bx(w, h, d, x, y, z, hex, 0, 0, ry); g.deleteAttribute('aWin'); return g; };
  // a local frame: (lx along the item's width, lz forward) to world, for an item at (x, z) facing yaw
  const at = (x, z, yaw) => { const s = Math.sin(yaw), c = Math.cos(yaw); return (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz]; };
  const quarter = (yaw) => Math.abs(Math.sin(yaw)) > 0.5;          // the box collider's turn (props round to quarter turns)

  // ---- what to keep clear of
  const used = [];
  const mark = (x, z, rr) => used.push([x, z, rr]);
  for (const o of P.cols) if (!(o.y0 > 0.5)) { if (o.c) mark(o.x, o.z, o.r); else mark((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, Math.max(o.x1 - o.x0, o.z1 - o.z0) / 2); }
  for (const f of FOOTPRINTS) if (f.x < KEY.x1 + 2) mark(f.x, f.z, f.r);
  for (const l of K.lamps) mark(l.x, l.z, 0.6);
  for (const p of K.palms) mark(p.x, p.z, 0.9);
  for (const t of K.trees) mark(t.x, t.z, 1.2);
  for (const b of K.benches) mark(b.x, b.z, 1.2);
  for (const k of ['places', 'venues']) for (const id in L[k] || {}) { const v = L[k][id]; if (v.x < KEY.x1 + 2) mark(v.x, v.z, 4.5); }
  for (const b of K.buildings) if (b.door && b.door.out) mark(b.door.out.x, b.door.out.z, 2.2);
  for (const p of K.parking) mark(p.x, p.z, p.lot ? 3.6 : 3.2);
  const st = K.stadium, cp = K.carpark, pk = K.park;
  const ZONES = [
    { x0: st.x0 - 9, x1: st.x1 + 9, z0: st.z0 - 9, z1: st.z1 + 9 },            // the Sunbowl, its concourse and approaches
    { x0: cp.x0 - 4, x1: cp.x1 + 4, z0: cp.z0 - 4, z1: cp.z1 + 4 },            // the car park
    { x0: pk.x0 - 2, x1: pk.x1 + 2, z0: pk.z0 - 2, z1: pk.z1 + 2 },            // Fernwood Park and its hedges
    { x0: -872, x1: -708, z0: 103, z1: 152 },                                   // the marina boardwalk
    { x0: KEY.x0, x1: -888, z0: 64, z1: KEY.z1 },                               // the docks
    { x0: -502, x1: KEY.x1 + 2, z0: 34, z1: 72 },                               // the causeway landing and its gate
    { x0: -799, x1: -781, z0: 62, z1: 104 },                                    // the way down to the marina pier
  ];
  for (const rp of K.ramps) {
    const dx = Math.sin(rp.yaw), dz = Math.cos(rp.yaw), ax = Math.abs(dx) > 0.5, hl = rp.len / 2 + 3, hw = (rp.w2 || rp.w) / 2 + 3;
    const box = (cx, cz, l, w) => ZONES.push(ax ? { x0: cx - l, x1: cx + l, z0: cz - w, z1: cz + w } : { x0: cx - w, x1: cx + w, z0: cz - l, z1: cz + l });
    box(rp.x, rp.z, hl, hw); box(rp.x - dx * (rp.len / 2 + 24), rp.z - dz * (rp.len / 2 + 24), 24, hw);
    if (rp.land) ZONES.push({ x0: rp.land.x0 - 3, x1: rp.land.x1 + 3, z0: rp.land.z0 - 3, z1: rp.land.z1 + 3 });
    for (const k of ['deck', 'deck2', 'down']) if (rp[k]) ZONES.push({ x0: rp.x - hw, x1: rp.x + hw, z0: rp[k].z0 - 3, z1: rp[k].z1 + 3 });
  }
  const inZone = (x, z, rr) => ZONES.some((q) => x > q.x0 - rr && x < q.x1 + rr && z > q.z0 - rr && z < q.z1 + rr);
  const city = (x, z) => x > -888;                                            // the downtown kind of dressing: not in Mango Grove or the docks
  const inSolid = (x, z, m) => L.solids.some((q) => x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m);
  const free = (x, z, rr, rs = Math.min(rr, 0.4)) => inKey(x, z, -3) && !onRoad(x, z, rr + 0.1) && !inJunction(x, z, rr + 0.6) && !inZone(x, z, rr)
    && used.every(([a, c, d]) => Math.hypot(a - x, c - z) > d + rr + 0.25) && !inSolid(x, z, rs);
  // a rectangle (in the item's frame) is free: its centre and corners
  const freeRect = (x, z, yaw, w, d, m = 0.2) => {
    const f = at(x, z, yaw);
    if (!free(x, z, Math.min(w, d) / 2)) return false;
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2], [-w / 2, 0], [w / 2, 0]]) {
      const [px, pz] = f(lx, lz);
      if (onRoad(px, pz, m) || inJunction(px, pz, m) || inZone(px, pz, m) || inSolid(px, pz, 0.1) || !inKey(px, pz, -2)) return false;
    }
    const R = Math.hypot(w, d) / 2;
    return used.every(([a, c, dd]) => Math.hypot(a - x, c - z) > dd + R * 0.8 + 0.2);
  };
  const regRect = (what, x, z, yaw, w, d) => {
    const q = quarter(yaw), W = q ? d : w, D = q ? w : d;
    footBox(what, x - W / 2, x + W / 2, z - D / 2, z + D / 2); mark(x, z, Math.hypot(w, d) / 2);
  };

  // ---- the sidewalks: every long side of every street, its kerb line and how deep the pavement is
  const SIDES = [];
  for (const h of KH) for (const sg of [-1, 1]) SIDES.push({ name: h.name, ax: 'x', fixed: h.z + sg * h.hw, n: [0, sg], a0: h.x0 + 4, a1: h.x1 - 4 });
  for (const v of KV) for (const sg of [-1, 1]) SIDES.push({ name: v.name, ax: 'z', fixed: v.x + sg * KV_W / 2, n: [sg, 0], a0: v.z0 + 2, a1: v.z1 - 2 });
  const pt = (sd, a, off) => (sd.ax === 'x' ? [a, sd.fixed + sd.n[1] * off] : [sd.fixed + sd.n[0] * off, a]);
  const yawIn = (sd) => Math.atan2(sd.n[0], sd.n[1]);                         // facing from the road into the sidewalk
  const depth = (sd, a) => {
    for (let o = 0.5; o < 24; o += 0.5) { const [x, z] = pt(sd, a, o); if (!inKey(x, z, -1) || onRoad(x, z, 0) || inSolid(x, z, 0)) return o - 0.5; }
    return 24;
  };
  // walk every side at `step` m (a seeded start), calling fn(sd, a, x, z) for kerb spots `off` m from the road edge
  const walk = (step, off, fn, filter = () => true) => {
    for (const sd of SIDES) {
      if (!filter(sd)) continue;
      for (let a = sd.a0 + r() * step; a < sd.a1; a += step) { const [x, z] = pt(sd, a, off); fn(sd, a, x, z); }
    }
  };

  // ================================================================ lobbies, shops, flags (on the buildings)
  const front = (b) => { const o = b.door.out; return o.yaw === 0 ? [0, 1] : o.yaw === PI ? [0, -1] : o.yaw > 0 ? [1, 0] : [-1, 0]; };
  const faceOf = (b, fx, fz) => {
    const ext = b.style === 'tower' ? 0.6 : b.style === 'apart' ? 0.3 : 0;   // the tower's lobby podium, the apartments' plinth
    const along = fx ? b.d : b.w, cx = b.cx + fx * (b.w / 2 + ext), cz = b.cz + fz * (b.d / 2 + ext), yaw = Math.atan2(fx, fz);
    // how deep is the pavement in front of the middle of this face
    let sd = 0;
    for (let o = 0.5; o < 24; o += 0.5) { const x = cx + fx * o, z = cz + fz * o; if (!inKey(x, z, -1) || onRoad(x, z, 0) || inSolid(x, z, 0)) break; sd = o; }
    return { fx, fz, cx, cz, along, yaw, sd, p: (o, out) => [cx + fz * o + fx * out, cz - fx * o + fz * out] };
  };
  const SIDESN = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let shop = 0;
  const shopOrder = KEY_SHOPS.map((s, i) => i).sort(() => r() - 0.5);
  const lobbies = [];
  for (const b of K.buildings) {
    if (!['tower', 'office', 'apart'].includes(b.style) || !city(b.cx, b.cz) || b.district === 'marina' && b.style !== 'apart') continue;
    const [dfx, dfz] = front(b), F = faceOf(b, dfx, dfz);
    // --- the lobby on the street face: canopy on two brass posts, a revolving door, a doorman's stand,
    // planter boxes either side and two flags over the canopy
    if (F.sd >= 6.5 && F.along >= 16) {
      const cw = b.style === 'apart' ? 4.6 : 6.4, cd = b.style === 'apart' ? 2.6 : 3.4, [px, pz] = F.p(0, cd / 2);
      const posts = [F.p(-cw / 2 + 0.3, cd - 0.25), F.p(cw / 2 - 0.3, cd - 0.25)];
      if (posts.every(([x, z]) => !onRoad(x, z, 0.6) && !inJunction(x, z, 0.3))) {
        S.push(bx(cw, 0.28, cd, px, 3.7, pz, b.style === 'tower' ? '#22324a' : b.accent, 0, 0, F.yaw));
        N.push(neonBox(cw + 0.06, 0.08, 0.08, ...F.p(0, cd + 0.02).slice(0, 1), 3.6, F.p(0, cd + 0.02)[1], b.neon || '#18f0ff', F.yaw));
        for (const [x, z] of posts) { S.push(cyl(0.07, 0.07, 3.6, 6, x, 1.8, z, BRASS)); P.circle(x, z, 0.1, 3.7); footprint('lobby canopy post', x, z, 0.1); mark(x, z, 0.4); }
        // the revolving door: a glass drum with four leaves, a brass top
        const [dx, dz] = F.p(0, 0.75);
        S.push(cyl(1.05, 1.05, 2.6, 12, dx, 1.3, dz, '#9fd0e4'), cyl(1.12, 1.12, 0.22, 12, dx, 2.71, dz, BRASS), cyl(1.12, 1.12, 0.08, 12, dx, 0.04, dz, BRASS));
        for (let k = 0; k < 2; k++) S.push(bx(2.0, 2.4, 0.05, dx, 1.25, dz, '#cfe8f4', 0, F.yaw + PI / 4 + k * PI / 2));
        P.circle(dx, dz, 1.05, 2.7); footprint('revolving door', dx, dz, 1.05);
        glows.push([dx + F.fx * 1.2, 3.2, dz + F.fz * 1.2, '#fff0c8', 5, 0]);
        // the doorman's stand (a lectern with a lamp), to one side under the canopy
        const [sx, sz] = F.p(cw / 2 - 1.2, 1.4);
        S.push(bx(0.6, 1.1, 0.45, sx, 0.55, sz, '#5a3a2a', 0, 0, F.yaw), bx(0.7, 0.06, 0.55, sx, 1.13, sz, BRASS, 0, 0.25, F.yaw));
        N.push(neonBox(0.12, 0.12, 0.12, sx, 1.3, sz, '#ffe7b0'));
        P.circle(sx, sz, 0.35, 1.2); footprint('doorman stand', sx, sz, 0.35);
        // planter boxes either side of the canopy, against the wall
        for (const sg of [-1, 1]) {
          const [qx, qz] = F.p(sg * (cw / 2 + 1.4), 0.55);
          if (onRoad(qx, qz, 0.8)) continue;
          S.push(bx(2.0, 0.7, 0.8, qx, 0.35, qz, '#3b3350', 0, 0, F.yaw), bx(1.9, 0.06, 0.7, qx, 0.69, qz, '#4a3626', 0, 0, F.yaw));
          for (let k = -1; k <= 1; k++) { const [lx, lz] = F.p(sg * (cw / 2 + 1.4) + k * 0.6, 0.55); S.push(ww(tint(new THREE.IcosahedronGeometry(0.34, 0).translate(lx, 0.98, lz), k ? '#2f8f4f' : '#3fae6a'))); }
          P.box(qx, qz, quarter(F.yaw) ? 0.8 : 2.0, quarter(F.yaw) ? 2.0 : 0.8, 0.75); footprint('lobby planter', qx, qz, 0.4);
        }
        // flags on poles out of the wall over the canopy
        for (const sg of [-1, 1]) {
          const [fx0, fz0] = F.p(sg * (cw / 2 + 0.4), 0.05), out = 2.2, y0 = 5.4, [fx1, fz1] = F.p(sg * (cw / 2 + 0.4), out);
          const g = new THREE.CylinderGeometry(0.04, 0.04, out * 1.42, 5); g.rotateX(PI / 2); g.rotateX(-PI / 4); g.rotateY(F.yaw);
          g.translate((fx0 + fx1) / 2, y0 + out / 2, (fz0 + fz1) / 2); S.push(ww(tint(g, STEEL)));
          const fl = bx(0.04, 1.1, 1.5, fx1 - F.fx * 0.75, y0 + out - 0.55, fz1 - F.fz * 0.75, sg > 0 ? b.accent : '#f6f1e7', 0, 0, F.yaw);
          S.push(fl);
        }
        lobbies.push({ b, F, cw });
        count('lobby');
      }
    }
    // --- ground-floor shops with deep sign bands on every face that looks at a street
    for (const [fx, fz] of SIDESN) {
      const G = faceOf(b, fx, fz);
      if (G.sd < 4 || G.along < 14) continue;
      const lob = lobbies.find((q) => q.b === b && q.F.fx === fx && q.F.fz === fz), gap = lob ? lob.cw / 2 + 2.8 : 0;
      const segs = lob ? [[-G.along / 2 + 1.2, -gap], [gap, G.along / 2 - 1.2]] : [[-G.along / 2 + 1.2, G.along / 2 - 1.2]];
      for (const [a0, a1] of segs) {
        const len = a1 - a0;
        if (len < 6) continue;
        const n = Math.max(1, Math.round(len / 10)), sl = len / n;
        for (let k = 0; k < n; k++) {
          const o = a0 + (k + 0.5) * sl, si = shopOrder[shop++ % shopOrder.length], c = SHOP_C[si % SHOP_C.length];
          const [gx, gz] = G.p(o, 0.08), [sx, sz] = G.p(o, 0.35), [qx, qz] = G.p(o, 0.62);
          S.push(bx(sl - 0.5, 2.9, 0.12, gx, 1.55, gz, '#2c5f7a', 0, 0, G.yaw));                     // the shop window
          S.push(bx(0.24, 3.4, 0.3, ...G.p(o - sl / 2 + 0.1, 0.15).slice(0, 1), 1.7, G.p(o - sl / 2 + 0.1, 0.15)[1], CREAM, 0, 0, G.yaw));
          S.push(bx(sl - 0.1, 1.15, 0.55, sx, 3.75, sz, k % 2 ? INK : '#2a1840', 0, 0, G.yaw));   // the deep sign band
          const fw = Math.min(sl - 1.2, 6.4), fh = fw / 6.1;
          quad(quads, shopCell(si), qx, 3.75, qz, G.yaw, fw, Math.min(fh, 1.0), 1);
          N.push(neonBox(sl - 0.1, 0.06, 0.06, ...G.p(o, 0.64).slice(0, 1), 3.16, G.p(o, 0.64)[1], c, G.yaw));
          glows.push([...G.p(o, 1.2).slice(0, 1), 3.4, G.p(o, 1.2)[1], c, Math.min(sl, 8) * 0.8, 0]);
          b.shops = (b.shops || 0) + 1; count('shop');
          if (KEY_SHOPS[si].c && G.sd >= 7.5) (b.cafes = b.cafes || []).push({ G, o });
        }
      }
    }
  }

  // ================================================================ street furniture
  const kerbFilter = (sd) => true;
  // --- fire hydrants (loose bodies, bolted down by a static circle until a fast vehicle shears them off)
  const hydrant = (x, z) => {
    if (!free(x, z, 0.35)) return false;
    const c = P.circle(x, z, 0.24, 0.75); c.tag = 'hydrant';
    const d = { kind: 'hydrant', hx: x, hz: z, yaw: 0, r: 0.24, seats: [] };
    L.loose.push(d); c.hyd = d; mark(x, z, 0.4); count('hydrant');
    return true;
  };
  walk(68, 0.75, (sd, a, x, z) => hydrant(x, z), (sd) => sd.name !== 'Mango Grove');

  // --- street trees in pits along every street: each street its own mix
  const tree = (sd, x, z) => {
    if (!free(x, z, 0.9)) return false;
    const sp = pickSpecies(MIX[sd.name] || MIX['Halcyon Avenue'], r), s = 0.85 + r() * 0.3, yaw = r() * 6.28;
    if (sp === 'kit') S.push(kit(r() < 0.5 ? 'treeS' : 'treeL', { scale: 5.2 * s, yaw, x, z, recolor: (rr, gg) => (gg > 200 && rr < 170 ? '#4fbf78' : null) }));
    else L.treeInstances.push({ x, z, sp, s, yaw });
    S.push(bx(1.36, 0.05, 1.36, x, 0.025, z, '#5a5468'), bx(1.2, 0.03, 1.2, x, 0.055, z, '#4a3626'));
    P.circle(x, z, TRUNK[sp] || 0.3, 6).tag = 'tree'; footprint('street tree', x, z, 0.65); mark(x, z, 1.3); count('tree'); count('tree:' + sp);
    return true;
  };
  walk(17, 1.05, (sd, a, x, z) => tree(sd, x, z), (sd) => sd.name !== 'Halcyon Avenue' || true);

  // --- ornate lamp posts: a fluted iron post, a crossarm and two globes
  const ornate = (x, z) => {
    S.push(cyl(0.2, 0.26, 0.5, 8, x, 0.25, z, IRON), cyl(0.07, 0.11, 3.6, 8, x, 2.3, z, IRON), bx(1.3, 0.08, 0.08, x, 4.05, z, IRON), cyl(0.12, 0.12, 0.25, 8, x, 4.2, z, IRON));
    for (const o of [-0.62, 0.62]) { N.push(ball(0.22, x + o, 4.35, z, '#fff3d6')); glows.push([x + o, 4.35, z, '#ffe7b0', 3.4, 0]); }
    P.circle(x, z, 0.22, 4.4); footprint('ornate lamp', x, z, 0.22); mark(x, z, 0.6); count('ornateLamp');
  };
  // --- street clocks: a column with a two-faced clock on top
  const clock = (x, z, yaw) => {
    if (!free(x, z, 0.5)) return false;
    S.push(cyl(0.25, 0.3, 0.6, 8, x, 0.3, z, IRON), cyl(0.09, 0.12, 3.4, 8, x, 2.2, z, IRON), cyl(0.48, 0.48, 0.3, 14, x, 4.3, z, IRON, PI / 2, 0, yaw));
    for (const sg of [-1, 1]) {
      const [cx, cz] = at(x, z, yaw)(0, sg * 0.16);
      S.push(cyl(0.4, 0.4, 0.02, 14, cx, 4.3, cz, '#fffaf0', PI / 2, 0, yaw));
      const [hx, hz] = at(x, z, yaw)(0, sg * 0.18);
      S.push(bx(0.04, 0.26, 0.02, hx, 4.4, hz, INK, 0, 0, yaw), bx(0.2, 0.035, 0.02, hx + Math.cos(yaw) * 0.08, 4.3, hz - Math.sin(yaw) * 0.08, INK, 0, 0, yaw));
    }
    glows.push([x, 4.3, z, '#fff6e0', 2.4, 0]);
    P.circle(x, z, 0.3, 4.6); footprint('street clock', x, z, 0.3); mark(x, z, 0.8); count('clock');
    return true;
  };
  // --- mailboxes: a squat navy box on a pedestal
  const mailbox = (x, z, yaw) => {
    if (!free(x, z, 0.45)) return false;
    S.push(bx(0.55, 0.12, 0.5, x, 0.06, z, DARK, 0, 0, yaw), bx(0.5, 0.95, 0.45, x, 0.6, z, '#2a4f8a', 0, 0, yaw), cyl(0.25, 0.25, 0.5, 10, x, 1.08, z, '#2a4f8a', 0, PI / 2, yaw + PI / 2), bx(0.52, 0.06, 0.47, x, 0.5, z, '#f6f1e7', 0, 0, yaw));
    P.circle(x, z, 0.3, 1.3); footprint('mailbox', x, z, 0.3); mark(x, z, 0.6); count('mailbox');
    return true;
  };
  // --- food carts (generic hot dog / pretzel style): a cart on wheels under a striped umbrella
  const cart = (x, z, yaw) => {
    if (!freeRect(x, z, yaw, 1.9, 1.1)) return false;
    const f = at(x, z, yaw), C = [['#f6f1e7', '#ff4f6a'], ['#ffd447', '#19c9bd'], ['#f6f1e7', '#2a6fd0']][(stats.cart || 0) % 3];
    count('cart');
    S.push(bx(1.8, 0.9, 1.0, x, 0.85, z, C[0], 0, 0, yaw), bx(1.82, 0.22, 1.02, x, 0.5, z, C[1], 0, 0, yaw), bx(1.7, 0.06, 0.9, x, 1.33, z, STEEL, 0, 0, yaw));
    for (const [lx, lz] of [[-0.6, -0.4], [-0.6, 0.4]]) { const [wx, wz] = f(lx, lz); S.push(cyl(0.3, 0.3, 0.08, 10, wx, 0.3, wz, '#22203a', PI / 2, 0, yaw)); }
    { const [lx, lz] = f(0.85, 0); S.push(bx(0.06, 0.6, 0.06, lx, 0.3, lz, STEEL)); }
    { const [hx, hz] = f(1.15, 0); S.push(bx(0.05, 0.05, 0.9, hx, 1.0, hz, STEEL, 0, 0, yaw)); }
    S.push(cyl(0.03, 0.03, 1.6, 5, x, 2.1, z, STEEL), ww(tint(new THREE.ConeGeometry(1.25, 0.5, 8).translate(x, 3.0, z), C[1])), ww(tint(new THREE.ConeGeometry(1.27, 0.12, 8).translate(x, 2.76, z), C[0])));
    P.box(x, z, quarter(yaw) ? 1.1 : 1.9, quarter(yaw) ? 1.9 : 1.1, 1.4); regRect('food cart', x, z, yaw, 1.9, 1.1);
    glows.push([x, 2.4, z, '#ffe2a8', 2.6, 0.05]);
    return true;
  };
  // --- newsstands: a green kiosk, magazines in the front rack, an awning
  const kiosk = (x, z, yaw) => {
    if (!freeRect(x, z, yaw, 2.8, 1.8)) return false;
    const f = at(x, z, yaw);
    S.push(bx(2.6, 2.5, 1.6, x, 1.25, z, '#2f6f5a', 0, 0, yaw), bx(2.9, 0.18, 2.1, ...f(0, 0.2).slice(0, 1), 2.6, f(0, 0.2)[1], '#1f4f40', 0, 0, yaw));
    const [rx0, rz0] = f(0, 0.84);
    S.push(bx(2.3, 1.2, 0.08, rx0, 1.2, rz0, '#22203a', 0, 0, yaw));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const [mx, mz] = f(-0.95 + i * 0.38, 0.9); S.push(bx(0.3, 0.4, 0.03, mx, 0.85 + j * 0.5, mz, ['#ff4fa3', '#ffd447', '#18f0ff', '#f6f1e7', '#ff8a3d', '#8dff5a'][(i + j * 3) % 6], 0, 0, yaw)); }
    const [sx, sz] = f(0, 0.82);
    sign('NEWS', sx, 2.25, sz, yaw, 1.6);
    glows.push([...f(0, 1.4).slice(0, 1), 2.2, f(0, 1.4)[1], '#fff0c8', 3, 0]);
    P.box(x, z, quarter(yaw) ? 1.6 : 2.6, quarter(yaw) ? 2.6 : 1.6, 2.7); regRect('newsstand', x, z, yaw, 2.6, 1.6);
    count('newsstand');
    return true;
  };
  // --- metro entrances: a railed stairwell going down, two globe lamps at the open end, a name board
  const metro = (x, z, yaw, name) => {
    // yaw: the stairs go down towards -z local; the open end (+z) faces along the street
    if (!freeRect(x, z, yaw, 2.6, 5.0, 0.5)) return false;
    const f = at(x, z, yaw);
    S.push(bx(2.2, 0.04, 4.6, x, 0.02, z, '#15131c', 0, 0, yaw));
    for (let k = 0; k < 7; k++) { const [sx, sz] = f(0, 1.9 - k * 0.6); S.push(bx(2.0, 0.03, 0.06, sx, 0.045, sz, '#4a4458', 0, 0, yaw)); }
    for (const sg of [-1, 1]) {
      const [rx0, rz0] = f(sg * 1.15, 0);
      S.push(bx(0.06, 0.06, 4.8, rx0, 1.1, rz0, '#2f6f5a', 0, 0, yaw), bx(0.04, 0.04, 4.8, rx0, 0.6, rz0, '#2f6f5a', 0, 0, yaw), bx(0.18, 0.12, 4.9, rx0, 0.06, rz0, '#8a8f9a', 0, 0, yaw));
      for (let k = 0; k < 5; k++) { const [px, pz] = f(sg * 1.15, -2.3 + k * 1.15); S.push(bx(0.05, 1.1, 0.05, px, 0.55, pz, '#2f6f5a')); }
      // the globe lamps on the posts at the open end
      const [gx, gz] = f(sg * 1.15, 2.4);
      S.push(cyl(0.07, 0.1, 2.4, 6, gx, 1.2, gz, '#2f6f5a'));
      N.push(ball(0.26, gx, 2.62, gz, sg > 0 ? '#8dff9a' : '#fff3d6'));
      glows.push([gx, 2.62, gz, sg > 0 ? '#8dff9a' : '#fff3d6', 3.6, 0]);
    }
    const [bx0, bz0] = f(0, -2.4);
    S.push(bx(2.36, 0.06, 0.06, bx0, 1.1, bz0, '#2f6f5a', 0, 0, yaw), bx(2.36, 0.12, 0.18, bx0, 0.06, bz0, '#8a8f9a', 0, 0, yaw));
    // the name board on two legs at the closed end, facing the open end
    const [nx, nz] = f(0, -2.45);
    for (const o of [-0.9, 0.9]) { const [lx, lz] = f(o, -2.5); S.push(bx(0.06, 1.8, 0.06, lx, 0.9, lz, '#2f6f5a')); }
    sign(name, nx, 2.0, nz, yaw, 2.2);
    P.box(x, z, quarter(yaw) ? 5.0 : 2.5, quarter(yaw) ? 2.5 : 5.0, 1.2); regRect('metro entrance', x, z, yaw, 2.5, 5.0);
    count('metro');
    return true;
  };
  // --- bike-share docks: a rail with five bikes and a pay pillar
  const bikeDock = (x, z, yaw) => {
    // yaw: the bikes point along +z local (into the sidewalk); the rail runs along local x
    if (!freeRect(x, z, yaw, 5.6, 1.9)) return false;
    const f = at(x, z, yaw), C = '#19c9bd';
    { const [rx0, rz0] = f(0, -0.55); S.push(bx(5.0, 0.12, 0.25, rx0, 0.06, rz0, DARK, 0, 0, yaw)); }
    for (let k = 0; k < 5; k++) {
      const lx = -2 + k * 1.0;
      if (k === 3) continue;                                                   // one dock empty
      for (const lz of [-0.55, 0.5]) { const [wx, wz] = f(lx, lz); S.push(cyl(0.32, 0.32, 0.05, 10, wx, 0.33, wz, '#22203a', 0, PI / 2, yaw)); }
      const [mx, mz] = f(lx, 0);
      S.push(bx(0.06, 0.06, 1.0, mx, 0.6, mz, C, 0, 0, yaw), bx(0.06, 0.5, 0.06, mx, 0.6, mz + 0, C), bx(0.25, 0.05, 0.12, ...f(lx, -0.15).slice(0, 1), 0.9, f(lx, -0.15)[1], '#22203a', 0, 0, yaw), bx(0.45, 0.05, 0.05, ...f(lx, 0.45).slice(0, 1), 0.98, f(lx, 0.45)[1], DARK, 0, 0, yaw));
      const [dx, dz] = f(lx, -0.62); S.push(bx(0.12, 0.7, 0.12, dx, 0.35, dz, STEEL));
    }
    const [kx, kz] = f(2.65, -0.4);
    S.push(bx(0.4, 1.7, 0.3, kx, 0.85, kz, C, 0, 0, yaw), bx(0.3, 0.4, 0.04, ...f(2.65, -0.24).slice(0, 1), 1.3, f(2.65, -0.24)[1], '#bff4ff', 0, 0, yaw));
    N.push(neonBox(0.3, 0.06, 0.04, ...f(2.65, -0.23).slice(0, 1), 1.55, f(2.65, -0.23)[1], '#18f0ff', yaw));
    P.box(x, z, quarter(yaw) ? 1.6 : 5.6, quarter(yaw) ? 5.6 : 1.6, 1.1); regRect('bike-share dock', x, z, yaw, 5.6, 1.6);
    count('bikeShare');
    return true;
  };
  // --- utility covers and steam vents (the steam: a points mesh below)
  const vents = [];
  const cover = (x, z, steam) => {
    if (!free(x, z, 0.5)) return false;
    S.push(cyl(0.45, 0.45, 0.03, 12, x, 0.015, z, '#4a4458'), cyl(0.36, 0.36, 0.035, 12, x, 0.02, z, '#5a5468'));
    for (let k = -1; k <= 1; k++) S.push(bx(0.6, 0.04, 0.05, x, 0.03, z + k * 0.14, '#3b3548'));
    if (steam) { vents.push([x, z]); count('steamVent'); } else count('cover');
    mark(x, z, 0.6);
    return true;
  };
  // --- bus shelters, phone booths, bike racks, newspaper boxes, planters (the old town's kinds, the key's colours)
  const shelter = (x, z, yaw) => {
    // yaw: the shelter faces the road along -z local... local +z points into the sidewalk, the open side is -z
    if (!freeRect(x, z, yaw, 3.6, 1.6)) return false;
    const f = at(x, z, yaw);
    for (const lx of [-1.5, 1.5]) { const [px, pz] = f(lx, 0.55); S.push(bx(0.1, 2.5, 0.1, px, 1.25, pz, DARK)); }
    { const [px, pz] = f(0, 0.1); S.push(bx(3.3, 0.12, 1.4, px, 2.55, pz, '#27d8cf', 0, 0, yaw)); }
    { const [px, pz] = f(0, 0.62); S.push(bx(3.0, 1.7, 0.05, px, 1.3, pz, '#bfe6f0', 0, 0, yaw)); }
    { const [px, pz] = f(0, 0.3); S.push(bx(2.4, 0.08, 0.42, px, 0.48, pz, '#ffd447', 0, 0, yaw)); }
    P.box(...f(0, 0.62), quarter(yaw) ? 0.3 : 3.2, quarter(yaw) ? 3.2 : 0.3, 2.6);
    for (const o of [-0.6, 0.6]) { const [px, pz] = f(o, 0.25); P.seat(px, pz, yaw + PI, 0.48, 'bench'); }
    regRect('bus shelter', x, z, yaw, 3.4, 1.5);
    glows.push([x, 2.3, z, '#cfefff', 3.5, 0.02]);
    count('busShelter');
    return true;
  };
  const booth = (x, z) => {
    if (!free(x, z, 0.75)) return false;
    S.push(bx(1.1, 0.2, 1.1, x, 0.1, z, DARK), bx(1.1, 0.35, 1.1, x, 2.5, z, '#ff4fa3'), bx(1.0, 2.2, 0.06, x, 1.25, z - 0.5, '#9fd8e8'),
      bx(0.06, 2.2, 1.0, x - 0.5, 1.25, z, '#9fd8e8'), bx(0.06, 2.2, 1.0, x + 0.5, 1.25, z, '#9fd8e8'), bx(0.3, 0.5, 0.2, x, 1.4, z - 0.36, '#22203a'));
    N.push(neonBox(1.12, 0.1, 1.12, x, 2.72, z, '#18f0ff'));
    glows.push([x, 2.3, z, '#bff4ff', 3.2, 0.05]);
    P.box(x, z, 1.1, 1.1, 2.8); footprint('phone booth', x, z, 0.55); mark(x, z, 1); count('phoneBooth');
    return true;
  };
  const rack = (x, z, yaw) => {
    if (!freeRect(x, z, yaw, 1.8, 0.7)) return false;
    const f = at(x, z, yaw);
    for (let k = 0; k < 4; k++) { const [px, pz] = f(-0.75 + k * 0.5, 0); S.push(bx(0.06, 0.8, 0.56, px, 0.4, pz, STEEL, 0, 0, yaw)); }
    S.push(bx(1.7, 0.05, 0.06, ...f(0, -0.25).slice(0, 1), 0.15, f(0, -0.25)[1], STEEL, 0, 0, yaw));
    P.box(x, z, quarter(yaw) ? 0.6 : 1.7, quarter(yaw) ? 1.7 : 0.6, 0.85); regRect('bike rack', x, z, yaw, 1.7, 0.6); count('bikeRack');
    return true;
  };
  const news = (x, z, yaw) => {
    if (!free(x, z, 0.4)) return false;
    L.loose.push({ kind: 'news', hx: x, hz: z, yaw, r: 0.32, seats: [], color: ['#ff4f6a', '#27c9bf', '#ffd447', '#2a6fd0'][Math.floor(r() * 4)] }); mark(x, z, 0.45); count('newsBox');
    return true;
  };
  const FLOWERS = ['#ff4fa3', '#ffd447', '#ff8a3d', '#b388ff', '#ffffff', '#ff6a8a'];
  const bed = (x, z, yaw, w = 2.6, d = 0.9) => {
    if (!freeRect(x, z, yaw, w, d)) return false;
    S.push(bx(w, 0.55, d, x, 0.275, z, '#d9d4e6', 0, 0, yaw), bx(w + 0.12, 0.08, d + 0.12, x, 0.58, z, '#3b3350', 0, 0, yaw), bx(w - 0.2, 0.05, d - 0.2, x, 0.53, z, '#5a3d2a', 0, 0, yaw));
    P.box(x, z, quarter(yaw) ? d : w, quarter(yaw) ? w : d, 0.6); regRect('planter', x, z, yaw, w, d);
    const f = at(x, z, yaw), n = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) { const [px, pz] = f(-w / 2 + (i + 0.5) * w / n, (r() - 0.5) * 0.15); L.planters.push({ x: px, z: pz, y: 0.55, s: 0.7 + r() * 0.5, yaw: r() * 6.28, c: FLOWERS[Math.floor(r() * FLOWERS.length)], grass: r() < 0.3 }); }
    count('planter');
    return true;
  };
  const taxiStand = (sd, a) => {
    const [x, z] = pt(sd, a, 0.6);
    if (!free(x, z, 0.4)) return false;
    // the stand: a pole with a TAXI board, the kerb painted yellow along the stand
    S.push(cyl(0.05, 0.05, 2.8, 6, x, 1.4, z, STEEL));
    sign('TAXI', x, 2.65, z + 0, yawIn(sd) + PI / 2, 0.8);
    for (let k = -1; k <= 1; k++) { const [kx, kz] = pt(sd, a + k * 2.4, 0.12); S.push(bx(sd.ax === 'x' ? 2.2 : 0.22, 0.02, sd.ax === 'x' ? 0.22 : 2.2, kx, 0.012, kz, '#ffd447')); }
    P.circle(x, z, 0.08, 2.9); footprint('taxi stand pole', x, z, 0.08); mark(x, z, 0.6); count('taxiStand');
    return true;
  };

  // kerb-zone furniture along the downtown streets, in a loose rhythm
  const downtown = (sd) => sd.name !== 'Mango Grove' && sd.name !== 'Dockside Road';
  let kk = 0;
  walk(13, 0.95, (sd, a, x, z) => {
    if (!city(x, z)) return;
    const yaw = yawIn(sd), k = kk++ % 9;
    if (k === 0) mailbox(x, z, yaw);
    else if (k === 2) news(x, z, yaw);
    else if (k === 3) cover(x, z, x > -720);
    else if (k === 5) clock(x, z, yaw + PI / 2);
    else if (k === 6) { const [cx, cz] = pt(sd, a, 1.0); cart(cx, cz, yaw); }
    else if (k === 7) cover(x, z, false);
    else if (k === 8) { const [bx0, bz0] = pt(sd, a, 1.2); rack(bx0, bz0, yaw); }
  }, downtown);
  // bus shelters and phone booths on Halcyon Avenue (the bus route), newspaper boxes by the shelters
  walk(58, 1.25, (sd, a, x, z) => { if (city(x, z) && shelter(x, z, yawIn(sd))) { const [nx, nz] = pt(sd, a + 2.8, 0.6); news(nx, nz, yawIn(sd)); } }, (sd) => sd.name === 'Halcyon Avenue' || sd.name === 'Stadium Way');
  walk(130, 0.9, (sd, a, x, z) => { if (city(x, z)) booth(x, z); }, downtown);
  // bike-share docks at the kerb
  walk(90, 1.2, (sd, a, x, z) => { if (city(x, z) && (stats.bikeShare || 0) < 3) bikeDock(x, z, yawIn(sd)); }, (sd) => sd.name === 'Glasswater Street' || sd.name === 'Halcyon Avenue' || sd.name === 'Marina Street');
  // taxi stands in front of the hotels and the galleria
  for (const b of K.buildings) if (b.hotel || b.style === 'mall') {
    const sd = SIDES.find((q) => q.name === 'Halcyon Avenue' && q.n[1] > 0);
    if (sd) for (let k = 0; k < 6; k++) if (taxiStand(sd, b.cx + (k % 2 ? -1 : 1) * (4 + k * 3))) break;
  }
  // frontage-zone pieces (against the buildings, behind the walking line): metro entrances, newsstands, planters
  const frontage = (n, step, want, fn, filter = downtown) => {
    let placed = 0;
    for (const sd of SIDES) {
      if (!filter(sd)) continue;
      for (let a = sd.a0 + 6 + r() * step; a < sd.a1 - 6 && placed < n; a += step) {
        const dep = depth(sd, a);
        if (dep < want) continue;
        const off = Math.max(4.4 + 0.1, dep - 0.6 - want / 2 + 2.2), [x, z] = pt(sd, a, Math.min(off, dep - 0.6)), yaw = yawIn(sd);
        if (city(x, z) && fn(x, z, yaw, sd, a, dep)) placed++;
      }
    }
    return placed;
  };
  {
    const names = ['Glasswater Station', 'Sunbowl Station', 'Halcyon Station', 'Marina Station'];
    let mi = 0;
    frontage(4, 47, 8.2, (x, z, yaw, sd, a, dep) => {
      const off = Math.min(dep - 1.6, 6.2), [mx, mz] = pt(sd, a, off);
      return metro(mx, mz, yaw + PI / 2, names[mi % names.length]) && ++mi;
    });
    frontage(3, 61, 7.6, (x, z, yaw, sd, a, dep) => { const [kx, kz] = pt(sd, a, Math.min(dep - 1.2, 6.0)); return kiosk(kx, kz, yaw + PI); });
    frontage(10, 29, 6.2, (x, z, yaw, sd, a, dep) => { const [px, pz] = pt(sd, a, dep - 0.75); return bed(px, pz, yaw); });
  }
  // café terraces outside the food shops on the deepest sidewalks
  const table = (x, z, c) => {
    if (!free(x, z, 0.5) || !free(x - 1.07, z, 0.3) || !free(x + 1.07, z, 0.3)) return false;
    L.loose.push({ kind: 'table', hx: x, hz: z, yaw: 0, r: 0.45, seats: [], color: c }); mark(x, z, 0.5);
    for (const sx of [-1, 1]) {
      const ch = { kind: 'chair', hx: x + sx * 1.07, hz: z, yaw: -sx * PI / 2, r: 0.3, seats: [], color: c };
      ch.seats.push(P.seat(x + sx * 0.95, z, -sx * PI / 2, 0.48, 'chair')); L.loose.push(ch); mark(ch.hx, ch.hz, 0.3);
    }
    count('cafeTable');
    return true;
  };
  for (const b of K.buildings) for (const c of b.cafes || []) {
    if ((stats.cafeTable || 0) >= 9) break;
    const col = SHOP_C[(b.cx | 0) % SHOP_C.length];
    if (c.G.fx) continue;                                                      // tables sit in a row along x
    for (const o of [-2.4, 2.4]) { const [x, z] = c.G.p(c.o + o, 1.6); table(x, z, col); }
  }

  // ================================================================ the pocket park by the marina apartments
  {
    const x0 = -812, x1 = -800, z0 = 70.5, z1 = 97;
    const ok = !onRoad(x0, z0, 0.5) && !onRoad(x1, z1, 0.5) && !inSolid((x0 + x1) / 2, (z0 + z1) / 2, 0.5);
    if (ok) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      S.push(bx(x1 - x0, 0.04, z1 - z0, cx, 0.02, cz, '#c8b9a8'), bx(x1 - x0 - 3, 0.05, z1 - z0 - 3, cx, 0.03, cz, '#6cc294'));
      S.push(bx(1.6, 0.06, z1 - z0 - 3, cx, 0.045, cz, '#d8c8b4'));
      // low iron railing round it with gaps at each end
      for (const xx of [x0 + 0.1, x1 - 0.1]) { S.push(bx(0.05, 0.05, z1 - z0 - 4, xx, 0.9, cz, IRON)); for (let z = z0 + 2; z <= z1 - 2; z += 1.2) S.push(bx(0.04, 0.9, 0.04, xx, 0.45, z, IRON)); P.box(xx, cz, 0.15, z1 - z0 - 4, 1); }
      for (const [bxx, bzz, yaw] of [[cx - 2.4, cz - 6, PI / 2], [cx - 2.4, cz + 1, PI / 2], [cx + 2.4, cz - 2.5, -PI / 2], [cx + 2.4, cz + 5, -PI / 2]]) {
        S.push(bx(1.8, 0.1, 0.55, bxx, 0.48, bzz, '#c98a5e', 0, 0, yaw), bx(1.8, 0.5, 0.08, bxx - Math.sin(yaw) * 0.26, 0.8, bzz - Math.cos(yaw) * 0.26, '#c98a5e', 0, 0, yaw), bx(0.08, 0.48, 0.5, bxx, 0.24, bzz, IRON, 0, 0, yaw));
        P.box(bxx, bzz, 0.6, 1.8, 0.9); P.seat(bxx, bzz, yaw, 0.48, 'bench'); mark(bxx, bzz, 1);
      }
      for (const [tx, tz, sp] of [[cx + 3.6, cz - 8, 'ficus'], [cx - 3.6, cz + 7, 'jacaranda'], [cx + 3.4, cz + 9.5, 'seagrape'], [cx - 3.5, cz - 10, 'cypress']]) { L.treeInstances.push({ x: tx, z: tz, sp, s: 0.9 + r() * 0.2 }); P.circle(tx, tz, TRUNK[sp], 6).tag = 'tree'; footprint('pocket park tree', tx, tz, 0.5); mark(tx, tz, 1.2); }
      for (const [lx, lz] of [[cx - 3.8, cz - 3], [cx + 3.8, cz + 2]]) ornate(lx, lz);
      footBox('pocket park', x0, x1, z0, z1);
      ZONES.push({ x0, x1, z0, z1 });
      count('pocketPark');
    }
  }
  // ornate lamps beside the lobbies of the glass towers
  for (const q of lobbies) if (q.b.style === 'tower') for (const sg of [-1, 1]) { const [x, z] = q.F.p(sg * (q.cw / 2 + 3.2), Math.min(q.F.sd - 1.2, 5.0)); if (free(x, z, 0.4)) ornate(x, z); }

  // ================================================================ scaffolding with a sidewalk shed, loading bays, water towers
  {
    let sc = 0;
    for (const b of K.buildings) {
      if (sc >= 2 || !['office', 'apart'].includes(b.style) || !city(b.cx, b.cz)) continue;
      for (const [fx, fz] of SIDESN) {
        const F = faceOf(b, fx, fz), [dfx, dfz] = front(b);
        if (sc >= 2 || F.sd < 7.5 || F.along < 22 || (fx === dfx && fz === dfz)) continue;
        const L2 = Math.min(F.along - 4, 18), D = 2.8, n = Math.round(L2 / 3);
        const okP = []; for (let k = 0; k <= n; k++) okP.push(F.p(-L2 / 2 + k * L2 / n, D));
        if (!okP.every(([x, z]) => free(x, z, 0.2, 0))) continue;
        for (let k = 0; k <= n; k++) {
          const o = -L2 / 2 + k * L2 / n, [x, z] = F.p(o, D), [ix, iz] = F.p(o, 0.35);
          S.push(bx(0.12, 3.2, 0.12, x, 1.6, z, '#8a8f9a'), bx(0.12, 3.2, 0.12, ix, 1.6, iz, '#8a8f9a'));
          P.circle(x, z, 0.1, 3.3); footprint('sidewalk shed post', x, z, 0.1); mark(x, z, 0.3);
          // scaffold up three floors: standards and ledgers against the wall, planks every floor
          const [sx, sz] = F.p(o, 0.9);
          S.push(bx(0.07, 10, 0.07, sx, 8.3, sz, '#9aa2ad'));
        }
        const [cx, cz] = F.p(0, D / 2 + 0.15);
        S.push(bx(L2 + 0.3, 0.3, D + 0.3, cx, 3.35, cz, '#5f7a4a', 0, 0, F.yaw), bx(L2 + 0.3, 1.0, 0.06, ...F.p(0, D + 0.15).slice(0, 1), 4.0, F.p(0, D + 0.15)[1], '#3f6a4a', 0, 0, F.yaw));
        for (let y = 5.4; y < 13; y += 3.4) { const [px, pz] = F.p(0, 0.9); S.push(bx(L2, 0.08, 0.9, px, y, pz, '#c98a5e', 0, 0, F.yaw), bx(L2, 0.05, 0.05, ...F.p(0, 1.35).slice(0, 1), y + 1.0, F.p(0, 1.35)[1], '#ffb000', 0, 0, F.yaw)); }
        glows.push([cx, 3.0, cz, '#fff0c8', 4, 0]);
        regRect('sidewalk shed', cx, cz, F.yaw, L2, D);
        sc++; count('scaffold');
      }
    }
    // loading bays with roller shutters on side walls that look at a street
    let lb = 0;
    for (const b of K.buildings) {
      if (lb >= 3 || !['office', 'apart', 'tower'].includes(b.style) || !city(b.cx, b.cz)) continue;
      const [dfx, dfz] = front(b);
      for (const [fx, fz] of SIDESN) {
        if (lb >= 3 || (fx === dfx && fz === dfz)) continue;
        const F = faceOf(b, fx, fz), o = F.along / 2 - 5;
        if (F.sd < 6 || F.along < 16 || b.shops > 6 && r() < 0.5) continue;
        const [px, pz] = F.p(o, 0.75);
        if (!free(px, pz, 1.2, 0)) continue;
        const [sx, sz] = F.p(o, 0.06);
        S.push(bx(3.6, 3.2, 0.1, sx, 1.6, sz, '#8a8f9a', 0, 0, F.yaw));
        for (let y = 0.3; y < 3.2; y += 0.25) S.push(bx(3.62, 0.04, 0.12, sx, y, sz, '#6a6e78', 0, 0, F.yaw));
        S.push(bx(4.2, 0.35, 0.3, ...F.p(o, 0.15).slice(0, 1), 3.4, F.p(o, 0.15)[1], '#ffb000', 0, 0, F.yaw));
        S.push(bx(4.0, 1.0, 1.4, px, 0.5, pz, '#9a96a0', 0, 0, F.yaw));
        for (const sg of [-1, 1]) { const [qx, qz] = F.p(o + sg * 1.6, 1.47); S.push(bx(0.35, 0.5, 0.12, qx, 0.7, qz, '#22203a', 0, 0, F.yaw)); }
        for (const sg of [-1, 1]) { const [qx, qz] = F.p(o + sg * 2.5, 1.9); S.push(cyl(0.13, 0.13, 1.0, 8, qx, 0.5, qz, '#ffd447'), cyl(0.135, 0.135, 0.15, 8, qx, 0.6, qz, '#22203a')); P.circle(qx, qz, 0.14, 1); footprint('loading bay bollard', qx, qz, 0.14); mark(qx, qz, 0.3); }
        P.box(px, pz, quarter(F.yaw) ? 1.4 : 4.0, quarter(F.yaw) ? 4.0 : 1.4, 1.0); regRect('loading bay', px, pz, F.yaw, 4.0, 1.4);
        glows.push([...F.p(o, 1.0).slice(0, 1), 3.9, F.p(o, 1.0)[1], '#ffe7b0', 3, 0.05]);
        lb++; count('loadingBay');
      }
    }
    // water towers: a wooden tank on steel legs on the office and apartment roofs, away from the stair hut,
    // the billboards and the roof clutter (their roof colliders)
    for (const b of K.buildings) {
      if (!['office', 'apart'].includes(b.style) || b.w < 22 || b.d < 16) continue;
      const y = b.roofY, spots = [[b.x0 + 4, b.z0 + 4], [b.x1 - 4, b.z0 + 4], [b.x0 + 4, b.z1 - 4], [b.x1 - 4, b.z1 - 4]];
      const busy = (x, z) => Math.hypot(x - b.door.x, z - b.door.z) < 5 || P.cols.some((o) => (o.y0 || 0) > y - 1.5 && (o.c ? Math.hypot(o.x - x, o.z - z) < o.r + 2.4 : x > o.x0 - 2.4 && x < o.x1 + 2.4 && z > o.z0 - 2.4 && z < o.z1 + 2.4));
      const sp = spots.find(([x, z]) => !busy(x, z));
      if (!sp) continue;
      const [x, z] = sp;
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(bx(0.14, 3, 0.14, x + ox * 1.1, y + 1.5, z + oz * 1.1, '#3b3350'));
      S.push(bx(2.6, 0.12, 0.12, x, y + 1.6, z - 1.1, '#3b3350'), bx(2.6, 0.12, 0.12, x, y + 1.6, z + 1.1, '#3b3350'), bx(0.25, 0.25, 2.6, x, y + 3.1, z, '#3b3350'));
      S.push(cyl(1.6, 1.6, 3.4, 12, x, y + 4.9, z, '#a8744e'));
      for (const hy of [3.6, 4.9, 6.2]) S.push(cyl(1.63, 1.63, 0.1, 12, x, y + hy, z, '#3b3350'));
      S.push(ww(tint(new THREE.ConeGeometry(1.75, 1.3, 12).translate(x, y + 7.25, z), '#6a5444')), cyl(0.08, 0.08, 0.5, 5, x, y + 8.1, z, STEEL));
      P.box(x, z, 3.4, 3.4, y + 8, 0, y);
      count('waterTower');
    }
  }

  // ================================================================ steam from the vents: one points mesh, risen in the shader
  let steam = null;
  if (vents.length) {
    const per = 7, pos = new Float32Array(vents.length * per * 3), seed = new Float32Array(vents.length * per);
    vents.forEach(([x, z], i) => { for (let k = 0; k < per; k++) { const j = i * per + k; pos[j * 3] = x; pos[j * 3 + 1] = 0.1; pos[j * 3 + 2] = z; seed[j] = k / per + (i * 0.37) % 1; } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const lowU = { value: quality.high ? 0 : 1 };
    quality.on(() => { lowU.value = quality.high ? 0 : 1; });
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: timeU, uScale: pointScaleU, uLow: lowU, ...fogU },
      vertexShader: /* glsl */`attribute float aSeed; uniform float uTime, uScale, uLow; varying float vA; varying float vFog;
        void main() {
          float t = fract(uTime * 0.22 + aSeed);
          vec3 p = position + vec3(sin(aSeed * 31.0 + uTime * 0.7) * 0.5 * t, t * 3.6, cos(aSeed * 17.0) * 0.4 * t);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float keep = uLow > 0.5 ? step(fract(aSeed * 7.0), 0.45) : 1.0;
          gl_PointSize = (0.7 + t * 2.6) * uScale / max(-mv.z, 1.0) * keep;
          vA = smoothstep(0.0, 0.15, t) * (1.0 - t) * 0.42 * keep;
          vFog = -mv.z;
        }`,
      fragmentShader: /* glsl */`${FOG_PARS} varying float vA; varying float vFog;
        void main() {
          vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0;
          if (r > 1.0) discard;
          float a = vA * (1.0 - r) * (1.0 - smoothstep(uFogNear, uFogFar, vFog));
          gl_FragColor = vec4(mix(vec3(0.92, 0.93, 0.97), uFogColor, smoothstep(uFogNear, uFogFar, vFog) * 0.5), a);
        }`,
    });
    steam = new THREE.Points(g, mat);
    steam.frustumCulled = false; steam.renderOrder = 4;
  }
  K.keyscape = stats;
  return { steam, stats };
}
