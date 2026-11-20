// The venue interiors (what you do in them is game/venues.js): the Sunset Strip Diner, the Seahorse
// Arcade, room 7 at the Moonlite Motor Inn, the Seafoam Galleria atrium and Starboard Bait & Tackle,
// plus their residents in the same refined-block style as the story cast (actors/blocky.js).
// Rooms are authored around (0, 0, 0) with the door on +z, like game/interiors.js.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng } from '../core/util.js';
import { shell, stool, plant, rug, pipe, boards, P, fan, fishTank, pulser, pbox, shadeHex } from './dress.js';

const BLK = '#22203a', GOLD = '#ffd166', CHROME = '#d9d6e6', NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];

// ---- residents -------------------------------------------------------------------------------------------
export const VENUE_LOOKS = {
  // Dot: a mint diner dress with a white collar and apron, red bouffant under a paper cap, a pencil behind the ear
  DOT: { skin: '#e8b48a', top: '#7fe8c8', legs: '#e8b48a', sleeve: '#7fe8c8', fore: '#e8b48a', cuff: '#ffffff', shoe: '#ff4f6a', belt: null,
    wear(K, P) {
      const M = '#7fe8c8', H = '#d8502a';
      P.body.push(K.B(0.27, 0.05, 0.23, 0, 1.478, 0, '#ffffff', 'rib'), K.B(0.34, 0.3, 0.02, 0, 1.12, 0.137, '#ffffff', 'seam'), K.B(0.44, 0.05, 0.26, 0, 1.0, 0, '#ffffff'),
        K.B(0.46, 0.18, 0.28, 0, 0.85, 0, M, 'weave'), K.B(0.52, 0.18, 0.32, 0, 0.69, 0, M, 'weave'), K.B(0.32, 0.3, 0.02, 0, 0.8, 0.165, '#ffffff', 'seam'),
        K.B(0.53, 0.03, 0.33, 0, 0.6, 0, '#ff4f6a', 'rib'), K.decal(0.1, 0.1, -0.11, 1.34, 0.138, M, 'heart'), K.B(0.07, 0.05, 0.012, 0.11, 1.36, 0.138, '#ff4f6a'));
      P.head.push(K.B(0.34, 0.16, 0.32, 0, 0.38, -0.01, H, 'hair'), K.B(0.26, 0.12, 0.24, 0, 0.5, -0.03, H, 'hair'), K.B(0.33, 0.24, 0.08, 0, 0.2, -0.125, H, 'hair'),
        K.B(0.04, 0.18, 0.2, 0.162, 0.25, -0.03, H, 'hair'), K.B(0.04, 0.18, 0.2, -0.162, 0.25, -0.03, H, 'hair'), K.B(0.22, 0.05, 0.045, 0, 0.312, 0.148, H, 'hair'),
        K.B(0.27, 0.07, 0.13, 0, 0.6, -0.02, '#ffffff', 'rib'), K.B(0.012, 0.012, 0.14, 0.175, 0.22, 0.02, '#ffe14a', 'plain', { rx: 0.4 }));
      P.arms((sx) => [K.B(0.14, 0.05, 0.15, 0, -0.25, 0, '#ffffff', 'rib')]);
    } },
  // Token: a cyan striped tee, the red token apron with a coin pouch, a purple cap on backwards
  TOKEN: { skin: '#8a5a3a', top: '#27a8c8', topPat: 'stripe', legs: '#3b5a9a', shoe: '#fff6ec', sole: '#ff2bd1', belt: BLK,
    wear(K, P) {
      P.body.push(K.B(0.44, 0.28, 0.02, 0, 1.05, 0.137, '#e8304a', 'seam'), K.B(0.3, 0.1, 0.03, 0, 0.98, 0.152, '#b0203a', 'leather'), K.B(0.03, 0.03, 0.01, 0.08, 0.99, 0.17, GOLD),
        K.B(0.03, 0.03, 0.01, -0.06, 0.99, 0.17, GOLD), K.B(0.04, 0.24, 0.02, 0.12, 1.32, 0.137, '#e8304a'), K.B(0.04, 0.24, 0.02, -0.12, 1.32, 0.137, '#e8304a'));
      P.head.push(K.B(0.32, 0.1, 0.3, 0, 0.36, 0, '#7a5cff', 'weave'), K.B(0.24, 0.025, 0.15, 0, 0.312, -0.215, '#7a5cff'), K.C(0.022, 0.022, 0.02, 6, 0, 0.415, 0, '#ffe14a'),
        K.B(0.31, 0.16, 0.06, 0, 0.22, -0.13, '#1b1410', 'hair'), K.B(0.03, 0.1, 0.14, 0.155, 0.25, -0.05, '#1b1410', 'hair'), K.B(0.03, 0.1, 0.14, -0.155, 0.25, -0.05, '#1b1410', 'hair'),
        K.B(0.12, 0.05, 0.03, 0, 0.32, 0.15, '#1b1410', 'hair'));
      P.arms((sx) => [K.B(0.136, 0.04, 0.146, 0, -0.235, 0, '#ffffff', 'rib')]);
    } },
  // Hazel: a mint cardigan over a pink dress, pearls, a big lilac perm, cat-eye glasses
  HAZEL: { skin: '#f0c8a8', top: '#9fe8d0', topPat: 'knit', legs: '#f0c8a8', sleeve: '#9fe8d0', cuff: '#ffffff', shoe: '#c06a8a', belt: null,
    wear(K, P) {
      const D = '#ff9ac8', L = '#c9b0ff';
      P.body.push(K.B(0.15, 0.4, 0.02, 0, 1.22, 0.137, D, 'knit'), K.B(0.025, 0.025, 0.012, 0.09, 1.3, 0.14, '#ffffff'), K.B(0.025, 0.025, 0.012, 0.09, 1.18, 0.14, '#ffffff'),
        K.B(0.44, 0.06, 0.26, 0, 1.0, 0, D), K.B(0.46, 0.2, 0.28, 0, 0.84, 0, D, 'weave'), K.B(0.5, 0.2, 0.3, 0, 0.66, 0, D, 'weave'),
        K.B(0.2, 0.025, 0.06, 0, 1.47, 0.11, '#fff6ec'), K.B(0.05, 0.025, 0.06, 0.1, 1.45, 0.1, '#fff6ec'), K.B(0.05, 0.025, 0.06, -0.1, 1.45, 0.1, '#fff6ec'));
      P.head.push(K.B(0.37, 0.18, 0.34, 0, 0.38, -0.01, L, 'hair'), K.B(0.09, 0.2, 0.26, 0.18, 0.25, -0.03, L, 'hair'), K.B(0.09, 0.2, 0.26, -0.18, 0.25, -0.03, L, 'hair'),
        K.B(0.35, 0.26, 0.1, 0, 0.2, -0.13, L, 'hair'), K.B(0.12, 0.1, 0.12, 0.08, 0.49, 0.02, L, 'hair'), K.B(0.12, 0.1, 0.12, -0.08, 0.49, -0.04, L, 'hair'),
        K.B(0.2, 0.06, 0.05, 0, 0.312, 0.148, L, 'hair'));
    } },
  // Kiki: a yellow visor, a pink striped shirt, teal shorts, a fanny pack, a dark ponytail
  KIKI: { skin: '#c98d62', top: '#ff9ac8', topPat: 'stripe', legs: '#c98d62', shoe: '#ffe14a', sole: '#fff6ec', belt: '#ff4fa3',
    wear(K, P) {
      const H = '#3a2410';
      P.body.push(K.B(0.22, 0.1, 0.08, 0, 0.98, 0.17, '#7a5cff', 'leather'), K.B(0.12, 0.03, 0.01, 0, 1.0, 0.212, '#ffe14a'), K.B(0.42, 0.14, 0.26, 0, 0.9, 0, '#27c9bf', 'denim'),
        K.decal(0.1, 0.1, 0.1, 1.34, 0.138, '#ff9ac8', 'star'));
      P.thighs.push(K.B(0.17, 0.18, 0.21, 0.095, -0.08, 0, '#27c9bf', 'denim'), K.B(0.17, 0.18, 0.21, -0.095, -0.08, 0, '#27c9bf', 'denim'));
      P.head.push(K.B(0.31, 0.1, 0.29, 0, 0.33, -0.01, H, 'hair'), K.B(0.33, 0.05, 0.31, 0, 0.35, 0, '#ffe14a', 'rib'), K.B(0.26, 0.025, 0.17, 0, 0.335, 0.22, '#ffe14a'),
        K.B(0.31, 0.22, 0.07, 0, 0.2, -0.125, H, 'hair'), K.B(0.1, 0.3, 0.1, 0, 0.18, -0.2, H, 'hair', { rx: 0.35 }), K.B(0.11, 0.04, 0.11, 0, 0.32, -0.19, '#ff4fa3'),
        K.B(0.03, 0.12, 0.14, 0.155, 0.24, -0.05, H, 'hair'), K.B(0.03, 0.12, 0.14, -0.155, 0.24, -0.05, H, 'hair'));
    } },
  // Cap'n Rudy: a white captain's hat, a yellow slicker over a navy turtleneck, green boots, a corncob pipe
  RUDY: { skin: '#d9a07a', top: '#ffd23a', topPat: 'leather', legs: '#2a3550', cuff: '#ffd23a', shoe: '#2a6a4a', shin: '#2a6a4a', belt: null,
    wear(K, P) {
      const N = '#2a3550';
      P.body.push(K.B(0.26, 0.09, 0.22, 0, 1.49, 0, N, 'knit'), K.B(0.14, 0.42, 0.02, 0, 1.2, 0.137, N, 'knit'), K.B(0.44, 0.1, 0.27, 0, 0.98, 0, '#ffd23a', 'leather'),
        K.B(0.05, 0.02, 0.012, 0.085, 1.3, 0.145, '#3a2a1a'), K.B(0.05, 0.02, 0.012, 0.085, 1.16, 0.145, '#3a2a1a'), K.B(0.1, 0.08, 0.02, -0.12, 1.06, 0.14, '#e8b81a', 'seam'));
      P.head.push(K.B(0.33, 0.1, 0.31, 0, 0.38, 0, '#f6f1e7', 'weave'), K.B(0.335, 0.04, 0.315, 0, 0.33, 0, BLK), K.B(0.26, 0.025, 0.15, 0, 0.315, 0.2, BLK),
        K.B(0.07, 0.05, 0.012, 0, 0.36, 0.158, GOLD), K.B(0.32, 0.18, 0.07, 0, 0.21, -0.125, '#d8d8d8', 'hair'), K.B(0.03, 0.12, 0.14, 0.155, 0.24, -0.06, '#d8d8d8', 'hair'),
        K.B(0.03, 0.12, 0.14, -0.155, 0.24, -0.06, '#d8d8d8', 'hair'), K.B(0.025, 0.025, 0.12, 0.07, 0.06, 0.19, '#c9a66a'), K.C(0.03, 0.03, 0.06, 8, 0.07, 0.09, 0.25, '#c9a66a'));
    } },
};

// ---- helpers -------------------------------------------------------------------------------------------
// place a list of locally built pieces at (x, z) turned by ry (local +z = the way it faces)
function put(g, list, x, z, ry = 0) { for (const q of list) { if (ry) q.rotateY(ry); q.translate(x, 0, z); g.push(q); } }
// a point in that same local frame, for boards: [x, y, z]
const loc = (x, z, ry, lx, ly, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)];
// a board placed in that frame
const bAt = (B, x, z, ry, lx, ly, lz, w, h, draw, res) => { const [px, py, pz] = loc(x, z, ry, lx, ly, lz); B.add(w, h, px, py, pz, ry, draw, res); };
const disc = (x, y, z, r, hex, k, axis, f) => ({ disc: [x, y, z, r, hex, k, axis, f] });
const cone = (x, y, z, rt, rb, h, hex, k) => ({ cone: [x, y, z, rt, rb, h, hex, k] });
// a framed picture on a wall
function picture(g, B, x, y, z, ry, w, h, frame, draw) {
  const [nx, nz] = [Math.sin(ry), Math.cos(ry)];
  g.push(box(ry % PI === 0 ? w + 0.12 : 0.04, h + 0.12, ry % PI === 0 ? 0.04 : w + 0.12, x - nx * 0.01, y, z - nz * 0.01, frame));
  B.add(w, h, x + nx * 0.015, y, z + nz * 0.015, ry, draw);
}
// a few painted pictures
const ART = {
  sunset(c, W, H) { P.grad(c, W, H, '#2a0f4a', '#ff6a8a'); c.fillStyle = '#ffd447'; c.beginPath(); c.arc(W / 2, H * 0.62, H * 0.26, PI, 0); c.fill(); c.fillStyle = '#ff2bd1'; for (let i = 0; i < 4; i++) c.fillRect(W * 0.2, H * (0.5 + i * 0.05), W * 0.6, H * 0.018); c.fillStyle = '#1b0f30'; c.fillRect(0, H * 0.62, W, H); c.fillStyle = '#ff4fc0'; for (let i = 0; i < 6; i++) c.fillRect(0, H * (0.66 + i * 0.06), W, 1 + i); P.palm(c, W * 0.18, H * 0.64, H * 0.45); P.palm(c, W * 0.86, H * 0.66, H * 0.36); },
  car(c, W, H) { P.grad(c, W, H, '#18f0ff', '#7a5cff'); c.fillStyle = '#ff2bd1'; c.fillRect(W * 0.12, H * 0.5, W * 0.76, H * 0.2); c.fillRect(W * 0.3, H * 0.34, W * 0.38, H * 0.18); c.fillStyle = '#bff8ff'; c.fillRect(W * 0.34, H * 0.37, W * 0.3, H * 0.12); c.fillStyle = '#22203a'; for (const x of [0.28, 0.72]) { c.beginPath(); c.arc(W * x, H * 0.72, H * 0.09, 0, 6.3); c.fill(); } c.fillStyle = '#ffe14a'; c.fillRect(W * 0.84, H * 0.54, W * 0.04, H * 0.05); },
  wave(c, W, H) { P.fill(c, W, H, '#fff6ec'); c.strokeStyle = '#27a8c8'; c.lineWidth = H * 0.05; for (let k = 0; k < 4; k++) { c.beginPath(); for (let x = 0; x <= W; x += 4) c.lineTo(x, H * (0.3 + k * 0.15) + Math.sin(x / W * 12 + k) * H * 0.05); c.stroke(); } c.fillStyle = '#ff6a3d'; c.beginPath(); c.arc(W * 0.75, H * 0.22, H * 0.12, 0, 6.3); c.fill(); },
  flamingo(c, W, H) { P.grad(c, W, H, '#ffd6e0', '#ffb0c8'); c.strokeStyle = '#ff2b8a'; c.lineWidth = W * 0.035; c.beginPath(); c.moveTo(W * 0.5, H * 0.9); c.lineTo(W * 0.52, H * 0.55); c.stroke(); c.fillStyle = '#ff4f9a'; c.beginPath(); c.ellipse(W * 0.5, H * 0.48, W * 0.2, H * 0.12, -0.3, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(W * 0.62, H * 0.42); c.quadraticCurveTo(W * 0.78, H * 0.12, W * 0.6, H * 0.14); c.stroke(); c.fillStyle = '#22203a'; c.fillRect(W * 0.55, H * 0.15, W * 0.06, H * 0.03); c.fillStyle = '#2f9f6a'; for (let i = 0; i < 5; i++) c.fillRect(W * (0.1 + i * 0.18), H * 0.85, W * 0.03, H * 0.15); },
};
P.palm = (c, x, y, h) => { c.strokeStyle = '#1b0f30'; c.lineWidth = h * 0.06; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + h * 0.1, y - h * 0.5, x + h * 0.05, y - h); c.stroke(); c.fillStyle = '#1b0f30'; for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * 0.55; c.beginPath(); c.ellipse(x + h * 0.05 + Math.cos(a) * h * 0.25, y - h + Math.sin(a) * h * 0.18, h * 0.28, h * 0.05, a, 0, 6.3); c.fill(); } };

