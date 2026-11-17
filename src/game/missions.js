// The story engine: plays the missions in story.js. One job at a time, made of steps with a
// clear objective each, checkpoints, a timer only on the legs that need one, a pass card with
// the reward and a fail card with retry.
import { MISSIONS, ODD_JOB } from './story.js';
import { makeMarker } from './cutscene.js';
import { FLOOR } from './interiors.js';

const $ = (id) => document.getElementById(id);

export function createStory(game, scene) {
  const { L, player, hud, audio, env, vehicles, save } = game;
  const mark = makeMarker(scene, '#ffd166');
  const card = $('card');
  let A = null, jobWait = 0, cardT = 0, pendingFail = null, lastDrop = null;

  const next = () => (save.story < MISSIONS.length ? MISSIONS[save.story] : null);
  const step = () => A && A.m.steps[A.si];
  const onFloor = (t) => t === 'tiles' || t === 'dance';
  const leaveAfter = (m, i) => { const s = m.steps[i], nx = m.steps[i + 1]; return s && s.stay !== undefined ? !s.stay : !(nx && onFloor(nx.type)); };
  const hot = (i, j) => { const r = L.places.club.room; if (r) r.floorU.uHot.value.set(i, j); };

  function show(cls, title, text, hold) {
    $('cardt').textContent = title; $('cards').textContent = text; card.className = 'on ' + cls;
    clearTimeout(cardT);
    if (hold) cardT = setTimeout(() => { card.className = ''; }, hold);
  }
  function start(m, odd = false) {
    A = { m, odd, si: 0, cp: 0, t: null, ri: 0, hits: 0, tile: null, bike: null };
    if (m.night && !env.isNight()) env.jump('night');
    hud.toast(m.title, m.blurb || '');
    begin();
  }
  function newTile() {
    const r = game.inside.room, at = r.tileAt(player.pos.x - r.ox, player.pos.z - r.oz);
    let i, j;
    do { i = Math.floor(Math.random() * FLOOR.nx); j = Math.floor(Math.random() * FLOOR.nz); }
    while ((A.tile && Math.abs(i - A.tile[0]) + Math.abs(j - A.tile[1]) < 2) || (at && at[0] === i && at[1] === j));
    A.tile = [i, j]; hot(i, j);
  }
  function begin() {
    const s = step();
    Object.assign(A, { t: s.time || null, ri: 0, hits: 0, tile: null, bike: null });
    mark.visible = false;
    if (s.type === 'drop') mark.position.set(s.at[0], 0, s.at[1]);
    else if (s.type === 'route') mark.position.set(s.points[0][0], 0, s.points[0][1]);
    else if (s.type === 'mount') {
      const b = A.bike = vehicles.cars.find((c) => c.kind === 'bike' && c.home === A.m.giver);
      if (b && !b.driven) Object.assign(b, { x: b.hx, z: b.hz, yaw: b.hyaw, y: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
    } else if (s.type === 'tiles') newTile();
    else if (s.type === 'dance') {
      // the dance-off: you dance on the beat to fill the vibe meter before the rival fills his
      const r = game.inside && game.inside.room;
      if (r) { player.pos.set(r.ox + 0.6, player.floor, r.oz - 1.5); game.act.startDance(true); }
      A.rivalV = 0; game.act.rival = 0; game.act.vibe = 0;
      hud.toast('DANCE-OFF!', 'HIT 1-8 ON THE BEAT · MIX YOUR MOVES');
    }
    objective();
    if (s.type === 'visit' && game.inside && game.inside.key === s.place) game.places.talk({ lines: s.talk, leave: leaveAfter(A.m, A.si), done: advance });
  }
  function objective() {
    const s = step();
    let text = s.text;
    if (s.type === 'route') text += ` (${A.ri}/${s.points.length})`;
    if (s.type === 'tiles') text += ` (${A.hits}/${s.count})`;
    if (s.type === 'dance') text += ` · VIBE ${Math.floor(game.act.vibe)}% · ${s.rivalName} ${Math.floor(A.rivalV || 0)}%`;
    const ms = game.mission || (game.mission = {});
    ms.title = A.m.title; ms.text = text; ms.time = A.t;
  }
  function advance() {
    if (!A) return;
    if (step().type === 'dance') { game.act.stopDance(); game.act.contest = false; game.act.rival = null; }
    A.si++;
    if (A.si >= A.m.steps.length) return pass();
    if (step().checkpoint) A.cp = A.si;
    audio.blip(true);
    begin();
  }
  function clear() { A = null; game.mission = null; mark.visible = false; hot(-1, -1); if (game.act) { game.act.contest = false; game.act.rival = null; } }
  function pass() {
    const m = A.m;
    let extra = '';
    game.money += m.reward; audio.win();
    if (A.odd) game.stats.jobs++;
    else {
      save.story++;
      if (m.unlock) { save.gift[m.unlock] = true; extra += ' · FLAMINGO ROYALE JACKET WAITING AT ZIGZAG THREADS'; }
      if (!next()) extra += ' · THE END (DEE STILL HAS DELIVERIES)';
      game.persist();
    }
    show('pass', m.passed, `${m.title} · +$${m.reward.toLocaleString('en-US')}${extra}`, 5200);
    clear(); jobWait = 3;
  }
  function fail(why) {
    if (!A) return;
    game.busy = 'fail'; mark.visible = false; hot(-1, -1);
    if (step() && step().type === 'dance') { game.act.stopDance(); game.act.rival = null; }
    audio.lose();
    show('fail', 'JOB BLOWN', `${why} · ENTER: RETRY FROM THE LAST CHECKPOINT · ESC: WALK AWAY`);
  }
  function retry() {
    card.className = ''; game.busy = null;
    A.si = A.cp;
    game.rules.leaveVehicle(); game.wanted = 0; game.health = Math.max(game.health, 60);
    const s = step(), prev = A.m.steps[A.si - 1];
    if (onFloor(s.type)) game.places.warpInside('club');
    else {
      const door = (key) => [L.places[key].x, L.places[key].z + 3.4];
      const at = !prev || prev.type === 'mount' ? door(A.m.giver) : prev.type === 'visit' ? door(prev.place) : prev.type === 'drop' ? prev.at : prev.points[prev.points.length - 1];
      game.places.putOutside(at[0], at[1]);
    }
    begin();
    hud.toast('TAKE TWO', A.m.title);
  }

  const api = {
    get active() { return A; },
    next, start, fail, advance,
    lockInside: () => !!A && onFloor(step().type) && game.busy !== 'fail',
    // walking into a place: is there a scene to play?
    onEnter(key) {
      if (!A) {
        const m = next();
        return m && m.giver === key ? { lines: m.intro, leave: !onFloor(m.steps[0].type), done: () => start(m) } : null;
      }
      const s = step();
      return s.type === 'visit' && s.place === key ? { lines: s.talk, leave: leaveAfter(A.m, A.si), done: advance } : null;
    },
    // E at Dee's counter: the next story job if it starts here, otherwise a timed odd job
    askDee() {
      if (A) { hud.toast('ONE JOB AT A TIME', game.places.bark('bar')); return; }
      const m = next();
      if (m && m.giver === 'bar') { game.places.talk({ lines: m.intro, leave: true, done: () => start(m) }); return; }
      const far = ODD_JOB.drops.filter((d) => d !== lastDrop), t = lastDrop = far[Math.floor(Math.random() * far.length)];
      const dist = Math.hypot(t.x - L.bar.x, t.z - L.bar.z), secs = Math.round((dist / 6.2 + 14) / 5) * 5, pay = Math.round((220 + dist) * (next() ? 1 : 1.5) / 10) * 10;
      game.places.talk({
        lines: ODD_JOB.lines(t, secs, pay), leave: true,
        done: () => start({ title: ODD_JOB.title, blurb: t.tag, giver: 'bar', reward: pay, passed: 'DELIVERED', steps: [{ type: 'drop', at: [t.x, t.z], text: `Deliver the Flamingo Fizz to ${t.tag}`, time: secs, checkpoint: true }] }, true),
      });
    },
    // knocked out or caught mid-job: the fail card comes up once you are back on your feet
    onDown(why) { if (A) { pendingFail = why; mark.visible = false; } },
    key(e) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') retry();
      else if (e.code === 'Escape') { card.className = ''; game.busy = null; clear(); jobWait = 2; hud.toast('JOB DROPPED', 'IT WILL STILL BE THERE LATER'); }
    },
    update(dt) {
      jobWait -= dt;
      if (pendingFail && !game.busy) { const w = pendingFail; pendingFail = null; fail(w); return; }
      if (!A || game.busy) { if (game.busy) mark.visible = false; return; }
      const s = step(), f = game.focus(), near = (x, z, r) => Math.hypot(f.x - x, f.z - z) < r && Math.abs(f.y) < 3;
      if (A.t !== null) { A.t -= dt; if (A.t <= 0) { A.t = 0; objective(); fail(onFloor(s.type) ? 'THE SONG ENDED' : 'OUT OF TIME'); return; } }
      mark.visible = (s.type === 'drop' || s.type === 'route') && !game.inside;
      if (s.type === 'drop') { if (near(s.at[0], s.at[1], 2.8)) return advance(); }
      else if (s.type === 'route') {
        const p = s.points[A.ri];
        if (near(p[0], p[1], 3.4)) {
          A.ri++;
          if (A.ri >= s.points.length) return advance();
          A.t += s.bonus; mark.position.set(s.points[A.ri][0], 0, s.points[A.ri][1]);
          audio.pickup(); hud.toast(`CHECKPOINT ${A.ri}/${s.points.length}`, `+${s.bonus} SECONDS`);
        }
      } else if (s.type === 'mount') { if (game.vehicle && game.vehicle.kind === 'bike') return advance(); }
      else if (s.type === 'dance') {
        const p = game.inside;
        if (!p || p.key !== 'club') { fail('YOU LEFT THE FLOOR'); return; }
        A.rivalV += dt * s.rival; game.act.rival = A.rivalV;
        if (game.act.vibe >= s.target) return advance();
        if (A.rivalV >= 100) { A.rivalV = 100; objective(); fail(s.lose); return; }
      }
      else if (s.type === 'tiles') {
        const p = game.inside, r = p && p.room;
        if (!r || p.key !== 'club') { fail('YOU LEFT THE FLOOR'); return; }
        const at = r.tileAt(player.pos.x - r.ox, player.pos.z - r.oz);
        if (at && at[0] === A.tile[0] && at[1] === A.tile[1]) {
          A.hits++; audio.pickup();
          if (A.hits >= s.count) { hot(-1, -1); return advance(); }
          newTile();
        }
      }
      objective();
    },
    blips(out) {
      if (!A) {
        const m = next();
        if (m && !game.inside) { const p = L.places[m.giver]; out.push({ x: p.x, z: p.z, color: p.color, big: true, star: true }); }
        return;
      }
      const s = step();
      if (s.type === 'visit') { const p = L.places[s.place]; out.push({ x: p.x, z: p.z, color: '#ffd166', big: true, diamond: true }); }
      else if (s.type === 'drop' || s.type === 'route') out.push({ x: mark.position.x, z: mark.position.z, color: '#ffd166', big: true, diamond: true });
      else if (s.type === 'mount' && A.bike) out.push({ x: A.bike.x, z: A.bike.z, color: '#ffd166', big: true, diamond: true });
    },
  };
  return api;
}
