// The four interiors and the people in them. Each room is built the first time you walk in
// (one merged unlit mesh plus a few animated extras), parked 90 units under its own building
// and only visible while you are inside. Rooms are authored around (0, 0, 0); the door is on +z.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng, beatU, section, angleDelta } from '../core/util.js';
import { newPose, dancePose, cheerPose, sitPose, blendPose } from '../actors/moves.js';

export const OY = -90;
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
  TAPS: { skin: '#e0a878', top: '#f6f1e7', legs: '#22203a', sleeve: '#f6f1e7',
    body: [[0.47, 0.5, 0.27, 0, 1.2, 0, '#22203a'], [0.14, 0.5, 0.02, 0, 1.22, 0.14, '#f6f1e7'], [0.18, 0.07, 0.03, 0, 1.47, 0.15, '#ff2bd1']],
    head: [[0.27, 0.08, 0.27, 0, 0.27, -0.01, '#1b1830'], [0.27, 0.16, 0.08, 0, 0.18, -0.11, '#1b1830'], [0.14, 0.03, 0.02, 0, 0.09, 0.127, '#1b1830']] },
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
    seats: [...[-2.6, -1.3, 1.7, 2.9].map((x) => ({ x, z: -1.15, y: 0.83, yaw: PI, kind: 'stool' })),
      { x: 5.1, z: 1.8, y: 0.83, yaw: Math.atan2(-0.9, -0.2), kind: 'stool' }, { x: 4.3, z: 0, y: 0.83, yaw: Math.atan2(-0.9, -0.2), kind: 'stool' }],
    me: [0.7, -0.95], cast: { DEE: [-0.3, -3.15, 0] }, use: { x: 0.4, z: -1.1, r: 1.5 }, wide: [4.6, 2.4, 3.2, -0.5, 1.25, -1.8],
    idle(t) { const d = room.npc.DEE; d.armL.rotation.set(-1.15, 0, Math.sin(t * 5) * 0.35 - 0.3); },   // Dee never stops polishing
  });
}

