// The old town's character pieces: a seeded variety of silhouettes and façades per lot (rounded corner
// turrets, stepped crowns, vertical neon fins with spires, roof pergolas and rooftop neon pictograms,
// balconies, porthole columns, glass-block strips, eyebrow ledges in several colours, hotel tower tops),
// and the inner streets behind the beachfront: shop fascias with invented names, murals on blank walls,
// café terraces, bus shelters, bike racks, planters, newspaper boxes, street trees in pits, and the alleys
// between the buildings (dumpsters, fire escapes, laundry lines, string lights).
//
// Everything is merged into the town's solid / neon meshes (no extra draw calls) except the shop fascias and
// the murals, which share one painted atlas and one mesh (one draw call). Every spot is checked against the
// carriageways (onRoad), the junctions, the doors and what already stands there; anything standing on the
// ground is registered as a footprint (layout.js FOOTPRINTS) for the road check.
import * as THREE from 'three';
import { box, cyl, tint, merge, rng, PI } from '../core/util.js';
import { onRoad, inJunction, footprint } from './layout.js';
import { kitGeometry } from './kits.js';
import { pickSpecies } from './streettrees.js';

// the old town's street-tree mixes: Back Avenue 1 under coconut palms, Back Avenue 2 under fig trees
const MIX_BACK1 = [['coconut', 0.45], ['jacaranda', 0.2], ['kit', 0.2], ['fan', 0.15]];
const MIX_BACK2 = [['ficus', 0.42], ['kit', 0.2], ['cypress', 0.14], ['seagrape', 0.12], ['royal', 0.12]];

const CREAM = '#fbf7f0', INK = '#1d1630', STEEL = '#b9bcc8', DARK = '#3b3350';
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
// Shop names (all invented). `c`: a café or food place, which may put tables out.
export const SHOPS = [
  { n: 'Seashell Café', c: 1 }, { n: 'Lido Laundromat' }, { n: 'Palmetto Pharmacy' }, { n: 'Tiki Taco Hut', c: 1 },
  { n: 'Vinyl Lagoon' }, { n: 'Sunnyside Bakery', c: 1 }, { n: 'Wavelength TV Repair' }, { n: 'Bayfront Barber' },
  { n: 'Flamingo Florist' }, { n: 'Sandbar Surf Co.' }, { n: 'Neptune Noodles', c: 1 }, { n: 'Gelato Galaxy', c: 1 },
  { n: 'Pink Palm Pawn' }, { n: 'Turquoise Travel' }, { n: 'Mojo Music' }, { n: 'Starfish Shoes' },
  { n: 'Coral Copy Center' }, { n: 'Hibiscus Hair' }, { n: 'Driftwood Deli', c: 1 }, { n: 'Moonbeam Video' },
  { n: 'Calypso Coffee', c: 1 }, { n: 'Sunrise Hardware' }, { n: 'Pastel Pets' }, { n: 'Dolphin Dry Cleaning' },
];
export const SHOP_C = ['#ff4fa3', '#18f0ff', '#ffe14a', '#8dff5a', '#ff8a3d', '#b388ff', '#ff6a8a', '#7fffd0'];
const MURALS = 6;

