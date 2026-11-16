// The four interiors and the people in them. Each room is built the first time you walk in
// (one merged unlit mesh plus a few animated extras), parked 90 units under its own building
// and only visible while you are inside. Rooms are authored around (0, 0, 0); the door is on +z.
import * as THREE from 'three';
import { box, cyl, tint, merge, timeU, PI, rng } from '../core/util.js';

export const OY = -90;
const BEAT = 60 / 104;                       // the soundtrack's tempo, so the club moves in time
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];

// ---- people -------------------------------------------------------------------------------
const LOOKS = {
  DEE: { skin: '#c98d62', top: '#ffe14a', legs: '#22203a', sleeve: '#ffe14a',
    body: [[0.48, 0.5, 0.2, 0, 1.15, -0.04, '#22203a']],
    head: [[0.3, 0.42, 0.3, 0, 0.45, -0.03, '#ff5fa8'], [0.27, 0.2, 0.1, 0, 0.19, -0.11, '#ff5fa8'], [0.06, 0.06, 0.03, 0.15, 0.1, 0.02, '#ffe14a']] },
  GLITZ: { skin: '#e0a878', top: '#6a3fb8', legs: '#6a3fb8', sleeve: '#6a3fb8',
    body: [[0.62, 0.12, 0.3, 0, 1.47, 0, '#6a3fb8'], [0.16, 0.5, 0.02, 0, 1.25, 0.135, '#fff6ec'], [0.07, 0.42, 0.02, 0, 1.22, 0.142, '#ffd166'], [0.38, 0.1, 0.3, 0, 0.05, 0.03, '#fff6ec']],
    head: [[0.27, 0.09, 0.27, 0, 0.27, -0.01, '#22203a'], [0.26, 0.07, 0.03, 0, 0.16, 0.125, '#27e8ff'], [0.27, 0.12, 0.06, 0, 0.2, -0.11, '#22203a']] },
  GUS: { skin: '#f1c9a5', top: '#f6f1e7', legs: '#3b5a9a', sleeve: '#f6f1e7',
    body: [[0.42, 0.75, 0.03, 0, 1.0, 0.135, '#2fa36b'], [0.1, 0.05, 0.02, 0.1, 1.3, 0.155, '#fff6ec']],
    head: [[0.28, 0.12, 0.2, 0, 0.32, 0, '#fff6ec'], [0.29, 0.03, 0.29, 0, 0.26, 0, '#ff4f6a'], [0.1, 0.07, 0.02, -0.07, 0.15, 0.135, '#22203a'], [0.1, 0.07, 0.02, 0.07, 0.15, 0.135, '#22203a'], [0.26, 0.08, 0.1, 0, 0.12, -0.1, '#a56b43']] },
  KILO: { skin: '#7a4a2e', top: '#7a5cff', legs: '#22203a', sleeve: '#7a5cff',
    body: [[0.47, 0.06, 0.27, 0, 1.3, 0, '#18f0ff'], [0.06, 0.9, 0.25, 0.19, 0.45, 0, '#18f0ff']],
    head: [[0.3, 0.1, 0.3, 0, 0.29, 0, '#ffe14a'], [0.24, 0.03, 0.16, 0, 0.25, 0.2, '#ffe14a'], [0.06, 0.16, 0.16, 0.155, 0.13, 0, '#ff2bd1'], [0.06, 0.16, 0.16, -0.155, 0.13, 0, '#ff2bd1'], [0.32, 0.04, 0.06, 0, 0.36, 0, '#22203a']] },
  MIMI: { skin: '#a56b43', top: '#ff8a3d', legs: '#ff8a3d', sleeve: '#a56b43',
    body: [[0.5, 0.5, 0.3, 0, 0.72, 0, '#ff8a3d'], [0.05, 0.6, 0.28, 0.1, 1.25, 0, '#ffe14a'], [0.47, 0.06, 0.27, 0, 0.95, 0, '#22203a']],
    head: [[0.34, 0.2, 0.3, 0, 0.3, -0.03, '#22203a'], [0.4, 0.3, 0.16, 0, 0.18, -0.12, '#22203a'], [0.16, 0.1, 0.06, 0.1, 0.4, 0.05, '#ff2bd1']] },
};
const bx = (a) => box(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);

