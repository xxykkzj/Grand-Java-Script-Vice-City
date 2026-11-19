// Loose street furniture and a light physics layer for it. Heavy, fast things push light things:
//   light   bins, cones, café chairs, potted plants, crates, beach balls (and cans):
//           knocked flying by anything moving fast enough, the courier on skates included
//   medium  benches, café tables, vending machines, newspaper boxes, sandwich boards: block the
//           courier, get shoved along by cars and only tumble above a topple speed (a vending machine
//           needs ~50 km/h). 'anchor' ones (newspaper boxes, benches, vending machines) don't budge
//           for the courier or a motorbike at all; only cars and the tank move them
//   fixed   hydrants: bolted down (a slow car stops), sheared off and flung above ~25 km/h, leaving
//           a water spout; the car keeps most of its speed
//   static  street lamps bend over when a car hits them above 45 km/h (sparks, a clank, the light
//           goes out); slower, the car just stops. Palms, walls and signal masts never give. The
//           tank flattens lamps, palms, hydrants and everything loose.
// Every loose prop is one range of vertices in ONE merged mesh (one draw call for all of them). Only
// awake bodies are simulated and only their vertex ranges are rewritten; sleeping ones sit in a static
// spatial grid. Knocked props, lamps and palms go back to their spot a few minutes later, once nobody
// is looking. Nothing here ever raises the heat.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, nightU, unseen, pushOut } from '../core/util.js';
import { clampToWorld, onRoad } from './layout.js';
import { circlesOf } from '../vehicles/vehicles.js';
import { createGlow } from './glow.js';

const CELL = 8, key = (i, j) => (i + 512) * 1024 + (j + 512);
export const LAMP_BREAK = 12.5;                    // m/s (45 km/h): a car this fast takes a lamp post down
const RESET = 150;
const HYD_BREAK = 7;                                // m/s (~25 km/h): faster than this shears a hydrant off
const ROAD_CLEAR = 12;                              // s: a knocked prop resting in a traffic lane is cleared sooner                                  // seconds before a knocked prop may go home (unseen)
const CAR_M = 1200, BIKE_M = 260, TANK_M = 40000;
// mass class, mass (kg), half extents [x, y, z] (resting on the ground), footprint circles [offset on local x, r],
// topple speed (m/s, medium props), bounce
export const KINDS = {
  bin: { cls: 'light', m: 15, he: [0.36, 0.47, 0.36], fp: [[0, 0.36]] },
  cone: { cls: 'light', m: 3, he: [0.22, 0.35, 0.22], fp: [[0, 0.24]] },
  chair: { cls: 'light', m: 6, he: [0.24, 0.47, 0.25], fp: [[0, 0.3]] },
  pot: { cls: 'light', m: 18, he: [0.3, 0.4, 0.3], fp: [[0, 0.32]] },
  crate: { cls: 'light', m: 22, he: [0.45, 0.45, 0.45], fp: [[0, 0.5]] },
  news: { cls: 'medium', m: 45, he: [0.26, 0.55, 0.24], fp: [[0, 0.32]], topple: 9, anchor: true },
  ball: { cls: 'light', m: 0.5, he: [0.3, 0.3, 0.3], fp: [[0, 0.3]], ball: true, bounce: 0.7 },
  can: { cls: 'light', m: 0.4, he: [0.04, 0.065, 0.04], fp: [[0, 0.08]] },
  bench: { cls: 'medium', m: 70, he: [1.0, 0.5, 0.33], fp: [[-0.62, 0.36], [0.62, 0.36]], topple: 13, anchor: true },
  table: { cls: 'medium', m: 25, he: [0.55, 1.35, 0.55], fp: [[0, 0.45]], topple: 7 },
  vend: { cls: 'medium', m: 300, he: [0.48, 0.95, 0.38], fp: [[0, 0.62]], topple: 14, anchor: true },
  board: { cls: 'medium', m: 8, he: [0.3, 0.45, 0.28], fp: [[0, 0.35]], topple: 4 },
  // bolted down (a static collider holds it) until a fast hit shears it off; then it flies like a light prop
  hydrant: { cls: 'fixed', m: 110, he: [0.25, 0.37, 0.25], fp: [[0, 0.24]] },
};
export const BRANDS = {
  coolwave: { name: 'COOLWAVE', body: '#1d4f8a', accent: '#27e8ff', glow: '#7fe8ff', items: ['#27e8ff', '#ff4fa3', '#ffd447', '#8dff5a'] },
  snaxx: { name: 'SNAXX 24', body: '#7a1f4a', accent: '#ff8a3d', glow: '#ffb070', items: ['#ffd447', '#ff6a3d', '#b388ff', '#ff4fa3'] },
};

