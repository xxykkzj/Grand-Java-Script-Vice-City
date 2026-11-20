// Swimming. Walk off the beach: the sand slopes away (world/sea.js), you wade (slower the deeper it gets,
// no skates), then swim once the water is deeper than ~1.14 m. At the surface WASD swims a front crawl
// (Shift = faster stroke, spends stamina); C dives, Space rises; underwater you swim in 3D along the
// camera's pitch. A breath meter drains while the head is under; empty and you lose health (and at 0 the
// usual KNOCKED OUT). Breath refills at the surface. Climb out on the beach (wading), or up a pier ladder (E).
// The pier's edge is a leap: jump at the rail. A strong current pushes swimmers back past SAFE_D.
//
// POSES: every pose is data ("pivot name -> [rx, ry, rz]") returned by the functions in POSES and applied by
// applyPose() to the pivots the character model exposes (body, head, armL, armR, legL, legR + legX.shin).
// Nothing else touches the courier's joints while swimming, so porting to another character model means
// mapping these names, nothing more.
import { clamp, damp, angleDelta, PI, reducedMotion } from '../core/util.js';
import { HZ, HX, PIER } from '../world/layout.js';
import { WL, FLOAT_Y, WADE_MAX, SAFE_D, LIMIT_D, bedAt, depthAt, islandDist, onDeck, pushFromSolids, nearLadder, nearestLand } from '../world/sea.js';

const BREATH_S = 24;               // seconds of air
const HIP = 0.96;                  // hip height above the feet in the model

