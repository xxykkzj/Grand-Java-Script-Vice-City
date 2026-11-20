// The four interiors and the people in them. Each room is built the first time you walk in
// (one merged unlit mesh plus a few animated extras), parked 90 units under its own building
// and only visible while you are inside. Rooms are authored around (0, 0, 0); the door is on +z.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, rng, beatU, section, angleDelta, reducedMotion } from '../core/util.js';
import { kit, rig, blockyMaterial, faceDriver, instExtras, castAtlas, crowdAtlas, mergeParts, CAST_ROW, CROWD_FACE_N } from '../actors/blocky.js';
import { newPose, dancePose, cheerPose, sitPose, blendPose } from '../actors/moves.js';
import { CLUB_CROWD, clubTier } from './story.js';
import { shell, stool, bake, glow } from './dress.js';
import { REDRESS } from './redress.js';
import { VENUE_BUILD, VENUE_LOOKS } from './venuerooms.js';
import { quality } from '../core/quality.js';

export const OY = -90;
const NEON = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];

// ---- people -------------------------------------------------------------------------------
// The story cast as refined blocks (actors/blocky.js): one skinned draw call each, a pixel-art face
// that blinks, talks and reacts, and the same pivots as before (g, head, armL, armR, thighs, shins).
// Every character shares the base body; `wear` adds their own hair, layers and accessories.
//   L: { skin, top, topPat, waist, legs, legPat, shoe, sole, belt, sleeve, fore, cuff, shoulder, shin }
const BLK = '#22203a', GOLD = '#ffd166', CHROME = '#c9c0d8';
const LOOKS = {
  // Dee: yellow blouse with rolled sleeves, a dark bar apron, a pink up-do with a yellow band, hoops
  DEE: { skin: '#c98d62', top: '#ffe14a', legs: '#22203a', fore: '#c98d62', shoe: '#ff5fa8', belt: null,
    wear(K, P) {
      const H = '#ff5fa8';
      P.body.push(K.B(0.36, 0.46, 0.025, 0, 1.06, 0.136, BLK, 'seam'), K.B(0.425, 0.035, 0.256, 0, 1.2, 0, BLK), K.B(0.16, 0.07, 0.012, 0, 0.98, 0.152, H, 'seam'),
        K.B(0.03, 0.12, 0.012, 0.1, 1.38, 0.14, BLK), K.B(0.03, 0.12, 0.012, -0.1, 1.38, 0.14, BLK), K.B(0.24, 0.05, 0.2, 0, 1.475, 0, '#ffe14a', 'rib'));
      P.head.push(K.B(0.32, 0.09, 0.3, 0, 0.345, -0.005, H, 'hair'), K.B(0.32, 0.25, 0.08, 0, 0.2, -0.125, H, 'hair'),
        K.B(0.035, 0.2, 0.2, 0.16, 0.24, -0.035, H, 'hair'), K.B(0.035, 0.2, 0.2, -0.16, 0.24, -0.035, H, 'hair'),
        K.B(0.2, 0.06, 0.045, -0.04, 0.312, 0.148, H, 'hair', { rz: 0.25 }), K.B(0.1, 0.05, 0.045, 0.09, 0.3, 0.146, H, 'hair', { rz: -0.3 }),
        K.B(0.2, 0.16, 0.2, 0, 0.46, -0.06, H, 'hair'), K.B(0.14, 0.06, 0.14, 0, 0.56, -0.06, H, 'hair'), K.B(0.205, 0.035, 0.205, 0, 0.39, -0.06, '#ffe14a', 'rib'),
        K.B(0.018, 0.06, 0.05, 0.178, 0.085, 0.01, '#ffe14a'), K.B(0.018, 0.06, 0.05, -0.178, 0.085, 0.01, '#ffe14a'));
      P.arms((sx) => [K.B(0.14, 0.05, 0.15, 0, -0.25, 0, '#ffe14a', 'rib')]);
    } },
  // Marty Glitz: a purple suit with padded shoulders, lapels, gold tie and pocket square, a quiff, cyan shades
  GLITZ: { skin: '#e0a878', top: '#6a3fb8', legs: '#6a3fb8', legPat: 'weave', shoe: '#fff6ec', cuff: '#fff6ec', shoulder: null, belt: null,
    wear(K, P) {
      const S = '#6a3fb8', D = '#4a2a8a', HR = '#22203a';
      P.body.push(K.B(0.17, 0.12, 0.3, 0.235, 1.46, 0, S, 'seam'), K.B(0.17, 0.12, 0.3, -0.235, 1.46, 0, S, 'seam'), K.B(0.44, 0.08, 0.27, 0, 0.98, 0, S, 'weave'),
        K.B(0.14, 0.32, 0.02, 0, 1.3, 0.137, '#fff6ec'), K.B(0.07, 0.28, 0.02, 0.085, 1.32, 0.14, D, 'plain', { rz: -0.22 }), K.B(0.07, 0.28, 0.02, -0.085, 1.32, 0.14, D, 'plain', { rz: 0.22 }),
        K.B(0.05, 0.24, 0.016, 0, 1.28, 0.149, GOLD, 'stripe'), K.B(0.06, 0.04, 0.02, 0, 1.415, 0.151, GOLD), K.B(0.06, 0.04, 0.012, 0.135, 1.37, 0.142, '#ff3fb4'),
        K.B(0.025, 0.025, 0.012, 0.04, 1.12, 0.137, GOLD), K.B(0.025, 0.025, 0.012, 0.04, 1.05, 0.137, GOLD), K.B(0.22, 0.05, 0.2, 0, 1.48, 0, '#fff6ec'));
      P.head.push(K.B(0.31, 0.07, 0.29, 0, 0.345, -0.01, HR, 'hair'), K.B(0.22, 0.07, 0.1, 0, 0.38, 0.09, HR, 'hair', { rx: -0.2 }), K.B(0.31, 0.22, 0.07, 0, 0.21, -0.125, HR, 'hair'),
        K.B(0.03, 0.14, 0.16, 0.155, 0.24, -0.05, HR, 'hair'), K.B(0.03, 0.14, 0.16, -0.155, 0.24, -0.05, HR, 'hair'),
        K.B(0.29, 0.062, 0.03, 0, 0.185, 0.158, '#27e8ff'), K.B(0.3, 0.016, 0.035, 0, 0.222, 0.158, HR), K.B(0.012, 0.02, 0.14, 0.152, 0.205, 0.08, HR), K.B(0.012, 0.02, 0.14, -0.152, 0.205, 0.08, HR));
      P.arms((sx) => [K.B(0.03, 0.022, 0.03, sx * 0.03, -0.555, 0.045, GOLD)]);
    } },
  // Gus, the night clerk: a maroon Pantry polo (green collar and trims, name badge), green-billed shop cap, glasses
  GUS: { skin: '#f1c9a5', top: '#7a1838', topPat: 'knit', legs: '#2a3550', fore: '#f1c9a5', shoe: '#1b1830', belt: '#3b2a1a',
    wear(K, P) {
      const G = '#5dff9a', M = '#7a1838', HR = '#2a1a12';
      P.body.push(K.B(0.26, 0.05, 0.22, 0, 1.478, 0, G, 'rib'), K.B(0.06, 0.04, 0.02, 0.05, 1.455, 0.122, G), K.B(0.06, 0.04, 0.02, -0.05, 1.455, 0.122, G),
        K.B(0.05, 0.12, 0.012, 0, 1.4, 0.138, '#5a1028'), K.B(0.02, 0.02, 0.01, 0, 1.43, 0.146, '#fff6ec'), K.B(0.02, 0.02, 0.01, 0, 1.38, 0.146, '#fff6ec'),
        K.decal(0.12, 0.12, 0.11, 1.32, 0.137, M, 'badge'), K.B(0.46, 0.035, 0.27, 0, 1.0, 0, '#3b2a1a', 'leather'));
      P.head.push(K.B(0.32, 0.1, 0.3, 0, 0.36, 0, M, 'weave'), K.B(0.325, 0.03, 0.305, 0, 0.315, 0, G, 'rib'), K.B(0.26, 0.025, 0.15, 0, 0.312, 0.21, G),
        K.decal(0.08, 0.08, 0, 0.365, 0.1505, M, 'star'), K.C(0.022, 0.022, 0.02, 6, 0, 0.415, 0, M),
        K.B(0.31, 0.2, 0.07, 0, 0.2, -0.125, HR, 'hair'), K.B(0.03, 0.12, 0.14, 0.155, 0.24, -0.06, HR, 'hair'), K.B(0.03, 0.12, 0.14, -0.155, 0.24, -0.06, HR, 'hair'));
      P.arms((sx) => [K.B(0.136, 0.03, 0.146, 0, -0.235, 0, G, 'rib')]);
    } },
  // DJ Kilowatt: a violet hoodie with a cyan band and a bolt, yellow cap, magenta headphones, a short beard
  KILO: { skin: '#7a4a2e', top: '#7a5cff', legs: '#22203a', cuff: '#18f0ff', shoe: '#fff6ec', sole: '#ff2bd1', belt: null,
    wear(K, P) {
      const V = '#7a5cff', Y = '#ffe14a';
      P.body.push(K.B(0.465, 0.06, 0.275, 0, 1.28, 0, '#18f0ff', 'rib'), K.B(0.26, 0.1, 0.015, 0, 1.1, 0.133, '#6a4ce0', 'seam'), K.decal(0.09, 0.09, 0.12, 1.39, 0.137, V, 'bolt'),
        K.B(0.014, 0.1, 0.012, 0.04, 1.42, 0.141, '#fff6ec'), K.B(0.014, 0.1, 0.012, -0.04, 1.42, 0.141, '#fff6ec'), K.B(0.3, 0.16, 0.07, 0, 1.5, -0.14, V, 'knit'),
        K.B(0.43, 0.06, 0.26, 0, 0.995, 0, V, 'rib'));
      P.head.push(K.B(0.32, 0.1, 0.3, 0, 0.36, 0, Y, 'weave'), K.B(0.26, 0.025, 0.16, 0, 0.312, 0.215, Y), K.C(0.022, 0.022, 0.02, 6, 0, 0.415, 0, Y),
        K.B(0.06, 0.13, 0.13, 0.178, 0.17, 0, '#ff2bd1', 'leather'), K.B(0.06, 0.13, 0.13, -0.178, 0.17, 0, '#ff2bd1', 'leather'),
        K.B(0.04, 0.2, 0.05, 0.18, 0.3, 0, BLK), K.B(0.04, 0.2, 0.05, -0.18, 0.3, 0, BLK), K.B(0.38, 0.035, 0.05, 0, 0.42, 0, BLK),
        K.B(0.31, 0.16, 0.06, 0, 0.19, -0.13, '#1b1410', 'hair'));
    } },
  // Taps, the bartender: white shirt, a dark checked waistcoat, magenta bow tie and sleeve garters, slick side part
  TAPS: { skin: '#e0a878', top: '#f6f1e7', legs: '#22203a', cuff: '#f6f1e7', shoe: '#1b1830', belt: null,
    wear(K, P) {
      const HR = '#1b1830';
      P.body.push(K.B(0.16, 0.4, 0.022, 0.11, 1.2, 0.137, BLK, 'check'), K.B(0.16, 0.4, 0.022, -0.11, 1.2, 0.137, BLK, 'check'), K.B(0.46, 0.4, 0.022, 0, 1.2, -0.137, BLK, 'check'),
        K.B(0.02, 0.4, 0.27, 0.232, 1.2, 0, BLK), K.B(0.02, 0.4, 0.27, -0.232, 1.2, 0, BLK),
        K.B(0.02, 0.02, 0.01, 0.045, 1.25, 0.15, GOLD), K.B(0.02, 0.02, 0.01, 0.045, 1.17, 0.15, GOLD), K.B(0.02, 0.02, 0.01, 0.045, 1.09, 0.15, GOLD),
        K.B(0.16, 0.06, 0.03, 0, 1.47, 0.14, '#ff2bd1'), K.B(0.04, 0.05, 0.036, 0, 1.47, 0.145, '#c01a8a'), K.B(0.24, 0.05, 0.2, 0, 1.48, 0, '#f6f1e7'));
      P.head.push(K.B(0.31, 0.07, 0.29, 0, 0.345, -0.01, HR, 'hair'), K.B(0.2, 0.04, 0.29, 0.05, 0.385, -0.01, HR, 'hair'), K.B(0.31, 0.2, 0.07, 0, 0.21, -0.125, HR, 'hair'),
        K.B(0.03, 0.13, 0.15, 0.155, 0.245, -0.05, HR, 'hair'), K.B(0.03, 0.13, 0.15, -0.155, 0.245, -0.05, HR, 'hair'));
      P.arms((sx) => [K.B(0.142, 0.03, 0.152, 0, -0.12, 0, '#ff2bd1')]);
    } },
  // Zizi Sparks: tangerine overalls (bib, yellow straps, a cyan pocket) over a dark long-sleeve, a tool pouch,
  // spiky teal hair under a goggle band, yellow boots
  ZIZI: { skin: '#a56b43', top: '#2a2140', waist: '#ff7a2f', legs: '#ff7a2f', legPat: 'denim', cuff: '#ff7a2f', shoe: '#ffe14a', belt: '#3a2a1a',
    wear(K, P) {
      const O = '#ff7a2f', Y = '#ffe14a', T = '#1fa89f';
      P.body.push(K.B(0.3, 0.26, 0.022, 0, 1.27, 0.137, O, 'denim'), K.B(0.3, 0.2, 0.022, 0, 1.24, -0.137, O, 'denim'),
        K.B(0.05, 0.2, 0.02, 0.12, 1.43, 0.14, Y), K.B(0.05, 0.2, 0.02, -0.12, 1.43, 0.14, Y), K.B(0.05, 0.2, 0.02, 0.12, 1.43, -0.14, Y), K.B(0.05, 0.2, 0.02, -0.12, 1.43, -0.14, Y),
        K.B(0.03, 0.03, 0.012, 0.12, 1.37, 0.151, CHROME), K.B(0.03, 0.03, 0.012, -0.12, 1.37, 0.151, CHROME),
        K.B(0.11, 0.07, 0.014, 0.06, 1.22, 0.151, '#18f0ff', 'seam'), K.B(0.1, 0.1, 0.06, -0.2, 0.95, 0.07, Y, 'leather'));
      P.head.push(K.B(0.32, 0.1, 0.3, 0, 0.34, -0.01, T, 'hair'), K.B(0.08, 0.07, 0.08, -0.08, 0.4, 0.03, T, 'hair', { rz: 0.4 }), K.B(0.08, 0.08, 0.08, 0.06, 0.405, -0.04, T, 'hair', { rz: -0.3 }),
        K.B(0.07, 0.06, 0.07, 0, 0.41, 0.08, T, 'hair', { rx: 0.3 }), K.B(0.32, 0.22, 0.08, 0, 0.2, -0.12, T, 'hair'),
        K.B(0.035, 0.18, 0.2, 0.16, 0.23, -0.03, T, 'hair'), K.B(0.035, 0.18, 0.2, -0.16, 0.23, -0.03, T, 'hair'),
        K.B(0.335, 0.04, 0.315, 0, 0.3, 0, BLK), K.B(0.09, 0.07, 0.035, 0.065, 0.31, 0.163, Y), K.B(0.09, 0.07, 0.035, -0.065, 0.31, 0.163, Y),
        K.B(0.03, 0.03, 0.03, 0, 0.31, 0.163, BLK));
      P.shins.push(K.B(0.17, 0.05, 0.2, 0.095, -0.29, 0.01, Y, 'rib'), K.B(0.17, 0.05, 0.2, -0.095, -0.29, 0.01, Y, 'rib'));
    } },
  // Mimi: a tiered tangerine dress with a yellow sash, bare arms with bangles, big dark hair with a magenta flower
  MIMI: { skin: '#a56b43', top: '#ff8a3d', legs: '#a56b43', sleeve: '#a56b43', cuff: '#ffe14a', shoulder: '#ff8a3d', shoe: '#ff2bd1', belt: null,
    wear(K, P) {
      const O = '#ff8a3d', HR = '#22203a';
      P.body.push(K.B(0.06, 0.55, 0.014, 0, 1.22, 0.137, '#ffe14a', 'plain', { rz: 0.6 }), K.B(0.43, 0.06, 0.26, 0, 0.98, 0, BLK),
        K.B(0.44, 0.16, 0.27, 0, 0.86, 0, O, 'weave'), K.B(0.5, 0.16, 0.31, 0, 0.71, 0, O, 'weave'), K.B(0.505, 0.03, 0.315, 0, 0.635, 0, '#ffe14a', 'rib'),
        K.B(0.56, 0.15, 0.35, 0, 0.56, 0, O, 'weave'), K.B(0.565, 0.03, 0.355, 0, 0.49, 0, '#ff2bd1', 'rib'), K.B(0.22, 0.04, 0.19, 0, 1.475, 0, O));
      P.head.push(K.B(0.36, 0.14, 0.32, 0, 0.36, -0.02, HR, 'hair'), K.B(0.42, 0.34, 0.16, 0, 0.19, -0.12, HR, 'hair'),
        K.B(0.06, 0.3, 0.2, 0.18, 0.2, -0.02, HR, 'hair'), K.B(0.06, 0.3, 0.2, -0.18, 0.2, -0.02, HR, 'hair'),
        K.B(0.1, 0.1, 0.1, 0.2, 0.05, -0.08, HR, 'hair'), K.B(0.1, 0.1, 0.1, -0.2, 0.05, -0.08, HR, 'hair'), K.B(0.26, 0.05, 0.045, 0, 0.312, 0.148, HR, 'hair'),
        K.B(0.1, 0.1, 0.06, 0.12, 0.4, 0.07, '#ff2bd1'), K.B(0.04, 0.04, 0.02, 0.12, 0.4, 0.105, '#ffe14a'));
    } },
};
Object.assign(LOOKS, VENUE_LOOKS);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// Characters indoors are lit (Lambert) with a soft rim light so they stand out from light walls too.
export const rimU = { value: new THREE.Color('#000000') };
export function addRim(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uRim = rimU;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);');
  };
  return mat;
}
function makeNPC(key) {
  const o = LOOKS[key], g = new THREE.Group(), atlas = castAtlas(), K = kit(atlas);
  const mat = blockyMaterial({ atlas, row: CAST_ROW[key], rim: rimU });
  const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const head = pivot(0, 1.57, 0), armL = pivot(0.3, 1.46, 0), armR = pivot(-0.3, 1.46, 0), thighs = pivot(0, 0.9, 0), shins = pivot(0, -0.46, 0, thighs);
  const sk = o.skin, sk2 = shade(sk, 0.86), top = o.top, sleeve = o.sleeve || top, fore = o.fore || sleeve, legs = o.legs, tp = o.topPat || 'weave', lp = o.legPat || 'denim';
  const P = { body: [], head: [], armL: [], armR: [], thighs: [], shins: [] };
  // body: hips, belt, waist, chest, shoulder yokes, neck
  P.body.push(K.B(0.4, 0.16, 0.25, 0, 0.92, 0, legs, lp), K.B(0.42, 0.2, 0.25, 0, 1.12, 0, o.waist || top, tp), K.B(0.46, 0.24, 0.27, 0, 1.33, 0, top, tp),
    K.B(0.11, 0.08, 0.11, 0, 1.54, 0, sk));
  if (o.shoulder !== null) P.body.push(K.B(0.12, 0.09, 0.26, 0.215, 1.455, 0, o.shoulder || top, 'seam'), K.B(0.12, 0.09, 0.26, -0.215, 1.455, 0, o.shoulder || top, 'seam'));
  if (o.belt !== null) P.body.push(K.B(0.41, 0.04, 0.258, 0, 1.0, 0, o.belt || BLK, 'leather'), K.B(0.05, 0.035, 0.012, 0, 1.0, 0.133, CHROME));
  // head: the block, the face plate, nose and ears
  P.head.push(K.B(0.3, 0.31, 0.28, 0, 0.17, 0, sk, 'plain', { b: 0.02 }), K.face(0.262, 0.272, 0, 0.17, 0.1405, sk),
    K.B(0.038, 0.042, 0.028, 0, 0.135, 0.152, sk2), K.B(0.032, 0.07, 0.06, 0.158, 0.155, 0, sk2), K.B(0.032, 0.07, 0.06, -0.158, 0.155, 0, sk2));
  // arms: upper, elbow, forearm, cuff, hand with fingers and a thumb
  P.arms = (fn) => { P.armL.push(...fn(1)); P.armR.push(...fn(-1)); };
  P.arms((sx) => [K.B(0.13, 0.25, 0.14, 0, -0.12, 0, sleeve, sleeve === sk ? 'plain' : tp), K.B(0.115, 0.05, 0.125, 0, -0.265, 0, fore, fore === sk ? 'plain' : 'seam'),
    K.B(0.122, 0.17, 0.132, 0, -0.37, 0, fore, fore === sk ? 'plain' : tp), ...(o.cuff ? [K.B(0.13, 0.04, 0.14, 0, -0.44, 0, o.cuff, 'rib')] : []),
    K.B(0.09, 0.08, 0.095, 0, -0.5, 0, sk), K.B(0.08, 0.045, 0.08, 0, -0.56, 0.005, sk), K.B(0.032, 0.055, 0.032, -sx * 0.052, -0.495, 0.042, sk, 'plain', { rz: sx * 0.3 })]);
  // legs: thigh and knee; shin, shoe with a toe cap and a treaded sole
  for (const x of [0.095, -0.095]) {
    P.thighs.push(K.B(0.16, 0.4, 0.2, x, -0.2, 0, legs, legs === sk ? 'plain' : lp), K.B(0.145, 0.06, 0.18, x, -0.43, 0, legs, legs === sk ? 'plain' : lp));
    P.shins.push(K.B(0.15, 0.3, 0.18, x, -0.17, 0, o.shin || legs, legs === sk ? 'plain' : lp), K.B(0.16, 0.1, 0.22, x, -0.355, 0.02, o.shoe, 'leather'),
      K.B(0.15, 0.07, 0.11, x, -0.37, 0.155, o.shoe, 'leather'), K.B(0.17, 0.035, 0.32, x, -0.425, 0.045, o.sole || '#1b1830', 'tread'));
  }
  o.wear(K, P);
  const mesh = rig([[g, P.body], [head, P.head], [armL, P.armL], [armR, P.armR], [thighs, P.thighs], [shins, P.shins]], mat);
  g.add(mesh);
  const face = faceDriver(mat.userData.face, reducedMotion);
  const n = { key, g, head, armL, armR, thighs, shins, mesh, x: 0, y: 0, z: 0, yaw: 0, home: 0, seated: false,
    talking: false, expr: null,          // set by the cutscene director while this character speaks
    tickFace(dt) { face(dt, n.talking, n.expr); },
    get faceState() { return mat.userData.face.x; },
    // sit on a seat ({ x, z, y, yaw } in room coordinates): hips on the cushion, knees bent, feet on the floor
    sit(st) {
      Object.assign(n, { seated: true, x: st.x, z: st.z, y: -0.42, yaw: st.yaw });
      g.position.set(st.x, st.y - 0.9, st.z); g.rotation.y = st.yaw; thighs.rotation.x = -1.5; shins.rotation.x = 1.5;
      if (st.taken !== undefined) st.taken = true;
    },
    stand() {
      if (!n.seated) return;
      const h = n.homeAt;
      Object.assign(n, { seated: false, x: h[0], y: h[3] || 0, z: h[1], yaw: h[2] });
      g.position.set(n.x, n.y, n.z); g.rotation.y = n.yaw; thighs.rotation.x = 0; shins.rotation.x = 0;
    },
  };
  return n;
}