// ---- the Sunset Strip Diner --------------------------------------------------------------------------
function buildDiner(room) {
  const g = [], B = room.boards = boards(1024), HX = 7, HZ = 5, H = 4;
  shell(g, HX, HZ, H, '#e6ddd0', '#22203a', ['#f2a8bc', '#ee9eb4', '#f4bca8'], '#d8c4bc', '#ff6a3d');
  // teal wainscot with a chrome rail all round, a red stripe under the ceiling
  g.push(box(14, 1.1, 0.04, 0, 0.55, -4.97, '#2fbfb0'), box(0.04, 1.1, 10, -6.97, 0.55, 0, '#2fbfb0'), box(0.04, 1.1, 10, 6.97, 0.55, 0, '#2fbfb0'),
    box(6.1, 1.1, 0.04, -3.95, 0.55, 4.97, '#2fbfb0'), box(6.1, 1.1, 0.04, 3.95, 0.55, 4.97, '#2fbfb0'),
    box(14, 0.06, 0.08, 0, 1.12, -4.95, CHROME), box(0.08, 0.06, 10, -6.95, 1.12, 0, CHROME), box(0.08, 0.06, 10, 6.95, 1.12, 0, CHROME),
    box(14, 0.14, 0.04, 0, 3.75, -4.97, '#ff3f5a'), box(0.04, 0.14, 10, -6.97, 3.75, 0, '#ff3f5a'), box(0.04, 0.14, 10, 6.97, 3.75, 0, '#ff3f5a'));
  // the counter: pink front with chrome ribs, a white top with a chrome edge, six red stools (a gap to order)
  g.push(box(7.4, 1.0, 0.8, -1.5, 0.5, -2.6, '#ff6a8a'), box(7.6, 0.07, 1.0, -1.5, 1.04, -2.6, '#f6f1e7'), box(7.62, 0.04, 1.02, -1.5, 1.0, -2.6, CHROME),
    box(7.4, 0.12, 0.82, -1.5, 0.06, -2.6, BLK));
  for (const y of [0.3, 0.55, 0.8]) g.push(box(7.42, 0.04, 0.04, -1.5, y, -2.19, CHROME));
  const STOOLS = [-4.8, -3.6, -2.4, -0.4, 0.8, 2.0];
  for (const x of STOOLS) stool(g, x, -1.7, '#ff3f5a');
  // on the counter: a pie case, napkins, sauces, sugar, the register at the end
  g.push(cyl(0.32, 0.34, 0.04, 14, -4.2, 1.1, -2.6, CHROME), cyl(0.3, 0.3, 0.32, 14, -4.2, 1.28, -2.6, '#d8f4f2'), cyl(0.05, 0.3, 0.12, 14, -4.2, 1.5, -2.6, '#e8fbfa'));
  for (let k = 0; k < 4; k++) { const a = k * 1.4; g.push(box(0.16, 0.08, 0.1, -4.2 + Math.cos(a) * 0.14, 1.17, -2.6 + Math.sin(a) * 0.14, k % 2 ? '#c8f06a' : '#ffe9a8', 0, -a)); }
  for (const x of [-3.0, -1.0, 1.4]) g.push(box(0.14, 0.14, 0.08, x, 1.14, -2.5, CHROME), cyl(0.035, 0.04, 0.18, 8, x + 0.16, 1.16, -2.48, '#e8304a'), cyl(0.035, 0.04, 0.18, 8, x + 0.25, 1.16, -2.48, '#ffd23a'), cyl(0.05, 0.05, 0.12, 8, x - 0.18, 1.13, -2.5, '#f6f1e7'));
  g.push(box(0.5, 0.32, 0.42, 2.6, 1.24, -2.7, '#3a3550'), box(0.42, 0.1, 0.2, 2.6, 1.43, -2.55, '#8dff5a'), box(0.46, 0.06, 0.3, 2.6, 1.1, -2.4, '#c9c0d8'));
  // the back counter: a coffee station, a milkshake mixer, cake stand, stacked cups
  g.push(box(9.6, 0.95, 0.7, -2.2, 0.475, -4.6, '#c9c9d6'), box(9.7, 0.05, 0.75, -2.2, 0.97, -4.6, '#f6f1e7'));
  g.push(box(0.7, 0.6, 0.45, -5.2, 1.3, -4.65, '#3a3550'), cyl(0.12, 0.14, 0.22, 10, -5.38, 1.1, -4.45, '#c87a3a'), cyl(0.12, 0.14, 0.22, 10, -5.02, 1.1, -4.45, '#7a3a1a'), box(0.7, 0.06, 0.06, -5.2, 1.55, -4.42, '#ff6a3d'));
  g.push(box(0.36, 0.5, 0.3, -3.6, 1.25, -4.65, '#5fd3a6'), cyl(0.07, 0.06, 0.2, 8, -3.6, 1.12, -4.45, CHROME), cyl(0.07, 0.06, 0.2, 8, -3.35, 1.1, -4.45, CHROME));
  g.push(cyl(0.22, 0.2, 0.03, 12, -1.8, 1.25, -4.6, CHROME), cyl(0.03, 0.03, 0.25, 6, -1.8, 1.1, -4.6, CHROME), cyl(0.18, 0.2, 0.16, 12, -1.8, 1.35, -4.6, '#ffb0c8'), cyl(0.18, 0.18, 0.03, 12, -1.8, 1.44, -4.6, '#fff6ec'));
  for (let i = 0; i < 4; i++) g.push(cyl(0.06, 0.05, 0.09, 8, -0.4 + i * 0.16, 1.02 + 0.045, -4.55, '#fff6ec'), cyl(0.06, 0.05, 0.09, 8, -0.32 + i * 0.16, 1.11 + 0.045, -4.55, '#fff6ec'));
  // the kitchen pass: an opening with a steel shelf, heat lamps, an order wheel and the ORDER UP bell
  g.push(box(2.8, 0.08, 0.5, 4.6, 1.3, -4.75, '#c9c9d6'), box(2.9, 0.1, 0.1, 4.6, 2.62, -4.9, CHROME), box(0.1, 1.42, 0.1, 3.2, 1.95, -4.9, CHROME), box(0.1, 1.42, 0.1, 6.0, 1.95, -4.9, CHROME));
  for (const x of [3.9, 4.6, 5.3]) g.push(box(0.4, 0.08, 0.16, x, 2.5, -4.75, '#3a3550'), box(0.36, 0.03, 0.12, x, 2.45, -4.75, '#ff6a3d'));
  g.push(cyl(0.06, 0.08, 0.06, 10, 5.6, 1.37, -4.65, GOLD), cyl(0.02, 0.02, 0.05, 6, 5.6, 1.42, -4.65, GOLD), cyl(0.25, 0.25, 0.04, 12, 3.7, 2.3, -4.88, CHROME, PI / 2));
  for (const [x, w] of [[4.2, 0.14], [4.7, 0.18], [5.2, 0.16]]) g.push(box(w, 0.06, 0.03, x, 1.37, -4.62, '#e8dcc8'));
  g.push(box(4.2, 0.95, 0.7, 4.9, 0.475, -4.6, '#c9c9d6'), box(4.3, 0.05, 0.75, 4.9, 0.97, -4.6, '#f6f1e7'));
  B.add(2.6, 1.25, 4.6, 1.95, -4.95, 0, (c, W, Hh) => {
    P.grad(c, W, Hh, '#2a2a38', '#4a4a5a'); c.fillStyle = '#8a8a9a'; for (let x = 0; x < W; x += W / 8) c.fillRect(x, 0, 2, Hh);
    c.fillStyle = '#c9c9d6'; c.fillRect(0, Hh * 0.55, W, Hh * 0.06); c.fillStyle = '#ff6a3d'; c.filter = 'blur(6px)'; c.fillRect(W * 0.1, Hh * 0.8, W * 0.35, Hh * 0.12); c.fillStyle = '#ffd447'; c.fillRect(W * 0.18, Hh * 0.76, W * 0.2, Hh * 0.08); c.filter = 'none';
    c.fillStyle = '#e8e8f0'; for (let i = 0; i < 4; i++) c.fillRect(W * (0.55 + i * 0.1), Hh * 0.68, W * 0.07, Hh * 0.18);
    c.fillStyle = '#fff6ec'; for (let i = 0; i < 5; i++) { c.save(); c.translate(W * (0.12 + i * 0.17), Hh * 0.1); c.rotate((i - 2) * 0.06); c.fillRect(0, 0, W * 0.1, Hh * 0.3); c.fillStyle = '#22203a'; for (let l = 0; l < 4; l++) c.fillRect(W * 0.01, Hh * (0.05 + l * 0.06), W * 0.07, 2); c.restore(); c.fillStyle = '#fff6ec'; }
  });
  // the big menu board over the back counter, and a clock
  B.add(5.8, 1.35, -2.4, 2.95, -4.96, 0, (c, W, Hh) => {
    P.fill(c, W, Hh, '#1b1830'); P.frame(c, W, Hh, '#ff6a3d', 6); P.frame(c, W, Hh, '#ffe14a', 2);
    P.text(c, 'SUNSET STRIP', W * 0.5, Hh * 0.13, Hh * 0.13, '#ff6a3d', { italic: true, glow: 10 });
    const L = [['SUNRISE STACK', '10.00'], ['STRIP BURGER & FRIES', '16.00'], ['THE BLUE PLATE', '24.00'], ['KEY LIME SLICE', '6.00']], R = [['BOTTOMLESS COFFEE', '2.00'], ['MALTED SHAKE', '4.50'], ['CHILI CHEESE FRIES', '5.00'], ['DOT\'S DAILY SOUP', '3.50']];
    for (const [col, list] of [[0, L], [1, R]]) list.forEach(([a, b], i) => { const x0 = W * (0.05 + col * 0.5), y = Hh * (0.36 + i * 0.16); P.text(c, a, x0, y, Hh * 0.085, '#fff6ec', { align: 'left', weight: 800 }); P.text(c, b, x0 + W * 0.42, y, Hh * 0.085, '#7fffd0', { align: 'right', weight: 800 }); });
  }, 100);
  B.add(0.6, 0.6, 1.4, 3.05, -4.96, 0, (c, W, Hh) => { c.clearRect(0, 0, W, Hh); c.fillStyle = '#fff6ec'; c.beginPath(); c.arc(W / 2, Hh / 2, W * 0.47, 0, 6.3); c.fill(); c.strokeStyle = '#ff3f5a'; c.lineWidth = W * 0.06; c.stroke(); c.strokeStyle = '#22203a'; c.lineWidth = W * 0.04; c.beginPath(); c.moveTo(W / 2, Hh / 2); c.lineTo(W * 0.5, Hh * 0.18); c.moveTo(W / 2, Hh / 2); c.lineTo(W * 0.72, Hh * 0.55); c.stroke(); for (let i = 0; i < 12; i++) { const a = i * PI / 6; c.fillRect(W / 2 + Math.cos(a) * W * 0.38 - 2, Hh / 2 + Math.sin(a) * W * 0.38 - 2, 4, 4); } });
  // booths along the right wall: red vinyl benches facing over a table, a fake window above each
  const seats = STOOLS.map((x) => ({ x, z: -1.7, y: 0.83, yaw: PI, kind: 'stool' })), blocks = [];
  for (const cz of [-2.6, 0.2, 3.0]) {
    for (const s of [-1, 1]) {
      const z = cz + s * 0.85;
      g.push(box(1.5, 0.42, 0.55, 5.85, 0.21, z, '#c41a3a'), box(1.5, 0.1, 0.55, 5.85, 0.47, z, '#ff3f5a'), box(1.5, 1.25, 0.2, 5.85, 0.62, cz + s * 1.2, '#c41a3a'),
        box(1.52, 0.14, 0.26, 5.85, 1.27, cz + s * 1.2, '#ff3f5a'), box(1.5, 0.04, 0.03, 5.85, 0.9, cz + s * 1.09, CHROME));
      seats.push({ x: 5.7, z: cz + s * 0.8, y: 0.5, yaw: s < 0 ? 0 : PI, kind: 'booth' });
    }
    g.push(box(1.35, 0.06, 0.8, 5.95, 0.76, cz, '#f6f1e7'), box(1.37, 0.03, 0.82, 5.95, 0.73, cz, CHROME), cyl(0.06, 0.1, 0.72, 8, 5.95, 0.36, cz, CHROME), cyl(0.3, 0.3, 0.03, 10, 5.95, 0.015, cz, CHROME),
      box(0.18, 0.22, 0.14, 6.6, 0.9, cz, CHROME), box(0.14, 0.12, 0.02, 6.6, 0.95, cz - 0.075, '#ffe14a'), cyl(0.045, 0.04, 0.14, 8, 5.7, 0.86, cz + 0.2, '#ff8fc4'), cyl(0.045, 0.04, 0.12, 8, 6.1, 0.85, cz - 0.15, '#7a3a1a'));
    g.push(box(0.04, 1.3, 1.8, 6.95, 2.15, cz, CHROME));
    B.add(1.7, 1.2, 6.92, 2.15, cz, -PI / 2, (c, W, Hh) => {
      P.grad(c, W, Hh, '#3a1060', '#ff7a6a'); c.fillStyle = '#ffd447'; c.beginPath(); c.arc(W * 0.6, Hh * 0.72, Hh * 0.2, PI, 0); c.fill();
      c.fillStyle = '#1b0f30'; c.fillRect(0, Hh * 0.72, W, Hh); P.palm(c, W * 0.2, Hh * 0.74, Hh * 0.55); c.fillStyle = '#ff2bd1'; c.fillRect(W * 0.55, Hh * 0.8, W * 0.3, Hh * 0.04); c.fillStyle = '#18f0ff'; c.fillRect(W * 0.1, Hh * 0.88, W * 0.25, Hh * 0.03);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(W * 0.08, 0, W * 0.05, Hh); c.fillRect(W * 0.18, 0, W * 0.02, Hh); P.frame(c, W, Hh, '#e6e6f0', 5); c.fillStyle = '#e6e6f0'; c.fillRect(W / 2 - 3, 0, 6, Hh);
    });
    blocks.push({ x0: 5.0, x1: 7, z0: cz - 1.32, z1: cz + 1.32 });
  }
  // the jukebox on the left wall (its glow is its own mesh, see below) and framed pictures
  put(g, [box(1.1, 1.3, 0.75, 0, 0.65, 0, '#c41a3a'), cyl(0.55, 0.55, 0.75, 16, 0, 1.3, 0, '#c41a3a', PI / 2), box(0.9, 0.5, 0.02, 0, 0.9, 0.38, '#2a2140'),
    box(0.7, 0.32, 0.03, 0, 1.38, 0.38, '#fff6ec'), box(0.95, 0.05, 0.05, 0, 0.62, 0.39, CHROME), box(0.95, 0.05, 0.05, 0, 0.3, 0.39, CHROME), box(0.3, 0.12, 0.03, 0, 0.45, 0.39, '#ffd447')], -6.55, 1.0, PI / 2);
  const juke = pulser([...[-0.45, 0.45].map((lz) => box(0.04, 1.25, 0.08, -6.15, 0.75, 1.0 + lz, '#ffffff')), cyl(0.5, 0.5, 0.05, 16, -6.16, 1.3, 1.0, '#ffffff', 0, PI / 2),
    box(0.04, 0.08, 0.95, -6.15, 0.18, 1.0, '#ffffff')], 'rainbow');
  juke.material.color.setHSL(0, 0.8, 0.6);
  room.extras.push(juke);
  let jukeH = 0;
  room.setJuke = (i) => { jukeH = i * 0.23; };
  const jt = juke.userData.tick; juke.userData.tick = (t, still) => { if (still) { juke.material.color.setHSL(jukeH % 1, 0.75, 0.62); return; } juke.material.color.setHSL((t * 0.08 + jukeH) % 1, 0.75, 0.62); void jt; };
  picture(g, B, -6.95, 2.4, -2.6, PI / 2, 1.3, 0.9, CHROME, ART.car);
  picture(g, B, -6.95, 2.4, 3.2, PI / 2, 1.0, 0.75, CHROME, ART.wave);
  // EAT in red neon on the left wall: it flickers now and then
  const eat = [], E = (x0, y0, x1, y1) => eat.push(box(0.06, Math.abs(y1 - y0) + 0.07, Math.abs(x1 - x0) + 0.07, -6.9, (y0 + y1) / 2, (x0 + x1) / 2, '#ff3f5a'));
  const ex = -0.9, ey = 3.0;
  E(ex - 0.5, ey - 0.3, ex - 0.5, ey + 0.3); E(ex - 0.5, ey + 0.3, ex - 0.15, ey + 0.3); E(ex - 0.5, ey, ex - 0.2, ey); E(ex - 0.5, ey - 0.3, ex - 0.15, ey - 0.3);
  E(ex, ey - 0.3, ex + 0.17, ey + 0.3); E(ex + 0.34, ey - 0.3, ex + 0.17, ey + 0.3); E(ex + 0.08, ey - 0.05, ex + 0.26, ey - 0.05);
  E(ex + 0.5, ey + 0.3, ex + 0.9, ey + 0.3); E(ex + 0.7, ey - 0.3, ex + 0.7, ey + 0.3);
  const eatM = pulser(eat, 'flicker', 7);
  room.extras.push(eatM);
  // a seat-yourself sign, a gumball machine, plants, ceiling fans and globe pendants over the counter
  g.push(cyl(0.03, 0.03, 1.2, 6, 1.9, 0.6, 3.5, CHROME), cyl(0.2, 0.22, 0.04, 10, 1.9, 0.02, 3.5, CHROME));
  B.add(0.7, 0.5, 1.9, 1.35, 3.53, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#fff6ec'); P.frame(c, W, Hh, '#ff3f5a', 5); P.text(c, 'PLEASE', W / 2, Hh * 0.25, Hh * 0.17, '#22203a'); P.text(c, 'SEAT', W / 2, Hh * 0.5, Hh * 0.24, '#ff3f5a', { italic: true }); P.text(c, 'YOURSELF', W / 2, Hh * 0.77, Hh * 0.17, '#22203a'); });
  g.push(cyl(0.16, 0.2, 0.7, 10, -5.6, 0.35, 3.6, '#c41a3a'), cyl(0.24, 0.24, 0.5, 14, -5.6, 0.95, 3.6, '#d8f4f2'), cyl(0.1, 0.12, 0.1, 10, -5.6, 1.25, 3.6, '#c41a3a'));
  for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = 0.06 + (i % 3) * 0.05; g.push(box(0.06, 0.06, 0.06, -5.6 + Math.cos(a) * rr, 0.78 + (i % 5) * 0.07, 3.6 + Math.sin(a) * rr, NEON[i % 6])); }
  plant(g, -6.4, 4.4, 1.1, '#ff6a8a', '#2f9f6a', 0); plant(g, 6.45, -4.5, 1, '#2fbfb0', '#3faf6a', 1);
  const fans = [fan(g, -2.2, 1.2, H), fan(g, 3.2, 0.9, H)];
  room.extras.push(...fans);
  const pools = room.pools, hi = room.hiPools;
  for (const x of [-4.2, -1.4, 1.4]) {
    g.push(cyl(0.012, 0.012, 0.9, 4, x, H - 0.45, -2.6, CHROME), cyl(0.2, 0.2, 0.3, 12, x, H - 1.05, -2.6, '#fff3c4'), cyl(0.08, 0.08, 0.05, 8, x, H - 0.88, -2.6, CHROME));
    pools.push(disc(x, 1.085, -2.6, 0.75, '#ffd9a0', 0.8), disc(x, 0.012, -1.8, 1.4, '#ffc890', 0.45));
    hi.push(cone(x, H - 1.2, -2.6, 0.18, 0.8, 1.7, '#ffe0b0', 0.35));
  }
  for (const cz of [-2.6, 0.2, 3.0]) { g.push(box(0.1, 0.3, 0.2, 6.9, 3.0, cz, CHROME), box(0.2, 0.2, 0.3, 6.8, 2.9, cz, '#fff3c4')); pools.push(disc(5.95, 0.8, cz, 0.7, '#ffb0c0', 0.5)); }
  pools.push(disc(-5.9, 0.012, 1.0, 1.5, '#ff60c0', 0.55), disc(4.6, 1.35, -4.7, 1.1, '#ff8a3d', 0.6), disc(-0.9, 3.0, -4.95, 1.6, '#ff3f5a', 0.35, 'z'));
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, clerk: 'DOT', rim: '#4a2a3a', amb: 0.5, ambCol: '#ffe8f0',
    lights: [{ x: -4.2, y: 2.8, z: -2.6, hex: '#ffd9a0', r: 5.5, k: 0.8 }, { x: -1.4, y: 2.8, z: -2.6, hex: '#ffd9a0', r: 5.5, k: 0.8 }, { x: 1.4, y: 2.8, z: -2.6, hex: '#ffd9a0', r: 5.5, k: 0.8 }, { x: 0, y: 3.2, z: 2.5, hex: '#ffd0c0', r: 6, k: 0.35 },
      { x: 6.4, y: 2.6, z: 0.2, hex: '#ffb0c0', r: 6, k: 0.5 }, { x: -6, y: 1.2, z: 1, hex: '#ff60c0', r: 3.5, k: 0.7 }, { x: 4.6, y: 2.2, z: -4.6, hex: '#ffa040', r: 3.5, k: 0.6 }],
    blocks: [{ x0: -7, x1: 2.75, z0: -5, z1: -2.15 }, { x0: 2.75, x1: 7, z0: -5, z1: -4.2 }, ...blocks, { x0: -7, x1: -6.0, z0: 0.35, z1: 1.65 }, { x0: -5.9, x1: -5.3, z0: 3.3, z1: 3.9 }, { x0: -7, x1: -6.0, z0: 4.0, z1: 5 }, { x0: 1.7, x1: 2.1, z0: 3.3, z1: 3.7 }],
    seats, me: [-1.4, -0.9], cast: { DOT: [-1.4, -3.55, 0] },
    uses: [{ x: -1.4, z: -1.45, r: 1.3, kind: 'diner', hint: 'order a meal from Dot', clerk: 'DOT' }, { x: -5.4, z: 1.0, r: 1.2, kind: 'jukebox', hint: 'play the jukebox' }],
    wide: [5.2, 2.8, 4.3, -1.5, 1.2, -2.5],
    idle(t, dt, still) {
      const d = room.npc.DOT, k = still ? 0.3 : 1;
      d.armR.rotation.set(-1.0, 0, -0.25 + Math.sin(t * 4) * 0.3 * k); d.armL.rotation.set(-0.5, 0, 0.1); d.head.rotation.y = Math.sin(t * 0.6) * 0.3 * k;
      for (const f of fans) f.rotation.y += dt * (still ? 0.6 : 2.4);
      juke.userData.tick(t, still);
      eatM.userData.tick(t, still);
    },
  });
}