// every part carries aGlow (0 = plain, 1 = lit at night) so all of them merge
const gl = (g, k = 0) => { const n = g.attributes.position.count; g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); return g; };
function template(b) {
  const c = b.color || '#ff4fa3', P = [];
  const add = (g, k = 0) => P.push(gl(g, k));
  switch (b.kind) {
    case 'bin': add(cyl(0.34, 0.28, 0.85, 8, 0, 0.43, 0, c)); add(cyl(0.37, 0.37, 0.08, 8, 0, 0.88, 0, '#3b3350')); break;
    case 'cone': add(cyl(0.03, 0.2, 0.62, 8, 0, 0.36, 0, '#ff6a2a')); add(cyl(0.1, 0.13, 0.1, 8, 0, 0.4, 0, '#ffffff')); add(box(0.44, 0.05, 0.44, 0, 0.025, 0, '#ff6a2a')); break;
    case 'chair':
      add(box(0.46, 0.06, 0.46, 0, 0.46, 0, c)); add(box(0.46, 0.5, 0.06, 0, 0.72, -0.22, c));
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) add(box(0.04, 0.44, 0.04, x, 0.22, z, '#b9bcc8'));
      break;
    case 'pot':
      add(cyl(0.3, 0.22, 0.45, 8, 0, 0.225, 0, '#c9603a')); add(cyl(0.32, 0.32, 0.06, 8, 0, 0.45, 0, '#d8774a'));
      add(tint(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.8, 1).translate(0, 0.62, 0), '#2f8f4f'));
      for (let k = 0; k < 5; k++) add(box(0.08, 0.06, 0.08, Math.cos(k * 1.26) * 0.2, 0.78, Math.sin(k * 1.26) * 0.2, c));
      break;
    case 'crate': add(box(0.9, 0.9, 0.9, 0, 0.45, 0, '#c98d62')); add(box(0.92, 0.12, 0.92, 0, 0.7, 0, '#a8744e')); add(box(0.92, 0.12, 0.92, 0, 0.2, 0, '#a8744e')); break;
    case 'news':
      add(box(0.1, 0.3, 0.1, 0, 0.15, 0, '#3b3350')); add(box(0.5, 0.75, 0.45, 0, 0.67, 0, c)); add(box(0.52, 0.06, 0.47, 0, 1.06, 0, '#3b3350'));
      add(box(0.36, 0.22, 0.02, 0, 0.82, 0.23, '#e8eef4'), 0.3); add(box(0.28, 0.04, 0.02, 0, 0.55, 0.23, '#22203a'));
      break;
    case 'ball': {
      const g = tint(new THREE.IcosahedronGeometry(0.3, 1).translate(0, 0.3, 0), '#ffffff'), col = g.attributes.color, k = new THREE.Color(c);
      for (let i = 0; i < col.count; i += 3) if ((i / 3) % 3 === 0) for (let j = 0; j < 3; j++) col.setXYZ(i + j, k.r, k.g, k.b);
      add(g); break;
    }
    case 'hydrant': add(cyl(0.16, 0.19, 0.6, 7, 0, 0.3, 0, '#ff4f6a')); add(cyl(0.12, 0.16, 0.14, 7, 0, 0.67, 0, '#ffd447')); add(box(0.5, 0.12, 0.12, 0, 0.42, 0, '#ff4f6a')); break;
    case 'can': add(cyl(0.035, 0.035, 0.12, 6, 0, 0.065, 0, c)); add(cyl(0.03, 0.03, 0.012, 6, 0, 0.13, 0, '#c9c0d8')); break;
    case 'bench':
      add(box(2, 0.1, 0.55, 0, 0.5, 0, '#f7b3c6')); add(box(2, 0.5, 0.1, 0, 0.85, -0.28, '#f7b3c6'));
      add(box(0.1, 0.5, 0.5, 0.85, 0.25, 0, '#3b3350')); add(box(0.1, 0.5, 0.5, -0.85, 0.25, 0, '#3b3350'));
      break;
    case 'table':
      add(cyl(0.45, 0.45, 0.05, 10, 0, 0.76, 0, '#fbf7f0')); add(cyl(0.05, 0.05, 0.74, 5, 0, 0.37, 0, '#b9bcc8')); add(cyl(0.28, 0.3, 0.04, 8, 0, 0.02, 0, '#b9bcc8'));
      add(cyl(0.03, 0.03, 1.6, 4, 0, 1.55, 0, '#fbf7f0')); add(tint(new THREE.ConeGeometry(1.25, 0.45, 8).translate(0, 2.45, 0), c));
      break;
    case 'vend': {
      const B = BRANDS[b.brand] || BRANDS.coolwave;
      add(box(0.95, 1.9, 0.75, 0, 0.95, 0, B.body)); add(box(0.97, 0.08, 0.77, 0, 1.91, 0, '#22203a'));
      add(box(0.6, 1.2, 0.02, -0.1, 1.12, 0.38, '#cfeeff'), 0.85);                       // lit window
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) add(box(0.1, 0.17, 0.02, -0.33 + k * 0.155, 0.66 + r * 0.29, 0.392, B.items[(r + k) % 4]), 1);
      add(box(0.95, 0.28, 0.03, 0, 1.76, 0.38, B.accent), 1);                            // header
      if (b.brand === 'snaxx') { for (let k = 0; k < 4; k++) add(box(0.2, 0.05, 0.02, -0.3 + k * 0.2, 1.76 + (k % 2 ? 0.05 : -0.05), 0.4, '#fff6ec', 0, 0, k % 2 ? -0.5 : 0.5), 1); }
      else for (let k = 0; k < 3; k++) add(box(0.22, 0.04, 0.02, -0.28 + k * 0.28, 1.76 + Math.sin(k * 2) * 0.05, 0.4, '#fff6ec', 0, 0, 0.4 * Math.cos(k * 2)), 1);
      add(box(0.2, 0.55, 0.02, 0.34, 1.15, 0.38, '#2a2a3a')); add(box(0.08, 0.1, 0.02, 0.34, 1.3, 0.392, '#ffd447'), 1);
      add(box(0.55, 0.16, 0.04, -0.1, 0.3, 0.38, '#111018')); add(box(0.02, 1.9, 0.77, 0.47, 0.95, 0, B.accent), 0.4); add(box(0.02, 1.9, 0.77, -0.47, 0.95, 0, B.accent), 0.4);
      break;
    }
    case 'board':
      add(box(0.6, 0.9, 0.04, 0, 0.45, 0.14, '#22203a', -0.3)); add(box(0.6, 0.9, 0.04, 0, 0.45, -0.14, '#22203a', 0.3));
      add(box(0.46, 0.5, 0.01, 0, 0.5, 0.165, c, -0.3), 0.3); add(box(0.3, 0.04, 0.01, 0, 0.62, 0.19, '#fff6ec', -0.3));
      break;
    default: add(box(0.4, 0.4, 0.4, 0, 0.2, 0, c));
  }
  return merge(P);
}