// ---------------------------------------------------------------- poses (data, in one place)
// pose: { y: body offset, rx/ry/rz: body rotation about the hips, head: [x,y,z], armL/armR: [x,y,z], legL/legR: [x,z] (thigh swing, spread), kneeL, kneeR }
export const POSES = {
  // upright, sculling with the hands, bicycling with the legs; the water is at the chin
  tread(t) {
    const s = Math.sin(t * 2.6), c = Math.cos(t * 2.6);
    return { y: -0.52 + Math.sin(t * 1.5) * 0.03, rx: 0.1, ry: 0, rz: 0, head: [-0.1, 0, 0], armL: [-0.7 + s * 0.25, 0, 0.95], armR: [-0.7 - s * 0.25, 0, -0.95], legL: [-0.5 + c * 0.45, 0.18], legR: [-0.5 - c * 0.45, -0.18], kneeL: 0.9 - c * 0.5, kneeR: 0.9 + c * 0.5 };
  },
  // front crawl: arms windmill (rotation about the shoulder), legs flutter, the head turns to breathe
  crawl(t, k) {
    const a = t * (1 + 0.5 * k), fl = Math.sin(t * 6.5);
    return { y: 0.06, rx: 1.42, ry: 0, rz: Math.sin(a) * 0.22, head: [-0.75, Math.sin(a + 1.2) * 0.5, 0], armL: [a, 0, 0.1], armR: [a + PI, 0, -0.1], legL: [fl * 0.3, 0.04], legR: [-fl * 0.3, -0.04], kneeL: 0.25 + Math.max(0, fl) * 0.35, kneeR: 0.25 + Math.max(0, -fl) * 0.35 };
  },
  // underwater: arms stretched ahead, long slow kicks; rx tilts with the direction of travel
  glide(t, k, rx) {
    const fl = Math.sin(t * 3.2) * (0.15 + 0.3 * k);
    return { y: 0, rx, ry: 0, rz: 0, head: [-0.2, 0, 0], armL: [PI * 0.93, 0, 0.14], armR: [PI * 0.93, 0, -0.14], legL: [fl, 0.04], legR: [-fl, -0.04], kneeL: 0.3 + Math.max(0, fl), kneeR: 0.3 + Math.max(0, -fl) };
  },
  // up a ladder: hands over head, knees alternately up
  climb(t) {
    const s = Math.sin(t * 5.2);
    return { y: 0, rx: 0.12, ry: 0, rz: 0, head: [-0.35, 0, 0], armL: [-2.75 + s * 0.55, 0, 0.18], armR: [-2.75 - s * 0.55, 0, -0.18], legL: [-0.2 - Math.max(0, s) * 0.9, 0.05], legR: [-0.2 - Math.max(0, -s) * 0.9, -0.05], kneeL: 0.3 + Math.max(0, s) * 1.1, kneeR: 0.3 + Math.max(0, -s) * 1.1 };
  },
  // wading: arms a little out for balance (only the arms; the legs come from the walking gait)
  wade(t) {
    const s = Math.sin(t);
    return { armL: [-0.25 - s * 0.25, 0, 0.75], armR: [-0.25 + s * 0.25, 0, -0.75] };
  },
};
// the pivots, by name; partial poses leave the others alone
const NUM = ['y', 'rx', 'ry', 'rz'];
function blend(cur, tgt, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  for (const f of NUM) if (tgt[f] !== undefined) cur[f] = cur[f] === undefined ? tgt[f] : cur[f] + (tgt[f] - cur[f]) * k;
  for (const f of ['head', 'armL', 'armR']) if (tgt[f]) { const a = cur[f] || (cur[f] = tgt[f].slice()); for (let i = 0; i < 3; i++) a[i] += (tgt[f][i] - a[i]) * k; }
  for (const f of ['legL', 'legR']) if (tgt[f]) { const a = cur[f] || (cur[f] = tgt[f].slice()); for (let i = 0; i < 2; i++) a[i] += (tgt[f][i] - a[i]) * k; }
  for (const f of ['kneeL', 'kneeR']) if (tgt[f] !== undefined) cur[f] = cur[f] === undefined ? tgt[f] : cur[f] + (tgt[f] - cur[f]) * k;
  return cur;
}
// write a pose onto the model's pivots. The body turns about the hips (not the feet).
export function applyPose(model, o, rootY) {
  const m = model, h = HIP;
  if (o.rx !== undefined) {
    const cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry || 0), sy = Math.sin(o.ry || 0), cz = Math.cos(o.rz || 0), sz = Math.sin(o.rz || 0);
    m.root.position.y = rootY;
    m.body.position.set(h * sz * cy, (o.y || 0) + h - h * (cz * cx - sz * sy * sx), -h * (cz * sx + sz * sy * cx));
    m.body.rotation.set(o.rx, o.ry || 0, o.rz || 0);
  }
  if (o.head) m.head.rotation.set(o.head[0], o.head[1], o.head[2]);
  if (o.armL) m.armL.rotation.set(o.armL[0], o.armL[1], o.armL[2]);
  if (o.armR) m.armR.rotation.set(o.armR[0], o.armR[1], o.armR[2]);
  if (o.legL) { m.legL.rotation.set(o.legL[0], 0, o.legL[1]); m.legR.rotation.set(o.legR[0], 0, o.legR[1]); }
  if (o.kneeL !== undefined) { m.legL.shin.rotation.x = o.kneeL; m.legR.shin.rotation.x = o.kneeR; }
  if (o.legL && m.skirt && m.skirt.visible) m.skirt.drape(m.legL.rotation.x, m.legL.rotation.z, m.legR.rotation.x, m.legR.rotation.z);
}

