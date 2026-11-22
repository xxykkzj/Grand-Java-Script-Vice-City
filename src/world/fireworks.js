// Distant fireworks over the bay: every third night (by the in-game day number, environment.js env.day) a show
// goes up far out over the water in front of the mainland skyline, about 640 m north of the penthouse tower and
// 750 m from the Solstice Terrace. It starts at 21:00 and runs for about a minute and a quarter of real time:
// peonies, chrysanthemums with gold tails, drooping willows, tilted rings, crackling glitter, strobes, and a
// finale. If you are in the Skyline Penthouse or up on the Solstice Terrace on a show night and missed it, one
// goes up for you anyway (once a night).
//
// Cheap by design: one pool of GPU points (4096 on High, 1536 on Low). The CPU only writes a shell's stars into
// the pool once, when it is fired (a burst origin, a velocity, a start time, a life, a drag and a gravity); every
// position after that is worked out in the vertex shader from the show clock, so nothing is touched per frame
// but one uniform. Trails are lagged copies of the same star. A second draw of the same geometry mirrors the
// show in the sea: each star is reflected below the water line and then slid along the view ray back up onto
// the surface (so land and the town still hide it, and it never sinks under the ocean plane), dimmed and
// shimmering. Both meshes are hidden when no show is on: zero draw calls the rest of the time.
//
// The booms arrive late, by distance (sound at 343 m/s: about two seconds), soft and low; indoors they are
// faint thumps, and through the penthouse glass they are muffled.
import * as THREE from 'three';
import { pointScaleU, reducedMotion, rng, clamp } from '../core/util.js';
import { quality } from '../core/quality.js';

export const FW = { x: -440, z: -760, every: 3, offset: 2, start: 21, window: 0.25, late: 3.5, dur: 76 };
// the night that tod belongs to: the evening of day d runs on past midnight into the small hours of day d + 1
export const nightOf = (day, tod) => (tod < 12 ? day - 1 : day);
export const showNight = (n) => n >= 1 && n % FW.every === FW.offset;
const inNight = (tod) => tod >= FW.start || tod < FW.late;

const PAL = [['#ff3f6a', '#ffd0dc'], ['#3fd8ff', '#d8f8ff'], ['#ffd447', '#fff3c0'], ['#8dff5a', '#e0ffd0'], ['#b388ff', '#eee0ff'], ['#ff8a3d', '#ffe0c0'], ['#ff5fe0', '#ffd8f6'], ['#ffffff', '#fff6dc']];
const GOLD = '#ffc860', SILVER = '#e8f0ff';