export function createLoose(scene, game, city, fx, audio) {
  const { L, camera } = game, props = L.props;
  const bodies = [], vends = [], cans = [];
  const byD = new Map();
  for (const d of L.loose) { const b = mk(d); bodies.push(b); byD.set(d, b); if (b.kind === 'vend') vends.push(b); }
  for (const o of props.cols) if (o.hyd) o.body = byD.get(o.hyd);
  for (let i = 0; i < 4; i++) { const b = mk({ kind: 'can', hx: 0, hz: 0, yaw: 0, color: ['#27e8ff', '#ff4fa3', '#ffd447', '#8dff5a'][i], seats: [] }); b.hidden = true; bodies.push(b); cans.push(b); }
  function mk(d) {
    const K = KINDS[d.kind];
    return { ...d, K, x: d.hx, y: K.he[1], z: d.hz, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
      awake: false, moved: false, still: 0, cool: 0, resetT: 0, cell: -1, stamp: 0, hidden: false };
  }

  // ---- one merged, dynamic mesh
  let total = 0;
  const tpl = new Map();
  for (const b of bodies) {
    const k = b.kind + '|' + (b.color || '') + '|' + (b.brand || '');
    if (!tpl.has(k)) tpl.set(k, template(b));
    b.g = tpl.get(k); b.o = total; b.n = b.g.attributes.position.count; total += b.n;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), colr = new Float32Array(total * 3), glw = new Float32Array(total);
  for (const b of bodies) { colr.set(b.g.attributes.color.array, b.o * 3); glw.set(b.g.attributes.aGlow.array, b.o); }
  const geo = new THREE.BufferGeometry();
  const pA = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), nA = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pA); geo.setAttribute('normal', nA);
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setAttribute('aGlow', new THREE.BufferAttribute(glw, 1));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = nightU;
    sh.vertexShader = 'attribute float aGlow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow;');
    sh.fragmentShader = 'uniform float uNight; varying float vGlow;\n' + sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.2 + uNight * 1.1);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const M = new THREE.Matrix4(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), OFF = new THREE.Vector3();
  function write(b) {
    const src = b.g.attributes.position.array, sn = b.g.attributes.normal.array, o = b.o * 3;
    if (b.hidden) { M.makeTranslation(0, -60, 0); } else { OFF.set(0, -b.K.he[1], 0).applyQuaternion(b.q); M.compose(V.set(b.x + OFF.x, b.y + OFF.y, b.z + OFF.z), b.q, S1); }
    const e = M.elements;
    for (let i = 0; i < b.n * 3; i += 3) {
      const x = src[i], y = src[i + 1], z = src[i + 2];
      pos[o + i] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[o + i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[o + i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const a = sn[i], c = sn[i + 1], d = sn[i + 2];
      nor[o + i] = e[0] * a + e[4] * c + e[8] * d; nor[o + i + 1] = e[1] * a + e[5] * c + e[9] * d; nor[o + i + 2] = e[2] * a + e[6] * c + e[10] * d;
    }
    pA.addUpdateRange(o, b.n * 3); nA.addUpdateRange(o, b.n * 3);
    pA.needsUpdate = nA.needsUpdate = true;
  }
  for (const b of bodies) write(b);
  pA.clearUpdateRanges(); nA.clearUpdateRanges();

  // ---- sleeping bodies live in a static grid; awake ones in a short list
  const grid = new Map(), awake = [];
  const file = (b) => { const k = key(Math.floor(b.x / CELL), Math.floor(b.z / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(b); b.cell = k; };
  const unfile = (b) => { const a = grid.get(b.cell); if (a) { const i = a.indexOf(b); if (i >= 0) a.splice(i, 1); } b.cell = -1; };
  for (const b of bodies) if (!b.hidden) file(b);
  let stamp = 0;
  function near(x, z, r, fn) {
    stamp++;
    const m = r + 1.3;
    for (let i = Math.floor((x - m) / CELL); i <= Math.floor((x + m) / CELL); i++) for (let j = Math.floor((z - m) / CELL); j <= Math.floor((z + m) / CELL); j++) {
      const a = grid.get(key(i, j));
      if (a) for (let k = 0; k < a.length; k++) { const b = a[k]; if (b.stamp !== stamp) { b.stamp = stamp; fn(b); } }
    }
    for (const b of awake) if (b.stamp !== stamp) { b.stamp = stamp; fn(b); }
  }

  function wake(b) {
    if (b.awake) return;
    b.awake = true; b.still = 0; unfile(b); awake.push(b);
    if (!b.moved) {
      b.moved = true; b.resetT = 0;
      // whoever was sitting on it is not any more
      for (const s of b.seats || []) {
        if (game.act && game.act.seat && game.act.seat.ref === s) game.act.reset();
        if (game.peds && s.taken && s.taken !== 'player') game.peds.knockOff(s, b.vx, b.vz);
        s.taken = 'moved';
      }
      if (b.kind === 'vend') glowDirty = true;
    }
  }
  function sleep(b) { b.awake = false; b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0; awake.splice(awake.indexOf(b), 1); if (!b.hidden) file(b); }
  function home(b) {
    if (b.awake) sleep(b);
    if (b.cell >= 0) unfile(b);
    Object.assign(b, { x: b.hx, z: b.hz, y: b.K.he[1], moved: false, resetT: 0 });
    b.q.setFromAxisAngle(V.set(0, 1, 0), b.yaw);
    for (const s of b.seats || []) if (s.taken === 'moved') s.taken = null;
    if (b.kind === 'can') b.hidden = true;
    if (!b.hidden) file(b);
    write(b); glowDirty = true;
  }

  // footprint circles of a body at its current orientation
  const FP = [[0, 0, 0], [0, 0, 0]];
  function footprint(b) {
    const fp = b.K.fp, e = M.makeRotationFromQuaternion(b.q).elements;
    let ax = e[0], az = e[2]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    for (let i = 0; i < fp.length; i++) { FP[i][0] = b.x + ax * fp[i][0]; FP[i][1] = b.z + az * fp[i][0]; FP[i][2] = fp[i][1]; }
    return fp.length;
  }
  const topOf = (b) => b.y + b.K.he[1];

  // ---- a mover (vehicle circle or the courier) meets a body
  function contact(b, mv, nx, nz, ov, isPlayer) {
    const K = b.K, tank = mv.kind === 'tank', rails = !!mv.ai && !(mv.ai.stun > 0) && !mv.ai.pursuit;
    if (K.cls === 'fixed' && !b.free) return;                    // still bolted: the static collider handles it
    const cls = K.cls === 'fixed' ? 'light' : K.cls;
    const vx = isPlayer ? mv.vel.x : mv.vx, vz = isPlayer ? mv.vel.z : mv.vz, sp = tank ? Math.abs(mv.speed) : Math.hypot(vx, vz);
    const mm = isPlayer ? 70 : tank ? TANK_M : mv.kind === 'bike' ? BIKE_M : CAR_M;
    // anchored street furniture (newspaper boxes, benches, vending machines) doesn't budge for a
    // person or a motorbike: they stop against it. Cars and the tank still shove or topple it.
    if (K.anchor && !isPlayer && mv.kind === 'bike') {
      mv.x += nx * ov; mv.z += nz * ov;
      const vn = mv.vx * nx + mv.vz * nz;
      if (vn < 0) { mv.vx -= 1.3 * vn * nx; mv.vz -= 1.3 * vn * nz; if (vn < -3 && b.cool <= 0) { audio.knock(0.5); b.cool = 0.3; } }
      return;
    }
    if (cls === 'medium' && isPlayer) {                     // benches & co block the courier
      mv.pos.x += nx * ov; mv.pos.z += nz * ov;
      const vn = mv.vel.x * nx + mv.vel.z * nz;
      if (vn < 0) { mv.vel.x -= vn * nx; mv.vel.z -= vn * nz; }
      return;
    }
    const fling = tank || (cls === 'light' ? sp > (isPlayer ? 4.5 : 1.5) : sp > K.topple);
    if (fling && b.cool <= 0) {
      wake(b);
      const k = cls === 'light' ? 1.15 + Math.random() * 0.35 : 0.8 + Math.random() * 0.2, s = Math.min(sp, 30);
      b.vx = vx * k - nx * 1.5; b.vz = vz * k - nz * 1.5;
      b.vy = cls === 'light' ? 2 + s * (isPlayer ? 0.18 : 0.3) : 1.5 + s * 0.16;
      const spin = s * (cls === 'light' ? 0.9 : 0.45);
      b.wx = (Math.random() - 0.5) * spin; b.wy = (Math.random() - 0.5) * spin; b.wz = (Math.random() - 0.5) * spin;
      // turn the impact into a tip-over about the axis across the hit direction
      b.wx += vz / (s + 1e-3) * spin * 0.5; b.wz -= vx / (s + 1e-3) * spin * 0.5;
      b.y += 0.05; b.cool = 0.35;
      // the mover pays a little for it
      const loss = Math.min(cls === 'light' ? 0.08 : 0.35, (K.m / (mm + K.m)) * 1.6);
      if (isPlayer) { mv.vel.x *= 0.85; mv.vel.z *= 0.85; } else if (!tank && !rails) { mv.vx *= 1 - loss; mv.vz *= 1 - loss; }
      audio.knock(Math.min(1.2, 0.4 + K.m / 60));
      return;
    }
    // a shove: the two separate by mass, the body takes on the mover's push and slides
    const wb = mm / (mm + K.m), vn = -(vx * nx + vz * nz);           // closing speed (mover towards body)
    b.x -= nx * ov * (rails || isPlayer ? 1 : wb); b.z -= nz * ov * (rails || isPlayer ? 1 : wb);
    if (!rails && !isPlayer && !tank) { mv.x += nx * ov * (1 - wb); mv.z += nz * ov * (1 - wb); }
    if (vn > 0.05) {
      wake(b);
      const bv = vn * 1.2 * wb;
      if (-(b.vx * nx + b.vz * nz) < bv) { b.vx = -nx * bv + vx * 0.2; b.vz = -nz * bv + vz * 0.2; }
      b.wy += (Math.random() - 0.5) * vn * 0.4;
      if (!rails && !isPlayer && !tank) { const dv = vn * 1.2 * (1 - wb); mv.vx += nx * dv; mv.vz += nz * dv; }
      if (vn > 2 && b.cool <= 0) { audio.knock(0.5); b.cool = 0.3; }
    } else if (ov > 0.01) { wake(b); }
    if (!b.awake) write(b);
  }
  const CS = [];
  function touchMovers() {
    // vehicles (AI traffic on its lanes included: they shove what lies in the road)
    for (const v of game.vehicles.all()) {
      if (v.y > 1.6) continue;
      const sp = v.kind === 'tank' ? Math.abs(v.speed) : Math.hypot(v.vx, v.vz);
      if (sp < 0.05) continue;
      for (const c of circlesOf(v, CS)) {
        near(c[0], c[1], c[2], (b) => {
          if (b.hidden || v.y > topOf(b) + 0.2) return;
          const n = footprint(b);
          for (let i = 0; i < n; i++) {
            const dx = c[0] - FP[i][0], dz = c[1] - FP[i][1], d = Math.hypot(dx, dz), ov = c[2] + FP[i][2] - d;
            if (ov > 0 && d > 1e-4) { contact(b, v, dx / d, dz / d, ov, false); break; }
          }
        });
      }
    }
    // the courier on foot
    const P = game.player;
    if (!game.vehicle && !P.hidden && !game.inside && game.busy !== 'cut') {
      near(P.pos.x, P.pos.z, 0.42, (b) => {
        if (b.hidden || P.pos.y > topOf(b) - 0.1) return;
        const n = footprint(b);
        for (let i = 0; i < n; i++) {
          const dx = P.pos.x - FP[i][0], dz = P.pos.z - FP[i][1], d = Math.hypot(dx, dz), ov = 0.42 + FP[i][2] - d;
          if (ov > 0 && d > 1e-4) { contact(b, P, dx / d, dz / d, ov, true); break; }
        }
      });
    }
  }

  // ---- rigid-body step for one awake body: velocity, spin, gravity, ground friction, then rest
  const E = new THREE.Matrix4(), W = new THREE.Quaternion();
  const tp = { x: 0, z: 0 };
  function step(b, dt) {
    const K = b.K, he = K.he;
    b.cool -= dt;
    b.vy -= (K.ball ? 14 : 22) * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    W.set(b.wx * dt * 0.5, b.wy * dt * 0.5, b.wz * dt * 0.5, 0).multiply(b.q);
    b.q.x += W.x; b.q.y += W.y; b.q.z += W.z; b.q.w += W.w; b.q.normalize();
    const e = E.makeRotationFromQuaternion(b.q).elements;
    const low = K.ball ? he[1] : Math.abs(e[1]) * he[0] + Math.abs(e[5]) * he[1] + Math.abs(e[9]) * he[2];
    let ground = false;
    if (b.y - low < 0) {
      b.y = low; ground = true;
      if (b.vy < 0) b.vy = b.vy < -2 ? -b.vy * (K.bounce || 0.28) : 0;
      const f = Math.exp(-(K.ball ? 0.7 : 4.5) * dt);
      b.vx *= f; b.vz *= f;
      if (K.ball) { b.wx = b.vz / he[0]; b.wz = -b.vx / he[0]; b.wy *= f; }
      else {
        // settle onto the nearest flat face: swing the most-vertical local axis up
        let ai = 0, best = -1;
        for (let i = 0; i < 3; i++) { const u = Math.abs(e[1 + i * 4]); if (u > best) { best = u; ai = i; } }
        const sg = e[1 + ai * 4] > 0 ? 1 : -1, ax = e[ai * 4] * sg, az = e[2 + ai * 4] * sg;
        b.wx += -az * 22 * dt; b.wz += ax * 22 * dt;
        const wd = Math.exp(-5 * dt); b.wx *= wd; b.wy *= wd; b.wz *= wd;
      }
    }
    // walls and buildings
    tp.x = b.x; tp.z = b.z;
    const r = K.fp[0][1];
    for (const s of L.solids) {
      if (b.y - low > s.h) continue;
      const n = pushOut(tp, r, s);
      if (n) { const vn = b.vx * n.nx + b.vz * n.nz; if (vn < 0) { b.vx -= 1.4 * vn * n.nx; b.vz -= 1.4 * vn * n.nz; } }
    }
    if (clampToWorld(tp, r)) { b.vx *= -0.3; b.vz *= -0.3; }
    b.x = tp.x; b.z = tp.z;
    const w2 = b.wx * b.wx + b.wy * b.wy + b.wz * b.wz;
    if (ground && b.vx * b.vx + b.vz * b.vz + b.vy * b.vy < 0.05 && w2 < (K.ball ? 0.6 : 0.2)) b.still += dt; else b.still = 0;
    write(b);
    if (b.still > 0.4) sleep(b);
  }

  // ---- lamps, palms and hydrants (static props with a tag, see world/props.js)
  const falling = [], sprays = [], dead = [];
  let glowDirty = true;
  props.onHit = (o, mv) => {
    const tank = mv.kind === 'tank', sp = tank ? Math.abs(mv.speed) : Math.hypot(mv.vx, mv.vz);
    if (o.tag === 'lamp') {
      if (mv.kind === 'heli' || !(tank || sp > LAMP_BREAK)) return null;
      knockLamp(o, Math.atan2(mv.vx, mv.vz));
      if (!tank) { mv.vx *= 0.72; mv.vz *= 0.72; }
      return 'pass';
    }
    if (o.tag === 'hydrant') {
      // slow: it's bolted to the kerb and stops you. Fast (or a tank): it shears off its base and
      // flies, a water spout comes up where it stood, and the vehicle only loses a little speed.
      if (mv.kind === 'heli' || !(tank || sp > HYD_BREAK)) return null;
      o.off = true; o.t = 0; dead.push(o);
      o.spray = 22; o.sprayT = 0; sprays.push(o);
      const hb = o.body;
      if (hb) {
        hb.free = true; wake(hb);
        const s2 = Math.min(sp, 30), k = 0.9 + Math.random() * 0.3;
        hb.vx = mv.vx * k + (Math.random() - 0.5) * 2; hb.vz = mv.vz * k + (Math.random() - 0.5) * 2;
        hb.vy = 3 + s2 * 0.22; hb.y += 0.1; hb.cool = 0.4;
        hb.wx = (Math.random() - 0.5) * s2 * 0.8 + mv.vz / (s2 + 1e-3) * s2 * 0.4; hb.wz = (Math.random() - 0.5) * s2 * 0.8 - mv.vx / (s2 + 1e-3) * s2 * 0.4;
      }
      if (!tank) { mv.vx *= 0.86; mv.vz *= 0.86; }
      audio.clank(); audio.knock(1);
      return 'pass';
    }
    if (o.tag === 'palm' && tank) {
      o.off = true; o.t = 0; dead.push(o);
      falling.push({ o, kind: 'palm', ang: 0, w: 0.4, dir: Math.atan2(mv.vx, mv.vz) });
      audio.thud(0.6);
      return 'pass';
    }
    return null;
  };
  function knockLamp(o, dir) {
    o.off = true; o.t = 0; dead.push(o);
    const l = L.lamps[o.i];
    falling.push({ o, kind: 'lamp', ang: 0, w: 0.6, dir });
    city.lampLight(o.i, false);
    fx.sparks(l.x + Math.sin(l.yaw) * 1.45, 5.9, l.z + Math.cos(l.yaw) * 1.45);
    fx.sparks(l.x, 0.5, l.z, 14);
    audio.clank();
  }
  function restore(o) {
    o.off = false; o.spray = 0;
    if (o.body) { o.body.free = false; home(o.body); }
    if (o.tag === 'lamp') { city.tipLamp(o.i, 0, 0); city.lampLight(o.i, true); }
    if (o.tag === 'palm') city.tipPalm(o.i, 0, 0);
  }

  // ---- vending machines: glow sprites at night, the hum, buying
  const glow = createGlow(scene, Math.max(1, vends.length));
  function vendGlow() {
    vends.forEach((b, i) => {
      if (b.moved) { glow.hide(i); return; }
      const B = BRANDS[b.brand] || BRANDS.coolwave;
      glow.set(i, b.hx + Math.sin(b.yaw) * 0.6, 1.3, b.hz + Math.cos(b.yaw) * 0.6, B.glow, 3.2, 0.1);
    });
    glow.commit(); glowDirty = false;
  }
  let canI = 0;

  const api = {
    bodies, vends, mesh, KINDS,
    get awake() { return awake.length; },
    // an upright vending machine whose front the courier is standing at
    vendNear(p) {
      let best = null, bd = 1.5;
      for (const b of vends) {
        if (b.moved) continue;
        const fx_ = b.hx + Math.sin(b.yaw) * 0.85, fz = b.hz + Math.cos(b.yaw) * 0.85, d = Math.hypot(p.x - fx_, p.z - fz);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },
    // a can (or a snack packet) drops out of the tray with a clunk and rolls out
    drop(b) {
      const c = cans[canI++ % cans.length], s = Math.sin(b.yaw), co = Math.cos(b.yaw);
      if (c.awake) sleep(c);
      if (c.cell >= 0) unfile(c);
      Object.assign(c, { hidden: false, x: b.hx + s * 0.45 - co * 0.1, z: b.hz + co * 0.45 + s * 0.1, y: 0.34, vx: s * 1.4, vz: co * 1.4, vy: 0.6, wx: 3, wy: 1, wz: 0, moved: false });
      wake(c);
      audio.clunk();
    },
    // an explosion or a firework bang: everything loose within r is thrown outwards. Medium props only
    // shift for a strong one, anchored ones (benches, vending machines) only right next to it.
    blast(x, z, r, k = 1) {
      let n = 0;
      near(x, z, r, (b) => {
        if (b.hidden || (b.K.cls === 'fixed' && !b.free)) return;
        const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
        if (d > r) return;
        const f = (1 - d / r) * k, light = b.K.cls !== 'medium';
        if (!light && f < (b.K.anchor ? 0.6 : 0.3)) return;
        const sp = (light ? 11 : 5.5) * f * (b.K.m > 100 ? 0.45 : 1), inv = 1 / Math.max(d, 0.3);
        wake(b);
        b.vx += dx * inv * sp; b.vz += dz * inv * sp; b.vy += 1.5 + sp * 0.45; b.y += 0.05;
        b.wx += (Math.random() - 0.5) * sp * 1.4; b.wz += (Math.random() - 0.5) * sp * 1.4; b.wy += (Math.random() - 0.5) * sp;
        b.cool = 0.3; n++;
      });
      return n;
    },
    // a blaster bolt reaching (x, y, z): knocks a light prop it touches about. Returns the prop or null.
    hitAt(x, y, z, vx, vz, k = 1) {
      let hit = null;
      near(x, z, 0.8, (b) => {
        if (hit || b.hidden || (b.K.cls === 'fixed' && !b.free) || y > topOf(b) + 0.15 || y < b.y - b.K.he[1] - 0.2) return;
        const n = footprint(b);
        for (let i = 0; i < n; i++) if (Math.hypot(x - FP[i][0], z - FP[i][1]) < FP[i][2] + 0.12) { hit = b; break; }
      });
      if (hit && (hit.K.cls !== 'medium' || k > 1.5)) {
        const s = Math.hypot(vx, vz) || 1, sp = (hit.K.cls === 'medium' ? 1.5 : 4.5) * k;
        wake(hit);
        hit.vx += vx / s * sp; hit.vz += vz / s * sp; hit.vy += 1.2 + sp * 0.3; hit.y += 0.03;
        hit.wx += (Math.random() - 0.5) * sp * 2; hit.wz += (Math.random() - 0.5) * sp * 2; hit.cool = 0.2;
        audio.knock(0.6);
      }
      return hit;
    },
    // test hooks: wake / reset everything
    resetAll() { for (const b of bodies) if (b.moved || b.awake) home(b); for (const o of [...dead]) restore(o); dead.length = 0; falling.length = 0; sprays.length = 0; },
    status(b) { return { kind: b.kind, x: b.x, y: b.y, z: b.z, moved: b.moved, awake: b.awake, dist: Math.hypot(b.x - b.hx, b.z - b.hz) }; },
    sound: { hum: 0, spray: 0 },
    update(dt) {
      if (game.inside) return;
      touchMovers();
      for (let i = awake.length - 1; i >= 0; i--) step(awake[i], Math.min(dt, 0.04));
      // falling lamps and palms: a hinged fall about the base with a small bounce
      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.w += 6.5 * Math.sin(f.ang + 0.12) * dt; f.ang += f.w * dt;
        if (f.ang >= 1.47) { f.ang = 1.47; if (f.w > 1.2) f.w = -f.w * 0.22; else { falling.splice(i, 1); } }
        if (f.kind === 'lamp') city.tipLamp(f.o.i, f.ang, f.dir); else city.tipPalm(f.o.i, f.ang, f.dir);
      }
      // hydrant fountains
      const foc = game.focus();
      let sp = 0;
      for (let i = sprays.length - 1; i >= 0; i--) {
        const o = sprays[i];
        o.spray -= dt;
        if (o.spray <= 0) { sprays.splice(i, 1); continue; }
        fx.spray(o.x, o.z, Math.min(1, o.spray / 3));
        sp = Math.max(sp, (1 - Math.min(1, Math.hypot(foc.x - o.x, foc.z - o.z) / 40)) * Math.min(1, o.spray / 3));
      }
      api.sound.spray = sp;
      // the hum of the nearest vending machine, louder at night
      let hm = 0;
      for (const b of vends) if (!b.moved) hm = Math.max(hm, 1 - Math.min(1, Math.hypot(foc.x - b.hx, foc.z - b.hz) / 9));
      api.sound.hum = hm * (0.35 + 0.65 * nightU.value);
      if (glowDirty) vendGlow();
      // back home after a few minutes, once out of sight (both where it lies and where it belongs)
      for (const b of bodies) {
        if (!b.moved || b.awake || b.kind === 'hydrant') continue;
        b.resetT += dt;
        // knocked into a traffic lane: cleared once you've moved on (out of sight, or 25 m away)
        if (b.resetT > ROAD_CLEAR && onRoad(b.x, b.z, 0) && (unseen(camera, b.x, b.z, 30) || Math.hypot(foc.x - b.x, foc.z - b.z) > 25)) { home(b); continue; }
        if (b.resetT > RESET && (b.kind === 'can' || (unseen(camera, b.x, b.z, 50) && unseen(camera, b.hx, b.hz, 50)))) home(b);
      }
      for (let i = dead.length - 1; i >= 0; i--) {
        const o = dead[i];
        o.t += dt;
        if (o.t > RESET && !o.spray && !falling.some((f) => f.o === o) && unseen(camera, o.x, o.z, 60) && (!o.body || unseen(camera, o.body.x, o.body.z, 50))) { restore(o); dead.splice(i, 1); }
      }
    },
  };
  return api;
}
