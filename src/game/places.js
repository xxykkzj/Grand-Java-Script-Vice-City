// Places you can walk into: the glowing ring at each door, the entry scene, walking around
// inside, the way back out, and the two shops (outfits at Zigzag Threads, snacks at Pelican Pantry 24).
import { clamp, lerp, damp, angleDelta, pushOut, timeU, PI, reducedMotion } from '../core/util.js';
import { makeMarker, ease } from './cutscene.js';
import { buildRoom, OY } from './interiors.js';
import { OUTFITS, SNACKS, BARKS, CAST } from './story.js';

const $ = (id) => document.getElementById(id);
const USE_HINT = { bar: 'ask Dee for a delivery', wear: 'try on outfits', mart: 'buy a snack' };

export function createPlaces(game, scene, camera) {
  const { L, player, hud, audio, env, cam, cut, save } = game;
  const list = Object.values(L.places), rooms = {};
  for (const p of list) { p.mark = makeMarker(scene, p.color); p.mark.position.set(p.x, 0, p.z); p.armed = true; }
  const exitMark = makeMarker(scene, '#fff6ec', 0.8, 2.6), useMark = makeMarker(scene, '#ffe14a', 0.7, 1.8);
  const local = { x: 0, z: 0 };
  let shop = null, sel = 0, msg = '', heatCd = 0, barkN = 0;

  const worn = () => OUTFITS.find((o) => o.id === save.outfit) || OUTFITS[0];
  const owns = (o) => !o.price || save.owned.includes(o.id) || (o.gift && save.gift[o.id]);
  player.model.setOutfit(worn());

  const room = (p) => rooms[p.key] || (rooms[p.key] = buildRoom(p, scene));
  const bark = (key) => { const b = BARKS[key]; return `${CAST[b[0]].name}: “${b[1][barkN++ % b[1].length]}”`; };

  function setInside(p, x, z) {
    const r = p.room = room(p);
    if (game.inside && game.inside !== p) game.inside.room.group.visible = false;
    r.group.visible = true; game.inside = p; env.indoor = true; audio.club = p.key === 'club';
    player.floor = OY; player.pos.set(r.ox + x, OY, r.oz + z); player.vel.set(0, 0, 0); player.vy = 0; player.onGround = true; player.yaw = PI; player.speed = 0;
    exitMark.position.set(r.ox, OY, r.oz + r.hz - 1.1);
    if (r.use) useMark.position.set(r.ox + r.use.x, OY, r.oz + r.use.z);
  }
  function putOutside(x, z) {
    if (game.inside) game.inside.room.group.visible = false;
    game.inside = null; env.indoor = false; audio.club = false;
    for (const p of list) p.armed = Math.hypot(p.x - x, p.z - z) > 3;
    player.floor = 0; player.pos.set(x, 0, z); player.yaw = 0; player.vel.set(0, 0, 0); player.vy = 0; player.speed = 0;
    cam.yaw = 0; cam.pitch = 0.2; cam.snap(player.pos);
    exitMark.visible = useMark.visible = false;
  }
  const roamCam = (r, lx, lz, k = 1) => {
    const x = r.ox + lx * 0.55, y = OY + Math.min(3.4, r.h - 0.7), z = r.oz + r.hz - 0.5;
    const c = camera.position;
    if (k >= 1) c.set(x, y, z); else c.set(lerp(c.x, x, k), lerp(c.y, y, k), lerp(c.z, z, k));
    camera.lookAt(r.ox + lx, OY + 1.1, r.oz + lz - 0.6);
  };

  // Walk-in scene: low shot of the courier rolling up to the door, cut inside, a wide reveal,
  // then either a conversation (ev = { lines, leave, done }) or you get the run of the place.
  function enter(p, ev) {
    const r = room(p), b = p.b, sx = player.pos.x, sz = player.pos.z, T1 = ev ? 2.4 : 1.5;
    const goal = ev ? r.me : [0, r.hz - 2.6];
    const beats = [
      {
        dur: reducedMotion ? 0.6 : T1,
        start() { cut.setFov(40); },
        tick(k, dt) {
          const e = ease(k);
          player.pos.set(lerp(sx, p.x, ease(k * 2)), 0, lerp(sz, b.z1 + 2.2, ease(k * 1.15))); player.yaw = PI; player.speed = k < 0.85 ? 4 : 0;
          player.animate(dt, 0, null);
          camera.position.set(p.x + 9 - e * 3, 1.1 + e * 0.6, p.z + 9 - e * 1.5);
          camera.lookAt(p.x + 1.2 * (1 - e), lerp(Math.min(b.h - 2.4, 12), 1.5, e), b.z1 + 1.5);
          if (k > 0.8) cut.fade(true);
        },
      },
      { dur: 0.28, start() { cut.fade(true); } },
      {
        dur: reducedMotion ? 0.8 : ev ? 2 : 1.6,
        start() { setInside(p, 0, r.hz - 1); cut.fade(false); hud.toast(p.title, ev ? '' : bark(p.key)); },
        tick(k, dt) {
          const e = ease(k), lx = lerp(0, goal[0], e), lz = lerp(r.hz - 1, goal[1], e), w = r.wide;
          player.pos.set(r.ox + lx, OY, r.oz + lz); player.yaw = PI + (goal[0] ? -0.3 * Math.sign(goal[0]) * (1 - e) : 0); player.speed = k < 0.9 ? 3.5 : 0;
          player.animate(dt, 0, null);
          r.idle(timeU.value, dt, reducedMotion);
          cut.setFov(lerp(46, ev ? 46 : 60, e));
          camera.position.set(r.ox + w[0] - (reducedMotion ? 0 : e * 0.8 * Math.sign(w[0])), OY + w[1] - e * 0.3, r.oz + w[2]);
          camera.lookAt(r.ox + lerp(w[3], lx, 0.4), OY + w[4], r.oz + lerp(w[5], lz, 0.4));
          if (!ev && k > 0.55) roamCam(r, lx, lz, ease((k - 0.55) / 0.45));
        },
      },
      ...(ev ? cut.talkBeats(r, ev.lines) : []),
    ];
    cut.run(beats, () => after(p, ev), !!(ev && ev.leave));
  }
  function after(p, ev) {
    if (!ev) return;
    if (ev.leave) putOutside(p.x, p.z + 3.4);
    ev.done();
  }
  // a conversation when you are already inside
  function talk(ev) {
    const p = game.inside;
    cut.run(cut.talkBeats(p.room, ev.lines), () => after(p, ev), !!ev.leave);
  }
  function leave() {
    const p = game.inside;
    game.busy = 'door'; cut.fade(true);
    setTimeout(() => { putOutside(p.x, p.z + 3.4); game.busy = null; setTimeout(() => cut.fade(false), 60); }, 320);
  }

  // ---- shops
  const el = { box: $('shop'), t: $('shopt'), l: $('shopl'), f: $('shopf') };
  function render() {
    const wear = shop === 'wear', items = wear ? OUTFITS : SNACKS;
    el.t.textContent = wear ? 'ZIGZAG THREADS' : 'PELICAN PANTRY 24';
    el.l.textContent = '';
    items.forEach((o, i) => {
      const li = document.createElement('li'), b = document.createElement('b'), s = document.createElement('span'), pr = document.createElement('i');
      b.textContent = o.name; s.textContent = o.note;
      pr.textContent = wear ? (save.outfit === o.id ? 'WEARING' : owns(o) ? 'OWNED' : '$' + o.price) : '$' + o.price;
      if (wear && o.gift && !owns(o)) s.textContent += ' (' + o.gift + ', or buy it)';
      if (i === sel) li.className = 'sel';
      li.append(b, pr, s); el.l.appendChild(li);
    });
    el.f.textContent = msg || (wear ? 'W/S choose · Enter wear or buy · Esc done · a new look sheds one star of heat' : 'W/S choose · Enter buy · Esc done');
  }
  function openShop(kind) {
    shop = kind; game.busy = 'shop'; msg = bark(kind);
    sel = kind === 'wear' ? Math.max(0, OUTFITS.findIndex((o) => o.id === save.outfit)) : 0;
    el.box.hidden = false; render();
    audio.blip(true);
  }
  function closeShop() {
    shop = null; game.busy = null; el.box.hidden = true;
    player.model.setOutfit(worn());
  }
  function buy() {
    if (shop === 'wear') {
      const o = OUTFITS[sel];
      if (save.outfit === o.id) { msg = 'YOU ARE WEARING IT'; return render(); }
      if (!owns(o)) {
        if (game.money < o.price) { msg = `NOT ENOUGH CASH: ${o.name} IS $${o.price}`; audio.blip(false); return render(); }
        game.money -= o.price; save.owned.push(o.id);
      }
      save.outfit = o.id; player.model.setOutfit(o); audio.pickup();
      msg = 'LOOKING SHARP: ' + o.name;
      if (game.wanted > 0 && timeU.value > heatCd) { game.wanted--; heatCd = timeU.value + 45; msg += ' · COAST PATROL IS LOOKING FOR THE OLD JACKET: -1 HEAT'; }
      game.persist();
    } else {
      const o = SNACKS[sel];
      if (game.health >= 100) { msg = "YOU'RE FULL. GUS LOOKS RELIEVED."; audio.blip(false); return render(); }
      if (game.money < o.price) { msg = 'NOT ENOUGH CASH'; audio.blip(false); return render(); }
      game.money -= o.price; game.health = Math.min(100, game.health + o.heal); audio.pickup();
      msg = `${o.name}: +${o.heal} HEALTH`;
    }
    render();
  }

  const api = {
    list, enter, talk, putOutside, bark,
    get shop() { return shop; },
    // debug / retry helpers
    warp(key) { const p = L.places[key]; if (game.inside) putOutside(p.x, p.z + 3.4); p.armed = true; player.pos.set(p.x, 0, p.z); },
    warpInside(key) { const p = L.places[key], r = room(p); setInside(p, r.me[0], r.me[1]); },
    key(e) {
      const n = (shop === 'wear' ? OUTFITS : SNACKS).length;
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyQ') return closeShop();
      if (e.code === 'ArrowUp' || e.code === 'KeyW') sel = (sel + n - 1) % n;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') sel = (sel + 1) % n;
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE' || e.code === 'Space') return buy();
      else return;
      msg = ''; audio.step(1);
      if (shop === 'wear') player.model.setOutfit(OUTFITS[sel]);
      render();
    },
    // E while inside
    use() {
      const p = game.inside, r = p && p.room;
      if (!r || !r.use || game.busy || Math.hypot(player.pos.x - r.ox - r.use.x, player.pos.z - r.oz - r.use.z) > r.use.r) return;
      if (p.key === 'bar') game.story.askDee(); else openShop(p.key);
    },
    hint() {
      const p = game.inside, r = p.room;
      if (shop) return [['W S', 'choose'], ['Enter', shop === 'wear' ? 'wear / buy' : 'buy'], ['Esc', 'done']];
      const near = r.use && Math.hypot(player.pos.x - r.ox - r.use.x, player.pos.z - r.oz - r.use.z) < r.use.r;
      return [...(near ? [['E', USE_HINT[p.key]]] : []), ['WASD', 'move'], ['Shift', 'hurry'], ['Door', 'walk into the white ring to leave']];
    },
    update(dt, ctl) {
      const p = game.inside;
      if (!p) {
        // door rings on the street
        const show = game.busy !== 'cut' && game.busy !== 'door';
        for (const q of list) {
          q.mark.visible = show;
          const d = Math.hypot(player.pos.x - q.x, player.pos.z - q.z);
          if (!q.armed) { if (d > 3) q.armed = true; continue; }
          if (show && !game.busy && !game.vehicle && d < 1.7 && player.pos.y < 2) { enter(q, game.story.onEnter(q.key)); break; }
        }
        return;
      }
      for (const q of list) q.mark.visible = false;
      const r = p.room;
      if (game.busy === 'cut') { exitMark.visible = useMark.visible = false; return; }
      r.idle(timeU.value, dt, reducedMotion);
      const lock = game.story.lockInside();
      exitMark.visible = !lock; useMark.visible = !!r.use && !shop && !lock;
      if (shop) {
        const u = r.use;
        if (shop === 'wear') {
          player.pos.set(r.ox + u.x, OY + 0.22, r.oz + u.z - 0.4); player.yaw += angleDelta(player.yaw, 0.25 + (reducedMotion ? 0 : Math.sin(timeU.value * 0.9) * 0.5)) * (1 - Math.exp(-5 * dt));
          camera.position.set(r.ox + u.x + 1.5, OY + 1.5, r.oz + u.z + 2.5); camera.lookAt(r.ox + u.x + 0.75, OY + 1.12, r.oz + u.z - 0.4);
        } else {
          const g = r.npc.GUS;
          player.pos.set(r.ox + u.x, OY, r.oz + u.z); player.yaw += angleDelta(player.yaw, Math.atan2(g.x - u.x, g.z - u.z)) * (1 - Math.exp(-8 * dt));
          camera.position.set(r.ox + u.x - 1.3, OY + 2, r.oz + u.z + 2.1); camera.lookAt(r.ox + g.x - 0.6, OY + 1.3, r.oz + g.z);
        }
        cut.setFov(42);
        player.speed = 0; player.animate(dt, 0, null);
        return;
      }
      // walking around indoors: camera sits above the door looking in, so W is "further in"
      if (!game.busy) {
        let dx = ctl.strafe, dz = -ctl.move;
        const len = Math.hypot(dx, dz), top = ctl.sprint ? 7 : 4.6;
        if (len > 0) { dx = dx / len * top; dz = dz / len * top; }
        player.vel.x = damp(player.vel.x, dx, len > 0 ? 7 : 4, dt); player.vel.z = damp(player.vel.z, dz, len > 0 ? 7 : 4, dt);
        local.x = player.pos.x - r.ox + player.vel.x * dt; local.z = player.pos.z - r.oz + player.vel.z * dt;
        for (const b of r.blocks) pushOut(local, 0.42, b);
        local.x = clamp(local.x, -r.hx + 0.5, r.hx - 0.5); local.z = clamp(local.z, -r.hz + 0.5, r.hz - 0.5);
        player.pos.set(r.ox + local.x, OY, r.oz + local.z);
        player.speed = Math.hypot(player.vel.x, player.vel.z);
        let turn = 0;
        if (player.speed > 0.5) { turn = angleDelta(player.yaw, Math.atan2(player.vel.x, player.vel.z)); player.yaw += turn * (1 - Math.exp(-10 * dt)); }
        player.onGround = true;
        player.animate(dt, turn, audio);
        if (!lock && Math.hypot(local.x, local.z - (r.hz - 1.1)) < 0.9) { leave(); return; }
      } else { player.speed = 0; player.animate(dt, 0, null); }
      cut.setFov(60);
      roamCam(r, player.pos.x - r.ox, player.pos.z - r.oz);
    },
    blips(out) {
      if (game.inside) return;
      for (const q of list) out.push({ x: q.x, z: q.z, color: q.color, near: true, sq: true });
    },
  };
  return api;
}
