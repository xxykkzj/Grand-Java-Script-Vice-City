// Places you can walk into: the glowing ring at each door, the entry scene, walking around
// inside, the way back out, and the two shops (outfits at Zigzag Threads, snacks at Pelican Pantry 24).
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, pushOut, timeU, PI, reducedMotion } from '../core/util.js';
import { makeMarker, ease } from './cutscene.js';
import { buildRoom, OY, rimU } from './interiors.js';
import { OUTFITS, SNACKS, BARKS, CAST, VEND, ARMS, ARMS_INTRO } from './story.js';
import { BRANDS } from '../world/loose.js';

const $ = (id) => document.getElementById(id);
const USE_HINT = { bar: 'ask Dee for a delivery', wear: 'try on outfits', mart: 'buy a snack', arms: 'browse the blasters' };
const RIM = { club: '#5a3a8a', bar: '#4a2050', arms: '#2a3a5a' };
const SHOP_NAME = { mart: 'PELICAN PANTRY 24', arms: 'VOLT & SPARK SUPPLY' };
const statLine = (o) => `${o.kind === 'throw' ? 'BLAST ' + o.radius + ' M' : 'RANGE ' + o.range + ' M'} · DMG ${o.dmg}${o.burst ? ' ×' + o.burst : o.shots ? ' ×' + o.shots : ''} · ${o.ammo} PER BUY`;

