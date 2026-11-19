// Random street events that reward good deeds. Every few minutes (never during a job, a scene, indoors,
// in the helicopter or the tank, or while wanted) the director starts one near you: a blinking blip on
// the minimap, a toast, a couple of subtitle lines and an objective in the HUD, with a timer where it
// adds tension.
//   BAG SNATCHER     someone grabs a shopper's bag and runs along the sidewalks. Tackle them (bump into
//                    them on foot, on skates or the Comet), pick up the bag and give it back: a share of
//                    the cash. Lost if the snatcher gets too far ahead or the clock runs out.
//   GETAWAY CAR      an alarm at a shop, a getaway car tears off with a patrol car after it. Ram it or stop
//                    it (blasters, bangs) until it gives up: the patrol thanks you with a reward, and knocks
//                    a star off if you had heat. The stolen takings drop out: return them to the shopkeeper
//                    for an extra share.
//   SUSPECT ON FOOT  a patrol radio call: tackle the runner before they get away; the officer pays out.
// Event people never get hurt: tackles are the same cartoon tumble as a bump on skates.
import * as THREE from 'three';
import { box, merge, unseen, outOfSight, timeU, reducedMotion } from '../core/util.js';
import { CAST } from './story.js';
import { readTime, makeMarker } from './cutscene.js';
import { zoneName } from '../world/layout.js';
import { disabled, frac } from './damage.js';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const title = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
const LINES = {
  bagStart: ["Hey! My bag! Somebody stop that snatcher!", "That's my handbag! My lucky comb is in there!", "Stop! Thief! That bag is older than you are!"],
  bagTackle: ["Gotcha! Bags are for owners, pal.", "Down you go. Nobody outruns eight wheels."],
  bagPick: ["One handbag, slightly dramatic. Let's get it home."],
  bagThanks: ["My bag! Everything's still in it, even the emergency mints. Here, for your trouble!", "You're an angel on wheels! Take this, I insist."],
  bagFail: ["Gone. And my lucky comb was in there.", "Well. There goes my bus fare."],
  carStart: (z, dir) => `Alarm at a shop in ${z}! Getaway car heading ${dir}, the takings on the back seat. Units in pursuit.`,
  carStop: ["Nice driving, citizen! We'll take it from here.", "Smooth! That's the most fun this shift has had all week."],
  carStar: "And we'll forget about that earlier business. Just this once.",
  carCash: ["My takings! You're a hero. Here's a cut, and a free keychain.", "The whole week's float! Take a share, you earned it."],
  carFail: "Suspect vehicle lost. All units, resume patrol.",
  susStart: (z) => pick([`All units: suspect on foot near ${z}! Wanted for swapping price stickers at the Pantry.`, `Suspect on foot near ${z}, wanted for eleven unpaid parking tickets at the pier. Approach with sirens.`]),
  susTackle: ["Textbook tackle! The Coast Patrol owes you one.", "Nice catch, skater! Sit tight, pal, you're coming with us."],
  susFail: "Suspect's given us the slip. All units, stand down.",
};
const TYPES = ['bag', 'getaway', 'suspect'];