function makeNPC(key, mat) {
  const o = LOOKS[key], g = new THREE.Group();
  const add = (geos, x, y, z) => { const m = new THREE.Mesh(merge(geos), mat); m.position.set(x, y, z); g.add(m); return m; };
  add([box(0.46, 0.6, 0.26, 0, 1.2, 0, o.top), box(0.36, 0.9, 0.24, 0, 0.45, 0, o.legs), box(0.12, 0.1, 0.12, 0, 1.53, 0, o.skin), ...o.body.map(bx)], 0, 0, 0);
  const head = add([box(0.25, 0.26, 0.25, 0, 0.13, 0, o.skin), box(0.05, 0.05, 0.02, -0.07, 0.15, 0.127, '#1b1830'), box(0.05, 0.05, 0.02, 0.07, 0.15, 0.127, '#1b1830'),
    box(0.1, 0.025, 0.02, 0, 0.06, 0.127, '#8a3a3a'), ...o.head.map(bx)], 0, 1.57, 0);
  const arm = (sx) => add([box(0.13, 0.5, 0.14, 0, -0.22, 0, o.sleeve), box(0.1, 0.1, 0.1, 0, -0.5, 0, o.skin)], sx * 0.3, 1.46, 0);
  return { key, g, head, armL: arm(1), armR: arm(-1), x: 0, y: 0, z: 0, yaw: 0, home: 0 };
}

// ---- shared shell ---------------------------------------------------------------------------
function shell(g, hx, hz, h, tileA, tileB, walls, ceil, doorNeon) {
  for (let x = -hx; x < hx; x += 1.5) for (let z = -hz; z < hz; z += 1.5) {
    g.push(box(1.5, 0.1, 1.5, x + 0.75, -0.05, z + 0.75, (Math.round(x / 1.5) + Math.round(z / 1.5)) % 2 ? tileA : tileB));
  }
  g.push(box(hx * 2 + 0.4, h + 0.2, 0.2, 0, h / 2, -hz - 0.1, walls[0]), box(hx * 2 + 0.4, h + 0.2, 0.2, 0, h / 2, hz + 0.1, walls[1]),
    box(0.2, h + 0.2, hz * 2, -hx - 0.1, h / 2, 0, walls[2]), box(0.2, h + 0.2, hz * 2, hx + 0.1, h / 2, 0, walls[2]), box(hx * 2 + 0.4, 0.2, hz * 2 + 0.4, 0, h + 0.1, 0, ceil));
  // the way out: a doorway full of sunset with a neon frame
  g.push(box(1.7, 2.7, 0.08, 0, 1.35, hz - 0.02, '#ffa64a'), box(1.7, 0.9, 0.09, 0, 0.45, hz - 0.02, '#ff6a8a'), box(1.9, 0.1, 0.1, 0, 2.75, hz - 0.06, doorNeon),
    box(0.1, 2.8, 0.1, -0.9, 1.4, hz - 0.06, doorNeon), box(0.1, 2.8, 0.1, 0.9, 1.4, hz - 0.06, doorNeon), box(0.8, 0.22, 0.05, 0, 3.05, hz - 0.05, '#8dff5a'));
}
const stool = (g, x, z, hex) => g.push(cyl(0.27, 0.27, 0.09, 10, x, 0.78, z, hex), cyl(0.05, 0.09, 0.76, 6, x, 0.38, z, '#c9c0d8'), cyl(0.22, 0.24, 0.04, 8, x, 0.02, z, '#c9c0d8'));

