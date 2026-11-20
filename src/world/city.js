// Builds the whole static town from the layout: ground, art-deco blocks, neon,
// windows, signs, lamps, palms, pier and beach furniture. Everything is merged
// or instanced, so the entire city is roughly a dozen draw calls.
import * as THREE from 'three';
import { box, cyl, tint, merge, timeU, fogU, FOG_PARS, PI, rng, wetU, rainU, reflU, nightU } from '../core/util.js';
import { HX, HZ, PIER, SIGN_NAMES, ADS, EDGE_SIGNS } from './layout.js';
import { LADDERS, LADDER_GAP, shelfGeometry } from './sea.js';
import { addEdges } from './edges.js';
import { paintGround, paintSigns, SIGN_ROWS } from './textures.js';
import { addDetails, buildLife } from './details.js';
import { createGlow } from './glow.js';
import { rampParts } from './rampGeo.js';
import { neonPools } from './neonpools.js';
import { quality } from '../core/quality.js';

function roundedShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
  s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, PI / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, PI / 2, PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5, false);
  return s;
}
// A rounded-corner slab standing on y0.
function slab(w, d, r, h, cx, y0, cz, hex) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, d, Math.min(r, w / 2 - 0.01, d / 2 - 0.01)), { depth: h, bevelEnabled: false, curveSegments: 3 });
  g.rotateX(-PI / 2);
  g.translate(cx, y0, cz);
  return tint(g, hex);
}

// Night street light without lights: one 600 x 300 canvas (1 px = 1 m) with a warm pool painted under
// every street lamp and a softer spill in front of every lit shop window and door. The ground shader
// adds albedo * pool * night, so the back streets read as lit at midnight. A knocked-down lamp is
// simply left out of the next repaint.
function createLampMap(L) {
  const W = HX * 2, H = HZ * 2, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  let data = null;
  const pool = (x, z, rad, a, rgb = '255,196,128') => {
    const g = ctx.createRadialGradient(x, z, 0, x, z, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.42})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, z - rad, rad * 2, rad * 2);
  };
  const paint = () => {
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L.lamps) if (!l.dead) pool(l.x + Math.sin(l.yaw) * 1.45 + HX, l.z + Math.cos(l.yaw) * 1.45 + HZ, 9.5, 0.8);
    for (const b of L.buildings) {
      if (b.hotel) { pool(b.cx + HX, b.z1 + 2.2 + HZ, 5, 0.32, '255,214,160'); continue; }
      const sx = b.cx + b.w * 0.17 + HX, sw = Math.min(b.w * 0.42, 8), z = b.z1 + HZ;
      const g = ctx.createLinearGradient(0, z, 0, z + 4.5);
      g.addColorStop(0, 'rgba(255,214,160,0.42)'); g.addColorStop(1, 'rgba(255,214,160,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - sw / 2 - 0.5, z, sw + 1, 4.5);
    }
    for (const k in L.places) { const p = L.places[k]; pool(p.x + HX, p.z - 3 + HZ, 5, 0.35, '255,150,220'); }
    // the big neon signs throw a pool of their own colour (High quality)
    if (quality.high && L.neonPools) for (const n of L.neonPools) pool(n.x + HX, n.z + HZ, n.r, n.a, n.rgb);
    data = ctx.getImageData(0, 0, W, H).data;
  };
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return {
    tex,
    repaint() { paint(); tex.needsUpdate = true; },
    // the lamp-light term (0..1+) the ground gets at (x, z) at full night, for checks
    sample(x, z) { const i = (Math.floor(clampN(z + HZ, 0, H - 1)) * W + Math.floor(clampN(x + HX, 0, W - 1))) * 4; return (data[i] + data[i + 1] + data[i + 2]) / 765; },
  };
}
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
export const LAMP_GAIN = 1.7;

