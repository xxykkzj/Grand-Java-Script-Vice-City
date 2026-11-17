// Time of day, lighting, fog, rain and lightning. One clock drives everything:
// the sky/ocean shaders, the lights, neon brightness and the HUD clock.
import * as THREE from 'three';
import { lerp, damp, clamp, fogU, nightU, timeU, wetU, rainU, reflU, reducedMotion } from '../core/util.js';

const col = (h) => new THREE.Color(h);
const PRESET = {
  night: {
    top: col('#03020f'), mid: col('#140a38'), hor: col('#3c165e'), sunA: col('#ff2f8a'), sunB: col('#7a1a6a'),
    glow: col('#3a1a6a'), sun: col('#7f8cff'), hemiS: col('#3a3a8a'), hemiG: col('#3a1a52'),
    deep: col('#05041c'), shallow: col('#1b2c6e'), glass: col('#141a3a'),
    sunI: 0.55, hemiI: 0.85, neon: 1.0, lit: 0.62, stars: 1, size: 0.17, stripe: 1, fogNear: 70, fogFar: 520,
  },
  dawn: {
    top: col('#33479a'), mid: col('#e88aa8'), hor: col('#ffd0a0'), sunA: col('#fff3c0'), sunB: col('#ff9a6a'),
    glow: col('#ffb080'), sun: col('#ffc09a'), hemiS: col('#c8b0e8'), hemiG: col('#f0b090'),
    deep: col('#1c3a78'), shallow: col('#6ab0c8'), glass: col('#5a6a98'),
    sunI: 1.5, hemiI: 1.2, neon: 0.42, lit: 0.14, stars: 0.05, size: 0.11, stripe: 0.6, fogNear: 100, fogFar: 580,
  },
  day: {
    top: col('#2a7fd6'), mid: col('#74b9ea'), hor: col('#b9e3f2'), sunA: col('#fffbe6'), sunB: col('#fff3c4'),
    glow: col('#fff1c9'), sun: col('#fff1d6'), hemiS: col('#d6ecff'), hemiG: col('#e8c9a0'),
    deep: col('#0c6a93'), shallow: col('#35c9c2'), glass: col('#3f7f9c'),
    sunI: 2.3, hemiI: 1.5, neon: 0.12, lit: 0.0, stars: 0, size: 0.055, stripe: 0, fogNear: 140, fogFar: 640,
  },
  golden: {
    top: col('#2a4aa8'), mid: col('#f08a6a'), hor: col('#ffc266'), sunA: col('#fff0a0'), sunB: col('#ff7a4a'),
    glow: col('#ffa050'), sun: col('#ffb870'), hemiS: col('#e0a8c8'), hemiG: col('#ffb080'),
    deep: col('#1a3a80'), shallow: col('#e08a78'), glass: col('#8a5a78'),
    sunI: 2.1, hemiI: 1.35, neon: 0.38, lit: 0.1, stars: 0, size: 0.12, stripe: 0.6, fogNear: 110, fogFar: 600,
  },
  dusk: {
    top: col('#1c0b4d'), mid: col('#c22a8c'), hor: col('#ffa64a'), sunA: col('#ffe85a'), sunB: col('#ff2f8a'),
    glow: col('#ff7a4a'), sun: col('#ff9a5c'), hemiS: col('#c07ad8'), hemiG: col('#ff9a78'),
    deep: col('#2a1464'), shallow: col('#d2508c'), glass: col('#7a3d78'),
    sunI: 1.8, hemiI: 1.25, neon: 0.85, lit: 0.42, stars: 0.1, size: 0.17, stripe: 1, fogNear: 90, fogFar: 560,
  },
};
// hour -> look. Everything in between is interpolated every frame (uniform and colour updates only).
const KEYS = [[0, 'night'], [4.8, 'night'], [6.1, 'dawn'], [7.6, 'day'], [16.6, 'day'], [18.3, 'golden'], [19.5, 'dusk'], [20.4, 'dusk'], [21.6, 'night'], [24, 'night']];
const STOPS = [['dawn', 6.1], ['day', 12], ['golden', 18.3], ['dusk', 19.7], ['night', 22.5]];
const STORM = col('#2b2a3d'), OVERCAST = col('#8490a4'), MIST = col('#a9b0bb');
// cloud cover, rainfall, lightning, fog density for each kind of weather
export const WEATHER = {
  clear: { cloud: 0.12, rain: 0, bolt: 0, fog: 0, label: 'CLEAR' },
  cloudy: { cloud: 0.8, rain: 0, bolt: 0, fog: 0, label: 'CLOUDY' },
  rain: { cloud: 0.95, rain: 0.6, bolt: 0, fog: 0.12, label: 'RAIN' },
  storm: { cloud: 1, rain: 1, bolt: 1, fog: 0.15, label: 'STORM' },
  fog: { cloud: 0.55, rain: 0, bolt: 0, fog: 1, label: 'FOG' },
};
const ODDS = [['clear', 40], ['cloudy', 25], ['rain', 16], ['storm', 8], ['fog', 11]];
export const SPEEDS = [0, 0.25, 0.5, 1, 2, 5, 15, 60];