// ---- The Velvet Flamingo ----------------------------------------------------------------------
function buildBar(room) {
  const g = [];
  shell(g, 6, 4.5, 4.2, '#3d1f5c', '#1b0f30', ['#34185a', '#241040', '#2c1450'], '#120822', '#ff4fc0');
  g.push(box(7, 1.1, 0.8, 0, 0.55, -2.2, '#5a2468'), box(7.3, 0.08, 1.05, 0, 1.14, -2.2, '#ffc7ea'), box(7, 0.06, 0.06, 0, 0.22, -1.78, '#ff2bd1'), box(7.3, 0.05, 0.05, 0, 1.07, -1.68, '#18f0ff'));
  for (const x of [-2.6, -1.3, 1.7, 2.9]) stool(g, x, -1.15, '#ff4fa3');
  for (const y of [1.55, 2.2]) {
    g.push(box(6.6, 0.07, 0.34, 0, y, -4.25, '#7a3d78'));
    for (let i = 0; i < 15; i++) if ((i * 7 + (y > 2 ? 3 : 0)) % 5) g.push(box(0.13, 0.3 + (i % 3) * 0.07, 0.13, -3 + i * 0.43, y + 0.2 + (i % 3) * 0.035, -4.25, NEON[(i + (y > 2 ? 2 : 0)) % 6]));
  }
  g.push(box(6.8, 0.06, 0.06, 0, 2.95, -4.4, '#18f0ff'), box(6.8, 0.06, 0.06, 0, 1.38, -4.4, '#18f0ff'));
  const P = '#ff4fc0', nx = 4.4, nz = -4.4;                    // the house flamingo in neon
  g.push(box(0.07, 1, 0.07, nx, 1.5, nz, P), box(0.9, 0.5, 0.07, nx - 0.1, 2.25, nz, P, 0, 0, 0.25), box(0.07, 0.9, 0.07, nx + 0.5, 2.9, nz, P, 0, 0, -0.35), box(0.3, 0.24, 0.07, nx + 0.7, 3.4, nz, P), box(0.28, 0.07, 0.07, nx + 0.95, 3.27, nz, '#ffe14a', 0, 0, -0.5));
  g.push(box(1.2, 1.5, 0.7, -5.3, 0.75, 1.2, '#7a1a6a'), cyl(0.6, 0.6, 0.7, 12, -5.3, 1.5, 1.2, '#7a1a6a', PI / 2), box(0.06, 1.3, 0.5, -4.68, 0.9, 1.2, '#ffe14a'),
    box(0.07, 0.5, 0.36, -4.67, 1.45, 1.2, '#18f0ff'), box(0.07, 0.12, 0.5, -4.67, 0.5, 1.2, '#ff2bd1'), box(0.07, 0.12, 0.5, -4.67, 0.3, 1.2, '#8dff5a'));
  for (const [x, z] of [[4.2, 1.6], [3.4, -0.2]]) { g.push(cyl(0.55, 0.55, 0.06, 12, x, 0.8, z, '#ffc7ea'), cyl(0.06, 0.06, 0.8, 6, x, 0.4, z, '#c9c0d8'), cyl(0.05, 0.05, 0.14, 6, x, 0.9, z, '#ffe14a')); stool(g, x + 0.9, z + 0.2, '#18f0ff'); }
  g.push(box(10, 0.06, 0.06, 0, 4.05, -1.5, '#18f0ff'), box(10, 0.06, 0.06, 0, 4.05, 1.5, '#ff2bd1'));
  // framed lease notice by the door, because somebody is three months behind
  g.push(box(0.7, 0.9, 0.04, -2.2, 1.9, 4.42, '#fff6ec'), box(0.5, 0.06, 0.05, -2.2, 2.15, 4.4, '#ff4f6a'), box(0.5, 0.04, 0.05, -2.2, 1.95, 4.4, '#22203a'), box(0.5, 0.04, 0.05, -2.2, 1.8, 4.4, '#22203a'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4.2, geo: g,
    blocks: [{ x0: -3.7, x1: 3.7, z0: -4.5, z1: -1.7 }, { x0: -6, x1: -4.6, z0: 0.7, z1: 1.7 }, { x0: 3.7, x1: 4.7, z0: 1.1, z1: 2.1 }, { x0: 2.9, x1: 3.9, z0: -0.7, z1: 0.3 }],
    seats: [...[-2.6, -1.3, 1.7, 2.9].map((x) => ({ x, z: -1.15, y: 0.83, yaw: PI, kind: 'stool' })),
      { x: 5.1, z: 1.8, y: 0.83, yaw: Math.atan2(-0.9, -0.2), kind: 'stool' }, { x: 4.3, z: 0, y: 0.83, yaw: Math.atan2(-0.9, -0.2), kind: 'stool' }],
    me: [0.7, -0.95], cast: { DEE: [-0.3, -3.15, 0] }, use: { x: 0.4, z: -1.1, r: 1.5 }, wide: [4.6, 2.4, 3.2, -0.5, 1.25, -1.8],
    idle(t) { const d = room.npc.DEE; d.armL.rotation.set(-1.15, 0, Math.sin(t * 5) * 0.35 - 0.3); },   // Dee never stops polishing
  });
}

