// What you can DO in the venues (rooms in game/venuerooms.js, doors in world/layout.js VENUE_DEFS):
//   diner   order a meal at the counter (heals), the jukebox, sit at the counter or in a booth (F)
//   arcade  Skate Surge, a tiny original arcade game on the back cabinet, with a saved high score
//   motel   the safehouse: sleep to morning / golden hour, or just save (game/saves.js: the same slot as the autosave)
//   mall    Kiki's pretzel cart, and a coin in the wishing fountain
//   bait    Cap'n Rudy's counter: a snorkel vest (more breath under water), tackle trivia, taffy
//   barber  Fade & Fringe: Dolly's chair (game/salon.js): hairstyle, colour, facial hair, the cap
//   lounge  the Blue Pelican: Birdie's drinks (a little health), the jukebox / stage skip the record
//           (audio/music.js streams them), a now-playing card with title, artist and licence
// Menus reuse the shop panel (game/places.js asks menu(kind) for a provider).
import { clamp, rng, PI, reducedMotion, angleDelta } from '../core/util.js';
import { SKYBAR_MENU } from './story.js';
import { CAST, BARKS, DINER_MENU, DINER_SIT, JUKEBOX, MOTEL_MENU, MOTEL_WAKE, PRETZELS, WISHES, BAIT_MENU, TRIVIA, TRIVIA_RIGHT, TRIVIA_WRONG, LOUNGE_MENU, CLUB_MENU, KIOSK_MENU, PIER_MENU, PIER_GREET } from './story.js';
import { OY } from './interiors.js';
import { createSalon } from './salon.js';

const $ = (id) => document.getElementById(id);
const pickOf = (a, n) => a[((n % a.length) + a.length) % a.length];
const say = (key, i) => { const b = BARKS[key]; return `${CAST[b[0]].name}: “${pickOf(b[1], i)}”`; };