// ---------------------------------------------------------------- the atlas: shop fascias and murals
// 1024 x 1024: 24 fascias (4 columns x 6 rows of 256 x 42) on top, then 6 murals (2 x 3 of 512 x 256).
const AT = 1024, SW = 256, SH = 42, MW = 512, MH = 256, MY = 256;
export function paintStreetAtlas(shops = SHOPS) {
  const cv = document.createElement('canvas');
  cv.width = AT; cv.height = AT;
  const g = cv.getContext('2d');
  g.fillStyle = '#1d1630'; g.fillRect(0, 0, AT, AT);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const FONT = ['italic 800 %px "Trebuchet MS", Verdana, sans-serif', '800 %px "Arial Narrow", Impact, sans-serif', 'italic 700 %px Georgia, serif'];
  shops.forEach((s, i) => {
    const ox = (i % 4) * SW, oy = Math.floor(i / 4) * SH, c = SHOP_C[i % SHOP_C.length];
    g.save(); g.beginPath(); g.rect(ox, oy, SW, SH); g.clip();
    g.fillStyle = i % 3 === 0 ? '#2a1840' : i % 3 === 1 ? '#13283a' : '#2b1a24'; g.fillRect(ox, oy, SW, SH);
    g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(ox + 3, oy + 3, SW - 6, SH - 6);
    const f = FONT[i % 3], text = i % 2 ? s.n.toUpperCase() : s.n;
    let px = 26; g.font = f.replace('%', px);
    const tw = g.measureText(text).width;
    if (tw > SW - 20) { px = Math.floor(px * (SW - 20) / tw); g.font = f.replace('%', px); }
    g.shadowColor = c; g.shadowBlur = 8; g.fillStyle = c; g.fillText(text, ox + SW / 2, oy + SH / 2 + 1);
    g.shadowBlur = 0; g.fillStyle = '#fffdf5'; g.globalAlpha = 0.55; g.fillText(text, ox + SW / 2, oy + SH / 2 + 1); g.globalAlpha = 1;
    g.restore();
  });
  for (let m = 0; m < MURALS; m++) {
    const ox = (m % 2) * MW, oy = MY + Math.floor(m / 2) * MH;
    g.save(); g.beginPath(); g.rect(ox, oy, MW, MH); g.clip(); g.translate(ox, oy);
    MURAL_PAINT[m](g, MW, MH, rng(600 + m));
    g.restore();
  }
  return cv;
}
const poly = (g, pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const disc = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
function palmSil(g, x, y, s, c) {
  g.strokeStyle = c; g.lineWidth = 6 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 18 * s, y - 70 * s, x + 6 * s, y - 130 * s); g.stroke();
  for (let k = 0; k < 7; k++) {
    const a = -PI / 2 + (k - 3) * 0.48, tx = x + 6 * s + Math.cos(a) * 62 * s, ty = y - 130 * s + Math.sin(a) * 30 * s + 22 * s;
    g.lineWidth = 9 * s; g.beginPath(); g.moveTo(x + 6 * s, y - 130 * s); g.quadraticCurveTo((x + 6 * s + tx) / 2, y - 152 * s, tx, ty); g.stroke();
  }
}
const MURAL_PAINT = [
  // a striped sunset over the sea, palms on the shore, "Greetings from Lumina"
  (g, W, H) => {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#5b2a86'); sky.addColorStop(0.5, '#ff5fa8'); sky.addColorStop(1, '#ffb36b');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    disc(g, W * 0.5, H * 0.6, H * 0.34, '#ffe14a');
    g.fillStyle = '#ff5fa8'; for (let k = 0; k < 5; k++) g.fillRect(0, H * (0.42 + k * 0.045), W, 3 + k * 2);
    g.fillStyle = '#19c9bd'; g.fillRect(0, H * 0.62, W, H);
    g.fillStyle = '#8fe3d9'; for (let k = 0; k < 7; k++) g.fillRect(W * 0.2 + k * 9, H * (0.66 + k * 0.045), W * 0.6 - k * 18, 3);
    palmSil(g, W * 0.1, H, 1.1, '#2a1840'); palmSil(g, W * 0.88, H, 0.9, '#2a1840');
    g.font = 'italic 800 34px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fffdf5'; g.shadowColor = '#2a1840'; g.shadowBlur = 0;
    g.fillText('Greetings from Lumina', W / 2, H * 0.17);
  },
  // two flamingos on mint with confetti
  (g, W, H, r) => {
    g.fillStyle = '#a5e6cf'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 40; k++) { g.save(); g.translate(r() * W, r() * H); g.rotate(r() * 6); g.fillStyle = ['#ffe14a', '#7a5cff', '#ff8a3d', '#fffdf5'][k % 4]; g.fillRect(-7, -2, 14, 4); g.restore(); }
    for (const [x, s, f] of [[W * 0.32, 1, 1], [W * 0.66, 0.85, -1]]) {
      g.save(); g.translate(x, H * 0.55); g.scale(f * s, s);
      g.strokeStyle = '#ff6fae'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 30); g.lineTo(-4, 110); g.moveTo(6, 30); g.lineTo(18, 80); g.lineTo(4, 110); g.stroke();
      g.fillStyle = '#ff7fb6'; g.beginPath(); g.ellipse(0, 0, 58, 34, -0.2, 0, 6.2832); g.fill();
      g.fillStyle = '#ff4fa3'; g.beginPath(); g.ellipse(-18, -4, 34, 18, -0.4, 0, 6.2832); g.fill();
      g.strokeStyle = '#ff7fb6'; g.lineWidth = 12; g.beginPath(); g.moveTo(40, -10); g.bezierCurveTo(80, -40, 40, -110, 70, -120); g.stroke();
      disc(g, 74, -124, 14, '#ff7fb6'); poly(g, [[84, -126], [104, -116], [86, -112]], '#2a1840');
      g.restore();
    }
  },
  // layered waves with foam dots
  (g, W, H) => {
    g.fillStyle = '#fff0b3'; g.fillRect(0, 0, W, H);
    const C = ['#8fe3d9', '#19c9bd', '#4a6fa8', '#2a1840'];
    C.forEach((c, k) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.3 + k * 0.17) + Math.sin(x / (40 + k * 10) + k) * (18 - k * 2));
      g.lineTo(W, H); g.closePath(); g.fill();
      g.fillStyle = '#fffdf5';
      for (let x = 20 + k * 13; x < W; x += 64) disc(g, x, H * (0.3 + k * 0.17) + Math.sin(x / (40 + k * 10) + k) * (18 - k * 2) - 4, 5, '#fffdf5');
    });
    disc(g, W * 0.82, H * 0.16, 26, '#ff8a3d');
  },
  // a neon grid to the horizon, a banded sun and purple hills
  (g, W, H) => {
    g.fillStyle = '#140a2a'; g.fillRect(0, 0, W, H);
    const hz = H * 0.58;
    const sun = g.createLinearGradient(0, hz - 110, 0, hz);
    sun.addColorStop(0, '#ffe14a'); sun.addColorStop(1, '#ff2bd1');
    g.fillStyle = sun; g.beginPath(); g.arc(W / 2, hz, 105, PI, 0); g.fill();
    g.fillStyle = '#140a2a'; for (let k = 0; k < 6; k++) g.fillRect(W / 2 - 110, hz - 12 - k * 14, 220, 3 + k * 0.6);
    poly(g, [[0, hz], [90, hz - 60], [170, hz - 20], [250, hz - 75], [340, hz - 10], [430, hz - 55], [W, hz - 15], [W, hz]], '#5b2a86');
    g.strokeStyle = '#18f0ff'; g.lineWidth = 2;
    for (let k = -12; k <= 12; k++) { g.beginPath(); g.moveTo(W / 2 + k * 14, hz); g.lineTo(W / 2 + k * 70, H); g.stroke(); }
    for (let k = 0; k < 7; k++) { const y = hz + (H - hz) * Math.pow(k / 6, 1.8); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  },
  // monstera leaves and hibiscus on peach
  (g, W, H, r) => {
    g.fillStyle = '#ffc7a0'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      g.save(); g.translate(r() * W, r() * H); g.rotate(r() * 6.28); const s = 0.7 + r() * 0.7; g.scale(s, s);
      g.fillStyle = k % 2 ? '#2f8f4f' : '#3fae6a'; g.beginPath(); g.ellipse(0, 0, 70, 46, 0, 0, 6.2832); g.fill();
      g.strokeStyle = '#ffc7a0'; g.lineWidth = 7; for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(j * 22, 0); g.lineTo(j * 30, j % 2 ? -46 : 46); g.stroke(); }
      g.restore();
    }
    for (let k = 0; k < 6; k++) {
      const x = 40 + r() * (W - 80), y = 30 + r() * (H - 60);
      for (let p = 0; p < 5; p++) { const a = p * 1.2566; g.fillStyle = k % 2 ? '#ff4f6a' : '#ff5fa8'; g.beginPath(); g.ellipse(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 16, 11, a, 0, 6.2832); g.fill(); }
      disc(g, x, y, 6, '#ffe14a');
    }
  },
  // an art-deco sunburst and chevrons
  (g, W, H) => {
    g.fillStyle = '#f6f1e7'; g.fillRect(0, 0, W, H);
    const C = ['#19c9bd', '#ff8fb0', '#ffd447', '#b388ff'];
    for (let k = 0; k < 18; k++) { const a0 = PI + k * PI / 18, a1 = a0 + PI / 18; poly(g, [[W / 2, H], [W / 2 + Math.cos(a0) * W, H + Math.sin(a0) * W], [W / 2 + Math.cos(a1) * W, H + Math.sin(a1) * W]], C[k % 4]); }
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#2a1840' : '#fffdf5'; g.beginPath(); g.arc(W / 2, H, 120 - k * 26, PI, 0); g.fill(); }
    g.fillStyle = '#2a1840'; for (let x = 0; x < W; x += 32) poly(g, [[x, 0], [x + 16, 18], [x + 32, 0], [x + 32, 8], [x + 16, 26], [x, 8]], '#2a1840');
  },
];
// a quad facing yaw (+z at yaw 0), textured from an atlas cell, with a glow factor (fascias light up at night)
export function quad(list, cell, x, y, z, yaw, w, h, glow) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, cell[0] + uv.getX(k) * (cell[2] - cell[0]), cell[3] + uv.getY(k) * (cell[1] - cell[3]));
  g.rotateY(yaw); g.translate(x, y, z);
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(uv.count).fill(glow), 1));
  list.push(g);
}
export const shopCell = (i) => { const ox = (i % 4) * SW, oy = Math.floor(i / 4) * SH; return [ox / AT, 1 - oy / AT, (ox + SW) / AT, 1 - (oy + SH) / AT]; };
export const muralCell = (m) => { const ox = (m % 2) * MW, oy = MY + Math.floor(m / 2) * MH; return [(ox + 2) / AT, 1 - (oy + 2) / AT, (ox + MW - 2) / AT, 1 - (oy + MH - 2) / AT]; };