// ---- the Seahorse Arcade -------------------------------------------------------------------------------
const CABS = [['COMET CRASH', '#ff2bd1', '#18f0ff'], ['TURBO TIDE', '#18f0ff', '#ffe14a'], ['PIXEL PELICAN', '#ffe14a', '#ff6a3d'], ['LASER LAGOON', '#8dff5a', '#ff2bd1'],
  ['MEGA MANATEE', '#b388ff', '#8dff5a'], ['DISCO DRAGON', '#ff6a3d', '#b388ff'], ['SYNTH RACER', '#18f0ff', '#ff2bd1'], ['SPACE SURF', '#ffe14a', '#18f0ff']];
function screenArt(c, W, H, i, A, Bc) {
  const r = rng(i * 31 + 5);
  P.fill(c, W, H, '#0a0820');
  if (i % 4 === 0) { for (let k = 0; k < 30; k++) { c.fillStyle = '#fff'; c.fillRect(r() * W, r() * H, 2, 2); } c.fillStyle = A; c.beginPath(); c.moveTo(W / 2, H * 0.7); c.lineTo(W * 0.42, H * 0.85); c.lineTo(W * 0.58, H * 0.85); c.fill(); for (let k = 0; k < 6; k++) { c.fillStyle = Bc; c.fillRect(W * (0.1 + k * 0.14), H * 0.2, W * 0.08, H * 0.06); } }
  else if (i % 4 === 1) { c.fillStyle = '#18406a'; c.fillRect(0, H * 0.5, W, H); c.fillStyle = A; for (let k = 0; k < 5; k++) c.fillRect(0, H * (0.5 + k * 0.1), W, 2); c.fillStyle = Bc; c.fillRect(W * 0.4, H * 0.6, W * 0.2, H * 0.08); c.fillStyle = '#ff6a3d'; c.beginPath(); c.arc(W / 2, H * 0.32, H * 0.14, 0, 6.3); c.fill(); }
  else if (i % 4 === 2) { for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) if (r() < 0.55) { c.fillStyle = NEON[Math.floor(r() * 6)]; c.fillRect(W * (0.08 + x * 0.14), H * (0.08 + y * 0.09), W * 0.12, H * 0.07); } c.fillStyle = '#fff'; c.fillRect(W * 0.4, H * 0.9, W * 0.2, H * 0.03); }
  else { c.strokeStyle = A; c.lineWidth = 2; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(W / 2, H * 0.4); c.lineTo(W * (k / 7), H); c.stroke(); } c.fillStyle = Bc; c.fillRect(W * 0.42, H * 0.7, W * 0.16, H * 0.1); P.grad(c, W, H * 0.4, '#ff2bd1', '#2a0f4a'); }
  c.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  P.text(c, `1UP ${String(Math.floor(r() * 90000)).padStart(5, '0')}`, W * 0.05, H * 0.05, H * 0.07, '#fff', { align: 'left', font: 'monospace' });
}
function cabinet(g, B, x, z, ry, i, glowEdges) {
  const [name, A, Bc] = CABS[i % CABS.length];
  put(g, [box(0.84, 1.8, 0.8, 0, 0.9, 0, shadeHex(A, 0.45)), box(0.86, 0.1, 0.82, 0, 1.8, 0, BLK), box(0.03, 1.5, 0.6, 0.43, 0.95, 0, A), box(0.03, 1.5, 0.6, -0.43, 0.95, 0, A),
    box(0.72, 0.9, 0.02, 0, 0.47, 0.405, '#22203a'), box(0.22, 0.26, 0.02, 0, 0.56, 0.42, CHROME), box(0.04, 0.06, 0.01, -0.05, 0.6, 0.432, '#ff3f5a'), box(0.04, 0.06, 0.01, 0.05, 0.6, 0.432, '#ff3f5a'),
    box(0.84, 0.1, 0.36, 0, 1.0, 0.52, BLK, -0.22), cyl(0.015, 0.015, 0.12, 6, -0.18, 1.12, 0.52, '#c9c0d8'), cyl(0.04, 0.04, 0.04, 8, -0.18, 1.19, 0.52, '#ff3f5a'),
    cyl(0.035, 0.035, 0.03, 8, 0.06, 1.08, 0.55, A), cyl(0.035, 0.035, 0.03, 8, 0.16, 1.08, 0.52, Bc), cyl(0.035, 0.035, 0.03, 8, 0.26, 1.08, 0.49, '#fff6ec'),
    box(0.76, 0.64, 0.05, 0, 1.45, 0.38, '#0c0a14'), box(0.84, 0.3, 0.32, 0, 1.96, 0.25, '#fff6ec')], x, z, ry);
  bAt(B, x, z, ry, 0, 1.45, 0.41, 0.62, 0.5, (c, W, H) => screenArt(c, W, H, i, A, Bc), 140);
  bAt(B, x, z, ry, 0, 1.96, 0.415, 0.82, 0.26, (c, W, H) => { P.grad(c, W, H, shadeHex(A, 0.35), '#0c0a20'); P.text(c, name, W / 2, H / 2, H * 0.48, A, { italic: true, glow: 10, max: W * 0.92 }); }, 160);
  const [gx, , gz] = loc(x, z, ry, 0, 0, 0.42);
  glowEdges.push(...[box(0.66, 0.025, 0.02, 0, 1.75, 0.42, '#ffffff'), box(0.66, 0.025, 0.02, 0, 1.15, 0.42, '#ffffff')].map((q) => { q.rotateY(ry); q.translate(x, 0, z); return tint(q, A); }));
  return [gx, gz, A];
}
function buildArcade(room) {
  const g = [], B = room.boards = boards(1024), HX = 6.5, HZ = 5, H = 3.8, pools = room.pools, hi = room.hiPools;
  shell(g, HX, HZ, H, '#1a1238', '#140e2c', ['#1b1440', '#1b1440', '#211848'], '#0c0820', '#ffe14a');
  // the cosmic carpet: one painted board over the whole floor
  B.add(HX * 2, HZ * 2, 0, 0.004, 0, 0, (c, W, Hh) => {
    const r = rng(9); P.fill(c, W, Hh, '#120c30');
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = r() * Hh, k = r(), col = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#b388ff'][Math.floor(r() * 5)];
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
      if (k < 0.3) { c.beginPath(); c.moveTo(x, y); for (let s = 1; s < 5; s++) c.lineTo(x + s * 6, y + (s % 2 ? -6 : 6)); c.stroke(); }
      else if (k < 0.55) { c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y + 5); c.lineTo(x - 6, y + 5); c.closePath(); c.stroke(); }
      else if (k < 0.75) { c.beginPath(); c.arc(x, y, 4 + r() * 4, 0, 6.3); c.stroke(); }
      else c.fillRect(x, y, 2, 2);
    }
  }, 40, -PI / 2);
  // neon grid on the ceiling, a star field
  for (let i = -2; i <= 2; i++) g.push(box(12.6, 0.04, 0.04, 0, H - 0.04, i * 1.9, i % 2 ? '#18f0ff' : '#ff2bd1'));
  for (let i = -3; i <= 3; i++) g.push(box(0.04, 0.04, 9.6, i * 1.8, H - 0.05, 0, '#3a2a7a'));
  // cabinets: four down each side, the Skate Surge cabinet on the back wall between two pinball tables
  const edges = [], spots = [];
  [-3.4, -2.2, -1.0, 0.2].forEach((z, i) => { spots.push(cabinet(g, B, -6.05, z, PI / 2, i, edges)); spots.push(cabinet(g, B, 6.05, z, -PI / 2, i + 4, edges)); });
  // Skate Surge: bigger, pink chrome, a live screen (the venue canvas)
  g.push(box(1.1, 2.05, 0.9, 0, 1.025, -4.5, '#4a1050'), box(0.04, 1.8, 0.7, 0.56, 1.05, -4.45, '#ff2bd1'), box(0.04, 1.8, 0.7, -0.56, 1.05, -4.45, '#ff2bd1'),
    box(0.92, 0.95, 0.02, 0, 0.5, -4.04, '#22203a'), box(0.26, 0.3, 0.02, 0, 0.58, -4.02, CHROME), box(1.1, 0.12, 0.42, 0, 1.06, -3.9, BLK, -0.22),
    cyl(0.015, 0.015, 0.14, 6, -0.25, 1.18, -3.9, '#c9c0d8'), cyl(0.05, 0.05, 0.05, 8, -0.25, 1.26, -3.9, '#ff2bd1'), cyl(0.045, 0.045, 0.03, 8, 0.1, 1.13, -3.88, '#ffe14a'), cyl(0.045, 0.045, 0.03, 8, 0.25, 1.13, -3.9, '#18f0ff'),
    box(0.98, 0.84, 0.05, 0, 1.55, -4.08, '#0c0a14'), box(1.12, 0.36, 0.4, 0, 2.2, -4.25, '#fff6ec'));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ fog: false }));
  scr.position.set(0, 1.55, -4.05); scr.renderOrder = 1;
  const venues = room.game && room.game.venues;
  if (venues) { const tex = new THREE.CanvasTexture(venues.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; scr.material.map = tex; venues.screen(tex); }
  room.extras.push(scr);
  const marq = pulser([box(1.06, 0.3, 0.02, 0, 2.2, -4.04, '#ff2bd1')], 'pulse');
  room.extras.push(marq);
  B.add(1.0, 0.27, 0, 2.2, -4.025, 0, (c, W, Hh) => { c.clearRect(0, 0, W, Hh); P.text(c, 'SKATE SURGE', W / 2, Hh / 2, Hh * 0.6, '#ffe14a', { italic: true, glow: 12, max: W * 0.95 }); }, 180);
  for (const sx of [-1, 1]) {
    const x = sx * 2.1, c0 = sx < 0 ? '#18f0ff' : '#ffe14a';
    g.push(box(0.75, 0.22, 1.4, x, 0.95, -4.0, '#2a1a5a', 0.1), box(0.72, 0.02, 1.34, x, 1.07, -4.0, c0, 0.1), box(0.78, 0.04, 1.42, x, 0.84, -4.0, CHROME, 0.1));
    for (const [lx, lz] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) g.push(box(0.06, 0.85, 0.06, x + lx, 0.42, -4.0 + lz, CHROME));
    for (let k = 0; k < 3; k++) g.push(cyl(0.07, 0.07, 0.08, 10, x - 0.15 + k * 0.15, 1.12 + (k % 2) * 0.02, -4.2 + k * 0.1, NEON[(k + (sx > 0 ? 2 : 0)) % 6]));
    g.push(box(0.75, 0.75, 0.14, x, 1.6, -4.66, '#2a1a5a'));
    B.add(0.68, 0.62, x, 1.6, -4.585, 0, (c, W, Hh) => { P.grad(c, W, Hh, sx < 0 ? '#18406a' : '#5a1a4a', '#0a0820'); P.text(c, sx < 0 ? 'WAVE' : 'GATOR', W / 2, Hh * 0.35, Hh * 0.22, c0, { italic: true, glow: 8 }); P.text(c, sx < 0 ? 'WIZARD' : 'GOLF', W / 2, Hh * 0.62, Hh * 0.22, '#fff6ec', { italic: true }); P.frame(c, W, Hh, c0, 4); });
    spots.push([x, -3.0, c0]);
  }
  // air hockey in the middle, a change machine, the token counter with Token behind it
  g.push(box(1.3, 0.75, 2.3, 0, 0.375, -0.3, '#2a1a5a'), box(1.3, 0.04, 2.3, 0, 0.77, -0.3, '#eaf8ff'), box(1.36, 0.1, 0.06, 0, 0.8, 0.86, '#ff2bd1'), box(1.36, 0.1, 0.06, 0, 0.8, -1.46, '#18f0ff'),
    box(0.06, 0.1, 2.36, 0.68, 0.8, -0.3, '#b388ff'), box(0.06, 0.1, 2.36, -0.68, 0.8, -0.3, '#b388ff'), box(1.28, 0.005, 0.02, 0, 0.795, -0.3, '#ff2bd1'),
    cyl(0.07, 0.07, 0.03, 12, 0.1, 0.8, 0.3, '#ff3f5a'), cyl(0.1, 0.1, 0.06, 12, -0.2, 0.82, 0.6, '#ffe14a'), cyl(0.1, 0.1, 0.06, 12, 0.25, 0.82, -1.2, '#18f0ff'));
  g.push(box(0.5, 1.3, 0.4, -6.25, 0.65, 3.6, CHROME), box(0.02, 0.3, 0.26, -6.0, 1.0, 3.6, '#22203a'), box(0.02, 0.1, 0.2, -6.0, 0.4, 3.6, '#ffe14a'));
  B.add(0.36, 0.2, -5.99, 1.25, 3.6, PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#1b1830'); P.text(c, 'CHANGE', W / 2, Hh / 2, Hh * 0.55, '#8dff5a', { glow: 6 }); });
  g.push(box(0.8, 1.05, 2.3, 4.9, 0.525, 3.1, '#3a2a7a'), box(0.95, 0.06, 2.4, 4.9, 1.08, 3.1, '#ffe14a'), box(0.82, 0.06, 2.32, 4.9, 0.2, 3.1, '#ff2bd1'),
    box(0.4, 0.3, 0.35, 4.85, 1.26, 2.5, BLK), box(0.3, 0.14, 0.02, 4.66, 1.32, 2.5, '#8dff5a'), cyl(0.12, 0.1, 0.18, 10, 4.9, 1.2, 3.6, '#ffd166'));
  for (let i = 0; i < 6; i++) g.push(cyl(0.035, 0.035, 0.012, 10, 4.85 + (i % 3) * 0.05, 1.12 + Math.floor(i / 3) * 0.015, 3.3, GOLD));
  B.add(2.3, 1.1, 6.47, 2.3, 3.1, -PI / 2, (c, W, Hh) => {
    P.fill(c, W, Hh, '#1b1440'); P.frame(c, W, Hh, '#ffe14a', 5);
    P.text(c, 'TOKENS', W / 2, Hh * 0.2, Hh * 0.2, '#ffe14a', { italic: true, glow: 10 }); P.text(c, '1 TOKEN · $1', W / 2, Hh * 0.45, Hh * 0.14, '#fff6ec');
    P.text(c, 'BEAT TOK ON SKATE SURGE', W / 2, Hh * 0.67, Hh * 0.1, '#18f0ff'); P.text(c, 'FOR ETERNAL GLORY*', W / 2, Hh * 0.82, Hh * 0.1, '#ff2bd1'); P.text(c, '*GLORY NOT REDEEMABLE FOR CASH', W / 2, Hh * 0.94, Hh * 0.05, '#9a8acb');
  });
  // posters, and the HIGH SCORE HEROES board by the door
  B.add(1.0, 1.4, -3.6, 2.2, -4.96, 0, (c, W, Hh) => { P.grad(c, W, Hh, '#ff2bd1', '#2a0f4a'); P.text(c, 'SKATE', W / 2, Hh * 0.2, Hh * 0.13, '#ffe14a', { italic: true, glow: 6 }); P.text(c, 'SURGE', W / 2, Hh * 0.33, Hh * 0.13, '#18f0ff', { italic: true, glow: 6 }); c.fillStyle = '#27e8ff'; c.fillRect(W * 0.42, Hh * 0.5, W * 0.16, Hh * 0.18); c.fillStyle = '#f1c9a5'; c.fillRect(W * 0.44, Hh * 0.42, W * 0.12, Hh * 0.08); c.fillStyle = '#ff8a3d'; c.beginPath(); c.moveTo(W * 0.2, Hh * 0.8); c.lineTo(W * 0.27, Hh * 0.68); c.lineTo(W * 0.34, Hh * 0.8); c.fill(); P.text(c, 'DODGE · GRAB · GLOW', W / 2, Hh * 0.9, Hh * 0.06, '#fff6ec'); });
  B.add(1.0, 1.4, 3.6, 2.2, -4.96, 0, (c, W, Hh) => { P.grad(c, W, Hh, '#18f0ff', '#1b1440'); P.text(c, 'LASER', W / 2, Hh * 0.2, Hh * 0.13, '#fff6ec', { italic: true, glow: 6 }); P.text(c, 'LAGOON', W / 2, Hh * 0.33, Hh * 0.13, '#8dff5a', { italic: true, glow: 6 }); c.strokeStyle = '#ff2bd1'; c.lineWidth = 3; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(W * 0.5, Hh * 0.45); c.lineTo(W * (0.1 + k * 0.2), Hh * 0.85); c.stroke(); } P.text(c, 'NOW WITH STEREO', W / 2, Hh * 0.92, Hh * 0.06, '#ffe14a'); });
  // light: every screen throws its colour on the carpet; Skate Surge throws pink
  for (const [x, z, c0] of spots) pools.push(disc(x, 0.012, z, 1.0, c0, 0.5));
  pools.push(disc(0, 0.012, -3.4, 1.7, '#ff2bd1', 0.6), disc(0, 1.55, -4.03, 0.7, '#ffb0ff', 0.25, 'z'), disc(4.9, 1.12, 3.1, 1.0, '#ffe14a', 0.4), disc(0, 0.8, -0.3, 1.4, '#b0e8ff', 0.35));
  for (let i = -2; i <= 2; i++) hi.push(cone(i * 2.4, H - 0.05, 1.9, 0.1, 0.9, 1.6, i % 2 ? '#18f0ff' : '#ff2bd1', 0.18));
  room.extras.push(pulser(edges, 'pulse', 4));
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#4a3a8a', amb: 0.5, ambCol: '#c8b8ff', clerk: 'TOKEN', screenAt: [0, 1.55, -4.05],
    lights: [...spots.map(([x, z, c0]) => ({ x, y: 1.4, z, hex: c0, r: 3.2, k: 0.7 })), { x: 0, y: 1.6, z: -3.6, hex: '#ff6ad8', r: 4.5, k: 0.9 }, { x: 4.9, y: 2.4, z: 3.1, hex: '#ffe0a0', r: 3.5, k: 0.6 }, { x: 0, y: 3, z: 0, hex: '#b0a0ff', r: 6, k: 0.4 }],
    blocks: [{ x0: -6.5, x1: -5.5, z0: -3.9, z1: 0.7 }, { x0: 5.5, x1: 6.5, z0: -3.9, z1: 0.7 }, { x0: -0.65, x1: 0.65, z0: -5, z1: -3.7 }, { x0: -2.55, x1: -1.65, z0: -5, z1: -3.25 }, { x0: 1.65, x1: 2.55, z0: -5, z1: -3.25 },
      { x0: -0.7, x1: 0.7, z0: -1.5, z1: 0.9 }, { x0: -6.5, x1: -6.0, z0: 3.35, z1: 3.85 }, { x0: 4.45, x1: 6.5, z0: 1.9, z1: 5 }],
    me: [0.9, 1.6], cast: { TOKEN: [5.85, 3.0, -PI / 2] },
    uses: [{ x: 0, z: -3.2, r: 1.2, kind: 'arcade', hint: 'play Skate Surge ($1)' }],
    wide: [-4.2, 2.6, 4.2, 0.5, 1.2, -2.5],
    idle(t, dt, still) {
      const n = room.npc.TOKEN, k = still ? 0.3 : 1;
      n.armR.rotation.set(-0.6 + Math.sin(t * 6) * 0.25 * k, 0, -0.2); n.armL.rotation.set(-0.4, 0, 0.15); n.head.rotation.y = Math.sin(t * 0.8) * 0.5 * k;
      for (const m of room.extras) if (m.userData.tick) m.userData.tick(t, still);
    },
  });
}