export function createFireworks(game, scene) {
  // the pool is sized once, by the Graphics setting at load (shells fit the pool they have, whatever it is later)
  const HI = quality.high, N = HI ? 4096 : 1536;
  const geo = new THREE.BufferGeometry();
  const A = {
    aP0: new Float32Array(N * 3), aV: new Float32Array(N * 3), aC: new Float32Array(N * 3), aT: new Float32Array(N * 4), aK: new Float32Array(N * 4),
  };
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  for (const k in A) { const it = k === 'aT' || k === 'aK' ? 4 : 3; const b = new THREE.BufferAttribute(A[k], it); b.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, b); }
  // every slot starts dead (a start time far in the future)
  for (let i = 0; i < N; i++) { A.aT[i * 4] = 1e9; A.aT[i * 4 + 1] = 0.01; }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(FW.x, 120, FW.z), 1e5);
  const U = { uTime: { value: 0 }, uScale: pointScaleU, uHaze: { value: 1 }, uSea: { value: -0.6 }, uRefl: { value: 0 } };
  const VERT = /* glsl */`
    attribute vec3 aP0, aV, aC; attribute vec4 aT, aK;
    uniform float uTime, uScale, uHaze, uSea, uRefl;
    varying vec3 vC; varying float vA;
    float h1(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      float t = uTime - aT.x - aT.z, life = aT.y;
      if (t < 0.0 || t > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
      float k = aK.x, g = aK.y, mode = aK.w, u = t / life;
      float e = (1.0 - exp(-k * t)) / k;
      vec3 p = aP0 + aV * e;
      p.y -= g / k * (t - e);
      // brightness over the star's life: a hot white flash at the break, then its colour, fading out
      float b = 1.0 - u * u;
      vec3 col = mix(vec3(1.0, 0.97, 0.9), aC, smoothstep(0.0, 0.16, u));
      if (mode > 3.5) { b = pow(1.0 - u, 3.0); col = aC; }                                     // the break flash
      else if (mode > 2.5) { b = 0.75 * (1.0 - u * 0.5); col = aC; }                            // a rising shell
      else if (mode > 1.5) { float f = step(0.55, h1(aT.w * 91.7 + floor(uTime * 22.0) * 7.31)); b *= u < 0.35 ? 1.0 : 0.25 + 1.4 * f; }   // crackle / glitter / strobe
      else if (mode > 0.5) { b *= 0.9 + 0.1 * sin(uTime * 30.0 + aT.w * 50.0); }               // willow sparkle
      float sz = aK.z;
      if (uRefl > 0.5) {
        // the sea: mirror below the water line, then slide along the view ray back up onto the surface
        p.y = 2.0 * uSea - p.y;
        vec3 d = p - cameraPosition;
        if (d.y > -0.001 || cameraPosition.y < uSea + 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
        float s = (uSea + 0.35 - cameraPosition.y) / d.y;
        p = cameraPosition + d * s;
        p.x += sin(uTime * 1.7 + aT.w * 37.0) * 4.0 * s; p.z += cos(uTime * 1.3 + aT.w * 23.0) * 2.0 * s;
        sz *= s * 1.6;
        b *= 0.2 * (0.6 + 0.4 * sin(uTime * 5.0 + aT.w * 61.0 + p.x * 0.3));
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float px = sz * uScale / max(-mv.z, 1.0), ps = clamp(px, 1.6, 48.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = ps;
      vC = col;
      vA = b * uHaze * min(1.0, px / ps);
    }`;
  const FRAG = /* glsl */`
    varying vec3 vC; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0, a = max(1.0 - d, 0.0);
      gl_FragColor = vec4(vC * vA * a * a * (0.8 + 1.2 * a * a), 1.0);
    }`;
  const mk = (refl) => {
    const m = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { ...U, uRefl: { value: refl ? 1 : 0 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    m.frustumCulled = false; m.renderOrder = refl ? 6 : 7; m.visible = false;
    scene.add(m);
    return m;
  };
  const sky = mk(false), sea = mk(true);

  // ---- writing stars into the pool --------------------------------------------------------------------------
  let cur = 0, lo = N, hi = -1, wrapped = false;
  const tc = new THREE.Color();
  function star(px, py, pz, vx, vy, vz, hex, t0, life, k, g, size, mode, lag = 0, dim = 1) {
    const i = cur; cur = (cur + 1) % N; if (cur === 0) wrapped = true;
    if (i < lo) lo = i; if (i > hi) hi = i;
    A.aP0[i * 3] = px; A.aP0[i * 3 + 1] = py; A.aP0[i * 3 + 2] = pz;
    A.aV[i * 3] = vx; A.aV[i * 3 + 1] = vy; A.aV[i * 3 + 2] = vz;
    tc.set(hex).multiplyScalar(dim); A.aC[i * 3] = tc.r; A.aC[i * 3 + 1] = tc.g; A.aC[i * 3 + 2] = tc.b;
    A.aT[i * 4] = t0; A.aT[i * 4 + 1] = life; A.aT[i * 4 + 2] = lag; A.aT[i * 4 + 3] = Math.random() * 100;
    A.aK[i * 4] = k; A.aK[i * 4 + 1] = g; A.aK[i * 4 + 2] = size; A.aK[i * 4 + 3] = mode;
  }
  function flush() {
    if (hi < 0) return;
    for (const k in A) {
      const at = geo.attributes[k], it = at.itemSize;
      at.clearUpdateRanges();
      if (!wrapped) at.addUpdateRange(lo * it, (hi - lo + 1) * it);
      at.needsUpdate = true;
    }
    lo = N; hi = -1; wrapped = false;
  }

  // ---- the shells -----------------------------------------------------------------------------------------------
  const S = { on: false, t: 0, prog: [], pi: 0, booms: [], n: 0, kind: null, played: -1, seen: -1, guaranteed: -1, forced: false, shells: 0, prevTod: null, stats: { shows: 0, shells: 0, booms: 0, toasts: 0 }, last: null };
  const R = rng(7);
  const lowK = () => (HI ? 1 : 0.55);
  // a shell: rises from the barge line for `rise` seconds, then breaks at (x, y, z)
  function shell(type, at, x, y, z, pal, size = 1) {
    const q = lowK(), rise = 1.5 + R() * 0.5, tb = at + rise;
    const bx = x + (R() - 0.5) * 6, bz = z + (R() - 0.5) * 6;
    // the rising comet: a dim gold star with a short tail, from the water up to the break
    const ry = y - 1;
    for (let j = 0; j < (HI ? 4 : 2); j++) star(bx, 1, bz, (x - bx) / rise, ry / rise * 1.04, (z - bz) / rise, GOLD, at, rise, 0.0001, 0, 3.6 - j * 0.5, 3, j * 0.06, 0.65 - j * 0.14);
    const [c0, c1] = pal, sp = (type === 'willow' ? 110 : type === 'ring' ? 125 : 140) * size;
    const n = Math.round((type === 'ring' ? 56 : type === 'willow' ? 70 : type === 'crackle' ? 84 : 96) * q * size);
    // the break flash
    star(x, y, z, 0, 0, 0, '#fff6e6', tb, 0.35, 1, 0, 60 * size, 4);
    let tilt = null;
    if (type === 'ring') { const a = R() * Math.PI, b = (R() - 0.5) * 1.6; tilt = [Math.cos(a), Math.sin(a), Math.sin(b), Math.cos(b)]; }
    for (let i = 0; i < n; i++) {
      let dx, dy, dz;
      if (tilt) {
        // a flat ring in a tilted plane: e1 level, e2 square to it (both unit length)
        const th = (i / n) * Math.PI * 2, [ca, sa, sb, cb] = tilt, c = Math.cos(th), s2 = Math.sin(th);
        dx = c * ca - s2 * sa * sb; dy = s2 * cb; dz = c * sa + s2 * ca * sb;
      } else {
        // an even sphere (a golden spiral), a touch of jitter
        const yy = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996 + R() * 0.2;
        dx = Math.cos(a) * rr; dy = yy; dz = Math.sin(a) * rr;
      }
      const v = sp * (0.92 + R() * 0.12);
      const vx = dx * v, vy = dy * v + 6, vz = dz * v;
      const hex = i % 4 === 0 ? c1 : c0;
      if (type === 'peony') star(x, y, z, vx, vy, vz, hex, tb, 2.0 + R() * 0.5, 1.7, 7, 7.5 * size, 0);
      else if (type === 'chrys') {
        // a chrysanthemum: the coloured head with a gold tail of lagged sparks
        star(x, y, z, vx, vy, vz, hex, tb, 2.4 + R() * 0.4, 1.6, 8, 7.0 * size, 0);
        const tails = HI ? 3 : 1;
        for (let j = 1; j <= tails; j++) star(x, y, z, vx, vy, vz, GOLD, tb, 2.2, 1.6, 8, 5.0 - j * 0.6, 1, j * 0.09, 0.62 - j * 0.12);
      } else if (type === 'willow') {
        // a willow: slow gold stars that hang and droop, long glittering trails
        star(x, y, z, vx, vy * 0.8, vz, GOLD, tb, 4.6 + R() * 0.8, 2.2, 14, 6.5 * size, 1);
        const tails = HI ? 3 : 1;
        for (let j = 1; j <= tails; j++) star(x, y, z, vx, vy * 0.8, vz, '#ffb040', tb, 4.4, 2.2, 14, 4.8, 1, j * 0.22, 0.55 - j * 0.12);
      } else if (type === 'ring') star(x, y, z, vx, vy - 6, vz, hex, tb, 2.1 + R() * 0.3, 1.8, 6, 7.5 * size, 0);
      else if (type === 'crackle') star(x, y, z, vx * 0.85, vy * 0.85, vz * 0.85, i % 3 ? SILVER : hex, tb, 2.6 + R() * 0.6, 1.9, 7, 6.0 * size, 2);
      else if (type === 'strobe') star(x, y, z, vx * 0.7, vy * 0.7, vz * 0.7, '#ffffff', tb, 2.8 + R() * 0.4, 2.0, 5, 5.5 * size, 2);
    }
    // a crackle shell pops a second cloud of glitter late in its life
    if (type === 'crackle') for (let i = 0; i < Math.round(30 * q); i++) {
      const a = R() * 6.283, e = R() * 2 - 1, k = Math.sqrt(1 - e * e), v = 30 + R() * 25;
      star(x + (R() - 0.5) * 30, y - 10 + (R() - 0.5) * 20, z + (R() - 0.5) * 30, Math.cos(a) * k * v, e * v, Math.sin(a) * k * v, '#fffbe8', tb + 1.1 + R() * 0.6, 0.6 + R() * 0.4, 3, 6, 4.0, 2);
    }
    S.booms.push({ at: tb, k: (type === 'willow' ? 0.8 : 1) * Math.min(1.3, size), crackle: type === 'crackle' || type === 'strobe' });
    S.stats.shells++;
  }

  // a show's running order: openers, a middle with doubles and triples, a quiet beat, then the finale
  function program(dur) {
    const P = [], TYPES = ['peony', 'chrys', 'peony', 'ring', 'willow', 'crackle', 'chrys', 'strobe'];
    const pick = () => TYPES[Math.floor(R() * TYPES.length)], pal = () => PAL[Math.floor(R() * PAL.length)];
    const pos = (spread = 1) => [FW.x + (R() - 0.5) * 260 * spread, 130 + R() * 100, FW.z + (R() - 0.5) * 60];
    let t = 0.5;
    const fin = dur - 16;
    while (t < fin) {
      const n = R() < 0.25 ? (R() < 0.4 ? 3 : 2) : 1, ty = pick(), c = pal();
      for (let i = 0; i < n; i++) { const [x, y, z] = pos(); P.push({ at: t + i * 0.12, ty: n > 1 && i ? ty : ty, x, y, z, pal: n > 1 && R() < 0.5 ? c : pal(), size: 0.9 + R() * 0.3 }); }
      t += 1.0 + R() * 1.6 + (R() < 0.08 ? 2.5 : 0);
    }
    // the finale: a fast barrage, a crackle salvo, then three big gold willows hanging over it all
    t = fin + 1.5;
    while (t < dur - 6) { const [x, y, z] = pos(1.2); P.push({ at: t, ty: R() < 0.5 ? 'peony' : R() < 0.6 ? 'chrys' : 'ring', x, y, z, pal: pal(), size: 0.9 + R() * 0.3 }); t += 0.22 + R() * 0.25; }
    for (let i = 0; i < 4; i++) { const [x, y, z] = pos(1.1); P.push({ at: dur - 6 + i * 0.15, ty: 'crackle', x, y, z, pal: PAL[7], size: 1.1 }); }
    for (let i = 0; i < 3; i++) P.push({ at: dur - 4.6 + i * 0.25, ty: 'willow', x: FW.x + (i - 1) * 90, y: 200 + R() * 20, z: FW.z, pal: PAL[2], size: 1.35 });
    return P;
  }

  // ---- where you are: can you see the bay from here, how loud is it ---------------------------------------------
  const where = () => {
    const p = game.inside;
    if (p) return p.key === 'penthouse' ? 'glass' : 'indoors';
    return 'out';
  };
  const eye = () => {
    const p = game.inside, r = p && p.room, c = game.camera.position;
    if (r && r.view && !r.view.sky) return [c.x - r.ox + r.view.x, r.view.y + 1.6, c.z - r.oz + r.view.z];
    return [c.x, c.y, c.z];
  };

  function start(why = 'scheduled') {
    S.on = true; S.t = 0; S.pi = 0; S.booms.length = 0; S.kind = why; S.n++; S.stats.shows++;
    S.prog = program(FW.dur);
    sky.visible = sea.visible = true;
    const w = where();
    if (w !== 'indoors' && !(game.busy === 'cut')) { game.hud.toast('FIREWORKS OVER THE BAY TONIGHT', w === 'glass' ? 'LOOK NORTH THROUGH THE GLASS, ACROSS THE WATER' : 'LOOK NORTH, OUT OVER THE WATER'); S.stats.toasts++; }
    S.last = { at: +game.env.tod.toFixed(2), day: game.env.day, why };
  }
  function stop() {
    S.on = false; sky.visible = sea.visible = false;
    for (let i = 0; i < N; i++) A.aT[i * 4] = 1e9;
    lo = 0; hi = N - 1; wrapped = true; flush();
  }

  const api = {
    S, FW,
    get on() { return S.on; },
    start,
    stop,
    // jump the show clock to t (automated checks: software GL runs at a couple of frames a second); shells long gone are skipped
    seek(t) { if (!S.on) return null; while (S.pi < S.prog.length && S.prog[S.pi].at < t - 5) S.pi++; S.t = t; return api.state(); },
    // which of the next `days` nights get a show, from night `from` (debug / checks)
    schedule(from = 1, days = 9) { const o = []; for (let n = from; n < from + days; n++) o.push({ night: n, show: showNight(n) }); return o; },
    state() { return { on: S.on, t: +S.t.toFixed(1), kind: S.kind, shells: S.stats.shells, left: S.on ? S.prog.length - S.pi : 0, played: S.played, seen: S.seen, day: game.env.day, night: nightOf(game.env.day, game.env.tod), tonight: showNight(nightOf(game.env.day, game.env.tod)), where: where(), haze: +U.uHaze.value.toFixed(2), stats: { ...S.stats }, last: S.last, pool: N }; },
    update(dt) {
      const env = game.env, tod = env.tod, n = nightOf(env.day || 1, tod), prev = S.prevTod ?? tod;
      S.prevTod = tod;
      if (game.started && !S.on && showNight(n) && env.weather !== 'storm') {
        // 21:00 sharp (or the clock running past it while you wait or sleep through)
        const crossed = (prev < FW.start && tod >= FW.start) || (tod >= FW.start && tod < FW.start + FW.window);
        if (S.played !== n && crossed) { S.played = n; start('scheduled'); }
        // in the penthouse or up on the terrace on a show night, and you have not seen it: one goes up for you
        else if (S.seen !== n && S.guaranteed !== n && inNight(tod) && ((game.inside && game.inside.key === 'penthouse') || (game.spire && game.spire.on))) { S.played = n; S.guaranteed = n; start('guaranteed'); }
      }
      if (!S.on) return;
      S.t += dt;
      // fire the shells due this frame (their stars are written once and then run on the GPU)
      while (S.pi < S.prog.length && S.prog[S.pi].at <= S.t + 0.05) {
        const s = S.prog[S.pi++];
        shell(s.ty, s.at, s.x, s.y, s.z, s.pal, s.size);
      }
      flush();
      U.uTime.value = S.t; sky.material.uniforms.uTime.value = S.t; sea.material.uniforms.uTime.value = S.t;
      // fog and rain veil them; a clear night shows them crisp (they are not fogged like the town: far too far)
      const w = env.w, hz = clamp(1 - w.fog * 0.85 - w.rain * 0.35 - w.cloud * 0.1, 0.08, 1);
      sky.material.uniforms.uHaze.value = sea.material.uniforms.uHaze.value = U.uHaze.value = hz * (reducedMotion ? 0.8 : 1);
      const wh = where();
      if (wh !== 'indoors' && game.busy !== 'cut') S.seen = n;
      // the booms: sound takes its time over the water
      if (S.booms.length) {
        const [ex, ey, ez] = eye(), audio = game.audio;
        for (let i = S.booms.length - 1; i >= 0; i--) {
          const b = S.booms[i], d = Math.hypot(ex - FW.x, ey - 150, ez - FW.z), lag = d / 343;
          if (S.t < b.at + lag) continue;
          S.booms.splice(i, 1);
          const k = b.k * clamp(260 / d, 0.12, 0.8) * (wh === 'glass' ? 0.55 : wh === 'indoors' ? 0.18 : 1);
          if (audio.fwBoom) audio.fwBoom(k, wh === 'out' ? 0 : wh === 'glass' ? 0.7 : 1, b.crackle);
          S.stats.booms++;
        }
      }
      if (S.t > FW.dur + 6) stop();
    },
  };
  return api;
}
