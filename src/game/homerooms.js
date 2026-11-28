// The two estate agencies and the four homes you can buy from them (what you DO in them is game/homes.js;
// their street doors are world/homefronts.js). Built like the other rooms (game/interiors.js buildRoom): one
// merged, baked mesh, one painted board atlas, soft light pools, a few animated extras, parked 90 m under the
// street and only drawn while you are inside.
//
// A home can look out: `view` is where the room's origin really is in the world (the studio's balcony over the
// boulevard, the penthouse at the top of its tower, the houseboat on the water). main.js then draws the town
// from there first and the room over it, so the windows show the real coast, its clock and its weather.
// `view.sky` (the villa's open courtyard) draws only the sky dome behind the room.
//
// Extra room fields used here: exit [x, z] (the way-out ring), entry / spawn (the walk-in), bounds, floorAt(lx,
// lz, ly) and ceilAt (stairs, mezzanine, pool), blocks with y0/y1 (only on that level), camFor(lx, lz, ly), tour
// (the agency's viewing: camera shots [x, y, z, lx, ly, lz]), tv (the screen), steam, water.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng } from '../core/util.js';
import { boards, P, plant, rug, fan, pulser, pbox, shadeHex } from './dress.js';
import { buildPenthouse } from './penthouse.js';

export const BLK = '#22203a', GOLD = '#ffd166', CHROME = '#d9d6e6', CREAM = '#fff6ec';
export const disc = (x, y, z, r, hex, k, axis, f) => ({ disc: [x, y, z, r, hex, k, axis, f] });
export const cone = (x, y, z, rt, rb, h, hex, k) => ({ cone: [x, y, z, rt, rb, h, hex, k] });

// ---- the agents ------------------------------------------------------------------------------------------
export const HOME_LOOKS = {
  // Brenda Shore, Coral Keys Realty: a peach blazer with big shoulder pads over a mint blouse, a pencil skirt,
  // a tall frosted-blonde perm, pearl earrings, a gold name badge
  BRENDA: { skin: '#e8b48a', top: '#ffb38a', topPat: 'weave', legs: '#e8b48a', sleeve: '#ffb38a', cuff: '#a8f0dc', shoe: '#ff6a8a', belt: null,
    wear(K, P) {
      const S = '#ffb38a', H = '#f4dc9a';
      P.body.push(K.B(0.2, 0.3, 0.02, 0, 1.3, 0.138, '#a8f0dc', 'knit'), K.B(0.18, 0.12, 0.32, 0.24, 1.47, 0, S, 'seam'), K.B(0.18, 0.12, 0.32, -0.24, 1.47, 0, S, 'seam'),
        K.B(0.07, 0.3, 0.02, 0.09, 1.3, 0.142, shadeHex(S, 0.85), 'plain', { rz: -0.2 }), K.B(0.07, 0.3, 0.02, -0.09, 1.3, 0.142, shadeHex(S, 0.85), 'plain', { rz: 0.2 }),
        K.B(0.07, 0.03, 0.012, -0.12, 1.36, 0.15, GOLD), K.B(0.44, 0.06, 0.26, 0, 1.0, 0, '#2a3a5a'), K.B(0.44, 0.3, 0.27, 0, 0.8, 0, '#2a3a5a', 'weave'));
      P.head.push(K.B(0.38, 0.2, 0.34, 0, 0.38, -0.01, H, 'hair'), K.B(0.26, 0.14, 0.26, 0, 0.5, -0.02, H, 'hair'), K.B(0.1, 0.24, 0.26, 0.18, 0.24, -0.03, H, 'hair'),
        K.B(0.1, 0.24, 0.26, -0.18, 0.24, -0.03, H, 'hair'), K.B(0.36, 0.28, 0.1, 0, 0.2, -0.13, H, 'hair'), K.B(0.24, 0.06, 0.05, 0, 0.312, 0.148, H, 'hair'),
        K.B(0.03, 0.03, 0.03, 0.17, 0.09, 0.02, '#ffffff'), K.B(0.03, 0.03, 0.03, -0.17, 0.09, 0.02, '#ffffff'));
    } },
  // Vaughn Castellane, Skyline Estates: a charcoal double-breasted suit, a lilac shirt and a silver tie, a slick
  // grey side part, a gold watch
  VAUGHN: { skin: '#c98d62', top: '#3a3a48', topPat: 'weave', legs: '#3a3a48', legPat: 'weave', cuff: '#d8c8ff', shoe: '#1b1830', belt: null,
    wear(K, P) {
      const S = '#3a3a48', HR = '#b8b8c4';
      P.body.push(K.B(0.14, 0.3, 0.02, 0, 1.31, 0.137, '#d8c8ff'), K.B(0.05, 0.26, 0.016, 0, 1.28, 0.149, '#c9ccd8', 'stripe'),
        K.B(0.08, 0.3, 0.02, 0.08, 1.3, 0.142, '#2a2a36', 'plain', { rz: -0.24 }), K.B(0.08, 0.3, 0.02, -0.08, 1.3, 0.142, '#2a2a36', 'plain', { rz: 0.24 }),
        K.B(0.025, 0.025, 0.012, 0.05, 1.12, 0.14, GOLD), K.B(0.025, 0.025, 0.012, -0.05, 1.12, 0.14, GOLD), K.B(0.025, 0.025, 0.012, 0.05, 1.04, 0.14, GOLD), K.B(0.025, 0.025, 0.012, -0.05, 1.04, 0.14, GOLD),
        K.B(0.44, 0.08, 0.27, 0, 0.98, 0, S, 'weave'), K.B(0.06, 0.04, 0.012, 0.13, 1.37, 0.142, '#ff6ab0'));
      P.head.push(K.B(0.31, 0.07, 0.29, 0, 0.345, -0.01, HR, 'hair'), K.B(0.22, 0.05, 0.29, 0.05, 0.385, -0.01, HR, 'hair'), K.B(0.31, 0.2, 0.07, 0, 0.21, -0.125, HR, 'hair'),
        K.B(0.03, 0.14, 0.15, 0.155, 0.245, -0.05, HR, 'hair'), K.B(0.03, 0.14, 0.15, -0.155, 0.245, -0.05, HR, 'hair'));
      P.arms((sx) => (sx > 0 ? [K.B(0.14, 0.04, 0.15, 0, -0.45, 0, GOLD)] : []));
    } },
};

