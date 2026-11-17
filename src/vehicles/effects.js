// Explosion particles: a fixed pool of additive point sprites + one reusable flash light.
import * as THREE from 'three';
import { pointScaleU, reducedMotion } from '../core/util.js';

export function createFx(scene) {
  const N = 640;
  const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3), size = new Float32Array(N);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), base = new Float32Array(N), grav = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colr, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uScale: pointScaleU },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vCol = aColor;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 300.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main(){
        float a = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0);
        gl_FragColor = vec4(vCol * a * a, 1.0);
      }`,
  }));
  pts.frustumCulled = false; pts.renderOrder = 7;
  scene.add(pts);
  const light = new THREE.PointLight(0xffb060, 0, 60, 1.6);
  scene.add(light);

  const c = new THREE.Color();
  let cursor = 0;
  function spawn(x, y, z, vx, vy, vz, hex, s, l, g) {
    const i = cursor; cursor = (cursor + 1) % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    c.set(hex); colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b;
    base[i] = s; life[i] = max[i] = l; grav[i] = g;
  }
  const PAL = ['#ffd27a', '#ff8a3d', '#ff4fa3', '#fff3c4', '#27e8ff'];
  const fx = {
    shake: 0,
    explode(x, y, z, scale = 1) {
      const n = Math.round(110 * scale);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, e = Math.random() * 1.45, sp = (4 + Math.random() * 20) * scale;
        const fire = i < n * 0.45;
        spawn(x, y + 0.3, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * (fire ? 0.7 : 1.1), Math.sin(a) * Math.cos(e) * sp,
          fire ? PAL[i % 2] : PAL[i % PAL.length], fire ? 3.4 * scale : 0.7, fire ? 0.35 + Math.random() * 0.4 : 0.6 + Math.random() * 0.9, fire ? 2 : 16);
      }
      spawn(x, y + 1, z, 0, 2, 0, '#fff3c4', 16 * scale, 0.22, 0);
      light.position.set(x, y + 2.5, z); light.intensity = 260 * scale;
      if (!reducedMotion) fx.shake = Math.max(fx.shake, 0.6 * scale);
    },
    puff(x, y, z, dx, dy, dz) {
      for (let i = 0; i < 10; i++) {
        spawn(x, y, z, dx * (8 + Math.random() * 10) + (Math.random() - 0.5) * 4, dy * 8 + Math.random() * 3, dz * (8 + Math.random() * 10) + (Math.random() - 0.5) * 4,
          PAL[i % 2], 1.6, 0.15 + Math.random() * 0.2, 0);
      }
    },
    // a burst of sparks (a lamp post going down)
    sparks(x, y, z, n = 26) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = 3 + Math.random() * 7;
        spawn(x, y, z, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, i % 3 ? '#ffd27a' : '#fff3c4', 0.35, 0.3 + Math.random() * 0.5, 18);
      }
    },
    // a hydrant fountain: call every frame while it runs (k fades it out)
    spray(x, z, k = 1) {
      const n = reducedMotion ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = Math.random() * 1.1;
        spawn(x + Math.cos(a) * 0.08, 0.75, z + Math.sin(a) * 0.08, Math.cos(a) * s, (7 + Math.random() * 3.5) * k, Math.sin(a) * s, i % 2 ? '#bfe8ff' : '#7fc8ff', 0.45, 1.1 + Math.random() * 0.4, 14);
      }
    },
    update(dt) {
      const drag = Math.exp(-2.2 * dt);
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { size[i] = 0; continue; }
        vel[i * 3 + 1] -= grav[i] * dt;
        vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.35; }
        size[i] = base[i] * Math.sqrt(life[i] / max[i]);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
      light.intensity *= Math.exp(-9 * dt);
      fx.shake *= Math.exp(-5 * dt);
    },
  };
  return fx;
}
