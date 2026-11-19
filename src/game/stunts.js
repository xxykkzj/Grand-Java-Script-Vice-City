// Stunt jumps: eight ramps across both districts (world/layout.js A_RAMPS, world/key.js). Hit one fast
// enough and land in its zone: a moment of slow motion from the side, the AIRTIME card with the distance,
// height and flips, cash, and the jump goes on your list (kept with the save; the pause panel shows
// "stunts found x/8"). The vertical physics are in vehicles/vehicles.js (onTakeoff / onLand).
import { reducedMotion, damp, clamp } from '../core/util.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export function createStunts(game) {
  const { vehicles, hud, audio, L, camera } = game;
  const save = game.save;
  if (!Array.isArray(save.stunts)) save.stunts = [];
  const ramps = L.ramps, total = ramps.length;
  const stats = { jumps: 0, clean: 0, last: null };
  const banner = $('airtime');
  let jump = null, slow = 0, bannerT = 0, camOn = false;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();

  vehicles.onTakeoff = (c, surface, speed) => {
    if (c !== game.vehicle || !surface.stunt) return;
    const r = surface.stunt;
    jump = { r, c, x: c.x, z: c.z, y0: c.y, speed, fast: speed >= r.vmin, t: 0, high: 0 };
    stats.jumps++;
    if (jump.fast) {
      slow = 1.6;
      // the camera steps out to the side of the arc (not with reduced motion: the normal camera follows)
      if (!reducedMotion && !game.cam.first) {
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), side = Math.random() < 0.5 ? 1 : -1;
        camPos.set(c.x + fx * 9 + fz * 13 * side, c.y + 4.5, c.z + fz * 9 - fx * 13 * side);
        camOn = true;
      }
    }
  };
  vehicles.onLand = (c, impact, surface, flipA) => land(c, flipA);
  function land(c, flipA) {
    if (!jump || c !== jump.c) return;
    const r = jump.r, L2 = r.land;
    const dist = Math.hypot(c.x - jump.x, c.z - jump.z), height = Math.max(0, jump.high), flips = Math.floor((flipA + 0.9) / (Math.PI * 2));
    const inZone = c.x > L2.x0 && c.x < L2.x1 && c.z > L2.z0 && c.z < L2.z1;
    const clean = jump.fast && inZone && !c.wreck;
    stats.last = { id: r.id, clean, dist: +dist.toFixed(1), height: +height.toFixed(1), flips, fast: jump.fast, inZone, speed: +jump.speed.toFixed(1) };
    jump = null;
    if (clean) {
      stats.clean++;
      const first = !save.stunts.includes(r.id);
      if (first) { save.stunts.push(r.id); game.persist(); }
      const cash = Math.round((80 + dist * 8 + height * 30 + flips * 250 + (first ? 250 : 0)) / 10) * 10;
      game.money += cash;
      stats.last.cash = cash;
      show(r.name, dist, height, flips, cash, first);
      audio.cash();
    } else {
      slow = Math.min(slow, 0.2);
      if (dist > 5) hud.toast(stats.last.fast ? 'MISSED THE LANDING' : 'NOT ENOUGH SPEED', r.name + (stats.last.fast ? ' · LAND IN THE ZONE' : ' · HIT IT FASTER'));
    }
  }
  function show(name, dist, height, flips, cash, first) {
    $('airn').textContent = name;
    $('aird').textContent = `${dist.toFixed(0)} M`;
    $('airh').textContent = `${height.toFixed(1)} M`;
    $('airf').textContent = String(flips);
    $('airc').textContent = '+$' + cash.toLocaleString('en-US');
    $('airs').textContent = first ? `NEW STUNT · ${save.stunts.length}/${total} FOUND` : `${save.stunts.length}/${total} FOUND`;
    banner.hidden = false; banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on');
    bannerT = 3.2;
  }

  return {
    stats, ramps,
    found: () => save.stunts.length, total,
    // the game's time scale this frame (slow motion while a clean jump is in the air)
    get scale() { return slow > 0 ? (reducedMotion ? 0.6 : 0.35) : 1; },
    get cam() { return camOn; },
    update(rawDt) {
      if (jump) {
        jump.t += rawDt; jump.high = Math.max(jump.high, jump.c.y - (jump.c.gy || 0));
        if (jump.c.sink) land(jump.c, jump.c.flipA || 0);              // into the sea (vehicles/sinking.js took it): a splash landing
        else if (jump.t > 6 || game.vehicle !== jump.c) { jump = null; slow = 0; }
      }
      if (slow > 0) { slow -= rawDt; if (slow <= 0) camOn = false; }
      if (!jump && slow <= 0) camOn = false;
      if (bannerT > 0) { bannerT -= rawDt; if (bannerT <= 0) { banner.classList.remove('on'); setTimeout(() => { if (bannerT <= 0) banner.hidden = true; }, 400); } }
    },
    // the side-on camera during a jump: hold position, keep the car in the middle of the frame
    camUpdate(dt) {
      const c = game.vehicle;
      if (!c) { camOn = false; return; }
      camPos.y = damp(camPos.y, c.y + 3.5, 2, dt);
      camera.position.copy(camPos);
      look.set(c.x, c.y + 0.8, c.z);
      camera.lookAt(look);
      const fov = clamp(camera.fov, 55, 70);
      if (fov !== camera.fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // checks: launch the player's vehicle at a ramp's foot, lined up and at speed
    line(id, speed = 24) {
      const r = ramps.find((k) => k.id === id), v = game.vehicle;
      if (!r || !v) return null;
      const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw), back = r.len / 2 + (r.deck ? 5 : 8);
      Object.assign(v, { x: r.x - fx * back, z: r.z - fz * back, yaw: r.yaw, vx: fx * speed, vz: fz * speed, vy: 0, y: 0, air: false, surf: null, tx: 0, tz: 0, spin: 0 });
      return r;
    },
  };
}
