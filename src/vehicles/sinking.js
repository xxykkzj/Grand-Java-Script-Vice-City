// Vehicles in the water. A car, bike or tank that drives off the pier (hard enough to go through the rail), off
// the seawall (very hard), or simply into the surf, and a helicopter that lands on the sea, all sink slowly,
// trailing bubbles; the engine dies and the player bails out and swims. The wreck is cleaned up later, once
// nobody is looking (the same clean-up the damage system uses).
import { clamp, unseen, PI } from '../core/util.js';
import { WL, bedAt, depthAt, onDeck } from '../world/sea.js';
import { HX, HZ, CAUSEWAY } from '../world/layout.js';

const RATE = { car: 0.6, bike: 0.8, tank: 1.3, heli: 0.9 };    // m/s once under
const KEEL = { car: 0.04, bike: 0.02, tank: 0.1, heli: 0.05 };  // how far the base rests above the sand
const dry = (x, z) => (Math.abs(x) <= HX && Math.abs(z) <= HZ) || onDeck(x, z) || (x < -HX && x > CAUSEWAY.x0 - 2 && z > CAUSEWAY.z0 - 1 && z < CAUSEWAY.z1 + 1);

export function createSinking(game) {
  const { vehicles, player, hud, audio, fx, camera } = game;
  const stats = { sunk: 0, bailed: 0 };

  function bail(v) {
    if (game.vehicle !== v) return;
    game.rules.leaveVehicle();
    const sp = Math.hypot(v.vx || 0, v.vz || 0) || 1, ux = (v.vx || 0) / sp, uz = (v.vz || 0) / sp;
    const fwd = sp > 2 ? 2.4 : 0.8, side = 1.4;
    game.swim.drop(v.x + ux * fwd + Math.cos(v.yaw) * side, v.z + uz * fwd - Math.sin(v.yaw) * side, ux * sp * 0.25, uz * sp * 0.25, Math.max(v.y, WL) + 1.0);
    stats.bailed++;
    hud.toast(v.kind === 'heli' ? 'SPLASHDOWN!' : 'INTO THE SEA!', 'THE ENGINE IS DEAD. SWIM FOR IT');
    audio.splash(1.1);
  }
  function start(v) {
    v.sink = { t: 0, vy: Math.min(v.vy || 0, 0), splashed: false, settled: false, bubbleT: 0, off: KEEL[v.kind] || 0.04 };
    v.cut = true; v.perf = 0; v.driven = false; if (v.group) v.group.rotation.order = 'YXZ';
    if (v.kind === 'heli') { v.spool = Math.min(v.spool || 0, 0.5); v.vy = 0; }
    stats.sunk++;
    bail(v);
  }
  function splash(v) {
    v.sink.splashed = true;
    const big = v.kind === 'tank' ? 1.5 : v.kind === 'heli' ? 1.2 : 1;
    game.swim.splash(v.x, v.z, big);
    fx.sparks(v.x, WL + 0.5, v.z, 36, '#e8fbff');
    if (game.sea) game.sea.bubbles.burst(v.x, WL - 0.5, v.z, 18);
    audio.thud(0.6);
    if (v.burn > 0) { v.burn = 0; }       // put out
  }
  function step(v, dt) {
    const s = v.sink, bed = bedAt(v.x, v.z) + s.off;
    s.t += dt;
    const k = Math.exp(-(v.y > WL ? 0.12 : 1.5) * dt);
    v.x += (v.vx || 0) * dt; v.z += (v.vz || 0) * dt; v.vx = (v.vx || 0) * k; v.vz = (v.vz || 0) * k;
    if (!s.splashed) {
      s.vy -= 22 * dt; v.y += s.vy * dt;
      if (v.y <= WL + 0.15) splash(v);
    } else if (!s.settled) {
      s.vy += (-RATE[v.kind] - s.vy) * (1 - Math.exp(-1.3 * dt));
      v.y += s.vy * dt;
    }
    if (v.y <= bed) { v.y = bed; s.vy = 0; if (!s.settled) { s.settled = true; s.tSettle = s.t; } }
    v.vy = 0; v.spin = 0;
    const tilt = v.kind === 'bike' ? 0.5 : v.kind === 'heli' ? 0.35 : 0.3;
    v.tx = (v.tx || 0) + ((s.settled ? tilt * 0.6 : tilt) - (v.tx || 0)) * (1 - Math.exp(-1.2 * dt));
    v.tz = (v.tz || 0) * Math.exp(-1 * dt) + Math.sin(s.t * 0.7) * 0.01;
    if (v.kind === 'heli') { v.pitchVis = v.tx; v.rollVis = 0.15; }
    // bubbles: a stream while sinking, then a trickle for a while
    s.bubbleT -= dt;
    if (s.bubbleT <= 0 && game.sea && v.y < WL + 0.4) {
      s.bubbleT = s.settled ? (s.t - s.tSettle < 14 ? 0.45 : 1.6) : 0.07;
      game.sea.bubbles.emit(v.x + (Math.random() - 0.5) * 1.6, v.y + 0.8 + Math.random() * 0.6, v.z + (Math.random() - 0.5) * 2.2);
    }
    // cleaned up later, once nobody is looking
    if (s.settled && s.t > 40 && !v.driven && unseen(camera, v.x, v.z, 45) && !(game.sea && game.sea.under && Math.hypot(camera.position.x - v.x, camera.position.z - v.z) < 60)) {
      if (game.damage && game.damage.clear) game.damage.clear(v);       // resets the vehicle (and its sink state) when it can
    }
  }

  return {
    stats,
    update(dt) {
      for (const v of vehicles.all()) {
        if (v.sink) { step(v, dt); continue; }
        if (v.off || v.ai) continue;
        if (v.kind === 'heli') {
          if (v.y <= 0.3 && !dry(v.x, v.z) && depthAt(v.x, v.z) > 0.5) start(v);
          continue;
        }
        if (v.y > 0.8) continue;
        if (!dry(v.x, v.z) && depthAt(v.x, v.z) > 0.7) start(v);
      }
    },
    // debug: sink a vehicle right where it is (it must be over water)
    sink(v) { if (v && !v.sink) { start(v); return true; } return false; },
  };
}
