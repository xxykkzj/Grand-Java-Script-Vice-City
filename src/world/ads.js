// Billboards, wall ads, the key's venue signs and the stadium scoreboard: one painted atlas, one merged
// mesh for both districts (one draw call), brighter at night. The frames and lamp arms that hold them are
// built into each district's own solid mesh by whoever places them.
import * as THREE from 'three';
import { merge } from '../core/util.js';
import { KEY_SIGNS, KEY_ADS, TEAMS } from './key.js';

export const AD_NAMES = [...KEY_SIGNS, ...KEY_ADS, 'SCOREBOARD', 'VACANCY'];
const ROWS = Math.ceil(AD_NAMES.length / 2);
const FONTS = [
  '900 %px "Arial Black", "Franklin Gothic Heavy", Impact, sans-serif',
  'italic 800 %px "Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  'italic 700 %px Georgia, "Times New Roman", serif',
  '800 %px "Arial Narrow", "Avenir Next Condensed", Impact, sans-serif',
];
// background / text colour pairs for the 80s ads (sunset gradients, chrome-ish lettering)
const AD_STYLE = [
  ['#2a0b5a', '#ff2bd1', '#ffe14a'], ['#ff5fa8', '#ffd447', '#2a0b5a'], ['#0b2a5a', '#18f0ff', '#ffffff'], ['#1d1630', '#8dff5a', '#ff2bd1'],
  ['#ff8a3d', '#ffe14a', '#2a0b5a'], ['#13002e', '#b388ff', '#18f0ff'], ['#27d8cf', '#fff6ec', '#2a0b5a'], ['#2a0b5a', '#ff6a3d', '#ffe14a'],
];

function paintAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = ROWS * 128;
  const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  AD_NAMES.forEach((name, i) => {
    const ox = (i % 2) * 512, oy = Math.floor(i / 2) * 128;
    g.save();
    g.beginPath(); g.rect(ox, oy, 512, 128); g.clip();
    const fit = (text, font, px, max) => { g.font = font.replace('%', px); const tw = g.measureText(text).width; if (tw > max) { px = Math.floor(px * max / tw); g.font = font.replace('%', px); } return px; };
    if (name === 'SCOREBOARD') {
      // amber dot-matrix scoreboard with the invented teams
      g.fillStyle = '#07040f'; g.fillRect(ox, oy, 512, 128);
      g.fillStyle = '#1a1028'; for (let x = 6; x < 512; x += 8) for (let y = 6; y < 128; y += 8) g.fillRect(ox + x, oy + y, 3, 3);
      g.shadowColor = '#ffb000'; g.shadowBlur = 10; g.fillStyle = '#ffcf4a';
      fit(TEAMS.home, FONTS[3], 34, 190); g.fillText(TEAMS.home, ox + 120, oy + 40); g.fillText('3', ox + 120, oy + 92);
      fit(TEAMS.away, FONTS[3], 34, 190); g.fillText(TEAMS.away, ox + 392, oy + 40); g.fillText('1', ox + 392, oy + 92);
      g.fillStyle = '#ff3f6a'; g.font = FONTS[3].replace('%', 30); g.fillText('2ND HALF 67:12', ox + 256, oy + 66);
    } else if (name === 'VACANCY') {
      g.fillStyle = '#0d0820'; g.fillRect(ox, oy, 512, 128);
      g.shadowColor = '#ff2a3a'; g.shadowBlur = 16; g.strokeStyle = '#ff2a3a'; g.lineWidth = 6;
      fit('VACANCY', FONTS[0], 74, 440); g.strokeText('VACANCY', ox + 256, oy + 66); g.fillStyle = '#ffe0e4'; g.fillText('VACANCY', ox + 256, oy + 66);
    } else if (i < KEY_SIGNS.length) {
      // venue signs: neon tube lettering on a dark plate, like the old town's
      const C = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'][i % 6];
      g.fillStyle = '#100a22'; g.fillRect(ox, oy, 512, 128);
      g.shadowColor = C; g.shadowBlur = 14; g.strokeStyle = C; g.lineWidth = 5;
      g.beginPath(); g.roundRect(ox + 14, oy + 14, 484, 100, 30); g.stroke();
      const font = FONTS[(i + 1) % FONTS.length];
      fit(name, font, 62, 430);
      g.shadowBlur = 18; g.lineWidth = 7; g.strokeText(name, ox + 256, oy + 66);
      g.shadowBlur = 6; g.fillStyle = '#fffdf5'; g.fillText(name, ox + 256, oy + 66);
    } else {
      // an 80s billboard: sunset stripes or a grid, a sun, a slogan in two colours
      const [bg, a, b] = AD_STYLE[i % AD_STYLE.length];
      const gr = g.createLinearGradient(0, oy, 0, oy + 128);
      gr.addColorStop(0, bg); gr.addColorStop(1, '#0a0518');
      g.fillStyle = gr; g.fillRect(ox, oy, 512, 128);
      if (i % 2) { g.strokeStyle = a; g.globalAlpha = 0.35; g.lineWidth = 2; for (let x = -256; x < 512; x += 32) { g.beginPath(); g.moveTo(ox + 256, oy + 70); g.lineTo(ox + x * 2, oy + 128); g.stroke(); } for (let y = 80; y < 128; y += 10) { g.beginPath(); g.moveTo(ox, oy + y); g.lineTo(ox + 512, oy + y); g.stroke(); } g.globalAlpha = 1; }
      else { g.fillStyle = a; g.globalAlpha = 0.85; g.beginPath(); g.arc(ox + 430, oy + 64, 40, 0, 6.3); g.fill(); g.globalAlpha = 1; g.fillStyle = bg; for (let y = 64; y < 104; y += 8) g.fillRect(ox + 385, oy + y, 90, 3); }
      const [t1, t2] = name.includes(':') ? name.split(':').map((x) => x.trim()) : [name, ''];
      const font = FONTS[i % FONTS.length];
      g.shadowColor = a; g.shadowBlur = 12; g.fillStyle = '#fffdf5'; g.strokeStyle = a; g.lineWidth = 5;
      const ty = t2 ? 50 : 64;
      fit(t1.toUpperCase(), font, 58, 380); g.strokeText(t1.toUpperCase(), ox + 220, oy + ty); g.fillText(t1.toUpperCase(), ox + 220, oy + ty);
      if (t2) { g.shadowBlur = 4; g.fillStyle = b; fit(t2, FONTS[1], 30, 380); g.fillText(t2, ox + 220, oy + 96); }
    }
    g.restore();
  });
  return cv;
}

// signs: [{ name, x, y, z, yaw, w, h }] (yaw: the way the face looks). Returns { mesh, setLights }.
export function buildAds(scene, signs) {
  const tex = new THREE.CanvasTexture(paintAtlas());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geos = [];
  for (const s of signs) {
    const i = AD_NAMES.indexOf(s.name);
    if (i < 0) continue;
    const g = new THREE.PlaneGeometry(s.w, s.h).toNonIndexed();
    const uv = g.attributes.uv, u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) / ROWS;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v1 - (1 - uv.getY(k)) / ROWS);
    g.rotateY(s.yaw); g.translate(s.x, s.y, s.z);
    geos.push(g);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(merge(geos), mat);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, setLights(k) { mat.color.setScalar(0.55 + k * 0.75); } };
}
