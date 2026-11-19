// AI traffic and Coast Patrol cars. They are ordinary cars from the fleet with an `ai`
// record: on rails they follow lane polylines kinematically; when knocked they fall back
// to physics for a moment, then steer home. Patrol cars can leave the rails to chase, either you
// (from 2 stars) or a target a street event hands them (ai.chase: a getaway car, a suspect on foot).
// A badly damaged car (game/damage.js) pulls over and stops: a disabled patrol car stops chasing.
import { clamp, angleDelta, segBlocked, dailyCurve, outOfSight } from '../core/util.js';
import { connector, signal } from '../world/roads.js';
import { onRails, PATROL_TEAL, resetDamage } from '../vehicles/vehicles.js';
import { disabled } from '../game/damage.js';

const TRAFFIC = 26, POLICE = 6;
// Share of the traffic fleet on the road by hour: dead quiet 01:00-05:00, rush hours at 07-09 and 17-19,
// a moderate middle of the day, and a busy evening on the boulevard (nightlife) that tails off after midnight.
export const TRAFFIC_CURVE = [[0, 0.42], [1, 0.2], [2, 0.12], [5, 0.12], [6.5, 0.55], [7.4, 1], [9, 1], [10.2, 0.6], [16, 0.65], [17, 1], [19, 1], [20.2, 0.7], [23, 0.6], [24, 0.42]];

