// Every texture in the game is painted here on a 2D canvas at load time.
import { rng } from '../core/util.js';
import { HX, HZ, ROADS, SIDE_X } from './layout.js';

export function paintGround(L) {
  const W = 2048, H = 1024, S = W / (HX * 2);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const r = rng(77);
  const X = (x) => (x + HX) * S, Z = (z) => (z + HZ) * S;
  const rect = (x0, z0, x1, z1, c) => { g.fillStyle = c; g.fillRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S); };
  const speckle = (x0, z0, x1, z1, n, cols, a) => {
    g.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(X(x0 + r() * (x1 - x0)), Z(z0 + r() * (z1 - z0)), 1 + r() * 2, 1 + r() * 2);
    }
    g.globalAlpha = 1;
  };

  // sand everywhere, wetter towards the sea
  rect(-HX, -HZ, HX, HZ, '#f1dcae');
  const wet = g.createLinearGradient(0, Z(118), 0, Z(150));
  wet.addColorStop(0, 'rgba(196,160,112,0)'); wet.addColorStop(1, 'rgba(176,140,104,0.85)');
  g.fillStyle = wet; g.fillRect(0, Z(118), W, Z(150) - Z(118));
  speckle(-HX, -HZ, HX, HZ, 9000, ['#fff3cf', '#d9bf8a', '#e6cc98'], 0.5);

  // city slab + green back lots
  rect(-294, -136, 294, 44, '#d2bfcb');
  rect(-294, -150, 294, -136, '#6cc294');
  for (const b of L.buildings) if (b.row === 2) rect(b.x0 - 2, b.z0 - 5, b.x1 + 2, b.z0, '#6cc294');
  speckle(-294, -150, 294, -136, 1500, ['#4fa77a', '#8fdcae'], 0.6);
  speckle(-294, -136, 294, 44, 5000, ['#bfaab8', '#e2d2dc'], 0.5);

  // promenade: two-tone tiles with a teal kerb stripe
  rect(-HX, 62, HX, 78, '#f9e3e6');
  g.fillStyle = '#f4bfd0';
  for (let x = -HX; x < HX; x += 2) for (let z = 62; z < 78; z += 2) {
    if (((x + HX) / 2 + (z - 62) / 2) % 2 === 0) g.fillRect(X(x), Z(z), 2 * S, 2 * S);
  }
  rect(-HX, 62, HX, 62.5, '#27c9bf'); rect(-HX, 77.5, HX, 78, '#27c9bf');

  // roads
  const ASPH = '#3b3548';
  const { blvd, back1, back2, sideW, sideZ0, sideZ1 } = ROADS;
  for (const s of SIDE_X) rect(s - sideW / 2, sideZ0, s + sideW / 2, sideZ1, ASPH);
  rect(-HX, blvd.z - blvd.w / 2, HX, blvd.z + blvd.w / 2, ASPH);
  for (const rd of [back1, back2]) rect(-294, rd.z - rd.w / 2, 294, rd.z + rd.w / 2, ASPH);
  speckle(-HX, -140, HX, 62, 9000, ['#4a4458', '#2f2a3a'], 0.35);

  // markings
  const dashX = (z, x0, x1, len, gap, c, w = 0.22) => { for (let x = x0; x < x1; x += len + gap) rect(x, z - w / 2, Math.min(x + len, x1), z + w / 2, c); };
  const dashZ = (x, z0, z1, len, gap, c, w = 0.22) => { for (let z = z0; z < z1; z += len + gap) rect(x - w / 2, z, x + w / 2, Math.min(z + len, z1), c); };
  rect(-HX, blvd.z - 0.45, HX, blvd.z - 0.2, '#ffd35c'); rect(-HX, blvd.z + 0.2, HX, blvd.z + 0.45, '#ffd35c');
  dashX(blvd.z - 4.4, -HX, HX, 3, 4, '#f4eef7'); dashX(blvd.z + 4.4, -HX, HX, 3, 4, '#f4eef7');
  rect(-HX, blvd.z - 8.9, HX, blvd.z - 8.6, '#ff8fc4'); rect(-HX, blvd.z + 8.6, HX, blvd.z + 8.9, '#ff8fc4');
  dashX(back1.z, -294, 294, 3, 5, '#f4eef7'); dashX(back2.z, -294, 294, 3, 5, '#f4eef7');
  for (const s of SIDE_X) {
    dashZ(s, sideZ0, -74, 3, 5, '#f4eef7'); dashZ(s, -62, -10, 3, 5, '#f4eef7'); dashZ(s, 2, 40, 3, 5, '#f4eef7');
    // zebra crossings over the boulevard either side of each junction
    for (const cx of [s - 10, s + 10]) for (let z = blvd.z - 8; z < blvd.z + 8; z += 1.6) rect(cx - 1.6, z, cx + 1.6, z + 0.8, '#f4eef7');
  }

  // soft vignette of darker sand at the island rim
  g.strokeStyle = 'rgba(160,125,95,0.5)'; g.lineWidth = 10; g.strokeRect(0, 0, W, H);
  return cv;
}

const FONTS = [
  'italic 700 %px Georgia, "Times New Roman", serif',
  '800 %px "Arial Narrow", "Avenir Next Condensed", "Franklin Gothic Medium", Impact, sans-serif',
  'italic 800 %px "Trebuchet MS", "Segoe UI", Verdana, sans-serif',
];

// 16 neon signs packed into one 1024x1024 atlas: 2 columns x 8 rows of 512x128.
export function paintSigns(signs) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  signs.forEach((s, i) => {
    const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 128;
    g.save();
    g.beginPath(); g.rect(ox, oy, 512, 128); g.clip();
    // tube frame
    g.shadowColor = s.color; g.shadowBlur = 14;
    g.strokeStyle = s.color; g.lineWidth = 5;
    g.beginPath(); g.roundRect(ox + 14, oy + 14, 484, 100, 30); g.stroke();
    // lettering, scaled to fit
    let px = 64;
    const font = FONTS[i % FONTS.length];
    const text = i % 3 === 1 ? s.name.toUpperCase() : s.name;
    g.font = font.replace('%', px);
    const tw = g.measureText(text).width;
    if (tw > 430) { px = Math.floor(px * 430 / tw); g.font = font.replace('%', px); }
    g.shadowBlur = 18;
    g.strokeStyle = s.color; g.lineWidth = 7;
    g.strokeText(text, ox + 256, oy + 66);
    g.shadowBlur = 6;
    g.fillStyle = '#fffdf5';
    g.fillText(text, ox + 256, oy + 66);
    g.restore();
  });
  return cv;
}
