// Coast Patrol escalation above the patrol cars (game/rules.js, actors/traffic.js, game/combat.js):
//   1-2 stars  patrol cars chase (traffic.js)
//   3 stars    more cars, roadblocks, roof lasers at the vehicle you are in (combat.js)
//   4 stars    + a patrol helicopter: a searchlight that tracks you, laser bursts at your vehicle
//   5 stars    + a patrol tank that hunts you down the roads and lobs shells (arc, muzzle flash, blast)
// Nobody shoots at you on foot: on foot they chase and arrest. Shots and blasts damage vehicles and props
// only (pedestrians just scatter). One helicopter and one tank at most; both leave when the stars drop.
import * as THREE from 'three';
import { heliGeometry, tankGeometry } from '../vehicles/models.js';
import { clamp, angleDelta, segBlocked, pushOut, unseen, reducedMotion } from '../core/util.js';
import { onLand, ROAD_RECTS, inJunction } from '../world/layout.js';

const G = 12;                          // shell gravity
const DOWN = new THREE.Vector3(0, -1, 0);

export function createPursuit(game, scene) {
  const { fx, audio, damage, L, camera } = game;
  const stats = { heliSpawns: 0, tankSpawns: 0, heliShots: 0, heliHits: 0, shells: 0, shellHits: 0, blasts: 0 };
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();

  // ---- the helicopter: the game's chopper model in patrol colours, a light bar, a searchlight cone and spot
  const hg = heliGeometry(), hMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#a8d8ff' });
  const H = { on: false, leaving: false, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0, ang: 0, cool: 2.5, burst: 0, burstT: 0, sx: 0, sz: 0, rot: 0 };
  const hGroup = new THREE.Group();
  const rotor = new THREE.Mesh(hg.rotor, hMat); rotor.position.set(0, 2.98, 0);
  const tail = new THREE.Mesh(hg.tail, hMat); tail.position.set(0.32, 2.3, -5.3);
  const barMat = new THREE.MeshBasicMaterial({ color: '#ff2a3a' });
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), barMat); lightBar.position.set(0, 2.3, 0.6);
  hGroup.add(new THREE.Mesh(hg.body, hMat), rotor, tail, lightBar);
  hGroup.visible = false; scene.add(hGroup);
  const beamGeo = new THREE.CylinderGeometry(0.3, 4.2, 1, 18, 1, true).translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const spot = new THREE.Mesh(new THREE.CircleGeometry(4.4, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beam.visible = spot.visible = false; beam.renderOrder = spot.renderOrder = 5;
  scene.add(beam, spot);

  // ---- the tank: the disco tank's hull in patrol blue
  const tg = tankGeometry(), tMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#b4c4ff' });
  const T = { on: false, leaving: false, x: 0, z: 0, yaw: 0, speed: 0, tYaw: 0, cool: 3, recoil: 0, gone: 0, blind: 0, losT: 0, los: false };
  const tGroup = new THREE.Group(), turret = new THREE.Group();
  tGroup.add(new THREE.Mesh(tg.hull, tMat));
  turret.position.set(0, 1.72, -0.2); turret.add(new THREE.Mesh(tg.turret, tMat));
  const barrel = new THREE.Mesh(tg.barrel, tMat); barrel.position.set(0, 0.42, 1.2); turret.add(barrel);
  const tBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3), barMat); tBar.position.set(0, 1.0, -0.6); turret.add(tBar);
  tGroup.add(turret); tGroup.visible = false; scene.add(tGroup);
  const shellMat = new THREE.MeshBasicMaterial({ color: '#ffb45a', fog: false });
  const shells = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), shellMat); m.visible = false; scene.add(m); return { on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, m }; });

  const pos = { x: 0, z: 0 };
  const focusNow = () => game.focus();
  const target = () => game.vehicle;

  function spawnHeli(f) {
    const a = Math.random() * Math.PI * 2;
    Object.assign(H, { on: true, leaving: false, x: f.x + Math.cos(a) * 130, y: 42, z: f.z + Math.sin(a) * 130, vx: 0, vy: 0, vz: 0, ang: a, cool: 3, burst: 0, sx: f.x, sz: f.z });
    hGroup.visible = true; stats.heliSpawns++;
  }
  // a road spot 90-140 m away that the camera can't see
  function spawnTank(f, near = false) {
    for (let i = 0; i < 40; i++) {
      const r = ROAD_RECTS[Math.floor(Math.random() * ROAD_RECTS.length)];
      const x = r.x0 + 3 + Math.random() * (r.x1 - r.x0 - 6), z = r.z0 + 3 + Math.random() * (r.z1 - r.z0 - 6), d = Math.hypot(x - f.x, z - f.z);
      if (near ? d < 30 || d > 70 : d < 90 || d > 140) continue;
      if (!onLand(x, z) || inJunction(x, z, 2) || (!near && !unseen(camera, x, z, 40)) || (near && segBlocked(x, z, f.x, f.z, L.solids))) continue;
      Object.assign(T, { on: true, leaving: false, x, z, yaw: Math.atan2(f.x - x, f.z - z), speed: 0, tYaw: 0, cool: 3, recoil: 0, gone: 0, blind: 0, losT: 0 });
      if (!near) stats.tankSpawns++; else stats.tankMoves = (stats.tankMoves || 0) + 1;
      tGroup.visible = true;
      return true;
    }
    return false;
  }
  function hideAll() {
    H.on = false; hGroup.visible = beam.visible = spot.visible = false;
    T.on = false; tGroup.visible = false;
    for (const s of shells) { s.on = false; s.m.visible = false; }
  }

  // ---- helicopter
  function heliUpdate(dt, f) {
    if (!H.on) return;
    let gx, gy, gz;
    if (H.leaving) { const dx = H.x - f.x, dz = H.z - f.z, d = Math.hypot(dx, dz) || 1; gx = H.x + dx / d * 40; gz = H.z + dz / d * 40; gy = 60; if (d > 170) { H.on = false; hGroup.visible = beam.visible = spot.visible = false; return; } }
    else { H.ang += dt * 0.22; gx = f.x + Math.cos(H.ang) * 26; gz = f.z + Math.sin(H.ang) * 26; gy = 23; }
    const dx = gx - H.x, dy = gy - H.y, dz = gz - H.z, d = Math.hypot(dx, dz), top = H.leaving ? 26 : 24;
    const k = 1 - Math.exp(-1.6 * dt), wvx = d > 0.1 ? dx / d * Math.min(top, d * 0.9) : 0, wvz = d > 0.1 ? dz / d * Math.min(top, d * 0.9) : 0;
    H.vx += (wvx - H.vx) * k; H.vz += (wvz - H.vz) * k; H.vy += (clamp(dy, -6, 6) - H.vy) * k;
    H.x += H.vx * dt; H.y += H.vy * dt; H.z += H.vz * dt;
    // nose towards the target (or away when leaving), banking with speed
    H.yaw += angleDelta(H.yaw, H.leaving ? Math.atan2(H.vx, H.vz) : Math.atan2(f.x - H.x, f.z - H.z)) * (1 - Math.exp(-2.2 * dt));
    H.rot += dt * 32;
    hGroup.position.set(H.x, H.y, H.z); hGroup.rotation.set(clamp(Math.hypot(H.vx, H.vz) * 0.012, 0, 0.25), H.yaw, 0);
    rotor.rotation.y = H.rot; tail.rotation.x = H.rot * 1.4;
    barMat.color.set(reducedMotion || (performance.now() / 260) % 2 < 1 ? '#ff2a3a' : '#3a7aff');
    // the searchlight lags behind you a little: keep moving and it slips off
    const ks = 1 - Math.exp(-(H.leaving ? 0.5 : 2.4) * dt);
    H.sx += (f.x - H.sx) * ks; H.sz += (f.z - H.sz) * ks;
    const by = H.y + 0.9;
    dir.set(H.sx - H.x, 0.05 - by, H.sz - H.z); const len = dir.length(); dir.multiplyScalar(1 / len);
    beam.position.set(H.x, by, H.z); beam.quaternion.setFromUnitVectors(DOWN, dir); beam.scale.set(1, len, 1);
    spot.position.set(H.sx, 0.06 + (game.vehicle ? game.vehicle.y || 0 : game.player.pos.y), H.sz);
    beam.visible = spot.visible = true;
    // laser bursts at the vehicle you are in, while the light is on you
    const v = target();
    H.cool -= dt;
    if (H.burst > 0) {
      H.burstT -= dt;
      if (H.burstT <= 0 && v) { heliShot(v); H.burst--; H.burstT = 0.13; }
      if (!v) H.burst = 0;
    } else if (!H.leaving && v && H.cool <= 0 && Math.hypot(H.sx - f.x, H.sz - f.z) < 5 && Math.hypot(H.x - f.x, H.z - f.z) < 60) {
      H.burst = 4; H.burstT = 0.4; H.cool = 3.4 + Math.random();
      audio.charge(clamp(1 - Math.hypot(H.x - camera.position.x, H.z - camera.position.z) / 90, 0.15, 1));
    }
  }
  function heliShot(v) {
    const mx = H.x + Math.sin(H.yaw) * 1.8, my = H.y + 0.9, mz = H.z + Math.cos(H.yaw) * 1.8;
    const hitIt = Math.random() < 0.72;
    let ex = v.x, ey = (v.y || 0) + 0.8, ez = v.z;
    if (!hitIt) { ex += (Math.random() - 0.5) * 6; ez += (Math.random() - 0.5) * 6; ey = 0.1; }
    fx.beam(mx, my, mz, ex, ey, ez, '#ff2bd1', 0.15, 0.09); fx.beam(mx, my, mz, ex, ey, ez, '#ffffff', 0.05, 0.07);
    const vol = clamp(1 - Math.hypot(camera.position.x - mx, camera.position.z - mz) / 90, 0.15, 1);
    audio.laser(vol); stats.heliShots++;
    if (hitIt) { stats.heliHits++; fx.sparks(ex, ey, ez, 10, '#ff8af0'); audio.zapHit(vol); damage.hit(v, 3, 'police'); }
    else fx.sparks(ex, ey, ez, 5, '#ff8af0');
  }

  // ---- tank
  function tankUpdate(dt, f) {
    if (!T.on) return;
    if (T.leaving) {
      T.gone += dt;
      if (T.gone > 8 || unseen(camera, T.x, T.z, 30)) { T.on = false; tGroup.visible = false; return; }
    }
    const dx = f.x - T.x, dz = f.z - T.z, d = Math.hypot(dx, dz);
    // drive at you (away when leaving), slowing down to fire once in range
    const want = T.leaving ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    T.yaw += clamp(angleDelta(T.yaw, want), -1.1 * dt, 1.1 * dt);
    const vmax = T.leaving ? 7 : d < 16 ? 0 : d < 35 ? 4 : 9;
    T.speed += clamp(vmax - T.speed, -8 * dt, 3 * dt);
    const nx = T.x + Math.sin(T.yaw) * T.speed * dt, nz = T.z + Math.cos(T.yaw) * T.speed * dt;
    if (onLand(nx, nz)) {
      pos.x = nx; pos.z = nz;
      for (const b of L.solids) if (b.h > 1.2) pushOut(pos, 2.8, b);
      T.x = pos.x; T.z = pos.z;
    } else T.speed = 0;
    // it shoves cars out of its way (yours included), scraping them
    for (const c of game.vehicles.cars) {
      if (c.off || c.wreck) continue;
      const ex = c.x - T.x, ez = c.z - T.z, e = Math.hypot(ex, ez);
      if (e < 4 && e > 0.01) { const k = (4 - e) / e; c.x += ex * k; c.z += ez * k; c.vx += ex / e * 3; c.vz += ez / e * 3; if (c === game.vehicle) damage.hit(c, 6 * dt, 'police'); }
    }
    T.recoil = Math.max(0, T.recoil - dt * 2.5);
    tGroup.position.set(T.x, 0, T.z); tGroup.rotation.y = T.yaw;
    T.tYaw += clamp(angleDelta(T.tYaw, Math.atan2(dx, dz) - T.yaw), -1.6 * dt, 1.6 * dt);
    turret.rotation.y = T.tYaw; barrel.position.z = 1.2 - T.recoil * 0.5;
    const v = target();
    T.cool -= dt;
    if ((T.losT -= dt) <= 0) { T.losT = 0.25; T.los = d < 90 && !segBlocked(T.x, T.z, f.x, f.z, L.solids); }
    // stuck behind the blocks with no line on you: it comes round another street, out of view
    T.blind = T.los ? 0 : T.blind + dt;
    if (!T.leaving && T.blind > 8 && unseen(camera, T.x, T.z, 30)) { T.blind = 0; spawnTank(f, true); return; }
    if (!T.leaving && v && T.cool <= 0 && d > 14 && d < 85 && T.los && Math.abs(angleDelta(T.yaw + T.tYaw, Math.atan2(dx, dz))) < 0.2) fire(v, d);
  }
  function fire(v, d) {
    const s = shells.find((k) => !k.on);
    if (!s) return;
    const yaw = T.yaw + T.tYaw;
    s.x = T.x + Math.sin(yaw) * 4.6; s.y = 2.3; s.z = T.z + Math.cos(yaw) * 4.6;
    // a lobbed shell: flight time grows with range, aimed where the vehicle will be (roughly)
    const ft = 0.7 + d / 45, lead = 0.6;
    const tx = v.x + (v.vx || 0) * ft * lead + (Math.random() - 0.5) * 3, tz = v.z + (v.vz || 0) * ft * lead + (Math.random() - 0.5) * 3, ty = (v.y || 0) + 0.6;
    s.vx = (tx - s.x) / ft; s.vz = (tz - s.z) / ft; s.vy = (ty - s.y + 0.5 * G * ft * ft) / ft;
    s.on = true; s.life = ft + 1.5; s.m.visible = true;
    T.cool = 4.2 + Math.random() * 1.5; T.recoil = 1;
    fx.puff(s.x, s.y, s.z, Math.sin(yaw), 0.2, Math.cos(yaw)); fx.flame(s.x, s.y, s.z, 1.3); fx.sparks(s.x, s.y, s.z, 14, '#ffd27a');
    if (!reducedMotion) fx.shake = Math.max(fx.shake, 0.12);
    audio.shot(); stats.shells++;
  }
  function shellsUpdate(dt) {
    for (const s of shells) {
      if (!s.on) continue;
      const n = 3, h = dt / n;
      for (let k = 0; k < n && s.on; k++) {
        s.vy -= G * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.life -= h;
        let hit = s.y <= 0.15 || s.life <= 0, direct = null;
        if (!hit) for (const b of L.solids) if (s.y < b.h && s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1) { hit = true; break; }
        if (!hit) for (const c of game.vehicles.all()) if (!c.off && !c.wreck && Math.abs(s.y - (c.y || 0) - 0.8) < 1.6 && Math.hypot(s.x - c.x, s.z - c.z) < (c.radius || 1.5) + 0.6) { hit = true; direct = c; break; }
        if (hit) { s.on = false; boom(s.x, Math.max(s.y, 0.3), s.z, direct); }
      }
      s.m.visible = s.on; if (s.on) s.m.position.set(s.x, s.y, s.z);
    }
  }
  // the blast: vehicles and props only. Pedestrians aren't knocked down or hurt, they just run
  function boom(x, y, z, direct) {
    fx.explode(x, y, z); audio.boom(); stats.blasts++;
    if (direct && direct === game.vehicle) stats.shellHits++;
    else if (game.vehicle && Math.hypot(game.vehicle.x - x, game.vehicle.z - z) < 8) stats.shellHits++;
    damage.blast(x, y, z, { r: 8, dmg: 34, by: 'police', direct, directDmg: 26, push: 9, props: 1.2, knock: 0, scare: 45, hurt: 0 });
  }

  const api = {
    stats,
    get heli() { return H.on ? { x: +H.x.toFixed(1), y: +H.y.toFixed(1), z: +H.z.toFixed(1), leaving: H.leaving, spot: [+H.sx.toFixed(1), +H.sz.toFixed(1)] } : null; },
    get tank() { return T.on ? { x: +T.x.toFixed(1), z: +T.z.toFixed(1), leaving: T.leaving, cool: +T.cool.toFixed(2) } : null; },
    // automated checks: bring the units in close at once
    warp() {
      const f = focusNow();
      if (game.wanted >= 4) { if (!H.on) spawnHeli(f); Object.assign(H, { x: f.x + 20, y: 23, z: f.z + 10, sx: f.x, sz: f.z, cool: 0.3, leaving: false }); }
      if (game.wanted >= 5) { T.on = false; spawnTank(f, true); T.cool = 0.5; }
      return { heli: api.heli, tank: api.tank };
    },
    blips(out) {
      if (game.inside) return;
      const fl = (performance.now() / 250) % 2 < 1 ? '#ff2a3a' : '#3a7aff';
      if (H.on) out.push({ x: H.x, z: H.z, color: fl, big: true });
      if (T.on) out.push({ x: T.x, z: T.z, color: fl, big: true });
    },
    update(dt) {
      if (!game.started) return;
      if (game.busy === 'down' || game.busy === 'walkout') { if (game.wanted === 0) hideAll(); return; }
      if (game.inside || game.busy === 'cut') { beam.visible = spot.visible = false; return; }
      const f = focusNow();
      if (game.wanted >= 4 && !H.on) spawnHeli(f);
      if (H.on) H.leaving = game.wanted < 4;
      if (game.wanted >= 5 && !T.on) spawnTank(f);
      if (T.on && game.wanted < 5) T.leaving = true;
      heliUpdate(dt, f);
      tankUpdate(dt, f);
      shellsUpdate(dt);
      if (!H.on) beam.visible = spot.visible = false;
    },
  };
  return api;
}
