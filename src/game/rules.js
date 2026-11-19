// The game layer on top of the sandbox: cash, health, heat (wanted stars) and the Coast
// Patrol, carjacking, pickups and the CAUGHT / KNOCKED OUT cards.
// Heat comes from taking an occupied vehicle, running people over, tank fire and red lights in
// view of a patrol car. Bumping other cars is just traffic: it never adds a star.
import * as THREE from 'three';
import { box, merge, clamp, lerp, angleDelta, segBlocked, timeU, PI, reducedMotion } from '../core/util.js';
import { signal } from '../world/roads.js';
import { onRoad } from '../world/layout.js';
import { createGlow } from '../world/glow.js';

const $ = (id) => document.getElementById(id);
const CASH = [[40, 205], [-205, 112], [228, 116], [-150, -144], [150, -144], [118, 71], [-262, 4], [0, -112]];
const REASON = {
  jack: 'THAT WAS NOT YOUR RIDE', ped: 'WATCH WHERE YOU ROLL', tank: 'HEAVY ARTILLERY ON THE BOULEVARD',
  red: 'COAST PATROL SAW THAT RED LIGHT', patrol: 'YOU STOLE A PATROL CAR',
  copshot: 'YOU OPENED FIRE ON THE COAST PATROL', shots: 'SHOOTING UP CARS IN FRONT OF THE PATROL', copwreck: 'A PATROL CAR WENT UP IN SMOKE',
};

