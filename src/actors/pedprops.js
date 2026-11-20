// Fixed street props as obstacles for pedestrians (actors/peds.js, actors/beachgoers.js).
// One static grid (4 m cells) of oriented boxes, built once from the same registries the placement checks use:
//   - the solid colliders (L.props.cols: lamps, palms, trunks, benches, bus shelter glass, planters, bins,
//     booths, hydrants, signal poles, beach huts / showers / fire pit / logs / umbrella poles ...), kept live
//     through their `off` flag (a knocked lamp or a sheared hydrant stops being an obstacle)
//   - the footprints of what is built into the merged meshes (layout.js FOOTPRINTS: sign and billboard legs,
//     lobby planters and posts, tree pits, scaffolding legs, bollards ...) and the lot boxes (FOOTBOXES),
//     where no collider already covers them
//   - the beach loungers (seats), which have no collider
//   - loose props (world/loose.js): benches, café tables and chairs, newspaper boxes, bins, vending machines.
//     Sleeping ones sit in the grid at their home spot; one that has been knocked around is taken out of
//     the grid and checked from a short list at its current position until it goes home again.
// A query returns the boxes within reach as [cx, cz, fx, fz, hl, hw, stopped, static] rows (the layout the
// vehicle boxes in peds.js use: a centre, the forward axis (sin, cos), half extents along / across it).
// Usable props (benches, loungers, fire logs, the kiosk ...) are exempt for a person whose goal or origin is
// at them: see the ex1 / ex2 points of fill().

const CELL = 4, key = (i, j) => (i + 1024) * 4096 + (j + 1024);
const SKIP_FP = /revolving door|doorman/;
// a prop must be at least this tall to matter to someone walking
const MIN_H = 0.3;

