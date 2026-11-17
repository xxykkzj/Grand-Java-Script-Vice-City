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
  }
  // zebra crossings + stop lines at every signalled junction (same numbers as world/roads.js)
  const WH = '#f4eef7';
  for (const s of SIDE_X) {
    for (const [rz, hw, hz, off] of [[blvd.z, 9, 13.8, 2.3], [back1.z, 6, 10.2, 2], [back2.z, 6, 10.2, 2]]) {
      for (const cx of [s - 8.8, s + 8.8]) for (let z = rz - hw + 0.4; z < rz + hw - 0.5; z += 1.6) rect(cx - 1.6, z, cx + 1.6, z + 0.8, WH);
      rect(s - 11.4, rz, s - 11, rz + hw - (hw > 6 ? 4.6 : 0.3), WH); rect(s + 11, rz - hw + (hw > 6 ? 4.6 : 0.3), s + 11.4, rz, WH);
      for (const zz of rz > 0 ? [rz - hz + 2.2] : [rz - hz + 2.2, rz + hz - 2.2]) {
        for (let x = s - 5.6; x < s + 5.5; x += 1.6) rect(x, zz - 1.6, x + 0.8, zz + 1.6, WH);
        if (zz < rz) rect(s - 5.7, zz - 2.4, s, zz - 2, WH); else rect(s, zz + 2, s + 5.7, zz + 2.4, WH);
      }
    }
  }

  // kerbs, parking bays, manholes, sidewalk seams, a skate lane and a volleyball court
  const KERB = '#efe6ee';
  for (const rd of [back1, back2]) { rect(-294, rd.z - rd.w / 2 - 0.3, 294, rd.z - rd.w / 2, KERB); rect(-294, rd.z + rd.w / 2, 294, rd.z + rd.w / 2 + 0.3, KERB); }
  for (const s of SIDE_X) for (const [a, b] of [[sideZ0, -74.3], [-61.7, -10.3], [2.3, 43.7]]) { rect(s - sideW / 2 - 0.3, a, s - sideW / 2, b, KERB); rect(s + sideW / 2, a, s + sideW / 2 + 0.3, b, KERB); }
  for (let x = -288; x < 290; x += 4.5) if (!SIDE_X.some((s) => Math.abs(x - s) < 12)) { rect(x, blvd.z - 8.6, x + 0.2, blvd.z - 6.4, '#8f88a0'); rect(x, blvd.z + 6.4, x + 0.2, blvd.z + 8.6, '#8f88a0'); }
  g.globalAlpha = 0.5;
  for (let x = -292; x < 292; x += 4) rect(x, 36.3, x + 0.14, 43.7, '#b9a4b4');
  for (let x = -290; x < 290; x += 6) { rect(x, -13.7, x + 0.14, -10.3, '#b9a4b4'); rect(x, -77.6, x + 0.14, -74.3, '#b9a4b4'); }
  g.globalAlpha = 1;
  for (let i = 0; i < 46; i++) {
    const rd = [blvd, back1, back2][i % 3], x = -280 + r() * 560, z = rd.z + (r() - 0.5) * (rd.w - 4);
    g.fillStyle = '#2a2533'; g.beginPath(); g.arc(X(x), Z(z), 0.55 * S, 0, 6.3); g.fill();
    g.strokeStyle = '#5a5468'; g.lineWidth = 1; g.stroke();
  }
  dashX(71.6, -HX, HX, 2, 2, '#27c9bf', 0.3);                               // skate lane along the promenade
  g.strokeStyle = '#fffaf0'; g.lineWidth = 2; g.strokeRect(X(-49), Z(98), 18 * S, 9 * S);   // volleyball court
  for (let i = 0; i < 60; i++) {                                              // beach towels
    const x = -285 + r() * 570, z = 88 + r() * 44, c = ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c', '#9b7bff', '#ffffff'][i % 6];
    g.save(); g.translate(X(x), Z(z)); g.rotate(r() * 3); g.fillStyle = c; g.fillRect(-3, -1.6, 6, 3.2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-1, -1.6, 2, 3.2); g.restore();
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

// 26 neon signs, billboards and edge signs packed into one 1024x1664 atlas: 2 columns x 13 rows of 512x128.
export const SIGN_ROWS = 13;
export function paintSigns(signs) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = SIGN_ROWS * 128;
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
