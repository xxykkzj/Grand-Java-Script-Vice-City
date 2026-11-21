// The Solstice Spire (world/spire.js builds it, game/spireroom.js is the lobby): the lift between the lobby and
// the Solstice Terrace on the roof, and the terrace itself, outdoors at the real height of the tower.
//   - E at the lift in the lobby: the doors close, the counter races up to the terrace, the doors open on the roof.
//     E at the lift hut on the roof rides back down. Skipping either scene still leaves you in the right place.
//   - the terrace: a glass balustrade all round (solid, and you are kept inside it), loungers and benches facing
//     the view, the Afterglow Bar (June, drinks through game/eat.js), guests by the clock and the weather.
//   - sit down on a lounger or a bench: the camera eases out to a wide view, and you can wait for the sunset
//     (19:30) or the night (22:00): the clock fast-forwards smoothly, and getting up stops it.
//   - while you are up there the view goes further: trees, lamps and the fog are pushed back (core/util.js VIEW).
//   - the helicopter cannot land on it (vehicles/vehicles.js keeps it hovering; a toast says why).
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, PI, reducedMotion, timeU, unseen, VIEW, rng } from '../core/util.js';
import { ease } from './cutscene.js';
import { OY, makeCastNPC } from './interiors.js';
import { LIFT } from './spireroom.js';
import { SKYBAR_GREET, LEO_LINES } from './story.js';
import { kit, blockyMaterial, instExtras, crowdAtlas, mergeParts, hairPieces, pickHair, lookMask } from '../actors/blocky.js';
import { newPose, sitPose } from '../actors/moves.js';
import { quality } from '../core/quality.js';
import { setDeckLight } from '../world/lamplight.js';

const FLOORS = 23;
const SUNSET = 19.5, NIGHT = 22;

// how many guests are up there at hour h (the spots fill best-first); none in rain or a storm
export function terraceGuests(h, weather, rain = 0) {
  if (weather === 'rain' || weather === 'storm' || rain > 0.25) return 0;
  const n = h < 2 ? 3 : h < 6 ? 0 : h < 10 ? 1 : h < 16 ? 3 : h < 18 ? 6 : h < 22.5 ? 12 : 5;
  return weather === 'fog' ? Math.ceil(n / 2) : n;
}

