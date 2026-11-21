// Starlight Pier as a place to be (world/pier.js builds it): the Starlight Wheel ride, Sugar Tide's counter,
// the pier crowd by the clock and the weather, its own carnival theme that fades in as you come near.
//   - E at the boarding platform (touch: RIDE): $5, a short walk-on scene (X skips it), then one slow revolution
//     (~75 s) with the camera in the gondola looking out over the beach, the old town, the bay, the causeway and
//     Solano Key; a pause at the top. Drag to look round. 1 / 2: wait for the sunset / the night (the gondola
//     holds at the top until it is time). E / F steps out at the bottom; X skips the ride (you land on the platform).
//   - while riding, the view reaches further (core/util.js VIEW, the Solstice Terrace's boost).
//   - E at Sugar Tide: candy floss, popcorn, a corn dog, pink lemonade (game/eat.js).
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, PI, reducedMotion, timeU, unseen, VIEW } from '../core/util.js';
import { ease } from './cutscene.js';
import { kit, blockyMaterial, instExtras, crowdAtlas, mergeParts, CROWD_FACE_N } from '../actors/blocky.js';
import { newPose, sitPose } from '../actors/moves.js';
import { quality } from '../core/quality.js';
import { setDeckLight } from '../world/lamplight.js';
import { APIER, WHEEL, BOARD, CANDY_SPOT, CAROUSEL, BOOTHS, BOOTH_X, FISH_SPOTS, PHOTO, createPierFx } from '../world/pier.js';

export const TICKET = 5;
const SUNSET = 19.5, NIGHT = 22;
const UP_S = 34, TOP_S = 6, DOWN_S = 34, RIDE_S = UP_S + TOP_S + DOWN_S;
// how many people are on the pier at hour h: families by day, busiest in the evening, a few late, empty in a storm
export function pierCrowd(h, weather, rain = 0) {
  if (weather === 'storm' || rain > 0.8) return 0;
  if (weather === 'rain' || rain > 0.25) return 2;                 // two hardy anglers in slickers
  const n = h < 1.5 ? 8 : h < 5 ? 1 : h < 9 ? 4 : h < 17 ? 16 : h < 23 ? 26 : 9;
  return weather === 'fog' ? Math.ceil(n / 2) : n;
}
const opens = (h) => h >= 9 || h < 2;              // the rides run 9:00 to 2:00
const standOpen = (h) => h >= 10 || h < 0.5;

