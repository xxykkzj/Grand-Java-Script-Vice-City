// Pedestrians (and the drivers you can see through car windows). Everyone is drawn with a
// handful of InstancedMeshes: torsos, heads, limbs, hats and blob shadows, so fifty people
// cost five draw calls. They walk a sidewalk graph and cross on the walk phase.
import * as THREE from 'three';
import { box, cyl, merge, angleDelta, clamp, PI, dailyCurve, outOfSight } from '../core/util.js';
import { SIDE_X } from '../world/layout.js';
import { H_ROADS, walkOK } from '../world/roads.js';

const N = 52, DRIVERS = 54;
const WALK_Z = [65, 41.4, 4, -12, -60, -76], DX = 8.8;
const SHIRT = ['#ff5fa8', '#27d8cf', '#ffd447', '#f6f1e7', '#ff8a4c', '#9b7bff', '#7fe0ff', '#ff3f6a', '#8dff9a', '#f7b3c6', '#2a2140', '#ffb000'];
const LEGS = ['#f6f1e7', '#3b5a9a', '#c9b38a', '#22203a', '#ff8fb0', '#5a7ac8', '#e8e0d0', '#2f8f86'];
const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
const HAT = ['#fff6ec', '#ff3fb4', '#27e8ff', '#ffd166', '#22203a'];
const WALK = 0, WAIT = 1, DOWN = 2, FIST = 3, LIE = 4, SIT = 5;
// Share of the crowd out and about by hour: rush hours busiest, nightlife on the boulevard, empty small hours.
export const CROWD_CURVE = [[0, 0.62], [1, 0.3], [2, 0.12], [5, 0.1], [6.5, 0.45], [7.4, 1], [9, 1], [10.2, 0.72], [16, 0.75], [17, 1], [19, 1], [20.2, 0.85], [23, 0.75], [24, 0.62]];