// ---- Moonlite Motor Inn, room 7 --------------------------------------------------------------------------
function buildMotel(room) {
  const g = [], B = room.boards = boards(1024), HX = 5, HZ = 4, H = 3.2, pools = room.pools, hi = room.hiPools;
  shell(g, HX, HZ, H, '#3f8a7a', '#3a8070', ['#f3e3b0', '#f0dca4', '#f3e3b0'], '#f4efe6', '#ff8fc4');
  // striped wallpaper, a wooden skirting board
  for (let x = -4.8; x < 5; x += 0.4) g.push(box(0.12, H - 0.3, 0.01, x, (H - 0.3) / 2 + 0.15, -3.99, '#e8cf90'));
  for (const sx of [-1, 1]) for (let z = -3.8; z < 4; z += 0.4) g.push(box(0.01, H - 0.3, 0.12, sx * 4.99, (H - 0.3) / 2 + 0.15, z, '#e8cf90'));
  g.push(box(10, 0.15, 0.03, 0, 0.075, -3.98, '#8a5a3a'), box(0.03, 0.15, 8, -4.98, 0.075, 0, '#8a5a3a'), box(0.03, 0.15, 8, 4.98, 0.075, 0, '#8a5a3a'));
  // the bed: a rattan headboard, a pink bedspread with yellow stripes, two pillows
  g.push(box(2.1, 1.2, 0.12, -0.8, 0.9, -3.92, '#b8844e'));
  for (let i = 0; i < 9; i++) g.push(box(0.03, 1.0, 0.13, -1.7 + i * 0.225, 0.9, -3.91, '#8a5a3a'));
  g.push(box(2.0, 0.35, 2.3, -0.8, 0.25, -2.75, '#8a5a3a'), box(1.92, 0.25, 2.22, -0.8, 0.55, -2.75, '#fff6ec'), box(1.98, 0.12, 1.7, -0.8, 0.72, -2.45, '#ff8fc4'),
    box(2.0, 0.42, 0.04, -0.8, 0.52, -1.58, '#ff8fc4'), box(1.98, 0.13, 0.25, -0.8, 0.74, -3.38, '#fff6ec'));
  for (let i = 0; i < 4; i++) g.push(box(1.99, 0.125, 0.1, -0.8, 0.725, -2.95 + i * 0.4, '#ffd447'));
  g.push(box(0.75, 0.16, 0.42, -1.25, 0.78, -3.62, '#fff6ec'), box(0.75, 0.16, 0.42, -0.35, 0.78, -3.62, '#fff6ec'));
  picture(g, B, -0.8, 2.25, -3.97, 0, 1.5, 0.85, '#d9b26a', ART.flamingo);
  // nightstands with lamps; a phone and a little bible-free notepad
  for (const x of [-2.3, 0.7]) {
    g.push(box(0.55, 0.55, 0.45, x, 0.275, -3.6, '#a8744e'), box(0.57, 0.04, 0.47, x, 0.57, -3.6, '#8a5a3a'), box(0.4, 0.02, 0.02, x, 0.4, -3.37, GOLD),
      cyl(0.08, 0.1, 0.28, 10, x, 0.73, -3.65, '#2fbfb0'), cyl(0.12, 0.2, 0.26, 12, x, 1.0, -3.65, '#fff3c4'));
    pools.push(disc(x, 0.6, -3.6, 0.55, '#ffd9a0', 0.7)); hi.push(cone(x, 0.9, -3.65, 0.18, 0.4, 0.3, '#ffe8c0', 0.4));
  }
  g.push(box(0.22, 0.08, 0.16, 0.85, 0.63, -3.55, '#ff3f5a'), box(0.2, 0.01, 0.15, -2.2, 0.6, -3.5, '#fff6ec'));
  // the dresser with a boxy TV (its screen flickers), an ice bucket, fresh towels
  g.push(box(0.6, 0.85, 1.9, 4.65, 0.425, -1.5, '#a8744e'), box(0.62, 0.04, 1.92, 4.65, 0.87, -1.5, '#8a5a3a'));
  for (let i = 0; i < 3; i++) g.push(box(0.02, 0.22, 0.85, 4.34, 0.2 + i * 0.25, -1.95, '#c8945e'), box(0.02, 0.22, 0.85, 4.34, 0.2 + i * 0.25, -1.05, '#c8945e'), box(0.03, 0.03, 0.12, 4.32, 0.22 + i * 0.25, -1.95, GOLD), box(0.03, 0.03, 0.12, 4.32, 0.22 + i * 0.25, -1.05, GOLD));
  g.push(box(0.6, 0.55, 0.72, 4.6, 1.17, -1.9, '#5a4a3a'), box(0.03, 0.42, 0.5, 4.29, 1.18, -1.95, '#1b2a2a'), cyl(0.008, 0.008, 0.5, 4, 4.6, 1.6, -1.7, CHROME, 0, 0.5), cyl(0.008, 0.008, 0.5, 4, 4.6, 1.6, -2.1, CHROME, 0, -0.5),
    cyl(0.12, 0.1, 0.2, 10, 4.6, 0.99, -0.9, CHROME), box(0.4, 0.06, 0.3, 4.6, 0.92, -0.4, '#ffffff'), box(0.4, 0.06, 0.3, 4.6, 0.98, -0.4, '#a5e6cf'), box(0.4, 0.06, 0.3, 4.6, 1.04, -0.4, '#ffffff'));
  const tv = pulser([box(0.02, 0.38, 0.46, 4.275, 1.18, -1.95, '#7fd8ff')], 'flicker', 11);
  room.extras.push(tv);
  B.add(0.44, 0.36, 4.263, 1.18, -1.95, -PI / 2, (c, W, Hh) => { const bars = ['#fff6ec', '#ffe14a', '#18f0ff', '#8dff5a', '#ff2bd1', '#ff3f5a', '#3a5aff']; bars.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * W / 7, 0, W / 7 + 1, Hh * 0.7); }); c.fillStyle = '#22203a'; c.fillRect(0, Hh * 0.7, W, Hh * 0.3); P.text(c, 'CHANNEL 86', W / 2, Hh * 0.85, Hh * 0.18, '#fff'); });
  // the window with blinds (VACANCY glowing outside), an armchair, the kitchenette, a wall AC unit
  g.push(box(0.06, 1.4, 2.0, -4.97, 1.65, 0.5, '#f6f1e7'));
  B.add(1.85, 1.28, -4.93, 1.65, 0.5, PI / 2, (c, W, Hh) => {
    P.grad(c, W, Hh, '#1b0f40', '#5a2a6a'); c.fillStyle = '#ff2a3a'; c.filter = 'blur(8px)'; c.fillRect(W * 0.5, Hh * 0.35, W * 0.4, Hh * 0.18); c.filter = 'none';
    P.text(c, 'VACANCY', W * 0.7, Hh * 0.44, Hh * 0.13, '#ff5a6a', { glow: 10 }); c.fillStyle = '#ffd447'; c.beginPath(); c.arc(W * 0.2, Hh * 0.2, Hh * 0.07, 0, 6.3); c.fill();
    P.palm(c, W * 0.25, Hh * 0.95, Hh * 0.6);
    c.fillStyle = 'rgba(240,230,210,.88)'; for (let y = 0; y < Hh; y += Hh / 14) c.fillRect(0, y, W, Hh / 28);
    P.frame(c, W, Hh, '#f6f1e7', 6);
  });
  pools.push(disc(-3.8, 0.012, 0.5, 1.6, '#ff4a6a', 0.35), disc(-4.94, 1.65, 0.5, 1.2, '#ff5a8a', 0.25, 'x'));
  g.push(box(0.9, 0.42, 0.85, -4.1, 0.21, 1.9, '#2fbfb0'), box(0.9, 0.12, 0.85, -4.1, 0.47, 1.9, '#5fd3c6'), box(0.2, 0.75, 0.85, -4.5, 0.55, 1.9, '#2fbfb0'),
    box(0.9, 0.3, 0.18, -4.1, 0.6, 1.48, '#2fbfb0'), box(0.9, 0.3, 0.18, -4.1, 0.6, 2.32, '#2fbfb0'));
  g.push(box(0.6, 0.9, 1.4, -4.7, 0.45, 3.2, '#f6f1e7'), box(0.62, 0.04, 1.42, -4.7, 0.92, 3.2, '#ff8fc4'), box(0.4, 0.04, 0.4, -4.7, 0.95, 3.4, CHROME), cyl(0.02, 0.02, 0.25, 6, -4.85, 1.07, 3.4, CHROME),
    box(0.3, 0.06, 0.3, -4.7, 0.97, 2.8, '#3a3550'), box(0.5, 0.75, 0.5, -4.7, 0.375, 2.2, '#fff6ec'), box(0.02, 0.3, 0.02, -4.44, 0.5, 2.05, CHROME));
  g.push(box(0.9, 0.5, 0.4, 3.0, 2.3, 3.78, '#e8e0d8'), box(0.8, 0.36, 0.02, 3.0, 2.3, 3.57, '#c8c0b8'));
  for (let i = 0; i < 6; i++) g.push(box(0.76, 0.02, 0.025, 3.0, 2.15 + i * 0.06, 3.56, '#9a9290'));
  // luggage rack with a suitcase, a rug at the bed's foot, a ceiling fan
  g.push(box(0.9, 0.04, 0.5, 2.8, 0.5, -3.6, '#8a5a3a'), box(0.03, 0.5, 0.03, 2.4, 0.25, -3.4, CHROME), box(0.03, 0.5, 0.03, 3.2, 0.25, -3.4, CHROME), box(0.03, 0.5, 0.03, 2.4, 0.25, -3.8, CHROME), box(0.03, 0.5, 0.03, 3.2, 0.25, -3.8, CHROME),
    box(0.8, 0.5, 0.3, 2.8, 0.77, -3.6, '#ff6a3d'), box(0.25, 0.06, 0.05, 2.8, 1.05, -3.6, BLK), box(0.82, 0.04, 0.32, 2.8, 0.75, -3.6, '#ffd447'));
  rug(g, 2.6, 1.6, -0.8, -0.6, '#7a3a6a', '#d8607a', '#ffd447', 'diamonds');
  const f = fan(g, 1.4, 0.2, H, '#8a5a3a', '#c8945e');
  room.extras.push(f);
  plant(g, 4.5, 3.5, 1, '#2fbfb0', '#3faf6a', 1);
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#4a3a3a', amb: 0.58, ambCol: '#fff0d8', clerk: 'HAZEL',
    lights: [{ x: -2.3, y: 1.1, z: -3.5, hex: '#ffd9a0', r: 4, k: 0.9 }, { x: 0.7, y: 1.1, z: -3.5, hex: '#ffd9a0', r: 4, k: 0.9 }, { x: 4.2, y: 1.2, z: -1.9, hex: '#80c8ff', r: 3, k: 0.6 },
      { x: -4.7, y: 1.6, z: 0.5, hex: '#ff5a8a', r: 4, k: 0.7 }, { x: 1.4, y: 2.4, z: 0.2, hex: '#fff0d0', r: 6, k: 0.35 }],
    blocks: [{ x0: -1.85, x1: 0.25, z0: -4, z1: -1.55 }, { x0: -2.6, x1: -2.0, z0: -4, z1: -3.35 }, { x0: 0.4, x1: 1.0, z0: -4, z1: -3.35 }, { x0: 4.3, x1: 5, z0: -2.5, z1: -0.45 },
      { x0: -5, x1: -4.35, z0: 1.4, z1: 3.95 }, { x0: -4.6, x1: -3.6, z0: 1.45, z1: 2.35 }, { x0: 2.3, x1: 3.3, z0: -4, z1: -3.3 }, { x0: 4.2, x1: 5, z0: 3.1, z1: 4 }],
    seats: [{ x: -4.0, z: 1.9, y: 0.5, yaw: PI / 2, kind: 'stool' }, { x: -0.8, z: -1.35, y: 0.62, yaw: 0, kind: 'stool' }],
    me: [1.2, 0.4], cast: { HAZEL: [2.3, -2.2, -0.9] },
    uses: [{ x: 0.7, z: -1.0, r: 1.3, kind: 'motel', hint: 'sleep and save', clerk: 'HAZEL' }],
    wide: [3.6, 2.3, 3.3, -0.8, 1.0, -2.2],
    idle(t, dt, still) {
      const n = room.npc.HAZEL, k = still ? 0.3 : 1;
      n.armR.rotation.set(-1.2, 0, -0.3 + Math.sin(t * 2.2) * 0.1 * k); n.armL.rotation.set(-1.2, 0, 0.3 - Math.sin(t * 2.2) * 0.1 * k); n.head.rotation.z = Math.sin(t * 0.7) * 0.06 * k;
      f.rotation.y += dt * (still ? 0.5 : 2);
      tv.userData.tick(t, still);
    },
  });
}