export function createEnvironment(scene, sky, ocean, city, camera, audio) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0x000000, 80, 520);

  const cur = { ...PRESET.dusk };
  for (const k in cur) if (cur[k].isColor) cur[k] = cur[k].clone();
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), tmp = new THREE.Color();

  // rain: line segments that wrap around the camera, animated entirely in the vertex shader
  const N = 1500, rp = new Float32Array(N * 6), re = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * 60, y = Math.random() * 40, z = Math.random() * 60;
    rp.set([x, y, z, x, y, z], i * 6); re[i * 2 + 1] = 1;
  }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rgeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainU_ = { uTime: timeU, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 } };
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU_, transparent: true, depthWrite: false, fog: false,
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
    tod: 19, target: null, speed: 1, indoor: false, flash: 0, cur,
    weather: 'clear', w: { cloud: 0.12, rain: 0, bolt: 0, fog: 0 }, wxTimer: 2.5, wet: 0,
    nextBolt: 4, pendingThunder: -1, phase: 'DUSK',
    get rainAmt() { return env.indoor ? 0 : env.w.rain; },
    jump(mode) { env.target = STOPS.find((s) => s[0] === mode)[1]; },
    // N key: fast-forward to the next named part of the day
    cycle() {
      const t = env.target ?? env.tod;
      const nx = STOPS.find((s) => s[1] > t + 0.3) || STOPS[0];
      env.target = nx[1];
      return nx[0].toUpperCase();
    },
    isNight() { const t = env.target ?? env.tod; return t >= 21 || t < 5.5; },
    toggleNight() { const on = !env.isNight(); env.jump(on ? 'night' : 'dusk'); return on; },
    setWeather(name, hold = 4) { env.weather = name; env.wxTimer = hold; if (name === 'storm') env.nextBolt = 1.2; },
    stepSpeed(dir) { const i = clamp(SPEEDS.indexOf(env.speed) + dir, 0, SPEEDS.length - 1); env.speed = SPEEDS[i]; return env.speed; },
    update(dt) {
      // clock: one game minute per real second (times env.speed), or fast-forward to a requested hour
      let adv = dt * env.speed / 60;
      if (env.target !== null) {
        const d = (env.target - env.tod + 24) % 24;
        adv = dt * 7;
        if (d <= adv) { adv = d; env.target = null; }
      }
      env.tod = (env.tod + adv) % 24;
      const t = env.tod;
      let i = 0;
      while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
      const a = PRESET[KEYS[i][1]], b = PRESET[KEYS[i + 1][1]];
      let k = clamp((t - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]), 0, 1);
      k = k * k * (3 - 2 * k);
      for (const key in a) {
        if (a[key].isColor) cur[key].copy(a[key]).lerp(b[key], k); else cur[key] = lerp(a[key], b[key], k);
      }
      env.phase = t < 4.8 || t >= 21.2 ? 'NIGHT' : t < 7 ? 'DAWN' : t < 17.4 ? 'DAY' : t < 19 ? 'GOLDEN HOUR' : 'DUSK';

      // sun rises in the east at 06:00, sets down the boulevard at 20:24; the moon takes the night shift
      const ang = (t - 6) / 14.4 * Math.PI, up = Math.sin(ang), dayK = clamp(up * 3, 0, 1);
      sunDir.set(-Math.cos(ang), up * 1.3, 0.28).normalize();
      const mang = ((t + 24 - 20.4) % 24) / 9.6 * Math.PI;
      moonDir.set(Math.cos(mang) * 0.8, Math.max(Math.sin(mang), -0.3) * 0.9 + 0.08, -0.6).normalize();

      // weather: drift towards the current kind, pick a new one every few game hours
      env.wxTimer -= adv;
      if (env.wxTimer <= 0) {
        let r = Math.random() * 100, pick = 'clear';
        for (const [n, o] of ODDS) { if (r < o) { pick = n; break; } r -= o; }
        if (pick === env.weather) pick = pick === 'clear' ? 'cloudy' : 'clear';
        env.setWeather(pick, 2 + Math.random() * 3);
      }
      const W = WEATHER[env.weather], w = env.w;
      for (const key in w) w[key] = damp(w[key], W[key], 0.22, dt);
      if (w.rain > 0.05) env.wet = Math.min(1, env.wet + dt * w.rain / 5); else env.wet = Math.max(0, env.wet - dt / 50);
      wetU.value = env.wet; rainU.value = env.indoor ? 0 : w.rain;

      const cover = w.cloud * 0.5 + w.rain * 0.3;
      if (cover > 0.01) {
        tmp.copy(STORM).lerp(OVERCAST, dayK * (1 - w.rain * 0.7));
        for (const key of ['top', 'mid', 'hor']) cur[key].lerp(tmp, cover);
        cur.sunI *= 1 - w.cloud * 0.35 - w.rain * 0.3; cur.stars *= 1 - w.cloud; cur.glow.multiplyScalar(1 - cover * 0.8);
        cur.fogNear = lerp(cur.fogNear, 30, w.rain); cur.fogFar = lerp(cur.fogFar, 300, w.rain);
      }
      scene.fog.color.copy(cur.hor).lerp(cur.mid, 0.25);
      if (w.fog > 0.01) {
        tmp.copy(MIST).multiplyScalar(0.12 + 0.88 * dayK).lerp(scene.fog.color, 0.35);
        scene.fog.color.lerp(tmp, w.fog * 0.8);
        for (const key of ['top', 'mid', 'hor']) cur[key].lerp(scene.fog.color, w.fog * 0.94);
        cur.fogNear = lerp(cur.fogNear, 3, w.fog); cur.fogFar = lerp(cur.fogFar, 95, w.fog);
        cur.sunI *= 1 - w.fog * 0.45; cur.stars *= 1 - w.fog;
      }
      if (w.bolt > 0.5 && env.weather === 'storm') {
        env.nextBolt -= dt;
        if (env.nextBolt <= 0) {
          env.nextBolt = 3 + Math.random() * 7;
          if (!reducedMotion) env.flash = 1;
          env.pendingThunder = 0.25 + Math.random() * 0.9;
        }
      }
      if (env.pendingThunder >= 0) { env.pendingThunder -= dt; if (env.pendingThunder < 0) audio.thunder(); }
      // flicker: a second, weaker pulse shortly after the first
      env.flash = Math.max(0, env.flash - dt * 2.6);
      const fl = reducedMotion || env.indoor ? 0 : env.flash * (0.55 + 0.45 * Math.sin(env.flash * 22));
      rain.visible = w.rain > 0.02 && !env.indoor; rainU_.uAmt.value = w.rain; rainU_.uCam.value.copy(camera.position);

      const su = sky.uniforms, ou = ocean.uniforms, veil = Math.max(w.fog, w.cloud * 0.85);
      su.uTop.value.copy(cur.top); su.uMid.value.copy(cur.mid); su.uHor.value.copy(cur.hor);
      su.uSunA.value.copy(cur.sunA); su.uSunB.value.copy(cur.sunB); su.uGlow.value.copy(cur.glow);
      su.uSunDir.value.copy(sunDir); su.uMoonDir.value.copy(moonDir); su.uSunSize.value = cur.size; su.uStripe.value = cur.stripe;
      su.uStars.value = cur.stars; su.uFlash.value = fl * 0.5; su.uCloud.value = w.cloud * (1 - w.fog * 0.7); su.uVeil.value = veil;
      sky.mesh.position.copy(camera.position);
      ocean.mesh.position.set(Math.round(camera.position.x / 40) * 40, ocean.mesh.position.y, Math.round(camera.position.z / 40) * 40);
      const sunUp = sunDir.y > 0.03, lightDir = sunUp ? sunDir : moonDir;
      ou.uDeep.value.copy(cur.deep).lerp(STORM, cover * 0.6); ou.uShallow.value.copy(cur.shallow).lerp(STORM, cover * 0.5);
      ou.uSky.value.copy(cur.hor); ou.uSunCol.value.copy(cur.glow).multiplyScalar((sunUp ? 1 : 0.25) * (1 - veil));
      ou.uSunDir.value.copy(lightDir);

      fogU.uFogColor.value.copy(scene.fog.color); fogU.uFogNear.value = cur.fogNear; fogU.uFogFar.value = cur.fogFar;
      scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;

      sun.color.copy(cur.sun); sun.intensity = cur.sunI + fl * 2;
      sun.position.copy(lightDir).multiplyScalar(100);
      // lift the light a little when it is low so façades are not completely side-lit
      sun.position.y = Math.max(sun.position.y, 32);
      hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI * (1 - cover * 0.25) + fl * 2.5;

      nightU.value = clamp(cur.neon * 1.15 - 0.1 + (w.fog + cover) * 0.25 * (1 - cur.neon), 0, 1);
      reflU.sky.value.copy(cur.hor).lerp(cur.mid, 0.5).multiplyScalar(0.8 + fl * 2);
      reflU.sun.value.copy(cur.sun).multiplyScalar(cur.sunI * 0.5 * (1 - veil)); reflU.dir.value.copy(lightDir);
      city.setLights(cur.neon, cur.lit, cur.glass);
      // indoors the courier is lit by the room, not the sky
      if (env.indoor) { hemi.color.set(0xfff0f6); hemi.groundColor.set(0xb090d0); hemi.intensity = 2.1; sun.intensity = 0.5; scene.fog.near = 400; scene.fog.far = 900; }
    },
  };
  return env;
}
