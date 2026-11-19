// The lane graph AI traffic drives on, the traffic-light timing, and the signal heads.
// Right-hand traffic. Junction nodes are boxes (hx, hz) whose edges are the stop lines.
import * as THREE from 'three';
import { SIDE_X } from './layout.js';
import { KH, KV, KEY_JUNCTIONS } from './key.js';
import { box, cyl, merge } from '../core/util.js';

export const CYCLE = 30;
export const H_ROADS = [
  { z: 53, hw: 9, off: 2.3, end: 291, hz: 13.8 },     // Lumina Boulevard (inner lanes; outer lanes are parking)
  { z: -4, hw: 6, off: 2, end: 286, hz: 10.2 },
  { z: -68, hw: 6, off: 2, end: 286, hz: 10.2 },
];

export function makeRoads() {
  const nodes = [], edges = [];
  const node = (x, z, hx, hz, light) => {
    const n = { id: nodes.length, x, z, hx, hz, light, exits: [], ins: [], heads: [], key: -1, offset: light ? (Math.abs(x) * 0.07 + Math.abs(z) * 0.31) % CYCLE : 0 };
    nodes.push(n);
    return n;
  };
  const link = (a, b, off, hw) => {
    for (const [p, q] of [[a, b], [b, a]]) {
      const d = Math.hypot(q.x - p.x, q.z - p.z), dx = (q.x - p.x) / d, dz = (q.z - p.z) / d;
      const rx = -dz, rz = dx, ep = Math.abs(dx) * p.hx + Math.abs(dz) * p.hz, eq = Math.abs(dx) * q.hx + Math.abs(dz) * q.hz;
      const e = {
        id: edges.length, from: p, to: q, dx, dz, h: Math.abs(dx) > 0.5, hw, off,
        x0: p.x + dx * ep + rx * off, z0: p.z + dz * ep + rz * off, x1: q.x - dx * eq + rx * off, z1: q.z - dz * eq + rz * off,
      };
      e.len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
      edges.push(e); p.exits.push(e); q.ins.push(e);
    }
  };
  const rows = H_ROADS.map((r) => {
    const row = [node(-r.end, r.z, 0, 0, false), ...SIDE_X.map((x) => node(x, r.z, 11, r.hz, true)), node(r.end, r.z, 0, 0, false)];
    for (let i = 0; i < row.length - 1; i++) link(row[i], row[i + 1], r.off, r.hw);
    return row;
  });
  for (let i = 1; i <= SIDE_X.length; i++) { link(rows[0][i], rows[1][i], 2, 6); link(rows[1][i], rows[2][i], 2, 6); }
  // Solano Key: its junctions (all signalled), dead ends, and Halcyon Avenue running over the causeway
  // into Lumina Boulevard (the boulevard's old west dead end becomes a straight pass-through)
  const J = new Map();
  for (const j of KEY_JUNCTIONS) J.set(j.x + ',' + j.z, node(j.x, j.z, 11, j.h.hz, true));
  const at = (x, z) => J.get(x + ',' + z) || node(x, z, 0, 0, false);
  for (const h of KH) {
    const xs = [...new Set([h.x0, ...KV.filter((v) => h.z >= v.z0 && h.z <= v.z1).map((v) => v.x), ...(h.z === 53 ? [] : [h.x1])])].sort((a, b) => a - b);
    const row = xs.map((x) => at(x, h.z));
    for (let i = 0; i < row.length - 1; i++) link(row[i], row[i + 1], h.off, h.hw);
    if (h.z === 53) link(row[row.length - 1], rows[0][0], h.off, h.hw);
  }
  for (const v of KV) {
    const zs = [...new Set([v.z0, ...KH.filter((h) => h.z >= v.z0 && h.z <= v.z1).map((h) => h.z), v.z1])].sort((a, b) => a - b);
    const col = zs.map((z) => at(v.x, z));
    for (let i = 0; i < col.length - 1; i++) link(col[i], col[i + 1], 2, 6);
  }
  return { nodes, edges, lights: nodes.filter((n) => n.light), at: (x, z) => nodes.find((n) => n.x === x && n.z === z) };
}

