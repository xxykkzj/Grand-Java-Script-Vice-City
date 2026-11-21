// The beach crowd on Coral Beach: a capped pool of people (the pedestrians' blocky meshes, indices after
// the street crowd) doing things on a timetable, like
//   morning (6-10)   joggers on the wet sand, dog walkers, a yoga group, surfers waiting for a wave
//   day (10-17)      sunbathers on loungers and towels, swimmers in the shallows, a volleyball game (the
//                    ball really goes over the net), frisbee and bat-and-ball pairs, kids building
//                    sandcastles, a queue at the Coconut Shack
//   sunset (17-20)   people sitting watching the sun go down, couples strolling the shore, photographers
//   night (20-6)     a few round the lit fire pit, a couple of late walkers; nobody sunbathes or swims
//   rain / storm     the beach empties (one or two hardy walkers in the rain)
// Whoever is not wanted any more walks off the beach; newcomers appear out of sight (or walk in from the
// promenade). They react like everyone else: they flinch and run from shots and bangs, tumble when a car
// clips them, and are never harmed. Cheap: one pose per person per frame, people far away tick at a
// quarter rate, nothing at all runs or draws while you are away from the beach.
import * as THREE from 'three';
import { angleDelta, clamp, lerp, PI, outOfSight } from '../core/util.js';
import { WL, bedAt } from '../world/sea.js';

export const BEACH_N = 27;
export const PLAN = {
  morning: { vendor: 1, jog: 4, dog: 2, yoga: 5, surf: 3 },
  day: { vendor: 1, sun: 8, swim: 4, volley: 4, frisbee: 2, paddle: 2, kids: 3, queue: 3 },
  sunset: { vendor: 1, watch: 7, couple: 4, photo: 2, jog: 1 },
  night: { fire: 5, walk: 2 },
  rain: { vendor: 1, walk: 1, jog: 1 },
  storm: {},
};
export function beachPeriod(h, weather, rain = 0) {
  if (weather === 'storm') return 'storm';
  if (weather === 'rain' || rain > 0.5) return 'rain';
  return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'sunset' : 'night';
}
const ENTRY_Z = 79.5;
const ground = (x, z) => (z > 149.5 ? Math.max(bedAt(x, z), -3) : 0);
const depth = (x, z) => WL - ground(x, z);