export function createTraffic(R, vehicles, grid, game) {
  const { cars } = vehicles, solids = game.L.solids;
  const P = { x: 0, z: 0 };
  let frame = 0;

  function setPath(ai, pts) {
    ai.pts = pts; ai.cum = [0];
    for (let i = 1; i < pts.length; i++) ai.cum.push(ai.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    ai.len = ai.cum[pts.length - 1];
  }
  const lane = (e) => [[e.x0, e.z0], [e.x1, e.z1]];
  function posAt(ai, s) {
    const { pts, cum } = ai;
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const k = clamp((s - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-4), 0, 1), a = pts[i - 1], b = pts[i];
    P.x = a[0] + (b[0] - a[0]) * k; P.z = a[1] + (b[1] - a[1]) * k;
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  function rail(c, e, s) {
    const ai = c.ai || (c.ai = { inp: { throttle: 0, steer: 0, hand: false } });
    Object.assign(ai, { edge: e, next: null, inConn: false, s, speed: 0, stun: 0, recover: false, pursuit: false, wait: 0, ghost: 0, hold: false, braking: false, stuck: 0, rev: 0, siren: false, honk: 0 });
    ai.cruise = ai.cruise || 8.5 + Math.random() * 3.5;
    setPath(ai, lane(e));
    c.yaw = posAt(ai, s); c.x = P.x; c.z = P.z; c.y = 0; c.vx = c.vy = c.vz = 0; c.tx = c.tz = c.spin = 0;
    c.hasDriver = true; c.driven = false; c.off = false;
  }
  // a random lane position at least `far` from the player and clear of other cars
  const blvdEdges = R.edges.filter((e) => e.h && Math.abs(e.z0 - 53) < 6);
  function place(c, far, hide = false, blvd = 0) {
    const f = game.focus();
    for (let i = 0; i < 60; i++) {
      const pool = Math.random() < blvd ? blvdEdges : R.edges;
      const e = pool[Math.floor(Math.random() * pool.length)], s = 3 + Math.random() * (e.len - 12);
      const x = e.x0 + e.dx * s, z = e.z0 + e.dz * s;
      if (Math.hypot(x - f.x, z - f.z) < far) continue;
      if (hide && !outOfSight(game.camera, x, z, solids)) continue;
      if (cars.some((o) => o !== c && !o.off && Math.hypot(o.x - x, o.z - z) < 11)) continue;
      rail(c, e, s);
      resetDamage(c); vehicles.retint(c); c.evtCar = false; c.ai.chase = null; c.ai.getaway = false;
      return true;
    }
    return false;
  }
  // nearest lane to wherever the car ended up
  function rejoin(c) {
    let best = null, bd = 1e9, bs = 0;
    for (const e of R.edges) {
      const s = clamp((c.x - e.x0) * e.dx + (c.z - e.z0) * e.dz, 1, e.len - 4);
      const d = Math.hypot(e.x0 + e.dx * s - c.x, e.z0 + e.dz * s - c.z) + (Math.sin(c.yaw) * e.dx + Math.cos(c.yaw) * e.dz < 0 ? 3 : 0);
      if (d < bd) { bd = d; best = e; bs = s; }
    }
    const x = c.x, z = c.z, yaw = c.yaw;
    rail(c, best, bs);
    c.x = x; c.z = z; c.yaw = yaw; c.ai.recover = true;
  }

  for (let i = 0; i < TRAFFIC; i++) {
    const c = vehicles.addCar(0, 0, 0, vehicles.PAINTS[(i * 4 + 1) % vehicles.PAINTS.length], { traffic: true });
    if (c) place(c, 30);
  }
  // a couple of Comets ride with the traffic
  for (let i = 0; i < 2; i++) {
    const c = vehicles.addCar(0, 0, 0, vehicles.BIKE_PAINT[(i * 2 + 4) % vehicles.BIKE_PAINT.length], { traffic: true, kind: 'bike' });
    if (c) { place(c, 30); c.ai.cruise = 11.5 + i * 2; }
  }
  const police = [];
  for (let i = 0; i < POLICE; i++) {
    const c = vehicles.addCar(0, 0, 0, PATROL_TEAL, { police: true, label: 'patrol car', off: true });
    if (c) police.push(c);
  }

  function chooseExit(c, e, chase, f) {
    const n = e.to;
    let opts = n.exits.filter((x) => x.to !== e.from);
    if (!opts.length) opts = n.exits;
    if (!chase) return opts[Math.floor(Math.random() * opts.length)];
    let best = opts[0], bd = 1e9;
    for (const x of opts) { const d = Math.hypot(x.to.x - f.x, x.to.z - f.z) + (x.to.light ? 0 : 40); if (d < bd) { bd = d; best = x; } }
    return best;
  }

  function step(c, dt, t) {
    const ai = c.ai;
    ai.braking = false;
    // badly damaged: pull over, siren off, no more chasing (it coasts to a stop under physics)
    if (disabled(c)) { ai.siren = false; ai.pursuit = false; ai.braking = true; ai.stun = Math.max(ai.stun || 0, 0.3); return; }
    const tgt = ai.chase && !ai.chase.off ? ai.chase : null;
    const chase = c.police && (tgt ? true : game.wanted >= 2 && !game.busy);
    ai.siren = chase;
    if (ai.stun > 0) {
      ai.stun -= dt;
      if (ai.stun <= 0) { if (c.y > 0.05 || Math.hypot(c.vx, c.vz) > 2) ai.stun = 0.3; else if (ai.pursuit) ai.stun = 0; else rejoin(c); }
      return;
    }
    const f = tgt || game.focus(), dxp = f.x - c.x, dzp = f.z - c.z, dp = Math.hypot(dxp, dzp);
    if (ai.pursuit) {
      // physics car with synthetic inputs: point at the player, back out when wedged
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), vf = c.vx * fx + c.vz * fz, inp = ai.inp;
      inp.steer = clamp(angleDelta(c.yaw, Math.atan2(dxp, dzp)) * 2.5, -1, 1);
      inp.throttle = dp < 4.6 ? (vf > 1 ? -1 : 0) : vf < (dp < 14 ? 7 : 19) ? 1 : vf > (dp < 14 ? 9 : 99) ? -1 : 0;
      if (Math.abs(vf) < 0.8 && dp > 7) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt);
      if (ai.stuck > 1.4) { ai.rev = 1.1; ai.stuck = 0; }
      if (ai.rev > 0) { ai.rev -= dt; inp.throttle = -1; inp.steer = -inp.steer; }
      if (!chase || dp > 70) { ai.pursuit = false; rejoin(c); }
      return;
    }
    if (ai.recover) {
      posAt(ai, ai.s);
      const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.7) ai.recover = false;
      else {
        const m = Math.min(d, 7 * dt);
        c.x += dx / d * m; c.z += dz / d * m; c.vx = c.vz = 0;
        c.yaw += angleDelta(c.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-5 * dt));
        return;
      }
    }
    if (ai.hold) { ai.speed = 0; c.vx = c.vz = 0; ai.braking = true; return; }
    // a suspect on foot: the patrol follows along the road and pulls up close by, it never mounts the kerb
    const onFoot = tgt && tgt.isPed;
    if (chase && !onFoot && dp < 32 && (ai.los = !segBlocked(c.x, c.z, f.x, f.z, solids))) { ai.pursuit = true; ai.stuck = 0; return; }

    const e = ai.edge;
    let vmax = ai.inConn ? 6 : ai.cruise, red = false;
    if (chase) vmax *= ai.inConn ? 1.5 : onFoot ? 1.3 : 2;
    if (onFoot && dp < 10) vmax = 0;
    if (ai.getaway) vmax = ai.inConn ? 10 : 17.5;          // a getaway car floors it and ignores the lights
    vmax *= c.perf || 1;
    if (!ai.inConn && e.to.light && !chase && !ai.getaway) {
      const sg = signal(e.to, e.h, t), d = ai.len - 2.6 - ai.s;
      if (d > -1.5 && (sg === 2 || (sg === 1 && d > 5))) { vmax = Math.min(vmax, d < 0.4 ? 0 : Math.sqrt(d * 9)); red = true; }
    }
    // anything in the way? other cars ahead in lane, pedestrians, the player
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), reach = 7 + ai.speed * 1.1;
    let gap = 99, byPlayer = false;
    grid.query(c.x + fx * reach * 0.5, c.z + fz * reach * 0.5, reach * 0.5 + 2, (o) => {
      if (o === c) return;
      const ox = o.x - c.x, oz = o.z - c.z, fw = ox * fx + oz * fz;
      if (fw < 0.5 || fw > reach + 3) return;
      const lat = Math.abs(ox * fz - oz * fx);
      let g;
      if (o.isPed) { if (lat > 1.7 || (chase && !o.isPlayer)) return; g = fw - 3.4; }
      else {
        if (lat > 1.9) return;
        if (onRails(o) && (ai.ghost > 0 || Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz < 0.2)) return;
        if (ai.ghost > 0 && !o.driven) return;
        g = fw - 5.4;
      }
      if (g < gap) { gap = g; byPlayer = !!o.isPlayer || !!o.driven; }
    });
    if (gap < 99) vmax = Math.min(vmax, Math.max(0, gap) * 1.5);
    if (ai.speed < 0.3 && !red && gap < 99) {
      ai.wait += dt;
      if (byPlayer && ai.wait > 1.6 && ai.honk <= 0 && !c.police) { game.audio.horn(clamp(1 - dp / 40, 0, 1)); ai.honk = 3 + Math.random() * 4; }
      if (ai.wait > (ai.getaway ? 1 : 7) && !byPlayer) { ai.ghost = 3.5; ai.wait = 0; }
    } else ai.wait = 0;
    ai.ghost -= dt; ai.honk -= dt;
    if (ai.speed < vmax) ai.speed = Math.min(vmax, ai.speed + 5 * dt);
    else { ai.braking = ai.speed - vmax > 0.4; ai.speed = Math.max(vmax, ai.speed - 16 * dt); }
    ai.s += ai.speed * dt;
    while (ai.s >= ai.len) {
      ai.s -= ai.len;
      if (ai.inConn) { ai.inConn = false; ai.edge = ai.next; setPath(ai, lane(ai.edge)); }
      else { ai.next = chooseExit(c, e, chase, f); ai.inConn = true; setPath(ai, connector(e, ai.next)); }
    }
    const yaw = posAt(ai, ai.s);
    c.x = P.x; c.z = P.z;
    c.yaw += angleDelta(c.yaw, yaw) * (1 - Math.exp(-9 * dt));
    c.vx = Math.sin(yaw) * ai.speed; c.vz = Math.cos(yaw) * ai.speed;
  }

  // ---- time of day: park cars out of sight when the town goes quiet, bring them back for the rush
  const fleet = cars.filter((c) => c.traffic);
  let target = fleet.length, densT = 0;
  const parkable = (c) => c.ai && !c.off && !c.driven && !c.jacking && !c.ai.pursuit && !c.ai.hold && !(c.ai.stun > 0) && !c.evtCar;
  function density(dt) {
    const h = game.env.tod, night = h >= 20 || h < 2;
    target = Math.round(fleet.length * dailyCurve(TRAFFIC_CURVE, h));
    densT -= dt;
    if (densT > 0) return;
    densT = 0.12;
    let on = 0;
    for (const c of fleet) if (!c.off && c.ai) on++;
    if (on > target) {
      // the first suitable car out of sight goes home; at night boulevard cars stay out longest
      let best = null, bs = -1;
      for (const c of fleet) {
        if (!parkable(c) || !outOfSight(game.camera, c.x, c.z, solids)) continue;
        const sc = Math.random() + (night && Math.abs(c.z - 53) < 10 ? 0 : 0.6);
        if (sc > bs) { bs = sc; best = c; }
      }
      if (best) { best.off = true; best.ai = null; }
    } else if (on < target) {
      const c = fleet.find((k) => k.off);
      if (c) place(c, 70, true, night ? 0.65 : h > 7 && h < 19 ? 0.2 : 0.35);
    }
  }

  const api = {
    police, count: () => cars.reduce((n, c) => n + (c.ai && !c.off ? 1 : 0), 0),
    get target() { return target; },
    place,
    // put a car on the lane nearest to (x, z), heading along yaw (street events)
    railNear(c, x, z, yaw) {
      const hx = Math.sin(yaw), hz = Math.cos(yaw);
      let best = null, bd = 1e9, bs = 0;
      for (const e of R.edges) {
        const s = clamp((x - e.x0) * e.dx + (z - e.z0) * e.dz, 1, e.len - 4);
        const d = Math.hypot(e.x0 + e.dx * s - x, e.z0 + e.dz * s - z) + (hx * e.dx + hz * e.dz < 0.7 ? 40 : 0);
        if (d < bd) { bd = d; best = e; bs = s; }
      }
      rail(c, best, bs);
      return c;
    },
    // freeze a car for the carjack animation, then hand it to the player
    release(c) { c.ai = null; c.hasDriver = false; },
    update(dt, t) {
      frame++;
      const f = game.focus();
      density(dt);
      // patrol roster: two cars always on the beat, more as the stars climb (six at five stars)
      const want = game.wanted >= 5 ? 6 : game.wanted >= 4 ? 5 : game.wanted >= 3 ? 3 : 2;
      police.forEach((c, i) => {
        if (c.off && i < want) { if (place(c, i < 2 && frame < 5 ? 60 : 85)) vehicles.paint(c, PATROL_TEAL); }
        else if (!c.off && i >= want && !c.driven && !c.wreck && !(c.ai && c.ai.chase) && Math.hypot(c.x - f.x, c.z - f.z) > 110) { c.off = true; c.ai = null; }
        else if (!c.off && !c.ai && !c.driven && !c.wreck && !(c.burn > 0) && Math.hypot(c.x - f.x, c.z - f.z) > 110) place(c, 85);
      });
      for (const c of cars) {
        if (c.off) continue;
        if (!c.ai) {
          // a car the player borrowed and abandoned goes back into circulation once out of sight
          // (wrecks and burning cars are cleared by game/damage.js)
          if (c.traffic && !c.driven && !c.wreck && !(c.burn > 0) && !c.evtCar && (frame + c.idx) % 90 === 0 && Math.hypot(c.x - f.x, c.z - f.z) > 130) place(c, 110);
          continue;
        }
        // far-away cars tick at a third of the rate
        const far = (c.x - f.x) ** 2 + (c.z - f.z) ** 2 > 12000;
        if (far && !c.ai.pursuit && !(c.ai.stun > 0)) { if ((frame + c.idx) % 3 === 0) step(c, dt * 3, t); }
        else step(c, dt, t);
      }
    },
  };
  return api;
}
