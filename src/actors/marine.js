// Sea life. Fish schools (boids; three colourful species, one InstancedMesh each), rays gliding over the sand,
// jellyfish that pulse (and glow softly at night), sea turtles (the dusk turtles of animals.js swim here when
// they are not at the surface), dolphins that sometimes leap far offshore, and RARE sharks.
//
// Cost: everything underwater is only simulated and drawn while the camera is under the water; the dolphins
// only while you are near the sea. Standing in the street none of it runs and no draw call is added.
//
// SHARKS (PG: a chomp, a splash, health loss, a shake, no blood): uncommon, more likely far from the shore and
// at night, never in water shallower than 2 m. First a fin circles at the surface (with a tense synthesised
// sting and a SHARK! warning), then it lunges. It keeps attacking while you stay in deep water; swim to the
// beach, a pier ladder or shallow water and it loses interest. Using a blaster scares it off (it flees; it is
// never hurt).
import * as THREE from 'three';
import { box, tint, merge, rng, clamp, lerp, angleDelta, timeU, nightU, reducedMotion, PI } from '../core/util.js';
import { HX, HZ } from '../world/layout.js';
import { WL, FLOAT_Y, DEEP_SHARK, bedAt, depthAt, islandDist, MOUNDS } from '../world/sea.js';
import { seaMat } from '../world/underwater.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- geometry
function fishGeo(o) {
  const P = [];
  const body = new THREE.SphereGeometry(0.5, 8, 6); body.scale(o.w, o.h, o.len); P.push(tint(body, o.body));
  const belly = new THREE.SphereGeometry(0.5, 8, 5); belly.scale(o.w * 0.92, o.h * 0.6, o.len * 0.9); belly.translate(0, -o.h * 0.2, 0); P.push(tint(belly, o.belly));
  const tail = new THREE.ConeGeometry(o.h * 0.62, o.len * 0.36, 3); tail.rotateX(PI / 2); tail.scale(0.16, 1, 1); tail.translate(0, 0, -o.len * 0.5 - o.len * 0.14); P.push(tint(tail, o.fin));
  const dors = new THREE.ConeGeometry(o.len * 0.14, o.h * 0.5, 3); dors.scale(0.2, 1, 1); dors.translate(0, o.h * 0.5, -o.len * 0.05); P.push(tint(dors, o.fin));
  for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(o.h * 0.1, 5, 4); e.translate(sx * o.w * 0.42, o.h * 0.1, o.len * 0.3); P.push(tint(e, '#14121f')); }
  if (o.stripe) for (const zz of [0.12, -0.14]) P.push(box(o.w * 0.92, o.h * 0.86, o.len * 0.07, 0, 0, o.len * zz, o.stripe));
  return merge(P);
}
function polyGeo(tris, hex) {
  const p = [];
  for (const t of tris) for (const v of t) p.push(v[0], v[1], v[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals();
  return tint(g, hex);
}
function rayGeo() {
  const c = [0, 0.22, 0.1], nose = [0, 0, 1.0], L = [-1.35, 0, 0.05], R = [1.35, 0, 0.05], back = [0, 0, -0.75];
  const P = [polyGeo([[c, L, nose], [c, back, L], [c, R, back], [c, nose, R]], '#6e8190'), polyGeo([[nose, L, c], [L, back, c], [back, R, c], [R, nose, c]], '#d8d2c4')];
  P.push(box(0.05, 0.05, 1.5, 0, 0.02, -1.5, '#5c6c7a'), box(0.1, 0.1, 0.1, 0.2, 0.2, 0.55, '#14121f'), box(0.1, 0.1, 0.1, -0.2, 0.2, 0.55, '#14121f'));
  return merge(P);
}
function jellyGeo() {
  const P = [];
  const bell = new THREE.SphereGeometry(0.3, 10, 6, 0, PI * 2, 0, PI / 2); bell.scale(1, 0.75, 1); P.push(tint(bell, '#e9a6ff'));
  const core = new THREE.SphereGeometry(0.17, 7, 4, 0, PI * 2, 0, PI / 2); core.scale(1, 0.7, 1); core.translate(0, 0.02, 0); P.push(tint(core, '#fff0ff'));
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; P.push(box(0.025, 0.65 + (i % 2) * 0.2, 0.025, Math.cos(a) * 0.2, -0.33 - (i % 2) * 0.1, Math.sin(a) * 0.2, '#f6c8ff')); }
  P.push(box(0.07, 0.4, 0.07, 0.05, -0.2, 0, '#ffd9ff'), box(0.07, 0.35, 0.07, -0.05, -0.18, 0.05, '#ffd9ff'));
  return merge(P);
}
function turtleGeo() {
  const part = (g) => g;
  const shell = new THREE.SphereGeometry(0.5, 8, 4, 0, PI * 2, 0, PI / 2); shell.scale(1, 0.5, 1.25);
  return merge([
    part(tint(shell, '#5a8a4a')), box(0.9, 0.05, 1.1, 0, 0.0, 0, '#d8c888'), box(0.18, 0.14, 0.26, 0, 0.1, 0.7, '#9fbe7a'),
    box(0.55, 0.05, 0.22, -0.62, 0.08, 0.3, '#86a85a', 0, 0.4), box(0.55, 0.05, 0.22, 0.62, 0.08, 0.3, '#86a85a', 0, -0.4),
    box(0.3, 0.05, 0.16, -0.38, 0.06, -0.5, '#86a85a'), box(0.3, 0.05, 0.16, 0.38, 0.06, -0.5, '#86a85a'),
    box(0.08, 0.06, 0.08, 0.07, 0.16, 0.78, '#14121f'), box(0.08, 0.06, 0.08, -0.07, 0.16, 0.78, '#14121f'),
  ]);
}
function dolphinGeo() {
  const body = new THREE.SphereGeometry(0.5, 10, 7); body.scale(0.62, 0.66, 2.5);
  const belly = new THREE.SphereGeometry(0.5, 8, 5); belly.scale(0.56, 0.4, 2.2); belly.translate(0, -0.18, 0.05);
  const beak = new THREE.ConeGeometry(0.12, 0.55, 6); beak.rotateX(PI / 2); beak.translate(0, -0.05, 1.45);
  const dors = new THREE.ConeGeometry(0.2, 0.42, 4); dors.scale(0.25, 1, 1); dors.rotateX(-0.35); dors.translate(0, 0.43, -0.1);
  const fl = new THREE.ConeGeometry(0.16, 0.5, 3); fl.scale(0.2, 1, 1);
  const f1 = fl.clone(); f1.rotateZ(1.9); f1.translate(-0.3, -0.18, 0.5); const f2 = fl.clone(); f2.rotateZ(-1.9); f2.translate(0.3, -0.18, 0.5);
  const tail = new THREE.ConeGeometry(0.2, 0.55, 3); tail.rotateX(-PI / 2); tail.scale(1, 0.4, 1); tail.translate(0, 0, -1.45);
  const fluke = box(0.9, 0.05, 0.28, 0, 0, -1.78, '#52718a');
  return merge([tint(body, '#6f8fa8'), tint(belly, '#dfe9ee'), tint(beak, '#6f8fa8'), tint(dors, '#52718a'), tint(f1, '#52718a'), tint(f2, '#52718a'), tint(tail, '#6f8fa8'), fluke]);
}
function sharkGeo() {
  const body = new THREE.SphereGeometry(0.5, 12, 8); body.scale(1.0, 0.95, 3.1);
  const belly = new THREE.SphereGeometry(0.5, 10, 6); belly.scale(0.9, 0.55, 2.7); belly.translate(0, -0.3, 0.1);
  const snout = new THREE.ConeGeometry(0.42, 0.9, 8); snout.rotateX(PI / 2); snout.translate(0, -0.02, 1.8);
  const dors = new THREE.ConeGeometry(0.34, 0.85, 4); dors.scale(0.22, 1, 1.5); dors.rotateX(-0.25); dors.translate(0, 0.72, 0.15);
  const pf = new THREE.ConeGeometry(0.26, 1.0, 3); pf.scale(0.14, 1, 1);
  const p1 = pf.clone(); p1.rotateZ(1.2); p1.rotateY(0.5); p1.translate(-0.7, -0.25, 0.6); const p2 = pf.clone(); p2.rotateZ(-1.2); p2.rotateY(-0.5); p2.translate(0.7, -0.25, 0.6);
  const teeth = [];
  for (let i = 0; i < 7; i++) { const t = new THREE.ConeGeometry(0.035, 0.1, 3); t.rotateX(PI); t.translate((i - 3) * 0.075, -0.3, 1.78 - Math.abs(i - 3) * 0.04); teeth.push(tint(t, '#fbf7f0')); }
  return merge([tint(body, '#6b7f92'), tint(belly, '#e9eef2'), tint(snout, '#6b7f92'), tint(dors, '#566a7e'), tint(p1, '#566a7e'), tint(p2, '#566a7e'),
    box(0.5, 0.05, 0.14, 0, -0.3, 1.7, '#3a1f2a'), box(0.07, 0.09, 0.07, 0.3, 0.12, 1.4, '#14121f'), box(0.07, 0.09, 0.07, -0.3, 0.12, 1.4, '#14121f'), ...teeth]);
}
function sharkTailGeo() {
  const up = new THREE.ConeGeometry(0.28, 1.2, 3); up.scale(0.14, 1, 1.4); up.rotateX(-0.5); up.translate(0, 0.45, -0.45);
  const lo = new THREE.ConeGeometry(0.2, 0.7, 3); lo.scale(0.14, 1, 1.2); lo.rotateX(0.7); lo.translate(0, -0.3, -0.3);
  const stalk = new THREE.ConeGeometry(0.3, 1.0, 6); stalk.rotateX(-PI / 2); stalk.translate(0, 0, 0.25);
  return merge([tint(up, '#566a7e'), tint(lo, '#566a7e'), tint(stalk, '#6b7f92')]);
}

export function createMarine(scene, game, sea) {
  const { camera, player, hud, audio, fx, env } = game;
  const R = rng(909);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const place = (mesh, i, x, y, z, yaw, pitch = 0, s = 1, roll = 0) => mesh.setMatrixAt(i, M.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, roll)), S.set(s, s, s)));
  const hideI = (mesh, i) => mesh.setMatrixAt(i, M.makeScale(0, 0, 0));
  const inst = (geo, flags, n) => {
    const ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = R();
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    const m = new THREE.InstancedMesh(geo, seaMat(flags, { side: THREE.DoubleSide }), n);
    m.frustumCulled = false; m.visible = false; scene.add(m);
    for (let i = 0; i < n; i++) hideI(m, i);
    return m;
  };

  // ---------------- fish
  const SPECIES = [
    { geo: fishGeo({ len: 0.5, h: 0.3, w: 0.09, body: '#ffd23a', belly: '#fff3b0', fin: '#2a52d8' }), n: 24, schools: [[56, 188, 12], [-22, 214, 12]], speed: 1.5 },
    { geo: fishGeo({ len: 0.34, h: 0.22, w: 0.08, body: '#ff7a2a', belly: '#ffd0a0', fin: '#ff9a4a', stripe: '#fbf7f0' }), n: 18, schools: [[28, 216, 6], [60, 238, 6], [130, 196, 6]], speed: 1.2 },
    { geo: fishGeo({ len: 0.26, h: 0.12, w: 0.06, body: '#b9d4e6', belly: '#f2f8ff', fin: '#6c93bb' }), n: 48, schools: [[-150, 232, 24], [92, 246, 24]], speed: 2.0 },
  ];
  const fish = [];
  SPECIES.forEach((sp, si) => {
    sp.mesh = inst(sp.geo, 'WAG', sp.n); sp.fish = [];
    let k = 0;
    sp.schools.forEach(([hx, hz, cnt], sc) => {
      const school = { sp, si, hx, hz, goal: { x: hx, y: -3, z: hz, t: 0 }, cx: hx, cy: -3, cz: hz, members: [], active: false };
      for (let i = 0; i < cnt; i++) {
        const f = { i: k++, x: hx + rnd(-3, 3), y: bedAt(hx, hz) + rnd(1, 2.5), z: hz + rnd(-3, 3), vx: rnd(-1, 1), vy: 0, vz: rnd(-1, 1), school, s: rnd(0.85, 1.25) };
        f.y = Math.min(f.y, WL - 1.2);
        school.members.push(f); sp.fish.push(f); fish.push(f);
      }
      (sp.list || (sp.list = [])).push(school);
    });
    sp.count = k;
  });
  function stepSchool(sc, dt) {
    const sp = sc.sp, m = sc.members, g = sc.goal;
    g.t -= dt;
    if (g.t <= 0) {
      g.t = rnd(7, 14);
      for (let t = 0; t < 8; t++) { g.x = sc.hx + rnd(-26, 26); g.z = sc.hz + rnd(-26, 26); if (depthAt(g.x, g.z) > 2.2) break; }
      g.y = clamp(bedAt(g.x, g.z) + rnd(1, 3.5), -6, WL - 1.2);
    }
    let cx = 0, cy = 0, cz = 0, ax = 0, az = 0;
    for (const f of m) { cx += f.x; cy += f.y; cz += f.z; ax += f.vx; az += f.vz; }
    cx /= m.length; cy /= m.length; cz /= m.length; ax /= m.length; az /= m.length;
    sc.cx = cx; sc.cy = cy; sc.cz = cz;
    const px = player.pos.x, pz = player.pos.z, py = player.pos.y + 0.8;
    for (const f of m) {
      let sx = 0, sy = 0, sz = 0;
      for (const o of m) { if (o === f) continue; const dx = f.x - o.x, dy = f.y - o.y, dz = f.z - o.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < 0.5 && d2 > 1e-4) { const k = 0.5 / d2; sx += dx * k; sy += dy * k; sz += dz * k; } }
      let ax_ = (cx - f.x) * 0.5 + (ax - f.vx) * 0.6 + sx * 0.9 + (g.x - f.x) * 0.06;
      let ay_ = (cy - f.y) * 0.5 + sy * 0.9 + (g.y - f.y) * 0.1;
      let az_ = (cz - f.z) * 0.5 + (az - f.vz) * 0.6 + sz * 0.9 + (g.z - f.z) * 0.06;
      // scatter from the courier
      const dx = f.x - px, dy = f.y - py, dz = f.z - pz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 12) { const k = 6 / Math.max(d2, 0.5); ax_ += dx * k; ay_ += dy * k * 0.5; az_ += dz * k; }
      const bed = bedAt(f.x, f.z);
      if (f.y < bed + 0.7) ay_ += 4; if (f.y > WL - 1.0) ay_ -= 4;
      f.vx += ax_ * dt; f.vy += ay_ * dt; f.vz += az_ * dt;
      const v = Math.hypot(f.vx, f.vy, f.vz) || 1, lim = sp.speed * (d2 < 12 ? 1.8 : 1), mn = sp.speed * 0.4;
      const k = v > lim ? lim / v : v < mn ? mn / v : 1;
      f.vx *= k; f.vy *= k * 0.9; f.vz *= k;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    }
  }

  // ---------------- rays
  const rays = [], rayMesh = inst(rayGeo(), 'FLAP', 3);
  [[-12, 190, 14], [75, 224, 16], [-95, 248, 18]].forEach(([x, z, r], i) => rays.push({ i, hx: x, hz: z, r, a: R() * 6.28, w: 0.08 * (i % 2 ? -1 : 1), x, y: -3, z }));

  // ---------------- jellyfish
  const jelly = [], jellyMesh = inst(jellyGeo(), 'PULSE GLOW', 9);
  for (let i = 0; i < 9; i++) {
    const m = MOUNDS[i % MOUNDS.length];
    jelly.push({ i, x: m[0] + rnd(-14, 14), y: rnd(-5.5, -1.9), z: m[1] + rnd(-14, 14), vx: rnd(-0.25, 0.25), vz: rnd(-0.25, 0.25), vy: 0, t: rnd(2, 6), s: rnd(0.9, 1.5) });
  }
  jelly[0].x = 36; jelly[0].z = 188; jelly[1].x = 48; jelly[1].z = 215; jelly[2].x = 30; jelly[2].z = 232;

  // ---------------- turtles (the animals.js dusk turtles dive here; plus one that lives on the reef)
  const turtleMesh = inst(turtleGeo(), 'FLAP', 4);
  const turtles = [0, 1, 2, 3].map((i) => ({ i, x: 0, y: -2.4, z: 0, yaw: R() * 6.28, show: false, own: i === 3, ox: -150, oz: 232 }));

  // ---------------- dolphins (above water: standard lit material so the world's fog and light apply)
  const dolMesh = new THREE.InstancedMesh(dolphinGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), 2);
  dolMesh.frustumCulled = false; dolMesh.visible = false; scene.add(dolMesh);
  for (let i = 0; i < 2; i++) hideI(dolMesh, i);
  const dol = [0, 1].map((i) => ({ i, on: false, t: 0, x: 0, z: 0, yaw: 0, sp: 8, delay: 0 }));
  let dolT = rnd(8, 20);

  // ---------------- the shark
  const sharkGroup = new THREE.Group(), sharkBody = new THREE.Mesh(sharkGeo(), new THREE.MeshLambertMaterial({ vertexColors: true })), tailPivot = new THREE.Group();
  const sharkTail = new THREE.Mesh(sharkTailGeo(), sharkBody.material);
  tailPivot.position.set(0, 0, -1.55); tailPivot.add(sharkTail); sharkGroup.add(sharkBody, tailPivot);
  sharkGroup.visible = false; scene.add(sharkGroup);
  const sh = { st: 'off', t: 0, x: 0, y: -1.15, z: 0, yaw: 0, th: 0, r: 14, cyc: 0, lockX: 0, lockZ: 0, bitten: false, cool: 25, exposure: 0, away: 0, shots: 0, bites: 0, count: 0, speed: 0, hitCd: 0, spawns: 0 };
  const sharkEl = document.getElementById('sharkw');
  let sharkShown = false;
  const exposed = () => {
    const w = game.swim;
    return !!w && w.wet && w.mode === 'swim' && !w.S.climb && w.S.depth >= DEEP_SHARK && !game.busy && !game.vehicle && !game.inside;
  };
  function setSharkUI(on) { if (on !== sharkShown) { sharkShown = on; if (sharkEl) sharkEl.hidden = !on; } }
  function sharkSpawn(force) {
    const px = player.pos.x, pz = player.pos.z;
    for (let t = 0; t < 14; t++) {
      const a = Math.random() * PI * 2, r = 14 + Math.random() * 6, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (depthAt(x, z) >= DEEP_SHARK + 0.3 && islandDist(x, z) < 190) {
        Object.assign(sh, { st: 'circle', t: 6 + Math.random() * 3, x, z, y: -1.15, th: a, r, cyc: 0, bitten: false, away: 0, exposure: 0, hitCd: 0, speed: 3.6, yaw: a + PI / 2 });
        sh.spawns++;
        sharkGroup.visible = true;
        audio.sting();
        hud.toast('SHARK!', 'A FIN IS CIRCLING. GET OUT OF THE DEEP WATER');
        return true;
      }
    }
    return false;
  }
  function sharkLeave(msg) {
    if (sh.st === 'off') return;
    sh.st = 'flee'; sh.t = 5; sh.speed = 7;
    if (msg) hud.toast(msg);
  }
  function sharkStep(dt) {
    const ex = exposed(), px = player.pos.x, pz = player.pos.z;
    const shots = game.combat ? game.combat.stats.shots : 0;
    if (sh.st === 'off') {
      sh.shots = shots;
      sh.cool -= dt;
      if (ex && sh.cool <= 0) {
        sh.exposure += dt;
        if (sh.exposure >= 12) {
          sh.exposure = 0;
          const d = islandDist(px, pz), night = nightU.value;
          const p = clamp(0.12 * (0.4 + d / 90) * (1 + 1.6 * night), 0, 0.7);
          if (Math.random() < p) sharkSpawn();
        }
      } else if (!ex) sh.exposure = Math.max(0, sh.exposure - dt * 0.5);
      setSharkUI(false);
      return;
    }
    // weapons scare it (it is never hurt)
    if (shots > sh.shots) { sh.shots = shots; if (sh.st !== 'flee' && Math.hypot(sh.x - px, sh.z - pz) < 90) sharkLeave('THE SHARK SWIMS OFF'); }
    sh.shots = shots;
    sh.hitCd -= dt;
    setSharkUI(sh.st !== 'flee');
    if (sh.st !== 'flee') {
      if (!ex) sh.away += dt; else sh.away = 0;
      if (sh.away > 1.2) { sharkLeave('YOU ARE SAFE... FOR NOW'); }
    }
    const dx = px - sh.x, dz = pz - sh.z, dist = Math.hypot(dx, dz);
    const aim = (tx, tz, sp, turn) => { const want = Math.atan2(tx - sh.x, tz - sh.z); sh.yaw += angleDelta(sh.yaw, want) * (1 - Math.exp(-turn * dt)); sh.x += Math.sin(sh.yaw) * sp * dt; sh.z += Math.cos(sh.yaw) * sp * dt; };
    if (sh.st === 'circle') {
      sh.t -= dt; sh.th += (reducedMotion ? 0.35 : 0.5) * dt * (sh.cyc % 2 ? -1 : 1);
      const k = clamp(sh.t / 6, 0, 1), rr = lerp(7, sh.r, k);
      const tx = px + Math.cos(sh.th) * rr, tz = pz + Math.sin(sh.th) * rr;
      aim(tx, tz, 4.2, 3);
      sh.y = lerp(sh.y, -1.15, 1 - Math.exp(-3 * dt)); sh.speed = 4.2;
      if (sh.t <= 0) { sh.st = 'lunge'; sh.t = 3.6; sh.speed = 5; sh.bitten = false; audio.sting(0.5); }
    } else if (sh.st === 'lunge') {
      sh.t -= dt; sh.speed = Math.min(11.5, sh.speed + dt * 9);
      aim(px, pz, sh.speed, 6);
      sh.y = lerp(sh.y, dist < 5 ? -0.55 : -1.1, 1 - Math.exp(-5 * dt));
      if (dist < 1.9 && sh.hitCd <= 0 && player.pos.y + 0.96 > WL - 3.5) {
        // CHOMP: a splash, a shake, some health, a shove
        sh.hitCd = 2.2; sh.bites++;
        game.rules.hurt(12 + Math.random() * 6);
        game.swim.splash(sh.x, sh.z, 1.2);
        fx.sparks(sh.x, WL + 0.3, sh.z, 30, '#ffffff');
        if (!reducedMotion) fx.shake = Math.max(fx.shake, 0.55);
        audio.chomp();
        hud.toast('CHOMP!', 'KEEP SWIMMING!');
        const k = 1 / Math.max(dist, 0.3);
        player.vel.x -= dx * k * -5; player.vel.z -= dz * k * -5;
        sh.st = 'recover'; sh.t = 1.5; sh.th = Math.atan2(sh.z - pz, sh.x - px);
      } else if (sh.t <= 0) { sh.st = 'circle'; sh.t = 2.6; sh.r = 10; sh.th = Math.atan2(sh.z - pz, sh.x - px); sh.cyc++; }
    } else if (sh.st === 'recover') {
      sh.t -= dt; aim(sh.x + Math.sin(sh.yaw) * 5, sh.z + Math.cos(sh.yaw) * 5, 7, 2);
      sh.y = lerp(sh.y, -1.4, 1 - Math.exp(-3 * dt));
      if (sh.t <= 0) { sh.st = 'circle'; sh.t = 2.4 + Math.random() * 1.2; sh.r = 11; sh.cyc++; sh.th = Math.atan2(sh.z - pz, sh.x - px); }
    } else if (sh.st === 'flee') {
      sh.t -= dt;
      aim(sh.x + (sh.x - px), sh.z + (sh.z - pz), 7, 2);
      sh.y = lerp(sh.y, -3.2, 1 - Math.exp(-1.5 * dt));
      if (sh.t <= 0 || dist > 120) { sh.st = 'off'; sh.cool = 40; sharkGroup.visible = false; setSharkUI(false); return; }
    }
    // never into shallows
    if (depthAt(sh.x, sh.z) < DEEP_SHARK - 0.3 && sh.st !== 'flee') { sh.x -= Math.sin(sh.yaw) * 3 * dt * 2; sh.z -= Math.cos(sh.yaw) * 3 * dt * 2; if (sh.st === 'lunge') { sh.st = 'circle'; sh.t = 2; } }
    sharkGroup.visible = true;
    sharkGroup.position.set(sh.x, sh.y, sh.z);
    const wag = Math.sin(timeU.value * (3 + sh.speed * 0.5)) * (reducedMotion ? 0.1 : 0.28);
    sharkGroup.rotation.set(0, sh.yaw + wag * 0.15, Math.sin(timeU.value * 1.2) * 0.04);
    tailPivot.rotation.y = wag;
  }

  // ---------------- per frame
  const stats = { fish: 0, rays: 3, jelly: 0, turtles: 0, dolphins: 0, leaps: 0, sharks: 0 };
  const camP = camera.position;
  let acc = 0, wasUnder = false, force = 0;
  const api = {
    stats, shark: sh, fish, rays, jelly, turtles, dol,
    // debug / tests: run the underwater simulation for a moment even when the camera is above water
    force(s = 1) { force = s; },
    spawnShark() { return sharkSpawn(true); },
    sharkState() { return { st: sh.st, x: +sh.x.toFixed(1), z: +sh.z.toFixed(1), y: +sh.y.toFixed(2), bites: sh.bites, spawns: sh.spawns, visible: sharkGroup.visible, ui: sharkShown }; },
    blips(bl) { if (sh.st !== 'off' && sh.st !== 'flee') bl.push({ x: sh.x, z: sh.z, color: '#ff3a4a', big: true, blink: true, star: false }); },
    warm(on) {
      for (const sp of SPECIES) sp.mesh.visible = on || wasUnder;
      rayMesh.visible = jellyMesh.visible = turtleMesh.visible = on || wasUnder;
      dolMesh.visible = on; sharkGroup.visible = on || sh.st !== 'off';
    },
    leapNow() { dolStart(dol[0]); dolStart(dol[1], 1.2); },
    sample() { const f = fish[0]; return { x: +f.x.toFixed(2), y: +f.y.toFixed(2), z: +f.z.toFixed(2), jx: +jelly[0].x.toFixed(2), jy: +jelly[0].y.toFixed(2), rx: +rays[0].x.toFixed(2) }; },
    update(dt) {
      acc += dt;
      const under = sea.under || force > 0;
      if (force > 0) force -= dt;
      // ---- underwater life: simulated only while the camera is under (or just came up)
      if (under !== wasUnder) {
        wasUnder = under;
        for (const sp of SPECIES) sp.mesh.visible = under;
        rayMesh.visible = jellyMesh.visible = turtleMesh.visible = under;
        if (!under) { stats.fish = stats.jelly = stats.turtles = 0; }
      }
      if (under) {
        const step = Math.min(acc, 0.1); acc = 0;
        const t = timeU.value;
        let nf = 0;
        for (const sp of SPECIES) {
          for (const sc of sp.list) {
            const near = Math.hypot(camP.x - sc.hx, camP.z - sc.hz) < 150;
            if (near) { stepSchool(sc, step); sc.active = true; }
            for (const f of sc.members) {
              if (!near) { hideI(sp.mesh, f.i); continue; }
              const sp3 = Math.hypot(f.vx, f.vy, f.vz) || 1;
              place(sp.mesh, f.i, f.x, f.y, f.z, Math.atan2(f.vx, f.vz), -Math.asin(clamp(f.vy / sp3, -1, 1)) * 0.6, f.s);
              nf++;
            }
          }
          sp.mesh.instanceMatrix.needsUpdate = true;
        }
        stats.fish = nf;
        // rays glide in wide circles just above the sand
        rayMesh.count = rays.length;
        for (const r of rays) {
          r.a += r.w * step;
          const nx = r.hx + Math.cos(r.a) * r.r, nz = r.hz + Math.sin(r.a) * r.r, yaw = Math.atan2(nx - r.x, nz - r.z);
          const first = r.x === r.hx && r.z === r.hz;
          r.x = nx; r.z = nz; r.y = bedAt(nx, nz) + 0.55;
          place(rayMesh, r.i, r.x, r.y, r.z, first ? r.a : yaw, 0, 1.1, Math.sin(t * 0.7 + r.i) * 0.06);
        }
        rayMesh.instanceMatrix.needsUpdate = true;
        // jellyfish drift and bob
        let nj = 0;
        for (const j of jelly) {
          const near = Math.hypot(camP.x - j.x, camP.z - j.z) < 110;
          if (!near) { hideI(jellyMesh, j.i); continue; }
          j.t -= step; if (j.t <= 0) { j.t = rnd(3, 8); j.vx = rnd(-0.3, 0.3); j.vz = rnd(-0.3, 0.3); j.vy = rnd(-0.12, 0.12); }
          j.x += j.vx * step; j.z += j.vz * step; j.y += (j.vy + Math.sin(t * 1.1 + j.i * 2) * 0.1) * step;
          const bed = bedAt(j.x, j.z);
          j.y = clamp(j.y, bed + 1, WL - 1.2);
          if (depthAt(j.x, j.z) < 1.5) { j.vx = -j.vx; j.vz = -j.vz; j.x += j.vx * step * 3; j.z += j.vz * step * 3; }
          place(jellyMesh, j.i, j.x, j.y, j.z, t * 0.2 + j.i, Math.sin(t * 0.9 + j.i) * 0.08, j.s);
          nj++;
        }
        stats.jelly = nj; jellyMesh.instanceMatrix.needsUpdate = true;
        // turtles: the dusk turtles of animals.js swim here while "under"; one more lives on the reef
        let nt = 0;
        const at = game.animals && game.animals.turtles;
        for (const u of turtles) {
          const src = !u.own && at ? at[u.i] : null;
          let show = false, tx, tz, ty;
          if (src) {
            if (src.st === 'under') {
              const k = clamp(src.t / 2.5, 0, 1), a = t * 0.12 + u.i * 2, rr = 7 * k;
              tx = src.x + Math.cos(a) * rr; tz = src.z + Math.sin(a) * rr; ty = lerp(-1.4, Math.max(bedAt(tx, tz) + 0.9, -2.6), k); show = true;
            }
          } else if (u.own) { const a = t * 0.07; tx = u.ox + Math.cos(a) * 12; tz = u.oz + Math.sin(a) * 9; ty = bedAt(tx, tz) + 1.1; show = true; }
          if (show) {
            const yaw = Math.atan2(tx - u.x, tz - u.z);
            if (u.show) u.yaw += angleDelta(u.yaw, yaw) * (1 - Math.exp(-3 * step)); else u.yaw = yaw;
            u.x = tx; u.y = ty; u.z = tz; place(turtleMesh, u.i, u.x, u.y, u.z, u.yaw, Math.sin(t * 0.8 + u.i) * 0.08, 1.3); nt++;
          } else hideI(turtleMesh, u.i);
          u.show = show;
        }
        stats.turtles = nt; turtleMesh.instanceMatrix.needsUpdate = true;
      } else acc = 0;

      // ---- dolphins: only near the sea, above water
      const nearSea = !game.inside && (camP.z > HZ - 90 || Math.abs(camP.x) > HX) && !sea.under && camP.y < 60;
      dolMesh.visible = nearSea && (dol[0].on || dol[1].on);
      if (nearSea) {
        dolT -= dt;
        if (dolT <= 0) { dolT = rnd(35, 80); dolStart(dol[0]); if (Math.random() < 0.6) dolStart(dol[1], rnd(0.5, 1.6)); }
        let nd = 0;
        for (const d of dol) {
          if (d.delay > 0) { d.delay -= dt; if (d.delay <= 0) dolBegin(d); else continue; }
          if (!d.on) { hideI(dolMesh, d.i); continue; }
          d.t += dt;
          const T = 2.1, k = d.t / T;
          if (k >= 1) { d.on = false; hideI(dolMesh, d.i); dolSplash(d, 0.7); dolMesh.instanceMatrix.needsUpdate = true; continue; }
          const x = d.x + Math.sin(d.yaw) * d.sp * d.t, z = d.z + Math.cos(d.yaw) * d.sp * d.t;
          const y = WL - 0.9 + 4.2 * 4 * k * (1 - k) - 0.0, vy = 4.2 * 4 * (1 - 2 * k) / T;
          place(dolMesh, d.i, x, y, z, d.yaw, -Math.atan2(vy, d.sp) * 0.9, 1.4, Math.sin(d.t * 3 + d.i) * 0.1);
          nd++;
        }
        stats.dolphins = nd;
        if (nd) dolMesh.instanceMatrix.needsUpdate = true;
      } else stats.dolphins = 0;

      sharkStep(dt);
      stats.sharks = sh.st === 'off' ? 0 : 1;
    },
  };
  function dolStart(d, delay = 0) {
    if (d.on) return;
    if (delay > 0) { d.delay = delay; return; }
    dolBegin(d);
  }
  function dolBegin(d) {
    // far offshore, in front of wherever the camera looks (down the beach), or anywhere in the bay
    for (let i = 0; i < 12; i++) {
      const x = clamp(camP.x + rnd(-120, 120), -260, 260), z = HZ + rnd(80, 170);
      if (depthAt(x, z) > 3) { d.x = x; d.z = z; break; }
      d.x = x; d.z = z;
    }
    d.yaw = rnd(0, PI * 2); d.sp = rnd(8, 11); d.t = 0; d.on = true; d.delay = 0; stats.leaps++;
    dolSplash(d, 0.6);
  }
  function dolSplash(d, k) {
    const x = d.x + Math.sin(d.yaw) * d.sp * (d.t || 0), z = d.z + Math.cos(d.yaw) * d.sp * (d.t || 0);
    fx.sparks(x, WL + 0.2, z, 14, '#d8f6ff');
    if (game.sea && game.sea.bubbles) game.sea.bubbles.burst(x, WL - 0.3, z, 5);
    const dist = Math.hypot(camP.x - x, camP.z - z);
    if (dist < 260) audio.splash(k * 0.35 * (1 - dist / 260));
  }
  return api;
}
