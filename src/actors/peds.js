// Pedestrians (and the drivers you can see through car windows). Everyone is drawn with a
// handful of InstancedMeshes: torsos, heads, limbs, hats and blob shadows, so fifty people
// cost five draw calls. Refined blocks with pixel faces (actors/blocky.js). They walk a sidewalk graph and cross on the walk phase.
import * as THREE from 'three';
import { angleDelta, clamp, PI, dailyCurve, outOfSight } from '../core/util.js';
import { kit, blockyMaterial, instExtras, crowdAtlas, mergeParts, CROWD_FACE_N } from './blocky.js';
import { SIDE_X, KEY, FOOTPRINTS, FOOTBOXES, onRoad } from '../world/layout.js';
import { KH, KV, KEY_JUNCTIONS } from '../world/key.js';
import { H_ROADS, walkOK } from '../world/roads.js';
import { createBeachgoers, BEACH_N } from './beachgoers.js';
import { createPedProps } from './pedprops.js';

// BN: the beach crowd (actors/beachgoers.js) shares the meshes; DRIVERS: one per vehicle slot (vehicles.js CAP)
const N = 52, DRIVERS = 110, BN = BEACH_N;
const WALK_Z = [65, 41.4, 4, -12, -60, -76], DX = 8.8;
const SHIRT = ['#ff5fa8', '#27d8cf', '#ffd447', '#f6f1e7', '#ff8a4c', '#9b7bff', '#7fe0ff', '#ff3f6a', '#8dff9a', '#f7b3c6', '#2a2140', '#ffb000'];
const LEGS = ['#f6f1e7', '#3b5a9a', '#c9b38a', '#22203a', '#ff8fb0', '#5a7ac8', '#e8e0d0', '#2f8f86'];
const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
const HAT = ['#fff6ec', '#ff3fb4', '#27e8ff', '#ffd166', '#22203a'];
const WALK = 0, WAIT = 1, DOWN = 2, FIST = 3, LIE = 4, SIT = 5, FLINCH = 6, ACT = 7;   // ACT: a beach activity pose (actors/beachgoers.js)
// Share of the crowd out and about by hour: rush hours busiest, nightlife on the boulevard, empty small hours.
export const CROWD_CURVE = [[0, 0.62], [1, 0.3], [2, 0.12], [5, 0.1], [6.5, 0.45], [7.4, 1], [9, 1], [10.2, 0.72], [16, 0.75], [17, 1], [19, 1], [20.2, 0.85], [23, 0.75], [24, 0.62]];

