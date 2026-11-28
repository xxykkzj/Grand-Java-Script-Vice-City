// Street trees of both districts: seven original low-poly species (alongside the Kenney suburban tree the
// streets already had), each drawn as ONE InstancedMesh for the whole coast (at most one draw call a species):
//   royal    a tall smooth grey trunk, a green crownshaft and a ring of arching fronds
//   coconut  a curved, leaning trunk, drooping fronds and a cluster of nuts
//   fan      a short ringed trunk with round fan leaves
//   ficus    a thick trunk under a broad bushy canopy
//   jacaranda  a flowering tree, its canopy violet-blue with green showing through
//   seagrape a low spreading shrub-tree with big round leaves
//   cypress  slim and dark, a tall narrow cone
// Every instance gets its own height, scale, turn and a slight tint of its foliage (aTint, only where aLeaf
// is 1, so trunks stay trunk-coloured); palms sway a little in the vertex shader. On Low graphics each
// species switches to a simpler geometry (fewer fronds and leaf blobs). Each street picks a dominant species
// with some variety (pickSpecies).
import * as THREE from 'three';
import { tint, merge, rng, PI, timeU, VIEW } from '../core/util.js';
import { quality } from '../core/quality.js';

export const SPECIES = ['royal', 'coconut', 'fan', 'ficus', 'jacaranda', 'seagrape', 'cypress'];
// the shade of foliage each species varies around (multiplied into the leaf colour per instance)
const TINTS = {
  royal: ['#ffffff', '#e8fff0', '#f4ffe0'], coconut: ['#ffffff', '#f0ffe0', '#e0fff4'], fan: ['#ffffff', '#e8f8ff', '#f8ffe8'],
  ficus: ['#ffffff', '#e4f4e0', '#f0ffe8'], jacaranda: ['#ffffff', '#ffd8f4', '#e0e4ff', '#ffc8e8'], seagrape: ['#ffffff', '#fff4d8', '#e8ffe0'], cypress: ['#ffffff', '#e0f0e8', '#f0f8e0'],
};
const leaf = (g, k = 1) => { g.setAttribute('aLeaf', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); return g; };
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
const T = (g, hex, k = 0) => leaf(tint(nonIdx(g), hex), k);

