// Cars (one InstancedMesh for the whole fleet), the tank, the helicopter and tank shells.
import * as THREE from 'three';
import { clamp, damp, angleDelta, pushOut, PI, reducedMotion, nightU, wetU } from '../core/util.js';
import { clampToWorld, SEA_R } from '../world/layout.js';
import { carGeometry, carGlassGeometry, patrolKitGeometry, tankGeometry, heliGeometry, bikeGeometry } from './models.js';
import { createGlow } from '../world/glow.js';

const CAP = 54, POLICE = 4, BIKES = 8;
const BIKE_PAINT = ['#ff3f6a', '#27d8cf', '#ffd447', '#f6f1e7', '#9b7bff', '#ff8a3d'];
export const PATROL_TEAL = '#19b8b0';
// A car steered by the traffic AI along its lane (not by physics).
export const onRails = (c) => !!c.ai && !(c.ai.stun > 0) && !c.ai.pursuit;
const PAINT = ['#ffb3d1', '#9fe8dc', '#fff0a8', '#b9d4ff', '#ffc39a', '#d6bcff', '#f6f1e7', '#ff8fb0', '#7fe0ff'];
const HOT_PINK = '#ff1f9c';

// Collision shapes: a row of circles along the body, [offset along the heading, radius]. The car's
// front circle reaches the bumper, so the bonnet no longer slides into lamp posts and walls.
const SHAPES = {
  car: [[1.3, 1.0], [0, 1.0], [-1.3, 1.0]],
  bike: [[0.62, 0.45], [-0.72, 0.45]],
  tank: [[1.25, 2.1], [0, 2.1], [-1.25, 2.1]],
  heli: [[0.4, 1.6], [-3.6, 0.6]],
};
const REACH = { car: 2.3, bike: 1.17, tank: 3.35, heli: 4.2 };
export function circlesOf(v, out = []) {
  const sh = SHAPES[v.kind] || SHAPES.car, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  for (let i = 0; i < sh.length; i++) { const o = out[i] || (out[i] = [0, 0, 0]); o[0] = v.x + fx * sh[i][0]; o[1] = v.z + fz * sh[i][0]; o[2] = sh[i][1]; }
  out.length = sh.length;
  return out;
}
// distance from a point to the vehicle's body (negative inside it)
const _cs = [];
export function bodyDist(v, x, z) {
  let best = 1e9;
  for (const c of circlesOf(v, _cs)) best = Math.min(best, Math.hypot(x - c[0], z - c[1]) - c[2]);
  return best;
}

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
  const bikeMesh = new THREE.InstancedMesh(bikeGeometry(), carMat, BIKES);
  bikeMesh.frustumCulled = false; bikeMesh.count = 0;
  scene.add(bikeMesh);
  let nBikes = 0;
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
    if (c.kind === 'bike') {
      if (nBikes >= BIKES) return null;
      Object.assign(c, { label: 'Comet', radius: 0.95, mass: 0.45, bi: nBikes++ });
      bikeMesh.count = nBikes;
    }
    cars.push(c);
    tintOf(c);
    return c;
  }
  function tintOf(c) {
    const m = c.kind === 'bike' ? bikeMesh : carMesh;
    m.setColorAt(c.kind === 'bike' ? c.bi : c.idx, col.set(neon ? HOT_PINK : c.color));
    m.instanceColor.needsUpdate = true;
  }
  L.parking.forEach((p, i) => addCar(p.x, p.z, p.yaw, PAINT[i % PAINT.length]));
  L.bikes.forEach((p, i) => addCar(p.x, p.z, p.yaw, BIKE_PAINT[i % BIKE_PAINT.length], { kind: 'bike', home: p.home, hx: p.x, hz: p.z, hyaw: p.yaw }));
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

  // Push every body circle out of the buildings and the street furniture, moving the whole vehicle.
  const tp = { x: 0, z: 0 };
  function hitSolids(o, bounce) {
    let hit = false;
    const heli = o.kind === 'heli', sh = SHAPES[o.kind] || SHAPES.car;
    for (const [off, r] of sh) {
      const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw);
      tp.x = o.x + fx * off; tp.z = o.z + fz * off;
      const x0 = tp.x, z0 = tp.z;
      for (const b of solids) {
        if (o.y > b.h) continue;
        const n = pushOut(tp, r, b);
        if (!n) continue;
        hit = true;
        const vn = o.vx * n.nx + o.vz * n.nz;
        if (vn < 0) { o.vx -= (1 + bounce) * vn * n.nx; o.vz -= (1 + bounce) * vn * n.nz; }
      }
      // street furniture: lamps, palms, hydrants... a car stops dead against a pole (a soft bounce, a thud,
      // never any heat) unless it is going fast enough to flatten it (see world/loose.js); the helicopter
      // only minds the tall things, and only when low
      if (!heli || o.y < 8) {
        const k = L.props.collide(tp, r, o.y, o, heli ? 0.1 : 0.2, heli ? 3 : 0, o);
        if (k > 0) { hit = true; if (k > 4 && (o.driven || !o.ai)) audio.thud(clamp(k / 25, 0.15, 0.8)); }
      }
      o.x += tp.x - x0; o.z += tp.z - z0;
    }
    return hit;
  }
  // keep every circle inside the world (seawall, beach, pier, causeway)
  function clampShape(c) {
    let hit = false;
    for (const [off, r] of SHAPES[c.kind] || SHAPES.car) {
      tp.x = c.x + Math.sin(c.yaw) * off; tp.z = c.z + Math.cos(c.yaw) * off;
      const x0 = tp.x, z0 = tp.z;
      if (clampToWorld(tp, Math.min(r, 1))) {
        hit = true;
        if (tp.x !== x0) c.vx *= -0.3;
        if (tp.z !== z0) c.vz *= -0.3;
        c.x += tp.x - x0; c.z += tp.z - z0;
      }
    }
    return hit;
  }

  function updateCar(c, dt, user) {
    if (c.off || onRails(c)) return;
    const inp = c.driven ? user : c.ai && c.ai.pursuit && !(c.ai.stun > 0) ? c.ai.inp : null;
    const B = c.kind === 'bike';
    if (inp && c.y < 0.3) {
      let fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let vf = c.vx * fx_ + c.vz * fz;
      const sf = clamp(Math.abs(vf) / 6, 0, 1) * (vf >= 0 ? 1 : -1);
      c.yaw += inp.steer * sf * ((B ? 3 : 2.5) / (1 + Math.abs(vf) * 0.03)) * (inp.hand ? 1.4 : 1) * dt;
      fx_ = Math.sin(c.yaw); fz = Math.cos(c.yaw);
      const rx = -fz, rz = fx_;
      vf = c.vx * fx_ + c.vz * fz;
      let vl = c.vx * rx + c.vz * rz;
      if (inp.throttle > 0) vf += (B ? 38 : 26) * (1 - clamp(vf / (B ? 58 : 44), 0, 1)) * dt;
      else if (inp.throttle < 0) { vf -= (vf > 0.5 ? 40 : 14) * dt; if (vf < -14) vf = -14; }
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.5 * dt);
      vf *= Math.exp(-(inp.hand ? 1.3 : 0.3) * dt);
      // lateral grip: lose it under handbrake or once already sliding => drift
      const grip = B ? 9 : inp.hand ? 1.1 : Math.abs(vl) > 7 ? 3 : 7.5;
      vl *= Math.exp(-grip * dt);
      c.vx = fx_ * vf + rx * vl; c.vz = fz * vf + rz * vl;
      c.slip = Math.abs(vl);
      if (B) {
        // lean into the turn; the front wheel comes up when you open the throttle from low speed
        c.tz = damp(c.tz, -inp.steer * clamp(Math.abs(vf) / 20, 0, 1) * 0.6, 7, dt);
        c.tx = damp(c.tx, inp.throttle > 0 && vf > 2.5 && vf < 26 && !reducedMotion ? -0.5 : 0, inp.throttle > 0 ? 4 : 9, dt);
      } else {
        c.tz = damp(c.tz, clamp(vl * 0.012, -0.12, 0.12), 8, dt);
        c.tx = damp(c.tx, 0, 8, dt);
      }
    } else {
      const k = Math.exp(-(c.y > 0.05 ? 0.2 : 2.4) * dt);
      c.vx *= k; c.vz *= k; c.yaw += c.spin * dt; c.spin *= Math.exp(-2.2 * dt); c.slip = 0;
      if (c.y <= 0 && c.vy <= 0) { c.tx = damp(c.tx, 0, 6, dt); c.tz = damp(c.tz, B && !c.ai ? 0.2 : 0, 6, dt); }   // parked bikes rest on the stand
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
    const sp0 = Math.hypot(c.vx, c.vz);
    hitSolids(c, 0.35);
    if (B && c.driven && sp0 - Math.hypot(c.vx, c.vz) > 11 && api.onThrow) api.onThrow(c, sp0);
    clampShape(c);
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
    if (hitSolids(t, 0)) t.speed *= Math.exp(-4 * dt);
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
    hitSolids(h, 0.1);
    // soft boundary out at sea: past SEA_R the fuel warning turns the nose for home and a growing
    // push brings it back; there is no wall, just a firmer hand the further out you go
    const rr = Math.hypot(h.x, h.z);
    h.turnBack = rr > SEA_R;
    if (h.turnBack) {
      const nx = h.x / rr, nz = h.z / rr, over = rr - SEA_R, vout = h.vx * nx + h.vz * nz;
      if (vout > 0) { const k = Math.min(1, dt * (0.8 + over * 0.04)); h.vx -= nx * vout * k; h.vz -= nz * vout * k; }
      h.vx -= nx * Math.min(over, 60) * 0.25 * dt; h.vz -= nz * Math.min(over, 60) * 0.25 * dt;
      if (h.driven && h.y > 0.25) h.yaw += angleDelta(h.yaw, Math.atan2(-nx, -nz)) * (1 - Math.exp(-dt * clamp(over / 30, 0.3, 2)));
      if (rr > SEA_R + 90) { h.x = nx * (SEA_R + 90); h.z = nz * (SEA_R + 90); }
    }
    const vf = h.vx * fx_ + h.vz * fz, air = clamp(h.y / 2, 0, 1);
    h.pitchVis = damp(h.pitchVis, clamp(vf * 0.016, -0.35, 0.35) * air, 4, dt);
    h.rollVis = damp(h.rollVis, (h.driven ? -inp.steer * 0.22 : 0) * air, 4, dt);
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.set(h.pitchVis, h.yaw, h.rollVis, 'YXZ');
    h.rotor.rotation.y = h.rotA; h.tail.rotation.x = h.rotA * 1.7;
  }

  const CA = [], CB = [];
  function collidePairs(all) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.y > 2.5) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.y > 2.5) continue;
        const ra = onRails(a), rb = onRails(b);
        if (ra && rb) continue;
        const reach = (REACH[a.kind] || 2.3) + (REACH[b.kind] || 2.3);
        if ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 >= reach * reach) continue;
        // deepest overlap between any circle of a and any circle of b
        const slack = ra || rb ? 0.55 : 0;
        let ov = 0, nx = 0, nz = 0;
        for (const p of circlesOf(a, CA)) for (const q2 of circlesOf(b, CB)) {
          const dx = q2[0] - p[0], dz = q2[1] - p[1], d = Math.hypot(dx, dz), o = p[2] + q2[2] - slack - d;
          if (o > ov && d > 1e-4) { ov = o; nx = dx / d; nz = dz / d; }
        }
        if (ov <= 0) continue;
        const wa = b.mass / (a.mass + b.mass);
        a.x -= nx * ov * wa; a.z -= nz * ov * wa; b.x += nx * ov * (1 - wa); b.z += nz * ov * (1 - wa);
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const imp = -1.35 * rel / (1 / a.mass + 1 / b.mass);
          if (a.kind !== 'tank') { a.vx -= imp / a.mass * nx; a.vz -= imp / a.mass * nz; }
          if (b.kind !== 'tank') { b.vx += imp / b.mass * nx; b.vz += imp / b.mass * nz; }
          if (!a.driven && a.kind !== 'tank') a.spin += (Math.random() - 0.5) * imp * 0.25;
          if (!b.driven && b.kind !== 'tank') b.spin += (Math.random() - 0.5) * imp * 0.25;
          if (imp > 6) audio.thud(clamp(imp / 30, 0.2, 1));
          if (imp > 3.5) { if (a.ai) a.ai.stun = Math.max(a.ai.stun || 0, 2.2); if (b.ai) b.ai.stun = Math.max(b.ai.stun || 0, 2.2); }
          if (api.onCollide) api.onCollide(a, b, imp);
          const rider = a.driven ? a : b.driven ? b : null;
          if (rider && rider.kind === 'bike' && -rel > 13 && api.onThrow) api.onThrow(rider, -rel);
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
    cars, glowU, addCar, PAINTS, BIKE_PAINT, onCollide: null, onBoom: null, onShot: null, onThrow: null, circlesOf, bodyDist,
    paint(c, color) { c.color = color; tintOf(c); },
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
      for (const c of cars) tintOf(c);
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
          if (c.kind === 'bike') bikeMesh.setMatrixAt(c.bi, m4);
          for (let k = 0; k < 5; k++) glow.hide(g + k);
          if (c.police) { kit.setMatrixAt(nk, m4); glow.hide(G_BAR + nk * 2); glow.hide(G_BAR + nk * 2 + 1); nk++; }
          continue;
        }
        e.set(c.tx, c.yaw, c.tz);
        const fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw), y = c.y + 0.9;
        if (c.kind === 'bike') {
          // pivot the wheelie on the rear axle
          const up = Math.sin(-Math.min(c.tx, 0));
          m4.compose(p3.set(c.x - fx_ * up * 0.3, c.y + up * 0.72, c.z - fz * up * 0.3), q.setFromEuler(e), s3);
          bikeMesh.setMatrixAt(c.bi, m4);
          m4.makeScale(0, 0, 0); carMesh.setMatrixAt(c.idx, m4);
          q.setFromEuler(e.set(0, c.yaw, 0));
          m4.compose(p3.set(c.x, 0.03, c.z), q, s3.set(0.3, 1, 0.42)); shadows.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
          const lit = c.driven || !!c.ai;
          if (lit && c.y < 0.5) m4.compose(p3.set(c.x, 0, c.z), q, s3.set(0.6, 1, 0.8)); else m4.makeScale(0, 0, 0);
          pools.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
          const brk = c.driven ? inp.throttle < 0 : !!c.ai && c.ai.braking;
          glow.set(g, c.x - fx_ * 1.3, y + 0.16, c.z - fz * 1.3, '#ff1830', brk ? 2.4 : lit ? 1.5 : 0.9, brk ? 1 : lit ? 0.3 : 0);
          glow.set(g + 2, c.x + fx_ * 0.95, y, c.z + fz * 0.95, '#fff0c0', lit ? 2.4 : 0, 0.12);
          glow.hide(g + 1); glow.hide(g + 3);
          if (neon) glow.set(g + 4, c.x, c.y + 0.5, c.z, HOT_PINK, 5, 0.35); else glow.hide(g + 4);
          continue;
        }
        m4.compose(p3.set(c.x, c.y, c.z), q.setFromEuler(e), s3);
        carMesh.setMatrixAt(c.idx, m4);
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
      kit.count = nk; kit.instanceMatrix.needsUpdate = true; bikeMesh.instanceMatrix.needsUpdate = true; pools.instanceMatrix.needsUpdate = true;
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