// The ground material: albedo from a painted canvas, lamp pools at night, and (in the rain) darker asphalt,
// a sky sheen, lamp streaks and rain speckle, all in the one fragment shader. x0/z0/W/H: the rectangle the
// canvases cover; streaks: the old town's boulevard lamps make reflections (their positions are a formula).
export function groundMaterial(tex, lampTex, x0, z0, W, H, streaks) {
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uWet: wetU, uRain: rainU, uNight: nightU, uTime: timeU, uSkyC: reflU.sky, uSunC: reflU.sun, uSunD: reflU.dir, uLampMap: { value: lampTex } });
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uWet, uRain, uNight, uTime; uniform vec3 uSkyC, uSunC, uSunD; uniform sampler2D uLampMap; varying vec3 vWP;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
        float wetK = uWet * (0.5 + 0.5 * smoothstep(0.45, 0.12, dot(diffuseColor.rgb, vec3(0.333))));
        diffuseColor.rgb *= 1.0 - 0.4 * wetK;`)
      .replace('#include <opaque_fragment>', /* glsl */`
        vec3 lampL = texture2D(uLampMap, vec2((vWP.x - ${x0.toFixed(1)}) / ${W.toFixed(1)}, (vWP.z - ${z0.toFixed(1)}) / ${H.toFixed(1)})).rgb;
        outgoingLight += diffuseColor.rgb * lampL * uNight * ${LAMP_GAIN.toFixed(2)};
        if (uWet > 0.01) {
          vec3 V = normalize(cameraPosition - vWP);
          vec3 N = normalize(vec3(sin(vWP.x * 3.1 + sin(vWP.z * 2.3)) * 0.03, 1.0, cos(vWP.x * 2.2 + vWP.z * 3.3) * 0.03));
          vec3 refl = uSkyC * pow(1.0 - max(dot(V, N), 0.0), 4.0) * 0.7;
          vec3 lampC = vec3(1.0, 0.76, 0.46) * uNight;
          ${streaks ? `for (int r = 0; r < 2; r++) {
            float lz = r == 0 ? 44.05 : 61.95, lx = r == 0 ? -285.0 : -270.0;
            float bx = floor((vWP.x - lx) / 30.0 + 0.5);
            for (int k = -1; k <= 1; k++) {
              vec3 Ld = vec3(lx + (bx + float(k)) * 30.0, 5.9, lz) - vWP;
              float d2 = dot(Ld, Ld);
              vec3 Hh = normalize(Ld * inversesqrt(d2) + V);
              refl += lampC * pow(max(dot(N, Hh), 0.0), 240.0) * 16.0 / (1.0 + d2 * 0.012);
            }
          }` : 'refl += lampL * lampC * 0.6 * pow(1.0 - max(dot(V, N), 0.0), 2.0);'}
          refl += uSunC * pow(max(dot(N, normalize(uSunD + V)), 0.0), 140.0);
          vec2 cell = floor(vWP.xz * 2.5);
          refl += vec3(0.55, 0.6, 0.7) * step(0.991, fract(sin(dot(cell, vec2(12.9898, 78.233)) + floor(uTime * 9.0) * 3.7) * 43758.5453)) * uRain * 0.5;
          outgoingLight += refl * wetK;
        }
        #include <opaque_fragment>`);
  };
  return mat;
}

export function buildGround(scene, L, renderer) {
  const canvas = paintGround(L);
  const lampMap = L.lampMap = createLampMap(L);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const geo = new THREE.PlaneGeometry(HX * 2, HZ * 2);
  geo.rotateX(-PI / 2);
  const ground = new THREE.Mesh(geo, groundMaterial(tex, lampMap.tex, -HX, -HZ, HX * 2, HZ * 2, true));
  // sandy skirt so the island has an edge where it meets the water
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, 3, HZ * 2), new THREE.MeshLambertMaterial({ color: '#c9a878' }));
  skirt.position.y = -1.52;
  // both belong to the old town's district group (world/districts.js hides them from far away)
  L.groundMeshes = [ground, skirt];
  return canvas;
}