// 0 green, 1 amber, 2 red for traffic travelling along x (h) or along z at junction n.
export function signal(n, h, t) {
  if (!n.light) return 0;
  const tt = (t + n.offset) % CYCLE;
  if (h) return tt < 12 ? 0 : tt < 14.5 ? 1 : 2;
  return tt < 16 ? 2 : tt < 26 ? 0 : tt < 28.5 ? 1 : 2;
}
// May a pedestrian who needs `need` seconds start crossing? crossH = they cross the east-west road.
export function walkOK(n, crossH, t, need) {
  const tt = (t + n.offset) % CYCLE;
  return crossH ? tt >= 16 && tt + need < 27.5 : tt + need < 13.5;
}

// Path through a junction (or a U-turn at a dead end) as a short polyline.
export function connector(e1, e2) {
  const x0 = e1.x1, z0 = e1.z1, x3 = e2.x0, z3 = e2.z0;
  const k = e2.to === e1.from ? 5 : Math.hypot(x3 - x0, z3 - z0) * 0.45;
  const x1 = x0 + e1.dx * k, z1 = z0 + e1.dz * k, x2 = x3 - e2.dx * k, z2 = z3 - e2.dz * k;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    pts.push([a * x0 + b * x1 + c * x2 + d * x3, a * z0 + b * z1 + c * z2 + d * z3]);
  }
  return pts;
}

const LIT = ['#ff2a3a', '#ffb62e', '#3dff8a'], WALK = '#dffcff', WAIT = '#ff6a1a';

// One instanced mast per approach, one instanced cube per lamp. Colours change only when a phase flips.
export function buildSignals(scene, R, mat, props) {
  const heads = [];
  for (const n of R.lights) for (const e of n.ins) { n.heads.push(heads.length); heads.push(e); }
  // local frame: traffic travels +z, the kerb is at the origin, the road is towards +x
  const DARK = '#2b2540';
  const geo = merge([
    cyl(0.09, 0.13, 5.4, 6, 0, 2.7, 0, DARK), box(2.7, 0.1, 0.1, 1.35, 5.3, 0, DARK),
    box(0.42, 1.3, 0.34, 2.6, 4.9, 0, DARK), box(0.5, 0.06, 0.5, 2.6, 5.58, 0, '#ffd166'),
    box(0.3, 0.34, 0.3, 0.2, 2.7, 0, DARK),
  ]);
  const masts = new THREE.InstancedMesh(geo, mat, heads.length);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshBasicMaterial(), heads.length * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const LOCAL = [[2.6, 5.3, -0.14], [2.6, 4.9, -0.14], [2.6, 4.5, -0.14], [0.36, 2.7, 0]];
  heads.forEach((e, i) => {
    const lat = e.hw - e.off + 1.3, px = e.x1 - e.dz * lat, pz = e.z1 + e.dx * lat, yaw = Math.atan2(e.dx, e.dz);
    q.setFromAxisAngle(UP, yaw);
    masts.setMatrixAt(i, m.compose(p.set(px, 0, pz), q, s));
    if (props) props.circle(px, pz, 0.2, 5.6).tag = 'mast';
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    LOCAL.forEach((l, k) => lamps.setMatrixAt(i * 4 + k, m.compose(p.set(px + l[0] * c + l[2] * sn, l[1], pz - l[0] * sn + l[2] * c), q, s)));
  });
  masts.frustumCulled = lamps.frustumCulled = false;
  scene.add(masts, lamps);
  const col = new THREE.Color();
  return {
    update(t) {
      let dirty = false;
      for (const n of R.lights) {
        const sh = signal(n, true, t), sv = signal(n, false, t), key = sh * 3 + sv;
        if (key === n.key) continue;
        n.key = key; dirty = true;
        for (const i of n.heads) {
          const mine = heads[i].h ? sh : sv, other = heads[i].h ? sv : sh;
          for (let k = 0; k < 3; k++) { col.set(LIT[k]); if (k !== mine) col.multiplyScalar(0.1); lamps.setColorAt(i * 4 + k, col); }
          lamps.setColorAt(i * 4 + 3, col.set(mine === 2 && other === 0 ? WALK : WAIT));
        }
      }
      if (dirty) lamps.instanceColor.needsUpdate = true;
    },
  };
}
