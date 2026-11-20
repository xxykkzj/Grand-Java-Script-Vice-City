// Cinematic mode (K, or the button in the pause panel): the HUD and touch controls go away, letterbox bars
// slide in and the camera flies a slow orbit round the courier (or whatever they are driving), drifting in
// and out and up and down, pulling in or lifting over anything that would stand between it and the subject.
// Any key, click, tap or scroll ends it. Reduced motion: a much slower, level orbit with no drift.
import * as THREE from 'three';
import { clamp, damp, reducedMotion } from '../core/util.js';

export function createCinematic(game) {
  const { camera, L } = game;
  const solids = L.solids;
  const $ = (id) => document.getElementById(id);
  const bars = $('cine'), tag = $('cinetag');
  let on = false, t = 0, ang = 0, stamp = 0, shot = 0;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3();
  const C = { r: 16, h: 5, fov: 50 };

  // anything solid and tall enough between the subject and a camera spot?
  const clear = (cx, cy, cz, px, py, pz) => {
    for (let i = 1; i <= 12; i++) {
      const s = i / 12, x = cx + (px - cx) * s, y = cy + (py - cy) * s, z = cz + (pz - cz) * s;
      for (const b of solids) if (y < b.h + 0.4 && x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) return false;
    }
    return true;
  };
  function exit(e) {
    if (!on) return;
    on = false;
    document.body.classList.remove('cinemode');
    bars.classList.remove('cm');
    tag.classList.remove('on');
    removeEventListener('keydown', onInput, true); removeEventListener('pointerdown', onInput, true); removeEventListener('wheel', onInput, true);
    if (e && e.type !== 'wheel') e.stopImmediatePropagation();
    if (e && e.type === 'keydown') e.preventDefault();
  }
  // the key or tap that leaves the mode is swallowed, so it does not also do something in the game
  function onInput(e) {
    if (e.type === 'keydown' && (e.repeat || e.timeStamp <= stamp)) { e.stopImmediatePropagation(); return; }
    if (e.type === 'pointerdown' && e.timeStamp <= stamp) return;
    exit(e);
  }
  const api = {
    get active() { return on; },
    // false when it cannot start right now (a scene, a shop, indoors, not started yet)
    start() {
      if (on || !game.started || game.busy || game.inside || game.cheats.open) return false;
      on = true; t = 0; shot = 0; stamp = performance.now();
      pos.copy(camera.position);
      const f = game.focus();
      ang = Math.atan2(camera.position.x - f.x, camera.position.z - f.z);
      look.set(f.x, (f.y || 0) + 1.4, f.z);
      document.body.classList.add('cinemode');
      bars.classList.add('cm'); tag.classList.add('on');
      setTimeout(() => tag.classList.remove('on'), 3600);
      addEventListener('keydown', onInput, true); addEventListener('pointerdown', onInput, true); addEventListener('wheel', onInput, { capture: true, passive: true });
      return true;
    },
    stop() { exit(); },
    toggle() { return on ? (exit(), false) : api.start(); },
    update(dt) {
      if (!on) return;
      if (game.busy || game.inside || game.paused) { exit(); return; }
      t += dt;
      const f = game.focus(), cx = f.x, cy = (f.y || 0) + 1.4, cz = f.z;
      // the shot: a slow orbit, drifting in and out and up and down
      const k = reducedMotion ? 0 : 1;
      ang += dt * (reducedMotion ? 0.035 : 0.11);
      const R = 15 + k * 6 * Math.sin(t * 0.07 + 0.6) + (game.vehicle ? 5 : 0), H = 4.5 + k * 3 * Math.sin(t * 0.05 + 1.3);
      let r = R, h = H, ok = false;
      for (let i = 0; i < 7 && !ok; i++) {
        r = R * (1 - i * 0.13); h = H + i * 0.9;
        want.set(cx + Math.sin(ang) * r, Math.max(1.4, cy + h), cz + Math.cos(ang) * r);
        ok = clear(cx, cy, cz, want.x, want.y, want.z);
      }
      if (!ok) want.set(cx + Math.sin(ang) * 3.5, cy + H + 7, cz + Math.cos(ang) * 3.5);
      // ease towards the spot; pull in quickly when something is in the way
      const rate = ok && r > R * 0.95 ? 2.4 : 5;
      pos.x = damp(pos.x, want.x, rate, dt); pos.y = damp(pos.y, want.y, rate, dt); pos.z = damp(pos.z, want.z, rate, dt);
      look.x = damp(look.x, cx, 4, dt); look.y = damp(look.y, cy + 0.2, 4, dt); look.z = damp(look.z, cz, 4, dt);
      camera.position.copy(pos);
      camera.lookAt(look);
      const fov = 50 + k * 4 * Math.sin(t * 0.09);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }
    },
  };
  return api;
}