// ---- shared pieces ----------------------------------------------------------------------------------------
// one TV picture for whichever home you are in (game/homes.js paints it)
export const TV = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 176; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.keep = true; return { cv, ctx: cv.getContext('2d'), tex }; })();
export function screen(w, h, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#1a1826', fog: false, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 2;
  m.userData.on = (on) => { m.material.map = on ? TV.tex : null; m.material.color.set(on ? '#ffffff' : '#1a1826'); m.material.needsUpdate = true; };
  return m;
}
// a glass pane (the town shows through it, faintly tinted)
export function glass(list) {
  const m = new THREE.Mesh(merge(list), new THREE.MeshBasicMaterial({ color: '#cfefff', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 4;
  return m;
}
export const pane = (w, h, x, y, z, ry = 0) => { const q = new THREE.PlaneGeometry(w, h); q.rotateY(ry); q.translate(x, y, z); return q; };
// steam from a shower or a bath: soft points rising and spreading, shown while it runs (on(k), 0..1)
export function steam(x, y, z, w = 0.9, n = 46) {
  const r = rng(Math.round(x * 31 + z * 7 + 99)), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * w; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (r() - 0.5) * w; ph[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aP', new THREE.BufferAttribute(ph, 1));
  const U = { uT: { value: 0 }, uK: { value: 0 } };
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'attribute float aP; uniform float uT; varying float vA; void main(){ float k = fract(aP + uT * 0.22); vec3 p = position * (0.6 + k * 1.4); p.y = k * 2.1; p.x += sin(uT * 1.3 + aP * 20.0) * 0.12 * k; vA = sin(k * 3.1416); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (40.0 + 90.0 * k) / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uK; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.98, 0.96, (0.5 - d) * vA * uK * 0.75); }',
  }));
  m.position.set(x, y, z); m.frustumCulled = false; m.visible = false; m.renderOrder = 5;
  m.userData.U = U;
  m.userData.on = (k) => { U.uK.value = k; m.visible = k > 0.01; };
  return m;
}
// animated water (the villa's pool, the penthouse's hot tub)
export function water(w, d, x, y, z, deep, shallow) {
  const U = { uT: { value: 0 }, uA: { value: new THREE.Color(deep) }, uB: { value: new THREE.Color(shallow) } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uA, uB; varying vec2 vP;
      void main(){ float c = sin(vP.x * 3.1 + uT * 1.7) * sin(vP.y * 2.7 - uT * 1.3) + sin((vP.x + vP.y) * 4.3 + uT * 2.1) * 0.5;
        float l = smoothstep(0.75, 1.35, c); vec3 col = mix(uA, uB, 0.5 + 0.25 * c) + vec3(0.55, 0.8, 0.9) * l * 0.45;
        gl_FragColor = vec4(col, 0.72); }`,
  }));
  m.position.set(x, y, z); m.renderOrder = 3;
  m.userData.U = U;
  return m;
}
// a framed picture painted on a board
export function picture(g, B, x, y, z, ry, w, h, frame, draw) {
  const nx = Math.sin(ry), nz = Math.cos(ry), across = Math.abs(nz) > 0.5;
  g.push(box(across ? w + 0.1 : 0.04, h + 0.1, across ? 0.04 : w + 0.1, x - nx * 0.01, y, z - nz * 0.01, frame));
  B.add(w, h, x + nx * 0.015, y, z + nz * 0.015, ry, draw);
}
// walls: along x at z (with gaps [[a, b], ...] in x) or along z at x
export function wallX(g, z, x0, x1, y0, y1, hex, gaps = [], t = 0.2) {
  let a = x0;
  for (const [g0, g1, gy0 = y0, gy1 = y1] of [...gaps, [x1, x1]]) {
    if (g0 > a + 0.01) g.push(pbox(g0 - a, y1 - y0, t, (a + g0) / 2, (y0 + y1) / 2, z, hex));
    if (g1 > g0 && gy0 > y0 + 0.01) g.push(pbox(g1 - g0, gy0 - y0, t, (g0 + g1) / 2, (y0 + gy0) / 2, z, hex));
    if (g1 > g0 && gy1 < y1 - 0.01) g.push(pbox(g1 - g0, y1 - gy1, t, (g0 + g1) / 2, (gy1 + y1) / 2, z, hex));
    a = g1;
  }
}
export function wallZ(g, x, z0, z1, y0, y1, hex, gaps = [], t = 0.2) {
  let a = z0;
  for (const [g0, g1, gy0 = y0, gy1 = y1] of [...gaps, [z1, z1]]) {
    if (g0 > a + 0.01) g.push(pbox(t, y1 - y0, g0 - a, x, (y0 + y1) / 2, (a + g0) / 2, hex));
    if (g1 > g0 && gy0 > y0 + 0.01) g.push(pbox(t, gy0 - y0, g1 - g0, x, (y0 + gy0) / 2, (g0 + g1) / 2, hex));
    if (g1 > g0 && gy1 < y1 - 0.01) g.push(pbox(t, y1 - gy1, g1 - g0, x, (gy1 + y1) / 2, (g0 + g1) / 2, hex));
    a = g1;
  }
}
// a floor of tiles (a, b alternate) or planks (b = null) between x0..x1, z0..z1 at height y
export function floor(g, x0, x1, z0, z1, y, a, b, s = 1) {
  if (!b) { for (let z = z0; z < z1 - 0.01; z += 0.3) g.push(box(x1 - x0, 0.1, Math.min(0.29, z1 - z), (x0 + x1) / 2, y - 0.05, z + 0.15, ((z - z0) / 0.3 | 0) % 3 === 1 ? shadeHex(a, 0.93) : a)); return; }
  for (let x = x0; x < x1 - 0.01; x += s) for (let z = z0; z < z1 - 0.01; z += s) {
    const w = Math.min(s, x1 - x), d = Math.min(s, z1 - z);
    g.push(box(w, 0.1, d, x + w / 2, y - 0.05, z + d / 2, (Math.round(x / s) + Math.round(z / s)) % 2 ? a : b));
  }
}
// a sofa (back towards -z before turning by ry) of width w at (x, z)
export function sofa(g, w, x, z, ry, col, cush) {
  const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (ww, hh, dd, lx, y, lz, hex) => { const [px, pz] = at(lx, lz); g.push(box(ww, hh, dd, px, y, pz, hex, 0, ry)); };
  add(w, 0.42, 0.9, 0, 0.21, 0, col); add(w - 0.3, 0.14, 0.72, 0, 0.47, 0.08, cush); add(w, 0.5, 0.22, 0, 0.62, -0.38, col);
  add(0.18, 0.62, 0.9, -w / 2 + 0.09, 0.31, 0, col); add(0.18, 0.62, 0.9, w / 2 - 0.09, 0.31, 0, col);
  for (let i = 0; i < 2; i++) add(0.38, 0.32, 0.12, -w / 4 + i * w / 2, 0.68, -0.25, cush);
}
// a bed (head towards -z before turning): frame, mattress, cover, pillows
export function bed(g, w, l, x, z, ry, frame, cover, pillow = CREAM) {
  const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (ww, hh, dd, lx, y, lz, hex) => { const [px, pz] = at(lx, lz); g.push(box(ww, hh, dd, px, y, pz, hex, 0, ry)); };
  add(w + 0.1, 0.3, l + 0.1, 0, 0.2, 0, frame); add(w, 0.2, l, 0, 0.45, 0, '#fbf7f0'); add(w + 0.04, 0.1, l * 0.66, 0, 0.58, l * 0.17, cover);
  add(w + 0.1, 1.0, 0.1, 0, 0.6, -l / 2 - 0.05, frame);
  if (w > 1.2) { add(w * 0.42, 0.14, 0.38, -w * 0.24, 0.62, -l / 2 + 0.3, pillow); add(w * 0.42, 0.14, 0.38, w * 0.24, 0.62, -l / 2 + 0.3, pillow); } else add(w * 0.8, 0.14, 0.38, 0, 0.62, -l / 2 + 0.3, pillow);
}
export const lamp = (g, x, z, h, shade, pools, hiP) => { g.push(cyl(0.2, 0.24, 0.05, 10, x, 0.025, z, BLK), cyl(0.025, 0.025, h, 6, x, h / 2, z, GOLD), cyl(0.16, 0.3, 0.36, 12, x, h + 0.1, z, shade)); pools.push(disc(x, 0.012, z, 1.3, '#ffd9a0', 0.4)); if (hiP) hiP.push(cone(x, h - 0.05, z, 0.28, 0.9, h - 0.1, '#ffe8c0', 0.3)); };
// a wardrobe against a wall (doors face +z before turning)
function wardrobe(g, B, w, x, z, ry, col, knob = GOLD) {
  const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const add = (ww, hh, dd, lx, y, lz, hex) => { const [px, pz] = at(lx, lz); g.push(box(ww, hh, dd, px, y, pz, hex, 0, ry)); };
  add(w, 2.2, 0.6, 0, 1.1, 0, col); add(w + 0.08, 0.08, 0.66, 0, 2.24, 0, shadeHex(col, 0.8));
  add(0.02, 2.0, 0.02, 0, 1.1, 0.31, shadeHex(col, 0.7)); add(0.03, 0.2, 0.04, -0.08, 1.15, 0.32, knob); add(0.03, 0.2, 0.04, 0.08, 1.15, 0.32, knob);
  const [mx, mz] = at(-w / 4, 0.311);
  B.add(w / 2 - 0.12, 1.5, mx, 1.2, mz, ry, (cv, W, H) => P.mirror(cv, W, H, ['#8aa8c0', '#c8dcec'], [['#ff9ac8', 3], ['#ffe9b0', 2]], 5));
}

// ---- Coral Keys Realty (old town) ----------------------------------------------------------------------------
function buildRealty(room) {
  const g = [], B = room.boards = boards(1024), HX = 6, HZ = 4.5, H = 3.6, pools = room.pools, hi = room.hiPools;
  floor(g, -HX, HX, -HZ, HZ, 0, '#e9d6b6', '#dcc6a2', 1.2);
  wallX(g, -HZ - 0.1, -HX - 0.2, HX + 0.2, 0, H, '#a8e0d0'); wallZ(g, -HX - 0.1, -HZ, HZ, 0, H, '#f6c9b0'); wallZ(g, HX + 0.1, -HZ, HZ, 0, H, '#f6c9b0');
  wallX(g, HZ + 0.1, -HX - 0.2, HX + 0.2, 0, H, '#f6c9b0', [[-0.85, 0.85, 0, 2.7]]);
  g.push(pbox(HX * 2 + 0.4, 0.2, HZ * 2 + 0.4, 0, H + 0.1, 0, '#fbf3e6', 1.5));
  g.push(box(1.7, 2.7, 0.08, 0, 1.35, HZ - 0.02, '#ffa64a'), box(1.9, 0.1, 0.1, 0, 2.75, HZ - 0.06, '#ffb38a'), box(0.1, 2.8, 0.1, -0.9, 1.4, HZ - 0.06, '#ffb38a'), box(0.1, 2.8, 0.1, 0.9, 1.4, HZ - 0.06, '#ffb38a'));
  // a wainscot of pale wood with a teal rail, a peach cornice
  g.push(box(12, 0.9, 0.04, 0, 0.45, -HZ + 0.02, '#e8cfa0'), box(0.04, 0.9, 9, -HX + 0.02, 0.45, 0, '#e8cfa0'), box(0.04, 0.9, 9, HX - 0.02, 0.45, 0, '#e8cfa0'),
    box(12, 0.06, 0.06, 0, 0.92, -HZ + 0.04, '#2fbfb0'), box(0.06, 0.06, 9, -HX + 0.04, 0.92, 0, '#2fbfb0'), box(0.06, 0.06, 9, HX - 0.04, 0.92, 0, '#2fbfb0'),
    box(12, 0.16, 0.06, 0, H - 0.08, -HZ + 0.03, '#ffb38a'));
  // the shop windows either side of the door: wooden blinds with the boulevard's palms showing through
  for (const sx of [-1, 1]) {
    g.push(box(3.4, 2.0, 0.06, sx * 3.4, 1.7, HZ - 0.03, '#c89a68'));
    B.add(3.2, 1.86, sx * 3.4, 1.7, HZ - 0.07, PI, (c, W, Hh) => {
      P.grad(c, W, Hh, '#ff9a6a', '#ffd9a0'); P.palm(c, W * (sx > 0 ? 0.3 : 0.7), Hh * 1.05, Hh * 0.9); c.fillStyle = '#7fd0e8'; c.fillRect(0, Hh * 0.82, W, Hh * 0.18);
      for (let y = 0; y < Hh; y += Hh / 16) { c.fillStyle = 'rgba(214,170,112,.92)'; c.fillRect(0, y, W, Hh / 26); c.fillStyle = 'rgba(120,80,40,.35)'; c.fillRect(0, y + Hh / 26, W, 2); }
      c.fillStyle = '#8a5a30'; c.fillRect(W * 0.2, 0, 2, Hh); c.fillRect(W * 0.8, 0, 2, Hh); P.frame(c, W, Hh, '#f6f1e7', 5);
    });
  }
  // the desk: teak with a mint top, a beige computer with a green screen, a phone, an in-tray, a nameplate
  g.push(box(3.0, 0.78, 1.0, 0, 0.39, -2.4, '#a8744e'), box(3.1, 0.06, 1.1, 0, 0.81, -2.4, '#bff0e0'), box(2.9, 0.62, 0.04, 0, 0.42, -1.88, '#8a5a3a'),
    box(0.55, 0.42, 0.45, 0.8, 1.05, -2.55, '#e8dcc0'), box(0.42, 0.3, 0.02, 0.8, 1.08, -2.32, '#1b3a2a'), box(0.6, 0.05, 0.25, 0.8, 0.86, -2.1, '#e8dcc0'),
    box(0.3, 0.1, 0.22, -0.9, 0.89, -2.3, '#ff6a8a'), box(0.3, 0.06, 0.08, -0.9, 0.97, -2.38, '#ff6a8a'), box(0.42, 0.05, 0.32, -0.25, 0.86, -2.55, '#c8945e'),
    box(0.4, 0.09, 0.03, 0, 0.88, -1.92, GOLD));
  const sc = pulser([box(0.4, 0.28, 0.01, 0.8, 1.08, -2.305, '#5dff9a')], 'pulse', 3); room.extras.push(sc);
  g.push(box(0.7, 0.5, 0.6, 0, 0.5, -3.4, '#ff8a6a'), box(0.7, 0.7, 0.12, 0, 1.0, -3.72, '#ff8a6a'), cyl(0.05, 0.05, 0.25, 6, 0, 0.13, -3.4, CHROME));
  // client chairs in front of the desk
  for (const x of [-0.75, 0.75]) g.push(box(0.6, 0.45, 0.6, x, 0.32, -1.25, '#2fbfb0'), box(0.6, 0.6, 0.1, x, 0.75, -0.98, '#2fbfb0'), box(0.62, 0.08, 0.62, x, 0.56, -1.25, '#7fe8d4'));
  // the wall map of the coast behind the desk: the old town, the causeway, Solano Key, a pin for every home
  B.add(3.6, 1.7, 0, 2.3, -HZ + 0.06, 0, (c, W, Hh) => {
    P.fill(c, W, Hh, '#7fd0e8'); for (let i = 0; i < 9; i++) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); for (let x = 0; x < W; x += 6) c.lineTo(x, Hh * (0.1 + i * 0.1) + Math.sin(x * 0.05 + i) * 3); c.stroke(); }
    c.fillStyle = '#f4e2b0'; c.fillRect(W * 0.58, Hh * 0.25, W * 0.36, Hh * 0.5); c.fillRect(W * 0.06, Hh * 0.2, W * 0.32, Hh * 0.6);
    c.fillStyle = '#ffd9a0'; c.fillRect(W * 0.58, Hh * 0.72, W * 0.36, Hh * 0.06); c.fillStyle = '#c8b8a0'; c.fillRect(W * 0.38, Hh * 0.46, W * 0.2, Hh * 0.04);
    c.fillStyle = '#b8e0a0'; for (let i = 0; i < 6; i++) c.fillRect(W * (0.1 + i * 0.04), Hh * (0.3 + (i % 3) * 0.12), W * 0.03, Hh * 0.08);
    P.text(c, 'LUMINA', W * 0.76, Hh * 0.4, Hh * 0.08, '#8a4a2a'); P.text(c, 'SOLANO KEY', W * 0.22, Hh * 0.3, Hh * 0.08, '#2a5a8a');
    for (const [x, y, col] of [[0.86, 0.66, '#ff3f6a'], [0.64, 0.42, '#ff3f6a'], [0.32, 0.7, '#ffe14a'], [0.12, 0.32, '#ffe14a']]) { c.fillStyle = col; c.beginPath(); c.arc(W * x, Hh * y, Hh * 0.035, 0, 6.3); c.fill(); c.fillStyle = BLK; c.fillRect(W * x - 1, Hh * y, 2, Hh * 0.05); }
    P.text(c, 'CORAL KEYS REALTY · WE KNOW EVERY KEY', W / 2, Hh * 0.92, Hh * 0.06, '#1b3a5a'); P.frame(c, W, Hh, '#c89a68', 8);
  });
  // the left wall: a pinboard of listings with Polaroid photos; the right: SOLD! and the agent of the month
  B.add(3.6, 1.5, -HX + 0.06, 2.0, -0.6, PI / 2, (c, W, Hh) => {
    P.fill(c, W, Hh, '#c8945e'); P.frame(c, W, Hh, '#8a5a30', 6);
    const cols = ['#ff9ac8', '#7fe0ff', '#ffe14a', '#8dffcf', '#ffb38a', '#c8b0ff'];
    for (let i = 0; i < 8; i++) {
      const x = 12 + (i % 4) * (W - 20) / 4, y = 10 + Math.floor(i / 4) * Hh * 0.48, w = (W - 40) / 4, h = Hh * 0.42;
      c.save(); c.translate(x + w / 2, y + h / 2); c.rotate((i % 3 - 1) * 0.04); c.fillStyle = '#fff'; c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = cols[i % 6]; c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.58); c.fillStyle = '#fff6ec'; c.fillRect(-w * 0.2, -h * 0.1, w * 0.4, h * 0.2); c.fillStyle = '#ff6a8a'; c.beginPath(); c.moveTo(-w * 0.25, -h * 0.1); c.lineTo(0, -h * 0.28); c.lineTo(w * 0.25, -h * 0.1); c.fill();
      c.fillStyle = BLK; c.font = `bold ${Math.round(h * 0.11)}px monospace`; c.textAlign = 'center'; c.fillText(['$1,800', '$9,500', '$14,500', '$45,000', 'SOLD', 'LET', '2 BED', 'OCEAN VU'][i], 0, h * 0.32); c.restore();
      c.fillStyle = '#ff3f3a'; c.beginPath(); c.arc(x + w / 2, y + 3, 3, 0, 6.3); c.fill();
    }
  });
  B.add(1.4, 0.7, HX - 0.06, 2.4, -1.6, -PI / 2, (c, W, Hh) => { P.fill(c, W, Hh, '#ff3f5a'); P.frame(c, W, Hh, '#fff6ec', 6); P.text(c, 'SOLD!', W / 2, Hh / 2, Hh * 0.55, '#fff6ec', { italic: true }); });
  picture(g, B, HX - 0.05, 2.1, 1.6, -PI / 2, 1.0, 1.2, GOLD, (c, W, Hh) => { P.grad(c, W, Hh, '#7fd0e8', '#ffd9e0'); c.fillStyle = '#f4dc9a'; c.beginPath(); c.arc(W / 2, Hh * 0.38, W * 0.26, 0, 6.3); c.fill(); c.fillStyle = '#e8b48a'; c.beginPath(); c.arc(W / 2, Hh * 0.42, W * 0.17, 0, 6.3); c.fill(); c.fillStyle = '#ffb38a'; c.fillRect(W * 0.18, Hh * 0.62, W * 0.64, Hh * 0.3); P.text(c, 'AGENT OF THE MONTH', W / 2, Hh * 0.95, Hh * 0.06, BLK); });
  // filing cabinets, a water cooler, the waiting sofa with a magazine table, plants
  for (const x of [-4.9, -4.3]) { g.push(box(0.55, 1.3, 0.6, x, 0.65, -4.1, '#c9c0d8')); for (let k = 0; k < 3; k++) g.push(box(0.4, 0.04, 0.02, x, 0.35 + k * 0.4, -3.79, '#8a8496')); }
  g.push(box(0.4, 0.95, 0.4, 4.9, 0.475, -3.9, '#e8e8f0'), cyl(0.16, 0.16, 0.45, 10, 4.9, 1.2, -3.9, '#9fe0ff'), box(0.06, 0.06, 0.06, 4.9, 0.8, -3.68, '#3a5aff'));
  sofa(g, 2.2, -5.25, 1.4, PI / 2, '#ff9ac8', '#ffd0e4');
  g.push(box(0.9, 0.42, 1.3, -4.0, 0.21, 1.4, '#a8744e'), box(0.95, 0.05, 1.35, -4.0, 0.44, 1.4, '#e8f8f4'), box(0.4, 0.02, 0.3, -4.0, 0.48, 1.2, '#ff6a8a'), box(0.36, 0.02, 0.28, -3.9, 0.5, 1.6, '#7fe0ff'));
  plant(g, 5.3, 3.8, 1.05, '#2fbfb0', '#3faf6a', 0); plant(g, -5.3, -2.6, 0.9, '#ff8a6a', '#2f9f6a', 1); plant(g, 3.0, -4.0, 0.8, '#fff6ec', '#3faf6a', 1);
  rug(g, 3.4, 2.2, 0, -0.6, '#2fbfb0', '#bff0e0', '#ffb38a', 'zigzag');
  const f = fan(g, 0, 0.6, H, '#8a5a3a', '#c8945e'); room.extras.push(f);
  pools.push(disc(0, 0.82, -2.4, 0.8, '#fff0c0', 0.4), disc(0, 0.012, -0.5, 2.6, '#fff0d0', 0.25), disc(-3.4, 1.7, HZ - 0.1, 1.4, '#ffb070', 0.14, '-z'), disc(3.4, 1.7, HZ - 0.1, 1.4, '#ffb070', 0.14, '-z'));
  hi.push(cone(0, H - 0.6, 0.6, 0.3, 1.6, 2.4, '#fff0d0', 0.18));
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#5a3a3a', amb: 0.32, ambCol: '#fff4e4', clerk: 'BRENDA',
    lights: [{ x: 0, y: 2.6, z: -1, hex: '#fff4e0', r: 7, k: 0.45 }, { x: -3.4, y: 1.6, z: 3.8, hex: '#ffb070', r: 4, k: 0.4 }, { x: 3.4, y: 1.6, z: 3.8, hex: '#ffb070', r: 4, k: 0.4 }, { x: 0.8, y: 1.1, z: -2.3, hex: '#80ffb0', r: 1.8, k: 0.3 }],
    blocks: [{ x0: -1.6, x1: 1.6, z0: -4.5, z1: -1.85 }, { x0: -6, x1: -4.0, z0: -4.5, z1: -3.7 }, { x0: 4.6, x1: 6, z0: -4.5, z1: -3.6 }, { x0: -6, x1: -3.5, z0: 0.2, z1: 2.6 },
      { x0: 4.9, x1: 6, z0: 3.4, z1: 4.5 }, { x0: -6, x1: -4.8, z0: -3.0, z1: -2.2 }, { x0: 2.6, x1: 3.4, z0: -4.5, z1: -3.6 }],
    seats: [{ x: -0.75, z: -1.3, y: 0.56, yaw: PI, kind: 'stool' }, { x: 0.75, z: -1.3, y: 0.56, yaw: PI, kind: 'stool' }, { x: -5.0, z: 0.9, y: 0.5, yaw: PI / 2, kind: 'booth' }, { x: -5.0, z: 1.9, y: 0.5, yaw: PI / 2, kind: 'booth' }],
    me: [0, -0.9], cast: { BRENDA: [0, -3.25, 0] },
    uses: [{ x: 0, z: -1.0, r: 1.4, kind: 'listings', agency: 'realty', hint: 'ask Brenda about homes for sale', clerk: 'BRENDA', cam: [-1.9, 1.9, 1.7], lookY: 1.25 }],
    wide: [4.4, 2.5, 3.4, -0.6, 1.2, -2.2],
    idle(t, dt, still) {
      const n = room.npc.BRENDA, k = still ? 0.3 : 1;
      n.armR.rotation.set(-1.0 + Math.sin(t * 2.6) * 0.12 * k, 0, -0.2); n.armL.rotation.set(-0.95, 0, 0.25); n.head.rotation.y = Math.sin(t * 0.7) * 0.4 * k;
      f.rotation.y += dt * (still ? 0.6 : 2.2); sc.userData.tick(t, still);
    },
  });
}

// ---- Skyline Estates (Solano Key) ------------------------------------------------------------------------------
function buildEstates(room) {
  const g = [], B = room.boards = boards(1024), HX = 7, HZ = 5, H = 4.4, pools = room.pools, hi = room.hiPools;
  floor(g, -HX, HX, -HZ, HZ, 0, '#f2f0ec', '#e2ded8', 1.4);
  for (let i = 0; i < 9; i++) g.push(box(0.04, 0.012, 10, -HX + 1.4 * (i + 1), 0.003, 0, '#c9b07a'));
  wallX(g, -HZ - 0.1, -HX - 0.2, HX + 0.2, 0, H, '#e8eef4'); wallZ(g, -HX - 0.1, -HZ, HZ, 0, H, '#dfe6ee'); wallZ(g, HX + 0.1, -HZ, HZ, 0, H, '#dfe6ee');
  wallX(g, HZ + 0.1, -HX - 0.2, HX + 0.2, 0, H, '#dfe6ee', [[-0.9, 0.9, 0, 2.8]]);
  g.push(pbox(HX * 2 + 0.4, 0.2, HZ * 2 + 0.4, 0, H + 0.1, 0, '#f6f8fa', 1.5));
  g.push(box(1.8, 2.8, 0.08, 0, 1.4, HZ - 0.02, '#ffc070'), box(2.0, 0.08, 0.08, 0, 2.86, HZ - 0.06, '#9fe8ff'), box(0.08, 2.9, 0.08, -0.96, 1.45, HZ - 0.06, '#9fe8ff'), box(0.08, 2.9, 0.08, 0.96, 1.45, HZ - 0.06, '#9fe8ff'));
  // a brass skirting and ceiling coffers with cove light
  g.push(box(14, 0.12, 0.04, 0, 0.06, -HZ + 0.02, GOLD), box(0.04, 0.12, 10, -HX + 0.02, 0.06, 0, GOLD), box(0.04, 0.12, 10, HX - 0.02, 0.06, 0, GOLD));
  for (const x of [-4, 0, 4]) for (const z of [-2.5, 1.5]) g.push(box(3.2, 0.06, 3.2, x, H - 0.03, z, '#e8ecf2'), box(3.0, 0.02, 0.04, x, H - 0.07, z - 1.5, '#fff0c8'), box(3.0, 0.02, 0.04, x, H - 0.07, z + 1.5, '#fff0c8'));
  // the marble desk: white slab with grey veining (painted on its front), a brass edge; a slim screen, a pen set
  g.push(box(3.4, 0.9, 1.0, 2.6, 0.45, -2.6, '#f4f2f0'), box(3.5, 0.06, 1.1, 2.6, 0.93, -2.6, '#fbfaf8'), box(3.52, 0.03, 1.12, 2.6, 0.9, -2.6, GOLD),
    box(0.7, 0.45, 0.06, 3.4, 1.2, -2.8, BLK), box(0.1, 0.25, 0.1, 3.4, 1.0, -2.8, CHROME), box(0.25, 0.04, 0.12, 1.9, 0.98, -2.3, GOLD));
  B.add(3.36, 0.82, 2.6, 0.45, -2.08, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#f4f2f0'); c.strokeStyle = 'rgba(120,120,140,.35)'; for (let i = 0; i < 9; i++) { c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo(W * i / 9, 0); c.bezierCurveTo(W * (i / 9 + 0.1), Hh * 0.4, W * (i / 9 - 0.05), Hh * 0.6, W * (i / 9 + 0.12), Hh); c.stroke(); } P.text(c, 'SKYLINE ESTATES', W / 2, Hh / 2, Hh * 0.2, '#b8954a', { font: 'Georgia, serif', weight: 400 }); });
  g.push(box(0.75, 0.55, 0.65, 2.6, 0.5, -3.75, '#2a2a36'), box(0.75, 0.9, 0.14, 2.6, 1.15, -4.1, '#2a2a36'));
  for (const x of [1.9, 3.3]) g.push(box(0.6, 0.45, 0.6, x, 0.3, -1.35, '#3a3a48'), box(0.6, 0.62, 0.1, x, 0.75, -1.08, '#3a3a48'), box(0.62, 0.06, 0.62, x, 0.55, -1.35, '#5a5a6a'));
  // the architectural model of the district on a plinth under a glass case: towers, the marina, a gold top
  g.push(box(2.6, 0.9, 1.8, -3.2, 0.45, -0.6, '#2a2a36'), box(2.66, 0.04, 1.86, -3.2, 0.92, -0.6, GOLD), box(2.4, 0.03, 1.6, -3.2, 0.955, -0.6, '#5aa8d0'), box(1.9, 0.04, 1.2, -3.3, 0.98, -0.75, '#e8e4dc'));
  const tw = [[-3.9, -1.1, 0.5, '#7fb0d8'], [-3.4, -1.05, 0.38, '#a8c8e8'], [-2.9, -1.0, 0.62, '#c9a86e'], [-2.5, -0.9, 0.3, '#8fc0e0'], [-3.8, -0.5, 0.24, '#ffd0e0'], [-3.2, -0.45, 0.2, '#fff0b3'], [-2.7, -0.4, 0.22, '#a5e6cf']];
  for (const [x, z, h, c] of tw) g.push(box(0.26, h, 0.22, x, 1.0 + h / 2, z, c));
  g.push(box(0.27, 0.05, 0.23, -2.9, 1.0 + 0.62 + 0.025, -1.0, '#ffd36a'));
  room.extras.push(glass([pane(2.5, 0.8, -3.2, 1.36, 0.28), pane(2.5, 0.8, -3.2, 1.36, -1.48), pane(1.76, 0.8, -4.45, 1.36, -0.6, PI / 2), pane(1.76, 0.8, -1.95, 1.36, -0.6, PI / 2)]));
  B.add(0.9, 0.18, -3.2, 0.72, 0.31, 0, (c, W, Hh) => { P.fill(c, W, Hh, '#2a2a36'); P.text(c, 'SOLANO KEY · 1:500', W / 2, Hh / 2, Hh * 0.55, GOLD, { font: 'Georgia, serif', weight: 400 }); });
  // the listing screens on the back wall (they glow), a skyline painting, the name in brushed letters
  const scrs = [];
  for (let i = 0; i < 3; i++) {
    const x = -4.6 + i * 1.9;
    g.push(box(1.7, 1.05, 0.08, x, 2.1, -HZ + 0.06, BLK));
    B.add(1.56, 0.92, x, 2.1, -HZ + 0.11, 0, (c, W, Hh) => {
      P.grad(c, W, Hh, ['#1a3a6a', '#3a1a5a', '#1a5a5a'][i], '#0a0a1a'); c.fillStyle = ['#7fb0d8', '#ff9ad5', '#8dffcf'][i]; c.fillRect(W * 0.06, Hh * 0.1, W * 0.5, Hh * 0.62);
      c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(W * 0.12, Hh * 0.45, W * 0.38, Hh * 0.2); c.fillStyle = '#ffd36a'; c.fillRect(W * 0.2, Hh * 0.18, W * 0.22, Hh * 0.27);
      P.text(c, ['PENTHOUSE', 'HOUSEBOAT', 'VILLA'][i], W * 0.78, Hh * 0.25, Hh * 0.1, '#ffffff', { max: W * 0.4 }); P.text(c, ['$45,000', '$9,500', '$14,500'][i], W * 0.78, Hh * 0.45, Hh * 0.12, '#ffd36a');
      P.text(c, ['FLOOR 27 · BAY VIEW', 'MARINA · MOORED', 'OLD TOWN · POOL'][i], W * 0.78, Hh * 0.62, Hh * 0.07, '#bfe8ff', { max: W * 0.42 }); P.text(c, 'SKYLINE ESTATES', W / 2, Hh * 0.9, Hh * 0.08, GOLD);
    });
    scrs.push(box(1.6, 0.96, 0.01, x, 2.1, -HZ + 0.1, '#ffffff'));
    pools.push(disc(x, 2.1, -HZ + 0.15, 1.2, ['#7fb0d8', '#ff9ad5', '#8dffcf'][i], 0.25, 'z'));
  }
  B.add(4.0, 0.5, 2.6, 3.4, -HZ + 0.06, 0, (c, W, Hh) => { c.clearRect(0, 0, W, Hh); P.text(c, 'SKYLINE ESTATES', W / 2, Hh * 0.5, Hh * 0.7, '#b8954a', { font: 'Georgia, serif', weight: 400 }); });
  picture(g, B, HX - 0.05, 2.2, 0.6, -PI / 2, 3.2, 1.7, GOLD, (c, W, Hh) => {
    P.grad(c, W, Hh, '#2a1a5a', '#ff8a6a'); c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(W * 0.7, Hh * 0.7, Hh * 0.16, 0, 6.3); c.fill();
    const tws = [[0.05, 0.5], [0.14, 0.35], [0.24, 0.6], [0.34, 0.28], [0.44, 0.45], [0.56, 0.62], [0.82, 0.4], [0.9, 0.55]];
    for (const [x, h] of tws) { c.fillStyle = '#1a1438'; c.fillRect(W * x, Hh * (1 - h) - Hh * 0.08, W * 0.08, Hh * h); c.fillStyle = 'rgba(255,220,160,.6)'; for (let y = Hh * (1 - h); y < Hh * 0.9; y += 8) c.fillRect(W * x + 3, y, W * 0.06, 2); }
    c.fillStyle = '#3a6ab0'; c.fillRect(0, Hh * 0.9, W, Hh * 0.1);
  });
  // two leather sofas facing over a glass table, a glass partition, orchids and palms
  sofa(g, 2.2, 3.2, 2.6, PI / 2, '#5a3a2a', '#7a5040'); sofa(g, 2.2, 0.9, 2.6, -PI / 2, '#5a3a2a', '#7a5040');
  g.push(box(1.0, 0.04, 1.4, 2.05, 0.42, 2.6, '#bfe8f0'), cyl(0.05, 0.05, 0.4, 6, 2.05, 0.2, 2.6, CHROME), box(0.3, 0.05, 0.22, 2.0, 0.46, 2.4, '#ff9ad5'), cyl(0.06, 0.05, 0.22, 8, 2.2, 0.55, 2.8, '#ffffff'));
  room.extras.push(glass([pane(3.0, 3.2, -1.5, 1.6, 1.2, PI / 2)]));
  g.push(box(0.06, 0.06, 3.0, -1.5, 3.22, 1.2, CHROME), box(0.06, 3.2, 0.06, -1.5, 1.6, -0.3, CHROME), box(0.06, 3.2, 0.06, -1.5, 1.6, 2.7, CHROME));
  plant(g, -6.3, 4.3, 1.2, '#2a2a36', '#3faf6a', 0); plant(g, 6.3, -4.3, 1.1, '#2a2a36', '#3faf6a', 0); plant(g, -6.3, -4.3, 0.8, '#fbfaf8', '#5fbf6a', 1);
  rug(g, 4.2, 3.2, 2.05, 2.6, '#3a3a48', '#d8d0c4', '#b8954a', 'diamonds');
  const scr = pulser(scrs, 'pulse', 5); scr.material.transparent = true; scr.material.opacity = 0.12; scr.material.blending = THREE.AdditiveBlending; room.extras.push(scr);
  pools.push(disc(2.6, 0.95, -2.6, 0.9, '#fff0c0', 0.35), disc(-3.2, 0.98, -0.6, 1.1, '#bfe8ff', 0.35), disc(2.05, 0.012, 2.6, 2.2, '#ffe8c0', 0.22));
  hi.push(cone(-3.2, H - 0.1, -0.6, 0.2, 1.1, H - 1.2, '#e8f4ff', 0.25), cone(2.6, H - 0.1, -2.6, 0.2, 1.2, H - 1.0, '#fff0d0', 0.2));
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#3a4a5a', amb: 0.37, ambCol: '#f0f4ff', clerk: 'VAUGHN', bloomK: 0.5,
    lights: [{ x: 2.6, y: 3.6, z: -2.4, hex: '#fff0d8', r: 6, k: 0.4 }, { x: -3.2, y: 3.6, z: -0.6, hex: '#e8f4ff', r: 5, k: 0.4 }, { x: 2, y: 3.6, z: 2.6, hex: '#ffe8c8', r: 6, k: 0.3 }, { x: -2.7, y: 2.1, z: -4.4, hex: '#a0c0ff', r: 4, k: 0.35 }],
    blocks: [{ x0: 0.8, x1: 4.4, z0: -5, z1: -2.0 }, { x0: -4.6, x1: -1.8, z0: -1.6, z1: 0.4 }, { x0: 2.7, x1: 3.8, z0: 1.4, z1: 3.8 }, { x0: 0.3, x1: 1.4, z0: 1.4, z1: 3.8 }, { x0: 1.5, x1: 2.6, z0: 1.9, z1: 3.3 },
      { x0: -1.6, x1: -1.4, z0: -0.3, z1: 2.7 }, { x0: -7, x1: -5.7, z0: 3.7, z1: 5 }, { x0: 5.7, x1: 7, z0: -5, z1: -3.7 }, { x0: -7, x1: -5.8, z0: -5, z1: -3.8 }],
    seats: [{ x: 1.9, z: -1.4, y: 0.55, yaw: PI, kind: 'stool' }, { x: 3.3, z: -1.4, y: 0.55, yaw: PI, kind: 'stool' }, { x: 3.35, z: 2.1, y: 0.5, yaw: -PI / 2, kind: 'booth' }, { x: 3.35, z: 3.1, y: 0.5, yaw: -PI / 2, kind: 'booth' }, { x: 0.75, z: 2.1, y: 0.5, yaw: PI / 2, kind: 'booth' }, { x: 0.75, z: 3.1, y: 0.5, yaw: PI / 2, kind: 'booth' }],
    me: [2.6, -1.0], cast: { VAUGHN: [2.6, -3.55, 0] },
    uses: [{ x: 2.6, z: -1.05, r: 1.4, kind: 'listings', agency: 'estates', hint: 'ask Vaughn about homes for sale', clerk: 'VAUGHN', cam: [-2.0, 1.9, 1.7], lookY: 1.3 }],
    wide: [-5.2, 2.8, 4.0, 1.4, 1.3, -2.4],
    idle(t, dt, still) {
      const n = room.npc.VAUGHN, k = still ? 0.3 : 1;
      n.armR.rotation.set(-0.7 + Math.sin(t * 1.4) * 0.15 * k, 0, -0.15); n.armL.rotation.set(-0.3, 0, 0.12); n.head.rotation.y = Math.sin(t * 0.5) * 0.3 * k;
      scr.userData.tick(t, still);
    },
  });
}

// ---- the old-town seafront studio, 2B, above the shop -----------------------------------------------------
// The +z wall is the façade over Lumina Boulevard: a French door onto a narrow balcony, the beach, the sea and
// the Starlight Wheel beyond. The way in is the stair door in the back wall.
function buildStudio(room, place) {
  const g = [], B = room.boards = boards(1024), HX = 4.2, HZ = 3.4, H = 3.0, pools = room.pools, hi = room.hiPools;
  const W = '#f3d9c0', WB = '#e8c8a8';
  floor(g, -HX, HX, -HZ, HZ, 0, '#b88a5e', null); floor(g, -2.4, 2.4, HZ, HZ + 1.6, 0, '#e8e0d4', '#d8cfc2', 0.4);
  wallX(g, -HZ - 0.1, -HX - 0.2, HX + 0.2, 0, H, W, [[2.2, 3.2, 0, 2.2]]);
  wallZ(g, -HX - 0.1, -HZ, HZ, 0, H, WB); wallZ(g, HX + 0.1, -HZ, HZ, 0, H, WB);
  wallX(g, HZ + 0.1, -HX - 0.2, HX + 0.2, 0, H, W, [[-3.8, -2.6, 0.9, 2.3], [-1.0, 1.0, 0, 2.4]]);
  g.push(pbox(HX * 2 + 0.4, 0.2, HZ * 2 + 0.4, 0, H + 0.1, 0, '#fbf3e6', 1.4), box(2.0, 0.08, 0.18, 0, 2.44, HZ + 0.1, '#f6f1e7'), box(1.4, 0.08, 0.18, -3.2, 0.86, HZ + 0.1, '#f6f1e7'));
  // the stair door and its frame, a mat; a coat hook
  g.push(box(0.9, 2.1, 0.06, 2.7, 1.05, -HZ + 0.03, '#7a4a2a'), box(1.1, 0.1, 0.1, 2.7, 2.15, -HZ + 0.05, '#f6f1e7'), box(0.04, 0.04, 0.08, 2.4, 1.05, -HZ + 0.08, GOLD),
    box(0.9, 0.02, 0.6, 2.7, 0.01, -HZ + 0.5, '#ff8a6a'), box(0.3, 0.05, 0.05, 1.6, 1.7, -HZ + 0.05, GOLD));
  // the balcony: a tiled ledge, a pastel railing with balusters, a folding chair and a pot of geraniums
  g.push(box(5.0, 0.18, 1.7, 0, -0.1, HZ + 0.85, '#f6f1e7'), box(5.0, 0.08, 0.1, 0, 1.0, HZ + 1.62, '#7fe0ff'), box(0.1, 0.08, 1.6, -2.45, 1.0, HZ + 0.8, '#7fe0ff'), box(0.1, 0.08, 1.6, 2.45, 1.0, HZ + 0.8, '#7fe0ff'));
  for (let x = -2.4; x <= 2.41; x += 0.3) g.push(box(0.05, 0.9, 0.05, x, 0.5, HZ + 1.6, '#f6f1e7'));
  for (let z = HZ + 0.2; z < HZ + 1.6; z += 0.3) { g.push(box(0.05, 0.9, 0.05, -2.45, 0.5, z, '#f6f1e7'), box(0.05, 0.9, 0.05, 2.45, 0.5, z, '#f6f1e7')); }
  g.push(box(0.5, 0.05, 0.5, 1.4, 0.45, HZ + 0.9, '#ff6a8a'), box(0.05, 0.45, 0.05, 1.18, 0.22, HZ + 0.68, CHROME), box(0.05, 0.45, 0.05, 1.62, 0.22, HZ + 1.12, CHROME), box(0.05, 0.45, 0.05, 1.18, 0.22, HZ + 1.12, CHROME), box(0.05, 0.45, 0.05, 1.62, 0.22, HZ + 0.68, CHROME),
    box(0.5, 0.5, 0.05, 1.4, 0.72, HZ + 0.66, '#ff6a8a'));
  plant(g, -1.8, HZ + 1.2, 0.7, '#e07a5f', '#3faf6a', 1); g.push(box(0.2, 0.2, 0.2, -1.8, 0.75, HZ + 1.2, '#ff3f5a'), box(0.15, 0.15, 0.15, -1.7, 0.85, HZ + 1.1, '#ff3f5a'));
  room.extras.push(glass([pane(1.2, 1.4, -3.2, 1.6, HZ + 0.12), pane(0.9, 2.3, -0.5, 1.2, HZ + 0.12)]));
  g.push(box(0.06, 2.4, 0.06, -1.0, 1.2, HZ + 0.12, '#f6f1e7'), box(0.06, 2.4, 0.06, 0, 1.2, HZ + 0.12, '#f6f1e7'), box(0.06, 1.4, 0.06, -3.2, 1.6, HZ + 0.12, '#f6f1e7'));
  // net curtains each side of the French door
  for (const x of [-1.3, 1.25]) g.push(box(0.5, 2.3, 0.04, x, 1.25, HZ - 0.05, '#fff0f4'));
  // the bed along the right wall: a pink chenille cover, a white headboard; a nightstand with a lamp
  bed(g, 1.1, 2.0, 3.55, 0.0, -PI / 2, '#f6f1e7', '#ff9ac8');
  g.push(box(0.45, 0.5, 0.4, 3.85, 0.25, 1.4, '#a8744e'), cyl(0.06, 0.08, 0.25, 8, 3.85, 0.62, 1.4, '#7fe0ff'), cyl(0.1, 0.17, 0.2, 10, 3.85, 0.85, 1.4, '#fff3c4'));
  picture(g, B, HX - 0.05, 1.75, 0.0, -PI / 2, 1.2, 0.7, '#7fe0ff', (c, Ww, Hh) => { P.grad(c, Ww, Hh, '#2a0f4a', '#ff6a8a'); c.fillStyle = '#ffd447'; c.beginPath(); c.arc(Ww / 2, Hh * 0.7, Hh * 0.25, PI, 0); c.fill(); c.fillStyle = '#1b0f30'; c.fillRect(0, Hh * 0.7, Ww, Hh); P.palm(c, Ww * 0.2, Hh * 0.72, Hh * 0.55); });
  // the kitchenette on the left wall: a counter with a sink, a two-ring hob, a kettle, the little fridge, a radio
  g.push(box(0.65, 0.9, 2.6, -3.85, 0.45, 0.0, '#7fe0d0'), box(0.7, 0.06, 2.7, -3.85, 0.93, 0.0, '#fff6ec'), box(0.5, 0.06, 0.5, -3.85, 0.95, 0.6, CHROME), cyl(0.02, 0.02, 0.3, 6, -4.05, 1.1, 0.6, CHROME),
    cyl(0.12, 0.12, 0.03, 10, -3.85, 0.97, -0.5, BLK), cyl(0.12, 0.12, 0.03, 10, -3.85, 0.97, -0.9, BLK), cyl(0.08, 0.1, 0.2, 10, -3.8, 1.06, -0.9, '#ff6a3d'),
    box(0.62, 0.86, 0.04, -3.52, 0.45, 0.0, '#5fc8b8'), box(0.6, 1.2, 0.6, -3.85, 0.6, 1.8, '#f6f1e7'), box(0.04, 0.3, 0.04, -3.53, 0.85, 1.6, CHROME), box(0.02, 0.02, 0.56, -3.54, 0.6, 1.8, '#d8d0c4'),
    box(0.45, 0.6, 0.35, -3.9, 1.95, 0.0, '#f6f1e7'));
  // the transistor radio: chrome dial, a red case
  g.push(box(0.42, 0.24, 0.16, -3.8, 1.08, 1.0, '#e8304a'), cyl(0.07, 0.07, 0.02, 10, -3.72, 1.1, 1.08, CHROME, PI / 2), box(0.16, 0.12, 0.012, -3.86, 1.1, 1.085, '#ffd9a0'), box(0.01, 0.2, 0.01, -3.95, 1.3, 1.0, CHROME));
  B.add(0.9, 0.5, -HX + 0.06, 1.55, 0.0, PI / 2, (c, Ww, Hh) => { P.fill(c, Ww, Hh, '#fff6ec'); for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff6a8a', '#7fe0ff', '#ffe14a'][i % 3]; c.fillRect(i * Ww / 6 + 3, Hh * 0.2, Ww / 6 - 6, Hh * 0.6); } });
  // the CRT on a cabinet, a bean bag in front of it; a few cassettes
  g.push(box(1.0, 0.55, 0.5, 1.0, 0.275, -2.95, '#a8744e'), box(0.78, 0.6, 0.55, 1.0, 0.85, -2.95, '#3a3550'), box(0.62, 0.48, 0.02, 1.0, 0.86, -2.66, '#141020'),
    box(0.1, 0.1, 0.02, 1.36, 0.7, -2.66, '#c9c0d8'), box(0.06, 0.06, 0.02, 1.36, 0.9, -2.66, '#ff3f5a'), cyl(0.008, 0.008, 0.5, 4, 0.95, 1.35, -3.0, CHROME, 0, 0.5), cyl(0.008, 0.008, 0.5, 4, 1.05, 1.35, -3.0, CHROME, 0, -0.5));
  for (let i = 0; i < 4; i++) g.push(box(0.1, 0.06, 0.16, 0.6 + i * 0.12, 0.58, -2.9, ['#ff6a8a', '#7fe0ff', '#ffe14a', '#8dff5a'][i]));
  const tv = screen(0.58, 0.44, 1.0, 0.86, -2.645); room.extras.push(tv); room.tv = tv;
  g.push(box(0.9, 0.35, 0.9, 1.1, 0.18, -1.3, '#ff8a3d'), box(0.8, 0.25, 0.3, 1.1, 0.45, -0.95, '#ff8a3d'));
  rug(g, 2.4, 1.6, 0.4, -1.0, '#7a3a6a', '#ffd0a0', '#7fe0ff', 'stripes');
  // the bathroom in the back-left corner: tiled walls, a shower with a curtain, a basin, a mirror
  const T = '#bfe8e0';
  wallX(g, -1.4, -HX, -2.0, 0, 2.5, T, [[-3.2, -2.4, 0, 2.1]], 0.1); wallZ(g, -2.0, -HZ, -1.4, 0, 2.5, T, [], 0.1);
  floor(g, -HX, -2.05, -HZ, -1.45, 0.012, '#e8f8f4', '#bfe8e0', 0.3);
  g.push(box(0.9, 0.06, 0.9, -3.65, 0.04, -2.85, '#fff6ec'), cyl(0.012, 0.012, 1.0, 4, -3.65, 1.9, -2.8, CHROME, PI / 2), cyl(0.08, 0.06, 0.04, 8, -3.65, 2.0, -2.6, CHROME),
    box(0.02, 1.6, 0.02, -3.2, 1.25, -2.4, CHROME), box(0.04, 1.4, 0.8, -3.2, 1.2, -2.85, '#ffd0e4'));
  g.push(box(0.5, 0.15, 0.4, -2.4, 0.85, -3.15, '#fff6ec'), cyl(0.05, 0.05, 0.85, 6, -2.4, 0.42, -3.15, '#fff6ec'));
  B.add(0.45, 0.6, -2.4, 1.6, -HZ + 0.03, 0, (c, Ww, Hh) => P.mirror(c, Ww, Hh, ['#7aa0b8', '#c8e0ec'], [['#ff9ac8', 2], ['#fff0d0', 2]], 7));
  const st = steam(-3.65, 0.2, -2.85, 0.7); room.extras.push(st); room.steam = st;
  // the wardrobe by the bathroom, a cork board, a ceiling light
  wardrobe(g, B, 1.2, -0.7, -3.05, 0, '#e8d0b8');
  B.add(0.8, 0.6, 0.35, 1.7, -HZ + 0.06, 0, (c, Ww, Hh) => { P.fill(c, Ww, Hh, '#c8945e'); for (let i = 0; i < 5; i++) { c.fillStyle = ['#fff6ec', '#ffe14a', '#7fe0ff', '#ff9ac8', '#8dff5a'][i]; c.fillRect(6 + (i % 3) * Ww * 0.3, 6 + Math.floor(i / 3) * Hh * 0.45, Ww * 0.26, Hh * 0.38); } });
  g.push(cyl(0.25, 0.2, 0.12, 12, 0, H - 0.06, 0, '#fff3c4'));
  pools.push(disc(0, 0.012, 0, 2.6, '#fff0d0', 0.22), disc(3.85, 0.86, 1.4, 0.5, '#ffe0a0', 0.6), disc(0, 0.012, HZ + 0.6, 1.6, '#ffc080', 0.2));
  hi.push(cone(0, H - 0.12, 0, 0.2, 1.1, H - 0.4, '#fff0d0', 0.18));
  const b = place.b;
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#5a3a4a', amb: 0.37, ambCol: '#fff0e0', bloomK: 0.6,
    view: { x: b.cx + place.along, y: 6.4, z: b.z1 - HZ },
    lights: [{ x: 0, y: 2.6, z: 0, hex: '#fff0d8', r: 6, k: 0.5 }, { x: 3.85, y: 1.0, z: 1.4, hex: '#ffd9a0', r: 3, k: 0.6 }, { x: 0, y: 1.8, z: HZ + 0.5, hex: '#ffc8a0', r: 4, k: 0.3 }, { x: -3.2, y: 2.1, z: -2.6, hex: '#e0fff8', r: 2.5, k: 0.4 }],
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ + 1.6 },
    blocks: [{ x0: 3.0, x1: 4.2, z0: -1.1, z1: 1.1 }, { x0: 3.5, x1: 4.2, z0: 1.1, z1: 1.7 }, { x0: -4.2, x1: -3.5, z0: -1.4, z1: 2.2 }, { x0: 0.45, x1: 1.55, z0: -3.4, z1: -2.65 },
      { x0: -1.35, x1: -0.05, z0: -3.4, z1: -2.75 }, { x0: -4.2, x1: -2.0, z0: -1.5, z1: -1.3 }, { x0: -2.1, x1: -1.9, z0: -3.4, z1: -1.4 }, { x0: -2.7, x1: -2.1, z0: -3.4, z1: -2.9 },
      { x0: 0.65, x1: 1.55, z0: -1.75, z1: -0.75 },
      { x0: -4.2, x1: -1.0, z0: HZ - 0.12, z1: HZ + 0.3 }, { x0: 1.0, x1: 4.2, z0: HZ - 0.12, z1: HZ + 0.3 }, { x0: -4.2, x1: -2.4, z0: HZ + 0.3, z1: HZ + 2 }, { x0: 2.4, x1: 4.2, z0: HZ + 0.3, z1: HZ + 2 }, { x0: -2.4, x1: 2.4, z0: HZ + 1.55, z1: HZ + 2 }],
    seats: [{ x: 1.1, z: -1.3, y: 0.38, yaw: PI, kind: 'booth' }, { x: 3.3, z: 0.3, y: 0.55, yaw: PI / 2 + PI, kind: 'lounger', home: 'bed' },
      { x: 1.4, z: HZ + 0.92, y: 0.45, yaw: 0, kind: 'stool', view: true, cam: [-1.2, 2.1, HZ - 1.6, 1.2, 1.0, HZ + 40] }],
    entry: [2.7, -2.7], spawn: [1.6, -1.0], exit: [2.7, -2.75], faceIn: 0,
    uses: [
      { x: 1.0, z: -2.1, r: 0.9, kind: 'tv', hint: 'the TV', look: [1.0, -2.7], cam: [-1.0, 1.6, 1.5], lookY: 0.9 },
      { x: 2.6, z: 0.3, r: 1.0, kind: 'bed', hint: 'sleep (and save)', look: [3.6, 0.3], cam: [-1.8, 1.9, 1.4] },
      { x: -2.75, z: -2.4, r: 0.75, kind: 'shower', hint: 'take a shower', look: [-3.65, -2.85] },
      { x: -0.7, z: -2.3, r: 0.8, kind: 'wardrobe', hint: 'change clothes', face: 0.35 },
      { x: -3.0, z: 1.75, r: 0.8, kind: 'fridge', hint: 'something from the fridge', look: [-3.85, 1.8], cam: [1.6, 1.6, 1.4] },
      { x: -3.0, z: 0.85, r: 0.7, kind: 'radio', hint: 'the radio', look: [-3.8, 1.0], cam: [1.4, 1.5, 1.2], lookY: 1.05 },
    ],
    wide: [-3.2, 2.4, 2.6, 1.4, 1.0, -1.6],
    camFor(lx, lz) { return lz > HZ - 0.3 ? [lx * 0.4, 2.2, HZ - 2.2, 1.2, -1.6] : [lx * 0.45, 2.45, Math.min(HZ + 1.2, lz + 3.6), 1.0, 0.6]; },
    tour: [[3.4, 2.4, -2.8, -1.0, 1.0, 2.0], [-3.0, 2.2, 2.6, 2.6, 0.8, -1.0], [0.0, 1.8, 1.5, 0.0, 1.6, 30], [-2.4, 1.9, -1.8, -3.6, 1.0, -2.9]],
    idle(t, dt, still) { st.userData.U.uT.value = t; },
  });
}

// ---- Villa Paloma (old town): a courtyard with a pool, a curved stair, a gallery upstairs ----------------
// Open to the sky over the courtyard (view.sky: the sky dome is drawn there). Ground floor: the entrance hall
// (+z), the den on the left (big TV, the console, the bar cart), the garage on the right front, a covered loggia
// under the gallery at the back. Upstairs (3.6 m): the gallery with the bedroom (left) and the bathroom (right).
const VG = 3.6, VSTAIR = { x: 5.4, z: -2.2, r0: 1.5, r1: 2.7 };
function buildVilla(room) {
  const g = [], B = room.boards = boards(1024), HX = 9, HZ = 8, H = 7.2, pools = room.pools, hi = room.hiPools;
  const WALL = '#ffe0d0', TR = '#7fe0d0', PINK = '#ff9ad5';
  // floors: terracotta in the courtyard, checker in the hall, parquet in the den
  floor(g, -HX, HX, -HZ, HZ, 0, '#e8a07a', '#d88a64', 1.0);
  floor(g, -HX, -4.6, -3.6, 5, 0.01, '#c8945e', null);
  floor(g, -3.5, 3.5, 5.2, HZ, 0.01, '#fff6ec', BLK, 0.8);
  // the outer walls (tall: two floors), with a pink band at the top and a neon edge
  wallX(g, -HZ - 0.1, -HX - 0.2, HX + 0.2, 0, H, WALL); wallZ(g, -HX - 0.1, -HZ, HZ, 0, H, WALL); wallZ(g, HX + 0.1, -HZ, HZ, 0, H, WALL);
  wallX(g, HZ + 0.1, -HX - 0.2, HX + 0.2, 0, H, WALL, [[-0.9, 0.9, 0, 2.7]]);
  for (const [x, z, w, d] of [[0, -HZ + 0.12, 18, 0.06], [-HX + 0.12, 0, 0.06, 16], [HX - 0.12, 0, 0.06, 16], [0, HZ - 0.12, 18, 0.06]]) g.push(box(w, 0.08, d, x, H - 0.3, z, '#ff2bd1'));
  g.push(box(1.7, 2.7, 0.08, 0, 1.35, HZ - 0.02, '#ffa64a'), box(1.9, 0.1, 0.1, 0, 2.75, HZ - 0.06, PINK), box(0.1, 2.8, 0.1, -0.9, 1.4, HZ - 0.06, PINK), box(0.1, 2.8, 0.1, 0.9, 1.4, HZ - 0.06, PINK));
  // the hall: a low arcade of three arches on the courtyard side, a roof over it
  g.push(pbox(18.4, 0.3, 3.0, 0, 3.6, 6.5, '#fff6ec', 1.5));
  for (const x of [-3.5, -1.2, 1.2, 3.5]) g.push(cyl(0.18, 0.2, 3.45, 10, x, 1.72, 5.1, '#fff6ec'), box(0.5, 0.2, 0.5, x, 3.35, 5.1, PINK));
  g.push(box(7.4, 0.5, 0.3, 0, 3.25, 5.1, '#fff6ec'));
  // the den: a wall on the courtyard side with a wide opening, a roof; the big TV on the far wall, a sectional,
  // the console, a bar cart, a neon palm
  wallZ(g, -4.6, -3.6, 5.0, 0, VG, WALL, [[-1.6, 2.6, 0, 2.8]]);
  g.push(pbox(4.6, 0.3, 8.8, -6.8, VG, 0.7, '#fff6ec', 1.5), box(0.1, 0.06, 4.2, -4.5, 2.85, 0.5, '#18f0ff'));
  g.push(box(0.12, 1.4, 2.4, -HX + 0.1, 1.5, 0.6, BLK), box(0.05, 1.3, 2.3, -HX + 0.17, 1.5, 0.6, '#141020'), box(0.6, 0.45, 2.6, -HX + 0.35, 0.22, 0.6, '#3a2a4a'),
    box(0.35, 0.08, 0.4, -HX + 0.45, 0.5, 1.4, '#e8e8f0'), box(0.3, 0.06, 0.06, -HX + 0.45, 0.56, 1.25, '#ff2bd1'), box(0.2, 0.04, 0.12, -HX + 0.7, 0.47, 1.0, BLK));
  const tv = screen(2.3, 1.3, -HX + 0.2, 1.5, 0.6, PI / 2); room.extras.push(tv); room.tv = tv;
  sofa(g, 2.8, -6.0, 0.6, -PI / 2, '#ff6a8a', '#ffc0d4');
  sofa(g, 1.8, -7.3, 2.75, PI, '#ff6a8a', '#ffc0d4');
  g.push(box(1.0, 0.36, 1.4, -7.3, 0.18, 0.6, '#fff6ec'), box(1.04, 0.04, 1.44, -7.3, 0.38, 0.6, PINK));
  // the bar cart: brass with two glass shelves, bottles, a shaker
  g.push(box(0.9, 0.04, 0.5, -5.2, 0.4, -2.8, '#bfe8f0'), box(0.9, 0.04, 0.5, -5.2, 0.85, -2.8, '#bfe8f0'));
  for (const [x, z] of [[-5.6, -3.0], [-4.8, -3.0], [-5.6, -2.6], [-4.8, -2.6]]) g.push(cyl(0.02, 0.02, 0.9, 4, x, 0.45, z, GOLD));
  for (let i = 0; i < 5; i++) g.push(cyl(0.045, 0.05, 0.28, 8, -5.5 + i * 0.15, 1.02, -2.85, ['#ff6a3d', '#7fe0ff', '#ffe14a', '#8dff5a', '#b388ff'][i]));
  g.push(cyl(0.05, 0.06, 0.2, 8, -4.9, 0.97, -2.7, CHROME), cyl(0.12, 0.12, 0.07, 10, -5.2, 0.15, -2.7, '#3a2a4a', 0, PI / 2), cyl(0.12, 0.12, 0.07, 10, -5.2, 0.15, -2.9, '#3a2a4a', 0, PI / 2));
  B.add(1.6, 1.4, -HX + 0.06, 2.6, -2.2, PI / 2, (c, Ww, Hh) => P.neon(c, Ww, Hh, '✶ PALOMA ✶', '#ff2bd1', { size: 0.22 }));
  // the garage on the right front: its wall to the hall with a door, the roll-up door, a workbench, tools
  wallX(g, 1.4, 4.4, HX, 0, VG, WALL, [], 0.2); wallZ(g, 4.4, 1.4, 5.0, 0, VG, WALL, [[2.6, 3.8, 0, 2.3]]);
  g.push(pbox(4.6, 0.3, 6.8, 6.7, VG, 4.6, '#fff6ec', 1.5), box(4.0, 2.6, 0.08, 6.7, 1.3, HZ - 0.04, '#c9c0d8'));
  for (let y = 0.2; y < 2.6; y += 0.26) g.push(box(4.0, 0.03, 0.06, 6.7, y, HZ - 0.08, '#a8a0b8'));
  g.push(box(0.6, 0.9, 2.4, HX - 0.35, 0.45, 3.6, '#a8744e'), box(0.04, 1.2, 2.4, HX - 0.05, 1.8, 3.6, '#5a5468'));
  for (let i = 0; i < 6; i++) g.push(box(0.04, 0.3, 0.06, HX - 0.1, 1.7 + (i % 2) * 0.3, 2.7 + i * 0.35, CHROME));
  g.push(box(4.1, 0.01, 6.2, 6.7, 0.012, 4.6, '#8a8496'), box(0.08, 0.01, 4.6, 5.2, 0.02, 4.6, '#ffe14a'), box(0.08, 0.01, 4.6, 8.2, 0.02, 4.6, '#ffe14a'));
  // the stored car: a boxy silhouette tinted with its paint (shown by game/homes.js)
  const car = new THREE.Group();
  const body = new THREE.Mesh(merge([box(1.9, 0.6, 4.2, 0, 0.55, 0, '#ffffff'), box(1.6, 0.5, 2.2, 0, 1.08, -0.2, '#ffffff')]), new THREE.MeshLambertMaterial({ vertexColors: true }));
  const trim = new THREE.Mesh(merge([box(1.5, 0.42, 0.04, 0, 1.08, 0.92, '#2a3a4a'), box(1.5, 0.42, 0.04, 0, 1.08, -1.32, '#2a3a4a'), box(0.04, 0.38, 2.0, 0.81, 1.08, -0.2, '#2a3a4a'), box(0.04, 0.38, 2.0, -0.81, 1.08, -0.2, '#2a3a4a'),
    ...[[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]].map(([x, z]) => cyl(0.34, 0.34, 0.26, 12, x, 0.34, z, BLK, 0, PI / 2)), box(1.7, 0.12, 0.06, 0, 0.5, 2.12, CHROME), box(0.3, 0.12, 0.04, 0.6, 0.62, 2.11, '#fff3c4'), box(0.3, 0.12, 0.04, -0.6, 0.62, 2.11, '#fff3c4')]), new THREE.MeshBasicMaterial({ vertexColors: true }));
  car.add(body, trim); car.position.set(6.7, 0, 4.9); car.visible = false; room.extras.push(car);
  room.garageCar = (hex) => { car.visible = !!hex; if (hex) body.material.color.set(hex); };
  // the courtyard pool: a tiled basin, a coping, steps at the east end, a light under the water
  const PX0 = -3.6, PX1 = 2.0, PZ0 = -2.4, PZ1 = 2.6;
  g.push(box(PX1 - PX0, 0.06, PZ1 - PZ0, (PX0 + PX1) / 2, -1.5, (PZ0 + PZ1) / 2, '#3fb8d8'));
  g.push(box(PX1 - PX0, 1.5, 0.06, (PX0 + PX1) / 2, -0.75, PZ0, '#5fd0e8'), box(PX1 - PX0, 1.5, 0.06, (PX0 + PX1) / 2, -0.75, PZ1, '#5fd0e8'), box(0.06, 1.5, PZ1 - PZ0, PX0, -0.75, (PZ0 + PZ1) / 2, '#5fd0e8'), box(0.06, 1.5, PZ1 - PZ0, PX1, -0.75, (PZ0 + PZ1) / 2, '#5fd0e8'));
  for (const [x, z, w, d] of [[(PX0 + PX1) / 2, PZ0 - 0.2, PX1 - PX0 + 0.8, 0.4], [(PX0 + PX1) / 2, PZ1 + 0.2, PX1 - PX0 + 0.8, 0.4], [PX0 - 0.2, (PZ0 + PZ1) / 2, 0.4, PZ1 - PZ0], [PX1 + 0.2, (PZ0 + PZ1) / 2, 0.4, PZ1 - PZ0]]) g.push(box(w, 0.08, d, x, 0.04, z, '#fff6ec'));
  for (let i = 0; i < 3; i++) g.push(box(0.5, 0.06, 1.6, PX1 - 0.25 - i * 0.5, -0.45 - i * 0.35, 1.6, '#e8f8ff'));
  for (let i = 0; i < 12; i++) g.push(box(0.4, 0.4, 0.02, PX0 + 0.3 + i * 0.45, -0.3, PZ0 + 0.04, i % 2 ? '#ff9ad5' : '#7fe0ff'));
  const pw = water(PX1 - PX0, PZ1 - PZ0, (PX0 + PX1) / 2, -0.12, (PZ0 + PZ1) / 2, '#1f8fb8', '#5fe0f0'); room.extras.push(pw); room.water = pw;
  pools.push(disc((PX0 + PX1) / 2, -1.44, (PZ0 + PZ1) / 2, 2.4, '#7fe8ff', 0.45));
  // loungers by the pool, palms in pots, a striped umbrella
  for (const x of [-2.4, -0.4]) g.push(box(0.7, 0.3, 1.9, x, 0.25, 4.0, '#fff6ec'), box(0.66, 0.1, 1.2, x, 0.45, 4.3, '#7fe0d0'), box(0.66, 0.5, 0.12, x, 0.62, 3.15, '#7fe0d0', -0.6));
  g.push(cyl(0.04, 0.04, 2.2, 6, 1.4, 1.1, 4.0, CHROME), tint(new THREE.ConeGeometry(1.2, 0.5, 8).translate(1.4, 2.3, 4.0), '#ff9ad5'), cyl(0.3, 0.32, 0.06, 10, 1.4, 0.03, 4.0, BLK));
  plant(g, -3.9, -3.2, 1.2, '#ff9ad5', '#2f9f6a', 0); plant(g, 3.2, -3.2, 1.1, TR, '#2f9f6a', 0); plant(g, 3.6, 4.4, 1.0, '#ff9ad5', '#3faf6a', 1); plant(g, -4.0, 4.4, 1.0, TR, '#3faf6a', 1);
  // the loggia under the gallery: columns along its edge, a dining table, a big neon wave on the back wall
  for (const x of [-4.4, -1.4, 1.4]) g.push(cyl(0.2, 0.22, VG, 10, x, VG / 2, -3.6, '#fff6ec'));
  g.push(box(2.4, 0.06, 1.0, -1.4, 0.76, -5.8, '#fff6ec'), cyl(0.08, 0.12, 0.74, 8, -1.4, 0.37, -5.8, GOLD));
  for (const x of [-2.2, -0.6]) for (const z of [-6.5, -5.1]) g.push(box(0.42, 0.45, 0.42, x, 0.4, z, '#ff6a8a'));
  for (let i = 0; i < 8; i++) g.push(box(1.2, 0.08, 0.08, -4.0 + i * 1.1, 2.4 + (i % 2 ? 0.15 : -0.15), -HZ + 0.06, '#18f0ff', 0, 0, i % 2 ? -0.25 : 0.25));
  // the gallery floor (3.6 m) over the loggia, its glass and chrome balustrade
  g.push(pbox(14.4, 0.3, 4.4, -1.8, VG - 0.15, -5.8, '#fff6ec', 1.5));
  floor(g, -HX, 5.4, -HZ, -3.6, VG + 0.01, '#c8945e', null);
  g.push(box(14.4, 0.06, 0.08, -1.8, VG + 1.0, -3.55, CHROME), box(14.4, 0.08, 0.04, -1.8, VG + 0.05, -3.55, PINK));
  for (let x = -8.8; x < 5.4; x += 0.6) g.push(box(0.04, 1.0, 0.04, x, VG + 0.5, -3.55, CHROME));
  // the curved stair: steps round a quarter circle and a half (from the hall side up to the gallery's east end)
  const S = VSTAIR, NST = 18;
  for (let i = 0; i < NST; i++) {
    const a = (i + 0.5) / NST * PI, rm = (S.r0 + S.r1) / 2, y = (i + 1) / NST * VG, x = S.x + Math.sin(a) * rm, z = S.z + Math.cos(a) * rm;
    g.push(box(S.r1 - S.r0, 0.12, 0.42, x, y - 0.06, z, i % 2 ? '#fff6ec' : '#f4e8dc', 0, a + PI / 2), box(S.r1 - S.r0, y - 0.12, 0.42, x, (y - 0.12) / 2, z, '#ffe8dc', 0, a + PI / 2));
    g.push(cyl(0.02, 0.02, 0.9, 4, S.x + Math.sin(a) * (S.r1 + 0.05), y + 0.45, S.z + Math.cos(a) * (S.r1 + 0.05), GOLD));
  }
  for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * PI, y = (i + 0.5) / 24 * VG + 0.9; g.push(box(0.08, 0.06, PI * S.r1 / 24 + 0.05, S.x + Math.sin(a) * (S.r1 + 0.05), y, S.z + Math.cos(a) * (S.r1 + 0.05), GOLD, 0, a + PI / 2, -0.0)); }
  // upstairs: the bedroom (left): a round bed under a pink neon arch, a wardrobe; the bathroom (right): a
  // clawfoot tub, a vanity, a partition between them; the roof over the gallery
  wallZ(g, -1.0, -HZ, -3.8, VG, H - 0.4, WALL, [[-5.6, -4.4, VG, VG + 2.3]]);
  g.push(pbox(14.4, 0.3, 4.4, -1.8, H - 0.4, -5.8, '#fff6ec', 1.5));
  g.push(cyl(1.15, 1.15, 0.45, 18, -5.6, VG + 0.25, -6.2, '#fff6ec'), cyl(1.12, 1.12, 0.14, 18, -5.6, VG + 0.52, -6.2, PINK), box(0.6, 0.12, 0.4, -6.0, VG + 0.62, -6.9, CREAM), box(0.6, 0.12, 0.4, -5.2, VG + 0.62, -6.9, CREAM));
  for (let i = 0; i < 9; i++) { const a = PI * i / 8; g.push(box(0.09, 0.09, 0.42, -5.6 + Math.cos(a) * 1.4, VG + 1.0 + Math.sin(a) * 1.4, -HZ + 0.08, '#ff2bd1', 0, 0, a)); }
  wardrobe(g, B, 1.6, -2.4, -7.4, 0, '#fff6ec', '#ff2bd1');
  g.push(box(0.5, 0.5, 0.5, -7.7, VG + 0.25, -7.4, '#7fe0d0'), cyl(0.08, 0.14, 0.3, 10, -7.7, VG + 0.68, -7.4, '#fff3c4'));
  floor(g, -0.9, 5.3, -HZ, -3.65, VG + 0.02, '#ffffff', '#bfe8e0', 0.5);
  g.push(box(1.7, 0.55, 0.8, 1.6, VG + 0.38, -7.3, '#fff6ec'), box(1.6, 0.1, 0.7, 1.6, VG + 0.6, -7.3, '#5fd0e8'));
  for (const [x, z] of [[0.9, -7.6], [2.3, -7.6], [0.9, -7.0], [2.3, -7.0]]) g.push(box(0.08, 0.12, 0.08, x, VG + 0.06, z, GOLD));
  g.push(cyl(0.025, 0.025, 0.4, 6, 2.35, VG + 0.85, -7.6, GOLD), box(1.0, 0.85, 0.5, 4.2, VG + 0.43, -7.6, '#ff9ad5'), box(1.05, 0.05, 0.55, 4.2, VG + 0.88, -7.6, '#fff6ec'));
  B.add(0.9, 1.0, 4.2, VG + 1.6, -HZ + 0.03, 0, (c, Ww, Hh) => P.mirror(c, Ww, Hh, ['#8aa0c0', '#d8e8f4'], [['#ff9ad5', 3], ['#7fe0ff', 2]], 9));
  const st = steam(1.6, VG + 0.6, -7.3, 1.1); room.extras.push(st); room.steam = st;
  // the den and hall lights, the lanterns along the gallery, fairy lights over the pool
  for (let i = 0; i < 10; i++) g.push(box(0.12, 0.12, 0.12, -3.6 + i * 0.62, 5.2 - Math.sin(i / 9 * PI) * 0.5, 0.1, ['#ffe14a', '#ff9ad5', '#7fe0ff'][i % 3]));
  g.push(box(0.03, 0.03, 6, -3.6, 5.2, -2.9, CHROME));
  pools.push(disc(-7.0, 0.012, 0.6, 2.2, '#ffd0e0', 0.3), disc(0, 0.012, 6.6, 2.4, '#fff0d0', 0.3), disc(-5.6, VG + 0.6, -6.2, 1.4, '#ff9ad5', 0.25), disc(6.7, 0.012, 4.6, 2.4, '#e8f0ff', 0.25), disc(1.6, VG + 0.02, -6.4, 1.6, '#fff0e0', 0.25));
  hi.push(cone(-7.0, VG - 0.2, 0.6, 0.3, 1.4, 3.0, '#ffe8f0', 0.2), cone(0, VG - 0.2, 6.6, 0.3, 1.4, 3.0, '#fff0d0', 0.2));
  const f = fan(g, -7.0, 0.6, VG, '#fff6ec', '#ff9ad5'); room.extras.push(f);
  // levels: the pool (the swimmer's feet at -1.06 so the chin is at the water), the stair, the gallery
  const inPool = (x, z) => x > PX0 + 0.25 && x < PX1 - 0.25 && z > PZ0 + 0.25 && z < PZ1 - 0.25;
  const stairH = (x, z) => { const dx = x - S.x, dz = z - S.z, r = Math.hypot(dx, dz); if (dx < -0.05 || r < S.r0 - 0.15 || r > S.r1 + 0.1) return null; return Math.min(VG, Math.max(0, Math.atan2(Math.max(dx, 0), dz) / PI * VG)); };
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#5a3a5a', amb: 0.39, ambCol: '#fff0e8', bloomK: 0.6,
    view: { sky: true }, consoleCam: [-6.2, 2.0, 2.4, -HX + 0.2, 1.4, 0.6],
    lights: [{ x: -7, y: 3, z: 0.6, hex: '#ffe0f0', r: 6, k: 0.4 }, { x: 0, y: 3, z: 6.6, hex: '#fff0d0', r: 6, k: 0.4 }, { x: -1, y: -1.2, z: 0, hex: '#7fe8ff', r: 4, k: 0.6 }, { x: 0, y: 6, z: 0, hex: '#fff4e8', r: 14, k: 0.3 },
      { x: -5.6, y: VG + 2.2, z: -6.2, hex: '#ffd0e8', r: 4, k: 0.45 }, { x: 2.0, y: VG + 2.2, z: -6.6, hex: '#f0fff8', r: 4, k: 0.4 }, { x: 6.7, y: 3, z: 4.6, hex: '#f0f0ff', r: 5, k: 0.35 }],
    floorAt(x, z, y) {
      // the steps at the east end climb out of the water (0.5 m wide treads over 1.5 m)
      if (x > PX1 - 1.6 && x < PX1 + 0.1 && z > 0.8 && z < 2.4 && y < 0.6) return Math.min(0, -1.06 + Math.max(0, x - (PX1 - 1.6)) / 1.5 * 1.06);
      if (inPool(x, z)) return y < 0.6 ? -1.06 : y;
      const s = stairH(x, z); if (s !== null) return s;
      if (z < -3.6 && x < 5.4 && y > VG - 0.9) return VG;
      return 0;
    },
    ceilAt(x, z, y) { return y > 2 ? H - 0.4 : (z < -3.6 || x < -4.6 || z > 5.0 || (x > 4.4 && z > 1.4)) ? VG - 0.05 : H; },
    inPool, pool: { x0: PX0, x1: PX1, z0: PZ0, z1: PZ1 },
    blocks: [
      // the den wall, the garage walls, the hall arcade columns
      { x0: -4.7, x1: -4.5, z0: -3.6, z1: -1.6 }, { x0: -4.7, x1: -4.5, z0: 2.6, z1: 5.0 }, { x0: 4.4, x1: HX, z0: 1.3, z1: 1.5 }, { x0: 4.3, x1: 4.5, z0: 1.4, z1: 2.6 }, { x0: 4.3, x1: 4.5, z0: 3.8, z1: 5.0 },
      ...[-3.5, -1.2, 1.2, 3.5].map((x) => ({ x0: x - 0.25, x1: x + 0.25, z0: 4.85, z1: 5.35 })),
      ...[-4.4, -1.4, 1.4].map((x) => ({ x0: x - 0.25, x1: x + 0.25, z0: -3.85, z1: -3.35, y0: -1, y1: 1 })),
      // den furniture, the bar cart, garage bench, pool steps' rail
      { x0: -HX, x1: -8.3, z0: -0.7, z1: 1.9 }, { x0: -6.6, x1: -5.5, z0: -0.8, z1: 2.0 }, { x0: -8.2, x1: -6.4, z0: 2.2, z1: 3.3 }, { x0: -7.85, x1: -6.75, z0: -0.15, z1: 1.35 }, { x0: -5.7, x1: -4.7, z0: -3.1, z1: -2.5 },
      { x0: HX - 0.7, x1: HX, z0: 2.3, z1: 4.9 }, { x0: 4.9, x1: 8.5, z0: 2.6, z1: 7.3, car: true },
      // loungers, the umbrella, pots, the dining set
      { x0: -2.8, x1: -2.0, z0: 3.0, z1: 5.0 }, { x0: -0.8, x1: 0, z0: 3.0, z1: 5.0 }, { x0: 1.2, x1: 1.6, z0: 3.8, z1: 4.2 }, { x0: -2.8, x1: 0, z0: -6.8, z1: -4.8, y0: -1, y1: 1 },
      { x0: -4.3, x1: -3.5, z0: -3.6, z1: -2.8 }, { x0: 2.8, x1: 3.6, z0: -3.6, z1: -2.8 }, { x0: 3.2, x1: 4.0, z0: 4.0, z1: 4.8 }, { x0: -4.4, x1: -3.6, z0: 4.0, z1: 4.8 },
      // upstairs: the balustrade, the partition, the bed, the tub, the vanity, the wardrobe; the stair's outer rail
      { x0: -HX, x1: 5.4, z0: -3.7, z1: -3.45, y0: 3, y1: 9 }, { x0: -1.1, x1: -0.9, z0: -HZ, z1: -5.6, y0: 3, y1: 9 }, { x0: -1.1, x1: -0.9, z0: -4.4, z1: -3.8, y0: 3, y1: 9 },
      { x0: -6.8, x1: -4.4, z0: -7.4, z1: -5.0, y0: 3, y1: 9 }, { x0: 0.7, x1: 2.5, z0: -HZ, z1: -6.85, y0: 3, y1: 9 }, { x0: 3.6, x1: 4.8, z0: -HZ, z1: -7.3, y0: 3, y1: 9 }, { x0: -3.25, x1: -1.55, z0: -HZ, z1: -7.0, y0: 3, y1: 9 },
      { x0: -8.0, x1: -7.4, z0: -7.7, z1: -7.1, y0: 3, y1: 9 }, { x0: 5.4, x1: HX, z0: -HZ, z1: -4.6, y0: 3, y1: 9 },
    ],
    seats: [{ x: -6.1, z: 0.0, y: 0.5, yaw: -PI / 2, kind: 'booth' }, { x: -6.1, z: 1.2, y: 0.5, yaw: -PI / 2, kind: 'booth' }, { x: -7.3, z: 2.65, y: 0.5, yaw: PI, kind: 'booth' },
      { x: -2.4, z: 4.2, y: 0.5, yaw: PI, kind: 'lounger', view: true, cam: [-1.6, 2.4, 7.4, -0.8, 3.5, -8] }, { x: -0.4, z: 4.2, y: 0.5, yaw: PI, kind: 'lounger', view: true, cam: [0.8, 2.4, 7.4, -0.8, 3.5, -8] },
      { x: -5.6, z: -6.0, y: 0.75, yaw: 0, kind: 'lounger', fy: VG, home: 'bed' }, { x: 1.6, z: -7.3, y: 0.15, yaw: -PI / 2, kind: 'lounger', fy: VG, tub: true }],
    spawn: [0, 6.0],
    uses: [
      { x: -7.6, z: 0.6, r: 1.1, kind: 'tv', hint: 'the TV', look: [-HX, 0.6], cam: [2.2, 1.7, 1.6], lookY: 1.4 },
      { x: -8.2, z: 1.6, r: 0.7, kind: 'console', hint: 'play Tide Rider on the console', look: [-HX, 0.6] },
      { x: -5.2, z: -2.15, r: 0.8, kind: 'bar', hint: 'mix a drink at the bar cart', look: [-5.2, -2.8], cam: [1.4, 1.7, 1.6] },
      { x: -4.6, z: -6.0, r: 1.0, fy: VG, kind: 'bed', hint: 'sleep (and save)', look: [-5.6, -6.2], cam: [2.2, 2.0, 1.6] },
      { x: 1.6, z: -6.5, r: 0.8, fy: VG, kind: 'bath', hint: 'soak in the tub', look: [1.6, -7.3] },
      { x: -2.4, z: -6.5, r: 0.8, fy: VG, kind: 'wardrobe', hint: 'change clothes', face: 0.35 },
    ],
    wide: [6.0, 3.4, 7.0, -1.5, 1.0, -1.0],
    // the camera: in the courtyard from the hall side, in the den from its opening, upstairs over the balustrade
    camFor(lx, lz, ly) {
      if (ly > 2.4) return [Math.max(-7.5, Math.min(4.6, lx * 0.8)), VG + 2.8, -2.4, 1.0, 0.2];
      if (lx < -4.6) return [-4.0, 2.7, Math.min(4.6, lz + 2.4), 1.0, -0.6];
      if (lz < -3.4) return [lx * 0.6, 2.9, -1.0, 1.0, 0.6];
      if (lx > 4.4 && lz > 1.4) return [5.0, 3.0, 2.2, 0.6, -2.4];
      return [lx * 0.5, 3.4 + (ly < -0.5 ? -0.8 : 0), Math.min(HZ - 0.6, lz + 4.6), ly < -0.5 ? 0.0 : 1.0, 0.6];
    },
    tour: [[0, 3.2, 7.4, -0.8, 0.0, -2.0], [-4.2, 2.2, 3.6, -8.5, 1.3, 0.6], [7.8, 2.0, 1.2, 4.5, 2.6, -4.2], [3.4, VG + 1.9, -3.9, -5.6, VG + 0.4, -6.4], [-1.0, 5.8, 3.0, -1.0, -0.5, -1.0]],
    idle(t, dt, still) { st.userData.U.uT.value = t; pw.userData.U.uT.value = still ? t * 0.3 : t; f.rotation.y += dt * (still ? 0.5 : 1.8); },
  });
}

// ---- the Skyline Penthouse: its own file (game/penthouse.js), it is the biggest room in the game

// ---- The Driftwood Dory, a houseboat at Starboard Marina ---------------------------------------------------
// The boat lies along x with its gangway on the north side (-z, towards the boardwalk) at the aft deck (+x).
// The cabin (x -5..3) has a bunk, the galley, a vintage radio, a tiny wet room; the aft deck (x 3..7) the deck
// chairs and the fishing spot at the stern rail; a little foredeck at the bow.
function buildHouseboat(room, place) {
  const g = [], B = room.boards = boards(1024), HX = 7, HZ = 3, H = 2.5, pools = room.pools, hi = room.hiPools;
  const WOOD = '#b89070', DK = '#8a5a3a', CAB = '#a5e6cf', TRIM = '#ff8a6a';
  // the hull and the decks
  g.push(box(14.4, 0.8, 6.4, 0, -0.45, 0, '#f6f1e7'), box(14.5, 0.12, 6.5, 0, -0.22, 0, TRIM), box(14.6, 0.08, 6.6, 0, -0.8, 0, '#2a6a8a'));
  floor(g, -HX, HX, -HZ, HZ, 0, WOOD, null);
  for (const [x, z, w, d] of [[0, -HZ - 0.02, 14.2, 0.1], [0, HZ + 0.02, 14.2, 0.1], [HX + 0.02, 0, 0.1, 6], [-HX - 0.02, 0, 0.1, 6]]) g.push(box(w, 0.9, d, x, 0.45, z, '#f6f1e7'));
  for (const [x, z, w, d] of [[0, -HZ - 0.02, 14.3, 0.16], [0, HZ + 0.02, 14.3, 0.16], [HX + 0.02, 0, 0.16, 6.1], [-HX - 0.02, 0, 0.16, 6.1]]) g.push(box(w, 0.06, d, x, 0.92, z, DK));
  // the cabin: mint clapboard walls, round porthole windows, a door to the aft deck, the roof with a rail
  wallX(g, -HZ + 0.4, -5, 3, 0, H, CAB, [[-3.4, -2.2, 0.9, 1.8], [-0.6, 0.6, 0.9, 1.8]], 0.12); wallX(g, HZ - 0.4, -5, 3, 0, H, CAB, [[-3.4, -2.2, 0.9, 1.8], [-0.4, 0.8, 0.9, 1.8]], 0.12);
  wallZ(g, -5, -HZ + 0.4, HZ - 0.4, 0, H, CAB, [[-0.6, 0.6, 0.9, 1.7]], 0.12); wallZ(g, 3, -HZ + 0.4, HZ - 0.4, 0, H, CAB, [[-0.5, 0.5, 0, 2.0]], 0.12);
  for (let y = 0.3; y < H; y += 0.3) for (const z of [-HZ + 0.33, HZ - 0.33]) g.push(box(8.0, 0.03, 0.02, -1, y, z, '#8fd0bc'));
  g.push(pbox(8.6, 0.16, 5.4, -1, H + 0.08, 0, '#f0ece4', 1.2), box(8.7, 0.06, 5.5, -1, H + 0.2, 0, TRIM));
  for (const [x, z] of [[-2.8, -HZ + 0.4], [0, -HZ + 0.4], [-2.8, HZ - 0.4], [0.2, HZ - 0.4]]) g.push(box(1.3, 0.12, 0.16, x, 1.85, z, '#f6f1e7'), box(1.3, 0.12, 0.16, x, 0.85, z, '#f6f1e7'));
  room.extras.push(glass([pane(1.2, 0.9, -2.8, 1.35, -HZ + 0.4), pane(1.2, 0.9, 0, 1.35, -HZ + 0.4), pane(1.2, 0.9, -2.8, 1.35, HZ - 0.4), pane(1.2, 0.9, 0.2, 1.35, HZ - 0.4), pane(1.2, 0.8, -5, 1.3, 0, PI / 2)]));
  // inside: plank floor, a braided rug, the bunk (a quilt), the galley, the radio, the little wet room
  rug(g, 2.6, 1.6, -1.2, 0, '#c84a3a', '#f4e2b0', '#2a6a8a', 'stripes');
  g.push(box(2.2, 0.45, 0.9, -3.8, 0.23, 2.05, DK), box(2.1, 0.18, 0.84, -3.8, 0.54, 2.05, '#fbf7f0'), box(2.12, 0.08, 0.86, -3.6, 0.65, 2.05, '#2a6a8a'), box(0.5, 0.12, 0.6, -4.6, 0.68, 2.05, CREAM),
    box(2.2, 0.08, 0.9, -3.8, 1.55, 2.05, DK), box(2.1, 0.12, 0.84, -3.8, 1.65, 2.05, '#fbf7f0'), box(2.12, 0.06, 0.86, -3.7, 1.74, 2.05, '#ff9ac8'), box(0.06, 1.7, 0.06, -2.72, 0.85, 1.62, DK));
  for (let i = 0; i < 5; i++) g.push(box(0.4, 0.06, 0.86, -4.6 + i * 0.45, 0.7, 2.05, ['#ff6a3d', '#ffe14a', '#2a6a8a', '#ff9ac8', '#8dffcf'][i]));
  g.push(box(2.4, 0.9, 0.6, -1.2, 0.45, -2.25, '#f6f1e7'), box(2.5, 0.05, 0.65, -1.2, 0.92, -2.25, '#2a6a8a'), box(0.45, 0.05, 0.4, -0.5, 0.94, -2.25, CHROME),
    cyl(0.1, 0.1, 0.02, 10, -1.7, 0.95, -2.25, BLK), cyl(0.08, 0.1, 0.16, 10, -1.7, 1.03, -2.25, '#ff6a3d'), box(0.9, 0.5, 0.35, -1.2, 1.9, -2.4, WOOD));
  for (let i = 0; i < 5; i++) g.push(cyl(0.04, 0.05, 0.1, 8, -1.55 + i * 0.18, 1.72, -2.4, ['#fff6ec', '#ff9ac8', '#7fe0ff'][i % 3]));
  // the vintage radio: a walnut arch with a gold grille and a lit dial
  g.push(box(0.5, 0.42, 0.28, 1.6, 1.13, -2.35, '#7a4a2a'), cyl(0.25, 0.25, 0.28, 12, 1.6, 1.34, -2.35, '#7a4a2a', PI / 2), box(0.3, 0.22, 0.02, 1.6, 1.16, -2.2, GOLD), box(0.22, 0.05, 0.02, 1.6, 0.98, -2.2, '#ffd9a0'),
    box(0.9, 0.85, 0.5, 1.6, 0.43, -2.35, DK));
  const dial = pulser([box(0.2, 0.04, 0.01, 1.6, 0.98, -2.19, '#ffd9a0')], 'pulse', 6); room.extras.push(dial);
  // the wet room: a curtain, a hand shower; a locker for clothes; a wheel and a chart on the wall
  g.push(box(1.0, 0.06, 1.0, 2.25, 0.04, 2.1, '#e8f8f4'), box(0.04, 2.0, 1.1, 1.72, 1.1, 2.1, '#ffd0e4'), cyl(0.06, 0.04, 0.04, 8, 2.4, 2.0, 2.45, CHROME), box(0.02, 1.0, 0.02, 2.5, 1.5, 2.5, CHROME));
  const st = steam(2.25, 0.2, 2.1, 0.7); room.extras.push(st); room.steam = st;
  g.push(box(0.6, 1.8, 0.5, -4.6, 0.9, -2.15, '#7fe0d0'), box(0.02, 1.6, 0.02, -4.6, 0.9, -1.89, '#5fb0a0'), box(0.08, 0.08, 0.04, -4.45, 1.0, -1.88, GOLD));
  B.add(0.4, 1.4, -4.6, 0.95, -1.89, 0, (c, Ww, Hh) => P.mirror(c, Ww, Hh, ['#7aa0b8', '#c8e0ec'], [['#ffd0a0', 2]], 13));
  g.push(cyl(0.35, 0.35, 0.05, 12, -4.92, 1.5, 0.8, DK, 0, PI / 2), cyl(0.06, 0.06, 0.1, 6, -4.9, 1.5, 0.8, GOLD, 0, PI / 2));
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.push(box(0.04, 0.04, 0.85, -4.9, 1.5 + Math.sin(a) * 0.2, 0.8 + Math.cos(a) * 0.2, DK, a)); }
  picture(g, B, -4.94, 1.45, -0.9, PI / 2, 0.9, 0.7, DK, (c, Ww, Hh) => { P.fill(c, Ww, Hh, '#f4e2b0'); c.strokeStyle = '#2a6a8a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Ww * 0.5, Hh * 0.55, Hh * (0.08 + i * 0.07), 0, 6.3); c.stroke(); } P.text(c, 'TIDE CHART', Ww / 2, Hh * 0.12, Hh * 0.12, '#8a4a2a'); });
  // a lamp and a rocking chair; strings of bulbs out on the deck; life rings; a lantern
  g.push(box(0.7, 0.4, 0.7, 0.9, 0.35, 1.6, '#c84a3a'), box(0.7, 0.7, 0.1, 0.9, 0.85, 1.95, DK), box(0.9, 0.04, 0.08, 0.9, 0.04, 1.3, DK));
  g.push(cyl(0.14, 0.16, 0.24, 10, -0.6, H - 0.2, 0, '#ffd9a0'));
  for (let i = 0; i < 9; i++) g.push(box(0.1, 0.1, 0.1, 3.2 + i * 0.45, 2.35 - Math.sin(i / 8 * PI) * 0.3, -2.7, ['#ffe14a', '#ff9ac8', '#7fe0ff'][i % 3]), box(0.1, 0.1, 0.1, 3.2 + i * 0.45, 2.35 - Math.sin(i / 8 * PI) * 0.3, 2.7, ['#ff9ac8', '#7fe0ff', '#ffe14a'][i % 3]));
  for (const [x, z] of [[6.9, -2.9], [6.9, 2.9], [3.1, -2.9], [3.1, 2.9]]) g.push(box(0.1, 2.4, 0.1, x, 1.2, z, DK));
  for (const z of [-HZ - 0.08, HZ + 0.08]) g.push(tint(new THREE.TorusGeometry(0.3, 0.07, 6, 14).translate(5.0, 0.55, z), '#ff6a3d'));
  // the aft deck: two deck chairs facing the open water, a bait bucket and the rod holder at the stern
  for (const z of [-1.4, 0.9]) g.push(box(0.6, 0.06, 1.2, 5.3, 0.4, z, '#2a6a8a'), box(0.6, 0.7, 0.06, 4.8, 0.7, z + 0.0, '#2a6a8a', 0, PI / 2 - 0.0, 0.5), box(0.04, 0.4, 0.04, 5.0, 0.2, z - 0.5, WOOD), box(0.04, 0.4, 0.04, 5.0, 0.2, z + 0.5, WOOD), box(0.04, 0.4, 0.04, 5.6, 0.2, z - 0.5, WOOD), box(0.04, 0.4, 0.04, 5.6, 0.2, z + 0.5, WOOD));
  g.push(cyl(0.18, 0.15, 0.32, 10, 6.4, 0.16, -2.2, '#ffe14a'), cyl(0.05, 0.05, 0.4, 6, 6.85, 0.95, 0.0, CHROME));
  // the foredeck: a coil of rope, the anchor locker, a flag; the gangway gap in the north rail at the aft deck
  g.push(cyl(0.3, 0.3, 0.12, 12, -6.2, 0.06, 0.0, '#e8d8a8'), box(0.8, 0.3, 0.8, -6.2, 0.15, 1.6, DK), box(0.04, 1.6, 0.04, -6.8, 1.7, 0, CHROME), box(0.6, 0.35, 0.02, -6.5, 2.3, 0, '#ff6a8a'));
  const bob = new THREE.Mesh(merge([cyl(0.06, 0.06, 0.08, 8, 0, 0.04, 0, '#ff3f3a'), cyl(0.06, 0.06, 0.06, 8, 0, -0.03, 0, '#ffffff')]), new THREE.MeshBasicMaterial({ vertexColors: true }));
  bob.visible = false; room.extras.push(bob); room.bobber = bob;
  pools.push(disc(-0.6, 0.012, 0, 2.2, '#ffe8c8', 0.1), disc(1.6, 1.0, -2.15, 0.5, '#ffd9a0', 0.3, 'z'), disc(5.0, 0.012, 0, 2.6, '#ffd9a0', 0.12));
  hi.push(cone(-0.6, H - 0.3, 0, 0.14, 1.0, H - 0.4, '#ffe8c0', 0.12));
  const b = place.b;
  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, rim: '#3a4a5a', amb: 0.4, ambCol: '#f4f8ff', bloomK: 0.4,
    view: { x: b.cx, y: 0.35, z: b.cz },
    lights: [{ x: -0.6, y: 1.6, z: 0, hex: '#fff2e0', r: 5, k: 0.3 }, { x: 1.6, y: 1.1, z: -2.0, hex: '#ffe0b0', r: 2.5, k: 0.3 }, { x: 5.0, y: 2.2, z: 0, hex: '#ffe8c8', r: 5, k: 0.25 }, { x: -3.8, y: 1.4, z: 1.8, hex: '#fff0e0', r: 2.5, k: 0.25 }],
    bounds: { x0: -HX, x1: HX, z0: -HZ, z1: HZ },
    ceilAt(x) { return x > -5 && x < 3 ? H : 6; },
    blocks: [
      // the cabin walls (the doors: x -0.5..0.5 at x = 3 aft, x -0.6..0.6 at -5 is a window), with the side decks
      { x0: -5.1, x1: 3.1, z0: -HZ + 0.3, z1: -HZ + 0.5 }, { x0: -5.1, x1: 3.1, z0: HZ - 0.5, z1: HZ - 0.3 }, { x0: -5.1, x1: -4.9, z0: -HZ, z1: HZ }, { x0: 2.9, x1: 3.1, z0: -HZ, z1: -0.5 }, { x0: 2.9, x1: 3.1, z0: 0.5, z1: HZ },
      { x0: -HX, x1: -5.1, z0: -HZ, z1: HZ },
      // inside: the bunk, the galley, the radio stand, the locker, the wet room, the rocking chair
      { x0: -4.9, x1: -2.65, z0: 1.55, z1: 2.6 }, { x0: -2.5, x1: 0.1, z0: -2.6, z1: -1.9 }, { x0: 1.1, x1: 2.1, z0: -2.6, z1: -2.05 }, { x0: -4.9, x1: -4.25, z0: -2.6, z1: -1.85 }, { x0: 1.65, x1: 2.9, z0: 1.55, z1: 2.6 },
      { x0: 0.5, x1: 1.3, z0: 1.2, z1: 2.1 },
      // the deck chairs, the bucket, the rail posts
      { x0: 4.8, x1: 5.65, z0: -2.0, z1: -0.8 }, { x0: 4.8, x1: 5.65, z0: 0.3, z1: 1.5 }, { x0: 6.2, x1: 6.6, z0: -2.4, z1: -2.0 },
    ],
    seats: [{ x: 0.9, z: 1.5, y: 0.5, yaw: PI, kind: 'booth' }, { x: -3.6, z: 1.9, y: 0.6, yaw: -PI / 2, kind: 'lounger', home: 'bed' },
      { x: 5.25, z: -1.4, y: 0.42, yaw: PI / 2, kind: 'lounger', view: true, cam: [3.4, 2.2, -2.2, 40, -1.5, 8] }, { x: 5.25, z: 0.9, y: 0.42, yaw: PI / 2, kind: 'lounger', view: true, cam: [3.4, 2.2, 1.9, 40, -1.5, -8] }],
    entry: [5.0, -2.4], spawn: [4.2, -1.0], exit: [5.0, -2.5], faceIn: 0,
    uses: [
      { x: -3.4, z: 1.0, r: 0.9, kind: 'bed', hint: 'sleep in the bunk (and save)', look: [-3.8, 2.05], cam: [1.8, 1.4, -1.6] },
      { x: -1.2, z: -1.4, r: 0.9, kind: 'galley', hint: 'the galley', look: [-1.2, -2.25], cam: [1.4, 1.5, 1.5] },
      { x: 1.6, z: -1.5, r: 0.7, kind: 'radio', hint: 'the radio', look: [1.6, -2.35], cam: [-1.2, 1.4, 1.2], lookY: 1.1 },
      { x: 2.25, z: 1.2, r: 0.6, kind: 'shower', hint: 'a quick shower', look: [2.25, 2.1] },
      { x: -4.0, z: -1.4, r: 0.7, kind: 'wardrobe', hint: 'the locker', face: 0.35 },
      { x: 6.3, z: 0.0, r: 0.8, kind: 'fish', hint: 'fish off the stern' },
    ],
    wide: [-2.4, 2.0, -1.2, 4.6, 0.8, 0.0],
    camFor(lx, lz) {
      if (lx > 3) return [Math.max(3.4, lx - 3.0), 2.6, Math.max(-2.2, Math.min(2.2, lz + (lz > 0 ? -2.0 : 2.0))), 0.9, 0];
      if (lx < -5) return [-3.8, 2.0, 0, 0.8, 0];
      return [Math.min(2.6, lx + 3.0), 2.15, Math.max(-2.2, Math.min(2.2, lz * 0.5)), 0.9, 0.0];
    },
    tour: [[6.6, 2.2, -2.4, 2.0, 1.0, 0.0], [2.4, 1.9, 2.0, -3.6, 1.0, 1.6], [2.4, 1.8, -1.6, -1.2, 1.0, -2.4], [3.6, 1.8, 0, 60, 0.2, 0]],
    idle(t, dt, still) { st.userData.U.uT.value = t; dial.userData.tick(t, still); },
  });
}

export const HOME_BUILD = { realty: buildRealty, estates: buildEstates, studio: buildStudio, villa: buildVilla, penthouse: buildPenthouse, houseboat: buildHouseboat };
