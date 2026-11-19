// Everything below the surface. While the camera is under the water (and ONLY then) the scene switches:
// blue-green depth fog that darkens with depth and at night, animated caustics on the seabed, soft light
// shafts, drifting plankton, the surface seen from below (a bright Snell's window; see the ocean shader in
// sky.js) and the seabed itself: sand ripples, rocks, swaying seaweed, coral, pier piles, an old boat wreck,
// tyres and a lost beach ball. All of it hangs off one group that is not drawn when the camera is above the
// water, so the street view pays nothing. Respects reduced motion (still caustics and shafts).
import * as THREE from 'three';
import { box, cyl, tint, merge, rng, clamp, lerp, timeU, nightU, fogU, pointScaleU, reducedMotion, PI } from '../core/util.js';
import { HX, HZ, PIER } from './layout.js';
import { WL, bedAt, depthAt, islandDist, MOUNDS } from './sea.js';

// ---- shared uniforms for every underwater material
export const SU = {
  uT: timeU, uFog: { value: new THREE.Color('#2aa7b3') }, uNear: { value: 1.5 }, uFar: { value: 40 },
  uLight: { value: 1 }, uNight: nightU, uGlow: { value: 0 }, uShaft: { value: 1 }, uScale: pointScaleU, uSurf: { value: WL },
};