export function createPier(game, scene) {
  const { L, player, hud, audio, env, cam, cut, camera, input } = game;
  const fx = createPierFx(scene, L);
  // the bulbs and lamps over the deck light the people on it, out over the sea too (world/lamplight.js)
  setDeckLight(1, APIER.x0, APIER.z0, APIER.x1, APIER.z1, 0, '#ffd0a0', 0.28);
  const W = WHEEL, N = W.N;
  const stats = { pushes: 0, rides: 0, revs: 0, skips: 0, exits: 0, boards: 0, tickets: 0, waits: 0, food: 0, topPause: 0 };
  const S = { phase: null, k: 0, t: 0, base: 0, wait: null, look: { yaw: 0, pitch: 0, idle: 0 }, music: 0, near: false, held: 0, topT: 0, toastT: 0 };

  // ---------------------------------------------------------------- the crowd (refined blocks, instanced: 4 draw calls)
  const spots = [];
  const sp = (x, z, yaw, kind, o = {}) => spots.push({ x, z, yaw, kind, ...o });
  for (const [x, z] of FISH_SPOTS) sp(x, z, 0, 'fish', { pri: 0 });
  const seats = (L.pierSeats || []).filter((s, i) => i % 2 === 0);
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const ring = (cx, cz, r, n, a0, kid) => { for (let i = 0; i < n; i++) { const a = a0 + i * 0.55; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; sp(x, z, face(x, z, cx, cz), 'stand', { kid: kid && i % 2 === 1 }); } };
  // people in the order they turn up (a few of the spots are for kids, by day only)
  sp(272, 189.6, 0, 'stand', { queue: 1 }); sp(272.4, 188.4, 0, 'stand', { kid: true }); sp(271.6, 187.2, 0, 'stand');
  ring(CAROUSEL.x, CAROUSEL.z, 7.3, 3, 0.2, true);
  for (const b of BOOTHS) { sp(BOOTH_X + 2.6, b.z - 0.6, -PI / 2, 'stand'); sp(BOOTH_X + 2.9, b.z + 0.9, -PI / 2, 'stand', { kid: true }); }
  sp(CANDY_SPOT.x - 1.2, CANDY_SPOT.z + 0.5, PI / 2, 'stand'); sp(CANDY_SPOT.x - 2.2, CANDY_SPOT.z - 0.3, PI / 2, 'stand', { kid: true });
  for (const s of seats) sp(s.x, s.z, s.yaw, 'sit', { seat: s, y: s.y });
  sp(PHOTO.x, PHOTO.z - 3.2, 0, 'stand', { photo: true });
  sp(292.6, 192, PI / 2, 'lean'); sp(292.6, 199, PI / 2, 'lean'); sp(251.4, 192, -PI / 2, 'lean');
  ring(CAROUSEL.x, CAROUSEL.z, 7.6, 3, 2.4, false);
  // strollers: up one side of the promenade and down the other
  const LOOP = [[269.5, 110], [269.5, 184], [274.5, 184], [274.5, 110]];
  const loopLen = 2 * (74 + 5);
  for (let i = 0; i < 6; i++) sp(0, 0, 0, 'walk', { s: i * loopLen / 6 + (i % 2) * 7, v: 0.95 + (i % 3) * 0.15, kid: i === 2 || i === 5 });
  const NG = spots.length;
  const CA = crowdAtlas(), CK = kit(CA), WH = '#ffffff', P0 = { b: 0 };
  const cMat = blockyMaterial({ atlas: CA, inst: true }), cHead = blockyMaterial({ atlas: CA, inst: true, face: true });
  const mk = (geo, n, m = cMat) => { const o = new THREE.InstancedMesh(geo, m, n); o.frustumCulled = false; scene.add(o); return o; };
  const torso = mk(mergeParts([CK.B(0.4, 0.17, 0.25, 0, 0.93, 0, WH, 'denim', { alt: 1 }), CK.B(0.41, 0.035, 0.258, 0, 1.02, 0, '#3a3440', 'leather', { alt: 3, b: 0 }),
    CK.B(0.42, 0.2, 0.25, 0, 1.12, 0, WH, 'weave'), CK.B(0.45, 0.25, 0.27, 0, 1.33, 0, WH, 'weave'), CK.B(0.12, 0.09, 0.26, 0.215, 1.45, 0, WH, 'seam', P0), CK.B(0.12, 0.09, 0.26, -0.215, 1.45, 0, WH, 'seam', P0),
    CK.B(0.24, 0.045, 0.2, 0, 1.475, 0, WH, 'rib', { alt: 2, b: 0 })]), NG);
  const head = mk(mergeParts([CK.B(0.1, 0.08, 0.1, 0, 0, 0, WH, 'plain', P0), CK.B(0.27, 0.28, 0.26, 0, 0.17, 0, WH, 'plain', { b: 0.018 }), CK.face(0.234, 0.244, 0, 0.17, 0.1305, WH),
    CK.B(0.032, 0.036, 0.022, 0, 0.135, 0.139, '#e2e2e2', 'plain', P0), CK.B(0.026, 0.06, 0.05, 0.145, 0.16, 0, '#dcdcdc', 'plain', P0), CK.B(0.026, 0.06, 0.05, -0.145, 0.16, 0, '#dcdcdc', 'plain', P0),
    CK.B(0.285, 0.07, 0.275, 0, 0.3, -0.005, WH, 'hair', { alt: 1 }), CK.B(0.285, 0.2, 0.07, 0, 0.2, -0.11, WH, 'hair', { alt: 1, b: 0 })]), NG, cHead);
  const arms = mk(mergeParts([CK.B(0.12, 0.24, 0.13, 0, -0.11, 0, WH, 'weave'), CK.B(0.105, 0.04, 0.115, 0, -0.25, 0, WH, 'plain', { alt: 1, b: 0 }),
    CK.B(0.112, 0.17, 0.122, 0, -0.35, 0, WH, 'weave', { alt: 1 }), CK.B(0.085, 0.08, 0.09, 0, -0.475, 0, WH, 'plain', { alt: 2, b: 0 })]), NG * 2);
  const legs = mk(mergeParts([CK.B(0.15, 0.4, 0.17, 0, -0.2, 0, WH, 'denim'), CK.B(0.135, 0.05, 0.155, 0, -0.42, 0, WH, 'plain', { alt: 1, b: 0 }),
    CK.B(0.14, 0.33, 0.16, 0, -0.6, 0, WH, 'denim', { alt: 1 }), CK.B(0.155, 0.1, 0.25, 0, -0.82, 0.04, WH, 'leather', { alt: 2, b: 0 })]), NG * 2);
  const xT = instExtras(torso), xH = instExtras(head, true), xA = instExtras(arms), xL = instExtras(legs);
  const TOPS = ['#ff8a6a', '#27a8a0', '#ffd447', '#f6f1e7', '#7a5cff', '#ff5fa8', '#2a3a5a', '#8dff9a', '#9fe8d0', '#c8622a', '#7fe0ff'];
  const BOTTOMS = ['#22203a', '#f6f1e7', '#2f4a6a', '#c9b38a', '#ff8fb0', '#3a5a4a'];
  const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'], HAIRS = ['#1b1410', '#2a1a12', '#5a3a1a', '#a0703a', '#d9b26a', '#8a8a90', '#ff7a5a', '#22203a'];
  const col = new THREE.Color();
  const people = spots.map((s, i) => {
    const slick = s.kind === 'fish';
    const top = slick ? '#ffd21a' : TOPS[(i * 7 + 3) % TOPS.length], sk = SKIN[(i * 5 + 1) % SKIN.length], lg = slick ? '#2a3a5a' : BOTTOMS[(i * 3) % BOTTOMS.length];
    torso.setColorAt(i, col.set(top)); xT.b(i, lg); xT.c(i, i % 3 ? top : '#ffd166');
    head.setColorAt(i, col.set(sk)); xH.b(i, HAIRS[(i * 7 + 2) % HAIRS.length]); xH.face(i, (i * 3 + 1) % CROWD_FACE_N);
    for (const k of [0, 1]) {
      arms.setColorAt(i * 2 + k, col.set(i % 3 === 2 && !slick ? sk : top)); xA.b(i * 2 + k, i % 3 === 0 || slick ? top : sk); xA.c(i * 2 + k, sk);
      legs.setColorAt(i * 2 + k, col.set(lg)); xL.b(i * 2 + k, i % 4 === 1 ? sk : lg); xL.c(i * 2 + k, ['#22203a', '#f6f1e7', '#c0303a', '#c9a46a'][i % 4]);
    }
    return { i, s, on: false, h: s.kid ? 0.62 : 0.94 + ((i * 37) % 11) * 0.012, seed: i * 1.7, p: newPose(), x: s.x, z: s.z, yaw: s.yaw };
  });
  const Rt = new THREE.Matrix4(), Bm = new THREE.Matrix4(), Lm = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3();
  const HIP = 0.92, Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  const local = (x, y, z, rx, ry, rz) => Lm.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one);
  function loopAt(s) {
    s = ((s % loopLen) + loopLen) % loopLen;
    const seg = [74, 5, 74, 5];
    for (let i = 0; i < 4; i++) {
      if (s <= seg[i]) { const a = LOOP[i], b = LOOP[(i + 1) % 4], k = s / seg[i]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]; }
      s -= seg[i];
    }
    return [LOOP[0][0], LOOP[0][1], 0];
  }
  function pose(g, t, dt) {
    const o = g.p, s = g.s, k = reducedMotion ? 0.3 : 1, w = Math.sin(t * 0.4 + g.seed);
    Object.assign(o, { y: 0, x: 0, rx: 0.04, ry: 0, rz: 0, spin: 0, hx: 0, hz: 0 });
    o.lL[0] = o.lR[0] = 0; o.lL[1] = 0.06; o.lR[1] = -0.06; o.aL[0] = -0.1; o.aL[1] = 0; o.aL[2] = 0.12; o.aR[0] = -0.1; o.aR[1] = 0; o.aR[2] = -0.12;
    g.turn = Math.sin(t * 0.23 + g.seed * 2) * 0.45 * k;
    if (s.kind === 'sit') { sitPose(s.y, 0, o, g.seed, true); o.hx = 0.05 * Math.sin(t * 0.3 + g.seed) * k; o.ry = 0; if (w > 0.65) { o.aR[0] = -1.6; o.aR[2] = -0.1; } }
    else if (s.kind === 'fish') { o.aL[0] = o.aR[0] = -0.9 + Math.sin(t * 0.8 + g.seed) * 0.08 * k; o.aL[2] = -0.2; o.aR[2] = 0.2; g.turn = 0; }
    else if (s.kind === 'lean') { o.rx = 0.14; o.aL[0] = -1.15; o.aL[2] = 0.18; o.aR[0] = -1.15; o.aR[2] = -0.18; }
    else if (s.kind === 'walk') {
      s.s += dt * s.v; const [x, z, yaw] = loopAt(s.s); g.x = x; g.z = z; g.yaw = yaw;
      const ph = s.s * 4.2; o.lL[0] = Math.sin(ph) * 0.55; o.lR[0] = -o.lL[0]; o.aL[0] = -o.lL[0] * 0.7; o.aR[0] = o.lL[0] * 0.7; o.y = Math.abs(Math.cos(ph)) * 0.03; g.turn *= 0.3;
    } else if (s.photo) { o.aL[0] = o.aR[0] = -1.4; o.aL[2] = 0.35; o.aR[2] = -0.35; g.turn = 0; }
    else if (s.kid && w > 0.3) { o.aR[0] = -2.6; o.aR[2] = -0.3 + Math.sin(t * 6 + g.seed) * 0.2 * k; }   // a kid waving at the rides
  }
  function draw(g) {
    const i = g.i;
    if (!g.on) { torso.setMatrixAt(i, Z0); head.setMatrixAt(i, Z0); for (const k of [0, 1]) { arms.setMatrixAt(i * 2 + k, Z0); legs.setMatrixAt(i * 2 + k, Z0); } return; }
    const o = g.p;
    Rt.compose(v.set(g.x, 0.02, g.z), q.setFromEuler(e.set(0, g.yaw, 0)), sv.set(g.h, g.h, g.h));
    Bm.multiplyMatrices(Rt, local(0, o.y + HIP, 0, o.rx, o.ry, o.rz)); Bm.multiply(M.makeTranslation(0, -HIP, 0));
    torso.setMatrixAt(i, Bm);
    head.setMatrixAt(i, M.multiplyMatrices(Bm, local(0, 1.5, 0, o.hx, g.turn || 0, o.hz)));
    arms.setMatrixAt(i * 2, M.multiplyMatrices(Bm, local(0.29, 1.46, 0, o.aL[0], o.aL[1], o.aL[2])));
    arms.setMatrixAt(i * 2 + 1, M.multiplyMatrices(Bm, local(-0.29, 1.46, 0, o.aR[0], o.aR[1], o.aR[2])));
    legs.setMatrixAt(i * 2, M.multiplyMatrices(Bm, local(0.11, HIP, 0, o.lL[0], 0, o.lL[1])));
    legs.setMatrixAt(i * 2 + 1, M.multiplyMatrices(Bm, local(-0.11, HIP, 0, o.lR[0], 0, o.lR[1])));
  }
  // the order people turn up in: anglers first, then the rest; kids only by day
  const order = () => { const h = env.tod, day = h >= 9 && h < 19.5; return people.filter((g) => day || !g.s.kid); };
  let want = 0, crowdT = 0;
  const setOn = (g, on) => { g.on = on; if (g.s.seat) g.s.seat.taken = on ? 'guest' : (g.s.seat.taken === 'guest' ? null : g.s.seat.taken); };
  function crowdTick(dt, near) {
    want = pierCrowd(env.tod, env.weather, env.w.rain);
    const list = order(), wanted = new Set(list.slice(0, want));
    crowdT -= dt;
    // near the pier people come and go only where you are not looking, one at a time; far away straight away
    const close = Math.hypot(player.pos.x - APIER.cx, player.pos.z - 160) < 140 && !game.inside;
    if (!close) { for (const g of people) { const w = wanted.has(g) && !(g.s.seat && g.s.seat.taken && g.s.seat.taken !== 'guest'); if (w !== g.on) setOn(g, w); } }
    else if (crowdT <= 0) {
      crowdT = 0.8;
      const add = list.find((g) => !g.on && wanted.has(g) && !(g.s.seat && g.s.seat.taken) && unseen(camera, g.x, g.z, 0, 999) && Math.hypot(g.x - player.pos.x, g.z - player.pos.z) > 1.4);
      const drop = people.find((g) => g.on && !wanted.has(g) && unseen(camera, g.x, g.z, 0, 999));
      if (add) setOn(add, true); else if (drop) setOn(drop, false);
    }
    // the crowd is solid: the courier is pushed out of anyone she walks into (kids are smaller)
    if (onPier() && !game.busy) {
      const P = player.pos;
      for (const g of people) { if (!g.on) continue; const dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz), rr = (g.s.kid ? 0.22 : 0.3) + 0.42; if (d < rr && d > 1e-4) { P.x = g.x + dx / d * rr; P.z = g.z + dz / d * rr; stats.pushes++; } }
    }
    const show = near && people.some((g) => g.on);
    for (const m of [torso, head, arms, legs]) m.visible = show;
    if (!show) return;
    const t = timeU.value;
    for (const g of people) { if (g.on) pose(g, t, dt); draw(g); }
    for (const m of [torso, head, arms, legs]) m.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- where you are, what E does
  const dist = (p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
  const onPier = () => !game.inside && !game.vehicle && player.pos.x > APIER.x0 && player.pos.x < APIER.x1 && player.pos.z > APIER.z0 - 2 && player.pos.z < APIER.z1;
  function nearUse() {
    if (game.busy || game.vehicle || game.inside || (game.act && game.act.mode) || S.phase) return null;
    if (dist(BOARD) < 2.3) return { kind: 'board', label: 'RIDE', hint: `ride the ${'Starlight Wheel'} ($${TICKET})` };
    if (dist(CANDY_SPOT) < 1.9) return { kind: 'candy', label: 'BUY', hint: 'buy candy floss and popcorn' };
    return null;
  }
  function setBoost(on) { VIEW.far = on ? (quality.high ? 2.6 : 1.8) : 1; VIEW.fog = on ? 1.9 : 1; }

  // ---------------------------------------------------------------- the ride
  const floorY = () => fx.pivot(S.k).y - W.hang + 0.12;
  // the gondola that will come round to the bottom next, and the wheel angle that puts it there
  function nextBottom() {
    let best = 0, bd = 1e9;
    for (let k = 0; k < N; k++) {
      const a = -PI / 2 - k / N * PI * 2;
      let d = (a - fx.S.angle) % (PI * 2); if (d < 0) d += PI * 2;
      if (d < bd) { bd = d; best = k; }
    }
    return { k: best, d: bd };
  }
  function board() {
    const h = env.tod;
    if (game.wanted > 0) { hud.toast('THE ATTENDANT SHAKES HIS HEAD', 'NOT WITH COAST PATROL ON YOUR TAIL'); audio.blip(false); return true; }
    if (env.weather === 'storm') { hud.toast('THE WHEEL IS CLOSED', 'NOT IN A THUNDERSTORM'); audio.blip(false); return true; }
    if (!opens(h)) { hud.toast('THE WHEEL IS CLOSED', 'RIDES FROM 9:00 TO 2:00'); audio.blip(false); return true; }
    if (game.money < TICKET) { hud.toast(`A RIDE IS $${TICKET}`, 'NOT ENOUGH CASH'); audio.blip(false); return true; }
    game.money -= TICKET; stats.tickets += TICKET; stats.boards++; audio.cash();
    game.act.reset();
    const nb = nextBottom(), a0 = fx.S.angle, a1 = a0 + nb.d;
    S.k = nb.k; fx.S.held = true; S.phase = 'board';
    // too far off the platform for a short walk: start right at the queue
    if (dist(BOARD) > 3) game.places.putOutside(BOARD.x, BOARD.z - 1.5, 0);
    const sx = player.pos.x, sz = player.pos.z;
    const beats = [
      { dur: reducedMotion ? 1.2 : 2.6, start() { cut.setFov(50); },
        tick(k, dt) {
          fx.S.angle = lerp(a0, a1, ease(k));
          const m = ease(clamp(k / 0.7, 0, 1));
          player.pos.set(lerp(sx, BOARD.x, m), 0, lerp(sz, BOARD.z, m)); player.yaw = 0; player.speed = k < 0.7 ? 2.5 : 0; player.animate(dt, 0, null);
          camera.position.set(W.x + 5.5, 2.6, W.z - 9.5); camera.lookAt(W.x, 1.6, W.z - 2.5);
        } },
      { dur: reducedMotion ? 0.9 : 1.6,
        tick(k, dt) {
          const m = ease(k), fy = floorY();
          player.pos.set(BOARD.x, lerp(0, fy, m), lerp(BOARD.z, W.z + W.off, m)); player.yaw = 0; player.speed = k < 0.85 ? 2 : 0; player.animate(dt, 0, null);
          camera.position.set(W.x + 4.2, 2.4, W.z - 7.4); camera.lookAt(W.x, 1.4, W.z + W.off);
          if (k > 0.85) cut.fade(true);
        } },
    ];
    cut.run(beats, startRide, true);
    return true;
  }
  function startRide() {
    const nb = nextBottom();
    if (nb.d > 1e-3 && nb.d < PI * 2 - 1e-3) { fx.S.angle = -PI / 2 - S.k / N * PI * 2; }
    S.base = fx.S.angle; S.t = 0; S.phase = 'ride'; S.wait = null; S.look.yaw = 0; S.look.pitch = 0; S.look.idle = 9; S.topT = 0;
    fx.S.held = true; game.busy = 'ride'; stats.rides++;
    player.setHidden(true); player.vel.set(0, 0, 0); player.speed = 0;
    player.pos.set(BOARD.x, 0, BOARD.z);
    setBoost(true); cut.fade(false);
    hud.toast('THE STARLIGHT WHEEL', game.input.touchMode ? 'DRAG TO LOOK · SUNSET / NIGHT TO WAIT AT THE TOP · SKIP' : 'DRAG TO LOOK · 1 SUNSET · 2 NIGHT · X SKIPS THE RIDE');
  }
  function rideAngle(t) {
    if (t < UP_S) return S.base + PI * ease(t / UP_S);
    if (t < UP_S + TOP_S) return S.base + PI;
    return S.base + PI + PI * ease(Math.min(1, (t - UP_S - TOP_S) / DOWN_S));
  }
  function exitRide(skipped) {
    if (S.phase !== 'ride' && S.phase !== 'done') return false;
    if (skipped) stats.skips++; else stats.exits++;
    if (S.wait) { S.wait = null; env.ffRate = null; env.target = null; }
    S.phase = 'exit';
    cut.fade(true);
    setTimeout(() => {
      // the wheel stops with this gondola at the bottom, the courier steps off onto the platform
      fx.S.angle = S.base + PI * 2; fx.S.held = false; S.phase = null; game.busy = null;
      player.setHidden(false);
      game.places.putOutside(BOARD.x, BOARD.z - 0.6, PI);
      player.pos.y = 0; player.onGround = true; player.fallFrom = 0;
      cam.yaw = PI + 0.9; cam.pitch = 0.22; cam.snap(player.pos);
      setBoost(false);
      if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
      setTimeout(() => cut.fade(false), 60);
      hud.toast(skipped ? 'BACK ON THE PLATFORM' : 'WHAT A VIEW', 'STARLIGHT PIER');
    }, 320);
    return true;
  }
  function wait(which) {
    if (S.phase !== 'ride') return false;
    const h = env.tod, to = which === 'sunset' ? SUNSET : NIGHT;
    if (which === 'sunset' && h >= SUNSET - 0.2 && h < 21) { hud.toast('THE SUN IS ALREADY GOING DOWN', 'ENJOY IT FROM UP HERE'); return true; }
    if (which === 'night' && (h >= NIGHT - 0.2 || h < 4.5)) { hud.toast('IT IS ALREADY NIGHT', 'THE WHOLE COAST IS LIT UP'); return true; }
    env.target = to; env.ffRate = (d) => clamp(d * 0.55, 0.3, 2.4);
    S.wait = which; stats.waits++;
    hud.toast(which === 'sunset' ? 'HOLDING AT THE TOP FOR THE SUNSET' : 'HOLDING AT THE TOP FOR THE NIGHT', 'X: SKIP THE RIDE');
    audio.blip(true);
    return true;
  }
  function rideTick(dt) {
    if (S.phase !== 'ride' && S.phase !== 'done') return;
    if (S.phase === 'ride') {
      // waiting for the sunset / the night: climb to the top and hold there until the clock gets there
      const holding = S.wait && env.target !== null;
      if (S.wait && env.target === null) { hud.toast(S.wait === 'sunset' ? 'SUNSET OVER CORAL BEACH' : 'NIGHT OVER THE BAY', 'THE WHEEL TURNS ON'); S.wait = null; env.ffRate = null; }
      if (holding && S.t >= UP_S) S.t = Math.min(S.t, UP_S + TOP_S * 0.5);
      else S.t += dt;
      if (S.t >= UP_S && S.t < UP_S + TOP_S) S.topT += dt;
      if (S.t >= RIDE_S) { S.t = RIDE_S; S.phase = 'done'; stats.revs++; hud.toast('BACK AT THE BOTTOM', game.input.touchMode ? 'STEP OUT' : 'E / F: STEP OUT'); }
      fx.S.angle = rideAngle(S.t);
    }
  }
  // the camera in the gondola: seated eye height, looking out; drag to look round, it eases back after a while
  const eye = new THREE.Vector3(), tgt = new THREE.Vector3();
  function autoYaw(u) {
    // west along the beach to the old town, round to the causeway and the key at the top, then over the town
    const keys = [[0, -1.45], [0.35, -1.62], [0.55, -1.76], [0.75, -2.15], [1, -1.7]];
    for (let i = 0; i < keys.length - 1; i++) if (u <= keys[i + 1][0]) { const k = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return lerp(keys[i][1], keys[i + 1][1], ease(k)); }
    return keys[keys.length - 1][1];
  }
  function camUpdate(dt) {
    const p = fx.pivot(S.k);
    eye.set(p.x, p.y - W.hang + 0.12 + 1.32, p.z + W.off);
    const L2 = S.look;
    if (input.dragDX || input.dragDY) { L2.yaw -= input.dragDX * 0.005; L2.pitch = clamp(L2.pitch - input.dragDY * 0.004, -0.9, 0.7); L2.idle = 0; }
    else { L2.idle += dt; if (L2.idle > 5) { L2.yaw = damp(L2.yaw, 0, 0.6, dt); L2.pitch = damp(L2.pitch, 0, 0.6, dt); } }
    const u = S.t / RIDE_S, h = (p.y - W.y + W.R) / (2 * W.R);
    const yaw = autoYaw(u) + L2.yaw, pitch = -0.1 - 0.16 * h + L2.pitch;
    tgt.set(eye.x + Math.sin(yaw) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z + Math.cos(yaw) * Math.cos(pitch));
    camera.position.copy(eye); camera.lookAt(tgt);
    const fov = damp(camera.fov, 64, 2, dt);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  const api = {
    fx, stats, people, spots, pierCrowd,
    get riding() { return S.phase === 'ride' || S.phase === 'done' || S.phase === 'exit'; },
    get phase() { return S.phase; },
    get waiting() { return S.wait; },
    get on() { return onPier(); },
    get music() { return S.music; },
    get want() { return want; },
    nearUse,
    use() {
      if (S.phase === 'done') return exitRide(false);
      if (S.phase === 'ride') { hud.toast('NOT YET', game.input.touchMode ? 'SKIP TO GET OFF NOW' : 'WAIT FOR THE BOTTOM, OR X TO SKIP THE RIDE'); return true; }
      const u = nearUse();
      if (!u) return false;
      if (u.kind === 'board') return board();
      if (!standOpen(env.tod)) { hud.toast('SUGAR TIDE IS CLOSED', 'OPEN FROM 10:00 TILL HALF PAST MIDNIGHT'); audio.blip(false); return true; }
      player.vel.set(0, 0, 0); player.speed = 0; player.pos.x = CANDY_SPOT.x; player.pos.z = CANDY_SPOT.z; player.yaw = PI / 2;
      stats.food++; game.places.openShop('pier');
      return true;
    },
    // keys while riding (main.js passes them all here while game.busy is 'ride')
    key(e) {
      const c = e.code;
      if (c === 'KeyX' || c === 'Escape') { if (S.phase === 'ride' || S.phase === 'done') exitRide(true); return; }
      if (c === 'KeyE' || c === 'KeyF') { api.use(); return; }
      if (c === 'Digit1' || c === 'Numpad1') { wait('sunset'); return; }
      if (c === 'Digit2' || c === 'Numpad2') { wait('night'); return; }
      if (c === 'KeyM' || c === 'KeyP' || c === 'BracketLeft' || c === 'BracketRight') return 'pass';
    },
    hint() {
      if (S.phase === 'done') return [['E / F', 'step out'], ['Drag', 'look around']];
      return [['Drag', 'look around'], ['1', 'wait for sunset (19:30)'], ['2', 'wait for night (22:00)'], ['X', 'skip the ride']];
    },
    touchButtons() { return S.phase === 'done' ? [['KeyE', 'STEP OUT']] : [['Digit1', 'SUNSET'], ['Digit2', 'NIGHT'], ['KeyX', 'SKIP']]; },
    camUpdate,
    get camOn() { return S.phase === 'ride' || S.phase === 'done'; },
    update(dt) {
      fx.S.open = opens(env.tod) && env.weather !== 'storm' ? 1 : 0;
      fx.S.lightsOn = env.tod >= 2 && env.tod < 5.5 ? 0 : 1;
      fx.update(dt, camera, game);
      rideTick(dt);
      const c = camera.position, near = fx.root.visible && Math.hypot(c.x - APIER.cx, c.z - 160) < 260;
      crowdTick(dt, near);
      // the pier's theme: full on the deck, fading out over ~70 m off it; softer up on the wheel
      const f = game.focus(), dx = Math.max(APIER.x0 - f.x, 0, f.x - APIER.x1), dz = Math.max(APIER.z0 - f.z, 0, f.z - APIER.z1);
      const d = Math.hypot(dx, dz), k = game.inside ? 0 : api.riding ? 0.75 : 1 - clamp((d - 6) / 70, 0, 1);
      S.music = damp(S.music, k * k, 3, dt);
    },
    // ---- automated checks
    state: () => {
      const p = fx.pivot(S.k);
      return { phase: S.phase, t: +S.t.toFixed(1), k: S.k, angle: +fx.S.angle.toFixed(3), held: fx.S.held, gondY: +(p.y - W.hang).toFixed(2), x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2),
        busy: game.busy, hidden: player.hidden, money: game.money, view: { ...VIEW }, wait: S.wait, tod: +env.tod.toFixed(2), crowd: people.filter((g) => g.on).length, want, music: +S.music.toFixed(2),
        cam: { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) }, stats: { ...stats } };
    },
    // jump the ride clock (checks: software GL runs at a few frames a second)
    rideTo(t) { if (S.phase === 'ride') { S.t = clamp(t, 0, RIDE_S - 0.01); fx.S.angle = rideAngle(S.t); } return api.state(); },
    settle() { want = pierCrowd(env.tod, env.weather, env.w.rain); const list = order(), w = new Set(list.slice(0, want)); for (const g of people) setOn(g, w.has(g)); return people.filter((g) => g.on).length; },
    RIDE_S,
  };
  return api;
}
