// "Skye", the roller-skating courier: teal-and-magenta bomber jacket, white shorts,
// backwards cap, messenger bag. Built from boxes, six draw calls, animated by swinging pivots.
import * as THREE from 'three';
import { box, cyl, merge, damp, clamp, angleDelta, pushOut, PI, reducedMotion } from '../core/util.js';
import { clampToWorld } from '../world/layout.js';

const TEAL = '#12b5a6', MAG = '#e6258f', WHITE = '#f7f5ef', SKIN = '#c98d62', BAG = '#f2b63a', HAIR = '#2a2140', DARK = '#1b1830';

function buildModel() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const part = (geos, x, y, z, parent = body) => {
    const m = new THREE.Mesh(merge(geos), mat);
    m.position.set(x, y, z); parent.add(m);
    return m;
  };
  // torso: jacket, ribbed hem + collar, chest stripe, shorts, bag strap + bag
  part([
    box(0.46, 0.52, 0.27, 0, 1.3, 0, TEAL),
    box(0.48, 0.08, 0.29, 0, 1.07, 0, MAG), box(0.3, 0.07, 0.24, 0, 1.585, 0, MAG),
    box(0.47, 0.07, 0.28, 0, 1.36, 0, MAG), box(0.47, 0.03, 0.28, 0, 1.3, 0, WHITE),
    box(0.05, 0.5, 0.275, 0, 1.3, 0.002, WHITE),                                   // zip
    box(0.4, 0.2, 0.25, 0, 0.94, 0, WHITE),                                         // shorts waist
    box(0.07, 0.72, 0.3, 0, 1.3, 0, DARK, 0, 0, -0.72),                             // strap
    box(0.13, 0.26, 0.34, -0.31, 0.96, -0.02, BAG), box(0.135, 0.1, 0.35, -0.31, 1.05, -0.02, '#d6952a'),
    box(0.12, 0.1, 0.12, 0, 1.63, 0, SKIN),                                         // neck
  ], 0, 0, 0);
  // head with a backwards cap (brim over the neck)
  const head = part([
    box(0.26, 0.27, 0.26, 0, 0.14, 0, SKIN),
    box(0.275, 0.1, 0.24, 0, 0.2, -0.03, HAIR),
    box(0.29, 0.11, 0.29, 0, 0.3, 0, MAG), box(0.29, 0.05, 0.29, 0, 0.25, 0, TEAL),
    box(0.22, 0.03, 0.17, 0, 0.25, -0.21, MAG),
    box(0.05, 0.05, 0.02, -0.07, 0.15, 0.131, DARK), box(0.05, 0.05, 0.02, 0.07, 0.15, 0.131, DARK),
    box(0.1, 0.02, 0.02, 0, 0.07, 0.131, '#8a4a3a'),
  ], 0, 1.68, 0);
  const arm = (sx) => part([
    box(0.14, 0.44, 0.15, 0, -0.2, 0, MAG), box(0.145, 0.06, 0.155, 0, -0.43, 0, TEAL),
    box(0.145, 0.04, 0.155, 0, -0.1, 0, WHITE), box(0.1, 0.12, 0.11, 0, -0.52, 0, SKIN),
  ], sx * 0.3, 1.52, 0);
  const leg = (sx) => part([
    box(0.18, 0.3, 0.2, 0, -0.14, 0, WHITE),                                         // shorts leg
    box(0.13, 0.36, 0.14, 0, -0.44, 0, SKIN),
    box(0.14, 0.1, 0.15, 0, -0.62, 0, WHITE), box(0.14, 0.03, 0.155, 0, -0.6, 0, MAG), // sock
    box(0.17, 0.17, 0.32, 0, -0.74, 0.04, WHITE), box(0.175, 0.05, 0.33, 0, -0.74, 0.04, TEAL), // skate boot
    box(0.1, 0.04, 0.3, 0, -0.84, 0.04, DARK),
    cyl(0.06, 0.06, 0.16, 8, 0, -0.9, 0.15, MAG, 0, PI / 2), cyl(0.06, 0.06, 0.16, 8, 0, -0.9, -0.07, MAG, 0, PI / 2),
  ], sx * 0.12, 0.96, 0);
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
  // Outfits repaint the vertex colours: every vertex remembers which of the four base colours it was built with.
  const BASE = [TEAL, MAG, WHITE, BAG].map((h) => new THREE.Color(h)), KEYS = ['jacket', 'trim', 'light', 'bag'];
  const skins = [];
  root.traverse((m) => {
    if (!m.isMesh) return;
    const a = m.geometry.attributes.color, role = new Int8Array(a.count).fill(-1);
    for (let i = 0; i < a.count; i++) BASE.forEach((b, k) => { if (Math.abs(a.getX(i) - b.r) + Math.abs(a.getY(i) - b.g) + Math.abs(a.getZ(i) - b.b) < 0.01) role[i] = k; });
    skins.push({ a, role });
  });
  const c = new THREE.Color();
  const setOutfit = (o) => {
    for (const { a, role } of skins) {
      for (let i = 0; i < a.count; i++) if (role[i] >= 0) { c.set(o[KEYS[role[i]]]); a.setXYZ(i, c.r, c.g, c.b); }
      a.needsUpdate = true;
    }
  };
  return { root, body, head, armL, armR, legL, legR, setOutfit };
}