// ---- Club Prism ---------------------------------------------------------------------------------
// A big room on one shared BPM clock (beatU, locked to the synth): a raised DJ booth with decks,
// a mixer full of blinking LEDs and speaker stacks that thump with the kick, a light-tile floor
// whose pattern changes every bar, a mirror ball throwing moving spots, lasers through the haze,
// a bar with a bartender, booths, a VIP corner, a coat check and a crowd of 29 that dances in time.
export const FLOOR = { nx: 8, nz: 6, size: 1.3, cx: 0, cz: -0.9 };
const CROWD_TOPS = ['#ff5fa8', '#27d8cf', '#ffd447', '#ff8a4c', '#9b7bff', '#8dff9a', '#ff3f6a', '#f6f1e7', '#7fe0ff', '#ffb000'];
const CROWD_LEGS = ['#22203a', '#3b5a9a', '#f6f1e7', '#2f8f86', '#6a3fb8', '#c9b38a'];
const SKINS = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
// little helper: a geometry with a per-vertex float attribute (for the shader-animated parts)
function withAttr(geo, name, size, val) {
  const n = geo.attributes.position.count, a = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) a[i * size + k] = Array.isArray(val) ? val[k] : val;
  geo.setAttribute(name, new THREE.BufferAttribute(a, size));
  return geo;
}
const GAP = [-0.5, 2.4];                               // doorway in the club's right wall (z range)
const LOUNGE = { x0: 11, x1: 21, z0: -8, z1: 2.6, h: 4.2 };
// A semicircular upholstered booth around (cx, cz), open towards +z: seat cushions and a padded back
// built from short segments along the arc, end arms, a low round table with drinks and a candle lamp.
function booth(g, cx, cz, R, col, top) {
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = PI / 2 + ((i + 0.5) / N) * PI, ws = R * PI / N + 0.07, rb = R + 0.4, wb = rb * PI / N + 0.08;
    g.push(box(ws, 0.42, 0.62, cx + Math.sin(a) * R, 0.21, cz + Math.cos(a) * R, col, 0, a), box(ws - 0.02, 0.08, 0.58, cx + Math.sin(a) * R, 0.45, cz + Math.cos(a) * R, top, 0, a),
      box(wb, 0.95, 0.22, cx + Math.sin(a) * rb, 0.6, cz + Math.cos(a) * rb, col, 0, a), box(wb, 0.12, 0.28, cx + Math.sin(a) * rb, 1.12, cz + Math.cos(a) * rb, top, 0, a));
  }
  for (const sx of [-1, 1]) g.push(box(0.18, 0.66, 0.68, cx + sx * (R + 0.04), 0.33, cz + 0.12, col), box(0.2, 0.08, 0.7, cx + sx * (R + 0.04), 0.68, cz + 0.12, top));
  g.push(cyl(0.55, 0.55, 0.05, 14, cx, 0.52, cz, '#d9c7ff'), cyl(0.07, 0.1, 0.5, 6, cx, 0.25, cz, '#c9c0d8'), cyl(0.3, 0.32, 0.04, 10, cx, 0.02, cz, '#c9c0d8'),
    cyl(0.06, 0.05, 0.16, 6, cx - 0.2, 0.62, cz + 0.12, '#ff2bd1'), cyl(0.06, 0.05, 0.16, 6, cx + 0.22, 0.62, cz - 0.1, '#18f0ff'), cyl(0.05, 0.05, 0.12, 6, cx + 0.05, 0.6, cz + 0.28, '#ffe14a'),
    cyl(0.07, 0.08, 0.16, 8, cx, 0.63, cz - 0.05, '#ff9a3d'), box(0.03, 0.06, 0.03, cx, 0.74, cz - 0.05, '#fff3c4'));
  // pendant lamp over the table
  g.push(box(0.02, 1.9, 0.02, cx, LOUNGE.h - 0.95, cz, '#3a3550'), cyl(0.1, 0.32, 0.26, 10, cx, LOUNGE.h - 1.95, cz, top));
}
function lounge(g) {
  const L = LOUNGE, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, w = L.x1 - L.x0, d = L.z1 - L.z0, H = L.h;
  // carpet, walls, a lower ceiling, velvet wall panels
  g.push(box(w, 0.1, d, cx, -0.05, cz, '#2a1034'));
  for (let i = 0; i < 6; i++) g.push(box(w, 0.012, 0.06, cx, 0.003, L.z0 + 1 + i * 1.8, '#3e1a4a'));
  g.push(box(w + 0.2, H + 0.2, 0.2, cx, H / 2, L.z0 - 0.1, '#2a0f3a'), box(0.2, H + 0.2, d + 0.2, L.x1 + 0.1, H / 2, cz, '#260d34'), box(w + 0.2, H + 0.2, 0.2, cx, H / 2, L.z1 + 0.1, '#2a0f3a'),
    box(w + 0.4, 0.2, d + 0.4, cx, H + 0.1, cz, '#0c0616'));
  for (let i = 0; i < 5; i++) g.push(box(1.6, 2.2, 0.05, L.x0 + 1 + i * 2, 1.6, L.z0 + 0.03, '#4a1a58'));
  // booths: the back row against the wall, the front row by the walkway (the far one is the talking booth)
  const T = [[13.8, -6.0], [18.4, -6.0], [13.8, -1.3], [18.4, -1.3]], R = 1.15;
  const COL = [['#8a1a52', '#d63a86'], ['#1a5a8a', '#3aa6d6'], ['#6a1a8a', '#b43ad6'], ['#8a3a1a', '#e07a3a']];
  T.forEach(([x, z], i) => booth(g, x, z, R, COL[i][0], COL[i][1]));
  // neon dividers between the booths
  g.push(box(0.08, 1.5, 3.0, 16.1, 0.75, -6.4, '#3a1a5a'), box(0.1, 0.1, 3.0, 16.1, 1.52, -6.4, '#ff2bd1'), box(0.1, 1.5, 0.1, 16.1, 0.75, -4.9, '#ff2bd1'));
  g.push(box(0.08, 1.3, 1.2, 16.1, 0.65, -2.9, '#3a1a5a'), box(0.1, 0.1, 1.2, 16.1, 1.32, -2.9, '#18f0ff'), box(0.1, 1.3, 0.1, 16.1, 0.65, -2.3, '#18f0ff'));
  // a neon cocktail glass on the far wall, a wave along the back wall
  const zx = (z0, y0, z1, y1, hex) => g.push(box(0.09, 0.09, Math.hypot(z1 - z0, y1 - y0) + 0.09, L.x1 - 0.06, (y0 + y1) / 2, (z0 + z1) / 2, hex, Math.atan2(-(y1 - y0), z1 - z0)));
  zx(-4.6, 3.3, -3.6, 2.4, '#ffe14a'); zx(-2.6, 3.3, -3.6, 2.4, '#ffe14a'); zx(-4.6, 3.3, -2.6, 3.3, '#ffe14a'); zx(-3.6, 2.4, -3.6, 1.9, '#ffe14a'); zx(-4.0, 1.9, -3.2, 1.9, '#ffe14a'); zx(-2.9, 3.1, -2.5, 3.8, '#ff2bd1');
  for (let i = 0; i < 8; i++) g.push(box(1.3, 0.09, 0.09, L.x0 + 0.7 + i * 1.2, 3.3 + (i % 2 ? 0.15 : -0.15), L.z0 + 0.06, '#18f0ff', 0, 0, i % 2 ? -0.25 : 0.25));
  // soft additive pools: table candles, pendant light on each table, the glow off the dividers
  const pools = [];
  const disc = (x, y, z, rad, hex, k) => { const q = new THREE.CircleGeometry(rad, 18).rotateX(-PI / 2).translate(x, y, z).toNonIndexed(); q.deleteAttribute('uv'); q.deleteAttribute('normal'); pools.push(withAttr(tint(q, hex), 'aK', 1, k)); };
  for (const [x, z] of T) { disc(x, 0.555, z, 0.5, '#ffb070', 0.9); disc(x, 0.01, z, 1.9, '#ff6ab0', 0.35); }
  disc(16.1, 0.01, -6.4, 1.6, '#ff2bd1', 0.4); disc(16.1, 0.01, -2.9, 1.1, '#18f0ff', 0.4);
  const gU = { uK: { value: 1 }, uT: { value: 0 } };
  const glow = new THREE.Mesh(merge(pools), new THREE.ShaderMaterial({
    uniforms: gU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true,
    vertexShader: 'attribute float aK; varying vec3 vC; varying float vK; varying vec2 vP; void main(){ vC = color; vK = aK; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK, uT; varying vec3 vC; varying float vK; varying vec2 vP; void main(){ gl_FragColor = vec4(vC * vK * uK * (0.88 + 0.12 * sin(uT * 7.0 + vP.x * 3.0)) * 0.55, 1.0); }',
  }));
  glow.renderOrder = 3;
  // seats: two ends facing each other across the table (turned a little towards the open side), and the back
  const seats = [], crowdSeats = [];
  T.forEach(([x, z], i) => {
    const e = 0.2, A = { x: x + R * Math.cos(e), z: z - R * Math.sin(e) }, Bq = { x: x - R * Math.cos(e), z: z - R * Math.sin(e) };
    const sA = { ...A, y: 0.45, yaw: Math.atan2(x - A.x, z - A.z), kind: 'booth', taken: false };
    const sB = { ...Bq, y: 0.45, yaw: Math.atan2(x - Bq.x, z - Bq.z), kind: 'booth', taken: false };
    const sC = { x, z: z - R, y: 0.45, yaw: 0, kind: 'booth', taken: false };
    seats.push(sA, sB, sC);
    if (i < 3) crowdSeats.push(sA, sC, sB);
  });
  const [tx, tz] = T[3], s = seats.slice(9);
  const blocks = [];
  for (const [x, z] of T) blocks.push({ x0: x - R - 0.55, x1: x + R + 0.55, z0: z - R - 0.55, z1: z - 0.7 }, { x0: x + R - 0.3, x1: x + R + 0.5, z0: z - 0.7, z1: z + 0.45 }, { x0: x - R - 0.5, x1: x - R + 0.3, z0: z - 0.7, z1: z + 0.45 }, { x0: x - 0.55, x1: x + 0.55, z0: z - 0.55, z1: z + 0.55 });
  blocks.push({ x0: 16.0, x1: 16.2, z0: -7.9, z1: -4.85 }, { x0: 16.0, x1: 16.2, z0: -3.5, z1: -2.3 });
  return {
    seats, crowdSeats, blocks, glow,
    talk: { me: s[1], npc: s[0], extra: s[2], zones: [{ x: tx, z: tz, r: 2.6 }, { x: tx, z: tz + 2.4, r: 1.7 }, { x: tx - 2.2, z: tz, r: 1.2 }], wide: [14.2, 2.4, 1.9, tx, 0.9, tz] },
    tick(t) { gU.uT.value = t; },
  };
}
function buildClub(room) {
  const g = [], F = FLOOR, HX = 11, HZ = 8, H = 6, r = rng(7);
  shell(g, HX, HZ, H, '#15102c', '#1c1438', ['#1a0f3a', '#120a2a', '#160c32'], '#0a0618', '#a98bff', GAP);
  // neon tube on the back / side walls
  const segZ = (x0, y0, x1, y1, z, hex, t = 0.09) => g.push(box(Math.hypot(x1 - x0, y1 - y0) + t, t, t, (x0 + x1) / 2, (y0 + y1) / 2, z, hex, 0, 0, Math.atan2(y1 - y0, x1 - x0)));
  const segX = (z0, y0, z1, y1, x, hex, t = 0.09) => g.push(box(t, t, Math.hypot(z1 - z0, y1 - y0) + t, x, (y0 + y1) / 2, (z0 + z1) / 2, hex, Math.atan2(-(y1 - y0), z1 - z0)));

  // --- raised DJ booth
  g.push(box(8.2, 0.7, 2.8, 0, 0.35, -6.6, '#241650'), box(8.24, 0.08, 0.08, 0, 0.7, -5.2, '#18f0ff'), box(8.24, 0.06, 0.06, 0, 0.08, -5.18, '#ff2bd1'));
  g.push(box(5, 1.0, 0.9, 0, 1.2, -5.75, '#2a1a5a'), box(5.2, 0.06, 1.0, 0, 1.73, -5.75, '#3a2a7a'), box(5.22, 0.04, 0.04, 0, 1.75, -5.24, '#18f0ff'));
  for (let i = 0; i < 16; i++) { const k = (i * 5) % 7; g.push(box(0.22, 0.12 + k * 0.08, 0.04, -2.1 + i * 0.28, 0.85 + k * 0.04, -5.28, NEON[i % 6])); }
  for (const sx of [-1, 1]) {
    const x = sx * 1.45;
    g.push(box(1.0, 0.1, 0.8, x, 1.8, -5.8, '#17122a'), cyl(0.36, 0.36, 0.04, 16, x, 1.87, -5.8, '#0c0c10'), cyl(0.1, 0.1, 0.05, 10, x, 1.89, -5.8, sx < 0 ? '#ff2bd1' : '#ffe14a'),
      box(0.04, 0.03, 0.45, x + 0.35, 1.9, -5.75, '#c9c0d8', 0, 0.3));
  }
  g.push(box(0.8, 0.12, 0.6, 0, 1.82, -5.8, '#3a3550'));
  // back wall: the prism logo in neon, a big one
  segZ(-1.5, 3, 1.5, 3, -7.92, '#f4f0ff'); segZ(-1.5, 3, 0, 5.2, -7.92, '#f4f0ff'); segZ(1.5, 3, 0, 5.2, -7.92, '#f4f0ff'); segZ(-5, 3.4, -0.7, 4.0, -7.92, '#ffffff');
  segZ(0.7, 4.1, 5.2, 5.0, -7.92, '#ff2bd1'); segZ(0.7, 4.0, 5.2, 4.2, -7.92, '#ffe14a'); segZ(0.7, 3.9, 5.2, 3.4, -7.92, '#18f0ff');
  // speaker stacks either side of the booth
  for (const sx of [-1, 1]) {
    const x = sx * 5.3;
    g.push(box(1.7, 1.8, 1.4, x, 0.9, -7.1, '#17122a'), box(1.4, 1.3, 1.2, x, 2.45, -7.1, '#1d1734'), box(1.0, 0.7, 1.0, x, 3.45, -7.1, '#17122a'),
      box(1.72, 0.04, 1.42, x, 1.8, -7.1, '#a98bff'), box(1.42, 0.04, 1.22, x, 3.1, -7.1, '#a98bff'));
  }
  // --- the bar down the left wall, bottles on lit shelves, a cocktail glass in neon
  g.push(box(1.0, 1.15, 7.6, -8.9, 0.575, -2.6, '#3a1a6a'), box(1.3, 0.08, 7.8, -8.9, 1.17, -2.6, '#d9c7ff'), box(0.05, 0.06, 7.6, -8.38, 0.25, -2.6, '#ff2bd1'), box(0.05, 0.05, 7.6, -8.38, 1.05, -2.6, '#18f0ff'));
  g.push(box(0.06, 1.8, 7.4, -10.94, 2.0, -2.6, '#4a3a8a'));
  for (const y of [1.45, 2.15]) {
    g.push(box(0.45, 0.06, 7.2, -10.7, y, -2.6, '#7a5cff'), box(0.46, 0.03, 7.2, -10.7, y - 0.05, -2.6, '#ffe14a'));
    for (let i = 0; i < 18; i++) { const hgt = 0.25 + r() * 0.15; g.push(cyl(0.055, 0.065, hgt, 6, -10.7, y + 0.03 + hgt / 2, -6 + i * 0.4, NEON[Math.floor(r() * 6)])); }
  }
  segX(-3.6, 4.4, -2.6, 3.4, -10.92, '#18f0ff'); segX(-1.6, 4.4, -2.6, 3.4, -10.92, '#18f0ff'); segX(-3.6, 4.4, -1.6, 4.4, -10.92, '#18f0ff');
  segX(-2.6, 3.4, -2.6, 2.9, -10.92, '#18f0ff'); segX(-3.0, 2.9, -2.2, 2.9, -10.92, '#18f0ff'); segX(-2.2, 4.2, -1.8, 4.9, -10.92, '#8dff5a');
  const BSTOOL = [-5.5, -4.2, -2.9, -1.6, -0.3];
  for (const z of BSTOOL) stool(g, -7.85, z, '#a98bff');
  // --- the booth lounge through the doorway in the right wall (see lounge() below), framed in neon
  g.push(box(0.1, 0.1, GAP[1] - GAP[0] + 0.2, HX - 0.02, 2.85, (GAP[0] + GAP[1]) / 2, '#ff2bd1'), box(0.1, 2.8, 0.1, HX - 0.02, 1.4, GAP[0] - 0.05, '#ff2bd1'), box(0.1, 2.8, 0.1, HX - 0.02, 1.4, GAP[1] + 0.05, '#ff2bd1'));
  segX(-3.2, 3.4, -1.0, 3.4, HX - 0.08, '#ffe14a'); segX(-1.0, 3.4, -0.7, 3.1, HX - 0.08, '#ffe14a'); segX(-1.0, 3.4, -0.7, 3.7, HX - 0.08, '#ffe14a');
  // neon palm and waves on the right wall either side of the doorway
  segX(-3.4, 2.2, -3.2, 4.6, 10.92, '#ffb000'); segX(-3.2, 4.6, -4.8, 3.9, 10.92, '#8dff5a'); segX(-3.2, 4.6, -1.8, 4.0, 10.92, '#8dff5a'); segX(-3.2, 4.6, -4.2, 5.2, 10.92, '#8dff5a'); segX(-3.2, 4.6, -2.2, 5.3, 10.92, '#8dff5a');
  for (let i = 0; i < 4; i++) { segX(-7.6 + i * 1.1, 1.75 + (i % 2) * 0.3, -6.5 + i * 1.1, 1.75 + ((i + 1) % 2) * 0.3, 10.92, '#18f0ff'); segX(3 + i * 1.1, 1.75 + (i % 2) * 0.3, 4.1 + i * 1.1, 1.75 + ((i + 1) % 2) * 0.3, 10.92, '#18f0ff'); }
  const LS = lounge(g);

  // --- the VIP corner behind a velvet rope
  g.push(box(4.0, 0.45, 0.9, 8.9, 0.225, 7.3, '#3a1a6a'), box(4.0, 1.2, 0.3, 8.9, 0.6, 7.85, '#2a1050'), box(3.9, 0.08, 0.85, 8.9, 0.49, 7.3, '#6a3fb8'), cyl(0.55, 0.55, 0.06, 12, 8.9, 0.55, 5.9, '#ffd166'), cyl(0.08, 0.12, 0.55, 6, 8.9, 0.27, 5.9, '#c9c0d8'));
  const ropeP = [[6.5, 7.6], [6.5, 5.9], [6.5, 4.2], [8.0, 4.2], [9.5, 4.2], [10.9, 4.2]];
  for (const [x, z] of ropeP) g.push(cyl(0.06, 0.09, 1, 8, x, 0.5, z, '#ffd166'), cyl(0.1, 0.1, 0.08, 8, x, 1.02, z, '#ffd166'), cyl(0.2, 0.22, 0.05, 8, x, 0.02, z, '#ffd166'));
  for (let i = 1; i < ropeP.length; i++) { const [x0, z0] = ropeP[i - 1], [x1, z1] = ropeP[i]; g.push(box(Math.abs(x1 - x0) + 0.05, 0.07, Math.abs(z1 - z0) + 0.05, (x0 + x1) / 2, 0.82, (z0 + z1) / 2, '#c41a3a')); }
  segZ(7.4, 3.6, 7.8, 2.8, 7.92, '#ffd166'); segZ(7.8, 2.8, 8.2, 3.6, 7.92, '#ffd166'); segZ(8.6, 2.8, 8.6, 3.6, 7.92, '#ffd166');
  segZ(9.1, 2.8, 9.1, 3.6, 7.92, '#ffd166'); segZ(9.1, 3.6, 9.6, 3.6, 7.92, '#ffd166'); segZ(9.6, 3.6, 9.6, 3.2, 7.92, '#ffd166'); segZ(9.6, 3.2, 9.1, 3.2, 7.92, '#ffd166');
  // --- coat check by the door
  g.push(box(0.8, 1.1, 3.1, -7.2, 0.55, 6.45, '#3a2a7a'), box(1.0, 0.07, 3.2, -7.2, 1.13, 6.45, '#d9c7ff'), box(0.05, 0.05, 3.1, -6.78, 0.9, 6.45, '#ffe14a'));
  g.push(box(0.06, 0.06, 3.2, -10.3, 2.1, 6.4, '#c9c0d8'));
  for (let i = 0; i < 8; i++) g.push(box(0.12, 0.9, 0.5, -10.3, 1.55, 5.0 + i * 0.4, ['#22203a', '#6a3fb8', '#ff5fa8', '#27d8cf', '#c9b38a', '#f6f1e7'][i % 6]));
  segX(5.4, 3.3, 6.4, 3.3, -10.92, '#ff2bd1'); segX(5.9, 3.3, 5.9, 3.6, -10.92, '#ff2bd1'); segX(5.4, 3.3, 5.9, 2.9, -10.92, '#ff2bd1'); segX(6.4, 3.3, 5.9, 2.9, -10.92, '#ff2bd1');
  // --- ceiling: trusses, light cans, the ball's rod
  for (const z of [-3.6, 1.8]) g.push(box(18, 0.14, 0.14, 0, 5.6, z, '#3a3550'), box(18, 0.14, 0.14, 0, 5.3, z, '#3a3550'));
  for (const x of [-5, 5]) g.push(box(0.14, 0.14, 11, x, 5.6, -0.9, '#3a3550'));
  for (let i = 0; i < 10; i++) g.push(cyl(0.16, 0.22, 0.4, 8, -7.2 + i * 1.6, 5.1, i % 2 ? -3.6 : 1.8, '#1d1734'), cyl(0.15, 0.15, 0.02, 8, -7.2 + i * 1.6, 4.89, i % 2 ? -3.6 : 1.8, NEON[i % 6]));
  g.push(box(0.04, 0.8, 0.04, 0, 5.6, -0.9, '#c9c0d8'));

  // --- dance floor: one quad; tiles, patterns (one per bar), breakdown and build are all in the shader
  const fU = { uBeat: beatU, uHot: { value: new THREE.Vector2(-1, -1) }, uCalm: { value: 0 }, uFlare: { value: 0 }, uMe: { value: new THREE.Vector2(-9, -9) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(F.nx * F.size, F.nz * F.size).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: fU, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uBeat, uCalm, uFlare; uniform vec2 uHot, uMe; varying vec2 vUv;
      vec3 pal(float h){ return 0.55 + 0.45 * cos(6.2832 * (h + vec3(0.0, 0.33, 0.67))); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 n = vec2(${F.nx}.0, ${F.nz}.0), p = vec2(vUv.x, 1.0 - vUv.y) * n, c = floor(p), f = fract(p), m = c + 0.5 - n * 0.5;
        float b = uBeat, beat = floor(b), ph = fract(b), bar = floor(b / 4.0), pb = mod(bar, 16.0);
        float pat = mod(bar * 5.0 + floor(bar / 4.0), 6.0), on;
        if (pat < 0.5) on = step(0.55, hash(c + beat * 0.37));
        else if (pat < 1.5) on = mod(c.x + c.y + beat, 2.0);
        else if (pat < 2.5) on = step(fract(length(m) * 0.32 - b * 0.5), 0.33);
        else if (pat < 3.5) on = step(abs(c.x - mod(floor(b * 2.0), n.x)), 0.5) + step(abs(c.y - mod(beat, n.y)), 0.5) * 0.6;
        else if (pat < 4.5) on = step(0.5, fract((c.x + c.y) * 0.25 - b * 0.5));
        else on = step(fract(length(c + 0.5 - uMe) * 0.3 - b * 0.5), 0.3) + 0.15;
        float pulse = 1.0 - 0.5 * ph;
        if (pb >= 12.0 && pb < 14.0) { on = 0.25 + 0.2 * sin(b * 0.785 + length(m)); pulse = 1.0; }
        else if (pb >= 14.0) { float rate = pb < 15.0 ? 1.0 : (ph < 0.5 && fract(b / 2.0) < 0.5 ? 2.0 : 4.0); on = step(0.5, fract(b * rate)) * (0.4 + (pb - 14.0) * 0.4 + ph * 0.2); pulse = 1.0; }
        vec3 col = pal(bar * 0.137 + c.y * 0.06 + c.x * 0.02 + pat * 0.11) * mix(0.12, 1.0, clamp(on, 0.0, 1.0)) * pulse * mix(1.0, 0.3, uCalm);
        col += vec3(1.0, 0.85, 1.0) * uFlare * (0.35 + 0.65 * on) * smoothstep(5.0, 0.0, length(c + 0.5 - uMe));
        float hot = step(abs(c.x - uHot.x) + abs(c.y - uHot.y), 0.1);
        col = mix(col, vec3(1.0) * (0.75 + 0.25 * sin(b * 6.2832)), hot);
        float edge = smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x) * smoothstep(0.0, 0.05, f.y) * smoothstep(1.0, 0.95, f.y);
        col *= mix(0.12, 1.0, edge) * (0.8 + 0.2 * smoothstep(0.7, 0.0, length(f - 0.5)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  floor.position.set(F.cx, 0.012, F.cz);

  // --- mirror ball, and the light spots it throws round the room (one instanced quad each)
  const BALL = new THREE.Vector3(0, 5.0, -0.9);
  const ballG = new THREE.SphereGeometry(0.55, 14, 10).toNonIndexed();
  { const n = ballG.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) { const k = 0.35 + r() * 0.65; for (let j = 0; j < 9; j++) col[i * 3 + j] = k * (j % 3 === 2 ? 1 : 0.92); }
    ballG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const ball = new THREE.Mesh(ballG, room.mat);
  ball.position.copy(BALL);
  const NS = 44, spotU = { uK: { value: 1 } };
  const spots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: spotU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.92, 1.0) * uK * smoothstep(1.0, 0.25, d), 1.0); }',
  }), NS);
  spots.frustumCulled = false;
  const sdir = [];
  for (let i = 0; i < NS; i++) { const y = -0.95 + r() * 1.05, a = r() * PI * 2, k = Math.sqrt(1 - y * y); sdir.push([Math.cos(a) * k, y, Math.sin(a) * k]); }

  // --- lasers fanning out from the booth through the haze (animated in the vertex shader)
  const lg = [], LCOL = ['#ff2bd1', '#18f0ff', '#8dff5a', '#ff2bd1', '#18f0ff', '#8dff5a', '#ffe14a', '#ffe14a'];
  const LORG = [[-3.8, 1.95, -5.4], [3.8, 1.95, -5.4], [-5.3, 3.9, -6.6], [5.3, 3.9, -6.6], [-2.2, 5.3, -7.5], [2.2, 5.3, -7.5], [-9.5, 5.4, -7.5], [9.5, 5.4, -7.5]];
  LORG.forEach((o, i) => {
    for (const rz of [0, PI / 2]) {
      const q = new THREE.PlaneGeometry(0.05, 18, 1, 1).rotateX(PI / 2).translate(0, 0, 9);
      if (rz) q.rotateZ(rz);
      const gq = tint(q, LCOL[i]);
      withAttr(gq, 'aB', 1, i); withAttr(gq, 'aO', 3, o);
      lg.push(gq);
    }
  });
  const lzU = { uBeat: beatU, uOn: { value: 1 } };
  const lasers = new THREE.Mesh(merge(lg), new THREE.ShaderMaterial({
    uniforms: lzU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexColors: true,
    vertexShader: /* glsl */`
      attribute float aB; attribute vec3 aO; uniform float uBeat; varying vec3 vC; varying float vL;
      void main(){
        vC = color; vL = position.z / 18.0;
        float side = aO.x < 0.0 ? 1.0 : -1.0, w = uBeat * 0.25 + aB * 0.9;
        float yaw = side * (0.25 + 0.35 * sin(w)) + (aO.x == 0.0 ? 0.0 : 0.0), pitch = (aO.y > 4.5 ? 0.42 : 0.04) + 0.12 * sin(w * 1.7 + aB);
        vec3 p = position;
        p.yz = mat2(cos(pitch), sin(pitch), -sin(pitch), cos(pitch)) * p.yz;
        p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + aO, 1.0);
      }`,
    fragmentShader: 'uniform float uOn; varying vec3 vC; varying float vL; void main(){ gl_FragColor = vec4(vC * uOn * pow(1.0 - vL, 1.6) * 1.4, 1.0); }',
  }));
  lasers.frustumCulled = false;

  // --- haze: a few soft additive sheets that drift
  const hz = [];
  for (const [y, s] of [[2.2, 0], [3.4, 1], [4.6, 2]]) hz.push(withAttr(new THREE.PlaneGeometry(21, 15).rotateX(-PI / 2).translate(0, y, 0).toNonIndexed(), 'aS', 1, s));
  const hzU = { uBeat: beatU, uCol: { value: new THREE.Color('#7a5cff') }, uK: { value: 1 } };
  for (const q of hz) q.deleteAttribute('normal');
  const haze = new THREE.Mesh(merge(hz), new THREE.ShaderMaterial({
    uniforms: hzU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'attribute float aS; varying vec2 vP; varying float vS; void main(){ vP = position.xz; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uBeat, uK; uniform vec3 uCol; varying vec2 vP; varying float vS;
      void main(){
        float t = uBeat * 0.12 + vS * 3.0;
        float n = sin(vP.x * 0.55 + t) * sin(vP.y * 0.7 - t * 0.8) + sin((vP.x + vP.y) * 0.31 + t * 1.3) * 0.6;
        float a = (0.5 + 0.35 * n) * 0.05 * uK * smoothstep(11.0, 6.0, abs(vP.x)) * smoothstep(8.0, 4.0, abs(vP.y + 0.9));
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  }));
  haze.frustumCulled = false; haze.renderOrder = 3;

  // --- speaker cones (they pump with the kick) and the mixer / deck LEDs (they blink on the beat)
  const coneG = merge([cyl(1, 1, 0.08, 14, 0, 0, 0, '#3a3550', PI / 2), cyl(0.62, 0.62, 0.1, 14, 0, 0, 0.02, '#55506a', PI / 2), cyl(0.22, 0.22, 0.12, 10, 0, 0, 0.05, '#8a85a0', PI / 2)]);
  const CONES = [];
  for (const sx of [-1, 1]) CONES.push([sx * 5.3, 0.9, -6.38, 0.62], [sx * 5.3, 2.45, -6.48, 0.48], [sx * 5.3, 3.45, -6.58, 0.26]);
  const cones = new THREE.InstancedMesh(coneG, room.mat, CONES.length);
  const leds = [];
  for (let i = 0; i < 28; i++) {
    const row = Math.floor(i / 7), col = i % 7;
    leds.push(withAttr(box(0.05, 0.03, 0.05, -0.3 + col * 0.1, 1.9, -6.0 + row * 0.12, NEON[(i * 3) % 6]), 'aI', 1, i));
  }
  for (let i = 0; i < 20; i++) { const sx = i < 10 ? -1 : 1, k = i % 10; leds.push(withAttr(box(0.08, 0.05, 0.03, sx * 0.55 + sx * 0.02, 1.0 + k * 0.07, -5.27, k > 7 ? '#ff2a3a' : k > 5 ? '#ffe14a' : '#3dff8a'), 'aI', 1, 100 + k + (sx > 0 ? 50 : 0))); }
  const ledU = { uBeat: beatU, uLvl: { value: 0 } };
  for (const q of leds) q.deleteAttribute('normal');
  const led = new THREE.Mesh(merge(leds), new THREE.ShaderMaterial({
    uniforms: ledU, fog: false, vertexColors: true,
    vertexShader: 'attribute float aI; uniform float uBeat, uLvl; varying vec3 vC; varying float vOn; void main(){ vC = color;'
      + ' float k = mod(aI, 50.0); vOn = aI < 100.0 ? step(0.45, fract(sin(aI * 12.9898 + floor(uBeat * 2.0) * 7.31) * 43758.5)) : step(k - 100.0, uLvl * 10.0);'
      + ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vOn; void main(){ gl_FragColor = vec4(vC * mix(0.12, 1.4, vOn), 1.0); }',
  }));

  // --- the crowd: torsos, heads, arms and legs as four instanced meshes. How many of them are out is
  // set by the story (CLUB_CROWD in story.js): dancers on the floor, regulars standing at the bar and on
  // the stools, couples in the lounge booths and the VIP corner, the coat-check attendant.
  const seats = [];
  for (const z of BSTOOL) seats.push({ x: -7.85, z, y: 0.83, yaw: -PI / 2, kind: 'stool', taken: false });
  seats.push(...LS.seats);
  const crowd = [];
  const person = (kind, role, x, z, yaw, extra) => crowd.push({ kind, role, x, z, yaw, hx: x, hz: z, tx: x, tz: z, i: crowd.length, move: crowd.length % 8, pref: [crowd.length % 8, (crowd.length * 3 + 1) % 8, (crowd.length * 5 + 2) % 8],
    h: 0.92 + r() * 0.16, cheer: 0, copy: 0, copyMove: 0, p: newPose(), seed: r() * 10, on: false, ...extra });
  // dance-floor slots on a jittered 7 x 4 grid, ordered so any first few are spread over the floor;
  // the courier's dance-off spot (0.6, -1.5) stays clear
  const slots = [];
  for (let cz = 0; cz < 4; cz++) for (let cx = 0; cx < 7; cx++) {
    let x = -4.4 + cx * 1.47 + (r() - 0.5) * 0.5, z = -4.1 + cz * 2.0 + (r() - 0.5) * 0.5 + (cx % 2) * 0.5;
    if (Math.hypot(x - 0.6, z + 1.5) < 1.2) x += x > 0.6 ? 0.9 : -0.9;
    slots.push([x, z]);
  }
  const ORDER = [10, 3, 25, 15, 21, 0, 6, 17, 12, 8, 23, 1, 19, 26, 4, 14, 9, 27, 2, 20, 11, 24, 7, 16, 22, 5, 13, 18];
  for (const k of ORDER) person('dance', 'dancers', slots[k][0], slots[k][1], PI + (r() - 0.5) * 1.2);
  person('bar', 'barStand', -7.3, -3.55, -PI / 2 + 0.4); person('bar', 'barStand', -7.25, -0.95, -PI / 2 - 0.3);
  for (const k of [1, 3, 0, 4, 2]) person('sit', 'stools', seats[k].x, seats[k].z, seats[k].yaw, { y: seats[k].y, seat: seats[k] });
  for (const st of LS.crowdSeats) person('sit', 'lounge', st.x, st.z, st.yaw, { y: st.y, seat: st });
  person('sit', 'vip', 8.3, 7.2, PI, { y: 0.5 }); person('sit', 'vip', 9.6, 7.2, PI, { y: 0.5 });
  person('coat', 'coat', -8.1, 6.3, PI / 2);
  const N = crowd.length;
  // the same refined blocks as the cast, cheaper: unlit with the shading baked in, big blocks bevelled,
  // per-person second / third colours (hair, trousers, shoes, hands) and a face from the shared atlas
  const CA = crowdAtlas(), CK = kit(CA, { shade: true }), W = '#ffffff', P0 = { b: 0 };
  const cMat = blockyMaterial({ atlas: CA, basic: true, inst: true }), cHead = blockyMaterial({ atlas: CA, basic: true, inst: true, face: true });
  const torso = new THREE.InstancedMesh(mergeParts([CK.B(0.4, 0.17, 0.25, 0, 0.93, 0, W, 'denim', { alt: 1 }), CK.B(0.41, 0.035, 0.258, 0, 1.02, 0, '#3a3440', 'leather', { alt: 3, b: 0 }),
    CK.B(0.42, 0.2, 0.25, 0, 1.12, 0, W, 'weave'), CK.B(0.45, 0.25, 0.27, 0, 1.33, 0, W, 'weave'), CK.B(0.12, 0.09, 0.26, 0.215, 1.45, 0, W, 'seam', P0), CK.B(0.12, 0.09, 0.26, -0.215, 1.45, 0, W, 'seam', P0),
    CK.B(0.24, 0.045, 0.2, 0, 1.475, 0, W, 'rib', { alt: 2, b: 0 }), CK.B(0.455, 0.05, 0.275, 0, 1.3, 0, W, 'plain', { alt: 2, b: 0 })]), cMat, N);
  const head = new THREE.InstancedMesh(mergeParts([CK.B(0.1, 0.08, 0.1, 0, 0, 0, W, 'plain', P0), CK.B(0.27, 0.28, 0.26, 0, 0.17, 0, W, 'plain', { b: 0.018 }), CK.face(0.234, 0.244, 0, 0.17, 0.1305, W),
    CK.B(0.032, 0.036, 0.022, 0, 0.135, 0.139, '#e2e2e2', 'plain', P0), CK.B(0.026, 0.06, 0.05, 0.145, 0.16, 0, '#dcdcdc', 'plain', P0), CK.B(0.026, 0.06, 0.05, -0.145, 0.16, 0, '#dcdcdc', 'plain', P0),
    CK.B(0.285, 0.07, 0.275, 0, 0.3, -0.005, W, 'hair', { alt: 1 }), CK.B(0.285, 0.2, 0.07, 0, 0.2, -0.11, W, 'hair', { alt: 1, b: 0 }),
    CK.B(0.03, 0.12, 0.17, 0.142, 0.24, -0.04, W, 'hair', { alt: 1, b: 0 }), CK.B(0.03, 0.12, 0.17, -0.142, 0.24, -0.04, W, 'hair', { alt: 1, b: 0 }),
    CK.B(0.2, 0.04, 0.03, 0.03, 0.29, 0.132, W, 'hair', { alt: 1, b: 0, rz: -0.12 })]), cHead, N);
  const arms = new THREE.InstancedMesh(mergeParts([CK.B(0.12, 0.24, 0.13, 0, -0.11, 0, W, 'weave'), CK.B(0.105, 0.04, 0.115, 0, -0.25, 0, W, 'plain', { alt: 1, b: 0 }),
    CK.B(0.112, 0.17, 0.122, 0, -0.35, 0, W, 'weave', { alt: 1 }), CK.B(0.085, 0.08, 0.09, 0, -0.475, 0, W, 'plain', { alt: 2, b: 0 }), CK.B(0.075, 0.04, 0.075, 0, -0.53, 0.005, W, 'plain', { alt: 2, b: 0 })]), cMat, N * 2);
  const legs = new THREE.InstancedMesh(mergeParts([CK.B(0.15, 0.4, 0.17, 0, -0.2, 0, W, 'denim'), CK.B(0.135, 0.05, 0.155, 0, -0.42, 0, W, 'plain', { alt: 1, b: 0 }),
    CK.B(0.14, 0.33, 0.16, 0, -0.6, 0, W, 'denim', { alt: 1 }), CK.B(0.155, 0.1, 0.25, 0, -0.82, 0.04, W, 'leather', { alt: 2, b: 0 }), CK.B(0.16, 0.03, 0.26, 0, -0.885, 0.04, '#3a3a3a', 'tread', { alt: 3, b: 0 })]), cMat, N * 2);
  const xT = instExtras(torso), xH = instExtras(head, true), xA = instExtras(arms), xL = instExtras(legs);
  const col = new THREE.Color();
  const HAIRS = ['#1b1410', '#2a1a12', '#5a3a1a', '#a0703a', '#d9b26a', '#22203a', '#8a8a90', '#ff5fa8', '#27d8cf', '#9b7bff'];
  const SHOES = ['#f6f1e7', '#22203a', '#ff3f6a', '#27d8cf', '#c9b38a', '#ffd447'];
  for (const d of crowd) {
    const top = CROWD_TOPS[(d.i * 7) % CROWD_TOPS.length], sk = SKINS[(d.i * 5) % SKINS.length], lg2 = d.kind === 'coat' ? '#22203a' : CROWD_LEGS[(d.i * 3) % CROWD_LEGS.length];
    const shirt = d.kind === 'coat' ? '#f6f1e7' : top, acc = d.i % 3 === 1 ? CROWD_TOPS[(d.i * 3 + 4) % CROWD_TOPS.length] : shirt, bare = d.i % 4 === 2;
    torso.setColorAt(d.i, col.set(shirt)); xT.b(d.i, lg2); xT.c(d.i, acc);
    head.setColorAt(d.i, col.set(sk)); xH.b(d.i, HAIRS[(d.i * 7 + 3) % HAIRS.length]); xH.face(d.i, (d.i * 3) % CROWD_FACE_N);
    for (const k of [0, 1]) {
      arms.setColorAt(d.i * 2 + k, col.set(d.i % 3 ? shirt : sk)); xA.b(d.i * 2 + k, d.i % 3 === 1 ? shirt : sk); xA.c(d.i * 2 + k, sk);
      legs.setColorAt(d.i * 2 + k, col.set(lg2)); xL.b(d.i * 2 + k, bare ? sk : lg2); xL.c(d.i * 2 + k, SHOES[(d.i * 5 + 1) % SHOES.length]);
    }
  }
  for (const m of [torso, head, arms, legs, cones]) m.frustumCulled = false;
  const Rt = new THREE.Matrix4(), Bm = new THREE.Matrix4(), Lm = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'XYZ'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3();
  const tmp = newPose(), HIP = 0.92;
  const local = (m, x, y, z, rx, ry, rz) => Lm.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one);
  const Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  function drawPerson(d) {
    if (!d.on) { torso.setMatrixAt(d.i, Z0); head.setMatrixAt(d.i, Z0); for (const k of [0, 1]) { arms.setMatrixAt(d.i * 2 + k, Z0); legs.setMatrixAt(d.i * 2 + k, Z0); } return; }
    const o = d.p, c = Math.cos(d.yaw), s = Math.sin(d.yaw);
    Rt.compose(v.set(d.x + c * o.x, 0, d.z - s * o.x), q.setFromEuler(e.set(0, d.yaw + o.spin, 0)), sv.set(d.h, d.h, d.h));
    // body = root * T(0, y + hip) * R * T(0, -hip): turns about the hips
    Bm.multiplyMatrices(Rt, local(Lm, 0, o.y + HIP, 0, o.rx, o.ry, o.rz)); Bm.multiply(M.makeTranslation(0, -HIP, 0));
    torso.setMatrixAt(d.i, Bm);
    head.setMatrixAt(d.i, M.multiplyMatrices(Bm, local(Lm, 0, 1.5, 0, o.hx, 0, o.hz)));
    arms.setMatrixAt(d.i * 2, M.multiplyMatrices(Bm, local(Lm, 0.29, 1.46, 0, o.aL[0], o.aL[1], o.aL[2])));
    arms.setMatrixAt(d.i * 2 + 1, M.multiplyMatrices(Bm, local(Lm, -0.29, 1.46, 0, o.aR[0], o.aR[1], o.aR[2])));
    legs.setMatrixAt(d.i * 2, M.multiplyMatrices(Bm, local(Lm, 0.11, HIP, 0, o.lL[0], 0, o.lL[1])));
    legs.setMatrixAt(d.i * 2 + 1, M.multiplyMatrices(Bm, local(Lm, -0.11, HIP, 0, o.lR[0], 0, o.lR[1])));
  }
  const focus = { x: 99, z: 99, move: 0, dancing: false };
  let flare = 0, last = 0;
  const sp = new THREE.Vector3(), nrm = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), sq = new THREE.Quaternion(), ballQ = new THREE.Quaternion();

  Object.assign(room, {
    hx: HX, hz: HZ, h: H, geo: g, extras: [floor, ball, spots, lasers, haze, cones, led, torso, head, arms, legs, LS.glow],
    // walkable bounds: the main room plus the lounge (x up to 21, z -8..2.6); the right wall and the lounge's
    // front wall are blocks
    x0: -HX, x1: LOUNGE.x1, z0: -HZ, z1: HZ,
    blocks: [{ x0: -4.1, x1: 4.1, z0: -8, z1: -5.2 }, { x0: -6.2, x1: -4.4, z0: -8, z1: -6.35 }, { x0: 4.4, x1: 6.2, z0: -8, z1: -6.35 }, { x0: -11, x1: -8.35, z0: -6.45, z1: 1.25 },
      ...BSTOOL.map((z) => ({ x0: -8.12, x1: -7.58, z0: z - 0.27, z1: z + 0.27 })),
      { x0: HX - 0.1, x1: HX + 0.35, z0: -HZ, z1: GAP[0] }, { x0: HX - 0.1, x1: HX + 0.35, z0: GAP[1], z1: HZ }, { x0: HX + 0.35, x1: LOUNGE.x1, z0: LOUNGE.z1, z1: HZ },
      ...LS.blocks,
      { x0: 6.35, x1: 6.65, z0: 4.05, z1: 8 }, { x0: 6.35, x1: 11, z0: 4.05, z1: 4.35 }, { x0: -7.62, x1: -6.78, z0: 4.85, z1: 8 }, { x0: -11, x1: -9.9, z0: 4.6, z1: 8 }],
    seats,
    me: [9.4, 1.0], cast: { KILO: [0, -6.5, 0, 0.7], GLITZ: [4.3, -3.1, -1.2], TAPS: [-10.05, -2.6, PI / 2] }, wide: [-6.8, 3.8, 6.6, 1, 1.3, -3.2],
    // conversations happen seated in the far booth of the lounge: Skye and the speaker face each other
    // across the table, a second speaker takes the back of the booth. Dancers keep out of the zones.
    talk: LS.talk,
    // indoor roaming camera: in the lounge it sits in the front corner away from the courier
    camFor(lx, lz) { if (lx < HX + 0.3) return null; return [lx > 16 ? 12.2 : 20.3, 3.3, 2.0]; },
    clampCam(p) {
      if (p.x > HX + 0.2) { p.x = Math.min(Math.max(p.x, HX + 0.45), LOUNGE.x1 - 0.45); p.z = Math.min(Math.max(p.z, LOUNGE.z0 + 0.45), LOUNGE.z1 - 0.45); p.y = Math.min(p.y, LOUNGE.h - 0.3); }
      else { p.x = Math.max(p.x, -HX + 0.45); p.z = Math.min(Math.max(p.z, -HZ + 0.45), HZ - 0.45); p.y = Math.min(p.y, H - 0.35); }
    },
    inLounge: (lx) => lx > HX + 0.2,
    // story-driven crowd: 'quiet' | 'busy' | 'packed' (CLUB_CROWD in story.js)
    tier: null, level: CLUB_CROWD.busy,
    setTier(name) {
      if (room.tier === name) return;
      const first = room.tier === null, T = CLUB_CROWD[name], seen = {};
      room.tier = name; room.level = T;
      for (const d of crowd) {
        const n = seen[d.role] = (seen[d.role] || 0) + 1, on = n <= (T[d.role] || 0);
        if (on && !d.on && !first && d.kind === 'dance') { d.x = (r() - 0.5) * 2; d.z = HZ - 1.2; }   // newcomers walk in from the door
        else if (on && !d.on) { d.x = d.hx; d.z = d.hz; }
        d.on = on;
        if (d.seat) d.seat.taken = on;
      }
      fU.uCalm.value = name === 'quiet' ? 0.45 : 0;
    },
    exclude: null,
    setExclude(z) { room.exclude = z; },
    get crowd() { return crowd; },
    floorU: fU,
    // which dance-floor tile is (x, z) on? -> [i, j] or null
    tileAt(x, z) {
      const i = Math.floor((x - F.cx) / F.size + F.nx / 2), j = Math.floor((z - F.cz) / F.size + F.nz / 2);
      return i >= 0 && i < F.nx && j >= 0 && j < F.nz ? [i, j] : null;
    },
    // the dance module tells the room where the courier is and what they are doing
    setFocus(x, z, move, dancing) { focus.x = x; focus.z = z; focus.move = move; focus.dancing = dancing; fU.uMe.value.set((x - F.cx) / F.size + F.nx / 2, (z - F.cz) / F.size + F.nz / 2); },
    // a beat landed: the floor flares and dancers within reach cheer, then copy the move
    react(x, z, move, combo) {
      flare = Math.min(1.4, 0.7 + combo * 0.05);
      for (const d of crowd) {
        if (d.kind !== 'dance' || !d.on) continue;
        const dist = Math.hypot(d.x - x, d.z - z);
        if (dist > 2.4 + Math.min(combo, 16) * 0.12) continue;
        if (combo >= 4 && combo % 4 === 0) d.cheer = 1.6;
        if (combo >= 3) { d.copy = 6; d.copyMove = move; }
      }
    },
    // keep the courier out of the dancers (local coords)
    pushPeople(p, rad) {
      for (const d of crowd) {
        if (d.kind === 'sit' || !d.on) continue;
        const dx = p.x - d.x, dz = p.z - d.z, dd = Math.hypot(dx, dz), rr = rad + 0.28;
        if (dd < rr && dd > 1e-4) { p.x = d.x + dx / dd * rr; p.z = d.z + dz / dd * rr; }
      }
    },
    idle(t, dt, still) {
      const G = room.game, A = G && G.story && G.story.active;
      room.setTier(clubTier(G ? G.save.story : 2, A && !A.odd ? A.m.id : null));
      const LV = room.level.lights;
      const b = beatU.value, ph = b - Math.floor(b), sec = section(b), pb = Math.floor(b / 4) % 16;
      const kickE = sec === 'break' || (pb === 15 && ph + (Math.floor(b) % 4) >= 2) ? 0 : Math.exp(-ph * 7);
      ball.rotation.y = t * 0.45;
      // spots: rays from the ball to the walls, floor and ceiling
      ballQ.setFromAxisAngle(v.set(0, 1, 0), t * 0.45 * (still ? 0.3 : 1));
      for (let i = 0; i < NS; i++) {
        const dd = sdir[i]; nrm.set(dd[0], dd[1], dd[2]).applyQuaternion(ballQ);
        let tt = 1e9, nx = 0, ny = 0, nz = 0;
        if (nrm.y < -1e-3) { const k = -BALL.y / nrm.y; if (k < tt) { tt = k; nx = 0; ny = 1; nz = 0; } }
        if (nrm.y > 1e-3) { const k = (H - BALL.y) / nrm.y; if (k < tt) { tt = k; nx = 0; ny = -1; nz = 0; } }
        if (Math.abs(nrm.x) > 1e-3) { const k = ((nrm.x > 0 ? HX : -HX) - BALL.x) / nrm.x; if (k < tt) { tt = k; nx = -Math.sign(nrm.x); ny = 0; nz = 0; } }
        if (Math.abs(nrm.z) > 1e-3) { const k = ((nrm.z > 0 ? HZ : -HZ) - BALL.z) / nrm.z; if (k < tt) { tt = k; nx = 0; ny = 0; nz = -Math.sign(nrm.z); } }
        sp.copy(BALL).addScaledVector(nrm, tt).add(v.set(nx * 0.03, ny * 0.03, nz * 0.03));
        sq.setFromUnitVectors(Z, v.set(nx, ny, nz));
        const sz = 0.18 + tt * 0.045;
        spots.setMatrixAt(i, M.compose(sp, sq, sv.set(sz, sz, 1)));
      }
      spots.instanceMatrix.needsUpdate = true;
      spotU.uK.value = (sec === 'break' ? 0.75 : sec === 'build' ? 0.25 : 0.35 + 0.15 * kickE) * LV;
      lzU.uOn.value = (sec === 'break' ? 0 : sec === 'build' ? (pb === 15 ? (ph < 0.5 ? 0.9 : 0.15) : 0.35) : 0.55 + 0.35 * kickE) * (LV < 0.6 ? 0.25 : LV);
      hzU.uK.value = (sec === 'break' ? 0.6 : 1 + kickE * 0.6) * LV;
      LS.tick(t);
      hzU.uCol.value.set(NEON[Math.floor(b / 4) % 6]);
      ledU.uLvl.value = 0.25 + 0.75 * kickE;
      flare = Math.max(0, flare - dt * 2.2); fU.uFlare.value = flare;
      for (let i = 0; i < CONES.length; i++) {
        const c = CONES[i], k = c[3] * (1 + kickE * (still ? 0.03 : 0.1));
        cones.setMatrixAt(i, M.compose(v.set(c[0], c[1], c[2] + kickE * 0.04), q.identity(), sv.set(k, k, 1 + kickE * 2)));
      }
      cones.instanceMatrix.needsUpdate = true;
      // the crowd
      const near2 = 20;
      const ex = room.exclude;
      for (const d of crowd) {
        if (!d.on) { drawPerson(d); continue; }
        d.cheer = Math.max(0, d.cheer - dt); d.copy = Math.max(0, d.copy - dt);
        if (d.kind === 'dance' || d.kind === 'bar') {
          // walk to the slot, stepping out of any zone a conversation has claimed
          let tx = d.hx, tz = d.hz;
          if (ex) for (const zn of ex) { const dx = tx - zn.x, dz = tz - zn.z, dd = Math.hypot(dx, dz); if (dd < zn.r + 0.4) { const k = (zn.r + 0.4) / (dd || 1); tx = zn.x + (dd ? dx : 1) * k; tz = zn.z + (dd ? dz : 0) * k; } }
          const mx = tx - d.x, mz = tz - d.z, md = Math.hypot(mx, mz);
          if (md > 0.02) { const st = Math.min(md, dt * 2.2); d.x += mx / md * st; d.z += mz / md * st; }
          if (ex) for (const zn of ex) { const dx = d.x - zn.x, dz = d.z - zn.z, dd = Math.hypot(dx, dz); if (dd < zn.r) { d.x = zn.x + dx / (dd || 1) * zn.r; d.z = zn.z + dz / (dd || 1) * zn.r; } }
        }
        if (d.kind === 'sit') sitPose(d.y, b + d.seed * 0.01, tmp, d.seed, still);
        else if (d.kind === 'coat') { dancePose(1, b, tmp, 0.25); tmp.aR[0] = -0.5; tmp.aL[0] = -0.5; }
        else if (d.kind === 'bar') { dancePose(1, b, tmp, 0.35); tmp.aR[0] = -1.9 - 0.15 * Math.sin(b * 0.7 + d.seed); tmp.aR[2] = 0.35; tmp.hx = -0.1; }
        else {
          const drop = pb === 0 && b - Math.floor(b / 4) * 4 < 2;
          if (d.cheer > 0 || (sec === 'build' && pb === 15) || drop) cheerPose(b, tmp);
          else if (sec === 'break') dancePose(1, b, tmp, 0.35);
          else dancePose(d.copy > 0 ? d.copyMove : d.pref[(Math.floor(b / 16) + d.i) % 3], b, tmp, still ? 0.3 : 1);
          // face the booth, or the courier when they are dancing close by
          const fx = focus.x - d.x, fz = focus.z - d.z, near = focus.dancing && fx * fx + fz * fz < near2;
          const want = near ? Math.atan2(fx, fz) : PI + Math.sin(d.seed + b * 0.05) * 0.5;
          d.yaw += angleDelta(d.yaw, want) * (1 - Math.exp(-3 * dt));
        }
        blendPose(d.p, tmp, last ? 1 - Math.exp(-10 * dt) : 1);
        drawPerson(d);
      }
      last = 1;
      for (const m of [torso, head, arms, legs]) m.instanceMatrix.needsUpdate = true;
      const k = room.npc.KILO, kb = Math.sin(b * PI * 2);
      if (!k.seated) {
        // warming up to a near-empty room: one hand on the deck, a slow nod; later the hand goes up
        if (room.level.dj === 'warmup') { k.armL.rotation.set(-1.2, 0, 0.2); k.armR.rotation.set(-1.25, 0, -0.15); k.head.rotation.x = Math.sin(b * PI) * 0.08; }
        else { k.armL.rotation.set(-1.2, 0, 0.2); k.armR.rotation.set(0, 0, sec === 'build' ? -2.9 : -2.6 + kb * 0.25); k.head.rotation.x = kb * 0.12; }
      }
      const tp = room.npc.TAPS;                                   // the bartender shakes a cocktail in time
      tp.armR.rotation.set(-2.2 + Math.sin(b * PI * 2) * 0.35, 0, -0.3); tp.armL.rotation.set(-2.0 + Math.sin(b * PI * 2) * 0.35, 0, 0.3);
    },
  });
}

