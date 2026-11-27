// Water effects for the boats (vehicles/boats.js), in two draw calls for everything on the sea:
//   wakes   one ribbon mesh. Every boat drops a "sample" behind its transom every metre or so (where, the way
//           across, its speed, beam and how foamy it is); each sample is a quad joined to the boat's previous
//           one. The vertex shader spreads it out with age (the arms of the V open at the Kelvin angle, about
//           19 degrees, from the speed the boat had), floats it on the same swell as the sea (world/waves.js)
//           and the fragment shader draws the pattern: white churn down the middle that dies in ~2 s, two foamy
//           arms that run out and fade over ~10 s, broken up by moving noise like the shore foam. The same
//           mesh draws expanding rings (idle ripples round a hull, splashes, landings). A ring buffer of slots:
//           the oldest is reused, so the cost is fixed (900 slots on High, 420 on Low).
//   spray   one point cloud (320 / 120): bow spray, side sheets, the stern churn's mist and splash bursts,
//           simulated on the CPU (gravity, drag), soft round sprites lit like the foam.
// Foam colour follows the sea's own (bright by day, moonlit grey at night) plus the light of your boat's lamps,
// so a wake still reads at night.
import * as THREE from 'three';
import { timeU, fogU, FOG_PARS, pointScaleU, nightU } from '../core/util.js';
import { WAVE_GLSL, waveU } from '../world/waves.js';
import { WL } from '../world/sea.js';
import { quality } from '../core/quality.js';

const NOISE = /* glsl */`
  float hh(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
  float vnz(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }`;

