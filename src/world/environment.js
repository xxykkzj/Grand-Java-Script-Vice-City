// Time of day, lighting, fog, rain and lightning. One clock drives everything:
// the sky/ocean shaders, the lights, neon brightness and the HUD clock.
import * as THREE from 'three';
import { lerp, damp, clamp, fogU, nightU, timeU, reducedMotion } from '../core/util.js';

const col = (h) => new THREE.Color(h);
const PRESET = {
  day: {
    top: col('#2a7fd6'), mid: col('#74b9ea'), hor: col('#b9e3f2'), sunA: col('#fffbe6'), sunB: col('#fff3c4'),
    glow: col('#fff1c9'), sun: col('#fff1d6'), hemiS: col('#d6ecff'), hemiG: col('#e8c9a0'),
    deep: col('#0c6a93'), shallow: col('#35c9c2'), glass: col('#3f7f9c'),
    sunI: 2.3, hemiI: 1.5, neon: 0.12, lit: 0.0, stars: 0, elev: 0.95, size: 0.055, stripe: 0, fogNear: 140, fogFar: 640,
  },
  sunset: {
    top: col('#1c0b4d'), mid: col('#c22a8c'), hor: col('#ffa64a'), sunA: col('#ffe85a'), sunB: col('#ff2f8a'),
    glow: col('#ff7a4a'), sun: col('#ff9a5c'), hemiS: col('#c07ad8'), hemiG: col('#ff9a78'),
    deep: col('#2a1464'), shallow: col('#d2508c'), glass: col('#7a3d78'),
    sunI: 1.9, hemiI: 1.25, neon: 0.8, lit: 0.34, stars: 0.08, elev: 0.15, size: 0.17, stripe: 1, fogNear: 90, fogFar: 560,
  },
  night: {
    top: col('#03020f'), mid: col('#140a38'), hor: col('#3c165e'), sunA: col('#ff2f8a'), sunB: col('#7a1a6a'),
    glow: col('#3a1a6a'), sun: col('#7f8cff'), hemiS: col('#3a3a8a'), hemiG: col('#3a1a52'),
    deep: col('#05041c'), shallow: col('#1b2c6e'), glass: col('#141a3a'),
    sunI: 0.55, hemiI: 0.85, neon: 1.0, lit: 0.62, stars: 1, elev: -0.3, size: 0.17, stripe: 1, fogNear: 70, fogFar: 520,
  },
};
const KEYS = [[0, 'night'], [5, 'night'], [6.2, 'sunset'], [7.5, 'day'], [17, 'day'], [18.6, 'sunset'], [20.2, 'sunset'], [21.6, 'night'], [24, 'night']];
const JUMP = { day: 12, sunset: 19, night: 22.5 };
const STORM = col('#2b2a3d');
const MOON = new THREE.Vector3(0.55, 0.5, -0.67).normalize();

