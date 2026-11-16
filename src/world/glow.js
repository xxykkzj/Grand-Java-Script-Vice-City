// Cheap "bloom": additive soft point sprites placed on every light source.
// One draw call per set, brightness follows the day/night uniform.
import * as THREE from 'three';
import { fogU, FOG_PARS, pointScaleU, nightU } from '../core/util.js';

export function createGlow(scene, capacity) {
  const pos = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const base = new Float32Array(capacity);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: pointScaleU, uNight: nightU, ...fogU },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; attribute float aBase;
      uniform float uScale, uNight;
      ${FOG_PARS}
      varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        mv.z += min(0.9, dist * 0.5);              // nudge towards the camera so the lamp itself doesn't hide it
        float k = aBase + (1.0 - aBase) * uNight;
        vCol = aColor * k * (1.0 - smoothstep(uFogNear, uFogFar * 1.4, dist));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(dist, 0.1), 240.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main(){
        float a = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0);
        gl_FragColor = vec4(vCol * (a * a * 0.7 + pow(a, 6.0) * 0.6), 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  const c = new THREE.Color();
  let n = 0;
  const api = {
    points, capacity,
    set(i, x, y, z, hex, s, b = 0) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      if (hex !== null) { c.set(hex); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      size[i] = s; base[i] = b;
    },
    add(x, y, z, hex, s, b = 0) { if (n < capacity) api.set(n++, x, y, z, hex, s, b); return n - 1; },
    hide(i) { size[i] = 0; },
    commit() { for (const k in geo.attributes) geo.attributes[k].needsUpdate = true; },
  };
  return api;
}