export function createVenues(game) {
  const { player, hud, audio, save, env, camera } = game;
  let n = 0, jukeI = 0, wishN = 0, triviaN = 0, trivia = null, sitSeen = null;
  const stats = { meals: 0, songs: 0, wishes: 0, sleeps: 0, saves: 0, trivia: 0, right: 0, games: 0, lastScore: 0 };
  // buy it, then eat or drink it (game/eat.js): it heals, or at full health it refreshes you instead
  const feed = (o) => {
    if (game.money < o.price) { audio.blip(false); return `NOT ENOUGH CASH: ${o.name} IS $${o.price}`; }
    game.money -= o.price; audio.cash(); audio.pickup(); stats.meals++;
    return game.eat.consume(o);
  };

  // ---- menus -------------------------------------------------------------------------------------
  const salon = createSalon(game);
  const MENUS = {
    salon,
    diner: {
      title: 'SUNSET STRIP DINER', label: 'ORDER',
      items: () => DINER_MENU, greet: () => say('diner', n++),
      pick: (o) => feed(o),
    },
    motel: {
      title: 'MOONLITE · ROOM 7', label: 'REST',
      items: () => MOTEL_MENU, greet: () => say('motel', n++),
      pick: (o) => { api.closeMenu(); sleep(o.to); return null; },
    },
    cart: {
      title: "KIKI'S KNOTS", label: 'BUY',
      items: () => PRETZELS.filter((o) => o.id !== 'wish'), greet: () => say('mall', n++),
      pick: (o) => feed(o),
    },
    lounge: {
      title: 'THE BLUE PELICAN · BAR', label: 'ORDER',
      items: () => LOUNGE_MENU, greet: () => say('lounge', n++),
      pick: (o) => feed(o),
    },
    clubbar: {
      title: 'PRISM BAR', label: 'ORDER',
      items: () => CLUB_MENU, greet: () => 'TAPS: “What can I pour you? On the beat, as always.”',
      pick: (o) => feed(o),
    },
    skybar: {
      title: 'THE AFTERGLOW BAR · FLOOR 23', label: 'ORDER',
      items: () => SKYBAR_MENU, greet: () => (game.spire ? game.spire.greet() : ''),
      pick: (o) => feed(o),
    },
    pier: {
      title: 'SUGAR TIDE · STARLIGHT PIER', label: 'BUY',
      items: () => PIER_MENU, greet: () => PIER_GREET[n++ % PIER_GREET.length],
      pick: (o) => feed(o),
    },
    kiosk: {
      title: 'COCONUT SHACK', label: 'BUY',
      items: () => KIOSK_MENU, greet: () => 'SMOOTHIES, SOFT SERVE AND COCONUTS. EVERYTHING COMES WITH SAND.',
      pick: (o) => feed(o),
    },
    bait: {
      get title() { return trivia ? 'TACKLE TRIVIA' : 'STARBOARD BAIT & TACKLE'; },
      get label() { return trivia ? 'ANSWER' : 'BUY'; },
      items: () => (trivia ? trivia.opts.map((a, i) => ({ name: a, note: '', tag: 'ABC'[i] })) : BAIT_MENU.map((o) => (o.id === 'vest' && save.vest ? { ...o, tag: 'WEARING' } : o))),
      greet: () => say('bait', n++),
      close: () => { trivia = null; },
      pick(o, i) {
        if (trivia) {
          const ok = i === trivia.right; stats.trivia++;
          trivia = null;
          if (ok) { stats.right++; game.money += 10; audio.cash(); return `${pickOf(TRIVIA_RIGHT, stats.right)} +$10`; }
          audio.blip(false); return `${pickOf(TRIVIA_WRONG, stats.trivia)}`;
        }
        if (o.id === 'trivia') {
          const q = TRIVIA[triviaN++ % TRIVIA.length], r = rng(triviaN * 7 + 3), order = [0, 1, 2];
          for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
          trivia = { opts: order.map((k) => q[1][k]), right: order.indexOf(q[2]) };
          audio.blip(true);
          return q[0].toUpperCase();
        }
        if (o.id === 'vest') {
          if (save.vest) { audio.blip(false); return 'YOU ALREADY HAVE ONE. IT SUITS YOU.'; }
          if (game.money < o.price) { audio.blip(false); return `NOT ENOUGH CASH: THE VEST IS $${o.price}`; }
          game.money -= o.price; save.vest = 1; game.persist(); audio.cash(); audio.pickup();
          return 'BUOY-O VEST ON: YOU CAN HOLD YOUR BREATH 75% LONGER';
        }
        return feed(o);
      },
    },
  };

  // ---- the motel: sleep, save -----------------------------------------------------------------------
  function sleep(to) {
    game.busy = 'door'; game.cut.fade(true);
    setTimeout(() => {
      if (to !== undefined) { env.tod = to; env.target = null; game.health = 100; game.wanted = 0; stats.sleeps++; }
      save.motel = { cash: game.money, tod: +env.tod.toFixed(2), at: Date.now() };
      // the same slot the autosave writes (game/saves.js); you wake up at the motel's door after a reload
      const r = game.saves ? game.saves.manual() : { ok: false, why: 'COULD NOT SAVE' };
      if (r.ok) stats.saves++;
      game.busy = null;
      setTimeout(() => game.cut.fade(false), 120);
      hud.toast(r.ok ? 'GAME SAVED' : r.why, to !== undefined ? pickOf(MOTEL_WAKE, stats.sleeps) : r.ok ? 'THE GUEST BOOK HAS YOUR NAME IN IT NOW' : 'HAZEL SHRUGS AT THE GUEST BOOK');
      audio.pickup();
    }, reducedMotion ? 350 : 900);
  }

  // ---- Skate Surge: a tiny arcade game drawn on a 160 x 208 canvas -----------------------------------
  const W = 160, H = 208, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const box = $('arcade'), view = $('arcc'), foot = $('arcf');
  const vctx = view ? view.getContext('2d') : null;
  const A = { mode: 'attract', x: W / 2, t: 0, score: 0, stars: 0, speed: 60, obs: [], items: [], spawn: 0, spark: [], over: 0, frameT: 0, flash: 0 };
  const best = () => save.arcade || 0;
  const BOARD = [['TOK', 4200], ['DOT', 2650], ['RDY', 1200], ['HZL', 900]];
  let rr = rng(86);
  function reset() { Object.assign(A, { mode: 'play', x: W / 2, t: 0, score: 0, stars: 0, speed: 60, obs: [], items: [], spawn: 0.4, spark: [], over: 0, flash: 0 }); rr = rng(86 + stats.games * 13); }
  function start() {
    if (game.money < 1) { audio.blip(false); foot.textContent = 'ONE TOKEN IS $1. YOU ARE OUT OF QUARTERS.'; return false; }
    game.money -= 1; audio.cash(); stats.games++; reset(); return true;
  }
  function step(dt, input) {
    A.t += dt; A.frameT += dt; A.flash = Math.max(0, A.flash - dt);
    if (A.mode !== 'play') return;
    const dir = (input.isDown('ArrowRight', 'KeyD') ? 1 : 0) - (input.isDown('ArrowLeft', 'KeyA') ? 1 : 0) + (input.stick.on ? input.stick.x : 0);
    A.x = clamp(A.x + clamp(dir, -1, 1) * 120 * dt, 14, W - 14);
    A.speed = 60 + A.t * 5;
    A.score += dt * 10 * (1 + A.t * 0.05);
    A.spawn -= dt;
    if (A.spawn <= 0) {
      A.spawn = Math.max(0.28, 0.9 - A.t * 0.025) * (0.7 + rr() * 0.6);
      const k = rr();
      if (k < 0.2) A.items.push({ x: 14 + rr() * (W - 28), y: -10 });
      else A.obs.push({ x: 14 + rr() * (W - 28), y: -14, w: k < 0.55 ? 12 : k < 0.8 ? 22 : 34, kind: k < 0.55 ? 'cone' : k < 0.8 ? 'puddle' : 'car', c: ['#ff4fa3', '#27d8cf', '#ffd447', '#9b7bff'][Math.floor(rr() * 4)] });
    }
    for (const o of A.obs) o.y += A.speed * dt * (o.kind === 'car' ? 1.35 : 1);
    for (const s of A.items) s.y += A.speed * dt;
    A.obs = A.obs.filter((o) => o.y < H + 30); A.items = A.items.filter((s) => s.y < H + 20 && !s.got);
    const py = H - 26;
    for (const s of A.items) if (Math.abs(s.x - A.x) < 11 && Math.abs(s.y - py) < 12) { s.got = true; A.stars++; A.score += 50; audio.step(1); A.flash = 0.15; }
    for (const o of A.obs) {
      const hh = o.kind === 'car' ? 22 : 10;
      if (Math.abs(o.x - A.x) < o.w / 2 + 4 && Math.abs(o.y - py) < hh / 2 + 5) {
        A.mode = 'over'; A.over = 0; stats.lastScore = Math.floor(A.score);
        audio.thud(0.4); audio.blip(false);
        if (stats.lastScore > best()) { save.arcade = stats.lastScore; game.persist(); A.newBest = true; } else A.newBest = false;
        break;
      }
    }
  }
  function draw() {
    const t = A.t;
    // road: dusk purple with scrolling lane marks and palm silhouettes at the sides
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a0f4a'); gr.addColorStop(1, '#5a1a6a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const scroll = (A.mode === 'play' ? A.t * A.speed : t * 40) % 24;
    g.fillStyle = '#ff2bd1'; g.fillRect(6, 0, 2, H); g.fillRect(W - 8, 0, 2, H);
    g.fillStyle = 'rgba(255,240,255,.35)'; for (let y = -24 + scroll; y < H; y += 24) { g.fillRect(W / 3, y, 2, 10); g.fillRect(2 * W / 3, y, 2, 10); }
    if (A.mode === 'attract') {
      g.fillStyle = '#ffe14a'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
      g.fillText('SKATE', W / 2, 46 + Math.sin(t * 3) * 2); g.fillStyle = '#18f0ff'; g.fillText('SURGE', W / 2, 70 + Math.sin(t * 3 + 1) * 2);
      g.font = 'bold 9px monospace'; g.fillStyle = '#fff';
      g.fillText('HIGH SCORES', W / 2, 98);
      const rows = [...BOARD, ['YOU', best()]].sort((a, b) => b[1] - a[1]).slice(0, 5);
      rows.forEach(([nm, sc], i) => { g.fillStyle = nm === 'YOU' ? '#8dff5a' : '#ffd6f5'; g.fillText(`${i + 1}. ${nm}  ${String(sc).padStart(5, '0')}`, W / 2, 114 + i * 13); });
      if (Math.floor(t * 2) % 2) { g.fillStyle = '#ffe14a'; g.fillText('INSERT TOKEN', W / 2, 192); }
      return;
    }
    // stars, obstacles, the skater
    for (const s of A.items) { g.fillStyle = '#ffe14a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * 0.628 - 1.57 + t * 3, q = k % 2 ? 2.5 : 6; g.lineTo(s.x + Math.cos(a) * q, s.y + Math.sin(a) * q); } g.fill(); }
    for (const o of A.obs) {
      if (o.kind === 'cone') { g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(o.x, o.y - 7); g.lineTo(o.x + 6, o.y + 5); g.lineTo(o.x - 6, o.y + 5); g.fill(); g.fillStyle = '#fff'; g.fillRect(o.x - 3, o.y, 6, 2); }
      else if (o.kind === 'puddle') { g.fillStyle = '#18f0ffaa'; g.beginPath(); g.ellipse(o.x, o.y, o.w / 2, 5, 0, 0, 6.28); g.fill(); }
      else { g.fillStyle = o.c; g.fillRect(o.x - o.w / 2, o.y - 11, o.w, 22); g.fillStyle = '#22203a'; g.fillRect(o.x - o.w / 2 + 3, o.y - 5, o.w - 6, 7); g.fillStyle = '#ffe14a'; g.fillRect(o.x - o.w / 2 + 2, o.y + 9, 4, 2); g.fillRect(o.x + o.w / 2 - 6, o.y + 9, 4, 2); }
    }
    const py = H - 26, bob = A.mode === 'play' ? Math.sin(A.t * 14) * 1 : 0;
    g.fillStyle = '#27e8ff'; g.fillRect(A.x - 4, py - 12 + bob, 8, 9); g.fillStyle = '#f1c9a5'; g.fillRect(A.x - 3, py - 18 + bob, 6, 6);
    g.fillStyle = '#ff2bd1'; g.fillRect(A.x - 4, py - 3, 3, 6); g.fillRect(A.x + 1, py - 3, 3, 6); g.fillStyle = '#ffe14a'; g.fillRect(A.x - 5, py + 3, 4, 2); g.fillRect(A.x + 1, py + 3, 4, 2);
    if (A.flash > 0) { g.fillStyle = `rgba(255,255,255,${A.flash})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = '#fff'; g.font = 'bold 9px monospace'; g.textAlign = 'left'; g.fillText(`SCORE ${String(Math.floor(A.score)).padStart(5, '0')}`, 4, 10);
    g.textAlign = 'right'; g.fillText(`HI ${String(Math.max(best(), Math.floor(A.score))).padStart(5, '0')}`, W - 4, 10);
    if (A.mode === 'over') {
      g.fillStyle = 'rgba(20,6,40,.78)'; g.fillRect(10, 60, W - 20, 80);
      g.textAlign = 'center'; g.fillStyle = '#ff4fa3'; g.font = 'bold 16px monospace'; g.fillText('WIPEOUT!', W / 2, 82);
      g.font = 'bold 9px monospace'; g.fillStyle = '#fff'; g.fillText(`SCORE ${stats.lastScore}`, W / 2, 100);
      g.fillStyle = A.newBest ? '#8dff5a' : '#ffd6f5'; g.fillText(A.newBest ? 'NEW HIGH SCORE!' : `BEST ${best()}`, W / 2, 114);
      g.fillStyle = '#ffe14a'; g.fillText('AGAIN: $1', W / 2, 130);
    }
  }
  let screenTex = null, screenT = 0;
  function blit() {
    if (vctx && !box.hidden) { vctx.imageSmoothingEnabled = false; vctx.drawImage(cv, 0, 0, view.width, view.height); }
    if (screenTex) screenTex.needsUpdate = true;
  }
  function openArcade() {
    if (!start()) { hud.toast('OUT OF TOKENS', 'ONE GO IS $1'); return; }
    game.busy = 'arcade'; game.act.reset(); box.hidden = false; arcFoot(); audio.blip(true);
  }
  function closeArcade() { if (A.mode === 'play') { A.mode = 'over'; stats.lastScore = Math.floor(A.score); if (stats.lastScore > best()) { save.arcade = stats.lastScore; game.persist(); } } A.mode = 'attract'; box.hidden = true; game.busy = null; }
  const arcFoot = () => { foot.textContent = game.input.touchMode ? '◀ ▶ steer · PLAY again · QUIT' : '← → / A D steer · Enter play again · Esc quit'; };

  // ---- the Blue Pelican's now-playing card ------------------------------------------------------------
  const np = $('nowplay'), music = game.music;
  let npT = 0;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function nowPlaying(hold = 8) {
    if (!np || !music) return;
    const t = music.current(), S = music.state;
    if (t) {
      np.innerHTML = `<b>♪ NOW PLAYING</b><i>${esc(t.title)}</i><span>${esc(t.artist || 'Unknown artist')}</span><small>${esc(t.licence)}${t.genre ? ' · ' + esc(t.genre) : ''}</small>`;
      np.classList.remove('synth');
    } else {
      np.innerHTML = `<b>♪ HOUSE SYNTH</b><i>The band is on a break</i><small>${esc(S.note || 'Loading the record crate…')}</small>`;
      np.classList.add('synth');
    }
    np.hidden = false; npT = hold;
  }
  if (music) music.onChange = () => { if (game.inside && game.inside.key === 'lounge') nowPlaying(); };

  // ---- the API -------------------------------------------------------------------------------------
  const api = {
    stats, arcade: A, canvas: cv, salon,
    get vest() { return !!save.vest; },
    menu: (kind) => MENUS[kind] || null,
    closeMenu: () => game.places.closeShop(),
    // the arcade cabinet's screen in the room shows the same canvas
    screen(tex) { screenTex = tex; },
    entered(p) {
      sitSeen = null; if (p.key === 'arcade') { A.mode = 'attract'; }
      if (p.key === 'lounge' && music) music.load().then(() => { if (game.inside === p) nowPlaying(9); });
    },
    nowPlaying,
    get cardShown() { return !!np && !np.hidden; },
    // E at a use spot: true when handled here
    // the Galleria's escalator: up from the atrium to Velvet Rope Couture, or back down (a short ride, X skips)
    escalator(up = true) {
      const from = game.inside, cut = game.cut, places = game.places;
      if (!from) return false;
      const r0 = from.room, O = { x: r0.ox, z: r0.oz }, OYc = player.pos.y;
      stats.escalator = (stats.escalator || 0) + 1;
      const done = () => { if (up) places.enterRoom('boutique', 0, 2.6); else places.enterRoom('mall', 7.8, 4.4); player.yaw = up ? PI : 0; hud.toast(up ? 'VELVET ROPE COUTURE' : 'SEAFOAM GALLERIA', up ? 'UPPER LEVEL · STEP ONTO THE PODIUM TO TRY THINGS ON' : 'BACK DOWN IN THE ATRIUM'); };
      if (!up) { cut.fade(true); game.busy = 'door'; setTimeout(() => { done(); game.busy = null; setTimeout(() => cut.fade(false), 60); }, 340); return true; }
      game.act.reset();
      cut.run([
        { dur: 2.6, start() { cut.setFov(50); },
          tick(k, dt) {
            const e = k * k * (3 - 2 * k), lz = 2.6 - e * 6.2, ly = Math.max(0, Math.min(3.2, (2.0 - lz) / 6.1 * 3.1));
            player.pos.set(O.x + 7.8, OYc + ly, O.z + lz); player.yaw = PI; player.speed = 0; player.animate(dt, 0, null);
            camera.position.set(O.x + 4.2, OYc + 2.6 + ly * 0.6, O.z + lz + 4.0); camera.lookAt(O.x + 7.8, OYc + ly + 1.2, O.z + lz);
            if (r0.idle) r0.idle(game.dt ? performance.now() / 1000 : 0, dt, false);
            if (k > 0.85) cut.fade(true);
          } },
      ], done, true);
      return true;
    },
    use(p, u) {
      const k = u.kind || p.key;
      if (k === 'escalator') return api.escalator(true);
      if (k === 'fitting') { game.places.openShop('boutique'); return true; }
      if (k === 'jukebox') {
        jukeI++; stats.songs++; audio.blip(true);
        if (p.room.setJuke) p.room.setJuke(jukeI);
        hud.toast('♪ NOW PLAYING', pickOf(JUKEBOX, jukeI)); return true;
      }
      if (k === 'fountain') {
        if (game.money < 1) { hud.toast('NO COINS', 'THE FOUNTAIN LOOKS DISAPPOINTED'); audio.blip(false); return true; }
        game.money -= 1; wishN++; stats.wishes++; audio.cash();
        if (p.room.splash) p.room.splash();
        if (wishN % 5 === 0) { game.health = Math.min(100, game.health + 25); hud.toast('WISH GRANTED: A FREE PRETZEL', 'KIKI TOSSES YOU A WARM KNOT. +25 HEALTH'); }
        else hud.toast('PLINK!', pickOf(WISHES, wishN));
        return true;
      }
      if (k === 'arcade') { openArcade(); return true; }
      if ((k === 'lift' || k === 'concierge') && game.spire) return game.spire.lobbyUse(k);
      if (k === 'records') {
        stats.songs++;
        if (music && music.skip()) { audio.blip(true); nowPlaying(); }
        else { audio.blip(false); hud.toast('NO RECORDS IN THE CRATE', 'THE HOUSE SYNTH KEEPS PLAYING'); nowPlaying(); }
        return true;
      }
      if (MENUS[k]) { game.places.openShop(k); return true; }
      return false;
    },
    // keys while the arcade is open
    key(e) {
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyQ') { closeArcade(); return; }
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyE') && A.mode !== 'play') { if (start()) arcFoot(); }
    },
    get arcadeOn() { return game.busy === 'arcade'; },
    touchButtons() { return A.mode === 'play' ? [['ArrowLeft', '◀'], ['ArrowRight', '▶'], ['Escape', 'QUIT']] : [['Enter', 'PLAY $1'], ['Escape', 'QUIT']]; },
    hint() { return A.mode === 'play' ? [['← →', 'steer'], ['Esc', 'quit']] : [['Enter', 'play again ($1)'], ['Esc', 'quit']]; },
    // the arcade owns the camera: over the shoulder at the cabinet
    arcadeUpdate(dt) {
      const r = game.inside.room, u = r.uses.find((q) => q.kind === 'arcade');
      step(dt, game.input); draw(); blit();
      player.pos.set(r.ox + u.x, OY, r.oz + u.z); player.yaw += angleDelta(player.yaw, PI) * (1 - Math.exp(-8 * dt)); player.speed = 0; player.animate(dt, 0, null);
      const s = r.screenAt;
      camera.position.set(r.ox + s[0] + 1.55, OY + 1.95, r.oz + s[2] + 1.5); camera.lookAt(r.ox + s[0] - 0.15, OY + s[1] - 0.1, r.oz + s[2]);   // beside Skye, not behind her head
      game.cut.setFov(44);
    },
    // every frame while inside a venue (idle animation of the attract screen, diner counter flavour)
    tick(dt) {
      const p = game.inside;
      if (np && !np.hidden) { npT -= dt; if (npT <= 0 || !p || p.key !== 'lounge') np.hidden = true; }
      if (!p || !p.venue) return;
      if (p.key === 'arcade' && game.busy !== 'arcade') { A.t += dt; screenT -= dt; if (screenT <= 0) { screenT = 0.12; draw(); blit(); } }
      if (p.key === 'diner' && game.act.mode === 'sit' && game.act.seat && sitSeen !== game.act.seat.ref) { sitSeen = game.act.seat.ref; hud.toast(game.act.seat.kind === 'stool' ? 'AT THE COUNTER' : 'IN A BOOTH', pickOf(DINER_SIT, stats.meals + (game.act.seat.kind === 'stool' ? 0 : 1)) + (game.input.touchMode ? '' : ' · E AT THE COUNTER TO ORDER')); }
      if (game.act.mode !== 'sit') sitSeen = null;
    },
    sleep,
  };
  return api;
}