// ---- The Velvet Flamingo ----------------------------------------------------------------------
function buildBar(room) {
  const g = [];
  shell(g, 6, 4.5, 4.2, '#3d1f5c', '#1b0f30', ['#34185a', '#241040', '#2c1450'], '#120822', '#ff4fc0');
  g.push(box(7, 1.1, 0.8, 0, 0.55, -2.2, '#5a2468'), box(7.3, 0.08, 1.05, 0, 1.14, -2.2, '#ffc7ea'), box(7, 0.06, 0.06, 0, 0.22, -1.78, '#ff2bd1'), box(7.3, 0.05, 0.05, 0, 1.07, -1.68, '#18f0ff'));
  for (const x of [-2.6, -1.3, 1.7, 2.9]) stool(g, x, -1.15, '#ff4fa3');
  for (const y of [1.55, 2.2]) {
    g.push(box(6.6, 0.07, 0.34, 0, y, -4.25, '#7a3d78'));
    for (let i = 0; i < 15; i++) if ((i * 7 + (y > 2 ? 3 : 0)) % 5) g.push(box(0.13, 0.3 + (i % 3) * 0.07, 0.13, -3 + i * 0.43, y + 0.2 + (i % 3) * 0.035, -4.25, NEON[(i + (y > 2 ? 2 : 0)) % 6]));
  }
  g.push(box(6.8, 0.06, 0.06, 0, 2.95, -4.4, '#18f0ff'), box(6.8, 0.06, 0.06, 0, 1.38, -4.4, '#18f0ff'));
  const P = '#ff4fc0', nx = 4.4, nz = -4.4;                    // the house flamingo in neon
  g.push(box(0.07, 1, 0.07, nx, 1.5, nz, P), box(0.9, 0.5, 0.07, nx - 0.1, 2.25, nz, P, 0, 0, 0.25), box(0.07, 0.9, 0.07, nx + 0.5, 2.9, nz, P, 0, 0, -0.35), box(0.3, 0.24, 0.07, nx + 0.7, 3.4, nz, P), box(0.28, 0.07, 0.07, nx + 0.95, 3.27, nz, '#ffe14a', 0, 0, -0.5));
  g.push(box(1.2, 1.5, 0.7, -5.3, 0.75, 1.2, '#7a1a6a'), cyl(0.6, 0.6, 0.7, 12, -5.3, 1.5, 1.2, '#7a1a6a', PI / 2), box(0.06, 1.3, 0.5, -4.68, 0.9, 1.2, '#ffe14a'),
    box(0.07, 0.5, 0.36, -4.67, 1.45, 1.2, '#18f0ff'), box(0.07, 0.12, 0.5, -4.67, 0.5, 1.2, '#ff2bd1'), box(0.07, 0.12, 0.5, -4.67, 0.3, 1.2, '#8dff5a'));
  for (const [x, z] of [[4.2, 1.6], [3.4, -0.2]]) { g.push(cyl(0.55, 0.55, 0.06, 12, x, 0.8, z, '#ffc7ea'), cyl(0.06, 0.06, 0.8, 6, x, 0.4, z, '#c9c0d8'), cyl(0.05, 0.05, 0.14, 6, x, 0.9, z, '#ffe14a')); stool(g, x + 0.9, z + 0.2, '#18f0ff'); }
  g.push(box(10, 0.06, 0.06, 0, 4.05, -1.5, '#18f0ff'), box(10, 0.06, 0.06, 0, 4.05, 1.5, '#ff2bd1'));
  // framed lease notice by the door, because somebody is three months behind
  g.push(box(0.7, 0.9, 0.04, -2.2, 1.9, 4.42, '#fff6ec'), box(0.5, 0.06, 0.05, -2.2, 2.15, 4.4, '#ff4f6a'), box(0.5, 0.04, 0.05, -2.2, 1.95, 4.4, '#22203a'), box(0.5, 0.04, 0.05, -2.2, 1.8, 4.4, '#22203a'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4.2, geo: g,
    blocks: [{ x0: -3.7, x1: 3.7, z0: -4.5, z1: -1.7 }, { x0: -6, x1: -4.6, z0: 0.7, z1: 1.7 }, { x0: 3.7, x1: 4.7, z0: 1.1, z1: 2.1 }, { x0: 2.9, x1: 3.9, z0: -0.7, z1: 0.3 }],
    me: [0.7, -0.95], cast: { DEE: [-0.3, -3.15, 0] }, use: { x: 0.4, z: -1.1, r: 1.5 }, wide: [4.6, 2.4, 3.2, -0.5, 1.25, -1.8],
    idle(t) { const d = room.npc.DEE; d.armL.rotation.set(-1.15, 0, Math.sin(t * 5) * 0.35 - 0.3); },   // Dee never stops polishing
  });
}