// The atlas mesh: Lambert-lit (murals are paint on a wall), fascias add their own glow as the neon comes on.
export function streetAtlasMesh(quads, shops = SHOPS) {
  if (!quads.length) return null;
  const tex = new THREE.CanvasTexture(paintStreetAtlas(shops));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const neonK = { value: 0.5 };
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNeonK = neonK;
    sh.vertexShader = 'attribute float aGlow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow;');
    sh.fragmentShader = 'uniform float uNeonK; varying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vGlow * uNeonK;');
  };
  const mesh = new THREE.Mesh(merge(quads), mat);
  mesh.userData.neonK = neonK;
  return mesh;
}

// ---------------------------------------------------------------- per-lot planning (before the town is built)
// Sets on each old-town building: style (the crown), facade (the face treatment), brow (eyebrow colour),
// awn (awning style), shop (fascia name), mural, hotelTop, keep (roof spots the rooftop clutter avoids).
export function planFacades(L) {
  const r = rng(9090);
  const STY = ['plain', 'turret', 'ziggurat', 'fins', 'pergola', 'sign'], FAC = ['none', 'balcony', 'porthole', 'glass', 'balcony', 'porthole'];
  const order = [...L.buildings].sort((a, b) => a.row - b.row || a.cx - b.cx);
  let prevS = null, prevF = null, prevRow = -1, shop = 0, mural = 0;
  const shops = SHOPS.map((s, i) => i).sort(() => r() - 0.5);
  for (const b of order) {
    if (b.row !== prevRow) { prevS = prevF = null; prevRow = b.row; }
    b.keep = [];
    b.brow = [CREAM, CREAM, b.accent, '#ffffff', '#f2d0ec'][Math.floor(r() * 5)];
    b.awn = Math.floor(r() * 4);
    let s = STY[Math.floor(r() * STY.length)];
    if (s === prevS) s = STY[(STY.indexOf(s) + 1 + Math.floor(r() * (STY.length - 1))) % STY.length];
    let f = FAC[Math.floor(r() * FAC.length)];
    if (f === prevF) f = FAC[(FAC.indexOf(f) + 1 + Math.floor(r() * (FAC.length - 1))) % FAC.length];
    if (b.hotel) { b.hotelTop = Math.floor(r() * 4); b.fins = 2 + Math.floor(r() * 3); s = r() < 0.35 ? 'pergola' : 'plain'; f = r() < 0.5 ? 'balcony' : r() < 0.5 ? 'porthole' : 'none'; }
    if (b.name && s === 'ziggurat') s = 'turret';
    if (b.floors < 3 && s === 'turret') s = 'sign';
    b.style = s; b.facade = f; prevS = s; prevF = f;
    if (!b.hotel && !b.place && b.row >= 1) b.shop = shops[shop++ % shops.length];
    // murals on the blank-ish rear walls the back avenues look at (row 0's backs face Back Avenue 1, row 1's
    // face the yards along Back Avenue 2): the windows behind them are left out
    if (b.row < 2 && !b.place && b.w > 15 && r() < 0.5) {
      const mw = Math.min(b.w * 0.6, 14, (b.h - 1.6) * 2), mh = mw / 2, off = (r() - 0.5) * (b.w - mw - 4);
      b.mural = { face: 1, m: mural++ % MURALS, x: b.cx + off, t: -off, hw: mw / 2, w: mw, h: mh, y0: 0.7, y1: 0.7 + mh };
    }
  }
}

