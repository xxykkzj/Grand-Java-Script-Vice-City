// Solid street furniture and the places you can sit. The world builders register what they place
// (palms, lamps, benches, bins, umbrella poles, ...) as simple circles or boxes; build() files them
// in a static spatial grid so a mover only tests the few props in its own cells.
// Seats are points ({ x, z, y: seat height, yaw: the way you face, kind }) or lines (a seawall, a pier
// edge, bleacher steps): you can sit anywhere along a line.
import { clamp } from '../core/util.js';

const CELL = 8;
const key = (i, j) => (i + 512) * 1024 + (j + 512);

export function createProps() {
  const cols = [], seats = [], lines = [], grid = new Map(), seatGrid = new Map();
  const file = (map, o, x0, x1, z0, z1) => {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = key(i, j);
      let a = map.get(k);
      if (!a) map.set(k, a = []);
      a.push(o);
    }
  };
  let stamp = 0;
  const P = {
    cols, seats, lines,
    // circle collider (a pole, a trunk, a bin)
    circle(x, z, r, h = 3) { cols.push({ c: true, x, z, r, h, s: 0 }); },
    // box collider; yaw rounds the box to the nearest quarter turn
    box(x, z, w, d, h = 1, yaw = 0) {
      if (Math.abs(Math.sin(yaw)) > 0.7) { const t = w; w = d; d = t; }
      cols.push({ c: false, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, s: 0 });
    },
    seat(x, z, yaw, y, kind) { const s = { x, z, yaw, y, kind, taken: null }; seats.push(s); return s; },
    line(x0, z0, x1, z1, yaw, y, kind) { lines.push({ x0, z0, x1, z1, yaw, y, kind }); },
    build() {
      grid.clear(); seatGrid.clear();
      for (const o of cols) {
        if (o.c) file(grid, o, o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r);
        else file(grid, o, o.x0, o.x1, o.z0, o.z1);
      }
      for (const s of seats) file(seatGrid, s, s.x, s.x, s.z, s.z);
    },
    // Push a moving circle (p.x, p.z, radius r, standing at height y) out of every prop it overlaps.
    // vel (optional, with vx/vz or x/z) loses its inward part, plus `bounce` of it reflected.
    // minH skips props lower than that (the helicopter only cares about tall things). Returns the hardest hit.
    collide(p, r, y = 0, vel = null, bounce = 0, minH = 0) {
      stamp++;
      let hit = 0;
      const i0 = Math.floor((p.x - r) / CELL), i1 = Math.floor((p.x + r) / CELL), j0 = Math.floor((p.z - r) / CELL), j1 = Math.floor((p.z + r) / CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const a = grid.get(key(i, j));
        if (!a) continue;
        for (const o of a) {
          if (o.s === stamp || y > o.h || o.h < minH) continue;
          o.s = stamp;
          let nx, nz, pen;
          if (o.c) {
            const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), rr = r + o.r;
            if (d >= rr) continue;
            if (d < 1e-5) { nx = 1; nz = 0; } else { nx = dx / d; nz = dz / d; }
            pen = rr - d;
          } else {
            const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
            else {
              const l = p.x - o.x0, rt = o.x1 - p.x, n = p.z - o.z0, f = o.z1 - p.z, m = Math.min(l, rt, n, f);
              if (m === l) { nx = -1; nz = 0; } else if (m === rt) { nx = 1; nz = 0; } else if (m === n) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
              pen = m + r;
            }
          }
          p.x += nx * pen; p.z += nz * pen;
          if (vel) {
            const vx = vel.vx !== undefined ? 'vx' : 'x', vz = vel.vz !== undefined ? 'vz' : 'z';
            const vn = vel[vx] * nx + vel[vz] * nz;
            if (vn < 0) { vel[vx] -= (1 + bounce) * vn * nx; vel[vz] -= (1 + bounce) * vn * nz; hit = Math.max(hit, -vn); }
            else hit = Math.max(hit, 0.01);
          } else hit = Math.max(hit, 0.01);
        }
      }
      return hit;
    },
    // nearest free point seat within maxD, or the closest spot on a seat line
    nearest(x, z, maxD = 1.5) {
      let best = null, bd = maxD;
      for (let i = Math.floor((x - maxD) / CELL); i <= Math.floor((x + maxD) / CELL); i++) for (let j = Math.floor((z - maxD) / CELL); j <= Math.floor((z + maxD) / CELL); j++) {
        const a = seatGrid.get(key(i, j));
        if (a) for (const s of a) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd && !s.taken) { bd = d; best = s; } }
      }
      for (const l of lines) {
        const dx = l.x1 - l.x0, dz = l.z1 - l.z0, len2 = dx * dx + dz * dz;
        const t = clamp(((x - l.x0) * dx + (z - l.z0) * dz) / len2, 0, 1), px = l.x0 + dx * t, pz = l.z0 + dz * t, d = Math.hypot(px - x, pz - z);
        if (d < bd) { bd = d; best = { x: px, z: pz, yaw: l.yaw, y: l.y, kind: l.kind, line: true }; }
      }
      return best;
    },
  };
  return P;
}