// one arching frond (a strip bent down from the crown), pointing along +x before it is turned
function frond(len, wid, droop, seg) {
  const f = new THREE.PlaneGeometry(len, wid, seg, 1);
  f.rotateX(-PI / 2); f.translate(len / 2, 0, 0);
  const p = f.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / len;
    p.setZ(i, p.getZ(i) * (1 - t * 0.85) * (0.55 + Math.sin(t * PI) * 0.85));
    p.setY(i, Math.sin(t * 2.0) * 0.55 - t * t * droop - Math.abs(p.getZ(i)) * 0.3);
  }
  return f;
}
function crown(parts, n, y, len, droop, seg, a, b, x = 0) {
  for (let k = 0; k < n; k++) {
    const f = frond(len * (0.85 + (k % 3) * 0.1), len * 0.3, droop * (1 + (k % 2) * 0.35), seg);
    f.rotateZ(0.18 + (k % 2) * 0.12); f.rotateY((k / n) * PI * 2 + 0.3); f.translate(x, y, 0);
    parts.push(T(f, k % 2 ? a : b, 1));
  }
}
function blob(parts, r, x, y, z, hex, det, sy = 0.85) {
  parts.push(T(new THREE.IcosahedronGeometry(r, det).scale(1, sy, 1).translate(x, y, z), hex, 1));
}
// geometry of a species at full (hi) or reduced detail, base at the origin
function build(sp, hi) {
  const P = [], s6 = hi ? 6 : 4;
  if (sp === 'royal') {
    const tr = new THREE.CylinderGeometry(0.2, 0.3, 10, s6, hi ? 4 : 1); tr.translate(0, 5, 0);
    { const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.18 * Math.sin(y / 10 * PI); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
    P.push(T(tr, '#c8c2bc'), T(new THREE.CylinderGeometry(0.24, 0.26, 1.6, s6).translate(0, 10.8, 0), '#5fa36a'));
    crown(P, hi ? 10 : 6, 11.5, 3.6, 1.7, hi ? 5 : 3, '#2f9a5f', '#43b874');
  } else if (sp === 'coconut') {
    const tr = new THREE.CylinderGeometry(0.17, 0.3, 7.5, s6, hi ? 6 : 3); tr.translate(0, 3.75, 0);
    { const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 7.5; p.setX(i, p.getX(i) + t * t * 1.9); } }
    P.push(T(tr, '#9a6b4a'));
    crown(P, hi ? 9 : 5, 7.5, 3.4, 2.4, hi ? 5 : 3, '#2fa36b', '#3fbf7a', 1.9);
    if (hi) for (let k = 0; k < 3; k++) P.push(T(new THREE.IcosahedronGeometry(0.22, 0).translate(1.9 + Math.cos(k * 2.1) * 0.25, 7.25, Math.sin(k * 2.1) * 0.25), '#7a5a3a'));
  } else if (sp === 'fan') {
    const tr = new THREE.CylinderGeometry(0.32, 0.4, 3.6, s6, 1); tr.translate(0, 1.8, 0);
    P.push(T(tr, '#8a6a52'));
    if (hi) for (let y = 0.4; y < 3.4; y += 0.45) P.push(T(new THREE.CylinderGeometry(0.42, 0.42, 0.08, s6).translate(0, y, 0), '#6f553f'));
    const n = hi ? 9 : 6;
    for (let k = 0; k < n; k++) {
      const f = new THREE.CircleGeometry(1.25, hi ? 9 : 5, -1.1, 2.2);
      f.translate(0, 1.15, 0); f.rotateX(-0.5 - (k % 3) * 0.25); f.rotateY((k / n) * PI * 2); f.translate(0, 3.6, 0);
      P.push(T(f, k % 2 ? '#3a9a62' : '#4cb879', 1));
      const st = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 3); st.translate(0, 0.6, 0); st.rotateX(-0.5 - (k % 3) * 0.25); st.rotateY((k / n) * PI * 2); st.translate(0, 3.6, 0);
      if (hi) P.push(T(st, '#6f8a4a'));
    }
  } else if (sp === 'ficus') {
    P.push(T(new THREE.CylinderGeometry(0.32, 0.5, 2.6, s6).translate(0, 1.3, 0), '#7a6a5e'));
    for (const [a, l] of [[0.4, 1.6], [2.5, 1.4], [4.4, 1.5]]) { const br = new THREE.CylinderGeometry(0.12, 0.2, l, 4); br.translate(0, l / 2, 0); br.rotateZ(0.7); br.rotateY(a); br.translate(0, 2.3, 0); P.push(T(br, '#7a6a5e')); }
    const B = hi ? [[0, 4.4, 0, 2.3], [1.6, 3.9, 0.6, 1.6], [-1.5, 4.0, -0.4, 1.7], [0.4, 3.8, -1.6, 1.6], [-0.5, 3.9, 1.6, 1.5], [0.2, 5.4, 0.2, 1.5]] : [[0, 4.3, 0, 2.5], [1.3, 3.9, 0.4, 1.7], [-1.2, 4.0, -0.5, 1.7]];
    B.forEach(([x, y, z, r], k) => blob(P, r, x, y, z, k % 2 ? '#2f7f45' : '#3a944f', hi ? 1 : 0));
  } else if (sp === 'jacaranda') {
    P.push(T(new THREE.CylinderGeometry(0.18, 0.28, 3.2, s6).translate(0, 1.6, 0), '#6a5444'));
    for (const a of [0.3, 2.4, 4.3]) { const br = new THREE.CylinderGeometry(0.07, 0.12, 1.6, 4); br.translate(0, 0.8, 0); br.rotateZ(0.6); br.rotateY(a); br.translate(0, 2.8, 0); P.push(T(br, '#6a5444')); }
    const B = hi ? [[0, 4.6, 0, 1.7, '#9b7be8'], [1.3, 4.1, 0.5, 1.2, '#b08cf0'], [-1.2, 4.2, -0.4, 1.3, '#8e6fe0'], [0.3, 4.0, -1.3, 1.1, '#a888f2'], [-0.4, 4.1, 1.3, 1.1, '#5fa36a'], [0.1, 5.5, 0.2, 1.0, '#b99af4']]
      : [[0, 4.5, 0, 1.9, '#9b7be8'], [1.1, 4.0, 0.4, 1.3, '#a888f2'], [-1.1, 4.1, -0.4, 1.3, '#8e6fe0']];
    B.forEach(([x, y, z, r, c]) => blob(P, r, x, y, z, c, hi ? 1 : 0, 0.7));
  } else if (sp === 'seagrape') {
    for (const a of [0, 2.1, 4.2]) { const br = new THREE.CylinderGeometry(0.06, 0.12, 1.4, 4); br.translate(0, 0.7, 0); br.rotateZ(0.5); br.rotateY(a); P.push(T(br, '#7a5a44')); }
    const n = hi ? 12 : 5;
    for (let k = 0; k < n; k++) {
      const a = k * 2.399, rr = 0.4 + (k % 4) * 0.35, y = 0.9 + (k % 3) * 0.45;
      if (hi) { const d = new THREE.CircleGeometry(0.42, 7); d.rotateX(-PI / 2 + 0.5 * Math.sin(k)); d.rotateY(a); d.translate(Math.cos(a) * rr, y + 0.3, Math.sin(a) * rr); P.push(T(d, k % 2 ? '#5f9a3a' : '#79b04a', 1)); }
      else blob(P, 0.8, Math.cos(a) * rr * 0.8, y + 0.2, Math.sin(a) * rr * 0.8, k % 2 ? '#5f9a3a' : '#79b04a', 0, 0.7);
    }
    if (hi) blob(P, 0.9, 0, 1.3, 0, '#4f8a34', 0, 0.75);
  } else if (sp === 'cypress') {
    P.push(T(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 4).translate(0, 0.6, 0), '#5a4636'));
    if (hi) { P.push(T(new THREE.ConeGeometry(0.95, 4.2, 7, 2).translate(0, 3.0, 0), '#2a5f3e', 1), T(new THREE.ConeGeometry(0.75, 3.4, 7, 1).translate(0, 5.2, 0), '#326d47', 1), T(new THREE.ConeGeometry(0.42, 2.2, 6).translate(0, 7.1, 0), '#2a5f3e', 1)); }
    else P.push(T(new THREE.ConeGeometry(0.9, 7.4, 5).translate(0, 4.4, 0), '#2a5f3e', 1));
  }
  for (const g of P) { g.deleteAttribute('uv'); }
  const g = merge(P);
  g.computeBoundingSphere();
  return g;
}
const HEIGHT = { royal: [0.85, 1.2], coconut: [0.85, 1.15], fan: [0.8, 1.2], ficus: [0.85, 1.2], jacaranda: [0.85, 1.15], seagrape: [0.8, 1.25], cypress: [0.8, 1.25] };
// trunk radius at the base (for the collider) per species
export const TRUNK = { royal: 0.32, coconut: 0.3, fan: 0.4, ficus: 0.45, jacaranda: 0.28, seagrape: 0.5, cypress: 0.5, kit: 0.28 };

