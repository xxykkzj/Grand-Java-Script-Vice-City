// The lobby of the Solstice Spire (game/spire.js runs the lift and the terrace on the roof): marble floor with
// brass inlays, walnut wainscot, a coffered ceiling with a ring chandelier, Leo the concierge behind a curved
// desk, a pair of sofas round a coffee table, a sun sculpture, palms in big pots, a skyline painting, and the
// lift bank on the back wall: the middle car is real (a lit car behind sliding doors and a floor counter over
// them), the other two are dressing. Rooms are authored around (0, 0, 0) with the door on +z (game/interiors.js).
import * as THREE from 'three';
import { box, cyl, tint, PI } from '../core/util.js';
import { plant, rug, boards, P, pbox } from './dress.js';

const BLK = '#22203a', GOLD = '#ffd166', BRASS = '#d9b45a', WALNUT = '#5a3a26', CREAM = '#f6f1e7';

export const SPIRE_LOOKS = {
  // Leo, the concierge: a deep teal tailcoat with gold buttons and epaulettes, white gloves, a burgundy tie,
  // silver hair combed back, a neat moustache
  LEO: { skin: '#d8a882', top: '#1f4a5a', legs: '#1b2a36', cuff: '#f6f1e7', fore: '#1f4a5a', shoe: '#1b1830', belt: null,
    wear(K, P) {
      const T = '#1f4a5a', HR = '#c8c8d0';
      P.body.push(K.B(0.16, 0.4, 0.022, 0, 1.22, 0.137, '#fff6ec'), K.B(0.05, 0.22, 0.016, 0, 1.27, 0.15, '#8a1a30', 'stripe'), K.B(0.07, 0.3, 0.02, 0.09, 1.3, 0.14, T, 'plain', { rz: -0.2 }),
        K.B(0.07, 0.3, 0.02, -0.09, 1.3, 0.14, T, 'plain', { rz: 0.2 }), K.B(0.025, 0.025, 0.012, 0.06, 1.12, 0.14, GOLD), K.B(0.025, 0.025, 0.012, 0.06, 1.04, 0.14, GOLD),
        K.B(0.025, 0.025, 0.012, -0.06, 1.12, 0.14, GOLD), K.B(0.025, 0.025, 0.012, -0.06, 1.04, 0.14, GOLD),
        K.B(0.15, 0.04, 0.27, 0.23, 1.5, 0, GOLD, 'rib'), K.B(0.15, 0.04, 0.27, -0.23, 1.5, 0, GOLD, 'rib'), K.B(0.44, 0.24, 0.06, 0, 0.82, -0.13, T, 'weave'),
        K.B(0.22, 0.05, 0.2, 0, 1.48, 0, '#fff6ec'));
      P.head.push(K.B(0.31, 0.08, 0.29, 0, 0.345, -0.01, HR, 'hair'), K.B(0.2, 0.05, 0.12, 0, 0.385, 0.06, HR, 'hair', { rx: -0.25 }), K.B(0.31, 0.2, 0.07, 0, 0.21, -0.125, HR, 'hair'),
        K.B(0.03, 0.12, 0.15, 0.155, 0.245, -0.05, HR, 'hair'), K.B(0.03, 0.12, 0.15, -0.155, 0.245, -0.05, HR, 'hair'));
      P.arms((sx) => [K.B(0.1, 0.09, 0.105, 0, -0.5, 0, '#fbf7f0'), K.B(0.13, 0.04, 0.14, 0, -0.44, 0, GOLD, 'rib')]);
    } },
  // June, the Afterglow Bar's bartender on the terrace: a white shirt with rolled sleeves, a rust waistcoat, a
  // black apron, a coral bob, gold hoops
  JUNE: { skin: '#a56b43', top: '#f6f1e7', legs: '#22203a', fore: '#a56b43', cuff: '#f6f1e7', shoe: '#1b1830', belt: null,
    wear(K, P) {
      const V = '#c8622a', HR = '#ff7a5a';
      P.body.push(K.B(0.17, 0.4, 0.022, 0.11, 1.22, 0.137, V, 'knit'), K.B(0.17, 0.4, 0.022, -0.11, 1.22, 0.137, V, 'knit'), K.B(0.46, 0.4, 0.022, 0, 1.22, -0.137, V, 'knit'),
        K.B(0.02, 0.4, 0.27, 0.232, 1.22, 0, V), K.B(0.02, 0.4, 0.27, -0.232, 1.22, 0, V), K.B(0.025, 0.025, 0.012, 0.04, 1.2, 0.15, GOLD), K.B(0.025, 0.025, 0.012, 0.04, 1.1, 0.15, GOLD),
        K.B(0.4, 0.55, 0.02, 0, 0.82, 0.14, BLK, 'weave'), K.B(0.24, 0.05, 0.2, 0, 1.48, 0, '#f6f1e7'));
      P.head.push(K.B(0.33, 0.11, 0.31, 0, 0.35, -0.01, HR, 'hair'), K.B(0.33, 0.24, 0.08, 0, 0.21, -0.125, HR, 'hair'), K.B(0.04, 0.22, 0.22, 0.165, 0.22, -0.02, HR, 'hair'),
        K.B(0.04, 0.22, 0.22, -0.165, 0.22, -0.02, HR, 'hair'), K.B(0.24, 0.05, 0.045, 0, 0.312, 0.148, HR, 'hair'),
        K.B(0.018, 0.06, 0.05, 0.178, 0.085, 0.01, GOLD), K.B(0.018, 0.06, 0.05, -0.178, 0.085, 0.01, GOLD));
      P.arms((sx) => [K.B(0.14, 0.05, 0.15, 0, -0.25, 0, '#f6f1e7', 'rib')]);
    } },
};