export function createSwim(game) {
  const { player, hud, audio, fx, L } = game;
  const P = player, pos = P.pos;
  const S = {
    wet: false, mode: 'dry', depth: 0, breath: 1, stamina: 1, submerged: false, current: 0, ladder: null, sprinting: false,
    sy: 0, vy: 0, speedXZ: 0, climb: null, pose: {}, phase: 0, drownT: 0, curToast: 0, lastPose: 'tread', free: false,
    splashes: 0, bubbleT: 0, strokeN: 0, ko: 0,
  };
  // the sand shelf under the courier's feet (see world/sea.js): lets the dry skating follow the slope
  P.groundAt = (x, z) => (z > HZ - 0.5 && Math.abs(x) < HX + 12 && !onDeck(x, z) ? Math.min(0, bedAt(x, z)) : 0);

  function splash(x, z, k = 1) {
    S.splashes++;
    fx.sparks(x, WL + 0.15, z, Math.round(10 + 22 * k), '#d8f6ff');
    audio.splash(k);
    if (k > 0.8 && !reducedMotion) fx.shake = Math.max(fx.shake, 0.12 * k);
    if (game.sea && game.sea.bubbles) game.sea.bubbles.burst(x, WL - 0.4, z, Math.round(6 + 10 * k));
  }

  function setCam(cam, on) {
    if (on) { cam.minY = -400; cam.minPitch = -1.15; cam.floorAt = (x, z) => (depthAt(x, z) > 0 ? bedAt(x, z) : -1e9); }
    else { cam.minY = 0.5; cam.minPitch = -0.12; cam.floorAt = null; cam.maxY = 1e9; }
  }

  function leave() {            // out of the water: hand the courier back to the skating code
    if (S.wet) { P.vy = Math.max(0, S.vy); P.swimming = false; P.shadow.visible = !P.hidden; P.resetPose(); P.onGround = true; }
    S.wet = false; S.mode = 'dry'; S.submerged = false; S.current = 0; S.ladder = null; S.climb = null; S.free = false;
  }

  // ---------------------------------------------------------------- climbing a pier ladder
  function startClimb(l) {
    S.climb = { l, t: 0, x0: pos.x, z0: pos.z, y0: S.sy };
    S.mode = 'climb'; P.vel.set(0, 0, 0);
    audio.splash(0.4);
  }
  function stepClimb(dt, cam) {
    const c = S.climb, l = c.l;
    c.t += dt;
    const yaw = -l.s * PI / 2, hx = l.x + l.s * 0.62;
    const T0 = 0.55, T1 = T0 + 1.5, T2 = T1 + 0.85;
    P.yaw += angleDelta(P.yaw, yaw) * (1 - Math.exp(-12 * dt));
    P.speed = 0;
    if (c.t < T0) {
      const k = c.t / T0, e = k * k * (3 - 2 * k);
      pos.x = c.x0 + (hx - c.x0) * e; pos.z = c.z0 + (l.z - c.z0) * e; S.sy = c.y0 + (FLOAT_Y - c.y0) * e;
      S.pose = blend(S.pose, POSES.tread(S.phase), 8, dt);
    } else if (c.t < T1) {
      const k = (c.t - T0) / (T1 - T0);
      pos.x = hx; pos.z = l.z; S.sy = FLOAT_Y + (0 - FLOAT_Y) * k;
      S.phase += dt * 1.3;
      S.pose = blend(S.pose, POSES.climb(S.phase * 3.2), 12, dt);
      if (Math.floor(k * 7) !== c.step) { c.step = Math.floor(k * 7); audio.step(0.8); }
    } else if (c.t < T2) {
      const k = (c.t - T1) / (T2 - T1), e = k * k * (3 - 2 * k);
      pos.x = hx + (l.x - l.s * 1.35 - hx) * e; pos.z = l.z; S.sy = Math.sin(k * PI) * 0.35;
      P.speed = 2.4;
    } else {
      pos.set(l.x - l.s * 1.35, 0, l.z); P.vel.set(-l.s * 0.5, 0, 0); P.vy = 0; S.sy = 0;
      S.climb = null; leave(); setCam(cam, false);
      hud.toast('BACK ON THE PIER', 'DRY LAND');
      P.onGround = true; P.animate(dt, 0, null);
      return;
    }
    pos.y = S.sy;
    if (c.t >= T1) { P.resetPose(); P.onGround = true; P.animate(dt, 0, null); pos.y = S.sy; P.model.root.position.y = S.sy; }
    else {
      P.model.root.position.set(pos.x, S.sy, pos.z); P.model.root.rotation.set(0, P.yaw, 0);
      applyPose(P.model, S.pose, S.sy);
    }
    P.shadow.visible = false;
    cam.minY = -400; cam.minPitch = -1.15;
  }

  const api = {
    S,
    // ---- read by the HUD, touch controls and tests
    get wet() { return S.wet; },
    get mode() { return S.mode; },
    state() { return { wet: S.wet, mode: S.mode, depth: +S.depth.toFixed(2), breath: +S.breath.toFixed(2), stamina: +S.stamina.toFixed(2), submerged: S.submerged, current: S.current, x: +pos.x.toFixed(1), y: +pos.y.toFixed(2), z: +pos.z.toFixed(1), ladder: !!S.ladder, splashes: S.splashes }; },
    interact() {
      if (!S.wet || S.climb) return false;
      const l = nearLadder(pos.x, pos.z);
      if (l && S.mode === 'swim' && S.sy > FLOAT_Y - 0.9) { startClimb(l); return true; }
      if (l) { hud.toast('SWIM UP TO THE LADDER', 'COME UP FOR AIR FIRST'); return true; }
      return false;
    },
    touchButtons() {
      if (!S.wet || S.climb) return [];
      return [...(S.ladder ? [['KeyE', 'CLIMB']] : []), ['KeyC', 'DIVE'], ['Space', 'UP']];
    },
    hint() {
      if (S.climb) return [];
      const out = [];
      if (S.ladder) out.push(['E', 'climb the ladder']);
      if (S.mode === 'swim') out.push(['WASD', 'swim'], ['Shift', 'faster stroke'], ['C', 'dive'], ['Space', 'rise']);
      else out.push(['WASD', 'wade'], ['Shift', 'push on']);
      out.push(['V', 'camera view']);
      return out;
    },
    // not in play (indoors, in a scene, in a vehicle): drop the swimming state
    sleep(cam) { if (S.wet || S.climb) { leave(); setCam(cam, false); } S.breath = Math.min(1, S.breath + 0.02); },
    splash,
    // put the courier into the water at (x, z) on the surface (vehicles that sink, the helicopter, tests)
    drop(x, z, vx = 0, vz = 0, y = WL + 0.2) {
      pos.set(x, y - HIP * 0, z); P.vel.set(vx, 0, vz); P.vy = -1; P.onGround = false; P.leap = false;
    },
    // advance one frame. Returns true when it moved the courier (so player.update is skipped).
    update(dt, ctl, cam) {
      if (S.climb) { S.wet = true; stepClimb(dt, cam); return true; }
      const x = pos.x, z = pos.z, depth = depthAt(x, z);
      const onPierDeck = onDeck(x, z) && pos.y > -0.3;
      const wet = depth > 0.04 && !onPierDeck;
      if (!wet) {
        if (S.wet) { leave(); setCam(cam, false); }
        S.depth = 0; S.submerged = false; S.current = 0; S.ladder = null;
        S.breath = Math.min(1, S.breath + dt * 0.6); S.stamina = Math.min(1, S.stamina + dt * 0.3);
        return false;
      }
      if (!S.wet) {                       // just went in
        S.wet = true; S.sy = pos.y; S.vy = P.vy; S.phase = 0; S.pose = {};
        P.swimming = true; P.leap = false;
        setCam(cam, true);
        if (pos.y < WL + 0.3 && P.vy < -2.5) splash(x, z, 0.5);
        else if (pos.y > FLOAT_Y + 0.2 && depth > WADE_MAX) { /* falls in: splashes when it lands */ }
        else audio.splash(0.3);
      }
      S.depth = depth;
      const bed = bedAt(x, z);
      S.mode = S.mode === 'swim' ? (depth > WADE_MAX - 0.1 ? 'swim' : 'wade') : (depth > WADE_MAX + 0.06 ? 'swim' : 'wade');
      if (S.mode === 'swim' && S.lastPose === 'wade') S.pose = {};

      // ---- movement intent, camera-relative
      const fx_ = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      let ix = fx_ * ctl.move - fz * ctl.strafe, iz = fz * ctl.move + fx_ * ctl.strafe;
      const len = Math.hypot(ix, iz), mag = Math.min(1, len);
      if (len > 0) { ix /= len; iz /= len; }
      const wantSprint = ctl.sprint && mag > 0.3 && S.stamina > 0.04 && !(S.ko > 0);
      S.sprinting = wantSprint;
      let top, rate = 3.2;
      if (S.mode === 'wade') {
        top = (wantSprint ? 5.2 : 3.4) * (1 - 0.55 * clamp(depth / WADE_MAX, 0, 1)); rate = 5;
      } else top = (wantSprint ? 5.0 : 2.9) * (S.submerged ? 0.92 : 1);
      top *= mag;
      if (wantSprint && S.mode === 'swim') S.stamina = Math.max(0, S.stamina - dt * 0.22 * (game.eat && game.eat.refreshed ? 0.6 : 1)); else S.stamina = Math.min(1, S.stamina + dt * (len > 0 ? 0.12 : 0.28));

      // ---- the strong current beyond the safe radius: a drift towards the island, never a wall
      const d = islandDist(x, z);
      let pushX = 0, pushZ = 0;
      if (d > SAFE_D) {
        const over = d - SAFE_D, [cx, cz] = nearestLand(x, z);
        let nx = cx - x, nz = cz - z; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        const s = Math.min(1.2 + over * 0.12, 6.5);
        pushX = nx * s; pushZ = nz * s; S.current = Math.min(1, over / 12 + 0.25);
        S.curToast -= dt;
        if (S.curToast <= 0) { hud.toast('STRONG CURRENT', 'IT IS PUSHING YOU BACK TOWARDS THE ISLAND'); S.curToast = 4; }
      } else { S.current = 0; S.curToast = 0; }
      const tvx = ix * top + pushX, tvz = iz * top + pushZ;
      P.vel.x = damp(P.vel.x, tvx, rate, dt); P.vel.z = damp(P.vel.z, tvz, rate, dt);
      pos.x += P.vel.x * dt; pos.z += P.vel.z * dt;
      pushFromSolids(pos, 0.5, S.sy);
      if (islandDist(pos.x, pos.z) > LIMIT_D) {      // the hard limit: held where the current is strongest
        const [cx, cz] = nearestLand(pos.x, pos.z), ddx = pos.x - cx, ddz = pos.z - cz, dl = Math.hypot(ddx, ddz) || 1;
        pos.x = cx + ddx / dl * LIMIT_D; pos.z = cz + ddz / dl * LIMIT_D;
      }
      S.speedXZ = Math.hypot(P.vel.x, P.vel.z);
      P.speed = S.speedXZ;
      let turn = 0;
      if (S.speedXZ > 0.35) { turn = angleDelta(P.yaw, Math.atan2(P.vel.x, P.vel.z)); P.yaw += turn * (1 - Math.exp(-8 * dt)); }
      const bed2 = bedAt(pos.x, pos.z);

      if (S.mode === 'wade') {
        // feet on the bed; falling in lands on it
        S.vy -= 23 * dt; S.sy += S.vy * dt;
        if (S.sy <= bed2) { if (S.vy < -4) splash(pos.x, pos.z, 0.5); S.sy = bed2; S.vy = 0; }
        else if (S.sy - bed2 < 0.4 && S.vy <= 0) S.sy = bed2;
        S.submerged = false; S.lastPose = 'wade';
        pos.y = S.sy; P.onGround = true; P.vy = 0;
        S.phase += dt * (1.2 + S.speedXZ * 0.9);
        const prev = S.strokeN; S.strokeN = Math.floor(S.phase / PI);
        if (S.strokeN !== prev && S.speedXZ > 0.8) audio.wadeStep(clamp(S.speedXZ / 4, 0.3, 1));
        P.phase = S.phase;
        P.animate(dt, turn, null);
        // knees up high through the water, arms out
        const m = P.model, kk = 0.5 + clamp(depth / WADE_MAX, 0, 1) * 0.5;
        m.legL.shin.rotation.x += 0.35 * kk * Math.max(0, Math.sin(S.phase)); m.legR.shin.rotation.x += 0.35 * kk * Math.max(0, -Math.sin(S.phase));
        applyPose(P.model, POSES.wade(S.phase), 0);
        P.shadow.visible = false;
        S.breath = Math.min(1, S.breath + dt * 0.6);
      } else {
        // ---- vertical: float, dive (C), rise (Space), and in 3D along the camera's pitch underwater
        const top_ = FLOAT_Y, floor = bed2 - 0.62;
        const airborne = S.sy > top_ + 0.06;
        if (airborne) {
          S.vy -= 23 * dt; S.sy += S.vy * dt;
          if (S.sy <= top_) { splash(pos.x, pos.z, clamp(-S.vy / 8, 0.3, 1.2)); S.vy *= 0.35; S.sy = top_; }
        } else {
          const look = -Math.sin(cam.pitch - 0.2);                        // + up, - down
          let tv = 0;
          const forward = ctl.move > 0.05 ? ctl.move : 0, deep = S.sy < top_ - 0.55;
          if (deep || look < -0.5) tv += look * top * forward;            // 3D swimming (at the surface only a steep look-down dives)
          if (ctl.down) tv -= 2.3;
          if (ctl.up) tv += 2.4;
          if (!ctl.down && !ctl.up && Math.abs(tv) < 0.3) tv += S.sy < top_ - 0.1 ? 0.55 : 0;       // buoyancy
          S.vy = damp(S.vy, tv, 4, dt);
          S.sy += S.vy * dt;
          if (S.sy >= top_) { S.sy = top_; if (S.vy > 0) S.vy = 0; }
        }
        if (S.sy < floor) { S.sy = floor; if (S.vy < 0) S.vy = 0; }
        pos.y = S.sy; P.onGround = false; P.vy = S.vy;
        // ---- breath
        const rxNow = S.pose.rx === undefined ? 1.4 : S.pose.rx;
        const hip = S.sy + HIP + (S.pose.y || 0), headTop = hip + 0.74 * Math.cos(rxNow) + 0.15;
        const sub = headTop < WL - 0.03 && !airborne;
        if (sub !== S.submerged) { S.submerged = sub; if (sub) audio.splash(0.15); }
        if (sub) {
          S.breath = Math.max(0, S.breath - dt / (BREATH_S * (game.save && game.save.vest ? 1.75 : 1)));   // the Buoy-O vest (Starboard Bait & Tackle)
          S.bubbleT -= dt;
          if (S.bubbleT <= 0) { S.bubbleT = 0.9 + Math.random() * 1.2; if (game.sea) game.sea.bubbles.emit(pos.x, hip + 0.2, pos.z); audio.bubble(); }
          if (S.breath <= 0) {
            S.drownT -= dt;
            if (S.drownT <= 0) { S.drownT = 0.7; game.rules.hurt(4); hud.toast('OUT OF BREATH', 'SWIM UP FOR AIR'); }
          }
        } else { S.breath = Math.min(1, S.breath + dt * 0.45); S.drownT = 0; }
        // ---- pose
        let name = 'tread';
        const moving = S.speedXZ > 0.55;
        const elev = Math.atan2(S.vy, Math.max(S.speedXZ, 0.3));
        if (S.submerged || S.sy < top_ - 0.45 || Math.abs(S.vy) > 1.2) name = 'glide';
        else if (moving) name = 'crawl';
        S.lastPose = name;
        const k = clamp(S.speedXZ / 3, 0, 1.6);
        S.phase += dt * (name === 'crawl' ? 2.6 + S.speedXZ * 1.3 : name === 'glide' ? 2 + S.speedXZ * 0.8 : 1);
        const prev = S.strokeN; S.strokeN = Math.floor(S.phase / PI);
        if (name === 'crawl' && S.strokeN !== prev) audio.stroke(0.5 + k * 0.4);
        const tgt = name === 'tread' ? POSES.tread(S.phase) : name === 'crawl' ? POSES.crawl(S.phase, k) : POSES.glide(S.phase, k, clamp(PI / 2 - elev * 0.85, 0.5, 2.65));
        S.pose = blend(S.pose, tgt, name === 'glide' ? 6 : 8, dt);
        if (reducedMotion) { S.pose.rz *= 0.4; }
        P.model.root.position.set(pos.x, S.sy, pos.z); P.model.root.rotation.set(0, P.yaw, 0);
        applyPose(P.model, S.pose, S.sy);
        P.shadow.visible = false;
      }
      cam.maxY = S.submerged ? WL - 0.3 : 1e9;
      // a ladder in reach?
      S.ladder = S.mode === 'swim' && S.sy > FLOAT_Y - 0.9 ? nearLadder(pos.x, pos.z) : null;
      if (S.ko > 0) S.ko -= dt;
      return true;
    },
  };
  return api;
}