export function createEvents(game, scene) {
  const { peds, traffic, vehicles, hud, audio, player, L, damage, cut } = game;
  let E = null, next = 75, last = null, sayTok = 0;
  const stats = { started: 0, won: 0, failed: 0, paid: 0, last: null };

  // ---- subtitles without a scene (the director's own lines win if a scene starts)
  const sub = $('sub');
  function say(who, text, secs) {
    if (cut.active || !text) return;
    const c = CAST[who] || { name: who, color: '#fff' };
    sub.textContent = '';
    const b = document.createElement('b'), t = document.createElement('span');
    b.textContent = c.name; b.style.color = c.color; t.className = 'txt'; t.textContent = text;
    sub.append(b, t);
    audio.talk(c.voice || 1);
    const tok = ++sayTok;
    setTimeout(() => { if (tok === sayTok && !cut.active && sub.firstChild === b) sub.textContent = ''; }, (secs || readTime(text) + 0.8) * 1000);
  }

  // ---- the two bags (the shopper's handbag, the stolen takings): one instanced mesh, one marker ring
  const bagMesh = new THREE.InstancedMesh(merge([
    box(0.42, 0.3, 0.16, 0, 0.15, 0, '#ffffff'), box(0.44, 0.06, 0.18, 0, 0.27, 0, '#d8d0e0'),
    box(0.04, 0.16, 0.04, -0.13, 0.38, 0, '#3a3046'), box(0.04, 0.16, 0.04, 0.13, 0.38, 0, '#3a3046'), box(0.3, 0.04, 0.04, 0, 0.46, 0, '#3a3046'),
    box(0.12, 0.08, 0.17, 0, 0.17, 0, '#ffe14a'),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true }), 2);
  bagMesh.setColorAt(0, new THREE.Color('#ff5fa8')); bagMesh.setColorAt(1, new THREE.Color('#39d98a'));
  bagMesh.frustumCulled = false; bagMesh.visible = false;
  scene.add(bagMesh);
  const mark = makeMarker(scene, '#ffd166', 1.2, 6);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const bags = [{ held: null, x: 0, z: 0 }, { held: null, x: 0, z: 0 }];
  function drawBags() {
    let any = false;
    bags.forEach((b, i) => {
      let x = 0, y = 0, z = 0, yaw = 0;
      if (b.held && b.held !== 'player' && !b.held.off) { const p = b.held, s = Math.sin(p.yaw), c = Math.cos(p.yaw); x = p.x - c * 0.34; y = 0.62; z = p.z + s * 0.34; yaw = p.yaw; }
      else if (b.held === 'ground') { x = b.x; y = 0.05 + (reducedMotion ? 0 : Math.abs(Math.sin(timeU.value * 3)) * 0.15); z = b.z; yaw = timeU.value * 1.5; if (Math.random() < 0.3) game.fx.trail(x, 0.5, z, i ? '#8dffb0' : '#ffd166'); }
      else { bagMesh.setMatrixAt(i, ZERO); return; }
      any = true;
      m4.compose(v3.set(x, y, z), q.setFromEuler(e3.set(0, yaw, 0)), one); bagMesh.setMatrixAt(i, m4);
    });
    bagMesh.visible = any; bagMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- helpers
  const focus = () => game.focus();
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function objective(text) { if (!E) return; game.mission = { title: E.title, text, time: E.t > 0 && E.timed ? E.t : null, evt: true }; }
  function lock(p, evt) { if (!p) return; p.evtLock = true; p.evt = evt || null; }
  function release(p) { if (p && (p.evtLock || p.evt)) peds.free(p); }
  // a calm passer-by between rmin and rmax of you, or (if everyone nearby has run off) someone brought
  // out on a sidewalk behind the camera, out of view
  function someone(rmin, rmax) {
    const f = focus(), w = peds.walkers(f.x, f.z, rmin, rmax)[0];
    if (w) return w;
    const cp = game.camera.position, a = Math.atan2(f.x - cp.x, f.z - cp.z), d = (rmin + rmax) / 2;
    return peds.spawnNear(f.x - Math.sin(a) * d, f.z - Math.cos(a) * d);
  }
  function pay(n, title, why) { game.money += n; stats.paid += n; audio.thanks(); audio.cash(); hud.toast(title, `${why} · +$${n}`); }
  // bumped into on foot (or run into on the Comet / by a car: that knocks them down anyway)
  function tackled(p) {
    if (peds.isDown(p)) return true;
    const f = focus(), d = dist(p, f);
    if (!game.vehicle && d < 1.1 && player.pos.y < 1.3) { peds.tackle(p, player.vel.x * 0.7 + (p.x - f.x) * 2, player.vel.z * 0.7 + (p.z - f.z) * 2); player.vel.x *= 0.4; player.vel.z *= 0.4; audio.thud(0.5); return true; }
    if (game.vehicle && game.vehicle.kind === 'bike' && d < 1.6) { const v = game.vehicle; peds.tackle(p, v.vx * 0.5, v.vz * 0.5); return true; }
    return false;
  }
  function finish(ok, why) {
    if (!E) return;
    const e = E;
    E = null; stats.last = { type: e.type, ok, why };
    if (ok) stats.won++; else stats.failed++;
    if (game.mission && game.mission.evt) game.mission = null;
    mark.visible = false; bags[0].held = bags[1].held = null; drawBags();
    for (const p of [e.victim, e.thief, e.keeper]) release(p);
    if (e.suspect) { const s = e.suspect; setTimeout(() => release(s), ok ? 9000 : 0); }
    // the patrol car pulls up by a caught suspect for a few seconds, then goes back on the beat
    if (e.cop && e.cop.ai) { const cop = e.cop; if (ok && e.type === 'suspect') setTimeout(() => { if (cop.ai && cop.ai.chase === e.suspect) cop.ai.chase = null; }, 9000); else cop.ai.chase = null; }
    if (e.car) { const c = e.car; if (c.ai) c.ai.getaway = false; c.evtCar = false; c.color = e.paint; vehicles.paint(c, c.color); }
    if (!ok && why) hud.toast(e.title + ': FAILED', why);
    next = 150 + Math.random() * 90;
  }

  // ---- BAG SNATCHER
  function startBag() {
    const victim = someone(12, 55);
    if (!victim) return false;
    let thief = peds.walkers(victim.x, victim.z, 3, 28).find((p) => p !== victim);
    if (!thief) { thief = peds.spawnNear(victim.x + 9, victim.z); if (!thief || thief === victim) return false; }
    lock(victim, { mode: 'hold', gesture: 'bag', face: thief });
    lock(thief, { mode: 'goto', x: victim.x, z: victim.z, speed: 6.5 });
    E = { type: 'bag', title: 'BAG SNATCHER', phase: 'grab', t: 90, timed: true, victim, thief, grabT: 0, reward: 60 + Math.round(Math.random() * 5) * 10 };
    bags[0].held = victim;
    hud.toast('BAG SNATCHER!', 'TACKLE THE SNATCHER · BUMP INTO THEM');
    objective('Stop the bag snatcher');
    return true;
  }
  function stepBag(dt) {
    const { victim: V, thief: T } = E, f = focus();
    if (E.phase === 'grab') {
      E.grabT += dt;
      T.evt.x = V.x; T.evt.z = V.z;
      if (dist(T, V) < 0.9 || E.grabT > 5) {
        // snatched: the shopper shakes a fist, the snatcher legs it along the sidewalks away from you
        bags[0].held = T; V.evt = { mode: 'hold', gesture: 'fist', face: T };
        peds.free(T); T.evtLock = true; T.flee = 999; T.runSpeed = 6.3; T.tx = f.x; T.tz = f.z;
        say('SHOPPER', pick(LINES.bagStart)); audio.hey(V.voice || 1, 1);
        E.phase = 'chase';
      }
      objective('Stop the bag snatcher');
      return;
    }
    if (E.phase === 'chase') {
      T.tx = f.x; T.tz = f.z; T.flee = 999;
      const d = dist(T, f);
      if (tackled(T)) {
        bags[0].held = 'ground'; bags[0].x = T.x + 0.8; bags[0].z = T.z + 0.5;
        T.flee = 8; T.runSpeed = 5.6;
        say('SKYE', pick(LINES.bagTackle)); audio.knock(1);
        E.phase = 'pickup';
      } else if (d > 85) { say('SHOPPER', pick(LINES.bagFail)); finish(false, 'THE SNATCHER GOT AWAY'); return; }
      else objective(`Catch the bag snatcher (${Math.round(d)} m)`);
    }
    if (E.phase === 'pickup') {
      const b = bags[0], r = game.vehicle ? 2.6 : 1.7;
      if (Math.hypot(b.x - f.x, b.z - f.z) < r && Math.abs(f.y || 0) < 2) {
        b.held = 'player'; audio.pickup(); say('SKYE', LINES.bagPick[0]);
        V.evt = { mode: 'hold', gesture: 'wave' }; E.phase = 'return';
        hud.toast('GOT THE BAG', 'GIVE IT BACK TO ITS OWNER');
      } else objective('Pick up the bag');
    }
    if (E.phase === 'return') {
      if (dist(V, f) < 2.8 && Math.abs(f.y || 0) < 2) {
        say('SHOPPER', pick(LINES.bagThanks)); pay(E.reward, 'BAG RETURNED', 'THE SHOPPER SAYS THANKS');
        finish(true); return;
      }
      objective('Return the bag to its owner');
    }
    if (E.phase === 'chase' || E.phase === 'pickup') T.evtLock = true;
  }

  // ---- GETAWAY CAR
  function startGetaway() {
    const f = focus();
    // a shop front 45-120 m away, out of sight if possible
    const shops = L.buildings.filter((b) => !b.hotel && !b.place).map((b) => ({ b, x: b.cx - b.w * 0.2, z: b.z1 + 1.6 }))
      .filter((s) => { const d = Math.hypot(s.x - f.x, s.z - f.z); return d > 45 && d < 120; });
    if (!shops.length) return false;
    shops.sort((a, b) => (outOfSight(game.camera, b.x, b.z, L.solids) ? 1 : 0) - (outOfSight(game.camera, a.x, a.z, L.solids) ? 1 : 0) || Math.random() - 0.5);
    const s = shops[0];
    const car = vehicles.cars.find((c) => c.traffic && c.off && c.kind === 'car') ||
      vehicles.cars.find((c) => c.traffic && c.ai && !c.driven && !c.evtCar && c.kind === 'car' && !c.wreck && unseen(game.camera, c.x, c.z, 50));
    const cop = traffic.police.find((c) => !c.off && c.ai && !c.driven && !c.wreck && !c.ai.chase) || traffic.police.find((c) => c.off);
    if (!car || !cop) return false;
    const yaw = f.x < s.x ? Math.PI / 2 : -Math.PI / 2;
    traffic.railNear(car, s.x, s.z + 5, yaw);
    damage.repair(car);
    const paint = car.color;
    vehicles.paint(car, '#2a2140');
    Object.assign(car, { evtCar: true, hasDriver: true });
    car.ai.getaway = true; car.ai.speed = 6; car.ai.cruise = car.ai.cruise || 10;
    const s2 = Math.sin(car.yaw), c2 = Math.cos(car.yaw);
    traffic.railNear(cop, car.x - s2 * 24, car.z - c2 * 24, car.yaw);
    damage.repair(cop); vehicles.paint(cop, '#19b8b0');
    cop.ai.chase = car; cop.hasDriver = true;
    const keeper = peds.spawnNear(s.x, s.z);
    if (keeper) { lock(keeper, { mode: 'hold', gesture: 'point', face: car }); keeper.x = s.x; keeper.z = s.z; }
    E = { type: 'getaway', title: 'GETAWAY CAR', phase: 'chase', t: 100, timed: true, car, cop, keeper, paint, shop: s, reward: 150 + Math.round(Math.random() * 10) * 10, bonus: 80 + Math.round(Math.random() * 4) * 10 };
    audio.bell(); audio.radio();
    const dir = Math.abs(Math.sin(car.yaw)) > 0.7 ? (Math.sin(car.yaw) > 0 ? 'east' : 'west') : Math.cos(car.yaw) > 0 ? 'for the beach' : 'inland';
    say('DISPATCH', LINES.carStart(title(zoneName(s.x, s.z)), dir));
    hud.toast('GETAWAY CAR!', 'RAM IT OR STOP IT · HELP THE PATROL');
    objective('Stop the getaway car');
    return true;
  }
  function stepGetaway() {
    const { car, cop } = E, f = focus();
    if (E.phase === 'chase') {
      if (car.off) { finish(false, 'THE GETAWAY CAR GOT AWAY'); return; }
      if (disabled(car)) {
        // it gives up: the patrol pulls up, thanks you, the takings fall out
        if (car.ai) car.ai.getaway = false;
        say('OFFICER', pick(LINES.carStop));
        pay(E.reward, 'GETAWAY STOPPED', 'COAST PATROL REWARD');
        if (game.wanted > 0) { game.wanted--; setTimeout(() => say('OFFICER', LINES.carStar), 3200); hud.toast('GETAWAY STOPPED', `COAST PATROL REWARD · +$${E.reward} · ONE STAR OFF`); }
        const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
        bags[1].held = 'ground'; bags[1].x = car.x + c * 2.2; bags[1].z = car.z - s * 2.2;
        E.phase = 'cash'; E.t = 60; E.paid = true;
        return;
      }
      const d = dist(car, f);
      if (d > 170) { say('DISPATCH', LINES.carFail); finish(false, 'THE GETAWAY CAR GOT AWAY'); return; }
      objective(`Stop the getaway car: ram it or blast it (${Math.round(frac(car) * 100)}%)`);
      return;
    }
    if (E.phase === 'cash') {
      const b = bags[1], r = game.vehicle ? 2.8 : 1.8;
      if (Math.hypot(b.x - f.x, b.z - f.z) < r && Math.abs(f.y || 0) < 2) { b.held = 'player'; audio.pickup(); E.phase = 'return'; hud.toast('GOT THE TAKINGS', 'RETURN THEM TO THE SHOPKEEPER'); }
      else objective('Bonus: pick up the stolen takings');
    }
    if (E.phase === 'return') {
      const k = E.keeper || E.shop;
      if (dist(k, f) < 3 && Math.abs(f.y || 0) < 2) {
        if (E.keeper) E.keeper.evt = { mode: 'hold', gesture: 'wave' };
        say('SHOPKEEP', pick(LINES.carCash)); pay(E.bonus, 'TAKINGS RETURNED', 'THE SHOPKEEPER\'S SHARE');
        finish(true); return;
      }
      objective('Bonus: return the takings to the shopkeeper');
    }
    if (cop && cop.ai && !disabled(cop)) cop.ai.chase = car;
  }

  // ---- SUSPECT ON FOOT
  function startSuspect() {
    const f = focus();
    const sus = someone(18, 50);
    if (!sus) return false;
    const cop = traffic.police.find((c) => !c.off && c.ai && !c.driven && !c.wreck && !c.ai.chase) || traffic.police.find((c) => c.off);
    if (!cop) return false;
    // the patrol car turns up on the road behind the runner, siren on; the runner bolts away from you
    const away = Math.atan2(sus.x - f.x, sus.z - f.z);
    traffic.railNear(cop, sus.x - Math.sin(away) * 22, sus.z - Math.cos(away) * 22, Math.abs(Math.sin(away)) > 0.7 ? Math.sign(Math.sin(away)) * Math.PI / 2 : Math.cos(away) > 0 ? 0 : Math.PI);
    damage.repair(cop); vehicles.paint(cop, '#19b8b0');
    cop.ai.chase = sus; cop.hasDriver = true;
    lock(sus); sus.flee = 999; sus.runSpeed = 6.0; sus.tx = f.x; sus.tz = f.z;
    E = { type: 'suspect', title: 'SUSPECT ON FOOT', phase: 'chase', t: 60, timed: true, suspect: sus, cop, reward: 120 + Math.round(Math.random() * 8) * 10 };
    audio.radio();
    say('DISPATCH', LINES.susStart(title(zoneName(sus.x, sus.z))));
    hud.toast('SUSPECT ON FOOT', 'TACKLE THEM BEFORE THEY GET AWAY');
    objective('Tackle the suspect');
    return true;
  }
  function stepSuspect() {
    const { suspect: S } = E, f = focus();
    if (E.phase === 'chase') {
      S.tx = f.x; S.tz = f.z; S.flee = 999;
      const d = dist(S, f);
      if (tackled(S)) {
        S.evt = { mode: 'sit', face: E.cop };
        say('OFFICER', pick(LINES.susTackle));
        pay(E.reward, 'SUSPECT CAUGHT', 'COAST PATROL REWARD');
        finish(true); return;
      }
      if (d > 85) { say('DISPATCH', LINES.susFail); finish(false, 'THE SUSPECT GOT AWAY'); return; }
      objective(`Tackle the suspect (${Math.round(d)} m)`);
    }
  }

  const START = { bag: startBag, getaway: startGetaway, suspect: startSuspect };
  const STEP = { bag: stepBag, getaway: stepGetaway, suspect: stepSuspect };
  const canStart = () => game.started && !game.busy && !game.inside && !(game.story && game.story.active) && !game.wanted && !cut.active && !(game.act && game.act.dancing) && game.mode !== 'heli' && game.mode !== 'tank' && !game.paused;

  const api = {
    stats,
    get active() { return E; },
    start(type) {
      if (E) finish(false, null);
      const t = type || pick(TYPES.filter((k) => k !== last));
      if (!START[t] || !START[t]()) return false;
      last = t; stats.started++;
      return true;
    },
    cancel() { finish(false, null); },
    // a car (or the Comet) hitting an event person: part of the event, never heat
    pedHit(p) { return !!E && (p === E.thief || p === E.victim || p === E.suspect || p === E.keeper); },
    blips(out) {
      if (!E || game.inside) return;
      const key = E.type === 'bag' ? (E.phase === 'pickup' ? bags[0] : E.phase === 'return' ? E.victim : E.thief)
        : E.type === 'getaway' ? (E.phase === 'chase' ? E.car : E.phase === 'cash' ? bags[1] : E.keeper || E.shop) : E.suspect;
      if (key) out.push({ x: key.x, z: key.z, color: E.phase === 'return' || E.phase === 'cash' || E.phase === 'pickup' ? '#ffd166' : '#ff3f6a', big: true, blink: !reducedMotion, diamond: E.phase === 'return' });
    },
    // where the thing you are after is (debug teleports)
    target() {
      if (!E) return null;
      const k = E.type === 'bag' ? (E.phase === 'pickup' ? bags[0] : E.phase === 'return' ? E.victim : E.thief)
        : E.type === 'getaway' ? (E.phase === 'chase' ? E.car : E.phase === 'cash' ? bags[1] : E.keeper || E.shop) : E.suspect;
      return k && { x: k.x, z: k.z };
    },
    state() { return E ? { type: E.type, phase: E.phase, t: +E.t.toFixed(1), reward: E.reward, carHp: E.car ? Math.round(E.car.hp) : null, copChase: !!(E.cop && E.cop.ai && E.cop.ai.chase), target: api.target() } : { type: null, next: +next.toFixed(1), last: stats.last }; },
    update(dt) {
      if (!E) {
        if (canStart()) { next -= dt; if (next <= 0) { if (!api.start()) next = 10; } }
        return;
      }
      // a story job, a knock-out or a bust ends the event quietly
      if ((game.story && game.story.active) || game.busy === 'down') { finish(false, null); return; }
      if (E.timed) {
        E.t -= dt;
        if (E.t <= 0) {
          if (E.type === 'bag') say('SHOPPER', pick(LINES.bagFail));
          else if (E.type === 'suspect') say('DISPATCH', LINES.susFail);
          else if (!E.paid) say('DISPATCH', LINES.carFail);
          finish(!!E.paid, E.paid ? null : 'OUT OF TIME'); return;
        }
      }
      STEP[E.type](dt);
      if (E) {
        const k = api.target(), ring = E.phase === 'pickup' || E.phase === 'return' || E.phase === 'cash';
        mark.visible = ring && !game.inside && !!k;
        if (mark.visible) mark.position.set(k.x, 0, k.z);
      }
      drawBags();
    },
  };
  return api;
}
