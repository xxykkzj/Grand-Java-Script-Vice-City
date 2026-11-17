import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PI = Math.PI;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export function angleDelta(a, b) {
  let d = (b - a) % (PI * 2);
  if (d > PI) d -= PI * 2;
  if (d < -PI) d += PI * 2;
  return d;
}

// Small seeded PRNG so the island is identical on every load.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _c = new THREE.Color();
// Normalise a geometry to non-indexed position+normal+color so anything can be merged.
export function tint(geom, hex) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(hex);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function box(w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return tint(g, hex);
}
export function cyl(rt, rb, h, seg, x, y, z, hex, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return tint(g, hex);
}
export function merge(list) {
  const g = mergeGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g;
}

// Uniform objects shared by every custom shader.
export const timeU = { value: 0 };
export const fogU = {
  uFogColor: { value: new THREE.Color() },
  uFogNear: { value: 80 },
  uFogFar: { value: 520 },
};
export const pointScaleU = { value: 600 };
export const nightU = { value: 0 };

export const FOG_PARS = 'uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;';

export const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pause = (ms = 16) => new Promise((r) => setTimeout(r, ms));

// Circle vs axis-aligned box in the XZ plane. Moves p out of b, returns the contact normal.
export function pushOut(p, r, b) {
  const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
  const dx = p.x - cx, dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2), k = (r - d) / d;
    p.x += dx * k; p.z += dz * k;
    return { nx: dx / d, nz: dz / d };
  }
  const l = p.x - b.x0, rr = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z;
  const m = Math.min(l, rr, n, f);
  if (m === l) { p.x = b.x0 - r; return { nx: -1, nz: 0 }; }
  if (m === rr) { p.x = b.x1 + r; return { nx: 1, nz: 0 }; }
  if (m === n) { p.z = b.z0 - r; return { nx: 0, nz: -1 }; }
  p.z = b.z1 + r; return { nx: 0, nz: 1 };
}

// Shared by the wet-road shader and anything else that wants to look rained on.
export const wetU = { value: 0 };
export const rainU = { value: 0 };
export const reflU = { sky: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, dir: { value: new THREE.Vector3(0, 1, 0) } };

// Does the segment (x0,z0)-(x1,z1) pass through any solid box? Used for police line of sight.
export function segBlocked(x0, z0, x1, z1, solids) {
  const dx = x1 - x0, dz = z1 - z0;
  for (const b of solids) {
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-6) { if (x0 < b.x0 || x0 > b.x1) continue; } else {
      let a = (b.x0 - x0) / dx, c = (b.x1 - x0) / dx;
      if (a > c) { const s = a; a = c; c = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-6) { if (z0 < b.z0 || z0 > b.z1) continue; } else {
      let a = (b.z0 - z0) / dz, c = (b.z1 - z0) / dz;
      if (a > c) { const s = a; a = c; c = s; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) continue;
    }
    return true;
  }
  return false;
}

// Uniform spatial hash for neighbour queries (cars, pedestrians, the player). Rebuilt every frame.
export function createGrid(cell = 14) {
  const map = new Map();
  const K = (x) => Math.floor(x / cell) + 512;
  return {
    clear() { for (const a of map.values()) a.length = 0; },
    add(o) {
      const k = K(o.x) * 1024 + K(o.z);
      let a = map.get(k);
      if (!a) map.set(k, a = []);
      a.push(o);
    },
    query(x, z, r, fn) {
      const i0 = K(x - r), i1 = K(x + r), j0 = K(z - r), j1 = K(z + r);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const a = map.get(i * 1024 + j);
        if (a) for (let k = 0; k < a.length; k++) fn(a[k]);
      }
    },
  };
}

// A daily curve: keys are [hour, value] pairs from 0 to 24; smooth (eased) between keys.
export function dailyCurve(keys, h) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < keys.length - 2 && h >= keys[i + 1][0]) i++;
  const [h0, a] = keys[i], [h1, b] = keys[i + 1];
  let k = clamp((h - h0) / Math.max(h1 - h0, 1e-6), 0, 1);
  k = k * k * (3 - 2 * k);
  return a + (b - a) * k;
}

// Is the ground point (x, z) out of the player's sight? Far away, or well outside the view cone.
// Used to park / bring back cars and people without popping them in view.
const _fwd = new THREE.Vector3();
export function unseen(camera, x, z, near = 60, far = 330) {
  const p = camera.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < near) return false;
  if (d > far) return true;
  camera.getWorldDirection(_fwd);
  const f = Math.hypot(_fwd.x, _fwd.z) || 1;
  return (dx * _fwd.x + dz * _fwd.z) / (d * f) < 0.4;
}
// unseen(), or tucked behind a building as seen from a street-level camera
export function outOfSight(camera, x, z, solids, near = 60) {
  if (unseen(camera, x, z, near, 260)) return true;
  const p = camera.position;
  return p.y < 9 && Math.hypot(x - p.x, z - p.z) > near * 0.6 && segBlocked(p.x, p.z, x, z, solids);
}
