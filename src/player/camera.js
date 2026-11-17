// Third-person orbit camera: smooth follow, mouse-drag orbit, simple wall avoidance.
import * as THREE from 'three';
import { damp, clamp, angleDelta, reducedMotion } from '../core/util.js';

const DIST = { foot: 7.5, car: 10.5, bike: 8.2, tank: 14, heli: 17 };
const LIFT = { foot: 1.5, car: 1.6, bike: 1.6, tank: 3, heli: 2.4 };
// first-person eye: height above the vehicle/feet and how far forward of its centre
export const EYE = { foot: [1.62, 0.25], car: [1.25, 0.35], bike: [1.7, 0.2], tank: [3.5, 0.4], heli: [1.9, 1.3] };
export const VIEWS = [
  { id: 'third', name: 'THIRD PERSON', dist: 1 },
  { id: 'close', name: 'CLOSE THIRD PERSON', dist: 0.52 },
  { id: 'first', name: 'FIRST PERSON', dist: 0 },
];
let saved = 0;
try { saved = +localStorage.getItem('neon-view') || 0; } catch {}

export function createFollowCamera(camera, solids) {
  const target = new THREE.Vector3(-10, 1.5, 67), look = new THREE.Vector3();
  const cam = {
    yaw: Math.PI / 2, pitch: 0.2, dist: 7.5, view: VIEWS[saved % VIEWS.length],
    cycleView() {
      cam.view = VIEWS[(VIEWS.indexOf(cam.view) + 1) % VIEWS.length];
      try { localStorage.setItem('neon-view', VIEWS.indexOf(cam.view)); } catch {}
      return cam.view;
    },
    get first() { return cam.view.id === 'first'; },
    snap(p) { target.set(p.x, p.y + 1.5, p.z); },
    update(dt, input, mode, focus, heading, speed, fx, playerPhase) {
      if (input.dragDX || input.dragDY) {
        cam.yaw -= input.dragDX * 0.0055;
        cam.pitch = clamp(cam.pitch + input.dragDY * 0.004, -0.12, 1.25);
      }
      // ease back behind a moving car / helicopter when the mouse has been left alone
      const idle = performance.now() / 1000 - input.lastDrag;
      if (cam.first && mode !== 'foot' && idle > 0.8) {
        cam.yaw += angleDelta(cam.yaw, heading) * (1 - Math.exp(-6 * dt));
      } else if ((mode === 'car' || mode === 'bike' || mode === 'heli') && idle > 1.2 && Math.abs(speed) > 3) {
        cam.yaw += angleDelta(cam.yaw, heading) * (1 - Math.exp(-(mode === 'heli' ? 1.2 : mode === 'bike' ? 3 : 2.2) * dt));
      }
      target.x = damp(target.x, focus.x, 12, dt);
      target.z = damp(target.z, focus.z, 12, dt);
      target.y = damp(target.y, focus.y + LIFT[mode], 8, dt);
      if (cam.first) {
        // eyes in the head (or the driver's seat), looking where the mouse points
        const [eh, ef] = EYE[mode], fy = Math.sin(heading), fz = Math.cos(heading);
        camera.position.set(focus.x + fy * ef, focus.y + eh, focus.z + fz * ef);
        const lp = clamp(cam.pitch - 0.2, -0.9, 0.9), c = Math.cos(lp);
        look.set(camera.position.x + Math.sin(cam.yaw) * c, camera.position.y - Math.sin(lp), camera.position.z + Math.cos(cam.yaw) * c);
        if (fx.shake > 0.01) { camera.position.x += (Math.random() - 0.5) * fx.shake * 0.5; camera.position.y += (Math.random() - 0.5) * fx.shake * 0.5; }
        camera.lookAt(look);
        const fovF = 72 + (reducedMotion ? 0 : clamp(Math.abs(speed) * 0.2, 0, 8));
        if (Math.abs(camera.fov - fovF) > 0.05) { camera.fov = damp(camera.fov, fovF, 4, dt); camera.updateProjectionMatrix(); }
        return;
      }
      let want = DIST[mode] * cam.view.dist + (mode === 'car' || mode === 'bike' ? Math.min(Math.abs(speed) * 0.06, 3) * cam.view.dist : 0);
      // pull in if a building sits between the camera and the target
      const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
      for (let i = 1; i <= 10; i++) {
        const d = want * i / 10, x = target.x + dx * d, y = target.y + dy * d, z = target.z + dz * d;
        let blocked = false;
        for (const b of solids) if (y < b.h && x > b.x0 - 0.4 && x < b.x1 + 0.4 && z > b.z0 - 0.4 && z < b.z1 + 0.4) { blocked = true; break; }
        if (blocked) { want = Math.max(1.2, want * (i - 1) / 10); break; }
      }
      cam.dist = want < cam.dist ? want : damp(cam.dist, want, 4, dt);
      let bob = 0;
      if (mode === 'foot' && !reducedMotion) bob = Math.sin(playerPhase * 2) * 0.03 * clamp(speed / 13, 0, 1);
      camera.position.set(target.x + dx * cam.dist, Math.max(0.5, target.y + dy * cam.dist + bob), target.z + dz * cam.dist);
      if (fx.shake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * fx.shake; camera.position.y += (Math.random() - 0.5) * fx.shake;
      }
      look.copy(target); look.y += 0.4;
      camera.lookAt(look);
      const fov = 62 + (reducedMotion ? 0 : clamp(Math.abs(speed) * 0.22, 0, 10));
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
    },
  };
  return cam;
}
