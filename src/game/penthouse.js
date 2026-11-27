// The Skyline Penthouse: the whole north-east corner of the top floor of the Glasswater tower (floor 27), 28 m
// along the bay and 18 m deep, with a terrace out over the east face. Built like every room (game/interiors.js
// buildRoom: one merged, baked mesh, one painted board atlas, soft light pools) plus a few live pieces: the glass,
// an unlit mesh of light strips and lamp glow, the drop-down projector screen, the automatic blinds, the fire, the
// hot tub, the bath and the steam. Room space: x east, z south; the north glass (-z) looks over the bay at the
// mainland skyline (and the fireworks, world/fireworks.js), the east glass (+x) at the causeway and the old town.
//
//   ground floor (0): the lift and the foyer (south wall, x 10), the double-height living room with a sunken
//     lounge facing the north glass, the drop-down projector screen, a grand piano, a linear gas fireplace in a
//     stone wall, the espresso bar at the east glass, the record player under the vinyl wall; under the mezzanine
//     (x < -3): the chef's kitchen (full-height cabinetry, a 6 m marble island with stools and pendants), the long
//     dining table at the glass, the bar with backlit shelves; the terrace (x > 14) with the hot tub and loungers.
//   the floating stair along the south wall (x 3.4 -> -1.4) up to a landing and the mezzanine (4.2 m, x < -3):
//     the primary bedroom facing the bay, the spa bathroom (rain shower, a freestanding tub at the window), the
//     walk-in closet, the study with its library wall, a gym corner.
//
// Walking rules (game/places.js): floorAt / ceilAt below, blocks (y0 / y1: one level only). The stair, the
// landing, the mezzanine edge and the terrace are sealed with glass balustrades that are solid.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng } from '../core/util.js';
import { boards, P, plant, rug, shadeHex, pbox, glow } from './dress.js';
import { BLK, CHROME, CREAM, disc, cone, screen, glass, pane, steam, water, picture, wallX, wallZ, sofa, bed } from './homerooms.js';

export const GOLD = '#a8844e';    // brushed brass (the shared bright GOLD reads as neon in a room this size)
export const PH = { HX: 14, HZ: 9, H: 8.4, PM: 4.2, MX: -3, SX0: 3.4, SX1: -1.4, SZ0: 7.1, SZ1: 9, TX: 17.5, TZ0: -9, TZ1: -1, PIT: [2.5, 10, -6, -1.5] };

