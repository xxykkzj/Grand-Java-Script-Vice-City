// The small stuff that makes the town read as a place: rooftop clutter, penthouse tiers, billboards,
// awnings and lit shopfronts, blade signs, street furniture, beach and pier props. Everything here
// is pushed into the city's merged solid / neon meshes, so it adds triangles but no draw calls.
// Gulls and boats move, so they get one draw call each.
import * as THREE from 'three';
import { box, cyl, tint, merge, rng, PI, timeU } from '../core/util.js';
import { pierDetails } from './pier.js';
import { PIER, ADS, SIDE_X, offRoad, inJunction, footprint } from './layout.js';
import { KEY_ADS } from './key.js';
import { beachGeometry } from './beach.js';

const INK = '#1d1630', CREAM = '#fbf7f0', STEEL = '#b9bcc8';
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];

export function addDetails(L, S, N, glows, addWin, signs) {
  const r = rng(808), P = L.props;
  // a neon tube between two points on a façade
  const seg = (x0, y0, x1, y1, z, hex, t = 0.11) => {
    const dx = x1 - x0, dy = y1 - y0;
    N.push(box(Math.hypot(dx, dy) + t, t, t, (x0 + x1) / 2, (y0 + y1) / 2, z, hex, 0, 0, Math.atan2(dy, dx)));
  };
  const path = (pts, z, hex) => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], z, hex); };
  const billboard = (name, x, y, z, yaw, w, color) => {
    const h = w / 4, s = Math.sin(yaw), c = Math.cos(yaw);
    signs.push({ name, color, x: x + s * 0.14, y, z: z + c * 0.14, yaw, w, h });
    S.push(box(w + 0.5, h + 0.4, 0.22, x, y, z, INK, 0, yaw));
    for (const o of [-w * 0.32, w * 0.32]) {
      S.push(box(0.22, y, 0.22, x + c * o - s * 0.2, y / 2, z - s * o - c * 0.2, '#3b3350'));
      if (y < 8) { P.circle(x + c * o - s * 0.2, z - s * o - c * 0.2, 0.2, y + h / 2); footprint('billboard leg: ' + name, x + c * o - s * 0.2, z - s * o - c * 0.2, 0.11); }   // stilts on the ground (not the rooftop ones)
    }
    N.push(box(w + 0.5, 0.1, 0.1, x + s * 0.16, y + h / 2 + 0.2, z + c * 0.16, color, 0, yaw));
    glows.push([x + s, y, z + c, color, w * 1.3, 0]);
  };

  let ad = 0, blade = 0;
  for (const b of L.buildings) {
    const { cx, cz, w, d, h } = b, top = h + 1.4;
    // --- rooftops: air-con units, vents, a water tank or an aerial
    const spot = () => {
      for (let i = 0; i < 8; i++) {
        const x = cx + (r() - 0.5) * (w - 8), z = cz + (r() - 0.5) * (d - 8) - (b.hotel ? 2 : 0);
        if (Math.hypot(x - (cx + w * 0.18), z - cz) > 3.6 && Math.hypot(x - b.door.x, z - b.door.z) > 3.4 && !(b.keep || []).some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 1.2)) return [x, z];
      }
      return [cx - w * 0.3, cz - d * 0.25];
    };
    const penthouse = !b.hotel && !b.name && w > 21 && d > 21 && r() < 0.45;
    if (penthouse) {
      // a set-back upper tier with its own neon band: breaks up the flat roofline
      const pw = w * 0.5, pd = d * 0.5, px = cx - w * 0.16, ph = 3.2 + Math.floor(r() * 2) * 3.2;
      S.push(box(pw, ph, pd, px, top + ph / 2 - 0.9, cz, b.color), box(pw + 0.6, 0.5, pd + 0.6, px, top + ph - 0.7, cz, b.accent));
      P.box(px, cz, pw + 0.6, pd + 0.6, top + ph - 0.45, 0, top - 0.2);
      L.surf.rect(px - pw / 2 - 0.3, px + pw / 2 + 0.3, cz - pd / 2 - 0.3, cz + pd / 2 + 0.3, top + ph - 0.45, 'roof', { b });
      N.push(box(pw + 0.7, 0.12, pd + 0.7, px, top + ph - 0.4, cz, b.neon));
      for (let f = 0; f < ph / 3.2; f++) for (let i = 0; i < Math.floor(pw / 3); i++) addWin(px - pw / 2 + 1.5 + i * 3, top + f * 3.2 + 0.7, cz + pd / 2 + 0.04, 0, 1.8, 1.7, Math.min(0.99, r() * b.litBias));
    } else {
      for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
        const [x, z] = spot();
        S.push(box(1.7, 0.9, 1.2, x, top + 0.45, z, '#cfd3da'), cyl(0.42, 0.42, 0.06, 8, x - 0.35, top + 0.93, z, '#4a4d5c'), box(0.5, 0.5, 0.06, x + 0.45, top + 0.5, z + 0.61, '#8a8d9c'));
        P.box(x, z, 1.7, 1.2, top + 0.9, 0, top);
      }
    }
    const pick = r();
    if (pick < 0.3 && b.floors >= 3) {
      const [x, z] = spot();
      for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) S.push(box(0.12, 1.4, 0.12, x + ox, top + 0.7, z + oz, '#5a4a3a'));
      S.push(cyl(1.15, 1.15, 1.9, 10, x, top + 2.35, z, '#a8744e'), tint(new THREE.ConeGeometry(1.3, 0.7, 10).translate(x, top + 3.65, z), '#7a5236'), cyl(1.17, 1.17, 0.1, 10, x, top + 2.1, z, '#4a3626'));
      P.box(x, z, 1.6, 1.6, top + 4, 0, top);
    } else if (pick < 0.6) {
      const [x, z] = spot(), ah = 3 + r() * 3;
      S.push(box(0.09, ah, 0.09, x, top + ah / 2, z, STEEL), box(1.3, 0.06, 0.06, x, top + ah * 0.8, z, STEEL), box(0.9, 0.06, 0.06, x, top + ah * 0.62, z, STEEL));
      P.circle(x, z, 0.12, top + ah, top);
      if (b.floors >= 6) glows.push([x, top + ah + 0.15, z, '#ff3040', 2.4, 0.25]);
    } else if (pick < 0.75) {
      const [x, z] = spot();
      S.push(tint(new THREE.SphereGeometry(0.9, 8, 5, 0, PI * 2, 0, PI / 2).rotateX(-0.7).translate(x, top + 1.1, z), '#e8eaf0'), box(0.14, 1.1, 0.14, x, top + 0.55, z, STEEL));
      P.circle(x, z, 0.6, top + 1.6, top);
    }
    // the stair hut: a roof door down to the street (F), lit by a little lamp over the door
    const hx = b.door.x, hz = b.door.z;
    S.push(box(2.2, 2.6, 2.2, hx, top + 1.3, hz, CREAM), box(2.5, 0.2, 2.5, hx, top + 2.7, hz, b.accent), box(1, 2, 0.08, hx, top + 1, hz + 1.12, '#2b2440'), box(0.12, 0.12, 0.08, hx + 0.36, top + 1.05, hz + 1.17, '#ffd166'));
    N.push(box(0.5, 0.1, 0.1, hx, top + 2.25, hz + 1.17, '#ffe7b0'));
    P.box(hx, hz, 2.2, 2.2, top + 2.8, 0, top - 0.2);
    S.push(cyl(0.2, 0.2, 0.9, 6, cx + w / 2 - 2.6, top + 0.45, cz - d / 2 + 2.6, STEEL));

    // the rest of the roof that stands up: the plant room, the hotel tower, a rooftop name sign
    if (!b.hotel) P.box(cx + w * 0.18, cz, 3, 3, h + 2.1, 0, h + 0.3);
    else P.box(cx, b.z1 + 0.5, 6, 1.6, h + 9, 0, h);
    if (b.name && !b.hotel) { const sw = Math.min(w * 0.7, 16); P.box(cx, b.z1 - 0.8, sw + 0.3, 0.5, h + 2 + sw / 4, 0, h + 0.3); }
    if (b.place && !b.bar) placeFront(b);
    if (b.hotel) continue;

    // --- shopfront: striped awning over a wide lit window, a blade sign beside the door
    const fz = b.z1, sw = Math.min(w * 0.42, 8), sx = cx + w * 0.17;
    addWin(sx, 1.55, fz + 0.05, 0, sw, 2.1, 0.02);
    // the awning differs from shop to shop (world/streetscape.js planFacades): striped, a rounded hood with a
    // scalloped valance, a dark box canopy with a neon edge, or steep candy stripes
    const aw = b.awn || 0, aW = sw + 0.8;
    if (aw === 1) {
      S.push(tint(new THREE.CylinderGeometry(0.75, 0.75, aW, 6, 1, false, 0, PI).rotateZ(PI / 2).rotateX(-PI / 2).translate(sx, 2.75, fz + 0.05), b.accent));
      for (let x = -aW / 2 + 0.25; x < aW / 2; x += 0.5) S.push(cyl(0.2, 0.2, 0.04, 6, sx + x, 2.68, fz + 0.78, CREAM, PI / 2));
    } else if (aw === 2) {
      S.push(box(aW, 0.24, 1.5, sx, 3.0, fz + 0.75, INK));
      N.push(box(aW + 0.04, 0.07, 0.07, sx, 2.9, fz + 1.5, b.neon));
    } else {
      const [ca, cb, tilt] = aw === 3 ? [['#ff5fa8', '#19c9bd', '#ffd447'][Math.floor(Math.abs(b.cx)) % 3], '#ffffff', 0.45] : [b.accent, CREAM, 0.3];
      S.push(box(aW, 0.1, 1.7, sx, 2.95, fz + 0.8, ca, tilt));
      for (let k = 0, n = Math.floor(aW / 1.2); k < n; k += 2) S.push(box(0.6, 0.11, 1.72, sx - aW / 2 + 0.3 + k * 1.2 + 0.6, 2.955, fz + 0.8, cb, tilt));
    }
    S.push(box(sw + 0.4, 0.5, 0.25, sx, 0.25, fz + 0.14, b.accent));
    glows.push([sx, 1.6, fz + 1.2, '#ffd9a0', sw * 1.1, 0]);
    if (b.row === 1 && !b.name && ad < 5 && w > 20 && r() < 0.55) {
      billboard(ADS[ad], cx - w * 0.1, h + 4.6, b.z1 - 1.2, 0, Math.min(w * 0.6, 13), NEON[ad % 6]); ad++;
    }
    // blade signs: a handful of simple neon pictograms
    const bx = cx - w * 0.2 - 2.4, by = 5.2, bz = fz + 0.5, C = b.neon, k = blade++ % 5;
    S.push(box(0.14, 3.4, 0.9, bx, by, bz, INK));
    const z1 = bz + 0.5;
    if (k === 0) { path([[bx - 0.6, by + 1.1], [bx + 0.6, by + 1.1], [bx, by + 0.2], [bx - 0.6, by + 1.1]], z1, C); seg(bx, by + 0.2, bx, by - 0.9, z1, C); seg(bx - 0.4, by - 0.9, bx + 0.4, by - 0.9, z1, '#ffe14a'); }
    else if (k === 1) { seg(bx, by + 1.3, bx, by - 0.6, z1, C); path([[bx - 0.6, by - 0.3], [bx, by - 1.2], [bx + 0.6, by - 0.3]], z1, '#ffe14a'); }
    else if (k === 2) path([[bx, by + 1.2], [bx + 0.7, by], [bx, by - 1.2], [bx - 0.7, by], [bx, by + 1.2]], z1, C);
    else if (k === 3) { seg(bx + 0.3, by + 1.2, bx + 0.3, by - 0.6, z1, C); seg(bx + 0.3, by + 1.2, bx + 0.8, by + 0.8, z1, C); N.push(box(0.5, 0.36, 0.1, bx + 0.05, by - 0.75, z1, '#18f0ff')); }
    else { path([[bx - 0.5, by + 1.2], [bx + 0.5, by + 0.5], [bx - 0.5, by - 0.2], [bx + 0.5, by - 0.9]], z1, C); }
    glows.push([bx, by, z1 + 0.4, C, 5, 0.05]);
  }

  // --- door emblems for the places you can walk into
  function placeFront(b) {
    const cx = b.cx, fz = b.z1 + 0.5, z = fz + 0.9, C = b.neon, ex = cx + 5, ey = 5.7;
    N.push(box(3.6, 0.1, 0.1, cx, 2.85, z, C), box(0.1, 2.8, 0.1, cx - 1.75, 1.4, z, C), box(0.1, 2.8, 0.1, cx + 1.75, 1.4, z, C));
    path([[cx - 0.5, 3.9], [cx, 3.3], [cx + 0.5, 3.9]], z, '#ffe14a'); seg(cx, 4.6, cx, 3.3, z, '#ffe14a');   // "this way in" arrow
    if (b.place === 'club') {
      path([[ex - 0.9, ey - 0.8], [ex + 0.9, ey - 0.8], [ex, ey + 0.9], [ex - 0.9, ey - 0.8]], z, '#f4f0ff');
      seg(ex - 2, ey - 0.4, ex - 0.45, ey, z, '#ffffff', 0.08);
      seg(ex + 0.45, ey + 0.1, ex + 2.1, ey + 0.7, z, '#ff2bd1'); seg(ex + 0.45, ey, ex + 2.1, ey + 0.1, z, '#ffe14a'); seg(ex + 0.45, ey - 0.1, ex + 2.1, ey - 0.5, z, '#18f0ff');
    } else if (b.place === 'wear') {
      for (const [o, c] of [[0, C], [0.55, '#ffe14a']]) path([[ex - 1 + o, ey + 1.3], [ex + 0.3 + o, ey + 0.5], [ex - 0.6 + o, ey], [ex + 0.7 + o, ey - 0.7], [ex + o, ey - 1.5]], z, c);
    } else if (b.place === 'arms') {
      // Volt & Spark: a lightning bolt beside a firework burst
      path([[ex - 1.2, ey + 1.4], [ex - 0.35, ey + 0.15], [ex - 0.95, ey + 0.05], [ex - 0.15, ey - 1.4]], z, '#ffe14a');
      for (let k = 0; k < 8; k++) { const a = k * PI / 4; seg(ex + 0.9 + Math.cos(a) * 0.3, ey + 0.3 + Math.sin(a) * 0.3, ex + 0.9 + Math.cos(a) * 0.9, ey + 0.3 + Math.sin(a) * 0.9, z, k % 2 ? '#ff2bd1' : C); }
    } else {
      const Y = '#ffe14a', a = ex - 1, c2 = ex + 0.25;
      path([[a, ey + 0.8], [a + 0.8, ey + 0.8], [a + 0.8, ey], [a, ey], [a, ey - 0.8], [a + 0.8, ey - 0.8]], z, Y);          // 2
      path([[c2, ey + 0.8], [c2, ey], [c2 + 0.8, ey]], z, Y); seg(c2 + 0.8, ey + 0.8, c2 + 0.8, ey - 0.8, z, Y);            // 4
      path([[ex - 1.5, ey + 1.3], [ex + 1.6, ey + 1.3], [ex + 1.6, ey - 1.3], [ex - 1.5, ey - 1.3], [ex - 1.5, ey + 1.3]], z, C);
    }
    glows.push([ex, ey, z + 0.5, C, 9, 0.15]);
  }

  // --- wall ads: big painted billboards on the end walls that face the side streets, lit by two lamp arms
  L.adSigns = L.adSigns || [];
  let wa = 0;
  for (const b of L.buildings) {
    if (b.floors < 4 || b.row > 1) continue;
    const east = SIDE_X.some((s) => Math.abs(b.x1 - (s - 10)) < 3), west = SIDE_X.some((s) => Math.abs(b.x0 - (s + 10)) < 3);
    if (!east && !west) continue;
    const yaw = east ? PI / 2 : -PI / 2, fx = east ? b.x1 + 0.3 : b.x0 - 0.3, w = Math.min(b.d * 0.7, 14), hh = w / 4, y = Math.min(b.h - hh / 2 - 1.2, 9 + hh / 2);
    const name = KEY_ADS[wa++ % KEY_ADS.length], sx = Math.sin(yaw);
    S.push(box(0.25, hh + 0.5, w + 0.5, fx - sx * 0.05, y, b.cz, INK));
    L.adSigns.push({ name, x: fx + sx * 0.1, y, z: b.cz, yaw, w, h: hh });
    for (const o of [-w * 0.3, w * 0.3]) {
      S.push(box(1.1, 0.08, 0.08, fx + sx * 0.55, y + hh / 2 + 0.5, b.cz + o, '#3b3350'), box(0.3, 0.14, 0.4, fx + sx * 1.05, y + hh / 2 + 0.45, b.cz + o, '#fff2c8'));
      glows.push([fx + sx * 1.0, y + hh / 2 + 0.3, b.cz + o, '#ffe7b0', 4, 0]);
    }
  }

  // --- billboards on stilts where the promenade meets the sand (they face the boulevard)
  [[-152, 6], [118, 7], [248, 5]].forEach(([x, i]) => billboard(ADS[i], x, 6.2, 80.5, PI, 11, NEON[(i + 2) % 6]));

  // --- street furniture. Everything that can be knocked about (benches, bins, café tables and chairs,
  // vending machines, pots, newspaper boxes, sandwich boards, cones, crates, beach balls) is a loose
  // prop: it is listed in L.loose and drawn and simulated by world/loose.js. Hydrants, planting beds and
  // bike racks are part of the static town. Every spot is checked against the carriageways (offRoad)
  // and against what is already standing there, so nothing ends up in a lane or on top of a lamp.
  const used = [];
  const mark = (x, z, rr) => used.push([x, z, rr]);
  const free = (x, z, rr) => used.every(([a, b, c]) => Math.hypot(a - x, b - z) > c + rr + 0.15);
  for (const l of L.lamps) mark(l.x, l.z, 0.3);
  for (const p of L.palms) mark(p.x, p.z, 0.45);
  for (const b of L.booths) mark(b.x, b.z, 0.85);
  for (const it of L.beach.items) mark(it.x, it.z, it.r);
  for (const u of L.umbrellas) mark(u.x, u.z, 1.4);
  for (const k in L.places) mark(L.places[k].x, L.places[k].z, 2.4);
  for (const t of L.streetTrees || []) mark(t.x, t.z, 0.7);
  const runs = L.ramps.filter((k) => k.clear).map((k) => k.clear);
  const spot = (x, z, rr) => { const a = offRoad(x, z, rr); if (!a || inJunction(a[0], a[1], rr) || !free(a[0], a[1], rr) || runs.some((c) => a[0] > c.x0 - rr && a[0] < c.x1 + rr && a[1] > c.z0 - rr && a[1] < c.z1 + rr)) return null; mark(a[0], a[1], rr); return a; };
  const loose = (kind, x, z, yaw = 0, rr = 0.4, extra = {}) => {
    const a = spot(x, z, rr);
    if (!a) return null;
    const b = { kind, hx: a[0], hz: a[1], yaw, r: rr, seats: [], ...extra };
    L.loose.push(b);
    return b;
  };
  const bench = (x, z, yaw) => {
    const b = loose('bench', x, z, yaw, 1.05);
    if (!b) return;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    // room for two: you sit facing the way the bench faces (its back is behind you)
    for (const o of [-0.5, 0.5]) b.seats.push(P.seat(b.hx + c * o + s * 0.08, b.hz - s * o + c * 0.08, yaw, 0.55, 'bench'));
  };
  const bin = (x, z, hex) => loose('bin', x, z, 0, 0.36, { color: hex });
  const hydrant = (x, z) => {
    const a = spot(x, z, 0.24);
    if (!a) return;
    [x, z] = a;
    // drawn and simulated as a loose body (world/loose.js); the static circle keeps it bolted down
    // until a fast vehicle shears it off
    const c = P.circle(x, z, 0.24, 0.75); c.tag = 'hydrant';
    const d = { kind: 'hydrant', hx: x, hz: z, yaw: 0, r: 0.24, seats: [] };
    L.loose.push(d); c.hyd = d;
  };
  for (let x = -255; x <= 285; x += 30) { bench(x, 76.2, 0); bin(x + 13.6, 63.7, '#27c9bf'); }
  for (let x = -265; x <= 285; x += 60) { bench(x, 37.4, 0); hydrant(x + 22, 43.3); bin(x - 8, 43.2, '#ff8fc4'); }
  for (let x = -250; x <= 285; x += 50) { hydrant(x + 9, -10.9); bin(x + 20, -11.2, '#ffd447'); }
  for (const b of L.booths) {
    footprint('phone booth', b.x, b.z, 0.55);
    S.push(box(1.1, 0.2, 1.1, b.x, 0.1, b.z, '#3b3350'), box(1.1, 0.35, 1.1, b.x, 2.5, b.z, '#19c9bd'), box(1.0, 2.2, 0.06, b.x, 1.25, b.z - 0.5, '#9fd8e8'),
      box(0.06, 2.2, 1.0, b.x - 0.5, 1.25, b.z, '#9fd8e8'), box(0.06, 2.2, 1.0, b.x + 0.5, 1.25, b.z, '#9fd8e8'), box(0.3, 0.5, 0.2, b.x, 1.4, b.z - 0.36, '#22203a'));
    N.push(box(1.12, 0.1, 1.12, b.x, 2.72, b.z, '#ffe14a'));
    glows.push([b.x, 2.3, b.z, '#bff4ff', 3.2, 0.05]);
  }

  // --- café tables with parasols outside the Sunset Strip Diner (tables are medium, chairs light)
  L.cafe.forEach((t, i) => {
    const c = ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c'][i % 4];
    if (!loose('table', t.x, t.z, 0, 0.45, { color: c })) return;
    for (const sx of [-1, 1]) {
      const ch = loose('chair', t.x + sx * 1.07, t.z, -sx * PI / 2, 0.3, { color: c });
      if (ch) ch.seats.push(P.seat(t.x + sx * 0.95, t.z, -sx * PI / 2, 0.48, 'chair'));
    }
  });

  // --- vending machines: drinks (Coolwave) and snacks (Snaxx 24), against walls and on the promenade
  // (Volt & Spark stays in this list so the machines, pots and beds keep the spots they had before it opened)
  const front = L.buildings.filter((b) => b.row === 0 && (!b.place || b.place === 'arms') && b.name !== 'Sunset Strip Diner').sort((a, b) => Math.abs(a.cx) - Math.abs(b.cx));
  const mid = L.buildings.filter((b) => b.row === 1 && !b.place).sort((a, b) => Math.abs(a.cx) - Math.abs(b.cx));
  const back = L.buildings.filter((b) => b.row === 2).sort((a, b) => Math.abs(a.cx) - Math.abs(b.cx));
  let vn = 0;
  const vend = (x, z, yaw) => { if (loose('vend', x, z, yaw, 0.62, { brand: vn % 2 ? 'snaxx' : 'coolwave' })) vn++; };
  for (const b of [front[0], front[3], front[6]]) if (b) vend(b.x0 + 1.4, b.z1 + 0.5, 0);
  for (const b of [mid[1], mid[4], mid[7]]) if (b) vend(b.x1 - 1.4, b.z1 + 0.5, 0);
  for (const b of [back[2], back[5]]) if (b) vend(b.x1 - 1.4, b.z1 + 0.5, 0);
  vend(-40, 72.6, PI); vend(100, 72.6, PI);
  vend(PIER.x1 - 0.8, 203, -PI / 2);

  // --- raised planting beds (static concrete, plants are one InstancedMesh in city.js) and potted plants
  const FLOWERS = ['#ff4fa3', '#ffd447', '#ff8a3d', '#b388ff', '#ffffff', '#ff6a8a'];
  const bed = (x, z, w, d) => {
    const a = spot(x, z, Math.max(w, d) / 2);
    if (!a) return;
    [x, z] = a;
    S.push(box(w, 0.55, d, x, 0.275, z, '#d8d2c8'), box(w + 0.12, 0.08, d + 0.12, x, 0.58, z, '#efe9de'), box(w - 0.2, 0.05, d - 0.2, x, 0.53, z, '#5a3d2a'));
    P.box(x, z, w, d, 0.6);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) for (const row of d > 0.95 ? [-0.22, 0.22] : [0]) {
      L.planters.push({ x: x - w / 2 + (i + 0.5) * w / n + (r() - 0.5) * 0.15, z: z + row + (r() - 0.5) * 0.1, y: 0.55, s: 0.7 + r() * 0.5, yaw: r() * 6.28, c: FLOWERS[Math.floor(r() * FLOWERS.length)], grass: r() < 0.35 });
    }
  };
  for (let x = -240; x <= 285; x += 60) bed(x, 73.2, 3.2, 1.1);
  for (const b of front) if (b.w > 20) bed(b.x1 - 2.6, b.z1 + 0.55, 2.6, 0.9);
  bed(PIER.x0 - 3.4, 147.6, 2.4, 1); bed(PIER.x1 + 3.4, 147.6, 2.4, 1);
  const pot = (x, z) => loose('pot', x, z, r() * 6.28, 0.32, { color: FLOWERS[Math.floor(r() * FLOWERS.length)] });
  for (const [i, b] of [...mid, ...back].entries()) if (i % 2 === 0) { const dx = b.cx - b.w * 0.2; pot(dx - 1.9, b.z1 + 0.45); pot(dx + 1.9, b.z1 + 0.45); }
  for (const b of front) if (b.w > 20 && b.place !== 'bar') { pot(b.cx - 4.7, b.z1 + 0.5); pot(b.cx + 4.7, b.z1 + 0.5); }
  if (L.cafe.length) { pot(L.cafe[0].x - 2.2, 37.2); pot(L.cafe[L.cafe.length - 1].x + 2.2, 37.2); }

  // --- newspaper boxes by the kerb, bike racks on the promenade, sandwich boards outside shops
  L.lamps.forEach((l, i) => { if ((l.z === 42.6 || l.z === -10.75) && i % 3 === 0) loose('news', l.x + 2.1, l.z === 42.6 ? 42.8 : -11.0, l.z === 42.6 ? 0 : PI, 0.32, { color: ['#ff4f6a', '#27c9bf', '#ffd447'][i % 3] }); });
  for (const x of [-130, -10, 130, 250]) {
    const a = spot(x, 67.2, 1);
    if (!a) continue;
    for (let k = 0; k < 4; k++) S.push(box(0.06, 0.8, 0.06, a[0] - 0.75 + k * 0.5, 0.4, a[1] - 0.25, STEEL), box(0.06, 0.8, 0.06, a[0] - 0.75 + k * 0.5, 0.4, a[1] + 0.25, STEEL), box(0.06, 0.06, 0.56, a[0] - 0.75 + k * 0.5, 0.8, a[1], STEEL));
    S.push(box(1.7, 0.05, 0.06, a[0], 0.15, a[1] - 0.25, STEEL), box(1.7, 0.05, 0.06, a[0], 0.15, a[1] + 0.25, STEEL));
    P.box(a[0], a[1], 1.7, 0.6, 0.85);
  }
  for (const [i, b] of back.entries()) if (i % 2) loose('board', b.cx - b.w * 0.2 + 1.6, b.z1 + 1.3, 0.3, 0.35, { color: NEON[i % 6] });
  const diner = L.buildings.find((b) => b.name === 'Sunset Strip Diner');
  if (diner) loose('board', diner.cx - 9, 39.6, -0.4, 0.35, { color: '#ff5fa8' });
  if (L.places.mart) loose('board', L.places.mart.x - 3.4, 38.4, 0.3, 0.35, { color: '#5dff9a' });

  // --- beach balls by a few of the umbrellas (the court and its run-off stay clear: world/beach.js)
  for (const u of L.umbrellas.filter((u, i) => i % 6 === 2)) loose('ball', u.x + 2.6, u.z - 2.2, 0, 0.3, { color: ['#ff4fa3', '#27d8cf', '#ffd447'][Math.floor(u.x) & 1] });

  // --- beach: volleyball net, surfboards, a tall lifeguard chair
  P.circle(-40, 97.6, 0.15, 2.6).own = 'court'; P.circle(-40, 107.4, 0.15, 2.6).own = 'court';
  // bleacher steps beside the volleyball court, back past its run-off
  for (let i = 0; i < 3; i++) {
    const x = -53.6 - i * 0.75, y = 0.42 * (i + 1);
    S.push(box(0.75, y, 8, x, y / 2, 102.5, i % 2 ? '#27c9bf' : CREAM), box(0.77, 0.06, 8.02, x, y, 102.5, '#ff4fa3'));
    P.line(x + 0.1, 99, x + 0.1, 106, PI / 2, y, 'steps');
  }
  P.box(-54.35, 102.5, 2.25, 8, 1.3);
  S.push(box(0.14, 2.6, 0.14, -40, 1.3, 97.6, CREAM), box(0.14, 2.6, 0.14, -40, 1.3, 107.4, CREAM), box(0.05, 0.9, 9.8, -40, 2.1, 102.5, '#ffffff'), box(0.07, 0.08, 9.8, -40, 2.56, 102.5, '#ff4fa3'));
  // the rest of the beach (kiosk, rental stand, boardwalks, showers, bins, fire pit, sandcastles, kayaks,
  // towels, dune grass, shells, surfboards): world/beach.js
  beachGeometry(L.beach, S);
  pierDetails(L, S, N, glows, { bench: (x, z, yaw) => { bench(x, z, yaw); const b = L.loose[L.loose.length - 1]; return b && b.kind === 'bench' && Math.abs(b.hx - x) < 0.01 ? b : null; } });
  glows.push([L.beach.fire.x, 0.9, L.beach.fire.z, '#ff9a3d', 7, 0]);
  for (const x of [20, -200, 230]) {
    for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) S.push(box(0.1, 2.6, 0.1, x + ox, 1.3, 124 + oz, CREAM));
    S.push(box(1.5, 0.12, 1.5, x, 2.6, 124, CREAM), box(1.5, 0.9, 0.1, x, 3.1, 123.3, '#ff4f6a'), box(0.9, 0.08, 0.5, x, 1.3, 124.9, CREAM, -0.5));
    P.box(x, 124, 1.45, 1.45, 3.6).own = 'chair';
  }
  // --- pier: crates, benches, life rings
  const px = (PIER.x0 + PIER.x1) / 2;
  for (let z = 170; z < 236; z += 22) {
    bench(PIER.x1 - 1, z, -PI / 2); bench(PIER.x0 + 1, z + 11, PI / 2);
    loose('crate', PIER.x0 + 1.2, z + 6, 0, 0.5); loose('crate', PIER.x0 + 1.4, z + 7.3, 0.4, 0.5);
  }
  // benches on the sand either side of the pier, looking out to sea
  for (const x of [PIER.x0 - 5, PIER.x1 + 5, PIER.x0 - 12, PIER.x1 + 12]) bench(x, 143, 0);
  for (let z = 160; z < 250; z += 30) S.push(tint(new THREE.TorusGeometry(0.34, 0.1, 5, 10).rotateY(PI / 2).translate(PIER.x1 - 0.25, 0.85, z), '#ff6a3d'));
  S.push(box(0.1, 3, 0.1, px + 4.5, 1.5, 248, CREAM), box(1.3, 0.8, 0.05, px + 5.2, 2.6, 248, '#ff4fa3'));
  P.circle(px + 4.5, 248, 0.12, 3);
}