export function createPedProps(game, FOOTPRINTS, FOOTBOXES) {
  const L = game.L, grid = new Map(), ents = [], dyn = [], stats = { statics: 0, cols: 0, fps: 0, boxes: 0, lounger: 0, loose: 0, moved: 0, queries: 0, ms: 0 };
  let stamp = 0, loose = null;
  const add = (e) => {
    ents.push(e);
    const r = Math.abs(e.fx) * e.hl + Math.abs(e.fz) * e.hw, s = Math.abs(e.fz) * e.hl + Math.abs(e.fx) * e.hw;   // world half extents
    for (let i = Math.floor((e.x - r) / CELL); i <= Math.floor((e.x + r) / CELL); i++) for (let j = Math.floor((e.z - s) / CELL); j <= Math.floor((e.z + s) / CELL); j++) {
      const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e);
    }
    return e;
  };
  const box = (x, z, fx, fz, hl, hw, extra) => add({ x, z, fx, fz, hl, hw, s: 0, o: null, body: null, ...extra });
  const circle = (x, z, r, extra) => box(x, z, 0, 1, r, r, extra);

  // does (x, z) lie within r of a collider's shape?
  const nearCol = (cols, x, z, r) => {
    for (const o of cols) {
      if (o.c) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return o; }
      else if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return o;
    }
    return null;
  };

  function build() {
    const cols = L.props.cols.filter((o) => o.h >= MIN_H && !(o.y0 !== undefined && o.y0 > 0.8));
    // bucket the colliders so the footprint dedupe stays cheap
    const cg = new Map();
    for (const o of cols) {
      const x0 = o.c ? o.x - o.r : o.x0, x1 = o.c ? o.x + o.r : o.x1, z0 = o.c ? o.z - o.r : o.z0, z1 = o.c ? o.z + o.r : o.z1;
      for (let i = Math.floor(x0 / 8); i <= Math.floor(x1 / 8); i++) for (let j = Math.floor(z0 / 8); j <= Math.floor(z1 / 8); j++) { const k = key(i, j); let a = cg.get(k); if (!a) cg.set(k, a = []); a.push(o); }
    }
    const colAt = (x, z, r) => { const a = cg.get(key(Math.floor(x / 8), Math.floor(z / 8))); return a ? nearCol(a, x, z, r) : null; };
    for (const o of cols) {
      if (o.c) circle(o.x, o.z, o.r, { o, kind: o.tag || 'prop' });
      else box((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, 0, 1, (o.z1 - o.z0) / 2, (o.x1 - o.x0) / 2, { o, kind: o.tag || 'box' });
      stats.cols++;
    }
    for (const f of FOOTPRINTS) {
      if (SKIP_FP.test(f.what)) continue;
      // a collider already stands there and is at least as big: nothing to add
      const c = colAt(f.x, f.z, Math.min(f.r, 0.5) * 0.6);
      if (c && (c.c ? c.r >= f.r - 0.1 : Math.min(c.x1 - c.x0, c.z1 - c.z0) / 2 >= Math.min(f.r, 0.5) - 0.1)) continue;
      circle(f.x, f.z, Math.min(f.r, 1.6), { kind: 'fp:' + f.what.split(':')[0] });
      stats.fps++;
    }
    for (const f of FOOTBOXES) { box((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, 0, 1, (f.z1 - f.z0) / 2, (f.x1 - f.x0) / 2, { kind: 'lot:' + f.what.split(':')[0] }); stats.boxes++; }
    for (const s of L.props.seats) if (s.kind === 'lounger') { box(s.x, s.z, Math.sin(s.yaw), Math.cos(s.yaw), 0.95, 0.38, { kind: 'lounger', seat: s }); stats.lounger++; }
    stats.statics = ents.length;
  }
  // loose props (created after the peds): sleeping ones in the grid at their home spot
  function bindLoose(lo) {
    loose = lo;
    for (const b of lo.bodies) {
      if (b.hidden || b.kind === 'can' || b.kind === 'ball' || b.kind === 'hydrant') continue;       // hydrants: the bolted collider is already in
      const he = b.K.he, s = Math.sin(b.yaw), c = Math.cos(b.yaw);
      // the long axis of a bench is the body's local x, which points (cos yaw, -sin yaw) in the world
      if (b.kind === 'bench') add({ x: b.hx, z: b.hz, fx: c, fz: -s, hl: he[0], hw: he[2], s: 0, o: null, body: b, kind: 'bench' });
      else add({ x: b.hx, z: b.hz, fx: 0, fz: 1, hl: b.K.fp[0][1], hw: b.K.fp[0][1], s: 0, o: null, body: b, kind: b.kind });
      stats.loose++;
    }
  }
  // the knocked-about ones: a short list refreshed a few times a second
  const scan = () => {
    if (!loose) return;
    dyn.length = 0;
    for (const b of loose.bodies) if (b.moved && !b.hidden && b.kind !== 'can' && b.kind !== 'ball') {
      let e = b.pe; if (!e) e = b.pe = { x: 0, z: 0, fx: 0, fz: 1, hl: 0, hw: 0, s: 0, o: null, body: null, kind: b.kind };
      const he = b.K.he; e.x = b.x; e.z = b.z; e.hl = e.hw = Math.min(1.0, Math.max(he[0], he[1], he[2]) * 0.9);
      dyn.push(e);
    }
    stats.moved = dyn.length;
  };

  const inside = (e, x, z, m) => {
    const rx = x - e.x, rz = z - e.z;
    return Math.abs(rx * e.fx + rz * e.fz) < e.hl + m && Math.abs(rx * e.fz - rz * e.fx) < e.hw + m;
  };
  // Append the boxes within r of (x, z) to rows (from index n); returns the new count. A box is left out if
  // the point (ex1, ez1) or (ex2, ez2) (a goal, where someone is leaving from) lies at it: that prop is in use.
  function fill(rows, n, x, z, r, ex1 = NaN, ez1 = NaN, ex2 = NaN, ez2 = NaN) {
    stamp++;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    const take = (e) => {
      if (n >= rows.length) return;
      const rx = x - e.x, rz = z - e.z, la = Math.abs(rx * e.fx + rz * e.fz) - e.hl, lp = Math.abs(rx * e.fz - rz * e.fx) - e.hw;
      if (la > r || lp > r || (la > 0 && lp > 0 && la * la + lp * lp > r * r)) return;
      if ((ex1 === ex1 && inside(e, ex1, ez1, 0.9)) || (ex2 === ex2 && inside(e, ex2, ez2, 0.9))) return;
      const b = rows[n++]; b[0] = e.x; b[1] = e.z; b[2] = e.fx; b[3] = e.fz; b[4] = e.hl; b[5] = e.hw; b[6] = 1; b[7] = 1;
    };
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = grid.get(key(i, j));
      if (!a) continue;
      for (let k = 0; k < a.length; k++) {
        const e = a[k];
        if (e.s === stamp) continue;
        e.s = stamp;
        if (e.o ? e.o.off : e.body ? e.body.moved || e.body.hidden : false) continue;
        take(e);
      }
    }
    for (let k = 0; k < dyn.length; k++) take(dyn[k]);
    return n;
  }
  // test hook: the boxes within r of (x, z) as fresh rows
  const fillTest = (out, x, z, r, ex1, ez1, ex2, ez2) => { const rows = []; for (let k = 0; k < 96; k++) rows.push([0, 0, 0, 0, 0, 0, 0, 0]); const n = fill(rows, 0, x, z, r, ex1, ez1, ex2, ez2); out.length = 0; for (let k = 0; k < n; k++) out.push(rows[k].slice()); return n; };
  return { build, bindLoose, scan, fill, fillTest, stats, ents, inside, get ready() { return ents.length > 0; } };
}
