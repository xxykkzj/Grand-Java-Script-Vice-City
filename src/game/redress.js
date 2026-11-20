// Finer dressing for the five story interiors (built in game/interiors.js): painted menus, posters and
// neon on one canvas atlas per room, fake mirror reflections, rugs, plants, ceiling fans, pipes, light
// rigs, baked lighting and soft light pools, plus a few small animated touches (a fish tank, a jukebox
// glow, a flickering tube, a plasma globe, a spinning sunglasses stand).
import * as THREE from 'three';
import { box, cyl, PI, rng } from '../core/util.js';
import { boards, P, plant, rug, pipe, fan, fishTank, pulser, shadeHex } from './dress.js';

const BLK = '#22203a', GOLD = '#ffd166', CHROME = '#d9d6e6', NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
const disc = (x, y, z, r, hex, k, axis, f) => ({ disc: [x, y, z, r, hex, k, axis, f] });
const cone = (x, y, z, rt, rb, h, hex, k) => ({ cone: [x, y, z, rt, rb, h, hex, k] });
// chain an extra idle step onto a room
const also = (room, fn) => { const prev = room.idle; room.idle = function (t, dt, still) { prev.call(room, t, dt, still); fn(t, dt || 1 / 60, still); }; };

// ---- The Velvet Flamingo ------------------------------------------------------------------------------
function bar(room) {
  const g = room.geo, B = room.boards = boards(1024), pools = room.pools, hi = room.hiPools;
  // the back-bar mirror behind the bottles: a dim violet glass with the room's colours swimming in it
  B.add(6.5, 1.5, 0, 2.17, -4.47, 0, (c, W, H) => P.mirror(c, W, H, ['#2a1440', '#1a0a2a'], [['#ff4fc0', 10], ['#18f0ff', 8], ['#ffe14a', 6], ['#ffc7ea', 5]], 3));
  // happy-hour menu board and a neon script over the bar
  B.add(2.6, 0.8, -1.9, 3.5, -4.47, 0, (c, W, H) => {
    P.fill(c, W, H, '#14101e'); P.frame(c, W, H, GOLD, 5);
    P.text(c, 'HAPPY HOUR 5 – 7', W / 2, H * 0.17, H * 0.14, '#ff4fc0', { italic: true, glow: 8 });
    [['SUNSET SLING', '4'], ['CORAL CRUSH', '4'], ['FLAMINGO FIZZ', '3'], ['NO-NAME NIGHTCAP', '5']].forEach(([a, b], i) => { const y = H * (0.38 + i * 0.16); P.text(c, a, W * 0.08, y, H * 0.1, '#fff6ec', { align: 'left', weight: 800 }); P.text(c, '$' + b, W * 0.92, y, H * 0.1, '#7fffd0', { align: 'right' }); });
  });
  B.add(2.8, 0.75, 1.75, 3.5, -4.46, 0, (c, W, H) => P.neon(c, W, H, 'Velvet', '#ff4fc0', { size: 0.62 }), 160);
  // bottles: a third shelf of tall shapes and a few on the counter top
  const r = rng(12);
  for (const y of [1.55, 2.2]) for (let i = 0; i < 14; i++) {
    const x = -3.05 + i * 0.46 + (r() - 0.5) * 0.1, h = 0.22 + r() * 0.18, col = ['#5a9a6a', '#c87a3a', '#e8d8a8', '#7a3a8a', '#3a8aa8', '#c83a5a'][Math.floor(r() * 6)];
    if (i % 3 === 1) continue;
    g.push(cyl(0.05, 0.055, h, 7, x, y + 0.035 + h / 2, -4.12, col), cyl(0.018, 0.022, 0.1, 6, x, y + 0.035 + h + 0.05, -4.12, shadeHex(col, 0.7)), box(0.07, 0.06, 0.005, x, y + 0.035 + h * 0.45, -4.067, '#fff6ec'));
  }
  for (const x of [-2.9, -0.6, 2.3]) g.push(cyl(0.1, 0.06, 0.02, 10, x, 1.19, -2.3, '#ffc7ea'), cyl(0.012, 0.012, 0.12, 5, x, 1.24, -2.3, '#ffc7ea'), cyl(0.12, 0.012, 0.1, 10, x, 1.35, -2.3, '#ffd6f0'));
  // wainscot: dark panels with a gold rail round the room
  g.push(box(11.9, 1.1, 0.04, 0, 0.55, -4.47, '#241040'), box(0.04, 1.1, 8.9, -5.97, 0.55, 0, '#241040'), box(0.04, 1.1, 8.9, 5.97, 0.55, 0, '#241040'),
    box(11.9, 0.05, 0.06, 0, 1.12, -4.46, GOLD), box(0.06, 0.05, 8.9, -5.96, 1.12, 0, GOLD), box(0.06, 0.05, 8.9, 5.96, 1.12, 0, GOLD));
  // rugs: a velvet runner to the bar and a patterned one under the tables
  rug(g, 1.5, 4.2, 0.4, 1.7, '#5a1048', '#8a1a6a', '#ff4fc0', 'stripes');
  rug(g, 2.8, 3.6, 3.9, 0.7, '#3a1a5a', '#5a2a7a', '#ffd166', 'diamonds');
  // the fish tank on the right wall, on a low cabinet
  g.push(box(0.65, 0.95, 1.7, 5.62, 0.475, -2.9, '#3a1a4a'), box(0.67, 0.04, 1.72, 5.62, 0.97, -2.9, GOLD), box(0.6, 0.04, 1.6, 5.62, 1.0, -2.9, BLK), box(0.6, 0.05, 1.6, 5.62, 1.72, -2.9, BLK),
    box(0.6, 0.72, 0.04, 5.62, 1.36, -3.68, BLK), box(0.6, 0.72, 0.04, 5.62, 1.36, -2.12, BLK), box(0.5, 0.05, 1.5, 5.64, 1.05, -2.9, '#e8d8a8'), box(0.16, 0.2, 0.16, 5.65, 1.15, -3.3, '#c86aa8'));
  for (let i = 0; i < 5; i++) g.push(box(0.03, 0.25 + (i % 3) * 0.1, 0.04, 5.6 + (i % 2) * 0.1, 1.2, -3.4 + i * 0.3, '#3faf6a'));
  B.add(1.52, 0.68, 5.93, 1.36, -2.9, -PI / 2, (c, W, H) => { P.grad(c, W, H, '#3a7ac8', '#103a6a'); c.fillStyle = 'rgba(255,255,255,.35)'; const q = rng(2); for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(W * (0.2 + q() * 0.06), H * q(), 1 + q() * 2, 0, 6.3); c.fill(); } });
  const fish = fishTank({ x0: 5.4, x1: 5.85, y0: 1.05, y1: 1.7, z0: -3.6, z1: -2.2 }, 7, 5);
  room.extras.push(fish.mesh);
  pools.push(disc(5.9, 1.36, -2.9, 1.2, '#40a8ff', 0.4, '-x'), disc(5.0, 0.012, -2.9, 1.3, '#4090ff', 0.3));
  room.blocks.push({ x0: 5.25, x1: 6, z0: -3.8, z1: -2.0 });
  // pictures: a Flamingo Fizz poster, the sunset over the tables, a little gallery of regulars
  B.add(1.0, 1.4, -5.94, 2.35, -2.6, PI / 2, (c, W, H) => { P.grad(c, W, H, '#ffb0d0', '#ff4fa3'); P.text(c, 'FLAMINGO', W / 2, H * 0.14, H * 0.1, '#fff6ec', { italic: true }); P.text(c, 'FIZZ', W / 2, H * 0.26, H * 0.15, '#ffe14a', { italic: true, glow: 6 }); c.fillStyle = '#fff6ec'; c.fillRect(W * 0.38, H * 0.38, W * 0.24, H * 0.45); c.fillStyle = '#ff2b8a'; c.fillRect(W * 0.38, H * 0.52, W * 0.24, H * 0.31); c.fillStyle = '#18f0ff'; c.fillRect(W * 0.47, H * 0.3, W * 0.03, H * 0.14); P.text(c, 'THE PINK DRINK', W / 2, H * 0.92, H * 0.06, '#22203a'); });
  g.push(box(0.03, 1.5, 1.1, -5.97, 2.35, -2.6, GOLD));
  for (let i = 0; i < 4; i++) {
    const z = -0.6 + (i % 2) * 0.55, y = 2.0 + Math.floor(i / 2) * 0.62;
    g.push(box(0.03, 0.5, 0.42, -5.97, y, z, GOLD));
    B.add(0.36, 0.44, -5.95, y, z, PI / 2, (c, W, H) => { const q = rng(i + 40); P.grad(c, W, H, ['#ffd6a0', '#a0d8ff', '#ffb0c0', '#c8b0ff'][i], '#3a2a4a'); c.fillStyle = ['#c98d62', '#f1c9a5', '#7a4a2e', '#e0a878'][i]; c.fillRect(W * 0.35, H * 0.25, W * 0.3, H * 0.3); c.fillStyle = NEON[Math.floor(q() * 6)]; c.fillRect(W * 0.25, H * 0.58, W * 0.5, H * 0.42); c.fillStyle = '#22203a'; c.fillRect(W * 0.35, H * 0.2, W * 0.3, H * 0.08); });
  }
  B.add(1.6, 0.9, 5.94, 2.4, 1.0, -PI / 2, (c, W, H) => { P.grad(c, W, H, '#2a0f4a', '#ff6a8a'); c.fillStyle = '#ffd447'; c.beginPath(); c.arc(W / 2, H * 0.62, H * 0.24, PI, 0); c.fill(); c.fillStyle = '#1b0f30'; c.fillRect(0, H * 0.62, W, H); P.palm(c, W * 0.2, H * 0.64, H * 0.5); });
  g.push(box(0.03, 1.0, 1.7, 5.97, 2.4, 1.0, GOLD));
  // a cocktail glass in neon over the jukebox: it flickers now and then
  const glass = [], seg = (z0, y0, z1, y1) => glass.push(box(0.06, 0.06, Math.hypot(z1 - z0, y1 - y0) + 0.06, -5.93, (y0 + y1) / 2, (z0 + z1) / 2, '#18f0ff', Math.atan2(-(y1 - y0), z1 - z0)));
  seg(0.8, 3.6, 1.2, 3.1); seg(1.6, 3.6, 1.2, 3.1); seg(0.8, 3.6, 1.6, 3.6); seg(1.2, 3.1, 1.2, 2.7); seg(0.95, 2.7, 1.45, 2.7);
  const neonGlass = pulser(glass, 'flicker', 5);
  room.extras.push(neonGlass);
  // the jukebox glows and cycles
  const juke = pulser([box(0.04, 1.2, 0.06, -4.66, 0.85, 0.95, '#ffffff'), box(0.04, 1.2, 0.06, -4.66, 0.85, 1.45, '#ffffff'), box(0.04, 0.06, 0.5, -4.66, 1.62, 1.2, '#ffffff')], 'rainbow');
  room.extras.push(juke);
  pools.push(disc(-4.4, 0.012, 1.2, 1.3, '#ff6ad8', 0.45));
  // plants by the door, ceiling fans, pendant lamps over the bar
  plant(g, -5.4, 3.8, 1.1, '#7a1a6a', '#2f9f6a', 0); plant(g, 5.4, 3.8, 1, '#ffd166', '#3faf6a', 1);
  room.blocks.push({ x0: -5.75, x1: -5.05, z0: 3.45, z1: 4.15 }, { x0: 5.05, x1: 5.75, z0: 3.45, z1: 4.15 });
  const fans = [fan(g, -2.6, 1.2, 4.2, '#2a1a3a', '#c8a0c8'), fan(g, 3.4, 1.4, 4.2, '#2a1a3a', '#c8a0c8')];
  room.extras.push(...fans);
  for (const x of [-2.4, 0, 2.4]) {
    g.push(cyl(0.01, 0.01, 1.1, 4, x, 3.65, -2.25, GOLD), cyl(0.06, 0.24, 0.24, 12, x, 2.98, -2.25, '#ff4fc0'), cyl(0.07, 0.07, 0.04, 8, x, 2.86, -2.25, '#fff3c4'));
    pools.push(disc(x, 1.185, -2.2, 0.7, '#ffb0e0', 0.65));
    hi.push(cone(x, 2.85, -2.25, 0.2, 0.75, 1.65, '#ffb8e8', 0.35));
  }
  for (const [x, z] of [[4.2, 1.6], [3.4, -0.2]]) pools.push(disc(x, 0.86, z, 0.55, '#ffd9a0', 0.7), disc(x, 0.012, z, 1.5, '#ff9ad0', 0.3));
  pools.push(disc(4.6, 2.3, -4.46, 1.6, '#ff4fc0', 0.3, 'z'));
  room.lights = [{ x: -2.4, y: 2.8, z: -2.2, hex: '#ffb0e0', r: 4.5, k: 0.8 }, { x: 0, y: 2.8, z: -2.2, hex: '#ffb0e0', r: 4.5, k: 0.8 }, { x: 2.4, y: 2.8, z: -2.2, hex: '#ffb0e0', r: 4.5, k: 0.8 },
    { x: 4.6, y: 2.2, z: -4.2, hex: '#ff4fc0', r: 3.5, k: 0.9 }, { x: -4.5, y: 1.2, z: 1.2, hex: '#ff6ad8', r: 3.5, k: 0.7 }, { x: 5.4, y: 1.4, z: -2.9, hex: '#4090ff', r: 3, k: 0.8 },
    { x: 3.8, y: 1.2, z: 0.7, hex: '#ffd9a0', r: 3.5, k: 0.7 }, { x: 0, y: 3, z: 2.5, hex: '#c080ff', r: 6, k: 0.35 }];
  room.amb = 0.62; room.ambCol = '#e8d8ff';
  also(room, (t, dt, still) => { for (const f of fans) f.rotation.y += dt * (still ? 0.5 : 2.2); fish.tick(t * (still ? 0.3 : 1)); neonGlass.userData.tick(t, still); juke.userData.tick(t, still); });
}