export function createPlaces(game, scene, camera) {
  const { L, player, hud, audio, env, cam, cut, save } = game;
  // the story places and the venues (game/venues.js) share the rings, the walk-in and the way out
  const list = [...Object.values(L.places), ...Object.values(L.venues || {})], rooms = {};
  const byKey = (k) => L.places[k] || (L.venues && L.venues[k]);
  // a door faces along (nx, nz): +z for everything on Lumina Boulevard
  const N = (p) => [p.nx ?? 0, p.nz ?? 1];
  const faceYaw = (p) => { const [nx, nz] = N(p); return Math.atan2(nx, nz); };
  const outside = (p, d = 3.4) => { const [nx, nz] = N(p); return [p.x + nx * d, p.z + nz * d]; };
  // the use spots in a room (E): r.uses, or the single r.use; the nearest one in reach
  const usesOf = (r) => r.uses || (r.use ? [r.use] : []);
  const nearUse = (r) => { let best = null, bd = 1e9; for (const u of usesOf(r)) { const d = Math.hypot(player.pos.x - r.ox - u.x, player.pos.z - r.oz - u.z); if (d < u.r && d < bd) { bd = d; best = u; } } return best; };
  let shopUse = null;
  for (const p of list) { p.mark = makeMarker(scene, p.color); p.mark.position.set(p.x, 0, p.z); p.armed = true; }
  const exitMark = makeMarker(scene, '#fff6ec', 0.8, 2.6), useMark = makeMarker(scene, '#ffe14a', 0.7, 1.8);
  exitMark.layers.enable(1); useMark.layers.enable(1);
  const local = { x: 0, z: 0 };
  let shop = null, sel = 0, msg = '', heatCd = 0, barkN = 0, vend = null;

  const worn = () => OUTFITS.find((o) => o.id === save.outfit) || OUTFITS[0];
  const owns = (o) => !o.price || save.owned.includes(o.id) || (o.gift && save.gift[o.id]);
  player.model.setOutfit(worn());

  const room = (p) => rooms[p.key] || (rooms[p.key] = buildRoom(p, scene, game));
  const bark = (key) => { const b = BARKS[key]; return `${CAST[b[0]].name}: “${b[1][barkN++ % b[1].length]}”`; };

  function setInside(p, x, z) {
    const r = p.room = room(p);
    if (game.inside && game.inside !== p) game.inside.room.group.visible = false;
    r.group.visible = true; game.inside = p; env.indoor = true; audio.club = p.key === 'club';
    rimU.value.set(r.rim || RIM[p.key] || '#3a3046');   // a soft rim light on the characters
    camRoom = null;
    camera.layers.set(1);                       // indoors only the room, the courier and the rings are drawn
    player.floor = OY; player.pos.set(r.ox + x, OY, r.oz + z); player.vel.set(0, 0, 0); player.vy = 0; player.onGround = true; player.yaw = PI; player.speed = 0;
    exitMark.position.set(r.ox, OY, r.oz + r.hz - 1.1);
    const u0 = usesOf(r)[0];
    if (u0) useMark.position.set(r.ox + u0.x, OY, r.oz + u0.z);
    if (game.venues) game.venues.entered(p);
  }
  function putOutside(x, z, yaw = 0) {
    if (game.inside) game.inside.room.group.visible = false;
    if (game.act) game.act.reset();
    game.inside = null; env.indoor = false; audio.club = false; camera.layers.set(0); rimU.value.set(0);
    for (const p of list) p.armed = Math.hypot(p.x - x, p.z - z) > 3;
    player.floor = 0; player.pos.set(x, 0, z); player.yaw = yaw; player.vel.set(0, 0, 0); player.vy = 0; player.speed = 0;
    cam.yaw = yaw; cam.pitch = 0.2; cam.snap(player.pos);
    exitMark.visible = useMark.visible = false;
  }
  let camRoom = null;
  const roamCam = (r, lx, lz, k = 1) => {
    let x = r.ox + lx * 0.55, y = OY + Math.min(3.4, r.h - 0.7), z = r.oz + Math.min(r.hz - 0.5, lz + 7.5);
    const c = camera.position, alt = r.camFor && r.camFor(lx, lz);
    if (alt) { x = r.ox + alt[0]; y = OY + alt[1]; z = r.oz + alt[2]; }
    // rooms with a side room ease the camera between its spots instead of cutting
    if (r.camFor && k >= 1 && camRoom === r) k = 1 - Math.exp(-5 * (game.dt || 0.016));
    camRoom = r;
    if (k >= 1) c.set(x, y, z); else c.set(lerp(c.x, x, k), lerp(c.y, y, k), lerp(c.z, z, k));
    camera.lookAt(r.ox + lx, OY + 1.1, r.oz + lz - 0.6);
  };

  // Walk-in scene: low shot of the courier rolling up to the door, cut inside, a wide reveal,
  // then either a conversation (ev = { lines, leave, done }) or you get the run of the place.
  function enter(p, ev) {
    if (game.act) game.act.reset();
    const r = room(p), b = p.b, T1 = ev ? 2.4 : 1.5;
    const goal = ev ? r.me : [0, r.hz - 2.6];
    // street-side staging in the door's own frame: a along the face (t), b out from it (n)
    const [nx, nz] = N(p), tx = nz, tz = -nx, fy = faceYaw(p), out = p.out ?? 5.2;
    const W = (a, q) => [p.x + tx * a + nx * q, p.z + tz * a + nz * q];
    const sa = (player.pos.x - p.x) * tx + (player.pos.z - p.z) * tz, sb = (player.pos.x - p.x) * nx + (player.pos.z - p.z) * nz;
    const beats = [
      {
        dur: reducedMotion ? 0.6 : T1,
        start() { cut.setFov(40); },
        tick(k, dt) {
          const e = ease(k), at = W(lerp(sa, 0, ease(k * 2)), lerp(sb, 2.2 - out, ease(k * 1.15))), cp = W(9 - e * 3, 9 - e * 1.5), lk = W(1.2 * (1 - e), 1.5 - out);
          player.pos.set(at[0], 0, at[1]); player.yaw = fy + PI; player.speed = k < 0.85 ? 4 : 0;
          player.animate(dt, 0, null);
          camera.position.set(cp[0], 1.1 + e * 0.6, cp[1]);
          camera.lookAt(lk[0], lerp(Math.min(b.h - 2.4, 12), 1.5, e), lk[1]);
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
    // if the scene is skipped before the cut inside, still end up indoors (or the door ring re-fires)
    cut.run(beats, () => { if (!ev || !ev.leave) setInside(p, goal[0], goal[1]); after(p, ev); }, !!(ev && ev.leave));
  }
  // the first time you walk into Volt & Spark, Zizi gives you the safety talk
  function firstVisit(key) {
    if (key !== 'arms' || save.armsIntro) return null;
    return { lines: ARMS_INTRO, leave: false, done: () => { save.armsIntro = 1; game.persist(); } };
  }
  function after(p, ev) {
    if (!ev) return;
    if (ev.leave) putOutside(...outside(p), faceYaw(p));
    ev.done();
  }
  // a conversation when you are already inside
  function talk(ev) {
    const p = game.inside;
    if (game.act) game.act.reset();
    cut.run(cut.talkBeats(p.room, ev.lines), () => after(p, ev), !!ev.leave);
  }
  function leave() {
    const p = game.inside;
    game.busy = 'door'; cut.fade(true);
    setTimeout(() => { putOutside(...outside(p), faceYaw(p)); game.busy = null; setTimeout(() => cut.fade(false), 60); }, 320);
  }

  // ---- shops
  const el = { box: $('shop'), t: $('shopt'), l: $('shopl'), f: $('shopf') };
  // a venue menu (game/venues.js): { title, items(), pick(item, i), label, foot, greet() }
  const prov = () => (game.venues ? game.venues.menu(shop) : null);
  const items = () => { const v = prov(); return v ? v.items() : shop === 'wear' ? OUTFITS : shop === 'vend' ? VEND[vend.brand] || VEND.coolwave : shop === 'arms' ? ARMS : SNACKS; };
  function render() {
    const wear = shop === 'wear', arms = shop === 'arms', list = items(), inv = game.arms, v = prov();
    if (sel >= list.length) sel = 0;
    el.t.textContent = v ? v.title : wear ? 'ZIGZAG THREADS' : shop === 'vend' ? (BRANDS[vend.brand] || BRANDS.coolwave).name : SHOP_NAME[shop] || 'PELICAN PANTRY 24';
    el.l.textContent = '';
    list.forEach((o, i) => {
      const li = document.createElement('li'), b = document.createElement('b'), s = document.createElement('span'), pr = document.createElement('i');
      b.textContent = o.name; s.textContent = o.note;
      pr.textContent = v ? (o.tag ?? (o.price ? '$' + o.price : '')) : wear ? (save.outfit === o.id ? 'WEARING' : owns(o) ? 'OWNED' : '$' + o.price) : arms && inv.owned[o.id] ? `+${o.ammo} AMMO · $${o.refill}` : '$' + o.price;
      if (wear && o.gift && !owns(o)) s.textContent += ' (' + o.gift + ', or buy it)';
      if (arms) s.textContent += ` ${statLine(o)}${inv.owned[o.id] ? ` · CARRYING ${inv.ammo[o.id]}` : ''}`;
      if (i === sel) li.className = 'sel';
      // tap / click: the first tap picks, a tap on the picked line buys or wears it
      li.addEventListener('click', () => { if (!shop) return; if (sel === i) buy(); else { sel = i; msg = ''; audio.step(1); if (wear) player.model.setOutfit(OUTFITS[i]); render(); } });
      li.append(b, pr, s); el.l.appendChild(li);
    });
    if (v) { el.f.textContent = msg || (game.input.touchMode ? `Tap to choose · tap again or ${v.label} · DONE to leave` : v.foot || `W/S choose · Enter ${v.label.toLowerCase()} · Esc done`); return; }
    el.f.textContent = msg || (game.input.touchMode ? (wear ? 'Tap to try on · tap again or WEAR / BUY · DONE to leave' : 'Tap to choose · tap again or BUY · DONE to leave') : wear ? 'W/S choose · Enter wear or buy · Esc done · a new look sheds one star of heat' : arms ? 'W/S choose · Enter buy · Esc done · outside: 1-5 or Q to pick, click / R to fire, G to throw' : 'W/S choose · Enter buy · Esc done');
  }
  for (const b of el.box.querySelectorAll('[data-k]')) b.addEventListener('click', () => { if (shop) api.key({ code: b.dataset.k }); });
  function openShop(kind) {
    shop = kind; game.busy = 'shop'; const v = prov();
    msg = v ? v.greet() : kind === 'vend' ? 'IT HUMS AT YOU EXPECTANTLY' : bark(kind);
    sel = kind === 'wear' ? Math.max(0, OUTFITS.findIndex((o) => o.id === save.outfit)) : 0;
    el.box.hidden = false; render();
    const bb = el.box.querySelector('[data-k="Enter"]'); if (bb) bb.textContent = v ? v.label : kind === 'wear' ? 'WEAR / BUY' : 'BUY';
    audio.blip(true);
  }
  function closeShop() {
    const v = prov(); if (v && v.close) v.close();
    shop = null; shopUse = null; game.busy = null; el.box.hidden = true;
    player.model.setOutfit(worn());
  }
  // The try-on view: Skye on the fitting platform is framed in the part of the screen the menu leaves free
  // (to the right of it on a landscape screen, above it when it sits at the bottom of a portrait one). The
  // camera keeps its three-quarter angle, backs off far enough for her to fit that area, then turns so she
  // lands in its middle.
  const FIT_DIR = new THREE.Vector3(1.5, 0.45, 2.9).normalize();
  function frameFitting(x, y, z) {
    const W = innerWidth, H = innerHeight, rc = el.box.getBoundingClientRect();
    const bottom = !el.box.hidden && rc.top > H * 0.3 && rc.width > W * 0.6;      // the menu across the bottom
    const fx0 = bottom ? 0 : el.box.hidden ? 0 : Math.min(W * 0.7, rc.right), fy1 = bottom ? rc.top : H;
    const cx = (fx0 + W) / 2, cy = fy1 / 2, fw = W - fx0, fh = fy1;
    const fov = 42, tv = Math.tan(fov * Math.PI / 360), th = tv * camera.aspect;
    // she is about 1.9 m tall standing on the platform (and 0.9 m wide as she turns): fit 78 % of the free area
    const dist = Math.max(2.6, 2.1 / (2 * tv * 0.78 * fh / H), 1.1 / (2 * th * 0.78 * fw / W));
    const sy = y + 0.9;
    camera.position.set(x + FIT_DIR.x * dist, sy + FIT_DIR.y * dist, z + FIT_DIR.z * dist);
    camera.lookAt(x, sy, z);
    const nx = cx / W * 2 - 1, ny = 1 - cy / H * 2;
    camera.rotateY(Math.atan(nx * th)); camera.rotateX(-Math.atan(ny * tv));
  }
  function buy() {
    const v = prov();
    if (v) { const m = v.pick(items()[sel], sel); if (!shop) return; msg = m || ''; return render(); }
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
    } else if (shop === 'arms') {
      const [ok, m] = game.combat.buy(items()[sel]);
      msg = m;
      if (ok) { audio.cash(); audio.pickup(); } else audio.blip(false);
    } else {
      const o = items()[sel];
      if (game.money < o.price) { msg = 'NOT ENOUGH CASH'; audio.blip(false); return render(); }
      game.money -= o.price;
      if (shop === 'vend') { game.loose.drop(vend); audio.cash(); } else audio.pickup();
      // eat or drink it (game/eat.js): health up to 100, or REFRESHED at full health
      msg = game.eat.consume(o);
    }
    render();
  }

  const api = {
    list, enter, talk, putOutside, bark, byKey, openShop, closeShop, render, outside, faceYaw,
    // a place's room (built on first use), and stepping straight into it at room (x, z) (the Spire's lift)
    roomOf: (p) => room(p),
    enterRoom(key, x, z) { const p = byKey(key); setInside(p, x, z); return p.room; },
    get shopUse() { return shopUse; },
    // F at a street vending machine
    openVend(m) { vend = m; game.act.reset(); player.vel.set(0, 0, 0); player.speed = 0; player.yaw = m.yaw + PI; openShop('vend'); },
    get shop() { return shop; },
    // debug / retry helpers
    warp(key) { const p = byKey(key); if (game.inside) putOutside(...outside(game.inside), faceYaw(game.inside)); p.armed = true; player.pos.set(p.x, 0, p.z); },
    warpInside(key) { const p = byKey(key), r = room(p); setInside(p, r.me[0], r.me[1]); },
    // walk out of the current room at once (automated checks)
    exit() { const p = game.inside; if (p) putOutside(...outside(p), faceYaw(p)); },
    key(e) {
      const n = items().length;
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyQ') return closeShop();
      if (e.code === 'ArrowUp' || e.code === 'KeyW') sel = (sel + n - 1) % n;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') sel = (sel + 1) % n;
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE' || e.code === 'Space') return buy();
      else return;
      msg = ''; audio.step(1);
      if (shop === 'wear') player.model.setOutfit(OUTFITS[sel]);
      render();
    },
    // pick a menu line directly (automated checks): select line i and press it
    choose(i) { if (!shop) return null; sel = i; buy(); return msg; },
    get msg() { return msg; },
    // E while inside
    use() {
      const p = game.inside, r = p && p.room;
      if (!r || game.busy) return;
      const u = nearUse(r);
      if (!u) return;
      if (p.key === 'bar') game.story.askDee();
      else if (game.venues && game.venues.use(p, u)) shopUse = u;
      else openShop(p.key);
    },
    hint() {
      if (shop) return [['W S', 'choose'], ['Enter', shop === 'wear' ? 'wear / buy' : 'buy'], ['Esc', 'done']];
      const p = game.inside, r = p.room;
      const ah = game.act.hint();
      if (ah) return ah;
      const u = nearUse(r), f = game.act.fHint();
      return [...(u ? [['E', u.hint || USE_HINT[p.key]]] : []), ...(f ? [f] : []), ['WASD', 'move'], ['Shift', 'hurry'], ['Door', 'walk into the white ring to leave']];
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
          if (show && !game.busy && !game.vehicle && d < 1.7 && player.pos.y < 2) { enter(q, game.story.onEnter(q.key) || firstVisit(q.key)); break; }
        }
        return;
      }
      for (const q of list) q.mark.visible = false;
      const r = p.room;
      if (game.busy === 'cut') { exitMark.visible = useMark.visible = false; return; }
      r.idle(timeU.value, dt, reducedMotion);
      const lock = game.story.lockInside();
      exitMark.visible = !lock; useMark.visible = usesOf(r).length > 0 && !shop && !lock && game.busy !== 'arcade';
      if (useMark.visible) {
        // the yellow ring sits on the nearest use spot
        let best = null, bd = 1e9;
        for (const u of usesOf(r)) { const d = Math.hypot(player.pos.x - r.ox - u.x, player.pos.z - r.oz - u.z); if (d < bd) { bd = d; best = u; } }
        useMark.position.set(r.ox + best.x, OY, r.oz + best.z);
      }
      if (game.busy === 'arcade' && game.venues) { game.venues.arcadeUpdate(dt); return; }
      if (shop) {
        const u = shopUse || r.use;
        if (shop === 'wear') {
          player.pos.set(r.ox + u.x, OY + 0.22, r.oz + u.z - 0.4); player.yaw += angleDelta(player.yaw, 0.25 + (reducedMotion ? 0 : Math.sin(timeU.value * 0.9) * 0.5)) * (1 - Math.exp(-5 * dt));
          frameFitting(r.ox + u.x, OY + 0.22, r.oz + u.z - 0.4);
        } else {
          const g = u.look ? { x: u.look[0], z: u.look[1] } : r.npc[u.clerk || r.clerk || 'GUS'], cs = u.cam || [-1.3, 2, 2.1];
          player.pos.set(r.ox + u.x, OY, r.oz + u.z); player.yaw += angleDelta(player.yaw, Math.atan2(g.x - u.x, g.z - u.z)) * (1 - Math.exp(-8 * dt));
          camera.position.set(r.ox + u.x + cs[0], OY + cs[1], r.oz + u.z + cs[2]); camera.lookAt(r.ox + g.x - (u.look ? 0 : 0.6), OY + (u.lookY || 1.3), r.oz + g.z);
        }
        cut.setFov(42);
        player.speed = 0; player.animate(dt, 0, null);
        return;
      }
      // sitting on a stool / sofa, or dancing (the dance owns the camera)
      if (!game.busy && game.act.mode) {
        game.act.update(dt, ctl, game.input);
        if (game.act.dancing) return;
        if (game.act.mode) { cut.setFov(60); roamCam(r, player.pos.x - r.ox, player.pos.z - r.oz); return; }
      }
      // walking around indoors: camera sits above the door looking in, so W is "further in"
      if (!game.busy) {
        let dx = ctl.strafe, dz = -ctl.move;
        const len = Math.hypot(dx, dz), top = (ctl.sprint ? 7 : 4.6) * (player.boost || 1);
        if (len > 0) { const k = top * Math.min(1, len) / len; dx *= k; dz *= k; }
        player.vel.x = damp(player.vel.x, dx, len > 0 ? 7 : 4, dt); player.vel.z = damp(player.vel.z, dz, len > 0 ? 7 : 4, dt);
        local.x = player.pos.x - r.ox + player.vel.x * dt; local.z = player.pos.z - r.oz + player.vel.z * dt;
        for (const b of r.blocks) pushOut(local, 0.42, b);
        if (r.pushPeople) r.pushPeople(local, 0.3);
        local.x = clamp(local.x, (r.x0 ?? -r.hx) + 0.5, (r.x1 ?? r.hx) - 0.5); local.z = clamp(local.z, -r.hz + 0.5, r.hz - 0.5);
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
