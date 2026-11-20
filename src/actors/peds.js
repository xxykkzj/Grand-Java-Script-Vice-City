// Pedestrians (and the drivers you can see through car windows). Everyone is drawn with a
// handful of InstancedMeshes: torsos, heads, limbs, hats and blob shadows, so fifty people
// cost five draw calls. Refined blocks with pixel faces (actors/blocky.js). They walk a sidewalk graph and cross on the walk phase.
import * as THREE from 'three';
import { angleDelta, clamp, PI, dailyCurve, outOfSight } from '../core/util.js';
import { kit, blockyMaterial, instExtras, crowdAtlas, mergeParts, CROWD_FACE_N } from './blocky.js';
import { SIDE_X, KEY } from '../world/layout.js';
import { KH, KV, KEY_JUNCTIONS } from '../world/key.js';
import { H_ROADS, walkOK } from '../world/roads.js';
import { createBeachgoers, BEACH_N } from './beachgoers.js';

const N = 52, DRIVERS = 90, BN = BEACH_N;      // BN: the beach crowd (actors/beachgoers.js) shares the meshes
const WALK_Z = [65, 41.4, 4, -12, -60, -76], DX = 8.8;
const SHIRT = ['#ff5fa8', '#27d8cf', '#ffd447', '#f6f1e7', '#ff8a4c', '#9b7bff', '#7fe0ff', '#ff3f6a', '#8dff9a', '#f7b3c6', '#2a2140', '#ffb000'];
const LEGS = ['#f6f1e7', '#3b5a9a', '#c9b38a', '#22203a', '#ff8fb0', '#5a7ac8', '#e8e0d0', '#2f8f86'];
const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
const HAT = ['#fff6ec', '#ff3fb4', '#27e8ff', '#ffd166', '#22203a'];
const WALK = 0, WAIT = 1, DOWN = 2, FIST = 3, LIE = 4, SIT = 5, FLINCH = 6, ACT = 7;   // ACT: a beach activity pose (actors/beachgoers.js)
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

  // ---- Solano Key's sidewalks: lines beside every road, corners at every junction, crossings on the walk phase
  {
    const K = new Map(), at = (x, z) => { const k = Math.round(x * 10) + ',' + Math.round(z * 10); let n = K.get(k); if (!n) { n = { x, z, adj: [], key: true }; K.set(k, n); nodes.push(n); } return n; };
    for (const h of KH) {
      const dz = h.hw + 2.6, js = KEY_JUNCTIONS.filter((j) => j.h === h);
      const xs = [h.x0 + 2, h.x1 - 3];
      for (const j of js) { xs.push(j.x - DX, j.x + DX); }
      xs.sort((a, b) => a - b);
      for (const sz of [-1, 1]) for (let i = 0; i < xs.length - 1; i++) {
        const j = js.find((q) => xs[i] < q.x && xs[i + 1] > q.x && (sz < 0 ? q.v.z0 < q.z : q.v.z1 > q.z));
        link(at(xs[i], h.z + sz * dz), at(xs[i + 1], h.z + sz * dz), j ? { n: R.at(j.x, j.z), h: false } : null);
      }
    }
    for (const v of KV) {
      const js = KEY_JUNCTIONS.filter((j) => j.v === v), zs = [];
      if (!js.some((j) => j.z === v.z0)) zs.push(v.z0 + 2);
      if (!js.some((j) => j.z === v.z1)) zs.push(v.z1 - 2);
      for (const j of js) { const dz = j.h.hw + 2.6; if (j.z > v.z0) zs.push(j.z - dz); if (j.z < v.z1) zs.push(j.z + dz); }
      zs.sort((a, b) => a - b);
      for (const sx of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
        const j = js.find((q) => zs[i] < q.z && zs[i + 1] > q.z);
        link(at(v.x + sx * DX, zs[i]), at(v.x + sx * DX, zs[i + 1]), j ? { n: R.at(j.x, j.z), h: true } : null);
      }
    }
  }
  const inKeyF = () => game.focus().x < KEY.x1 + 20;

  // ---- instanced body parts
  // refined blocks, the cheap way: the big blocks bevelled, the small ones sharp; per-person second and third
  // colours (trousers / hair / band, accents / shoes / hands) and a face from the shared crowd atlas
  const A = crowdAtlas(), K = kit(A), W = '#ffffff', P0 = { b: 0 };
  const mat = blockyMaterial({ atlas: A, inst: true }), headMat = blockyMaterial({ atlas: A, inst: true, face: true });
  const mk = (geo, count, m = mat) => { const o = new THREE.InstancedMesh(geo, m, count); o.frustumCulled = false; scene.add(o); return o; };
  const torso = mk(mergeParts([K.B(0.4, 0.12, 0.24, 0, 0.06, 0, W, 'denim', { alt: 1, b: 0 }), K.B(0.41, 0.03, 0.25, 0, 0.12, 0, '#3a3440', 'leather', { alt: 3, b: 0 }),
    K.B(0.42, 0.2, 0.25, 0, 0.235, 0, W, 'weave'), K.B(0.45, 0.22, 0.265, 0, 0.44, 0, W, 'weave'),
    K.B(0.11, 0.08, 0.25, 0.2, 0.55, 0, W, 'seam', P0), K.B(0.11, 0.08, 0.25, -0.2, 0.55, 0, W, 'seam', P0),
    K.B(0.22, 0.04, 0.19, 0, 0.58, 0, W, 'rib', { alt: 2, b: 0 }), K.B(0.455, 0.045, 0.27, 0, 0.42, 0, W, 'plain', { alt: 2, b: 0 })]), N + BN + DRIVERS);
  const head = mk(mergeParts([K.B(0.1, 0.08, 0.1, 0, -0.02, 0, W, 'plain', P0), K.B(0.26, 0.26, 0.24, 0, 0.13, 0, W, 'plain', { b: 0.016 }), K.face(0.228, 0.228, 0, 0.13, 0.1205, W),
    K.B(0.03, 0.034, 0.02, 0, 0.1, 0.127, '#e2e2e2', 'plain', P0), K.B(0.024, 0.055, 0.045, 0.135, 0.12, 0, '#dcdcdc', 'plain', P0), K.B(0.024, 0.055, 0.045, -0.135, 0.12, 0, '#dcdcdc', 'plain', P0),
    K.B(0.275, 0.065, 0.255, 0, 0.25, -0.005, W, 'hair', { alt: 1, b: 0 }), K.B(0.275, 0.19, 0.065, 0, 0.15, -0.1, W, 'hair', { alt: 1, b: 0 }),
    K.B(0.026, 0.11, 0.15, 0.137, 0.19, -0.04, W, 'hair', { alt: 1, b: 0 }), K.B(0.026, 0.11, 0.15, -0.137, 0.19, -0.04, W, 'hair', { alt: 1, b: 0 }),
    K.B(0.19, 0.035, 0.03, 0.025, 0.24, 0.122, W, 'hair', { alt: 1, b: 0, rz: -0.12 })]), N + BN + DRIVERS, headMat);
  const limb = mk(mergeParts([K.B(0.13, 0.24, 0.14, 0, -0.12, 0, W, 'weave'), K.B(0.115, 0.04, 0.125, 0, -0.26, 0, W, 'plain', { alt: 1, b: 0 }),
    K.B(0.125, 0.22, 0.135, 0, -0.39, 0, W, 'weave', { alt: 1 }), K.B(0.13, 0.09, 0.16, 0, -0.545, 0.015, W, 'leather', { alt: 2, b: 0 }),
    K.B(0.135, 0.025, 0.165, 0, -0.6, 0.015, W, 'tread', { alt: 2, b: 0 })]), (N + BN) * 4);
  const hat = mk(mergeParts([K.B(0.26, 0.1, 0.25, 0, 0.32, 0, W, 'weave', { b: 0.012 }), K.B(0.265, 0.03, 0.255, 0, 0.285, 0, W, 'rib', { alt: 1, b: 0 }),
    K.B(0.38, 0.022, 0.36, 0, 0.275, 0, W, 'weave', P0)]), N + BN);
  const xT = instExtras(torso), xH = instExtras(head, true), xL = instExtras(limb), xHat = instExtras(hat);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 10).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N + BN);
  shadow.frustumCulled = false; shadow.renderOrder = 1; scene.add(shadow);

  const col = new THREE.Color(), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const peds = [];
  const HAIR = ['#1b1410', '#2a1a12', '#5a3a1a', '#a0703a', '#d9b26a', '#22203a', '#8a8a90', '#c4c0c8', '#b0402a'];
  const SHOE = ['#f6f1e7', '#22203a', '#ff3f6a', '#27d8cf', '#c9b38a', '#ffd447', '#5a3a1a'];
  function dress(p) {
    const i = p.i, skin = pick(SKIN), shirt = pick(SHIRT), legs = pick(LEGS);
    torso.setColorAt(i, col.set(shirt)); xT.b(i, legs); xT.c(i, Math.random() < 0.45 ? pick(SHIRT) : shirt);
    head.setColorAt(i, col.set(skin)); xH.b(i, Math.random() < 0.08 ? skin : pick(HAIR)); xH.face(i, Math.floor(Math.random() * CROWD_FACE_N));
    const long = Math.random() < 0.5, shorts = Math.random() < 0.35, shoe = pick(SHOE);
    for (const k of [0, 1]) { limb.setColorAt(i * 4 + k, col.set(legs)); xL.b(i * 4 + k, shorts ? skin : legs); xL.c(i * 4 + k, shoe); }
    for (const k of [2, 3]) { limb.setColorAt(i * 4 + k, col.set(shirt)); xL.b(i * 4 + k, long ? shirt : skin); xL.c(i * 4 + k, skin); }
    hat.setColorAt(i, col.set(pick(HAT))); xHat.b(i, pick(SHIRT));
    p.hat = Math.random() < 0.4; p.h = 0.9 + Math.random() * 0.2; p.w = 0.88 + Math.random() * 0.3; p.voice = 0.75 + Math.random() * 0.6;
    for (const m of [torso, head, limb, hat]) m.instanceColor.needsUpdate = true;
  }
  // beach clothes: swimwear and bare feet, or a vest and shorts for sport (actors/beachgoers.js)
  function dressBeach(p, mode) {
    dress(p);
    if (mode === 'casual') return;
    const i = p.i, skin = head.instanceColor ? col.fromBufferAttribute(head.instanceColor, i).getHex() : 0xc98d62, sk = '#' + skin.toString(16).padStart(6, '0');
    const suit = pick(SHIRT), one = Math.random() < 0.45;
    if (mode === 'swim') {
      torso.setColorAt(i, col.set(one ? suit : sk)); xT.b(i, suit); xT.c(i, one ? suit : sk);
      for (const k of [0, 1]) { limb.setColorAt(i * 4 + k, col.set(one ? sk : suit)); xL.b(i * 4 + k, sk); xL.c(i * 4 + k, sk); }
      for (const k of [2, 3]) { limb.setColorAt(i * 4 + k, col.set(sk)); xL.b(i * 4 + k, sk); xL.c(i * 4 + k, sk); }
      p.hat = Math.random() < 0.25;
    } else {
      torso.setColorAt(i, col.set(suit)); xT.b(i, pick(['#22203a', '#3b5a9a', '#f6f1e7', '#2f8f86'])); xT.c(i, suit);
      for (const k of [0, 1]) { limb.setColorAt(i * 4 + k, col.set(pick(['#22203a', '#3b5a9a', '#ff5fa8']))); xL.b(i * 4 + k, sk); xL.c(i * 4 + k, pick(SHOE)); }
      for (const k of [2, 3]) { limb.setColorAt(i * 4 + k, col.set(sk)); xL.b(i * 4 + k, sk); xL.c(i * 4 + k, sk); }
    }
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
  for (let i = 0; i < DRIVERS; i++) {
    const k = N + BN + i, sk = pick(SKIN);
    torso.setColorAt(k, col.set(pick(SHIRT))); xT.b(k, pick(LEGS)); xT.c(k, pick(SHIRT));
    head.setColorAt(k, col.set(sk)); xH.b(k, pick(HAIR)); xH.face(k, Math.floor(Math.random() * CROWD_FACE_N));
  }

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
    if (p.state === ACT) { beach.drawAct(p); return; }
    const gy = p.gy || 0;
    B.compose(v.set(p.x, gy, p.z), q.setFromEuler(eu.set(p.tilt, p.yaw, 0)), sc.set(p.h, p.h, p.h));
    if (p.state === FLINCH) {
      // a shot whizzed past: duck, arms over the head (never hurt, just startled)
      part(torso, i, 0, 0.74, 0, 0.38, 0, p.w, 1); part(head, i, 0, 1.34, 0.2, 0.45, 0, 1, 1);
      part(limb, i * 4, 0.1 * p.w, 0.8, 0, -0.35, 0, 1, 1.3); part(limb, i * 4 + 1, -0.1 * p.w, 0.8, 0, 0.1, 0, 1, 1.3);
      part(limb, i * 4 + 2, 0.24 * p.w, 1.28, 0.2, -2.7, 0.5, 0.85, 1); part(limb, i * 4 + 3, -0.24 * p.w, 1.28, 0.2, -2.7, -0.5, 0.85, 1);
      if (p.hat) part(hat, i, 0, 1.34, 0.2, 0.45, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
      shadow.setMatrixAt(i, M.makeTranslation(p.x, gy + 0.03, p.z));
      return;
    }
    const g = p.evt && p.state !== DOWN ? p.evt.gesture : null;
    const fist = p.state === FIST || g === 'fist' ? -2.4 + Math.sin((p.t || p.phase) * 16) * 0.35 : g === 'wave' ? -2.7 + Math.sin(p.phase * 4) * 0.35 : g === 'point' ? -1.5 : g === 'bag' ? -0.5 : p.leash && p.state === WALK ? -0.75 : 0;
    const flail = p.state === DOWN ? 2.6 : p.state === LIE ? 2.9 : 0;
    part(torso, i, 0, 0.84, 0, 0.06 * k, 0, p.w, 1);
    part(head, i, 0, 1.5, 0, 0, 0, 1, 1);
    part(limb, i * 4, 0.1 * p.w, 0.86, 0, s, 0, 1, 1.38);
    part(limb, i * 4 + 1, -0.1 * p.w, 0.86, 0, -s, 0, 1, 1.38);
    part(limb, i * 4 + 2, 0.27 * p.w, 1.38, 0, fist || -s - flail, g === 'wave' ? 0.4 : 0.08, 0.85, 1);
    part(limb, i * 4 + 3, -0.27 * p.w, 1.38, 0, s - flail, -0.08, 0.85, 1);
    if (p.hat && p.state !== LIE) part(hat, i, 0, 1.5, 0, 0, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
    if (p.state === LIE || gy < -0.3) shadow.setMatrixAt(i, ZERO); else shadow.setMatrixAt(i, M.makeTranslation(p.x, gy + 0.03, p.z));
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
    if (p.state === FLINCH) { p.t -= dt; if (p.t <= 0) { p.state = WALK; p.flee = Math.max(p.flee, 4); } p.x = H.x + p.ox; p.z = H.z + p.oz; return; }
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

  // a person a street event is directing (game/events.js): stand somewhere, walk or run to a spot, sit
  function evtStep(p, dt) {
    const E = p.evt;
    p.v = 0;
    if (p.state === DOWN) {
      p.t -= dt;
      p.tilt += ((p.t > 0.6 ? p.dir * 1.5 : 0) - p.tilt) * (1 - Math.exp(-(p.t > 0.6 ? 12 : 6) * dt));
      p.x += p.ovx * dt; p.z += p.ovz * dt;
      const k = Math.exp(-3.5 * dt); p.ovx *= k; p.ovz *= k;
      if (p.t <= 0) { p.tilt = 0; p.state = WALK; }
    } else if (p.state === FLINCH) { p.t -= dt; if (p.t <= 0) p.state = WALK; }
    else if (E.mode === 'sit') { p.state = SIT; p.sitY = 0; p.sitK = 'sand'; if (E.face) p.yaw += angleDelta(p.yaw, Math.atan2(E.face.x - p.x, E.face.z - p.z)) * (1 - Math.exp(-4 * dt)); }
    else if (E.mode === 'goto') {
      const dx = E.x - p.x, dz = E.z - p.z, d = Math.hypot(dx, dz), sp = E.speed || 1.6;
      if (d < 0.35) { E.mode = 'hold'; E.arrived = true; }
      else { const m = Math.min(d, sp * dt); p.x += dx / d * m; p.z += dz / d * m; p.v = sp; p.yaw += angleDelta(p.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-10 * dt)); }
    } else {
      if (p.state === SIT) p.state = WALK;
      const fc = E.face || game.focus();
      p.yaw += angleDelta(p.yaw, Math.atan2(fc.x - p.x, fc.z - p.z)) * (1 - Math.exp(-5 * dt));
    }
    p.phase += dt * (2 + p.v * 3.2);
  }
  function update(p, dt, t) {
    if (p.evt) { evtStep(p, dt); hitCheck(p); return; }
    if (p.hang) { hangOut(p, dt); hitCheck(p); return; }
    const e = p.e;
    p.v = 0;
    if (p.state === FLINCH) { p.t -= dt; if (p.t <= 0) { p.state = WALK; p.flee = Math.max(p.flee, 4); } return; }
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
        const sp = run ? p.runSpeed || 5.2 : 1.8, m = Math.min(off, sp * dt);
        p.yaw += angleDelta(p.yaw, Math.atan2(-p.ox, -p.oz)) * (1 - Math.exp(-10 * dt));
        p.ox -= p.ox / off * m; p.oz -= p.oz / off * m; p.v = sp;
      } else if (p.state === WAIT) {
        p.t += dt;
        const c = e.cross;
        if (run || walkOK(c.n, c.h, t, e.len / 3.1 + 1)) p.state = WALK;
        else if (p.t > 24) { p.b = p.a; p.d = e.len; p.state = WALK; }     // give up and wander on
      } else {
        p.v = run ? p.runSpeed || 5.2 : e.cross ? Math.max(p.speed, 3.1) : p.speed;
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
      grid.query(p.x, p.z, 4, (o) => {
        if (o.isPed) return;
        const ddx = p.x - o.x, ddz = p.z - o.z, d = Math.hypot(ddx, ddz), sp = Math.hypot(o.vx, o.vz);
        if (sp < 3 || o.y > 1.5 || game.vehicles.bodyDist(o, p.x, p.z) > 0.35) return;
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
  const SEATS = game.L.props.seats.filter((s) => s.kind === 'bench' || s.kind === 'chair');
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
    const { night, day } = mood(), r = Math.random(), K = inKeyF();
    // (the beach has its own crowd now, on a timetable: actors/beachgoers.js)
    const kind = K ? null : night && r < 0.5 ? (r < 0.3 ? 'club' : 'bar') : null;
    // take a seat: a fair share by day, a few on the boulevard benches in the evening
    if (!kind && Math.random() < (day ? 0.4 : mood().h < 1 || mood().h > 6 ? 0.18 : 0.05)) {
      for (let i = 0; i < 10; i++) {
        const st = SEATS[Math.floor(Math.random() * SEATS.length)];
        if (st.taken || Math.hypot(st.x - game.focus().x, st.z - game.focus().z) > 280 || (!day && (st.kind === 'lounger' || st.kind === 'towel')) || !hid(st.x, st.z, 40)) continue;
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
    const f = game.focus();
    for (let i = 0; i < 24; i++) {
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      if (Math.hypot(a.x - f.x, a.z - f.z) > 280 && i < 20) continue;
      if (night && !a.key && a.z < 30 && Math.random() < 0.6) continue;
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
    // someone left far behind (the other district) goes home, so they can come out again near you
    if (active >= target) {
      const f = game.focus();
      const far = peds.find((p) => !p.off && !p.evtLock && p.state !== DOWN && Math.hypot(p.x - f.x, p.z - f.z) > 340);
      if (far) { release(far); active--; return; }
    }
    if (active > target) {
      // send home someone out of sight; people standing in the "wrong" place for the hour go first
      let best = null, bs = -1;
      for (const p of peds) {
        if (p.off || p.state === DOWN || p.state === FIST || p.evtLock || !hid(p.x, p.z, 45)) continue;
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
      if (wrong && !p.evtLock && p.state !== DOWN && p.state !== FIST && hid(p.x, p.z, 45)) { release(p); spawn(p); }
    }
  }

  // the beach crowd: its own pool of people in the same meshes (indices N .. N + BN - 1)
  const beach = createBeachgoers({ game, base: N, count: BN, torso, head, limb, hat, shadow, part, B, M, v, q, eu, sc, ZERO, dress, dressBeach, knock, shout, hitCheck, standUp: () => {},
    S: { WALK, DOWN, LIE, SIT, FLINCH, ACT } });
  const all = () => (beach.on ? [...peds, ...beach.list] : peds);
  const api = {
    peds, count: N, beach,
    // scare everyone within r of (x, z); the closest ones go flying
    alarm(x, z, r, blast = 0) {
      for (const p of all()) {
        if (p.off) continue;
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d > r) continue;
        if (blast && d < blast) { if (knock(p, dx / (d + 0.5) * 7, dz / (d + 0.5) * 7, 2.8)) shout(p); }
        else if (p.flee <= 0 && p.state !== DOWN && Math.random() < 0.25) shout(p);
        if (p.state === WAIT) p.state = WALK;
        if (!p.evtLock) { p.flee = Math.max(p.flee, 5 + Math.random() * 4); p.tx = x; p.tz = z; }
      }
    },
    // weapons never hurt anyone: people near a shot or a bang flinch (ducking, arms over the head),
    // shout "hey!" and run away from it; further out they just leave
    scare(x, z, r, fr = 3) {
      let n = 0;
      for (const p of all()) {
        if (p.off) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d > r) continue;
        if (d < fr && p.state !== DOWN && p.state !== FLINCH && !(p.evt && p.evt.mode === 'sit')) {
          if (p.state === SIT) standUp(p);
          if (p.state === LIE) p.tilt = 0;
          p.state = FLINCH; p.t = 0.45 + Math.random() * 0.3; n++;
          shout(p);
        } else if (p.flee <= 0 && p.state !== DOWN && Math.random() < 0.3) shout(p);
        if (p.state === WAIT) p.state = WALK;
        if (!p.evtLock) { p.flee = Math.max(p.flee, 5 + Math.random() * 4); p.tx = x; p.tz = z; }
      }
      return n;
    },
    // ---- street events
    isDown: (p) => p.state === DOWN,
    flinching: (p) => p.state === FLINCH,
    tackle(p, vx, vz) { if (knock(p, vx, vz, 2.6)) { shout(p); return true; } return false; },
    // walkers (not sitting, not hanging about, not busy) between rmin and rmax of (x, z), nearest first
    walkers(x, z, rmin, rmax) {
      const out = [];
      for (const p of peds) {
        if (p.off || p.hang || p.evtLock || p.state !== WALK || p.flee > 0) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d >= rmin && d <= rmax) out.push([d, p]);
      }
      return out.sort((a, b) => a[0] - b[0]).map((a) => a[1]);
    },
    // bring someone out at the sidewalk node nearest (x, z): a spare person, or the furthest one out of sight
    spawnNear(x, z) {
      let p = peds.find((k) => k.off);
      if (!p) { let bd = -1; for (const o of peds) { const d = Math.hypot(o.x - x, o.z - z); if (!o.evtLock && o.state !== DOWN && d > bd && hid(o.x, o.z, 40)) { bd = d; p = o; } } }
      if (!p) return null;
      if (p.hang) release(p);
      let a = nodes[0], ad = 1e9;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < ad) { ad = d; a = n; } }
      dress(p); p.off = false; p.hang = null; put(p, a); p.lane = (Math.random() - 0.5) * 1.6;
      p.x = a.x; p.z = a.z;
      return p;
    },
    // hand an event person back to the crowd: back onto the nearest sidewalk path
    free(p) {
      if (!p) return;
      const x = p.x, z = p.z, down = p.state === DOWN ? { t: p.t, ovx: p.ovx, ovz: p.ovz, tilt: p.tilt, dir: p.dir } : null;
      p.evt = null; p.evtLock = false; p.runSpeed = 0; p.flee = 0; p.fistAt = false;
      if (p.state === SIT) p.state = WALK;
      let a = nodes[0], ad = 1e9;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < ad) { ad = d; a = n; } }
      put(p, a); p.lane = 0; p.ox = x - a.x; p.oz = z - a.z; p.x = x; p.z = z;
      if (down) Object.assign(p, { state: DOWN }, down);
    },
    // the nearest sidewalk node to (x, z)
    node(x, z) { let a = nodes[0], ad = 1e9; for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < ad) { ad = d; a = n; } } return a; },
    // a driver hauled out of their car: stumbles, shakes a fist, then legs it
    eject(x, z, vx, vz, angry = true) {
      const f = game.focus();
      let p = null, bd = 0;
      for (const o of peds) { const d = o.off ? 1e6 : Math.hypot(o.x - f.x, o.z - f.z); if (d > bd && o.state !== DOWN && !o.evtLock) { bd = d; p = o; } }
      if (!p) return null;
      p.off = false; p.hang = null; p.tilt = 0;
      let a = nodes[0], ad = 1e9;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < ad) { ad = d; a = n; } }
      dress(p); put(p, a);
      p.lane = 0; p.ox = x - a.x; p.oz = z - a.z; p.x = x; p.z = z;
      if (angry) { knock(p, vx, vz, 1.1); p.fistAt = true; }
      else { p.flee = 9; p.tx = x - vx; p.tz = z - vz; p.yaw = Math.atan2(vx, vz); }
      shout(p);
      return p;
    },
    // bumping into someone on skates
    bump(player) {
      if (player.speed < 5) return;
      for (const p of all()) {
        if (p.off || p.state === DOWN || Math.abs(p.x - player.pos.x) > 0.75 || Math.abs(p.z - player.pos.z) > 0.75) continue;
        if (knock(p, player.vel.x * 0.5, player.vel.z * 0.5, 1.3)) { shout(p); player.vel.x *= 0.4; player.vel.z *= 0.4; }
      }
    },
    // a bench or café chair got knocked over: whoever was sitting on it goes flying
    knockOff(seat, vx, vz) { const p = seat && seat.taken; if (p && p.i !== undefined && p.state === SIT) { knock(p, vx, vz, 2); shout(p); } },
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
      beach.update(dt, t, frame, draw);
      // drivers sit on the left: a torso and a head per occupied car
      for (const c of cars) {
        const i = N + BN + c.idx;
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