// the lift car behind the middle doors: x within +-CAR.w, from the back wall (z = -HZ) to z = -HZ - CAR.d
export const LIFT = { w: 0.95, d: 1.9, door: 0.8, h: 2.6 };

export function buildSpire(room) {
  const g = [], B = room.boards = boards(1024), HX = 8, HZ = 6.5, H = 4.6, pools = room.pools, hi = room.hiPools;
  const disc = (x, y, z, r, hex, k, axis) => ({ disc: [x, y, z, r, hex, k, axis] }), cone = (x, y, z, rt, rb, h, hex, k) => ({ cone: [x, y, z, rt, rb, h, hex, k] });
  // ---- the shell: marble tiles, walls in warm sand over walnut, a coffered ceiling; the back wall has the lift opening
  for (let x = -HX; x < HX; x += 1.6) for (let z = -HZ; z < HZ; z += 1.6) {
    const w = Math.min(1.6, HX - x), d = Math.min(1.6, HZ - z), k = (Math.round(x / 1.6) + Math.round(z / 1.6)) % 2;
    g.push(box(w, 0.1, d, x + w / 2, -0.05, z + d / 2, k ? '#efe8dc' : '#e0d6c6'));
    // a vein or two in each slab
    if ((Math.round(x * 3) + Math.round(z * 7)) % 3 === 0) g.push(box(w * 0.8, 0.004, 0.025, x + w / 2, 0.002, z + d * 0.4, '#cfc4b2', 0, 0.5));
  }
  // a brass border band and a dark inlay round the floor, the sun medallion in the middle
  for (const [w, d, x, z] of [[HX * 2 - 2, 0.12, 0, -HZ + 1], [HX * 2 - 2, 0.12, 0, HZ - 1], [0.12, HZ * 2 - 2, -HX + 1, 0], [0.12, HZ * 2 - 2, HX - 1, 0]]) g.push(box(w, 0.012, d, x, 0.006, z, BRASS), box(w + (d < 1 ? 0 : 0.3), 0.01, d + (w < 1 ? 0 : 0.3), x, 0.004, z, '#3a4a48'));
  g.push(tint(new THREE.RingGeometry(1.7, 1.85, 32).rotateX(-PI / 2).translate(0, 0.008, 0.8), BRASS), tint(new THREE.CircleGeometry(1.7, 32).rotateX(-PI / 2).translate(0, 0.006, 0.8), '#d8c8a8'));
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.push(box(0.12, 0.012, i % 2 ? 0.9 : 1.4, Math.sin(a) * 1.0, 0.01, 0.8 + Math.cos(a) * 1.0, i % 2 ? '#c8a050' : '#3a4a48', 0, a)); }
  const WALL = '#d8c4a8';
  const back = (x0, x1, y0, y1) => g.push(pbox(x1 - x0, y1 - y0, 0.2, (x0 + x1) / 2, (y0 + y1) / 2, -HZ - 0.1, WALL));
  back(-HX - 0.2, -LIFT.door, -0.1, H + 0.1); back(LIFT.door, HX + 0.2, -0.1, H + 0.1); back(-LIFT.door, LIFT.door, LIFT.h, H + 0.1);
  g.push(pbox(HX * 2 + 0.4, H + 0.2, 0.2, 0, H / 2, HZ + 0.1, WALL), pbox(0.2, H + 0.2, HZ * 2, -HX - 0.1, H / 2, 0, WALL), pbox(0.2, H + 0.2, HZ * 2, HX + 0.1, H / 2, 0, WALL),
    pbox(HX * 2 + 0.4, 0.2, HZ * 2 + 0.4, 0, H + 0.1, 0, '#f4ede2', 1.5));
  // walnut wainscot with a brass cap (cut round the lift doors), pilasters, a cornice
  const wain = (w, x, z, ry) => g.push(box(w, 1.1, 0.05, x, 0.55, z, WALNUT, 0, ry), box(w, 0.05, 0.08, x, 1.12, z, BRASS, 0, ry));
  wain(HX - 1.4, -(HX + 1.4) / 2 - 0.1, -HZ + 0.03, 0); wain(HX - 1.4, (HX + 1.4) / 2 + 0.1, -HZ + 0.03, 0);
  wain(HX - 1, -(HX + 1) / 2, HZ - 0.03, 0); wain(HX - 1, (HX + 1) / 2, HZ - 0.03, 0);
  wain(HZ * 2, -HX + 0.03, 0, PI / 2); wain(HZ * 2, HX - 0.03, 0, PI / 2);
  for (const x of [-6, -1.9, 1.9, 6]) g.push(box(0.5, H, 0.12, x, H / 2, -HZ + 0.06, '#e8dcc8'), box(0.6, 0.2, 0.18, x, H - 0.1, -HZ + 0.09, BRASS));
  for (const z of [-3.2, 0, 3.2]) for (const sx of [-1, 1]) g.push(box(0.12, H, 0.5, sx * (HX - 0.06), H / 2, z, '#e8dcc8'));
  g.push(box(HX * 2, 0.22, 0.2, 0, H - 0.11, -HZ + 0.1, '#c8b494'), box(HX * 2, 0.22, 0.2, 0, H - 0.11, HZ - 0.1, '#c8b494'), box(0.2, 0.22, HZ * 2, -HX + 0.1, H - 0.11, 0, '#c8b494'), box(0.2, 0.22, HZ * 2, HX - 0.1, H - 0.11, 0, '#c8b494'));
  // coffers: a grid of beams under the ceiling
  for (let x = -HX + 2; x < HX; x += 2.7) g.push(box(0.22, 0.24, HZ * 2, x, H - 0.12, 0, '#efe6d6'));
  for (let z = -HZ + 2.2; z < HZ; z += 2.6) g.push(box(HX * 2, 0.24, 0.22, 0, H - 0.12, z, '#efe6d6'));
  // the way out: the glass doors to Stadium Way, warm street light behind them, a brass frame
  g.push(box(2.4, 2.9, 0.06, 0, 1.45, HZ - 0.02, '#ffbf70'), box(2.4, 1.0, 0.07, 0, 0.5, HZ - 0.02, '#ff8a6a'), box(0.06, 2.9, 0.08, 0, 1.45, HZ - 0.05, BRASS),
    box(2.6, 0.12, 0.1, 0, 2.95, HZ - 0.06, BRASS), box(0.1, 3.0, 0.1, -1.25, 1.5, HZ - 0.06, BRASS), box(0.1, 3.0, 0.1, 1.25, 1.5, HZ - 0.06, BRASS));
  for (const sx of [-1, 1]) g.push(box(1.6, 3.0, 0.05, sx * 2.2, 1.5, HZ - 0.03, '#2a3a5a'), box(1.6, 0.08, 0.08, sx * 2.2, 3.0, HZ - 0.06, BRASS));
  B.add(1.4, 2.7, -2.2, 1.5, HZ - 0.07, PI, (c, W, Hh) => skyline(c, W, Hh, 3));
  B.add(1.4, 2.7, 2.2, 1.5, HZ - 0.07, PI, (c, W, Hh) => skyline(c, W, Hh, 8));

  // ---- the lift bank: the middle car (open to a lit car behind sliding doors), two dressed ones either side
  const car = (x) => {
    g.push(box(LIFT.door * 2 + 0.36, 0.18, 0.12, x, LIFT.h + 0.09, -HZ + 0.06, BRASS), box(0.18, LIFT.h, 0.12, x - LIFT.door - 0.09, LIFT.h / 2, -HZ + 0.06, BRASS), box(0.18, LIFT.h, 0.12, x + LIFT.door + 0.09, LIFT.h / 2, -HZ + 0.06, BRASS));
    g.push(box(1.0, 0.34, 0.05, x, LIFT.h + 0.45, -HZ + 0.03, BLK), box(0.14, 0.3, 0.06, x + LIFT.door + 0.45, 1.25, -HZ + 0.04, BRASS), box(0.07, 0.07, 0.07, x + LIFT.door + 0.45, 1.32, -HZ + 0.08, '#ffb35a'));
  };
  for (const x of [-3.9, 0, 3.9]) car(x);
  // the dressing cars: closed steel doors, their counters stopped on a floor
  for (const [x, n] of [[-3.9, '12'], [3.9, '7']]) {
    g.push(box(LIFT.door - 0.02, LIFT.h, 0.04, x - LIFT.door / 2, LIFT.h / 2, -HZ + 0.02, '#b8b4c4'), box(LIFT.door - 0.02, LIFT.h, 0.04, x + LIFT.door / 2, LIFT.h / 2, -HZ + 0.02, '#c4c0d0'), box(0.02, LIFT.h, 0.05, x, LIFT.h / 2, -HZ + 0.03, '#6a6878'));
    B.add(0.9, 0.28, x, LIFT.h + 0.45, -HZ + 0.06, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#120a18'); P.text(c, n, W / 2, Hh / 2, Hh * 0.8, '#ffb35a', { glow: 6, font: 'monospace' }); });
  }
  // the real car: cream walls, a brass rail, a mirror on the back, a warm light
  const cz = -HZ - LIFT.d / 2;
  g.push(box(LIFT.w * 2, 0.08, LIFT.d, 0, -0.04, cz, '#a8844e'), box(LIFT.w * 2, 0.1, LIFT.d, 0, LIFT.h + 0.05, cz, '#e8dcc0'),
    box(0.08, LIFT.h, LIFT.d, -LIFT.w, LIFT.h / 2, cz, '#b8946a'), box(0.08, LIFT.h, LIFT.d, LIFT.w, LIFT.h / 2, cz, '#b8946a'), box(LIFT.w * 2, LIFT.h, 0.08, 0, LIFT.h / 2, -HZ - LIFT.d, '#c8a476'),
    box(LIFT.w * 2 - 0.2, 0.05, 0.05, 0, 0.95, -HZ - LIFT.d + 0.1, BRASS), box(0.05, 0.05, LIFT.d - 0.3, -LIFT.w + 0.1, 0.95, cz, BRASS), box(0.05, 0.05, LIFT.d - 0.3, LIFT.w - 0.1, 0.95, cz, BRASS),
    box(0.9, 0.06, 0.6, 0, LIFT.h - 0.02, cz, '#fffbe8'), box(0.2, 0.5, 0.04, LIFT.w - 0.06, 1.3, -HZ - 0.4, BRASS, 0, PI / 2));
  B.add(1.2, 1.1, 0, 1.6, -HZ - LIFT.d + 0.05, 0, (c, W, Hh) => P.mirror(c, W, Hh, ['#8a9aa8', '#5a6a78'], [['#ffd9a0', 4], ['#c8a060', 3]], 11));
  pools.push(disc(0, 0.012, cz, 1.0, '#ffe0b0', 0.3));
  // its doors slide into the wall (game/spire.js opens and closes them); the counter over them is a little canvas
  const dm = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const leaf = (sx) => { const m = new THREE.Mesh(box(LIFT.door, LIFT.h, 0.05, 0, LIFT.h / 2, 0, sx < 0 ? '#c8c4d4' : '#d4d0de'), dm); m.position.set(sx * LIFT.door / 2, 0, -HZ - 0.08); return m; };
  const doorL = leaf(-1), doorR = leaf(1);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 40;
  const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.29), new THREE.MeshBasicMaterial({ map: ctex, fog: false }));
  counter.position.set(0, LIFT.h + 0.45, -HZ + 0.06);
  let shown = null;
  const setFloor = (f, dir = 0) => {
    const s = (f === 0 ? 'L' : f >= 23 ? 'T' : String(f)) + (dir > 0 ? ' ▲' : dir < 0 ? ' ▼' : '');
    if (s === shown) return; shown = s;
    const c = cv.getContext('2d'); c.fillStyle = '#120a18'; c.fillRect(0, 0, 128, 40);
    c.font = 'bold 30px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#ffb35a'; c.shadowBlur = 8; c.fillStyle = '#ffc070'; c.fillText(s, 64, 21);
    ctex.needsUpdate = true;
  };
  setFloor(0);
  room.extras.push(doorL, doorR, counter);
  // the directory by the lifts and the house name in brass letters over them
  B.add(1.5, 1.0, -6.0, 1.75, -HZ + 0.13, 0, (c, W, Hh) => {
    P.fill(c, W, Hh, '#1b1a2a'); P.frame(c, W, Hh, BRASS, 5);
    P.text(c, 'DIRECTORY', W / 2, Hh * 0.13, Hh * 0.09, GOLD);
    [['SOLSTICE TERRACE', '23'], ['AFTERGLOW BAR', '23'], ['HALCYON LAW', '18'], ['TIDEWATER CAPITAL', '12'], ['BLUEWAVE RADIO', '7'], ['LOBBY · CONCIERGE', 'L']].forEach(([a, n], i) => {
      P.text(c, a, W * 0.08, Hh * (0.3 + i * 0.11), Hh * 0.065, '#f6f1e7', { align: 'left' }); P.text(c, n, W * 0.92, Hh * (0.3 + i * 0.11), Hh * 0.065, '#ffc070', { align: 'right' });
    });
  });
  B.add(7.4, 0.62, 0, 3.75, -HZ + 0.07, 0, (c, W, Hh) => { c.clearRect(0, 0, W, Hh); P.text(c, 'THE SOLSTICE SPIRE', W / 2, Hh / 2, Hh * 0.62, '#e8c070', { glow: 10, font: 'Georgia, serif', weight: 700 }); }, 140);
  pools.push(disc(0, 3.75, -HZ + 0.05, 3.2, '#ffc890', 0.25, 'z'), disc(0, 0.012, -HZ + 1.2, 2.2, '#ffd9a0', 0.32));

  // ---- the concierge desk (left), curved in three angled sections, a brass lamp, a bell, the key board behind
  const DX = -5.4;
  for (const [z, ry, w] of [[-2.35, 0.45, 1.5], [-1.0, 0, 1.4], [0.35, -0.45, 1.5]]) {
    g.push(box(0.7, 1.08, w, DX - Math.abs(ry) * 0.6, 0.54, z, WALNUT, 0, ry), box(0.82, 0.06, w + 0.06, DX - Math.abs(ry) * 0.6, 1.11, z, '#e8e0d0', 0, ry), box(0.04, 0.9, w - 0.1, DX - Math.abs(ry) * 0.6 + 0.36, 0.55, z, BRASS, 0, ry));
  }
  g.push(cyl(0.08, 0.1, 0.05, 10, DX + 0.1, 1.16, -1.5, BRASS), cyl(0.012, 0.012, 0.42, 4, DX + 0.1, 1.38, -1.5, BRASS), cyl(0.12, 0.17, 0.16, 10, DX + 0.1, 1.62, -1.5, '#2f6f5a'),
    cyl(0.06, 0.07, 0.05, 10, DX + 0.15, 1.16, -0.4, GOLD), box(0.3, 0.02, 0.22, DX + 0.05, 1.15, -0.95, CREAM));
  pools.push(disc(DX + 0.1, 1.15, -1.5, 0.6, '#ffd9a0', 0.3));
  g.push(box(0.06, 1.4, 2.2, -HX + 0.05, 1.9, -1.0, WALNUT));
  for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) g.push(box(0.04, 0.05, 0.05, -HX + 0.09, 1.4 + i * 0.3, -1.85 + k * 0.34, GOLD), box(0.03, 0.12, 0.03, -HX + 0.1, 1.33 + i * 0.3, -1.85 + k * 0.34, BRASS));
  B.add(1.8, 0.5, -HX + 0.12, 2.95, -1.0, PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#1b1a2a'); P.text(c, 'CONCIERGE', W / 2, Hh / 2, Hh * 0.5, '#e8c070', { glow: 6, font: 'Georgia, serif', weight: 700 }); });

  // ---- the sitting area (right): two sofas facing each other over a coffee table on a rug, lamps, the painting
  rug(g, 3.8, 3.4, 5.2, -0.3, '#2f4a5a', '#3f6a7a', '#d9b45a', 'diamonds');
  const seats = [], blocks = [];
  const sofa = (x, z, yaw) => {
    const s = yaw ? -1 : 1;
    g.push(box(2.6, 0.42, 0.85, x, 0.21, z, '#7a2a3a'), box(2.6, 0.12, 0.8, x, 0.48, z + s * 0.02, '#8a3446'), box(2.6, 0.6, 0.22, x, 0.72, z - s * 0.36, '#7a2a3a'),
      box(0.22, 0.62, 0.85, x - 1.3, 0.31, z, '#6a2232'), box(0.22, 0.62, 0.85, x + 1.3, 0.31, z, '#6a2232'));
    for (const o of [-0.6, 0.6]) seats.push({ x: x + o, z: z + s * 0.05, y: 0.5, yaw, kind: 'booth' });
    blocks.push({ x0: x - 1.45, x1: x + 1.45, z0: z - 0.45, z1: z + 0.45 });
  };
  sofa(5.2, -2.3, 0); sofa(5.2, 1.7, PI);
  g.push(box(1.6, 0.06, 0.8, 5.2, 0.42, -0.3, '#3a2a20'), box(1.5, 0.36, 0.7, 5.2, 0.2, -0.3, WALNUT), box(0.4, 0.04, 0.3, 4.9, 0.47, -0.25, '#e8dcc8'), cyl(0.07, 0.09, 0.16, 8, 5.6, 0.53, -0.35, '#27a8a0'));
  for (let i = 0; i < 3; i++) g.push(box(0.12, 0.12, 0.12, 5.6 + (i - 1) * 0.05, 0.66 + i * 0.03, -0.35, ['#ff5fa8', '#ffd447', CREAM][i]));
  blocks.push({ x0: 4.35, x1: 6.05, z0: -0.75, z1: 0.15 });
  for (const z of [-2.3, 1.7]) {
    g.push(box(0.5, 0.5, 0.5, 7.25, 0.25, z, WALNUT), cyl(0.03, 0.03, 0.5, 6, 7.25, 0.75, z, BRASS), cyl(0.14, 0.22, 0.28, 10, 7.25, 1.1, z, '#f6e8c8'));
    pools.push(disc(7.25, 0.012, z, 1.2, '#ffd9a0', 0.45)); blocks.push({ x0: 6.95, x1: 7.55, z0: z - 0.3, z1: z + 0.3 });
  }
  g.push(box(0.04, 1.9, 3.4, HX - 0.04, 2.35, -0.3, BRASS));
  B.add(3.2, 1.7, HX - 0.07, 2.35, -0.3, -PI / 2, (c, W, Hh) => skyline(c, W, Hh, 21, true));
  pools.push(disc(HX - 0.05, 2.35, -0.3, 2.2, '#ffd0a0', 0.25, '-x'));

  // ---- the sun sculpture on a plinth in the middle, a palm in each corner and by the lifts
  g.push(cyl(0.55, 0.62, 0.9, 12, 0, 0.45, 0.8, '#3a4a48'), cyl(0.6, 0.6, 0.06, 12, 0, 0.92, 0.8, BRASS));
  g.push(tint(new THREE.TorusGeometry(0.42, 0.06, 6, 20).translate(0, 1.6, 0.8), GOLD), tint(new THREE.SphereGeometry(0.22, 10, 8).translate(0, 1.6, 0.8), '#ffb35a'));
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.push(box(0.05, 0.34, 0.05, Math.cos(a) * 0.62, 1.6 + Math.sin(a) * 0.62, 0.8, GOLD, 0, 0, a - PI / 2)); }
  blocks.push({ x0: -0.65, x1: 0.65, z0: 0.15, z1: 1.45 });
  pools.push(disc(0, 0.94, 0.8, 0.8, '#ffd9a0', 0.2));
  for (const [x, z, k] of [[-7.1, 5.5, 0], [7.1, 5.5, 0], [-7.1, -5.6, 1], [7.1, -5.6, 0], [-2.0, -5.7, 1], [2.0, -5.7, 1]]) {
    plant(g, x, z, k ? 1.0 : 1.4, '#e8e0d0', k ? '#3faf6a' : '#2f9f6a', k);
    blocks.push({ x0: x - 0.45, x1: x + 0.45, z0: z - 0.45, z1: z + 0.45 });
  }

  // ---- the chandelier: a brass ring of lamps over the medallion, and two smaller ones by the lifts and the desk
  const ring = (x, z, rr, y) => {
    g.push(tint(new THREE.TorusGeometry(rr, 0.04, 5, 24).rotateX(PI / 2).translate(x, y, z), BRASS), cyl(0.015, 0.015, H - y, 4, x, (H + y) / 2, z, BRASS));
    for (let i = 0; i < 10; i++) { const a = i * PI / 5; g.push(cyl(0.05, 0.06, 0.12, 6, x + Math.cos(a) * rr, y + 0.07, z + Math.sin(a) * rr, '#fff3c4')); }
    pools.push(disc(x, 0.012, z, rr * 3.2, '#ffd9a0', 0.18)); hi.push(cone(x, y, z, rr, rr * 2.6, y - 0.1, '#ffe8c0', 0.07));
  };
  ring(0, 0.8, 0.9, 3.4); ring(-4.6, -1.0, 0.5, 3.6);
  // brass sconces either side of the lift bank
  for (const x of [-6, -1.9, 1.9, 6]) { g.push(box(0.16, 0.3, 0.12, x, 2.9, -HZ + 0.18, BRASS), cyl(0.07, 0.11, 0.2, 8, x, 3.12, -HZ + 0.22, '#fff0c8')); pools.push(disc(x, 3.0, -HZ + 0.02, 0.9, '#ffd9a0', 0.3, 'z')); }
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, clerk: 'LEO', rim: '#4a3a2a', amb: 0.52, ambCol: '#fff0dc',
    bloomK: 0.35,
    lights: [{ x: 0, y: 3.3, z: 0.8, hex: '#ffd9a0', r: 9, k: 0.4 }, { x: 0, y: 3.0, z: -5.2, hex: '#ffd0a0', r: 5.5, k: 0.35 }, { x: -4.6, y: 3.4, z: -1.0, hex: '#ffd9a0', r: 5, k: 0.35 },
      { x: 7.0, y: 1.3, z: -0.3, hex: '#ffcf90', r: 4.5, k: 0.4 }, { x: 0, y: 2.0, z: 5.6, hex: '#ffb070', r: 4.5, k: 0.3 }, { x: 0, y: 2.2, z: -HZ - 0.9, hex: '#fff0d0', r: 2.4, k: 0.35 }],
    blocks: [{ x0: DX - 1.0, x1: DX + 0.4, z0: -3.2, z1: 1.2 }, { x0: -HX, x1: DX - 0.9, z0: -3.2, z1: 1.2 }, ...blocks],
    seats, me: [1.4, 3.0], cast: { LEO: [-6.6, -1.0, PI / 2] },
    uses: [{ x: 0, z: -5.4, r: 1.25, kind: 'lift', hint: 'ride the lift up to the terrace' }, { x: -4.3, z: -1.0, r: 1.2, kind: 'concierge', hint: 'talk to Leo', clerk: 'LEO', look: [-6.6, -1.0] }],
    wide: [6.6, 3.3, 5.4, -1.2, 1.5, -3.2],
    lift: { doorL, doorR, setFloor, open: 0, carZ: cz },
    setDoors(k) { room.lift.open = k; doorL.position.x = -LIFT.door / 2 - k * LIFT.door; doorR.position.x = LIFT.door / 2 + k * LIFT.door; },
    idle(t, dt, still) {
      const n = room.npc.LEO, k = still ? 0.3 : 1;
      // hands folded on the desk, a polite look round now and then
      n.armR.rotation.set(-0.9, 0, -0.25); n.armL.rotation.set(-0.9, 0, 0.25); n.head.rotation.set(0, Math.sin(t * 0.35) * 0.45 * k, 0);
    },
  });
}