export function buildPenthouse(room, place) {
  const { HX, HZ, H, PM, MX, SX0, SX1, SZ0, SZ1, TX, TZ0, TZ1 } = PH, [PX0, PX1, PZ0, PZ1] = PH.PIT;
  const g = [], lit = [], B = room.boards = boards(1024), pools = room.pools, hi = room.hiPools;
  const WALL = '#ece7df', STONE = '#e9e1d4', STONE2 = '#ddd3c3', OAK = '#c49a6c', WAL = '#6a4a30', BRONZE = '#4a3c34', MARBLE = '#f7f5f1', INK = '#2a2a36', LINEN = '#ece4d6';
  const up = (arr, dy) => { for (const q of arr) q.translate(0, dy, 0); return arr; };
  const U = (list) => up(list, PM);                    // upstairs: lift a list of parts onto the mezzanine

  // ---------------------------------------------------------------- shell: floors, walls, glass, ceiling
  // travertine in big tiles on the ground floor, with the sunken lounge cut out (its tiles line up with the grid)
  for (let x = -HX; x < HX - 0.01; x += 1.5) for (let z = -HZ; z < HZ - 0.01; z += 1.5) {
    const w = Math.min(1.5, HX - x), d = Math.min(1.5, HZ - z), cx = x + w / 2, cz = z + d / 2;
    if (cx > PX0 && cx < PX1 && cz > PZ0 && cz < PZ1) continue;
    g.push(box(w, 0.1, d, cx, -0.05, cz, (Math.round(x / 1.5) + Math.round(z / 1.5)) % 2 ? STONE : STONE2));
  }
  // the sunken lounge: a step all round at -0.2, the floor at -0.4 (walnut), a brass nosing on the edge
  g.push(box(PX1 - PX0, 0.2, 0.5, (PX0 + PX1) / 2, -0.3, PZ0 + 0.25, STONE), box(PX1 - PX0, 0.2, 0.5, (PX0 + PX1) / 2, -0.3, PZ1 - 0.25, STONE),
    box(0.5, 0.2, PZ1 - PZ0 - 1, PX0 + 0.25, -0.3, (PZ0 + PZ1) / 2, STONE), box(0.5, 0.2, PZ1 - PZ0 - 1, PX1 - 0.25, -0.3, (PZ0 + PZ1) / 2, STONE),
    box(PX1 - PX0 - 1, 0.1, PZ1 - PZ0 - 1, (PX0 + PX1) / 2, -0.45, (PZ0 + PZ1) / 2, '#8a6444'));
  for (const [w, d, x, z] of [[PX1 - PX0, 0.06, (PX0 + PX1) / 2, PZ0], [PX1 - PX0, 0.06, (PX0 + PX1) / 2, PZ1], [0.06, PZ1 - PZ0, PX0, (PZ0 + PZ1) / 2], [0.06, PZ1 - PZ0, PX1, (PZ0 + PZ1) / 2]]) g.push(box(w, 0.04, d, x, -0.015, z, GOLD));
  // the pit's walls under the nosing (no slit through to the town below the floor)
  for (const [w, d, x, z] of [[PX1 - PX0, 0.04, (PX0 + PX1) / 2, PZ0 - 0.02], [PX1 - PX0, 0.04, (PX0 + PX1) / 2, PZ1 + 0.02], [0.04, PZ1 - PZ0, PX0 - 0.02, (PZ0 + PZ1) / 2], [0.04, PZ1 - PZ0, PX1 + 0.02, (PZ0 + PZ1) / 2]]) g.push(box(w, 0.46, d, x, -0.23, z, STONE2));
  // the inner walls: south (the lift and the foyer) and west; the lift door in brushed brass in a bronze frame
  const LIFT = 10;
  wallX(g, HZ + 0.1, -HX - 0.2, HX + 0.2, 0, H, WALL, [[LIFT - 1.1, LIFT + 1.1, 0, 2.7]]); wallZ(g, -HX - 0.1, -HZ, HZ, 0, H, WALL);
  g.push(box(2.0, 2.65, 0.08, LIFT, 1.33, HZ - 0.02, '#c9a86e'), box(0.03, 2.6, 0.06, LIFT, 1.3, HZ - 0.07, '#8a7040'), box(2.4, 0.16, 0.14, LIFT, 2.78, HZ - 0.06, BRONZE),
    box(0.16, 2.8, 0.14, LIFT - 1.12, 1.4, HZ - 0.06, BRONZE), box(0.16, 2.8, 0.14, LIFT + 1.12, 1.4, HZ - 0.06, BRONZE));
  lit.push(box(0.5, 0.12, 0.03, LIFT, 3.05, HZ - 0.05, '#ffe9b0'));
  B.add(0.46, 0.1, LIFT, 3.05, HZ - 0.07, PI, (c, W, Hh) => { P.fill(c, W, Hh, '#1a1410'); P.text(c, '27', W / 2, Hh / 2, Hh * 0.8, '#ffd36a', { glow: 4 }); });
  // a walnut skirting and a shadow gap along the inner walls
  g.push(box(HX * 2, 0.1, 0.03, 0, 0.05, HZ - 0.015, WAL), box(0.03, 0.1, HZ * 2, -HX + 0.015, 0.05, 0, WAL));
  // the ceiling: one slab with a lowered cove frame round the edge; cove light strips (unlit mesh)
  g.push(pbox(HX * 2 + 0.4, 0.3, HZ * 2 + 0.4, 0, H + 0.15, 0, '#f6f4f0', 3));
  g.push(box(HX * 2, 0.25, 0.9, 0, H - 0.12, -HZ + 0.45, '#f6f4f0'), box(HX * 2, 0.25, 0.9, 0, H - 0.12, HZ - 0.45, '#f6f4f0'), box(0.9, 0.25, HZ * 2, HX - 0.45, H - 0.12, 0, '#f6f4f0'), box(0.9, 0.25, HZ * 2, -HX + 0.45, H - 0.12, 0, '#f6f4f0'));
  lit.push(box(HX * 2 - 1.8, 0.04, 0.05, 0, H - 0.26, -HZ + 0.92, '#fff0d0'), box(HX * 2 - 1.8, 0.04, 0.05, 0, H - 0.26, HZ - 0.92, '#fff0d0'), box(0.05, 0.04, HZ * 2 - 1.8, HX - 0.92, H - 0.26, 0, '#fff0d0'), box(0.05, 0.04, HZ * 2 - 1.8, -HX + 0.92, H - 0.26, 0, '#fff0d0'));
  // the glass: floor to ceiling on the north (the bay) and east (the causeway) with slim bronze mullions; a
  // sliding door to the terrace in the east glass (z -6.5 .. -4.5)
  const DZ0 = -6.5, DZ1 = -4.5;
  for (let i = 0; i <= 12; i++) { const x = -HX + i * (HX * 2 / 12); g.push(box(0.08, H, 0.1, x, H / 2, -HZ - 0.05, BRONZE)); }
  for (const z of [-HZ + 0.05, DZ0, DZ1, -1.5, 2.25, 6, HZ - 0.05]) g.push(box(0.1, H, 0.08, HX + 0.05, H / 2, z, BRONZE));
  g.push(box(HX * 2, 0.12, 0.14, 0, 0.06, -HZ - 0.05, BRONZE), box(0.14, 0.12, HZ * 2, HX + 0.05, 0.06, 0, BRONZE), box(HX * 2, 0.2, 0.14, 0, H - 0.1, -HZ - 0.05, BRONZE), box(0.14, 0.2, HZ * 2, HX + 0.05, H - 0.1, 0, BRONZE),
    box(0.14, 0.12, DZ1 - DZ0, HX + 0.05, 2.7, (DZ0 + DZ1) / 2, BRONZE), box(0.06, 2.6, 0.06, HX + 0.02, 1.3, -5.5, BRONZE));
  const glassList = [pane(HX * 2, H, 0, H / 2, -HZ - 0.05), pane(HZ - DZ1, H, HX + 0.05, H / 2, (DZ1 + HZ) / 2, PI / 2), pane(DZ0 + HZ, H, HX + 0.05, H / 2, (-HZ + DZ0) / 2, PI / 2), pane(DZ1 - DZ0, H - 2.7, HX + 0.05, 2.7 + (H - 2.7) / 2, (DZ0 + DZ1) / 2, PI / 2)];

  // ---------------------------------------------------------------- the terrace (x 14 .. 17.5, z -9 .. -1)
  for (let z = TZ0; z < TZ1 - 0.01; z += 0.25) g.push(box(TX - HX, 0.1, 0.23, (HX + TX) / 2, -0.05, z + 0.125, ((z - TZ0) / 0.25 | 0) % 2 ? '#b8885e' : '#c8986a'));
  g.push(box(TX - HX + 0.2, 0.35, TZ1 - TZ0 + 0.2, (HX + TX) / 2, -0.28, (TZ0 + TZ1) / 2, '#d8d0c4'));
  // the balustrade: glass on three sides in a bronze shoe, a brass rail (solid: see the blocks)
  for (const [w, d, x, z] of [[TX - HX, 0.1, (HX + TX) / 2, TZ0], [0.1, TZ1 - TZ0, TX, (TZ0 + TZ1) / 2], [TX - HX, 0.1, (HX + TX) / 2, TZ1]]) g.push(box(w + 0.06, 0.12, d + 0.06, x, 0.06, z, BRONZE), box(w + 0.04, 0.05, d + 0.04, x, 1.12, z, GOLD));
  glassList.push(pane(TX - HX, 1.05, (HX + TX) / 2, 0.6, TZ0), pane(TZ1 - TZ0, 1.05, TX, 0.6, (TZ0 + TZ1) / 2, PI / 2), pane(TX - HX, 1.05, (HX + TX) / 2, 0.6, TZ1));
  // the hot tub: a stone surround, teak rim, steps; loungers with cushions; planters with grasses
  const HTX = 16.0, HTZ = -7.4;
  g.push(cyl(1.0, 1.0, 0.72, 20, HTX, 0.36, HTZ, '#e8e2d8'), cyl(1.06, 1.06, 0.06, 20, HTX, 0.73, HTZ, '#b8885e'), box(0.7, 0.2, 0.4, HTX - 1.0, 0.1, HTZ + 0.6, '#b8885e', 0, 0.6));
  const hw = water(1.6, 1.6, HTX, 0.64, HTZ, '#2a9ab8', '#7ff0ff'); room.extras.push(hw);
  pools.push(disc(HTX, 0.68, HTZ, 0.95, '#7ff0ff', 0.4));
  for (const z of [-3.6, -2.2]) {
    g.push(box(1.9, 0.28, 0.72, 16.15, 0.2, z, '#e8e4e0'), box(1.3, 0.1, 0.66, 16.4, 0.39, z, '#f2ece2'), box(0.12, 0.5, 0.66, 15.35, 0.58, z, '#f2ece2', 0, 0, -0.6));
    for (const dx of [-0.8, 0.8]) g.push(box(0.06, 0.1, 0.7, 16.15 + dx, 0.05, z, '#8a7040'));
  }
  g.push(box(0.5, 0.42, 0.5, 15.9, 0.21, -2.9, '#c8986a'), cyl(0.06, 0.05, 0.16, 8, 15.9, 0.5, -2.9, '#ff9ad5'));
  for (const [x, z] of [[17.0, -5.4], [14.4, -8.6]]) { g.push(box(0.6, 0.55, 0.6, x, 0.28, z, BRONZE)); for (let i = 0; i < 7; i++) g.push(box(0.04, 0.6 + (i % 3) * 0.15, 0.04, x + Math.cos(i) * 0.14, 0.85, z + Math.sin(i) * 0.14, i % 2 ? '#7fae5a' : '#9fc87a', 0, i, 0.25)); }

  // ---------------------------------------------------------------- the foyer (south, by the lift)
  // a dark marble medallion under a ring chandelier, a console with a round mirror and a lamp, a tall painting
  g.push(cyl(1.5, 1.5, 0.012, 32, LIFT, 0.006, 6.6, '#3a3330'), cyl(1.32, 1.32, 0.014, 32, LIFT, 0.007, 6.6, '#efe6d6'), cyl(0.5, 0.5, 0.016, 24, LIFT, 0.008, 6.6, GOLD));
  for (const r of [0.75, 0.5]) g.push(tint(new THREE.TorusGeometry(r, 0.025, 6, 32).rotateX(PI / 2).translate(LIFT, 4.2 + r * 0.6, 6.6), GOLD));
  g.push(cyl(0.012, 0.012, H - 4.6, 4, LIFT, (H + 4.6) / 2, 6.6, GOLD));
  lit.push(tint(new THREE.TorusGeometry(0.62, 0.02, 4, 32).rotateX(PI / 2).translate(LIFT, 4.43, 6.6), '#fff3d0'));
  const CON = 13.15;
  g.push(box(1.3, 0.06, 0.42, CON, 0.86, HZ - 0.3, '#2a2420'), box(0.06, 0.84, 0.38, CON - 0.6, 0.42, HZ - 0.3, GOLD), box(0.06, 0.84, 0.38, CON + 0.6, 0.42, HZ - 0.3, GOLD), box(1.2, 0.04, 0.36, CON, 0.18, HZ - 0.3, '#2a2420'),
    cyl(0.09, 0.12, 0.3, 10, CON - 0.38, 1.04, HZ - 0.3, '#c8d0c0'), cyl(0.18, 0.14, 0.22, 12, CON - 0.38, 1.38, HZ - 0.3, '#fff3dc'), box(0.3, 0.08, 0.22, CON + 0.3, 0.93, HZ - 0.3, '#7fd0c8'), box(0.22, 0.06, 0.18, CON + 0.32, 1.0, HZ - 0.3, '#ff9ad5'));
  g.push(tint(new THREE.TorusGeometry(0.55, 0.04, 6, 28).translate(CON, 1.85, HZ - 0.05), GOLD));
  B.add(1.04, 1.04, CON, 1.85, HZ - 0.06, PI, (c, W, Hh) => { c.save(); c.beginPath(); c.arc(W / 2, Hh / 2, W / 2, 0, 6.3); c.clip(); P.mirror(c, W, Hh, ['#7a8898', '#c8d4e0'], [['#ffd36a', 3], ['#7fe0ff', 2], ['#fff6ec', 2]], 31); c.restore(); });
  pools.push(disc(CON - 0.38, 0.9, HZ - 0.3, 0.6, '#ffe0b0', 0.4), disc(CON - 0.38, 1.4, HZ - 0.06, 0.9, '#ffe0b0', 0.25, '-z'), disc(LIFT, 0.012, 6.6, 2.0, '#fff0d0', 0.22));
  picture(g, B, 8.05, 1.9, HZ - 0.05, PI, 1.0, 2.1, GOLD, (c, W, Hh) => {
    P.grad(c, W, Hh, '#f4e6d0', '#e8c8b0'); const r = rng(41);
    for (let i = 0; i < 7; i++) { c.fillStyle = ['#ff6a8a', '#2a6a8a', '#ffd36a', '#1a1438', '#7fd0c8', '#ff8a3d', '#fff6ec'][i]; c.globalAlpha = 0.85; c.beginPath(); c.arc(W * (0.2 + r() * 0.6), Hh * (0.1 + i * 0.12), W * (0.12 + r() * 0.2), 0, 6.3); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#1a1438'; c.fillRect(W * 0.48, Hh * 0.05, 3, Hh * 0.9);
  });
  hi.push(cone(LIFT, 4.3, 6.6, 0.3, 1.6, 4.25, '#fff0d0', 0.15));

  // ---------------------------------------------------------------- the living room (double height)
  // the sunken lounge: a U-shaped sectional open to the glass, a travertine coffee table, a deep rug
  const SOF = '#ece4d6', SOFC = '#d8ccb8', PITY = -0.4;
  { const t = []; sofa(t, 5.6, 6.25, PZ1 - 0.95, PI, SOF, SOFC); sofa(t, 2.8, PX0 + 1.0, -3.6, PI / 2, SOF, SOFC); sofa(t, 2.8, PX1 - 1.0, -3.6, -PI / 2, SOF, SOFC); g.push(...up(t, PITY)); }
  for (const [x, z, c] of [[4.6, -2.45, '#2a8a8a'], [7.9, -2.45, '#e07a5f'], [3.4, -4.6, '#ffd36a'], [9.1, -4.6, '#2a8a8a']]) g.push(box(0.4, 0.34, 0.12, x, PITY + 0.7, z, c, 0, Math.abs(z + 2.45) < 0.1 ? 0 : PI / 2));
  { const t = []; rug(t, 5.2, 3.0, 6.25, -3.8, '#c8b8a0', '#efe6d6', '#b8954a', 'diamonds'); g.push(...up(t, PITY)); }
  g.push(box(2.0, 0.36, 1.0, 6.25, PITY + 0.18, -3.9, '#e6dccb'), box(2.04, 0.04, 1.04, 6.25, PITY + 0.38, -3.9, MARBLE), cyl(0.1, 0.08, 0.22, 8, 5.7, PITY + 0.51, -3.8, '#2a8a8a'), box(0.4, 0.06, 0.3, 6.6, PITY + 0.43, -4.0, '#ff9ad5'), box(0.36, 0.05, 0.28, 6.62, PITY + 0.48, -4.02, '#fff6ec'));
  // the drop-down projector screen over the north glass, the projector on a ceiling rod, slim tower speakers
  // (the cassette sits flush in the ceiling: switched off, nothing hangs in front of the view)
  const SCW = 6.2, SCH = 3.5, SCT = 5.0, SCZ = -HZ + 0.32, STOP = H - 0.3;
  g.push(box(SCW + 0.4, 0.2, 0.28, 6.25, H - 0.2, SCZ, '#e0dcd6'));
  const tv = screen(SCW, SCH, 6.25, SCT - SCH / 2, SCZ + 0.04, 0);
  tv.geometry.translate(0, -SCH / 2, 0); tv.position.y = STOP;
  // its two cables from the cassette down to the screen's top edge (one small mesh, stretched as it drops)
  const rig = new THREE.Mesh(merge([box(0.02, 1, 0.02, -SCW / 2 + 0.05, 0.5, 0, '#c8c4d4'), box(0.02, 1, 0.02, SCW / 2 - 0.05, 0.5, 0, '#c8c4d4')]), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  rig.position.set(6.25, STOP, SCZ + 0.05); rig.visible = false; room.extras.push(rig);
  { const on0 = tv.userData.on; let k = 0, want = 0; tv.scale.y = 0.001; tv.visible = false;
    tv.userData.on = (on) => { on0(on); want = on ? 1 : 0; if (on) tv.visible = true; };
    tv.userData.tick = (dt) => {
      k += Math.sign(want - k) * Math.min(Math.abs(want - k), dt * 0.6);
      const e = k * k * (3 - 2 * k), top = STOP - e * (STOP - SCT);
      tv.position.y = top; tv.scale.y = Math.max(0.001, e); tv.visible = rig.visible = k > 0.002;
      rig.position.y = top; rig.scale.y = Math.max(0.001, STOP - top);
    };
    tv.userData.k = () => k; }
  room.extras.push(tv); room.tv = tv;
  g.push(cyl(0.015, 0.015, H - 4.6, 4, 6.25, (H + 4.6) / 2, 0.2, CHROME), box(0.5, 0.2, 0.42, 6.25, 4.5, 0.2, INK), cyl(0.07, 0.07, 0.05, 10, 6.25, 4.5, -0.03, '#9fe8ff', PI / 2));
  for (const x of [2.7, 9.8]) g.push(box(0.28, 1.3, 0.3, x, 0.65, -HZ + 0.5, INK), cyl(0.08, 0.08, 0.02, 10, x, 0.95, -HZ + 0.66, '#5a5a6a', PI / 2), cyl(0.05, 0.05, 0.02, 10, x, 0.6, -HZ + 0.66, '#5a5a6a', PI / 2));
  // the grand piano in the north-east corner of the glass: a black case, the lid propped open, a bench
  { const X = 11.8, Z = -6.7, y = 0.75, BK = '#18161e';
    g.push(box(1.5, 0.3, 1.0, X, y, Z + 0.55, BK), tint(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 16, 1, false, PI / 2, PI).scale(1, 1, 1.35).translate(X, y, Z + 0.05), BK));
    g.push(box(1.42, 0.02, 0.05, X, y + 0.16, Z + 1.06, BK), box(1.3, 0.04, 0.16, X, y + 0.04, Z + 1.12, CREAM), box(1.5, 0.02, 1.9, X, y + 0.68, Z - 0.05, BK, -0.6), box(0.02, 0.8, 0.02, X + 0.55, y + 0.5, Z - 0.1, BK, 0.45));
    for (let i = 0; i < 14; i++) g.push(box(0.03, 0.02, 0.09, X - 0.6 + i * 0.09 + ((i % 7) > 2 ? 0.045 : 0), y + 0.07, Z + 1.08, BK));
    for (const [dx, dz] of [[-0.6, 0.85], [0.6, 0.85], [0, -0.7]]) g.push(cyl(0.05, 0.04, y - 0.15, 8, X + dx, (y - 0.15) / 2, Z + dz, BK));
    g.push(box(0.9, 0.08, 0.38, X, 0.5, Z + 1.65, BK), box(0.06, 0.46, 0.06, X - 0.38, 0.23, Z + 1.65, BK), box(0.06, 0.46, 0.06, X + 0.38, 0.23, Z + 1.65, BK));
    pools.push(disc(X, 0.012, Z + 0.4, 1.8, '#ffe8c8', 0.16)); }
  // the fireplace: a travertine wall under the mezzanine edge, a long linear fire behind glass, a bronze hearth
  const FX = -2.7;
  g.push(pbox(0.6, PM - 0.3, 4.0, FX - 0.3, (PM - 0.3) / 2, 1.0, '#d8cbb6', 1), box(0.1, 0.4, 3.0, FX + 0.02, 0.55, 1.0, '#141016'), box(0.14, 0.06, 3.2, FX + 0.05, 0.32, 1.0, BRONZE), box(0.14, 0.06, 3.2, FX + 0.05, 0.78, 1.0, BRONZE),
    box(0.5, 0.14, 4.0, FX + 0.25, 0.07, 1.0, '#3a3330'));
  for (let i = 0; i < 5; i++) g.push(box(0.12, 0.1, 0.1, FX + 0.08, 0.37, -0.2 + i * 0.6, ['#c8c0b4', '#8a8478', '#e8e0d4'][i % 3], 0, i, 0));
  picture(g, B, FX + 0.04, 2.35, 1.0, PI / 2, 2.6, 1.4, GOLD, (c, W, Hh) => {
    P.grad(c, W, Hh, '#0e1a3a', '#3a2a6a'); c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(W * 0.72, Hh * 0.34, Hh * 0.16, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, Hh * (0.62 + i * 0.045)); for (let x = 0; x < W; x += 8) c.lineTo(x, Hh * (0.62 + i * 0.045) + Math.sin(x * 0.04 + i) * 3); c.stroke(); }
    c.fillStyle = '#1a1438'; for (const [x, h] of [[0.05, 0.3], [0.12, 0.42], [0.2, 0.26], [0.3, 0.5], [0.4, 0.34]]) c.fillRect(W * x, Hh * (0.62 - h), W * 0.07, Hh * h);
  });
  const fire = flames(2.8, 0.36, FX + 0.08, 0.37, 1.0); room.extras.push(fire);
  const fireGlow = glow([disc(FX + 1.4, 0.012, 1.0, 2.6, '#ff9a4a', 0.6, 'y', 1), disc(FX + 0.06, 0.9, 1.0, 1.9, '#ff8a3a', 0.35, 'x', 1)]); room.extras.push(fireGlow);
  // two lounge chairs and a side table facing the fire, a floor lamp, a round rug
  for (const z of [0.0, 2.0]) { const t = []; sofa(t, 1.0, 0.35, z, -PI / 2, '#b86a4a', '#d8906a'); g.push(...t); }
  g.push(cyl(0.25, 0.25, 0.5, 12, 0.5, 0.25, 1.0, '#c9a86e'), cyl(0.27, 0.27, 0.03, 12, 0.5, 0.51, 1.0, MARBLE), cyl(0.07, 0.06, 0.14, 8, 0.5, 0.6, 1.0, '#2a6a8a'));
  floorLamp(g, lit, pools, 1.0, 3.1);
  g.push(cyl(1.7, 1.7, 0.014, 28, -0.9, 0.007, 1.0, '#d8c8b0'), cyl(1.5, 1.5, 0.016, 28, -0.9, 0.008, 1.0, '#efe6d6'));
  // the espresso bar at the east glass: a walnut counter, the chrome machine, cups, two stools facing out
  const EX = HX - 0.45;
  g.push(box(0.7, 1.0, 2.4, EX, 0.5, 2.3, WAL), box(0.8, 0.05, 2.5, EX, 1.02, 2.3, INK), box(0.5, 0.45, 0.42, EX, 1.27, 1.8, CHROME), box(0.42, 0.06, 0.3, EX, 1.52, 1.8, '#3a3a48'),
    cyl(0.04, 0.04, 0.12, 6, EX - 0.2, 1.15, 1.7, BLK, 0, PI / 2), cyl(0.05, 0.04, 0.07, 8, EX + 0.1, 1.08, 2.4, CREAM), cyl(0.05, 0.04, 0.07, 8, EX + 0.1, 1.08, 2.6, CREAM), box(0.06, 0.2, 0.06, EX + 0.2, 1.15, 1.8, '#ff3f5a'));
  for (const z of [1.8, 2.9]) g.push(cyl(0.22, 0.22, 0.07, 10, HX - 1.2, 0.78, z, INK), cyl(0.03, 0.04, 0.75, 6, HX - 1.2, 0.38, z, CHROME), cyl(0.2, 0.22, 0.03, 10, HX - 1.2, 0.015, z, CHROME));
  pools.push(disc(EX, 1.05, 2.3, 0.9, '#ffd8a0', 0.3));
  // the record player on a long walnut sideboard under the vinyl wall (south wall, between the stair and the lift)
  const RX = 6.0;
  g.push(box(2.8, 0.7, 0.5, RX, 0.35, HZ - 0.3, WAL), box(2.84, 0.04, 0.54, RX, 0.72, HZ - 0.3, INK), box(0.5, 0.12, 0.4, RX + 0.4, 0.8, HZ - 0.3, INK), cyl(0.15, 0.15, 0.02, 14, RX + 0.4, 0.87, HZ - 0.3, BLK), box(0.02, 0.02, 0.22, RX + 0.58, 0.89, HZ - 0.32, CHROME),
    box(0.5, 0.5, 0.35, RX - 0.9, 0.97, HZ - 0.3, '#2a2a36'), box(0.5, 0.5, 0.35, RX - 0.35, 0.97, HZ - 0.3, '#2a2a36'));
  B.add(3.4, 2.4, RX, 2.6, HZ - 0.06, PI, (c, Ww, Hh) => {
    P.fill(c, Ww, Hh, '#e8e2da'); const r = rng(8);
    for (let row = 0; row < 3; row++) { c.fillStyle = '#6a4a30'; c.fillRect(0, (row + 1) * Hh / 3 - 6, Ww, 6); for (let i = 0; i < 7; i++) { const x = 6 + i * (Ww - 12) / 7, s = (Ww - 20) / 8; c.fillStyle = ['#ff6a8a', '#7fe0ff', '#ffe14a', '#2a2a36', '#8dff5a', '#ff8a3d', '#b388ff'][Math.floor(r() * 7)]; c.fillRect(x, (row + 1) * Hh / 3 - 8 - s, s, s); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x + s / 2, (row + 1) * Hh / 3 - 8 - s / 2, s * 0.22, 0, 6.3); c.fill(); } }
  }, 80);
  pools.push(disc(RX, 2.6, HZ - 0.12, 2.0, '#ffe8c8', 0.2, '-z'));
  // indoor trees in big bronze planters: an olive by the foyer, a fiddle-leaf fig at the glass, a palm by the dining
  tree(g, 13.0, 5.0, 1.25, '#6f8a5a'); tree(g, 1.4, -7.9, 1.1, '#3f8f4a', 1); tree(g, -2.2, -8.0, 1.0, '#4f9f5a', 1);
  // a big abstract canvas high on the south wall over the stair, seen from the whole room
  picture(g, B, 0.8, 6.2, HZ - 0.05, PI, 4.6, 2.2, GOLD, (c, W, Hh) => {
    P.grad(c, W, Hh, '#ff9a6a', '#ffd9a0', false); const r = rng(5);
    for (let i = 0; i < 9; i++) { c.fillStyle = ['#2a6a8a', '#ff6a8a', '#1a1438', '#fff6ec', '#7fd0c8'][i % 5]; c.globalAlpha = 0.8; c.fillRect(W * r() * 0.9, Hh * r() * 0.7, W * (0.05 + r() * 0.2), Hh * (0.2 + r() * 0.5)); }
    c.globalAlpha = 1;
  }, 60);

  // ---------------------------------------------------------------- the floating stair, the landing, the mezzanine
  const NST = 15, SW = SZ1 - SZ0 - 0.05, SZC = (SZ0 + SZ1) / 2 + 0.02, run = (SX0 - SX1) / NST;
  const stairGlass = [];
  for (let i = 0; i < NST; i++) {
    const x = SX0 - (i + 0.5) * run, y = (i + 1) / NST * PM;
    g.push(box(run + 0.04, 0.09, SW, x, y - 0.045, SZC, OAK));
    lit.push(box(run - 0.04, 0.012, 0.05, x, y - 0.1, SZ0 + 0.1, '#fff0d0'));          // a strip of light under each tread's nose
    stairGlass.push(pane(run, 1.0, x, y + 0.5, SZ0));
  }
  // the steel stringer in the wall, the brass handrail on the glass, the landing slab
  g.push(box(Math.hypot(SX0 - SX1, PM) + 0.1, 0.3, 0.08, (SX0 + SX1) / 2, PM / 2 - 0.15, HZ - 0.06, BRONZE, 0, 0, Math.atan2(PM, SX0 - SX1)));
  g.push(box(Math.hypot(SX0 - SX1, PM), 0.05, 0.06, (SX0 + SX1) / 2, PM / 2 + 1.02, SZ0, GOLD, 0, 0, Math.atan2(PM, SX0 - SX1)));
  g.push(box(SX1 - MX, 0.3, SZ1 - SZ0, (SX1 + MX) / 2, PM - 0.15, SZC, '#f6f4f0'), box(SX1 - MX, 0.02, SZ1 - SZ0 - 0.1, (SX1 + MX) / 2, PM + 0.01, SZC, OAK), box(SX1 - MX, 0.05, 0.06, (SX1 + MX) / 2, PM + 1.05, SZ0, GOLD));
  stairGlass.push(pane(SX1 - MX, 1.0, (SX1 + MX) / 2, PM + 0.5, SZ0));
  glassList.push(...stairGlass);
  // the mezzanine slab, its bronze fascia with a line of light under it, its glass balustrade and brass rail
  g.push(pbox(-MX + HX, 0.3, HZ * 2, (MX - HX) / 2, PM - 0.15, 0, '#f6f4f0', 2), box(0.08, 0.34, SZ0 + HZ, MX + 0.04, PM - 0.15, (SZ0 - HZ) / 2, BRONZE), box(0.06, 0.05, SZ0 + HZ, MX, PM + 1.05, (SZ0 - HZ) / 2, GOLD));
  lit.push(box(0.04, 0.03, SZ0 + HZ - 0.4, MX + 0.02, PM - 0.34, (SZ0 - HZ) / 2, '#fff0d0'));
  glassList.push(pane(SZ0 + HZ, 1.0, MX, PM + 0.5, (SZ0 - HZ) / 2, PI / 2));
  // upstairs floors: oak in the bedroom, study and gym, stone in the bathroom
  for (let z = -HZ; z < HZ - 0.01; z += 0.3) { const x0 = z < -3.4 ? -9.8 : -HX; g.push(box(MX - x0, 0.02, Math.min(0.29, HZ - z), (x0 + MX) / 2, PM + 0.01, z + 0.15, ((z + HZ) / 0.3 | 0) % 3 === 1 ? shadeHex(OAK, 0.93) : OAK)); }
  for (let x = -HX; x < -9.8 - 0.01; x += 0.7) for (let z = -HZ; z < -3.4 - 0.01; z += 0.7) g.push(box(Math.min(0.69, -9.8 - x), 0.02, Math.min(0.69, -3.4 - z), x + Math.min(0.35, (-9.8 - x) / 2), PM + 0.012, z + Math.min(0.35, (-3.4 - z) / 2), ((x / 0.7 | 0) + (z / 0.7 | 0)) % 2 ? '#d8d4ce' : '#e4e0da'));

  // ---------------------------------------------------------------- upstairs: the primary suite
  // the bed facing the bay, an upholstered headboard wall, nightstands with lamps, a bench at the foot, a rug
  { const t = [];
    bed(t, 2.1, 2.2, -6.8, -4.62, PI, '#3a3a48', '#d8d0c4', CREAM);   // headboard 5 cm proud of the wall panels (it shared their face and flickered)
    t.push(box(4.35, 2.4, 0.16, -7.125, 1.2, -3.32, '#c8b8a8'));
    for (let i = 0; i < 5; i++) t.push(box(0.78, 1.3, 0.06, -8.7 + i * 0.78, 1.15, -3.42, i % 2 ? '#d8c8b8' : '#cfbfae'));
    for (const x of [-8.35, -5.25]) t.push(box(0.55, 0.5, 0.42, x, 0.25, -3.7, WAL), box(0.57, 0.03, 0.44, x, 0.51, -3.7, GOLD));
    t.push(box(1.6, 0.42, 0.42, -6.8, 0.21, -6.05, '#b86a4a'), box(1.62, 0.06, 0.44, -6.8, 0.45, -6.05, '#d8906a'));
    rug(t, 3.6, 3.8, -6.8, -5.0, '#8a7a68', '#e8dccb', '#b8954a', 'stripes');
    g.push(...U(t)); }
  for (const x of [-8.35, -5.25]) { g.push(cyl(0.07, 0.09, 0.26, 8, x, PM + 0.65, -3.7, GOLD)); lit.push(cyl(0.14, 0.18, 0.24, 10, x, PM + 0.9, -3.7, '#fff0d0')); pools.push(disc(x, PM + 0.53, -3.7, 0.7, '#ffe0b0', 0.4)); }
  picture(g, B, -7.125, PM + 2.05, -3.43, PI, 1.6, 0.6, GOLD, (c, W, Hh) => { P.grad(c, W, Hh, '#2a1a5a', '#ff8a6a', false); c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 30; i++) c.fillRect((i * 37) % W, (i * 13) % Hh, 2, 2); });
  // the spa bathroom: frosted glass walls with a doorway, a rain shower box against the west wall, a double
  // vanity, a freestanding tub at the north glass, stone floor, a towel ladder, a plant
  g.push(...U([box(0.1, 1.0, 3.4, -9.8, 0.5, -7.3, '#e8e8ec'), box(0.1, 1.0, 1.0, -9.8, 0.5, -3.9, '#e8e8ec')]));
  glassList.push(pane(3.4, 1.4, -9.8, PM + 1.7, -7.3, PI / 2), pane(1.0, 1.4, -9.8, PM + 1.7, -3.9, PI / 2), pane(4.2, 2.4, -11.9, PM + 1.2, -3.4));
  g.push(...U([box(0.06, 0.06, 3.4, -9.8, 2.42, -7.3, BRONZE), box(0.06, 0.06, 1.0, -9.8, 2.42, -3.9, BRONZE), box(4.2, 0.06, 0.06, -11.9, 2.42, -3.4, BRONZE), box(0.06, 0.3, 1.2, -9.8, 2.27, -5.0, BRONZE),
    box(0.1, 2.4, 0.08, -9.8, 1.2, -5.6, BRONZE), box(0.1, 2.4, 0.08, -9.8, 1.2, -4.4, BRONZE)]));
  // the shower: a glass box at x -14 .. -12.4, z -5.3 .. -3.5 with a big round rain head and a stone bench
  g.push(...U([box(1.6, 0.06, 1.8, -13.2, 0.03, -4.4, '#c8c4bc'), cyl(0.3, 0.3, 0.04, 16, -13.3, 2.4, -4.4, CHROME), box(0.04, 0.04, 0.9, -13.6, 2.42, -4.4, CHROME), box(1.4, 0.45, 0.4, -13.2, 0.23, -3.75, '#d8d0c4')]));
  glassList.push(pane(1.6, 2.4, -13.2, PM + 1.2, -5.3), pane(1.2, 2.4, -12.4, PM + 1.2, -4.7, PI / 2));
  // the double vanity on the closet side of the bathroom wall (facing north), a long mirror
  g.push(...U([box(2.2, 0.85, 0.55, -10.95, 0.42, -3.75, WAL), box(2.24, 0.05, 0.58, -10.95, 0.87, -3.75, MARBLE), cyl(0.2, 0.18, 0.1, 14, -11.5, 0.94, -3.75, '#ffffff'), cyl(0.2, 0.18, 0.1, 14, -10.4, 0.94, -3.75, '#ffffff'),
    box(0.03, 0.2, 0.12, -11.5, 1.05, -3.55, CHROME), box(0.03, 0.2, 0.12, -10.4, 1.05, -3.55, CHROME)]));
  B.add(2.1, 1.1, -10.95, PM + 1.7, -3.47, PI, (c, W, Hh) => P.mirror(c, W, Hh, ['#606878', '#a8b8c8'], [['#ffd36a', 2], ['#7fe0ff', 2]], 11));
  lit.push(box(2.1, 0.04, 0.04, -10.95, PM + 2.3, -3.48, '#fff0d0'));
  // the tub at the window: an oval of white stone on the stone floor, a floor-standing brass filler, water
  const TBX = -11.9, TBZ = -7.55;
  g.push(...U([tint(new THREE.CylinderGeometry(0.5, 0.42, 0.6, 18).scale(1.9, 1, 1).translate(TBX, 0.3, TBZ), '#fbfaf8'), tint(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 18).scale(1.9, 1, 1).translate(TBX, 0.6, TBZ), '#ffffff'),
    cyl(0.03, 0.03, 1.0, 6, TBX - 1.15, 0.5, TBZ + 0.55, GOLD), box(0.25, 0.03, 0.03, TBX - 1.05, 1.0, TBZ + 0.55, GOLD),
    box(0.04, 1.6, 0.4, -HX + 0.3, 0.8, -6.0, GOLD), box(0.02, 0.9, 0.36, -HX + 0.33, 0.9, -6.0, '#fff6ec')]));
  const bw = water(1.6, 0.72, TBX, PM + 0.52, TBZ, '#4ab8d8', '#bff4ff'); room.extras.push(bw);
  { const t = []; plant(t, -13.4, -8.4, 0.8, '#e8e4de', '#3faf6a', 1); g.push(...U(t)); }
  pools.push(disc(TBX, PM + 0.02, TBZ, 1.6, '#ffe8d0', 0.25), disc(-13.2, PM + 0.07, -4.4, 0.9, '#e8f8ff', 0.35));
  // the walk-in closet (x -14 .. -9.8, z -3.4 .. 2): wardrobes down the west wall with lit rails, a round
  // ottoman, a full-length mirror; its door is on the south side. The study's library wall is its east side.
  g.push(...U([box(0.1, 2.4, 5.4, -9.8, 1.2, -0.7, '#e8e2d8'), box(2.0, 2.4, 0.1, -13.0, 1.2, 2.0, '#e8e2d8'), box(1.0, 2.4, 0.1, -10.3, 1.2, 2.0, '#e8e2d8'), box(1.2, 0.3, 0.1, -11.4, 2.25, 2.0, '#e8e2d8')]));
  { const t = [];
    for (let i = 0; i < 5; i++) { const z = -3.0 + i * 0.95; t.push(box(0.62, 2.3, 0.92, -HX + 0.32, 1.15, z, '#efe6da'), box(0.02, 2.0, 0.02, -HX + 0.64, 1.15, z + 0.46, '#c8b8a0')); }
    t.push(box(0.04, 0.04, 4.4, -HX + 0.5, 1.95, -0.8, GOLD), cyl(0.38, 0.38, 0.42, 16, -11.6, 0.21, -0.6, '#d8a0b0'), cyl(0.4, 0.4, 0.04, 16, -11.6, 0.43, -0.6, '#e8b8c4'));
    for (let i = 0; i < 9; i++) t.push(box(0.44, 0.9, 0.06, -HX + 0.48, 1.4, -2.9 + i * 0.36, ['#ff9ad5', '#2a2a36', '#7fe0ff', '#fff6ec', '#ffd36a', '#3a3a48', '#8dffcf', '#ff6a3d', '#c8b0ff'][i]));
    g.push(...U(t)); }
  lit.push(box(0.03, 0.03, 4.4, -HX + 0.62, PM + 2.32, -0.8, '#fff0d0'));
  B.add(0.8, 1.9, -10.0, PM + 1.1, -0.6, -PI / 2, (c, W, Hh) => P.mirror(c, W, Hh, ['#7a8898', '#c8d4e0'], [['#ff9ad5', 2], ['#fff6ec', 3]], 17));
  pools.push(disc(-11.8, PM + 0.02, -0.6, 1.6, '#fff0d8', 0.2));
  // the study: the library wall (books on the closet's east side), a desk facing the void, a reading chair
  B.add(4.8, 2.3, -9.74, PM + 1.2, -0.7, PI / 2, (c, W, Hh) => {
    P.fill(c, W, Hh, '#5a3a24'); const r = rng(12), rows = 5, rh = Hh / rows;
    for (let row = 0; row < rows; row++) { let x = 3; while (x < W - 6) { const w = 3 + r() * 6, h = rh * (0.55 + r() * 0.35); if (r() < 0.06) { x += 14; continue; } c.fillStyle = ['#8a2a2a', '#2a4a6a', '#c8a060', '#2a5a3a', '#e8dcc8', '#4a2a4a', '#b86a4a'][Math.floor(r() * 7)]; c.fillRect(x, (row + 1) * rh - 4 - h, w, h); x += w + 0.6; } c.fillStyle = '#3a2416'; c.fillRect(0, (row + 1) * rh - 4, W, 4); }
  }, 80);
  g.push(...U([box(1.8, 0.05, 0.8, -6.5, 0.76, 0.4, WAL), box(0.05, 0.74, 0.7, -7.35, 0.37, 0.4, GOLD), box(0.05, 0.74, 0.7, -5.65, 0.37, 0.4, GOLD), box(0.55, 0.35, 0.03, -6.6, 1.0, 0.1, INK), box(0.4, 0.02, 0.3, -6.4, 0.8, 0.6, '#e8e4de'),
    box(0.55, 0.45, 0.55, -7.85, 0.3, 0.4, INK), box(0.55, 0.55, 0.08, -8.1, 0.75, 0.4, INK, 0, PI / 2)]));
  { const t = []; sofa(t, 1.0, -8.3, 2.7, PI / 2, '#2a6a6a', '#3a8a8a'); g.push(...U(t)); }
  floorLamp(g, lit, pools, -8.4, 3.6, PM);
  g.push(...U([cyl(0.09, 0.11, 0.3, 8, -6.2, 0.91, 0.65, GOLD)])); lit.push(cyl(0.13, 0.17, 0.12, 10, -6.2, PM + 1.12, 0.65, '#fff0d0'));
  pools.push(disc(-6.5, PM + 0.8, 0.4, 0.9, '#ffe0b0', 0.35));
  // the gym corner: a treadmill facing a mirror wall, a bench, a rack of weights, a mat
  g.push(...U([box(0.8, 0.2, 2.0, -12.9, 0.1, 5.2, INK), box(0.7, 0.02, 1.6, -12.9, 0.21, 5.3, '#3a3a48'), box(0.06, 1.2, 0.06, -13.25, 0.7, 4.3, CHROME), box(0.06, 1.2, 0.06, -12.55, 0.7, 4.3, CHROME), box(0.8, 0.25, 0.1, -12.9, 1.3, 4.25, INK),
    box(0.4, 0.45, 1.2, -13.2, 0.22, 7.6, INK), box(1.4, 0.06, 0.4, -10.9, 1.1, HZ - 0.3, CHROME), box(0.05, 1.1, 0.4, -11.55, 0.55, HZ - 0.3, CHROME), box(0.05, 1.1, 0.4, -10.25, 0.55, HZ - 0.3, CHROME),
    box(2.0, 0.02, 1.0, -12.0, 0.01, 7.6, '#2a8a8a')]));
  for (let i = 0; i < 6; i++) g.push(...U([cyl(0.06, 0.06, 0.2, 8, -11.45 + i * 0.22, 0.7, HZ - 0.3, i % 2 ? '#3a3a48' : '#5a5a6a', 0, PI / 2)]));
  B.add(3.4, 2.0, -HX + 0.06, PM + 1.2, 5.6, PI / 2, (c, W, Hh) => P.mirror(c, W, Hh, ['#7a8898', '#c8d4e0'], [['#2a8a8a', 2], ['#fff6ec', 3]], 23), 70);
  // a statement sculpture on the landing: a polished bronze loop on a plinth
  g.push(...U([box(0.5, 0.9, 0.5, -8.6, 0.45, 8.4, '#efe6da'), tint(new THREE.TorusKnotGeometry(0.26, 0.06, 48, 6, 2, 3).translate(-8.6, 1.3, 8.4), '#c8964a')]));
  pools.push(disc(-8.6, PM + 0.92, 8.4, 0.7, '#ffe0b0', 0.3));

  // ---------------------------------------------------------------- under the mezzanine: kitchen, dining, bar
  // full-height cabinetry on the west wall: the fridge column, two ovens and a steam oven, the pantry, the wine
  // fridge (lit), a counter run with the hob and a marble splashback
  const CW = -HX + 0.33, CF = -HX + 0.66;
  g.push(box(0.66, 3.6, 4.3, CW, 1.8, 6.6, '#e8e2d8'));
  for (let i = 0; i < 5; i++) g.push(box(0.02, 3.4, 0.02, CF + 0.005, 1.8, 4.7 + i * 0.86, '#c8bca8'));
  g.push(box(0.03, 0.6, 0.7, CF + 0.01, 1.35, 5.55, '#22222a'), box(0.03, 0.6, 0.7, CF + 0.01, 2.05, 5.55, '#22222a'), box(0.03, 0.06, 0.6, CF + 0.02, 1.62, 5.55, CHROME), box(0.03, 0.06, 0.6, CF + 0.02, 2.32, 5.55, CHROME),
    box(0.03, 1.8, 0.02, CF + 0.02, 1.4, 7.0, CHROME), box(0.03, 1.8, 0.02, CF + 0.02, 1.4, 7.9, CHROME));
  g.push(box(0.66, 2.0, 0.7, CW, 1.0, 3.5, '#22222a')); lit.push(box(0.02, 1.7, 0.56, CF + 0.005, 1.0, 3.5, '#ffb070'));
  for (let i = 0; i < 6; i++) g.push(box(0.02, 0.04, 0.5, CF + 0.01, 0.35 + i * 0.27, 3.5, '#8a2a3a'));
  g.push(box(0.66, 0.9, 4.0, CW, 0.45, 1.0, '#e8e2d8'), box(0.7, 0.05, 4.0, CW + 0.02, 0.93, 1.0, MARBLE), box(0.5, 0.02, 0.8, CW + 0.05, 0.96, 1.2, '#22222a'), box(0.66, 1.4, 4.7, CW, 3.0, 1.35, '#e8e2d8'));
  B.add(4.0, 1.0, -HX + 0.03, 1.45, 1.0, PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#c4c0ba'); c.strokeStyle = 'rgba(120,110,130,.35)'; for (let i = 0; i < 12; i++) { c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo(W * i / 12, 0); c.bezierCurveTo(W * (i / 12 + 0.1), Hh * 0.4, W * (i / 12 - 0.05), Hh * 0.6, W * (i / 12 + 0.12), Hh); c.stroke(); } }, 70);
  lit.push(box(0.04, 0.03, 4.0, CF, 2.28, 1.0, '#fff0d0'));
  g.push(box(0.5, 0.04, 0.9, CW + 0.1, 2.27, 1.2, CHROME));
  for (let i = 0; i < 4; i++) g.push(box(0.02, 0.04, 0.12, CF + 0.02, 0.6, -0.5 + i * 1.0, CHROME));
  // the island: 6 m of white marble with waterfall ends, walnut base, sink, four stools, three pendants
  const IX = -10.8, IZ0 = 0.4, IZ1 = 6.4, IZC = (IZ0 + IZ1) / 2;
  g.push(box(1.0, 0.86, IZ1 - IZ0 - 0.2, IX, 0.43, IZC, WAL), box(1.25, 0.07, IZ1 - IZ0, IX, 0.92, IZC, MARBLE), box(1.25, 0.92, 0.07, IX, 0.46, IZ0 + 0.035, MARBLE), box(1.25, 0.92, 0.07, IX, 0.46, IZ1 - 0.035, MARBLE),
    box(0.5, 0.02, 0.7, IX - 0.2, 0.96, 5.0, '#a8a8b0'), cyl(0.02, 0.02, 0.35, 6, IX - 0.45, 1.12, 5.0, CHROME), box(0.25, 0.02, 0.02, IX - 0.33, 1.3, 5.0, CHROME),
    box(0.42, 0.03, 0.3, IX + 0.1, 0.97, 2.0, '#c89a68'), cyl(0.14, 0.12, 0.08, 12, IX + 0.2, 1.0, 3.0, '#ff8a3d'), cyl(0.12, 0.1, 0.1, 10, IX - 0.1, 1.01, 3.6, '#7fbf5a'));
  B.add(IZ1 - IZ0 - 0.1, 0.8, IX + 0.63, 0.47, IZC, PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#c4c0ba'); c.strokeStyle = 'rgba(120,110,130,.35)'; for (let i = 0; i < 14; i++) { c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo(W * i / 14, 0); c.bezierCurveTo(W * (i / 14 + 0.08), Hh * 0.4, W * (i / 14 - 0.04), Hh * 0.6, W * (i / 14 + 0.1), Hh); c.stroke(); } }, 70);
  const STOOLS = [1.3, 2.6, 3.9, 5.2];
  for (const z of STOOLS) g.push(cyl(0.22, 0.2, 0.08, 12, IX + 1.05, 0.76, z, '#b86a4a'), box(0.36, 0.3, 0.04, IX + 1.24, 0.95, z, '#b86a4a'), cyl(0.025, 0.035, 0.72, 6, IX + 1.05, 0.38, z, GOLD), cyl(0.18, 0.18, 0.02, 10, IX + 1.05, 0.3, z, GOLD));
  for (const z of [1.6, 3.4, 5.2]) { g.push(cyl(0.008, 0.008, 1.6, 4, IX, PM - 0.3 - 0.8, z, GOLD), cyl(0.06, 0.26, 0.28, 14, IX, 2.14, z, GOLD)); lit.push(cyl(0.2, 0.2, 0.02, 12, IX, 2.0, z, '#fff3d0')); pools.push(disc(IX, 0.97, z, 0.9, '#fff0c8', 0.45)); hi.push(cone(IX, 2.0, z, 0.2, 0.8, 1.0, '#fff0c8', 0.22)); }
  // the long dining table at the north glass under a linear chandelier: walnut on two bronze trestles, ten chairs
  const DX = -8.4, DZ = -5.6, DL = 4.4;
  g.push(box(DL, 0.07, 1.15, DX, 0.76, DZ, WAL), box(0.12, 0.72, 0.9, DX - DL / 2 + 0.6, 0.36, DZ, BRONZE), box(0.12, 0.72, 0.9, DX + DL / 2 - 0.6, 0.36, DZ, BRONZE), box(DL - 1.4, 0.06, 0.1, DX, 0.2, DZ, BRONZE));
  for (let i = 0; i < 3; i++) g.push(cyl(0.06, 0.05, 0.22, 8, DX - 1.0 + i, 0.91, DZ, ['#2a8a8a', '#fff6ec', '#c9a86e'][i]));
  const chair = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; const put = (w, h, d, lx, y, lz, hex) => { const [px, pz] = at(lx, lz); g.push(box(w, h, d, px, y, pz, hex, 0, ry)); };
    put(0.5, 0.08, 0.5, 0, 0.47, 0, LINEN); put(0.5, 0.55, 0.07, 0, 0.78, -0.24, LINEN); for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) put(0.04, 0.45, 0.04, a, 0.22, b, BRONZE); };
  const DCH = [];
  for (let i = 0; i < 4; i++) { const x = DX - 1.5 + i; chair(x, DZ + 0.85, PI); chair(x, DZ - 0.85, 0); DCH.push(x); }
  chair(DX - DL / 2 - 0.45, DZ, PI / 2); chair(DX + DL / 2 + 0.45, DZ, -PI / 2);
  g.push(box(3.4, 0.05, 0.12, DX, 2.6, DZ, GOLD), cyl(0.008, 0.008, PM - 0.3 - 2.6, 4, DX - 1.5, (PM - 0.3 + 2.6) / 2, DZ, GOLD), cyl(0.008, 0.008, PM - 0.3 - 2.6, 4, DX + 1.5, (PM - 0.3 + 2.6) / 2, DZ, GOLD));
  lit.push(box(3.3, 0.02, 0.08, DX, 2.57, DZ, '#fff3d0'));
  rug(g, 5.8, 3.0, DX, DZ, '#5a4a40', '#d8ccb8', '#8a7058', 'stripes');
  pools.push(disc(DX, 0.8, DZ, 2.0, '#fff0c8', 0.4)); hi.push(cone(DX, 2.55, DZ, 1.4, 1.8, 1.7, '#fff0c8', 0.15));
  // the bar: a fluted walnut front with a brass foot rail and a marble top, three stools; behind it backlit
  // onyx shelves of bottles on the south wall, a glass-washer cabinet. The space under the landing is its store.
  const BX = -5.3, BZ = 6.6;
  g.push(box(3.8, 1.05, 0.62, BX, 0.52, BZ, WAL), box(3.9, 0.05, 0.7, BX, 1.07, BZ, MARBLE), box(3.8, 0.04, 0.04, BX, 0.2, BZ - 0.42, GOLD));
  for (let i = 0; i < 18; i++) g.push(box(0.1, 0.95, 0.02, BX - 1.8 + i * 0.212, 0.5, BZ - 0.32, i % 2 ? shadeHex(WAL, 0.85) : WAL));
  for (const x of [BX - 1.2, BX, BX + 1.2]) g.push(cyl(0.22, 0.2, 0.08, 12, x, 0.8, BZ - 0.85, '#3a3a48'), cyl(0.025, 0.035, 0.76, 6, x, 0.4, BZ - 0.85, GOLD), cyl(0.18, 0.18, 0.02, 10, x, 0.01, BZ - 0.85, GOLD));
  g.push(box(4.4, 0.9, 0.55, BX, 0.45, HZ - 0.3, '#2a2420'), box(4.4, 0.04, 0.58, BX, 0.92, HZ - 0.3, MARBLE));
  lit.push(box(4.2, 2.0, 0.04, BX, 2.25, HZ - 0.04, '#ffcf80'));
  B.add(4.2, 2.0, BX, 2.25, HZ - 0.07, PI, (c, W, Hh) => {
    const gr = c.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#ffd890'); gr.addColorStop(1, '#ff9a50'); c.fillStyle = gr; c.fillRect(0, 0, W, Hh); const r = rng(4);
    for (let row = 0; row < 4; row++) { const y1 = (row + 1) * Hh / 4 - 3; c.fillStyle = 'rgba(40,24,16,.85)'; c.fillRect(0, y1, W, 4); let x = 4; while (x < W - 8) { const w = 5 + r() * 4, h = Hh / 4 * (0.45 + r() * 0.35); c.fillStyle = ['rgba(90,40,20,.85)', 'rgba(30,80,50,.8)', 'rgba(200,120,40,.7)', 'rgba(255,255,255,.6)', 'rgba(120,20,40,.85)'][Math.floor(r() * 5)]; c.fillRect(x, y1 - h, w, h); c.fillRect(x + w * 0.35, y1 - h - h * 0.3, w * 0.3, h * 0.3); x += w + 2 + r() * 3; } }
  }, 80);
  g.push(box(SX1 - MX, PM - 0.3, SZ1 - SZ0, (SX1 + MX) / 2, (PM - 0.3) / 2, SZC, '#e8e2d8'));
  pools.push(disc(BX, 1.1, BZ, 1.4, '#ffd090', 0.35), disc(BX, 1.6, HZ - 0.1, 2.4, '#ffb060', 0.25, '-z'));
  // the under-mezzanine soffit: recessed downlights in the slab (unlit dots)
  for (const [x, z] of [[-12, -7], [-9, -7], [-6, -7], [-12, -3], [-6, -3], [-4.5, 1], [-12.6, 5], [-7, 3], [-4.5, 4.5]]) lit.push(cyl(0.09, 0.09, 0.01, 10, x, PM - 0.31, z, '#fff6e0'));

  // ---------------------------------------------------------------- the automatic blinds (one mesh, rolled in the shader)
  // linen panels behind the glass: open they are rolled up into the head; closed they come down to the floor (or,
  // in front of the mezzanine, down to its edge, and a second set under it)
  const blinds = blindsMesh([
    [-3, HX, -HZ + 0.12, H - 0.2, 0, 'x'], [-HX, -3, -HZ + 0.12, H - 0.2, PM + 0.05, 'x'], [-HX, -3, -HZ + 0.12, PM - 0.32, 0, 'x'],
    [-HZ, DZ0, HX - 0.12, H - 0.2, 0, 'z'], [DZ1, HZ, HX - 0.12, H - 0.2, 0, 'z'],
  ]);
  room.extras.push(blinds); room.blinds = blinds;
  for (const [x0, x1, z] of [[-3, HX, -HZ + 0.12], [-HX, -3, -HZ + 0.12]]) g.push(box(x1 - x0, 0.14, 0.14, (x0 + x1) / 2, H - 0.15, z, '#e8e4de'));
  g.push(box(0.14, 0.14, HZ * 2, HX - 0.12, H - 0.15, 0, '#e8e4de'), box(HX - 3, 0.1, 0.14, (-HX - 3) / 2, PM - 0.32, -HZ + 0.12, '#e8e4de'));

  // ---------------------------------------------------------------- glass, light pools, the unlit glow
  room.extras.push(glass(glassList));
  const litMesh = new THREE.Mesh(merge(lit), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); room.extras.push(litMesh);
  const st = steam(-13.3, PM + 0.1, -4.4, 1.0); room.extras.push(st); room.steam = st;
  const st2 = steam(HTX, 0.7, HTZ, 1.2, 30); room.extras.push(st2); room.steam2 = st2;
  const st3 = steam(TBX, PM + 0.6, TBZ, 0.9, 24); room.extras.push(st3); room.steam3 = st3;
  pools.push(disc(6.25, 0.012, -3.8, 3.4, '#ffe8c8', 0.2), disc(6.25, PITY + 0.02, -3.8, 2.6, '#ffe0c0', 0.25), disc(-11, 0.012, 3.4, 2.6, '#fff0d0', 0.2), disc(-6.8, PM + 0.6, -4.6, 1.8, '#ffe0c0', 0.25), disc(-11.6, PM + 0.02, 5.6, 2.0, '#fff0d8', 0.18));
  hi.push(cone(6.25, H - 0.3, -3.8, 0.3, 2.4, H - 0.6, '#fff0d8', 0.08));

  const vt = place.b;
  const onStair = (x, z) => z > SZ0 - 0.02 && z < SZ1 + 0.1 && x <= SX0 && x > SX1;
  const stairH = (x) => Math.min(PM, Math.max(0, (SX0 - x) / (SX0 - SX1) * PM));
  const inPit = (x, z) => x > PX0 && x < PX1 && z > PZ0 && z < PZ1;
  const upper = (x, z) => x < MX || (x <= SX1 && z > SZ0 - 0.02);
  // ---------------------------------------------------------------- walking: levels, blocks, seats, uses, cameras
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#3a3a5a', amb: 0.36, ambCol: '#fff6ee', bloomK: 0.5,
    view: { x: vt.x1 - HX - 0.4, y: vt.h - 9.2, z: vt.z0 + HZ + 0.4, boost: true },
    lights: [
      { x: 6, y: 6.5, z: -3, hex: '#fff0e0', r: 14, k: 0.38 }, { x: 10, y: 4, z: 6, hex: '#fff0d8', r: 7, k: 0.4 }, { x: 1, y: 3, z: 3, hex: '#fff0e0', r: 7, k: 0.3 },
      { x: -1.2, y: 1.0, z: 1.0, hex: '#ffa860', r: 5, k: 0.4 }, { x: 12, y: 3, z: -6, hex: '#fff0e0', r: 6, k: 0.3 },
      { x: -10.8, y: 3.0, z: 3.4, hex: '#fff0c8', r: 6, k: 0.36 }, { x: -8.4, y: 2.8, z: -5.6, hex: '#fff0c8', r: 6, k: 0.4 }, { x: -5.3, y: 2.2, z: 7.6, hex: '#ffc880', r: 5, k: 0.45 },
      { x: -6.8, y: PM + 2.6, z: -5.2, hex: '#ffe8d0', r: 7, k: 0.4 }, { x: -12, y: PM + 2.4, z: -6.5, hex: '#e8f4ff', r: 5, k: 0.35 }, { x: -11.8, y: PM + 2.3, z: -0.6, hex: '#fff0d8', r: 4, k: 0.4 },
      { x: -6.5, y: PM + 2.2, z: 1.5, hex: '#ffe8c8', r: 5, k: 0.35 }, { x: -9, y: PM + 2.4, z: 6.5, hex: '#fff0e0', r: 7, k: 0.35 },
      { x: 15.8, y: 2.4, z: -5, hex: '#ffe0c0', r: 6, k: 0.35 }, { x: HX - 0.5, y: 2.2, z: 2.3, hex: '#ffd8a0', r: 3, k: 0.4 }, { x: 6, y: 2.6, z: HZ - 1, hex: '#fff0d8', r: 5, k: 0.3 },
    ],
    bounds: { x0: -HX, x1: TX, z0: -HZ, z1: HZ },
    floorAt(x, z, y) {
      if (onStair(x, z)) return stairH(x);
      if (upper(x, z) && y > PM - 0.9) return PM;
      if (inPit(x, z)) return x > PX0 + 0.5 && x < PX1 - 0.5 && z > PZ0 + 0.5 && z < PZ1 - 0.5 ? PITY : -0.2;
      return 0;
    },
    ceilAt(x, z, y) { return y < 2 && upper(x, z) ? PM - 0.5 : H; },
    blocks: [
      // the glass and the terrace's balustrade (the sliding door is the gap z -6.5 .. -4.5 in the east glass)
      { x0: HX - 0.1, x1: TX + 1, z0: TZ1, z1: HZ + 1 }, { x0: HX - 0.1, x1: HX + 0.2, z0: -HZ - 1, z1: DZ0 }, { x0: HX - 0.1, x1: HX + 0.2, z0: DZ1, z1: TZ1 },
      { x0: TX - 0.1, x1: TX + 1, z0: -HZ - 1, z1: TZ1 }, { x0: HX, x1: TX + 1, z0: -HZ - 1, z1: -HZ + 0.05 },
      // the terrace: the hot tub, the loungers, the planters
      { x0: HTX - 1.05, x1: HTX + 1.05, z0: HTZ - 1.05, z1: HTZ + 0.95 }, { x0: 15.2, x1: 17.2, z0: -3.95, z1: -1.85 }, { x0: 16.7, x1: 17.3, z0: -5.7, z1: -5.1 }, { x0: 14.1, x1: 14.7, z0: -8.9, z1: -8.3 },
      // the stair's glass side and the landing's (solid at every height: no stepping off, no walking under it),
      // the store under the landing, the mezzanine's glass edge (upstairs only)
      { x0: MX - 0.1, x1: SX0, z0: SZ0 - 0.16, z1: SZ0 }, { x0: MX, x1: SX1, z0: SZ0, z1: HZ, y0: -1, y1: 3 },
      { x0: MX - 0.12, x1: MX + 0.1, z0: -HZ - 1, z1: SZ0, y0: 3.2, y1: 9 },
      // the foyer console, the sideboard, the espresso bar and its stools, the piano, the trees
      { x0: CON - 0.68, x1: CON + 0.68, z0: HZ - 0.55, z1: HZ }, { x0: RX - 1.45, x1: RX + 1.45, z0: HZ - 0.58, z1: HZ }, { x0: HX - 0.85, x1: HX, z0: 1.05, z1: 3.55 }, { x0: HX - 1.45, x1: HX - 0.95, z0: 1.55, z1: 3.15 },
      { x0: 11.0, x1: 12.6, z0: -7.8, z1: -5.75 }, { x0: 11.4, x1: 12.2, z0: -5.15, z1: -4.85 },
      { x0: 12.6, x1: 13.4, z0: 4.6, z1: 5.4 }, { x0: 1.0, x1: 1.8, z0: -HZ, z1: -7.5 }, { x0: -2.6, x1: -1.8, z0: -HZ, z1: -7.6 },
      // the speakers at the screen, the sunken lounge's sectional and coffee table (in the pit), the fire wall, the chairs
      { x0: 2.5, x1: 2.9, z0: -HZ, z1: -8.3 }, { x0: 9.6, x1: 10.0, z0: -HZ, z1: -8.3 },
      { x0: 3.4, x1: 9.1, z0: -2.45, z1: -1.5, y1: 0.5, y0: -1 }, { x0: PX0, x1: 3.95, z0: -5.0, z1: -2.2, y0: -1, y1: 0.5 }, { x0: 8.55, x1: PX1, z0: -5.0, z1: -2.2, y0: -1, y1: 0.5 }, { x0: 5.25, x1: 7.25, z0: -4.4, z1: -3.4, y0: -1, y1: 0.5 },
      { x0: FX - 0.65, x1: FX + 0.05, z0: -1.0, z1: 3.0, y0: -1, y1: 3 }, { x0: -0.1, x1: 0.8, z0: -0.5, z1: 0.5 }, { x0: -0.1, x1: 0.8, z0: 1.5, z1: 2.5 }, { x0: 0.25, x1: 0.75, z0: 0.75, z1: 1.25 },
      // the kitchen: the cabinetry and the island; the dining table and its chairs; the bar and its back counter
      { x0: -HX, x1: CF, z0: -0.5, z1: HZ, y0: -1, y1: 3 }, { x0: IX - 0.63, x1: IX + 0.63, z0: IZ0, z1: IZ1, y0: -1, y1: 3 },
      { x0: DX - DL / 2 - 0.7, x1: DX + DL / 2 + 0.7, z0: DZ - 1.1, z1: DZ + 1.1, y0: -1, y1: 3 },
      { x0: BX - 1.95, x1: BX + 1.95, z0: BZ - 0.35, z1: BZ + 0.35, y0: -1, y1: 3 }, { x0: BX - 2.2, x1: MX + 0.1, z0: HZ - 0.6, z1: HZ, y0: -1, y1: 3 },
      // upstairs: the bed and its headboard wall, the bathroom's walls, the tub, the shower bench, the vanity,
      // the closet's walls and wardrobes, the ottoman, the study desk, the reading chair, the gym, the sculpture
      { x0: -9.35, x1: -4.95, z0: -3.45, z1: -3.2, y0: 3.2, y1: 9 }, { x0: -8.65, x1: -8.05, z0: -3.95, z1: -3.3, y0: 3.2, y1: 9 }, { x0: -5.55, x1: -4.95, z0: -3.95, z1: -3.3, y0: 3.2, y1: 9 }, { x0: -7.9, x1: -5.7, z0: -5.7, z1: -3.3, y0: 3.2, y1: 9 }, { x0: -7.65, x1: -5.95, z0: -6.3, z1: -5.8, y0: 3.2, y1: 9 },
      { x0: -9.9, x1: -9.7, z0: -HZ, z1: -5.6, y0: 3.2, y1: 9 }, { x0: -9.9, x1: -9.7, z0: -4.4, z1: -3.3, y0: 3.2, y1: 9 }, { x0: -HX, x1: -9.7, z0: -3.5, z1: -3.3, y0: 3.2, y1: 9 },
      { x0: TBX - 1.0, x1: TBX + 1.0, z0: TBZ - 0.5, z1: TBZ + 0.5, y0: 3.2, y1: 9 }, { x0: -HX, x1: -12.35, z0: -5.4, z1: -3.4, y0: 3.2, y1: 9 }, { x0: -12.1, x1: -9.8, z0: -4.05, z1: -3.4, y0: 3.2, y1: 9 },
      { x0: -9.9, x1: -9.7, z0: -3.4, z1: 2.0, y0: 3.2, y1: 9 }, { x0: -HX, x1: -12.0, z0: 1.95, z1: 2.05, y0: 3.2, y1: 9 }, { x0: -10.8, x1: -9.7, z0: 1.95, z1: 2.05, y0: 3.2, y1: 9 },
      { x0: -HX, x1: -HX + 0.65, z0: -3.4, z1: 1.8, y0: 3.2, y1: 9 }, { x0: -12.0, x1: -11.2, z0: -1.0, z1: -0.2, y0: 3.2, y1: 9 },
      { x0: -7.45, x1: -5.55, z0: 0.0, z1: 0.8, y0: 3.2, y1: 9 }, { x0: -8.85, x1: -7.75, z0: 2.2, z1: 3.2, y0: 3.2, y1: 9 },
      { x0: -13.3, x1: -12.5, z0: 4.2, z1: 6.2, y0: 3.2, y1: 9 }, { x0: -13.45, x1: -12.95, z0: 6.95, z1: 8.25, y0: 3.2, y1: 9 }, { x0: -11.65, x1: -10.15, z0: HZ - 0.5, z1: HZ, y0: 3.2, y1: 9 },
      { x0: -8.85, x1: -8.35, z0: 8.15, z1: 8.65, y0: 3.2, y1: 9 },
    ],
    seats: [
      // the sunken lounge (facing the glass and the screen)
      { x: 4.8, z: -2.45, y: 0.5, yaw: PI, kind: 'booth', fy: PITY, view: true, cam: [6.25, 1.5, 1.6, 5.0, 2.2, -40] }, { x: 6.25, z: -2.45, y: 0.5, yaw: PI, kind: 'booth', fy: PITY, view: true, cam: [6.25, 1.6, 1.8, 6.25, 2.2, -40] },
      { x: 7.7, z: -2.45, y: 0.5, yaw: PI, kind: 'booth', fy: PITY, view: true, cam: [6.25, 1.5, 1.6, 7.5, 2.2, -40] },
      { x: 3.5, z: -3.6, y: 0.5, yaw: PI / 2, kind: 'booth', fy: PITY }, { x: 9.0, z: -3.6, y: 0.5, yaw: -PI / 2, kind: 'booth', fy: PITY },
      // the chairs at the fire, the dining chairs facing the glass, the island and bar stools
      { x: 0.35, z: 0.0, y: 0.5, yaw: -PI / 2, kind: 'booth' }, { x: 0.35, z: 2.0, y: 0.5, yaw: -PI / 2, kind: 'booth' },
      ...DCH.map((x) => ({ x, z: DZ + 0.85, y: 0.47, yaw: PI, kind: 'booth', view: true, cam: [x + 0.4, 2.0, DZ + 3.4, x, 1.6, -60] })),
      ...STOOLS.map((z) => ({ x: IX + 1.05, z, y: 0.8, yaw: -PI / 2, kind: 'stool' })),
      ...[BX - 1.2, BX, BX + 1.2].map((x) => ({ x, z: BZ - 0.85, y: 0.84, yaw: 0, kind: 'stool' })),
      // the espresso stools at the east glass, the piano bench
      { x: HX - 1.2, z: 1.8, y: 0.8, yaw: PI / 2, kind: 'stool', view: true, cam: [HX - 3.6, 2.2, 3.4, 60, -3, 0] },
      { x: 11.8, z: -5.05, y: 0.52, yaw: PI, kind: 'stool' },
      // the terrace loungers, the hot tub
      { x: 16.3, z: -3.6, y: 0.5, yaw: PI / 2, kind: 'lounger', view: true, cam: [14.8, 2.6, -0.2, 60, -6, -30] },
      { x: 16.3, z: -2.2, y: 0.5, yaw: PI / 2, kind: 'lounger', view: true, cam: [14.8, 2.6, 0.6, 60, -6, -20] },
      { x: HTX, z: HTZ, y: 0.3, yaw: PI, kind: 'stool', fy: -0.2, tub: true, steam: 'steam2', view: true, cam: [HTX - 1.2, 2.4, HTZ + 3.2, HTX - 10, -6, -60] },
      // upstairs: the bed (sleep), the tub at the window, the reading chair, the desk chair
      { x: -6.8, z: -4.3, y: 0.58, yaw: PI, kind: 'lounger', fy: PM, home: 'bed', view: true, cam: [-6.8, PM + 2.2, -1.6, -6.8, PM - 0.5, -60] },
      { x: TBX, z: TBZ, y: 0.3, yaw: PI / 2, kind: 'stool', fy: PM - 0.15, tub: true, steam: 'steam3', view: true, cam: [TBX + 2.6, PM + 2.0, TBZ + 2.6, TBX - 6, PM - 1.5, -60] },
      { x: -8.3, z: 2.7, y: 0.5, yaw: PI / 2, kind: 'booth', fy: PM },
      { x: -7.85, z: 0.4, y: 0.52, yaw: PI / 2, kind: 'stool', fy: PM },
    ],
    entry: [LIFT, HZ - 1.0], spawn: [LIFT, 5.4], exit: [LIFT, HZ - 0.9], faceIn: PI,
    uses: [
      { x: 6.25, z: -1.0, r: 1.1, kind: 'tv', hint: 'the projector (the screen comes down)', look: [6.25, -HZ + 0.3], cam: [0.0, 2.0, 2.8], lookY: 3.4 },
      { x: 11.2, z: -1.0, r: 0.9, kind: 'blinds', hint: () => (room.blinds.userData.want ? 'open the blinds' : 'close the blinds') },
      { x: -0.9, z: 1.0, r: 1.0, kind: 'fireplace', hint: () => (fire.userData.want ? 'turn the fire down' : 'light the fire') },
      { x: 11.8, z: -4.6, r: 0.8, kind: 'piano', hint: 'play the piano' },
      { x: -12.3, z: 3.2, r: 0.9, kind: 'cook', hint: 'cook something at the island', look: [IX, 3.2], cam: [2.4, 2.2, 2.4], lookY: 1.0 },
      { x: -13.0, z: 7.4, r: 0.9, kind: 'fridge', hint: 'the fridge', look: [CF, 7.4], cam: [2.2, 1.8, -1.4], lookY: 1.4 },
      { x: BX, z: BZ - 1.4, r: 1.0, kind: 'skybar', hint: 'a drink at the bar', look: [BX, BZ + 1.2], cam: [-1.8, 1.9, -1.8], lookY: 1.5 },
      { x: HX - 1.0, z: 0.9, r: 0.8, kind: 'espresso', hint: 'an espresso at the window', look: [EX, 1.8], cam: [-1.8, 1.7, -1.2] },
      { x: RX, z: HZ - 1.2, r: 0.9, kind: 'records', hint: 'the record player', look: [RX + 0.4, HZ - 0.3], cam: [-1.6, 1.8, -2.0], lookY: 1.4 },
      { x: -8.4, z: -4.2, r: 0.9, fy: PM, kind: 'bed', hint: 'sleep (and save)', look: [-6.8, -4.6], cam: [-1.6, 2.0, 2.4] },
      { x: -11.9, z: -4.7, r: 0.9, fy: PM, kind: 'shower', hint: 'the rain shower', look: [-13.2, -4.4], cam: [2.6, 1.9, -2.2] },
      { x: TBX + 0.4, z: TBZ + 0.95, r: 0.9, fy: PM, kind: 'bath', hint: 'a soak in the tub (the bay outside)', seat: 'steam3' },
      { x: -12.2, z: -1.9, r: 0.9, fy: PM, kind: 'wardrobe', hint: 'the walk-in closet', face: 0.6 },
    ],
    wide: [4.0, 2.6, 5.0, 10.0, 1.6, -6.0],
    camFor(lx, lz, ly) {
      if (lx > HX) return [HX - 1.0, 2.6, Math.min(-0.8, lz + 3.0), 0.8, 0.6];
      if (onStair(lx, lz) && ly > 0.3 && lx > SX1) return [lx + 1.6, ly + 2.0, 4.4, 1.0, -0.2];
      if (ly > 2.4) return [Math.max(-11.5, Math.min(-0.6, lx + 4.4)), PM + 2.8, Math.max(-7.6, Math.min(8.4, lz + 3.0)), 1.0, 0.0];
      if (lx < MX) return [Math.max(-9.5, Math.min(0.5, lx + 4.2)), 2.9, Math.max(-7.6, Math.min(8.3, lz + 3.4)), 1.0, 0.6];
      return [Math.max(-2.0, Math.min(13.0, lx * 0.6 + 2.6)), 3.6 + Math.max(0, lz - 3) * 0.3, Math.max(-5.5, Math.min(8.3, lz + 5.0)), 1.0, 0.6];
    },
    tour: [[LIFT - 1.5, 2.2, 7.6, 4.0, 1.6, -9.0], [-3.0, 2.0, -1.5, -11.0, 1.0, 4.0], [5.5, 2.6, 4.2, -3.0, PM + 1.0, 8.0], [-3.6, PM + 2.0, 0.0, -7.0, PM + 0.6, -9.0], [HX - 1.2, 1.9, -0.8, 17.0, 0.6, -8.0], [6.25, 1.6, 1.2, 6.25, 2.6, -60]],
    idle(t, dt) {
      const d = dt || 1 / 60;
      st.userData.U.uT.value = t; st2.userData.U.uT.value = t; st3.userData.U.uT.value = t; hw.userData.U.uT.value = t; bw.userData.U.uT.value = t;
      tv.userData.tick(d); blinds.userData.tick(d); fire.userData.tick(t, d); fireGlow.userData.U.uT.value = t; fireGlow.userData.U.uK.value = fire.userData.k();
    },
  });
  room.fire = fire;
  room.blocks.forEach((b) => { if (b.y0 === undefined && b.y1 !== undefined) b.y0 = -1; });
}

