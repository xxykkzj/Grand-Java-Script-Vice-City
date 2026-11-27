// Boats and jet skis: the craft you own (bought at Seaglass Marine, moored at a private berth on the Starboard
// Marina pier), the jet-ski rentals (Starboard Marina and Driftwood Pier), test rides, and the bay's traffic
// (a ferry, two sailboats, a fishing boat). Models and handling data: vehicles/boatmodels.js; the water
// effects (wakes, spray, ripples): vehicles/wake.js; the swell they ride: world/waves.js.
//
// Driving: throttle with inertia and water drag, reverse thrust, a keel that grips sideways (less on the jet ski,
// which slides), yaw that follows the stick with the hull's inertia (the yacht is slow to answer), weak steering at
// a crawl, banking into turns, planing (the bow rises over the hump, then levels as she gets up on the plane), and
// the swell sampled at the bow, stern and both sides for heave, pitch and roll, smoothed by the hull's size. The
// jet ski hops off crests and jumps on Space. Seawalls, piers, pontoons, buoys, moored boats and other boats are
// solid (hard hits cost condition, game/damage.js); shallow water beaches the bow gently and stops it. A boat at
// the end of its condition takes on water and sinks slowly instead of exploding: you end up in the sea.
// On deck (stopped or not) you walk about on the moving deck, sit (F), wait for the sunset or the night on a lounger
// (1 / 2), dive off (Space) and climb back up the ladder (E), sleep in the cabin (a manual save) and mix a drink.
import * as THREE from 'three';
import { clamp, damp, lerp, angleDelta, PI, timeU, nightU, reducedMotion, unseen, pushOut } from '../core/util.js';
import { WL, depthAt, pushFromSolids, onDeck, bedAt } from '../world/sea.js';
import { onLand, seaPull, MPIER, KEY } from '../world/layout.js';
import { waveAt, SEA, waveU, shoreDist } from '../world/waves.js';
import { BOAT_TYPES, AI_TYPES, ROUTES, BERTHS, RENTAL_SITES, RENT_FEE, TEST_SPOT, BOAT_IDS, PONTOON_X } from './boatmodels.js';
import { createWater } from './wake.js';
import { createGlow } from '../world/glow.js';
import { resetDamage } from './vehicles.js';
import { makeMarker } from '../game/cutscene.js';
import { quality } from '../core/quality.js';
import { boards, P } from '../game/dress.js';
import { box, cyl, merge } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const money = (n) => '$' + n.toLocaleString('en-US');
const TEST_S = 75;
const SLEEP = [
  { id: 'morning', name: 'WAKE IN THE MORNING', note: 'Sleep till 8:00 to the slap of the water. A little health back, and the game is saved.', tag: '8:00', to: 8 },
  { id: 'evening', name: 'WAKE IN THE EVENING', note: 'Nap till 18:30, golden hour on the water. Saves the game.', tag: '18:30', to: 18.5 },
  { id: 'night', name: 'WAKE AT NIGHT', note: 'Sleep till 22:00, the coast lit up. Saves the game.', tag: '22:00', to: 22 },
  { id: 'save', name: 'JUST SAVE', note: 'Write the save without sleeping.', tag: 'SAVE' },
];
const BAR = [{ id: 'negroni', name: 'FLYBRIDGE NEGRONI', note: 'Stirred over one big cube, an orange twist.', heal: 12 }, { id: 'fizzwine', name: 'SPARKLING ROSÉ', note: 'From the wine fridge under the bar.', heal: 10 }, { id: 'oldfash', name: 'SALT AIR OLD FASHIONED', note: 'Bourbon, bitters, the sea at your back.', heal: 14 }];
const SUNSET = 19.5, NIGHT = 22;

