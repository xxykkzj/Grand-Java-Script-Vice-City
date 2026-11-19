// "Skye", the roller-skating courier: teal-and-magenta bomber jacket, white shorts, backwards cap,
// messenger bag, quad skates. Four or five draw calls, animated by swinging the pivots.
import * as THREE from 'three';
import { damp, clamp, angleDelta, pushOut, PI, reducedMotion } from '../core/util.js';
import { createFigure, lookOf } from '../actors/figure.js';
import { rimU } from '../game/interiors.js';
import { clampToWorld, PIER, HZ } from '../world/layout.js';
import { pushFromSolids } from '../world/sea.js';

// The courier is the procedural, skinned figure from actors/figure.js. It keeps the old model's pivots
// (root, body, torso, head, eyes / mouth hooks, armL/armR, legL/legR + legX.shin, skirt.drape), so the
// code below drives it as before; the figure solves elbows, wrists, ankles and the face itself.
export { lookOf };
function buildModel() {
  return createFigure('SKYE', { rimU, reducedMotion });
}

export function createPlayer(scene, L) {
  const model = buildModel();
  scene.add(model.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  shadow.renderOrder = 1;
  scene.add(shadow);

  const CS = [];
  let blinkT = 2, blink = 0, breathT = 0, talkT = 0;
  const knees = (kl, kr) => { model.legL.shin.rotation.x = kl; model.legR.shin.rotation.x = kr; };
  const drape = () => { const m = model; m.skirt.drape(m.legL.rotation.x, m.legL.rotation.z, m.legR.rotation.x, m.legR.rotation.z); };
  const P = {
    talking: false,
    // blink, breathe, and move the mouth while talking in a scene (called every frame)
    tickFace(dt) {
      const m = model;
      blinkT -= dt;
      if (blinkT <= 0) { blink = 0.13; blinkT = 2.2 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt);
      m.eyes.scale.y = blink > 0 ? 0.12 : 1;
      breathT += dt;
      const br = Math.sin(breathT * 1.7);
      m.torso.scale.set(1 + br * 0.006, 1, 1 + br * 0.022);
      talkT += dt;
      m.mouth.scale.y = P.talking && !reducedMotion ? 1.3 + Math.abs(Math.sin(talkT * 17)) * 2.4 * (0.6 + 0.4 * Math.sin(talkT * 5.3)) : P.talking ? 1.8 : 1;
      m.tick(dt, { blink: false });   // eye darts, expression easing (blinks and the mouth come from the hooks above)
    },
    pos: new THREE.Vector3(-10, 0, 67), vel: new THREE.Vector3(), vy: 0, yaw: PI / 2,
    onGround: true, hidden: false, lowGravity: false, phase: 0, speed: 0, lean: 0, model, floor: 0, shadow,
    groundAt: null,      // optional (x, z) -> ground height: the sand shelf that slopes into the sea (player/swim.js)
    sy: 0,               // how far the ground under the courier is below the floor (lowers the blob shadow)
    leap: false,         // jumping off the pier into the water: the pier edge lets go
    swimming: false,     // set by player/swim.js while it drives the courier
    setHidden(h) { P.hidden = h; model.root.visible = !h; shadow.visible = !h; },
    update(dt, inp, camYaw, vehicles, audio) {
      if (P.hidden) return;
      // camera-relative movement with a bit of glide: you're on skates
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      let dx = fx * inp.move - fz * inp.strafe, dz = fz * inp.move + fx * inp.strafe;
      const len = Math.hypot(dx, dz), top = inp.sprint ? 13.5 : 7.5;
      if (len > 0) { const k = top * Math.min(1, len) / len; dx *= k; dz *= k; }   // keys give len >= 1, the touch stick less
      const rate = P.onGround ? (len > 0 ? 5 : 1.7) : 1;
      P.vel.x = damp(P.vel.x, dx, rate, dt); P.vel.z = damp(P.vel.z, dz, rate, dt);
      if (inp.jump && P.onGround) {
        P.vy = 8.4; P.onGround = false; audio.jump();
        // at the pier's edge a jump is a leap into the sea
        const px = P.pos.x, pz = P.pos.z;
        if (P.pos.y > -0.3 && px > PIER.x0 && px < PIER.x1 && pz > HZ + 12 && (px < PIER.x0 + 1.5 || px > PIER.x1 - 1.5 || pz > PIER.z1 - 1.5)) {
          P.leap = true;
          if (px < PIER.x0 + 1.5) P.vel.x = Math.min(P.vel.x, -3.5); else if (px > PIER.x1 - 1.5) P.vel.x = Math.max(P.vel.x, 3.5); else P.vel.z = Math.max(P.vel.z, 3.5);
        }
      }
      const g0 = P.groundAt ? P.groundAt(P.pos.x, P.pos.z) : 0;
      P.vy -= (P.lowGravity ? 4.2 : 23) * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= g0) { if (!P.onGround && P.vy < -4) audio.step(1); P.pos.y = g0; P.vy = 0; P.onGround = true; } else P.onGround = false;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      if (P.groundAt) {          // walking down the sand shelf: stay on it instead of hopping
        const g1 = P.groundAt(P.pos.x, P.pos.z); P.sy = g1;
        if (P.onGround && P.vy <= 0 && P.pos.y > g1 && P.pos.y - g1 < 0.35) P.pos.y = g1;
      }

      for (const b of L.solids) {
        if (P.pos.y > b.h) continue;
        const n = pushOut(P.pos, 0.45, b);
        if (n) { const vn = P.vel.x * n.nx + P.vel.z * n.nz; if (vn < 0) { P.vel.x -= vn * n.nx; P.vel.z -= vn * n.nz; } }
      }
      L.props.collide(P.pos, 0.42, P.pos.y, P.vel);
      for (const v of vehicles.all()) {
        if (Math.abs(v.y - P.pos.y) > 1.6 || Math.abs(P.pos.x - v.x) > 6 || Math.abs(P.pos.z - v.z) > 6) continue;
        for (const c of vehicles.circlesOf(v, CS)) {
          const ddx = P.pos.x - c[0], ddz = P.pos.z - c[1], rr = c[2] + 0.4, d = Math.hypot(ddx, ddz);
          if (d < rr && d > 1e-4) { P.pos.x += ddx / d * (rr - d); P.pos.z += ddz / d * (rr - d); }
        }
      }
      if (P.pos.y < -0.25 && !P.leap) pushFromSolids(P.pos, 0.5, P.pos.y);     // below the pier deck: the sand beside the pier piles
      clampToWorld(P.pos, 0.6, P.leap ? 3 : 1);
      if (P.leap && (P.onGround || P.pos.y < -0.2)) P.leap = false;

      P.speed = Math.hypot(P.vel.x, P.vel.z);
      let turn = 0;
      if (P.speed > 0.6) { turn = angleDelta(P.yaw, Math.atan2(P.vel.x, P.vel.z)); P.yaw += turn * (1 - Math.exp(-10 * dt)); }

      P.animate(dt, turn, audio);
    },
    // pose the model from P.pos / P.yaw / P.speed (also used by cutscenes and the carjack)
    animate(dt, turn, audio) {
      const k = clamp(P.speed / 7.5, 0, 1.5), m = model;
      const prev = P.phase;
      P.phase += dt * (2.2 + P.speed * 0.42) * (k > 0.05 ? 1 : 0.15);
      if (audio && P.onGround && k > 0.2 && Math.floor(prev / PI) !== Math.floor(P.phase / PI)) audio.step(k);
      const s = Math.sin(P.phase), c = Math.cos(P.phase);
      P.lean = damp(P.lean, clamp(turn * 0.5, -0.3, 0.3) * k, 6, dt);
      if (P.onGround) {
        m.legL.rotation.set(s * 0.55 * k, 0, Math.max(0, -c) * 0.22 * k);
        m.legR.rotation.set(-s * 0.55 * k, 0, -Math.max(0, c) * 0.22 * k);
        m.armL.rotation.set(-s * 0.75 * k, 0, 0.08 + 0.1 * k);
        m.armR.rotation.set(s * 0.75 * k, 0, -0.08 - 0.1 * k);
        m.body.rotation.set(0.2 * k, 0, -P.lean);
        m.body.position.y = (reducedMotion ? 0 : Math.abs(c) * 0.035 * k) - 0.03 * k + Math.sin(P.phase * 0.5) * 0.004;
        knees(0.12 * k + Math.max(0, s) * 0.5 * k, 0.12 * k + Math.max(0, -s) * 0.5 * k);
      } else {
        m.legL.rotation.set(-0.5, 0, 0.1); m.legR.rotation.set(0.35, 0, -0.1); knees(0.7, 0.3);
        m.armL.rotation.set(-0.4, 0, 0.9); m.armR.rotation.set(-0.4, 0, -0.9);
        m.body.rotation.set(0.08, 0, -P.lean); m.body.position.y = 0;
      }
      m.head.rotation.set(-0.15 * k, 0, 0); m.body.position.x = m.body.position.z = 0;
      m.root.position.copy(P.pos); m.root.rotation.set(0, P.yaw, 0);
      drape();
      shadow.position.set(P.pos.x, P.floor + P.sy + 0.03, P.pos.z);
      const sk = 1 / (1 + (P.pos.y - P.floor) * 0.35); shadow.scale.set(sk, 1, sk);
    },
    // dancing / sitting: pose the model from a pose object (see actors/moves.js); the legs pivot at the hips
    applyPose(o) {
      const m = model, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      m.root.position.set(P.pos.x + rx * o.x, P.pos.y, P.pos.z + rz * o.x);
      m.root.rotation.set(0, P.yaw + o.spin, 0);
      // rotate the body about the hips, not the feet
      const h = 0.96, cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry), sy = Math.sin(o.ry), cz = Math.cos(o.rz), sz = Math.sin(o.rz);
      m.body.position.set(h * sz * cy, o.y + h - h * (cz * cx - sz * sy * sx), -h * (cz * sx + sz * sy * cx));
      m.body.rotation.set(o.rx, o.ry, o.rz);
      m.head.rotation.set(o.hx, o.hy || 0, o.hz);
      m.armL.rotation.set(o.aL[0], o.aL[1], o.aL[2]); m.armR.rotation.set(o.aR[0], o.aR[1], o.aR[2]);
      m.legL.rotation.set(o.lL[0], 0, o.lL[1]); m.legR.rotation.set(o.lR[0], 0, o.lR[1]);
      // knees bend with the thighs (sitting, lunging); `knee` scales it (a sun lounger keeps legs long)
      const kk = o.knee === undefined ? 1 : o.knee;
      knees(clamp(-o.lL[0] - 0.12, 0, 1.6) * kk, clamp(-o.lR[0] - 0.12, 0, 1.6) * kk);
      drape();
      shadow.visible = !P.hidden;
      shadow.position.set(m.root.position.x, P.floor + 0.03, m.root.position.z); shadow.scale.set(1, 1, 1);
    },
    // back to the plain standing rig (after dancing or sitting)
    resetPose() { model.body.position.set(0, 0, 0); model.body.rotation.set(0, 0, 0); model.head.rotation.set(0, 0, 0); },
    // sat on the Comet: tucked in behind the screen, leaning and wheelie-ing with the bike
    ride(v) {
      const m = model, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), up = Math.sin(-Math.min(v.tx, 0));
      P.pos.set(v.x, v.y, v.z); P.yaw = v.yaw; P.speed = 0; P.vel.set(0, 0, 0); P.vy = 0; P.onGround = true;
      m.root.position.set(v.x - fx * (0.95 + up * 0.3), v.y + 0.02 + up * 0.5, v.z - fz * (0.95 + up * 0.3));
      m.root.rotation.set(v.tx * 0.8, v.yaw, v.tz, 'YXZ');
      m.body.rotation.set(0.42, 0, 0); m.body.position.y = 0;
      m.legL.rotation.set(-1.25, 0, 0.28); m.legR.rotation.set(-1.25, 0, -0.28); knees(1.25, 1.25); drape();
      m.armL.rotation.set(-1.6, 0, -0.12); m.armR.rotation.set(-1.6, 0, 0.12);
      m.head.rotation.x = -0.35;
      shadow.visible = false;
    },
  };
  return P;
}