// ---- Zigzag Threads -----------------------------------------------------------------------------
function buildWear(room) {
  const g = [];
  // warm but not glaring: dusty-rose and sand tiles, terracotta walls, a toned ceiling (it used to be the
  // brightest room in the game by far, and bloomed white at night on High)
  shell(g, 6, 4.5, 4.2, '#b9849a', '#cdb3a6', ['#c97c55', '#b86c4a', '#cf8a62'], '#a8927f', '#ff9a3d');
  // zigzag dado along the back wall
  for (let i = 0; i < 12; i++) g.push(box(1.1, 0.14, 0.05, -5.5 + i, 3.2, -4.46, i % 2 ? '#ff2bd1' : '#18f0ff', 0, 0, i % 2 ? 0.5 : -0.5));
  // rails of jackets along both side walls
  for (const sx of [-1, 1]) {
    g.push(box(0.06, 0.06, 5.6, sx * 5.5, 2, -0.6, '#c9c0d8'), box(0.06, 2, 0.06, sx * 5.5, 1, -3.4, '#c9c0d8'), box(0.06, 2, 0.06, sx * 5.5, 1, 2.2, '#c9c0d8'));
    for (let i = 0; i < 13; i++) {
      const c = NEON[(i * 5 + (sx > 0 ? 2 : 0)) % 6], z = -3.2 + i * 0.43;
      g.push(box(0.5, 0.75, 0.1, sx * 5.45, 1.55, z, c), box(0.52, 0.1, 0.11, sx * 5.45, 1.25, z, '#fff6ec'), box(0.2, 0.5, 0.09, sx * 5.2, 1.6, z, c));
    }
    g.push(box(0.7, 0.3, 5.4, sx * 5.5, 0.15, -0.6, '#ff8fc4'));
    for (let i = 0; i < 6; i++) g.push(box(0.3, 0.14, 0.5, sx * 5.5, 0.37, -3 + i * 0.95, i % 2 ? '#fff6ec' : '#22203a'));
  }
  // fitting podium and a three-panel mirror
  g.push(cyl(1.1, 1.2, 0.2, 18, -2.2, 0.1, -2.6, '#ff2bd1'), cyl(0.95, 0.95, 0.03, 18, -2.2, 0.215, -2.6, '#fff6ec'));
  for (const [x, ry] of [[-3.5, 0.5], [-2.2, 0], [-0.9, -0.5]]) g.push(box(1.2, 2.5, 0.06, x, 1.45, -4.2 + Math.abs(ry) * 0.6, '#8fb2cc', 0, ry), box(1.3, 0.1, 0.08, x, 2.75, -4.19 + Math.abs(ry) * 0.6, '#ffe14a', 0, ry));
  // counter with a till, two mannequins in the window
  g.push(box(2.4, 1, 0.8, 3.2, 0.5, -2.2, '#7a3cff'), box(2.6, 0.08, 1, 3.2, 1.04, -2.2, '#fff6ec'), box(0.5, 0.35, 0.4, 3.9, 1.25, -2.2, '#22203a'), box(0.4, 0.2, 0.05, 3.9, 1.5, -2.35, '#8dff5a'));
  [[-3.6, '#ff7a2f', '#ffd84a'], [3.6, '#3a1d8a', '#18f0ff']].forEach(([x, a, b]) => {
    g.push(cyl(0.4, 0.45, 0.12, 10, x, 0.06, 3.4, '#22203a'), box(0.3, 0.8, 0.2, x, 0.6, 3.4, '#e8dccc'), box(0.46, 0.6, 0.27, x, 1.3, 3.4, a), box(0.48, 0.08, 0.29, x, 1.07, 3.4, b),
      box(0.14, 0.5, 0.15, x - 0.3, 1.28, 3.4, b), box(0.14, 0.5, 0.15, x + 0.3, 1.28, 3.4, b), box(0.22, 0.24, 0.22, x, 1.75, 3.4, '#e8dccc'));
  });
  g.push(box(8, 0.06, 0.06, 0, 4.05, 0, '#ff2bd1'), box(0.06, 0.06, 7, 0, 4.05, 0, '#ffe14a'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4.2, geo: g,
    blocks: [{ x0: -6, x1: -5, z0: -3.6, z1: 2.4 }, { x0: 5, x1: 6, z0: -3.6, z1: 2.4 }, { x0: 2, x1: 4.4, z0: -4.5, z1: -1.8 }, { x0: -4, x1: -0.4, z0: -4.5, z1: -3.9 }, { x0: -4, x1: -3.2, z0: 3, z1: 3.8 }, { x0: 3.2, x1: 4, z0: 3, z1: 3.8 }],
    me: [0.6, -0.6], cast: { MIMI: [3.1, -3.1, -0.5] }, use: { x: -2.2, z: -2.2, r: 1.5 }, wide: [4.6, 2.6, 3.4, -1.5, 1.2, -2],
    idle(t) { const m = room.npc.MIMI; m.armR.rotation.set(-0.9 + Math.sin(t * 2) * 0.15, 0, -0.2); m.head.rotation.z = Math.sin(t * 0.8) * 0.08; },
  });
}