export function createPeds(scene, R, grid, game) {
  // ---- sidewalk graph
  const xs = [-286];
  for (const s of SIDE_X) xs.push(s - DX, s + DX);
  xs.push(286);
  const nodes = [];
  WALK_Z.forEach((z) => xs.forEach((x) => nodes.push({ x, z, adj: [] })));
  const link = (a, b, cross) => {
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    a.adj.push({ to: b, cross, len }); b.adj.push({ to: a, cross, len });
  };
  WALK_Z.forEach((z, zi) => {
    const road = H_ROADS[zi >> 1];
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const side = xi % 2 === 1 && zi > 0;       // the gap between s-8.8 and s+8.8 is a side street (not on the promenade)
      link(nodes[zi * 12 + xi], nodes[zi * 12 + xi + 1], side ? { n: R.at(SIDE_X[(xi - 1) / 2], road.z), h: false } : null);
    }
  });
  for (let xi = 1; xi <= 10; xi++) for (let zi = 0; zi < 5; zi++) {
    link(nodes[zi * 12 + xi], nodes[(zi + 1) * 12 + xi], zi % 2 === 0 ? { n: R.at(SIDE_X[(xi - 1) >> 1], H_ROADS[zi >> 1].z), h: true } : null);
  }

  // ---- instanced body parts
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mk = (geo, count) => { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; scene.add(m); return m; };
  const torso = mk(merge([box(0.42, 0.56, 0.24, 0, 0.28, 0, '#ffffff'), box(0.43, 0.1, 0.25, 0, 0.03, 0, '#b8b8b8'), box(0.16, 0.08, 0.16, 0, 0.6, 0, '#d8d8d8')]), N + DRIVERS);
  const head = mk(merge([box(0.24, 0.25, 0.24, 0, 0.125, 0, '#ffffff'), box(0.255, 0.1, 0.25, 0, 0.215, -0.01, '#3a3a3a'), box(0.255, 0.16, 0.08, 0, 0.13, -0.09, '#3a3a3a'),
    box(0.04, 0.04, 0.02, -0.06, 0.14, 0.122, '#202020'), box(0.04, 0.04, 0.02, 0.06, 0.14, 0.122, '#202020')]), N + DRIVERS);
  const limb = mk(merge([box(0.13, 0.5, 0.14, 0, -0.25, 0, '#ffffff'), box(0.135, 0.12, 0.17, 0, -0.56, 0.015, '#4a4a4a')]), N * 4);
  const hat = mk(merge([cyl(0.2, 0.2, 0.03, 8, 0, 0.26, 0, '#ffffff'), cyl(0.125, 0.135, 0.1, 8, 0, 0.31, 0, '#ffffff'), box(0.27, 0.035, 0.02, 0, 0.275, 0.125, '#555555')]), N);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 10).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N);
  shadow.frustumCulled = false; shadow.renderOrder = 1; scene.add(shadow);

  const col = new THREE.Color(), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const peds = [];
  function dress(p) {
    const i = p.i, skin = pick(SKIN), shirt = pick(SHIRT), legs = pick(LEGS);
    torso.setColorAt(i, col.set(shirt)); head.setColorAt(i, col.set(skin));
    const sleeves = Math.random() < 0.5 ? shirt : skin, shorts = Math.random() < 0.35 ? skin : legs;
    limb.setColorAt(i * 4, col.set(shorts)); limb.setColorAt(i * 4 + 1, col.set(shorts));
    limb.setColorAt(i * 4 + 2, col.set(sleeves)); limb.setColorAt(i * 4 + 3, col.set(sleeves));
    hat.setColorAt(i, col.set(pick(HAT)));
    p.hat = Math.random() < 0.4; p.h = 0.9 + Math.random() * 0.2; p.w = 0.88 + Math.random() * 0.3; p.voice = 0.75 + Math.random() * 0.6;
    for (const m of [torso, head, limb, hat]) m.instanceColor.needsUpdate = true;
  }
  function put(p, a) {
    const e = a.adj[Math.floor(Math.random() * a.adj.length)];
    Object.assign(p, { a, b: e.to, e, d: 0, state: WALK, t: 0, ox: 0, oz: 0, ovx: 0, ovz: 0, tilt: 0, flee: 0, tx: 0, tz: 0 });
  }
  for (let i = 0; i < N; i++) {
    const p = { i, isPed: true, x: 0, z: 0, yaw: 0, phase: Math.random() * 6, speed: 1.3 + Math.random() * 0.8, lane: (Math.random() - 0.5) * 2.2, off: false, hang: null };
    dress(p);
    // most people stroll the boulevard and the promenade
    let a;
    do a = nodes[Math.floor(Math.random() * nodes.length)]; while (a.z < 0 && Math.random() < 0.5);
    put(p, a);
    p.d = Math.random() * p.e.len;
    if (p.e.cross) p.d = 0;
    peds.push(p);
  }
  for (let i = 0; i < DRIVERS; i++) { torso.setColorAt(N + i, col.set(pick(SHIRT))); head.setColorAt(N + i, col.set(pick(SKIN))); }

  const B = new THREE.Matrix4(), Lm = new THREE.Matrix4(), M = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const part = (mesh, idx, x, y, z, rx, rz, sx, sy) => {
    Lm.compose(v.set(x, y, z), q.setFromEuler(eu.set(rx, 0, rz)), sc.set(sx, sy, sx));
    mesh.setMatrixAt(idx, M.multiplyMatrices(B, Lm));
  };
  function draw(p) {
    const i = p.i, k = p.state === WALK ? clamp(p.v / 1.6, 0, 1.6) : 0, s = Math.sin(p.phase) * 0.6 * Math.min(k, 1.2);
    if (p.state === SIT) {
      // on a bench / lounger / chair (or the sand): hips on the seat, legs forward, looking about now and then
      const g = p.sitY < 0.2, lean = g ? -0.28 : p.sitK === 'lounger' ? -0.5 : -0.04;
      B.compose(v.set(p.x, p.sitY + 0.05 - 0.86 * p.h, p.z), q.setFromEuler(eu.set(0, p.yaw, 0)), sc.set(p.h, p.h, p.h));
      part(torso, i, 0, 0.84, 0, lean, 0, p.w, 1);
      part(head, i, 0, 1.5 + lean * 0.1, lean * 0.6, 0, Math.sin(p.phase * 0.3) * 0.15, 1, 1);
      const lg = g ? -1.45 : p.sitK === 'lounger' ? -1.3 : -1.25;
      part(limb, i * 4, 0.1 * p.w, 0.86, 0, lg, 0.05, 1, 1.38); part(limb, i * 4 + 1, -0.1 * p.w, 0.86, 0, lg + 0.1, -0.05, 1, 1.38);
      const arm = g ? 0.7 : -0.45;
      part(limb, i * 4 + 2, 0.27 * p.w, 1.38, lean * 0.4, arm, 0.25, 0.85, 1); part(limb, i * 4 + 3, -0.27 * p.w, 1.38, lean * 0.4, arm, -0.25, 0.85, 1);
      if (p.hat) part(hat, i, 0, 1.5, lean * 0.6, 0, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
      shadow.setMatrixAt(i, M.makeTranslation(p.x, 0.03, p.z));
      return;
    }
    B.compose(v.set(p.x, 0, p.z), q.setFromEuler(eu.set(p.tilt, p.yaw, 0)), sc.set(p.h, p.h, p.h));
    const fist = p.state === FIST ? -2.4 + Math.sin(p.t * 16) * 0.35 : 0, flail = p.state === DOWN ? 2.6 : p.state === LIE ? 2.9 : 0;
    part(torso, i, 0, 0.84, 0, 0.06 * k, 0, p.w, 1);
    part(head, i, 0, 1.5, 0, 0, 0, 1, 1);
    part(limb, i * 4, 0.1 * p.w, 0.86, 0, s, 0, 1, 1.38);
    part(limb, i * 4 + 1, -0.1 * p.w, 0.86, 0, -s, 0, 1, 1.38);
    part(limb, i * 4 + 2, 0.27 * p.w, 1.38, 0, fist || -s - flail, 0.08, 0.85, 1);
    part(limb, i * 4 + 3, -0.27 * p.w, 1.38, 0, s - flail, -0.08, 0.85, 1);
    if (p.hat && p.state !== LIE) part(hat, i, 0, 1.5, 0, 0, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
    shadow.setMatrixAt(i, M.makeTranslation(p.x, 0.03, p.z));
  }

  function standUp(p) { if (p.hang && p.hang.seat && p.hang.seat.taken === p) p.hang.seat.taken = null; }
  function knock(p, vx, vz, long = 2.2) {
    if (p.state === DOWN) return false;
    if (p.state === SIT) standUp(p);
    if (p.state === LIE) p.tilt = 0;
    p.state = DOWN; p.t = long; p.ovx = vx; p.ovz = vz; p.dir = Math.random() < 0.5 ? 1 : -1;
    return true;
  }
  function shout(p) {
    const f = game.focus(), d = Math.hypot(p.x - f.x, p.z - f.z);
    if (d < 45) game.audio.hey(p.voice, 1 - d / 45);
  }

  // standing around a spot: outside the club or the bar at night, by an umbrella on the beach by day
  function hangOut(p, dt) {
    const H = p.hang;
    p.v = 0;
    if (p.state === DOWN) {
      p.t -= dt;
      p.tilt += ((p.t > 0.6 ? p.dir * 1.5 : 0) - p.tilt) * (1 - Math.exp(-(p.t > 0.6 ? 12 : 6) * dt));
      p.ox += p.ovx * dt; p.oz += p.ovz * dt;
      const k = Math.exp(-3.5 * dt); p.ovx *= k; p.ovz *= k;
      if (p.t <= 0) { p.tilt = 0; p.state = WALK; p.flee = Math.max(p.flee, 2); }
    } else if (p.flee > 0) {
      // scared: run a few metres away from the trouble, then settle there
      p.flee -= dt;
      if (p.state === LIE) { p.state = WALK; p.tilt = 0; }
      if (p.state === SIT) { standUp(p); p.state = WALK; }
      const dx = p.x - p.tx, dz = p.z - p.tz, d = Math.hypot(dx, dz) || 1;
      p.ox += dx / d * 5.2 * dt; p.oz += dz / d * 5.2 * dt; p.v = 5.2;
      p.yaw += angleDelta(p.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-10 * dt));
    } else {
      // shuffle about a little and face the group's centre
      H.t -= dt;
      if (H.t <= 0) { H.t = 3 + Math.random() * 7; H.wx = (Math.random() - 0.5) * 1.6; H.wz = (Math.random() - 0.5) * 1.6; }
      const dx = H.wx - p.ox, dz = H.wz - p.oz, d = Math.hypot(dx, dz);
      if (p.state === SIT) p.v = 0;
      else if (p.state !== LIE && d > 0.15) {
        const m = Math.min(d, 0.9 * dt);
        p.ox += dx / d * m; p.oz += dz / d * m; p.v = 0.9;
        p.yaw += angleDelta(p.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-6 * dt));
      } else if (p.state !== LIE) p.yaw += angleDelta(p.yaw, Math.atan2(H.cx - p.x, H.cz - p.z)) * (1 - Math.exp(-2 * dt));
      else p.tilt = -1.52;
    }
    p.x = H.x + p.ox; p.z = H.z + p.oz;
    p.phase += dt * (1.2 + p.v * 3.2);
  }

  function update(p, dt, t) {
    if (p.hang) { hangOut(p, dt); hitCheck(p); return; }
    const e = p.e;
    p.v = 0;
    if (p.state === DOWN) {
      // cartoon tumble: slide, lie flat, then pick yourself up
      p.t -= dt;
      p.tilt += ((p.t > 0.6 ? p.dir * 1.5 : 0) - p.tilt) * (1 - Math.exp(-(p.t > 0.6 ? 12 : 6) * dt));
      p.ox += p.ovx * dt; p.oz += p.ovz * dt;
      const k = Math.exp(-3.5 * dt); p.ovx *= k; p.ovz *= k;
      if (p.t <= 0) { p.tilt = 0; p.state = p.fistAt ? FIST : WALK; p.t = 1.7; if (p.state === WALK) p.flee = Math.max(p.flee, 3); }
    } else if (p.state === FIST) {
      p.t -= dt;
      const f = game.focus();
      p.yaw += angleDelta(p.yaw, Math.atan2(f.x - p.x, f.z - p.z)) * (1 - Math.exp(-10 * dt));
      if (p.t <= 0) { p.state = WALK; p.fistAt = false; p.flee = 7; p.tx = f.x; p.tz = f.z; }
    } else {
      const run = p.flee > 0, off = Math.hypot(p.ox, p.oz);
      p.flee -= dt;
      if (off > 0.25) {
        // knocked or shoved off the path: head back to it
        const sp = run ? 5.2 : 1.8, m = Math.min(off, sp * dt);
        p.yaw += angleDelta(p.yaw, Math.atan2(-p.ox, -p.oz)) * (1 - Math.exp(-10 * dt));
        p.ox -= p.ox / off * m; p.oz -= p.oz / off * m; p.v = sp;
      } else if (p.state === WAIT) {
        p.t += dt;
        const c = e.cross;
        if (run || walkOK(c.n, c.h, t, e.len / 3.1 + 1)) p.state = WALK;
        else if (p.t > 24) { p.b = p.a; p.d = e.len; p.state = WALK; }     // give up and wander on
      } else {
        p.v = run ? 5.2 : e.cross ? Math.max(p.speed, 3.1) : p.speed;
        p.d += p.v * dt;
        if (p.d >= e.len) {
          const from = p.a, at = p.b;
          let opts = at.adj.filter((x) => x.to !== from);
          if (!opts.length) opts = at.adj;
          let nx = opts[Math.floor(Math.random() * opts.length)];
          // when fleeing, take whichever way leads away from the trouble
          if (run) { let bd = -1; for (const o of at.adj) { const d = Math.hypot(o.to.x - p.tx, o.to.z - p.tz); if (d > bd) { bd = d; nx = o; } } }
          p.a = at; p.b = nx.to; p.e = nx; p.d = 0;
          if (nx.cross && !run) { p.state = WAIT; p.t = 0; }
        }
      }
    }
    const a = p.a, b = p.b, k = p.e.len ? clamp(p.d / p.e.len, 0, 1) : 0, dx = b.x - a.x, dz = b.z - a.z, il = 1 / (Math.hypot(dx, dz) || 1);
    p.x = a.x + dx * k - dz * il * p.lane + p.ox; p.z = a.z + dz * k + dx * il * p.lane + p.oz;
    if (p.state === WALK && p.v && Math.hypot(p.ox, p.oz) <= 0.25) p.yaw += angleDelta(p.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt));
    p.phase += dt * (2 + p.v * 3.2);
    hitCheck(p);
  }
  // traffic and the player's own wheels
  function hitCheck(p) {
    if (p.state !== DOWN) {
      grid.query(p.x, p.z, 3, (o) => {
        if (o.isPed) return;
        const ddx = p.x - o.x, ddz = p.z - o.z, d = Math.hypot(ddx, ddz), sp = Math.hypot(o.vx, o.vz);
        if (d > o.radius * 0.75 + 0.4 || sp < 3 || o.y > 1.5) return;
        if (knock(p, o.vx * 0.55 + ddx / (d + 0.1) * 3, o.vz * 0.55 + ddz / (d + 0.1) * 3)) { shout(p); game.pedHit(p, o); }
      });
    }
  }

  // ---- time of day: send people home out of sight when it gets late, bring them out for the rush.
  // At night a good share of them hang around outside Club Prism and the Velvet Flamingo; by day, on the beach.
  const P = game.L.places, UMB = game.L.umbrellas, solids = game.L.solids;
  const hid = (x, z, near) => outOfSight(game.camera, x, z, solids, near);
  const spots = {
    club: { cx: P.club.x, cz: 40.5, list: [] }, bar: { cx: P.bar.x, cz: 40.5, list: [] }, beach: { list: [] },
  };
  for (const k of ['club', 'bar']) for (let i = 0; i < 12; i++) {
    const s = spots[k], side = i % 2 ? 1 : -1;
    s.list.push({ x: s.cx + side * (2.8 + Math.random() * 6.5), z: 38 + Math.random() * 4.6, cx: s.cx, cz: 40.5 });
  }
  // seats people use: benches and café chairs any time, loungers and towels while the sun is up
  const SEATS = game.L.props.seats.filter((s) => s.kind === 'bench' || s.kind === 'chair' || s.kind === 'lounger' || s.kind === 'towel');
  UMB.forEach((u) => spots.beach.list.push({ x: u.x + 1.6, z: u.z + 1.2, cx: u.x, cz: u.z }, { x: u.x - 1.2, z: u.z + 1.8, cx: u.x, cz: u.z }));
  // a few people start out sitting on the boulevard and promenade benches and at the café
  {
    const pool = SEATS.filter((st) => st.kind === 'bench' || st.kind === 'chair');
    for (let i = 0; i < 7 && pool.length; i++) {
      const p = peds[N - 1 - i], st = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      st.taken = p;
      Object.assign(p, { hang: { x: st.x, z: st.z, cx: st.x, cz: st.z, src: st, seat: st, kind: 'seat', t: 99, wx: 0, wz: 0 }, state: SIT, sitY: st.y, sitK: st.kind, ox: 0, oz: 0, x: st.x, z: st.z, yaw: st.yaw, v: 0 });
    }
  }
  let target = N, active = N, densT = 0, churnT = 0;
  const mood = () => {
    const h = game.env.tod;
    return { h, night: h >= 20 || h < 3, day: h >= 9 && h < 18.5 };
  };
  function despawn(p) {
    p.off = true; p.hang = null; p.state = WALK; p.tilt = 0;
    for (const m of [torso, head, hat, shadow]) m.setMatrixAt(p.i, ZERO);
    for (let k = 0; k < 4; k++) limb.setMatrixAt(p.i * 4 + k, ZERO);
  }
  function spawn(p) {
    const { night, day } = mood(), r = Math.random();
    const kind = night && r < 0.5 ? (r < 0.3 ? 'club' : 'bar') : day && r < 0.38 ? 'beach' : null;
    // take a seat: a fair share by day, a few on the boulevard benches in the evening
    if (!kind && Math.random() < (day ? 0.4 : mood().h < 1 || mood().h > 6 ? 0.18 : 0.05)) {
      for (let i = 0; i < 10; i++) {
        const st = SEATS[Math.floor(Math.random() * SEATS.length)];
        if (st.taken || (!day && (st.kind === 'lounger' || st.kind === 'towel')) || !hid(st.x, st.z, 40)) continue;
        dress(p); st.taken = p;
        Object.assign(p, { off: false, hang: { x: st.x, z: st.z, cx: st.x + Math.sin(st.yaw), cz: st.z + Math.cos(st.yaw), src: st, seat: st, kind: 'seat', t: 99, wx: 0, wz: 0 }, state: SIT,
          sitY: st.y, sitK: st.kind, ox: 0, oz: 0, ovx: 0, ovz: 0, tilt: 0, flee: 0, x: st.x, z: st.z, yaw: st.yaw, v: 0 });
        return true;
      }
    }
    if (kind) {
      const list = spots[kind].list;
      for (let i = 0; i < 8; i++) {
        const s = list[Math.floor(Math.random() * list.length)];
        if (s.busy || !hid(s.x, s.z, 45)) continue;
        dress(p); s.busy = p;
        const rr = Math.random();
        Object.assign(p, { off: false, hang: { ...s, src: s, kind, t: Math.random() * 3, wx: 0, wz: 0 }, state: kind === 'beach' && rr < 0.45 ? LIE : kind === 'beach' && rr < 0.72 ? SIT : WALK, sitY: 0, sitK: 'sand',
          ox: 0, oz: 0, ovx: 0, ovz: 0, tilt: 0, flee: 0, x: s.x, z: s.z, yaw: Math.random() * 6.28, v: 0 });
        return true;
      }
    }
    // a walker on a sidewalk node out of sight (the boulevard is busiest at night)
    for (let i = 0; i < 12; i++) {
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      if (night && a.z < 30 && Math.random() < 0.6) continue;
      if (!hid(a.x, a.z, 50)) continue;
      dress(p); p.off = false; p.hang = null; put(p, a); p.lane = (Math.random() - 0.5) * 2.2;
      p.x = a.x; p.z = a.z;
      return true;
    }
    return false;
  }
  function release(p) { if (p.hang && p.hang.src.busy === p) p.hang.src.busy = null; standUp(p); despawn(p); }
  function density(dt) {
    const { night, day } = mood();
    target = Math.round(N * dailyCurve(CROWD_CURVE, game.env.tod));
    active = 0;
    for (const p of peds) if (!p.off) active++;
    densT -= dt; churnT -= dt;
    if (densT > 0) return;
    densT = 0.1;
    if (active > target) {
      // send home someone out of sight; people standing in the "wrong" place for the hour go first
      let best = null, bs = -1;
      for (const p of peds) {
        if (p.off || p.state === DOWN || p.state === FIST || !hid(p.x, p.z, 45)) continue;
        const wrong = p.hang && ((p.hang.kind === 'beach' && !day) || (p.hang.kind === 'seat' && !day && p.state === SIT && (p.sitK === 'lounger' || p.sitK === 'towel')) || (p.hang.kind !== 'beach' && p.hang.kind !== 'seat' && !night));
        const sc = Math.random() + (wrong ? 2 : 0);
        if (sc > bs) { bs = sc; best = p; }
      }
      if (best) { release(best); active--; }
    } else if (active < target) {
      const p = peds.find((k) => k.off);
      if (p && spawn(p)) active++;
    } else if (churnT <= 0) {
      // slow turnover so the crowd drifts towards the club at night and the beach by day
      churnT = 4;
      const p = peds[Math.floor(Math.random() * N)];
      const wrong = !p.off && (p.hang ? (p.hang.kind === 'beach' ? !day : p.hang.kind === 'seat' ? Math.random() < 0.3 : !night) : (night || day) && Math.random() < 0.35);
      if (wrong && p.state !== DOWN && p.state !== FIST && hid(p.x, p.z, 45)) { release(p); spawn(p); }
    }
  }

  const api = {
    peds, count: N,
    // scare everyone within r of (x, z); the closest ones go flying
    alarm(x, z, r, blast = 0) {
      for (const p of peds) {
        if (p.off) continue;
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d > r) continue;
        if (blast && d < blast) { if (knock(p, dx / (d + 0.5) * 7, dz / (d + 0.5) * 7, 2.8)) shout(p); }
        else if (p.flee <= 0 && p.state !== DOWN && Math.random() < 0.25) shout(p);
        if (p.state === WAIT) p.state = WALK;
        p.flee = Math.max(p.flee, 5 + Math.random() * 4); p.tx = x; p.tz = z;
      }
    },
    // a driver hauled out of their car: stumbles, shakes a fist, then legs it
    eject(x, z, vx, vz) {
      const f = game.focus();
      let p = null, bd = 0;
      for (const o of peds) { const d = o.off ? 1e6 : Math.hypot(o.x - f.x, o.z - f.z); if (d > bd && o.state !== DOWN) { bd = d; p = o; } }
      p.off = false; p.hang = null; p.tilt = 0;
      let a = nodes[0], ad = 1e9;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < ad) { ad = d; a = n; } }
      dress(p); put(p, a);
      p.lane = 0; p.ox = x - a.x; p.oz = z - a.z; p.x = x; p.z = z;
      knock(p, vx, vz, 1.1); p.fistAt = true;
      shout(p);
      return p;
    },
    // bumping into someone on skates
    bump(player) {
      if (player.speed < 5) return;
      for (const p of peds) {
        if (p.off || p.state === DOWN || Math.abs(p.x - player.pos.x) > 0.75 || Math.abs(p.z - player.pos.z) > 0.75) continue;
        if (knock(p, player.vel.x * 0.5, player.vel.z * 0.5, 1.3)) { shout(p); player.vel.x *= 0.4; player.vel.z *= 0.4; }
      }
    },
    get active() { return active; },
    get target() { return target; },
    update(dt, t, frame, cars) {
      const f = game.focus();
      density(dt);
      for (const p of peds) {
        if (p.off) continue;
        const far = (p.x - f.x) ** 2 + (p.z - f.z) ** 2 > 8100;
        if (far) { if ((frame + p.i) % 4) continue; update(p, dt * 4, t); } else update(p, dt, t);
        draw(p);
      }
      // drivers sit on the left: a torso and a head per occupied car
      for (const c of cars) {
        const i = N + c.idx;
        if (c.off || !c.hasDriver || !(c.ai || c.jacking)) { torso.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); continue; }
        B.compose(v.set(c.x, c.y, c.z), q.setFromEuler(eu.set(c.tx, c.yaw, c.tz)), sc.set(1, 1, 1));
        if (c.kind === 'bike') { part(torso, i, 0, 0.92, -0.42, 0.5, 0, 0.9, 0.9); part(head, i, 0, 1.42, -0.1, 0.1, 0, 1, 1); continue; }
        part(torso, i, 0.42, 0.66, -0.55, -0.12, 0, 0.9, 0.9);
        part(head, i, 0.42, 1.24, -0.6, 0, 0, 1, 1);
      }
      for (const m of [torso, head, limb, hat, shadow]) m.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}
