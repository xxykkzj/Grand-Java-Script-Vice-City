// Vehicle damage. Every car, bike, patrol car, the tank and the helicopter has a condition (hp). Crashes
// (by how hard you hit), tank shells, patrol lasers, the neon blasters, firework bangs and nearby
// explosions wear it down through visible stages:
//   1  light white smoke from the bonnet                        (below 72 %)
//   2  grey-black smoke and a sputtering engine: top speed and  (below 45 %)
//      acceleration drop a little and it coughs now and then
//   3  flames; a few seconds later a cartoon explosion          (18 % or less)
//      (flash, fireball, debris, a shockwave that throws loose props about, knocks nearby pedestrians
//      off their feet and damages nearby vehicles)
//   4  a charred wreck, cleared once nobody is looking
// The paint darkens and the bonnet crumples as it goes (vehicles.js). On the Comet the rider is thrown
// off instead; the helicopter loses lift and crash-lands. AI drivers pull over at 30 % and bail out
// when it catches fire; a disabled patrol car stops chasing. Normal driving and light bumps do nothing:
// collision damage only starts above about 6.5 m/s of change in speed.
import { clamp, unseen, segBlocked, timeU } from '../core/util.js';
import { resetDamage } from '../vehicles/vehicles.js';

const $ = (id) => document.getElementById(id);
const BURN = { car: 4.6, bike: 3.6, tank: 6, heli: 3.4 };   // seconds on fire before it goes up
const NAME = { car: 'CAR', bike: 'COMET', tank: 'DISCO TANK', heli: 'CHOPPER' };
export const frac = (v) => (v && v.maxHp ? v.hp / v.maxHp : 1);
// AI drivers give up here: patrol cars stop chasing, getaway cars stop running
export const disabled = (v) => !!v && (v.wreck || v.burn > 0 || v.dead || frac(v) <= 0.3);
export function stageOf(v) {
  if (v.wreck) return 4;
  if (v.burn > 0 || v.dead) return 3;
  const f = frac(v);
  return f <= 0.18 ? 3 : f < 0.45 ? 2 : f < 0.72 ? 1 : 0;
}