export function createSpire(game, scene) {
  const { L, player, hud, audio, env, cam, cut, camera } = game;
  const b = L.key.buildings.find((q) => q.spire), T = b.terrace, TT = T.T, X = T.X, Z = T.Z, Y = T.Y;
  const W = (lx, lz) => [X + lx, Z + lz];
  const stats = { up: 0, down: 0, waits: 0, drinks: 0, noLand: 0, clamps: 0 };
  const S = { on: false, wait: null, camK: 0, sitToast: null, leoN: 0, greetN: 0, noLandT: 0, boost: 0 };
  const lobby = () => L.venues.spire;
  // the terrace's string lights reach the people up there (world/lamplight.js deck term)
  setDeckLight(0, X - 24.5, Z - 18.5, X + 24.5, Z + 18.5, Y, '#ffc890', 0.3);

  // ---------------------------------------------------------------- the roof lift hut's doors
  const steel = new THREE.MeshLambertMaterial({ color: '#c8c4d4' });
  const hutDoor = (sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.42, TT.hut.door), steel); m.position.set(X + TT.hut.x1 - 0.13, Y + 1.21, Z + sz * TT.hut.door / 2); scene.add(m); return m; };
  const hutL = hutDoor(-1), hutR = hutDoor(1);
  let hutOpen = 0;
  const setHut = (k) => { hutOpen = k; hutL.position.z = Z - TT.hut.door / 2 - k * TT.hut.door; hutR.position.z = Z + TT.hut.door / 2 + k * TT.hut.door; };

  // ---------------------------------------------------------------- June behind the bar
  const june = makeCastNPC('JUNE');
  june.g.position.set(X + TT.barman.x, Y, Z + TT.barman.z); june.g.rotation.y = 0;
  Object.assign(june, { x: june.g.position.x, z: june.g.position.z, yaw: 0, home: 0 });
  scene.add(june.g);

  // ---------------------------------------------------------------- the guests: refined blocks, instanced (4 draw calls)
  const spots = T.spots, NG = spots.length;
  const CA = crowdAtlas(), CK = kit(CA), WH = '#ffffff', P0 = { b: 0 };
  const cMat = blockyMaterial({ atlas: CA, inst: true }), cHead = blockyMaterial({ atlas: CA, inst: true, face: true, hair: true });
  const mk = (geo, n, m = cMat) => { const o = new THREE.InstancedMesh(geo, m, n); o.frustumCulled = false; scene.add(o); return o; };
  const torso = mk(mergeParts([CK.B(0.4, 0.17, 0.25, 0, 0.93, 0, WH, 'denim', { alt: 1 }), CK.B(0.41, 0.035, 0.258, 0, 1.02, 0, '#3a3440', 'leather', { alt: 3, b: 0 }),
    CK.B(0.42, 0.2, 0.25, 0, 1.12, 0, WH, 'weave'), CK.B(0.45, 0.25, 0.27, 0, 1.33, 0, WH, 'weave'), CK.B(0.12, 0.09, 0.26, 0.215, 1.45, 0, WH, 'seam', P0), CK.B(0.12, 0.09, 0.26, -0.215, 1.45, 0, WH, 'seam', P0),
    CK.B(0.24, 0.045, 0.2, 0, 1.475, 0, WH, 'rib', { alt: 2, b: 0 })]), NG);
  const head = mk(mergeParts([CK.B(0.1, 0.08, 0.1, 0, 0, 0, WH, 'plain', P0), CK.B(0.27, 0.28, 0.26, 0, 0.17, 0, WH, 'plain', { b: 0.018 }), CK.face(0.234, 0.244, 0, 0.17, 0.1305, WH),
    CK.B(0.032, 0.036, 0.022, 0, 0.135, 0.139, '#e2e2e2', 'plain', P0), CK.B(0.026, 0.06, 0.05, 0.145, 0.16, 0, '#dcdcdc', 'plain', P0), CK.B(0.026, 0.06, 0.05, -0.145, 0.16, 0, '#dcdcdc', 'plain', P0),
    ...hairPieces(CK, { w: 0.27, h: 0.28, d: 0.26, y: 0.17 }, WH, { all: true, alt: 1 })]), NG, cHead);
  const arms = mk(mergeParts([CK.B(0.12, 0.24, 0.13, 0, -0.11, 0, WH, 'weave'), CK.B(0.105, 0.04, 0.115, 0, -0.25, 0, WH, 'plain', { alt: 1, b: 0 }),
    CK.B(0.112, 0.17, 0.122, 0, -0.35, 0, WH, 'weave', { alt: 1 }), CK.B(0.085, 0.08, 0.09, 0, -0.475, 0, WH, 'plain', { alt: 2, b: 0 })]), NG * 2);
  const legs = mk(mergeParts([CK.B(0.15, 0.4, 0.17, 0, -0.2, 0, WH, 'denim'), CK.B(0.135, 0.05, 0.155, 0, -0.42, 0, WH, 'plain', { alt: 1, b: 0 }),
    CK.B(0.14, 0.33, 0.16, 0, -0.6, 0, WH, 'denim', { alt: 1 }), CK.B(0.155, 0.1, 0.25, 0, -0.82, 0.04, WH, 'leather', { alt: 2, b: 0 })]), NG * 2);
  const xT = instExtras(torso), xH = instExtras(head, true, true), xA = instExtras(arms), xL = instExtras(legs);
  const TOPS = ['#f6f1e7', '#ff8a6a', '#27a8a0', '#ffd447', '#7a5cff', '#ff5fa8', '#2a3a5a', '#e8c070', '#9fe8d0', '#c8622a'];
  const BOTTOMS = ['#22203a', '#f6f1e7', '#2f4a6a', '#c9b38a', '#5a2a4a', '#3a5a4a'];
  const SKIN = ['#f1c9a5', '#e0a878', '#c98d62', '#a56b43', '#7a4a2e', '#5a3620'];
  const col = new THREE.Color(), hrnd = rng(23), hairs = [];
  const guests = spots.map((s, i) => {
    const top = TOPS[(i * 7 + 3) % TOPS.length], sk = SKIN[(i * 5 + 1) % SKIN.length], lg = BOTTOMS[(i * 3) % BOTTOMS.length], dress = i % 4 === 1;
    torso.setColorAt(i, col.set(top)); xT.b(i, dress ? top : lg); xT.c(i, i % 3 ? top : '#ffd166');
    head.setColorAt(i, col.set(sk)); { const hr = pickHair(hrnd); xH.b(i, hr.hex); xH.face(i, hr.face); xH.hair(i, lookMask(hr)); hairs.push(hr); }
    for (const k of [0, 1]) {
      arms.setColorAt(i * 2 + k, col.set(i % 3 === 2 ? sk : top)); xA.b(i * 2 + k, i % 3 === 0 ? top : sk); xA.c(i * 2 + k, sk);
      legs.setColorAt(i * 2 + k, col.set(dress ? sk : lg)); xL.b(i * 2 + k, dress ? sk : lg); xL.c(i * 2 + k, ['#22203a', '#f6f1e7', '#c0303a', '#c9a46a'][(i + k * 0) % 4]);
    }
    return { i, s, on: false, h: 0.94 + ((i * 37) % 11) * 0.012, seed: i * 1.7, p: newPose(), x: s.x, z: s.z, yaw: s.yaw, mv: null, gest: null, gT: 3 + i * 1.3 };
  });
  const Rt = new THREE.Matrix4(), Bm = new THREE.Matrix4(), Lm = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3();
  const HIP = 0.92, Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  const local = (x, y, z, rx, ry, rz) => Lm.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one);
  // poses: seated / on a lounger, leaning on the glass (forearms forward on the top rail, hands together), standing
  // with a drink; all of them breathe, shift their weight and look about; standing guests sip, chat with their
  // hands, check a watch, laugh. A guest on the move (to the bar and back, arriving from or leaving for the lift)
  // walks with a proper stride.
  function pose(gst, t, dt) {
    const o = gst.p, s = gst.s, k = reducedMotion ? 0.3 : 1, br = Math.sin(t * 1.6 + gst.seed) * 0.012 * k;
    gst.gT -= dt;
    if (gst.gT <= 0) { gst.gT = 4 + ((gst.seed * 7.3 + t) % 6); const r = (Math.sin(t * 12.9 + gst.seed * 3.1) + 1) / 2; gst.gest = r < 0.3 ? 'sip' : r < 0.55 ? 'talk' : r < 0.68 ? 'watch' : r < 0.82 ? 'laugh' : null; gst.gLen = gst.gest === 'talk' ? 3 : 1.6; gst.g0 = t; }
    const ga = gst.gest && t - gst.g0 < gst.gLen ? Math.sin(Math.min(1, (t - gst.g0) / gst.gLen) * PI) : 0;
    if (gst.mv) {
      Object.assign(o, { y: 0, x: 0, rx: 0.05, ry: 0, rz: 0, spin: 0, hx: 0, hz: 0 });
      const ph = gst.mv.d * 4.4; o.lL[0] = Math.sin(ph) * 0.55; o.lR[0] = -o.lL[0]; o.lL[1] = 0.04; o.lR[1] = -0.04;
      o.aL[0] = -o.lL[0] * 0.6; o.aL[1] = 0; o.aL[2] = 0.1; o.aR[0] = o.lL[0] * 0.6; o.aR[1] = 0; o.aR[2] = -0.1; o.y = Math.abs(Math.cos(ph)) * 0.03; gst.turn = 0; return;
    }
    if (s.kind === 'sit' || s.kind === 'lounger') {
      sitPose(s.y, 0, o, gst.seed, true);
      o.hx = 0.05 * Math.sin(t * 0.3 + gst.seed) * k; o.ry = 0; o.y += br;
      if (s.kind === 'lounger') { o.rx = -0.55; o.lL[0] = o.lR[0] = -1.5; o.aL[0] = 0.2; o.aL[2] = 0.45; o.aR[0] = -0.4; o.aR[2] = -0.2; }
      else if (gst.gest === 'sip') { o.aR[0] = -0.5 - 1.6 * ga; o.aR[2] = -0.12; }
      else if (gst.gest === 'talk') { o.aL[0] = -0.6 - 0.35 * Math.abs(Math.sin(t * 4)) * ga; o.aL[2] = 0.3; }
    } else {
      Object.assign(o, { y: br, x: 0, rx: 0.04, ry: 0, rz: Math.sin(t * 0.21 + gst.seed) * 0.025 * k, spin: 0, hx: 0, hz: 0 });
      o.lL[0] = o.lR[0] = 0; o.lL[1] = 0.06 + o.rz; o.lR[1] = -0.06 + o.rz;
      if (s.kind === 'lean') {
        // the top rail is ~1.1 m up: the arms reach forward and down to it, the hands meet in front
        o.rx = 0.2; o.aL[0] = -0.95; o.aL[1] = 0; o.aL[2] = -0.26; o.aR[0] = -0.95; o.aR[1] = 0; o.aR[2] = 0.26;
        if (gst.gest === 'sip') { o.aR[0] = -0.95 - 0.9 * ga; o.aR[2] = 0.26 - 0.5 * ga; }
      } else {
        o.aL[0] = -0.1; o.aL[1] = 0; o.aL[2] = 0.1;
        o.aR[0] = -0.75; o.aR[1] = 0; o.aR[2] = -0.12;                                   // the drink held at the waist
        if (gst.gest === 'sip') { o.aR[0] = -0.75 - 1.15 * ga; o.aR[2] = -0.12 + 0.1 * ga; }
        else if (gst.gest === 'talk') { o.aL[0] = -0.5 - 0.5 * Math.abs(Math.sin(t * 3.6 + gst.seed)) * ga; o.aL[2] = 0.25 + 0.2 * ga; }
        else if (gst.gest === 'watch') { o.aL[0] = -1.35 * ga; o.aL[2] = -0.75 * ga; o.hx = 0.35 * ga; }
        else if (gst.gest === 'laugh') { o.y += Math.abs(Math.sin(t * 9)) * 0.025 * ga; o.rx = 0.04 - 0.12 * ga; }
      }
    }
    o.hz = 0; gst.turn = Math.sin(t * 0.23 + gst.seed * 2) * 0.5 * k;
  }
  function draw(gst) {
    const i = gst.i;
    if (!gst.on) { torso.setMatrixAt(i, Z0); head.setMatrixAt(i, Z0); for (const k of [0, 1]) { arms.setMatrixAt(i * 2 + k, Z0); legs.setMatrixAt(i * 2 + k, Z0); } return; }
    const o = gst.p, s = gst.s;
    Rt.compose(v.set(gst.x, Y, gst.z), q.setFromEuler(e.set(0, gst.yaw, 0)), sv.set(gst.h, gst.h, gst.h));
    Bm.multiplyMatrices(Rt, local(0, o.y + HIP, 0, o.rx, o.ry, o.rz)); Bm.multiply(M.makeTranslation(0, -HIP, 0));
    torso.setMatrixAt(i, Bm);
    head.setMatrixAt(i, M.multiplyMatrices(Bm, local(0, 1.5, 0, o.hx, gst.turn || 0, o.hz)));
    arms.setMatrixAt(i * 2, M.multiplyMatrices(Bm, local(0.29, 1.46, 0, o.aL[0], o.aL[1], o.aL[2])));
    arms.setMatrixAt(i * 2 + 1, M.multiplyMatrices(Bm, local(-0.29, 1.46, 0, o.aR[0], o.aR[1], o.aR[2])));
    legs.setMatrixAt(i * 2, M.multiplyMatrices(Bm, local(0.11, HIP, 0, o.lL[0], 0, o.lL[1])));
    legs.setMatrixAt(i * 2 + 1, M.multiplyMatrices(Bm, local(-0.11, HIP, 0, o.lR[0], 0, o.lR[1])));
  }
  const setGuest = (gst, on) => { gst.on = on; gst.mv = null; gst.x = gst.s.x; gst.z = gst.s.z; gst.yaw = gst.s.yaw; if (gst.s.seat) gst.s.seat.taken = on ? 'guest' : null; };
  // walking about the deck: through the middle aisle (clear of the furniture), at a stroll
  const HUT = W(TT.lift.x + 0.4, 0), AISLE = W(-6, 0), BAR = W(TT.barUse.x + 0.6, TT.barUse.z + 0.7);
  const route = (from, to) => [[from[0], from[1]], [from[0] * 0.5 + AISLE[0] * 0.5, from[1] * 0.4 + AISLE[1] * 0.6], AISLE, [to[0] * 0.5 + AISLE[0] * 0.5, to[1] * 0.4 + AISLE[1] * 0.6], [to[0], to[1]]];
  function go(g, pts, then) { g.mv = { pts, i: 0, d: 0, then }; if (g.s.seat && g.s.seat.taken === 'guest') g.s.seat.taken = 'guest'; }
  function stepWalk(g, dt) {
    const M2 = g.mv, a = M2.pts[M2.i], b = M2.pts[M2.i + 1];
    if (!b) { const then = M2.then; g.mv = null; if (then === 'leave') setGuest(g, false); else if (then === 'bar') { g.barT = 5; } else { g.x = g.s.x; g.z = g.s.z; g.yaw = g.s.yaw; } return; }
    const dx = b[0] - g.x, dz = b[1] - g.z, d = Math.hypot(dx, dz), sp = 1.05 * dt;
    M2.d += sp;
    if (d <= sp) { g.x = b[0]; g.z = b[1]; M2.i++; } else { g.x += dx / d * sp; g.z += dz / d * sp; g.yaw += angleDelta(g.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt)); }
  }
  // the guests are solid: the courier is pushed out of them (and out of June behind the bar)
  function pushPlayer() {
    const P = player.pos;
    for (const g of guests) {
      if (!g.on) continue;
      const dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz), rr = 0.3 + 0.42;
      if (d < rr && d > 1e-4) { P.x = g.x + dx / d * rr; P.z = g.z + dz / d * rr; stats.pushes = (stats.pushes || 0) + 1; }
    }
    const dx = P.x - june.x, dz = P.z - june.z, d = Math.hypot(dx, dz);
    if (d < 0.72 && d > 1e-4) { P.x = june.x + dx / d * 0.72; P.z = june.z + dz / d * 0.72; }
  }
  let guestT = 0, want = 0, drawT = 0;
  function guestsTick(dt, near) {
    want = Math.min(NG, terraceGuests(env.tod, env.weather, env.w.rain));
    guestT -= dt;
    // up there, changes happen one at a time and only where you are not looking; elsewhere straight away
    if (!S.on || game.inside || cut.active) { for (const g of guests) { const on = g.i < want && !(g.s.seat && g.s.seat.taken === 'player'); if (on !== g.on) setGuest(g, on); } }
    else if (guestT <= 0) {
      guestT = 1.2;
      // up here people arrive from the lift hut and walk to their spot, and walk back to it to leave; one at a time
      // (if the hut is in view, a newcomer still waits until it is not, so nobody pops out of thin air in view)
      const busy = guests.some((g) => g.mv && (g.mv.then === 'arrive' || g.mv.then === 'leave'));
      const add = !busy && guests.find((g) => !g.on && g.i < want && !(g.s.seat && g.s.seat.taken) && Math.hypot(g.s.x - player.pos.x, g.s.z - player.pos.z) > 1.4);
      const drop = !busy && [...guests].reverse().find((g) => g.on && !g.mv && g.i >= want);
      if (add) { setGuest(add, true); add.x = HUT[0]; add.z = HUT[1]; go(add, route(HUT, [add.s.x, add.s.z]), 'arrive'); stats.arrivals = (stats.arrivals || 0) + 1; }
      else if (drop) { go(drop, route([drop.x, drop.z], HUT), 'leave'); if (drop.s.seat) drop.s.seat.taken = null; stats.leavers = (stats.leavers || 0) + 1; }
      // now and then someone standing or leaning goes to the bar for another round, and comes back
      else if (!guests.some((g) => g.mv && g.mv.then === 'bar') && Math.random() < 0.12) {
        const g = guests.find((q) => q.on && !q.mv && (q.s.kind === 'stand' || q.s.kind === 'lean') && Math.random() < 0.3);
        if (g) { go(g, route([g.x, g.z], BAR), 'bar'); stats.barTrips = (stats.barTrips || 0) + 1; }
      }
    }
    if (S.on) for (const g of guests) {
      if (!g.on) continue;
      if (g.mv) stepWalk(g, dt);
      else if (g.barT !== undefined) { g.barT -= dt; g.yaw += angleDelta(g.yaw, PI) * (1 - Math.exp(-4 * dt)); if (g.barT <= 0) { g.barT = undefined; go(g, route([g.x, g.z], [g.s.x, g.s.z]), 'back'); } }
    }
    if (S.on && !cut.active && !game.busy) pushPlayer();
    const show = near && guests.some((g) => g.on);
    for (const m of [torso, head, arms, legs]) m.visible = show;
    if (!show) return;
    // the far-off crowd is posed a few times a second, close up every frame
    drawT -= dt;
    if (!S.on && drawT > 0) return;
    drawT = 0.25;
    const t = timeU.value;
    for (const g of guests) { if (g.on) pose(g, t, S.on ? dt : 0.25); draw(g); }
    for (const m of [torso, head, arms, legs]) m.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- where you are
  const onDeck = () => !game.inside && !game.vehicle && player.pos.y > Y - 1.6 && Math.abs(player.pos.x - X) < b.w / 2 + 0.6 && Math.abs(player.pos.z - Z) < b.d / 2 + 0.6;
  const at = (u) => Math.hypot(player.pos.x - X - u.x, player.pos.z - Z - u.z) < u.r;
  const nearUse = () => {
    if (!S.on || game.busy || game.act.mode) return null;
    if (at(TT.lift)) return { kind: 'down', label: 'LIFT', hint: 'ride the lift down to the lobby' };
    if (at(TT.barUse)) return { kind: 'bar', label: 'ORDER', hint: 'order a drink from June' };
    return null;
  };
  // the view boost: trees, lamps and the fog reach further while you are up here (eased, restored on the way down)
  function setBoost(on) {
    VIEW.far = on ? (quality.high ? 2.4 : 1.7) : 1;
    VIEW.fog = on ? 1.75 : 1;
  }

  // ---------------------------------------------------------------- the lift
  const lobbyRoom = () => { const p = lobby(); return p.room || game.places.roomOf(p); };
  // put the courier on the roof in the lift car (or out on the deck, done = true), facing the view
  function toRoof(done) {
    const [x, z] = done ? W(TT.lift.x + 0.3, 0) : W(TT.cab.x, TT.cab.z);
    game.places.putOutside(x, z, PI / 2);
    player.pos.y = Y; player.onGround = true; player.vy = 0; player.fallFrom = Y; player.sy = Y;
    cam.yaw = PI / 2; cam.pitch = 0.16; cam.snap(player.pos);
    S.on = true; setBoost(true);
    if (done) {
      setHut(0); hud.toast('THE SOLSTICE TERRACE', 'FLOOR 23 · SIT DOWN TO WAIT FOR THE SUNSET');
      // walk a few metres out onto the deck towards the view, the camera out in front looking back at her (with it
      // behind her from the start it sat inside the lift hut), then it comes round behind her
      const [x0, z0] = W(TT.lift.x + 0.3, 0), [x1, z1] = W(TT.lift.x + 6.3, 0);
      if (game.rules && game.rules.walkOut && !api.checking) game.rules.walkOut(x0, z0, x1, z1, PI / 2, { y: Y, T: 2.4, camOff: 0.55, pitch: 0.2 });
    }
  }
  function toLobby(done) {
    const r = lobbyRoom();
    game.places.enterRoom('spire', 0, done ? -4.3 : r.lift.carZ);
    player.yaw = 0;
    S.on = false; setBoost(false);
    if (done) { r.setDoors(0); r.lift.setFloor(0); }
  }
  function rideUp() {
    const r = lobbyRoom(), lf = r.lift, O = { x: r.ox, z: r.oz }, HZ = r.hz;
    game.act.reset();
    const sx = player.pos.x - O.x, sz = player.pos.z - O.z;
    stats.up++;
    const C = (x, y, z) => camera.position.set(O.x + x, OY + y, O.z + z), Lk = (x, y, z) => camera.lookAt(O.x + x, OY + y, O.z + z);
    audio.blip(true);
    const beats = [
      { dur: reducedMotion ? 0.7 : 1.5, start() { cut.setFov(50); },
        tick(k, dt) {
          r.setDoors(ease(Math.min(1, k * 2.2)));
          // to the middle of the doors first, then straight in
          const m1 = ease(clamp((k - 0.2) / 0.3, 0, 1)), m2 = ease(clamp((k - 0.45) / 0.4, 0, 1)), px = lerp(sx, 0, m1), pz = lerp(lerp(sz, -HZ + 0.9, m1), lf.carZ, m2);
          player.pos.set(O.x + px, OY, O.z + pz); player.yaw = k < 0.8 ? PI : PI + angleDelta(PI, 0) * ease((k - 0.8) / 0.2); player.speed = k > 0.25 && k < 0.85 ? 3 : 0;
          player.animate(dt, 0, null); r.idle(timeU.value, dt, reducedMotion);
          C(1.9, 1.8, -1.6); Lk(0, 1.3, -HZ - 0.6);
        } },
      { dur: reducedMotion ? 0.5 : 1.0, start() { audio.thud(0.15); },
        tick(k, dt) { r.setDoors(1 - ease(k)); player.pos.set(O.x, OY, O.z + lf.carZ); player.yaw = 0; player.speed = 0; player.animate(dt, 0, null); r.idle(timeU.value, dt, reducedMotion); C(1.2, 1.7, -2.6); Lk(0, 1.3, -HZ - 0.4); } },
      { dur: reducedMotion ? 0.8 : 1.7, start() { cut.setFov(38); },
        tick(k) { lf.setFloor(Math.min(FLOORS, Math.floor(ease(k) * (FLOORS + 0.99))), 1); C(0.35, LIFT.h + 0.3, -HZ + 1.5); Lk(0, LIFT.h + 0.45, -HZ); if (k > 0.86) cut.fade(true); } },
      { dur: 0.3, start() { cut.fade(true); lf.setFloor(FLOORS, 0); audio.blip(true); } },
      { dur: reducedMotion ? 0.9 : 2.3,
        start() { toRoof(false); setHut(0); r.setDoors(0); lf.setFloor(0); cut.fade(false); cut.setFov(48); },
        tick(k, dt) {
          setHut(ease(Math.min(1, k * 2.4)));
          const m = ease(clamp((k - 0.3) / 0.6, 0, 1));
          player.pos.set(X + lerp(TT.cab.x, TT.lift.x + 0.3, m), Y, Z); player.yaw = PI / 2; player.speed = k > 0.3 && k < 0.9 ? 3 : 0; player.animate(dt, 0, null);
          // the camera on the deck looking back at the hut, easing round to the view as Skye steps out
          const a = lerp(0.35, 0.95, ease(k));
          camera.position.set(X + TT.lift.x + 4.2 * Math.cos(a), Y + 1.7 + 0.5 * k, Z + 4.2 * Math.sin(a));
          camera.lookAt(X + TT.lift.x - 1.2, Y + 1.3, Z);
        } },
    ];
    cut.run(beats, () => toRoof(true), true);
  }
  function rideDown() {
    const sx = player.pos.x - X, sz = player.pos.z - Z;
    game.act.reset(); stats.down++;
    audio.blip(true);
    const beats = [
      { dur: reducedMotion ? 0.7 : 1.6, start() { cut.setFov(48); },
        tick(k, dt) {
          setHut(ease(Math.min(1, k * 2.2)));
          const m1 = ease(clamp((k - 0.15) / 0.3, 0, 1)), m2 = ease(clamp((k - 0.42) / 0.42, 0, 1));
          player.pos.set(X + lerp(lerp(sx, TT.hut.x1 + 0.9, m1), TT.cab.x, m2), Y, Z + lerp(sz, TT.cab.z, m1));
          player.yaw = k < 0.82 ? -PI / 2 : -PI / 2 + angleDelta(-PI / 2, PI / 2) * ease((k - 0.82) / 0.18); player.speed = k > 0.2 && k < 0.85 ? 3 : 0;
          player.animate(dt, 0, null);
          camera.position.set(X + TT.lift.x + 4.6, Y + 2.0, Z + 2.4); camera.lookAt(X + TT.hut.x1 - 0.8, Y + 1.3, Z);
        } },
      { dur: reducedMotion ? 0.5 : 1.0, start() { audio.thud(0.15); },
        tick(k, dt) { setHut(1 - ease(k)); player.pos.set(X + TT.cab.x, Y, Z + TT.cab.z); player.yaw = PI / 2; player.speed = 0; player.animate(dt, 0, null); if (k > 0.8) cut.fade(true); } },
      { dur: 0.3, start() { cut.fade(true); setHut(0); } },
      { dur: reducedMotion ? 0.8 : 1.7,
        start() { toLobby(false); const r = lobbyRoom(); r.setDoors(0); r.lift.setFloor(FLOORS, -1); cut.fade(false); cut.setFov(38); },
        tick(k, dt) {
          const r = lobbyRoom(); r.lift.setFloor(Math.max(0, FLOORS - Math.floor(ease(k) * (FLOORS + 0.99))), -1);
          camera.position.set(r.ox + 0.35, OY + LIFT.h + 0.3, r.oz - r.hz + 1.5); camera.lookAt(r.ox, OY + LIFT.h + 0.45, r.oz - r.hz);
          player.pos.set(r.ox, OY, r.oz + r.lift.carZ); player.yaw = 0; player.animate(dt, 0, null); r.idle(timeU.value, dt, reducedMotion);
        } },
      { dur: reducedMotion ? 0.8 : 1.6, start() { const r = lobbyRoom(); r.lift.setFloor(0, 0); audio.blip(true); cut.setFov(50); },
        tick(k, dt) {
          const r = lobbyRoom(), m = ease(clamp((k - 0.3) / 0.6, 0, 1));
          r.setDoors(ease(Math.min(1, k * 2.4)) * (k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1));
          player.pos.set(r.ox, OY, r.oz + lerp(r.lift.carZ, -4.3, m)); player.yaw = 0; player.speed = k > 0.3 && k < 0.9 ? 3 : 0; player.animate(dt, 0, null); r.idle(timeU.value, dt, reducedMotion);
          camera.position.set(r.ox + 2.2, OY + 1.9, r.oz - 1.2); camera.lookAt(r.ox, OY + 1.2, r.oz - r.hz - 0.3);
        } },
    ];
    cut.run(beats, () => toLobby(true), true);
  }

  // ---------------------------------------------------------------- sitting and waiting
  const seated = () => game.act.mode === 'sit' && !game.act.rising && game.act.seat && game.act.seat.floorY !== undefined && S.on;
  function wait(which) {
    if (!seated()) return false;
    const h = env.tod, to = which === 'sunset' ? SUNSET : NIGHT;
    if (which === 'sunset' && h >= SUNSET - 0.2 && h < 21) { hud.toast('THE SUN IS ALREADY GOING DOWN', 'SIT BACK AND WATCH IT'); return true; }
    if (which === 'night' && (h >= NIGHT - 0.2 || h < 4.5)) { hud.toast('IT IS ALREADY NIGHT', 'THE CITY IS ALL LIT UP'); return true; }
    env.target = to; env.ffRate = (d) => clamp(d * 0.55, 0.3, 2.4);
    S.wait = which; stats.waits++;
    hud.toast(which === 'sunset' ? 'WAITING FOR THE SUNSET' : 'WAITING FOR THE NIGHT', 'F / E / WASD: GET UP ANY TIME');
    audio.blip(true);
    return true;
  }
  function endWait(reached) {
    if (!S.wait) return;
    const w = S.wait; S.wait = null; env.ffRate = null;
    if (!reached) { env.target = null; hud.toast('BACK ON YOUR FEET', `IT IS ${clock()}`); return; }
    hud.toast(w === 'sunset' ? 'SUNSET OVER THE OLD TOWN' : 'NIGHT OVER THE BAY', `${clock()} · THE VIEW IS ON THE HOUSE`);
  }
  const clock = () => { const h = Math.floor(env.tod), m = Math.floor((env.tod - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  // the wide view while seated: behind and above the seat, looking out over the city and the sea
  const cp = new THREE.Vector3(), lk = new THREE.Vector3(), cpw = new THREE.Vector3(), lkw = new THREE.Vector3();
  let camWas = false;
  function camUpdate(dt) {
    const s = game.act.seat, yaw = s.kind === 'stool' ? PI / 2 : s.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), sxv = Math.cos(yaw), szv = -Math.sin(yaw);
    if (!camWas) { cp.copy(camera.position); camera.getWorldDirection(lk).multiplyScalar(20).add(camera.position); camWas = true; S.camK = 0; }
    S.camK = Math.min(1, S.camK + dt * 0.35);
    const drift = reducedMotion ? 0 : Math.sin(timeU.value * 0.05) * 0.8;
    // (above the string lights, which hang 2.6 to 3.4 m over the deck)
    cpw.set(s.x - fx * 3.6 + sxv * (1.2 + drift), Y + 4.8, s.z - fz * 3.6 + szv * (1.2 + drift));
    lkw.set(s.x + fx * 90, Y - 11, s.z + fz * 90);
    const k = 1 - Math.exp(-(0.8 + S.camK * 1.6) * dt);
    cp.lerp(cpw, k); lk.lerp(lkw, k);
    camera.position.copy(cp); camera.lookAt(lk);
    const fov = lerp(camera.fov, 58, k);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  const api = {
    stats, guests, june, building: b,
    get on() { return S.on; },
    get waiting() { return S.wait; },
    get seated() { return seated(); },
    get camOn() { return seated() && !game.busy; },
    get want() { return want; },
    get hutOpen() { return hutOpen; },
    terraceGuests,
    camUpdate,
    nearUse,
    // E in the lobby (venues.js passes the lift and the desk here)
    lobbyUse(kind) {
      if (kind === 'lift') { rideUp(); return true; }
      if (kind === 'concierge') { hud.toast('LEO, THE CONCIERGE', LEO_LINES[S.leoN++ % LEO_LINES.length]); audio.blip(true); return true; }
      return false;
    },
    // E on the terrace: the lift down, or a drink at the bar
    use() {
      const u = nearUse();
      if (!u) return false;
      if (u.kind === 'down') { rideDown(); return true; }
      player.vel.set(0, 0, 0); player.speed = 0;
      const [bx, bz] = W(TT.barUse.x, TT.barUse.z);
      player.pos.x = bx; player.pos.z = bz; player.yaw = PI;
      game.places.openShop('skybar'); stats.drinks++;
      return true;
    },
    greet() { return SKYBAR_GREET[S.greetN++ % SKYBAR_GREET.length]; },
    // F on the terrace: the nearest free seat in reach
    seatNear(p) {
      if (!S.on) return null;
      let best = null, bd = 1.3;
      for (const s of T.seats) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd && !s.taken) { bd = d; best = s; } }
      return best && { x: best.x, z: best.z, y: best.y, yaw: best.yaw, kind: best.kind, ref: best, floorY: best.floorY };
    },
    wait,
    hint() {
      const u = nearUse();
      return [...(u ? [['E', u.hint]] : []), ...(game.act.fHint() ? [game.act.fHint()] : []), ['WASD', 'skate'], ['Space', 'jump'], ['K', 'cinematic camera']];
    },
    seatHint() { return [['1', 'wait for sunset (19:30)'], ['2', 'wait for night (22:00)'], ['K', 'cinematic camera'], ['F / E / WASD', 'get up']]; },
    // the helicopter tried to come down on the deck (vehicles/vehicles.js)
    noLand() {
      stats.noLand++;
      if (timeU.value > S.noLandT) { S.noLandT = timeU.value + 4; hud.toast('NO LANDING ON THE TERRACE', 'THE GLASSWATER TOWER PAD IS JUST UP THE STREET'); }
    },
    update(dt) {
      const was = S.on;
      if (!cut.active) S.on = onDeck();
      if (S.on !== was) setBoost(S.on);
      // a fixed, solid edge: whatever happens, a courier on the deck stays inside the glass and on the deck
      if (S.on && !cut.active && !game.busy) {
        const w = TT.walk, lx = player.pos.x - X, lz = player.pos.z - Z;
        const cx = clamp(lx, w.x0, w.x1), cz = clamp(lz, w.z0, w.z1);
        if (cx !== lx || cz !== lz) { player.pos.x = X + cx; player.pos.z = Z + cz; stats.clamps++; }
        if (player.pos.y < Y - 0.02) { player.pos.y = Y; player.vy = Math.max(0, player.vy); player.onGround = true; }
      }
      // seated: show the choice once; getting up stops a wait
      const st = seated();
      if (st && S.sitToast !== game.act.seat.ref) {
        S.sitToast = game.act.seat.ref;
        hud.toast('THE VIEW FROM FLOOR 23', game.input.touchMode ? 'SUNSET or NIGHT to wait · GET UP any time' : '1: WAIT FOR SUNSET · 2: WAIT FOR NIGHT · F: GET UP');
      }
      if (!st) { S.sitToast = null; camWas = false; if (S.wait) endWait(false); }
      else if (S.wait && env.target === null) endWait(true);
      // June: polishing glasses, an eye on whoever is at the bar
      // the deck's own pieces (June, the hut doors, the glass, the light pools, the guests) are only drawn when the
      // camera can see the deck: up there, or high up nearby (the helicopter); never from the street below
      const cy = camera.position.y, dd = Math.hypot(camera.position.x - X, camera.position.z - Z);
      const near = !game.inside && game.districts.showB && (S.on || (cy > 30 && dd < 420) || (cy > Y - 25 && dd < 600));
      T.glass.visible = T.pools.visible = near;
      june.g.visible = near && !game.inside; hutL.visible = hutR.visible = near && !game.inside;
      if (june.g.visible && S.on) {
        const t = timeU.value, kk = reducedMotion ? 0.3 : 1, served = game.busy === 'shop' && game.places.shop === 'skybar';
        june.armR.rotation.set(-1.1, 0, -0.3 + Math.sin(t * 3.0) * 0.25 * kk); june.armL.rotation.set(-1.0, 0, 0.35);
        const look = served ? Math.atan2(player.pos.x - june.x, player.pos.z - june.z) : Math.sin(t * 0.4) * 0.5 * kk;
        june.head.rotation.y = damp(june.head.rotation.y, clamp(angleDelta(0, look), -0.9, 0.9), 4, dt);
        june.talking = served && game.eat && !game.eat.active && Math.sin(t * 0.7) > 0.4;
        june.tickFace(dt);
      }
      guestsTick(dt, near && !game.inside);
    },
    // ---- automated checks
    state: () => ({ on: S.on, y: +player.pos.y.toFixed(3), x: +(player.pos.x - X).toFixed(2), z: +(player.pos.z - Z).toFixed(2), deck: Y, inside: game.inside && game.inside.key, busy: game.busy,
      seated: seated(), wait: S.wait, tod: +env.tod.toFixed(2), guests: guests.filter((g) => g.on).length, moving: guests.filter((g) => g.on && g.mv).length, gpos: guests.filter((g) => g.on).map((g) => [g.i, +(g.x - X).toFixed(2), +(g.z - Z).toFixed(2), g.s.kind, g.mv ? g.mv.then : null]), want, view: { ...VIEW }, hut: +hutOpen.toFixed(2), stats: { ...stats } }),
    // put the courier on the deck at terrace (x, z) (checks only; the lift is the real way up)
    warp(lx = TT.lift.x + 0.3, lz = 0) { api.checking = true; toRoof(true); api.checking = false; player.pos.x = X + lx; player.pos.z = Z + lz; return api.state(); },
    // set the guests for an hour and weather at once (checks)
    settle() { for (const g of guests) setGuest(g, g.i < Math.min(NG, terraceGuests(env.tod, env.weather, env.w.rain))); return guests.filter((g) => g.on).length; },
    seats: () => T.seats.map((s) => ({ x: +(s.x - X).toFixed(2), z: +(s.z - Z).toFixed(2), kind: s.kind, taken: s.taken })),
    terrace: T,
  };
  return api;
}