const HEAD = /* glsl */`
  varying vec3 vC; varying vec3 vW; varying vec3 vN;
`;
const VERT = (flags) => /* glsl */`
  ${HEAD}
  uniform float uT;
  attribute float aPh;
  void main(){
    vec3 p = position;
    vec3 nrm = normal;
    ${flags.includes('WAG') ? 'float tk = smoothstep(0.05, -0.55, p.z); p.x += sin(uT * 9.0 + aPh * 6.283 + p.z * 4.0) * 0.14 * tk;' : ''}
    ${flags.includes('SWAY') ? 'float hh = p.y; p.x += sin(uT * 1.15 + aPh * 6.283 + hh * 2.3) * 0.2 * hh * hh; p.z += cos(uT * 0.9 + aPh * 5.0 + hh * 1.7) * 0.12 * hh * hh;' : ''}
    ${flags.includes('PULSE') ? 'float pu = sin(uT * 2.2 + aPh * 6.283); float bell = step(0.0, p.y); p.xz *= 1.0 + pu * 0.16 * bell; p.y *= 1.0 - pu * 0.1 * bell; p.xz += (1.0 - bell) * vec2(sin(uT * 1.7 + p.y * 4.0 + aPh * 6.0), cos(uT * 1.3 + p.y * 3.0 + aPh * 4.0)) * 0.06 * -p.y;' : ''}
    ${flags.includes('FLAP') ? 'p.y += sin(uT * 2.1 + aPh * 6.283 - abs(p.x) * 2.2) * 0.2 * abs(p.x);' : ''}
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * nrm);
    #else
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * nrm);
    #endif
    vW = wp.xyz;
    vC = color;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRAG = (flags) => /* glsl */`
  ${HEAD}
  uniform float uT, uLight, uNight, uGlow, uNear, uFar, uSurf;
  uniform vec3 uFog;
  float caus(vec2 p, float t){
    vec2 a = p * 0.9 + vec2(t * 0.20, t * 0.13);
    float v = sin(a.x * 2.1 + sin(a.y * 1.7 + t * 0.6)) * sin(a.y * 2.3 + sin(a.x * 1.3 - t * 0.5));
    vec2 b = p * 1.7 - vec2(t * 0.15, -t * 0.18);
    float w = sin(b.x * 1.9 + sin(b.y * 2.1 - t * 0.7)) * sin(b.y * 1.6 + sin(b.x * 1.4 + t * 0.4));
    float c = abs(v + w) * 0.5;
    return pow(1.0 - c, 6.0);
  }
  void main(){
    vec3 col = vC;
    float depth = max(uSurf - vW.y, 0.0);
    float up = clamp(vN.y, 0.0, 1.0);
    ${flags.includes('FLAT') ? 'float lit = 0.8;' : 'float lit = 0.4 + 0.6 * (vN.y * 0.5 + 0.5);'}
    float ab = exp(-depth * 0.05);
    ${flags.includes('SEABED') ? 'col *= 0.9 + 0.1 * sin(dot(vW.xz, vec2(0.8, 0.55)) * 2.4 + sin(vW.x * 0.17 + vW.z * 0.11) * 3.0);' : ''}
    float cz = caus(vW.xz, uT) * smoothstep(0.15, 0.85, up) * exp(-depth * 0.1);
    col = col * lit * uLight * ab + vec3(0.75, 1.0, 0.9) * cz * uLight * (0.5 + 0.5 * dot(col, vec3(0.33)));
    col *= mix(vec3(1.0), vec3(0.45, 0.88, 1.05), 1.0 - exp(-depth * 0.1));
    ${flags.includes('GLOW') ? 'col += vC * uGlow;' : ''}
    float d = length(vW - cameraPosition);
    col = mix(col, uFog, smoothstep(uNear, uFar, d));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
export function seaMat(flags = '', extra = {}) {
  return new THREE.ShaderMaterial({ uniforms: SU, vertexShader: VERT(flags), fragmentShader: FRAG(flags), vertexColors: true, fog: false, ...extra });
}

// ---- builders
const col = (hex) => new THREE.Color(hex);
function rock(x, y, z, s, hex, r) {
  const g = new THREE.IcosahedronGeometry(s, 0);
  g.scale(1 + r() * 0.5, 0.55 + r() * 0.35, 1 + r() * 0.5); g.rotateY(r() * 6.28); g.translate(x, y, z);
  return tint(g, hex);
}
function ball(x, y, z, rad) {
  const g = new THREE.SphereGeometry(rad, 12, 8).toNonIndexed(), p = g.attributes.position, n = p.count, arr = new Float32Array(n * 3), c = new THREE.Color();
  const cols = ['#ff4f6a', '#fbf7f0', '#ffd447', '#fbf7f0', '#27c9d8', '#fbf7f0'];
  for (let i = 0; i < n; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)), k = Math.floor(((a + PI) / (PI * 2)) * 6 + 0.001) % 6; c.set(Math.abs(p.getY(i)) > rad * 0.93 ? '#fbf7f0' : cols[k]); arr.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv'); g.translate(x, y, z);
  return g;
}
function tyre(x, y, z, rx, ry) {
  const g = new THREE.TorusGeometry(0.36, 0.15, 6, 12); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z);
  return tint(g, '#2b2833');
}
function coralCluster(parts, x, z, r, base) {
  const PAL = ['#ff6fa8', '#ff9a4a', '#c07aff', '#ffd166', '#4fd1c5', '#ff5d6c'];
  const hex = PAL[Math.floor(r() * PAL.length)], hex2 = PAL[Math.floor(r() * PAL.length)];
  const n = 4 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, o = 0.1 + r() * 0.8, h = 0.5 + r() * 1.0, tilt = (r() - 0.5) * 0.6;
    const bx = x + Math.cos(a) * o, bz = z + Math.sin(a) * o, by = bedAt(bx, bz);
    const g = new THREE.CylinderGeometry(0.03 + r() * 0.04, 0.09 + r() * 0.05, h, 5); g.rotateZ(tilt); g.translate(bx, by + h / 2 - 0.05, bz);
    parts.push(tint(g, i % 3 ? hex : hex2));
    const t = new THREE.IcosahedronGeometry(0.09 + r() * 0.05, 0); t.translate(bx + Math.sin(tilt) * -h / 2, by + h - 0.02, bz); parts.push(tint(t, '#fff0c8'));
    if (r() < 0.5) { const f = new THREE.CylinderGeometry(0.02, 0.05, h * 0.55, 5); f.rotateZ(-tilt * 2 + 0.7); f.translate(bx + 0.12, by + h * 0.6, bz); parts.push(tint(f, i % 2 ? hex : hex2)); }
  }
  const dome = new THREE.SphereGeometry(0.28 + r() * 0.2, 7, 4, 0, PI * 2, 0, PI / 2); dome.translate(x + (r() - 0.5) * 0.8, bedAt(x, z) - 0.02, z + (r() - 0.5) * 0.8);
  parts.push(tint(dome, base));
}
function buildWreck(parts, wx, wz, yaw) {
  const by = bedAt(wx, wz), P = [];
  const W = '#6b4a30', W2 = '#4d3626', MOSS = '#3c6b4a', RUST = '#8a4a2a';
  // a little wooden fishing boat, heeled over and half buried: keel, ribs, a few planks, broken mast, cabin frame, rudder
  P.push(box(8.4, 0.22, 0.28, 0, 0.1, 0, W2), box(0.3, 1.4, 0.26, 4.1, 0.8, 0, W, 0, 0, -0.5), box(0.3, 1.1, 0.26, -4.0, 0.6, 0, W, 0, 0, 0.35));
  for (let i = -3; i <= 3; i++) {
    const rb = Math.abs(i) < 3 || i % 2 ? 1 : 0;
    P.push(box(0.14, 1.5 - Math.abs(i) * 0.12, 0.14, i * 1.05, 0.9, 1.05 - Math.abs(i) * 0.1, W2, 0, 0, -0.3), box(0.14, 1.5 - Math.abs(i) * 0.12, 0.14, i * 1.05, 0.9, -1.05 + Math.abs(i) * 0.1, W2, 0, 0, 0.3));
    if (rb) P.push(box(0.16, 0.12, 2.1 - Math.abs(i) * 0.2, i * 1.05, 0.3, 0, W2));
  }
  for (let k = 0; k < 4; k++) P.push(box(7 - k * 0.5, 0.1, 0.34, 0, 0.35 + k * 0.28, 0.95 + k * 0.1 - 0.15, k % 2 ? W : W2, 0, 0, -0.25), box(6.3 - k * 0.5, 0.1, 0.34, 0.4, 0.35 + k * 0.28, -0.95 - k * 0.1 + 0.15, k % 2 ? W2 : W, 0, 0, 0.25));
  P.push(box(0.2, 4.6, 0.2, 0.8, 1.2, 0.3, W, 0.2, 0, 1.2), box(0.1, 0.1, 2.2, -1.5, 0.5, 0.4, '#a89880', 0, 0.3, 0.2));
  P.push(box(2.0, 0.1, 1.6, -2.2, 1.5, 0, W2), box(0.12, 1.1, 0.12, -1.3, 1.0, 0.7, W), box(0.12, 1.1, 0.12, -1.3, 1.0, -0.7, W), box(0.12, 1.1, 0.12, -3.1, 1.0, 0.7, W), box(0.12, 1.1, 0.12, -3.1, 1.0, -0.7, W));
  P.push(box(0.12, 0.9, 0.6, -4.3, 0.45, 0, W), box(0.5, 0.3, 0.4, 2.4, 0.3, 0.4, RUST), cyl(0.25, 0.25, 0.1, 8, 3.0, 0.18, -0.5, RUST));
  for (let i = 0; i < 5; i++) P.push(box(0.5, 0.12, 0.35, -2.5 + i * 1.3, 0.6 + (i % 2) * 0.25, (i % 3 - 1) * 0.5, MOSS, 0, i, 0.2));
  const g = merge(P);
  g.rotateZ(0.32); g.rotateY(yaw); g.translate(wx, by - 0.25, wz);
  parts.push(g);
}

