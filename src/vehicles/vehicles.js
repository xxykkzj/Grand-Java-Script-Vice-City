// Cars (one InstancedMesh for the whole fleet), the tank, the helicopter and tank shells.
import * as THREE from 'three';
import { clamp, damp, angleDelta, pushOut, PI, reducedMotion, nightU, wetU } from '../core/util.js';
import { clampToWorld } from '../world/layout.js';
import { carGeometry, carGlassGeometry, patrolKitGeometry, tankGeometry, heliGeometry } from './models.js';
import { createGlow } from '../world/glow.js';

const CAP = 54, POLICE = 4;
export const PATROL_TEAL = '#19b8b0';
// A car steered by the traffic AI along its lane (not by physics).
export const onRails = (c) => !!c.ai && !(c.ai.stun > 0) && !c.ai.pursuit;
const PAINT = ['#ffb3d1', '#9fe8dc', '#fff0a8', '#b9d4ff', '#ffc39a', '#d6bcff', '#f6f1e7', '#ff8fb0', '#7fe0ff'];
const HOT_PINK = '#ff1f9c';

export function createVehicles(scene, L, fx, audio) {
  const solids = L.solids;
  const glowU = { value: 0 };
  const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  carMat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glowU;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  const carMesh = new THREE.InstancedMesh(carGeometry(), carMat, CAP);
  carMesh.frustumCulled = false;
  scene.add(carMesh);
  const glass = new THREE.InstancedMesh(carGlassGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }), CAP);
  glass.instanceMatrix = carMesh.instanceMatrix;
  glass.frustumCulled = false; glass.renderOrder = 3;
  scene.add(glass);
  const kit = new THREE.InstancedMesh(patrolKitGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), POLICE);
  kit.frustumCulled = false;
  scene.add(kit);
  // headlight pools on the road: one additive instanced quad per car, faded in by the night uniform
  const poolGeo = new THREE.PlaneGeometry(5.5, 10); poolGeo.rotateX(-PI / 2); poolGeo.translate(0, 0.06, 7.2);
  const pools = new THREE.InstancedMesh(poolGeo, new THREE.ShaderMaterial({
    uniforms: { uNight: nightU, uWet: wetU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uNight, uWet; varying vec2 vUv;
      void main(){
        float far = 1.0 - vUv.y, w = abs(vUv.x - 0.5) * 2.0;
        float a = pow(1.0 - far, 1.4) * smoothstep(1.0, 0.15, w / (0.3 + far * 0.7)) * smoothstep(0.0, 0.06, far);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.72) * a * uNight * (0.34 + uWet * 0.3), 1.0);
      }`,
  }), CAP);
  pools.frustumCulled = false; pools.renderOrder = 2;
  scene.add(pools);
  const shGeo = new THREE.PlaneGeometry(2.7, 5.2); shGeo.rotateX(-PI / 2);
  const shadows = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), CAP);
  shadows.frustumCulled = false; shadows.renderOrder = 1;
  scene.add(shadows);

  // 5 sprites per car, then tank (2), heli (2), shells (4)
  const glow = createGlow(scene, CAP * 5 + 8 + POLICE * 2);
  const G_TANK = CAP * 5, G_HELI = G_TANK + 2, G_SHELL = G_HELI + 2, G_BAR = G_SHELL + 4;

  const partMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cars = [];
  const col = new THREE.Color();
  let neon = false;

  function addCar(x, z, yaw, color, extra) {
    if (cars.length >= CAP) return null;
    const c = {
      kind: 'car', label: 'car', x, y: 0, z, yaw, vx: 0, vy: 0, vz: 0, spin: 0, tx: 0, tz: 0, tvx: 0, tvz: 0,
      radius: 1.5, mass: 1, driven: false, color, slip: 0, idx: cars.length,
    };
    Object.assign(c, extra);
    cars.push(c);
    carMesh.setColorAt(c.idx, col.set(neon ? HOT_PINK : color));
    carMesh.instanceColor.needsUpdate = true;
    return c;
  }
  L.parking.forEach((p, i) => addCar(p.x, p.z, p.yaw, PAINT[i % PAINT.length]));
  const PAINTS = PAINT;

  let tank = null, heli = null;
  const shells = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffe9a0' }));
    m.visible = false; scene.add(m);
    shells.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, mesh: m });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);

  function hitSolids(o, r, bounce) {
    let hit = false;
    for (const b of solids) {
      if (o.y > b.h) continue;
      const n = pushOut(o, r, b);
      if (!n) continue;
      hit = true;
      const vn = o.vx * n.nx + o.vz * n.nz;
      if (vn < 0) { o.vx -= (1 + bounce) * vn * n.nx; o.vz -= (1 + bounce) * vn * n.nz; }
    }
    return hit;
  }

  function updateCar(c, dt, user) {
    if (c.off || onRails(c)) return;
    const inp = c.driven ? user : c.ai && c.ai.pursuit && !(c.ai.stun > 0) ? c.ai.inp : null;
    if (inp && c.y < 0.3) {
      let fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let vf = c.vx * fx_ + c.vz * fz;
      const sf = clamp(Math.abs(vf) / 6, 0, 1) * (vf >= 0 ? 1 : -1);
      c.yaw += inp.steer * sf * (2.5 / (1 + Math.abs(vf) * 0.03)) * (inp.hand ? 1.4 : 1) * dt;
      fx_ = Math.sin(c.yaw); fz = Math.cos(c.yaw);
      const rx = -fz, rz = fx_;
      vf = c.vx * fx_ + c.vz * fz;
      let vl = c.vx * rx + c.vz * rz;
      if (inp.throttle > 0) vf += 26 * (1 - clamp(vf / 44, 0, 1)) * dt;
      else if (inp.throttle < 0) { vf -= (vf > 0.5 ? 40 : 14) * dt; if (vf < -14) vf = -14; }
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.5 * dt);
      vf *= Math.exp(-(inp.hand ? 1.3 : 0.3) * dt);
      // lateral grip: lose it under handbrake or once already sliding => drift
      const grip = inp.hand ? 1.1 : Math.abs(vl) > 7 ? 3 : 7.5;
      vl *= Math.exp(-grip * dt);
      c.vx = fx_ * vf + rx * vl; c.vz = fz * vf + rz * vl;
      c.slip = Math.abs(vl);
      c.tz = damp(c.tz, clamp(vl * 0.012, -0.12, 0.12), 8, dt);
      c.tx = damp(c.tx, 0, 8, dt);
    } else {
      const k = Math.exp(-(c.y > 0.05 ? 0.2 : 2.4) * dt);
      c.vx *= k; c.vz *= k; c.yaw += c.spin * dt; c.spin *= Math.exp(-2.2 * dt); c.slip = 0;
      if (c.y <= 0 && c.vy <= 0) { c.tx = damp(c.tx, 0, 6, dt); c.tz = damp(c.tz, 0, 6, dt); }
    }
    if (c.y > 0 || c.vy > 0) {
      c.vy -= 22 * dt; c.y += c.vy * dt; c.tx += c.tvx * dt; c.tz += c.tvz * dt;
      if (c.y <= 0) {
        c.y = 0; c.tvx = c.tvz = 0;
        c.tx = angleDelta(0, c.tx); c.tz = angleDelta(0, c.tz);
        c.vy = c.vy < -7 ? -c.vy * 0.3 : 0;
      }
    }
    c.x += c.vx * dt; c.z += c.vz * dt;
    hitSolids(c, c.radius, 0.35);
    const px = c.x, pz = c.z;
    if (clampToWorld(c, 1.6)) { if (c.x !== px) c.vx *= -0.3; if (c.z !== pz) c.vz *= -0.3; }
  }

  function updateTank(t, dt, inp, camYaw, camPitch) {
    if (t.driven) {
      t.speed += inp.throttle * (inp.throttle > 0 ? 10 : 7) * dt;
      t.speed = clamp(t.speed * Math.exp(-1.0 * dt), -6, 13);
      t.yaw += inp.steer * 1.25 * dt * (t.speed < -0.5 ? -1 : 1);
      t.turretYaw += angleDelta(t.turretYaw, camYaw - t.yaw) * (1 - Math.exp(-7 * dt));
      t.elev = damp(t.elev, clamp(0.2 - camPitch * 0.35, 0.02, 0.3), 6, dt);
    } else t.speed *= Math.exp(-3 * dt);
    t.vx = Math.sin(t.yaw) * t.speed; t.vz = Math.cos(t.yaw) * t.speed;
    t.x += t.vx * dt; t.z += t.vz * dt;
    if (hitSolids(t, t.radius, 0)) t.speed *= Math.exp(-4 * dt);
    clampToWorld(t, 2.8);
    t.cool -= dt; t.recoil = damp(t.recoil, 0, 9, dt);
    t.group.position.set(t.x, 0, t.z); t.group.rotation.y = t.yaw;
    t.turret.rotation.y = t.turretYaw; t.barrel.rotation.x = -t.elev; t.barrel.position.z = 1.2 - t.recoil;
  }

  function updateHeli(h, dt, inp) {
    h.spool = damp(h.spool, h.driven ? 1 : 0, h.driven ? 1.4 : 0.5, dt);
    h.rotA += h.spool * 30 * dt;
    const fx_ = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    if (h.driven && h.spool > 0.6) {
      h.vy += ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * 18 * dt;
      h.vy *= Math.exp(-1.7 * dt);
      if (h.y > 0.25) {
        h.yaw += inp.steer * 1.6 * dt;
        h.vx += fx_ * inp.throttle * 22 * dt; h.vz += fz * inp.throttle * 22 * dt;
      }
      const k = Math.exp(-0.75 * dt); h.vx *= k; h.vz *= k;
    } else { h.vy -= 9 * dt; const k = Math.exp(-1 * dt); h.vx *= k; h.vz *= k; }
    h.y += h.vy * dt;
    if (h.y <= 0) { h.y = 0; if (h.vy < 0) h.vy = 0; const k = Math.exp(-6 * dt); h.vx *= k; h.vz *= k; }
    if (h.y > 110) { h.y = 110; h.vy = Math.min(h.vy, 0); }
    h.x += h.vx * dt; h.z += h.vz * dt;
    hitSolids(h, h.radius, 0.1);
    h.x = clamp(h.x, -430, 430); h.z = clamp(h.z, -300, 380);
    const vf = h.vx * fx_ + h.vz * fz, air = clamp(h.y / 2, 0, 1);
    h.pitchVis = damp(h.pitchVis, clamp(vf * 0.016, -0.35, 0.35) * air, 4, dt);
    h.rollVis = damp(h.rollVis, (h.driven ? -inp.steer * 0.22 : 0) * air, 4, dt);
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.set(h.pitchVis, h.yaw, h.rollVis, 'YXZ');
    h.rotor.rotation.y = h.rotA; h.tail.rotation.x = h.rotA * 1.7;
  }

  function collidePairs(all) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.y > 2.5) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.y > 2.5) continue;
        const ra = onRails(a), rb = onRails(b);
        if (ra && rb) continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = a.radius + b.radius - (ra || rb ? 0.55 : 0);
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = rr - d;
        const wa = b.mass / (a.mass + b.mass);
        a.x -= nx * ov * wa; a.z -= nz * ov * wa; b.x += nx * ov * (1 - wa); b.z += nz * ov * (1 - wa);
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const imp = -1.35 * rel / (1 / a.mass + 1 / b.mass);
          if (a.kind !== 'tank') { a.vx -= imp / a.mass * nx; a.vz -= imp / a.mass * nz; }
          if (b.kind !== 'tank') { b.vx += imp / b.mass * nx; b.vz += imp / b.mass * nz; }
          if (!a.driven && a.kind === 'car') a.spin += (Math.random() - 0.5) * imp * 0.25;
          if (!b.driven && b.kind === 'car') b.spin += (Math.random() - 0.5) * imp * 0.25;
          if (imp > 6) audio.thud(clamp(imp / 30, 0.2, 1));
          if (imp > 3.5) { if (a.ai) a.ai.stun = Math.max(a.ai.stun || 0, 2.2); if (b.ai) b.ai.stun = Math.max(b.ai.stun || 0, 2.2); }
          if (api.onCollide) api.onCollide(a, b, imp);
        }
      }
    }
  }

  function boom(x, y, z, player) {
    fx.explode(x, y, z);
    audio.boom();
    if (api.onBoom) api.onBoom(x, y, z);
    for (const c of cars) {
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
      if (d > 13 || c.off) continue;
      if (c.ai) c.ai.stun = 4;
      const k = 1 - d / 13, inv = 1 / Math.max(d, 0.5);
      c.vx += dx * inv * k * 26; c.vz += dz * inv * k * 26; c.vy += 4 + k * 10;
      c.spin += (Math.random() - 0.5) * 10 * k;
      c.tvx = (Math.random() - 0.5) * 9 * k; c.tvz = (Math.random() - 0.5) * 9 * k;
    }
    if (player && !player.hidden) {
      const dx = player.pos.x - x, dz = player.pos.z - z, d = Math.hypot(dx, dz);
      if (d < 10) { const k = (1 - d / 10) / Math.max(d, 0.5); player.vel.x += dx * k * 18; player.vel.z += dz * k * 18; player.vy = 7; player.pos.y += 0.05; }
    }
  }

  const api = {
    cars, glowU, addCar, PAINTS, onCollide: null, onBoom: null, onShot: null,
    paint(c, color) { c.color = color; carMesh.setColorAt(c.idx, col.set(neon ? HOT_PINK : color)); carMesh.instanceColor.needsUpdate = true; },
    get tank() { return tank; }, get heli() { return heli; },
    all() { const a = cars.filter((c) => !c.off); if (tank) a.push(tank); if (heli) a.push(heli); return a; },
    nearest(pos, reach = 2.4) {
      let best = null, bd = 1e9;
      for (const v of api.all()) {
        if (Math.abs(v.y - pos.y) > 2.5) continue;
        const d = Math.hypot(v.x - pos.x, v.z - pos.z) - v.radius;
        if (d < reach && d < bd) { bd = d; best = v; }
      }
      return best;
    },
    spawnTank(x, z, yaw) {
      if (!tank) {
        const g = tankGeometry();
        const group = new THREE.Group(), turret = new THREE.Group();
        group.add(new THREE.Mesh(g.hull, partMat));
        turret.position.set(0, 1.72, -0.2);
        turret.add(new THREE.Mesh(g.turret, partMat));
        const barrel = new THREE.Mesh(g.barrel, partMat);
        barrel.position.set(0, 0.42, 1.2);
        turret.add(barrel); group.add(turret); scene.add(group);
        tank = { kind: 'tank', label: 'tank', group, turret, barrel, x, y: 0, z, yaw, vx: 0, vz: 0, vy: 0, speed: 0, radius: 3.0, mass: 14, driven: false, turretYaw: 0, elev: 0.1, cool: 0, recoil: 0 };
      }
      Object.assign(tank, { x, z, yaw, speed: 0 });
      return tank;
    },
    spawnHeli(x, z, yaw) {
      if (!heli) {
        const g = heliGeometry();
        const group = new THREE.Group();
        group.add(new THREE.Mesh(g.body, partMat));
        const rotor = new THREE.Mesh(g.rotor, partMat); rotor.position.set(0, 2.98, 0);
        const tail = new THREE.Mesh(g.tail, partMat); tail.position.set(0.32, 2.3, -5.3);
        group.add(rotor, tail); scene.add(group);
        heli = { kind: 'heli', label: 'helicopter', group, rotor, tail, x, y: 0, z, yaw, vx: 0, vy: 0, vz: 0, radius: 2.4, mass: 3, driven: false, spool: 0, rotA: 0, pitchVis: 0, rollVis: 0 };
      }
      Object.assign(heli, { x, z, yaw, y: 0, vx: 0, vy: 0, vz: 0 });
      return heli;
    },
    setNeon(on) {
      neon = on; glowU.value = on ? 0.85 : 0;
      for (const c of cars) carMesh.setColorAt(c.idx, col.set(on ? HOT_PINK : c.color));
      carMesh.instanceColor.needsUpdate = true;
    },
    get neon() { return neon; },
    fire() {
      if (!tank || tank.cool > 0) return false;
      const s = shells.find((k) => !k.on);
      if (!s) return false;
      const yaw = tank.yaw + tank.turretYaw, ce = Math.cos(tank.elev);
      const dx = Math.sin(yaw) * ce, dy = Math.sin(tank.elev), dz = Math.cos(yaw) * ce;
      s.on = true; s.life = 3.5;
      s.x = tank.x + Math.sin(yaw) * 1.0 + dx * 4.4; s.y = 2.15 + dy * 4.4; s.z = tank.z + Math.cos(yaw) * 1.0 + dz * 4.4;
      s.vx = dx * 85; s.vy = dy * 85; s.vz = dz * 85;
      tank.cool = 0.55; tank.recoil = 0.7; tank.speed -= 1.5;
      fx.puff(s.x, s.y, s.z, dx, dy, dz);
      if (!reducedMotion) fx.shake = Math.max(fx.shake, 0.2);
      audio.shot();
      if (api.onShot) api.onShot(tank.x, tank.z);
      return true;
    },
    update(dt, inp, cam, player) {
      for (const c of cars) updateCar(c, dt, inp);
      if (tank) updateTank(tank, dt, inp, cam.yaw, cam.pitch);
      if (heli) updateHeli(heli, dt, inp);
      collidePairs(api.all());

      // shells
      shells.forEach((s, i) => {
        if (s.on) {
          const steps = 3, h = dt / steps;
          for (let k = 0; k < steps && s.on; k++) {
            s.vy -= 12 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.life -= h;
            let hit = s.y <= 0.1 || s.life <= 0 || Math.abs(s.x) > 460 || Math.abs(s.z) > 420;
            if (!hit) for (const b of solids) if (s.y < b.h && s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1) { hit = true; break; }
            if (!hit) for (const c of cars) if (!c.driven && !c.off && Math.abs(s.y - c.y - 0.8) < 1.6 && Math.hypot(s.x - c.x, s.z - c.z) < 2.3) { hit = true; break; }
            if (!hit && heli && !heli.driven && Math.abs(s.y - heli.y - 1.5) < 2 && Math.hypot(s.x - heli.x, s.z - heli.z) < 2.6) hit = true;
            if (hit) { s.on = false; boom(s.x, Math.max(s.y, 0.2), s.z, player); }
          }
        }
        s.mesh.visible = s.on;
        if (s.on) { s.mesh.position.set(s.x, s.y, s.z); glow.set(G_SHELL + i, s.x, s.y, s.z, '#ffb45a', 3.2, 1); } else glow.hide(G_SHELL + i);
      });

      // write instance matrices + light sprites
      carMesh.count = shadows.count = cars.length;
      let nk = 0;
      const blink = reducedMotion ? 0.5 : (performance.now() / 180) % 2 < 1 ? 1 : 0;
      for (const c of cars) {
        const g = c.idx * 5;
        if (c.off) {
          m4.makeScale(0, 0, 0);
          carMesh.setMatrixAt(c.idx, m4); shadows.setMatrixAt(c.idx, m4); pools.setMatrixAt(c.idx, m4);
          for (let k = 0; k < 5; k++) glow.hide(g + k);
          if (c.police) { kit.setMatrixAt(nk, m4); glow.hide(G_BAR + nk * 2); glow.hide(G_BAR + nk * 2 + 1); nk++; }
          continue;
        }
        e.set(c.tx, c.yaw, c.tz);
        m4.compose(p3.set(c.x, c.y, c.z), q.setFromEuler(e), s3);
        carMesh.setMatrixAt(c.idx, m4);
        const fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw), y = c.y + 0.9;
        if (c.police) {
          kit.setMatrixAt(nk, m4);
          const hot = c.ai && c.ai.siren ? 1 : 0;
          glow.set(G_BAR + nk * 2, c.x - fx_ * 0.5 - fz * 0.32, c.y + 1.85, c.z - fz * 0.5 + fx_ * 0.32, '#ff2a3a', hot ? 5 * (blink || 0.15) : 1, hot);
          glow.set(G_BAR + nk * 2 + 1, c.x - fx_ * 0.5 + fz * 0.32, c.y + 1.85, c.z - fz * 0.5 - fx_ * 0.32, '#3a7aff', hot ? 5 * (1 - blink || 0.15) : 1, hot);
          nk++;
        }
        e.set(0, c.yaw, 0);
        const sk = 1 / (1 + c.y * 0.25), on = c.driven || !!c.ai;
        q.setFromEuler(e);
        m4.compose(p3.set(c.x, 0.03, c.z), q, s3.set(sk, 1, sk));
        shadows.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
        if (on && c.y < 0.5) m4.compose(p3.set(c.x, 0, c.z), q, s3); else m4.makeScale(0, 0, 0);
        pools.setMatrixAt(c.idx, m4);
        const braking = c.driven ? inp.throttle < 0 : !!c.ai && c.ai.braking;
        const ts = braking ? 2.6 : on ? 1.7 : 1.1, tb = braking ? 1 : on ? 0.3 : 0;
        glow.set(g, c.x - fx_ * 2.25 + fz * 0.62, y, c.z - fz * 2.25 - fx_ * 0.62, '#ff1830', ts, tb);
        glow.set(g + 1, c.x - fx_ * 2.25 - fz * 0.62, y, c.z - fz * 2.25 + fx_ * 0.62, '#ff1830', ts, tb);
        glow.set(g + 2, c.x + fx_ * 2.25 + fz * 0.62, y - 0.28, c.z + fz * 2.25 - fx_ * 0.62, '#fff0c0', on ? 2.6 : 0, 0.12);
        glow.set(g + 3, c.x + fx_ * 2.25 - fz * 0.62, y - 0.28, c.z + fz * 2.25 + fx_ * 0.62, '#fff0c0', on ? 2.6 : 0, 0.12);
        if (neon) glow.set(g + 4, c.x, c.y + 0.5, c.z, HOT_PINK, 9, 0.35); else glow.hide(g + 4);
      }
      glass.count = pools.count = cars.length;
      kit.count = nk; kit.instanceMatrix.needsUpdate = true; pools.instanceMatrix.needsUpdate = true;
      carMesh.instanceMatrix.needsUpdate = true; shadows.instanceMatrix.needsUpdate = true;
      if (tank) {
        const fx_ = Math.sin(tank.yaw), fz = Math.cos(tank.yaw);
        glow.set(G_TANK, tank.x - fx_ * 3.2 + fz * 1.2, 1.5, tank.z - fz * 3.2 - fx_ * 1.2, '#ff1830', 1.8, 0.5);
        glow.set(G_TANK + 1, tank.x - fx_ * 3.2 - fz * 1.2, 1.5, tank.z - fz * 3.2 + fx_ * 1.2, '#ff1830', 1.8, 0.5);
      }
      if (heli) {
        const fx_ = Math.sin(heli.yaw), fz = Math.cos(heli.yaw);
        const blink = Math.sin(performance.now() / 160) > 0.3 ? 1 : 0;
        glow.set(G_HELI, heli.x - fx_ * 5.3, heli.y + 3.1, heli.z - fz * 5.3, '#ff1830', 2.4 * blink * (reducedMotion ? 0 : 1) + (reducedMotion ? 1.6 : 0), 1);
        glow.set(G_HELI + 1, heli.x + fx_ * 2, heli.y + 1.1, heli.z + fz * 2, '#c8f4ff', heli.driven ? 3 : 0, 0.5);
      }
      glow.commit();
    },
  };
  return api;
}