// ---- Club Prism ---------------------------------------------------------------------------------
export const FLOOR = { nx: 6, nz: 4, size: 1.3, cx: 0, cz: 0.2 };
function buildClub(room, scene) {
  const g = [], F = FLOOR;
  shell(g, 8, 6, 5, '#15102c', '#1c1438', ['#1a0f3a', '#120a2a', '#160c32'], '#0a0618', '#a98bff');
  // DJ booth with an equaliser front, speaker stacks either side
  g.push(box(5.4, 0.6, 2, 0, 0.3, -5, '#2a1a5a'), box(3.6, 0.55, 0.8, 0, 1.2, -4.3, '#3a2a7a'), box(3.7, 0.06, 0.9, 0, 1.5, -4.3, '#18f0ff'),
    cyl(0.36, 0.36, 0.05, 14, -0.9, 1.55, -4.3, '#0c0c10'), cyl(0.36, 0.36, 0.05, 14, 0.9, 1.55, -4.3, '#0c0c10'), cyl(0.1, 0.1, 0.06, 8, -0.9, 1.56, -4.3, '#ff2bd1'), cyl(0.1, 0.1, 0.06, 8, 0.9, 1.56, -4.3, '#ffe14a'), box(0.5, 0.1, 0.4, 0, 1.56, -4.3, '#c9c0d8'));
  for (let i = 0; i < 12; i++) g.push(box(0.2, 0.15 + ((i * 5) % 7) * 0.09, 0.05, -1.5 + i * 0.27, 0.8 + ((i * 5) % 7) * 0.045, -3.88, NEON[i % 6]));
  for (const sx of [-1, 1]) for (const y of [0, 1.5]) {
    g.push(box(1.4, 1.45, 1, sx * 4.2, y + 0.73, -5.3, '#17122a'), cyl(0.42, 0.42, 0.06, 12, sx * 4.2, y + 0.55, -4.78, '#3a3550', PI / 2), cyl(0.18, 0.18, 0.07, 10, sx * 4.2, y + 1.15, -4.78, '#55506a', PI / 2));
  }
  // prism logo on the back wall
  const seg = (x0, y0, x1, y1, hex) => g.push(box(Math.hypot(x1 - x0, y1 - y0), 0.09, 0.07, (x0 + x1) / 2, (y0 + y1) / 2, -5.92, hex, 0, 0, Math.atan2(y1 - y0, x1 - x0)));
  seg(-0.9, 3, 0.9, 3, '#f4f0ff'); seg(-0.9, 3, 0, 4.5, '#f4f0ff'); seg(0.9, 3, 0, 4.5, '#f4f0ff'); seg(-3, 3.3, -0.45, 3.7, '#ffffff');
  seg(0.45, 3.8, 3.2, 4.4, '#ff2bd1'); seg(0.45, 3.7, 3.2, 3.8, '#ffe14a'); seg(0.45, 3.6, 3.2, 3.2, '#18f0ff');
  // bar down the left wall, VIP sofa on the right
  g.push(box(0.9, 1.1, 5, -7.2, 0.55, 0.5, '#3a1a6a'), box(1.1, 0.08, 5.2, -7.2, 1.14, 0.5, '#d9c7ff'), box(0.06, 0.06, 5, -6.72, 0.25, 0.5, '#ff2bd1'));
  for (let i = 0; i < 9; i++) g.push(box(0.13, 0.34, 0.13, -7.8, 1.9, -1.6 + i * 0.5, NEON[i % 6]));
  g.push(box(0.3, 0.06, 4.6, -7.8, 1.7, 0.5, '#5a3d98'));
  for (const z of [-1, 0.5, 2]) stool(g, -6.2, z, '#a98bff');
  g.push(box(1, 0.5, 4, 7.3, 0.25, 0, '#b0246a'), box(0.3, 1.1, 4, 7.75, 0.55, 0, '#8a1a52'), box(1, 0.5, 0.9, 6.4, 0.25, -2.4, '#b0246a'),
    cyl(0.5, 0.5, 0.06, 12, 6, 0.6, 0, '#d9c7ff'), cyl(0.06, 0.06, 0.6, 6, 6, 0.3, 0, '#c9c0d8'), box(1.6, 0.06, 0.06, 7.2, 2.6, -2.9, '#ffd166'), box(0.06, 0.06, 5.8, 7.92, 2.6, 0, '#ffd166'));
  // velvet rope by the door, ceiling truss
  for (const x of [-2, 2]) g.push(cyl(0.06, 0.08, 1, 6, x, 0.5, 4.6, '#ffd166'));
  g.push(box(13, 0.12, 0.12, 0, 4.7, -1.5, '#3a3550'), box(13, 0.12, 0.12, 0, 4.7, 2, '#3a3550'), box(0.12, 0.12, 9, -3, 4.7, 0, '#3a3550'), box(0.12, 0.12, 9, 3, 4.7, 0, '#3a3550'));
  for (let i = 0; i < 8; i++) g.push(box(0.3, 0.3, 0.3, -5.25 + i * 1.5, 4.5, i % 2 ? -1.5 : 2, NEON[i % 6]));

  // dance floor: one quad, the tiles are drawn (and animated) in the shader
  const fU = { uTime: timeU, uHot: { value: new THREE.Vector2(-1, -1) }, uCalm: { value: 0 } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(F.nx * F.size, F.nz * F.size).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: fU, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uCalm; uniform vec2 uHot; varying vec2 vUv;
      vec3 pal(float h){ return 0.55 + 0.45 * cos(6.2832 * (h + vec3(0.0, 0.33, 0.67))); }
      void main(){
        vec2 p = vec2(vUv.x, 1.0 - vUv.y) * vec2(${F.nx}.0, ${F.nz}.0), c = floor(p), f = fract(p);
        float beat = floor(uTime / ${BEAT.toFixed(4)}), ph = fract(uTime / ${BEAT.toFixed(4)});
        float h = fract(sin(dot(c + beat * 0.37, vec2(12.9898, 78.233))) * 43758.5453);
        float on = step(0.45, fract(h * 7.0 + c.x * 0.13));
        vec3 col = pal(h + c.y * 0.07) * mix(0.16, 1.0, on) * (1.0 - 0.45 * ph) * mix(1.0, 0.3, uCalm);
        float hot = step(abs(c.x - uHot.x) + abs(c.y - uHot.y), 0.1);
        col = mix(col, vec3(1.0) * (0.75 + 0.25 * sin(uTime * 14.0)), hot);
        float edge = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.05, f.y) * smoothstep(1.0, 0.95, f.y);
        col *= mix(0.12, 1.0, edge) * (0.8 + 0.2 * smoothstep(0.7, 0.0, length(f - 0.5)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  floor.position.set(F.cx, 0.012, F.cz);

  // mirror ball and four sweeping beams
  const ballG = new THREE.SphereGeometry(0.55, 12, 8).toNonIndexed(), r = rng(7);
  { const n = ballG.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 6) { const k = 0.35 + r() * 0.65; for (let j = 0; j < 18; j++) col[i * 3 + j] = k * (j % 3 === 2 ? 1 : 0.92); }
    ballG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const ball = new THREE.Mesh(ballG, room.mat);
  ball.position.set(0, 4.05, 0.2);
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.CylinderGeometry(0.04, 1.5, 5.2, 10, 1, true).translate(0, -2.6, 0).rotateZ(0.45).rotateY(i * PI / 2);
    beams.push(tint(c, NEON[[0, 1, 2, 5][i]]));
  }
  const beam = new THREE.Mesh(merge(beams), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.set(0, 4.6, 0.2);

  // the crowd: clothes (tinted per dancer), skin + hair, and two arms each
  const N = 12, spots = [];
  for (let i = 0; i < N; i++) {
    const edge = i < 7, a = i * 2.4;
    spots.push(edge ? [(i % 2 ? -1 : 1) * (4.6 + (i % 3) * 0.5), -2.6 + i * 0.85, r() * 6] : [Math.cos(a) * (1.2 + (i % 3) * 0.9), 0.3 + Math.sin(a) * 1.5, r() * 6]);
  }
  const cloth = new THREE.InstancedMesh(merge([box(0.44, 0.58, 0.25, 0, 1.2, 0, '#ffffff'), box(0.36, 0.5, 0.24, 0, 0.66, 0, '#e8e8e8'), box(0.15, 0.42, 0.18, -0.1, 0.21, 0, '#9a9a9a'), box(0.15, 0.42, 0.18, 0.1, 0.21, 0, '#9a9a9a')]), room.mat, N);
  const skin = new THREE.InstancedMesh(merge([box(0.24, 0.25, 0.24, 0, 1.68, 0, '#ffffff'), box(0.26, 0.11, 0.26, 0, 1.79, -0.01, '#3a3040'), box(0.12, 0.1, 0.12, 0, 1.53, 0, '#e8e8e8')]), room.mat, N);
  const arms = new THREE.InstancedMesh(merge([box(0.12, 0.5, 0.13, 0, -0.22, 0, '#ffffff'), box(0.1, 0.1, 0.1, 0, -0.5, 0, '#c8a890')]), room.mat, N * 2);
  const col = new THREE.Color(), SK = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e'];
  const TOPS = ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c', '#9b7bff', '#8dff9a', '#ff3f6a', '#f6f1e7'];
  for (let i = 0; i < N; i++) { cloth.setColorAt(i, col.set(TOPS[i % 8])); skin.setColorAt(i, col.set(SK[i % 5])); arms.setColorAt(i * 2, col.set(TOPS[i % 8])); arms.setColorAt(i * 2 + 1, col.set(TOPS[i % 8])); }
  for (const m of [cloth, skin, arms]) m.frustumCulled = false;
  const B = new THREE.Matrix4(), A = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

  Object.assign(room, {
    hx: 8, hz: 6, h: 5, geo: g, extras: [floor, ball, beam, cloth, skin, arms],
    blocks: [{ x0: -2.8, x1: 2.8, z0: -6, z1: -3.7 }, { x0: -5, x1: -3.4, z0: -6, z1: -4.7 }, { x0: 3.4, x1: 5, z0: -6, z1: -4.7 }, { x0: -8, x1: -6.6, z0: -2.1, z1: 3.1 }, { x0: 6.7, x1: 8, z0: -2.9, z1: 2.1 }],
    me: [1.3, -1.6], cast: { KILO: [0, -5.05, 0, 0.6], GLITZ: [4.3, -0.9, -1.2] }, wide: [-5.6, 3.3, 4.6, 1, 1.2, -2.4],
    floorU: fU,
    // which dance-floor tile is (x, z) on? -> [i, j] or null
    tileAt(x, z) {
      const i = Math.floor((x - F.cx) / F.size + F.nx / 2), j = Math.floor((z - F.cz) / F.size + F.nz / 2);
      return i >= 0 && i < F.nx && j >= 0 && j < F.nz ? [i, j] : null;
    },
    idle(t, dt, still) {
      ball.rotation.y = t * 0.5;
      if (!still) beam.rotation.y = t * 0.7;
      const beat = t / BEAT;
      for (let i = 0; i < N; i++) {
        const s = spots[i], ph = s[2], style = i % 3, hop = still ? 0 : Math.abs(Math.sin(beat * PI + ph)) * 0.11;
        B.compose(v.set(s[0], hop, s[1]), q.setFromEuler(e.set(0, ph + Math.sin(beat * PI * 0.5 + ph) * 0.7, Math.sin(beat * PI + ph) * 0.07)), one);
        cloth.setMatrixAt(i, B); skin.setMatrixAt(i, B);
        for (let k = 0; k < 2; k++) {
          const sg = k ? -1 : 1, w = Math.sin(beat * PI * (style === 1 ? 2 : 1) + ph + k * (style ? PI : 0));
          if (style === 0) e.set(0, 0, sg * (2.5 + w * 0.3)); else if (style === 1) e.set(-1.9 + w * 0.7, 0, sg * 0.2); else e.set(-0.6 + w * 0.5, 0, sg * (0.9 + w * 0.5));
          A.compose(v.set(sg * 0.29, 1.46, 0), q.setFromEuler(e), one);
          arms.setMatrixAt(i * 2 + k, M.multiplyMatrices(B, A));
        }
      }
      cloth.instanceMatrix.needsUpdate = skin.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
      const k = room.npc.KILO;                                         // one hand on the deck, one in the air
      k.armL.rotation.set(-1.2, 0, 0.2); k.armR.rotation.set(0, 0, -2.6 + Math.sin(beat * PI * 2) * 0.25); k.head.rotation.x = Math.sin(beat * PI * 2) * 0.12;
    },
  });
}

// ---- Zigzag Threads -----------------------------------------------------------------------------
function buildWear(room) {
  const g = [];
  shell(g, 6, 4.5, 4.2, '#ffd9e6', '#fff6ec', ['#ffb36b', '#ff9a5c', '#ffc38a'], '#fff0d8', '#ff9a3d');
  // zigzag dado along the back wall
  for (let i = 0; i < 12; i++) g.push(box(1.1, 0.14, 0.05, -5.5 + i, 3.2, -4.46, i % 2 ? '#ff2bd1' : '#18f0ff', 0, 0, i % 2 ? 0.5 : -0.5));
  // rails of jackets along both side walls
  for (const sx of [-1, 1]) {
    g.push(box(0.06, 0.06, 5.6, sx * 5.5, 2, -0.6, '#c9c0d8'), box(0.06, 2, 0.06, sx * 5.5, 1, -3.4, '#c9c0d8'), box(0.06, 2, 0.06, sx * 5.5, 1, 2.2, '#c9c0d8'));
    for (let i = 0; i < 13; i++) {
      const c = NEON[(i * 5 + (sx > 0 ? 2 : 0)) % 6], z = -3.2 + i * 0.43;
      g.push(box(0.5, 0.75, 0.1, sx * 5.45, 1.55, z, c), box(0.52, 0.1, 0.11, sx * 5.45, 1.25, z, '#fff6ec'), box(0.2, 0.5, 0.09, sx * 5.2, 1.6, z, c));
    }
    g.push(box(0.7, 0.3, 5.4, sx * 5.5, 0.15, -0.6, '#ff8fc4'));
    for (let i = 0; i < 6; i++) g.push(box(0.3, 0.14, 0.5, sx * 5.5, 0.37, -3 + i * 0.95, i % 2 ? '#fff6ec' : '#22203a'));
  }
  // fitting podium and a three-panel mirror
  g.push(cyl(1.1, 1.2, 0.2, 18, -2.2, 0.1, -2.6, '#ff2bd1'), cyl(0.95, 0.95, 0.03, 18, -2.2, 0.215, -2.6, '#fff6ec'));
  for (const [x, ry] of [[-3.5, 0.5], [-2.2, 0], [-0.9, -0.5]]) g.push(box(1.2, 2.5, 0.06, x, 1.45, -4.2 + Math.abs(ry) * 0.6, '#bfe9ff', 0, ry), box(1.3, 0.1, 0.08, x, 2.75, -4.19 + Math.abs(ry) * 0.6, '#ffe14a', 0, ry));
  // counter with a till, two mannequins in the window
  g.push(box(2.4, 1, 0.8, 3.2, 0.5, -2.2, '#7a3cff'), box(2.6, 0.08, 1, 3.2, 1.04, -2.2, '#fff6ec'), box(0.5, 0.35, 0.4, 3.9, 1.25, -2.2, '#22203a'), box(0.4, 0.2, 0.05, 3.9, 1.5, -2.35, '#8dff5a'));
  [[-3.6, '#ff7a2f', '#ffd84a'], [3.6, '#3a1d8a', '#18f0ff']].forEach(([x, a, b]) => {
    g.push(cyl(0.4, 0.45, 0.12, 10, x, 0.06, 3.4, '#22203a'), box(0.3, 0.8, 0.2, x, 0.6, 3.4, '#e8dccc'), box(0.46, 0.6, 0.27, x, 1.3, 3.4, a), box(0.48, 0.08, 0.29, x, 1.07, 3.4, b),
      box(0.14, 0.5, 0.15, x - 0.3, 1.28, 3.4, b), box(0.14, 0.5, 0.15, x + 0.3, 1.28, 3.4, b), box(0.22, 0.24, 0.22, x, 1.75, 3.4, '#e8dccc'));
  });
  g.push(box(8, 0.06, 0.06, 0, 4.05, 0, '#ff2bd1'), box(0.06, 0.06, 7, 0, 4.05, 0, '#ffe14a'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4.2, geo: g,
    blocks: [{ x0: -6, x1: -5, z0: -3.6, z1: 2.4 }, { x0: 5, x1: 6, z0: -3.6, z1: 2.4 }, { x0: 2, x1: 4.4, z0: -4.5, z1: -1.8 }, { x0: -4, x1: -0.4, z0: -4.5, z1: -3.9 }, { x0: -4, x1: -3.2, z0: 3, z1: 3.8 }, { x0: 3.2, x1: 4, z0: 3, z1: 3.8 }],
    me: [0.6, -0.6], cast: { MIMI: [3.1, -3.1, -0.5] }, use: { x: -2.2, z: -2.2, r: 1.5 }, wide: [4.6, 2.6, 3.4, -1.5, 1.2, -2],
    idle(t) { const m = room.npc.MIMI; m.armR.rotation.set(-0.9 + Math.sin(t * 2) * 0.15, 0, -0.2); m.head.rotation.z = Math.sin(t * 0.8) * 0.08; },
  });
}

// ---- Pelican Pantry 24 ----------------------------------------------------------------------------
function buildMart(room) {
  const g = [], r = rng(24);
  shell(g, 6, 4.5, 4, '#e9fbf6', '#bfeee2', ['#f4fff9', '#e2f7ee', '#eafaf2'], '#ffffff', '#5dff9a');
  // fridge wall: glowing doors full of cans
  for (let i = 0; i < 6; i++) {
    const x = -4.9 + i * 1.5;
    g.push(box(1.4, 2.6, 0.5, x, 1.3, -4.2, '#dff9ff'), box(1.3, 2.4, 0.06, x, 1.3, -3.93, '#9fe8ff'), box(0.06, 2.6, 0.56, x + 0.72, 1.3, -4.2, '#c9c0d8'), box(0.05, 0.5, 0.05, x + 0.5, 1.3, -3.88, '#6a7a8a'));
    for (let s = 0; s < 4; s++) for (let k = 0; k < 5; k++) g.push(box(0.16, 0.3, 0.16, x - 0.48 + k * 0.24, 0.35 + s * 0.6, -3.86, NEON[Math.floor(r() * 6)]));
  }
  g.push(box(9.2, 0.3, 0.6, -1.15, 2.8, -4.15, '#27c9bf'));
  // two aisles of shelves
  for (const x of [-3.2, -0.4]) {
    g.push(box(0.9, 1.7, 3.6, x, 0.85, -0.3, '#fbf7f0'), box(1, 0.08, 3.7, x, 1.74, -0.3, '#ff8fc4'));
    for (const sx of [-1, 1]) for (let s = 0; s < 3; s++) for (let k = 0; k < 9; k++) {
      g.push(box(0.1, 0.28 + (k % 3) * 0.06, 0.3, x + sx * 0.47, 0.35 + s * 0.5, -1.9 + k * 0.4, NEON[Math.floor(r() * 6)]));
    }
  }
  // counter: till, hot-dog roller, slush machine. Gus stands behind it.
  g.push(box(1, 1, 3.4, 3.6, 0.5, 0.6, '#27c9bf'), box(1.2, 0.08, 3.6, 3.6, 1.04, 0.6, '#fff6ec'), box(0.06, 0.4, 3.4, 3.08, 0.5, 0.6, '#ff4fa3'),
    box(0.45, 0.35, 0.5, 3.6, 1.25, 1.6, '#22203a'), box(0.05, 0.22, 0.4, 3.36, 1.5, 1.6, '#8dff5a'),
    box(0.6, 0.14, 0.8, 3.6, 1.15, 0.4, '#c9c0d8'), cyl(0.05, 0.05, 0.7, 6, 3.5, 1.27, 0.4, '#c9603a', PI / 2), cyl(0.05, 0.05, 0.7, 6, 3.7, 1.27, 0.4, '#c9603a', PI / 2),
    box(0.7, 0.5, 0.6, 3.6, 1.33, -0.7, '#f4f0ff'), cyl(0.2, 0.2, 0.55, 10, 3.45, 1.85, -0.7, '#ff4fa3'), cyl(0.2, 0.2, 0.55, 10, 3.78, 1.85, -0.7, '#27e8ff'));
  // cigarette-free back wall: a pelican made of neon tubes, a clock, the freezer with the shoebox
  const P = '#ffe14a';
  g.push(box(0.9, 0.5, 0.06, 5.9, 2.8, 0.4, '#fff6ec', 0, 0, 0), box(0.07, 0.9, 0.5, 5.92, 2.75, 0.4, '#fff6ec'), box(0.07, 0.3, 0.9, 5.92, 2.75, 1.1, P), box(0.07, 0.1, 0.5, 5.92, 3.2, 0.2, '#22203a'));
  g.push(box(1.6, 0.9, 0.8, 5.1, 0.45, -3.2, '#f4fff9'), box(1.6, 0.06, 0.8, 5.1, 0.93, -3.2, '#9fe8ff'), box(0.4, 0.22, 0.26, 5.1, 1.07, -3.2, '#c98d62'));
  for (const z of [-2, 0.5, 3]) g.push(box(9, 0.08, 0.3, 0, 3.92, z, '#ffffff'));
  g.push(box(1.2, 0.5, 0.06, -4.6, 2.2, 4.42, '#ff4f6a'), box(1, 0.08, 0.07, -4.6, 2.3, 4.4, '#fff6ec'), box(0.7, 0.08, 0.07, -4.6, 2.1, 4.4, '#fff6ec'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4, geo: g,
    blocks: [{ x0: -6, x1: 4.6, z0: -4.5, z1: -3.6 }, { x0: -3.75, x1: -2.65, z0: -2.2, z1: 1.6 }, { x0: -0.95, x1: 0.15, z0: -2.2, z1: 1.6 }, { x0: 3, x1: 6, z0: -1.2, z1: 2.4 }, { x0: 4.2, x1: 6, z0: -3.7, z1: -2.7 }],
    me: [1.7, 0.5], cast: { GUS: [4.8, 0.5, -PI / 2] }, use: { x: 2.3, z: 0.6, r: 1.5 }, wide: [-1.6, 2.7, 3.6, 3.4, 1.2, 0.2],
    idle(t) { const n = room.npc.GUS; n.head.rotation.y = Math.sin(t * 1.7) * 0.5 * (Math.sin(t * 0.4) > 0 ? 1 : 0.1); n.armR.rotation.set(-0.5, 0, Math.sin(t * 9) * 0.05); n.armL.rotation.set(-0.5, 0, 0); },
  });
}

const BUILD = { bar: buildBar, club: buildClub, wear: buildWear, mart: buildMart };

// Build a room for a place. `place` is { key, b: building } from the layout.
export function buildRoom(place, scene) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const room = { key: place.key, mat, npc: {}, extras: [], ox: place.b.cx, oz: place.b.cz, idle() {} };
  BUILD[place.key](room, scene);
  const group = room.group = new THREE.Group();
  group.add(new THREE.Mesh(merge(room.geo), mat), ...room.extras);
  room.geo = null;
  for (const key in room.cast) {
    const [x, z, yaw, y = 0] = room.cast[key], n = room.npc[key] = makeNPC(key, mat);
    Object.assign(n, { x, y, z, yaw, home: yaw });
    n.g.position.set(x, y, z); n.g.rotation.y = yaw;
    group.add(n.g);
  }
  group.position.set(room.ox, OY, room.oz);
  group.visible = false;
  scene.add(group);
  return room;
}