export function createEnvironment(scene, sky, ocean, city, camera, audio) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0x000000, 80, 520);

  const cur = { ...PRESET.sunset };
  for (const k in cur) if (cur[k].isColor) cur[k] = cur[k].clone();
  const sunDir = new THREE.Vector3();

  // rain: line segments that wrap around the camera, animated entirely in the vertex shader
  const N = 1500, rp = new Float32Array(N * 6), re = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * 60, y = Math.random() * 40, z = Math.random() * 60;
    rp.set([x, y, z, x, y, z], i * 6); re[i * 2 + 1] = 1;
  }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rgeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainU = { uTime: timeU, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 } };
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uTime * 42.0, 40.0) + uCam.y - 14.0;
        p.xz = mod(p.xz - uCam.xz, 60.0) - 30.0 + uCam.xz;
        p.y += aEnd * 1.1; p.x += aEnd * 0.18;
        vA = 0.25 + aEnd * 0.3;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAmt; varying float vA;
      void main(){ gl_FragColor = vec4(0.78, 0.85, 1.0, vA * uAmt); }`,
  }));
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 6;
  scene.add(rain);

  const env = {
    tod: 19, target: null, storm: false, stormAmt: 0, flash: 0, cur,
    nextBolt: 4, pendingThunder: -1,
    phase: 'SUNSET',
    jump(mode) { env.target = JUMP[mode]; },
    cycle() { env.jump(env.isNight() ? 'day' : env.tod >= 7.5 && env.tod < 17 ? 'sunset' : 'night'); },
    isNight() { const t = env.target ?? env.tod; return t >= 21 || t < 5.5; },
    toggleNight() { const on = !env.isNight(); env.jump(on ? 'night' : 'sunset'); return on; },
    update(dt) {
      // clock: one game minute every two real seconds, or fast-forward to a requested hour
      if (env.target !== null) {
        const d = (env.target - env.tod + 24) % 24;
        const step = dt * 7;
        if (d <= step) { env.tod = env.target; env.target = null; } else env.tod = (env.tod + step) % 24;
      } else env.tod = (env.tod + dt / 120) % 24;
      const t = env.tod;
      let i = 0;
      while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
      const a = PRESET[KEYS[i][1]], b = PRESET[KEYS[i + 1][1]];
      let k = clamp((t - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]), 0, 1);
      k = k * k * (3 - 2 * k);
      for (const key in a) {
        if (a[key].isColor) cur[key].copy(a[key]).lerp(b[key], k); else cur[key] = lerp(a[key], b[key], k);
      }
      env.phase = t < 5 || t >= 21 ? 'NIGHT' : t < 7.5 ? 'DAWN' : t < 17.5 ? 'DAY' : 'SUNSET';

      // storm overlay
      env.stormAmt = damp(env.stormAmt, env.storm ? 1 : 0, 0.9, dt);
      const s = env.stormAmt;
      if (s > 0.01) {
        for (const key of ['top', 'mid', 'hor']) cur[key].lerp(STORM, s * 0.72);
        cur.sunI *= 1 - s * 0.6; cur.fogNear = lerp(cur.fogNear, 30, s); cur.fogFar = lerp(cur.fogFar, 300, s);
        cur.stars *= 1 - s; cur.glow.multiplyScalar(1 - s * 0.7);
        env.nextBolt -= dt;
        if (env.storm && env.nextBolt <= 0) {
          env.nextBolt = 3 + Math.random() * 7;
          if (!reducedMotion) env.flash = 1;
          env.pendingThunder = 0.25 + Math.random() * 0.9;
        }
      }
      if (env.pendingThunder >= 0) { env.pendingThunder -= dt; if (env.pendingThunder < 0) audio.thunder(); }
      // flicker: a second, weaker pulse shortly after the first
      env.flash = Math.max(0, env.flash - dt * 2.6);
      const fl = reducedMotion ? 0 : env.flash * (0.55 + 0.45 * Math.sin(env.flash * 22));
      rain.visible = s > 0.02; rainU.uAmt.value = s; rainU.uCam.value.copy(camera.position);

      // sun position (kept roughly down the boulevard so the sunset frames nicely)
      const ce = Math.cos(cur.elev);
      sunDir.set(0.968 * ce, Math.sin(cur.elev), 0.25 * ce).normalize();
      const su = sky.uniforms, ou = ocean.uniforms;
      su.uTop.value.copy(cur.top); su.uMid.value.copy(cur.mid); su.uHor.value.copy(cur.hor);
      su.uSunA.value.copy(cur.sunA); su.uSunB.value.copy(cur.sunB); su.uGlow.value.copy(cur.glow);
      su.uSunDir.value.copy(sunDir); su.uSunSize.value = cur.size; su.uStripe.value = cur.stripe;
      su.uStars.value = cur.stars; su.uFlash.value = fl * 0.5;
      sky.mesh.position.copy(camera.position);
      ou.uDeep.value.copy(cur.deep).lerp(STORM, s * 0.5); ou.uShallow.value.copy(cur.shallow).lerp(STORM, s * 0.4);
      ou.uSky.value.copy(cur.hor); ou.uSunCol.value.copy(cur.glow).multiplyScalar(cur.elev > 0 ? 1 : 0.25);
      ou.uSunDir.value.copy(cur.elev > 0.02 ? sunDir : MOON);

      scene.fog.color.copy(cur.hor).lerp(cur.mid, 0.25);
      scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
      fogU.uFogColor.value.copy(scene.fog.color); fogU.uFogNear.value = cur.fogNear; fogU.uFogFar.value = cur.fogFar;

      sun.color.copy(cur.sun); sun.intensity = cur.sunI + fl * 2;
      sun.position.copy(cur.elev > 0.02 ? sunDir : MOON).multiplyScalar(100);
      // lift the light a little at sunset so façades are not completely side-lit
      sun.position.y = Math.max(sun.position.y, 32);
      hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI * (1 - s * 0.25) + fl * 2.5;

      nightU.value = clamp(cur.neon * 1.15 - 0.1, 0, 1);
      city.setLights(cur.neon, cur.lit, cur.glass);
    },
  };
  return env;
}