export function createDamage(game) {
  const { vehicles, fx, audio, hud, player, peds, L, rules } = game;
  const el = { cond: $('vcond'), name: $('vname'), fill: $('vfill'), out: $('getout') };
  let shown = '', outOn = false;
  const speedOf = (v) => (v.kind === 'tank' ? Math.abs(v.speed || 0) : Math.hypot(v.vx || 0, v.vz || 0));

  // shooting up cars in front of the patrol raises the heat; the event getaway car is fair game
  function heatFor(v) {
    if (v.evtCar) return;
    if (v.police && v.ai) { rules.crime('copshot', 1, 5); return; }
    for (const c of game.traffic.police) {
      if (c.off || !c.ai || disabled(c) || Math.hypot(c.x - v.x, c.z - v.z) > 45) continue;
      if (!segBlocked(c.x, c.z, v.x, v.z, L.solids)) { rules.crime('shots', 1, 6); return; }
    }
  }

  // apply damage. by: 'player' (your weapons and bangs: blamed, heat), 'ram' (you crashed into it:
  // blamed, no heat), 'crash', 'police', 'world'. Returns the hp actually lost.
  function hit(v, amt, by = 'world') {
    if (!v || v.wreck || v.off || !(amt > 0)) return 0;
    if (v.hp === undefined) resetDamage(v);
    const arm = v.kind === 'tank' ? (by === 'crash' || by === 'ram' ? 0.04 : 0.22) : 1;
    const before = v.hp;
    v.hp = Math.max(0, v.hp - amt * arm);
    const lost = before - v.hp;
    if (lost <= 0) return 0;
    if (by === 'player') { v.blame = timeU.value; heatFor(v); }
    else if (by === 'ram') v.blame = timeU.value;
    const f = frac(v);
    v.char = Math.max(v.char || 0, clamp((1 - f) * 0.55, 0, 0.5));
    v.dent = Math.max(v.dent || 0, clamp((1 - f) * 1.05 - 0.15, 0, 0.8));
    vehicles.retint(v);
    if (f <= 0.18) ignite(v);
    if (api.onHit) api.onHit(v, lost, by);
    return lost;
  }

  function ignite(v) {
    if (v.burn > 0 || v.wreck) return;
    if (v.kind === 'heli' && !v.dead) {
      // no lift: it drops and lands hard first (vehicles.js), then burns
      v.hp = 0; v.dead = true;
      if (game.vehicle === v) hud.toast('MAYDAY!', 'BRACE FOR A HARD LANDING');
      if (v.y > 0.6 && !v.landed) return;
    }
    v.burn = 0.001; v.hp = Math.min(v.hp, v.maxHp * 0.18);
    audio.thud(0.6);
    // drivers bail out (patrol officers stay out of sight: they only ever appear in their cars)
    if (v.ai && v.hasDriver) {
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
      if (!v.police && !v.evtCar) peds.eject(v.x + c * 1.9, v.z - s * 1.9, c * 3, -s * 3, false);
      v.hasDriver = false;
    }
    if (v === game.vehicle) {
      const sp = speedOf(v);
      if (v.kind === 'bike' && sp > 6 && vehicles.onThrow) vehicles.onThrow(v, sp);       // over the bars instead
      else hud.toast('ON FIRE!', 'GET OUT BEFORE IT BLOWS');
    }
  }

  // a generic blast at a point (vehicle explosions, tank shells, firework bangs, candle stars)
  //   r, dmg: radius and damage at the centre (falls off to 30 % at the edge)
  //   by: who is to blame; src: a vehicle that is not hurt by its own blast; direct + directDmg: a direct hit
  //   push: how hard vehicles are shoved; props: loose-prop strength; knock: pedestrians within this are
  //   knocked off their feet (0 = they only flinch and flee); hurt: courier health lost on foot at the centre
  function blast(x, y, z, o = {}) {
    const R = o.r || 10, D = o.dmg || 40;
    for (const v of vehicles.all()) {
      if (v === o.src) continue;
      const vy = (v.y || 0) + (v.kind === 'heli' ? 1.5 : 0.8);
      const d = Math.max(0, Math.hypot(v.x - x, vy - y, v.z - z) - (v.kind === 'tank' ? 2.2 : v.kind === 'bike' ? 0.6 : 1.2));
      if (d > R) continue;
      const k = 1 - d / R;
      hit(v, D * (0.3 + 0.7 * k) + (v === o.direct ? o.directDmg || 0 : 0), o.by || 'world');
      if (o.push && v.kind !== 'tank' && !v.wreck) {
        const dx = v.x - x, dz = v.z - z, inv = 1 / Math.max(Math.hypot(dx, dz), 0.5), p = o.push * k;
        if (v.ai) v.ai.stun = Math.max(v.ai.stun || 0, 1.6 + k);
        v.vx += dx * inv * p; v.vz += dz * inv * p;
        if (v.kind !== 'heli') { v.vy = Math.max(v.vy || 0, 1 + p * 0.3); v.spin = (v.spin || 0) + (Math.random() - 0.5) * p * 0.35; }
      }
    }
    if (o.direct && !vehicles.all().includes(o.direct)) hit(o.direct, o.directDmg || 0, o.by || 'world');
    if (game.loose) game.loose.blast(x, z, R * 0.85, o.props ?? 1);
    if (o.knock) peds.alarm(x, z, o.scare || 55, o.knock);
    else if (peds.scare) peds.scare(x, z, o.scare || 30, R * 0.6);
    if (!game.vehicle && !player.hidden && !game.inside) {
      const dx = player.pos.x - x, dz = player.pos.z - z, d = Math.hypot(dx, dz), RR = R * 0.8;
      if (d < RR) {
        const k = 1 - d / RR, inv = 1 / Math.max(d, 0.5);
        player.vel.x += dx * inv * k * 12; player.vel.z += dz * inv * k * 12; player.vy = Math.max(player.vy, 4 * k); player.pos.y += 0.05; player.onGround = false;
        if (o.hurt) rules.hurt(k * o.hurt);
      }
    }
  }

  function explode(v) {
    if (v.wreck) return;
    const by = timeU.value - (v.blame || -99) < 15 ? 'player' : 'world';
    const big = v.kind === 'tank' ? 1.6 : v.kind === 'bike' ? 0.65 : v.kind === 'heli' ? 1.3 : 1.1;
    Object.assign(v, { wreck: true, burn: 0, hp: 0, char: 1, dent: 1, wreckT: 0, cut: false, perf: 0, dead: false });
    const y = v.y || 0;
    fx.blast(v.x, y + 0.7, v.z, big);
    audio.bigBoom();
    if (v.ai) v.ai = null;
    v.hasDriver = false; v.jacking = false;
    if (v.kind === 'car' || v.kind === 'bike') {
      v.vy = Math.max(v.vy || 0, 5.5); v.spin = (v.spin || 0) + (Math.random() - 0.5) * 3;
      v.tvx = (Math.random() - 0.5) * 2.4; v.tvz = (Math.random() - 0.5) * 2.4;
    }
    vehicles.retint(v);
    if (v.police && by === 'player') rules.crime('copwreck', 1, 1);
    // nearby vehicles take a beating; anything within reach goes flying; people stumble and run
    blast(v.x, y + 0.6, v.z, { r: 11 * Math.max(0.8, big), dmg: 48 * big, by: by === 'player' ? 'ram' : 'world', src: v, push: 16 * big, props: 1.3, knock: 6.5 * big, scare: 60, hurt: 40 });
    if (game.vehicle === v) rules.hurt(999);                 // still inside: KNOCKED OUT
    if (api.onExplode) api.onExplode(v);
  }

  // the helicopter hits the ground with no lift: sparks, a crunch, and it starts to burn
  vehicles.onCrash = (h, vy) => {
    if (vy > 2) { fx.sparks(h.x, 0.6, h.z, 40); fx.debris(h.x, 1, h.z, 10); audio.crunch(1.2); audio.thud(1); }
    if (!(h.burn > 0)) ignite(h);
    if (vy > 14 && game.vehicle !== h) explode(h);
  };
  // crashes: damage by change of speed (vehicles.js reports both cars of a collision and wall hits)
  vehicles.onImpact = (v, dv, other) => {
    const thr = v.kind === 'bike' ? 5.5 : 6.5;
    if (dv <= thr || v.wreck) return;
    const k = v.kind === 'heli' ? 3.2 : v.kind === 'bike' ? 2.6 : 2.5;
    const amt = (dv - thr) * k;
    hit(v, amt, other && other === game.vehicle ? 'ram' : 'crash');
    if (v === game.vehicle && amt > 6) audio.crunch(Math.min(1.2, amt / 30));
    if (amt > 10 && (v === game.vehicle || other === game.vehicle)) fx.sparks(v.x + Math.sin(v.yaw) * 1.8, 0.7, v.z + Math.cos(v.yaw) * 1.8, 10);
  };
  // tank shells: the shell's blast goes through here too (and a direct hit hurts a lot more)
  vehicles.onBlast = (x, y, z, direct) => {
    blast(x, y, z, { r: 10, dmg: 55, by: game.vehicle === vehicles.tank ? 'player' : 'world', src: vehicles.tank, direct, directDmg: 45, props: 1.4, knock: 9, scare: 55, hurt: 70 });
  };

  function clear(v) {
    if (v.kind === 'tank') { vehicles.removeTank(); return; }
    if (v.kind === 'heli') { const h = v.home; if (h && unseen(game.camera, h.x, h.z, 50)) vehicles.spawnHeli(h.x, h.z, h.yaw); return; }
    const home = v.kind === 'bike' && v.hx !== undefined ? { x: v.hx, z: v.hz, yaw: v.hyaw } : v.park;
    if (!v.traffic && !v.police && home && !unseen(game.camera, home.x, home.z, 50)) return;
    resetDamage(v); vehicles.retint(v);
    if (v.traffic || v.police || !home) { v.off = true; v.ai = null; v.evtCar = false; return; }
    // parked cars and bikes are back on their spot
    Object.assign(v, { x: home.x, z: home.z, yaw: home.yaw, y: 0, vx: 0, vy: 0, vz: 0, spin: 0, tx: 0, tz: 0, tvx: 0, tvz: 0 });
  }

  const sound = { fire: 0 };
  const api = {
    hit, blast, explode, ignite, frac, disabled, stageOf, sound, onHit: null, onExplode: null,
    // the PITSTOP code and debug: good as new
    repair(v) { if (!v) return false; resetDamage(v); vehicles.retint(v); if (v.kind === 'heli') v.landed = false; return true; },
    state(v) { return v && { kind: v.kind, hp: +v.hp.toFixed(1), max: v.maxHp, frac: +frac(v).toFixed(3), stage: stageOf(v), burn: +(v.burn || 0).toFixed(2), wreck: !!v.wreck, perf: v.perf, char: +(v.char || 0).toFixed(2), dent: +(v.dent || 0).toFixed(2), disabled: disabled(v) }; },
    update(dt) {
      const cam = game.camera.position;
      let fire = 0;
      for (const v of vehicles.all()) {
        if (v.hp === undefined) resetDamage(v);
        const st = v.stage = stageOf(v);
        // the engine: a sputtering cough once it's badly smoking
        if (st >= 2 && !v.wreck) {
          v.perf = st >= 3 ? 0.6 : 0.78;
          v.sputT -= dt;
          if (v.sputT <= 0) {
            v.cut = !v.cut;
            v.sputT = v.cut ? 0.14 + Math.random() * 0.12 : 0.6 + Math.random() * 1.3;
            if (v.cut && v === game.vehicle && v.kind !== 'heli') audio.sputter();
          }
        } else if (!v.wreck) { v.perf = 1; v.cut = false; }
        // an AI car left disabled (not burning) is towed away once nobody is looking
        if (v.ai && !v.wreck && !(v.burn > 0) && !v.evtCar && frac(v) <= 0.3) {
          v.disT = (v.disT || 0) + dt;
          if (v.disT > 25 && unseen(game.camera, v.x, v.z, 45)) { v.disT = 0; clear(v); continue; }
        } else v.disT = 0;
        if (st === 0) continue;
        if (v.burn > 0 && !v.wreck) {
          v.burn += dt;
          v.hp = Math.max(0, v.hp - dt * v.maxHp * 0.035);
          if (v.burn >= BURN[v.kind]) { explode(v); continue; }
        }
        if (v.wreck) {
          v.wreckT += dt;
          if (v.wreckT > 20 && !v.driven && unseen(game.camera, v.x, v.z, 45)) { clear(v); continue; }
        }
        // smoke and flames, only where someone could see them
        const d2 = (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2;
        if ((v.burn > 0 || (v.wreck && v.wreckT < 7)) && d2 < 3600) fire = Math.max(fire, 1 - Math.sqrt(d2) / 60);
        if (d2 > 170 * 170) continue;
        const s = Math.sin(v.yaw), c = Math.cos(v.yaw), y = v.y || 0;
        let ex, ey, ez;
        if (v.kind === 'car') { ex = v.x + s * 1.55; ey = y + 1.05; ez = v.z + c * 1.55; }
        else if (v.kind === 'bike') { ex = v.x; ey = y + 0.8; ez = v.z; }
        else if (v.kind === 'tank') { ex = v.x - s * 2.3; ey = 1.9; ez = v.z - c * 2.3; }
        else { ex = v.x - s * 0.8; ey = y + 2.7; ez = v.z - c * 0.8; }
        v.smokeT -= dt;
        if (v.wreck) {
          if (v.wreckT < 7) fx.flame(ex, ey - 0.2, ez, 0.85);
          if (v.smokeT <= 0) { v.smokeT = v.wreckT < 25 ? 0.2 : 0.7; fx.smoke(ex, ey, ez, 0.1, 1.3); }
        } else if (st >= 3) {
          fx.flame(ex, ey - 0.1, ez, v.kind === 'tank' ? 1.4 : 1);
          if (v.smokeT <= 0) { v.smokeT = 0.07; fx.smoke(ex, ey + 0.3, ez, 0.07 + Math.random() * 0.06, 1.4, v.vx || 0, v.vz || 0); }
        } else if (st === 2) {
          if (v.smokeT <= 0) { v.smokeT = 0.09; fx.smoke(ex, ey, ez, 0.22 + Math.random() * 0.12, 1.05, v.vx || 0, v.vz || 0); }
        } else if (v.smokeT <= 0) { v.smokeT = 0.15; fx.smoke(ex, ey, ez, 0.88 + Math.random() * 0.1, 0.75, v.vx || 0, v.vz || 0); }
      }
      sound.fire = game.inside ? 0 : fire;

      // HUD: the condition of whatever you are in, and a flashing GET OUT! while it burns
      const v = game.vehicle;
      if (v && !v.wreck) {
        const f = frac(v), st = stageOf(v), key = (v.police ? 'PATROL CAR' : NAME[v.kind] || 'CAR') + '|' + Math.round(f * 100) + '|' + st;
        if (key !== shown) {
          shown = key;
          el.cond.hidden = false;
          el.name.textContent = key.split('|')[0];
          el.fill.style.transform = `scaleX(${Math.max(0, f).toFixed(3)})`;
          el.cond.className = 'chip' + (st >= 3 ? ' fire' : st === 2 ? ' bad' : st === 1 ? ' warn' : '');
        }
      } else if (shown) { shown = ''; el.cond.hidden = true; }
      const out = !!v && !v.wreck && v.burn > 0 && game.busy !== 'down';
      if (out !== outOn) { outOn = out; el.out.hidden = !out; }
    },
  };
  return api;
}