// ---- Pelican Pantry 24 ----------------------------------------------------------------------------
function buildMart(room) {
  const g = [], r = rng(24);
  shell(g, 6, 4.5, 4, '#e9fbf6', '#bfeee2', ['#f4fff9', '#e2f7ee', '#eafaf2'], '#ffffff', '#5dff9a');
  // fridge wall: glowing doors full of cans
  for (let i = 0; i < 6; i++) {
    const x = -4.9 + i * 1.5;
    g.push(box(1.4, 2.6, 0.5, x, 1.3, -4.2, '#dff9ff'), box(1.3, 2.4, 0.06, x, 1.3, -3.93, '#9fe8ff'), box(0.06, 2.6, 0.56, x + 0.72, 1.3, -4.2, '#c9c0d8'), box(0.05, 0.5, 0.05, x + 0.5, 1.3, -3.86, '#6a7a8a'));
    // the drinks behind the glass are painted (game/redress.js)
  }
  g.push(box(9.2, 0.3, 0.6, -1.15, 2.8, -4.15, '#27c9bf'));
  // two aisles of shelves
  for (const x of [-3.2, -0.4]) {
    g.push(box(0.9, 1.7, 3.6, x, 0.85, -0.3, '#fbf7f0'), box(1, 0.08, 3.7, x, 1.74, -0.3, '#ff8fc4'));
    // the packs on the shelves are painted shelf fronts (game/redress.js)
  }
  // counter: till, hot-dog roller, slush machine. Gus stands behind it.
  g.push(box(1, 1, 3.4, 3.6, 0.5, 0.6, '#27c9bf'), box(1.2, 0.08, 3.6, 3.6, 1.04, 0.6, '#fff6ec'), box(0.06, 0.4, 3.4, 3.08, 0.5, 0.6, '#ff4fa3'),
    box(0.45, 0.35, 0.5, 3.6, 1.25, 1.6, '#22203a'), box(0.05, 0.22, 0.4, 3.36, 1.5, 1.6, '#8dff5a'),
    box(0.6, 0.14, 0.8, 3.6, 1.15, 0.4, '#c9c0d8'), cyl(0.05, 0.05, 0.7, 6, 3.5, 1.27, 0.4, '#c9603a', PI / 2), cyl(0.05, 0.05, 0.7, 6, 3.7, 1.27, 0.4, '#c9603a', PI / 2),
    box(0.7, 0.5, 0.6, 3.6, 1.33, -0.7, '#f4f0ff'), cyl(0.2, 0.2, 0.55, 10, 3.45, 1.85, -0.7, '#ff4fa3'), cyl(0.2, 0.2, 0.55, 10, 3.78, 1.85, -0.7, '#27e8ff'));
  // cigarette-free back wall: a pelican made of neon tubes, a clock, the freezer with the shoebox
  const P = '#ffe14a';
  g.push(box(0.07, 0.9, 0.5, 5.9, 2.75, -2.6, '#fff6ec'), box(0.07, 0.3, 0.9, 5.9, 2.75, -1.9, P), box(0.07, 0.1, 0.5, 5.9, 3.2, -2.8, '#22203a'));
  g.push(box(1.6, 0.9, 0.8, 5.1, 0.45, -3.2, '#f4fff9'), box(1.6, 0.06, 0.8, 5.1, 0.93, -3.2, '#9fe8ff'), box(0.4, 0.22, 0.26, 5.1, 1.07, -3.2, '#c98d62'));
  for (const z of [-2, 0.5, 3]) g.push(box(9, 0.08, 0.3, 0, 3.92, z, '#ffffff'));
  // behind the counter: a deep teal wall stacked with colourful products and a dark back counter, so the
  // clerk is seen against colour instead of white
  g.push(box(0.06, 3.9, 4.6, 5.96, 1.95, 0.6, '#1f5a66'), box(0.5, 0.95, 4.2, 5.7, 0.475, 0.6, '#2b2440'), box(0.55, 0.05, 4.3, 5.7, 0.97, 0.6, '#ffe14a'));
  for (let sh = 0; sh < 3; sh++) {
    g.push(box(0.32, 0.05, 4.2, 5.8, 1.45 + sh * 0.55, 0.6, '#d9c7ff'));
    for (let k = 0; k < 13; k++) g.push(box(0.2, 0.26 + (k % 3) * 0.05, 0.22, 5.82, 1.6 + sh * 0.55 + (k % 3) * 0.025, -1.2 + k * 0.3, NEON[(k * 5 + sh * 2) % 6]));
  }
  g.push(box(0.05, 0.45, 2.2, 5.9, 3.35, 0.6, '#ff4fa3'), box(0.06, 0.1, 2.3, 5.88, 3.62, 0.6, '#5dff9a'), box(0.06, 0.1, 2.3, 5.88, 3.08, 0.6, '#5dff9a'));
  g.push(box(1.2, 0.5, 0.06, -4.6, 2.2, 4.42, '#ff4f6a'), box(1, 0.08, 0.07, -4.6, 2.3, 4.4, '#fff6ec'), box(0.7, 0.08, 0.07, -4.6, 2.1, 4.4, '#fff6ec'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4, geo: g,
    blocks: [{ x0: -6, x1: 4.6, z0: -4.5, z1: -3.6 }, { x0: -3.75, x1: -2.65, z0: -2.2, z1: 1.6 }, { x0: -0.95, x1: 0.15, z0: -2.2, z1: 1.6 }, { x0: 3, x1: 6, z0: -1.2, z1: 2.4 }, { x0: 4.2, x1: 6, z0: -3.7, z1: -2.7 }],
    me: [1.7, 0.5], cast: { GUS: [4.8, 0.5, -PI / 2] }, use: { x: 2.3, z: 0.6, r: 1.5 }, wide: [-1.6, 2.7, 3.6, 3.4, 1.2, 0.2],
    idle(t) { const n = room.npc.GUS; n.head.rotation.y = Math.sin(t * 1.7) * 0.5 * (Math.sin(t * 0.4) > 0 ? 1 : 0.1); n.armR.rotation.set(-0.5, 0, Math.sin(t * 9) * 0.05); n.armL.rotation.set(-0.5, 0, 0); },
  });
}