export function createRules(game, scene) {
  const { L, vehicles, player, audio, hud, env, peds, traffic, R, cam } = game;
  Object.assign(game, { money: 250, health: 100, wanted: 0, cooling: false, mission: null, busy: null, inside: null, stats: { jobs: 0, reds: 0 } });
  const cd = {};
  let unseen = 0, hurtCd = 0, bust = 0, losT = 0, seen = false, frame = 0, jack = null, lastNode = null;

  // ---- markers and pickups
  const basic = new THREE.MeshBasicMaterial({ vertexColors: true });
  const cashMesh = new THREE.InstancedMesh(merge([
    box(0.8, 0.3, 0.42, 0, 0, 0, '#39d98a'), box(0.2, 0.31, 0.43, 0, 0, 0, '#fff3c4'), box(0.82, 0.05, 0.44, 0, 0, 0, '#1f9a5c'),
  ]), basic, CASH.length);
  const medMesh = new THREE.InstancedMesh(merge([
    box(0.7, 0.7, 0.3, 0, 0, 0, '#fff6ec'), box(0.5, 0.16, 0.34, 0, 0, 0, '#ff3fb4'), box(0.16, 0.5, 0.34, 0, 0, 0, '#ff3fb4'),
  ]), basic, 2);
  cashMesh.frustumCulled = medMesh.frustumCulled = false;
  scene.add(cashMesh, medMesh);
  const picks = CASH.map(([x, z], i) => ({ x, z, i, cash: 40 + (i * 37) % 90, t: 0, mesh: cashMesh }));
  picks.push({ x: L.clinic.x + 4, z: L.clinic.z, i: 0, med: true, t: 0, mesh: medMesh }, { x: 40, z: 168, i: 1, med: true, t: 0, mesh: medMesh });
  const glow = createGlow(scene, picks.length);
  picks.forEach((p, k) => { p.g = k; glow.add(p.x, 1.1, p.z, p.med ? '#ff3fb4' : '#6dffb0', 3.4, 0.55); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

  // car door used by the carjack animation (one mesh, hidden the rest of the time)
  const doorMat = new THREE.MeshLambertMaterial();
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 1.05).translate(0, 0, -0.52), doorMat);
  door.visible = false; scene.add(door);

  const card = $('card'), fade = $('fade');
  const onFoot = () => !game.vehicle;
  const pSpeed = () => { const v = game.vehicle; return v ? (v.kind === 'tank' ? Math.abs(v.speed) : Math.hypot(v.vx, v.vz)) : player.speed; };

  function crime(kind, n = 1, wait = 3) {
    if (cd[kind] > timeU.value || game.busy === 'down') return;
    cd[kind] = timeU.value + wait;
    unseen = 0;
    if (game.wanted >= 5) return;
    game.wanted = Math.min(5, game.wanted + n);
    audio.star();
    hud.toast('HEAT ' + '★'.repeat(game.wanted), REASON[kind]);
  }
  function hurt(n) {
    if (game.busy === 'down' || game.busy === 'cut') return;
    game.health = Math.max(0, game.health - n);
    if (!reducedMotion) game.fx.shake = Math.max(game.fx.shake, 0.25);
    if (game.health <= 0) down('KNOCKED OUT', 'ko', L.clinic, 'SEABREEZE CLINIC BILL', 0.1, 40);
  }
  function leaveVehicle() {
    const v = game.vehicle;
    if (!v) return;
    v.driven = false; game.vehicle = null; game.mode = 'foot'; player.setHidden(false);
  }
  // full-screen card, then wake up somewhere else a little poorer
  function down(title, cls, at, what, cut, least) {
    game.busy = 'down';
    if (jack) { jack.c.ai && (jack.c.ai.hold = false); jack.c.jacking = false; door.visible = false; jack = null; }
    const fee = Math.min(game.money, Math.max(least, Math.round(game.money * cut / 5) * 5));
    $('cardt').textContent = title; $('cards').textContent = fee ? `${what}: -$${fee}` : what + ': ON THE HOUSE';
    card.className = 'on ' + cls;
    audio.lose();
    game.story.onDown(title);
    setTimeout(() => fade.classList.add('on'), 2300);
    setTimeout(() => {
      leaveVehicle();
      game.places.putOutside(at.x, at.z);
      // walk out of the doorway (at.z is 5.4 m in front of the facade) a few steps onto the sidewalk.
      // The camera watches from the street side meanwhile; with it behind the courier from the start it
      // would sit inside the building and get pulled right up against Skye's back.
      let endZ = at.z + 1.6;
      if (onRoad(at.x, endZ, 0.6)) endZ = at.z;
      walk = { t: 0, x: at.x, z0: at.z - 4.6, z1: endZ };
      player.pos.set(at.x, 0, walk.z0); player.vel.set(0, 0, 0); player.vy = 0; player.yaw = 0; player.speed = 0;
      cam.yaw = PI + 0.5; cam.pitch = 0.24;
      game.money -= fee; game.health = 100; game.wanted = 0; unseen = 0; bust = 0;
      card.className = ''; game.busy = 'walkout';
      setTimeout(() => fade.classList.remove('on'), 80);
    }, 2750);
  }

  // ---- after CAUGHT / KNOCKED OUT: stroll out of the station or clinic, then turn along the sidewalk
  let walk = null;
  function stepWalk(dt) {
    walk.t += dt;
    const T = 2.0, k = clamp(walk.t / T, 0, 1), e = k * k * (3 - 2 * k);
    player.pos.set(walk.x, 0, lerp(walk.z0, walk.z1, e));
    player.speed = k < 1 ? 2.6 : 0;
    if (walk.t > T) {
      // face along the street and bring the camera round behind, clear of the building
      player.yaw += angleDelta(player.yaw, PI / 2) * (1 - Math.exp(-7 * dt));
      cam.yaw += angleDelta(cam.yaw, player.yaw) * (1 - Math.exp(-4 * dt));
    } else player.yaw = 0;
    player.animate(dt, 0, null);
    if (walk.t > T + 0.9) { cam.yaw = player.yaw; walk = null; game.busy = null; }
  }

  // ---- carjack: glide to the driver's door, swing it open, haul them out, hop in
  function startJack(c) {
    if (game.busy || !c.ai || c.jacking || c.kind === 'tank') return false;
    jack = { c, t: 0, sx: player.pos.x, sz: player.pos.z, out: false };
    c.ai.hold = true; c.ai.pursuit = false; c.jacking = true; game.busy = 'jack';
    doorMat.color.set(c.color);
    return true;
  }
  function stepJack(dt) {
    const c = jack.c, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz, lz = -fx;
    jack.t += dt;
    const t = jack.t, dx = c.x + lx * 1.75 - fx * 0.35, dz = c.z + lz * 1.75 - fz * 0.35;
    c.vx = c.vz = 0;
    if (t < 0.45) {
      const k = t / 0.45;
      player.pos.set(lerp(jack.sx, dx, k), 0, lerp(jack.sz, dz, k)); player.speed = 6;
    } else if (t < 0.95) { player.pos.set(dx, 0, dz); player.speed = 0; }
    else {
      const k = clamp((t - 0.95) / 0.4, 0, 1);
      player.pos.set(lerp(dx, c.x + lx * 0.5, k), 0.25 * Math.sin(k * PI), lerp(dz, c.z + lz * 0.5, k)); player.speed = 3;
    }
    player.yaw += angleDelta(player.yaw, Math.atan2(c.x - player.pos.x, c.z - player.pos.z)) * (1 - Math.exp(-14 * dt));
    player.animate(dt, 0, null);
    const open = clamp((t - 0.3) / 0.25, 0, 1) * (1 - clamp((t - 1.2) / 0.15, 0, 1));
    door.visible = c.kind === 'car';
    door.position.set(c.x + lx * 0.97 + fx * 0.3, c.y + 0.72, c.z + lz * 0.97 + fz * 0.3);
    door.rotation.y = c.yaw - open * 1.15;
    if (t > 0.4 && t < 0.95) { player.model.armR.rotation.x = -1.5; player.model.armL.rotation.x = -1.3; }
    if (t >= 0.62 && !jack.out) {
      jack.out = true; c.hasDriver = false;
      peds.eject(dx + lx * 0.9 - fx * 0.8, dz + lz * 0.9 - fz * 0.8, lx * 3.5 - fx * 3, lz * 3.5 - fz * 3);
      audio.thud(0.4);
      peds.alarm(c.x, c.z, 14);
    }
    if (t >= 1.35) {
      door.visible = false;
      traffic.release(c);
      c.jacking = false; c.driven = true; c.traffic = !c.police;
      game.vehicle = c; game.mode = c.kind; game.busy = null;
      player.pos.y = 0; player.setHidden(c.kind !== 'bike');
      audio.thud(0.3);
      crime(c.police ? 'patrol' : 'jack', c.police ? 2 : 1, 0.5);
      jack = null;
    }
  }

  // ---- hooks from the sandbox
  vehicles.onCollide = (a, b, imp) => {
    const mine = a.driven ? a : b.driven ? b : null;
    if (!mine || imp < 4) return;
    // fender benders are free: no heat for car-on-car contact, only a few bruises if it was a big one
    // (the car itself takes the damage: see game/damage.js)
    if (imp > 14 && mine.kind === 'car') hurt(Math.min(15, (imp - 14) * 0.6));
  };
  // a heavy crash on the Comet sends the courier over the bars
  vehicles.onThrow = (c, sp) => {
    if (game.busy || game.vehicle !== c) return;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), k = Math.min(sp, 30) * 0.4;
    leaveVehicle();
    player.pos.set(c.x, 0.9, c.z); player.vel.set(fx * k, 0, fz * k); player.vy = 6.5; player.onGround = false; player.yaw = c.yaw;
    c.spin += (Math.random() - 0.5) * 8; c.vx *= 0.4; c.vz *= 0.4;
    hurtCd = 1.2;
    audio.thud(0.9);
    hud.toast('THROWN OFF', 'THE COMET IS FAST, NOT FORGIVING');
    hurt(Math.min(38, 8 + sp * 0.8));
  };
  // tank shells: the blast (vehicle damage, people, props, the courier on foot) is in game/damage.js
  vehicles.onShot = (x, z) => { peds.alarm(x, z, 40); crime('tank', 1, 1.5); };
  game.pedHit = (p, o) => { if (game.events && game.events.pedHit(p, o)) return; if (o.driven) crime('ped', 1, 2); };

  const rules = {
    crime, hurt, startJack, leaveVehicle,
    blips: [],
    update(dt) {
      frame++;
      const f = game.focus(), t = timeU.value;
      if (jack) stepJack(dt);
      if (walk) stepWalk(dt);

      // pickups spin and bob; respawn after a while
      for (const p of picks) {
        if (p.t > 0) { p.t -= dt; if (p.t <= 0) glow.set(p.g, p.x, 1.1, p.z, null, 3.4, 0.55); }
        const live = p.t <= 0, y = 1.05 + Math.sin(t * 2.4 + p.x) * 0.16;
        if (live) m4.compose(v3.set(p.x, y, p.z), q.setFromEuler(eu.set(0.25, t * 2 + p.x, 0)), one); else m4.makeScale(0, 0, 0);
        p.mesh.setMatrixAt(p.i, m4);
        if (live && !game.busy && Math.abs(f.y) < 2.5 && Math.hypot(f.x - p.x, f.z - p.z) < (onFoot() ? 1.5 : 2.8) && !(p.med && game.health >= 100)) {
          p.t = 45; glow.hide(p.g);
          audio.pickup();
          if (p.med) { game.health = 100; hud.toast('PATCHED UP', 'HEALTH RESTORED'); } else { game.money += p.cash; hud.toast('+$' + p.cash, 'LOOSE CHANGE'); }
        }
      }
      cashMesh.instanceMatrix.needsUpdate = medMesh.instanceMatrix.needsUpdate = true;
      glow.commit();

      // Coast Patrol: do they see you? are they on top of you?
      let near = 1e9;
      if ((losT -= dt) <= 0) {
        losT = 0.2; seen = false;
        for (const c of traffic.police) {
          if (c.off || !c.ai) continue;
          const d = Math.hypot(c.x - f.x, c.z - f.z);
          if (d < 75 && !game.inside && !segBlocked(c.x, c.z, f.x, f.z, L.solids)) seen = true;
        }
      }
      let siren = 0;
      for (const c of traffic.police) {
        if (c.off || !c.ai) continue;
        const d = Math.hypot(c.x - f.x, c.z - f.z);
        if (d < near) near = d;
        if (c.ai.siren) { siren = Math.max(siren, clamp(1.15 - d / 110, 0.12, 1)); if ((frame + c.idx) % 45 === 0) peds.alarm(c.x, c.z, 20); }
      }
      game.siren = siren; game.seen = seen;
      if (game.wanted > 0 && !game.busy) {
        if (seen) unseen = 0; else unseen += dt;
        if (unseen > 24) { game.wanted--; unseen = 14; if (!game.wanted) hud.toast('HEAT GONE', 'COAST PATROL LOST INTEREST'); }
        const airborne = game.mode === 'heli' && game.vehicle.y > 1;
        if (game.wanted >= 2 && !airborne && !game.inside && near < (onFoot() ? 6.6 : 8) && pSpeed() < (onFoot() ? 8.5 : 3.5)) bust += dt; else bust = Math.max(0, bust - dt * 2);
        if (bust > 1.3) down('CAUGHT', 'bust', L.station, 'COAST PATROL FINE', 0.15, 50);
      } else bust = 0;
      game.cooling = game.wanted > 0 && unseen > 6;

      // running a red in front of a patrol car
      const v = game.vehicle;
      let inNode = null;
      if (v && v.kind !== 'heli') for (const n of R.lights) if (Math.abs(v.x - n.x) < n.hx && Math.abs(v.z - n.z) < n.hz) { inNode = n; break; }
      if (inNode && inNode !== lastNode && pSpeed() > 5) {
        const h = Math.abs(v.vx) > Math.abs(v.vz);
        if (signal(inNode, h, t) === 2) { game.stats.reds++; if (near < 55 && seen) crime('red', 1, 5); }
      }
      lastNode = inNode;

      // traffic hurts when you are on foot
      hurtCd -= dt;
      if (onFoot() && !game.busy && !game.inside && hurtCd <= 0 && player.pos.y < 1.2) {
        for (const c of vehicles.cars) {
          if (c.off) continue;
          const dx = player.pos.x - c.x, dz = player.pos.z - c.z, d = Math.hypot(dx, dz), sp = Math.hypot(c.vx, c.vz);
          if (sp < 4.5 || c.vx * dx + c.vz * dz < 0 || d > 5 || vehicles.bodyDist(c, player.pos.x, player.pos.z) > 0.5) continue;
          hurtCd = 0.9;
          player.vel.x += c.vx * 0.9; player.vel.z += c.vz * 0.9; player.vy = 5.5; player.pos.y += 0.05;
          audio.thud(0.7);
          hurt(Math.min(45, sp * 2.2));
          break;
        }
        peds.bump(player);
      }

      // minimap blips
      const bl = rules.blips;
      bl.length = 0;
      for (const p of picks) if (p.t <= 0) bl.push({ x: p.x, z: p.z, color: p.med ? '#ff8ad0' : '#6dffb0', near: true });
      game.places.blips(bl); game.story.blips(bl); if (game.events) game.events.blips(bl);
    },
  };
  return rules;
}