// ---------------------------------------------------------------- per-lot geometry (inside the building loop)
export function decorateBuilding(b, S, N, glows, addWin, P, surf) {
  const r = rng(Math.floor(b.cx * 13 + b.cz * 7 + 5000));
  const { cx, w, h, x0, x1, z1 } = b, top = h + 1.4;
  const seg = (ax, ay, bx, by, z, hex, t = 0.1) => N.push(box(Math.hypot(bx - ax, by - ay) + t, t, t, (ax + bx) / 2, (ay + by) / 2, z, hex, 0, 0, Math.atan2(by - ay, bx - ax)));
  // --- crowns
  if (b.style === 'turret') {
    // a rounded corner tower on the right front corner, from the first floor up past the roof, with
    // eyebrow rings, wrap-round windows and a cap
    const R = Math.min(2.8, Math.max(1.8, w * 0.11)), tx = x1 - R * 0.75, tz = z1 - R * 0.75, y0 = 3.4, y1 = h + 3.4;
    S.push(cyl(R, R, y1 - y0, 10, tx, (y0 + y1) / 2, tz, b.color));
    for (let f = 1; f <= b.floors + 1; f++) S.push(cyl(R + 0.2, R + 0.2, 0.2, 10, tx, f * 3.2 + 0.1, tz, b.brow));
    for (let f = 1; f <= b.floors; f++) for (const a of [0.2, 0.85, 1.5]) addWin(tx + Math.sin(a) * (R + 0.03), f * 3.2 + 1.7, tz + Math.cos(a) * (R + 0.03), a, 1.1, 1.5, Math.min(0.99, r() * b.litBias));
    if (r() < 0.5) S.push(tint(new THREE.SphereGeometry(R + 0.1, 10, 4, 0, PI * 2, 0, PI / 2).translate(tx, y1, tz), b.accent));
    else S.push(cyl(R + 0.4, R + 0.4, 0.4, 10, tx, y1 + 0.2, tz, b.accent), cyl(R * 0.55, R * 0.7, 1.2, 8, tx, y1 + 1, tz, b.color), cyl(0.07, 0.07, 2.4, 5, tx, y1 + 2.8, tz, STEEL));
    N.push(cyl(R + 0.26, R + 0.26, 0.12, 10, tx, y1 - 0.5, tz, b.neon));
    glows.push([tx, y1 - 0.5, tz + R, b.neon, 6, 0.05]);
    P.circle(tx, tz, R, y1 + 2, h);
    b.keep.push({ x: tx, z: tz, r: R + 0.5 });
  } else if (b.style === 'ziggurat' && w > 14) {
    // a stepped crown over the front: three tiers, fluting, a neon edge
    const ws = Math.min(w * 0.5, 12), zc = z1 - 1;
    [[1, b.color], [0.68, b.accent], [0.36, CREAM]].forEach(([k, c], i) => {
      S.push(box(ws * k, 1.5, 1.6, cx, h + 0.5 + i * 1.5 + 0.75, zc, c));
      N.push(box(ws * k + 0.08, 0.1, 0.1, cx, h + 0.5 + (i + 1) * 1.5, zc + 0.82, b.neon));
    });
    for (const o of [-0.25, 0, 0.25]) S.push(box(0.2, 4.4, 0.12, cx + o * ws * 0.6, h + 2.6, zc + 0.85, b.brow));
    glows.push([cx, h + 4.6, zc + 1, b.neon, 7, 0.05]);
    P.box(cx, zc, ws, 1.6, h + 5, 0, h);
    b.keep.push({ x: cx, z: zc, r: ws / 2 + 0.5 });
  } else if (b.style === 'fins') {
    // vertical fins up the front, a neon strip down the middle one, a spire over the top
    const n = 3, sp = 1.7, fx = cx + (b.name ? 0 : w * 0.05), y0 = 3.6, y1 = b.name ? h - 0.6 : h + 2.4;
    for (let k = 0; k < n; k++) S.push(box(0.32, y1 - y0, 0.8, fx + (k - 1) * sp, (y0 + y1) / 2, z1 + 0.4, k === 1 ? b.accent : b.brow));
    N.push(box(0.12, y1 - y0 - 0.4, 0.1, fx, (y0 + y1) / 2, z1 + 0.85, b.neon));
    glows.push([fx, (y0 + y1) / 2, z1 + 1.4, b.neon, 10, 0.05]);
    if (!b.name) {
      S.push(cyl(0.5, 0.8, 1.6, 8, fx, h + 1.2, z1 - 0.8, b.accent), cyl(0.06, 0.16, 4, 6, fx, h + 4, z1 - 0.8, STEEL));
      N.push(tint(new THREE.SphereGeometry(0.22, 8, 5).translate(fx, h + 6.1, z1 - 0.8), b.neon));
      glows.push([fx, h + 6.1, z1 - 0.8, b.neon, 3, 0.25]);
      P.circle(fx, z1 - 0.8, 0.8, h + 6, h);
      b.keep.push({ x: fx, z: z1 - 0.8, r: 1.2 });
    }
  } else if (b.style === 'pergola' && w > 14 && b.d > 14) {
    // a roof terrace: a pergola, planters and two loungers, at the front right of the roof
    const px = x1 - 5.2, pz = z1 - 4.6, pw = 6, pd = 5;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { S.push(box(0.16, 2.4, 0.16, px + ox * pw / 2, top + 1.2, pz + oz * pd / 2, CREAM)); P.circle(px + ox * pw / 2, pz + oz * pd / 2, 0.12, top + 2.4, top - 0.2); }
    for (let k = -2; k <= 2; k++) S.push(box(0.12, 0.12, pd + 0.4, px + k * pw / 5, top + 2.45, pz, '#c98a5a'));
    S.push(box(pw + 0.4, 0.14, 0.14, px, top + 2.35, pz - pd / 2, '#c98a5a'), box(pw + 0.4, 0.14, 0.14, px, top + 2.35, pz + pd / 2, '#c98a5a'));
    for (const ox of [-1.3, 1.3]) S.push(box(0.7, 0.12, 1.8, px + ox, top + 0.35, pz, '#fbf7f0'), box(0.66, 0.5, 0.1, px + ox, top + 0.6, pz - 0.85, '#fbf7f0', -0.6));
    for (const ox of [-2.4, 2.4]) { S.push(box(0.8, 0.6, 0.8, px + ox, top + 0.3, pz + 1.8, '#d8d2c8'), tint(new THREE.IcosahedronGeometry(0.5, 0).translate(px + ox, top + 0.9, pz + 1.8), '#3fae6a')); }
    glows.push([px, top + 2.2, pz, '#ffcf8a', 4, 0.05]);
    b.keep.push({ x: px, z: pz, r: 3.6 });
  } else if (b.style === 'sign' && !b.name && w >= 14 && b.d >= 12) {
    // a rooftop neon pictogram on a frame: a palm, a cocktail, a star or a wave
    const sx = cx + w * 0.05, sz = b.z0 + 3.4, y = top + 2.6, C = NEON[Math.floor(r() * 6)], C2 = NEON[Math.floor(r() * 6)], k = Math.floor(r() * 4), z = sz + 0.2;
    S.push(box(4.2, 3.6, 0.12, sx, y, sz, INK), box(0.16, 2, 0.16, sx - 1.6, top + 0.6, sz - 0.1, DARK), box(0.16, 2, 0.16, sx + 1.6, top + 0.6, sz - 0.1, DARK));
    if (k === 0) { seg(sx, y - 1.5, sx + 0.3, y + 0.8, z, '#c98a5a'); for (const a of [-2.4, -1.6, -0.8, 0, 0.8]) seg(sx + 0.3, y + 0.8, sx + 0.3 + Math.cos(a + PI / 2) * 1.4, y + 0.8 + Math.sin(a + PI / 2) * 0.6 - 0.3, z, C); }
    else if (k === 1) { seg(sx - 1, y + 1.2, sx + 1, y + 1.2, z, C); seg(sx - 1, y + 1.2, sx, y, z, C); seg(sx + 1, y + 1.2, sx, y, z, C); seg(sx, y, sx, y - 1.2, z, C); seg(sx - 0.6, y - 1.2, sx + 0.6, y - 1.2, z, C); seg(sx + 0.4, y + 1.6, sx + 0.9, y + 0.7, z, C2); }
    else if (k === 2) { for (let i = 0; i < 5; i++) { const a = PI / 2 + i * 2 * PI / 5, b2 = a + 2 * PI / 5 * 2; seg(sx + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, sx + Math.cos(b2) * 1.4, y + Math.sin(b2) * 1.4, z, C); } }
    else { for (let i = 0; i < 8; i++) seg(sx - 1.6 + i * 0.4, y + Math.sin(i * 0.9) * 0.5, sx - 1.2 + i * 0.4, y + Math.sin((i + 1) * 0.9) * 0.5, z, C); for (let i = 0; i < 8; i++) seg(sx - 1.6 + i * 0.4, y - 0.8 + Math.sin(i * 0.9 + 1) * 0.4, sx - 1.2 + i * 0.4, y - 0.8 + Math.sin((i + 1) * 0.9 + 1) * 0.4, z, C2); }
    glows.push([sx, y, z + 0.6, C, 8, 0.1]);
    P.box(sx, sz, 4.2, 0.6, y + 1.9, 0, top - 0.2);
    b.keep.push({ x: sx, z: sz, r: 2.4 });
  }
  // --- façades
  const fw = b.hotel ? (w - 7) / 2 : w;                     // hotels: the wings either side of the tower
  if (b.facade === 'balcony' && b.floors >= 3) {
    const xs = b.hotel ? [cx - 3 - fw / 2, cx + 3 + fw / 2] : [cx - w * 0.3, ...(b.style === 'turret' ? [] : [cx + w * 0.3])];
    const bw = Math.min(2.8, fw * 0.6);
    for (let f = 1; f < b.floors; f++) for (const x of xs) {
      const y = f * 3.2;
      S.push(box(bw, 0.16, 1.0, x, y + 0.08, z1 + 0.5, b.brow), box(bw, 0.75, 0.05, x, y + 0.55, z1 + 0.98, b.accent), box(bw + 0.06, 0.07, 0.07, x, y + 0.95, z1 + 0.98, CREAM));
    }
  } else if (b.facade === 'porthole' && b.floors >= 2) {
    const x = b.hotel ? cx - 3 - fw / 2 : cx - w * 0.36;
    for (let f = 1; f < b.floors; f++) S.push(cyl(0.62, 0.62, 0.1, 8, x, f * 3.2 + 1.7, z1 + 0.06, b.brow, PI / 2), cyl(0.46, 0.46, 0.14, 8, x, f * 3.2 + 1.7, z1 + 0.08, '#2c5f7a', PI / 2));
  } else if (b.facade === 'glass' && !b.hotel) {
    // a glass-block strip over the entrance, all the way up
    const x = cx - w * 0.2, y0 = 3.4, y1 = h - 1.2;
    if (y1 > y0 + 2) {
      S.push(box(1.5, y1 - y0, 0.14, x, (y0 + y1) / 2, z1 + 0.07, '#bfe6f0'));
      for (let y = y0 + 0.6; y < y1; y += 0.6) S.push(box(1.52, 0.04, 0.16, x, y, z1 + 0.08, '#8fb8c8'));
      S.push(box(0.04, y1 - y0, 0.16, x - 0.25, (y0 + y1) / 2, z1 + 0.08, '#8fb8c8'), box(0.04, y1 - y0, 0.16, x + 0.25, (y0 + y1) / 2, z1 + 0.08, '#8fb8c8'));
      glows.push([x, (y0 + y1) / 2, z1 + 0.6, '#bff4ff', 3, 0]);
    }
  }
}