// Boats moored off the pier (one merged mesh that bobs) and a flock of gulls (one instanced mesh
// that circles and flaps in the vertex shader).
export function buildLife(scene, bodyMat) {
  const g = [];
  const hull = (x, z, yaw, len, hex, trim) => {
    const h = new THREE.BoxGeometry(2.4, 1.1, len);
    const p = h.attributes.position;
    for (let i = 0; i < p.count; i++) { const zz = p.getZ(i), y = p.getY(i); p.setX(i, p.getX(i) * (zz > 0 ? 0.25 : 0.85) * (y < 0 ? 0.6 : 1)); }
    h.computeVertexNormals(); h.rotateY(yaw); h.translate(x, 0, z);
    g.push(tint(h, hex), box(2.1, 0.12, len * 0.6, x, 0.6, z, trim, 0, yaw));
  };
  const s = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
  [[24, 176, 0.4, '#fbf7f0', '#ff4fa3'], [58, 196, -2.6, '#8fe3d9', '#ffd447'], [22, 222, 2.2, '#ffc7a0', '#19c9bd'], [60, 236, 0.9, '#fbf7f0', '#7a5cff'], [-30, 172, 1.2, '#fff0b3', '#ff8a3d']].forEach(([x, z, yaw, hex, trim], i) => {
    const len = 6 + (i % 3), [sx, cz] = s(yaw);
    hull(x, z, yaw, len, hex, trim);
    if (i % 2) {                                              // sailboat
      g.push(box(0.12, 6.5, 0.12, x, 3.6, z, '#fbf7f0'));
      const sail = new THREE.BufferGeometry();
      sail.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.9, -0.2, 0, 6.6, -0.2, 0, 0.9, -3, 0, 0.9, -3, 0, 6.6, -0.2, 0, 0.9, -0.2]), 3));
      sail.computeVertexNormals(); sail.rotateY(yaw); sail.translate(x, 0.3, z);
      g.push(tint(sail, trim));
    } else g.push(box(1.5, 1, 2.2, x - sx * 0.8, 1.1, z - cz * 0.8, '#fbf7f0', 0, yaw), box(1.6, 0.14, 2.4, x - sx * 0.8, 1.65, z - cz * 0.8, trim, 0, yaw), box(1.52, 0.4, 0.1, x + sx * 0.3, 1.25, z + cz * 0.3, '#2c5f7a', 0, yaw));
  });
  for (const [x, z] of [[70, 170], [8, 205], [76, 250], [-70, 185]]) g.push(cyl(0.45, 0.6, 0.8, 8, x, 0.1, z, '#ff4f6a'), cyl(0.08, 0.08, 1.2, 5, x, 1, z, '#fbf7f0'));
  // the swimming area off Coral Beach: a line of red and white floats on a rope, a big buoy at each end
  for (let x = -140; x <= -20; x += 4) g.push(cyl(0.2, 0.2, 0.22, 7, x, -0.12, 180, (x / 4) % 2 ? '#fbf7f0' : '#ff4f6a'));
  g.push(box(120, 0.04, 0.04, -80, -0.14, 180, '#fbf7f0'));
  for (const x of [-142, -18]) g.push(cyl(0.4, 0.5, 0.7, 8, x, 0.05, 180, '#ffd447'), cyl(0.06, 0.06, 1.0, 5, x, 0.85, 180, '#fbf7f0'), box(0.5, 0.32, 0.03, x + 0.25, 1.2, 180, '#ff4f6a'));
  const boats = new THREE.Mesh(merge(g), bodyMat);
  boats.position.y = -0.35;
  scene.add(boats);

  // gulls: two triangles each; wing tips flap, the whole bird rides a circle
  const N = 18, wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.25, 0, 0, -0.25, 1.1, 0, -0.1, 0, 0, -0.25, 0, 0, 0.25, -1.1, 0, -0.1]), 3));
  const seed = new Float32Array(N * 4), r = rng(55);
  for (let i = 0; i < N; i++) seed.set([i < 12 ? 40 + (r() - 0.5) * 70 : -200 + r() * 420, 14 + r() * 16, i < 12 ? 190 + (r() - 0.5) * 90 : 110 + r() * 30, r() * 6.3], i * 4);
  wing.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  const gulls = new THREE.InstancedMesh(wing, new THREE.ShaderMaterial({
    uniforms: { uTime: timeU }, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime; varying float vS;
      void main(){
        float ph = aSeed.w, rad = 9.0 + fract(ph * 3.7) * 16.0, a = uTime * (0.25 + fract(ph * 1.3) * 0.2) + ph;
        vec3 p = position;
        float tip = abs(p.x);
        p.y += sin(uTime * (5.0 + fract(ph) * 3.0) + ph) * 0.45 * tip - tip * tip * 0.12;
        float c = cos(-a), s = sin(-a);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p += vec3(aSeed.x + cos(a) * rad, aSeed.y + sin(a * 0.7 + ph) * 1.5, aSeed.z + sin(a) * rad);
        vS = 0.8 + 0.2 * tip;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'varying float vS; void main(){ gl_FragColor = vec4(vec3(0.97, 0.96, 0.93) * vS, 1.0); }',
  }), N);
  gulls.frustumCulled = false;
  scene.add(gulls);
  return { tick(t) { boats.position.y = -0.35 + Math.sin(t * 0.9) * 0.1; } };
}