// ---- Volt & Spark Supply ----------------------------------------------------------------------------
// Small and brightly lit: a pale checked floor, light walls and ceiling panels; behind the violet counter
// a dark display wall of glowing neon blasters (the five Zizi sells), crates of fireworks along the left
// wall, a practice target on the right, Zizi behind the counter.
function buildArms(room) {
  const g = [], r = rng(31);
  shell(g, 6, 4.5, 4.2, '#d9e4f0', '#f3f7fb', ['#1d2440', '#a9bad2', '#b8c7dc'], '#f4f7fb', '#3ad6ff');
  for (const x of [-3, 0, 3]) for (const z of [-2.6, 0.4, 3]) g.push(box(1.8, 0.05, 0.7, x, 4.17, z, '#ffffff'));          // light panels
  // the display wall: a dark pegboard with the blasters lit up on it, a neon bolt over the top
  g.push(box(10.6, 2.8, 0.06, 0, 1.95, -4.44, '#141a30'));
  for (let i = 0; i < 26; i++) for (let j = 0; j < 7; j++) g.push(box(0.04, 0.04, 0.02, -5 + i * 0.4, 0.75 + j * 0.4, -4.4, '#2c3658'));
  const blaster = (x, y, kind, c) => {
    if (kind === 0) g.push(box(0.6, 0.18, 0.06, x, y, -4.38, '#22203a'), box(0.16, 0.3, 0.06, x - 0.12, y - 0.2, -4.38, '#3a3550'), box(0.56, 0.05, 0.07, x, y + 0.08, -4.36, c));
    else if (kind === 1) g.push(box(1.3, 0.14, 0.06, x, y, -4.38, '#22203a'), box(0.36, 0.22, 0.06, x - 0.55, y - 0.04, -4.38, '#3a3550'), box(1.0, 0.04, 0.07, x + 0.1, y + 0.07, -4.36, c), box(0.18, 0.18, 0.07, x + 0.7, y, -4.36, '#bff8ff'));
    else if (kind === 2) { g.push(box(0.9, 0.05, 0.06, x, y, -4.38, '#c9c0d8')); for (let k = 0; k < 3; k++) g.push(box(0.05, 0.26 - k * 0.04, 0.07, x - 0.2 + k * 0.2, y, -4.36, c)); }
    else g.push(box(1.1, 0.16, 0.06, x, y, -4.38, '#3a1d8a'), box(0.06, 0.18, 0.07, x - 0.3, y, -4.36, c), box(0.06, 0.18, 0.07, x + 0.1, y, -4.36, '#ffe14a'), box(0.06, 0.18, 0.07, x + 0.45, y, -4.36, c));
  };
  const COLS = ['#ff3fb4', '#27e8ff', '#b388ff', '#ff8a3d', '#8dff5a', '#ffe14a'];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) blaster(-3.9 + i * 2.6 + (row % 2) * 0.4, 1.2 + row * 0.85, (i + row) % 4, COLS[(i * 2 + row) % 6]);
  g.push(box(10.6, 0.08, 0.08, 0, 3.4, -4.38, '#3ad6ff'), box(10.6, 0.08, 0.08, 0, 0.52, -4.38, '#ff2bd1'));
  const B = '#ffe14a';                                              // the shop's bolt in neon, top centre
  g.push(box(0.12, 0.7, 0.07, -0.25, 3.82, -4.36, B, 0, 0, -0.5), box(0.6, 0.12, 0.07, 0, 3.55, -4.36, B), box(0.12, 0.7, 0.07, 0.25, 3.3, -4.36, B, 0, 0, -0.5));
  // the counter, with a glass case of firework bangs and a till
  g.push(box(6.4, 1.05, 0.8, 0, 0.525, -1.6, '#4a2a8a'), box(6.6, 0.08, 1.0, 0, 1.08, -1.6, '#efe8ff'), box(6.4, 0.06, 0.06, 0, 0.2, -1.18, '#3ad6ff'), box(6.4, 0.05, 0.05, 0, 0.98, -1.17, '#ff2bd1'));
  g.push(box(1.6, 0.35, 0.6, -1.6, 1.29, -1.6, '#cfeeff'), box(1.62, 0.04, 0.62, -1.6, 1.48, -1.6, '#ffffff'));
  for (let k = 0; k < 6; k++) g.push(cyl(0.06, 0.06, 0.22, 6, -2.2 + k * 0.24, 1.25, -1.6, k % 2 ? '#ff3f6a' : '#ffe14a', PI / 2));
  g.push(box(0.5, 0.32, 0.4, 2.2, 1.28, -1.7, '#22203a'), box(0.42, 0.18, 0.05, 2.2, 1.42, -1.48, '#8dff5a'));
  // fireworks along the left wall: crates with coloured stripes, rocket bundles, a SAFETY FIRST board
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2 - (i % 2); j++) {
    const x = -5.3, z = -0.6 + i * 0.95, y = 0.32 + j * 0.64;
    g.push(box(0.9, 0.62, 0.86, x, y, z, '#c98d62'), box(0.92, 0.12, 0.88, x, y + 0.12, z, COLS[(i + j * 2) % 6]), box(0.06, 0.3, 0.5, x + 0.46, y - 0.05, z, '#fff6ec'));
  }
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, rr = 0.12 + r() * 0.1; g.push(cyl(0.05, 0.05, 0.9, 6, -4.6 + Math.cos(a) * rr, 1.6, 2.9 + Math.sin(a) * rr, COLS[i % 6]), cyl(0.001, 0.07, 0.16, 6, -4.6 + Math.cos(a) * rr, 2.12, 2.9 + Math.sin(a) * rr, '#fff6ec')); }
  g.push(box(0.06, 0.9, 1.4, -5.94, 2.6, 1.0, '#ffe14a'), box(0.07, 0.12, 1.1, -5.92, 2.82, 1.0, '#22203a'), box(0.07, 0.08, 0.9, -5.92, 2.55, 1.0, '#22203a'), box(0.07, 0.08, 1.0, -5.92, 2.35, 1.0, '#22203a'));
  // the practice target on the right wall, a bench to try things on
  for (const [rad, c] of [[0.8, '#ff3f6a'], [0.6, '#fff6ec'], [0.4, '#ff3f6a'], [0.2, '#ffe14a']]) g.push(cyl(rad, rad, 0.04 + (0.8 - rad) * 0.05, 18, 5.95, 2.1, 0.6, c, 0, PI / 2));
  g.push(box(0.5, 0.45, 1.6, 5.4, 0.225, 0.6, '#3a3550'), box(0.52, 0.06, 1.62, 5.4, 0.47, 0.6, '#3ad6ff'));
  g.push(box(10, 0.06, 0.06, 0, 4.05, 1.5, '#3ad6ff'), box(10, 0.06, 0.06, 0, 4.05, -1.0, '#ff2bd1'));
  Object.assign(room, {
    hx: 6, hz: 4.5, h: 4.2, geo: g, clerk: 'ZIZI',
    blocks: [{ x0: -6, x1: 6, z0: -4.5, z1: -1.1 }, { x0: -6, x1: -4.75, z0: -1.1, z1: 3.4 }, { x0: 5.1, x1: 6, z0: -0.3, z1: 1.5 }],
    seats: [{ x: 5.4, z: 0.6, y: 0.5, yaw: -PI / 2, kind: 'stool' }],
    me: [0.5, -0.35], cast: { ZIZI: [-0.15, -2.55, 0] }, use: { x: 0, z: -0.6, r: 1.5 }, wide: [4.2, 2.6, 3.4, -0.6, 1.3, -2.2],
    idle(t) { const n = room.npc.ZIZI; n.armR.rotation.set(-1.1 + Math.sin(t * 3.2) * 0.25, 0, -0.25); n.armL.rotation.set(-0.9, 0, 0.3); n.head.rotation.y = Math.sin(t * 0.9) * 0.35; },
  });
}