const SEAT0 = [0.42, 0.66, -0.55];          // the sedan's driver seat (other types: vehicles/types.js seat)
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
  // umbrellas for the rain: one instanced canopy + shaft (instance colour = canopy), only drawn while it rains
  const umbG = (() => {
    const c = new THREE.ConeGeometry(0.62, 0.26, 8, 1, true).toNonIndexed(); c.translate(0, 0.86, 0);
    const g = c; g.deleteAttribute('uv');
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i += 3) { const k = Math.floor(i / 3) % 2 ? 1 : 0.78; for (let j = 0; j < 3; j++) col.set([k, k, k], (i + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const shaft = new THREE.CylinderGeometry(0.014, 0.014, 0.95, 4).toNonIndexed(); shaft.translate(0, 0.5, 0); shaft.deleteAttribute('uv');
    shaft.setAttribute('color', new THREE.BufferAttribute(new Float32Array(shaft.attributes.position.count * 3).fill(0.25), 3));
    const hook = new THREE.BoxGeometry(0.03, 0.08, 0.03).toNonIndexed(); hook.translate(0, 0.04, 0); hook.deleteAttribute('uv');
    hook.setAttribute('color', new THREE.BufferAttribute(new Float32Array(hook.attributes.position.count * 3).fill(0.2), 3));
    return mergeParts([g, shaft, hook]);
  })();
  const umb = new THREE.InstancedMesh(umbG, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), N);
  umb.frustumCulled = false; scene.add(umb);
  const UMB_C = ['#ff3f6a', '#27d8cf', '#ffd447', '#22203a', '#9b7bff', '#ff8a4c', '#f6f1e7', '#2f6fb0', '#8dff9a', '#ff5fa8'];
  for (let i = 0; i < N; i++) umb.setColorAt(i, new THREE.Color(UMB_C[i % UMB_C.length]));
  let rainK = 0;
  // drivers' arms: upper arm + forearm per arm, 4 instances per vehicle slot, one extra draw call (placed in update())
  const arms = mk(mergeParts([K.B(0.1, 1, 0.1, 0, -0.5, 0, W, 'weave', P0)]), DRIVERS * 4);
  instExtras(arms);
  const xT = instExtras(torso), xH = instExtras(head, true), xL = instExtras(limb), xHat = instExtras(hat);
  const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 10).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), N + BN);
  shadow.frustumCulled = false; shadow.renderOrder = 1; scene.add(shadow);

  const ZERO0 = new THREE.Matrix4().makeScale(0, 0, 0);
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
    p.umb = Math.random() < 0.62; p.hurry = 0.5 + Math.random() * 0.7;
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
    Object.assign(p, { a, b: e.to, e, d: 0, state: WALK, t: 0, ox: 0, oz: 0, ovx: 0, ovz: 0, tilt: 0, flee: 0, tx: 0, tz: 0, sx: 0, sxv: 0, slow: 1, stuck: 0 });
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
    const k = N + BN + i, sk = pick(SKIN), sh = pick(SHIRT);
    for (let a = 0; a < 4; a++) arms.setColorAt(i * 4 + a, col.set(a & 1 ? sk : sh));      // sleeve, then bare forearm
    arms.setMatrixAt(i * 4, ZERO0); arms.setMatrixAt(i * 4 + 1, ZERO0); arms.setMatrixAt(i * 4 + 2, ZERO0); arms.setMatrixAt(i * 4 + 3, ZERO0);
    torso.setColorAt(k, col.set(sh)); xT.b(k, pick(LEGS)); xT.c(k, pick(SHIRT));
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
    // in the rain: an umbrella held up in the right hand (walking, waiting, standing about); none on the beach
    const brolly = i < N && p.umb && rainK > 0.15 && (p.state === WALK || p.state === WAIT) && !g && p.flee <= 0 && !(p.hang && p.hang.kind === 'shelter');
    if (i < N) { if (brolly) { Lm.compose(v.set(-0.24 * p.w, 1.33, 0.2), q.setFromEuler(eu.set(0.08, 0, -0.05)), sc.set(1, 1, 1)); umb.setMatrixAt(i, M.multiplyMatrices(B, Lm)); } else umb.setMatrixAt(i, ZERO); }
    part(torso, i, 0, 0.84, 0, 0.06 * k, 0, p.w, 1);
    part(head, i, 0, 1.5, 0, 0, 0, 1, 1);
    part(limb, i * 4, 0.1 * p.w, 0.86, 0, s, 0, 1, 1.38);
    part(limb, i * 4 + 1, -0.1 * p.w, 0.86, 0, -s, 0, 1, 1.38);
    part(limb, i * 4 + 2, 0.27 * p.w, 1.38, 0, fist || -s - flail, g === 'wave' ? 0.4 : 0.08, 0.85, 1);
    part(limb, i * 4 + 3, -0.27 * p.w, 1.38, 0, brolly ? -1.05 : s - flail, -0.08, 0.85, 1);
    if (p.hat && p.state !== LIE && !brolly) part(hat, i, 0, 1.5, 0, 0, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
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
      // shuffle about a little and face the group's centre (under a shelter: stay put out of the rain)
      if (H.still) { H.wx = H.wz = 0; }
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

  // ---- vehicles as obstacles. Every vehicle's footprint is its type's own box (vehicles/types.js len x w,
  // oriented by its yaw), padded by a person's radius. Walkers look a few metres ahead along their path and
  // pick a sidestep (a lateral offset, sx) that clears any car standing on it, then drift back once past;
  // anyone who still ends up inside a box (a car parked or spawned onto them, a tumble against a bumper) is
  // pushed straight out. Moving cars (3 m/s and more) knock people over as before (hitCheck). Cheap: the
  // per-frame neighbour grid (main.js) gives the few cars within reach.
  const PR = 0.3, BOXK = { car: [2.2, 0.95], truck: [2.7, 1.05], bike: [1.1, 0.4], tank: [3.3, 2.0], heli: [2.6, 1.5] };
  const VB = [];                                  // scratch: nearby boxes [cx, cz, fx, fz, hl, hw, stopped, static prop]
  for (let k = 0; k < 64; k++) VB.push([0, 0, 0, 0, 0, 0, 0, 0]);
  let nVB = 0, nCars = 0;
  const stats = { pushes: 0, sidesteps: 0, turned: 0, ms: 0, calls: 0, blocked: 0, steered: 0, ghosts: 0 };
  // fixed props (actors/pedprops.js): the same kind of box, always 'stopped', so the walkers' sidestep and the
  // push-out below treat them like a parked car. Built on the first frame (the loose props come after the peds).
  const PROPS = createPedProps(game, FOOTPRINTS, FOOTBOXES);
  let propsOn = false;
  const nearProps = (x, z, r, ex1, ez1, ex2, ez2) => { if (!propsOn || !api.collide || !api.avoidProps) return nVB; return (nVB = PROPS.fill(VB, nVB, x, z, r, ex1, ez1, ex2, ez2)); };
  function nearCars(x, z, r) {
    nVB = nCars = 0;
    if (!api.collide) return 0;
    grid.query(x, z, r, (o) => {
      if (o.isPed || o.off || nVB >= VB.length || (o.y || 0) > 1.5 || (o.kind === 'heli' && !(o.y < 0.6))) return;
      const T = o.spec, hl = T ? T.len / 2 : (BOXK[o.kind] || BOXK.car)[0], hw = T ? T.w / 2 : (BOXK[o.kind] || BOXK.car)[1];
      const dx = x - o.x, dz = z - o.z;
      if (dx * dx + dz * dz > (r + hl) * (r + hl)) return;
      const b = VB[nVB++];
      b[0] = o.x; b[1] = o.z; b[2] = Math.sin(o.yaw); b[3] = Math.cos(o.yaw); b[4] = hl; b[5] = hw;
      b[6] = o.kind === 'tank' ? Math.abs(o.speed || 0) < 2 : Math.hypot(o.vx || 0, o.vz || 0) < 2; b[7] = 0;
    });
    return (nCars = nVB);
  }
  // how far (cx, cz) must move to get the point (x, z) out of every nearby box (padded by PR); 0 if clear
  const PUSH = [0, 0];
  function carPush(x, z) {
    let ox = 0, oz = 0;
    for (let k = 0; k < nVB; k++) {
      const b = VB[k], rx = x + ox - b[0], rz = z + oz - b[1];
      const la = rx * b[2] + rz * b[3], lp = rx * b[3] - rz * b[2];
      const ea = b[4] + PR - Math.abs(la), ep = b[5] + PR - Math.abs(lp);
      if (ea <= 0 || ep <= 0) continue;
      if (ep < ea) { const m = (lp < 0 ? -ep : ep) + (lp < 0 ? -0.01 : 0.01); ox += b[3] * m; oz -= b[2] * m; }
      else { const m = (la < 0 ? -ea : ea) + (la < 0 ? -0.01 : 0.01); ox += b[2] * m; oz += b[3] * m; }
    }
    PUSH[0] = ox; PUSH[1] = oz;
    return ox !== 0 || oz !== 0;
  }
  // anyone not walking the sidewalk graph (hanging about, an event's actor, the beach crowd): just pushed out
  // (props: also out of fixed props, except the one the person is using: a goal / origin spot, see pedprops.js)
  function shove(p, props = true, gx = NaN, gz = NaN, ux = NaN, uz = NaN) {
    if (p.state === SIT || p.state === LIE || p.state === ACT || (p.gy || 0) < -0.3) return false;
    nearCars(p.x, p.z, 4);
    if (props) nearProps(p.x, p.z, 2.5, gx, gz, ux, uz);
    if (!nVB || !carPush(p.x, p.z)) return false;
    stats.pushes++;
    return true;
  }
  // a walker on edge (a -> b): the lateral offset that clears every stopped car ahead, from the box corners
  // projected onto the path's frame (along u, across n). Returns [target lateral, along-distance to the
  // nearest blocking car or Infinity].
  const AV = [0, 0, 0], LATMAX = 3;
  // can someone stand at lateral offset l on this path, abreast of the prop? (not out into the road, not far off the line)
  function latOK(l, ax, az, ux, uz, ca, cross) {
    if (Math.abs(l) > LATMAX) return false;
    return cross || !onRoad(ax + ux * ca - uz * l, az + uz * ca + ux * l, 0.1);
  }
  // Every box within the look-ahead window, as [from, to, lo, hi, static, centre] along (u) and across (n) the path.
  // The sidestep is the candidate lateral (the lane itself, or just outside either side of any box) nearest to
  // where the person is that clears every box in the window; if the whole window is too crowded (two props
  // either side of the way, a prop and a hydrant), the window is shortened to the nearest boxes and tried
  // again, so the next prop is dealt with once the first is passed. Nothing fits: blocked (stop short, turn round).
  const AB = [];
  for (let k = 0; k < 64; k++) AB.push([0, 0, 0, 0, 0, 0]);
  const CAND = new Float64Array(300);
  function avoid(p, ax, az, ux, uz, s, L, look, cross) {
    const M = PR + 0.2, lane = p.lane;
    let n = 0, near = Infinity;
    for (let k = 0; k < nVB; k++) {
      const b = VB[k];
      if (!b[6]) continue;
      const bx = b[0] - ax, bz = b[1] - az, ca = bx * ux + bz * uz, cl = -bx * uz + bz * ux;
      // half extents of the oriented box along u and n
      const fu = b[2] * ux + b[3] * uz, fn = -b[2] * uz + b[3] * ux;
      const ea = Math.abs(fu) * b[4] + Math.abs(fn) * b[5] + M, el = Math.abs(fn) * b[4] + Math.abs(fu) * b[5] + M;
      if (ca + ea < s - 0.2 || ca - ea > s + look) continue;
      const r = AB[n++]; r[0] = ca - ea; r[1] = ca + ea; r[2] = cl - el; r[3] = cl + el; r[4] = b[7]; r[5] = ca;
      if (lane > r[2] && lane < r[3]) near = Math.min(near, Math.max(0, r[0] - s));
    }
    AV[1] = near; AV[2] = 0;
    if (near === Infinity) { AV[0] = lane; return AV; }
    for (const w of [1, 0.6, 0.3, 0]) {          // window: 100 %, 60 %, 30 %, 0 % of the look-ahead
      const end = s + look * w;
      let nc = 0;
      CAND[0] = lane; CAND[1] = 0; nc = 1;
      for (let k = 0; k < n; k++) { const r = AB[k]; if (r[0] > end) continue; CAND[nc * 2] = r[2] - 0.05; CAND[nc * 2 + 1] = r[5]; nc++; CAND[nc * 2] = r[3] + 0.05; CAND[nc * 2 + 1] = r[5]; nc++; }
      let best = NaN, bd = Infinity;
      for (let c = 0; c < nc; c++) {
        const l = CAND[c * 2];
        const d = Math.abs(l - L);
        if (d >= bd) continue;
        let ok = true;
        for (let k = 0; k < n; k++) { const r = AB[k]; if (r[0] > end) continue; if (l > r[2] && l < r[3]) { ok = false; break; } }
        if (!ok) continue;
        // a sidestep round a fixed prop stays on the sidewalk: not out into the road, not far off the line
        if (c > 0) { let st = false; for (let k = 0; k < n; k++) { const r = AB[k]; if (r[4] && r[5] === CAND[c * 2 + 1]) { st = true; break; } } if (st && !latOK(l, ax, az, ux, uz, CAND[c * 2 + 1], cross)) continue; }
        best = l; bd = d;
      }
      if (best === best) { AV[0] = best; return AV; }
    }
    AV[0] = lane; AV[2] = 1;
    return AV;
  }
  // A free mover (the beach crowd, walking straight at a goal): the direction to take so as not to run into a
  // fixed prop. Rays along the wanted direction, then bent to either side in steps until one is clear for `look`.
  // Props at the goal (gx, gz) or at the spot the person is using / leaving (p.use) are exempt.
  const STE = [0, 0], RM = PR + 0.15;
  function rayT(b, px, pz, dx, dz) {
    const rx = px - b[0], rz = pz - b[1], oa = rx * b[2] + rz * b[3], op = rx * b[3] - rz * b[2], da = dx * b[2] + dz * b[3], dp = dx * b[3] - dz * b[2], ha = b[4] + RM, hp = b[5] + RM;
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(da) < 1e-6) { if (Math.abs(oa) > ha) return Infinity; } else { let a = (-ha - oa) / da, c = (ha - oa) / da; if (a > c) { const x = a; a = c; c = x; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (Math.abs(dp) < 1e-6) { if (Math.abs(op) > hp) return Infinity; } else { let a = (-hp - op) / dp, c = (hp - op) / dp; if (a > c) { const x = a; a = c; c = x; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    return t1 > Math.max(t0, 0) ? Math.max(t0, 0) : Infinity;
  }
  const clearT = (px, pz, dx, dz) => { let m = Infinity; for (let k = 0; k < nVB; k++) { const t = rayT(VB[k], px, pz, dx, dz); if (t < m) m = t; } return m; };
  function steer(p, dx, dz, look, gx, gz) {
    STE[0] = dx; STE[1] = dz;
    if (!propsOn || !api.collide || !api.avoidProps || p.ghost > 0) return STE;
    nVB = 0;
    const u = p.use;
    nearProps(p.x, p.z, look + 2.5, gx, gz, u ? u[0] : NaN, u ? u[1] : NaN);
    if (!nVB) { p.sw = 0; return STE; }
    let best = clearT(p.x, p.z, dx, dz);
    if (best >= look) { p.sw = 0; return STE; }
    stats.steered++;
    // which way round: keep the side already chosen, else away from the middle of the nearest blocker
    let side = p.sw;
    if (!side) {
      let nb = null, nt = Infinity;
      for (let k = 0; k < nVB; k++) { const t = rayT(VB[k], p.x, p.z, dx, dz); if (t < nt) { nt = t; nb = VB[k]; } }
      side = nb && ((nb[0] - p.x) * dz - (nb[1] - p.z) * dx) > 0 ? -1 : 1;
    }
    let bx = dx, bz = dz;
    for (let k = 1; k <= 7; k++) {
      const ang = side * (k & 1 ? 1 : -1) * 0.42 * Math.ceil(k / 2);
      const c = Math.cos(ang), s2 = Math.sin(ang), ndx = dx * c - dz * s2, ndz = dx * s2 + dz * c, t = clearT(p.x, p.z, ndx, ndz);
      if (t > best) { best = t; bx = ndx; bz = ndz; }
      if (t >= look) { p.sw = side * (k & 1 ? 1 : -1); break; }
    }
    STE[0] = bx; STE[1] = bz;
    return STE;
  }
  function update(p, dt, t) {
    if (p.evt) { evtStep(p, dt); if (shove(p)) { p.x += PUSH[0]; p.z += PUSH[1]; } hitCheck(p); return; }
    if (p.hang) { hangOut(p, dt); if (shove(p)) { p.ox += PUSH[0]; p.oz += PUSH[1]; p.x += PUSH[0]; p.z += PUSH[1]; } hitCheck(p); return; }
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
        // caught in the rain without an umbrella: hurry, some break into a jog
        if (rainK > 0.2 && !(p.umb && rainK > 0.15)) p.v *= 1 + rainK * p.hurry;
        p.v *= p.slow;
        p.d += p.v * dt;
        if (p.d >= e.len) {
          const from = p.a, at = p.b;
          let opts = at.adj.filter((x) => x.to !== from);
          if (!opts.length) opts = at.adj;
          let nx = opts[Math.floor(Math.random() * opts.length)];
          // when fleeing, take whichever way leads away from the trouble
          if (run) { let bd = -1; for (const o of at.adj) { const d = Math.hypot(o.to.x - p.tx, o.to.z - p.tz); if (d > bd) { bd = d; nx = o; } } }
          // carry the sidestep over the corner: same spot in the world, expressed in the new edge's frame
          const il0 = 1 / (e.len || 1), wx = -(at.z - from.z) * il0 * p.sx, wz = (at.x - from.x) * il0 * p.sx;
          const il1 = 1 / (nx.len || 1), ux = (nx.to.x - at.x) * il1, uz = (nx.to.z - at.z) * il1;
          p.a = at; p.b = nx.to; p.e = nx; p.d = Math.max(-2, Math.min(nx.len, (p.d - e.len) + wx * ux + wz * uz)); p.sx = -wx * uz + wz * ux;
          if (nx.cross && !run) { p.state = WAIT; p.t = 0; }
        }
      }
    }
    const a = p.a, b = p.b, dx = b.x - a.x, dz = b.z - a.z, il = 1 / (Math.hypot(dx, dz) || 1), ux = dx * il, uz = dz * il;
    // cars on the way: pick a sidestep that clears them (walking or waiting at a crossing), then the push-out
    p.slow = 1;
    const tc = performance.now();
    nearCars(p.x, p.z, 7); nearProps(p.x, p.z, 6);
    if (nVB) {
      const free = p.state === WALK && Math.hypot(p.ox, p.oz) <= 0.25;
      if (free || p.state === WAIT) {
        const L = p.lane + p.sx, av = avoid(p, a.x, a.z, ux, uz, p.d, L, 2.2 + p.speed * 0.6, !!e.cross);
        const want = av[0] - p.lane, gap = Math.abs(want - p.sx);
        if (want !== 0 && gap > 0.02) stats.sidesteps++;
        // close to a car with the sidestep not done yet: mostly step sideways, barely forwards
        if (av[1] < 1.4 && gap > 0.12) p.slow = 0.12 + 0.6 * clamp(av[1] / 1.4, 0, 1) * 0.3;
        // a prop (or a car) across the whole way, no room to step round it: stop short of it, then turn round
        if (av[2]) { p.slow = Math.min(p.slow, clamp(av[1] / 1.2, 0, 1)); if (av[1] < 0.6) stats.blocked++; }
        const st = clamp(want - p.sx, -1.9 * dt, 1.9 * dt); p.sx += st; p.sxv = dt > 0 ? st / dt : 0;
        p.stuck = (av[1] < 0.3 && gap > 0.12 && free) || (av[2] && av[1] < 0.6) ? (p.stuck || 0) + dt : 0;
      }
      else p.sxv = 0;
    } else { const st = clamp(-p.sx, -1.2 * dt, 1.2 * dt); p.sx += st; p.sxv = dt > 0 ? st / dt : 0; p.stuck = 0; }
    p.x = a.x + ux * p.d - uz * (p.lane + p.sx) + p.ox; p.z = a.z + uz * p.d + ux * (p.lane + p.sx) + p.oz;
    if (nVB && carPush(p.x, p.z)) {
      stats.pushes++;
      const cx = PUSH[0], cz = PUSH[1];
      if (p.state === WALK && Math.hypot(p.ox, p.oz) <= 0.25 || p.state === WAIT) { p.d += cx * ux + cz * uz; p.sx += -cx * uz + cz * ux; }
      else {
        // knocked or heading back to the path with a car in between: fold the offset into the path frame
        p.ox += cx; p.oz += cz;
        if (p.state === WALK) { const ox = p.ox, oz = p.oz; p.ox = p.oz = 0; p.d += ox * ux + oz * uz; p.sx += -ox * uz + oz * ux; }
      }
      p.d = Math.max(-2, Math.min(p.e.len + 0.5, p.d));
      p.x += cx; p.z += cz;
    }
    // boxed in for a while (a car right across the way with no side to step to): turn round
    if (p.stuck > 3) {
      stats.turned++;
      const A = p.a; p.a = p.b; p.b = A; p.d = p.e.len - p.d; p.lane = -p.lane; p.sx = -p.sx; p.stuck = 0;
      p.e = p.a.adj.find((x) => x.to === p.b) || p.e;
      if (p.state === WAIT) p.state = WALK;
    }
    stats.ms += performance.now() - tc; stats.calls++;
    if (p.state === WALK && p.v && Math.hypot(p.ox, p.oz) <= 0.25) { const yx = ux * p.v * p.slow - uz * (p.sxv || 0), yz = uz * p.v * p.slow + ux * (p.sxv || 0); p.yaw += angleDelta(p.yaw, Math.atan2(yx, yz)) * (1 - Math.exp(-8 * dt)); }
    p.phase += dt * (2 + p.v * 3.2);
    hitCheck(p);
  }
  // a driver's arm from the shoulder S to the hand H (car-local, drawn under the current B): two segments of
  // length a with the elbow bent down and out. Instance base = upper arm, base + 1 = forearm.
  const AS = new THREE.Vector3(), AH = new THREE.Vector3(), AE = new THREE.Vector3(), AD = new THREE.Vector3(), AN = new THREE.Vector3(), AQ = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0), ASC = new THREE.Vector3();
  function seg(idx, p0, p1) {
    AD.subVectors(p1, p0);
    const len = AD.length() || 1e-3;
    Lm.compose(p0, AQ.setFromUnitVectors(DOWN, AD.multiplyScalar(1 / len)), ASC.set(1, len, 1));
    arms.setMatrixAt(idx, M.multiplyMatrices(B, Lm));
  }
  function arm(base, sx, sy, sz, hx, hy, hz, a) {
    AS.set(sx, sy, sz); AH.set(hx, hy, hz);
    AD.subVectors(AH, AS);
    let L = AD.length();
    const mx = 2 * a * 0.98;
    if (L > mx) { AH.copy(AS).addScaledVector(AD, mx / L); AD.subVectors(AH, AS); L = mx; }
    AD.multiplyScalar(1 / L);
    AN.set(sx > 0 || (sx === 0 && hx > 0) ? 0.5 : -0.5, -1, -0.25); AN.addScaledVector(AD, -AN.dot(AD)).normalize();
    AE.copy(AS).addScaledVector(AD, L / 2).addScaledVector(AN, Math.sqrt(Math.max(0, a * a - L * L / 4)));
    seg(base, AS, AE); seg(base + 1, AE, AH);
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
  // out of the rain: under the bus shelters and the shop awnings along the back streets
  spots.shelter = { list: [] };
  for (const [x, z, yaw] of game.L.busStops || []) for (const o of [-1.0, 0, 1.0]) {
    const s2 = Math.sin(yaw), c2 = Math.cos(yaw), lx = o, lz = 0.1;
    spots.shelter.list.push({ x: x + c2 * lx + s2 * lz, z: z - s2 * lx + c2 * lz, cx: x + s2 * 3, cz: z + c2 * 3, still: true });
  }
  for (const b of game.L.buildings) if (b.row > 0 && !b.place && b.w > 12) for (const o of [-0.25, 0.22]) spots.shelter.list.push({ x: b.cx + b.w * o, z: b.z1 + 0.85, cx: b.cx + b.w * o, cz: b.z1 + 5, still: true });
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
    for (const m of [torso, head, hat, shadow, umb]) m.setMatrixAt(p.i, ZERO);
    for (let k = 0; k < 4; k++) limb.setMatrixAt(p.i * 4 + k, ZERO);
  }
  function spawn(p) {
    const { night, day } = mood(), r = Math.random(), K = inKeyF();
    // (the beach has its own crowd now, on a timetable: actors/beachgoers.js)
    const kind = K ? null : rainK > 0.3 && r < 0.45 ? 'shelter' : night && r < 0.5 ? (r < 0.3 ? 'club' : 'bar') : null;
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
    rainK = game.env.indoor ? rainK : game.env.w.rain;
    const storm = game.env.weather === 'storm' ? 1 : 0;
    target = Math.round(N * dailyCurve(CROWD_CURVE, game.env.tod) * (1 - 0.3 * clamp(rainK, 0, 1) - 0.25 * storm));
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
        const wrong = p.hang && ((p.hang.kind === 'shelter' && rainK < 0.15) || (p.hang.kind === 'beach' && !day) || (p.hang.kind === 'seat' && !day && p.state === SIT && (p.sitK === 'lounger' || p.sitK === 'towel')) || (p.hang.kind !== 'beach' && p.hang.kind !== 'seat' && !night));
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
      const wrong = !p.off && (p.hang ? (p.hang.kind === 'shelter' ? rainK < 0.15 : p.hang.kind === 'beach' ? !day : p.hang.kind === 'seat' ? Math.random() < 0.3 : !night) : (night || day) && Math.random() < 0.35);
      if (wrong && !p.evtLock && p.state !== DOWN && p.state !== FIST && hid(p.x, p.z, 45)) { release(p); spawn(p); }
    }
  }

  // the beach crowd: its own pool of people in the same meshes (indices N .. N + BN - 1)
  const beach = createBeachgoers({ game, base: N, count: BN, torso, head, limb, hat, shadow, part, B, M, v, q, eu, sc, ZERO, dress, dressBeach, knock, shout, standUp: () => {},
    steer, onGhost: () => { stats.ghosts++; },
    hitCheck: (p) => { const u = p.use; if (shove(p, !(p.ghost > 0), p.gx, p.gz, u ? u[0] : NaN, u ? u[1] : NaN)) { p.x += PUSH[0]; p.z += PUSH[1]; } hitCheck(p); },
    S: { WALK, DOWN, LIE, SIT, FLINCH, ACT } });
  const all = () => (beach.on ? [...peds, ...beach.list] : peds);
  const api = {
    peds, count: N, beach, carStats: stats, collide: true, avoidProps: true, props: PROPS,
    // the footprint box test the checks use: is (x, z) inside any nearby vehicle (unpadded)?
    inCar(x, z) { nearCars(x, z, 4); for (let k = 0; k < nVB; k++) { const b = VB[k], rx = x - b[0], rz = z - b[1]; if (Math.abs(rx * b[2] + rz * b[3]) < b[4] && Math.abs(rx * b[3] - rz * b[2]) < b[5]) return true; } return false; },
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
      if (!propsOn && api.collide) { PROPS.build(); if (game.loose) PROPS.bindLoose(game.loose); propsOn = true; }
      if (propsOn && game.loose && frame % 8 === 0) PROPS.scan();
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
        const i = N + BN + c.idx, ai = c.idx * 4;
        // (the player's own car too: the figure shows through the glass; the convertible gets Skye herself, main.js)
        if (c.off || !(c.hasDriver || c.driven) || !(c.ai || c.jacking || (c.driven && c.kind === 'car' && c.type !== 'coupe' && !game.vehicles.firstPerson))) { torso.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); for (let a = 0; a < 4; a++) arms.setMatrixAt(ai + a, ZERO); continue; }
        B.compose(v.set(c.x, c.y, c.z), q.setFromEuler(eu.set(c.tx, c.yaw, c.tz)), sc.set(1, 1, 1));
        // the wheel angle follows the car's steering input a little late
        c.wa = (c.wa || 0) + ((c.steerLast || 0) * 1.1 - (c.wa || 0)) * Math.min(1, dt * 10);
        if (c.kind === 'bike') {
          part(torso, i, 0, 0.92, -0.42, 0.5, 0, 0.9, 0.9); part(head, i, 0, 1.42, -0.1, 0.1, 0, 1, 1);
          for (const sd of [1, -1]) arm(ai + (sd > 0 ? 0 : 2), sd * 0.24, 1.35, -0.19, sd * 0.3, 1.2, 0.46 + sd * c.wa * 0.05, 0.36);
          continue;
        }
        const st = (c.spec && c.spec.seat) || SEAT0;
        part(torso, i, st[0], st[1], st[2], -0.12, 0, 0.9, 0.9);
        part(head, i, st[0], st[1] + 0.58, st[2] - 0.05, 0, 0, 1, 1);
        // hands on a wheel in front of the seat, turned by the steering
        const ca = Math.cos(c.wa), sa = Math.sin(c.wa);
        for (const sd of [1, -1]) arm(ai + (sd > 0 ? 0 : 2), st[0] + sd * 0.24, st[1] + 0.49, st[2] - 0.11, st[0] + sd * 0.16 * ca, st[1] + 0.22 + sd * 0.16 * sa, st[2] + 0.42 - sd * 0.16 * sa * 0.3, 0.3);
      }
      for (const m of [torso, head, limb, hat, shadow, arms, umb]) m.instanceMatrix.needsUpdate = true;
      umb.visible = rainK > 0.15;
    },
    // rain checks: umbrellas up, people sheltering, people hurrying
    rainStats() { const on = peds.filter((p) => !p.off); return { rain: +rainK.toFixed(2), active: on.length, target, umbrellas: on.filter((p) => p.umb && (p.state === WALK || p.state === WAIT) && !p.hang && rainK > 0.15).length, sheltering: on.filter((p) => p.hang && p.hang.kind === 'shelter').length, hurrying: on.filter((p) => !p.hang && !(p.umb) && rainK > 0.2 && p.state === WALK).length, shelterSpots: spots.shelter.list.length }; },
  };
  return api;
}
