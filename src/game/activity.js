// Things the courier does standing still: patting the beach dog, sitting down (benches, loungers, stools, sofas, the seawall,
// the pier, the sand...) and dancing on the Club Prism floor, with a light rhythm game on top:
// hit a move key on the beat to build a combo and the vibe meter, the floor flares, the crowd cheers
// and copies you, and a hot streak earns tips.
import { clamp, lerp, damp, angleDelta, PI, reducedMotion, beatU, beatNow } from '../core/util.js';
import { HX, HZ, PIER } from '../world/layout.js';
import { OY } from './interiors.js';
import { MOVES, newPose, dancePose, blendPose, copyPose } from '../actors/moves.js';

const $ = (id) => document.getElementById(id);
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const WINDOW = 0.22, PERFECT = 0.1;          // timing windows, in beats either side of the beat

export function createActivity(game) {
  const { player, L, hud, audio, camera } = game;
  const stand = newPose(), tgt = newPose(), cur = newPose();
  const A = {
    mode: null, seat: null, move: 0, combo: 0, best: 0, vibe: 0, rival: null, contest: false,
    get sitting() { return A.mode === 'sit'; },
    get dancing() { return A.mode === 'dance'; },
    get rising() { return A.mode === 'sit' && dir < 0; },          // getting up off a seat
  };
  let k = 0, dir = 0, from = { x: 0, z: 0, yaw: 0 }, idleT = 0, idleK = 0, lastHit = -99, same = 0, lastMove = -1, judgeT = 0, orbitA = 0, camK = 0;
  const camPos = { x: 0, y: 0, z: 0 };

  // ---- where could I sit right now? Indoors: the room's seats. Outside: benches & co, or the sand.
  const room = () => (game.inside ? game.inside.room : null);
  function candidate() {
    const p = player.pos, r = room();
    if (r) {
      let best = null, bd = 1.3;
      const ly = p.y - OY;
      for (const s of r.seats) { const d = Math.hypot(r.ox + s.x - p.x, r.oz + s.z - p.z); if (d < (s.r || bd) && d < bd && !s.taken && Math.abs((s.fy || 0) - ly) < 1.2) { bd = d; best = s; } }
      // (a seat on an upper floor, or sunk into a hot tub, says where its floor is: fy)
      return best && { x: r.ox + best.x, z: r.oz + best.z, y: best.y, yaw: best.yaw, kind: best.kind, ref: best, ...(best.fy !== undefined ? { floorY: OY + best.fy } : {}) };
    }
    if (p.y > 0.3) return game.spire ? game.spire.seatNear(p) : null;     // up on the Solstice Terrace (game/spire.js)
    const s = L.props.nearest(p.x, p.z, 1.4);
    if (s) return { x: s.x, z: s.z, y: s.y, yaw: s.yaw, kind: s.kind, ref: s.line ? null : s };
    // the beach: anywhere on the sand, facing the way you were facing
    const onPier = p.x > PIER.x0 - 0.5 && p.x < PIER.x1 + 0.5 && p.z > HZ - 2;
    if (p.z > 80 && p.z < HZ - 1 && Math.abs(p.x) < HX - 4 && !onPier && player.speed < 1.2) return { x: p.x, z: p.z, y: 0, yaw: player.yaw, kind: 'sand', ref: null };
    return null;
  }
  const onFloor = () => {
    const r = room();
    return !!r && game.inside.key === 'club' && !!r.tileAt(player.pos.x - r.ox, player.pos.z - r.oz);
  };

  // ---- seated poses (the courier's legs pivot 0.96 m up)
  const ground = (kind) => kind === 'sand' || kind === 'towel' || kind === 'ground';
  function sitTarget(s, o, t) {
    const H = 0.96, y = s.y + (ground(s.kind) ? 0.12 : 0.06);
    copyPose(stand, o);
    o.y = y - H; o.hx = 0; o.knee = 1;
    if (ground(s.kind)) {
      o.rx = -0.3; o.lL[0] = -1.35; o.lR[0] = -1.2; o.lL[1] = 0.12; o.lR[1] = -0.12;
      o.aL[0] = 0.75; o.aL[2] = 0.35; o.aR[0] = 0.75; o.aR[2] = -0.35;
    } else if (s.kind === 'lounger') {
      o.rx = -0.6; o.lL[0] = o.lR[0] = -1.05; o.lL[1] = 0.05; o.lR[1] = -0.05; o.aL[2] = 0.3; o.aR[2] = -0.3; o.hx = 0.25; o.knee = 0.15;
    } else {
      // thighs level on the seat, the knees bend so the feet reach the floor (or dangle off a high seat)
      const a = y < 0.35 ? Math.max(Math.acos(clamp(y / 0.9, -1, 1)), 0.95) : 1.45;
      o.rx = -0.06; o.lL[0] = -a; o.lR[0] = -a + 0.1; o.lL[1] = 0.06; o.lR[1] = -0.06;
      o.aL[0] = -0.5; o.aL[2] = 0.18; o.aR[0] = -0.5; o.aR[2] = -0.18;
    }
    if (t === undefined) return o;
    // idles: look around, lean back, (on the sand) arms behind the head and lie back a little
    const v = idleK % 3, w = ease(Math.min(idleT, 1.2) / 1.2);
    o.hy = Math.sin(t * 0.7) * (v === 0 ? 0.7 : 0.25) * (reducedMotion ? 0.4 : 1);
    if (v === 1) {
      if (ground(s.kind)) { o.rx = lerp(o.rx, -0.5, w); o.aL[0] = lerp(o.aL[0], 1.05, w); o.aR[0] = lerp(o.aR[0], 1.05, w); }
      else if (s.kind !== 'lounger') { o.rx = lerp(o.rx, -0.2, w); o.aL[2] = lerp(o.aL[2], 1.25, w); o.aR[2] = lerp(o.aR[2], -1.25, w); o.aL[0] = lerp(o.aL[0], 0.15, w); o.aR[0] = lerp(o.aR[0], 0.15, w); }
    } else if (v === 2 && (ground(s.kind) || s.kind === 'lounger')) {
      o.rx = lerp(o.rx, ground(s.kind) ? -0.75 : -0.65, w);
      o.aL[0] = lerp(o.aL[0], -3.1, w); o.aL[2] = lerp(o.aL[2], 0.75, w); o.aR[0] = lerp(o.aR[0], -3.1, w); o.aR[2] = lerp(o.aR[2], -0.75, w); o.hx = lerp(o.hx, 0.25, w);
    }
    return o;
  }

  function sit(s) {
    A.mode = 'sit'; A.seat = s; k = 0; dir = 1; idleT = 0; idleK = 0;
    from = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    if (s.ref) s.ref.taken = 'player';
    player.vel.set(0, 0, 0); player.speed = 0;
    audio.step(0.6);
  }
  function getUp() { if (A.mode === 'sit' && dir >= 0) { dir = -1; audio.step(0.5); } }
  // ---- patting the beach dog: a short crouch, a few pats, back up (actors/animals.js does the dog's side)
  let patT = 0;
  const PAT_T = 1.6;
  function pat() {
    const d = game.animals && game.animals.pat(player.pos);
    if (!d) return false;
    A.mode = 'pat'; patT = 0;
    from = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    A.patYaw = Math.atan2(d.x - player.pos.x, d.z - player.pos.z);
    player.vel.set(0, 0, 0); player.speed = 0;
    return true;
  }
  function patUpdate(dt, ctl) {
    patT += dt;
    if (patT > 0.5 && (ctl.move || ctl.strafe)) patT = Math.max(patT, PAT_T - 0.2);
    player.yaw += angleDelta(player.yaw, A.patYaw) * (1 - Math.exp(-10 * dt));
    player.pos.y = player.floor;
    // down in 0.35 s, pat pat pat, up in 0.3 s
    const e = ease(Math.min(patT / 0.35, (PAT_T - patT) / 0.3, 1)), t = patT;
    copyPose(stand, cur);
    cur.y = -0.42 * e; cur.rx = 0.42 * e; cur.hx = 0.25 * e;
    cur.lL[0] = -1.25 * e; cur.lR[0] = -0.35 * e; cur.lR[1] = -0.08 * e;
    cur.aR[0] = -1.05 * e + (reducedMotion ? 0 : Math.max(0, Math.sin(t * 15)) * 0.32 * e); cur.aR[2] = -0.1;
    cur.aL[0] = -0.35 * e; cur.aL[2] = 0.25 * e;
    player.applyPose(cur);
    if (patT >= PAT_T) { A.mode = null; player.resetPose(); }
  }
  function endSit() {
    if (A.seat && A.seat.ref && A.seat.ref.taken === 'player') A.seat.ref.taken = null;
    A.mode = null; A.seat = null; player.resetPose();
  }

  // ---- dancing
  const el = {};
  for (const id of ['dance', 'dmoves', 'dpips', 'dring', 'dmove', 'dcombo', 'dvibe', 'drival', 'drivalw', 'djudge']) el[id] = $(id);
  if (el.dmoves && !el.dmoves.children.length) MOVES.forEach((m, i) => { const s = document.createElement('span'); s.textContent = `${i + 1} ${m.name}`; el.dmoves.appendChild(s); });
  function startDance(contest = false) {
    if (A.mode === 'sit') endSit();
    A.mode = 'dance'; A.contest = contest; A.combo = 0; lastHit = -99; same = 0; lastMove = -1; judgeT = 0;
    if (contest) { A.vibe = 0; A.best = 0; }
    copyPose(stand, cur);
    player.vel.set(0, 0, 0); player.speed = 0;
    const r = room();
    orbitA = Math.atan2(camera.position.x - player.pos.x, camera.position.z - player.pos.z); camK = 0;
    camPos.x = camera.position.x; camPos.y = camera.position.y; camPos.z = camera.position.z;
    if (r) player.yaw = PI;
    if (el.dance) el.dance.hidden = false;
    judge('DANCE!', '');
  }
  function stopDance() {
    if (A.mode !== 'dance') return;
    A.mode = null; player.resetPose();
    if (el.dance) el.dance.hidden = true;
    const r = room(); if (r && r.setFocus) r.setFocus(99, 99, 0, false);
  }
  function judge(text, cls) { if (el.djudge) { el.djudge.textContent = text; el.djudge.className = cls; } judgeT = 0.9; }
  // a move key: change move and try to land it on the beat
  function press(m) {
    if (A.mode !== 'dance') return;
    A.move = (m + MOVES.length) % MOVES.length;
    const b = beatNow(), n = Math.round(b), off = Math.abs(b - n), r = room();
    if (off <= WINDOW && n !== lastHit) {
      lastHit = n; A.combo++; A.best = Math.max(A.best, A.combo);
      same = A.move === lastMove ? same + 1 : 0; lastMove = A.move;
      let gain = (off < PERFECT ? 6 : 4) + Math.min(A.combo, 12) * 0.35;
      if (same >= 3) gain *= 0.4;
      if (A.contest) gain *= 0.75;
      A.vibe = Math.min(100, A.vibe + gain);
      judge(same >= 3 ? 'MIX IT UP' : off < PERFECT ? 'PERFECT' : 'GOOD', off < PERFECT ? 'p' : 'g');
      if (r && r.react) r.react(player.pos.x - r.ox, player.pos.z - r.oz, A.move, A.combo);
      audio.beatHit(off < PERFECT);
      if (A.combo >= 8 && A.combo % 8 === 0) {
        const tip = 5 * Math.min(6, A.combo / 8);
        game.money += tip; audio.cash(); judge(`TIP +$${tip}`, 't');
      }
    } else {
      if (A.combo > 2) judge('OFF BEAT', 'm'); else judge(n === lastHit ? 'WAIT FOR IT' : 'OFF BEAT', 'm');
      A.combo = 0; A.vibe = Math.max(0, A.vibe - 4);
      audio.beatMiss();
    }
  }

  function danceUpdate(dt) {
    const b = beatU.value, r = room();
    dancePose(A.move, b, tgt, reducedMotion ? 0.55 : 1);
    cur.spin = tgt.spin + angleDelta(tgt.spin, cur.spin);
    blendPose(cur, tgt, 1 - Math.exp(-12 * dt));
    player.applyPose(cur);
    // combo cools off if you stop hitting beats
    if (A.combo > 0 && beatNow() - lastHit > 2.6) { A.combo = 0; judge('COMBO DROPPED', 'm'); }
    if (beatNow() - lastHit > 2) A.vibe = Math.max(0, A.vibe - dt * (A.contest ? 2.5 : 1.5));
    if (r && r.setFocus) r.setFocus(player.pos.x - r.ox, player.pos.z - r.oz, A.move, true);
    // HUD
    if (el.dance) {
      const ph = b - Math.floor(b), bar = Math.floor(b) & 3;
      [...el.dpips.children].forEach((p, i) => p.classList.toggle('on', i === bar));
      el.dring.style.transform = `scale(${(1.9 - ph * 0.9).toFixed(3)})`;
      el.dring.style.opacity = (ph > 0.78 || ph < 0.22 ? 1 : 0.35).toFixed(2);
      el.dmove.textContent = MOVES[A.move].name;
      [...el.dmoves.children].forEach((s, i) => s.classList.toggle('on', i === A.move));
      el.dcombo.textContent = A.combo > 1 ? `×${A.combo} COMBO` : '';
      el.dvibe.style.transform = `scaleX(${(A.vibe / 100).toFixed(3)})`;
      el.drivalw.hidden = A.rival === null;
      if (A.rival !== null) el.drival.style.transform = `scaleX(${(clamp(A.rival, 0, 100) / 100).toFixed(3)})`;
      judgeT -= dt; if (judgeT <= 0 && el.djudge.textContent) el.djudge.textContent = '';
    }
    // camera: ease into a slow orbit round the dancer (gentler and slower with reduced motion)
    if (r) {
      orbitA += dt * (reducedMotion ? 0.06 : 0.32);
      camK = Math.min(1, camK + dt * 0.8);
      const rad = reducedMotion ? 4.6 : 3.9 + Math.sin(b * PI / 8) * 0.4, y = OY + (reducedMotion ? 2.2 : 1.9 + Math.sin(b * PI / 16) * 0.35);
      let x = player.pos.x + Math.sin(orbitA) * rad, z = player.pos.z + Math.cos(orbitA) * rad;
      x = clamp(x, r.ox - r.hx + 0.6, r.ox + r.hx - 0.6); z = clamp(z, r.oz - r.hz + 0.6, r.oz + r.hz - 0.6);
      const e = 1 - Math.exp(-(1 + camK * 3) * dt);
      camPos.x += (x - camPos.x) * e; camPos.y += (y - camPos.y) * e; camPos.z += (z - camPos.z) * e;
      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.lookAt(player.pos.x, OY + 1.15, player.pos.z);
      game.cut.setFov(56);
    }
  }

  function sitUpdate(dt, ctl) {
    const s = A.seat;
    if (dir > 0 && (ctl.move || ctl.strafe)) getUp();
    k = clamp(k + dt * (dir > 0 ? 1.8 : 2.2) * dir, 0, 1);
    if (k >= 1) { idleT += dt; if (idleT > 7) { idleT = 0; idleK++; } } else idleT = 0;
    const e = ease(k), m = ease(Math.min(1, k * 1.6));
    player.pos.x = lerp(from.x, s.x, m); player.pos.z = lerp(from.z, s.z, m); player.pos.y = s.floorY ?? player.floor;
    const yawFrom = dir > 0 ? from.yaw : s.yaw;
    player.yaw = dir > 0 ? yawFrom + angleDelta(yawFrom, s.yaw) * m : s.yaw;
    sitTarget(s, tgt, k >= 1 ? performance.now() / 1000 : undefined);
    if (k < 1) { tgt.hy = 0; blendPose(stand, tgt, e, cur); cur.hy = 0; } else { blendPose(cur, tgt, 1 - Math.exp(-6 * dt)); cur.hy = tgt.hy; }
    player.applyPose(cur);
    if (dir < 0 && k <= 0) endSit();
  }

  Object.assign(A, {
    candidate, onFloor, sit, getUp, startDance, stopDance, press, pat,
    // F: dance on the floor, sit by a seat, stop dancing, get up
    toggle() {
      if (A.mode === 'dance') { stopDance(); return true; }
      if (A.mode === 'sit') { getUp(); return true; }
      if (A.mode === 'pat') return true;
      if (game.vehicle || game.busy || !player.onGround || (game.swim && game.swim.wet)) return false;
      if (onFloor()) { startDance(false); return true; }
      const rd = game.roofs && game.roofs.near();
      if (rd) { game.roofs.down(rd); return true; }
      const vm = !game.inside && game.loose && game.loose.vendNear(player.pos);
      if (vm) { game.places.openVend(vm); return true; }
      // the Coconut Shack on the beach (actors/beachgoers.js knows whether it is open)
      if (!game.inside && game.peds && game.peds.beach.kioskNear(player.pos)) { player.vel.set(0, 0, 0); player.speed = 0; player.yaw = PI; game.places.openShop('kiosk'); return true; }
      if (!game.inside && game.animals && game.animals.canPat(player.pos) && pat()) return true;
      // on a boat's deck: its own seats, which ride along with it (vehicles/boats.js)
      if (game.boats && game.boats.aboard) { const bs = game.boats.sitHere(); if (bs) { sit(bs); return true; } return false; }
      const s = candidate();
      if (s) { sit(s); return true; }
      return false;
    },
    // movement keys and E get you up; WASD stops the dance (the arrows pick moves while dancing)
    update(dt, ctl, input) {
      if (A.mode === 'sit') sitUpdate(dt, ctl);
      else if (A.mode === 'pat') patUpdate(dt, ctl);
      else if (A.mode === 'dance') {
        if (input && input.isDown('KeyW', 'KeyA', 'KeyS', 'KeyD')) { stopDance(); return; }
        danceUpdate(dt);
      }
    },
    // drop everything at once (scene cuts, leaving a room, a new job step)
    reset() {
      if (A.mode === 'dance') stopDance();
      if (A.mode === 'pat') { A.mode = null; player.resetPose(); }
      if (A.mode === 'sit') { const s = A.seat; endSit(); player.pos.set(from.x, s && s.floorY !== undefined ? s.floorY : player.floor, from.z); if (s) player.yaw = from.yaw; }
      A.contest = false; A.rival = null;
    },
    hint() {
      if (A.mode === 'dance') return [['1-8', 'moves on the beat'], ['← →', 'next / previous move'], ['↑ ↓', 'repeat move'], ['F / WASD', 'stop dancing']];
      if (A.mode === 'sit') return game.spire && game.spire.seated ? game.spire.seatHint() : [['F / E / WASD', 'get up']];
      if (A.mode === 'pat') return [['♥', 'good dog!']];
      return null;
    },
    // extra hint while walking about: is F useful here?
    fHint() {
      if (game.vehicle || !player.onGround || (game.swim && game.swim.wet)) return null;
      if (onFloor()) return ['F', 'dance'];
      if (game.roofs && game.roofs.near()) return ['F', 'stairs down'];
      if (!game.inside && game.loose && game.loose.vendNear(player.pos)) return ['F', 'buy'];
      if (!game.inside && game.peds && game.peds.beach.kioskNear(player.pos)) return ['F', 'buy'];
      if (!game.inside && game.animals && game.animals.canPat(player.pos)) return ['F', 'pat'];
      if (game.boats && game.boats.aboard) return game.boats.seatNear() ? ['F', 'sit'] : null;
      return candidate() ? ['F', 'sit'] : null;
    },
  });
  return A;
}
