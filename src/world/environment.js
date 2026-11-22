// Time of day, lighting, fog, rain and lightning. One clock drives everything:
// the sky/ocean shaders, the lights, neon brightness and the HUD clock.
import * as THREE from 'three';
import { lerp, damp, clamp, fogU, nightU, timeU, glareU, wetU, rainU, reflU, reducedMotion, VIEW, pointScaleU } from '../core/util.js';
import { HX, HZ } from './layout.js';
import { KEY } from './key.js';

const col = (h) => new THREE.Color(h);
const lum = (c) => c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
let HOR_NIGHT = 0, HOR_DUSK = 1;   // set right after PRESET below
const PRESET = {
  night: {
    top: col('#03020f'), mid: col('#140a38'), hor: col('#3c165e'), sunA: col('#ff2f8a'), sunB: col('#7a1a6a'),
    glow: col('#3a1a6a'), sun: col('#7f8cff'), hemiS: col('#40409a'), hemiG: col('#4a2a62'),
    deep: col('#05041c'), shallow: col('#1b2c6e'), glass: col('#141a3a'),
    sunI: 0.55, hemiI: 1.02, neon: 1.0, lit: 0.62, stars: 1, size: 0.17, stripe: 1, fogNear: 70, fogFar: 520,
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
HOR_NIGHT = lum(PRESET.night.hor); HOR_DUSK = lum(PRESET.dusk.hor);
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
  const LN = 8, lightPos = []; for (let i = 0; i < LN; i++) lightPos.push(new THREE.Vector3(0, -999, 0));
  const rainU_ = { uTime: timeU, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uLights: { value: lightPos }, uNight: nightU };
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU_, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      attribute float aEnd; uniform float uTime, uNight; uniform vec3 uCam; uniform vec3 uLights[${LN}]; varying float vA; varying vec3 vLit;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uTime * 42.0, 40.0) + uCam.y - 14.0;
        p.xz = mod(p.xz - uCam.xz, 60.0) - 30.0 + uCam.xz;
        p.y += aEnd * 1.1; p.x += aEnd * 0.18;
        vA = 0.25 + aEnd * 0.3;
        // streaks light up as they fall past a street lamp (the nearest few lamps, passed in by the CPU)
        float gl = 0.0;
        for (int i = 0; i < ${LN}; i++) { vec3 d = p - uLights[i]; gl += exp(-dot(d, d) * 0.035); }
        vLit = vec3(1.0, 0.82, 0.55) * min(gl, 1.5) * uNight;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAmt; varying float vA; varying vec3 vLit;
      void main(){ gl_FragColor = vec4(vec3(0.78, 0.85, 1.0) + vLit, min(1.0, vA * uAmt * (1.0 + vLit.r * 1.6))); }`,
  }));
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 6;
  scene.add(rain);

  // splashes on the ground round the camera and drips off the awnings and bus shelters: one point cloud,
  // animated in the vertex shader (the splashes wrap round the camera like the rain; the drips' spots are
  // picked on the CPU twice a second from the shopfronts nearby). Street level only, never over the sea.
  const NS = 220, ND = 64, sp = new Float32Array((NS + ND) * 3), sk = new Float32Array(NS + ND), ss = new Float32Array(NS + ND);
  for (let i = 0; i < NS + ND; i++) { sp[i * 3] = Math.random() * 26; sp[i * 3 + 1] = 0; sp[i * 3 + 2] = Math.random() * 26; sk[i] = i < NS ? 0 : 1; ss[i] = Math.random(); }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('aKind', new THREE.BufferAttribute(sk, 1)); sgeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
  const splU = { uTime: timeU, uCam: rainU_.uCam, uAmt: { value: 0 }, uScale: pointScaleU, uNight: nightU,
    uIsle: { value: new THREE.Vector4(HX, HZ, (KEY.x0 + KEY.x1) / 2, (KEY.x1 - KEY.x0) / 2) }, uKeyZ: { value: (KEY.z1 - KEY.z0) / 2 } };
  const splash = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: splU, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      attribute float aKind, aSeed; uniform float uTime, uAmt, uScale, uKeyZ; uniform vec3 uCam; uniform vec4 uIsle;
      varying float vA; varying float vK; varying float vLife;
      void main(){
        vec3 p = position; float life;
        if (aKind < 0.5) {
          float cyc = uTime * (1.6 + aSeed) + aSeed * 13.0, n = floor(cyc); life = fract(cyc);
          vec2 o = fract(vec2(sin(n * 12.9 + aSeed * 78.2), sin(n * 39.3 + aSeed * 11.7)) * 43758.5) * 26.0;
          p.xz = uCam.xz - 13.0 + o; p.y = 0.03;
          bool land = (abs(p.x) < uIsle.x - 1.0 && abs(p.z) < uIsle.y - 0.5) || (abs(p.x - uIsle.z) < uIsle.w - 1.0 && abs(p.z) < uKeyZ - 1.0);
          vA = land ? (1.0 - life) * step(aSeed, uAmt * 1.1) : 0.0;
        } else {
          float cyc = uTime / (0.8 + aSeed * 0.9) + aSeed * 7.0; life = fract(cyc);
          p.y = position.y * (1.0 - life * life);
          vA = position.y > 0.5 ? smoothstep(0.0, 0.08, life) * (0.6 + 0.4 * step(0.3, uAmt)) : 0.0;
        }
        vK = aKind; vLife = life;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vA *= smoothstep(26.0, 8.0, dist) * step(0.5, dist);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aKind < 0.5 ? (0.12 + life * 0.3) * uScale / max(dist, 0.5) : 0.09 * uScale / max(dist, 0.5);
      }`,
    fragmentShader: /* glsl */`
      uniform float uNight; varying float vA; varying float vK; varying float vLife;
      void main(){
        vec2 q = gl_PointCoord - 0.5; float r = length(q);
        float a = vK < 0.5 ? smoothstep(0.5, 0.38, r) * smoothstep(0.18, 0.34, r) * 0.6 : smoothstep(0.5, 0.15, length(q * vec2(2.2, 0.7)));
        gl_FragColor = vec4(mix(vec3(0.75, 0.8, 0.9), vec3(0.95, 0.9, 0.8), uNight * 0.5), a * vA * 0.55);
      }`,
  }));
  splash.frustumCulled = false; splash.visible = false; splash.renderOrder = 6;
  scene.add(splash);
  let dripT = 0;
  // where the drips fall from: the shop awnings' front edges, the bus shelter roofs, nearest the camera
  function placeDrips() {
    const c = camera.position, out = [];
    const near = (env.dripSpots || []).filter((d) => Math.abs(d[0] - c.x) < 22 && Math.abs(d[2] - c.z) < 22);
    near.sort((a, b) => Math.hypot(a[0] - c.x, a[2] - c.z) - Math.hypot(b[0] - c.x, b[2] - c.z));
    for (let i = 0; i < ND; i++) {
      const d = near[i % Math.max(1, Math.min(near.length, 12))], o = (NS + i) * 3;
      if (!d) { sp[o + 1] = 0; continue; }
      sp[o] = d[0] + (Math.random() - 0.5) * d[3]; sp[o + 1] = d[1]; sp[o + 2] = d[2] + (Math.random() - 0.5) * d[4];
    }
    sgeo.attributes.position.needsUpdate = true;
  }
  // the rain streaks glow round the nearest lamps
  let lampT = 0;
  function nearLamps() {
    const c = camera.position, L = env.lampList || [];
    const best = [];
    for (const l of L) { if (l.dead) continue; const d = Math.abs(l.x - c.x) + Math.abs(l.z - c.z); if (d > 60) continue; best.push([d, l]); }
    best.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < LN; i++) { const l = best[i] && best[i][1]; if (l) lightPos[i].set(l.x + Math.sin(l.yaw) * 1.45, 5.6, l.z + Math.cos(l.yaw) * 1.45); else lightPos[i].set(0, -999, 0); }
  }

  const outL = { hc: new THREE.Color(), hg: new THREE.Color(), hi: 1, si: 1 };
  const env = {
    hemi, rain, splash, lightPos,
    tod: 19, day: 1, target: null, ffRate: null, viewFog: 1, speed: 1, indoor: false, roomLit: false, flash: 0, cur,
    glare: 0, weather: 'clear', w: { cloud: 0.12, rain: 0, bolt: 0, fog: 0 }, wxTimer: 2.5, wet: 0,
    nextBolt: 4, pendingThunder: -1, phase: 'DUSK',
    // the rainbow: armed by a real shower, it shows once the rain has stopped and the clouds thin with the sun up
    // and lower than the bow's 42 degrees; fades in over ~10 s, stays a few minutes, fades out. bow.force: debug
    bow: { k: 0, armed: false, life: 0, force: false, shown: 0 },
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
        adv = dt * (env.ffRate ? env.ffRate(d) : 7);      // ffRate: a gentler fast-forward (waiting on the Solstice Terrace)
        if (d <= adv) { adv = d; env.target = null; }
      }
      // the day number (the night's fireworks go by it, world/fireworks.js): up by one each time the clock passes midnight
      if (env.tod + adv >= 24) env.day++;
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
      // the ground soaks up quickly and dries slowly (about a minute and a half), the puddles last
      if (w.rain > 0.05) env.wet = Math.min(1, env.wet + dt * w.rain / 5); else env.wet = Math.max(0, env.wet - dt / 90);
      wetU.value = env.wet; rainU.value = env.indoor ? 0 : w.rain;

      const cover = w.cloud * 0.5 + w.rain * 0.3;
      if (cover > 0.01) {
        tmp.copy(STORM).lerp(OVERCAST, dayK * (1 - w.rain * 0.7));
        for (const key of ['top', 'mid', 'hor']) cur[key].lerp(tmp, cover);
        cur.sunI *= 1 - w.cloud * 0.35 - w.rain * 0.3; cur.stars *= 1 - w.cloud; cur.glow.multiplyScalar(1 - cover * 0.8);
        cur.fogNear = lerp(cur.fogNear, 30, w.rain); cur.fogFar = lerp(cur.fogFar, 300, w.rain);
      }
      // low sun: how much the sunset is shining straight at the camera's side of the world (0 by night / overcast)
      // the sky stays bright from late afternoon until well after the sun dips (afterglow), so this fades out only
      // once the sun is ~7 degrees below the horizon (about 21:00), not at sunset itself
      const sl = clamp((sunDir.y + 0.13) / 0.2, 0, 1);
      // ...and follow the horizon's own brightness too, so the glow waits until the afterglow has actually faded
      const hL = cur.hor.r * 0.299 + cur.hor.g * 0.587 + cur.hor.b * 0.114;
      const skyK = clamp((hL - HOR_NIGHT) / (HOR_DUSK - HOR_NIGHT), 0, 1);
      const sunLow = Math.max(sl * sl * (3 - 2 * sl), skyK * skyK) * (1 - clamp((sunDir.y - 0.5) / 0.25, 0, 1));
      env.glare = sunLow * (1 - Math.max(w.fog, w.cloud * 0.85)); glareU.value = env.glare;
      scene.fog.color.copy(cur.hor).lerp(cur.mid, 0.25 + 0.2 * env.glare).multiplyScalar(1 - 0.32 * env.glare);
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
          // sound travels ~343 m/s: a strike 100 m to 3.5 km away rumbles in 0.3 to 10 s later
          env.boltDist = Math.random(); env.pendingThunder = 0.3 + env.boltDist * env.boltDist * 9.7; env.bolts = (env.bolts || 0) + 1; env.lastBolt = timeU.value;
        }
      }
      if (env.pendingThunder >= 0) { env.pendingThunder -= dt; if (env.pendingThunder < 0) { audio.thunder(env.boltDist ?? 0.5); env.thunderLag = timeU.value - env.lastBolt; } }
      // flicker: a second, weaker pulse shortly after the first
      env.flash = Math.max(0, env.flash - dt * 2.6);
      const fl = reducedMotion || env.indoor ? 0 : env.flash * (0.55 + 0.45 * Math.sin(env.flash * 22));
      rain.visible = w.rain > 0.02 && !env.indoor; rainU_.uAmt.value = w.rain; rainU_.uCam.value.copy(camera.position);
      splash.visible = rain.visible && camera.position.y < 14; splU.uAmt.value = w.rain;
      if (splash.visible) { dripT -= dt; if (dripT <= 0) { dripT = 0.5; placeDrips(); } }
      if (rain.visible) { lampT -= dt; if (lampT <= 0) { lampT = 0.4; nearLamps(); } }

      const su = sky.uniforms, ou = ocean.uniforms, veil = Math.max(w.fog, w.cloud * 0.85);
      su.uTop.value.copy(cur.top); su.uMid.value.copy(cur.mid); su.uHor.value.copy(cur.hor);
      su.uSunA.value.copy(cur.sunA); su.uSunB.value.copy(cur.sunB); su.uGlow.value.copy(cur.glow);
      su.uSunDir.value.copy(sunDir); su.uMoonDir.value.copy(moonDir); su.uSunSize.value = cur.size; su.uStripe.value = cur.stripe;
      { const B = env.bow, alt = Math.asin(clamp(sunDir.y, -1, 1)) * 180 / Math.PI, LIFE = 150;
        if (w.rain > 0.3) { B.armed = true; B.dry = 0; }
        const sky = alt > 2 && alt < 41 && w.fog < 0.3 && w.cloud < 0.75 && !env.indoor;
        if (B.armed && w.rain < 0.08) { B.dry = (B.dry || 0) + dt; if (B.dry > 60) B.armed = false; }   // no sun for it in time: gone
        if (!B.on && (B.force || (B.armed && w.rain < 0.08 && sky))) { B.on = true; B.armed = false; B.life = 0; B.shown++; }
        if (B.on) { B.life += dt; if (B.life > LIFE + 30 || (w.rain > 0.3 && !B.force)) { B.on = false; B.force = false; } }
        const want = B.on && B.life < LIFE && sky ? (1 - w.cloud * 0.5) * (1 - w.fog) * (1 - clamp(w.rain * 4, 0, 0.8)) : 0;
        B.k = damp(B.k, want, want > B.k ? 0.3 : 0.18, dt);
        su.uBow.value = B.k * clamp((alt - 2) / 4, 0, 1) * clamp((41 - alt) / 3, 0, 1); B.alt = +alt.toFixed(1); }
      su.uStars.value = cur.stars; su.uFlash.value = fl * 0.5; su.uCloud.value = w.cloud * (1 - w.fog * 0.7); su.uVeil.value = veil;
      sky.mesh.position.copy(camera.position);
      ocean.mesh.position.set(Math.round(camera.position.x / 40) * 40, ocean.mesh.position.y, Math.round(camera.position.z / 40) * 40);
      const sunUp = sunDir.y > 0.03, lightDir = sunUp ? sunDir : moonDir;
      ou.uDeep.value.copy(cur.deep).lerp(STORM, cover * 0.6); ou.uShallow.value.copy(cur.shallow).lerp(STORM, cover * 0.5);
      ou.uSky.value.copy(cur.hor); ou.uSunCol.value.copy(cur.glow).multiplyScalar((sunUp ? 1 : 0.25) * (1 - veil));
      ou.uSunDir.value.copy(lightDir);

      // low sun: push the haze back so the beach and the far shore stay crisp instead of washing out
      cur.fogNear *= 1 + 0.9 * env.glare; cur.fogFar *= 1 + 0.35 * env.glare; cur.sunI *= 1 - 0.18 * env.glare;
      // high up (the Solstice Terrace) the haze is pushed back so both districts, the causeway and the sea read
      env.viewFog = damp(env.viewFog, VIEW.fog, 1.5, dt);
      if (env.viewFog > 1.001) { cur.fogNear *= env.viewFog; cur.fogFar *= env.viewFog; }
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
      // indoors the courier is lit by the room, not the sky. A home with a view (env.roomLit: the town is drawn
      // through its windows first, main.js) keeps the outdoor values for that pass: lightPass(true / false)
      outL.hc.copy(hemi.color); outL.hg.copy(hemi.groundColor); outL.hi = hemi.intensity; outL.si = sun.intensity;
      if (env.indoor || env.roomLit) { hemi.color.set(0xfff0f6); hemi.groundColor.set(0xb090d0); hemi.intensity = 2.1; sun.intensity = 0.5; }
      if (env.indoor) { scene.fog.near = 400; scene.fog.far = 900; }
    },
    lightPass(out) {
      if (out) { hemi.color.copy(outL.hc); hemi.groundColor.copy(outL.hg); hemi.intensity = outL.hi; sun.intensity = outL.si; }
      else { hemi.color.set(0xfff0f6); hemi.groundColor.set(0xb090d0); hemi.intensity = 2.1; sun.intensity = 0.5; }
    },
  };
  return env;
}