// ---- the Seafoam Galleria atrium --------------------------------------------------------------------------
function shopfront(g, B, x, z, ry, w, name, col, draw) {
  // glazing (a painted display) in a teal frame, the name over it, a soft pool of shop light on the floor
  const [cx, , cz] = loc(x, z, ry, 0, 0, 0.9);
  put(g, [box(w + 0.3, 0.12, 0.12, 0, 2.62, 0.06, '#27c9bf'), box(0.14, 2.6, 0.14, -w / 2 - 0.08, 1.3, 0.06, '#27c9bf'), box(0.14, 2.6, 0.14, w / 2 + 0.08, 1.3, 0.06, '#27c9bf'),
    box(w + 0.4, 0.7, 0.1, 0, 3.0, 0.05, '#f6f1e7'), box(w, 0.25, 0.08, 0, 0.12, 0.05, '#cfc6d6')], x, z, ry);
  bAt(B, x, z, ry, 0, 1.35, 0.1, w, 2.3, draw);
  bAt(B, x, z, ry, 0, 3.0, 0.11, w + 0.3, 0.6, (c, W, H) => { P.fill(c, W, H, '#fff6ec'); P.text(c, name, W / 2, H / 2, H * 0.55, col, { italic: true, glow: 4, max: W * 0.92 }); });
  return [cx, cz];
}
const window_ = (bg, items) => (c, W, H) => {
  P.grad(c, W, H, bg[0], bg[1]); const r = rng(W + H);
  c.fillStyle = '#ffffff22'; c.fillRect(0, H * 0.72, W, H * 0.28);
  items(c, W, H, r);
  c.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 3; i++) { const x = W * (0.15 + i * 0.3); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + W * 0.08, 0); c.lineTo(x - W * 0.06, H); c.lineTo(x - W * 0.14, H); c.fill(); }
};
function buildMall(room) {
  const g = [], B = room.boards = boards(2048), HX = 9, HZ = 7, H = 6.5, pools = room.pools, hi = room.hiPools;
  shell(g, HX, HZ, H, '#f3eee6', '#e3f1ec', ['#fbe3ee', '#fbe3ee', '#fdeef3'], '#e8f6fa', '#27d8cf');
  // terrazzo inlay: pink and teal bands round the fountain and out to the door
  for (const [r0, c0] of [[3.4, '#ff8fc4'], [3.7, '#27c9bf']]) for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2; g.push(box(0.8, 0.012, 0.12, Math.cos(a) * r0, 0.006, -0.5 + Math.sin(a) * r0, c0, 0, -a + PI / 2)); }
  g.push(box(0.12, 0.012, 3.3, -0.6, 0.006, 4.4, '#ff8fc4'), box(0.12, 0.012, 3.3, 0.6, 0.006, 4.4, '#27c9bf'));
  // the skylight: a glass panel in a white grid
  g.push(box(8.2, 0.06, 6.2, 0, H - 0.02, -0.5, '#bfeaff'));
  for (let i = -4; i <= 4; i++) g.push(box(0.08, 0.14, 6.2, i, H - 0.08, -0.5, '#f6f1e7'));
  for (let j = -3; j <= 3; j++) g.push(box(8.2, 0.14, 0.08, 0, H - 0.08, -0.5 + j, '#f6f1e7'));
  hi.push(cone(0, H - 0.1, -0.5, 3.2, 4.2, H - 0.3, '#e8fbff', 0.12));
  // the mezzanine along the back: a slab, a teal fascia, a glass railing; shops above and below
  g.push(box(18, 0.3, 2.4, 0, 3.2, -5.8, '#f6f1e7'), box(18, 0.36, 0.06, 0, 3.15, -4.58, '#27c9bf'), box(18, 0.06, 0.06, 0, 3.12, -4.54, '#ff2bd1'),
    box(18, 0.9, 0.03, 0, 3.8, -4.62, '#d8f4fa'), box(18, 0.06, 0.08, 0, 4.27, -4.62, CHROME));
  for (let x = -8.5; x <= 8.5; x += 1.7) g.push(box(0.05, 0.9, 0.05, x, 3.8, -4.62, CHROME));
  for (const x of [-6, -2, 2, 6]) g.push(cyl(0.16, 0.16, 3.05, 10, x, 1.52, -4.75, '#f6f1e7'));
  const fronts = [];
  fronts.push(shopfront(g, B, -5.6, -6.95, 0, 3.6, 'TAPE DECK TROPICS', '#ff2bd1', window_(['#2a1a5a', '#5a2a8a'], (c, W, H, r) => { for (let i = 0; i < 40; i++) { c.fillStyle = NEON[Math.floor(r() * 6)]; c.fillRect(W * (0.06 + (i % 10) * 0.09), H * (0.2 + Math.floor(i / 10) * 0.12), W * 0.07, H * 0.08); c.fillStyle = '#22203a'; c.fillRect(W * (0.07 + (i % 10) * 0.09), H * (0.22 + Math.floor(i / 10) * 0.12), W * 0.05, H * 0.025); } })));
  fronts.push(shopfront(g, B, 0, -6.95, 0, 3.6, 'SOLE PATROL', '#27a8c8', window_(['#e8fbff', '#bfeaff'], (c, W, H, r) => { for (let i = 0; i < 9; i++) { const x = W * (0.12 + (i % 3) * 0.3), y = H * (0.25 + Math.floor(i / 3) * 0.2); c.fillStyle = '#c9c0d8'; c.fillRect(x - W * 0.1, y + H * 0.06, W * 0.2, 3); c.fillStyle = NEON[i % 6]; c.beginPath(); c.moveTo(x - W * 0.08, y + H * 0.05); c.lineTo(x - W * 0.08, y - H * 0.02); c.lineTo(x, y); c.lineTo(x + W * 0.09, y + H * 0.02); c.lineTo(x + W * 0.09, y + H * 0.05); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - W * 0.08, y + H * 0.04, W * 0.17, H * 0.012); } })));
  fronts.push(shopfront(g, B, 5.6, -6.95, 0, 3.6, 'BYTE SHACK', '#3aaa5a', window_(['#1b2a2a', '#2a4a3a'], (c, W, H, r) => { for (let i = 0; i < 3; i++) { const x = W * (0.2 + i * 0.3); c.fillStyle = '#e8e0d0'; c.fillRect(x - W * 0.11, H * 0.35, W * 0.22, H * 0.2); c.fillStyle = '#0a2a1a'; c.fillRect(x - W * 0.09, H * 0.37, W * 0.18, H * 0.14); P.text(c, ['READY.', 'C:\\>_', 'HELLO'][i], x, H * 0.44, H * 0.04, '#5dff9a', { font: 'monospace' }); c.fillStyle = '#d8d0c0'; c.fillRect(x - W * 0.12, H * 0.58, W * 0.24, H * 0.05); } })));
  fronts.push(shopfront(g, B, -8.95, -1.8, PI / 2, 3.2, 'GLOW GETTER', '#ff4fa3', window_(['#ffe0ee', '#ffb0d0'], (c, W, H, r) => { for (let i = 0; i < 24; i++) { c.fillStyle = ['#ff2bd1', '#ff4f6a', '#b388ff', '#ffd447'][i % 4]; c.fillRect(W * (0.08 + (i % 8) * 0.11), H * (0.3 + Math.floor(i / 8) * 0.14), W * 0.04, H * 0.1); c.fillStyle = '#22203a'; c.fillRect(W * (0.08 + (i % 8) * 0.11), H * (0.27 + Math.floor(i / 8) * 0.14), W * 0.04, H * 0.03); } })));
  fronts.push(shopfront(g, B, -8.95, 3.4, PI / 2, 3.0, 'SEASHELL SWEETS', '#ff8a3d', window_(['#fff6d0', '#ffd8a0'], (c, W, H, r) => { for (let i = 0; i < 6; i++) { c.fillStyle = '#d8f4f2'; c.fillRect(W * (0.08 + i * 0.15), H * 0.3, W * 0.12, H * 0.32); for (let k = 0; k < 10; k++) { c.fillStyle = NEON[Math.floor(r() * 6)]; c.beginPath(); c.arc(W * (0.1 + i * 0.15) + r() * W * 0.08, H * (0.38 + r() * 0.22), W * 0.012, 0, 6.3); c.fill(); } } })));
  // upstairs shops, painted on the back wall above the mezzanine
  B.add(17.4, 2.0, 0, 4.75, -6.96, 0, (c, W, Hh) => {
    const N = [['VIDEO VORTEX', '#7a5cff'], ['SUNNY DAZE OPTICAL', '#ff8a3d'], ['PET PALACE', '#27a8c8'], ['RADICAL RACQUETS', '#ff2bd1']];
    N.forEach(([nm, col], i) => { const x0 = i * W / 4 + 6, w = W / 4 - 12; c.fillStyle = '#e0f4f8'; c.fillRect(x0, Hh * 0.3, w, Hh * 0.7); c.fillStyle = '#fff6ec'; c.fillRect(x0, 0, w, Hh * 0.26); P.text(c, nm, x0 + w / 2, Hh * 0.13, Hh * 0.14, col, { italic: true, max: w * 0.9 }); c.fillStyle = col; for (let k = 0; k < 6; k++) c.fillRect(x0 + w * (0.08 + k * 0.15), Hh * (0.55 + (k % 2) * 0.12), w * 0.1, Hh * 0.18); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x0 + w * 0.2, Hh * 0.3, w * 0.05, Hh * 0.7); });
  }, 60);
  // the fountain: a round basin, two tiers, the water (its jets pulse), coins on the bottom
  g.push(cyl(2.0, 2.05, 0.5, 28, 0, 0.25, -0.5, '#d9e8ec'), cyl(2.1, 2.1, 0.08, 28, 0, 0.52, -0.5, '#f6f1e7'), cyl(1.85, 1.85, 0.03, 28, 0, 0.43, -0.5, '#3fb8d6'),
    cyl(0.3, 0.4, 0.9, 12, 0, 0.9, -0.5, '#f6f1e7'), cyl(0.8, 0.7, 0.14, 18, 0, 1.38, -0.5, '#f6f1e7'), cyl(0.72, 0.72, 0.02, 18, 0, 1.43, -0.5, '#5fd3e6'),
    cyl(0.12, 0.16, 0.6, 10, 0, 1.75, -0.5, '#f6f1e7'), cyl(0.38, 0.32, 0.1, 14, 0, 2.08, -0.5, '#f6f1e7'), cyl(0.33, 0.33, 0.02, 14, 0, 2.12, -0.5, '#5fd3e6'));
  const cr = rng(5);
  for (let i = 0; i < 26; i++) { const a = cr() * 6.28, rr = 0.7 + cr() * 1.0; g.push(cyl(0.04, 0.04, 0.01, 8, Math.cos(a) * rr, 0.45, -0.5 + Math.sin(a) * rr, cr() < 0.7 ? GOLD : CHROME)); }
  const jets = [];
  jets.push(cyl(0.03, 0.08, 0.9, 8, 0, 2.55, -0.5, '#bff4ff'));
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; jets.push(box(0.04, 0.5, 0.04, Math.cos(a) * 0.55, 1.68, -0.5 + Math.sin(a) * 0.55, '#bff4ff', Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)); }
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; jets.push(box(0.04, 0.45, 0.04, Math.cos(a) * 1.4, 0.75, -0.5 + Math.sin(a) * 1.4, '#bff4ff', Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45)); }
  const water = pulser(jets, 'pulse');
  room.extras.push(water);
  let splashT = 0;
  room.splash = () => { splashT = 1; };
  pools.push(disc(0, 0.45, -0.5, 1.9, '#9ff0ff', 0.35), disc(0, 0.012, -0.5, 4.2, '#c8f8ff', 0.25));
  // benches round the fountain, palms in square planters, the directory, banners from the skylight
  const seats = [];
  const bench = (x, z, ry) => { put(g, [box(1.8, 0.08, 0.5, 0, 0.45, 0, '#c8945e'), box(1.8, 0.06, 0.08, 0, 0.42, -0.2, '#a8744e'), box(0.08, 0.42, 0.45, -0.8, 0.21, 0, CHROME), box(0.08, 0.42, 0.45, 0.8, 0.21, 0, CHROME), box(1.8, 0.4, 0.06, 0, 0.75, -0.24, '#c8945e')], x, z, ry); seats.push({ x, z, y: 0.48, yaw: ry, kind: 'bench' }); };
  bench(-3.5, -0.5, PI / 2); bench(3.5, -0.5, -PI / 2); bench(0, -3.6, 0);
  const blocks = [{ x0: -2.15, x1: 2.15, z0: -2.65, z1: 1.65 }, { x0: -4.0, x1: -3.2, z0: -1.45, z1: 0.45 }, { x0: 3.2, x1: 4.0, z0: -1.45, z1: 0.45 }, { x0: -0.95, x1: 0.95, z0: -4.1, z1: -3.3 }];
  for (const [x, z] of [[-5.4, -3.6], [5.0, -3.6], [-5.4, 2.4], [4.2, 3.6]]) {
    g.push(box(1.1, 0.6, 1.1, x, 0.3, z, '#f6f1e7'), box(1.14, 0.06, 1.14, x, 0.62, z, '#27c9bf'), box(1.0, 0.04, 1.0, x, 0.6, z, '#4a3020'));
    plant(g, x, z, 1.5, '#f6f1e7', '#2f9f6a', 0);
    blocks.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 });
  }
  g.push(box(1.0, 1.9, 0.3, 2.6, 0.95, 4.8, '#27c9bf'), box(1.1, 0.1, 0.36, 2.6, 1.95, 4.8, '#ff8fc4'));
  for (const ry of [0, PI]) B.add(0.9, 1.4, 2.6, 1.05, 4.8 + (ry ? -0.16 : 0.16), ry, (c, W, Hh) => {
    P.fill(c, W, Hh, '#fff6ec'); P.text(c, 'DIRECTORY', W / 2, Hh * 0.08, Hh * 0.06, '#27a8c8');
    c.fillStyle = '#ffd6e6'; c.fillRect(W * 0.1, Hh * 0.15, W * 0.8, Hh * 0.5); c.fillStyle = '#9fe8e0'; c.beginPath(); c.arc(W * 0.5, Hh * 0.42, W * 0.12, 0, 6.3); c.fill();
    c.fillStyle = '#ff2bd1'; c.beginPath(); c.arc(W * 0.5, Hh * 0.6, W * 0.04, 0, 6.3); c.fill(); P.text(c, 'YOU ARE HERE', W * 0.5, Hh * 0.68, Hh * 0.035, '#ff2bd1');
    ['TAPE DECK TROPICS · G1', 'SOLE PATROL · G2', 'BYTE SHACK · G3', 'GLOW GETTER · G4', 'SEASHELL SWEETS · G5', 'VIDEO VORTEX · U1', 'PET PALACE · U3'].forEach((s, i) => P.text(c, s, W * 0.1, Hh * (0.74 + i * 0.035), Hh * 0.026, '#22203a', { align: 'left', weight: 700 }));
  });
  blocks.push({ x0: 2.05, x1: 3.15, z0: 4.6, z1: 5.0 });
  B.add(3.2, 1.0, -3.4, 5.0, 2.4, 0, (c, W, Hh) => { P.grad(c, W, Hh, '#ff2bd1', '#ff8a3d'); P.text(c, 'SUMMER SPLASH', W / 2, Hh * 0.38, Hh * 0.32, '#fff6ec', { italic: true }); P.text(c, 'SALE ALL WEEK', W / 2, Hh * 0.75, Hh * 0.2, '#ffe14a'); });
  B.add(3.2, 1.0, 3.4, 5.0, 2.4, 0, (c, W, Hh) => { P.grad(c, W, Hh, '#27c9bf', '#18f0ff'); P.text(c, 'SEAFOAM', W / 2, Hh * 0.38, Hh * 0.34, '#fff6ec', { italic: true }); P.text(c, 'GALLERIA', W / 2, Hh * 0.75, Hh * 0.22, '#ff2bd1'); });
  for (const x of [-4.9, -1.9, 1.9, 4.9]) g.push(cyl(0.01, 0.01, 1.0, 4, x, H - 0.5, 2.4, CHROME));
  // the escalator up the right side (out of order: Kiki's word for it is stairs with ambition)
  g.push(box(1.4, 0.3, 7.2, 7.8, 1.5, -1.2, '#c9c0d8', Math.atan2(3.2, 6.2)), box(0.08, 1.0, 7.2, 7.08, 2.0, -1.2, '#d8f4fa', Math.atan2(3.2, 6.2)), box(0.08, 1.0, 7.2, 8.52, 2.0, -1.2, '#d8f4fa', Math.atan2(3.2, 6.2)),
    box(0.1, 0.08, 7.3, 7.08, 2.5, -1.2, BLK, Math.atan2(3.2, 6.2)), box(0.1, 0.08, 7.3, 8.52, 2.5, -1.2, BLK, Math.atan2(3.2, 6.2)), box(1.6, 0.1, 1.6, 7.8, 0.05, 2.4, CHROME));
  for (let i = 0; i < 18; i++) { const k = i / 18; g.push(box(1.3, 0.03, 0.08, 7.8, 0.12 + k * 3.1, 1.9 - k * 6.1, '#3a3550')); }
  g.push(cyl(0.02, 0.02, 1.0, 4, 7.8, 0.5, 3.0, CHROME), cyl(0.15, 0.15, 0.02, 8, 7.8, 0.01, 3.0, CHROME));
  B.add(0.7, 0.45, 7.8, 1.2, 3.02, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#ffe14a'); P.frame(c, W, Hh, '#22203a', 4); P.text(c, 'OUT OF', W / 2, Hh * 0.33, Hh * 0.26, '#22203a'); P.text(c, 'ORDER', W / 2, Hh * 0.7, Hh * 0.3, '#ff3f5a'); });
  blocks.push({ x0: 6.9, x1: 9, z0: -4.6, z1: 3.3 });
  // Kiki's pretzel cart: striped canopy, a glass warmer, wheels, her menu
  g.push(box(1.6, 0.9, 0.8, -2.8, 0.55, 3.2, '#ff8fc4'), box(1.7, 0.06, 0.9, -2.8, 1.02, 3.2, '#f6f1e7'), box(1.2, 0.45, 0.55, -2.8, 1.28, 3.2, '#d8f4f2'), box(1.22, 0.04, 0.57, -2.8, 1.52, 3.2, CHROME),
    cyl(0.18, 0.18, 0.08, 12, -3.5, 0.18, 3.62, BLK, PI / 2), cyl(0.18, 0.18, 0.08, 12, -2.1, 0.18, 3.62, BLK, PI / 2), cyl(0.18, 0.18, 0.08, 12, -3.5, 0.18, 2.78, BLK, PI / 2), cyl(0.18, 0.18, 0.08, 12, -2.1, 0.18, 2.78, BLK, PI / 2),
    box(0.05, 1.3, 0.05, -3.55, 1.65, 2.85, CHROME), box(0.05, 1.3, 0.05, -2.05, 1.65, 2.85, CHROME), box(0.05, 1.3, 0.05, -3.55, 1.65, 3.55, CHROME), box(0.05, 1.3, 0.05, -2.05, 1.65, 3.55, CHROME));
  for (let i = 0; i < 6; i++) g.push(box(0.3, 0.06, 1.0, -3.55 + i * 0.3 + 0.15, 2.33 - (i % 2) * 0.0, 3.2, i % 2 ? '#fff6ec' : '#ff4fa3'));
  for (let i = 0; i < 5; i++) g.push(box(0.16, 0.05, 0.12, -3.2 + i * 0.2, 1.12, 3.2, '#c87a3a', 0, i * 0.4, 0), box(0.06, 0.06, 0.06, -3.2 + i * 0.2, 1.17, 3.2, '#a85a2a'));
  B.add(1.2, 0.45, -2.8, 0.62, 3.61, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#ff4fa3'); P.text(c, "KIKI'S KNOTS", W / 2, Hh * 0.35, Hh * 0.32, '#fff6ec', { italic: true }); P.text(c, 'CLASSIC $6 · SWIRL $9', W / 2, Hh * 0.75, Hh * 0.18, '#ffe14a'); });
  blocks.push({ x0: -3.7, x1: -1.9, z0: 2.7, z1: 3.75 });
  for (const [x, z] of fronts) pools.push(disc(x, 0.012, z, 1.7, '#ffe0b0', 0.35));
  pools.push(disc(-8.96, 1.4, -1.8, 1.6, '#ffb0d0', 0.18, 'x'), disc(-2.8, 1.04, 3.2, 0.8, '#ffd9a0', 0.4));
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#3a4a5a', amb: 0.8, ambCol: '#f4fbff', clerk: 'KIKI',
    lights: [{ x: 0, y: 6, z: -0.5, hex: '#ffffff', r: 11, k: 0.45 }, { x: -5.6, y: 1.6, z: -6, hex: '#ff9ad8', r: 4, k: 0.4 }, { x: 0, y: 1.6, z: -6, hex: '#a8e8ff', r: 4, k: 0.4 }, { x: 5.6, y: 1.6, z: -6, hex: '#a8ffb8', r: 4, k: 0.4 },
      { x: -8, y: 1.6, z: 1, hex: '#ffc8a0', r: 5, k: 0.35 }],
    blocks, seats, me: [1.4, 2.8], cast: { KIKI: [-2.8, 2.45, 0] },
    uses: [{ x: -2.8, z: 4.3, r: 1.3, kind: 'cart', hint: "buy a pretzel from Kiki", clerk: 'KIKI', cam: [1.4, 1.9, 2.0] }, { x: 0.3, z: 2.2, r: 1.3, kind: 'fountain', hint: 'toss a coin in the fountain ($1)' }],
    wide: [6.2, 3.4, 5.8, -0.5, 1.6, -2.5],
    idle(t, dt, still) {
      const n = room.npc.KIKI, k = still ? 0.3 : 1;
      n.armR.rotation.set(-0.9, 0, -0.3 + Math.sin(t * 3) * 0.2 * k); n.armL.rotation.set(-0.3, 0, 0.2); n.head.rotation.y = Math.sin(t * 0.5) * 0.4 * k;
      splashT = Math.max(0, splashT - dt);
      if (still) water.material.color.setScalar(0.9 + splashT * 0.3);
      else water.material.color.setScalar(0.75 + 0.2 * Math.sin(t * 3.1) + splashT * 0.6);
    },
  });
}