// a painted skyline: the old town at sunset across the bay (the lobby doors' glass and the painting)
function skyline(c, W, H, seed, framed = false) {
  P.grad(c, W, H, '#2a1a5a', '#ff8a5a');
  c.fillStyle = '#ffd447'; c.beginPath(); c.arc(W * 0.62, H * 0.62, H * 0.16, PI, 0); c.fill();
  c.fillStyle = '#ff5fa8'; for (let i = 0; i < 3; i++) c.fillRect(W * 0.5, H * (0.53 + i * 0.03), W * 0.24, H * 0.012);
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  c.fillStyle = '#2a1840';
  for (let x = 0; x < W; ) { const w = W * (0.04 + rnd() * 0.06), h = H * (0.12 + rnd() * 0.3); c.fillRect(x, H * 0.66 - h, w, h); x += w + 1; }
  c.fillStyle = '#ffd9a0'; for (let i = 0; i < 60; i++) c.fillRect(rnd() * W, H * (0.4 + rnd() * 0.25), 2, 2);
  c.fillStyle = '#1b2a5a'; c.fillRect(0, H * 0.66, W, H * 0.34);
  c.fillStyle = '#ff8ab0'; for (let i = 0; i < 8; i++) c.fillRect(W * (0.45 + rnd() * 0.3), H * (0.7 + i * 0.035), W * 0.12, 2);
  if (framed) P.frame(c, W, H, '#d9b45a', 6);
}