const BUILD = { bar: buildBar, club: buildClub, wear: buildWear, mart: buildMart, arms: buildArms, ...VENUE_BUILD };

// Build a room for a place. `place` is { key, b: building } from the layout.
// A room may also carry (see dress.js): lights (baked into the vertex colours), boards (one painted canvas
// atlas), pools (additive light pools and shafts; shafts only on High graphics), ticks (animated pieces).
export function buildRoom(place, scene, game) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const room = { key: place.key, mat, npc: {}, extras: [], ox: place.b.cx, oz: place.b.cz, game, idle() {}, lights: null, pools: [], hiPools: [], ticks: [] };
  BUILD[place.key](room, scene);
  if (REDRESS[place.key]) REDRESS[place.key](room);
  const group = room.group = new THREE.Group();
  const body = merge(room.geo);
  if (room.lights) bake(body, room.lights, room.amb ?? 0.62, room.ambCol);
  group.add(new THREE.Mesh(body, mat), ...room.extras);
  if (room.boards) { const m = room.boards.mesh(); if (m) group.add(m); room.boards = null; }
  const lo = glow(room.pools), hi = glow(room.hiPools);
  for (const m of [lo, hi]) if (m) { group.add(m); room.ticks.push((t) => { m.userData.U.uT.value = t; }); }
  if (hi) room.ticks.push(() => { hi.visible = quality.high; });
  room.drawn = () => { let n = 0; group.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
  room.geo = null;
  for (const key in room.cast) {
    const [x, z, yaw, y = 0] = room.cast[key], n = room.npc[key] = makeNPC(key);
    Object.assign(n, { x, y, z, yaw, home: yaw, homeAt: [x, z, yaw, y] });
    n.g.position.set(x, y, z); n.g.rotation.y = yaw;
    group.add(n.g);
  }
  // the cast blink, talk and react whenever the room ticks (walking about, shopping, in a scene)
  const idle0 = room.idle;
  room.idle = (t, dt, still) => { idle0.call(room, t, dt, still); for (const f of room.ticks) f(t, dt, still); for (const k in room.npc) room.npc[k].tickFace(dt || 1 / 60); };
  group.position.set(room.ox, OY, room.oz);
  group.traverse((o) => o.layers.enable(1));
  if (!room.seats) room.seats = [];
  group.visible = false;
  scene.add(group);
  return room;
}