export function createWater(scene, ocean) {
  const N = quality.high ? 900 : 420, NP = quality.high ? 320 : 120;
  const ou = ocean.uniforms;
  const lampU = { value: new THREE.Vector4(0, 0, 0, 0) };      // your boat's lamps: x, z, radius, strength
  const common = { uTime: timeU, uWaveA: waveU, uIsle: ou.uIsle, uKey: ou.uKey, uSky: ou.uSky, uShallow: ou.uShallow, uLamp: lampU, uNight: nightU, ...fogU };

  // ---------------------------------------------------------------- the wake ribbon
  // a slot: two rows (the previous sample and this one) of COLS vertices across, so the ribbon follows the swell
  // across its width instead of cutting through the crests
  const COLS = 7, VS = COLS * 2;
  const A = new Float32Array(N * VS * 4), B = new Float32Array(N * VS * 4), C = new Float32Array(N * VS * 3);
  const idx = new Uint16Array(N * (COLS - 1) * 6);
  for (let i = 0; i < N; i++) for (let c = 0; c < COLS - 1; c++) { const v = i * VS + c, w = v + COLS; idx.set([v, v + 1, w, v + 1, w + 1, w], (i * (COLS - 1) + c) * 6); }
  for (let i = 0; i < N * VS; i++) B[i * 4] = -1e4;                  // never born: invisible
  const geo = new THREE.BufferGeometry();
  const aA = new THREE.BufferAttribute(A, 4), aB = new THREE.BufferAttribute(B, 4), aC = new THREE.BufferAttribute(C, 3);
  for (const a of [aA, aB, aC]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * VS * 3), 3));
  geo.setAttribute('aA', aA); geo.setAttribute('aB', aB); geo.setAttribute('aC', aC);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.ShaderMaterial({
    uniforms: common, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: /* glsl */`
      uniform float uTime;
      ${WAVE_GLSL}
      attribute vec4 aA; attribute vec4 aB; attribute vec3 aC;
      varying vec2 vQ; varying float vAge, vHalf, vBeam, vStr, vMode; varying vec3 vWp;
      void main(){
        float age = uTime - aB.x; vAge = age; vStr = aB.w; vMode = aC.z; vBeam = aB.z * 0.5;
        vec2 p;
        if (aC.z > 0.5) {
          float R = aB.z + age * aB.y;
          p = aA.xy + aC.xy * R * 1.25; vQ = aC.xy * 1.25; vHalf = R;
        } else {
          float spread = aB.z * 0.5 + min(aB.y * age * 0.34, 4.0 + aB.y * 0.55);
          float W = spread + 0.9 + age * 0.12;
          p = aA.xy + aA.zw * aC.x * W; vQ = vec2(aC.x * W, 0.0); vHalf = spread;
        }
        if (age < 0.0 || age > 16.0) p = aA.xy;                 // dead slot: a degenerate quad
        vec3 w = vec3(p.x, ${WL.toFixed(2)} + seaWave(p, uTime) + 0.045, p.y);
        vWp = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight; uniform vec3 uSky, uShallow; uniform vec4 uLamp;
      ${FOG_PARS}
      ${NOISE}
      varying vec2 vQ; varying float vAge, vHalf, vBeam, vStr, vMode; varying vec3 vWp;
      void main(){
        float age = vAge;
        if (age < 0.0 || age > 16.0) discard;
        vec2 p = vWp.xz;
        float lace = vnz(p * 1.4 + vec2(uTime * 0.3, -uTime * 0.2)), lace2 = vnz(p * 3.7 - vec2(uTime * 0.5, uTime * 0.25));
        float n = lace * 0.65 + lace2 * 0.35;
        float foam;
        if (vMode > 0.5) {
          float r = length(vQ);
          float ring = 1.0 - smoothstep(0.0, 0.16, abs(r - 0.85));
          float core = (1.0 - smoothstep(0.0, 0.6, r)) * exp(-age * 2.5);
          foam = (ring * 0.8 + core) * exp(-age / 1.4) * smoothstep(0.3, 0.55, n + ring * 0.2);
        } else {
          float d = abs(vQ.x);
          // the prop wash down the middle: white and boiling past the stern, breaking up into lace
          float churn = (1.0 - smoothstep(vBeam * 0.35, vBeam * 0.9 + age * 0.4, d)) * exp(-age / 2.2) * smoothstep(0.0, 0.35, age);
          // the two arms of the V: feathered into short diagonal crests, thinning and fading as they spread
          float armW = 0.35 + age * 0.1;
          float feather = 0.5 + 0.5 * smoothstep(-0.3, 0.7, sin(age * 10.0 - d * 1.7 + lace * 2.0));
          float arm = (1.0 - smoothstep(0.0, armW, abs(d - vHalf))) * exp(-age / 4.2) * feather;
          float inner = (1.0 - smoothstep(vHalf * 0.3, vHalf, d)) * exp(-age / 3.0) * 0.4;
          foam = max(churn * smoothstep(0.1, 0.5, n + churn * 0.3) * 1.05, arm * smoothstep(0.3, 0.62, n + arm * 0.2) * 1.1);
          foam = max(foam, inner * smoothstep(0.52, 0.78, lace2 * 0.6 + lace * 0.4));
          foam *= 1.0 - smoothstep(11.0, 16.0, age);
        }
        float a = clamp(foam * vStr, 0.0, 1.0);
        if (a < 0.01) discard;
        // lit like the shore foam (bright by day, a moonlit grey at night) plus your boat's lamps
        float lit = clamp(dot(uShallow, vec3(0.333)) * 1.6 + 0.12, 0.16, 1.0);
        vec2 dl = p - uLamp.xy;
        float lamp = uLamp.w * exp(-dot(dl, dl) / max(uLamp.z * uLamp.z, 1.0));
        vec3 col = mix(uSky, vec3(1.0), 0.65) * lit + vec3(1.0, 0.95, 0.85) * lamp * uNight + vec3(0.25, 0.5, 0.6) * uNight * 0.18;
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWp));
        gl_FragColor = vec4(mix(col, uFogColor, fogF), a * (1.0 - fogF * 0.9));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  // only the slots written since the last draw are uploaded (however many simulation steps ran in between)
  mesh.onBeforeRender = () => {
    if (dirty.hi < dirty.lo) return;
    const lo = dirty.lo * VS, n = (dirty.hi - dirty.lo + 1) * VS;
    for (const [a, w] of [[aA, 4], [aB, 4], [aC, 3]]) { a.clearUpdateRanges(); a.addUpdateRange(lo * w, n * w); a.needsUpdate = true; }
    dirty.lo = N; dirty.hi = -1;
  };
  scene.add(mesh);
  let head = 0, live = 0, lastBirth = -1e4;
  const dirty = { lo: N, hi: -1 };
  const touch = (i) => { if (i < dirty.lo) dirty.lo = i; if (i > dirty.hi) dirty.hi = i; };
  function row(i, r, s) {
    for (let c = 0; c < COLS; c++) { const v = i * VS + r * COLS + c; A.set([s.x, s.z, s.px, s.pz], v * 4); B.set([s.t, s.v, s.beam, s.str], v * 4); C.set([-1 + 2 * c / (COLS - 1), 0, 0], v * 3); }
  }
  // a wake sample for a chain (boat.wk keeps its previous one): returns the sample
  function emit(chain, x, z, px, pz, v, beam, str) {
    const s = { x, z, px, pz, v, beam, str, t: timeU.value };
    const prev = chain.last && timeU.value - chain.last.t < 0.6 ? chain.last : s;
    const i = head; head = (head + 1) % N;
    row(i, 0, prev); row(i, 1, s);
    touch(i); chain.last = s; lastBirth = timeU.value; live++;
    return s;
  }
  // an expanding ring: r0 start radius, grow m/s, str strength
  function ring(x, z, r0 = 0.4, grow = 1.2, str = 0.8) {
    const i = head; head = (head + 1) % N;
    const t = timeU.value;
    for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) { const v = i * VS + r * COLS + c; A.set([x, z, 0, 0], v * 4); B.set([t, grow, r0, str], v * 4); C.set([-1 + 2 * c / (COLS - 1), r ? 1 : -1, 1], v * 3); }
    touch(i); lastBirth = t;
  }

  // ---------------------------------------------------------------- spray
  const PP = new Float32Array(NP * 3), PS = new Float32Array(NP * 2);
  const sim = { vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP) };
  const pg = new THREE.BufferGeometry();
  const pPos = new THREE.BufferAttribute(PP, 3), pS = new THREE.BufferAttribute(PS, 2);
  pPos.setUsage(THREE.DynamicDrawUsage); pS.setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute('position', pPos); pg.setAttribute('aS', pS);
  pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const pmat = new THREE.ShaderMaterial({
    uniforms: { ...common, uScale: pointScaleU }, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      uniform float uScale; attribute vec2 aS; varying float vA; varying vec3 vWp;
      void main(){
        vA = aS.y; vWp = position;
        vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_PointSize = aS.y > 0.0 ? clamp(aS.x * uScale / max(-mv.z, 0.5), 1.0, 90.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSky, uShallow; uniform vec4 uLamp; uniform float uNight;
      ${FOG_PARS}
      varying float vA; varying vec3 vWp;
      void main(){
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q);
        if (r > 1.0 || vA <= 0.0) discard;
        float lit = clamp(dot(uShallow, vec3(0.333)) * 1.6 + 0.2, 0.2, 1.0);
        vec2 dl = vWp.xz - uLamp.xy;
        float lamp = uLamp.w * exp(-dot(dl, dl) / max(uLamp.z * uLamp.z, 1.0));
        vec3 col = mix(uSky, vec3(1.0), 0.7) * lit + vec3(1.0, 0.95, 0.85) * lamp * uNight;
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWp));
        gl_FragColor = vec4(mix(col, uFogColor, fogF), vA * (1.0 - r) * (1.0 - r));
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(pg, pmat);
  points.frustumCulled = false; points.renderOrder = 4;
  scene.add(points);
  let pHead = 0, pLive = 0;
  const stats = { wakes: 0, rings: 0, spray: 0 };
  // one drop: position, velocity, size (m), life (s)
  function drop(x, y, z, vx, vy, vz, size = 0.35, life = 0.9) {
    const i = pHead; pHead = (pHead + 1) % NP;
    PP[i * 3] = x; PP[i * 3 + 1] = y; PP[i * 3 + 2] = z;
    sim.vx[i] = vx; sim.vy[i] = vy; sim.vz[i] = vz; sim.life[i] = life; sim.max[i] = life; sim.size[i] = size;
    stats.spray++;
  }
  // a splash: n drops thrown up and out round (x, z)
  function burst(x, z, n = 14, up = 3.5, out = 2.2, size = 0.45) {
    n = Math.round(n * (quality.high ? 1 : 0.5));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, s = out * (0.4 + Math.random() * 0.8);
      drop(x + Math.cos(a) * 0.4, WL + 0.1, z + Math.sin(a) * 0.4, Math.cos(a) * s, up * (0.6 + Math.random() * 0.7), Math.sin(a) * s, size * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.6);
    }
    ring(x, z, 0.5, 1.6, 1.0); stats.rings++;
  }

  const api = {
    N, NP, stats, lamp: lampU, emit, ring, drop, burst, mesh, points,
    get live() { return timeU.value - lastBirth < 16; },
    update(dt, under) {
      mesh.visible = !under && timeU.value - lastBirth < 16;
      // spray: gravity, air drag, gone when it falls back into the sea
      let any = false;
      const kd = Math.exp(-1.6 * dt);
      for (let i = 0; i < NP; i++) {
        if (sim.life[i] <= 0) { if (PS[i * 2 + 1] !== 0) { PS[i * 2 + 1] = 0; any = true; } continue; }
        any = true;
        sim.life[i] -= dt;
        sim.vy[i] -= 9.8 * dt; sim.vx[i] *= kd; sim.vz[i] *= kd;
        PP[i * 3] += sim.vx[i] * dt; PP[i * 3 + 1] += sim.vy[i] * dt; PP[i * 3 + 2] += sim.vz[i] * dt;
        if (PP[i * 3 + 1] < WL - 0.3) sim.life[i] = 0;
        const k = sim.life[i] / sim.max[i];
        PS[i * 2] = sim.size[i] * (1.8 - k * 0.8); PS[i * 2 + 1] = sim.life[i] > 0 ? Math.min(1, k * 2.5) * (sim.vy[i] > -1 ? 0.8 : 0.45) : 0;
      }
      if (any) { pPos.needsUpdate = true; pS.needsUpdate = true; }
      points.visible = any && !under;
      pLive = any;
    },
    // automated checks: live wake slots within r of (x, z)
    near(x, z, r) { const t = timeU.value; let n = 0; for (let i = 0; i < N; i++) { const o = i * VS * 4, age = t - B[o]; if (age >= 0 && age < 16 && Math.hypot(A[o] - x, A[o + 1] - z) < r) n++; } return n; },
    clear() { for (let i = 0; i < N * VS; i++) B[i * 4] = -1e4; dirty.lo = 0; dirty.hi = N - 1; for (let i = 0; i < NP; i++) sim.life[i] = 0; },
    // automated checks: how many wake slots are alive and how foamy the youngest / oldest are
    state() {
      const t = timeU.value; let alive = 0, young = 1e9, old = 0;
      for (let i = 0; i < N; i++) { const b = B[i * VS * 4]; const age = t - b; if (age >= 0 && age < 16) { alive++; young = Math.min(young, age); old = Math.max(old, age); } }
      let drops = 0; for (let i = 0; i < NP; i++) if (sim.life[i] > 0) drops++;
      return { slots: N, alive, young: alive ? +young.toFixed(2) : null, oldest: +old.toFixed(2), drops, visible: mesh.visible, sprayVisible: points.visible, ...stats };
    },
  };
  return api;
}
