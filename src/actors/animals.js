// Beach wildlife: crabs, sandpipers on the waterline, pelicans on the pier posts, a friendly dog (pat it: F) and
// sea turtles at dusk. One InstancedMesh per species (five draw calls, all hidden when the camera is
// far from the beach); legs, wings, flippers and the dog's tail move in the vertex shader from a
// per-instance "action" attribute, so the CPU only writes a matrix and three numbers per animal.
// Nothing here can be hurt: whatever comes too close (you, a car, a pedestrian) they simply scatter.
import * as THREE from 'three';
import { box, tint, merge, clamp, damp, angleDelta, timeU, PI, unseen, pushOut } from '../core/util.js';
import { HX, HZ, PIER, clampToWorld } from '../world/layout.js';

const CRABS = 20, BIRDS = 12, PELICANS = 4, TURTLES = 3;
const BEACH = { x0: -288, x1: 288, z0: 84, z1: HZ - 1.5 };

// tag a part: 0 body, 1 legs, 2 wings / flippers, 3 tail
function part(g, k) { g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); return g; }

function speciesMaterial(o) {
  const U = { uTime: timeU, uRoot: { value: o.root || 0.05 }, uFlap: { value: o.flap || 20 }, uLeg: { value: o.leg || 24 }, uLegAmp: { value: o.legAmp || 0.03 }, uLegTop: { value: o.legTop || 0.1 } };
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aPart; attribute vec3 aAct; uniform float uTime, uRoot, uFlap, uLeg, uLegAmp, uLegTop;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      float side = position.x < 0.0 ? -1.0 : 1.0;
      if (aPart > 0.5 && aPart < 1.5) {
        float foot = clamp((uLegTop - position.y) / uLegTop, 0.0, 1.0);
        float pair = side * (position.z < 0.0 ? -1.0 : 1.0);
        transformed.z += sin(uTime * uLeg + aAct.x + pair * 1.5708) * uLegAmp * aAct.y * foot;
        transformed.y += max(0.0, sin(uTime * uLeg + aAct.x + pair * 1.5708 + 1.5708)) * uLegAmp * 0.6 * aAct.y * foot;
      } else if (aPart > 1.5 && aPart < 2.5) {
        // wings: folded against the body (0), spread (1), flapping (2)
        float spread = clamp(aAct.z, 0.0, 1.0);
        float flap = sin(uTime * uFlap + aAct.x) * 0.75 * clamp(aAct.z - 1.0, 0.0, 1.0);
        float rx = (abs(position.x) - uRoot) * mix(0.15, 1.0, spread);
        transformed.x = side * (uRoot + rx * cos(flap));
        transformed.y = position.y + rx * sin(flap);
      } else if (aPart > 2.5) {
        // the dog's tail: faster with its trot, and a happy blur while it sits for a pat (wag > 1.5)
        float happy = step(1.5, aAct.z);
        transformed.x += sin(uTime * (8.0 + aAct.y * 10.0 + happy * 14.0) + aAct.x) * (0.1 + happy * 0.04) * clamp(-position.z - 0.25, 0.0, 1.0) * 3.0;
      }`);
  };
  return m;
}
function makeMesh(scene, geo, mat, n) {
  const act = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  act.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAct', act);
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

export function createAnimals(scene, game) {
  const { L, grid, audio, env } = game;
  // ---- geometry (toy-like, a handful of boxes each)
  const crabGeo = merge([
    part(box(0.34, 0.12, 0.24, 0, 0.12, 0, '#ff6a3d'), 0), part(box(0.24, 0.05, 0.18, 0, 0.19, 0, '#ff8a5c'), 0),
    part(box(0.03, 0.08, 0.03, -0.06, 0.24, 0.1, '#22203a'), 0), part(box(0.03, 0.08, 0.03, 0.06, 0.24, 0.1, '#22203a'), 0),
    part(box(0.1, 0.07, 0.11, -0.2, 0.13, 0.15, '#ff4f2a'), 0), part(box(0.1, 0.07, 0.11, 0.2, 0.13, 0.15, '#ff4f2a'), 0),
    ...[-0.07, 0.01, 0.08].flatMap((z) => [part(box(0.18, 0.03, 0.03, -0.24, 0.07, z, '#e0502a', 0, 0, -0.5), 1), part(box(0.18, 0.03, 0.03, 0.24, 0.07, z, '#e0502a', 0, 0, 0.5), 1)]),
  ]);
  const birdGeo = merge([
    part(box(0.11, 0.09, 0.22, 0, 0.17, 0, '#b89c7a'), 0), part(box(0.1, 0.05, 0.18, 0, 0.13, 0.01, '#fbf7f0'), 0),
    part(box(0.07, 0.07, 0.07, 0, 0.25, 0.1, '#a88c6a'), 0), part(box(0.015, 0.015, 0.1, 0, 0.245, 0.18, '#22203a'), 0),
    part(box(0.08, 0.02, 0.07, 0, 0.17, -0.14, '#6a5a4a'), 0),
    part(box(0.015, 0.13, 0.015, -0.025, 0.065, 0, '#3a3530'), 1), part(box(0.015, 0.13, 0.015, 0.025, 0.065, 0.001, '#3a3530'), 1),
    part(box(0.24, 0.012, 0.1, -0.16, 0.2, -0.01, '#8a6a4a'), 2), part(box(0.24, 0.012, 0.1, 0.16, 0.2, -0.01, '#8a6a4a'), 2),
  ]);
  const pelGeo = merge([
    part(box(0.36, 0.34, 0.7, 0, 0.45, 0, '#e8e4dc'), 0), part(box(0.12, 0.38, 0.12, 0, 0.72, 0.28, '#f2eee6'), 0),
    part(box(0.15, 0.13, 0.2, 0, 0.92, 0.34, '#fbf7f0'), 0), part(box(0.07, 0.05, 0.44, 0, 0.89, 0.62, '#ffb347'), 0),
    part(box(0.06, 0.09, 0.3, 0, 0.83, 0.58, '#e89a3a'), 0), part(box(0.2, 0.06, 0.25, 0, 0.42, -0.42, '#9a9aa2'), 0),
    part(box(0.05, 0.3, 0.05, -0.08, 0.15, 0, '#3a3a3a'), 1), part(box(0.05, 0.3, 0.05, 0.08, 0.15, 0.001, '#3a3a3a'), 1),
    part(box(0.95, 0.04, 0.42, -0.66, 0.55, 0, '#a8a8b0'), 2), part(box(0.95, 0.04, 0.42, 0.66, 0.55, 0, '#a8a8b0'), 2),
    part(box(0.3, 0.045, 0.42, -1.0, 0.552, 0, '#4a4a52'), 2), part(box(0.3, 0.045, 0.42, 1.0, 0.552, 0, '#4a4a52'), 2),
  ]);
  const dogGeo = merge([
    part(box(0.26, 0.24, 0.58, 0, 0.44, 0, '#d9a066'), 0), part(box(0.22, 0.22, 0.24, 0, 0.62, 0.36, '#d9a066'), 0),
    part(box(0.13, 0.11, 0.14, 0, 0.56, 0.52, '#c48a50'), 0), part(box(0.06, 0.05, 0.04, 0, 0.6, 0.6, '#1d1630'), 0),
    part(box(0.06, 0.12, 0.06, -0.09, 0.77, 0.32, '#8a5a30'), 0), part(box(0.06, 0.12, 0.06, 0.09, 0.77, 0.32, '#8a5a30'), 0),
    part(box(0.03, 0.03, 0.02, -0.06, 0.66, 0.48, '#1d1630'), 0), part(box(0.03, 0.03, 0.02, 0.06, 0.66, 0.48, '#1d1630'), 0),
    part(box(0.27, 0.06, 0.07, 0, 0.53, 0.22, '#ff3fb4'), 0), part(box(0.24, 0.1, 0.4, 0, 0.34, 0, '#f2dcc0'), 0),
    ...[[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].map(([x, z]) => part(box(0.07, 0.34, 0.07, x, 0.17, z, '#c48a50'), 1)),
    part(box(0.05, 0.05, 0.26, 0, 0.56, -0.38, '#d9a066', 0.6), 3),
  ]);
  const shell = new THREE.SphereGeometry(0.5, 8, 4, 0, PI * 2, 0, PI / 2); shell.scale(1, 0.45, 1.25);
  const turtleGeo = merge([
    part(tint(shell, '#4f7a4a'), 0), part(box(0.9, 0.04, 1.1, 0, 0.02, 0, '#c8b878'), 0), part(box(0.18, 0.14, 0.24, 0, 0.06, 0.68, '#8fae6a'), 0),
    part(box(0.5, 0.04, 0.2, -0.55, 0.03, 0.3, '#7f9e5a'), 2), part(box(0.5, 0.04, 0.2, 0.55, 0.03, 0.3, '#7f9e5a'), 2),
    part(box(0.25, 0.04, 0.15, -0.35, 0.03, -0.45, '#7f9e5a'), 2), part(box(0.25, 0.04, 0.15, 0.35, 0.03, -0.45, '#7f9e5a'), 2),
  ]);

  const crabM = makeMesh(scene, crabGeo, speciesMaterial({ leg: 34, legAmp: 0.05, legTop: 0.1 }), CRABS);
  const birdM = makeMesh(scene, birdGeo, speciesMaterial({ root: 0.04, flap: 26, leg: 30, legAmp: 0.05, legTop: 0.13 }), BIRDS);
  const pelM = makeMesh(scene, pelGeo, speciesMaterial({ root: 0.18, flap: 7, leg: 10, legAmp: 0.04, legTop: 0.3 }), PELICANS);
  const dogM = makeMesh(scene, dogGeo, speciesMaterial({ leg: 13, legAmp: 0.14, legTop: 0.34 }), 1);
  const turM = makeMesh(scene, turtleGeo, speciesMaterial({ root: 0.3, flap: 2.5 }), TURTLES);
  // little hearts over the dog after a pat: one tiny instanced mesh, only drawn while they float
  const HEARTS = 6, heartGeo = merge([box(0.13, 0.13, 0.04, 0, 0, 0, '#ff4f9a', 0, 0, PI / 4), box(0.1, 0.1, 0.045, -0.05, 0.05, 0, '#ff4f9a'), box(0.1, 0.1, 0.045, 0.05, 0.05, 0, '#ff4f9a')]);
  const heartM = new THREE.InstancedMesh(heartGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), HEARTS);
  heartM.frustumCulled = false; heartM.visible = false; heartM.count = HEARTS;
  scene.add(heartM);
  const hearts = [...Array(HEARTS)].map(() => ({ t: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0 }));

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3();
  const put = (mesh, i, x, y, z, yaw, s = 1, pitch = 0, roll = 0) => mesh.setMatrixAt(i, M.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, roll)), S.set(s, s, s)));
  const hide = (mesh, i) => mesh.setMatrixAt(i, M.makeScale(0, 0, 0));
  const act = (mesh, i, a, b, c) => { const arr = mesh.geometry.attributes.aAct.array; arr[i * 3] = a; arr[i * 3 + 1] = b; arr[i * 3 + 2] = c; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inBeach = (o) => { o.x = clamp(o.x, BEACH.x0, BEACH.x1); o.z = clamp(o.z, BEACH.z0, BEACH.z1); };

  // ---- who is close? the player (or whatever they drive), plus pedestrians and cars from the grid
  const threat = { x: 0, z: 0, d: 1e9 };
  function nearest(x, z, r, dog) {
    threat.d = 1e9;
    const f = game.focus(), v = game.vehicle;
    if (!game.inside && game.busy !== 'cut' && !(game.player && game.player.hidden && !v)) {
      const fast = v ? Math.hypot(v.vx || 0, v.vz || 0) : 0, rr = v ? r * (v.kind === 'heli' ? (v.y < 12 ? 2.5 : 0) : 1.6 + fast * 0.05) : r;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < rr) { threat.d = d; threat.x = f.x; threat.z = f.z; }
    }
    grid.query(x, z, r, (o) => {
      if (o.isPlayer) return;
      const moving = o.isPed ? (o.v || 0) > 0.5 : Math.hypot(o.vx || 0, o.vz || 0) > 2;
      if (!moving) return;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < r * 0.6 && d < threat.d) { threat.d = d; threat.x = o.x; threat.z = o.z; }
    });
    if (dog && dogA.state !== 'shelter') { const d = Math.hypot(dogA.x - x, dogA.z - z); if (d < r * 0.7 && d < threat.d) { threat.d = d; threat.x = dogA.x; threat.z = dogA.z; } }
    return threat.d < 1e8;
  }

  // ---- crabs
  const crabs = [];
  for (let i = 0; i < CRABS; i++) {
    const x = rnd(-270, 270), z = rnd(100, 146);
    crabs.push({ i, x, z, hx: x, hz: z, yaw: rnd(0, 6.3), y: 0, st: 'out', t: rnd(0, 2), dir: 1, sp: 0, ph: rnd(0, 6) });
  }
  function crabStep(c, dt, out) {
    c.t -= dt;
    if (c.st === 'out') {
      if (nearest(c.x, c.z, 4, true)) {
        // dart sideways away from the trouble, then dig in
        const ax = c.x - threat.x, az = c.z - threat.z, side = Math.cos(c.yaw) * ax - Math.sin(c.yaw) * az;
        c.st = 'flee'; c.t = 0.7; c.dir = side >= 0 ? 1 : -1; c.sp = 4.5;
      } else if (!out) { c.st = 'dig'; c.t = 0.6; }
      else if (c.t <= 0) {
        if (c.sp > 0) { c.sp = 0; c.t = rnd(0.3, 1.8) * (env.isNight() ? 0.5 : 1); }
        else {
          c.sp = rnd(0.7, 1.6) * (env.isNight() ? 1.4 : 1); c.t = rnd(0.4, 1.4);
          const back = Math.hypot(c.x - c.hx, c.z - c.hz) > 10;
          c.dir = back ? (Math.cos(c.yaw) * (c.hx - c.x) - Math.sin(c.yaw) * (c.hz - c.z) > 0 ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
          if (Math.random() < 0.3) c.yaw += rnd(-0.6, 0.6);
        }
      }
    } else if (c.st === 'flee') { if (c.t <= 0) { c.st = 'dig'; c.t = 0.5; c.sp = 0; } }
    else if (c.st === 'dig') { c.y = -0.32 * (1 - c.t / 0.5); if (c.t <= 0) { c.st = 'under'; c.t = rnd(4, 9); c.y = -0.32; } }
    else if (c.st === 'under') {
      if (c.t <= 0 && out && !nearest(c.x, c.z, 7, true)) { c.st = 'up'; c.t = 0.6; }
      else if (c.t <= 0) c.t = rnd(1, 3);
    } else if (c.st === 'up') { c.y = -0.32 * (c.t / 0.6); if (c.t <= 0) { c.st = 'out'; c.y = 0; c.t = rnd(0.5, 2); } }
    if (c.sp > 0) {
      c.x += Math.cos(c.yaw) * c.dir * c.sp * dt; c.z -= Math.sin(c.yaw) * c.dir * c.sp * dt;
      inBeach(c);
    }
  }

  // ---- sandpipers: chase the swash up and down the wet sand, fly off when approached
  const swash = (x, t) => HZ - 1.1 - 2.2 * (0.5 + 0.5 * Math.sin(t * 0.55 + x * 0.015));
  const birds = [];
  for (let i = 0; i < BIRDS; i++) {
    const g = Math.floor(i / 4), x = -180 + g * 150 + rnd(-6, 6);
    birds.push({ i, x, z: swash(x, 0), y: 0, yaw: PI / 2, st: 'run', t: rnd(0, 3), vx: 0, vz: 0, vy: 0, run: 0, gx: x, ph: rnd(0, 6), lag: rnd(0.3, 1.4), tx: 0, tz: 0 });
  }
  const huts = L.huts;
  function birdStep(b, dt, t, want, rain) {
    b.t -= dt;
    const fly = (tx, tz, st) => { b.st = 'fly'; b.next = st; b.tx = tx; b.tz = tz; b.vy = 4.5; b.t = 0; };
    if (b.st === 'away') {
      if (want && !rain && unseen(game.camera, b.gx, HZ - 2)) { b.st = 'run'; b.x = b.gx; b.z = swash(b.x, t); b.y = 0; }
      return;
    }
    if (!want && b.st !== 'fly') { fly(b.x + rnd(-40, 40), HZ + 120, 'away'); return; }
    if (rain && b.st !== 'fly' && b.st !== 'shelter') { const h = huts[b.i % huts.length]; fly(h.x + rnd(-1.4, 1.4), h.z + rnd(-1.4, 1.4), 'shelter'); return; }
    if (!rain && b.st === 'shelter') { fly(b.gx, swash(b.gx, t), 'run'); return; }
    if (b.st === 'run') {
      if (nearest(b.x, b.z, 6.5, true)) {
        // burst into flight, away along the beach
        const dir = b.x > threat.x ? 1 : -1;
        b.gx = clamp(b.x + dir * rnd(25, 45), BEACH.x0 + 10, BEACH.x1 - 10);
        if (Math.abs(b.gx - (PIER.x0 + PIER.x1) / 2) < 10) b.gx += dir * 14;
        fly(b.gx, swash(b.gx, t), 'run');
        if (b.i % 4 === 0) chirp(b.x, b.z);
        return;
      }
      // follow the wave edge (a little behind it), with quick runs along the sand
      const tz = swash(b.x, t - b.lag), dz = tz - b.z;
      if (b.t <= 0) { b.run = Math.random() < 0.45 ? rnd(-1.8, 1.8) : 0; b.t = rnd(0.6, 2.2); }
      const toG = clamp((b.gx - b.x) * 0.3, -1.5, 1.5);
      const vx = b.run + toG, vz = clamp(dz * 3, -2.6, 2.6);
      b.x += vx * dt; b.z += vz * dt; b.z = Math.min(b.z, HZ - 0.4);
      const sp = Math.hypot(vx, vz);
      if (sp > 0.3) b.yaw += angleDelta(b.yaw, Math.atan2(vx, vz)) * (1 - Math.exp(-10 * dt));
      b.legs = clamp(sp / 1.5, 0, 1.5); b.wing = 0;
    } else if (b.st === 'fly') {
      b.t += dt;
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      const sp = b.next === 'away' ? 9 : 7.5, alt = b.next === 'away' ? 10 : clamp(d * 0.25, 0.2, 4);
      if (d > 0.3) { b.x += dx / d * Math.min(d, sp * dt); b.z += dz / d * Math.min(d, sp * dt); b.yaw += angleDelta(b.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt)); }
      b.y = damp(b.y, d < 1 ? 0 : alt, 3, dt);
      b.wing = d < 2.5 && b.y < 0.6 ? 1 : 2; b.legs = 0;
      if (b.next === 'away' && (d < 2 || b.t > 14)) { b.st = 'away'; return; }
      if (d < 0.35 && b.y < 0.08) { b.st = b.next; b.y = 0; b.t = rnd(0.5, 2); b.wing = 0; }
    } else if (b.st === 'shelter') { b.legs = 0; b.wing = 0; b.y = 0; }
  }

  // ---- pelicans on the pier posts
  const PZ = [175, 195, 215, 235];
  const pels = PZ.map((z, i) => {
    const x = i % 2 ? PIER.x1 - 0.15 : PIER.x0 + 0.15;
    return { i, px: x, pz: z, x, z, y: 1.17, yaw: i % 2 ? PI / 2 : -PI / 2, pyaw: i % 2 ? PI / 2 : -PI / 2, st: 'perch', t: rnd(6, 18), wing: 0, ang: 0, ph: rnd(0, 6), stretch: 0 };
  });
  let glideT = rnd(25, 50);
  function pelStep(p, dt, t, rain, night) {
    p.t -= dt;
    if (p.st === 'perch') {
      p.x = p.px; p.z = p.pz; p.y = damp(p.y, 1.17, 6, dt);
      p.yaw += angleDelta(p.yaw, p.pyaw) * (1 - Math.exp(-3 * dt));
      if (nearest(p.x, p.z, 2.6, false) && p.stretch <= 0) { p.stretch = 1.2; p.y = 1.5; }   // startled: a flap and a hop
      if (p.stretch > 0) { p.stretch -= dt; p.wing = 2; }
      else if (p.t <= 0 && !rain) { p.st = 'stretch'; p.t = 2.2; }
      else p.wing = damp(p.wing, 0, 6, dt);
      if (p.i === 0 && !rain && !night && glideT <= 0) { p.st = 'glide'; p.t = 0; p.ang = Math.atan2(p.z - 205, p.x - 75); glideT = rnd(45, 90); chirp(p.x, p.z, true); }
    } else if (p.st === 'stretch') {
      const k = p.t > 1.6 ? (2.2 - p.t) / 0.6 : p.t < 0.6 ? p.t / 0.6 : 1;
      p.wing = clamp(k, 0, 1);
      if (p.t <= 0) { p.st = 'perch'; p.t = rnd(8, 22); p.wing = 0; }
    } else if (p.st === 'glide') {
      // a lazy loop over the water east of the pier, then home to the post
      p.t += dt;
      const lap = p.t < 26 && !rain;
      let tx, tz, ty;
      if (lap) { p.ang += dt * 0.32; tx = 75 + Math.cos(p.ang) * 34; tz = 205 + Math.sin(p.ang) * 30; ty = 7 + Math.sin(p.t * 0.4) * 1.5; }
      else { tx = p.px; tz = p.pz; ty = 1.17; }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), sp = lap ? 9 : 6;
      if (d > 0.05) { const m = Math.min(d, sp * dt); p.x += dx / d * m; p.z += dz / d * m; p.yaw += angleDelta(p.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-3 * dt)); }
      p.y = damp(p.y, lap ? ty : d < 4 ? 1.17 : Math.max(2, d * 0.2), 1.5, dt);
      p.wing = p.t < 2.5 || (!lap && d < 6) || Math.sin(p.t * 0.7) > 0.85 ? 2 : 1;
      if (!lap && d < 0.1) { p.st = 'perch'; p.t = rnd(8, 18); }
    }
  }

  // ---- the beach dog
  const dogA = { x: -30, z: 96, yaw: 0, st: 'wander', t: 2, tx: -30, tz: 96, sp: 0, cool: 3, ph: 0, wag: 0.3, patCd: 0, pats: 0 };
  // can the courier pat the dog right now? (on foot, close, the dog not running off, not just patted)
  function canPat(pos) {
    const D = dogA;
    if (game.vehicle || game.inside || game.busy || (game.player && game.player.hidden) || D.patCd > 0) return false;
    if (D.st === 'flee' || D.st === 'shelter' || D.st === 'sit') return false;
    return Math.abs(pos.y) < 0.6 && Math.hypot(pos.x - D.x, pos.z - D.z) < 3.0;
  }
  function pat(pos) {
    if (!canPat(pos)) return null;
    const D = dogA;
    D.st = 'sit'; D.t = 1.9; D.patCd = 3.5; D.pats++; D.sp = 0; D.tx = D.x; D.tz = D.z;
    D.yaw = Math.atan2(pos.x - D.x, pos.z - D.z);
    if (audio.happyBark) audio.happyBark();
    for (let i = 0; i < HEARTS; i++) {
      const h = hearts[i], a = (i / HEARTS) * PI * 2;
      Object.assign(h, { t: 1.4 + i * 0.12, x: D.x + Math.cos(a) * 0.15, y: 0.9 + i * 0.05, z: D.z + Math.sin(a) * 0.15, vx: Math.cos(a) * 0.25, vz: Math.sin(a) * 0.25, d: i * 0.12 });
    }
    return D;
  }
  function dogStep(dt, rain) {
    const D = dogA, f = game.focus(), onFoot = !game.vehicle && !game.inside && !game.busy && !(game.player && game.player.hidden);
    const dp = Math.hypot(f.x - D.x, f.z - D.z);
    D.t -= dt; D.cool -= dt; D.patCd -= dt;
    let want = 0;
    if (nearest(D.x, D.z, 7, false) && game.vehicle && Math.hypot(game.vehicle.vx || 0, game.vehicle.vz || 0) > 4 && D.st !== 'flee') {
      D.st = 'flee'; D.t = 1.6; const d = threat.d || 1; D.tx = D.x + (D.x - threat.x) / d * 14; D.tz = D.z + (D.z - threat.z) / d * 14;
    }
    if (rain && D.st !== 'shelter' && D.st !== 'flee') { const h = huts[0]; D.st = 'shelter'; D.tx = h.x + 0.4; D.tz = h.z + 0.3; }
    if (!rain && D.st === 'shelter') { D.st = 'wander'; D.t = 0; }
    switch (D.st) {
      case 'wander':
        if (D.t <= 0) { D.t = rnd(3, 8); D.tx = rnd(BEACH.x0 + 20, BEACH.x1 - 20); D.tz = rnd(86, 138); if (Math.random() < 0.35) { D.tx = D.x + rnd(-15, 15); D.tz = clamp(D.z + rnd(-10, 10), 84, 140); } }
        want = Math.hypot(D.tx - D.x, D.tz - D.z) > 1 ? 2.3 : 0; D.wag = 0.4;
        if (onFoot && dp < 22 && D.cool <= 0) { D.st = 'come'; D.t = 12; audio.woof && audio.woof(clamp(1 - dp / 30, 0.2, 1)); }
        break;
      case 'come':
        D.tx = f.x; D.tz = f.z; want = dp > 2.4 ? 6.5 : 0; D.wag = 1;
        if (dp < 2.6) { D.st = 'follow'; D.t = rnd(14, 24); }
        if (!onFoot || D.t <= 0 || dp > 45) { D.st = 'leave'; D.t = 0; }
        break;
      case 'follow':
        D.tx = f.x; D.tz = f.z; D.wag = 1;
        want = clamp((dp - 2.4) * 2.2, 0, 9.5);
        if (!onFoot || D.t <= 0 || dp > 40) { D.st = 'leave'; D.t = 0; if (onFoot && dp < 20 && audio.woof) audio.woof(0.5); }
        break;
      case 'leave':
        if (!D.going) { D.going = true; D.cool = rnd(35, 60); D.tx = clamp(D.x + rnd(-90, 90), BEACH.x0 + 20, BEACH.x1 - 20); D.tz = rnd(90, 136); D.t = 25; }
        want = 3; D.wag = 0.3;
        if (Math.hypot(D.tx - D.x, D.tz - D.z) < 1.5 || D.t <= 0) { D.st = 'wander'; D.t = rnd(2, 5); D.going = false; }
        break;
      case 'sit':
        // sits for the pat, tail going, then tags along for longer than usual
        want = 0; D.wag = 2;
        if (D.t <= 0) { D.st = 'follow'; D.t = rnd(40, 55); D.going = false; }
        break;
      case 'flee':
        want = 7.5; D.wag = 0;
        if (D.t <= 0) { D.st = 'wander'; D.t = 0; D.cool = Math.max(D.cool, 6); }
        break;
      case 'shelter':
        want = Math.hypot(D.tx - D.x, D.tz - D.z) > 0.6 ? 4 : 0; D.wag = 0.1;
        break;
    }
    const dx = D.tx - D.x, dz = D.tz - D.z, d = Math.hypot(dx, dz) || 1;
    D.sp = damp(D.sp, want, 5, dt);
    if (D.sp > 0.05) {
      D.x += dx / d * Math.min(d, D.sp * dt); D.z += dz / d * Math.min(d, D.sp * dt);
      D.yaw += angleDelta(D.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-7 * dt));
    } else if (D.st === 'follow' || D.st === 'come') D.yaw += angleDelta(D.yaw, Math.atan2(f.x - D.x, f.z - D.z)) * (1 - Math.exp(-4 * dt));
    const pos = { x: D.x, z: D.z };
    for (const b of L.solids) if (Math.abs(b.x0 + b.x1 - 2 * D.x) < b.x1 - b.x0 + 2 && Math.abs(b.z0 + b.z1 - 2 * D.z) < b.z1 - b.z0 + 2) pushOut(pos, 0.4, b);
    clampToWorld(pos, 0.5);
    D.x = pos.x; D.z = pos.z;
  }

  // ---- sea turtles: surface in the shallows around dusk
  const turts = [-210, -70, 120].map((x, i) => ({ i, x: x + rnd(-10, 10), z: rnd(168, 185), yaw: rnd(0, 6.3), y: -1.4, st: 'under', t: rnd(1, 6) }));
  function turtleStep(u, dt, dusk) {
    u.t -= dt;
    if (u.st === 'under') { u.y = -1.4; if (u.t <= 0 && dusk) { u.st = 'rise'; u.t = 1.2; u.x = clamp(u.x + rnd(-12, 12), -280, 280); if (Math.abs(u.x - 40) < 14) u.x += 30; u.z = clamp(u.z + rnd(-5, 5), 168, 190); } else if (u.t <= 0) u.t = rnd(2, 5); }
    else if (u.st === 'rise') { u.y = -1.4 + 0.68 * (1 - u.t / 1.2); if (u.t <= 0) { u.st = 'float'; u.t = rnd(5, 10); } }
    else if (u.st === 'float') {
      u.y = -0.72 + Math.sin(timeU.value * 1.3 + u.i) * 0.03;
      u.yaw += dt * 0.15; u.x += Math.sin(u.yaw) * 0.5 * dt; u.z += Math.cos(u.yaw) * 0.5 * dt;
      if (u.t <= 0 || !dusk || nearest(u.x, u.z, 5, false)) { u.st = 'dive'; u.t = 1; }
    } else if (u.st === 'dive') { u.y = -0.72 - 0.68 * (1 - u.t); if (u.t <= 0) { u.st = 'under'; u.t = rnd(4, 10); } }
  }

  // ---- quiet calls
  let callT = 8;
  function chirp(x, z, gull) {
    const f = game.camera.position, d = Math.hypot(f.x - x, f.z - z);
    if (d < 60) (gull ? audio.gull : audio.peep) && (gull ? audio.gull(1 - d / 60) : audio.peep(1 - d / 60));
  }

  // ---- per frame
  const meshes = [crabM, birdM, pelM, dogM, turM];
  let acc = 0, frame = 0, nearBeach = true;
  const stats = { crabs: 0, birds: 0, pelicans: PELICANS, turtles: 0, dog: dogA };
  const api = {
    crabs, birds, pelicans: pels, dog: dogA, turtles: turts, stats, canPat, pat,
    get hearts() { return hearts.filter((h) => h.t > 0).length; },
    update(dt) {
      frame++;
      const cam = game.camera.position;
      // the camera far from the beach (or indoors): hide everything, tick only now and then
      const dx = Math.max(Math.abs(cam.x) - HX, 0), dz = cam.z < 80 ? 80 - cam.z : cam.z > 260 ? cam.z - 260 : 0;
      const near = !game.inside && Math.hypot(dx, dz) < 320;
      if (near !== nearBeach) { nearBeach = near; for (const m of meshes) m.visible = near; }
      acc += dt;
      if (!near && frame % 8) return;
      const step = acc; acc = 0;
      const t = timeU.value, h = env.tod, night = env.isNight(), rain = env.w.rain > 0.3, dusk = h > 18.2 && h < 21.4;
      // the dog: one more lap of the frame budget
      dogStep(step, rain);
      if (dogA.st === 'sit') { put(dogM, 0, dogA.x, -0.1, dogA.z, dogA.yaw, 1.1, -0.5); act(dogM, 0, 0, 0, dogA.wag); }
      else { put(dogM, 0, dogA.x, 0, dogA.z, dogA.yaw, 1.1); act(dogM, 0, 0, clamp(dogA.sp / 4, 0, 1.6), dogA.wag); }
      // the hearts drift up, wobble and shrink away
      let hv = 0;
      for (let i = 0; i < HEARTS; i++) {
        const h = hearts[i];
        if (h.t <= 0) { hide(heartM, i); continue; }
        h.t -= step; if (h.d > 0) { h.d -= step; hide(heartM, i); hv++; continue; }
        h.y += step * 0.7; h.x += h.vx * step; h.z += h.vz * step;
        const sc = clamp(h.t * 1.6, 0, 1) * (1 + Math.sin(t * 9 + i) * 0.12);
        if (sc > 0) { put(heartM, i, h.x + Math.sin(t * 4 + i) * 0.06, h.y, h.z, Math.atan2(cam.x - h.x, cam.z - h.z), sc); hv++; } else hide(heartM, i);
      }
      heartM.visible = near && hv > 0; if (hv) heartM.instanceMatrix.needsUpdate = true;
      // crabs: more of them out at night
      const outN = night ? CRABS : rain ? 14 : 11;
      let nc = 0;
      for (const c of crabs) {
        crabStep(c, step, c.i < outN);
        if (c.st === 'under') hide(crabM, c.i); else { put(crabM, c.i, c.x, c.y, c.z, c.yaw); nc++; }
        act(crabM, c.i, c.ph, c.sp > 0 ? 1 : 0.1, 0);
      }
      // sandpipers: a few at night, sheltering under the lifeguard huts in the rain
      const birdN = night ? 4 : BIRDS;
      let nb = 0;
      for (const b of birds) {
        birdStep(b, step, t, b.i < birdN, rain);
        if (b.st === 'away') hide(birdM, b.i); else { put(birdM, b.i, b.x, b.y, b.z, b.yaw, 1.15); nb++; }
        act(birdM, b.i, b.ph, b.legs || 0, b.wing || 0);
      }
      glideT -= step;
      for (const p of pels) {
        pelStep(p, step, t, rain, night);
        put(pelM, p.i, p.x, p.y, p.z, p.yaw, 1, p.st === 'glide' && p.y > 2 ? -0.08 : rain ? 0.12 : 0);
        act(pelM, p.i, p.ph, p.st === 'perch' ? 0 : 0.3, p.wing);
      }
      let nt = 0;
      for (const u of turts) {
        turtleStep(u, step, dusk);
        if (u.st === 'under') hide(turM, u.i); else { put(turM, u.i, u.x, u.y, u.z, u.yaw, 1.3); nt++; }
        act(turM, u.i, u.i * 2, 0, u.st === 'float' ? 1.6 : 1);
      }
      turM.visible = near && nt > 0;
      stats.crabs = nc; stats.birds = nb; stats.turtles = nt;
      for (const m of meshes) { m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aAct.needsUpdate = true; }
      // now and then a gull cries somewhere over the beach (fewer at night)
      callT -= step;
      if (callT <= 0) { callT = rnd(10, 26) * (night ? 2.5 : 1); if (near && cam.z > 40) chirp(cam.x + rnd(-30, 30), cam.z + rnd(-20, 20), true); }
    },
    count() { return stats.crabs + stats.birds + PELICANS + 1 + stats.turtles; },
  };
  return api;
}