export function createUnderwater(scene, camera, sky, ocean, env, game) {
  const r = rng(4242);
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---------------- the seabed: a grid over every bit of sea within reach, heights from bedAt()
  {
    const X0 = -HX - 260, X1 = HX + 260, Z0 = -HZ - 260, Z1 = HZ + 262, ST = 8;
    const nx = Math.round((X1 - X0) / ST) + 1, nz = Math.round((Z1 - Z0) / ST) + 1;
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), idx = [];
    const c = new THREE.Color(), sand = col('#dcc794'), wet = col('#c9b27c'), rockC = col('#8e8479'), green = col('#76946a'), dark = col('#04101c');
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X0 + i * ST, z = Z0 + j * ST, y = bedAt(x, z), k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = y - 0.02; pos[k + 2] = z;
      const d = islandDist(x, z), n = Math.sin(x * 0.09) * Math.sin(z * 0.07) + Math.sin(x * 0.31 + z * 0.17) * 0.5;
      c.copy(sand).lerp(wet, clamp(-y / 5, 0, 1) * 0.6);
      let mound = 0;
      for (const m of MOUNDS) { const q = ((x - m[0]) ** 2 + (z - m[1]) ** 2) / (m[2] * m[2]); mound = Math.max(mound, Math.exp(-q * 1.6)); }
      c.lerp(rockC, clamp(mound * 1.2 - 0.25, 0, 0.8)).lerp(green, clamp(n * 0.25 + 0.1, 0, 0.35) * (1 - clamp(mound, 0, 1) * 0.5));
      c.multiplyScalar(0.94 + 0.06 * Math.sin(i * 12.9 + j * 78.2));
      c.lerp(dark, clamp((d - 118) / 55, 0, 1));
      colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const x = X0 + i * ST, z = Z0 + j * ST;
      if (Math.abs(x + ST / 2) < HX - 4 && Math.abs(z + ST / 2) < HZ - 4) continue;      // under the island
      if (islandDist(x + ST / 2, z + ST / 2) > 268) continue;
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, seaMat('SEABED', { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.frustumCulled = false; group.add(m);
  }

  // ---------------- rocks, coral, pier piles, the wreck, tyres, the beach ball: one merged mesh
  {
    const parts = [];
    const ROCK = ['#8e8479', '#a39a8c', '#766d66', '#9a8e7e', '#6f7a72'];
    for (let i = 0; i < 110; i++) {
      const a = r();
      let x, z;
      if (a < 0.5) { const m = MOUNDS[Math.floor(r() * MOUNDS.length)], an = r() * 6.28, rr = r() * m[2]; x = m[0] + Math.cos(an) * rr; z = m[1] + Math.sin(an) * rr; }
      else { x = -HX + 20 + r() * (HX * 2 - 40); z = HZ + 16 + r() * 110; }
      if (depthAt(x, z) < 1.6) continue;
      const s = 0.35 + r() * (a < 0.5 ? 1.5 : 0.9);
      parts.push(rock(x, bedAt(x, z) + s * 0.15, z, s, ROCK[Math.floor(r() * ROCK.length)], r));
    }
    // coral: on the reef mounds and around the pier piles
    for (let i = 0; i < 60; i++) {
      let x, z;
      if (i < 36) { const m = MOUNDS[i % MOUNDS.length], an = r() * 6.28, rr = r() * m[2] * 0.7; x = m[0] + Math.cos(an) * rr; z = m[1] + Math.sin(an) * rr; }
      else { x = (i % 2 ? PIER.x1 + 2 + r() * 6 : PIER.x0 - 2 - r() * 6); z = PIER.z0 + 14 + r() * 90; }
      if (depthAt(x, z) < 1.8) continue;
      coralCluster(parts, x, z, r, ['#b84a6a', '#c98a4a', '#8a64c8'][i % 3]);
    }
    // pier piles run down to the sand
    for (const sx of [PIER.x0 + 0.15, PIER.x1 - 0.15]) for (let z = PIER.z0 + 6; z <= PIER.z1; z += 12.5) {
      const by = bedAt(sx, z), top = -3.9, h = top - (by - 0.3);
      if (h > 0.1) { parts.push(cyl(0.32, 0.34, h, 6, sx, top - h / 2, z, '#5a3f2a')); }
      parts.push(cyl(0.34, 0.34, 1.4, 6, sx, Math.max(by + 0.7, -3.9 + 0.2), z, '#3f6f4a'));      // algae band
      if (by > -4) parts.push(rock(sx, by, z, 0.5, '#8e8479', r));
    }
    buildWreck(parts, -104, 226, 0.7);
    // tyres, a crate, an anchor and the lost beach ball, near the pier where you will find them
    const tyres = [[54, 188, 0, 0.3], [29, 214, 1.5, 0.8], [58, 233, 0.2, 2.1], [46, 171, 1.2, 0.1]];
    for (const [x, z, rx, ry] of tyres) parts.push(tyre(x, bedAt(x, z) + 0.12, z, rx + PI / 2 * (rx > 1 ? 0.4 : 1), ry));
    parts.push(box(0.9, 0.6, 0.7, 24, bedAt(24, 196) + 0.28, 196, '#7a5a38', 0, 0.5, 0.1), box(0.9, 0.08, 0.08, 24, bedAt(24, 196) + 0.58, 196, '#4d3626', 0, 0.5, 0.1));
    parts.push(box(0.1, 1.5, 0.1, 61, bedAt(61, 222) + 0.55, 222, '#6a5a50', 0.2, 0, 0.9), box(0.9, 0.1, 0.1, 61, bedAt(61, 222) + 0.8, 222, '#6a5a50', 0.2, 0, 0.9));
    parts.push(ball(48, bedAt(48, 205) + 0.34, 205, 0.34));
    const g = merge(parts);
    const m = new THREE.Mesh(g, seaMat(''));
    m.frustumCulled = false; group.add(m);
  }

  // ---------------- seaweed: instanced ribbons that sway
  const weedN = 520;
  const weed = (() => {
    const segs = 4, pts = [], uvs = [], cols = [], idx = [];
    const base = col('#2a6b3a'), tip = col('#72d37e'), c = new THREE.Color();
    for (let pl = 0; pl < 2; pl++) {
      const a = pl * PI / 2, ca = Math.cos(a), sa = Math.sin(a), o = pts.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, w = 0.1 * (1 - t * 0.7);
        for (const sg of [-1, 1]) { pts.push(ca * w * sg, t, sa * w * sg); c.copy(base).lerp(tip, t); cols.push(c.r, c.g, c.b); }
      }
      for (let s = 0; s < segs; s++) { const k = o + s * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const ph = new Float32Array(weedN);
    for (let i = 0; i < weedN; i++) ph[i] = r();
    g.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    const mesh = new THREE.InstancedMesh(g, seaMat('SWAY FLAT', { side: THREE.DoubleSide }), weedN);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
    let n = 0, guard = 0;
    while (n < weedN && guard++ < 6000) {
      let x, z;
      const a = r();
      if (a < 0.4) { const m = MOUNDS[Math.floor(r() * MOUNDS.length)], an = r() * 6.28, rr = r() * m[2] * 0.9; x = m[0] + Math.cos(an) * rr; z = m[1] + Math.sin(an) * rr; }
      else if (a < 0.75) { x = (r() < 0.5 ? PIER.x0 - 3 - r() * 12 : PIER.x1 + 3 + r() * 12); z = PIER.z0 + 10 + r() * 95; }
      else { x = -200 + r() * 400; z = HZ + 22 + r() * 60; }
      const dep = depthAt(x, z);
      if (dep < 1.3) continue;
      // grow in clumps
      for (let k = 0; k < 4 && n < weedN; k++) {
        const cx = x + (r() - 0.5) * 2, cz = z + (r() - 0.5) * 2, d2 = depthAt(cx, cz);
        if (d2 < 1.3) continue;
        const h = Math.min(0.9 + r() * 1.4, d2 - 0.35);
        mesh.setMatrixAt(n++, M.compose(V.set(cx, bedAt(cx, cz) - 0.03, cz), Q.setFromEuler(E.set(0, r() * 6.28, 0)), S.set(1, h, 1)));
      }
    }
    mesh.count = n; mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  })();

  // ---------------- plankton: drifting motes in a box around the camera
  const PN = 260;
  const plank = (() => {
    const p = new Float32Array(PN * 3), s = new Float32Array(PN);
    for (let i = 0; i < PN; i++) { p[i * 3] = r() * 30; p[i * 3 + 1] = r() * 18; p[i * 3 + 2] = r() * 30; s[i] = 0.025 + r() * 0.05; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { ...SU, uCam: { value: new THREE.Vector3() }, uMove: { value: reducedMotion ? 0 : 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        attribute float aSize; uniform float uT, uScale, uSurf, uMove; uniform vec3 uCam; varying float vA;
        void main(){
          vec3 p = position;
          p += vec3(sin(uT * 0.3 + position.y), cos(uT * 0.23 + position.x) * 0.5 - 0.1 * uT * uMove, sin(uT * 0.27 + position.z)) * 0.8 * uMove;
          p = mod(p - uCam + vec3(15.0, 9.0, 15.0), vec3(30.0, 18.0, 30.0)) - vec3(15.0, 9.0, 15.0) + uCam;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 7.0);
          vA = p.y < uSurf - 0.2 ? 0.55 * (1.0 - smoothstep(6.0, 15.0, length(p - uCam))) : 0.0;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uFog; uniform float uLight; varying float vA;
        void main(){ float a = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0); gl_FragColor = vec4(vec3(0.7, 0.95, 0.95) * (0.3 + uLight * 0.7) * a * vA, 1.0); }`,
    }));
    m.frustumCulled = false; m.renderOrder = 5; group.add(m);
    return m;
  })();

  // ---------------- soft light shafts from above: crossed quads, additive, fixed in the world on a grid
  const shafts = (() => {
    const geos = [], R = rng(77);
    for (let i = 0; i < 22; i++) {
      const cx = (R() - 0.5) * 80, cz = (R() - 0.5) * 80, w = 1.6 + R() * 2.4, h = 16 + R() * 8, lean = 0.28 + R() * 0.1, rot = R() * PI;
      for (let k = 0; k < 2; k++) {
        const g = new THREE.PlaneGeometry(w, h, 1, 1);
        // top (y = h/2) wider and bright, leaning along the sun's direction as it goes down
        g.translate(0, -h / 2, 0);
        const p = g.attributes.position;
        for (let v = 0; v < p.count; v++) p.setX(v, p.getX(v) + (p.getY(v)) * lean * -1);
        g.rotateY(rot + k * PI / 2); g.translate(cx, WL, cz);
        const ph = new Float32Array(p.count).fill(R());
        g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
        geos.push(g);
      }
    }
    for (const g of geos) g.deleteAttribute('normal');
    const merged = merge(geos);
    const m = new THREE.Mesh(merged, new THREE.ShaderMaterial({
      uniforms: SU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: /* glsl */`
        attribute float aPh; uniform float uT; varying vec2 vUv; varying vec3 vW; varying float vP;
        void main(){ vUv = uv; vP = aPh; vec4 w = modelMatrix * vec4(position, 1.0); w.x += sin(uT * 0.4 + aPh * 6.0 + position.y * 0.15) * 0.8; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uT, uShaft, uLight, uNear, uFar; varying vec2 vUv; varying vec3 vW; varying float vP;
        void main(){
          float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float a = edge * edge * pow(vUv.y, 1.6) * (0.55 + 0.45 * sin(uT * 0.5 + vP * 9.0)) * uShaft * 0.2;
          float d = length(vW - cameraPosition);
          a *= 1.0 - smoothstep(uNear + 4.0, uFar * 0.9, d);
          gl_FragColor = vec4(vec3(0.62, 0.95, 0.85) * a, 1.0);
        }`,
    }));
    m.frustumCulled = false; m.renderOrder = 4; group.add(m);
    return m;
  })();

  // ---------------- bubbles (a pool of rising points; also used by sinking vehicles and sharks)
  const BN = 200;
  const bub = (() => {
    const pos = new Float32Array(BN * 3), size = new Float32Array(BN), life = new Float32Array(BN), vel = new Float32Array(BN * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: SU, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        attribute float aSize; uniform float uScale; varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 60.0); }`,
      fragmentShader: /* glsl */`
        uniform float uNear, uFar, uLight; uniform vec3 uFog; varying vec3 vW;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float ring = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d)), core = (1.0 - smoothstep(0.0, 0.5, d)) * 0.12;
          float a = (ring * 0.85 + core) * (1.0 - smoothstep(uNear, uFar, length(vW - cameraPosition)));
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(vec3(0.75, 0.95, 1.0), vec3(1.0), 0.4) * (0.4 + 0.6 * uLight), a);
        }`,
    }));
    m.frustumCulled = false; m.renderOrder = 6; m.visible = false; scene.add(m);
    let cursor = 0, alive = 0;
    const B = {
      mesh: m,
      emit(x, y, z, vx = 0, vy = 0.7, vz = 0, s = 0.05 + Math.random() * 0.07) {
        const i = cursor; cursor = (cursor + 1) % BN;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy + Math.random() * 0.3; vel[i * 3 + 2] = vz;
        size[i] = s; life[i] = 1;
      },
      burst(x, y, z, n = 8) { for (let i = 0; i < n; i++) B.emit(x + (Math.random() - 0.5) * 0.7, y - Math.random() * 0.4, z + (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5); },
      get alive() { return alive; },
      update(dt) {
        alive = 0;
        for (let i = 0; i < BN; i++) {
          if (life[i] <= 0) { size[i] = 0; continue; }
          pos[i * 3] += (vel[i * 3] + Math.sin(timeU.value * 3 + i) * 0.12) * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(timeU.value * 2.6 + i) * 0.12) * dt;
          vel[i * 3 + 1] += 0.5 * dt;
          if (pos[i * 3 + 1] > WL) { life[i] = 0; size[i] = 0; continue; }
          alive++;
        }
        g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
        m.visible = alive > 0;
      },
    };
    return B;
  })();

  // ---------------- the switch
  const fogDay = col('#2aa7b3'), fogNight = col('#04102a'), fogCol = new THREE.Color(), bg = new THREE.Color();
  let under = false, depthCam = 0, fade = 0;
  const sea = {
    group, bubbles: bub, weed, plank, shafts,
    get under() { return under; }, get depthCam() { return depthCam; },
    // draw the hidden underwater scene once so its shaders are compiled before the first dive
    warm(on) { group.visible = on || under; bub.mesh.visible = on || bub.alive > 0; },
    stats() { return { under, weed: weed.count, bubbles: bub.alive, fog: { near: SU.uNear.value, far: SU.uFar.value }, light: SU.uLight.value, bg: !!scene.background }; },
    // call every frame after the camera and the environment have been updated
    update(dt) {
      const cp = camera.position;
      const now = cp.y < WL - 0.02 && depthAt(cp.x, cp.z) > 0 && !game.inside;
      if (now !== under) { under = now; if (!under) { scene.background = null; sky.mesh.visible = true; } }
      group.visible = under;
      bub.update(dt);
      if (!under) { fade = 0; return; }
      fade = Math.min(1, fade + dt * 4);
      depthCam = clamp(WL - cp.y, 0, 60);
      const dk = Math.exp(-depthCam * 0.06), night = nightU.value;
      fogCol.copy(fogDay).lerp(fogNight, night).multiplyScalar(0.3 + 0.7 * dk * (1 - 0.15 * env.w.cloud));
      SU.uFog.value.copy(fogCol);
      SU.uNear.value = 1.2; SU.uFar.value = (lerp(40, 19, night)) * (0.55 + 0.45 * dk) * (1 - 0.25 * env.w.fog);
      SU.uLight.value = lerp(1, 0.17, night) * (1 - 0.4 * env.w.cloud) * (0.55 + 0.45 * dk) + 0.05;
      SU.uShaft.value = (1 - night) * (1 - env.w.cloud * 0.7) * dk * (reducedMotion ? 0.6 : 1);
      SU.uGlow.value = 0.12 + night * 1.1;
      // override the world's fog and sky for as long as we are down here
      scene.fog.color.copy(fogCol); scene.fog.near = SU.uNear.value; scene.fog.far = SU.uFar.value;
      fogU.uFogColor.value.copy(fogCol); fogU.uFogNear.value = SU.uNear.value; fogU.uFogFar.value = SU.uFar.value;
      bg.copy(fogCol); scene.background = bg;
      sky.mesh.visible = false;
      if (env.rain) env.rain.visible = false;
      plank.material.uniforms.uCam.value.copy(cp);
      shafts.position.set(Math.round(cp.x / 80) * 80, 0, Math.round(cp.z / 80) * 80);
    },
  };
  return sea;
}