// ---- Club Prism ---------------------------------------------------------------------------------------------
function club(room) {
  const g = room.geo, B = room.boards = boards(1024), pools = room.pools;
  // the drinks menu over the bar, a dance-off poster and an EST. plaque by the door
  B.add(2.0, 1.3, -10.9, 3.6, -5.7, PI / 2, (c, W, H) => {
    P.fill(c, W, H, '#100a24'); P.frame(c, W, H, '#7a5cff', 5);
    P.text(c, 'PRISM BAR', W / 2, H * 0.13, H * 0.12, '#18f0ff', { italic: true, glow: 8 });
    [['LASER LEMONADE', '3'], ['ULTRAVIOLET', '5'], ['MIRRORBALL', '6'], ['THE KILOWATT', '7'], ['FLOOR FILLER', '4']].forEach(([a, b], i) => { const y = H * (0.32 + i * 0.13); P.text(c, a, W * 0.08, y, H * 0.085, '#f4f0ff', { align: 'left', weight: 800 }); P.text(c, '$' + b, W * 0.92, y, H * 0.085, '#ff2bd1', { align: 'right' }); });
  });
  B.add(1.5, 2.0, -4.6, 2.4, 7.94, PI, (c, W, H) => {
    P.grad(c, W, H, '#ff2bd1', '#2a0f6a'); for (let i = 0; i < 12; i++) { c.strokeStyle = NEON[i % 6]; c.globalAlpha = 0.4; c.beginPath(); c.moveTo(W / 2, H * 0.55); c.lineTo(W * (i / 11), 0); c.stroke(); } c.globalAlpha = 1;
    P.text(c, 'DANCE-OFF', W / 2, H * 0.2, H * 0.1, '#ffe14a', { italic: true, glow: 8 }); P.text(c, 'SATURDAY', W / 2, H * 0.31, H * 0.08, '#fff6ec', { italic: true });
    P.text(c, '$5,000', W / 2, H * 0.55, H * 0.14, '#18f0ff', { glow: 10 }); P.text(c, 'HOSTED BY MARTY GLITZ', W / 2, H * 0.78, H * 0.045, '#fff6ec'); P.text(c, 'DJ KILOWATT ON THE DECKS', W / 2, H * 0.86, H * 0.045, '#ffe14a');
  });
  g.push(box(1.6, 2.1, 0.03, -4.6, 2.4, 7.96, '#a98bff'));
  B.add(1.0, 0.5, 4.2, 2.2, 7.95, PI, (c, W, H) => { P.fill(c, W, H, '#c9a64a'); P.frame(c, W, H, '#7a5a1a', 4); P.text(c, 'CLUB PRISM', W / 2, H * 0.36, H * 0.24, '#3a2a0a', { italic: true }); P.text(c, 'EST. 1983 · LUMINA BLVD', W / 2, H * 0.72, H * 0.14, '#3a2a0a'); });
  // the lounge: paintings over the back booths, a smoky mirror on the far wall, plants in the front corners
  for (const x of [13.8, 18.4]) {
    g.push(box(1.5, 1.0, 0.03, x, 1.95, -7.97, GOLD));
    B.add(1.38, 0.88, x, 1.95, -7.95, 0, (c, W, H) => { const q = rng(x * 10); P.grad(c, W, H, x < 16 ? '#2a0f4a' : '#0f2a4a', x < 16 ? '#ff6a8a' : '#18f0ff'); for (let i = 0; i < 7; i++) { c.fillStyle = NEON[Math.floor(q() * 6)]; c.globalAlpha = 0.6; c.beginPath(); c.arc(q() * W, q() * H, 6 + q() * 20, 0, 6.3); c.fill(); } c.globalAlpha = 1; });
  }
  B.add(2.4, 1.6, 20.97, 1.8, 0.3, -PI / 2, (c, W, H) => P.mirror(c, W, H, ['#2a1440', '#140a24'], [['#ff2bd1', 8], ['#18f0ff', 6], ['#ffb070', 6]], 9));
  g.push(box(0.03, 1.72, 2.52, 20.98, 1.8, 0.3, GOLD));
  plant(g, 11.6, -7.4, 1.2, '#3a1a5a', '#2f9f6a', 0); plant(g, 20.4, 2.0, 1.2, '#3a1a5a', '#2f9f6a', 0);
  room.blocks.push({ x0: 11.25, x1: 11.95, z0: -7.75, z1: -7.05 }, { x0: 20.05, x1: 20.75, z0: 1.65, z1: 2.35 });
  for (const z of [-6.0, -1.7]) g.push(box(0.12, 0.3, 0.12, 20.92, 2.5, z, GOLD), cyl(0.12, 0.08, 0.2, 8, 20.85, 2.7, z, '#ffd9a0'));
  pools.push(disc(20.95, 2.5, -6.0, 0.9, '#ffb070', 0.45, '-x'), disc(20.95, 2.5, -1.7, 0.9, '#ffb070', 0.45, '-x'));
  // a rug at the coat check, pipes and ducts up in the dark ceiling
  rug(g, 2.4, 3.4, -8.6, 6.4, '#2a1050', '#3a1a6a', '#a98bff', 'zigzag', PI / 2);
  pipe(g, -10.6, -7.6, -10.6, 7.6, 5.75, 0.09, '#2a2540'); pipe(g, -10.3, -7.6, -10.3, 7.6, 5.75, 0.06, '#3a3550'); pipe(g, -10.8, 7.6, 10.8, 7.6, 5.75, 0.12, '#2a2540');
  pools.push(disc(-8.9, 1.22, -2.6, 2.0, '#18f0ff', 0.25));
  room.lights = [{ x: 0, y: 2, z: -6, hex: '#a98bff', r: 8, k: 0.6 }, { x: -9, y: 2, z: -2.6, hex: '#18f0ff', r: 5, k: 0.5 }, { x: 0, y: 1, z: -0.9, hex: '#ff2bd1', r: 7, k: 0.5 },
    { x: 8.9, y: 1.5, z: 6.5, hex: '#ffd166', r: 4, k: 0.5 }, { x: 16, y: 1.5, z: -3, hex: '#ff6ab0', r: 6, k: 0.5 }, { x: -8, y: 1.5, z: 6.5, hex: '#a98bff', r: 4, k: 0.5 }];
  room.amb = 0.78; room.ambCol = '#e0d8ff';
}

