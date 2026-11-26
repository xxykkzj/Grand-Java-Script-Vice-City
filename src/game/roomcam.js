// The third-person orbit camera indoors (game/places.js): mouse drag / touch swipe turns it round Skye (yaw, and a
// modest pitch), smoothed like the street camera, and it pulls in towards her whenever the room's own geometry
// (walls, ceilings, the mezzanine slabs, stairs, big furniture) or the room's bounds stand between her and it, so it
// never clips out of the room or through a floor.
//
// Collision is an exact ray test against the room's merged body mesh (the one opaque mesh that holds every wall,
// floor, ceiling and piece of furniture, game/interiors.js buildRoom), made cheap with a 1 m grid over the floor plan
// built once per room: a ray only tests the triangles of the cells it passes over (a few hundred per frame).
import { clamp, damp, angleDelta } from '../core/util.js';

const CELL = 1;

// the room-local triangles of the body mesh, bucketed into xz cells
function buildGrid(r) {
  const mesh = r.group && r.group.children.find((o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position);
  if (!mesh) return null;
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const nT = idx ? idx.count / 3 : pos.count / 3;
  const T = new Float32Array(nT * 9);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
    const i = idx ? idx.getX(t * 3 + k) : t * 3 + k, o = t * 9 + k * 3;
    // (the body sits at the group's origin: its positions are already room-local; y from the room's floor)
    T[o] = pos.getX(i); T[o + 1] = pos.getY(i); T[o + 2] = pos.getZ(i);
    x0 = Math.min(x0, T[o]); x1 = Math.max(x1, T[o]); z0 = Math.min(z0, T[o + 2]); z1 = Math.max(z1, T[o + 2]);
  }
  const nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), nz = Math.max(1, Math.ceil((z1 - z0) / CELL));
  const lists = Array.from({ length: nx * nz }, () => []);
  for (let t = 0; t < nT; t++) {
    const o = t * 9;
    const ax = Math.min(T[o], T[o + 3], T[o + 6]), bx = Math.max(T[o], T[o + 3], T[o + 6]);
    const az = Math.min(T[o + 2], T[o + 5], T[o + 8]), bz = Math.max(T[o + 2], T[o + 5], T[o + 8]);
    // degenerate slivers (zero area) never block
    const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
    if (cx * cx + cy * cy + cz * cz < 1e-10) continue;
    const i0 = clamp(Math.floor((ax - x0) / CELL), 0, nx - 1), i1 = clamp(Math.floor((bx - x0) / CELL), 0, nx - 1);
    const k0 = clamp(Math.floor((az - z0) / CELL), 0, nz - 1), k1 = clamp(Math.floor((bz - z0) / CELL), 0, nz - 1);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) lists[k * nx + i].push(t);
  }
  const cells = lists.map((l) => Int32Array.from(l));
  return { T, cells, nx, nz, x0, z0, stamp: new Uint32Array(nT), cstamp: new Uint32Array(nx * nz), frame: 1, tris: nT };
}

// nearest hit of the ray o + d t (d normalised), 0 < t < maxT, against the room body; Infinity if none
function rayRoom(G, ox, oy, oz, dx, dy, dz, maxT) {
  const { T, cells, nx, nz, x0, z0, stamp, cstamp } = G;
  const fr = ++G.frame;
  let best = maxT, tested = 0;
  const step = CELL * 0.35, n = Math.ceil(maxT / step) + 1;
  for (let s = 0; s <= n; s++) {
    const tt = Math.min(maxT, s * step);
    const ci = Math.floor((ox + dx * tt - x0) / CELL), ck = Math.floor((oz + dz * tt - z0) / CELL);
    // the cells round the sample, so a ray that cuts a cell's corner between two samples is still covered
    for (let i = ci - 1; i <= ci + 1; i++) for (let k = ck - 1; k <= ck + 1; k++) {
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      const c = k * nx + i;
      if (cstamp[c] === fr) continue;
      cstamp[c] = fr;
      const L = cells[c];
      for (let j = 0; j < L.length; j++) {
        const t = L[j];
        if (stamp[t] === fr) continue;
        stamp[t] = fr; tested++;
        const o = t * 9;
        const ax = T[o], ay = T[o + 1], az = T[o + 2];
        const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az, e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-9 && det < 1e-9) continue;
        const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az;
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const h = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (h > 1e-4 && h < best) best = h;
      }
    }
    if (tt >= maxT || tt > best) break;
  }
  G.tested = tested;
  return best < maxT ? best : Infinity;
}