// A street's mix: its dominant species most of the time, sometimes one of the others it allows.
export function pickSpecies(mix, r) {
  const t = r();
  let acc = 0;
  for (const [sp, w] of mix) { acc += w; if (t < acc) return sp; }
  return mix[0][0];
}

// trees: [{ x, z, sp, s, yaw }]; returns { meshes, counts }
export function createStreetTrees(scene, trees) {
  const r = rng(8181), meshes = [], counts = {};
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.customProgramCacheKey = () => 'streettrees';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'attribute float aLeaf; attribute vec3 aTint; uniform float uTime;\n' + sh.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.xyz *= mix(vec3(1.0), aTint, aLeaf);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * 0.29 + instanceMatrix[3][2] * 0.13;
          float sw = aLeaf * smoothstep(1.5, 9.0, position.y) * 0.05;
          transformed.x += sin(uTime * 1.3 + ph) * sw * position.y * 0.25;
          transformed.z += cos(uTime * 1.1 + ph) * sw * position.y * 0.2;
        #endif`);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const sp of SPECIES) {
    const list = trees.filter((t) => t.sp === sp);
    counts[sp] = list.length;
    if (!list.length) continue;
    const hi = build(sp, true), lo = build(sp, false);
    const tintA = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    hi.setAttribute('aTint', tintA); lo.setAttribute('aTint', tintA);
    const mesh = new THREE.InstancedMesh(quality.high ? hi : lo, mat, list.length);
    const [h0, h1] = HEIGHT[sp];
    // every tree's matrix and tint, kept aside: only the trees near the camera are copied into the mesh (lod)
    const all = list.map((t) => {
      const k = (t.s || 1) * (h0 + r() * (h1 - h0)), wk = k * (0.92 + r() * 0.16), tl = TINTS[sp];
      c.set(tl[Math.floor(r() * tl.length)]).multiplyScalar(0.9 + r() * 0.15);
      return { x: t.x, z: t.z, m: m4.compose(v.set(t.x, 0, t.z), q.setFromAxisAngle(UP, t.yaw ?? r() * 6.28), s.set(wk, k, wk)).clone(), c: [c.r, c.g, c.b] };
    });
    all.forEach((a, i) => { mesh.setMatrixAt(i, a.m); tintA.setXYZ(i, ...a.c); });
    mesh.frustumCulled = false;
    mesh.userData = { geos: { hi, lo }, all, tint: tintA };
    scene.add(mesh); meshes.push(mesh);
  }
  quality.on(() => { for (const m of meshes) m.geometry = quality.high ? m.userData.geos.hi : m.userData.geos.lo; lodT = 0; });
  // street trees are many and small: only those within reach of the camera are drawn (refreshed every 20 frames)
  let lodT = 0;
  const lod = (cam) => {
    if ((lodT -= 1) > 0) return;
    lodT = 20;
    const R = (quality.high ? 230 : 160) * VIEW.far, cx = cam.position.x, cz = cam.position.z;
    for (const mesh of meshes) {
      const { all, tint } = mesh.userData;
      let n = 0;
      for (const a of all) {
        if ((a.x - cx) ** 2 + (a.z - cz) ** 2 > R * R) continue;
        mesh.setMatrixAt(n, a.m); tint.setXYZ(n, a.c[0], a.c[1], a.c[2]); n++;
      }
      mesh.count = n; mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true; tint.needsUpdate = true;
    }
  };
  return { meshes, counts, lod, tris: () => meshes.reduce((n, m) => n + (m.geometry.attributes.position.count / 3) * m.count, 0) };
}