export function buildCity(scene0, L) {
  // everything the old town draws goes in one group, so it can be swapped for a silhouette from far away
  const scene = new THREE.Group();
  scene0.add(scene);
  if (L.groundMeshes) scene.add(...L.groundMeshes);
  const r = rng(404);
  const solid = [], neon = [], winM = [], winSeed = [], signs = [], glows = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3(), sc = new THREE.Vector3();

  const addWin = (x, y, z, yaw, w, h, seed) => {
    m4.compose(v.set(x, y, z), q.setFromAxisAngle(UP, yaw), sc.set(w, h, 1));
    winM.push(m4.clone()); winSeed.push(seed);
  };
  function faceWindows(b, face) {
    const along = face < 2 ? b.w : b.d;
    const usable = along - 2 * b.r - 1.2;
    if (usable < 2.4) return;
    const n = Math.max(1, Math.floor(usable / 2.8)), sp = usable / n;
    const ww = b.ribbon ? sp - 0.3 : Math.min(sp - 0.6, 1.8);
    for (let f = 0; f < b.floors; f++) {
      for (let i = 0; i < n; i++) {
        const t = -usable / 2 + sp * (i + 0.5);
        if (face === 0 && b.hotel && Math.abs(t) < 3.3) continue;
        const y = f * 3.2 + 1.85, seed = Math.min(0.999, r() * b.litBias);
        if (face === 0) addWin(b.cx + t, y, b.z1 + 0.04, 0, ww, 1.7, seed);
        else if (face === 1) addWin(b.cx - t, y, b.z0 - 0.04, PI, ww, 1.7, seed);
        else if (face === 2) addWin(b.x1 + 0.04, y, b.cz - t, PI / 2, ww, 1.7, seed);
        else addWin(b.x0 - 0.04, y, b.cz + t, -PI / 2, ww, 1.7, seed);
      }
    }
  }

  for (const b of L.buildings) {
    const { cx, cz, w, d, h, r: rad } = b;
    solid.push(slab(w, d, rad, h, cx, 0, cz, b.color));
    solid.push(slab(w + 0.5, d + 0.5, rad + 0.25, 0.7, cx, 0, cz, b.accent));                 // plinth
    for (let f = 1; f < b.floors; f++) solid.push(slab(w + 0.6, d + 0.6, rad + 0.3, 0.28, cx, f * 3.2 - 0.14, cz, '#fbf7f0')); // eyebrows
    solid.push(slab(w + 0.8, d + 0.8, rad + 0.4, 0.7, cx, h - 0.2, cz, b.accent));             // cornice
    solid.push(slab(w - 3, d - 3, rad, 0.9, cx, h + 0.5, cz, '#fbf7f0'));                      // parapet step
    neon.push(slab(w + 0.95, d + 0.95, rad + 0.48, 0.16, cx, h + 0.52, cz, b.neon));           // roofline tube
    if (b.row < 2) neon.push(slab(w + 0.72, d + 0.72, rad + 0.36, 0.1, cx, 3.2 + 0.16, cz, b.neon));
    if (b.hotel) {
      // stepped central tower with vertical neon fins and a canopy over the door
      const fz = b.z1 + 0.5;
      solid.push(box(6, h + 3.2, 1.6, cx, (h + 3.2) / 2, fz, '#fbf7f0'));
      solid.push(box(3.6, 2.4, 1.6, cx, h + 4.4, fz, b.accent));
      solid.push(box(1.4, 2.6, 1.2, cx, h + 6.9, fz, '#fbf7f0'));
      for (const ox of [-1.8, 0, 1.8]) neon.push(box(0.16, h - 9.4, 0.12, cx + ox, 4.4 + (h - 9.4) / 2, fz + 0.86, b.neon));
      neon.push(box(0.2, 2.6, 0.2, cx, h + 9.4, fz, b.neon));
      glows.push([cx, h + 10.4, fz, b.neon, 7, 0.05]);
      glows.push([cx, h * 0.55, fz + 1.4, b.neon, 16, 0]);
      solid.push(box(8, 0.35, 3.4, cx, 3.25, b.z1 + 1.7, b.accent));
      neon.push(box(8.2, 0.12, 0.12, cx, 3.05, b.z1 + 3.42, b.neon));
      solid.push(box(3.2, 2.7, 0.2, cx, 1.35, fz + 0.75, '#2b2440'));                            // doorway
      if (b.bar) {
        // The Velvet Flamingo: a neon flamingo and a velvet-rope doorway
        const P = '#ff4fc0', nz = fz + 0.86, nx = cx + 4.6;
        neon.push(box(0.1, 1.5, 0.1, nx, 4.6, nz, P), box(0.1, 0.9, 0.1, nx + 0.35, 4.3, nz, P, 0, 0, 0.5),
          box(1.3, 0.75, 0.1, nx - 0.1, 5.7, nz, P, 0, 0, 0.25), box(0.1, 1.3, 0.1, nx + 0.75, 6.6, nz, P, 0, 0, -0.35),
          box(0.42, 0.34, 0.1, nx + 1.05, 7.3, nz, P), box(0.4, 0.1, 0.1, nx + 1.4, 7.12, nz, '#ffe14a', 0, 0, -0.5));
        neon.push(box(3.6, 0.1, 0.1, cx, 2.85, fz + 0.9, P), box(0.1, 2.8, 0.1, cx - 1.75, 1.4, fz + 0.9, P), box(0.1, 2.8, 0.1, cx + 1.75, 1.4, fz + 0.9, P));
        solid.push(cyl(0.06, 0.08, 1, 6, cx - 2.4, 0.5, fz + 2.4, '#ffd166'), cyl(0.06, 0.08, 1, 6, cx + 2.4, 0.5, fz + 2.4, '#ffd166'));
        glows.push([nx + 0.3, 5.8, nz + 0.5, P, 9, 0.15]);
      }
    } else {
      solid.push(box(2.6, 2.6, 0.2, cx - w * 0.2, 1.3, b.z1 + 0.05, '#2b2440'));
      solid.push(box(3, 1.6, 3, cx + w * 0.18, h + 1.3, cz, b.accent));                         // roof plant room
    }
    faceWindows(b, 0); faceWindows(b, 2); faceWindows(b, 3);
    if (b.row < 2) faceWindows(b, 1);
    if (b.name) {
      // hotels hang the sign across the tower front; everything else gets a rooftop frame
      const sw = Math.min(b.hotel ? w * 0.62 : w * 0.7, 16), sh = sw / 4;
      const sx = cx, sy = b.hotel ? h - 2.4 : h + 1.9 + sh / 2, sz = b.hotel ? b.z1 + 1.5 : b.z1 - 0.8;
      signs.push({ name: b.name, color: b.neon, x: sx, y: sy, z: sz, yaw: 0, w: sw, h: sh });
      solid.push(box(sw + 0.3, sh + 0.2, 0.2, sx, sy, sz - 0.14, '#1d1630'));
      if (!b.hotel) {
        solid.push(box(0.2, 1.6, 0.2, sx - sw * 0.35, h + 1.1, sz - 0.14, '#1d1630'));
        solid.push(box(0.2, 1.6, 0.2, sx + sw * 0.35, h + 1.1, sz - 0.14, '#1d1630'));
      }
      glows.push([sx, sy, sz + 0.6, b.neon, sw * 1.5, 0]);
    }
  }

  addDetails(L, solid, neon, glows, addWin, signs);
  for (const rp of L.ramps) if (rp.x > -HX) rampParts(rp, solid, neon);
  const blinkers = addEdges(solid, neon, glows, signs);

  // --- pier
  const px = (PIER.x0 + PIER.x1) / 2, plen = PIER.z1 - PIER.z0, pzc = PIER.z0 + plen / 2;
  solid.push(box(12, 0.5, plen, px, -0.25, pzc, '#b98a5e'));
  for (let z = PIER.z0 + 2; z < PIER.z1; z += 4) solid.push(box(11.6, 0.02, 0.18, px, 0.012, z, '#93683f'));
  for (const sx of [PIER.x0 + 0.15, PIER.x1 - 0.15]) {
    // the rail opens at each ladder (LADDER_GAP metres either side)
    const gaps = LADDERS.filter((l) => l.pier === 'a' && (l.s < 0) === (sx < px)).map((l) => l.z).sort((a, b) => a - b);
    let a0 = PIER.z0;
    for (const gz of [...gaps, PIER.z1 + LADDER_GAP]) {
      const a1 = Math.min(gz - LADDER_GAP, PIER.z1);
      if (a1 > a0 + 0.2) {
        solid.push(box(0.12, 0.12, a1 - a0, sx, 1.1, (a0 + a1) / 2, '#fbf7f0'));
        neon.push(box(0.07, 0.07, a1 - a0, sx, 1.2, (a0 + a1) / 2, sx < px ? '#18f0ff' : '#ff2bd1'));
      }
      a0 = gz + LADDER_GAP;
    }
    for (let z = PIER.z0; z <= PIER.z1; z += 5) if (!gaps.some((g) => Math.abs(g - z) < LADDER_GAP + 0.1)) solid.push(box(0.16, 1.1, 0.16, sx, 0.55, z, '#fbf7f0'));
    for (let z = PIER.z0 + 6; z <= PIER.z1; z += 12.5) solid.push(cyl(0.32, 0.32, 4, 6, sx, -2, z, '#6b4a30'));
  }
  // ladders: two steel rails and rungs from under the water up over the deck edge, with grab handles
  for (const l of LADDERS.filter((k) => k.pier === 'a')) {
    const sx = l.x + l.s * 0.22, hx = l.x - l.s * 0.35;
    for (const o of [-0.3, 0.3]) {
      solid.push(box(0.07, 3.9, 0.07, sx, -0.75, l.z + o, '#cfd6dd'));
      solid.push(box(0.07, 0.07, 0.07, sx, 1.22, l.z + o, '#cfd6dd'), box(0.5, 0.06, 0.07, hx + l.s * 0.1, 1.25, l.z + o, '#cfd6dd'), box(0.07, 0.6, 0.07, hx - l.s * 0.15, 1.0, l.z + o, '#cfd6dd'));
    }
    for (let y = -2.5; y < 1.1; y += 0.33) solid.push(box(0.05, 0.05, 0.6, sx, y, l.z, '#b7c0c9'));
  }
  // the sand where the beach slopes into the sea (a merged part of the city mesh)
  solid.push(shelfGeometry());
  solid.push(box(12, 0.12, 0.12, px, 1.1, PIER.z1 - 0.1, '#fbf7f0'));
  // entrance arch + sign (faces the island)
  solid.push(box(0.5, 5.6, 0.5, PIER.x0 + 0.3, 2.8, 151, '#f7b3c6'), box(0.5, 5.6, 0.5, PIER.x1 - 0.3, 2.8, 151, '#f7b3c6'));
  solid.push(box(12, 2.4, 0.4, px, 5.6, 151.1, '#1d1630'));
  signs.push({ name: 'Driftwood Pier', color: '#18f0ff', x: px, y: 5.6, z: 150.86, yaw: PI, w: 9, h: 2.25 });
  glows.push([px, 5.6, 150, '#18f0ff', 14, 0]);
  // kiosk at the far end
  solid.push(slab(6, 6, 2, 3.4, px, 0, 242, '#8fe3d9'), slab(7, 7, 2.4, 0.4, px, 3.4, 242, '#ff4fa3'));
  neon.push(slab(7.2, 7.2, 2.5, 0.14, px, 3.8, 242, '#ffe14a'));
  glows.push([px, 4.2, 242, '#ffe14a', 12, 0]);

  // --- lifeguard huts
  for (const h of L.huts) {
    for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) solid.push(box(0.2, 2.2, 0.2, h.x + ox, 1.1, h.z + oz, '#fbf7f0'));
    solid.push(box(4.4, 0.2, 4.4, h.x, 2.2, h.z, '#fbf7f0'), box(3.4, 2.2, 3.4, h.x, 3.4, h.z, h.color));
    solid.push(box(4.6, 0.3, 4.6, h.x, 4.65, h.z, h.accent), box(1.2, 0.12, 3.4, h.x, 1.1, h.z - 3.4, '#fbf7f0', -0.62));
    solid.push(box(0.08, 2, 0.08, h.x + 1.6, 5.8, h.z + 1.6, '#fbf7f0'), box(0.9, 0.5, 0.04, h.x + 2.05, 6.5, h.z + 1.6, h.accent));
  }

  // --- merged meshes
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const body = new THREE.Mesh(merge(solid), bodyMat);
  scene.add(body);
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  scene.add(new THREE.Mesh(merge(neon), neonMat));

  // --- windows: one instanced quad, lit/unlit decided in the shader from a per-instance seed
  const winU = { uLit: { value: 0 }, uGlass: { value: new THREE.Color('#2c5f7a') }, ...fogU };
  const winMat = new THREE.ShaderMaterial({
    uniforms: winU, fog: false,
    vertexShader: /* glsl */`
      attribute float aSeed;
      varying vec2 vUv; varying float vSeed; varying float vDist;
      void main(){
        vUv = uv; vSeed = aSeed;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uLit; uniform vec3 uGlass;
      ${FOG_PARS}
      varying vec2 vUv; varying float vSeed; varying float vDist;
      void main(){
        float s2 = fract(vSeed * 7.31 + 0.17), s3 = fract(vSeed * 13.7);
        float on = step(vSeed, uLit);
        vec3 warm = mix(vec3(1.0, 0.76, 0.38), vec3(0.35, 0.9, 1.0), step(0.8, s2));
        warm = mix(warm, vec3(1.0, 0.3, 0.72), step(0.93, s2));
        float blind = mix(0.55, 1.0, step(0.25 + s3 * 0.6, 1.0 - vUv.y));
        vec3 glass = uGlass * (0.55 + 0.7 * vUv.y);
        vec3 col = mix(glass, warm * blind * 1.1, on);
        float frame = step(0.05, vUv.x) * step(vUv.x, 0.95) * step(0.06, vUv.y) * step(vUv.y, 0.94) * step(0.025, abs(vUv.x - 0.5));
        col *= mix(0.3, 1.0, frame);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const winGeo = new THREE.PlaneGeometry(1, 1);
  winGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(winSeed), 1));
  const wins = new THREE.InstancedMesh(winGeo, winMat, winM.length);
  winM.forEach((m, i) => wins.setMatrixAt(i, m));
  wins.frustumCulled = false;
  scene.add(wins);

  // --- neon signs: one atlas texture, one merged mesh
  const ALL = [...SIGN_NAMES, ...ADS, ...EDGE_SIGNS];
  const atlasOrder = ALL.map((n) => signs.find((s) => s.name === n) || { name: n, color: '#ff2bd1' });
  const signTex = new THREE.CanvasTexture(paintSigns(atlasOrder));
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 4;
  const sgeo = [];
  for (const s of signs) {
    const i = ALL.indexOf(s.name);
    const g = new THREE.PlaneGeometry(s.w, s.h).toNonIndexed();
    const uv = g.attributes.uv, u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) / SIGN_ROWS;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v1 - (1 - uv.getY(k)) / SIGN_ROWS);
    g.rotateY(s.yaw); g.translate(s.x, s.y, s.z);
    sgeo.push(g);
  }
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false });
  const signMesh = new THREE.Mesh(merge(sgeo), signMat);
  signMesh.renderOrder = 2;
  scene.add(signMesh);

  // --- street lamps
  const lampGeo = merge([
    cyl(0.07, 0.12, 6.2, 6, 0, 3.1, 0, '#3b3350'), box(0.1, 0.1, 1.7, 0, 6.15, 0.75, '#3b3350'),
    box(0.5, 0.16, 0.8, 0, 6.05, 1.45, '#fff2c8'),
  ]);
  const lamps = new THREE.InstancedMesh(lampGeo, bodyMat, L.lamps.length);
  L.lamps.forEach((l, i) => {
    m4.compose(v.set(l.x, 0, l.z), q.setFromAxisAngle(UP, l.yaw), sc.set(1, 1, 1));
    lamps.setMatrixAt(i, m4);
    l.gi = glows.length;
    glows.push([l.x + Math.sin(l.yaw) * 1.45, 5.9, l.z + Math.cos(l.yaw) * 1.45, '#ffcf8a', 6.5, 0]);
  });
  lamps.frustumCulled = false;
  scene.add(lamps);

  // --- palms: trunk + fronds in one geometry, swaying in the vertex shader
  const palms = palmMesh(L.palms);
  scene.add(palms);

  // --- beach umbrellas (instance colour = canopy colour)
  const cone = new THREE.ConeGeometry(1.8, 0.7, 8).toNonIndexed();
  cone.translate(0, 2.55, 0);
  const cg = tint(cone, '#ffffff');
  { const p = cg.attributes.position, c = cg.attributes.color;
    for (let i = 0; i < p.count; i += 3) {
      const a = Math.atan2(p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2), p.getX(i) + p.getX(i + 1) + p.getX(i + 2));
      const k = Math.floor((a + PI) / (PI / 4) + 0.001) % 2 ? 1 : 0.62;
      for (let j = 0; j < 3; j++) c.setXYZ(i + j, k, k, k);
    } }
  // pole, towel and a sun lounger with a raised back (both are seats: see layout.js)
  const umbGeo = merge([cg, cyl(0.04, 0.04, 2.5, 5, 0, 1.25, 0, '#ffffff'), box(0.7, 0.04, 1.9, 0.9, 0.03, 0.3, '#ffffff'),
    box(0.66, 0.08, 1.3, -1.05, 0.3, 0.25, '#ffffff'), box(0.62, 0.08, 0.75, -1.05, 0.55, -0.62, '#ffffff', 0.75),
    ...[[-1.32, 0.8], [-0.78, 0.8], [-1.32, -0.9], [-0.78, -0.9]].map(([x, z]) => box(0.05, 0.3, 0.05, x, 0.13, z, '#e8e0d0'))]);
  const umbs = new THREE.InstancedMesh(umbGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), L.umbrellas.length);
  const col = new THREE.Color();
  L.umbrellas.forEach((u, i) => {
    m4.compose(v.set(u.x, 0, u.z), q.setFromAxisAngle(UP, u.yaw), sc.set(1, 1, 1));
    umbs.setMatrixAt(i, m4); umbs.setColorAt(i, col.set(u.color));
  });
  umbs.frustumCulled = false;
  scene.add(umbs);

  // --- planting beds: shrubs, grasses and flowers, one InstancedMesh (flowers take the instance colour)
  const plants = buildPlants(L.planters);
  if (plants) scene.add(plants);

  // --- static glow sprites
  const glow = createGlow(scene, glows.length);
  for (const g of glows) glow.add(g[0], g[1], g[2], g[3], g[4], g[5]);
  glow.commit();
  L.neonPools = neonPools(glows);
  L.lampMap.repaint();

  const life = buildLife(scene, bodyMat);
  // knocked-down lamps and (tank-)felled palms: tip the instance over about its base towards `dir`
  const tip = (mesh, i, x, z, yaw, s3, ang, dir) => {
    const qa = new THREE.Quaternion().setFromAxisAngle(v.set(Math.cos(dir), 0, -Math.sin(dir)), ang);
    q.setFromAxisAngle(UP, yaw).premultiply(qa);
    m4.compose(v.set(x, 0, z), q, sc.set(...s3)); mesh.setMatrixAt(i, m4); mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    group: scene, windowCount: winM.length, bodyMat, tick: life.tick, blinkers,
    tipLamp(i, ang, dir) { const l = L.lamps[i]; tip(lamps, i, l.x, l.z, l.yaw, [1, 1, 1], ang, dir); },
    tipPalm(i, ang, dir) { const p = L.palms[i]; tip(palms, i, p.x, p.z, p.yaw, p.sc, ang, dir); },
    // a lamp's light: its glow sprite and its pool on the ground
    lampLight(i, on) {
      const l = L.lamps[i], g = glows[l.gi];
      l.dead = !on;
      if (on) glow.set(l.gi, g[0], g[1], g[2], g[3], g[4], g[5]); else glow.hide(l.gi);
      glow.commit(); L.lampMap.repaint();
    },
    setLights(neonK, lit, glass) {
      neonMat.color.setScalar(0.5 + neonK * 0.9);
      signMat.color.setScalar(0.4 + neonK * 0.9);
      winU.uLit.value = lit;
      winU.uGlass.value.copy(glass);
    },
  };
}

// Palms: trunk + fronds in one geometry (shared by both districts), swaying in the vertex shader.
// Sets p.sc (the instance scale) on every palm in the list.
let palmGeo = null, palmMat = null;
export function palmMesh(list) {
  if (!palmGeo) {
    const palmParts = [];
    const trunk = new THREE.CylinderGeometry(0.16, 0.3, 7, 6, 5);
    trunk.translate(0, 3.5, 0);
    { const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 7; p.setX(i, p.getX(i) + t * t * 1.2); } }
    trunk.computeVertexNormals();
    palmParts.push(tint(trunk, '#9a6b4a'));
    for (let k = 0; k < 9; k++) {
      const len = 3.2 + (k % 3) * 0.5;
      const f = new THREE.PlaneGeometry(len, 1.1, 5, 1);
      f.rotateX(-PI / 2); f.translate(len / 2, 0, 0);
      const p = f.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = p.getX(i) / len;
        p.setZ(i, p.getZ(i) * (1 - t * 0.85) * (0.5 + Math.sin(t * PI) * 0.9));
        p.setY(i, Math.sin(t * 2.2) * 0.7 - t * t * (1.6 + (k % 2) * 0.6) + Math.abs(p.getZ(i)) * -0.35);
      }
      f.rotateY((k / 9) * PI * 2 + 0.2); f.translate(1.2, 7, 0);
      f.computeVertexNormals();
      palmParts.push(tint(f, k % 2 ? '#2fa36b' : '#3fbf7a'));
    }
    palmParts.push(tint(new THREE.SphereGeometry(0.34, 6, 4).translate(1.2, 6.9, 0), '#7a5a3a'));
    palmGeo = merge(palmParts);
    palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    palmMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.17;
        #else
          float ph = 0.0;
        #endif
        float hh = clamp(position.y / 7.0, 0.0, 1.0); hh *= hh;
        float tipD = length(position.xz - vec2(1.2, 0.0)) * step(4.5, position.y);
        transformed.x += sin(uTime * 1.1 + ph) * 0.3 * hh;
        transformed.z += cos(uTime * 0.9 + ph * 1.3) * 0.22 * hh;
        transformed.y += sin(uTime * 2.4 + ph + position.x * 1.7 + position.z * 1.3) * 0.07 * tipD;
      `);
    };
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, Math.max(1, list.length)), pcol = new THREE.Color();
  list.forEach((p, i) => {
    // variety: squat and lanky palms, a few sun-bleached or deep green
    const tall = 0.78 + ((i * 37) % 11) / 16;
    p.sc = [p.s * (1.12 - tall * 0.12), p.s * tall, p.s * (1.12 - tall * 0.12)];
    m4.compose(v.set(p.x, p.y || 0, p.z), q.setFromAxisAngle(UP, p.yaw), sc.set(...p.sc));
    palms.setMatrixAt(i, m4);
    palms.setColorAt(i, pcol.set(['#ffffff', '#e4ffc8', '#fff2c4', '#cfeedd', '#ffffff'][(i * 7) % 5]));
  });
  palms.count = list.length;
  palms.frustumCulled = false;
  return palms;
}