// ---- Starboard Bait & Tackle --------------------------------------------------------------------------
function buildBait(room) {
  const g = [], B = room.boards = boards(1024), HX = 5.5, HZ = 4.5, H = 3.6, pools = room.pools, hi = room.hiPools;
  shell(g, HX, HZ, H, '#a8774a', '#9a6a40', ['#8fc4cc', '#86bcc4', '#94c9d0'], '#e8dcc8', '#8dff5a');
  // painted planks on the walls, ceiling beams
  for (let x = -5.3; x < 5.5; x += 0.35) g.push(box(0.02, H, 0.01, x, H / 2, -4.49, '#6a9aa2'));
  for (const sx of [-1, 1]) for (let z = -4.3; z < 4.5; z += 0.35) g.push(box(0.01, H, 0.02, sx * 5.49, H / 2, z, '#6a9aa2'));
  for (const z of [-3, -1, 1, 3]) g.push(box(11, 0.18, 0.2, 0, H - 0.1, z, '#8a5a3a'));
  // the counter with a rope trim, the register, a jar of lollipops, a bell
  g.push(box(4.0, 1.0, 0.8, -1.4, 0.5, -2.4, '#7a4a2a'), box(4.1, 0.06, 0.9, -1.4, 1.03, -2.4, '#c8945e'), box(4.02, 0.05, 0.05, -1.4, 0.85, -1.99, '#e8d8a8'), box(4.02, 0.05, 0.05, -1.4, 0.15, -1.99, '#e8d8a8'));
  for (let x = -3.2; x < 0.6; x += 0.5) g.push(box(0.04, 0.85, 0.02, x, 0.5, -1.99, '#6a3a1a'));
  g.push(box(0.45, 0.3, 0.4, 0.2, 1.21, -2.45, '#3a3550'), box(0.36, 0.08, 0.2, 0.2, 1.38, -2.3, '#8dff5a'), cyl(0.1, 0.1, 0.24, 10, -2.6, 1.18, -2.3, '#d8f4f2'));
  for (let i = 0; i < 6; i++) g.push(cyl(0.03, 0.03, 0.03, 8, -2.6 + (i % 3 - 1) * 0.05, 1.32 + Math.floor(i / 3) * 0.03, -2.3 + (i % 2) * 0.03, NEON[i]));
  g.push(cyl(0.06, 0.08, 0.06, 10, -1.0, 1.09, -2.2, GOLD));
  // the wall behind Rudy: rods in a rack, a mounted fish, the tide chart, LIVE BAIT in flickering neon
  for (let i = 0; i < 9; i++) g.push(cyl(0.012, 0.02, 2.6, 5, -4.9 + i * 0.32, 1.5, -4.35, ['#3a3550', '#c41a3a', '#27a8c8', '#e8d8a8'][i % 4], 0, 0.12), cyl(0.035, 0.035, 0.05, 8, -4.88 + i * 0.32, 0.9, -4.3, CHROME, 0, PI / 2));
  g.push(box(3.2, 0.08, 0.2, -3.6, 0.3, -4.38, '#8a5a3a'), box(3.2, 0.08, 0.2, -3.6, 2.4, -4.38, '#8a5a3a'));
  B.add(1.4, 0.6, -0.8, 2.6, -4.47, 0, (c, W, Hh) => {
    c.clearRect(0, 0, W, Hh); c.fillStyle = '#8a5a3a'; c.beginPath(); c.ellipse(W / 2, Hh / 2, W * 0.48, Hh * 0.46, 0, 0, 6.3); c.fill();
    c.fillStyle = '#4a8a6a'; c.beginPath(); c.ellipse(W * 0.48, Hh * 0.48, W * 0.3, Hh * 0.22, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(W * 0.75, Hh * 0.48); c.lineTo(W * 0.9, Hh * 0.25); c.lineTo(W * 0.9, Hh * 0.72); c.fill();
    c.fillStyle = '#8acf9a'; c.beginPath(); c.ellipse(W * 0.45, Hh * 0.55, W * 0.22, Hh * 0.08, 0, 0, 6.3); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(W * 0.26, Hh * 0.43, Hh * 0.05, 0, 6.3); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(W * 0.26, Hh * 0.43, Hh * 0.025, 0, 6.3); c.fill();
    P.text(c, 'BIG BERTHA · 1971', W / 2, Hh * 0.88, Hh * 0.1, GOLD);
  });
  B.add(1.3, 1.0, 1.6, 2.1, -4.47, 0, (c, W, Hh) => {
    P.fill(c, W, Hh, '#fff6ec'); P.frame(c, W, Hh, '#27a8c8', 5); P.text(c, 'TIDES THIS WEEK', W / 2, Hh * 0.1, Hh * 0.08, '#27a8c8');
    c.strokeStyle = '#27a8c8'; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W * 0.86; x += 3) c.lineTo(W * 0.07 + x, Hh * 0.45 + Math.sin(x / W * 14) * Hh * 0.17); c.stroke();
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((d, i) => P.text(c, d, W * (0.1 + i * 0.13), Hh * 0.8, Hh * 0.07, '#22203a'));
    P.text(c, 'FISH BITE BEST AT THE TOP', W / 2, Hh * 0.92, Hh * 0.055, '#ff6a3d');
  });
  const bait = [];
  B.add(1.6, 0.5, 3.7, 3.0, -4.46, 0, (c, W, Hh) => P.neon(c, W, Hh, 'LIVE BAIT', '#ff3f5a', { back: null, size: 0.6 }), 160);
  bait.push(box(1.5, 0.03, 0.02, 3.7, 2.72, -4.45, '#ff3f5a'), box(1.5, 0.03, 0.02, 3.7, 3.28, -4.45, '#ff3f5a'));
  const baitM = pulser(bait, 'flicker', 21);
  room.extras.push(baitM);
  // the marina through the back window, the bait fridge under it
  g.push(box(2.1, 1.3, 0.06, 3.0, 1.95, -4.47, '#f6f1e7'));
  B.add(1.95, 1.15, 3.0, 1.95, -4.43, 0, (c, W, Hh) => {
    P.grad(c, W, Hh, '#ff9a6a', '#ffd8a0'); c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(W * 0.7, Hh * 0.5, Hh * 0.13, 0, 6.3); c.fill();
    c.fillStyle = '#2a6a8a'; c.fillRect(0, Hh * 0.55, W, Hh); c.fillStyle = '#ffd8a0'; for (let i = 0; i < 6; i++) c.fillRect(W * (0.5 + i * 0.03), Hh * (0.6 + i * 0.05), W * 0.2, 2);
    for (const [x, s] of [[0.2, 1], [0.45, 0.8]]) { c.fillStyle = '#fff6ec'; c.beginPath(); c.moveTo(W * (x - 0.1 * s), Hh * 0.68); c.lineTo(W * (x + 0.1 * s), Hh * 0.68); c.lineTo(W * (x + 0.07 * s), Hh * 0.74); c.lineTo(W * (x - 0.08 * s), Hh * 0.74); c.fill(); c.fillRect(W * x - 1, Hh * (0.68 - 0.3 * s), 2, Hh * 0.3 * s); c.fillStyle = '#ff4fa3'; c.beginPath(); c.moveTo(W * x + 2, Hh * (0.4)); c.lineTo(W * (x + 0.08 * s), Hh * 0.64); c.lineTo(W * x + 2, Hh * 0.64); c.fill(); }
    P.frame(c, W, Hh, '#f6f1e7', 6); c.fillStyle = '#f6f1e7'; c.fillRect(W / 2 - 3, 0, 6, Hh); c.fillRect(0, Hh / 2 - 3, W, 6);
  });
  g.push(box(1.7, 0.9, 0.8, 3.8, 0.45, -3.85, '#f6f1e7'), box(1.72, 0.06, 0.82, 3.8, 0.93, -3.85, '#9fe8ff'), box(1.6, 0.04, 0.04, 3.8, 0.75, -3.44, '#27a8c8'));
  B.add(1.0, 0.3, 3.8, 0.5, -3.44, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#27a8c8'); P.text(c, 'WORMS · SHRIMP · SQUID', W / 2, Hh / 2, Hh * 0.4, '#fff6ec', { max: W * 0.92 }); });
  pools.push(disc(3.0, 0.012, -3.0, 1.6, '#ffc890', 0.35), disc(3.8, 0.96, -3.85, 0.8, '#a0f0ff', 0.4));
  // the fish tank on the left wall
  g.push(box(0.8, 0.85, 2.2, -5.0, 0.425, 1.4, '#7a4a2a'), box(0.82, 0.04, 2.24, -5.0, 0.87, 1.4, '#c8945e'));
  for (const [y, h] of [[0.9, 0.04], [1.7, 0.05]]) g.push(box(0.7, h, 2.1, -5.05, y, 1.4, BLK));
  for (const z of [0.36, 2.44]) g.push(box(0.7, 0.8, 0.04, -5.05, 1.3, z, BLK));
  g.push(box(0.6, 0.06, 2.0, -5.05, 0.94, 1.4, '#e8d8a8'), box(0.2, 0.25, 0.2, -5.05, 1.05, 0.9, '#c8945e'), box(0.04, 0.4, 0.05, -5.1, 1.15, 1.7, '#3faf6a'), box(0.04, 0.5, 0.05, -5.0, 1.2, 2.0, '#2f9f6a'));
  B.add(2.06, 0.76, -5.38, 1.3, 1.4, PI / 2, (c, W, Hh) => { P.grad(c, W, Hh, '#2a9ac8', '#105a7a'); c.fillStyle = 'rgba(255,255,255,.4)'; const r = rng(4); for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(W * (0.75 + r() * 0.1), Hh * r(), 1 + r() * 2, 0, 6.3); c.fill(); } c.fillStyle = '#3faf6a'; for (let i = 0; i < 6; i++) c.fillRect(W * (0.08 + i * 0.12), Hh * (0.5 + (i % 2) * 0.1), 4, Hh * 0.5); });
  const fish = fishTank({ x0: -5.3, x1: -4.8, y0: 0.95, y1: 1.65, z0: 0.5, z1: 2.3 }, 6, 8);
  room.extras.push(fish.mesh);
  room.extras.push(new THREE.Mesh(box(0.01, 0.72, 2.0, -4.7, 1.3, 1.4, '#9fe8ff'), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, depthWrite: false, fog: false })));
  pools.push(disc(-5.35, 1.3, 1.4, 1.3, '#40c8ff', 0.4, 'x'), disc(-4.4, 0.012, 1.4, 1.4, '#40b0e0', 0.35));
  // life rings and a vest rack, tackle shelves on the right wall, a canoe on the ceiling hooks, a rope mat
  for (const [z, y] of [[-1.4, 2.5], [-0.3, 2.2]]) {
    const t = new THREE.TorusGeometry(0.32, 0.08, 8, 20); t.rotateY(PI / 2); t.translate(5.4, y, z); g.push(tint(t, '#fff6ec'));
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; g.push(box(0.18, 0.18, 0.18, 5.4, y + Math.sin(a) * 0.32, z + Math.cos(a) * 0.32, '#ff3f5a', a)); }
  }
  g.push(box(0.5, 1.6, 2.6, 5.2, 0.8, 1.6, '#8a5a3a'));
  for (const y of [0.4, 0.9, 1.4]) g.push(box(0.52, 0.04, 2.6, 5.2, y, 1.6, '#c8945e'));
  B.add(2.5, 1.5, 4.94, 0.92, 1.6, -PI / 2, (c, W, Hh) => P.products(c, W, Hh, 77, { rows: 3, bg: '#5a3a1a', shelf: '#c8945e', palette: ['#ff3f5a', '#ffe14a', '#27a8c8', '#8dff5a', '#ff8a3d', '#fff6ec'], names: ['LURE', 'HOOKS', 'BOBBER', 'LINE', 'REEL', 'SINKER'] }));
  B.add(1.6, 0.4, 4.9, 1.85, 1.6, -PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#22203a'); P.text(c, 'TACKLE', W / 2, Hh / 2, Hh * 0.55, '#ffe14a', { italic: true, glow: 6 }); });
  g.push(box(0.05, 1.5, 0.05, -4.6, 0.75, 3.6, CHROME), box(0.9, 0.05, 0.05, -4.6, 1.5, 3.6, CHROME, 0, PI / 2));
  for (let i = 0; i < 4; i++) g.push(box(0.12, 0.7, 0.5, -4.6, 1.1, 3.25 + i * 0.25, '#ff7a1a'), box(0.13, 0.08, 0.5, -4.6, 1.25, 3.25 + i * 0.25, '#ffe14a'));
  g.push(box(4.2, 0.18, 0.6, 0.4, H - 0.55, 0.8, '#ff8a3d'), box(3.0, 0.1, 0.5, 0.4, H - 0.66, 0.8, '#c8945e'), box(0.04, 0.4, 0.04, -1.2, H - 0.3, 0.8, '#e8d8a8'), box(0.04, 0.4, 0.04, 2.0, H - 0.3, 0.8, '#e8d8a8'));
  rug(g, 3.0, 1.1, -1.4, -1.3, '#c8a878', '#e8d8a8', '#a8774a', 'stripes');
  // a wooden crate to sit on by the tank, a palm by the door, a caged lamp over the counter
  g.push(box(0.55, 0.45, 0.55, -3.6, 0.225, 1.4, '#a8774a'), box(0.57, 0.05, 0.57, -3.6, 0.44, 1.4, '#c8945e'));
  plant(g, 4.8, 3.9, 1.1, '#c8945e', '#2f9f6a', 0);
  g.push(cyl(0.01, 0.01, 0.8, 4, -1.4, H - 0.4, -2.4, '#3a3550'), cyl(0.12, 0.12, 0.2, 8, -1.4, H - 0.9, -2.4, '#3a3550'), cyl(0.1, 0.1, 0.12, 8, -1.4, H - 1.05, -2.4, '#fff3c4'));
  pools.push(disc(-1.4, 1.065, -2.4, 0.9, '#ffd9a0', 0.6)); hi.push(cone(-1.4, H - 1.1, -2.4, 0.12, 0.9, 1.4, '#ffe0b0', 0.3));
  const f = fan(g, 2.6, 2.4, H, '#3a3550', '#c8945e');
  room.extras.push(f);
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#2a4a4a', amb: 0.62, ambCol: '#fff4e0', clerk: 'RUDY',
    lights: [{ x: -1.4, y: 2.4, z: -2.4, hex: '#ffd9a0', r: 4.5, k: 0.8 }, { x: -4.9, y: 1.3, z: 1.4, hex: '#40c8ff', r: 3, k: 0.8 }, { x: 3.0, y: 2, z: -4.2, hex: '#ffc890', r: 4, k: 0.7 }, { x: 3.7, y: 3, z: -4.3, hex: '#ff3f5a', r: 2.5, k: 0.6 }, { x: 0, y: 3, z: 1.5, hex: '#fff4e0', r: 6, k: 0.3 }],
    blocks: [{ x0: -5.5, x1: 0.7, z0: -4.5, z1: -1.95 }, { x0: 2.9, x1: 5.5, z0: -4.5, z1: -3.4 }, { x0: -5.5, x1: -4.55, z0: 0.25, z1: 2.55 }, { x0: 4.9, x1: 5.5, z0: 0.25, z1: 2.95 },
      { x0: -5.0, x1: -4.2, z0: 3.1, z1: 4.0 }, { x0: -3.9, x1: -3.3, z0: 1.1, z1: 1.7 }, { x0: 4.4, x1: 5.2, z0: 3.5, z1: 4.3 }, { x0: 5.0, x1: 5.5, z0: -1.9, z1: 0.1 }],
    seats: [{ x: -3.6, z: 1.4, y: 0.47, yaw: -PI / 2, kind: 'stool' }],
    me: [-0.6, -1.0], cast: { RUDY: [-1.4, -3.3, 0] },
    uses: [{ x: -1.4, z: -1.35, r: 1.3, kind: 'bait', hint: "talk to Cap'n Rudy", clerk: 'RUDY' }],
    wide: [3.8, 2.4, 3.6, -1.6, 1.2, -2.6],
    idle(t, dt, still) {
      const n = room.npc.RUDY, k = still ? 0.3 : 1;
      n.armR.rotation.set(-0.5, 0, -0.1); n.armL.rotation.set(-1.6 + Math.sin(t * 1.3) * 0.1 * k, 0, 0.4); n.head.rotation.y = Math.sin(t * 0.4) * 0.4 * k;
      f.rotation.y += dt * (still ? 0.5 : 1.8);
      fish.tick(t * (still ? 0.3 : 1));
      baitM.userData.tick(t, still);
    },
  });
}

export const VENUE_BUILD = { diner: buildDiner, arcade: buildArcade, motel: buildMotel, mall: buildMall, bait: buildBait };
