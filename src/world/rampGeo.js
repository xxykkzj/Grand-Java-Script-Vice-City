// Stunt ramp geometry (both districts): a wedge per sloped part, a raised deck on piers per flat part,
// hazard stripes on top and neon tubes along the edges. Parts come from world/surfaces.js registerRamps.
import * as THREE from 'three';
import { box, tint } from '../core/util.js';

const ASPH = '#3b3548', WALL_C = '#e9d8c4';
export function rampParts(rp, S, N, wrap = (g) => g) {
  for (const p of rp.parts) {
    if (p.rect) {
      const w = p.x1 - p.x0, d = p.z1 - p.z0;
      S.push(wrap(box(w, p.y, d, (p.x0 + p.x1) / 2, p.y / 2, (p.z0 + p.z1) / 2, '#8d8796')), wrap(box(w + 0.1, 0.12, d + 0.1, (p.x0 + p.x1) / 2, p.y - 0.04, (p.z0 + p.z1) / 2, ASPH)));
      for (const sx of [-1, 1]) { S.push(wrap(box(0.3, 0.9, d, (p.x0 + p.x1) / 2 + sx * (w / 2 - 0.15), p.y + 0.45, (p.z0 + p.z1) / 2, WALL_C))); }
      for (let z = p.z0 + 2; z < p.z1; z += 6) for (const sx of [-1, 1]) S.push(wrap(box(1.2, p.y, 1.2, (p.x0 + p.x1) / 2 + sx * (w / 2 - 1), p.y / 2, z, '#cbbfb0')));
      continue;
    }
    const g = new THREE.BoxGeometry(p.w, 1, p.len, 1, 1, 4), a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const z = a.getZ(i), top = p.y0 + (z + p.len / 2) * p.slope;
      a.setY(i, a.getY(i) > 0 ? top : Math.min(0, top));
    }
    g.computeVertexNormals(); g.rotateY(p.yaw); g.translate(p.x, 0, p.z);
    const up = p.slope > 0;
    S.push(wrap(tint(g, up ? '#ff6a3d' : '#8d8796')));
    // yellow stripes across the top and neon tubes along both edges
    for (let k = 0; k < p.len; k += 1.6) {
      const z = -p.len / 2 + k + 0.4, y = p.y0 + (z + p.len / 2) * p.slope + 0.03;
      const st = box(p.w * 0.96, 0.04, 0.6, 0, y, z, up ? '#ffd447' : '#f4eef7', Math.atan(-p.slope));
      st.rotateY(p.yaw); st.translate(p.x, 0, p.z); S.push(wrap(st));
    }
    for (const sx of [-1, 1]) {
      const t = box(0.1, 0.1, Math.hypot(p.len, p.y1 - p.y0), sx * p.w / 2, (p.y0 + p.y1) / 2 + 0.08, 0, up ? '#ff2bd1' : '#18f0ff', Math.atan(-p.slope));
      t.rotateY(p.yaw); t.translate(p.x, 0, p.z); N.push(t);
    }
  }
}