export function createPlayer(scene, L) {
  const model = buildModel();
  scene.add(model.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  shadow.renderOrder = 1;
  scene.add(shadow);

  const P = {
    pos: new THREE.Vector3(-10, 0, 67), vel: new THREE.Vector3(), vy: 0, yaw: PI / 2,
    onGround: true, hidden: false, lowGravity: false, phase: 0, speed: 0, lean: 0, model, floor: 0, shadow,
    setHidden(h) { P.hidden = h; model.root.visible = !h; shadow.visible = !h; },
    update(dt, inp, camYaw, vehicles, audio) {
      if (P.hidden) return;
      // camera-relative movement with a bit of glide: you're on skates
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      let dx = fx * inp.move - fz * inp.strafe, dz = fz * inp.move + fx * inp.strafe;
      const len = Math.hypot(dx, dz), top = inp.sprint ? 13.5 : 7.5;
      if (len > 0) { dx = dx / len * top; dz = dz / len * top; }
      const rate = P.onGround ? (len > 0 ? 5 : 1.7) : 1;
      P.vel.x = damp(P.vel.x, dx, rate, dt); P.vel.z = damp(P.vel.z, dz, rate, dt);
      if (inp.jump && P.onGround) { P.vy = 8.4; P.onGround = false; audio.jump(); }
      P.vy -= (P.lowGravity ? 4.2 : 23) * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= 0) { if (!P.onGround && P.vy < -4) audio.step(1); P.pos.y = 0; P.vy = 0; P.onGround = true; } else P.onGround = false;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;

      for (const b of L.solids) {
        if (P.pos.y > b.h) continue;
        const n = pushOut(P.pos, 0.45, b);
        if (n) { const vn = P.vel.x * n.nx + P.vel.z * n.nz; if (vn < 0) { P.vel.x -= vn * n.nx; P.vel.z -= vn * n.nz; } }
      }
      L.props.collide(P.pos, 0.42, P.pos.y, P.vel);
      for (const v of vehicles.all()) {
        if (Math.abs(v.y - P.pos.y) > 1.6) continue;
        const ddx = P.pos.x - v.x, ddz = P.pos.z - v.z, rr = v.radius * 0.8 + 0.4, d = Math.hypot(ddx, ddz);
        if (d < rr && d > 1e-4) { P.pos.x += ddx / d * (rr - d); P.pos.z += ddz / d * (rr - d); }
      }
      clampToWorld(P.pos, 0.6);

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
      } else {
        m.legL.rotation.set(-0.5, 0, 0.1); m.legR.rotation.set(0.35, 0, -0.1);
        m.armL.rotation.set(-0.4, 0, 0.9); m.armR.rotation.set(-0.4, 0, -0.9);
        m.body.rotation.set(0.08, 0, -P.lean); m.body.position.y = 0;
      }
      m.head.rotation.set(-0.15 * k, 0, 0); m.body.position.x = m.body.position.z = 0;
      m.root.position.copy(P.pos); m.root.rotation.set(0, P.yaw, 0);
      shadow.position.set(P.pos.x, P.floor + 0.03, P.pos.z);
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
      m.legL.rotation.set(-1.25, 0, 0.28); m.legR.rotation.set(-1.25, 0, -0.28);
      m.armL.rotation.set(-1.6, 0, -0.12); m.armR.rotation.set(-1.6, 0, 0.12);
      m.head.rotation.x = -0.35;
      shadow.visible = false;
    },
  };
  return P;
}
