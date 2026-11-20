// Everything above street level you can stand, land or drive on: flat roofs (both districts), helipads,
// container stacks, stunt ramps and the raised decks of the unfinished overpass. Pure data plus a static
// grid, so the courier, cars, bikes and the helicopter all ask the same question: how high is the ground here?
//
//   rect:  { x0, x1, z0, z1, y }                              a flat top
//   ramp:  { x, z, yaw, len, w, y0, y1 }                       rises from y0 to y1 along yaw (the way you drive up)
// Roof doors ({ x, z, y, out: { x, z, yaw } }) take you down the stairs to the street (game/rooftops.js).
const CELL = 16;
const key = (i, j) => (i + 512) * 1024 + (j + 512);

export function createSurfaces() {
  const list = [], grid = new Map(), doors = [];
  const file = (o, x0, x1, z0, z1) => {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = key(i, j);
      let a = grid.get(k);
      if (!a) grid.set(k, a = []);
      a.push(o);
    }
  };
  const S = {
    list, doors,
    rect(x0, x1, z0, z1, y, tag = 'roof', extra = {}) { const o = { rect: true, x0, x1, z0, z1, y, tag, ...extra }; list.push(o); file(o, x0, x1, z0, z1); return o; },
    ramp(x, z, yaw, len, w, y0, y1, tag = 'ramp', extra = {}) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), hx = Math.abs(fx) * len / 2 + Math.abs(fz) * w / 2, hz = Math.abs(fz) * len / 2 + Math.abs(fx) * w / 2;
      const o = { rect: false, x, z, yaw, fx, fz, len, w, y0, y1, slope: (y1 - y0) / len, tag, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, ...extra };
      list.push(o); file(o, o.x0, o.x1, o.z0, o.z1); return o;
    },
    door(x, z, y, out, b) { const d = { x, z, y, out, b }; doors.push(d); return d; },
    // height of surface o at (x, z), or -Infinity if (x, z) is not on it
    heightOn(o, x, z) {
      if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) return -Infinity;
      if (o.rect) return o.y;
      const dx = x - o.x, dz = z - o.z, u = dx * o.fx + dz * o.fz, v = dx * o.fz - dz * o.fx;
      if (Math.abs(u) > o.len / 2 || Math.abs(v) > o.w / 2) return -Infinity;
      return o.y0 + (u + o.len / 2) * o.slope;
    },
    // the highest surface at (x, z) that is not above `below` (so you do not snap up onto a roof from the street);
    // 0 (the ground) when there is none. S.last is the surface found.
    at(x, z, below = Infinity) {
      const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      let best = 0;
      S.last = null;
      if (!a) return 0;
      for (const o of a) {
        if (o.off) continue;
        const h = S.heightOn(o, x, z);
        if (h > best && h <= below) { best = h; S.last = o; }
      }
      return best;
    },
    last: null,
    // the highest ramp, deck or container top at (x, z) (not roofs: buildings have their own walls)
    climb(x, z) {
      const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      let best = 0;
      if (a) for (const o of a) if (!o.off && o.tag !== 'roof') best = Math.max(best, S.heightOn(o, x, z));
      return best;
    },
    // nearest roof door within reach of (x, y, z)
    doorNear(x, y, z, reach = 1.8) {
      let best = null, bd = reach;
      for (const d of doors) { if (Math.abs(d.y - y) > 1.2) continue; const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
      return best;
    },
  };
  return S;
}

// The stunt ramps (world/layout.js A_RAMPS, world/key.js) as surfaces, plus solids under raised decks.
// Every ramp gets r.top: the point where it launches you, and r.parts: the surfaces it is made of.
export function registerRamps(S, ramps, solids) {
  for (const r of ramps) {
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw), base = r.base || 0;
    r.parts = [];
    if (r.deck) {
      // the overpass: up ramp, deck with a lip, a gap, a second deck and a ramp down (all along +z)
      const D = r.deck, D2 = r.deck2, dn = r.down, w2 = r.w2 || r.w;
      r.parts.push(S.ramp(r.x, r.z, 0, r.len, r.w, 0, r.h, 'ramp', { stunt: r }));
      r.parts.push(S.rect(r.x - r.w / 2, r.x + r.w / 2, D.z0, D.z1 - D.lip, r.h, 'deck', { stunt: r }));
      r.parts.push(S.ramp(r.x, D.z1 - D.lip / 2, 0, D.lip, r.w, r.h, r.h + D.lipH, 'ramp', { stunt: r, kicker: true }));
      // the landing deck and the ramp down are wider than the run-up (w2), so a jump that lands a little off line still lands
      r.parts.push(S.rect(r.x - w2 / 2, r.x + w2 / 2, D2.z0, D2.z1, r.h, 'deck'));
      r.parts.push(S.ramp(r.x, (dn.z0 + dn.z1) / 2, 0, dn.z1 - dn.z0, w2, r.h, 0, 'ramp'));
      // (the solids stop a metre short of the deck top, so a car coming up the ramp is already above them)
      solids.push({ x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: D.z0, z1: D.z1, h: r.h - 1, deck: true }, { x0: r.x - w2 / 2, x1: r.x + w2 / 2, z0: D2.z0, z1: D2.z1, h: r.h - 1, deck: true });
      // guard rails: the parapets along both decks are solid for anything driving on them (cars used to slide off the side)
      for (const sx of [-1, 1]) {
        solids.push({ x0: r.x + sx * r.w / 2 - (sx > 0 ? 0.35 : 0), x1: r.x + sx * r.w / 2 + (sx > 0 ? 0 : 0.35), z0: D.z0, z1: D.z1, h: r.h + D.lipH + 0.9, rail: true });
        solids.push({ x0: r.x + sx * w2 / 2 - (sx > 0 ? 0.35 : 0), x1: r.x + sx * w2 / 2 + (sx > 0 ? 0 : 0.35), z0: D2.z0, z1: D2.z1, h: r.h + 0.9, rail: true });
      }
      r.top = { x: r.x, z: D.z1, y: r.h + D.lipH, yaw: 0, slope: D.lipH / D.lip };
      continue;
    }
    r.parts.push(S.ramp(r.x, r.z, r.yaw, r.len, r.w, base, base + r.h, 'ramp', { stunt: r, kicker: !r.kick }));
    let tx = r.x + fx * r.len / 2, tz = r.z + fz * r.len / 2, ty = base + r.h, sl = r.h / r.len;
    if (r.kick) {
      const k = r.kick, kx = tx + fx * k.len / 2, kz = tz + fz * k.len / 2;
      r.parts.push(S.ramp(kx, kz, r.yaw, k.len, r.w, ty, ty + k.h, 'ramp', { stunt: r, kicker: true }));
      tx += fx * k.len; tz += fz * k.len; ty += k.h; sl = k.h / k.len;
    }
    r.top = { x: tx, z: tz, y: ty, yaw: r.yaw, slope: sl };
  }
}