// ---- Club Prism ---------------------------------------------------------------------------------
// A big room on one shared BPM clock (beatU, locked to the synth): a raised DJ booth with decks,
// a mixer full of blinking LEDs and speaker stacks that thump with the kick, a light-tile floor
// whose pattern changes every bar, a mirror ball throwing moving spots, lasers through the haze,
// a bar with a bartender, booths, a VIP corner, a coat check and a crowd of 29 that dances in time.
export const FLOOR = { nx: 8, nz: 6, size: 1.3, cx: 0, cz: -0.9 };
const CROWD_TOPS = ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c', '#9b7bff', '#8dff9a', '#ff3f6a', '#f6f1e7', '#7fe0ff', '#ffb000'];
const CROWD_LEGS = ['#22203a', '#3b5a9a', '#f6f1e7', '#2f8f86', '#6a3fb8', '#c9b38a'];
const SKINS = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
// little helper: a geometry with a per-vertex float attribute (for the shader-animated parts)
function withAttr(geo, name, size, val) {
  const n = geo.attributes.position.count, a = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) a[i * size + k] = Array.isArray(val) ? val[k] : val;
  geo.setAttribute(name, new THREE.BufferAttribute(a, size));
  return geo;
}
function buildClub(room) {
  const g = [], F = FLOOR, HX = 11, HZ = 8, H = 6, r = rng(7);
  shell(g, HX, HZ, H, '#15102c', '#1c1438', ['#1a0f3a', '#120a2a', '#160c32'], '#0a0618', '#a98bff');
  // neon tube on the back / side walls
  const segZ = (x0, y0, x1, y1, z, hex, t = 0.09) => g.push(box(Math.hypot(x1 - x0, y1 - y0) + t, t, t, (x0 + x1) / 2, (y0 + y1) / 2, z, hex, 0, 0, Math.atan2(y1 - y0, x1 - x0)));
  const segX = (z0, y0, z1, y1, x, hex, t = 0.09) => g.push(box(t, t, Math.hypot(z1 - z0, y1 - y0) + t, x, (y0 + y1) / 2, (z0 + z1) / 2, hex, Math.atan2(-(y1 - y0), z1 - z0)));

  // --- raised DJ booth
  g.push(box(8.2, 0.7, 2.8, 0, 0.35, -6.6, '#241650'), box(8.24, 0.08, 0.08, 0, 0.7, -5.2, '#18f0ff'), box(8.24, 0.06, 0.06, 0, 0.08, -5.18, '#ff2bd1'));
  g.push(box(5, 1.0, 0.9, 0, 1.2, -5.75, '#2a1a5a'), box(5.2, 0.06, 1.0, 0, 1.73, -5.75, '#3a2a7a'), box(5.22, 0.04, 0.04, 0, 1.75, -5.24, '#18f0ff'));
  for (let i = 0; i < 16; i++) { const k = (i * 5) % 7; g.push(box(0.22, 0.12 + k * 0.08, 0.04, -2.1 + i * 0.28, 0.85 + k * 0.04, -5.28, NEON[i % 6])); }
  for (const sx of [-1, 1]) {
    const x = sx * 1.45;
    g.push(box(1.0, 0.1, 0.8, x, 1.8, -5.8, '#17122a'), cyl(0.36, 0.36, 0.04, 16, x, 1.87, -5.8, '#0c0c10'), cyl(0.1, 0.1, 0.05, 10, x, 1.89, -5.8, sx < 0 ? '#ff2bd1' : '#ffe14a'),
      box(0.04, 0.03, 0.45, x + 0.35, 1.9, -5.75, '#c9c0d8', 0, 0.3));
  }
  g.push(box(0.8, 0.12, 0.6, 0, 1.82, -5.8, '#3a3550'));
  // back wall: the prism logo in neon, a big one
  segZ(-1.5, 3, 1.5, 3, -7.92, '#f4f0ff'); segZ(-1.5, 3, 0, 5.2, -7.92, '#f4f0ff'); segZ(1.5, 3, 0, 5.2, -7.92, '#f4f0ff'); segZ(-5, 3.4, -0.7, 4.0, -7.92, '#ffffff');
  segZ(0.7, 4.1, 5.2, 5.0, -7.92, '#ff2bd1'); segZ(0.7, 4.0, 5.2, 4.2, -7.92, '#ffe14a'); segZ(0.7, 3.9, 5.2, 3.4, -7.92, '#18f0ff');
  // speaker stacks either side of the booth
  for (const sx of [-1, 1]) {
    const x = sx * 5.3;
    g.push(box(1.7, 1.8, 1.4, x, 0.9, -7.1, '#17122a'), box(1.4, 1.3, 1.2, x, 2.45, -7.1, '#1d1734'), box(1.0, 0.7, 1.0, x, 3.45, -7.1, '#17122a'),
      box(1.72, 0.04, 1.42, x, 1.8, -7.1, '#a98bff'), box(1.42, 0.04, 1.22, x, 3.1, -7.1, '#a98bff'));
  }
  // --- the bar down the left wall, bottles on lit shelves, a cocktail glass in neon
  g.push(box(1.0, 1.15, 7.6, -8.9, 0.575, -2.6, '#3a1a6a'), box(1.3, 0.08, 7.8, -8.9, 1.17, -2.6, '#d9c7ff'), box(0.05, 0.06, 7.6, -8.38, 0.25, -2.6, '#ff2bd1'), box(0.05, 0.05, 7.6, -8.38, 1.05, -2.6, '#18f0ff'));
  g.push(box(0.06, 1.8, 7.4, -10.94, 2.0, -2.6, '#4a3a8a'));
  for (const y of [1.45, 2.15]) {
    g.push(box(0.45, 0.06, 7.2, -10.7, y, -2.6, '#7a5cff'), box(0.46, 0.03, 7.2, -10.7, y - 0.05, -2.6, '#ffe14a'));
    for (let i = 0; i < 18; i++) { const hgt = 0.25 + r() * 0.15; g.push(cyl(0.055, 0.065, hgt, 6, -10.7, y + 0.03 + hgt / 2, -6 + i * 0.4, NEON[Math.floor(r() * 6)])); }
  }
  segX(-3.6, 4.4, -2.6, 3.4, -10.92, '#18f0ff'); segX(-1.6, 4.4, -2.6, 3.4, -10.92, '#18f0ff'); segX(-3.6, 4.4, -1.6, 4.4, -10.92, '#18f0ff');
  segX(-2.6, 3.4, -2.6, 2.9, -10.92, '#18f0ff'); segX(-3.0, 2.9, -2.2, 2.9, -10.92, '#18f0ff'); segX(-2.2, 4.2, -1.8, 4.9, -10.92, '#8dff5a');
  const BSTOOL = [-5.5, -4.2, -2.9, -1.6, -0.3];
  for (const z of BSTOOL) stool(g, -7.85, z, '#a98bff');
  // --- booths along the right wall
  const BOOTH = [-5.4, -1.8, 1.8];
  for (const zc of BOOTH) {
    g.push(box(0.35, 1.2, 3.1, 10.8, 0.6, zc, '#8a1a52'), box(0.9, 0.45, 3.0, 10.2, 0.225, zc, '#b0246a'), box(0.85, 0.08, 2.9, 10.2, 0.49, zc, '#d63a86'));
    for (const e of [-1, 1]) g.push(box(1.2, 0.8, 0.25, 10.4, 0.4, zc + e * 1.55, '#8a1a52'));
    g.push(cyl(0.5, 0.5, 0.06, 12, 8.9, 0.6, zc, '#d9c7ff'), cyl(0.07, 0.1, 0.6, 6, 8.9, 0.3, zc, '#c9c0d8'), cyl(0.06, 0.05, 0.16, 6, 8.75, 0.71, zc + 0.15, '#ffe14a'), cyl(0.06, 0.05, 0.16, 6, 9.05, 0.71, zc - 0.2, '#18f0ff'));
  }
  // neon palm and waves over the booths
  segX(-1.8, 2.2, -1.6, 4.6, 10.92, '#ffb000'); segX(-1.6, 4.6, -3.2, 3.9, 10.92, '#8dff5a'); segX(-1.6, 4.6, -0.2, 4.0, 10.92, '#8dff5a'); segX(-1.6, 4.6, -2.6, 5.2, 10.92, '#8dff5a'); segX(-1.6, 4.6, -0.6, 5.3, 10.92, '#8dff5a');
  for (let i = 0; i < 6; i++) { segX(-6.5 + i * 1.1, 1.75 + (i % 2) * 0.3, -5.4 + i * 1.1, 1.75 + ((i + 1) % 2) * 0.3, 10.92, '#18f0ff'); segX(1 + i * 1.1, 1.75 + (i % 2) * 0.3, 2.1 + i * 1.1, 1.75 + ((i + 1) % 2) * 0.3, 10.92, '#18f0ff'); }
  // --- the VIP corner behind a velvet rope
  g.push(box(4.0, 0.45, 0.9, 8.9, 0.225, 7.3, '#3a1a6a'), box(4.0, 1.2, 0.3, 8.9, 0.6, 7.85, '#2a1050'), box(3.9, 0.08, 0.85, 8.9, 0.49, 7.3, '#6a3fb8'), cyl(0.55, 0.55, 0.06, 12, 8.9, 0.55, 5.9, '#ffd166'), cyl(0.08, 0.12, 0.55, 6, 8.9, 0.27, 5.9, '#c9c0d8'));
  const ropeP = [[6.5, 7.6], [6.5, 5.9], [6.5, 4.2], [8.0, 4.2], [9.5, 4.2], [10.9, 4.2]];
  for (const [x, z] of ropeP) g.push(cyl(0.06, 0.09, 1, 8, x, 0.5, z, '#ffd166'), cyl(0.1, 0.1, 0.08, 8, x, 1.02, z, '#ffd166'), cyl(0.2, 0.22, 0.05, 8, x, 0.02, z, '#ffd166'));
  for (let i = 1; i < ropeP.length; i++) { const [x0, z0] = ropeP[i - 1], [x1, z1] = ropeP[i]; g.push(box(Math.abs(x1 - x0) + 0.05, 0.07, Math.abs(z1 - z0) + 0.05, (x0 + x1) / 2, 0.82, (z0 + z1) / 2, '#c41a3a')); }
  segZ(7.4, 3.6, 7.8, 2.8, 7.92, '#ffd166'); segZ(7.8, 2.8, 8.2, 3.6, 7.92, '#ffd166'); segZ(8.6, 2.8, 8.6, 3.6, 7.92, '#ffd166');
  segZ(9.1, 2.8, 9.1, 3.6, 7.92, '#ffd166'); segZ(9.1, 3.6, 9.6, 3.6, 7.92, '#ffd166'); segZ(9.6, 3.6, 9.6, 3.2, 7.92, '#ffd166'); segZ(9.6, 3.2, 9.1, 3.2, 7.92, '#ffd166');
  // --- coat check by the door
  g.push(box(0.8, 1.1, 3.1, -7.2, 0.55, 6.45, '#3a2a7a'), box(1.0, 0.07, 3.2, -7.2, 1.13, 6.45, '#d9c7ff'), box(0.05, 0.05, 3.1, -6.78, 0.9, 6.45, '#ffe14a'));
  g.push(box(0.06, 0.06, 3.2, -10.3, 2.1, 6.4, '#c9c0d8'));
  for (let i = 0; i < 8; i++) g.push(box(0.12, 0.9, 0.5, -10.3, 1.55, 5.0 + i * 0.4, ['#22203a', '#6a3fb8', '#ff5fa8', '#27d8cf', '#c9b38a', '#f6f1e7'][i % 6]));
  segX(5.4, 3.3, 6.4, 3.3, -10.92, '#ff2bd1'); segX(5.9, 3.3, 5.9, 3.6, -10.92, '#ff2bd1'); segX(5.4, 3.3, 5.9, 2.9, -10.92, '#ff2bd1'); segX(6.4, 3.3, 5.9, 2.9, -10.92, '#ff2bd1');
  // --- ceiling: trusses, light cans, the ball's rod
  for (const z of [-3.6, 1.8]) g.push(box(18, 0.14, 0.14, 0, 5.6, z, '#3a3550'), box(18, 0.14, 0.14, 0, 5.3, z, '#3a3550'));
  for (const x of [-5, 5]) g.push(box(0.14, 0.14, 11, x, 5.6, -0.9, '#3a3550'));
  for (let i = 0; i < 10; i++) g.push(cyl(0.16, 0.22, 0.4, 8, -7.2 + i * 1.6, 5.1, i % 2 ? -3.6 : 1.8, '#1d1734'), cyl(0.15, 0.15, 0.02, 8, -7.2 + i * 1.6, 4.89, i % 2 ? -3.6 : 1.8, NEON[i % 6]));
  g.push(box(0.04, 0.8, 0.04, 0, 5.6, -0.9, '#c9c0d8'));

  // --- dance floor: one quad; tiles, patterns (one per bar), breakdown and build are all in the shader
  const fU = { uBeat: beatU, uHot: { value: new THREE.Vector2(-1, -1) }, uCalm: { value: 0 }, uFlare: { value: 0 }, uMe: { value: new THREE.Vector2(-9, -9) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(F.nx * F.size, F.nz * F.size).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: fU, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uBeat, uCalm, uFlare; uniform vec2 uHot, uMe; varying vec2 vUv;
      vec3 pal(float h){ return 0.55 + 0.45 * cos(6.2832 * (h + vec3(0.0, 0.33, 0.67))); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 n = vec2(${F.nx}.0, ${F.nz}.0), p = vec2(vUv.x, 1.0 - vUv.y) * n, c = floor(p), f = fract(p), m = c + 0.5 - n * 0.5;
        float b = uBeat, beat = floor(b), ph = fract(b), bar = floor(b / 4.0), pb = mod(bar, 16.0);
        float pat = mod(bar * 5.0 + floor(bar / 4.0), 6.0), on;
        if (pat < 0.5) on = step(0.55, hash(c + beat * 0.37));
        else if (pat < 1.5) on = mod(c.x + c.y + beat, 2.0);
        else if (pat < 2.5) on = step(fract(length(m) * 0.32 - b * 0.5), 0.33);
        else if (pat < 3.5) on = step(abs(c.x - mod(floor(b * 2.0), n.x)), 0.5) + step(abs(c.y - mod(beat, n.y)), 0.5) * 0.6;
        else if (pat < 4.5) on = step(0.5, fract((c.x + c.y) * 0.25 - b * 0.5));
        else on = step(fract(length(c + 0.5 - uMe) * 0.3 - b * 0.5), 0.3) + 0.15;
        float pulse = 1.0 - 0.5 * ph;
        if (pb >= 12.0 && pb < 14.0) { on = 0.25 + 0.2 * sin(b * 0.785 + length(m)); pulse = 1.0; }
        else if (pb >= 14.0) { float rate = pb < 15.0 ? 1.0 : (ph < 0.5 && fract(b / 2.0) < 0.5 ? 2.0 : 4.0); on = step(0.5, fract(b * rate)) * (0.4 + (pb - 14.0) * 0.4 + ph * 0.2); pulse = 1.0; }
        vec3 col = pal(bar * 0.137 + c.y * 0.06 + c.x * 0.02 + pat * 0.11) * mix(0.12, 1.0, clamp(on, 0.0, 1.0)) * pulse * mix(1.0, 0.3, uCalm);
        col += vec3(1.0, 0.85, 1.0) * uFlare * (0.35 + 0.65 * on) * smoothstep(5.0, 0.0, length(c + 0.5 - uMe));
        float hot = step(abs(c.x - uHot.x) + abs(c.y - uHot.y), 0.1);
        col = mix(col, vec3(1.0) * (0.75 + 0.25 * sin(b * 6.2832)), hot);
        float edge = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.05, f.y) * smoothstep(1.0, 0.95, f.y);
        col *= mix(0.12, 1.0, edge) * (0.8 + 0.2 * smoothstep(0.7, 0.0, length(f - 0.5)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  floor.position.set(F.cx, 0.012, F.cz);

  // --- mirror ball, and the light spots it throws round the room (one instanced quad each)
  const BALL = new THREE.Vector3(0, 5.0, -0.9);
  const ballG = new THREE.SphereGeometry(0.55, 14, 10).toNonIndexed();
  { const n = ballG.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) { const k = 0.35 + r() * 0.65; for (let j = 0; j < 9; j++) col[i * 3 + j] = k * (j % 3 === 2 ? 1 : 0.92); }
    ballG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const ball = new THREE.Mesh(ballG, room.mat);
  ball.position.copy(BALL);
  const NS = 44, spotU = { uK: { value: 1 } };
  const spots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: spotU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.92, 1.0) * uK * smoothstep(1.0, 0.25, d), 1.0); }',
  }), NS);
  spots.frustumCulled = false;
  const sdir = [];
  for (let i = 0; i < NS; i++) { const y = -0.95 + r() * 1.05, a = r() * PI * 2, k = Math.sqrt(1 - y * y); sdir.push([Math.cos(a) * k, y, Math.sin(a) * k]); }

  // --- lasers fanning out from the booth through the haze (animated in the vertex shader)
  const lg = [], LCOL = ['#ff2bd1', '#18f0ff', '#8dff5a', '#ff2bd1', '#18f0ff', '#8dff5a', '#ffe14a', '#ffe14a'];
  const LORG = [[-3.8, 1.95, -5.4], [3.8, 1.95, -5.4], [-5.3, 3.9, -6.6], [5.3, 3.9, -6.6], [-2.2, 5.3, -7.5], [2.2, 5.3, -7.5], [-9.5, 5.4, -7.5], [9.5, 5.4, -7.5]];
  LORG.forEach((o, i) => {
    for (const rz of [0, PI / 2]) {
      const q = new THREE.PlaneGeometry(0.05, 18, 1, 1).rotateX(PI / 2).translate(0, 0, 9);
      if (rz) q.rotateZ(rz);
      const gq = tint(q, LCOL[i]);
      withAttr(gq, 'aB', 1, i); withAttr(gq, 'aO', 3, o);
      lg.push(gq);
    }
  });
  const lzU = { uBeat: beatU, uOn: { value: 1 } };
  const lasers = new THREE.Mesh(merge(lg), new THREE.ShaderMaterial({
    uniforms: lzU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexColors: true,
    vertexShader: /* glsl */`
      attribute float aB; attribute vec3 aO; uniform float uBeat; varying vec3 vC; varying float vL;
      void main(){
        vC = color; vL = position.z / 18.0;
        float side = aO.x < 0.0 ? 1.0 : -1.0, w = uBeat * 0.25 + aB * 0.9;
        float yaw = side * (0.25 + 0.35 * sin(w)) + (aO.x == 0.0 ? 0.0 : 0.0), pitch = (aO.y > 4.5 ? 0.42 : 0.04) + 0.12 * sin(w * 1.7 + aB);
        vec3 p = position;
        p.yz = mat2(cos(pitch), sin(pitch), -sin(pitch), cos(pitch)) * p.yz;
        p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aO, 1.0);
      }`,
    fragmentShader: 'uniform float uOn; varying vec3 vC; varying float vL; void main(){ gl_FragColor = vec4(vC * uOn * pow(1.0 - vL, 1.6) * 1.4, 1.0); }',
  }));
  lasers.frustumCulled = false;

  // --- haze: a few soft additive sheets that drift
  const hz = [];
  for (const [y, s] of [[2.2, 0], [3.4, 1], [4.6, 2]]) hz.push(withAttr(new THREE.PlaneGeometry(21, 15).rotateX(-PI / 2).translate(0, y, 0).toNonIndexed(), 'aS', 1, s));
  const hzU = { uBeat: beatU, uCol: { value: new THREE.Color('#7a5cff') }, uK: { value: 1 } };
  for (const q of hz) q.deleteAttribute('normal');
  const haze = new THREE.Mesh(merge(hz), new THREE.ShaderMaterial({
    uniforms: hzU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'attribute float aS; varying vec2 vP; varying float vS; void main(){ vP = position.xz; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uBeat, uK; uniform vec3 uCol; varying vec2 vP; varying float vS;
      void main(){
        float t = uBeat * 0.12 + vS * 3.0;
        float n = sin(vP.x * 0.55 + t) * sin(vP.y * 0.7 - t * 0.8) + sin((vP.x + vP.y) * 0.31 + t * 1.3) * 0.6;
        float a = (0.5 + 0.35 * n) * 0.05 * uK * smoothstep(11.0, 6.0, abs(vP.x)) * smoothstep(8.0, 4.0, abs(vP.y + 0.9));
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  }));
  haze.frustumCulled = false; haze.renderOrder = 3;

  // --- speaker cones (they pump with the kick) and the mixer / deck LEDs (they blink on the beat)
  const coneG = merge([cyl(1, 1, 0.08, 14, 0, 0, 0, '#3a3550', PI / 2), cyl(0.62, 0.62, 0.1, 14, 0, 0, 0.02, '#55506a', PI / 2), cyl(0.22, 0.22, 0.12, 10, 0, 0, 0.05, '#8a85a0', PI / 2)]);
  const CONES = [];
  for (const sx of [-1, 1]) CONES.push([sx * 5.3, 0.9, -6.38, 0.62], [sx * 5.3, 2.45, -6.48, 0.48], [sx * 5.3, 3.45, -6.58, 0.26]);
  const cones = new THREE.InstancedMesh(coneG, room.mat, CONES.length);
  const leds = [];
  for (let i = 0; i < 28; i++) {
    const row = Math.floor(i / 7), col = i % 7;
    leds.push(withAttr(box(0.05, 0.03, 0.05, -0.3 + col * 0.1, 1.9, -6.0 + row * 0.12, NEON[(i * 3) % 6]), 'aI', 1, i));
  }
  for (let i = 0; i < 20; i++) { const sx = i < 10 ? -1 : 1, k = i % 10; leds.push(withAttr(box(0.08, 0.05, 0.03, sx * 0.55 + sx * 0.02, 1.0 + k * 0.07, -5.27, k > 7 ? '#ff2a3a' : k > 5 ? '#ffe14a' : '#3dff8a'), 'aI', 1, 100 + k + (sx > 0 ? 50 : 0))); }
  const ledU = { uBeat: beatU, uLvl: { value: 0 } };
  for (const q of leds) q.deleteAttribute('normal');
  const led = new THREE.Mesh(merge(leds), new THREE.ShaderMaterial({
    uniforms: ledU, fog: false, vertexColors: true,
    vertexShader: 'attribute float aI; uniform float uBeat, uLvl; varying vec3 vC; varying float vOn; void main(){ vC = color;'
      + ' float k = mod(aI, 50.0); vOn = aI < 100.0 ? step(0.45, fract(sin(aI * 12.9898 + floor(uBeat * 2.0) * 7.31) * 43758.5)) : step(k - 100.0, uLvl * 10.0);'
      + ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vOn; void main(){ gl_FragColor = vec4(vC * mix(0.12, 1.4, vOn), 1.0); }',
  }));

  // --- the crowd: torsos, heads, arms and legs as four instanced meshes. Dancers on the floor,
  // regulars at the bar, couples in the booths and the VIP corner, the coat-check attendant.
  const seats = [];
  for (const z of BSTOOL) seats.push({ x: -7.85, z, y: 0.83, yaw: -PI / 2, kind: 'stool' });
  for (const zc of BOOTH) for (const o of [-0.9, 0, 0.9]) seats.push({ x: 10.15, z: zc + o, y: 0.5, yaw: -PI / 2, kind: 'sofa' });
  const crowd = [];
  const person = (kind, x, z, yaw, extra) => crowd.push({ kind, x, z, yaw, hx: x, hz: z, i: crowd.length, move: crowd.length % 8, pref: [crowd.length % 8, (crowd.length * 3 + 1) % 8, (crowd.length * 5 + 2) % 8],
    h: 0.92 + r() * 0.16, cheer: 0, copy: 0, copyMove: 0, p: newPose(), seed: r() * 10, ...extra });
  for (let k = 0; k < 18; k++) {
    const cx = k % 6, cz = Math.floor(k / 6), x = -4.3 + cx * 1.72 + (r() - 0.5) * 0.6, z = -3.9 + cz * 2.1 + (r() - 0.5) * 0.6 + (cx % 2) * 0.6;
    person('dance', x, z, PI + (r() - 0.5) * 1.2);
  }
  const sitOn = (s) => { s.taken = true; person('sit', s.x, s.z, s.yaw, { y: s.y }); };
  sitOn(seats[0]); sitOn(seats[3]);
  person('bar', -7.3, -3.55, -PI / 2 + 0.4); person('bar', -7.25, -0.95, -PI / 2 - 0.3);
  sitOn(seats[5]); sitOn(seats[6]); sitOn(seats[10]); sitOn(seats[12]);
  person('sit', 8.3, 7.2, PI, { y: 0.5 }); person('sit', 9.6, 7.2, PI, { y: 0.5 });
  person('coat', -8.1, 6.3, PI / 2);
  const N = crowd.length;
  const torso = new THREE.InstancedMesh(merge([box(0.44, 0.56, 0.25, 0, 1.22, 0, '#ffffff'), box(0.4, 0.2, 0.25, 0, 0.9, 0, '#c8c8c8'), box(0.45, 0.06, 0.26, 0, 0.98, 0, '#9a9a9a')]), room.mat, N);
  const head = new THREE.InstancedMesh(merge([box(0.12, 0.1, 0.12, 0, 0.0, 0, '#e8e8e8'), box(0.24, 0.25, 0.24, 0, 0.17, 0, '#ffffff'), box(0.26, 0.11, 0.26, 0, 0.29, -0.01, '#3a3040'),
    box(0.04, 0.04, 0.02, -0.06, 0.18, 0.122, '#202020'), box(0.04, 0.04, 0.02, 0.06, 0.18, 0.122, '#202020')]), room.mat, N);
  const arms = new THREE.InstancedMesh(merge([box(0.12, 0.5, 0.13, 0, -0.22, 0, '#ffffff'), box(0.1, 0.1, 0.1, 0, -0.5, 0, '#c8a890')]), room.mat, N * 2);
  const legs = new THREE.InstancedMesh(merge([box(0.15, 0.82, 0.17, 0, -0.41, 0, '#ffffff'), box(0.16, 0.1, 0.27, 0, -0.86, 0.04, '#3a3a3a')]), room.mat, N * 2);
  const col = new THREE.Color();
  for (const d of crowd) {
    const top = CROWD_TOPS[(d.i * 7) % CROWD_TOPS.length], sk = SKINS[(d.i * 5) % SKINS.length], lg2 = d.kind === 'coat' ? '#22203a' : CROWD_LEGS[(d.i * 3) % CROWD_LEGS.length];
    torso.setColorAt(d.i, col.set(d.kind === 'coat' ? '#f6f1e7' : top)); head.setColorAt(d.i, col.set(sk));
    arms.setColorAt(d.i * 2, col.set(d.i % 3 ? top : sk)); arms.setColorAt(d.i * 2 + 1, col.set(d.i % 3 ? top : sk));
    legs.setColorAt(d.i * 2, col.set(lg2)); legs.setColorAt(d.i * 2 + 1, col.set(lg2));
  }
  for (const m of [torso, head, arms, legs, cones]) m.frustumCulled = false;
  const Rt = new THREE.Matrix4(), Bm = new THREE.Matrix4(), Lm = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'XYZ'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3();
  const tmp = newPose(), HIP = 0.92;
  const local = (m, x, y, z, rx, ry, rz) => Lm.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one);
  function drawPerson(d) {
    const o = d.p, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    Rt.compose(v.set(d.x + c * o.x, 0, d.z - s * o.x), q.setFromEuler(e.set(0, d.yaw + o.spin, 0)), sv.set(d.h, d.h, d.h));
    // body = root * T(0, y + hip) * R * T(0, -hip): turns about the hips
    Bm.multiplyMatrices(Rt, local(Lm, 0, o.y + HIP, 0, o.rx, o.ry, o.rz)); Bm.multiply(M.makeTranslation(0, -HIP, 0));
    torso.setMatrixAt(d.i, Bm);
    head.setMatrixAt(d.i, M.multiplyMatrices(Bm, local(Lm, 0, 1.5, 0, o.hx, 0, o.hz)));
    arms.setMatrixAt(d.i * 2, M.multiplyMatrices(Bm, local(Lm, 0.29, 1.46, 0, o.aL[0], o.aL[1], o.aL[2])));
    arms.setMatrixAt(d.i * 2 + 1, M.multiplyMatrices(Bm, local(Lm, -0.29, 1.46, 0, o.aR[0], o.aR[1], o.aR[2])));
    legs.setMatrixAt(d.i * 2, M.multiplyMatrices(Bm, local(Lm, 0.11, HIP, 0, o.lL[0], 0, o.lL[1])));
    legs.setMatrixAt(d.i * 2 + 1, M.multiplyMatrices(Bm, local(Lm, -0.11, HIP, 0, o.lR[0], 0, o.lR[1])));
  }
  const focus = { x: 99, z: 99, move: 0, dancing: false };
  let flare = 0, last = 0;
  const sp = new THREE.Vector3(), nrm = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), sq = new THREE.Quaternion(), ballQ = new THREE.Quaternion();

  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, extras: [floor, ball, spots, lasers, haze, cones, led, torso, head, arms, legs],
    blocks: [{ x0: -4.1, x1: 4.1, z0: -8, z1: -5.2 }, { x0: -6.2, x1: -4.4, z0: -8, z1: -6.35 }, { x0: 4.4, x1: 6.2, z0: -8, z1: -6.35 }, { x0: -11, x1: -8.35, z0: -6.45, z1: 1.25 },
      ...BSTOOL.map((z) => ({ x0: -8.12, x1: -7.58, z0: z - 0.27, z1: z + 0.27 })),
      ...BOOTH.flatMap((zc) => [{ x0: 9.65, x1: 11, z0: zc - 1.68, z1: zc + 1.68 }, { x0: 8.4, x1: 9.4, z0: zc - 0.5, z1: zc + 0.5 }]),
      { x0: 6.35, x1: 6.65, z0: 4.05, z1: 8 }, { x0: 6.35, x1: 11, z0: 4.05, z1: 4.35 }, { x0: -7.62, x1: -6.78, z0: 4.85, z1: 8 }, { x0: -11, x1: -9.9, z0: 4.6, z1: 8 }],
    seats,
    me: [1.4, -3.5], cast: { KILO: [0, -6.5, 0, 0.7], GLITZ: [4.3, -3.1, -1.2], TAPS: [-10.05, -2.6, PI / 2] }, wide: [-6.8, 3.8, 6.6, 1, 1.3, -3.2],
    floorU: fU,
    // which dance-floor tile is (x, z) on? -> [i, j] or null
    tileAt(x, z) {
      const i = Math.floor((x - F.cx) / F.size + F.nx / 2), j = Math.floor((z - F.cz) / F.size + F.nz / 2);
      return i >= 0 && i < F.nx && j >= 0 && j < F.nz ? [i, j] : null;
    },
    // the dance module tells the room where the courier is and what they are doing
    setFocus(x, z, move, dancing) { focus.x = x; focus.z = z; focus.move = move; focus.dancing = dancing; fU.uMe.value.set((x - F.cx) / F.size + F.nx / 2, (z - F.cz) / F.size + F.nz / 2); },
    // a beat landed: the floor flares and dancers within reach cheer, then copy the move
    react(x, z, move, combo) {
      flare = Math.min(1.4, 0.7 + combo * 0.05);
      for (const d of crowd) {
        if (d.kind !== 'dance') continue;
        const dist = Math.hypot(d.x - x, d.z - z);
        if (dist > 2.4 + Math.min(combo, 16) * 0.12) continue;
        if (combo >= 4 && combo % 4 === 0) d.cheer = 1.6;
        if (combo >= 3) { d.copy = 6; d.copyMove = move; }
      }
    },
    // keep the courier out of the dancers (local coords)
    pushPeople(p, rad) {
      for (const d of crowd) {
        if (d.kind === 'sit') continue;
        const dx = p.x - d.x, dz = p.z - d.z, dd = Math.hypot(dx, dz), rr = rad + 0.28;
        if (dd < rr && dd > 1e-4) { p.x = d.x + dx / dd * rr; p.z = d.z + dz / dd * rr; }
      }
    },
    idle(t, dt, still) {
      const b = beatU.value, ph = b - Math.floor(b), sec = section(b), pb = Math.floor(b / 4) % 16;
      const kickE = sec === 'break' || (pb === 15 && ph + (Math.floor(b) % 4) >= 2) ? 0 : Math.exp(-ph * 7);
      ball.rotation.y = t * 0.45;
      // spots: rays from the ball to the walls, floor and ceiling
      ballQ.setFromAxisAngle(v.set(0, 1, 0), t * 0.45 * (still ? 0.3 : 1));
      for (let i = 0; i < NS; i++) {
        const dd = sdir[i]; nrm.set(dd[0], dd[1], dd[2]).applyQuaternion(ballQ);
        let tt = 1e9, nx = 0, ny = 0, nz = 0;
        if (nrm.y < -1e-3) { const k = -BALL.y / nrm.y; if (k < tt) { tt = k; nx = 0; ny = 1; nz = 0; } }
        if (nrm.y > 1e-3) { const k = (H - BALL.y) / nrm.y; if (k < tt) { tt = k; nx = 0; ny = -1; nz = 0; } }
        if (Math.abs(nrm.x) > 1e-3) { const k = ((nrm.x > 0 ? HX : -HX) - BALL.x) / nrm.x; if (k < tt) { tt = k; nx = -Math.sign(nrm.x); ny = 0; nz = 0; } }
        if (Math.abs(nrm.z) > 1e-3) { const k = ((nrm.z > 0 ? HZ : -HZ) - BALL.z) / nrm.z; if (k < tt) { tt = k; nx = 0; ny = 0; nz = -Math.sign(nrm.z); } }
        sp.copy(BALL).addScaledVector(nrm, tt).add(v.set(nx * 0.03, ny * 0.03, nz * 0.03));
        sq.setFromUnitVectors(Z, v.set(nx, ny, nz));
        const sz = 0.18 + tt * 0.045;
        spots.setMatrixAt(i, M.compose(sp, sq, sv.set(sz, sz, 1)));
      }
      spots.instanceMatrix.needsUpdate = true;
      spotU.uK.value = sec === 'break' ? 0.75 : sec === 'build' ? 0.25 : 0.35 + 0.15 * kickE;
      lzU.uOn.value = sec === 'break' ? 0 : sec === 'build' ? (pb === 15 ? (ph < 0.5 ? 0.9 : 0.15) : 0.35) : 0.55 + 0.35 * kickE;
      hzU.uK.value = sec === 'break' ? 0.6 : 1 + kickE * 0.6;
      hzU.uCol.value.set(NEON[Math.floor(b / 4) % 6]);
      ledU.uLvl.value = 0.25 + 0.75 * kickE;
      flare = Math.max(0, flare - dt * 2.2); fU.uFlare.value = flare;
      for (let i = 0; i < CONES.length; i++) {
        const c = CONES[i], k = c[3] * (1 + kickE * (still ? 0.03 : 0.1));
        cones.setMatrixAt(i, M.compose(v.set(c[0], c[1], c[2] + kickE * 0.04), q.identity(), sv.set(k, k, 1 + kickE * 2)));
      }
      cones.instanceMatrix.needsUpdate = true;
      // the crowd
      const near2 = 20;
      for (const d of crowd) {
        d.cheer = Math.max(0, d.cheer - dt); d.copy = Math.max(0, d.copy - dt);
        if (d.kind === 'sit') sitPose(d.y, b + d.seed * 0.01, tmp, d.seed, still);
        else if (d.kind === 'coat') { dancePose(1, b, tmp, 0.25); tmp.aR[0] = -0.5; tmp.aL[0] = -0.5; }
        else if (d.kind === 'bar') { dancePose(1, b, tmp, 0.35); tmp.aR[0] = -1.9 - 0.15 * Math.sin(b * 0.7 + d.seed); tmp.aR[2] = 0.35; tmp.hx = -0.1; }
        else {
          const drop = pb === 0 && b - Math.floor(b / 4) * 4 < 2;
          if (d.cheer > 0 || (sec === 'build' && pb === 15) || drop) cheerPose(b, tmp);
          else if (sec === 'break') dancePose(1, b, tmp, 0.35);
          else dancePose(d.copy > 0 ? d.copyMove : d.pref[(Math.floor(b / 16) + d.i) % 3], b, tmp, still ? 0.3 : 1);
          // face the booth, or the courier when they are dancing close by
          const fx = focus.x - d.hx, fz = focus.z - d.hz, near = focus.dancing && fx * fx + fz * fz < near2;
          const want = near ? Math.atan2(fx, fz) : PI + Math.sin(d.seed + b * 0.05) * 0.5;
          d.yaw += angleDelta(d.yaw, want) * (1 - Math.exp(-3 * dt));
        }
        blendPose(d.p, tmp, last ? 1 - Math.exp(-10 * dt) : 1);
        drawPerson(d);
      }
      last = 1;
      for (const m of [torso, head, arms, legs]) m.instanceMatrix.needsUpdate = true;
      const k = room.npc.KILO, kb = Math.sin(b * PI * 2);
      k.armL.rotation.set(-1.2, 0, 0.2); k.armR.rotation.set(0, 0, sec === 'build' ? -2.9 : -2.6 + kb * 0.25); k.head.rotation.x = kb * 0.12;
      const tp = room.npc.TAPS;                                   // the bartender shakes a cocktail in time
      tp.armR.rotation.set(-2.2 + Math.sin(b * PI * 2) * 0.35, 0, -0.3); tp.armL.rotation.set(-2.0 + Math.sin(b * PI * 2) * 0.35, 0, 0.3);
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
  group.traverse((o) => o.layers.enable(1));
  if (!room.seats) room.seats = [];
  group.visible = false;
  scene.add(group);
  return room;
}
