// More things to drive: a precomputed list of valid parking slots (kerbside parking lanes along the
// avenues and side streets, the stadium car park, and footpath edges for the Comets) and a small pool of
// spare cars and bikes. When you are on foot and nothing vacant is within reach, a spare is parked in the
// nearest free slot that the camera can't see (or the farthest spare is moved over). The pool is capped
// for phones; spares never show on the minimap (ui/hud.js skips vacant vehicles).
import { HX, ROADS, SIDE_X, inJunction, onRoad, onLand } from '../world/layout.js';
import { KH, KV, KV_W, inKey } from '../world/key.js';
import { unseen } from '../core/util.js';
import { resetDamage } from '../vehicles/vehicles.js';

const POOL_CARS = 8, POOL_BIKES = 4;
const TRIGGER = 48, MIN_D = 16, MAX_D = 58, PLAN = 60;

export function createParking(game) {
  const { L, vehicles, camera, player } = game;
  const { PAINTS, BIKE_PAINT } = vehicles;
  const key = L.key, st = key.stadium, cp = key.carpark;
  const doors = [...Object.values(L.places), ...Object.values(L.venues || {}), L.station, L.clinic];
  // ---- forbidden zones (stadium bowl and pitch, beach and sand, water, buildings, doorways, props)
  const inStadium = (x, z, m = 0) => Math.abs(x - st.cx) < st.w / 2 + m && Math.abs(z - st.cz) < st.d / 2 + m;
  const inSolid = (x, z, r) => L.solids.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  const nearDoor = (x, z, r) => doors.some((d) => d && Math.hypot(d.x - x, d.z - z) < r);
  const nearProp = (x, z, r) => L.props.cols.some((o) => !o.off && (o.c ? Math.hypot(o.x - x, o.z - z) < o.r + r : x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r))
    || L.palms.some((p) => Math.hypot(p.x - x, p.z - z) < r + 0.8) || L.lamps.some((p) => Math.hypot(p.x - x, p.z - z) < r + 0.5);
  // the old town's sand starts south of the promenade; the key's shore is its edge
  const onSand = (x, z) => (Math.abs(x) <= HX && z > 66) || (inKey(x, z) && (z > key.marina.z0 - 2 || z < -146));
  function problem(s) {
    const r = s.bike ? 0.9 : 1.6;
    if (!onLand(s.x, s.z)) return 'water';
    if (inStadium(s.x, s.z, 2)) return 'stadium';
    if (onSand(s.x, s.z)) return 'sand';
    if (inJunction(s.x, s.z, s.bike ? 1 : 2.5)) return 'junction';
    if (inSolid(s.x, s.z, r * 0.6)) return 'building';
    if (nearDoor(s.x, s.z, 4.5)) return 'doorway';
    if (s.bike ? onRoad(s.x, s.z, 0.4) : !s.lot && !onRoad(s.x, s.z)) return s.bike ? 'carriageway' : 'not a parking lane';
    if (nearProp(s.x, s.z, r)) return 'prop';
    return null;
  }

  // ---- the slots
  const raw = [];
  const lane = (x, z, yaw) => raw.push({ x, z, yaw });
  // old town: both kerbs of Lumina Boulevard, the north kerb of the first back avenue, the side streets
  for (let x = -276; x <= 276; x += 10) { lane(x, ROADS.blvd.z - 6.2, -Math.PI / 2); lane(x + 5, ROADS.blvd.z + 6.2, Math.PI / 2); lane(x + 2, ROADS.back1.z + 4.8, Math.PI / 2); }
  for (const s of SIDE_X) for (let z = ROADS.sideZ0 + 8; z < ROADS.blvd.z - 12; z += 10) { lane(s - 4.8, z, 0); lane(s + 4.8, z + 5, Math.PI); }
  // the key: Halcyon Avenue's kerbs, Stadium Way's, the four streets, the car park rows
  for (const h of KH) for (let x = h.x0 + 6; x < h.x1 - 4; x += 11) { const o = h.w === 18 ? 6.2 : 4.8; lane(x, h.z - o, -Math.PI / 2); lane(x + 5, h.z + o, Math.PI / 2); }
  for (const v of KV) for (let z = v.z0 + 6; z < v.z1 - 4; z += 11) { const o = KV_W / 2 - 1.2; lane(v.x - o, z, 0); lane(v.x + o, z + 5, Math.PI); }
  for (let x = cp.x0 + 8; x < cp.x1 - 6; x += 6.5) for (const z of [cp.z0 + 8, cp.z1 - 8, (cp.z0 + cp.z1) / 2]) raw.push({ x, z, yaw: z < (cp.z0 + cp.z1) / 2 ? 0 : Math.PI, lot: true });
  // Comets: on the footpath edge of the boulevard and Halcyon Avenue
  for (let x = -280; x <= 280; x += 16) { raw.push({ x, z: ROADS.blvd.z - 9.8, yaw: -Math.PI / 2, bike: true }); raw.push({ x: x + 8, z: ROADS.blvd.z + 11.6, yaw: Math.PI / 2, bike: true }); }
  for (let x = KH[0].x0 + 8; x < KH[0].x1 - 4; x += 16) { raw.push({ x, z: KH[0].z - 9.8, yaw: -Math.PI / 2, bike: true }); raw.push({ x: x + 8, z: KH[0].z + 11.6, yaw: Math.PI / 2, bike: true }); }
  for (const s of SIDE_X) for (let z = ROADS.sideZ0 + 14; z < ROADS.blvd.z - 16; z += 22) raw.push({ x: s - 7.4, z, yaw: 0, bike: true });
  const slots = raw.filter((s) => !problem(s));

  // ---- the spare pool (parked off-screen until needed)
  const pool = [];
  for (let i = 0; i < POOL_CARS; i++) { const c = vehicles.addCar(0, 0, 0, PAINTS[(i * 3 + 2) % PAINTS.length], { off: true, spare: true }); if (c) pool.push(c); }
  for (let i = 0; i < POOL_BIKES; i++) { const c = vehicles.addCar(0, 0, 0, BIKE_PAINT[(i * 3 + 1) % BIKE_PAINT.length], { off: true, spare: true, kind: 'bike' }); if (c) pool.push(c); }
  const stats = { moves: 0, pool: pool.length, slots: slots.length, rejected: raw.length - slots.length };

  const vacant = (v) => !v.off && !v.ai && !v.driven && !v.wreck && !v.sink && !v.police && !(v.burn > 0) && !v.jacking && (v.kind === 'car' || v.kind === 'bike') && (v.y || 0) < 2;
  function nearestVacant(x, z) {
    let best = null, bd = 1e9;
    for (const v of vehicles.cars) if (vacant(v)) { const d = Math.hypot(v.x - x, v.z - z); if (d < bd) { bd = d; best = v; } }
    return { v: best, d: bd };
  }
  const taken = (s) => vehicles.all().some((v) => !v.off && Math.hypot(v.x - s.x, v.z - s.z) < (s.bike ? 2.4 : 4.6));
  // move a spare into the best free slot near (x, z)
  function topUp(x, z, force = false) {
    let best = null, bd = 1e9;
    for (const s of slots) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < MIN_D || d > MAX_D || d > bd) continue;
      if (!force && !unseen(camera, s.x, s.z, 12)) continue;
      if (taken(s)) continue;
      bd = d; best = s;
    }
    if (!best) return false;
    const want = best.bike ? 'bike' : 'car';
    let c = pool.find((p) => p.off && p.kind === want);
    if (!c) {
      // the farthest spare nobody is using and nobody can see
      let far = -1;
      for (const p of pool) { if (p.kind !== want || !vacant(p)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d > 140 && d > far && unseen(camera, p.x, p.z, 40)) { far = d; c = p; } }
    }
    if (!c) return false;
    Object.assign(c, { off: false, x: best.x, z: best.z, y: 0, yaw: best.yaw, vx: 0, vy: 0, vz: 0, spin: 0, tvx: 0, tvz: 0, park: { x: best.x, z: best.z, yaw: best.yaw }, wreck: false, burn: 0 });
    resetDamage(c); vehicles.retint(c);
    stats.moves++;
    return true;
  }
  let t = 0, misses = 0;
  // sample on-foot spots across both districts (automated checks): sidewalks, plazas, parks, never inside
  function samples(n = 30) {
    const out = [];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; out.length < n && i < 6000; i++) {
      const old = out.length < n / 2;
      const x = old ? -270 + rnd() * 540 : -1060 + rnd() * 560, z = old ? -140 + rnd() * 200 : -140 + rnd() * 280;
      if (!onLand(x, z) || inSolid(x, z, 1) || onRoad(x, z) || inStadium(x, z, 4) || onSand(x, z)) continue;
      out.push([+x.toFixed(1), +z.toFixed(1)]);
    }
    return out;
  }
  return {
    slots, stats, pool,
    update(dt) {
      if ((t -= dt) > 0) return;
      t = 1;
      if (game.vehicle || game.inside || game.busy || !game.started) return;
      const f = player.pos;
      // a slot out of view first; after a few tries any free slot will do (better than nothing to drive)
      if (nearestVacant(f.x, f.z).d > TRIGGER) { if (topUp(f.x, f.z, misses >= 3)) misses = 0; else misses++; } else misses = 0;
    },
    nearest() { const f = player.pos, n = nearestVacant(f.x, f.z); return { d: +n.d.toFixed(1), kind: n.v && n.v.kind, spare: !!(n.v && n.v.spare), x: +f.x.toFixed(1), z: +f.z.toFixed(1) }; },
    // every slot re-checked against the forbidden zones (should be an empty list), and the counts
    check() { const bad = slots.map((s) => [s, problem(s)]).filter(([, p]) => p).map(([s, p]) => ({ x: s.x, z: s.z, p })); return { ...stats, bike: slots.filter((s) => s.bike).length, bad, cars: vehicles.cars.length }; },
    samples,
    plan: PLAN,
  };
}