// a floor lamp: a brass stem, a linen drum shade (its glow is unlit), a soft pool under it
function floorLamp(g, lit, pools, x, z, y = 0) {
  g.push(cyl(0.18, 0.2, 0.04, 10, x, y + 0.02, z, BLK), cyl(0.02, 0.02, 1.5, 6, x, y + 0.77, z, GOLD));
  lit.push(cyl(0.22, 0.26, 0.34, 12, x, y + 1.62, z, '#fff0d4'));
  pools.push(disc(x, y + 0.012, z, 1.4, '#ffd9a0', 0.35));
}
// an indoor tree in a bronze planter: an olive (kind 0: a crown of small leaf clumps) or a fig (1: big leaves)
function tree(g, x, z, s, leaf, kind = 0) {
  g.push(cyl(0.36 * s, 0.3 * s, 0.7 * s, 12, x, 0.35 * s, z, '#4a3c34'), cyl(0.32 * s, 0.32 * s, 0.02, 12, x, 0.69 * s, z, '#3a2a1a'), cyl(0.04 * s, 0.06 * s, 1.4 * s, 6, x, 1.35 * s, z, '#7a6040'));
  const r = rng(Math.round(x * 13 + z * 7 + 3));
  if (!kind) for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = 0.2 + r() * 0.35; g.push(box(0.34 * s, 0.26 * s, 0.34 * s, x + Math.cos(a) * rr * s, (1.85 + r() * 0.6) * s, z + Math.sin(a) * rr * s, i % 3 ? leaf : shadeHex(leaf, 1.18), 0.3, a, 0.2)); }
  else for (let i = 0; i < 11; i++) { const a = i * 2.1, h = (1.2 + i * 0.09) * s; g.push(box(0.36 * s, 0.03, 0.26 * s, x + Math.cos(a) * 0.26 * s, h, z + Math.sin(a) * 0.26 * s, i % 2 ? leaf : shadeHex(leaf, 1.2), 0, -a, -0.5)); }
}