// ---- Zigzag Threads --------------------------------------------------------------------------------------------
function wear(room) {
  const g = room.geo, B = room.boards = boards(1024), pools = room.pools, hi = room.hiPools;
  // reflections in the three-panel mirror
  for (const [x, ry] of [[-3.5, 0.5], [-2.2, 0], [-0.9, -0.5]]) {
    const cz = -4.2 + Math.abs(ry) * 0.6, nx = Math.sin(ry), nz = Math.cos(ry);
    B.add(1.12, 2.4, x + nx * 0.035, 1.45, cz + nz * 0.035, ry, (c, W, H) => P.mirror(c, W, H, ['#d8f0ff', '#a8c8e8'], [['#ff9a5c', 6], ['#ff2bd1', 4], ['#18f0ff', 4], ['#fff6ec', 6]], Math.round(x * 10)));
  }
  // the shop's name in neon over the dado, a sale sign behind the counter on a dark board (Mimi reads against it)
  B.add(3.4, 0.55, 2.6, 3.76, -4.47, 0, (c, W, H) => P.neon(c, W, H, 'Zigzag Threads', '#ff2bd1', { size: 0.6 }), 160);
  B.add(2.4, 1.0, 3.3, 2.35, -4.47, 0, (c, W, H) => {
    P.fill(c, W, H, '#3a1d6a'); P.frame(c, W, H, '#ffe14a', 5);
    P.text(c, 'SUMMER SALE', W / 2, H * 0.24, H * 0.2, '#ffe14a', { italic: true, glow: 6 });
    P.text(c, '2 FOR 1 LEG WARMERS', W / 2, H * 0.52, H * 0.11, '#fff6ec'); P.text(c, 'SHOULDER PADS: EXTRA LARGE', W / 2, H * 0.72, H * 0.085, '#18f0ff'); P.text(c, 'NO SKATES IN THE FITTING ROOM', W / 2, H * 0.88, H * 0.065, '#ff9ac8');
  });
  // shelves of folded tees and a sneaker wall on the back wall, left of the mirror
  g.push(box(1.6, 0.04, 0.35, -5.0, 2.3, -4.32, '#fff6ec'), box(1.6, 0.04, 0.35, -5.0, 1.65, -4.32, '#fff6ec'));
  for (let i = 0; i < 6; i++) for (const y of [1.67, 2.32]) g.push(box(0.22, 0.12, 0.28, -5.6 + i * 0.24, y + 0.08, -4.3, NEON[(i + (y > 2 ? 3 : 0)) % 6]), box(0.22, 0.02, 0.28, -5.6 + i * 0.24, y + 0.15, -4.3, '#fff6ec'));
  // posters by the door, track lights with cones, a zigzag rug, plants, a spinning sunglasses stand
  B.add(1.0, 1.4, 2.4, 2.2, 4.46, PI, (c, W, H) => { P.grad(c, W, H, '#ff9a5c', '#ff2bd1'); P.text(c, "SUMMER '86", W / 2, H * 0.12, H * 0.1, '#fff6ec', { italic: true }); P.text(c, 'LOOKBOOK', W / 2, H * 0.22, H * 0.09, '#ffe14a'); c.fillStyle = '#18f0ff'; c.fillRect(W * 0.36, H * 0.35, W * 0.28, H * 0.3); c.fillStyle = '#c98d62'; c.fillRect(W * 0.42, H * 0.27, W * 0.16, H * 0.1); c.fillStyle = '#22203a'; c.fillRect(W * 0.38, H * 0.65, W * 0.1, H * 0.25); c.fillRect(W * 0.52, H * 0.65, W * 0.1, H * 0.25); });
  B.add(1.0, 1.4, -2.4, 2.2, 4.46, PI, (c, W, H) => { P.grad(c, W, H, '#18f0ff', '#7a3cff'); P.text(c, 'NEW IN', W / 2, H * 0.14, H * 0.12, '#fff6ec', { italic: true, glow: 6 }); P.text(c, 'THE NEON SLIP', W / 2, H * 0.28, H * 0.08, '#ffe14a'); c.fillStyle = '#ff2bd1'; c.beginPath(); c.moveTo(W * 0.4, H * 0.38); c.lineTo(W * 0.6, H * 0.38); c.lineTo(W * 0.7, H * 0.85); c.lineTo(W * 0.3, H * 0.85); c.fill(); });
  rug(g, 2.0, 3.4, 0.9, 1.4, '#ff2bd1', '#fff6ec', '#18f0ff', 'zigzag', PI / 2);
  plant(g, -5.4, 3.9, 1.1, '#ff9a5c', '#2f9f6a', 0); plant(g, 5.4, 3.9, 1.1, '#18f0ff', '#2f9f6a', 1);
  room.blocks.push({ x0: -5.75, x1: -5.05, z0: 3.55, z1: 4.25 }, { x0: 5.05, x1: 5.75, z0: 3.55, z1: 4.25 });
  for (const z of [-1.6, 1.4]) {
    g.push(box(8, 0.05, 0.08, 0, 4.12, z, '#3a3550'));
    for (const x of [-3, -1, 1, 3]) { g.push(cyl(0.07, 0.1, 0.22, 8, x, 3.98, z, '#3a3550', 0.4), cyl(0.07, 0.07, 0.02, 8, x, 3.88, z + 0.05, '#fff3c4')); hi.push(cone(x, 3.88, z, 0.07, 0.7, 2.6, '#fff0d8', 0.25)); pools.push(disc(x, 0.012, z, 0.9, '#ffe0c0', 0.3)); }
  }
  const sx = 1.5, sz = 0.2;
  g.push(cyl(0.25, 0.3, 0.05, 10, sx, 0.025, sz, CHROME), cyl(0.025, 0.025, 1.7, 6, sx, 0.85, sz, CHROME));
  const spin = [];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) { const a = j * PI / 2 + k * 0.4; spin.push(box(0.16, 0.05, 0.02, Math.cos(a) * 0.17, 0.9 + k * 0.22, Math.sin(a) * 0.17, NEON[(j + k) % 6], 0, -a + PI / 2), box(0.17, 0.012, 0.012, Math.cos(a) * 0.16, 0.93 + k * 0.22, Math.sin(a) * 0.16, BLK, 0, -a + PI / 2)); }
  for (let k = 0; k < 4; k++) spin.push(box(0.36, 0.015, 0.36, 0, 0.87 + k * 0.22, 0, CHROME, 0, PI / 4));
  const stand = pulser(spin, 'none');
  stand.position.set(sx, 0, sz);
  room.extras.push(stand);
  room.blocks.push({ x0: sx - 0.3, x1: sx + 0.3, z0: sz - 0.3, z1: sz + 0.3 });
  pools.push(disc(-2.2, 0.23, -2.6, 1.0, '#ffd0e8', 0.35), disc(2.6, 3.76, -4.46, 1.7, '#ff2bd1', 0.25, 'z'));
  room.lights = [{ x: -2.2, y: 3.5, z: -2.0, hex: '#fff0e0', r: 5, k: 0.5 }, { x: 3, y: 3.5, z: -2.0, hex: '#ffe0d0', r: 5, k: 0.5 }, { x: 0, y: 3.5, z: 1.4, hex: '#fff0e0', r: 6, k: 0.4 }, { x: 2.6, y: 3.7, z: -4.2, hex: '#ff2bd1', r: 3, k: 0.6 }];
  room.amb = 0.82; room.ambCol = '#fff4f0';
  also(room, (t, dt, still) => { stand.rotation.y += dt * (still ? 0.15 : 0.6); });
}