export function createBoats(game, scene) {
  const { player, hud, audio, save, env, camera, L } = game;
  const water = createWater(scene, game.ocean);
  const S = { aboard: null, test: null, wait: null, rent: null, lastE: 0, msgT: 0, seaT: 0, lap: 0, rush: 0, air: 0, saveKey: '', camK: 0, hopCd: 0 };
  const stats = { bought: 0, rides: 0, rentals: 0, returns: 0, tests: 0, dives: 0, climbs: 0, sunk: 0, salvaged: 0, hops: 0, slaps: 0, bumps: 0, beached: 0, sleeps: 0, waits: 0, drinks: 0 };
  const boats = [];
  const glow = createGlow(scene, 80);
  let gN = 0;

  // ---------------------------------------------------------------- the craft
  const geoCache = {};
  function make(id, role, at, extra = {}) {
    const T = BOAT_TYPES[id] || AI_TYPES[id];
    const geo = geoCache[id] || (geoCache[id] = T.geo());
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.order = 'YXZ';
    scene.add(mesh);
    const b = {
      boat: true, kind: 'boat', type: id, spec: T, label: T.model || T.name, role, mesh, mat, x: at.x, y: WL, z: at.z, yaw: at.yaw, vx: 0, vz: 0, vy: 0, yawRate: 0, tx: 0, tz: 0, heave: 0,
      air: false, airVy: 0, len: T.L, radius: T.B / 2, mass: T.mass, home: { x: at.x, z: at.z, yaw: at.yaw }, driven: false, down: null, wk: { last: null }, emit: { x: at.x, z: at.z }, rip: Math.random() * 2,
      off: false, slapCd: 0, lastSurf: null, lastBow: 0, idleT: 0, g: gN, perf: 1, ...extra,
    };
    gN += 4;
    if (role !== 'ai') resetDamage(b);
    boats.push(b);
    return b;
  }
  const own = {};                       // id -> the boat you own (made when bought)
  const rentals = [];
  RENTAL_SITES.forEach((site, si) => site.slots.forEach((sl, k) => rentals.push(make('jetski', 'rent', sl, { site: si, slot: k, rentedT: 0 }))));
  const ai = Object.keys(ROUTES).map((id) => { const r = ROUTES[id], [x, z] = r[0], [x2, z2] = r[1]; return make(id, 'ai', { x, z, yaw: Math.atan2(x2 - x, z2 - z) }, { route: r, wp: 1 }); });
  const tests = {};
  function ensureOwned() {
    for (const id of save.boats || []) if (!own[id] && BOAT_TYPES[id]) { const B0 = BERTHS[id]; own[id] = make(id, 'own', B0); }
    for (const id in own) { const b = own[id]; b.off = !(save.boats || []).includes(id); }
  }
  ensureOwned();
  const active = () => boats.filter((b) => !b.off);
  const T0 = (b) => b.spec;

  // ---------------------------------------------------------------- the marina dressing: the rental stands, berth plates
  const rings = {};
  for (const id in BERTHS) { const r = BERTHS[id].ring; rings[id] = makeMarker(scene, '#7fe0ff', 0.85, 3.2); rings[id].position.set(r.x, 0, r.z); rings[id].visible = false; }
  const siteRings = RENTAL_SITES.map((s) => { const m = makeMarker(scene, '#ff9ad5', 0.85, 3.2); m.position.set(s.ring.x, 0, s.ring.z); return m; });
  {
    const Sg = [], N = [], Bd = boards(512);
    for (const s of RENTAL_SITES) {
      const { x, z } = s.stand, yaw = s.id === 'marina' ? PI / 2 : PI / 2;
      Sg.push(box(0.9, 1.0, 1.6, x, 0.5, z, '#ff9ad5'), box(1.0, 0.06, 1.7, x, 1.03, z, '#f6f1e7'), box(0.06, 2.4, 0.06, x - 0.4, 1.2, z - 0.75, '#f6f1e7'), box(0.06, 2.4, 0.06, x - 0.4, 1.2, z + 0.75, '#f6f1e7'),
        box(1.3, 0.1, 2.0, x - 0.1, 2.45, z, '#27d8cf'), box(0.3, 0.5, 0.5, x - 0.1, 1.3, z + 0.4, '#ff7a1a'), box(0.3, 0.5, 0.5, x - 0.1, 1.3, z - 0.1, '#ffe14a'));
      N.push(box(0.04, 0.04, 2.0, x + 0.56, 2.38, z, '#ff2bd1'));
      Bd.add(1.8, 0.5, x + 0.52, 1.75, z, yaw, (c, W, H) => { P.fill(c, W, H, '#1b2a5a'); P.frame(c, W, H, '#ff9ad5', 3); P.text(c, 'ZIPFIN RENTALS', W / 2, H * 0.36, H * 0.32, '#ff9ad5', { italic: true, max: W * 0.92 }); P.text(c, `JET SKIS · $${RENT_FEE} A RIDE`, W / 2, H * 0.74, H * 0.22, '#fff6ec', { max: W * 0.92 }); });
    }
    for (const id in BERTHS) {
      const b = BERTHS[id];
      Sg.push(box(0.3, 0.25, 0.2, PONTOON_X - 0.1, -0.12, b.z - 1.4, '#3a3550'), box(0.3, 0.25, 0.2, PONTOON_X - 0.1, -0.12, b.z + 1.4, '#3a3550'), box(0.08, 1.0, 0.6, -795.9, 0.5, b.z + 1.3, '#f6f1e7'));
      Bd.add(0.56, 0.36, -795.84, 0.82, b.z + 1.3, -PI / 2, (c, W, H) => { P.fill(c, W, H, '#1b2a5a'); P.text(c, 'PRIVATE BERTH', W / 2, H * 0.32, H * 0.2, '#7fe0ff', { max: W * 0.9 }); P.text(c, BOAT_TYPES[id].model, W / 2, H * 0.68, H * 0.18, '#fff6ec', { max: W * 0.9 }); });
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merge(Sg), new THREE.MeshLambertMaterial({ vertexColors: true })), new THREE.Mesh(merge(N), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const bm = Bd.mesh(); if (bm) g.add(bm);
    scene.add(g);
  }

  // ---------------------------------------------------------------- what is solid on the water
  const MPX = (MPIER.x0 + MPIER.x1) / 2;
  const BOXES = [
    { x0: MPX - 10.5, x1: MPX - 8.5, z0: 157, z1: 235 }, { x0: MPX + 8.5, x1: MPX + 10.5, z0: 157, z1: 235 },
    { x0: MPX - 9.5, x1: MPX - 5.5, z0: 157, z1: 159 }, { x0: MPX + 5.5, x1: MPX + 9.5, z0: 157, z1: 159 },
  ];
  { const hb = L.venues.houseboat && L.venues.houseboat.b; if (hb) BOXES.push({ x0: hb.x0 - 0.2, x1: hb.x1 + 0.2, z0: hb.z0 - 0.2, z1: hb.z1 + 0.2 }); }
  const CIRCLES = [[70, 170, 0.8], [8, 205, 0.8], [76, 250, 0.8], [-70, 185, 0.8], [-142, 180, 0.7], [-18, 180, 0.7]];
  for (const [x, z] of [[24, 176], [58, 196], [22, 222], [60, 236], [-30, 172]]) CIRCLES.push([x, z, 3.2]);
  for (const bt of (L.key.marina && L.key.marina.boats) || []) if (!(bt.x < MPIER.x0 && bt.z < 220)) CIRCLES.push([bt.x, bt.z, 2.2 * bt.s + 0.6]);

  // ---------------------------------------------------------------- frames
  const tmp = { x: 0, y: 0, z: 0 };
  function toWorld(b, lx, ly, lz, out = tmp) {
    const cz = Math.cos(b.tz), sz = Math.sin(b.tz), cx = Math.cos(b.tx), sx = Math.sin(b.tx), cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const x = lx * cz - ly * sz, y = lx * sz + ly * cz, z = lz;
    const y2 = y * cx - z * sx, z2 = y * sx + z * cx;
    out.x = b.x + x * cy + z2 * sy; out.y = b.y + y2; out.z = b.z - x * sy + z2 * cy;
    return out;
  }
  const toLocal = (b, wx, wz) => { const dx = wx - b.x, dz = wz - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
  // the hull as a row of circles (bow tip smaller)
  function circles(b) {
    const T = b.spec, n = Math.max(1, Math.round(T.L / T.B)), r = T.B * 0.48, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), out = [];
    for (let i = 0; i < n; i++) { const o = n === 1 ? 0 : -T.L / 2 + r + (T.L - 2 * r) * i / (n - 1); out.push([b.x + fx * o, b.z + fz * o, i === n - 1 && n > 1 ? r * 0.8 : r]); }
    return out;
  }
  const hullDist = (b, x, z) => { let d = 1e9; for (const c of circles(b)) d = Math.min(d, Math.hypot(x - c[0], z - c[1]) - c[2]); return d; };

  // ---------------------------------------------------------------- the sea state from the weather
  function seaState(dt) {
    const w = env.weather, rain = env.w ? env.w.rain || 0 : 0;
    const want = w === 'storm' ? 0.5 : 0.16 + rain * 0.14 + (w === 'fog' ? -0.04 : 0);
    SEA.amp = damp(SEA.amp, want, 0.15, dt); waveU.value = SEA.amp;
  }

  // ---------------------------------------------------------------- physics
  function launch(b, v) {
    b.air = true; b.airVy = v; stats.hops++;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = b.x - fx * 1.3, sz = b.z - fz * 1.3;
    water.burst(sx, sz, 8 + v * 2, 1.6 + v * 0.3, 1.4, 0.4);
    for (let i = 0; i < 10; i++) water.drop(sx + (Math.random() - 0.5) * 0.8, WL + b.heave + 0.1, sz + (Math.random() - 0.5) * 0.8, b.vx * 0.45 + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2.5, b.vz * 0.45 + (Math.random() - 0.5) * 2, 0.35 + Math.random() * 0.3, 0.6 + Math.random() * 0.4);
    audio.splash(0.35);
  }
  function land(b, imp) {
    b.air = false;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    water.burst(b.x - fx * 0.5, b.z - fz * 0.5, 8 + imp * 3, 2 + imp * 0.4, 2.2 + imp * 0.2, 0.5);
    audio.splash(clamp(imp / 6, 0.4, 1.2)); if (audio.slap) audio.slap(clamp(imp / 5, 0.5, 1.4));
    b.vx *= 0.94; b.vz *= 0.94; b.heave -= Math.min(0.3, imp * 0.05);
    if (imp > 10 && game.damage) game.damage.hit(b, (imp - 10) * 2.5, 'crash');
    if (!reducedMotion && b.driven) game.fx.shake = Math.max(game.fx.shake, Math.min(0.25, imp * 0.03));
  }
  function physics(b, dt, inp, near) {
    const T = b.spec, jet = T.kind === 'jetski';
    let fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    let vf = b.vx * fx + b.vz * fz, vl = b.vx * rx + b.vz * rz;
    const thr = inp ? inp.throttle : 0, st = inp ? inp.steer : 0;
    const perf = b.perf = b.hp !== undefined && b.maxHp ? (b.hp / b.maxHp < 0.45 ? 0.75 : 1) : 1;
    if (!b.air) {
      if (thr > 0) vf += (vf < 0 ? T.acc * 1.4 : T.acc * perf * (1 - Math.pow(clamp(vf / (T.top * (0.65 + 0.35 * perf)), 0, 1.2), 2))) * thr * dt;
      else if (thr < 0) { if (vf > 0.4) vf += thr * T.acc * 0.9 * dt; else vf = Math.max(-T.rev, vf + thr * T.acc * 0.55 * dt); }
      // coasting: water drag (heavy hulls glide on); nobody at the helm, the engine idles astern and she comes to rest
      const coast = (0.3 + 0.075 * Math.abs(vf)) / (0.7 + 0.15 * T.mass) * (thr ? 0.35 : 1) * (b.driven ? 1 : 2.2);
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), coast * dt);
      vl *= Math.exp(-T.grip * dt);
    } else vl *= Math.exp(-0.3 * dt);
    // the yaw follows the stick with the hull's inertia; at a crawl the rudder / jet has little bite
    const sEff = Math.max(Math.abs(vf), thr > 0 ? 2.6 * thr : 0), fs = clamp(sEff / (T.top * 0.3), 0, 1);
    const want = b.air ? 0 : st * T.turn * (T.turnLow + (1 - T.turnLow) * fs) * (vf < -0.3 ? -1 : 1) / (1 + Math.abs(vf) * 0.01);
    b.yawRate = damp(b.yawRate, want, T.resp, dt);
    b.yaw += b.yawRate * dt;
    vl -= b.yawRate * Math.abs(vf) * (jet ? 0.12 : 0.05) * dt;          // a little skid out of the turn
    fx = Math.sin(b.yaw); fz = Math.cos(b.yaw); rx = Math.cos(b.yaw); rz = -Math.sin(b.yaw);
    b.vx = fx * vf + rx * vl; b.vz = fz * vf + rz * vl;
    const px = b.x, pz = b.z;
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.speed = vf;
    // ---- the swell under the hull: heave, pitch and roll, smoothed by the hull's size
    const t = timeU.value, L2 = T.L * 0.4, B2 = T.B * 0.45;
    const hc = waveAt(b.x, b.z, t), hb = waveAt(b.x + fx * L2, b.z + fz * L2, t), hs = waveAt(b.x - fx * L2, b.z - fz * L2, t);
    const hp = waveAt(b.x + rx * B2, b.z + rz * B2, t), hst = waveAt(b.x - rx * B2, b.z - rz * B2, t);
    const surf = (hc * 2 + hb + hs + hp + hst) / 6, av = Math.abs(vf);
    const plane = T.planeV < 50 ? ss(T.planeV * 0.55, T.planeV * 1.15, av) : 0;
    const hump = T.planeV < 50 ? Math.exp(-Math.pow((av - T.planeV * 0.72) / (T.planeV * 0.32), 2)) : clamp(av / T.top, 0, 1) * 0.6;
    // shallow water: the bow rides up the sand, the boat slows and stops (beached gently)
    const bowX = b.x + fx * T.L * 0.45, bowZ = b.z + fz * T.L * 0.45, dBow = depthAt(bowX, bowZ), dMid = depthAt(b.x, b.z);
    let ground = 0;
    if (dBow < T.draft) {
      ground = clamp((T.draft - dBow) / Math.max(T.draft, 0.2), 0, 1.5);
      const fwd = Math.max(0, b.vx * fx + b.vz * fz);
      const k = Math.min(1, dt * (1.5 + 9 * ground));
      b.vx -= fx * fwd * k; b.vz -= fz * fwd * k;
      if (fwd > 3 && !b.beachT) { stats.beached++; b.beachT = 1.5; if (b.driven) { hud.toast('RUN AGROUND', 'TOO SHALLOW · S TO BACK OFF'); water.burst(bowX, bowZ, 10, 1.5, 2.5, 0.4); } }
      if (dBow <= 0.02 && dMid <= T.draft * 0.5) { b.x = px; b.z = pz; b.vx *= 0.2; b.vz *= 0.2; }
    }
    if (b.beachT) b.beachT = Math.max(0, b.beachT - dt);
    const pitchT = -Math.atan2(hb - hs, T.L * 0.8) - (T.hump * hump + plane * 0.02) * (vf > 0 ? 1 : 0.2) - ground * 0.06 + (thr < 0 && vf > 2 ? 0.02 : 0);
    const rollT = Math.atan2(hp - hst, T.B * 0.9) - T.bank * clamp(b.yawRate * av / (T.turn * T.top * 0.45), -1, 1) + (T.heel ? T.heel : 0);
    const k = T.wave * (1 + plane * 0.5);
    b.tx = damp(b.tx, pitchT, k, dt); b.tz = damp(b.tz, rollT, k * 0.8, dt);
    const lift = plane * T.draft * 0.3 + ground * 0.12;
    if (!b.air) {
      b.heave = damp(b.heave, surf + lift, k * 1.2, dt);
      b.y = WL + b.heave;
      // the jet ski hops off a crest at speed, or jumps on Space
      const dh = b.lastSurf === null ? 0 : (surf - b.lastSurf) / Math.max(dt, 1e-3);
      if (jet && av > 13 && dh > 0.75 && !(b.hopCd > 0)) { launch(b, dh * 1.4 + 0.8); b.hopCd = 0.5; }
      if (jet && inp && inp.hop && av > 5 && !(b.hopCd > 0)) { launch(b, 4.6 + av * 0.04); b.hopCd = 0.9; }
      // slamming into a wave at speed: a slap and a burst of spray off the bow
      const dBowH = (hb - b.lastBow) / Math.max(dt, 1e-3);
      b.slapCd = Math.max(0, b.slapCd - dt);
      if (!jet && av > T.top * 0.45 && dBowH > 0.35 + T.L * 0.02 && b.slapCd <= 0 && near < 160) {
        b.slapCd = 0.45 + Math.random() * 0.3; stats.slaps++;
        for (const s of [-1, 1]) water.burst(bowX + rx * s * T.B * 0.4, bowZ + rz * s * T.B * 0.4, 5 + av * 0.3, 2 + av * 0.08, 2.2, 0.45);
        if (b.driven && audio.slap) audio.slap(clamp(av / T.top, 0.4, 1));
      }
    } else {
      b.airVy -= 15 * dt; b.y += b.airVy * dt;
      b.tx = damp(b.tx, clamp(-b.airVy * 0.06, -0.4, 0.3), 3, dt);
      const s0 = WL + surf;
      if (b.y <= s0 && b.airVy < 0) { const imp = -b.airVy; b.heave = surf; b.y = s0; land(b, imp); }
    }
    b.lastSurf = surf; b.lastBow = hb;
    if (b.hopCd > 0) b.hopCd -= dt;
  }
  // the sea's soft edge (the same as the helicopter's), and what is solid: seawalls, piers, the causeway, pontoons,
  // buoys, moored boats
  const P2 = { x: 0, z: 0 };
  function bounds(b, dt) {
    const sp = seaPull(b.x, b.z);
    if (sp.over > -40) {
      const over = sp.over + 40, vout = b.vx * sp.nx + b.vz * sp.nz;
      if (vout > 0) { const k = Math.min(1, dt * (0.8 + over * 0.05)); b.vx -= sp.nx * vout * k; b.vz -= sp.nz * vout * k; }
      b.vx -= sp.nx * Math.min(over, 40) * 0.2 * dt; b.vz -= sp.nz * Math.min(over, 40) * 0.2 * dt;
      if (b.driven && (S.seaT -= dt) <= 0) { S.seaT = 4; hud.toast('OPEN SEA: TURN BACK', 'THE SWELL GETS SERIOUS OUT HERE'); }
    }
    let impact = 0, hx = 0, hz = 0;
    for (const c of circles(b)) {
      P2.x = c[0]; P2.z = c[1];
      pushFromSolids(P2, c[2], -2);
      for (const q of BOXES) pushOut(P2, c[2], q);
      for (const q of CIRCLES) { const dx = P2.x - q[0], dz = P2.z - q[1], d = Math.hypot(dx, dz), m = q[2] + c[2]; if (d < m && d > 1e-4) { P2.x += dx / d * (m - d); P2.z += dz / d * (m - d); } }
      const dx = P2.x - c[0], dz = P2.z - c[1], d = Math.hypot(dx, dz);
      if (d > 1e-5) {
        const nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz;
        b.x += dx; b.z += dz;
        if (vn < 0) { impact = Math.max(impact, -vn); b.vx -= 1.3 * vn * nx; b.vz -= 1.3 * vn * nz; b.yawRate *= 0.6; hx = c[0] + nx * -c[2]; hz = c[1] + nz * -c[2]; }
      }
    }
    if (impact > 1.5) hit(b, impact, hx, hz);
  }
  function hit(b, imp, x, z) {
    stats.bumps++;
    if (b.role === 'ai') return;
    if (imp > 2.5) water.burst(x, z, 4 + imp, 1.5 + imp * 0.15, 1.8, 0.4);
    if (b.driven || Math.hypot(camera.position.x - b.x, camera.position.z - b.z) < 40) audio.thud(clamp(imp / 14, 0.15, 0.9));
    if (imp > 4.5 && game.damage) { game.damage.hit(b, (imp - 4.5) * (b.spec.kind === 'jetski' ? 3.2 : 4.2), 'crash'); if (b.driven && imp > 7 && audio.crunch) audio.crunch(Math.min(1.2, imp / 20)); }
  }
  // boat against boat (the bay's traffic keeps to its route: only yours give way)
  function pairs(list) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j];
      if (a.down || c.down) continue;
      const reach = (a.spec.L + c.spec.L) / 2 + 1;
      if (Math.abs(a.x - c.x) > reach || Math.abs(a.z - c.z) > reach) continue;
      let ov = 0, nx = 0, nz = 0;
      for (const p of circles(a)) for (const q of circles(c)) { const dx = q[0] - p[0], dz = q[1] - p[1], d = Math.hypot(dx, dz), o = p[2] + q[2] - d; if (o > ov && d > 1e-4) { ov = o; nx = dx / d; nz = dz / d; } }
      if (ov <= 0) continue;
      const ka = a.role === 'ai' ? 0 : c.role === 'ai' ? 1 : c.mass / (a.mass + c.mass), kc = 1 - ka;
      a.x -= nx * ov * ka; a.z -= nz * ov * ka; c.x += nx * ov * kc; c.z += nz * ov * kc;
      const rel = (c.vx - a.vx) * nx + (c.vz - a.vz) * nz;
      if (rel < 0) {
        const imp = -1.25 * rel;
        if (a.role !== 'ai') { a.vx -= imp * ka * nx; a.vz -= imp * ka * nz; }
        if (c.role !== 'ai') { c.vx += imp * kc * nx; c.vz += imp * kc * nz; }
        const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
        if (-rel > 1.5) { hit(a, -rel * (ka || 0.3) * 2, mx, mz); hit(c, -rel * (kc || 0.3) * 2, mx, mz); }
      }
    }
  }
  // moored: lines hold her at the berth (a soft spring), the swell still rocks her
  function moor(b, dt) {
    const h = b.home, dx = h.x - b.x, dz = h.z - b.z;
    if (dx * dx + dz * dz > 14 * 14) return false;
    b.vx += dx * 1.2 * dt; b.vz += dz * 1.2 * dt; const k = Math.exp(-1.6 * dt); b.vx *= k; b.vz *= k;
    b.yawRate = damp(b.yawRate, angleDelta(b.yaw, h.yaw) * 0.8, 2, dt);
    return true;
  }

  // ---------------------------------------------------------------- the bay's traffic
  function aiStep(b, dt) {
    const T = b.spec, [tx, tz] = b.route[b.wp], dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 25) b.wp = (b.wp + 1) % b.route.length;
    // ease off when your boat is close ahead
    let slow = 1;
    const v = game.vehicle;
    if (v && v.boat) { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), ax = v.x - b.x, az = v.z - b.z, ahead = ax * fx + az * fz; if (ahead > 0 && ahead < T.L * 2 && Math.abs(ax * fz - az * fx) < T.B * 2) slow = 0.3; }
    const sp = damp(Math.hypot(b.vx, b.vz), T.speed * slow, 0.5, dt);
    b.yawRate = damp(b.yawRate, clamp(angleDelta(b.yaw, Math.atan2(dx, dz)) * 0.6, -0.12, 0.12), 1.5, dt);
    b.yaw += b.yawRate * dt;
    b.vx = Math.sin(b.yaw) * sp; b.vz = Math.cos(b.yaw) * sp;
    b.x += b.vx * dt; b.z += b.vz * dt;
    const t = timeU.value, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), L2 = T.L * 0.4, B2 = T.B * 0.45;
    const hb = waveAt(b.x + fx * L2, b.z + fz * L2, t), hs = waveAt(b.x - fx * L2, b.z - fz * L2, t), hp = waveAt(b.x + rx * B2, b.z + rz * B2, t), hst = waveAt(b.x - rx * B2, b.z - rz * B2, t);
    b.heave = damp(b.heave, (hb + hs + hp + hst) / 4, T.wave, dt); b.y = WL + b.heave;
    b.tx = damp(b.tx, -Math.atan2(hb - hs, T.L * 0.8), T.wave, dt); b.tz = damp(b.tz, Math.atan2(hp - hst, T.B * 0.9) + (T.heel || 0), T.wave, dt);
    b.speed = sp;
  }

  // ---------------------------------------------------------------- sinking (instead of exploding)
  function sinkStart(b) {
    if (b.down) return;
    b.down = { t: 0, d: 0, bailed: false }; stats.sunk++;
    if (b.driven || (S.aboard && S.aboard.boat === b)) hud.toast('TAKING ON WATER!', 'SHE IS GOING DOWN · ABANDON SHIP');
    audio.thud(0.6);
  }
  function sinkStep(b, dt) {
    const D = b.down; D.t += dt;
    D.d += dt * (D.t < 6 ? 0.06 : 0.35);
    const k = Math.exp(-0.8 * dt); b.vx *= k; b.vz *= k; b.x += b.vx * dt; b.z += b.vz * dt;
    b.tx = damp(b.tx, -0.12, 0.4, dt); b.tz = damp(b.tz, 0.18, 0.3, dt);
    const bed = bedAt(b.x, b.z) + b.spec.draft;
    b.heave = Math.max(bed - WL, waveAt(b.x, b.z, timeU.value) - D.d); b.y = WL + b.heave;
    const floor = b.spec.deck ? Math.min(...b.spec.deck.map((d) => d.y)) : 0.4;
    if (!D.bailed && (D.d > floor + 0.1 || D.t > 7)) {
      D.bailed = true;
      if (b.driven || (S.aboard && S.aboard.boat === b)) { const p = toWorld(b, b.spec.B * 0.5 + 1.2, 0, 0, {}); off(b); game.swim.drop(p.x, p.z, 0, 0, WL + 0.5); hud.toast('INTO THE SEA!', 'SWIM FOR IT · THE BOAT WILL BE SALVAGED'); audio.splash(1); }
    }
    if (game.sea && D.t < 30 && Math.random() < dt * 8) game.sea.bubbles.emit(b.x + (Math.random() - 0.5) * b.spec.B, b.y + 0.5, b.z + (Math.random() - 0.5) * b.spec.L * 0.6);
    // salvaged once nobody is looking: yours back at the berth, a rental back at its stand
    if (D.t > 25 && !b.driven && unseen(camera, b.x, b.z, 50) && !(S.aboard && S.aboard.boat === b)) { home(b); stats.salvaged++; if (b.role === 'own') hud.toast('SALVAGED: ' + b.spec.model, 'BACK AT ITS BERTH, GOOD AS NEW'); }
  }
  function home(b) {
    b.down = null; resetDamage(b); b.mat.color.setScalar(1);
    if (b.role === 'test') { b.off = true; return; }
    const h = b.home; Object.assign(b, { x: h.x, z: h.z, yaw: h.yaw, vx: 0, vz: 0, yawRate: 0, heave: 0, tx: 0, tz: 0, air: false, rentedT: 0 });
    b.wk.last = null;
  }

  // ---------------------------------------------------------------- boarding, the helm, getting off
  const deckOf = (b) => b.spec.deck;
  function heightAt(T, lx, lz, ly) {
    let best = null, bd = 1e9;
    for (const d of T.deck) {
      if (lx < d.x0 || lx > d.x1 || lz < d.z0 || lz > d.z1) continue;
      const h = d.y1 !== undefined ? d.y + (d.y1 - d.y) * (lz - d.z0) / (d.z1 - d.z0) : d.y, dd = ly === undefined ? h : Math.abs(h - ly);
      if (dd < bd) { bd = dd; best = h; }
    }
    if (best === null) return null;
    return ly === undefined || bd <= 0.56 ? best : null;
  }
  function boardDeck(b, spot) {
    const T = b.spec, s = spot || T.board;
    if (game.vehicle) off(game.vehicle, true);
    game.act.reset();
    S.aboard = { boat: b, lx: s.x, lz: s.z, ly: heightAt(T, s.x, s.z) ?? T.deck[0].y, vx: 0, vz: 0, seat: null };
    player.setHidden(false); player.vel.set(0, 0, 0); player.vy = 0; player.onGround = true; player.speed = 0;
    placeDeck(0);
    stats.rides++; audio.step(0.8);
  }
  function takeHelm(b) {
    if (b.down) return;
    game.act.reset();
    if (S.aboard && S.aboard.boat !== b) S.aboard = null;
    b.driven = true; game.vehicle = b; game.mode = 'boat';
    player.setHidden(false);
    if (b.spec.deck) { const h = b.spec.helm; S.aboard = { boat: b, lx: h.x, lz: h.z - 0.5, ly: heightAt(b.spec, h.x, h.z - 0.5, h.y) ?? b.spec.deck[0].y, vx: 0, vz: 0, seat: null }; }
    else S.aboard = { boat: b, lx: 0, lz: 0, ly: 0.5, vx: 0, vz: 0, seat: null };
    audio.thud(0.3); stats.rides++;
    game.cam.yaw = b.yaw; game.cam.pitch = 0.22;
  }
  // stop driving (stay on board on a boat with a deck)
  function off(b, quiet = false) {
    if (game.vehicle === b) { b.driven = false; game.vehicle = null; game.mode = 'foot'; }
    b.driven = false;
    if (S.aboard && S.aboard.boat === b && !quiet) S.aboard = null;
    player.setHidden(false); player.resetPose();
  }
  function leaveHelm(b) {
    b.driven = false; game.vehicle = null; game.mode = 'foot';
    const h = b.spec.helm;
    S.aboard = { boat: b, lx: h.x + (h.x < 0 ? 0.7 : -0.7), lz: h.z - 0.2, ly: 0, vx: 0, vz: 0, seat: null };
    const hy = heightAt(b.spec, S.aboard.lx, S.aboard.lz, h.y);
    if (hy === null) { S.aboard.lx = b.spec.board.x; S.aboard.lz = b.spec.board.z; S.aboard.ly = heightAt(b.spec, b.spec.board.x, b.spec.board.z); } else S.aboard.ly = hy;
    player.resetPose(); placeDeck(0);
  }
  // somewhere dry to step onto within reach of a point (a pier, the boardwalk, the beach)
  function dryNear(b, wx, wz, reach) {
    if (shoreDist(wx, wz) > reach + 2 && !onDeck(wx, wz) && Math.abs(wx - (MPIER.x0 + MPIER.x1) / 2) > reach + 8) return null;     // nothing dry in reach out here
    for (let d = 0.8; d <= reach; d += 0.6) for (let i = 0; i < 24; i++) {
      const a = i / 24 * PI * 2, x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d;
      if (!(onLand(x, z) || onDeck(x, z)) || (depthAt(x, z) > 0.05 && !onDeck(x, z))) continue;
      if (L.solids.some((s) => x > s.x0 - 0.5 && x < s.x1 + 0.5 && z > s.z0 - 0.5 && z < s.z1 + 0.5)) continue;
      if (b && hullDist(b, x, z) < 0.4) continue;
      return { x, y: 0, z };
    }
    return null;
  }
  function ashore(b, p) {
    if (game.vehicle === b) { b.driven = false; game.vehicle = null; game.mode = 'foot'; }
    S.aboard = null; game.act.reset();
    const y = Math.max(0, L.surf.at(p.x, p.z, 2));
    player.pos.set(p.x, y, p.z); player.floor = y; player.vel.set(0, 0, 0); player.vy = 0; player.onGround = true; player.fallFrom = y;
    player.yaw = Math.atan2(p.x - b.x, p.z - b.z); player.setHidden(false); player.resetPose();
    audio.step(0.8);
    // a rental left at a dock: it goes back to its stand when you walk away
    if (b === S.test) endTest();
  }
  function intoSea(b) {
    const T = b.spec, p = toWorld(b, T.B / 2 + 1.0, 0, -T.L * 0.1, {});
    off(b); S.aboard = null;
    game.swim.drop(p.x, p.z, b.vx * 0.3, b.vz * 0.3, WL + 0.6);
    audio.splash(0.6);
    if (b === S.test) endTest();
  }
  // the deck: move, stay on it, ride along with it
  function placeDeck(dt, turn = 0) {
    const A = S.aboard, b = A.boat, p = toWorld(b, A.lx, A.ly, A.lz, {});
    player.pos.set(p.x, p.y, p.z); player.floor = p.y; player.sy = 0;
    if (dt > 0) player.animate(dt, turn, audio); else { player.model.root.position.copy(player.pos); }
    player.shadow.position.set(p.x, p.y + 0.03, p.z);
  }
  function deck(dt, ctl, cam) {
    const A = S.aboard;
    if (!A || game.vehicle) return false;
    const b = A.boat;
    if (b.off) { S.aboard = null; return false; }
    // seated: keep the seat under her as the boat moves (game/activity.js does the pose)
    if (game.act.mode) {
      if (A.seat) { const s = A.seat, r = s.ref, p = toWorld(b, r.x, heightAt(b.spec, r.x, r.z, r.fy) ?? r.fy, r.z, {}); s.x = p.x; s.z = p.z; s.floorY = p.y; s.yaw = b.yaw + r.yaw; }
      game.act.update(dt, ctl, game.input);
      if (!game.act.mode) { if (A.seat) { const [lx, lz] = toLocal(b, player.pos.x, player.pos.z); if (heightAt(b.spec, lx, lz) !== null) { A.lx = lx; A.lz = lz; } A.seat = null; } }
      waitTick();
      player.onGround = true;
      return true;
    }
    if (S.wait) endWait(false);
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const wx = fx * ctl.move - fz * ctl.strafe, wz = fz * ctl.move + fx * ctl.strafe, len = Math.hypot(wx, wz);
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    let lx = c * wx - s * wz, lz = s * wx + c * wz;
    const top = (ctl.sprint ? 5.2 : 3.4) * (player.boost || 1);
    if (len > 0) { const k = top * Math.min(1, len) / len; lx *= k; lz *= k; }
    A.vx = damp(A.vx, lx, len > 0 ? 8 : 6, dt); A.vz = damp(A.vz, lz, len > 0 ? 8 : 6, dt);
    const T = b.spec, P0 = { x: A.lx + A.vx * dt, z: A.lz + A.vz * dt };
    for (const k of T.blocks || []) if (k.y0 === undefined || (A.ly >= k.y0 - 0.2 && A.ly < k.y1)) pushOut(P0, 0.3, k);
    let h = heightAt(T, P0.x, P0.z, A.ly);
    if (h === null) { h = heightAt(T, P0.x, A.lz, A.ly); if (h !== null) { P0.z = A.lz; A.vz = 0; } else { h = heightAt(T, A.lx, P0.z, A.ly); if (h !== null) { P0.x = A.lx; A.vx = 0; } else { P0.x = A.lx; P0.z = A.lz; A.vx = A.vz = 0; h = A.ly; } } }
    A.lx = P0.x; A.lz = P0.z; A.ly = h >= A.ly ? h : Math.max(h, A.ly - dt * 6);
    const sp = Math.hypot(A.vx, A.vz);
    player.speed = sp; player.onGround = true; player.vel.set(0, 0, 0); player.vy = 0;
    let turn = 0;
    if (sp > 0.4) { const yw = b.yaw + Math.atan2(A.vx, A.vz); turn = angleDelta(player.yaw, yw); player.yaw += turn * (1 - Math.exp(-10 * dt)); }
    else player.yaw += b.yawRate * dt;
    placeDeck(dt, turn);
    // Space: dive off the nearest side (or off the stern from the swim platform)
    if (ctl.jump && !S.jumpWas) dive(b);
    S.jumpWas = ctl.jump;
    return true;
  }
  function dive(b) {
    const A = S.aboard, T = b.spec;
    const aft = A.lz < -T.L / 2 + 1.6, side = Math.abs(A.lx) > 0.2 ? Math.sign(A.lx) : 1;
    const lx = aft ? A.lx : side * (T.B / 2 + 1.2), lz = aft ? Math.min(...T.deck.map((d) => d.z0)) - 1.6 : A.lz;
    const p = toWorld(b, lx, A.ly, lz, {}), dirx = p.x - player.pos.x, dirz = p.z - player.pos.z, dl = Math.hypot(dirx, dirz) || 1;
    S.aboard = null; game.act.reset();
    player.pos.set(player.pos.x + dirx / dl * 0.6, player.pos.y + 0.1, player.pos.z + dirz / dl * 0.6);
    player.vel.set(dirx / dl * 3.4 + b.vx, 0, dirz / dl * 3.4 + b.vz); player.vy = 4.2; player.onGround = false;
    player.yaw = Math.atan2(dirx, dirz);
    stats.dives++; audio.jump();
    S.dove = { boat: b, t: timeU.value };
    // the swim code takes the fall from here (player/swim.js): over the water it splashes in
    game.swim.drop(p.x, p.z, dirx / dl * 2.6 + b.vx * 0.5, dirz / dl * 2.6 + b.vz * 0.5, player.pos.y);
    player.vy = 4.2;
  }
  // in the water by a ladder (or a jet ski's stern): climb aboard
  function ladderNear(x, z, reach = 2.6) {
    let best = null, bd = reach;
    for (const b of active()) {
      if (b.role === 'ai' || b.down || (b.role === 'rent' && S.rent !== b) || (b.role === 'test' && S.test !== b)) continue;
      const T = b.spec, l = T.ladder; if (!l) continue;
      const p = toWorld(b, l[0], 0, l[1], {}), d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function climb(b) {
    const T = b.spec;
    game.swim.sleep(game.cam); stats.climbs++;
    if (!T.deck) { takeHelm(b); return; }
    boardDeck(b, T.plat || T.board);
    hud.toast('ABOARD THE ' + T.model, 'UP THE LADDER AND DRIPPING');
  }

  // ---------------------------------------------------------------- the rentals and the test ride
  function rent(si) {
    const site = RENTAL_SITES[si];
    const b = rentals.find((r) => r.site === si && !r.driven && !r.down && !r.rentedT && Math.hypot(r.x - r.home.x, r.z - r.home.z) < 3);
    if (!b) { hud.toast('ALL OUT ON THE WATER', 'COME BACK IN A MINUTE'); audio.blip(false); return true; }
    if (game.money < RENT_FEE) { hud.toast(`A RIDE IS $${RENT_FEE}`, 'NOT ENOUGH CASH'); audio.blip(false); return true; }
    game.money -= RENT_FEE; audio.cash(); stats.rentals++;
    if (S.rent && S.rent !== b) retire(S.rent);
    S.rent = b; b.rentedT = 1;
    takeHelm(b);
    hud.toast('ZIPFIN RENTAL · -$' + RENT_FEE, `${site.name} · BRING IT BACK TO A STAND (E) · SPACE TO JUMP`);
    return true;
  }
  function retire(b) { b.rentedT = 0; if (S.rent === b) S.rent = null; if (unseen(camera, b.x, b.z, 30) || Math.hypot(b.x - b.home.x, b.z - b.home.z) < 20) home(b); else b.returning = true; }
  function returnRental(b, si) {
    const site = RENTAL_SITES[si], r = site.ring;
    ashore(b, { x: r.x, y: 0, z: r.z });
    home(b); S.rent = null; stats.returns++;
    hud.toast('RETURNED · THANKS FOR RIDING ZIPFIN', site.name);
  }
  function startTest(id) {
    const T = BOAT_TYPES[id];
    const b = tests[id] || (tests[id] = make(id, 'test', TEST_SPOT));
    b.off = false; Object.assign(b.home, TEST_SPOT); home(b); b.off = false;
    S.test = b; S.testT = TEST_S; S.testFrom = game.inside; stats.tests++;
    game.busy = 'door'; game.cut.fade(true);
    setTimeout(() => {
      game.places.putOutside(TEST_SPOT.x, TEST_SPOT.z - 6, PI);
      takeHelm(b);
      game.busy = null; setTimeout(() => game.cut.fade(false), 80);
      hud.toast('TEST RIDE: ' + T.model, `${TEST_S} SECONDS ON THE HOUSE · E ENDS IT`);
    }, reducedMotion ? 200 : 450);
  }
  function endTest() {
    const b = S.test; if (!b) return;
    S.test = null;
    const p = game.places.byKey('boats');
    if (game.vehicle === b) { b.driven = false; game.vehicle = null; game.mode = 'foot'; }
    if (S.aboard && S.aboard.boat === b) S.aboard = null;
    if (game.swim.wet) game.swim.sleep(game.cam);
    game.busy = 'door'; game.cut.fade(true);
    setTimeout(() => {
      b.off = true; b.driven = false;
      const [x, z] = game.places.outside(p); game.places.putOutside(x, z, game.places.faceYaw(p));
      game.busy = null; setTimeout(() => game.cut.fade(false), 80);
      hud.toast('TEST RIDE OVER', 'MARISOL: “SO? SHE HANDLES LIKE A DREAM, RIGHT?”');
    }, reducedMotion ? 200 : 400);
  }

  // ---------------------------------------------------------------- the dealer: listings, test rides, buying
  let ph = null, menuMode = 'top', cur = null, menuSel = null;
  function photoEl() {
    if (ph) return ph;
    ph = document.createElement('canvas'); ph.width = 320; ph.height = 150; ph.id = 'shopbt';
    ph.style.cssText = 'display:none;width:100%;max-width:320px;height:auto;margin:4px auto 6px;border:2px solid #27d8cf;border-radius:4px';
    const bx = $('shop'), l = $('shopl'); if (bx && l) bx.insertBefore(ph, l);
    return ph;
  }
  function paint(id) {
    const c = photoEl().getContext('2d'), W = 320, H = 150, T = BOAT_TYPES[id];
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, id === 'motor' ? '#ff8a6a' : '#7fd0ff'); g.addColorStop(1, id === 'motor' ? '#ffd9a0' : '#e8f8ff'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = id === 'motor' ? '#ffd447' : '#fff6a0'; c.beginPath(); c.arc(250, 40, 18, 0, 6.3); c.fill();
    c.fillStyle = '#2a6a8a'; c.fillRect(0, 92, W, 58); c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 14; i++) c.fillRect((i * 53) % W, 100 + (i * 17) % 40, 26, 2);
    const s = { jetski: 0.55, runabout: 0.75, sport: 0.95, motor: 1.15 }[id], cx = 150, base = 96, len = 200 * s, hgt = 26 * s;
    const hullC = { jetski: '#ff3f9a', runabout: '#f6f1e7', sport: '#f6f1e7', motor: '#f6f1e7' }[id], band = { jetski: '#27d8cf', runabout: '#ff6a8a', sport: '#27d8cf', motor: '#1b2350' }[id];
    // the wake behind her
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(cx - len / 2, base + 2); c.lineTo(cx - len / 2 - 90, base + 14); c.lineTo(cx - len / 2 - 90, base + 6); c.fill();
    c.fillStyle = hullC; c.beginPath(); c.moveTo(cx - len / 2, base - hgt); c.lineTo(cx + len / 2, base - hgt * 1.25); c.lineTo(cx + len / 2 - 22 * s, base + 4); c.lineTo(cx - len / 2, base + 4); c.closePath(); c.fill();
    c.fillStyle = band; c.fillRect(cx - len / 2, base - hgt * 0.55, len * 0.86, hgt * 0.22);
    c.fillStyle = '#1b2a5a'; c.fillRect(cx - len / 2, base, len * 0.9, 4);
    if (id === 'jetski') { c.fillStyle = '#22203a'; c.fillRect(cx - 30, base - hgt - 10, 50, 10); c.fillStyle = '#d9d6e6'; c.fillRect(cx + 18, base - hgt - 22, 4, 16); }
    if (id === 'runabout') { c.fillStyle = '#3f6f8f'; c.beginPath(); c.moveTo(cx + 10, base - hgt); c.lineTo(cx + 30, base - hgt - 18); c.lineTo(cx + 40, base - hgt); c.fill(); c.fillStyle = '#22203a'; c.fillRect(cx - len / 2 - 8, base - hgt - 6, 10, 26); }
    if (id === 'sport' || id === 'motor') {
      c.fillStyle = '#f6f1e7'; c.fillRect(cx - len * 0.25, base - hgt - 22 * s, len * 0.48, 22 * s); c.fillStyle = '#3f6f8f'; c.fillRect(cx - len * 0.22, base - hgt - 17 * s, len * 0.42, 9 * s);
      c.fillStyle = '#f6f1e7'; c.fillRect(cx - len * 0.3, base - hgt - 26 * s, len * 0.4, 4 * s);
    }
    if (id === 'motor') { c.fillStyle = '#f6f1e7'; c.fillRect(cx - len * 0.28, base - hgt - 44 * s, len * 0.34, 20 * s); c.fillStyle = '#3f6f8f'; c.fillRect(cx - len * 0.25, base - hgt - 38 * s, len * 0.28, 7 * s); c.fillStyle = '#5fd8e8'; c.fillRect(cx - len * 0.24, base - hgt - 46 * s, 30, 4); }
    c.fillStyle = 'rgba(10,6,24,.72)'; c.fillRect(0, H - 22, W, 22); c.fillStyle = '#27d8cf'; c.font = 'bold 13px monospace'; c.textAlign = 'left'; c.fillText(T.model, 8, H - 7);
    c.textAlign = 'right'; c.fillStyle = owns(id) ? '#8dff5a' : '#fff'; c.fillText(owns(id) ? 'YOURS' : money(T.price), W - 8, H - 7);
  }
  const showPhoto = (on) => { photoEl().style.display = on ? 'block' : 'none'; };
  const owns = (id) => (save.boats || []).includes(id);
  const specLine = (T) => `${T.tier} · ${T.L.toFixed(1)} M · TOP ${T.knots} KNOTS${T.sleeps ? ` · SLEEPS ${T.sleeps}` : ''} · ${T.features}`;
  const say = (line) => `MARISOL: “${line}”`;
  const PITCH = {
    jetski: 'The Zipfin. Light, loud and it will jump a wave if you ask it nicely. Space, to be precise.',
    runabout: 'The Glintwave nineteen. Open cockpit, an outboard that sings, turns on a coin. My first love.',
    sport: 'The Coralyne thirty-four. A cabin to sleep in, a cockpit for friends, a swim platform for showing off.',
    motor: 'The Halcyon Grande fifty-two. A saloon with a bar, cabins below, a hot tub on the flybridge. Fireworks nights out on the bay, darling.',
  };
  const salesMenu = {
    get title() { return menuMode === 'top' ? 'SEAGLASS MARINE · FOR SALE' : cur.model; },
    get label() { return menuMode === 'top' ? 'DETAILS' : 'CHOOSE'; },
    get mode() { return menuMode; },
    open() { menuMode = 'top'; cur = null; showPhoto(true); paint(BOAT_IDS[0]); },
    close() { showPhoto(false); menuMode = 'top'; cur = null; },
    greet: () => say('Four on the water today. Every one comes with a private berth on the pier, right outside.'),
    items() {
      if (menuMode === 'top') return BOAT_IDS.map((id) => { const T = BOAT_TYPES[id]; return { name: T.name, note: specLine(T), tag: owns(id) ? 'YOURS' : money(T.price), boat: T }; });
      return [{ name: 'TEST RIDE', note: `${TEST_S} seconds out on the water off the boardwalk, on the house. E ends it early.`, tag: 'FREE', act: 'test' },
        { name: owns(cur.id) ? 'ALREADY YOURS' : 'BUY', note: owns(cur.id) ? 'She is at your berth on the marina pier.' : `Pay ${money(cur.price)}: she goes on your private berth on the Starboard Marina pier, an anchor on the map.`, tag: owns(cur.id) ? 'OWNED' : money(cur.price), act: 'buy' },
        { name: 'BACK', note: 'The other boats.', tag: '', act: 'back' }];
    },
    preview(o) { if (o && o.boat) paint(o.boat.id); },
    pick(o) {
      if (menuMode === 'top') { cur = o.boat; menuMode = 'boat'; menuSel = 0; paint(cur.id); audio.blip(true); return say(PITCH[cur.id]); }
      if (o.act === 'back') { menuMode = 'top'; menuSel = BOAT_IDS.indexOf(cur.id); return ''; }
      if (o.act === 'test') { const id = cur.id; game.places.closeShop(); startTest(id); return null; }
      if (owns(cur.id)) { audio.blip(false); return 'SHE IS ALREADY YOURS'; }
      if (game.money < cur.price) { audio.blip(false); return `NOT ENOUGH CASH: THE ${cur.model} IS ${money(cur.price)} (YOU HAVE ${money(Math.floor(game.money))})`; }
      return buy(cur.id);
    },
    takeSel() { const k = menuSel; menuSel = null; return k; },
    back() { if (menuMode !== 'top') { menuSel = BOAT_IDS.indexOf(cur.id); menuMode = 'top'; return true; } return false; },
  };
  function buy(id) {
    const T = BOAT_TYPES[id];
    game.money -= T.price; if (!save.boats) save.boats = []; save.boats.push(id); stats.bought++;
    ensureOwned(); home(own[id]);
    audio.cash(); audio.pickup(); game.persist();
    hud.toast('SOLD! ' + T.model, 'SHE IS AT YOUR PRIVATE BERTH ON THE MARINA PIER · AN ANCHOR ON THE MAP');
    paint(id);
    return say('Congratulations, captain. Sign here, and here. She is waiting for you at the berth.');
  }
  let sleepMenuAct = null;
  const sleepMenu = {
    title: 'THE CABIN', label: 'SLEEP', items: () => SLEEP,
    greet: () => (game.wanted > 0 ? 'THE SIRENS ON SHORE WON\'T LET YOU SLEEP' : 'THE BERTH IS MADE UP. WHEN DO YOU WANT TO WAKE?'),
    pick(o) {
      if (game.wanted > 0) { audio.blip(false); return 'NOT WITH HEAT ON YOU'; }
      game.places.closeShop();
      if (o.to === undefined) { const r = game.saves.manual(); hud.toast(r.ok ? 'GAME SAVED' : r.why, r.ok ? 'ABOARD THE ' + (S.aboard ? S.aboard.boat.spec.model : 'BOAT') : ''); if (r.ok) audio.pickup(); return null; }
      sleepMenuAct = o; sleepNow(o.to); return null;
    },
  };
  function sleepNow(to) {
    game.busy = 'door'; game.cut.fade(true); stats.sleeps++;
    setTimeout(() => {
      if (to < env.tod) env.day = (env.day || 1) + 1;
      env.tod = to; env.target = null; game.health = Math.min(100, game.health + 25);
      const r = game.saves.manual();
      game.busy = null; setTimeout(() => game.cut.fade(false), 150);
      hud.toast(r.ok ? 'GAME SAVED' : r.why, 'THE SEA ROCKED YOU TO SLEEP · +25 HEALTH');
      audio.pickup();
    }, reducedMotion ? 400 : 1400);
  }
  let barCd = 0;
  const barMenu = {
    title: 'THE SALOON BAR', label: 'MIX',
    items: () => BAR.map((o) => ({ ...o, price: 0, tag: 'FREE' })),
    greet: () => (timeU.value < barCd ? 'THE ICE IS STILL FREEZING' : 'CRYSTAL, A SHAKER, A LITTLE FRIDGE'),
    pick(o) { if (timeU.value < barCd) { audio.blip(false); return `NO ICE · BACK IN ${Math.ceil(barCd - timeU.value)} S`; } barCd = timeU.value + 45; stats.drinks++; audio.pickup(); return game.eat.consume(o); },
  };
  const MENUS = { boatsales: salesMenu, boatsleep: sleepMenu, boatbar: barMenu };

  // ---------------------------------------------------------------- seats with a view: wait for the sunset or the night
  function seatNear() {
    const A = S.aboard; if (!A || game.vehicle) return null;
    const b = A.boat, T = b.spec;
    let best = null, bd = 1.3;
    for (const s of T.seats || []) {
      const h = heightAt(T, s.x, s.z, A.ly); if (h === null || (s.fy !== undefined && Math.abs(s.fy - A.ly) > 0.6)) continue;
      const d = Math.hypot(A.lx - s.x, A.lz - s.z); if (d < bd) { bd = d; best = s; }
    }
    if (!best) return null;
    const fy = best.fy ?? heightAt(T, best.x, best.z, A.ly), p = toWorld(b, best.x, fy, best.z, {});
    const ref = { ...best, fy }, seat = { x: p.x, z: p.z, y: best.y, yaw: b.yaw + best.yaw, kind: best.kind, ref, floorY: p.y };
    return seat;
  }
  const seatedView = () => !!(S.aboard && game.act.mode === 'sit' && !game.act.rising && S.aboard.seat && S.aboard.seat.ref.view);
  function wait(which) {
    if (!seatedView()) return false;
    const h = env.tod, to = which === 'sunset' ? SUNSET : NIGHT;
    if (which === 'sunset' && h >= SUNSET - 0.2 && h < 21) { hud.toast('THE SUN IS ALREADY GOING DOWN', 'SIT BACK AND WATCH IT'); return true; }
    if (which === 'night' && (h >= NIGHT - 0.2 || h < 4.5)) { hud.toast('IT IS ALREADY NIGHT', 'THE COAST IS LIT UP'); return true; }
    env.target = to; env.ffRate = (d) => clamp(d * 0.55, 0.3, 2.4);
    S.wait = which; stats.waits++;
    hud.toast(which === 'sunset' ? 'WAITING FOR THE SUNSET' : 'WAITING FOR THE NIGHT', 'F / E / WASD: GET UP ANY TIME'); audio.blip(true);
    return true;
  }
  function waitTick() { if (S.wait && env.target === null) { const w = S.wait; S.wait = null; env.ffRate = null; hud.toast(w === 'sunset' ? 'SUNSET FROM THE DECK' : 'NIGHT ON THE WATER', 'NOT A BAD VIEW'); } else if (S.wait && !seatedView()) endWait(false); }
  function endWait(reached) { if (!S.wait) return; S.wait = null; env.ffRate = null; if (!reached) env.target = null; }

  // ---------------------------------------------------------------- the rider at the helm
  const proxy = { x: 0, y: 0, z: 0, yaw: 0, tx: 0, tz: 0, spec: null };
  function pose(steer) {
    const b = game.vehicle; if (!b || !b.boat) return;
    const fp = game.cam.first;
    player.model.root.visible = !fp;
    if (fp) return;
    const T = b.spec;
    if (T.rider === 'straddle') {
      const st = T.seat, p = toWorld(b, st[0], st[1], st[2], {}), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      Object.assign(proxy, { x: p.x + fx * 0.95, y: p.y - 0.78, z: p.z + fz * 0.95, yaw: b.yaw, tx: b.tx * 0.8, tz: b.tz });
      player.ride(proxy);
      player.model.root.rotation.set(b.tx * 0.8 + (b.speed > 8 ? 0.12 : 0), b.yaw, b.tz - steer * 0.12, 'YXZ');
    } else player.sitIn(b, steer);
    player.pos.set(b.x, b.y, b.z);
  }

  // ---------------------------------------------------------------- per frame
  function update(dt, ctl) {
    if (dt <= 0) return;
    seaState(dt); ensureOwned();
    const v = game.vehicle, cx = camera.position.x, cz = camera.position.z;
    const inp = v && v.boat && !game.busy ? { throttle: v.down ? 0 : ctl.throttle, steer: v.down ? 0 : ctl.steer, hop: ctl.up } : null;
    const list = active();
    for (const b of list) {
      const near = Math.hypot(b.x - cx, b.z - cz);
      if (b.role === 'ai') aiStep(b, dt);
      else if (b.down) sinkStep(b, dt);
      else {
        const mine = b === v ? inp : null;
        if (!mine && !b.driven) moor(b, dt);
        physics(b, dt, mine, near);
        bounds(b, dt);
      }
      effects(b, dt, near, b === v ? inp : null);
      if (b.hp !== undefined && !b.down && b.maxHp && b.hp / b.maxHp <= 0.18) sinkStart(b);
    }
    pairs(list);
    // the moving decks carry you (and push swimmers out of the hulls)
    if (game.swim && game.swim.wet && !S.aboard) for (const b of list) {
      if (player.pos.y < WL - b.spec.draft - 0.6) continue;
      for (const c of circles(b)) { const dx = player.pos.x - c[0], dz = player.pos.z - c[1], d = Math.hypot(dx, dz), r = c[2] + 0.35; if (d < r && d > 1e-4) { player.pos.x += dx / d * (r - d); player.pos.z += dz / d * (r - d); } }
    }
    // housekeeping: rentals left behind go home, your boats go back to their berths when abandoned far away
    for (const b of rentals) {
      if (b.driven || b.down) continue;
      const far = Math.hypot(player.pos.x - b.x, player.pos.z - b.z);
      if (S.rent === b && !(S.aboard && S.aboard.boat === b)) { b.leftT = (b.leftT || 0) + dt; if ((far > 70 || b.leftT > 120) && !(game.swim.wet && far < 30)) { retire(b); hud.toast('RENTAL RETURNED', 'THE ZIPFIN CREW TOWED IT BACK TO THE STAND'); } } else b.leftT = 0;
      if (b.returning && unseen(camera, b.x, b.z, 40)) { b.returning = false; home(b); }
    }
    for (const id in own) {
      const b = own[id]; if (b.off || b.driven || b.down || (S.aboard && S.aboard.boat === b)) { b.awayT = 0; continue; }
      const far = Math.hypot(player.pos.x - b.x, player.pos.z - b.z), away = Math.hypot(b.x - b.home.x, b.z - b.home.z) > 14;
      if (away && far > 150) { b.awayT = (b.awayT || 0) + dt; if (b.awayT > 40 && unseen(camera, b.x, b.z, 60)) { home(b); b.awayT = 0; } } else b.awayT = 0;
    }
    if (S.test) { S.testT -= dt; if (S.testT <= 0 && !game.busy) endTest(); }
    if (S.aboard && S.aboard.boat.off) S.aboard = null;
    if (S.dove && timeU.value - S.dove.t > 600) S.dove = null;
    // the rings at your berths, the rental stands
    const show = !game.inside && !game.busy;
    for (const id in rings) { const b = own[id]; rings[id].visible = show && !!b && !b.off && !b.driven && Math.hypot(b.x - b.home.x, b.z - b.home.z) < 14; }
    for (const m of siteRings) m.visible = show;
    // your boat's lamps light its wake at night; the lights on every hull
    const mine = v && v.boat ? v : S.aboard ? S.aboard.boat : null;
    if (mine) water.lamp.value.set(mine.x - Math.sin(mine.yaw) * mine.spec.L * 0.45, mine.z - Math.cos(mine.yaw) * mine.spec.L * 0.45, 7 + mine.spec.L * 0.4, 0.9); else water.lamp.value.w = 0;
    water.update(dt, game.sea && game.sea.under);
    sound(dt, v);
    for (const b of boats) draw(b);
    glow.commit();
  }
  // wakes, spray, ripples (only where somebody could see them)
  function effects(b, dt, near, inp) {
    const T = b.spec, sp = Math.hypot(b.vx, b.vz);
    if (near > 420 || b.down) return;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    // the wake is laid from the bow (so its arms run back along the hull, a Kelvin V); the churn shows past the stern
    const sx = b.x - fx * T.L * 0.47, sz = b.z - fz * T.L * 0.47, wx = b.x + fx * T.L * 0.36, wz = b.z + fz * T.L * 0.36;
    if (sp > 1.2 && !b.air) {
      const step = Math.max(1.0, sp * 0.07);
      if (Math.hypot(wx - b.emit.x, wz - b.emit.z) > step) {
        b.emit.x = wx; b.emit.z = wz;
        const vf = Math.max(0, b.vx * fx + b.vz * fz);
        water.emit(b.wk, wx, wz, rx, rz, vf, T.B * 0.8, clamp(0.3 + vf / (T.top || T.speed * 2) * 0.95, 0, 1.1) * (b.role === 'ai' ? T.wake : 1));
      }
    } else if (sp < 0.6) b.wk.last = null;
    if (near > 160) return;
    const k = quality.high ? 1 : 0.45, vf = b.vx * fx + b.vz * fz;
    if (!b.air && vf > 5 && b.role !== 'ai') {
      // bow spray: sheets off both sides of the bow, more with speed (and when turning hard)
      let n = (vf - 5) * (T.kind === 'jetski' ? 3.5 : 3) * k * dt * (1 + Math.abs(b.yawRate) * 1.5);
      while (n > 0) {
        if (Math.random() < n) for (const s of [-1, 1]) {
          const a = 0.15 + Math.random() * 0.25, bx = b.x + fx * T.L * a + rx * s * T.B * 0.45, bz = b.z + fz * T.L * a + rz * s * T.B * 0.45, out = 1.4 + vf * 0.14 * Math.random();
          water.drop(bx, WL + b.heave + 0.1, bz, rx * s * out + b.vx * 0.6, 1.2 + vf * 0.12 * (0.6 + Math.random() * 0.6), rz * s * out + b.vz * 0.6, 0.16 + vf * 0.009, 0.35 + Math.random() * 0.35);
        }
        n -= 1;
      }
      // the stern: churned mist (a jet ski throws a rooster tail)
      if (Math.random() < (T.kind === 'jetski' ? 9 : 4) * k * dt * clamp(vf / 10, 0, 2)) {
        if (T.kind === 'jetski') water.drop(sx, WL + b.heave + 0.15, sz, -fx * vf * 0.25 + (Math.random() - 0.5), 3.2 + vf * 0.08, -fz * vf * 0.25 + (Math.random() - 0.5), 0.45, 0.7);
        else water.drop(sx + (Math.random() - 0.5) * T.B * 0.6, WL + b.heave + 0.1, sz + (Math.random() - 0.5) * T.B * 0.6, b.vx * 0.3, 0.8 + Math.random(), b.vz * 0.3, 0.5, 0.6);
      }
    }
    // idle: little rings round the hull now and then (and under the throttle at a crawl: prop wash)
    if (sp < 1.0 && near < 90) {
      b.rip -= dt;
      if (b.rip <= 0) {
        b.rip = 1.1 + Math.random() * 1.4;
        const a = Math.random() * PI * 2, lx = Math.cos(a) * T.B * 0.5, lz = Math.sin(a) * T.L * 0.45, p = toWorld(b, lx, 0, lz, {});
        water.ring(p.x, p.z, 0.25, 0.7, 0.45);
      }
    }
    if (inp && inp.throttle > 0.2 && sp < 4 && Math.random() < dt * 4 * k) water.ring(sx, sz, 0.3, 1.2, 0.55);
  }
  function draw(b) {
    const m = b.mesh;
    m.visible = !b.off;
    if (b.off) { for (let i = 0; i < 4; i++) glow.hide(b.g + i); return; }
    m.position.set(b.x, b.y, b.z); m.rotation.set(b.tx, b.yaw, b.tz, 'YXZ');
    // nav lights: red to port, green to starboard, a white stern / masthead light; a warm deck light on the yachts
    const T = b.spec, hw = T.B * 0.45, l = T.light || [0, T.L * 0.12 + 2, -T.L * 0.2];
    const pr = toWorld(b, hw, (T.L > 8 ? 1.6 : 0.6), T.L * 0.25, {}); glow.set(b.g, pr.x, pr.y, pr.z, '#ff2a3a', 1.6 + T.L * 0.06, 0);
    const st = toWorld(b, -hw, (T.L > 8 ? 1.6 : 0.6), T.L * 0.25, {}); glow.set(b.g + 1, st.x, st.y, st.z, '#3aff7a', 1.6 + T.L * 0.06, 0);
    const mh = toWorld(b, l[0], l[1], l[2], {}); glow.set(b.g + 2, mh.x, mh.y, mh.z, '#fff6e0', 1.8 + T.L * 0.08, 0);
    if (T.L > 8) { const dk = toWorld(b, 0, (T.deck ? T.deck[0].y : 1) + 1.6, -T.L * 0.3, {}); glow.set(b.g + 3, dk.x, dk.y, dk.z, '#ffd9a0', 4 + T.L * 0.3, 0); } else glow.hide(b.g + 3);
  }
  // engine (main.js passes the profile and revs), the water rushing past, the slap of the waves, lapping when still
  function sound(dt, v) {
    const b = v && v.boat ? v : S.aboard ? S.aboard.boat : null;
    const sp = b ? Math.hypot(b.vx, b.vz) / b.spec.top : 0;
    S.rush = damp(S.rush, b ? clamp(sp, 0, 1.2) * (v === b ? 1 : 0.6) : 0, 3, dt);
    S.air = b && b.air ? 1 : 0;
    let lap = 0;
    if (!game.inside) for (const q of boats) { if (q.off || q.role === 'ai') continue; const d = Math.hypot(q.x - camera.position.x, q.z - camera.position.z); lap = Math.max(lap, (1 - d / 25) * (Math.hypot(q.vx, q.vz) < 2 ? 1 : 0.3)); }
    S.lap = clamp(lap, 0, 1) * 0.6;
  }

  // ---------------------------------------------------------------- E, hints, touch
  const nearRing = () => { for (const id in rings) if (rings[id].visible && Math.hypot(player.pos.x - rings[id].position.x, player.pos.z - rings[id].position.z) < 1.6) return own[id]; return null; };
  const nearSite = (r = 1.8) => RENTAL_SITES.findIndex((s) => Math.hypot(player.pos.x - s.ring.x, player.pos.z - s.ring.z) < r);
  const nearRentalReturn = (b) => RENTAL_SITES.findIndex((s) => Math.hypot(b.x - s.ring.x, b.z - s.ring.z) < 16);
  function boardable(x, z) {
    let best = null, bd = 2.6;
    for (const b of active()) {
      if (b.role === 'ai' || b.down || b.driven || (b.role === 'rent' && S.rent !== b) || (b.role === 'test' && S.test !== b)) continue;
      const d = hullDist(b, x, z); if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // the deck hints ask every frame (hint and touch): look for a dock a few times a second
  let dryMemo = { t: -1, p: null };
  const dryHint = (b) => { if (timeU.value - dryMemo.t > 0.25 || timeU.value < dryMemo.t) dryMemo = { t: timeU.value, p: dryNear(b, player.pos.x, player.pos.z, 7) }; return dryMemo.p; };
  function useNear() {
    const A = S.aboard; if (!A || game.vehicle) return null;
    const T = A.boat.spec;
    const lvl = (u) => Math.abs((u.y ?? heightAt(T, u.x, u.z, A.ly) ?? -9) - A.ly) < 0.6;
    if (T.helm && Math.hypot(A.lx - T.helm.x, A.lz - T.helm.z) < T.helm.r && lvl(T.helm)) return { kind: 'helm', hint: 'take the helm' };
    for (const u of T.uses || []) if (Math.hypot(A.lx - u.x, A.lz - u.z) < u.r && lvl(u)) return u;
    return null;
  }
  function interact() {
    if (game.busy || game.act.mode) return false;
    const v = game.vehicle;
    if (v && v.boat) {
      if (v === S.test) { endTest(); return true; }
      if (v === S.rent) { const si = nearRentalReturn(v); if (si >= 0) { returnRental(v, si); return true; } }
      if (v.spec.deck) { leaveHelm(v); return true; }
      // the jet ski: step off onto a dock if there is one in reach, else slide off into the sea
      const atBerth = v.role === 'own' && Math.hypot(v.x - v.home.x, v.z - v.home.z) < 4 ? BERTHS[v.type].ring : null;
      const p = atBerth ? { x: atBerth.x, y: 0, z: atBerth.z } : dryNear(v, v.x, v.z, 3.6);
      if (p) ashore(v, p); else intoSea(v);
      return true;
    }
    if (v) return false;
    // swimming by a ladder
    if (game.swim && game.swim.wet) { const b = ladderNear(player.pos.x, player.pos.z); if (b) { climb(b); return true; } return false; }
    if (S.aboard) {
      const b = S.aboard.boat, u = useNear();
      if (u && u.kind === 'helm') { takeHelm(b); return true; }
      if (u && u.kind === 'cabin') { game.places.openShop('boatsleep'); return true; }
      if (u && u.kind === 'bar') { game.places.openShop('boatbar'); return true; }
      const p = dryNear(b, player.pos.x, player.pos.z, 7);
      if (p) { ashore(b, p); return true; }
      hud.toast('NO DOCK IN REACH', 'SPACE DIVES IN · THE HELM IS ' + (b.spec.helm ? 'BY THE WHEEL' : 'AHEAD'));
      return true;
    }
    // on foot: your berth's ring, a rental stand, or a boat right beside you
    const si = nearSite(); if (si >= 0) return rent(si);
    const r = nearRing(); if (r) { if (r.spec.deck) boardDeck(r); else takeHelm(r); hud.toast('ABOARD THE ' + r.spec.model, r.spec.deck ? 'E AT THE WHEEL TO DRIVE · F TO SIT · SPACE TO DIVE IN' : 'W TO GO · SPACE TO JUMP'); return true; }
    if (player.pos.y > -0.3) { const b = boardable(player.pos.x, player.pos.z); if (b) { if (b.spec.deck) boardDeck(b); else takeHelm(b); return true; } }
    return false;
  }
  function hint() {
    const v = game.vehicle;
    if (v && v.boat) {
      const out = [['W S', 'throttle / reverse'], ['A D', 'steer']];
      if (v.spec.kind === 'jetski') out.push(['Space', 'jump']);
      if (v === S.test) out.push(['E', `end the test ride (${Math.max(0, Math.ceil(S.testT))} s)`]);
      else if (v === S.rent && nearRentalReturn(v) >= 0) out.push(['E', 'return the jet ski']);
      else out.push(['E', v.spec.deck ? 'leave the helm' : 'get off']);
      out.push(['V', 'camera view']);
      return out;
    }
    if (v) return null;
    if (game.swim && game.swim.wet) { const b = ladderNear(player.pos.x, player.pos.z); return b ? [['E', b.spec.deck ? 'climb aboard' : 'climb on'], ...game.swim.hint()] : null; }
    if (S.aboard) {
      if (game.act.mode) return seatedView() ? [['1', 'wait for sunset (19:30)'], ['2', 'wait for night (22:00)'], ['F / E / WASD', 'get up']] : [['F / E / WASD', 'get up']];
      const u = useNear(), s = seatNear(), b = S.aboard.boat, p = !u && dryHint(b);
      return [...(u ? [['E', u.hint]] : p ? [['E', 'step ashore']] : []), ...(s ? [['F', 'sit']] : []), ['WASD', 'walk the deck'], ['Space', 'dive in'], ['V', 'camera view']];
    }
    const si = nearSite(); if (si >= 0) return [['E', `rent a jet ski ($${RENT_FEE})`]];
    const r = nearRing(); if (r) return [['E', 'board the ' + r.spec.model]];
    if (player.pos.y > -0.3) { const b = boardable(player.pos.x, player.pos.z); if (b) return [['E', 'board the ' + b.spec.model]]; }
    return null;
  }
  function touchButtons() {
    const v = game.vehicle;
    if (v && v.boat) return [['KeyS', 'REVERSE'], ['KeyE', v === S.test ? 'END' : v === S.rent && nearRentalReturn(v) >= 0 ? 'RETURN' : v.spec.deck ? 'LEAVE HELM' : 'GET OFF'], ...(v.spec.kind === 'jetski' ? [['Space', 'JUMP']] : [])];
    if (v) return null;
    if (game.swim && game.swim.wet) { const b = ladderNear(player.pos.x, player.pos.z); return b ? [['KeyE', 'CLIMB ABOARD'], ...game.swim.touchButtons().filter((q) => q[0] !== 'KeyE')] : null; }
    if (S.aboard) {
      if (game.act.mode) return seatedView() ? [['Digit1', 'SUNSET'], ['Digit2', 'NIGHT'], ['KeyF', 'GET UP']] : [['KeyF', 'GET UP']];
      const u = useNear(), s = seatNear(), b = S.aboard.boat, p = !u && dryHint(b);
      return [['Space', 'DIVE'], ...(u ? [['KeyE', u.kind === 'helm' ? 'HELM' : u.kind === 'bar' ? 'BAR' : 'CABIN']] : p ? [['KeyE', 'ASHORE']] : []), ...(s ? [['KeyF', 'SIT']] : [])];
    }
    if (nearSite() >= 0) return [['Space', 'JUMP'], ['KeyE', 'RENT']];
    if (nearRing() || (player.pos.y > -0.3 && boardable(player.pos.x, player.pos.z))) return [['Space', 'JUMP'], ['KeyE', 'BOARD']];
    return null;
  }
  function blips(out) {
    if (game.inside) return;
    for (const id in own) { const b = own[id]; if (b.off) continue; out.push({ x: BERTHS[id].ring.x, z: BERTHS[id].ring.z - 0.01, color: '#7fe0ff', anchor: true }); if (Math.hypot(b.x - b.home.x, b.z - b.home.z) > 30) out.push({ x: b.x, z: b.z, color: '#7fe0ff', near: true }); }
    for (const s of RENTAL_SITES) out.push({ x: s.ring.x, z: s.ring.z, color: '#ff9ad5', near: true, sq: true });
    if (S.rent && !S.rent.driven) out.push({ x: S.rent.x, z: S.rent.z, color: '#ff9ad5', near: false, diamond: true });
  }

  // ---------------------------------------------------------------- saving (game/saves.js)
  const aboardOwned = () => {
    const v = game.vehicle, b = v && v.boat ? v : S.aboard ? S.aboard.boat : null;
    if (!b || b.role !== 'own' || b.down) return null;
    return { b, moving: Math.hypot(b.vx, b.vz) > 3 || b.air, helm: v === b };
  };
  function resumeAboard(w) {
    ensureOwned();
    const b = own[w.id]; if (!b || b.off) return false;
    // somewhere sensible: where she was if that is open water, else her berth
    const okSea = depthAt(w.x, w.z) > b.spec.draft + 0.2 && seaPull(w.x, w.z).over < -40;
    if (okSea) Object.assign(b, { x: w.x, z: w.z, yaw: w.yaw, vx: 0, vz: 0, yawRate: 0 }); else home(b);
    if (w.helm || !b.spec.deck) takeHelm(b); else boardDeck(b);
    game.cam.yaw = b.yaw; game.cam.pitch = 0.2; game.cam.snap(b);
    return true;
  }

  // ---------------------------------------------------------------- first-person at the helm: the eye rides the hull
  function camLate() {
    const v = game.vehicle;
    if (!v || !v.boat || !game.cam.first || game.cut.active) return;
    const e = v.spec.eye, st = v.spec.seat, p = toWorld(v, st[0], st[1] - 0.86 + e[0] * 0.55, st[2] + e[1] * 0.3, {});
    const cam = game.cam, lp = clamp(cam.pitch - 0.2, -0.9, 0.9), c = Math.cos(lp);
    camera.position.set(p.x, p.y + 0.45, p.z);
    camera.lookAt(p.x + Math.sin(cam.yaw) * c, p.y + 0.45 - Math.sin(lp), p.z + Math.cos(cam.yaw) * c);
    camera.rotateZ(v.tz * 0.7);
  }

  const api = {
    water, boats, own, rentals, ai, stats, S, MENUS,
    menu: (k) => MENUS[k] || null,
    update, deck, pose, camLate, interact, hint, touchButtons, blips, seatNear, seatedView, wait, aboardOwned, resumeAboard, toWorld, ensureOwned,
    // put somewhere else entirely (a respawn, a warp, a door, a scene): off the boat, the boat stays where she is
    drop() { const v = game.vehicle; if (v && v.boat) { v.driven = false; game.vehicle = null; game.mode = 'foot'; } if (S.aboard) { S.aboard = null; if (game.act.mode) game.act.reset(); } player.setHidden(false); },
    // F on deck by a seat (game/activity.js sits her down; the seat rides along with the boat)
    sitHere() { const s = seatNear(); if (s && S.aboard) S.aboard.seat = s; return s; },
    get aboard() { return S.aboard; },
    get sound() { return { rush: S.rush, air: S.air, lap: S.lap }; },
    // a swimmer near the boat she dived off is not swept back by the current (player/swim.js)
    sheltered(x, z) { const d = S.dove; return !!(d && !d.boat.off && Math.hypot(x - d.boat.x, z - d.boat.z) < 45); },
    // on your own boat out in the bay (world/fireworks.js: the guaranteed show)
    inBay() { const o = aboardOwned(); return !!o && shoreDist(o.b.x, o.b.z) > 30; },
    saveKey() { const o = aboardOwned(); return o ? o.b.type + (o.helm ? 'h' : 'd') : S.aboard ? 'x' : ''; },
    snapshot() { const o = aboardOwned(); return o ? { id: o.b.type, x: +o.b.x.toFixed(2), z: +o.b.z.toFixed(2), yaw: +o.b.yaw.toFixed(3), helm: o.helm } : null; },
    reset() { for (const id in own) { scene.remove(own[id].mesh); boats.splice(boats.indexOf(own[id]), 1); delete own[id]; } S.aboard = null; },
    // ---- automated checks: everything is driven from script (software GL runs at ~2 fps)
    debug: {
      state() {
        const v = game.vehicle, b = v && v.boat ? v : S.aboard ? S.aboard.boat : null;
        return { owned: [...(save.boats || [])], driving: !!(v && v.boat), aboard: !!S.aboard, on: b ? b.type : null, role: b ? b.role : null,
          b: b && { x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(3), yaw: +b.yaw.toFixed(3), speed: +Math.hypot(b.vx, b.vz).toFixed(2), pitch: +b.tx.toFixed(3), roll: +b.tz.toFixed(3), air: b.air, hp: b.hp !== undefined ? Math.round(b.hp) : null, down: !!b.down, depth: +depthAt(b.x, b.z).toFixed(2) },
          deck: S.aboard && { lx: +S.aboard.lx.toFixed(2), lz: +S.aboard.lz.toFixed(2), ly: +S.aboard.ly.toFixed(2) }, player: [+player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2)],
          wet: !!(game.swim && game.swim.wet), mode: game.mode, rent: S.rent ? S.rent.site : null, test: !!S.test, amp: +SEA.amp.toFixed(3), water: water.state(), stats: { ...stats } };
      },
      buy(id) { if (!owns(id)) { if (game.money < BOAT_TYPES[id].price) return 'cash'; buy(id); } return [...save.boats]; },
      own: (id) => own[id] && { x: own[id].x, z: own[id].z, yaw: own[id].yaw, home: own[id].home, off: own[id].off },
      boatAt: (id) => own[id] || null,
      board(id) { ensureOwned(); const b = own[id]; if (!b) return null; const r = BERTHS[id].ring; player.pos.set(r.x, 0, r.z); return interact() && api.debug.state(); },
      helm(id) { const b = own[id] || tests[id]; if (b) takeHelm(b); return !!(game.vehicle === b); },
      // step the simulation with fixed controls (no rendering): throttle, steer (+ = left), hop
      sim(sec, throttle = 0, steer = 0, hop = false) {
        const ctl = { throttle, steer, up: hop, move: 0, strafe: 0, jump: false, sprint: false }, n = Math.round(sec * 30);
        let maxAir = 0, minDepth = 1e9;
        for (let i = 0; i < n; i++) { timeU.value += 1 / 30; update(1 / 30, ctl); const v = game.vehicle; if (v && v.boat) { pose(steer); maxAir = Math.max(maxAir, v.air ? v.y - (WL + v.heave) : 0); minDepth = Math.min(minDepth, depthAt(v.x, v.z)); } if (ctl.up) ctl.up = false; }
        return { ...api.debug.state(), maxAir: +maxAir.toFixed(2), minDepth: +minDepth.toFixed(2) };
      },
      // walk on the deck with fixed keys for sec seconds (camera yaw = the boat's heading)
      walk(sec, move = 1, strafe = 0, boatThrottle = 0) {
        const ctl = { throttle: 0, steer: 0, up: false, move, strafe, jump: false, sprint: false }, n = Math.round(sec * 30), cam = game.cam;
        for (let i = 0; i < n; i++) { timeU.value += 1 / 30; if (S.aboard) cam.yaw = S.aboard.boat.yaw; deck(1 / 30, ctl, cam); if (boatThrottle && S.aboard) { const b = S.aboard.boat; b.vx += Math.sin(b.yaw) * boatThrottle * b.spec.acc / 30; b.vz += Math.cos(b.yaw) * boatThrottle * b.spec.acc / 30; } update(1 / 30, { throttle: 0, steer: 0, up: false }); }
        return api.debug.state();
      },
      dive() { if (!S.aboard) return null; dive(S.aboard.boat); return api.debug.state(); },
      swimTo(id) { const b = own[id] || S.rent; if (!b) return null; const l = b.spec.ladder, p = toWorld(b, l[0], 0, l[1] - 0.8, {}); game.swim.drop(p.x, p.z, 0, 0, WL + 0.3); player.pos.set(p.x, WL - 1.0, p.z); return [p.x, p.z]; },
      climb() { const b = ladderNear(player.pos.x, player.pos.z, 4); if (!b) return null; climb(b); return api.debug.state(); },
      rent(si = 0) { const s = RENTAL_SITES[si]; player.pos.set(s.ring.x, 0, s.ring.z); return interact() && api.debug.state(); },
      put(x, z, yaw) { const v = game.vehicle && game.vehicle.boat ? game.vehicle : S.aboard && S.aboard.boat; if (!v) return null; Object.assign(v, { x, z, yaw: yaw ?? v.yaw, vx: 0, vz: 0, yawRate: 0, air: false }); v.wk.last = null; return true; },
      test(id) { startTest(id); return true; },
      e: () => interact(),
      homeAll() { for (const id in own) if (!own[id].driven) home(own[id]); return true; },
      wakeSample: () => water.state(),
      sink() { const b = game.vehicle && game.vehicle.boat ? game.vehicle : S.aboard && S.aboard.boat; if (b) game.damage.hit(b, 9999, 'crash'); return !!b; },
    },
  };
  return api;
}
