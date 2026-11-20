// Night ambience: moths fluttering round the street lamps near you and fireflies blinking in Fernwood Park
// and in the crowns of nearby palms. One Points object, motion computed in the vertex shader, anchors
// handed out to the lamps and palms nearest the camera a few times a second. At day, in the rain, on Low
// or indoors nothing is drawn (the object is hidden, so it costs no draw call).
import * as THREE from 'three';
import { timeU, pointScaleU, nightU, reducedMotion, rng, clamp } from '../core/util.js';
import { quality } from '../core/quality.js';

const MOTH_LAMPS = 36, PER_LAMP = 3, PALMS = 10, PER_PALM = 3, PARK_FLIES = 36;
const TOTAL = MOTH_LAMPS * PER_LAMP + PALMS * PER_PALM + PARK_FLIES;

export function createMotes(scene, L, camera, env) {
  const pos = new Float32Array(TOTAL * 3), seed = new Float32Array(TOTAL), kind = new Float32Array(TOTAL), arm = new Float32Array(TOTAL);
  const r = rng(8086);
  for (let i = 0; i < TOTAL; i++) { seed[i] = r(); kind[i] = i < MOTH_LAMPS * PER_LAMP ? 0 : 1; }
  // the park's flies stay put: hovering over the lawns, the hill and the pond
  const park = L.key.park, p0 = MOTH_LAMPS * PER_LAMP + PALMS * PER_PALM;
  for (let i = 0; i < PARK_FLIES; i++) {
    const k = (p0 + i) * 3;
    pos[k] = park.x0 + 6 + r() * (park.x1 - park.x0 - 12); pos[k + 1] = 0.7 + r() * 1.9; pos[k + 2] = park.z0 + 5 + r() * (park.z1 - park.z0 - 10);
  }
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const armA = new THREE.BufferAttribute(arm, 1).setUsage(THREE.DynamicDrawUsage);      // 1 while the slot has an anchor
  geo.setAttribute('aOn', armA);
  const U = { uTime: timeU, uScale: pointScaleU, uAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uMove: { value: reducedMotion ? 0.3 : 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute float aSeed, aKind, aOn; uniform float uTime, uScale, uAmt, uMove; uniform vec3 uCam;
      varying float vA; varying vec3 vC;
      void main(){
        float t = uTime, s = aSeed;
        vec3 p = position; float size, a;
        if (aKind < 0.5) {
          float w = t * (1.7 + s * 1.5) * (0.4 + 0.6 * uMove) + s * 40.0, rad = 0.45 + 0.55 * fract(s * 7.3);
          p += vec3(cos(w) * rad, sin(w * 1.7 + s) * 0.35, sin(w * 1.3 + s * 3.0) * rad);
          p += vec3(sin(t * 9.0 + s * 30.0), sin(t * 11.0 + s * 17.0), sin(t * 7.0 + s * 5.0)) * 0.07 * uMove;
          a = 0.55 + 0.45 * sin(t * 38.0 + s * 20.0) * uMove; size = 0.075; vC = vec3(1.0, 0.9, 0.68);
        } else {
          float w = t * 0.22 + s * 50.0;
          p += vec3(sin(w * 1.3) * 1.8 + sin(w * 0.7 + s * 9.0), sin(w * 0.9 + s * 2.0) * 0.5, cos(w * 1.1) * 1.8 + sin(w * 0.5 + s * 4.0));
          float c = fract(t * 0.2 + s * 13.0);
          a = smoothstep(0.0, 0.07, c) * (1.0 - smoothstep(0.07, 0.4, c)) * 1.3; size = 0.13; vC = vec3(0.62, 1.0, 0.28);
        }
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = distance(p, uCam);
        vA = a * uAmt * aOn * (1.0 - smoothstep(42.0, 75.0, d)) * smoothstep(0.6, 2.0, d);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(size * uScale / max(-mv.z, 0.1), 2.0, 14.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vC;
      void main(){
        float a = clamp(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0, 1.0);
        gl_FragColor = vec4(vC * (a * a * 0.8 + pow(a, 5.0)) * vA, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 5; pts.visible = false;
  scene.add(pts);

  const lamps = [...L.lamps, ...L.key.lamps], palms = [...L.palms, ...L.key.palms, ...L.key.trees.filter((t) => t.big)];
  const slotLamp = new Array(MOTH_LAMPS).fill(null), slotPalm = new Array(PALMS).fill(null);
  let timer = 0, nearest = 0;
  const near = (list, n, cond) => {
    const cx = camera.position.x, cz = camera.position.z, out = [];
    for (const o of list) { if (cond && !cond(o)) continue; const d = (o.x - cx) ** 2 + (o.z - cz) ** 2; if (d < 80 * 80) out.push([d, o]); }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, n).map((e) => e[1]);
  };
  // hand out the slots: keep whoever is still among the nearest, fill the rest
  const assign = (slots, want) => {
    const set = new Set(want);
    for (let i = 0; i < slots.length; i++) if (slots[i] && !set.has(slots[i])) slots[i] = null;
    const have = new Set(slots);
    for (const o of want) if (!have.has(o)) { const k = slots.indexOf(null); if (k < 0) break; slots[k] = o; }
  };
  function refresh() {
    assign(slotLamp, near(lamps, MOTH_LAMPS, (l) => !l.dead));
    assign(slotPalm, near(palms, PALMS));
    for (let i = 0; i < MOTH_LAMPS; i++) {
      const l = slotLamp[i];
      for (let j = 0; j < PER_LAMP; j++) {
        const k = i * PER_LAMP + j;
        if (l) { pos[k * 3] = l.x + Math.sin(l.yaw || 0) * 1.4; pos[k * 3 + 1] = 5.9; pos[k * 3 + 2] = l.z + Math.cos(l.yaw || 0) * 1.4; }
        arm[k] = l ? 1 : 0;
      }
    }
    const b = MOTH_LAMPS * PER_LAMP;
    for (let i = 0; i < PALMS; i++) {
      const p = slotPalm[i];
      for (let j = 0; j < PER_PALM; j++) {
        const k = b + i * PER_PALM + j;
        if (p) { pos[k * 3] = p.x; pos[k * 3 + 1] = (3.2 + seed[k] * 3.2) * (p.s || 1); pos[k * 3 + 2] = p.z; }
        arm[k] = p ? 1 : 0;
      }
    }
    for (let i = 0; i < PARK_FLIES; i++) arm[p0 + i] = 1;
    posA.needsUpdate = true; armA.needsUpdate = true;
  }
  const api = {
    points: pts, count: TOTAL,
    update(dt) {
      const nk = clamp((nightU.value - 0.6) / 0.3, 0, 1), amt = quality.high && !env.indoor ? nk * (1 - clamp(env.w.rain * 2, 0, 1)) : 0;
      U.uAmt.value = amt;
      pts.visible = amt > 0.01;
      if (!pts.visible) { timer = 0; return; }
      U.uCam.value.copy(camera.position);
      if ((timer -= dt) <= 0) { timer = 0.8; refresh(); nearest++; }
    },
    // checks: how many are lit and drawn right now
    stats() { let n = 0; for (let i = 0; i < TOTAL; i++) n += arm[i] ? 1 : 0; return { visible: pts.visible, anchored: n, total: TOTAL, amt: +U.uAmt.value.toFixed(2) }; },
  };
  return api;
}