// the linear fire: a row of flame tongues (additive, flickering in the shader). userData: want (on / off), k()
function flames(w, h, x, y, z) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 1); geo.rotateY(PI / 2); geo.translate(x, y + h / 2, z);
  const U = { uT: { value: 0 }, uK: { value: 1 } };
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uK; varying vec2 vU;
      void main(){ float x = vU.x * 26.0, n = sin(x * 1.7 + uT * 7.0) * 0.5 + sin(x * 3.1 - uT * 11.0) * 0.3 + sin(x * 0.6 + uT * 3.0) * 0.2;
        float top = 0.55 + 0.35 * n, f = smoothstep(top, top - 0.45, vU.y) * smoothstep(0.0, 0.08, vU.x) * smoothstep(1.0, 0.92, vU.x);
        vec3 c = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.45), smoothstep(0.5, 0.0, vU.y)) + vec3(0.2, 0.4, 1.0) * smoothstep(0.12, 0.0, vU.y) * 0.6;
        gl_FragColor = vec4(c * f * uK * 1.2, 1.0); }`,
  }));
  m.renderOrder = 5; m.frustumCulled = false;
  let k = 1;
  m.userData = { want: 1, k: () => k, U,
    tick(t, dt) { k += Math.sign(m.userData.want - k) * Math.min(Math.abs(m.userData.want - k), dt * 1.2); U.uT.value = t; U.uK.value = k * (0.88 + 0.12 * Math.sin(t * 13) * Math.sin(t * 5.3)); m.visible = k > 0.01; } };
  return m;
}

// the blinds: panels [a0, a1, at, top, bottom, 'x' | 'z'] (along x at z = at, or along z at x = at). Each vertex
// keeps its panel's top in aTop; the shader rolls it up: y' = top - (top - y) * k. userData: want, toggle(), tick()
function blindsMesh(panels) {
  const parts = [];
  for (const [a0, a1, at, top, bot, ax] of panels) {
    const w = a1 - a0, h = top - bot, q = new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w / 1.2)), 1);
    if (ax === 'z') q.rotateY(PI / 2);
    q.translate(ax === 'x' ? (a0 + a1) / 2 : at, (top + bot) / 2, ax === 'x' ? at : (a0 + a1) / 2);
    const n = q.attributes.position.count;
    q.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(n).fill(top), 1));
    q.deleteAttribute('uv'); q.deleteAttribute('normal');
    const col = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) { c.set('#e8dcc8').multiplyScalar(0.82 + 0.18 * ((q.attributes.position.getY(i) - bot) / h)); col.set([c.r, c.g, c.b], i * 3); }
    q.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(q);
  }
  const geo = merge(parts);
  const U = { uK: { value: 0.0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, vertexColors: true,
    vertexShader: 'attribute float aTop; varying vec3 vC; varying float vS; uniform float uK; void main(){ vec3 p = position; p.y = aTop - (aTop - p.y) * uK; vC = color; vS = sin(p.x * 18.0 + p.z * 18.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vS; void main(){ gl_FragColor = vec4(vC * (0.96 + 0.04 * vS), 0.93); }',
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 5; m.frustumCulled = false; m.visible = false;
  let k = 0;
  m.userData = { want: 0, U,
    toggle() { m.userData.want = m.userData.want ? 0 : 1; m.visible = true; return m.userData.want; },
    tick(dt) { k += Math.sign(m.userData.want - k) * Math.min(Math.abs(m.userData.want - k), dt * 0.35); U.uK.value = Math.max(0.004, k); m.visible = k > 0.003; },
    get k() { return k; } };
  return m;
}
