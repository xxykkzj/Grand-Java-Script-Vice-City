// Distant scenery so the island sits in a bigger world: a mainland skyline to the north, the Key
// (a small island town) to the west at the far end of the old causeway, a hilly island to the
// south-east, a lighthouse on a rock with a turning beam, and a cargo ship crawling along the
// southern horizon. Three draw calls: one merged mesh (hazed by distance, windows that light up
// and twinkle at night, the ship moved in the vertex shader), one set of point lights (windows,
// causeway traffic, aviation and ship lights, the closure's amber flashers), and the beam.
import * as THREE from 'three';
import { box, cyl, tint, merge, rng, timeU, fogU, FOG_PARS, nightU, pointScaleU, reflU, reducedMotion, PI } from '../core/util.js';

const SHIP_Z = 1350, SHIP_SPAN = 4400, SHIP_SPEED = 3;
export const LIGHTHOUSE = { x: 470, z: 330 };
// the open half of the far causeway: from the Key's north shore to the mainland
const CW_A = [-880, -55], CW_B = [-985, -1120];

export function createHorizon(scene, blinkers) {
  const r = rng(2024);
  const parts = [];
  // tag every vertex: aWin (1 = façade that gets windows at night), aMove (1 = part of the ship)
  const add = (g, win = 0, move = 0) => {
    const n = g.attributes.position.count;
    g.setAttribute('aWin', new THREE.BufferAttribute(new Float32Array(n).fill(win), 1));
    g.setAttribute('aMove', new THREE.BufferAttribute(new Float32Array(n).fill(move), 1));
    parts.push(g);
  };
  const L = { pos: [], col: [], size: [], kind: [], seed: [], b: [] };
  // kind: 0 lamp (on at night), 1 twinkle, 2 blink, 3 causeway car, 4 ship light
  const light = (x, y, z, hex, size, kind, seed = Math.random(), b = [x, y, z]) => {
    const c = new THREE.Color(hex);
    L.pos.push(x, y, z); L.col.push(c.r, c.g, c.b); L.size.push(size); L.kind.push(kind); L.seed.push(seed); L.b.push(...b);
  };
  const tower = (x, z, w, d, h, hex) => {
    add(box(w, h, d, x, h / 2 - 2, z, hex), 1);
    if (h > 60 && r() < 0.5) { add(box(w * 0.6, h * 0.18, d * 0.6, x, h + h * 0.09 - 2, z, hex), 1); h *= 1.18; }
    if (h > 90) { add(box(0.8, 18, 0.8, x, h + 7, z, '#8a8a96')); light(x, h + 16, z, '#ff3040', 9, 2, r()); }
  };
  const hill = (x, z, rad, h, hex, seg = 9) => add(tint(new THREE.ConeGeometry(rad, h, seg, 1).translate(x, h / 2 - 2, z), hex));
  const dome = (x, z, rad, h, hex) => add(tint(new THREE.SphereGeometry(rad, 12, 4, 0, PI * 2, 0, PI / 2).scale(1, h / rad, 1).translate(x, -1.5, z), hex));

  // ---- the mainland across the bay (north)
  add(box(3400, 6, 160, -350, 1, -1200, '#6f8a72'));
  for (let i = 0; i < 14; i++) hill(-1800 + i * 240 + r() * 80, -1330 - r() * 160, 140 + r() * 140, 40 + r() * 70, i % 2 ? '#5f7a6a' : '#68806f');
  const PAST = ['#cdbccc', '#b8c6d4', '#dccbb2', '#c4d6c8', '#e0c2c8', '#b6b0cc'];
  for (let i = 0; i < 46; i++) {
    const a = r() * PI * 2, d = Math.sqrt(r()) * 260, x = -460 + Math.cos(a) * d * 1.6, z = -1215 + Math.sin(a) * d * 0.22;
    tower(x, z, 18 + r() * 26, 16 + r() * 22, 30 + (1 - d / 260) * 130 + r() * 30, PAST[i % PAST.length]);
  }
  for (let i = 0; i < 16; i++) tower(380 + (r() - 0.5) * 300, -1170 - r() * 50, 14 + r() * 16, 14 + r() * 14, 14 + r() * 36, PAST[i % PAST.length]);
  for (let i = 0; i < 70; i++) light(-1600 + r() * 2400, 4 + r() * 3, -1125 - r() * 10, r() < 0.7 ? '#ffcf8a' : '#bff4ff', 7, 1);   // waterfront

  // ---- the Key: a little island town west of the causeway gap
  const KX = -860, KZ = 60;
  add(tint(new THREE.CylinderGeometry(135, 145, 3, 16).translate(KX, -1.4, KZ), '#e8d3a4'));
  dome(KX, KZ, 120, 22, '#7f9a6e');
  for (let i = 0; i < 12; i++) {
    const a = r() * PI * 2, d = 30 + r() * 70;
    tower(KX + Math.cos(a) * d, KZ + Math.sin(a) * d, 10 + r() * 12, 10 + r() * 12, 14 + r() * 22, PAST[i % PAST.length]);
  }
  add(box(1.2, 60, 1.2, KX + 20, 50, KZ - 30, '#a0a0aa')); light(KX + 20, 81, KZ - 30, '#ff3040', 10, 2);
  // the old causeway: closed and dark from our stub to the Key, busy from the Key to the mainland
  const span = (x0, z0, x1, z1, y, piers) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
    add(box(len, 1.4, 14, (x0 + x1) / 2, y, (z0 + z1) / 2, '#8d8796', 0, yaw));
    add(box(len, 0.9, 0.5, (x0 + x1) / 2, y + 1.1, (z0 + z1) / 2 + 6.8, '#d8ccc0', 0, yaw));
    for (let t = 0; t <= len; t += piers) add(box(3, y + 6, 10, x0 + dx * t / len, (y - 6) / 2, z0 + dz * t / len, '#a89e96', 0, yaw));
    return { dx: dx / len, dz: dz / len, len };
  };
  span(-392, 53, KX + 134, 53, -0.7, 36);
  const s2 = span(CW_A[0], CW_A[1], CW_B[0], CW_B[1], 4, 45);
  for (let t = 20; t < s2.len; t += 60) light(CW_A[0] + s2.dx * t - s2.dz * 7, 13, CW_A[1] + s2.dz * t + s2.dx * 7, '#ffcf8a', 7, 0);
  // car lights: white one way, red the other, sliding along the deck in the shader
  for (let i = 0; i < 26; i++) {
    const dir = i % 2, o = dir ? 2.5 : -2.5, ox = -s2.dz * o, oz = s2.dx * o;
    const A = dir ? CW_B : CW_A, B = dir ? CW_A : CW_B;
    light(A[0] + ox, 6.2, A[1] + oz, dir ? '#ff2a3a' : '#fff0c0', 6, 3, i / 26 + r() * 0.02, [B[0] + ox, 6.2, B[1] + oz]);
  }

  // ---- the south-east island
  hill(1150, 760, 210, 85, '#5f7f66', 11); hill(1010, 690, 130, 45, '#6d8a70', 9);
  add(tint(new THREE.CylinderGeometry(230, 240, 3, 18).translate(1110, -1.4, 740), '#e2cc9c'));
  for (let i = 0; i < 6; i++) { const x = 960 + r() * 160, z = 620 + r() * 40; add(box(10, 8, 9, x, 2, z, '#f2e6d8'), 1); light(x, 5, z - 5, '#ffcf8a', 6, 1); }

  // ---- lighthouse on a rock
  const { x: LX, z: LZ } = LIGHTHOUSE;
  for (let i = 0; i < 14; i++) {
    const g = new THREE.IcosahedronGeometry(4 + r() * 5, 0); g.scale(1, 0.6, 1); g.translate(LX + (r() - 0.5) * 22, -0.5, LZ + (r() - 0.5) * 22);
    add(tint(g, i % 2 ? '#8f857c' : '#a69a8c'));
  }
  add(cyl(2.4, 3.4, 26, 10, LX, 13, LZ, '#fbf7f0'));
  for (const y of [6, 16]) add(cyl(2.85 - y * 0.03, 3.05 - y * 0.03, 4, 10, LX, y, LZ, '#e8384f'));
  add(cyl(3.2, 3.2, 0.5, 10, LX, 26.2, LZ, '#3b3350'), cyl(1.7, 1.7, 3, 8, LX, 28, LZ, '#fff4c0'), tint(new THREE.ConeGeometry(2.2, 2, 8).translate(LX, 30.5, LZ), '#e8384f'));
  add(box(5, 4, 4, LX + 6, 1.5, LZ + 3, '#fbf7f0'));
  light(LX, 28, LZ, '#fff2c0', 26, 0);

  // ---- the cargo ship (moved along x in the vertex shader)
  const SH = [];
  SH.push(box(170, 12, 24, 0, 2, SHIP_Z, '#7a3436'), box(171, 1.2, 25, 0, 8.3, SHIP_Z, '#e8e0d0'));
  const cc = ['#2f6f9a', '#d9643a', '#e0b040', '#4f8f5a', '#b04a6a', '#7a7f8c'];
  for (let i = 0; i < 9; i++) for (let k = 0; k < 2; k++) SH.push(box(14, 5 + (i % 3) * 2.5, 10, -60 + i * 15, 11 + (i % 3) * 1.2, SHIP_Z - 5.5 + k * 11, cc[(i + k * 3) % cc.length]));
  SH.push(box(16, 18, 22, 70, 17, SHIP_Z, '#f2ece2'), box(18, 2, 24, 70, 26, SHIP_Z, '#f2ece2'), box(5, 9, 5, 76, 30, SHIP_Z, '#d9643a'));
  SH.forEach((g) => add(g, 0, 1));
  for (const [x, y, c] of [[-84, 12, '#ff3040'], [84, 32, '#ffffff'], [70, 27, '#fff0c0'], [64, 20, '#ffcf8a'], [76, 20, '#ffcf8a'], [-30, 18, '#ffffff']]) light(x, y, SHIP_Z, c, 8, 4);

  // ---- the closure's flashing amber lamps (near: the same shader, almost no haze)
  for (const [x, y, z] of blinkers) light(x, y, z, '#ffb000', 1.1, 2, r());

  // ---------------------------------------------------------------- the merged mesh
  const geo = merge(parts);
  const U = {
    uTime: timeU, uNight: nightU, uAmb: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uSunD: reflU.dir,
    uShip: { value: new THREE.Vector3(SHIP_SPAN, SHIP_SPEED, 0) }, ...fogU,
  };
  const HAZE = /* glsl */`
    float haze(float d){ return min(1.0, (1.0 - exp(-d / (uFogFar * 1.6))) * 0.9 + smoothstep(1900.0, 2400.0, d)); }`;
  const mat = new THREE.ShaderMaterial({
    uniforms: U, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 color; attribute float aWin, aMove;
      uniform float uTime; uniform vec3 uShip;
      varying vec3 vCol, vW, vN; varying float vWin;
      void main(){
        vec3 p = position;
        p.x += aMove * (mod(uTime * uShip.y + uShip.x * 0.5, uShip.x) - uShip.x * 0.5);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz; vN = normal; vCol = color; vWin = aWin;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uAmb, uSunC, uSunD; uniform float uTime, uNight;
      ${FOG_PARS}
      varying vec3 vCol, vW, vN; varying float vWin;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      ${HAZE}
      void main(){
        vec3 N = normalize(vN);
        vec3 col = vCol * (uAmb + uSunC * max(dot(N, uSunD), 0.0));
        float d = length(cameraPosition - vW), hz = haze(d);
        vec3 glow = vec3(0.0);
        if (vWin > 0.5 && abs(N.y) < 0.5) {
          vec2 cell = vec2(floor((vW.x + vW.z) / 5.0), floor(vW.y / 4.5));
          vec2 f = fract(vec2((vW.x + vW.z) / 5.0, vW.y / 4.5));
          float s = h2(cell), on = step(s, uNight * 0.55) * step(0.25, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.8);
          on *= step(0.12, h2(cell + floor(uTime * 0.07 + s * 9.0)));        // a few switch on and off: twinkle
          glow = mix(vec3(1.0, 0.78, 0.45), vec3(0.6, 0.9, 1.0), step(0.75, fract(s * 7.3))) * on * 1.1;
          col = mix(col, col * 0.7, uNight);
        }
        col = mix(col, uFogColor, hz) + glow * (1.0 - hz * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ---------------------------------------------------------------- lights
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
  lg.setAttribute('aColor', new THREE.Float32BufferAttribute(L.col, 3));
  lg.setAttribute('aSize', new THREE.Float32BufferAttribute(L.size, 1));
  lg.setAttribute('aKind', new THREE.Float32BufferAttribute(L.kind, 1));
  lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(L.seed, 1));
  lg.setAttribute('aB', new THREE.Float32BufferAttribute(L.b, 3));
  const LU = { uTime: timeU, uNight: nightU, uScale: pointScaleU, uShip: U.uShip, uSteady: { value: reducedMotion ? 1 : 0 }, ...fogU };
  const pts = new THREE.Points(lg, new THREE.ShaderMaterial({
    uniforms: LU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aColor, aB; attribute float aSize, aKind, aSeed;
      uniform float uTime, uNight, uScale, uSteady; uniform vec3 uShip;
      ${FOG_PARS}
      ${HAZE}
      varying vec3 vCol;
      void main(){
        vec3 p = position;
        float k = uNight;
        if (aKind > 2.5 && aKind < 3.5) { p = mix(position, aB, fract(aSeed + uTime * 0.012)); k = 0.25 + 0.75 * uNight; }
        if (aKind > 3.5) { p.x += mod(uTime * uShip.y + uShip.x * 0.5, uShip.x) - uShip.x * 0.5; k = 0.2 + 0.8 * uNight; }
        if (aKind > 0.5 && aKind < 1.5) k *= step(0.25, fract(aSeed * 31.0 + uTime * 0.05 * (0.5 + aSeed)));
        if (aKind > 1.5 && aKind < 2.5) k = mix(step(0.5, fract(uTime * 0.9 + aSeed)), 0.7, uSteady) * (0.45 + 0.55 * uNight);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vCol = aColor * k * (1.0 - haze(d) * 0.6);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uScale / max(d, 0.1), 1.5, 90.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main(){
        float a = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0);
        gl_FragColor = vec4(vCol * (a * a * 0.8 + pow(a, 6.0) * 0.8), 1.0);
      }`,
  }));
  pts.frustumCulled = false; pts.renderOrder = 5;
  scene.add(pts);

  // ---------------------------------------------------------------- lighthouse beam
  const beamG = [];
  for (const s of [1, -1]) {
    const c = new THREE.ConeGeometry(16, 300, 12, 1, true);
    c.translate(0, -150, 0); c.rotateZ(s * PI / 2);                    // apex at the lamp, opening outwards
    beamG.push(c);
  }
  const bg = merge(beamG.map((g) => { g.deleteAttribute('normal'); return g; }));
  const BU = { uK: { value: 0 } };
  const beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({
    uniforms: BU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying float vD; void main(){ vD = abs(position.x) / 300.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying float vD; void main(){ gl_FragColor = vec4(vec3(1.0, 0.93, 0.7) * uK * pow(1.0 - vD, 1.6) * 0.32, 1.0); }',
  }));
  beam.position.set(LX, 28, LZ); beam.frustumCulled = false; beam.renderOrder = 5;
  scene.add(beam);

  return {
    mesh, pts, beam,
    update(env) {
      const c = env.cur;
      U.uAmb.value.copy(c.hemiS).multiplyScalar(c.hemiI * 0.42).lerp(c.hor, 0.25);
      U.uSunC.value.copy(c.sun).multiplyScalar(c.sunI * 0.32);
      BU.uK.value = env.indoor ? 0 : nightU.value * (1 - env.w.fog * 0.8);
      beam.visible = BU.uK.value > 0.02;
      beam.rotation.y = reducedMotion ? 0.6 : timeU.value * 0.7;
    },
  };
}