// ---- Pelican Pantry 24 ---------------------------------------------------------------------------------------------
function mart(room) {
  const g = room.geo, B = room.boards = boards(2048), pools = room.pools;
  // painted shelf fronts on both sides of both aisles (the packs used to be loose blocks)
  [-3.2, -0.4].forEach((x, ai) => {
    for (const sx of [-1, 1]) {
      B.add(3.6, 1.45, x + sx * 0.455, 0.95, -0.3, sx > 0 ? PI / 2 : -PI / 2, (c, W, H) => P.products(c, W, H, 10 + ai * 2 + (sx > 0 ? 1 : 0), { rows: 3, names: ai ? ['SUN', 'SHINE', 'SPF 8', 'SUDS', 'FOAM', 'WAX', 'GLO'] : ['CRUNCH', 'POP', 'ZING', 'WAVE', 'O-BITS', 'MEGA', 'CHOC'] }), 120);
      for (const y of [0.24, 0.72, 1.2]) g.push(box(0.06, 0.05, 3.6, x + sx * 0.47, y, -0.3, '#ff8fc4'));
    }
    // a hanging aisle sign at the front end
    g.push(cyl(0.008, 0.008, 0.6, 4, x - 0.5, 3.7, 1.7, CHROME), cyl(0.008, 0.008, 0.6, 4, x + 0.5, 3.7, 1.7, CHROME));
    B.add(1.3, 0.45, x, 3.2, 1.72, 0, (c, W, H) => { P.fill(c, W, H, '#27c9bf'); P.frame(c, W, H, '#fff6ec', 4); P.text(c, ai ? '2' : '1', W * 0.12, H / 2, H * 0.6, '#ffe14a'); P.text(c, ai ? 'HOME & BEACH' : 'SNACKS & SWEETS', W * 0.58, H / 2, H * 0.3, '#fff6ec', { max: W * 0.72 }); });
  });
  // the fridge wall: the drinks behind the glass are painted, a frost sheen, the motors hum
  for (let i = 0; i < 6; i++) {
    const x = -4.9 + i * 1.5;
    B.add(1.28, 2.38, x, 1.3, -3.89, 0, (c, W, H) => {
      P.grad(c, W, H, '#e8fbff', '#a8e8ff');
      const q = rng(i + 3);
      for (let s = 0; s < 4; s++) { const y1 = H * (0.25 + s * 0.24); c.fillStyle = '#c9d8e6'; c.fillRect(0, y1, W, 3); for (let k = 0; k < 5; k++) { const col = NEON[Math.floor(q() * 6)], cx = W * (0.1 + k * 0.2), w = W * 0.12, h = H * (0.13 + q() * 0.06); if (q() < 0.5) { c.fillStyle = col; c.fillRect(cx - w / 2, y1 - h, w, h); c.fillStyle = '#ffffffaa'; c.fillRect(cx - w / 2, y1 - h * 0.6, w, h * 0.2); } else { c.fillStyle = col; c.fillRect(cx - w * 0.35, y1 - h, w * 0.7, h); c.fillRect(cx - w * 0.15, y1 - h * 1.25, w * 0.3, h * 0.3); c.fillStyle = '#fff'; c.fillRect(cx - w * 0.35, y1 - h * 0.55, w * 0.7, h * 0.18); } } }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(W * 0.1, 0); c.lineTo(W * 0.3, 0); c.lineTo(W * 0.05, H); c.lineTo(0, H); c.fill();
      P.text(c, ['POP', 'FIZZ', 'COLD', 'ICE', 'MILK', 'JUICE'][i], W / 2, H * 0.05, H * 0.035, '#27a8c8');
    }, 90);
  }
  // the front: an OPEN 24 HOURS neon, a magazine rack, a gumball machine, a wet-floor sign and a door mat
  B.add(2.0, 0.6, 3.6, 3.0, 4.46, PI, (c, W, H) => P.neon(c, W, H, 'Open 24 Hours', '#5dff9a', { size: 0.5 }), 160);
  g.push(box(0.5, 1.4, 1.6, -5.65, 0.7, 2.6, '#c9c0d8'));
  for (const y of [0.5, 0.95, 1.4]) g.push(box(0.12, 0.04, 1.6, -5.36, y, 2.6, '#fff6ec'));
  B.add(1.55, 1.3, -5.39, 0.95, 2.6, PI / 2, (c, W, H) => {
    P.fill(c, W, H, '#d8d4e6');
    const T = [['SURF WEEKLY', '#18f0ff'], ['SYNTH MONTHLY', '#ff2bd1'], ['PET ROCK DIGEST', '#ffd447'], ['ROLLER NEWS', '#ff6a3d'], ['TV STARS', '#8dff5a'], ['TOTALLY TEEN', '#b388ff']];
    T.forEach(([nm, col], i) => { const x = W * (0.03 + (i % 3) * 0.33), y = H * (0.02 + Math.floor(i / 3) * 0.34), w = W * 0.29, h = H * 0.3; c.fillStyle = col; c.fillRect(x, y, w, h); c.fillStyle = '#fff6ec'; c.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.5); P.text(c, nm, x + w / 2, y + h * 0.15, h * 0.1, '#22203a', { max: w * 0.92 }); });
  });
  room.blocks.push({ x0: -6, x1: -5.3, z0: 1.75, z1: 3.45 });
  g.push(cyl(0.14, 0.18, 0.75, 10, 2.2, 0.375, 2.9, '#ff3f6a'), cyl(0.22, 0.22, 0.42, 14, 2.2, 0.96, 2.9, '#e8fbff'), cyl(0.09, 0.11, 0.08, 10, 2.2, 1.2, 2.9, '#ff3f6a'));
  for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = 0.05 + (i % 3) * 0.05; g.push(box(0.06, 0.06, 0.06, 2.2 + Math.cos(a) * rr, 0.82 + (i % 4) * 0.07, 2.9 + Math.sin(a) * rr, NEON[i % 6])); }
  room.blocks.push({ x0: 1.95, x1: 2.45, z0: 2.65, z1: 3.15 });
  g.push(box(0.45, 0.6, 0.02, -4.6, 0.32, -3.0, '#ffe14a', 0.25), box(0.45, 0.6, 0.02, -4.6, 0.32, -3.28, '#ffe14a', -0.25));
  B.add(0.3, 0.25, -4.6, 0.4, -2.9, 0, (c, W, H) => { c.clearRect(0, 0, W, H); P.text(c, 'WET', W / 2, H * 0.3, H * 0.32, '#22203a'); P.text(c, 'FLOOR', W / 2, H * 0.72, H * 0.3, '#22203a'); });
  rug(g, 2.4, 1.0, 0, 3.7, '#1f5a66', '#27c9bf', '#5dff9a', 'stripes');
  // a round security mirror up in the back corner, price cards on the counter wall, a slush sign
  B.add(0.8, 0.8, -5.55, 3.25, -3.55, PI / 4, (c, W, H) => { c.clearRect(0, 0, W, H); const gr = c.createRadialGradient(W * 0.4, H * 0.4, 2, W / 2, H / 2, W / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#bfeee2'); gr.addColorStop(1, '#5a8a8a'); c.fillStyle = gr; c.beginPath(); c.arc(W / 2, H / 2, W * 0.47, 0, 6.3); c.fill(); c.filter = 'blur(3px)'; for (let i = 0; i < 8; i++) { c.fillStyle = NEON[i % 6]; c.fillRect(W * (0.2 + i * 0.07), H * 0.5, W * 0.05, H * 0.15); } c.filter = 'none'; c.strokeStyle = '#3a3550'; c.lineWidth = W * 0.05; c.beginPath(); c.arc(W / 2, H / 2, W * 0.46, 0, 6.3); c.stroke(); });
  g.push(cyl(0.008, 0.008, 1.0, 4, 3.1, 3.5, -0.7, CHROME), cyl(0.008, 0.008, 1.0, 4, 4.1, 3.5, -0.7, CHROME));
  B.add(1.1, 0.5, 3.6, 2.85, -0.7, 0, (c, W, H) => { P.fill(c, W, H, '#ff4fa3'); P.text(c, 'SLUSH', W / 2, H * 0.36, H * 0.38, '#fff6ec', { italic: true }); P.text(c, '2 FOR $1', W / 2, H * 0.76, H * 0.24, '#ffe14a'); });
  // one of the ceiling tubes is on its way out
  const tube = pulser([box(1.6, 0.05, 0.12, -3.2, 3.86, 3, '#ffffff'), box(1.6, 0.05, 0.12, 1.6, 3.86, 3, '#ffffff')], 'flicker', 13);
  room.extras.push(tube);
  for (const z of [-2, 0.5]) for (const x of [-3.2, 1.6]) pools.push(disc(x, 0.012, z, 1.6, '#e8fff8', 0.18));
  pools.push(disc(-1.15, 0.012, -3.4, 3.2, '#a8f0ff', 0.25), disc(3.6, 1.65, -0.6, 0.7, '#ff4fa3', 0.35));
  room.lights = [{ x: -3.2, y: 3.7, z: -2, hex: '#f0fff8', r: 5, k: 0.35 }, { x: 1.6, y: 3.7, z: 0.5, hex: '#f0fff8', r: 5, k: 0.35 }, { x: -1.2, y: 1.3, z: -3.6, hex: '#a8f0ff', r: 4, k: 0.5 }, { x: 5, y: 2.5, z: 0.6, hex: '#ffe0a0', r: 3.5, k: 0.4 }];
  room.amb = 0.86; room.ambCol = '#f4fff8';
  also(room, (t, dt, still) => tube.userData.tick(t, still));
}

// ---- Volt & Spark Supply ---------------------------------------------------------------------------------------------
function arms(room) {
  const g = room.geo, B = room.boards = boards(1024), pools = room.pools, hi = room.hiPools;
  // VOLT and SPARK either side of the neon bolt
  B.add(1.9, 0.55, -1.55, 3.75, -4.43, 0, (c, W, H) => P.neon(c, W, H, 'VOLT', '#3ad6ff', { size: 0.7, italic: true }), 160);
  B.add(1.9, 0.55, 1.6, 3.75, -4.43, 0, (c, W, H) => P.neon(c, W, H, 'SPARK', '#ff2bd1', { size: 0.7, italic: true }), 160);
  // safety posters, a TEST LANE sign over the target, a pegboard of tools, a hazard mat at the counter
  B.add(1.0, 1.3, -5.94, 2.6, -0.4, PI / 2, (c, W, H) => { P.fill(c, W, H, '#ffe14a'); P.frame(c, W, H, BLK, 8); P.text(c, 'GOGGLES', W / 2, H * 0.2, H * 0.13, BLK); P.text(c, 'ON!', W / 2, H * 0.34, H * 0.13, '#ff3f6a'); c.fillStyle = BLK; c.fillRect(W * 0.2, H * 0.48, W * 0.6, H * 0.14); c.fillStyle = '#18f0ff'; c.fillRect(W * 0.26, H * 0.51, W * 0.2, H * 0.08); c.fillRect(W * 0.54, H * 0.51, W * 0.2, H * 0.08); P.text(c, 'FINGERS OFF', W / 2, H * 0.76, H * 0.08, BLK); P.text(c, 'THE GLOWY ONES', W / 2, H * 0.86, H * 0.08, BLK); });
  B.add(1.4, 0.4, 5.94, 3.25, 0.6, -PI / 2, (c, W, H) => { P.fill(c, W, H, '#141a30'); P.text(c, 'TEST LANE', W / 2, H / 2, H * 0.55, '#8dff5a', { glow: 8 }); });
  for (let i = 0; i < 5; i++) g.push(box(0.5, 0.012, 0.08, 2.4 + i * 0.6, 0.006, 0.6, i % 2 ? '#ffe14a' : BLK));
  B.add(1.6, 1.3, 5.94, 2.2, -2.7, -PI / 2, (c, W, H) => {
    P.fill(c, W, H, '#c8945e'); c.fillStyle = '#8a5a3a'; for (let y = 8; y < H; y += 12) for (let x = 8; x < W; x += 12) c.fillRect(x, y, 3, 3);
    c.fillStyle = '#3a3550'; c.fillRect(W * 0.1, H * 0.1, W * 0.08, H * 0.4); c.fillRect(W * 0.06, H * 0.1, W * 0.16, H * 0.08);
    c.fillStyle = '#ff3f6a'; c.fillRect(W * 0.3, H * 0.15, W * 0.06, H * 0.3); c.fillStyle = '#c9c0d8'; c.fillRect(W * 0.31, H * 0.45, W * 0.04, H * 0.15);
    c.fillStyle = '#ffe14a'; c.fillRect(W * 0.5, H * 0.1, W * 0.2, H * 0.12); c.fillStyle = '#22203a'; c.fillRect(W * 0.58, H * 0.22, W * 0.04, H * 0.2);
    c.strokeStyle = '#ff8a3d'; c.lineWidth = 6; c.beginPath(); c.arc(W * 0.82, H * 0.3, W * 0.08, 0, 6.3); c.stroke();
    for (let i = 0; i < 5; i++) { c.fillStyle = NEON[i]; c.fillRect(W * (0.1 + i * 0.17), H * 0.65, W * 0.1, H * 0.25); }
  });
  B.add(1.2, 1.4, 2.4, 2.2, 4.46, PI, (c, W, H) => { P.fill(c, W, H, '#ff3f6a'); P.text(c, 'BANGS ARE', W / 2, H * 0.22, H * 0.1, '#fff6ec'); P.text(c, 'FOR THE ROAD', W / 2, H * 0.34, H * 0.1, '#ffe14a'); P.text(c, 'NOT THE', W / 2, H * 0.55, H * 0.1, '#fff6ec'); P.text(c, 'BOARDWALK', W / 2, H * 0.67, H * 0.1, '#ffe14a'); P.text(c, '— ZIZI', W * 0.7, H * 0.86, H * 0.07, '#fff6ec', { italic: true }); });
  for (let i = 0; i < 12; i++) g.push(box(0.4, 0.012, 0.9, -2.2 + i * 0.4, 0.006, -0.72, i % 2 ? '#ffe14a' : BLK));
  // a plasma globe on the counter (it cycles colour), pipes and a cable tray on the ceiling, plants
  g.push(cyl(0.12, 0.16, 0.12, 10, 0.9, 1.18, -1.6, BLK), cyl(0.05, 0.08, 0.06, 8, 0.9, 1.27, -1.6, '#3a3550'));
  const globe = plasma(0.2, 0.9, 1.48, -1.6);
  room.extras.push(globe);
  pools.push(disc(0.9, 1.125, -1.6, 0.6, '#d080ff', 0.6));
  pipe(g, -5.8, -3.6, 5.8, -3.6, 3.95, 0.07, '#8a95b0'); pipe(g, -5.8, 2.6, 5.8, 2.6, 3.95, 0.1, '#6a7590');
  g.push(box(11, 0.05, 0.3, 0, 3.86, 0.4, '#5a6580'));
  plant(g, 5.4, 3.8, 1, '#3ad6ff', '#3faf6a', 1); plant(g, -5.4, 3.8, 1.1, '#ff2bd1', '#2f9f6a', 0);
  room.blocks.push({ x0: 5.05, x1: 5.75, z0: 3.45, z1: 4.15 }, { x0: -5.75, x1: -5.05, z0: 3.45, z1: 4.15 });
  for (const x of [-3, 0, 3]) for (const z of [-2.6, 0.4, 3]) { pools.push(disc(x, 0.012, z, 1.5, '#ffffff', 0.12)); hi.push(cone(x, 4.14, z, 0.8, 1.3, 1.4, '#f0f8ff', 0.08)); }
  pools.push(disc(0, 2, -4.38, 3.4, '#3ad6ff', 0.18, 'z'));
  room.lights = [{ x: 0, y: 2, z: -4, hex: '#3ad6ff', r: 5, k: 0.4 }, { x: 0.9, y: 1.5, z: -1.6, hex: '#d080ff', r: 2.5, k: 0.7 }, { x: 0, y: 3.8, z: 0.4, hex: '#ffffff', r: 7, k: 0.3 }, { x: -5, y: 1.5, z: 1, hex: '#ffb070', r: 4, k: 0.3 }];
  room.amb = 0.85; room.ambCol = '#f0f6ff';
  also(room, (t, dt, still) => globe.userData.tick(t, still));
}
// the plasma globe: a glass sphere whose colour drifts, and a bright core
function plasma(r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: '#c080ff', transparent: true, opacity: 0.75, fog: false }));
  m.position.set(x, y, z);
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
  m.add(core);
  m.userData.tick = (t, still) => { m.material.color.setHSL(0.75 + 0.12 * Math.sin(t * (still ? 0.3 : 1.3)), 0.9, 0.6); core.scale.setScalar(still ? 1 : 1 + 0.15 * Math.sin(t * 9)); };
  return m;
}

export const REDRESS = { bar, club, wear, mart, arms };