// the orbit camera; places.js calls update() every frame it walks you round a room in third person
export function createRoomCam(camera, cam, OY) {
  const S = { on: false, blend: 1, dist: 3, tx: 0, ty: 0, tz: 0, last: null, room: null, hits: 0 };
  const WANT = { third: 4.4, close: 2.5 };
  const PMIN = -0.22, PMAX = 0.95, LIFT = 1.35, MARGIN = 0.28, MIN = 0.55;
  const grid = (r) => (r._camGrid === undefined ? (r._camGrid = buildGrid(r)) : r._camGrid);
  const api = {
    S,
    // a framed camera (a menu, a seat, a scene...) had the camera: start again from where it is now
    reset() { S.on = false; },
    // ray from Skye's head out to where the camera wants to be: the free distance (room-local coordinates)
    free(r, B, ceil, lx, ly, lz, dx, dy, dz, want) {
      let t = want;
      // the room's bounds (a box from just above the floor to under the ceiling)
      const m = 0.22;
      if (dx > 1e-6) t = Math.min(t, (B.x1 - m - lx) / dx); else if (dx < -1e-6) t = Math.min(t, (B.x0 + m - lx) / dx);
      if (dz > 1e-6) t = Math.min(t, (B.z1 - m - lz) / dz); else if (dz < -1e-6) t = Math.min(t, (B.z0 + m - lz) / dz);
      if (dy > 1e-6) t = Math.min(t, (ceil - 0.22 - ly) / dy);
      const G = grid(r);
      if (G) { const h = rayRoom(G, lx, ly, lz, dx, dy, dz, want + MARGIN); if (h < Infinity) { t = Math.min(t, h - MARGIN); S.hits++; } }
      return Math.max(MIN, t);
    },
    // before the walk: make sure the orbit has taken over (so W/S already go the way the camera looks)
    begin(r) {
      const p = r.game.player.pos, lx = p.x - r.ox, lz = p.z - r.oz, ly = p.y - OY + (r.swimming ? 0.6 : LIFT);
      if (!S.on || S.room !== r) {
        // take over from wherever the camera is: its yaw, pitch and distance round Skye, then ease into place
        const c = camera.position, vx = p.x - c.x, vz = p.z - c.z, hd = Math.hypot(vx, vz);
        cam.yaw = hd > 0.05 ? Math.atan2(vx, vz) : cam.yaw;
        cam.pitch = clamp(Math.atan2(c.y - (OY + ly), Math.max(hd, 0.1)), 0.1, 0.7);
        S.dist = clamp(Math.hypot(hd, c.y - OY - ly), MIN, 5);
        S.tx = lx; S.ty = ly; S.tz = lz; S.on = true; S.room = r; S.blend = 0;
      }
    },
    update(dt, r, inp, B, ceilAt, floorY) {
      api.begin(r);
      const p = r.game.player.pos, lx = p.x - r.ox, lz = p.z - r.oz, ly = p.y - OY + (r.swimming ? 0.6 : LIFT);
      if (inp && (inp.dragDX || inp.dragDY)) {
        cam.yaw -= inp.dragDX * 0.0055;
        cam.pitch = clamp(cam.pitch + inp.dragDY * 0.004, PMIN, PMAX);
      }
      cam.pitch = clamp(cam.pitch, PMIN, PMAX);
      S.tx = damp(S.tx, lx, 12, dt); S.tz = damp(S.tz, lz, 12, dt); S.ty = damp(S.ty, ly, 10, dt);
      // the head can't lag behind through a block: when Skye moves fast the target snaps closer
      if (Math.hypot(S.tx - lx, S.tz - lz) > 0.6) { S.tx = lx; S.tz = lz; }
      const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
      const want = cam.view.id === 'close' ? WANT.close : WANT.third;
      const ceil = ceilAt(r, S.tx, S.tz, floorY);
      const ty = Math.min(S.ty, ceil - 0.3);
      const fr = api.free(r, B, ceil, S.tx, ty, S.tz, dx, dy, dz, want);
      // in at once when something is in the way, back out gently
      S.dist = fr < S.dist ? fr : damp(S.dist, fr, 4, dt);
      const wx = r.ox + S.tx + dx * S.dist, wy = OY + ty + dy * S.dist, wz = r.oz + S.tz + dz * S.dist;
      const c = camera.position;
      if (S.blend < 1) {
        S.blend = Math.min(1, S.blend + dt * 2.2);
        const k = S.blend >= 1 ? 1 : 1 - Math.exp(-9 * dt);
        c.set(c.x + (wx - c.x) * k, c.y + (wy - c.y) * k, c.z + (wz - c.z) * k);
      } else c.set(wx, wy, wz);
      camera.lookAt(r.ox + S.tx, OY + ty + 0.12, r.oz + S.tz);
    },
    // checks: the free distance and the hit along any ray from Skye's head (room-local), and the grid's size
    probe(r, lx, ly, lz, dx, dy, dz, maxT) { const G = grid(r); if (!G) return null; const n = Math.hypot(dx, dy, dz); return { hit: rayRoom(G, lx, ly, lz, dx / n, dy / n, dz / n, maxT), tris: G.tris, tested: G.tested }; },
    angleDelta,
  };
  return api;
}