export function createBeachgoers(ctx) {
  const { game, base, count, torso, head, limb, hat, hatShow, shadow, part, B, M, v, q, eu, sc, ZERO, dressBeach, knock, shout, hitCheck } = ctx;
  const { WALK, DOWN, LIE, SIT, FLINCH, ACT } = ctx.S;
  const L = game.L, BE = L.beach, scene = game.scene;
  const list = [];
  for (let j = 0; j < count; j++) list.push({ i: base + j, isPed: true, beach: true, off: true, x: 0, z: 0, yaw: 0, phase: Math.random() * 6, h: 1, w: 1, state: WALK, v: 0, tilt: 0, gy: 0, ox: 0, oz: 0, ovx: 0, ovz: 0, flee: 0, t: 0, slot: null, mode: 'off', o: newPose() });

  // ---- props the activities need: one instanced mesh of boxes (mats, frisbee, paddles, dogs, boards,
  // cameras, leashes) and one of balls. Both hidden when nobody is on the beach.
  const KN = 30;
  const kit = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), KN);
  const balls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial(), 2);
  const kc = new THREE.Color();
  for (let k = 0; k < KN; k++) { kit.setMatrixAt(k, ZERO); kit.setColorAt(k, kc.set('#ffffff')); }
  balls.setColorAt(0, kc.set('#fff3c0')); balls.setColorAt(1, kc.set('#ffd447'));
  for (const m of [kit, balls]) { m.frustumCulled = false; m.visible = false; scene.add(m); }
  const K = { disc: 0, paddle: 1, mat: 3, dog: 8, board: 18, cam: 21, leash: 23 };   // dogs: 5 boxes each
  const kq = new THREE.Quaternion(), ke = new THREE.Euler(0, 0, 0, 'YXZ'), kv = new THREE.Vector3(), ks = new THREE.Vector3();
  const kset = (k, x, y, z, sx, sy, sz, yaw = 0, rx = 0, rz = 0, hex) => { kit.setMatrixAt(k, M.compose(kv.set(x, y, z), kq.setFromEuler(ke.set(rx, yaw, rz)), ks.set(sx, sy, sz))); if (hex) kit.setColorAt(k, kc.set(hex)); };
  const kzero = (k, n = 1) => { for (let a = 0; a < n; a++) kit.setMatrixAt(k + a, ZERO); };
  ['#ff4fa3', '#27d8cf', '#ffd447', '#9b7bff', '#8dff9a'].forEach((c, a) => kit.setColorAt(K.mat + a, kc.set(c)));
  kit.setColorAt(K.disc, kc.set('#ff3f6a')); kit.setColorAt(K.paddle, kc.set('#27d8cf')); kit.setColorAt(K.paddle + 1, kc.set('#ff8a4c'));
  ['#f2ead8', '#7a4a2e'].forEach((c, d) => { for (let a = 0; a < 5; a++) kit.setColorAt(K.dog + d * 5 + a, kc.set(a === 4 ? '#ff3f6a' : c)); });
  ['#ff6a3d', '#18f0ff', '#ffe14a'].forEach((c, a) => kit.setColorAt(K.board + a, kc.set(c)));
  for (const a of [0, 1]) { kit.setColorAt(K.cam + a, kc.set('#22203a')); kit.setColorAt(K.leash + a, kc.set('#ff3f6a')); }
  kit.instanceColor.needsUpdate = balls.instanceColor.needsUpdate = true;
  const hand = (p, right, rx, rz = 0, L2 = 0.6) => {
    // a hand's world position from the shoulder and the arm's swing (rx, rz), lean ignored
    const sx = (right ? -0.27 : 0.27) * p.w, ly = 1.38 - L2 * Math.cos(rx) * Math.cos(rz), lz = -L2 * Math.sin(rx), lx = sx + L2 * Math.sin(rz) * (right ? 1 : 1);
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), h = p.h;
    return [p.x + (c * lx + s * lz) * h, (p.gy || 0) + (p.o.y || 0) + ly * h, p.z + (-s * lx + c * lz) * h];
  };

  // ---- the slots: every place someone can be doing something ------------------------------------------------
  const S = {};
  const add = (type, o) => { (S[type] = S[type] || []).push({ type, k: S[type].length, taken: null, ...o }); };
  [[145.6, -268, 268], [146.4, -250, 262], [144.9, -262, 240], [145.2, -230, 268], [146.0, -268, 250]].forEach(([z, a, b], k) => add('jog', { x: lerp(a, b, (k * 0.37) % 1), z, a, b, speed: 2.8 + k * 0.15, line: true }));
  [[133.5, -250, 240], [134.6, -240, 250]].forEach(([z, a, b], k) => add('dog', { x: lerp(a, b, 0.3 + k * 0.4), z, a, b, speed: 1.25, line: true, dog: k }));
  [[140.2, -250, 250], [142.4, -230, 240]].forEach(([z, a, b], k) => add('walk', { x: lerp(a, b, 0.6 - k * 0.3), z, a, b, speed: 0.95, line: true }));
  [[146.0, -150, 260], [143.2, -262, 100]].forEach(([z, a, b], k) => { add('couple', { x: lerp(a, b, 0.4), z, a, b, speed: 0.85, line: true, lead: true, pair: k }); add('couple', { x: lerp(a, b, 0.4), z: z + 0.62, a, b, speed: 0.85, line: true, pair: k }); });
  { const Y = BE.yoga; add('yoga', { x: Y.x, z: Y.z + 2.2, yaw: PI, lead: true }); [[-3, -0.6], [-1, -1.1], [1, -1.1], [3, -0.6]].forEach(([dx, dz]) => add('yoga', { x: Y.x + dx, z: Y.z + dz, yaw: 0 })); }
  [[150, 172], [158, 177], [166, 171]].forEach(([x, z]) => add('surf', { x, z, yaw: 0.1, water: true }));
  { const loungers = L.props.seats.filter((s) => s.kind === 'lounger'); for (let k = 0; k < 4 && loungers.length; k++) { const s = loungers[Math.floor(k * loungers.length / 4) + 1] || loungers[k]; add('sun', { x: s.x, z: s.z, yaw: s.yaw, seat: s, lounger: true }); } }
  for (let k = 0; k < 4 && k < BE.towels.length; k++) { const t = BE.towels[k * 2 % BE.towels.length]; add('sun', { x: t.x, z: t.z, yaw: t.yaw, seat: t.seat }); }
  [[-120, 163], [-95, 166], [-70, 162], [-45, 168]].forEach(([x, z]) => add('swim', { x, z, water: true }));
  { const C = BE.court; [[-44.5, 100.6, 0], [-45.5, 104.6, 0], [-35.5, 100.4, 1], [-34.5, 104.4, 1]].forEach(([x, z, side]) => add('volley', { x, z, side, yaw: side ? -PI / 2 : PI / 2, C })); }
  add('frisbee', { x: -185, z: 131, mate: 1 }); add('frisbee', { x: -174, z: 135, mate: 0 });
  add('paddle', { x: 238, z: 131, mate: 1 }); add('paddle', { x: 246, z: 128, mate: 0 });
  { const cs = BE.castles; [[cs[0], -0.9, 0], [cs[1], 0, -0.9], [cs[2], -0.9, 0]].forEach(([c, dz, dx]) => add('kids', { x: c[0] + dx, z: c[1] + dz, yaw: Math.atan2(-dx, -dz), castle: c })); }
  add('vendor', { x: BE.kiosk.x + 0.5, z: BE.kiosk.z + 0.75, yaw: 0 });
  for (let k = 0; k < 3; k++) add('queue', { x: BE.kiosk.x + 0.8 + (k === 2 ? 0.3 : 0), z: BE.kiosk.z + 2.45 + k * 1.15, yaw: PI });
  [[-230, 139], [-176, 138.5], [-110, 140], [-62, 139.5], [76, 140], [152, 139], [222, 139.5]].forEach(([x, z], k) => add('watch', { x, z, yaw: (k % 3 - 1) * 0.25 }));
  add('photo', { x: -25, z: 143.5, yaw: -0.35 }); add('photo', { x: 190, z: 143.8, yaw: 0.25 });
  for (const s of BE.seats.log.filter((_, k) => k !== 1 && k !== 6 && k !== 4)) add('fire', { x: s.x, z: s.z, yaw: s.yaw, seat: s });

  // ---- state
  let period = null, plan = {}, near = false, farT = 0, acc = 0;
  const env = game.env;
  const hid = (x, z, nearR = 45) => outOfSight(game.camera, x, z, L.solids, nearR);
  const ball = { from: null, to: null, t: 0, dur: 1, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, apex: 3, kind: 'hit', rest: true };
  const toss = { frisbee: { t: 0, dur: 1.3, from: 0, apex: 0.5, y: 1.2 }, paddle: { t: 0, dur: 0.85, from: 0, apex: 1.1, y: 1.05 } };
  const queue = [];
  let qT = 6;
  const stats = { spawned: 0, walkedIn: 0, left: 0, hits: 0, overNet: 0, served: 0 };

  function wanted() {
    const out = [];
    for (const type in plan) { const n = Math.min(plan[type], (S[type] || []).length); for (let k = 0; k < n; k++) out.push(S[type][k]); }
    return out;
  }
  function despawn(p) {
    if (p.slot && p.slot.taken === p) p.slot.taken = null;
    if (p.slot && p.slot.seat && p.slot.seat.taken === p) p.slot.seat.taken = null;
    const qi = queue.indexOf(p); if (qi >= 0) queue.splice(qi, 1);
    p.slot = null; p.use = null; p.off = true; p.mode = 'off'; p.state = WALK; p.tilt = 0; p.flee = 0; p.leash = false;
    for (const m of [torso, head, hat, shadow]) m.setMatrixAt(p.i, ZERO);
    for (let k = 0; k < 4; k++) limb.setMatrixAt(p.i * 4 + k, ZERO);
  }
  function outfit(p, type) {
    dressBeach(p, type === 'sun' || type === 'swim' || type === 'surf' || type === 'volley' || type === 'kids' ? 'swim' : type === 'jog' || type === 'yoga' || type === 'frisbee' || type === 'paddle' ? 'sport' : 'casual');
    if (type === 'kids') { p.h = 0.58 + Math.random() * 0.08; p.w = 0.8; }
  }
  // put someone on a slot: there right away (out of sight, or settle), or walking in from the promenade
  function spawn(p, s, now) {
    let at = null;
    if (now || hid(s.x, s.z)) at = [s.x, s.z];
    else {
      for (const dx of s.type === 'queue' ? [8, -8, 24, -24] : [0, 18, -18, 36, -36, 60, -60]) { const x = clamp(s.x + dx, -280, 280); if (hid(x, ENTRY_Z, 30)) { at = [x, ENTRY_Z]; break; } }
      if (!at) { s.wait = (s.wait || 0) + 0.25; if (s.wait < 12) return false; at = [clamp(s.x, -280, 280), ENTRY_Z]; }
    }
    s.wait = 0;
    outfit(p, s.type);
    Object.assign(p, { use: [s.x, s.z], ghost: 0, sw: 0, bd: undefined, off: false, slot: s, x: at[0], z: at[1], yaw: Math.atan2(s.x - at[0], s.z - at[1]) || 0, state: WALK, tilt: 0, v: 0, flee: 0, ox: 0, oz: 0, gy: ground(at[0], at[1]), dir: Math.random() < 0.5 ? 1 : -1, t: Math.random() * 4, leash: false });
    s.taken = p;
    if (s.seat) s.seat.taken = p;
    p.mode = at[0] === s.x && at[1] === s.z ? 'there' : 'arrive';
    if (p.mode === 'there') { if (s.line) p.x = s.x; } else stats.walkedIn++;
    if (s.type === 'queue') queue.push(p);
    stats.spawned++;
    return true;
  }
  function leave(p) {
    if (p.mode === 'leave' || p.mode === 'off') return;
    if (p.slot && p.slot.seat && p.slot.seat.taken === p) p.slot.seat.taken = null;
    if (p.slot) p.slot.taken = null;
    const qi = queue.indexOf(p); if (qi >= 0) queue.splice(qi, 1);
    p.slot = null; p.mode = 'leave'; p.state = WALK; p.tilt = 0; p.leash = false; p.ex = clamp(p.x, -280, 280); p.ez = ENTRY_Z; p.lt = 0;
    stats.left++;
  }
  // plan for the hour and the weather; reassign people
  function replan(force) {
    const P = beachPeriod(env.tod, env.weather, env.w ? env.w.rain : 0);
    if (P === period && !force) return;
    period = P; plan = PLAN[P];
    const want = new Set(wanted());
    for (const p of list) if (!p.off && p.slot && !want.has(p.slot)) leave(p);
  }
  function fill(now) {
    for (const s of wanted()) {
      if (s.taken && !s.taken.off && s.taken.slot === s) continue;
      if (s.seat && s.seat.taken && !(s.seat.taken.beach && s.seat.taken.off)) continue;
      const p = list.find((k) => k.off);
      if (!p) return;
      if (!spawn(p, s, now) && !now) return;    // one walk-in per tick is plenty
      if (!now) return;
    }
  }

  // ---- poses for the activities (ACT): { y, tilt, lean, lL, lR: [rx, rz], aL, aR, hx } ---------------------
  function newPose() { return { y: 0, tilt: 0, lean: 0, lL: [0, 0], lR: [0, 0], aL: [0, 0.08], aR: [0, -0.08], hx: 0, hz: 0 }; }
  const tgt = newPose();
  const set = (o, y, lean, lL0, lL1, lR0, lR1, aL0, aL1, aR0, aR1, tilt = 0, hx = 0) => { o.y = y; o.lean = lean; o.lL[0] = lL0; o.lL[1] = lL1; o.lR[0] = lR0; o.lR[1] = lR1; o.aL[0] = aL0; o.aL[1] = aL1; o.aR[0] = aR0; o.aR[1] = aR1; o.tilt = tilt; o.hx = hx; o.hz = 0; return o; };
  const blend = (o, t, k) => { o.y += (t.y - o.y) * k; o.lean += (t.lean - o.lean) * k; o.tilt += (t.tilt - o.tilt) * k; o.hx += (t.hx - o.hx) * k; o.hz += (t.hz - o.hz) * k; for (const a of ['lL', 'lR', 'aL', 'aR']) { o[a][0] += (t[a][0] - o[a][0]) * k; o[a][1] += (t[a][1] - o[a][1]) * k; } };
  const sitY = (p, y) => y + 0.05 - 0.86 * p.h;
  function drawAct(p) {
    const o = p.o, i = p.i, h = p.h, w = p.w, gy = p.gy || 0;
    B.compose(v.set(p.x, gy + o.y, p.z), q.setFromEuler(eu.set(o.tilt, p.yaw, 0)), sc.set(h, h, h));
    const l = o.lean, cl = Math.cos(l), sl = Math.sin(l);
    part(torso, i, 0, 0.84, 0, l, 0, w, 1);
    part(head, i, 0, 0.84 + 0.66 * cl, 0.66 * sl, l * 0.4 + o.hx, o.hz, 1, 1);
    part(limb, i * 4, 0.1 * w, 0.86, 0, o.lL[0], o.lL[1], 1, 1.38); part(limb, i * 4 + 1, -0.1 * w, 0.86, 0, o.lR[0], o.lR[1], 1, 1.38);
    const sy = 0.84 + 0.54 * cl, sz = 0.54 * sl;
    part(limb, i * 4 + 2, 0.27 * w, sy, sz, o.aL[0] + l, o.aL[1], 0.85, 1); part(limb, i * 4 + 3, -0.27 * w, sy, sz, o.aR[0] + l, o.aR[1], 0.85, 1);
    if (p.hat) part(hat, i, 0, 0.84 + 0.66 * cl, 0.66 * sl, l * 0.4 + o.hx, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
    hatShow(p, !!p.hat);
    if (gy < -0.3 || Math.abs(o.tilt) > 0.8) shadow.setMatrixAt(i, ZERO); else shadow.setMatrixAt(i, M.makeTranslation(p.x, gy + 0.03, p.z));
  }

  // ---- moving about: walking (wading, swimming when it gets deep) towards a point
  function moveTo(p, x, z, sp, dt) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    const dp = depth(p.x, p.z);
    const swim = dp > 0.95;
    const s = swim ? 1.0 : dp > 0.3 ? sp * 0.6 : sp;
    if (d > 0.05) {
      // round any fixed prop in the way (actors/peds.js steer); the goal and the spot being left are exempt
      p.gx = x; p.gz = z;
      const w = ctx.steer ? ctx.steer(p, dx / d, dz / d, Math.min(d, 2.6), x, z) : null, ux = w ? w[0] : dx / d, uz = w ? w[1] : dz / d;
      const m = Math.min(d, s * dt); p.x += ux * m; p.z += uz * m; p.yaw += angleDelta(p.yaw, Math.atan2(ux, uz)) * (1 - Math.exp(-8 * dt));
      // no way through for a while: walk through it rather than stand there for good
      if (p.ghost > 0) p.ghost -= dt;
      else if (d < 0.5 || p.bd === undefined || Math.abs(x - p.bx) > 1 || Math.abs(z - p.bz) > 1 || d < p.bd - 0.1) { p.bd = d; p.bt = 0; p.bx = x; p.bz = z; }
      else if ((p.bt += dt) > 3.5) { p.ghost = 2.5; p.bt = 0; p.bd = d; if (ctx.onGhost) ctx.onGhost(); }
    }
    p.v = d > 0.05 ? s : 0;
    p.gy = swim ? WL - 1.36 : Math.min(0, ground(p.x, p.z));
    if (swim) { p.state = ACT; swimPose(p, tgt); blend(p.o, tgt, 1 - Math.exp(-6 * dt)); } else if (p.state === ACT || p.state === SIT || p.state === LIE) { p.state = WALK; p.tilt = 0; }
    return d;
  }
  function swimPose(p, o) {
    const s = Math.sin(p.phase * 1.4), c = Math.cos(p.phase * 1.4);
    return set(o, 0, 0.75, 0.35 * s, 0.12, -0.35 * s, -0.12, -1.3 + 0.45 * s, 0.6 + 0.45 * c, -1.3 + 0.45 * s, -0.6 - 0.45 * c);
  }

  // ---- the ball games
  const team = (side) => list.filter((p) => !p.off && p.mode === 'there' && p.slot && p.slot.type === 'volley' && p.slot.side === side);
  function volleyStep(dt) {
    const ps = list.filter((p) => !p.off && p.mode === 'there' && p.slot && p.slot.type === 'volley');
    const C = BE.court;
    if (ps.length < 4) { ball.rest = true; return ps; }
    if (ball.rest || !ball.to || ball.to.off || ball.to.mode !== 'there') {
      ball.rest = false; const a = ps[Math.floor(Math.random() * 4)];
      launch(a, team(1 - a.slot.side)[Math.floor(Math.random() * 2)], 'serve');
    }
    ball.t += dt;
    if (ball.t >= ball.dur) {
      // the receiver plays it: a set to the teammate, or (after a set) over the net
      const r = ball.to, mate = team(r.slot.side).find((k) => k !== r);
      stats.hits++;
      if (ball.kind !== 'set' && mate) launch(r, mate, 'set');
      else { launch(r, team(1 - r.slot.side)[Math.floor(Math.random() * 2)], 'hit'); stats.overNet++; }
    }
    return ps;
  }
  function launch(a, b, kind) {
    const C = BE.court, side = b.slot.side;
    ball.from = a; ball.to = b; ball.kind = kind; ball.t = 0;
    ball.x0 = a.x; ball.z0 = a.z; ball.y0 = kind === 'set' ? 1.6 : 2.3;
    // where it comes down: near the receiver's home, inside their half
    const hx = b.slot.x + (Math.random() - 0.5) * 3, hz = b.slot.z + (Math.random() - 0.5) * 3;
    ball.x1 = clamp(hx, side ? C.net + 1.5 : C.x0 + 1, side ? C.x1 - 1 : C.net - 1.5); ball.z1 = clamp(hz, C.z0 + 1, C.z1 - 1);
    ball.dig = Math.random() < 0.5; ball.y1 = kind === 'set' ? 2.3 : 1.4; ball.apex = kind === 'set' ? 1.6 : 3.4; ball.dur = kind === 'set' ? 1.1 : kind === 'serve' ? 1.7 : 1.35;
  }
  const ballAt = (u) => [lerp(ball.x0, ball.x1, u), lerp(ball.y0, ball.y1, u) + ball.apex * 4 * u * (1 - u), lerp(ball.z0, ball.z1, u)];

  // ---- one person's step
  function step(p, dt, T) {
    p.phase += dt * (1.6 + p.v * 3.2);
    // the common reactions first: knocked over, startled, running from trouble
    if (p.state === DOWN) {
      p.t -= dt;
      p.tilt += ((p.t > 0.6 ? p.dir * 1.5 : 0) - p.tilt) * (1 - Math.exp(-(p.t > 0.6 ? 12 : 6) * dt));
      p.x += p.ovx * dt; p.z += p.ovz * dt; const k = Math.exp(-3.5 * dt); p.ovx *= k; p.ovz *= k; p.gy = Math.min(0, ground(p.x, p.z));
      if (p.t <= 0) { p.tilt = 0; p.state = WALK; p.flee = Math.max(p.flee, 2.5); }
      return;
    }
    if (p.state === FLINCH) { p.t -= dt; if (p.t <= 0) { p.state = WALK; p.flee = Math.max(p.flee, 4); } return; }
    if (p.flee > 0) {
      p.flee -= dt; p.state = WALK; p.tilt = 0;
      const dx = p.x - p.tx, dz = p.z - p.tz, d = Math.hypot(dx, dz) || 1;
      moveTo(p, clamp(p.x + dx / d * 6, -285, 285), clamp(p.z + dz / d * 6, 80, 170), 5.2, dt);
      if (p.flee <= 0 && p.mode === 'there') p.mode = 'arrive';
      return;
    }
    if (p.mode === 'leave') {
      p.lt += dt;
      const d = moveTo(p, p.ex, p.ez, 1.5, dt);
      if (d < 0.6 || p.lt > 60 || (p.lt > 2 && hid(p.x, p.z, 30))) despawn(p);
      return;
    }
    const s = p.slot;
    if (!s) { despawn(p); return; }
    if (p.mode === 'arrive') {
      let tx = s.x, tz = s.z;
      if (s.type === 'queue') { const qi = Math.max(0, queue.indexOf(p)); tx = S.queue[Math.min(qi, 2)].x; tz = S.queue[Math.min(qi, 2)].z; }
      if (s.line) { tz = s.z; tx = clamp(p.x, s.a, s.b); }
      if (moveTo(p, tx, tz, 1.5, dt) < 0.15) { p.mode = 'there'; p.t = 0; }
      return;
    }
    // ---- there: doing the thing
    const o = p.o, kk = 1 - Math.exp(-8 * dt);
    p.v = 0; p.gy = 0;
    switch (s.type) {
      case 'jog': case 'dog': case 'walk': case 'couple': {
        if (s.type === 'couple' && !s.lead) {
          const L2 = S.couple.find((k) => k.pair === s.pair && k.lead), lp = L2 && L2.taken;
          if (lp && !lp.off && lp.mode === 'there' && lp.flee <= 0 && lp.state === WALK) { p.x = lp.x; p.z = s.z; p.yaw = lp.yaw; p.v = lp.v; p.state = WALK; }
          else { p.state = WALK; p.v = 0; }
          break;
        }
        p.state = WALK; p.leash = s.type === 'dog';
        p.x += p.dir * s.speed * dt; p.v = s.speed;
        if (p.x > s.b) { p.x = s.b; p.dir = -1; } else if (p.x < s.a) { p.x = s.a; p.dir = 1; }
        p.yaw += angleDelta(p.yaw, p.dir > 0 ? PI / 2 : -PI / 2) * (1 - Math.exp(-5 * dt));
        p.z += (s.z - p.z) * (1 - Math.exp(-2 * dt));
        break;
      }
      case 'yoga': {
        p.state = ACT; p.yaw += angleDelta(p.yaw, s.yaw) * kk;
        const ph = Math.floor((T + 0.5) / 7) % 3, br = Math.sin(T * 1.3) * 0.04;
        if (ph === 0) set(tgt, 0, br, -0.55, 0.85, 0, -0.04, -3.0, 0.18, -3.0, -0.18);          // tree
        else if (ph === 1) set(tgt, -0.08, 0, -0.55, 0.12, 0.5, -0.12, 0, 1.5, 0, -1.5);         // warrior
        else set(tgt, 0, 1.2 + br, 0.05, 0.05, 0.05, -0.05, -1.15, 0.12, -1.15, -0.12, 0, -0.2); // forward fold
        blend(o, tgt, 1 - Math.exp(-3 * dt));
        break;
      }
      case 'surf': {
        // sitting on the board waiting for a wave, now and then lying down to paddle a few metres
        p.t += dt;
        const bob = Math.sin(T * 1.7 + s.k) * 0.06, paddle = (p.t % 14) > 10;
        p.yaw += angleDelta(p.yaw, s.yaw + Math.sin(T * 0.2 + s.k) * 0.5) * (1 - Math.exp(-dt));
        if (paddle) { p.x += Math.sin(p.yaw) * 0.7 * dt; p.z += Math.cos(p.yaw) * 0.7 * dt; }
        else { p.x += (s.x - p.x) * dt * 0.08; p.z += (s.z - p.z) * dt * 0.08; }
        p.state = ACT; p.gy = WL + bob;
        if (paddle) { const a = Math.sin(T * 4); set(tgt, 0.2, 0, 0.1, 0.05, 0.1, -0.05, -PI / 2 - 0.7 * a, 0.25, -PI / 2 + 0.7 * a, -0.25, 1.48, -0.9); }
        else set(tgt, sitY(p, 0.12), -0.04, -1.25, 0.12, -1.15, -0.12, -0.3, 0.3, -0.3, -0.3);
        blend(o, tgt, 1 - Math.exp(-4 * dt));
        break;
      }
      case 'sun': {
        p.yaw = s.yaw;
        if (s.lounger) { p.state = SIT; p.sitY = s.seat.y; p.sitK = 'lounger'; p.x = s.x; p.z = s.z; }
        else { p.state = LIE; p.tilt = -1.52; p.x = s.x + Math.sin(s.yaw) * 0.85; p.z = s.z + Math.cos(s.yaw) * 0.85; }
        break;
      }
      case 'swim': {
        p.t += dt * 0.25;
        const a = p.t + s.k * 1.7, cx = s.x, cz = s.z;
        p.x = cx + Math.cos(a) * 2.6; p.z = cz + Math.sin(a) * 2.2;
        p.yaw = Math.atan2(-Math.sin(a) * 2.6, Math.cos(a) * 2.2);
        p.state = ACT; p.gy = WL - 1.36 + Math.sin(T * 2 + s.k) * 0.03; p.phase += dt * 2;
        swimPose(p, tgt); blend(o, tgt, kk);
        break;
      }
      case 'volley': {
        p.state = ACT;
        const C = BE.court, mine = ball.to === p && !ball.rest, u = ball.t / ball.dur;
        let tx = s.x, tz = s.z;
        if (mine) { tx = ball.x1; tz = ball.z1; }
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), m = Math.min(d, (mine ? 3.2 : 1.6) * dt);
        if (d > 0.05) { p.x += dx / d * m; p.z += dz / d * m; }
        p.x = s.side ? clamp(p.x, C.net + 0.6, C.x1 - 0.3) : clamp(p.x, C.x0 + 0.3, C.net - 0.6);
        // face the ball (or the net)
        const by = ball.rest ? null : ballAt(Math.min(1, u));
        p.yaw += angleDelta(p.yaw, by ? Math.atan2(by[0] - p.x, by[2] - p.z) : s.yaw) * kk;
        if (mine && u > 0.72) {
          const j = Math.sin(clamp((u - 0.72) / 0.28, 0, 1) * PI);
          if (ball.kind === 'set') set(tgt, j * 0.5, -0.1, 0.3, 0.1, 0.2, -0.1, -3.0 + j * 0.8, 0.3, -3.1, -0.25);                 // spike
          else if (ball.dig) { set(tgt, -0.12, 0.35, -0.3, 0.16, -0.3, -0.16, -0.8, 0.05, -0.8, -0.05); }  // dig
          else set(tgt, 0, 0, -0.1, 0.1, -0.1, -0.1, -2.9, 0.3, -2.9, -0.3);                                                   // set
        } else { set(tgt, -0.06, 0.28, -0.25, 0.15, -0.25, -0.15, -0.9, 0.2, -0.9, -0.2); }
        blend(o, tgt, 1 - Math.exp(-12 * dt));
        break;
      }
      case 'frisbee': case 'paddle': {
        p.state = ACT;
        const G = toss[s.type], mate = S[s.type][s.mate].taken, both = mate && !mate.off && mate.mode === 'there';
        if (mate) p.yaw += angleDelta(p.yaw, Math.atan2(mate.x - p.x, mate.z - p.z)) * kk;
        const thrower = G.from === s.k, u = G.t / G.dur;
        const fr = s.type === 'frisbee';
        if (!both) set(tgt, 0, 0, 0, 0.04, 0, -0.04, 0, 0.1, -0.2, -0.1);
        else if (thrower && u < 0.3) { const w = u / 0.3; set(tgt, 0, 0.05, -0.15, 0.1, 0.1, -0.1, -0.3, 0.2, fr ? 0.6 - 2.2 * w : -0.4 - 1.2 * w, fr ? -1.2 + 0.8 * w : -0.4); }
        else if (!thrower && u > 0.55) set(tgt, 0, 0.1, -0.2, 0.12, -0.1, -0.12, fr ? -1.3 : -0.4, 0.25, fr ? -1.4 : -1.25, fr ? -0.25 : -0.3);
        else set(tgt, 0, 0.04, -0.08, 0.1, 0.04, -0.1, -0.4, 0.15, fr ? -0.5 : -0.9, -0.25);
        blend(o, tgt, 1 - Math.exp(-14 * dt));
        break;
      }
      case 'kids': {
        p.state = ACT; p.yaw = s.yaw;
        const a = Math.sin(T * 4 + s.k * 2);
        set(tgt, sitY(p, 0), 0.32, -1.45, 0.14, -1.35, -0.14, -0.75 + 0.45 * a, 0.25, -0.75 - 0.45 * a, -0.25);
        blend(o, tgt, kk);
        break;
      }
      case 'queue': {
        const qi = queue.indexOf(p), at = S.queue[clamp(qi < 0 ? 2 : qi, 0, 2)];
        if (p.detour) {
          const d = moveTo(p, p.detour[0], p.detour[1], 1.4, dt);
          if (d < 0.3) p.detour = null;
          break;
        }
        const d = moveTo(p, at.x, at.z, 1.2, dt);
        p.state = WALK;
        if (d < 0.1) p.yaw += angleDelta(p.yaw, PI) * kk;
        break;
      }
      case 'vendor': {
        // behind the Coconut Shack's counter, blending something
        p.state = ACT; p.yaw = 0; p.x = s.x; p.z = s.z;
        const a = Math.sin(T * 9) * ((T % 6) < 2.5 ? 0.25 : 0.03);
        set(tgt, 0, 0.1, 0, 0.05, 0, -0.05, -1.05 + a, 0.15, -1.1 - a, -0.2); blend(o, tgt, kk);
        break;
      }
      case 'watch': { p.state = SIT; p.sitY = 0; p.sitK = 'sand'; p.yaw = s.yaw; p.x = s.x; p.z = s.z; break; }
      case 'photo': {
        p.state = ACT; p.yaw += angleDelta(p.yaw, s.yaw + Math.sin(T * 0.15 + s.k) * 0.4) * (1 - Math.exp(-2 * dt));
        const up = (T + s.k * 2.3) % 7 < 4.2;
        if (up) set(tgt, 0, 0.04, 0, 0.06, 0, -0.06, -1.75, -0.45, -1.75, 0.45, 0, -0.05); else set(tgt, 0, 0, 0, 0.05, 0, -0.05, -0.4, 0.1, -0.15, -0.1);
        blend(o, tgt, 1 - Math.exp(-5 * dt));
        break;
      }
      case 'fire': { p.state = SIT; p.sitY = s.seat.y; p.sitK = 'log'; p.yaw = s.yaw; p.x = s.x; p.z = s.z; break; }
      default: p.state = WALK;
    }
  }

  // the kiosk queue moves up: the front one is served, steps aside with a drink and rejoins at the back
  function queueStep(dt) {
    if (queue.length < 2) return;
    qT -= dt;
    if (qT > 0) return;
    qT = 8 + Math.random() * 4;
    const a = queue.shift();
    if (a.mode !== 'there') { queue.unshift(a); return; }
    queue.push(a); a.detour = [a.x + 3.2, a.z + 4.5]; stats.served++;
  }
  // the props for this frame
  function drawKit(T) {
    // mats under the yoga group, boards under the surfers, dogs on leads, cameras, the frisbee and the paddles
    for (let k = 0; k < 5; k++) { const s = S.yoga[k], p = s.taken; if (p && !p.off && p.mode === 'there') kset(K.mat + k, s.x, 0.012, s.z, 0.62, 0.02, 1.8, s.yaw); else kzero(K.mat + k); }
    for (let k = 0; k < 3; k++) {
      const s = S.surf[k], p = s.taken;
      if (p && !p.off && p.slot === s && p.mode === 'there') { const f = p.o.tilt > 0.7 ? 0.85 : 0.2; kset(K.board + k, p.x + Math.sin(p.yaw) * f, (p.gy || WL) + 0.02, p.z + Math.cos(p.yaw) * f, 0.52, 0.07, 2.1, p.yaw); }
      else if (p && !p.off && p.slot === s && p.mode === 'arrive' && p.state === WALK) { const hd = hand(p, false, 0, 0.1); kset(K.board + k, hd[0], hd[1] + 0.3, hd[2], 0.07, 2.0, 0.5, p.yaw + PI / 2, 0, 0.2); }
      else kzero(K.board + k);
    }
    for (let k = 0; k < 2; k++) {
      const s = S.dog[k], p = s.taken, D = K.dog + k * 5;
      if (!p || p.off || p.slot !== s || p.state !== WALK) { kzero(D, 5); kzero(K.leash + k); continue; }
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), dx = p.x + fx * 1.7 + fz * 0.5, dz = p.z + fz * 1.7 - fx * 0.5, ya = p.yaw, sw = Math.sin(p.phase * 1.6) * 0.5 * Math.min(1, p.v);
      kset(D, dx, 0.42, dz, 0.24, 0.22, 0.58, ya); kset(D + 1, dx + fx * 0.36, 0.6, dz + fz * 0.36, 0.2, 0.2, 0.24, ya);
      kset(D + 2, dx - fx * 0.32, 0.56, dz - fz * 0.32, 0.05, 0.05, 0.26, ya, -0.7 + Math.sin(T * 12) * 0.3);
      kset(D + 3, dx, 0.17, dz, 0.18, 0.34, 0.08, ya, sw); kset(D + 4, dx + fx * 0.22, 0.52, dz + fz * 0.22, 0.25, 0.05, 0.06, ya);
      const hd = hand(p, true, -0.75, -0.08), cx = dx + fx * 0.22, cz = dz + fz * 0.22, cy = 0.52, lx = cx - hd[0], ly = cy - hd[1], lz = cz - hd[2], len = Math.hypot(lx, ly, lz);
      kset(K.leash + k, (hd[0] + cx) / 2, (hd[1] + cy) / 2, (hd[2] + cz) / 2, 0.025, 0.025, len, Math.atan2(lx, lz), -Math.atan2(ly, Math.hypot(lx, lz)));
    }
    for (let k = 0; k < 2; k++) {
      const p = S.photo[k].taken;
      if (p && !p.off && p.slot === S.photo[k] && p.mode === 'there' && p.o.aR[0] < -1.3) { const a = hand(p, true, p.o.aR[0], p.o.aR[1]), b = hand(p, false, p.o.aL[0], p.o.aL[1]); kset(K.cam + k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.04, (a[2] + b[2]) / 2, 0.16, 0.11, 0.09, p.yaw); }
      else kzero(K.cam + k);
    }
    // flying things
    const tossDraw = (type, idx, ballIdx) => {
      const G = toss[type], A = S[type][0].taken, Bq = S[type][1].taken;
      const ok = A && Bq && !A.off && !Bq.off && A.mode === 'there' && Bq.mode === 'there' && A.slot === S[type][0] && Bq.slot === S[type][1];
      if (!ok) return false;
      const f = G.from ? Bq : A, t = G.from ? A : Bq, u = G.t / G.dur;
      const a = hand(f, true, -1.2, -0.2), b = hand(t, true, -1.2, -0.2), y = lerp(a[1], b[1], u) + G.apex * 4 * u * (1 - u);
      const x = lerp(a[0], b[0], u), z = lerp(a[2], b[2], u);
      if (type === 'frisbee') kset(K.disc, x, y, z, 0.27, 0.03, 0.27, T * 14, 0.1);
      else { balls.setMatrixAt(1, M.compose(kv.set(x, y, z), kq.identity(), ks.setScalar(0.045))); for (const [pp, k2] of [[A, 0], [Bq, 1]]) { const hd = hand(pp, true, pp.o.aR[0], pp.o.aR[1], 0.72); kset(K.paddle + k2, hd[0], hd[1], hd[2], 0.2, 0.28, 0.025, pp.yaw, pp.o.aR[0] + PI / 2); } }
      return true;
    };
    if (!tossDraw('frisbee')) kzero(K.disc);
    if (!tossDraw('paddle')) { kzero(K.paddle, 2); balls.setMatrixAt(1, ZERO); }
    const vp = list.some((p) => !p.off && p.slot && p.slot.type === 'volley');
    if (!vp) balls.setMatrixAt(0, ZERO);
    else { const at = ball.rest ? [BE.court.net - 2, 0.11, (BE.court.z0 + BE.court.z1) / 2] : ballAt(Math.min(1, ball.t / ball.dur)); balls.setMatrixAt(0, M.compose(kv.set(at[0], at[1], at[2]), kq.identity(), ks.setScalar(0.11))); }
    kit.instanceMatrix.needsUpdate = balls.instanceMatrix.needsUpdate = true;
  }

  const api = {
    list, slots: S, stats, ball,
    get on() { return near; },
    // the Coconut Shack serves from 7:00 to 20:00 while someone is behind the counter
    kioskOpen() { const h = env.tod; return h >= 7 && h < 20 && env.weather !== 'storm'; },
    kioskNear(pos) { const k = BE.kioskSpot; return api.kioskOpen() && Math.hypot(pos.x - k.x, pos.z - k.z) < 1.5 && pos.y < 0.5; },
    get period() { return period; },
    drawAct,
    // place everyone the timetable wants straight onto their spots (automated checks, and a cut or a skip)
    settle() {
      replan(true);
      for (const p of list) if (!p.off && (p.mode === 'leave' || !p.slot)) despawn(p);
      for (const p of list) if (!p.off && p.mode === 'arrive') { p.x = p.slot.x; p.z = p.slot.z; p.mode = 'there'; }
      near = true; fill(true);
      return api.state();
    },
    // who is doing what (people walking to their spot count under their activity)
    state() {
      const by = {}, there = {};
      let leaving = 0, on = 0;
      for (const p of list) {
        if (p.off) continue;
        on++;
        if (p.mode === 'leave') { leaving++; continue; }
        const t = p.slot ? p.slot.type : '?';
        by[t] = (by[t] || 0) + 1;
        if (p.mode === 'there') there[t] = (there[t] || 0) + 1;
      }
      return { period, plan: { ...plan }, by, there, leaving, on, max: count, near, fire: !!(game.city && game.city.beachFx && game.city.beachFx.lit), ...stats };
    },
    update(dt, T, frame, drawPed) {
      const f = game.focus();
      const want = !game.inside && f.z > 10 && f.z < 420 && f.x > -380 && f.x < 380;
      if (!want) {
        farT += dt;
        if (near && farT > 1.5) { near = false; for (const p of list) if (!p.off) despawn(p); kit.visible = balls.visible = false; for (const m of [torso, head, limb, hat, shadow]) m.instanceMatrix.needsUpdate = true; }
        return;
      }
      farT = 0;
      if (!near) { near = true; period = null; }
      kit.visible = balls.visible = true;
      acc -= dt;
      if (acc <= 0) { acc = 0.25; replan(false); fill(false); }
      if (plan.volley) volleyStep(dt);
      for (const G of Object.values(toss)) { G.t += dt; if (G.t >= G.dur) { G.t = 0; G.from = 1 - G.from; } }
      queueStep(dt);
      for (const p of list) {
        if (p.off) continue;
        const d2 = (p.x - f.x) ** 2 + (p.z - f.z) ** 2;
        const step4 = d2 > 8100 && p.mode === 'there' && p.slot && p.slot.type !== 'volley' && !p.slot.line;
        if (step4 && (frame + p.i) % 4) continue;
        step(p, step4 ? dt * 4 : dt, T);
        if (!p.off && p.gy > -0.5) hitCheck(p);
        if (!p.off) drawPed(p);
      }
      drawKit(T);
    },
  };
  return api;
}