// ---------------------------------------------------------------- the inner streets and the alleys
export function addStreetscape(L, S, N, glows, quads) {
  const r = rng(7070), P = L.props;
  // what already stands where (loose props, colliders, lamps, palms, trees, booths, doors, venue rings)
  const used = [];
  const mark = (x, z, rr) => used.push([x, z, rr]);
  for (const b of L.loose) mark(b.hx, b.hz, b.r || 0.4);
  for (const o of P.cols) if (!o.y0) { if (o.c) mark(o.x, o.z, o.r); else mark((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, Math.max(o.x1 - o.x0, o.z1 - o.z0) / 2); }
  for (const b of L.booths) mark(b.x, b.z, 0.85);
  for (const k in L.places) mark(L.places[k].x, L.places[k].z, 3);
  for (const k in L.venues || {}) mark(L.venues[k].x, L.venues[k].z, 3);
  if (L.station) mark(L.station.x, L.station.z, 3);
  if (L.clinic) mark(L.clinic.x, L.clinic.z, 3);
  for (const b of L.buildings) if (!b.hotel) mark(b.cx - b.w * 0.2, b.z1 + 1.2, 1.6);       // shop doors
  // rr: clearance from other things; rs: how close to a building wall it may stand (default: up to 0.4 m)
  const free = (x, z, rr, rs = Math.min(rr, 0.4)) => !onRoad(x, z, rr + 0.3) && !inJunction(x, z, rr + 0.5) && used.every(([a, c, d]) => Math.hypot(a - x, c - z) > d + rr + 0.2)
    && !L.solids.some((s) => x > s.x0 - rs && x < s.x1 + rs && z > s.z0 - rs && z < s.z1 + rs);

  // --- street trees in pits (layout.js picked the spots): Kenney suburban trees, a soil pit and a grate
  // each avenue has a dominant species and some variety (world/streettrees.js); the Kenney tree is one of the
  // mix and stays merged into the town mesh, the others are drawn instanced (one draw call per species)
  const tr = rng(4545);
  L.treeInstances = L.treeInstances || [];
  for (const t of L.streetTrees) {
    t.sp = pickSpecies(t.z > 0 ? MIX_BACK1 : MIX_BACK2, tr);
    if (t.sp === 'kit') S.push(kitGeometry(t.kind ? 'treeS' : 'treeL', { scale: (t.kind ? 5.5 : 4.6) * t.s, yaw: t.yaw, x: t.x, z: t.z, recolor: (rr, gg, bb) => (gg > 200 && rr < 170 ? (t.kind ? '#3fae6a' : '#4fbf78') : null) }));
    else L.treeInstances.push({ x: t.x, z: t.z, sp: t.sp, s: t.s, yaw: t.yaw });
    S.push(box(1.3, 0.05, 1.3, t.x, 0.025, t.z, '#4a3626'));
    for (const [ox, oz, ww, dd] of [[0, -0.62, 1.32, 0.08], [0, 0.62, 1.32, 0.08], [-0.62, 0, 0.08, 1.32], [0.62, 0, 0.08, 1.32]]) S.push(box(ww, 0.07, dd, t.x + ox, 0.035, t.z + oz, '#5a5468'));
    footprint('street tree', t.x, t.z, 0.65);
  }

  // --- shop fascias over the awnings, with an invented name each (details.js builds the shopfront)
  for (const b of L.buildings) {
    if (b.shop === undefined) continue;
    const sw = Math.min(b.w * 0.42, 8), sx = b.cx + b.w * 0.17, fw = Math.min(sw + 0.6, 6.2), fh = fw / 6.1;
    S.push(box(fw + 0.2, fh + 0.16, 0.1, sx, 3.78, b.z1 + 0.06, INK));
    quad(quads, shopCell(b.shop), sx, 3.78, b.z1 + 0.12, 0, fw, fh, 1);
    glows.push([sx, 3.78, b.z1 + 0.8, SHOP_C[b.shop % SHOP_C.length], fw * 0.9, 0]);
  }
  // --- murals on the rear walls (planFacades chose them and left the windows out)
  for (const b of L.buildings) {
    const m = b.mural;
    if (!m) continue;
    quad(quads, muralCell(m.m), m.x, (m.y0 + m.y1) / 2, b.z0 - 0.06, PI, m.w, m.h, 0);
    S.push(box(m.w + 0.3, 0.14, 0.12, m.x, m.y1 + 0.1, b.z0 - 0.06, b.brow));
  }

  // --- café terraces: tables with parasols and chairs (loose props) outside the cafés that face a wide
  // sidewalk, and on Back Avenue 1's north side behind the hotels
  const table = (x, z, c) => {
    if (!free(x, z, 0.5) || !free(x - 1.07, z, 0.3) || !free(x + 1.07, z, 0.3)) return false;
    L.loose.push({ kind: 'table', hx: x, hz: z, yaw: 0, r: 0.45, seats: [], color: c }); mark(x, z, 0.5);
    for (const sx of [-1, 1]) {
      const ch = { kind: 'chair', hx: x + sx * 1.07, hz: z, yaw: -sx * PI / 2, r: 0.3, seats: [], color: c };
      ch.seats.push(P.seat(x + sx * 0.95, z, -sx * PI / 2, 0.48, 'chair')); L.loose.push(ch); mark(ch.hx, ch.hz, 0.3);
    }
    return true;
  };
  let terraces = 0;
  for (const b of L.buildings) {
    if (b.shop === undefined || !SHOPS[b.shop].c || b.row !== 2) continue;
    const c = SHOP_C[b.shop % SHOP_C.length];
    for (const ox of [-3.2, 0, 3.2]) if (table(b.cx + b.w * 0.17 + ox, b.z1 + 1.05, c)) terraces++;
  }
  for (const b of L.buildings.filter((q) => q.row === 0 && !q.place).sort((p, q) => Math.abs(p.cx + 60) - Math.abs(q.cx + 60)).slice(0, 3)) {
    for (const ox of [-3.6, 0, 3.6]) if (table(b.cx + ox, b.z0 - 1.25, ['#ff5fa8', '#27d8cf', '#ffd447'][terraces++ % 3])) { /* placed */ }
  }

  // --- bus shelters (roof, glass back, a bench, an ad panel, a stop pole) on the back avenues
  const shelter = (x, z, yaw) => {
    if (!free(x, z, 1.8, 0.75) || onRoad(x, z, 0.9)) return false;
    const s = Math.sin(yaw), c = Math.cos(yaw), at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    const parts = [];
    for (const lx of [-1.5, 1.5]) { const [px, pz] = at(lx, -0.5); parts.push(box(0.1, 2.5, 0.1, px, 1.25, pz, DARK)); }
    { const [px, pz] = at(0, -0.1); parts.push(box(3.3, 0.12, 1.4, px, 2.55, pz, '#19c9bd', 0, yaw)); }
    { const [px, pz] = at(0, -0.62); parts.push(box(3.0, 1.7, 0.05, px, 1.3, pz, '#bfe6f0', 0, yaw)); }
    { const [px, pz] = at(0, -0.3); parts.push(box(2.4, 0.08, 0.42, px, 0.48, pz, '#ff8fb0', 0, yaw), box(2.4, 0.4, 0.06, px, 0.7, pz - c * 0.0, '#ff8fb0', 0, yaw)); }
    { const [px, pz] = at(1.55, -0.05); parts.push(box(0.06, 1.6, 1.0, px, 1.35, pz, INK, 0, yaw)); quad(quads, muralCell(Math.floor(r() * MURALS)), px + c * 0.04, 1.35, pz - s * 0.04, yaw + PI / 2, 0.95, 0.48, 0.6); }
    { const [px, pz] = at(-2.3, 0.35); parts.push(cyl(0.05, 0.05, 2.7, 6, px, 1.35, pz, STEEL), cyl(0.32, 0.32, 0.05, 12, px, 2.75, pz, '#ffd447', 0, PI / 2)); N.push(box(0.5, 0.08, 0.08, px, 2.75, pz, '#ff2bd1', 0, yaw)); P.circle(px, pz, 0.08, 2.8); footprint('bus stop pole', px, pz, 0.08); mark(px, pz, 0.3); }
    S.push(...parts);
    P.box(x - s * 0.5, z - c * 0.5, Math.abs(c) * 3.2 + Math.abs(s) * 0.3, Math.abs(s) * 3.2 + Math.abs(c) * 0.3, 2.6);   // the glass back
    for (const o of [-0.6, 0.6]) { const [px, pz] = at(o, -0.2); P.seat(px, pz, yaw, 0.48, 'bench'); }
    footprint('bus shelter', x, z, 1.5); mark(x, z, 1.8);
    glows.push([x, 2.3, z, '#cfefff', 3.5, 0.02]);
    return true;
  };
  const stops = [];
  for (const [x, z, yaw] of [[-180, 6.1, PI], [10, 6.1, PI], [190, 6.1, PI], [-75, -77.9, 0], [65, -77.9, 0], [235, -77.9, 0]]) {
    for (const dx of [0, 4, -4, 8, -8]) if (shelter(x + dx, z, yaw)) { stops.push([x + dx, z]); break; }
  }

  // --- bike racks, planters and newspaper boxes along the inner sidewalks
  const rack = (x, z) => {
    if (!free(x, z, 1)) return;
    for (let k = 0; k < 4; k++) S.push(box(0.06, 0.8, 0.06, x - 0.75 + k * 0.5, 0.4, z - 0.25, STEEL), box(0.06, 0.8, 0.06, x - 0.75 + k * 0.5, 0.4, z + 0.25, STEEL), box(0.06, 0.06, 0.56, x - 0.75 + k * 0.5, 0.8, z, STEEL));
    S.push(box(1.7, 0.05, 0.06, x, 0.15, z - 0.25, STEEL), box(1.7, 0.05, 0.06, x, 0.15, z + 0.25, STEEL));
    P.box(x, z, 1.7, 0.6, 0.85); footprint('bike rack', x, z, 0.9); mark(x, z, 1);
  };
  for (const x of [-130, -20, 95, 245]) rack(x, 5.9);
  for (const x of [-215, 15, 175]) rack(x, -78);
  const FLOWERS = ['#ff4fa3', '#ffd447', '#ff8a3d', '#b388ff', '#ffffff', '#ff6a8a'];
  const bed = (x, z, w, d) => {
    if (!free(x, z, Math.max(w, d) / 2)) return;
    S.push(box(w, 0.55, d, x, 0.275, z, '#e8d6c8'), box(w + 0.12, 0.08, d + 0.12, x, 0.58, z, '#19c9bd'), box(w - 0.2, 0.05, d - 0.2, x, 0.53, z, '#5a3d2a'));
    P.box(x, z, w, d, 0.6); footprint('planter', x, z, Math.min(w, d) / 2); mark(x, z, Math.max(w, d) / 2);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) L.planters.push({ x: x - w / 2 + (i + 0.5) * w / n, z: z + (r() - 0.5) * 0.15, y: 0.55, s: 0.7 + r() * 0.5, yaw: r() * 6.28, c: FLOWERS[Math.floor(r() * FLOWERS.length)], grass: r() < 0.3 });
  };
  for (const x of [-240, -150, -40, 70, 150, 270]) bed(x, 6.2, 2.6, 0.9);
  for (const x of [-180, -110, 30, 120, 200]) bed(x, -78.3, 2.4, 0.9);
  for (const [x, z] of stops) { const a = [x + (z > 0 ? 2.6 : -2.6), z]; if (free(a[0], a[1], 0.35)) { L.loose.push({ kind: 'news', hx: a[0], hz: a[1], yaw: z > 0 ? PI : 0, r: 0.32, seats: [], color: ['#ff4f6a', '#27c9bf', '#ffd447'][Math.floor(r() * 3)] }); mark(a[0], a[1], 0.4); } }

  // --- the alleys: dumpsters and bags, fire escapes, laundry lines, string lights
  const ALLEY = { dump: 0, esc: 0, laundry: 0, lights: 0 };
  L.alleys.forEach((a, i) => {
    const len = a.z1 - a.z0;
    if (len < 10) return;
    const k = r();
    // a dumpster against one wall, a few bin bags beside it
    if (k < 0.65) {
      const side = r() < 0.5 ? -1 : 1, x = a.x + side * 1.05, z = a.z0 + len * (0.35 + r() * 0.3);
      S.push(box(1.1, 1.15, 1.9, x, 0.68, z, ['#2f8f4f', '#2a5f9a', '#7a3a5a'][i % 3]), box(1.16, 0.08, 1.96, x, 1.3, z, '#22203a', 0, 0, side * 0.12));
      for (const o of [-0.5, 0.5]) S.push(cyl(0.08, 0.08, 0.1, 6, x - side * 0.3, 0.08, z + o * 1.5, '#15131c', 0, PI / 2));
      for (let b = 0; b < 3; b++) S.push(tint(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.8, 1).translate(x - side * 0.1, 0.24, z + 1.35 + b * 0.45), '#2b2440'));
      P.box(x, z, 1.1, 1.9, 1.35); P.box(x - side * 0.1, z + 1.8, 0.7, 1.2, 0.5);
      footprint('dumpster', x, z, 0.55); ALLEY.dump++;
    }
    // a fire escape on one wall from the first floor up: landings, rails, flights, the drop ladder
    const wb = r() < 0.5 ? a.a : a.b, wx = wb === a.a ? a.x0 : a.x1, out = wb === a.a ? 1 : -1;
    if (r() < 0.55 && wb.floors >= 3) {
      const zc = a.z0 + len * (0.25 + r() * 0.5), x = wx + out * 0.5;
      for (let f = 1; f < wb.floors; f++) {
        const y = f * 3.2;
        S.push(box(0.95, 0.06, 2.8, x, y, zc, '#2b2440'), box(0.04, 0.9, 2.8, x + out * 0.47, y + 0.48, zc, '#3b3350'), box(0.06, 0.06, 2.8, x + out * 0.47, y + 0.95, zc, '#3b3350'));
        if (f < wb.floors - 1) S.push(box(0.5, 0.06, 3.9, x - out * 0.15, y + 1.6, zc, '#3b3350', -0.95 * (f % 2 ? 1 : -1) * 0.75));
      }
      S.push(box(0.04, 1.6, 0.04, x + out * 0.3, 3.2 - 0.8, zc + 1.2, '#3b3350'), box(0.04, 1.6, 0.04, x + out * 0.3, 3.2 - 0.8, zc + 1.6, '#3b3350'));
      for (let y = 1.8; y < 3.2; y += 0.35) S.push(box(0.04, 0.04, 0.4, x + out * 0.3, y, zc + 1.4, '#3b3350'));
      ALLEY.esc++;
    }
    // laundry lines across the alley, washing in pastels
    if (r() < 0.4 && a.row > 0) {
      for (const z of [a.z0 + len * 0.4, a.z0 + len * 0.62]) {
        const y = 7.4 + r() * 2.4;
        S.push(box(a.x1 - a.x0, 0.03, 0.03, a.x, y, z, '#e8e0d0'));
        for (let c = 0; c < 4; c++) { const cw = 0.45 + r() * 0.3, ch = 0.5 + r() * 0.5; S.push(box(cw, ch, 0.03, a.x0 + 0.6 + c * 0.85, y - ch / 2 - 0.02, z, ['#ff8fb0', '#8fe3d9', '#fff0b3', '#b3d9f7', '#ffffff', '#ffc7a0'][Math.floor(r() * 6)])); }
      }
      ALLEY.laundry++;
    }
    // string lights zigzagging over the alley (and over the lanes either side of the café blocks)
    if (r() < 0.3 || i % 7 === 3) {
      let side = -1;
      for (let z = a.z1 - 1; z > a.z0 + 3; z -= 4.5) {
        const xa = side < 0 ? a.x0 + 0.1 : a.x1 - 0.1, xb = side < 0 ? a.x1 - 0.1 : a.x0 + 0.1, y = 5.4, z2 = z - 4.5;
        const dx = xb - xa, dz = z2 - z, l = Math.hypot(dx, dz);
        S.push(box(0.025, 0.025, l, (xa + xb) / 2, y - 0.25, (z + z2) / 2, '#22203a', 0, Math.atan2(dx, dz)));
        for (let t = 0.17; t < 1; t += 0.33) N.push(box(0.12, 0.14, 0.12, xa + dx * t, y - 0.32 - Math.sin(t * PI) * 0.35, z + dz * t, ['#ffd166', '#ff8fc4', '#8ff0ff', '#ffe7b0'][Math.floor(t * 5) % 4]));
        glows.push([(xa + xb) / 2, y - 0.6, (z + z2) / 2, '#ffd9a0', 3.2, 0.05]);
        side = -side;
      }
      ALLEY.lights++;
    }
  });
  L.streetStats = { trees: L.streetTrees.length, shops: L.buildings.filter((b) => b.shop !== undefined).length, murals: L.buildings.filter((b) => b.mural).length, stops: stops.length, terraces, ...ALLEY, alleys: L.alleys.length,
    styles: L.buildings.reduce((o, b) => ((o[b.style] = (o[b.style] || 0) + 1), o), {}), facades: L.buildings.reduce((o, b) => ((o[b.facade] = (o[b.facade] || 0) + 1), o), {}) };
}
