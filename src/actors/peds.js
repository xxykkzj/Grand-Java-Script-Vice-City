// Pedestrians (and the drivers you can see through car windows). Everyone is drawn with a
// handful of InstancedMeshes: torsos, heads, limbs, hats and blob shadows, so fifty people
// cost five draw calls. They walk a sidewalk graph and cross on the walk phase.
import * as THREE from 'three';
import { box, cyl, merge, angleDelta, clamp, PI } from '../core/util.js';
import { SIDE_X } from '../world/layout.js';
import { H_ROADS, walkOK } from '../world/roads.js';

const N = 52, DRIVERS = 54;
const WALK_Z = [65, 41.4, 4, -12, -60, -76], DX = 8.8;
const SHIRT = ['#ff5fa8', '#27d8cf', '#ffd447', '#f6f1e7', '#ff8a4c', '#9b7bff', '#7fe0ff', '#ff3f6a', '#8dff9a', '#f7b3c6', '#2a2140', '#ffb000'];
const LEGS = ['#f6f1e7', '#3b5a9a', '#c9b38a', '#22203a', '#ff8fb0', '#5a7ac8', '#e8e0d0', '#2f8f86'];
const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
const HAT = ['#fff6ec', '#ff3fb4', '#27e8ff', '#ffd166', '#22203a'];
const WALK = 0, WAIT = 1, DOWN = 2, FIST = 3;

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
    const p = { i, isPed: true, x: 0, z: 0, yaw: 0, phase: Math.random() * 6, speed: 1.3 + Math.random() * 0.8, lane: (Math.random() - 0.5) * 2.2 };
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
    B.compose(v.set(p.x, 0, p.z), q.setFromEuler(eu.set(p.tilt, p.yaw, 0)), sc.set(p.h, p.h, p.h));
    const fist = p.state === FIST ? -2.4 + Math.sin(p.t * 16) * 0.35 : 0, flail = p.state === DOWN ? 2.6 : 0;
    part(torso, i, 0, 0.84, 0, 0.06 * k, 0, p.w, 1);
    part(head, i, 0, 1.5, 0, 0, 0, 1, 1);
    part(limb, i * 4, 0.1 * p.w, 0.86, 0, s, 0, 1, 1.38);
    part(limb, i * 4 + 1, -0.1 * p.w, 0.86, 0, -s, 0, 1, 1.38);
    part(limb, i * 4 + 2, 0.27 * p.w, 1.38, 0, fist || -s - flail, 0.08, 0.85, 1);
    part(limb, i * 4 + 3, -0.27 * p.w, 1.38, 0, s - flail, -0.08, 0.85, 1);
    if (p.hat) part(hat, i, 0, 1.5, 0, 0, 0, 1, 1); else hat.setMatrixAt(i, ZERO);
    shadow.setMatrixAt(i, M.makeTranslation(p.x, 0.03, p.z));
  }

  function knock(p, vx, vz, long = 2.2) {
    if (p.state === DOWN) return false;
    p.state = DOWN; p.t = long; p.ovx = vx; p.ovz = vz; p.dir = Math.random() < 0.5 ? 1 : -1;
    return true;
  }
  function shout(p) {
    const f = game.focus(), d = Math.hypot(p.x - f.x, p.z - f.z);
    if (d < 45) game.audio.hey(p.voice, 1 - d / 45);
  }

  function update(p, dt, t) {
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
    // traffic and the player's own wheels
    if (p.state !== DOWN) {
      grid.query(p.x, p.z, 3, (o) => {
        if (o.isPed) return;
        const ddx = p.x - o.x, ddz = p.z - o.z, d = Math.hypot(ddx, ddz), sp = Math.hypot(o.vx, o.vz);
        if (d > o.radius * 0.75 + 0.4 || sp < 3 || o.y > 1.5) return;
        if (knock(p, o.vx * 0.55 + ddx / (d + 0.1) * 3, o.vz * 0.55 + ddz / (d + 0.1) * 3)) { shout(p); game.pedHit(p, o); }
      });
    }
  }

  const api = {
    peds, count: N,
    // scare everyone within r of (x, z); the closest ones go flying
    alarm(x, z, r, blast = 0) {
      for (const p of peds) {
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
      for (const o of peds) { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d > bd && o.state !== DOWN) { bd = d; p = o; } }
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
        if (p.state === DOWN || Math.abs(p.x - player.pos.x) > 0.75 || Math.abs(p.z - player.pos.z) > 0.75) continue;
        if (knock(p, player.vel.x * 0.5, player.vel.z * 0.5, 1.3)) { shout(p); player.vel.x *= 0.4; player.vel.z *= 0.4; }
      }
    },
    update(dt, t, frame, cars) {
      const f = game.focus();
      for (const p of peds) {
        const far = (p.x - f.x) ** 2 + (p.z - f.z) ** 2 > 8100;
        if (far) { if ((frame + p.i) % 4) continue; update(p, dt * 4, t); } else update(p, dt, t);
        draw(p);
      }
      // drivers sit on the left: a torso and a head per occupied car
      for (const c of cars) {
        const i = N + c.idx;
        if (c.off || !c.hasDriver || !(c.ai || c.jacking)) { torso.setMatrixAt(i, ZERO); head.setMatrixAt(i, ZERO); continue; }
        B.compose(v.set(c.x, c.y, c.z), q.setFromEuler(eu.set(c.tx, c.yaw, c.tz)), sc.set(1, 1, 1));
        part(torso, i, 0.42, 0.66, -0.55, -0.12, 0, 0.9, 0.9);
        part(head, i, 0.42, 1.24, -0.6, 0, 0, 1, 1);
      }
      for (const m of [torso, head, limb, hat, shadow]) m.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}