// Shrub + grass + flower clump for the planting beds. Flowers are marked with aFlower = 1 and take the
// instance colour; the greens keep their own. Grasses sway a little in the vertex shader.
function buildPlants(list) {
  if (!list.length) return null;
  const parts = [], flower = [];
  const add = (g, f) => { parts.push(g); flower.push(f, g.attributes.position.count); };
  add(tint(new THREE.IcosahedronGeometry(0.32, 0).scale(1.1, 0.75, 1).translate(0, 0.22, 0), '#2f8f4f'), 0);
  add(tint(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 0.8, 1).translate(0.2, 0.3, 0.08), '#3fae5f'), 0);
  add(tint(new THREE.IcosahedronGeometry(0.2, 0).translate(-0.18, 0.28, -0.08), '#46b86a'), 0);
  for (let k = 0; k < 5; k++) { const a = k * 1.3; add(box(0.04, 0.55, 0.02, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, '#7ccf6a', Math.sin(a) * 0.3, a, Math.cos(a) * 0.3), 0); }
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, rr = 0.2 + (k % 2) * 0.1; add(box(0.09, 0.07, 0.09, Math.cos(a) * rr, 0.42 + (k % 3) * 0.05, Math.sin(a) * rr, '#ffffff'), 1); }
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), af = new Float32Array(n);
  let o = 0;
  for (let i = 0; i < flower.length; i += 2) { af.fill(flower[i], o, o + flower[i + 1]); o += flower[i + 1]; }
  const geo = merge(parts);
  geo.setAttribute('aFlower', new THREE.BufferAttribute(af, 1));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'attribute float aFlower; uniform float uTime;\n' + sh.vertexShader
      .replace('#include <color_vertex>', `vColor = vec4(1.0); vColor.rgb *= color;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, instanceColor.rgb, aFlower);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          transformed.x += sin(uTime * 1.6 + instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2]) * 0.035 * position.y;
        #endif`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  list.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw), p.grass ? new THREE.Vector3(0.55 * p.s, 1.5 * p.s, 0.55 * p.s) : new THREE.Vector3(p.s, p.s, p.s));
    mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(p.grass ? '#d8e27a' : p.c));
  });
  mesh.frustumCulled = false;
  return mesh;
}
