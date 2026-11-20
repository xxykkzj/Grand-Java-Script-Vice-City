// Cars (one InstancedMesh for the whole fleet), the tank, the helicopter and tank shells.
import * as THREE from 'three';
import { clamp, damp, angleDelta, pushOut, PI, reducedMotion, nightU, wetU, rng } from '../core/util.js';
import { clampToWorld, seaPull } from '../world/layout.js';
import { carGeometry, carGlassGeometry, patrolKitGeometry, tankGeometry, heliGeometry, bikeGeometry } from './models.js';
import { kitGeometry, kitPaint } from '../world/kits.js';
import { createGlow } from '../world/glow.js';
import { VTYPES, BATCHED, shapeOf, pickWeighted, PARKED_WEIGHTS, proxyGeometry } from './types.js';
import { quality } from '../core/quality.js';
import { lampPatch } from '../world/lamplight.js';

export const CAP = 110;
const POLICE = 6, BIKES = 16, HELIS = 2;
// Vehicle condition (see game/damage.js for the stages, smoke, fire and explosions)
export const MAXHP = { car: 100, bike: 60, tank: 420, heli: 140 };
export function resetDamage(v) {
  v.maxHp = (v.spec && v.spec.hp) || MAXHP[v.kind] || 100; v.hp = v.maxHp;
  Object.assign(v, { burn: 0, wreck: false, char: 0, dent: 0, perf: 1, cut: false, dead: false, landed: false, wreckT: 0, bailed: false, blame: -99, smokeT: 0, sputT: 1, stage: 0, sink: null });
}
const SOOT = new THREE.Color('#1c1517');
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
  truck: [[1.65, 1.05], [0, 1.05], [-1.65, 1.05]],
  bike: [[0.62, 0.45], [-0.72, 0.45]],
  tank: [[1.25, 2.1], [0, 2.1], [-1.25, 2.1]],
  heli: [[0.4, 1.6], [-3.6, 0.6]],
};
const REACH = { car: 2.3, truck: 2.75, bike: 1.17, tank: 3.35, heli: 4.2 };
// every vehicle type (vehicles/types.js) gets circles sized to its body; the sedan and the Comet keep theirs
for (const id in VTYPES) {
  if (id === 'sedan' || id === 'comet') { SHAPES[id] = SHAPES[VTYPES[id].kind]; REACH[id] = REACH[VTYPES[id].kind]; continue; }
  SHAPES[id] = shapeOf(VTYPES[id]); REACH[id] = Math.max(...SHAPES[id].map(([o, r]) => Math.abs(o) + r)) + 0.05;
}
export function circlesOf(v, out = []) {
  const sh = SHAPES[v.shape || v.kind] || SHAPES.car, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
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
  const solids = L.solids, surf = L.surf;
  const glowU = { value: 0 };
  const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  carMat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glowU;
    // dents: a damaged car's bonnet sags and crumples, the nose pushes in and the bumpers hang askew
    sh.vertexShader = 'attribute float aDmg;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float front = smoothstep(0.85, 2.2, position.z), top = smoothstep(0.55, 0.98, position.y);
      transformed.y -= aDmg * front * top * (0.15 + 0.07 * sin(position.x * 9.0 + position.z * 5.0));
      transformed.z -= aDmg * smoothstep(1.7, 2.3, position.z) * 0.16;
      float lowB = 1.0 - smoothstep(0.5, 0.62, position.y);
      transformed.y -= aDmg * lowB * (step(2.1, position.z) * (position.x + 1.0) * 0.07 + step(position.z, -2.1) * (1.0 - position.x) * 0.06);
      transformed.x += aDmg * lowB * step(2.1, abs(position.z)) * 0.08;`);
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uGlow;');
    lampPatch(sh);
  };
  const carGeo = carGeometry(), dentCar = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  carGeo.setAttribute('aDmg', dentCar);
  const carMesh = new THREE.InstancedMesh(carGeo, carMat, CAP);
  carMesh.frustumCulled = false;
  scene.add(carMesh);
  const glass = new THREE.InstancedMesh(carGlassGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }), CAP);
  glass.instanceMatrix = carMesh.instanceMatrix;
  glass.frustumCulled = false; glass.renderOrder = 3;
  for (let i = 0; i < CAP; i++) glass.setColorAt(i, new THREE.Color(1, 1, 1));
  scene.add(glass);
  const bikeGeo = bikeGeometry(), dentBike = new THREE.InstancedBufferAttribute(new Float32Array(BIKES), 1);
  bikeGeo.setAttribute('aDmg', dentBike);
  const bikeMesh = new THREE.InstancedMesh(bikeGeo, carMat, BIKES);
  bikeMesh.frustumCulled = false; bikeMesh.count = 0;
  scene.add(bikeMesh);
  let nBikes = 0;
  const kit = new THREE.InstancedMesh(patrolKitGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), POLICE);
  kit.frustumCulled = false;
  for (let i = 0; i < POLICE; i++) kit.setColorAt(i, new THREE.Color(1, 1, 1));
  scene.add(kit);
  // Every type but the sedan and the Comet (vehicles/types.js: Kenney Car Kit models and the original
  // convertible, muscle car, ice-cream truck, bus and scooter): one BatchedMesh, one draw call for all of
  // them. The body paint takes the instance colour (aFlag bit 1); the instance alpha darkens the whole
  // vehicle as it gets damaged (the procedural sedan dents instead)
  const kitIds = BATCHED, kitGeo = {};
  let kv = 0;
  const loGeo = {};
  for (const id of kitIds) {
    const T = VTYPES[id]; kitGeo[id] = T.geo ? T.geo() : kitGeometry(T.kit, { scale: T.s, flags: true }); kv += kitGeo[id].attributes.position.count;
    if (T.kind === 'car') { loGeo[id] = proxyGeometry(id, kitGeo[id]); kv += loGeo[id].attributes.position.count; }
  }
  const kitMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  kitMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aFlag;\n' + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      #ifdef USE_BATCHING_COLOR
        vec4 bc = getBatchingColor( getIndirectIndex( gl_DrawID ) );
        vColor.rgb = mix(color.rgb, bc.rgb, step(0.5, mod(aFlag, 2.0))) * bc.a;
      #endif`);
    lampPatch(sh);
  };
  const kitMesh = new THREE.BatchedMesh(CAP + BIKES, kv + 16, 0, kitMat);
  const kitGid = {};
  for (const id of kitIds) kitGid[id] = kitMesh.addGeometry(kitGeo[id]);
  // far away a batched car is drawn as its simple stand-in (types.js proxyGeometry): LOD_LOW / LOD_HIGH metres
  const kitLo = {};
  for (const id in loGeo) kitLo[id] = kitMesh.addGeometry(loGeo[id]);
  const LOD_LOW = 55, LOD_HIGH = 90;
  kitMesh.sortObjects = false;
  // The object-level frustum test uses BatchedMesh.boundingSphere, which three.js computes ONCE (on the
  // first render, when every instance still sat at the origin) and never refreshes when instances move.
  // With it left on, the whole batch was culled whenever that stale sphere (radius ~3 m round the world
  // origin) was off screen, so taxis, vans and trucks blinked out and back in as the camera turned
  // ("see-through" cars: only their shadow, lights and driver left). Per-instance culling below still
  // uses each vehicle's own, up-to-date sphere, so nothing is drawn off screen.
  kitMesh.frustumCulled = false;
  kitMesh.perObjectFrustumCulled = true;
  scene.add(kitMesh);
  const v4 = new THREE.Vector4();
  // headlight pools on the road: one additive instanced quad per car (traffic, kit vehicles, patrol, the
  // Comets and yours), faded in by the night uniform. The instance colour's red channel is the strength:
  // your own car throws a longer, brighter beam than the traffic. One draw call on Low and High alike.
  const poolGeo = new THREE.PlaneGeometry(6, 14); poolGeo.rotateX(-PI / 2); poolGeo.translate(0, 0.06, 9);
  const pools = new THREE.InstancedMesh(poolGeo, new THREE.ShaderMaterial({
    uniforms: { uNight: nightU, uWet: wetU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vUv; varying float vK;
      void main(){
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vK = instanceColor.r;
        #else
          vK = 1.0;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform float uNight, uWet; varying vec2 vUv; varying float vK;
      void main(){
        float far = 1.0 - vUv.y, w = abs(vUv.x - 0.5) * 2.0;
        // two lamps: a bright hot spot a few metres ahead fading into a wide, soft throw
        float a = pow(1.0 - far, 1.15) * smoothstep(1.0, 0.1, w / (0.28 + far * 0.72)) * smoothstep(0.0, 0.05, far);
        a += 0.6 * exp(-pow((far - 0.2) * 5.0, 2.0)) * smoothstep(0.75, 0.0, w);
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.7) * a * uNight * (0.5 + uWet * 0.3) * vK, 1.0);
      }`,
  }), CAP);
  for (let i = 0; i < CAP; i++) pools.setColorAt(i, new THREE.Color(1, 1, 1));
  pools.frustumCulled = false; pools.renderOrder = 2;
  scene.add(pools);
  const shGeo = new THREE.PlaneGeometry(2.7, 5.2); shGeo.rotateX(-PI / 2);
  const shadows = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), CAP);
  shadows.frustumCulled = false; shadows.renderOrder = 1;
  scene.add(shadows);

  // 5 sprites per car, then tank (2), helicopters (2 each), shells (4)
  const glow = createGlow(scene, CAP * 5 + 6 + HELIS * 2 + POLICE * 2);
  const G_TANK = CAP * 5, G_HELI = G_TANK + 2, G_SHELL = G_HELI + HELIS * 2, G_BAR = G_SHELL + 4;

  const partMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cars = [];
  const col = new THREE.Color();
  let neon = false;

  function addCar(x, z, yaw, color, extra) {
    if (cars.length >= CAP) return null;
    const c = {
      kind: 'car', label: 'car', x, y: 0, z, yaw, vx: 0, vy: 0, vz: 0, spin: 0, tx: 0, tz: 0, tvx: 0, tvz: 0,
      radius: 1.5, mass: 1, driven: false, color, slip: 0, idx: cars.length, park: { x, z, yaw }, ki: null,
    };
    Object.assign(c, extra);
    if (c.kind === 'bike') {
      if (nBikes >= BIKES) return null;
      Object.assign(c, { bi: nBikes++ });
      bikeMesh.count = nBikes;
    }
    cars.push(c);
    setType(c, c.type || (c.kind === 'bike' ? 'comet' : 'sedan'), c.color);
    return c;
  }
  // give a vehicle a type (vehicles/types.js): its body, handling, size, sound and condition. Cars only
  // become other cars and two-wheelers other two-wheelers. A batched type takes (or reuses) an instance in
  // the BatchedMesh; the sedan and the Comet hide it and draw from their own instanced meshes.
  function setType(c, id, color) {
    let T = VTYPES[id];
    if (!T || T.kind !== c.kind) { id = c.kind === 'bike' ? 'comet' : 'sedan'; T = VTYPES[id]; }
    const batched = BATCHED.includes(id);
    Object.assign(c, { type: id, spec: T, label: c.police ? 'patrol car' : T.label, shape: id, mass: T.mass, len: T.len,
      radius: c.kind === 'bike' ? 0.95 : id === 'sedan' ? 1.5 : Math.max(1.5, T.w / 2 + 0.55), model: batched ? id : null });
    if (batched) { if (c.ki === null) c.ki = kitMesh.addInstance(kitGid[id]); else kitMesh.setGeometryIdAt(c.ki, kitGid[id]); c.lod = false; }
    else if (c.ki !== null) kitMesh.setVisibleAt(c.ki, false);
    if (T.kit && !T.paint) c.color = kitPaint(T.kit);
    else if (color) c.color = color;
    resetDamage(c);
    tintOf(c);
    return c;
  }
  // paint, darkened with damage (a wreck is charred almost black); the glass smokes over too
  function tintOf(c) {
    if (c.model) {
      col.set(neon ? HOT_PINK : c.color);
      kitMesh.setColorAt(c.ki, v4.set(col.r, col.g, col.b, c.wreck ? 0.15 : 1 - Math.min(1, c.char || 0) * 0.8));
      return;
    }
    const m = c.kind === 'bike' ? bikeMesh : carMesh;
    col.set(neon ? HOT_PINK : c.color);
    if (c.char) col.lerp(SOOT, Math.min(1, c.char) * 0.9);
    m.setColorAt(c.kind === 'bike' ? c.bi : c.idx, col);
    m.instanceColor.needsUpdate = true;
    if (c.kind !== 'bike') { glass.setColorAt(c.idx, col.setScalar(c.wreck ? 0.12 : 1 - (c.char || 0) * 0.5)); glass.instanceColor.needsUpdate = true; }
  }
  // parked at the kerb: a seeded mix of the everyday types (the key's car park asks for vans, pickups and taxis)
  const pr = rng(1312), FROM_KIT = { truck: 'pickup' };
  L.parking.forEach((p, i) => addCar(p.x, p.z, p.yaw, PAINT[i % PAINT.length], { type: p.spawn ? 'sedan' : p.model ? FROM_KIT[p.model] || p.model : pickWeighted(PARKED_WEIGHTS, pr), spawnCar: !!p.spawn }));
  L.bikes.forEach((p, i) => addCar(p.x, p.z, p.yaw, BIKE_PAINT[i % BIKE_PAINT.length], { kind: 'bike', type: p.type, home: p.home, hx: p.x, hz: p.z, hyaw: p.yaw }));
  const PAINTS = PAINT;

  let tank = null;
  const helis = [];
  const heliNow = () => helis.find((h) => h.driven) || helis.find((h) => h.hi === 0) || helis[0] || null;
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
    o.impact = 0;
    const heli = o.kind === 'heli', sh = SHAPES[o.shape || o.kind] || SHAPES.car;
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
        if (vn < 0) { o.impact = Math.max(o.impact, -vn); o.vx -= (1 + bounce) * vn * n.nx; o.vz -= (1 + bounce) * vn * n.nz; }
      }
      // street furniture: lamps, palms, hydrants... a car stops dead against a pole (a soft bounce, a thud,
      // never any heat) unless it is going fast enough to flatten it (see world/loose.js); the helicopter
      // only minds the tall things, and only when low
      if (!heli || o.y - (o.floor || 0) < 8) {
        const k = L.props.collide(tp, r, o.y, o, heli ? 0.1 : 0.2, heli ? 3 : 0, o);
        if (k > 0) { hit = true; o.impact = Math.max(o.impact, k); if (k > 4 && (o.driven || !o.ai)) audio.thud(clamp(k / 25, 0.15, 0.8)); }
      }
      o.x += tp.x - x0; o.z += tp.z - z0;
    }
    return hit;
  }
  // keep every circle inside the world (seawall, beach, pier, causeway)
  function clampShape(c) {
    let hit = false;
    // out of reach of the seawall unless you hit it very hard; the pier rail gives at modest speed; the beach runs on into the sea
    // (game/sinking.js takes over once something is in the water). Traffic stays on its lanes: it never goes in.
    const sp = Math.hypot(c.vx, c.vz), wf = c.ai ? 0 : 1 | (sp > 8 ? 2 : 0) | (sp > 22 ? 4 : 0);
    for (const [off, r] of SHAPES[c.shape || c.kind] || SHAPES.car) {
      tp.x = c.x + Math.sin(c.yaw) * off; tp.z = c.z + Math.cos(c.yaw) * off;
      const x0 = tp.x, z0 = tp.z;
      if (clampToWorld(tp, Math.min(r, 1), wf)) {
        hit = true;
        if (tp.x !== x0) c.vx *= -0.3;
        if (tp.z !== z0) c.vz *= -0.3;
        c.x += tp.x - x0; c.z += tp.z - z0;
      }
    }
    return hit;
  }

  // Up and down: cars and bikes follow the ground they are on (the street, a stunt ramp, a raised deck, a
  // roof); when it falls away under them (off the top of a ramp, off a deck edge) they fly on with the
  // vertical speed the ramp gave them, and land on whatever is below. A face too tall to drive up (the
  // side of a ramp, a deck) stops them like a wall.
  function vertical(c, dt, px, pz) {
    const hs = Math.hypot(c.vx, c.vz);
    if (c.air) {
      c.vy -= 22 * dt; c.y += c.vy * dt; c.tx += c.tvx * dt; c.tz += c.tvz * dt;
      c.flipA = (c.flipA || 0) + Math.abs(c.tvz) * dt + Math.abs(c.tvx) * dt;
      if (!c.tvx && !c.tvz && !(c.kind === 'bike' && c.driven && c.tx < -0.2)) c.tx = damp(c.tx, clamp(-Math.atan2(c.vy, Math.max(hs, 5)) * 0.8, -0.7, 0.7), 4, dt);
      c.airT = (c.airT || 0) + dt; c.apex = Math.max(c.apex || 0, c.y);
      const gh = c.gy = surf.at(c.x, c.z, c.y + 0.3), sl = surf.last;
      if (c.y <= gh) {
        const impact = -c.vy, flip = Math.abs(c.flipA || 0);
        c.y = gh; c.air = false; c.surf = sl; c.tvx = c.tvz = 0;
        c.tx = angleDelta(0, c.tx); c.tz = angleDelta(0, c.tz);
        c.vy = impact > 7 && !sl && c.airT < 0.25 ? impact * 0.3 : 0;   // a hard bounce off the street after a short hop
        if (c.vy > 0) c.air = true;
        if (api.onLand) api.onLand(c, impact, sl, flip);
        // landing hard dents it a little (game/damage.js thresholds apply)
        if (api.onImpact && impact > 9) api.onImpact(c, impact * 0.6, null);
        c.airT = 0; c.apex = 0; c.flipA = 0; c.vyRamp = 0;
      }
      return;
    }
    const gh = c.gy = surf.at(c.x, c.z, c.y + 0.75), sl = surf.last, top = surf.at(c.x, c.z);
    if (top - c.y > 0.75 && top > gh) {
      // a face too tall to climb: back to where we were, bounce off
      c.x = px; c.z = pz; c.impact = Math.max(c.impact || 0, hs); c.vx *= -0.25; c.vz *= -0.25;
      if (api.onImpact && hs > 7) api.onImpact(c, hs * 0.8, null);
      return;
    }
    const dy = gh - c.y;
    if (dy < -0.12 && sl !== c.surf) {
      // the ground fell away: fly on with what the ramp gave us
      const prev = c.surf;
      c.air = true; c.vy = Math.max(0, c.vyRamp || 0); c.airT = 0; c.apex = c.y; c.flipA = 0;
      if (prev && prev.kicker && api.onTakeoff) api.onTakeoff(c, prev, hs);
      // a little twist off a kicker at speed: half the fun of the jump (never with reduced motion)
      if (prev && prev.kicker && !reducedMotion && hs > 14 && c.kind !== 'bike' && Math.abs(c.steerLast || 0) > 0.5) c.tvz = -Math.sign(c.steerLast) * 6.6;
      c.surf = null;
      return;
    }
    c.vyRamp = dt > 0 ? clamp(dy / dt, -30, 30) : 0;
    c.y = gh; c.vy = 0; c.surf = sl;
    if (sl && !sl.rect) c.tx = damp(c.tx, -Math.atan(c.vyRamp / Math.max(hs, 3)), 14, dt);
  }

  function updateCar(c, dt, user) {
    if (c.off || c.sink || onRails(c)) return;
    // a parked car at rest: nothing to integrate until something moves it
    if (!c.driven && !c.ai && !c.air && c.vx * c.vx + c.vz * c.vz < 0.0004 && !c.vy && Math.abs(c.spin) < 0.01 && Math.abs(c.tx) < 0.01 && Math.abs(c.tz - (c.kind === 'bike' ? 0.2 : 0)) < 0.01) { c.vx = c.vz = 0; c.impact = 0; return; }
    const inp = c.wreck ? null : c.driven ? user : c.ai && c.ai.pursuit && !(c.ai.stun > 0) ? c.ai.inp : null;
    const perf = c.perf || 1;
    const B = c.kind === 'bike', T = c.spec || VTYPES.sedan;
    if (!c.air && c.vy > 0.5) c.air = true;                 // thrown by a blast
    if (inp && !c.air) {
      let fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let vf = c.vx * fx_ + c.vz * fz;
      const sf = clamp(Math.abs(vf) / 6, 0, 1) * (vf >= 0 ? 1 : -1);
      c.yaw += inp.steer * sf * (T.steer / (1 + Math.abs(vf) * 0.03)) * (inp.hand ? 1.4 : 1) * dt;
      c.steerLast = inp.steer;
      fx_ = Math.sin(c.yaw); fz = Math.cos(c.yaw);
      const rx = -fz, rz = fx_;
      vf = c.vx * fx_ + c.vz * fz;
      let vl = c.vx * rx + c.vz * rz;
      if (inp.throttle > 0) { if (!c.cut) vf += T.acc * perf * (1 - clamp(vf / (T.top * (0.55 + 0.45 * perf)), 0, 1)) * dt; }
      else if (inp.throttle < 0) { vf -= (vf > 0.5 ? T.brake : 14 * Math.min(1, T.acc / 20)) * dt; if (vf < -14) vf = -14; }
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.5 * dt);
      vf *= Math.exp(-(inp.hand ? 1.3 : 0.3) * dt);
      // lateral grip: lose it under handbrake or once already sliding => drift
      const grip = B ? T.grip : inp.hand ? 1.1 : Math.abs(vl) > 7 ? T.grip * 0.4 : T.grip;
      vl *= Math.exp(-grip * dt);
      c.vx = fx_ * vf + rx * vl; c.vz = fz * vf + rz * vl;
      c.slip = Math.abs(vl);
      if (B) {
        // lean into the turn; the front wheel comes up when you open the throttle from low speed
        c.tz = damp(c.tz, -inp.steer * clamp(Math.abs(vf) / 20, 0, 1) * 0.6, 7, dt);
        c.tx = damp(c.tx, inp.throttle > 0 && vf > 2.5 && vf < 26 && !reducedMotion ? -0.5 : 0, inp.throttle > 0 ? 4 : 9, dt);
      } else {
        c.tz = damp(c.tz, clamp(vl * 0.012, -0.12, 0.12), 8, dt);
        if (!c.surf || c.surf.rect) c.tx = damp(c.tx, 0, 8, dt);
      }
    } else {
      const k = Math.exp(-(c.air ? 0.2 : 2.4) * dt);
      c.vx *= k; c.vz *= k; c.yaw += c.spin * dt; c.spin *= Math.exp(-2.2 * dt); c.slip = 0;
      if (!c.air && c.vy <= 0 && !c.surf) { c.tx = damp(c.tx, 0, 6, dt); c.tz = damp(c.tz, B && !c.ai ? 0.2 : 0, 6, dt); }   // parked bikes rest on the stand
    }
    const px = c.x, pz = c.z;
    c.x += c.vx * dt; c.z += c.vz * dt;
    vertical(c, dt, px, pz);
    const sp0 = Math.hypot(c.vx, c.vz);
    hitSolids(c, 0.35);
    if (c.impact > 0 && api.onImpact) api.onImpact(c, c.impact, null);
    if (B && c.driven && sp0 - Math.hypot(c.vx, c.vz) > 11 && api.onThrow) api.onThrow(c, sp0);
    clampShape(c);
  }

  function updateTank(t, dt, inp, camYaw, camPitch) {
    if (t.sink) { t.group.position.set(t.x, t.y, t.z); t.group.rotation.set(t.tx || 0, t.yaw, 0); return; }
    if (t.driven && !t.wreck) {
      t.speed += inp.throttle * (inp.throttle > 0 ? 10 : 7) * dt;
      t.speed = clamp(t.speed * Math.exp(-1.0 * dt), -6, 13);
      t.yaw += inp.steer * 1.25 * dt * (t.speed < -0.5 ? -1 : 1);
      t.turretYaw += angleDelta(t.turretYaw, camYaw - t.yaw) * (1 - Math.exp(-7 * dt));
      t.elev = damp(t.elev, clamp(0.2 - camPitch * 0.35, 0.02, 0.3), 6, dt);
    } else t.speed *= Math.exp(-3 * dt);
    t.vx = Math.sin(t.yaw) * t.speed; t.vz = Math.cos(t.yaw) * t.speed;
    t.x += t.vx * dt; t.z += t.vz * dt;
    if (hitSolids(t, 0)) t.speed *= Math.exp(-4 * dt);
    if (t.impact > 0 && api.onImpact) api.onImpact(t, t.impact, null);
    clampToWorld(t, 2.8, 1 | (Math.abs(t.speed) > 6 ? 2 : 0));
    t.cool -= dt; t.recoil = damp(t.recoil, 0, 9, dt);
    t.group.position.set(t.x, 0, t.z); t.group.rotation.y = t.yaw;
    t.turret.rotation.y = t.turretYaw; t.barrel.rotation.x = -t.elev; t.barrel.position.z = 1.2 - t.recoil;
  }

  function updateHeli(h, dt, inp) {
    if (h.sink) {            // sunk: rotor spins down, the helicopter settles on the seabed (game/sinking.js moves it)
      h.spool = damp(h.spool, 0, 0.8, dt); h.rotA += h.spool * 30 * dt;
      h.group.position.set(h.x, h.y, h.z); h.group.rotation.set(h.pitchVis || 0, h.yaw, h.rollVis || 0, 'YXZ');
      h.rotor.rotation.y = h.rotA; h.tail.rotation.x = h.rotA * 1.7;
      return;
    }
    const dead = h.hp <= 0 || h.wreck;
    h.spool = damp(h.spool, h.driven && !dead ? 1 : 0, h.driven && !dead ? 1.4 : dead ? 0.35 : 0.5, dt);
    h.rotA += h.spool * 30 * dt;
    const fx_ = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    if (dead && h.y > 0.2) {
      // no lift: it drops, spinning, and lands hard (game/damage.js sets it on fire)
      h.vy -= 13 * dt; h.yaw += 2.6 * dt;
      const k = Math.exp(-0.6 * dt); h.vx *= k; h.vz *= k;
    } else if (h.driven && h.spool > 0.6) {
      h.vy += ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * 18 * dt;
      h.vy *= Math.exp(-1.7 * dt);
      if (h.y - h.floor > 0.25) {
        h.yaw += inp.steer * 1.6 * dt;
        h.vx += fx_ * inp.throttle * 22 * dt; h.vz += fz * inp.throttle * 22 * dt;
      }
      const k = Math.exp(-0.75 * dt); h.vx *= k; h.vz *= k;
    } else { h.vy -= 9 * dt; const k = Math.exp(-1 * dt); h.vx *= k; h.vz *= k; }
    h.y += h.vy * dt;
    // the ground under the skids: the street, or any flat roof, helipad or deck (world/surfaces.js)
    const floor = h.floor = surf.at(h.x, h.z, h.y + 0.6);
    if (h.y <= floor) {
      if (dead && !h.landed) { h.landed = true; if (api.onCrash) api.onCrash(h, -h.vy); }
      h.y = floor; if (h.vy < 0) h.vy = 0; const k = Math.exp(-6 * dt); h.vx *= k; h.vz *= k;
    }
    if (h.y > 170) { h.y = 170; h.vy = Math.min(h.vy, 0); }
    h.x += h.vx * dt; h.z += h.vz * dt;
    hitSolids(h, 0.1);
    if (h.impact > 0 && api.onImpact) api.onImpact(h, h.impact, null);
    // soft boundary out at sea: past SEA_R the fuel warning turns the nose for home and a growing
    // push brings it back; there is no wall, just a firmer hand the further out you go
    // (measured from the line between the two islands' centres, so it hugs both)
    const sp = seaPull(h.x, h.z);
    h.turnBack = sp.over > 0;
    if (h.turnBack) {
      const nx = sp.nx, nz = sp.nz, over = sp.over, vout = h.vx * nx + h.vz * nz;
      if (vout > 0) { const k = Math.min(1, dt * (0.8 + over * 0.04)); h.vx -= nx * vout * k; h.vz -= nz * vout * k; }
      h.vx -= nx * Math.min(over, 60) * 0.25 * dt; h.vz -= nz * Math.min(over, 60) * 0.25 * dt;
      if (h.driven && h.y > 0.25) h.yaw += angleDelta(h.yaw, Math.atan2(-nx, -nz)) * (1 - Math.exp(-dt * clamp(over / 30, 0.3, 2)));
      if (over > 90) { h.x -= nx * (over - 90); h.z -= nz * (over - 90); }
    }
    const vf = h.vx * fx_ + h.vz * fz, air = clamp((h.y - h.floor) / 2, 0, 1);
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
      if (a.sink) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.sink || Math.abs(a.y - b.y) > 2.2) continue;
        const ra = onRails(a), rb = onRails(b);
        if (ra && rb) continue;
        const reach = (REACH[a.shape || a.kind] || 2.3) + (REACH[b.shape || b.kind] || 2.3);
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
          if (api.onImpact) { api.onImpact(a, imp / a.mass, b); api.onImpact(b, imp / b.mass, a); }
          const rider = a.driven ? a : b.driven ? b : null;
          if (rider && rider.kind === 'bike' && -rel > 13 && api.onThrow) api.onThrow(rider, -rel);
        }
      }
    }
  }

  function boom(x, y, z, player, direct) {
    fx.explode(x, y, z);
    audio.boom();
    if (api.onBoom) api.onBoom(x, y, z);
    if (api.onBlast) api.onBlast(x, y, z, direct);
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
    cars, glowU, addCar, PAINTS, BIKE_PAINT, onCollide: null, onBoom: null, onShot: null, onThrow: null, onImpact: null, onBlast: null, onCrash: null, circlesOf, bodyDist,
    paint(c, color) { c.color = color; tintOf(c); },
    setType, VTYPES, eye: null,            // eye: the camera position (main.js), for the far-away stand-ins
    retint(c) { if (c.kind === 'car' || c.kind === 'bike') tintOf(c); else if (c.mat) c.mat.color.setScalar(1 - Math.min(1, c.char || 0) * 0.8); },
    removeTank() { if (tank) { tank.group.visible = false; scene.remove(tank.group); tank = null; } },
    get tank() { return tank; }, get heli() { return heliNow(); }, helis,
    all() { const a = cars.filter((c) => !c.off); if (tank) a.push(tank); for (const h of helis) a.push(h); return a; },
    nearest(pos, reach = 2.4) {
      let best = null, bd = 1e9;
      for (const v of api.all()) {
        if (Math.abs(v.y - pos.y) > 2.5 || v.wreck || v.sink) continue;
        let d = Math.hypot(v.x - pos.x, v.z - pos.z) - v.radius;
        if (v.len > 5) d = Math.min(d, bodyDist(v, pos.x, pos.z) - 0.4);       // a bus or a truck: from its side, anywhere along it
        if (d < reach && d < bd) { bd = d; best = v; }
      }
      return best;
    },
    spawnTank(x, z, yaw) {
      if (!tank) {
        const g = tankGeometry(), mat = partMat.clone();
        const group = new THREE.Group(), turret = new THREE.Group();
        group.add(new THREE.Mesh(g.hull, mat));
        turret.position.set(0, 1.72, -0.2);
        turret.add(new THREE.Mesh(g.turret, mat));
        const barrel = new THREE.Mesh(g.barrel, mat);
        barrel.position.set(0, 0.42, 1.2);
        turret.add(barrel); group.add(turret); scene.add(group);
        tank = { kind: 'tank', label: 'tank', group, turret, barrel, mat, x, y: 0, z, yaw, vx: 0, vz: 0, vy: 0, speed: 0, radius: 3.0, mass: 14, driven: false, turretYaw: 0, elev: 0.1, cool: 0, recoil: 0 };
      }
      Object.assign(tank, { x, z, yaw, speed: 0 });
      if (tank.wreck || !tank.maxHp || tank.hp < tank.maxHp) { resetDamage(tank); api.retint(tank); }
      return tank;
    },
    // which: 0 is the one the ROTORWASH code and the start bring you, 1 waits on a downtown helipad; y: the roof it stands on
    spawnHeli(x, z, yaw, which = 0, y = 0) {
      let heli = helis.find((h) => h.hi === which);
      if (!heli) {
        const g = heliGeometry(), mat = partMat.clone();
        const group = new THREE.Group();
        group.add(new THREE.Mesh(g.body, mat));
        const rotor = new THREE.Mesh(g.rotor, mat); rotor.position.set(0, 2.98, 0);
        const tail = new THREE.Mesh(g.tail, mat); tail.position.set(0.32, 2.3, -5.3);
        group.add(rotor, tail); scene.add(group);
        heli = { kind: 'heli', label: 'helicopter', hi: which, group, rotor, tail, mat, x, y, z, yaw, vx: 0, vy: 0, vz: 0, radius: 2.4, mass: 3, driven: false, spool: 0, rotA: 0, pitchVis: 0, rollVis: 0, floor: y, home: { x, z, yaw, y } };
        helis.push(heli);
      }
      Object.assign(heli, { x, z, yaw, y, floor: y, vx: 0, vy: 0, vz: 0, sink: null, pitchVis: 0, rollVis: 0 });
      if (heli.wreck || !heli.maxHp || heli.hp < heli.maxHp) { resetDamage(heli); api.retint(heli); }
      heli.group.position.set(x, y, z); heli.group.rotation.set(0, yaw, 0);
      return heli;
    },
    setNeon(on) {
      neon = on; glowU.value = on ? 0.85 : 0;
      for (const c of cars) tintOf(c);
    },
    get neon() { return neon; },
    fire() {
      if (!tank || tank.cool > 0 || tank.wreck) return false;
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
      for (const h of helis) updateHeli(h, dt, inp);
      collidePairs(api.all());

      // shells
      shells.forEach((s, i) => {
        if (s.on) {
          const steps = 3, h = dt / steps;
          for (let k = 0; k < steps && s.on; k++) {
            s.vy -= 12 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.life -= h;
            let hit = s.y <= 0.1 || s.life <= 0 || seaPull(s.x, s.z).over > -200;
            if (!hit) for (const b of solids) if (s.y < b.h && s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1) { hit = true; break; }
            let direct = null;
            if (!hit) for (const c of cars) if (!c.driven && !c.off && Math.abs(s.y - c.y - 0.8) < 1.6 && Math.hypot(s.x - c.x, s.z - c.z) < 2.3) { hit = true; direct = c; break; }
            if (!hit) for (const heli of helis) if (!heli.driven && Math.abs(s.y - heli.y - 1.5) < 2 && Math.hypot(s.x - heli.x, s.z - heli.z) < 2.6) { hit = true; direct = heli; }
            if (hit) { s.on = false; boom(s.x, Math.max(s.y, 0.2), s.z, player, direct); }
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
          if (c.model) kitMesh.setVisibleAt(c.ki, false);
          if (c.kind === 'bike') bikeMesh.setMatrixAt(c.bi, m4);
          for (let k = 0; k < 5; k++) glow.hide(g + k);
          if (c.police) { kit.setMatrixAt(nk, m4); glow.hide(G_BAR + nk * 2); glow.hide(G_BAR + nk * 2 + 1); nk++; }
          continue;
        }
        e.set(c.tx, c.yaw, c.tz);
        const fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw), y = c.y + 0.9;
        const dent = c.wreck ? 1 : c.dent || 0;
        if (c.kind === 'bike') dentBike.array[c.bi] = dent; else dentCar.array[c.idx] = dent;
        const burning = c.burn > 0 || (c.wreck && c.wreckT < 7);
        if (c.kind === 'bike') {
          // pivot the wheelie on the rear axle
          const up = Math.sin(-Math.min(c.tx, 0));
          m4.compose(p3.set(c.x - fx_ * up * 0.3, c.y + up * 0.72, c.z - fz * up * 0.3), q.setFromEuler(e), s3);
          if (c.model) { kitMesh.setMatrixAt(c.ki, m4); kitMesh.setVisibleAt(c.ki, true); m4.makeScale(0, 0, 0); }
          bikeMesh.setMatrixAt(c.bi, m4);
          m4.makeScale(0, 0, 0); carMesh.setMatrixAt(c.idx, m4);
          q.setFromEuler(e.set(0, c.yaw, 0));
          m4.compose(p3.set(c.x, (c.gy || 0) + 0.03, c.z), q, s3.set(0.3, 1, 0.42)); shadows.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
          const lit = (c.driven || !!c.ai) && !c.wreck;
          if (lit && c.y - (c.gy || 0) < 0.5) m4.compose(p3.set(c.x, c.gy || 0, c.z), q, s3.set(0.6, 1, 0.8)); else m4.makeScale(0, 0, 0);
          pools.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
          pools.setColorAt(c.idx, col.setScalar(c.driven ? 0.7 : 0.5));
          if (c.sink) { m4.makeScale(0, 0, 0); shadows.setMatrixAt(c.idx, m4); pools.setMatrixAt(c.idx, m4); for (let k = 0; k < 5; k++) glow.hide(g + k); continue; }
          const brk = c.driven ? inp.throttle < 0 : !!c.ai && c.ai.braking;
          glow.set(g, c.x - fx_ * 1.3, y + 0.16, c.z - fz * 1.3, '#ff1830', brk ? 2.4 : lit ? 1.5 : 0.9, brk ? 1 : lit ? 0.3 : 0);
          glow.set(g + 2, c.x + fx_ * 0.95, y, c.z + fz * 0.95, '#fff0c0', lit ? 2.4 : 0, 0.12);
          glow.hide(g + 1); glow.hide(g + 3);
          if (burning) glow.set(g + 4, c.x, c.y + 0.9, c.z, '#ff8a3d', 3.5 + Math.random() * 1.5, 0.7);
          else if (neon) glow.set(g + 4, c.x, c.y + 0.5, c.z, HOT_PINK, 5, 0.35); else glow.hide(g + 4);
          continue;
        }
        m4.compose(p3.set(c.x, c.y, c.z), q.setFromEuler(e), s3);
        if (c.model) {
          kitMesh.setMatrixAt(c.ki, m4); kitMesh.setVisibleAt(c.ki, true); m4.makeScale(0, 0, 0);
          if (kitLo[c.model] !== undefined && api.eye) {
            const lod = (c.x - api.eye.x) ** 2 + (c.z - api.eye.z) ** 2 > (quality.high ? LOD_HIGH * LOD_HIGH : LOD_LOW * LOD_LOW) && !c.driven;
            if (lod !== c.lod) { c.lod = lod; kitMesh.setGeometryIdAt(c.ki, lod ? kitLo[c.model] : kitGid[c.model]); }
          }
        }
        carMesh.setMatrixAt(c.idx, m4);
        if (c.model) m4.compose(p3, q, s3);
        if (c.sink) { m4.makeScale(0, 0, 0); shadows.setMatrixAt(c.idx, m4); pools.setMatrixAt(c.idx, m4); for (let k = 0; k < 5; k++) glow.hide(g + k); continue; }
        if (c.police) {
          kit.setMatrixAt(nk, m4);
          kit.setColorAt(nk, col.setScalar(c.wreck ? 0.14 : 1 - (c.char || 0) * 0.6));
          const hot = c.ai && c.ai.siren ? 1 : 0;
          glow.set(G_BAR + nk * 2, c.x - fx_ * 0.5 - fz * 0.32, c.y + 1.85, c.z - fz * 0.5 + fx_ * 0.32, '#ff2a3a', hot ? 5 * (blink || 0.15) : 1, hot);
          glow.set(G_BAR + nk * 2 + 1, c.x - fx_ * 0.5 + fz * 0.32, c.y + 1.85, c.z - fz * 0.5 - fx_ * 0.32, '#3a7aff', hot ? 5 * (1 - blink || 0.15) : 1, hot);
          nk++;
        }
        e.set(0, c.yaw, 0);
        const gy = c.gy || 0, sk = 1 / (1 + (c.y - gy) * 0.25), on = (c.driven || !!c.ai) && !c.wreck;
        q.setFromEuler(e);
        const T = c.spec || VTYPES.sedan, hl = T.len / 2 + 0.05, hw = T.w * 0.33;
        m4.compose(p3.set(c.x, gy + 0.03, c.z), q, s3.set(sk * T.w / 1.9, 1, sk * T.len / 4.4));
        shadows.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
        if (on && c.y - gy < 0.5) m4.compose(p3.set(c.x, gy, c.z), q, c.driven ? s3.set(1.15, 1, 1.35) : s3); else m4.makeScale(0, 0, 0);
        pools.setMatrixAt(c.idx, m4); s3.set(1, 1, 1);
        pools.setColorAt(c.idx, col.setScalar(c.driven ? 0.8 : 0.55));
        const braking = c.driven ? inp.throttle < 0 : !!c.ai && c.ai.braking;
        const ts = braking ? 2.6 : on ? 1.7 : 1.1, tb = braking ? 1 : on ? 0.3 : 0;
        glow.set(g, c.x - fx_ * hl + fz * hw, y, c.z - fz * hl - fx_ * hw, '#ff1830', ts, tb);
        glow.set(g + 1, c.x - fx_ * hl - fz * hw, y, c.z - fz * hl + fx_ * hw, '#ff1830', ts, tb);
        glow.set(g + 2, c.x + fx_ * hl + fz * hw, y - 0.28, c.z + fz * hl - fx_ * hw, '#fff0c0', on ? 2.6 : 0, 0.12);
        glow.set(g + 3, c.x + fx_ * hl - fz * hw, y - 0.28, c.z + fz * hl + fx_ * hw, '#fff0c0', on ? 2.6 : 0, 0.12);
        if (burning) glow.set(g + 4, c.x + fx_ * (hl - 0.7), c.y + 1.3, c.z + fz * (hl - 0.7), '#ff8a3d', 6 + Math.random() * 2.5, 0.7);
        else if (neon) glow.set(g + 4, c.x, c.y + 0.5, c.z, HOT_PINK, 9, 0.35); else glow.hide(g + 4);
      }
      glass.count = pools.count = cars.length; pools.instanceColor.needsUpdate = true;
      kit.count = nk; kit.instanceMatrix.needsUpdate = true; kit.instanceColor.needsUpdate = true; bikeMesh.instanceMatrix.needsUpdate = true; pools.instanceMatrix.needsUpdate = true;
      dentCar.needsUpdate = true; dentBike.needsUpdate = true;
      carMesh.instanceMatrix.needsUpdate = true; shadows.instanceMatrix.needsUpdate = true;
      if (tank) {
        const fx_ = Math.sin(tank.yaw), fz = Math.cos(tank.yaw);
        glow.set(G_TANK, tank.x - fx_ * 3.2 + fz * 1.2, 1.5, tank.z - fz * 3.2 - fx_ * 1.2, '#ff1830', 1.8, 0.5);
        glow.set(G_TANK + 1, tank.x - fx_ * 3.2 - fz * 1.2, 1.5, tank.z - fz * 3.2 + fx_ * 1.2, '#ff1830', 1.8, 0.5);
      }
      helis.forEach((heli, i) => {
        const fx_ = Math.sin(heli.yaw), fz = Math.cos(heli.yaw), G = G_HELI + i * 2;
        const blink = Math.sin(performance.now() / 160 + i) > 0.3 ? 1 : 0;
        glow.set(G, heli.x - fx_ * 5.3, heli.y + 3.1, heli.z - fz * 5.3, '#ff1830', 2.4 * blink * (reducedMotion ? 0 : 1) + (reducedMotion ? 1.6 : 0), 1);
        glow.set(G + 1, heli.x + fx_ * 2, heli.y + 1.1, heli.z + fz * 2, '#c8f4ff', heli.driven ? 3 : 0, 0.5);
      });
      glow.commit();
    },
  };
  return api;
}
