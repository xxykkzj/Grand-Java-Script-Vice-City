// Saving and resuming: one autosave slot in localStorage (SAVE_KEY), versioned.
//   profile  the outfit worn and owned, the story chapter, gifts, hair and cap, blasters and ammo, the snorkel
//            vest, the arcade best, stunts found, odd jobs done (kept on every write)
//   world    cash, health, where you are (on foot, in a car / bike / helicopter of the same type and colour, or at
//            a venue's street door), the clock and the weather. Only taken in a clean moment: never with heat on
//            you, during a scene, while down or totalled, in the air or in the water. Otherwise the last clean
//            one stays, so a reload can't shake the Coast Patrol or wake you up somewhere broken.
// A story job in progress isn't kept: CONTINUE puts you back before it started (its giver has it again).
// Autosaves: every AUTOSAVE_S of play, soon after you go in or out of a place, a job step, a respawn, getting
// in or out of a vehicle, on every purchase / haircut (game.persist), when the tab is hidden and on pagehide.
// The motel bed is the manual save. Settings has Export / Import (a code with a checksum, or a .json file).
import { onLand, onRoad, zoneName } from '../world/layout.js';
import { WEATHER } from '../world/environment.js';
import { MISSIONS, OUTFITS } from './story.js';
import { DEFAULT_HAIR, fixHair } from './salon.js';
import { HOMES, HOME_IDS } from './homes.js';

export const SAVE_KEY = 'neon-coast-save-2';
const OLD_KEY = 'neon-coast-save-1';
// schema 3 adds the homes (owned, the car in each parking bay, the last one slept in); a schema-2 slot or code
// still loads (the new fields just start empty)
const VERSION = 3, CODE_TAG = 'NEONCOAST2', OK_V = (v) => v === 2 || v === 3;
const AUTOSAVE_S = 50, MIN_GAP = 3000;
export const START = { x: -10, z: 67, yaw: Math.PI / 2 };
const $ = (id) => document.getElementById(id);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const profileDefaults = () => ({ outfit: 'classic', owned: [], story: 0, gift: {}, arms: {}, armsIntro: 0, vest: 0, motel: null, arcade: 0, hair: { ...DEFAULT_HAIR }, cap: 1, stunts: [], homes: [], garage: {}, lastHome: null });
const PROFILE_KEYS = Object.keys(profileDefaults());

// FNV-1a over the JSON text: catches a code that got cut short or edited
export function checksum(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const toB64 = (s) => btoa(unescape(encodeURIComponent(s)));
const fromB64 = (s) => decodeURIComponent(escape(atob(s)));

// ---- validation: anything odd falls back to the default for that field; not an object at all -> null
function cleanWorld(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const o = {
    cash: fin(w.cash) ? clamp(Math.floor(w.cash), 0, 1e9) : 250,
    health: fin(w.health) ? clamp(Math.round(w.health), 1, 100) : 100,
    tod: fin(w.tod) ? ((w.tod % 24) + 24) % 24 : 19,
    weather: typeof w.weather === 'string' && WEATHER[w.weather] ? w.weather : 'clear',
    zone: typeof w.zone === 'string' ? w.zone.slice(0, 40) : '',
    venue: typeof w.venue === 'string' && /^[a-z]{2,16}$/.test(w.venue) ? w.venue : null,
    pos: null, vehicle: null,
  };
  const p = w.pos;
  if (p && fin(p.x) && fin(p.z) && Math.abs(p.x) < 4000 && Math.abs(p.z) < 4000) o.pos = { x: p.x, y: fin(p.y) ? clamp(p.y, 0, 400) : 0, z: p.z, yaw: fin(p.yaw) ? p.yaw : 0 };
  const v = w.vehicle;
  if (v && ['car', 'bike', 'heli'].includes(v.kind) && fin(v.x) && fin(v.z) && Math.abs(v.x) < 4000 && Math.abs(v.z) < 4000) {
    o.vehicle = { kind: v.kind, type: typeof v.type === 'string' ? v.type.slice(0, 24) : null, color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : null,
      x: v.x, z: v.z, yaw: fin(v.yaw) ? v.yaw : 0, y: fin(v.y) ? clamp(v.y, 0, 400) : 0, hi: v.hi === 1 ? 1 : 0 };
  }
  return o;
}
export function cleanSlot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = profileDefaults();
  if (typeof raw.outfit === 'string' && OUTFITS.some((o) => o.id === raw.outfit)) s.outfit = raw.outfit;
  if (Array.isArray(raw.owned)) s.owned = [...new Set(raw.owned.filter((id) => typeof id === 'string' && OUTFITS.some((o) => o.id === id)))];
  s.story = clamp(Math.floor(+raw.story || 0), 0, MISSIONS.length);
  if (raw.gift && typeof raw.gift === 'object') for (const k in raw.gift) if (raw.gift[k] === true && /^[a-z0-9_-]{1,24}$/i.test(k)) s.gift[k] = true;
  if (raw.arms && typeof raw.arms === 'object' && !Array.isArray(raw.arms)) {
    const a = raw.arms, o = {}, m = {};
    if (a.owned && typeof a.owned === 'object') for (const k in a.owned) o[k] = !!a.owned[k];
    if (a.ammo && typeof a.ammo === 'object') for (const k in a.ammo) if (fin(a.ammo[k])) m[k] = Math.max(0, Math.floor(a.ammo[k]));
    s.arms = { owned: o, ammo: m, cur: typeof a.cur === 'string' ? a.cur : null };
  }
  s.armsIntro = raw.armsIntro ? 1 : 0;
  s.vest = raw.vest ? 1 : 0;
  s.arcade = fin(raw.arcade) ? clamp(Math.floor(raw.arcade), 0, 1e7) : 0;
  s.hair = fixHair(raw.hair);
  s.cap = raw.cap === 0 ? 0 : 1;
  if (Array.isArray(raw.stunts)) s.stunts = [...new Set(raw.stunts.filter((k) => typeof k === 'string').map((k) => k.slice(0, 32)))];
  if (Array.isArray(raw.homes)) s.homes = [...new Set(raw.homes.filter((k) => HOME_IDS.includes(k)))];
  if (raw.garage && typeof raw.garage === 'object' && !Array.isArray(raw.garage)) for (const h of HOMES) {
    const g = raw.garage[h.id];
    if (h.bay && g && typeof g.type === 'string' && /^[a-z]{2,16}$/.test(g.type) && typeof g.color === 'string' && /^#[0-9a-f]{6}$/i.test(g.color)) s.garage[h.id] = { type: g.type, color: g.color };
  }
  s.lastHome = HOME_IDS.includes(raw.lastHome) && s.homes.includes(raw.lastHome) ? raw.lastHome : null;
  if (raw.motel && fin(raw.motel.cash) && fin(raw.motel.tod)) s.motel = { cash: raw.motel.cash, tod: raw.motel.tod, at: fin(raw.motel.at) ? raw.motel.at : 0 };
  return {
    profile: s,
    jobs: fin(raw.jobs) ? clamp(Math.floor(raw.jobs), 0, 1e6) : 0,
    at: fin(raw.at) ? raw.at : 0,
    world: cleanWorld(raw.world),
  };
}

// read the slot, or migrate the old one (and its motel cash and clock) into it
function load(storage) {
  let raw = null, from = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (raw) from = 'v2'; } catch (e) { raw = null; }
  if (!raw || !OK_V(raw.v)) {
    raw = null;
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (old && typeof old === 'object') {
        raw = { ...old };
        if (old.motel && fin(old.motel.cash)) raw.world = { cash: old.motel.cash, tod: old.motel.tod, health: 100 };
        from = 'v1';
      }
    } catch (e) { raw = null; }
  }
  const slot = raw ? cleanSlot(raw) : null;
  return { slot, from: slot ? from : null, storage };
}

export function createSaves(game) {
  let storage = true;
  try { const k = 'neon-coast-probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { storage = false; }
  const loaded = load(storage);
  const save = profileDefaults();
  let slot = loaded.slot;
  if (slot) Object.assign(save, slot.profile);
  let world = slot ? slot.world : null, jobs0 = slot ? slot.jobs : 0, savedAt = slot ? slot.at : 0;
  const stats = { writes: 0, autos: 0, skipped: 0, lastWhy: null, failed: 0, migrated: loaded.from === 'v1', restored: false };
  let has = !!slot, warned = false, lastWrite = 0, autoT = AUTOSAVE_S, soon = 1e9, lastKey = '';

  function payload() {
    const o = { v: VERSION, at: savedAt || Date.now() };
    for (const k of PROFILE_KEYS) o[k] = save[k];
    o.jobs = game.stats ? game.stats.jobs : jobs0;
    o.world = world;
    return o;
  }
  function write() {
    if (!storage || game.importing) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload()));
      stats.writes++; has = true;
      return true;
    } catch (e) {
      stats.failed++;
      if (!warned && game.started) { warned = true; game.hud.toast('SAVING UNAVAILABLE IN THIS BROWSER', 'THE GAME STILL PLAYS · PROGRESS WON\'T SURVIVE A RELOAD'); }
      return false;
    }
  }
  // a migrated save: write it in the new slot and retire the old key (only once the new one is safely written)
  if (loaded.from === 'v1' && storage && write()) { try { localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ } }

  // ---- is now a clean moment to take the world snapshot? null when it is, else why not
  function unsafe() {
    const g = game;
    if (!g.started) return 'not started';
    if (g.wanted > 0) return 'heat';
    if (g.deathCam || g.health <= 0 || g.busy === 'down' || document.body.classList.contains('dead')) return 'down';
    if (g.busy && !((g.busy === 'shop' || g.busy === 'arcade') && g.inside)) return 'busy ' + g.busy;
    if (g.cut && g.cut.active) return 'scene';
    if (g.stunts && g.stunts.cam) return 'stunt';
    const v = g.vehicle;
    if (v) {
      if (v.wreck || v.burn > 0 || v.sink || v.jacking) return 'vehicle';
      if (v.kind === 'heli' ? v.y - (v.floor || 0) > 0.6 : v.air) return 'airborne';
      if (v.kind !== 'heli' && !onLand(v.x, v.z)) return 'water';
    } else if (!g.inside && !(g.spire && g.spire.on)) {
      if (g.swim && g.swim.wet) return 'water';
      if (!g.player.onGround) return 'airborne';
      if (!onLand(g.player.pos.x, g.player.pos.z)) return 'water';
    }
    return null;
  }
  function snapshot() {
    const g = game, { player, env } = g;
    const w = { cash: Math.floor(g.money), health: Math.round(g.health), tod: +env.tod.toFixed(3), weather: env.weather, zone: '', venue: null, pos: null, vehicle: null };
    const p = g.inside;
    if (p) { const k = p.up || p.key, q = g.places.byKey(k) || p; w.venue = k; w.zone = String(q.name || '').toUpperCase(); }
    else if (g.spire && g.spire.on) { w.venue = 'spire'; w.zone = 'THE SOLSTICE SPIRE'; }
    else {
      const v = g.vehicle;
      if (v && (v.kind === 'car' || v.kind === 'bike' || v.kind === 'heli') && !v.police) {
        w.vehicle = { kind: v.kind, type: v.type || null, color: typeof v.color === 'string' ? v.color : null, x: +v.x.toFixed(2), z: +v.z.toFixed(2), yaw: +v.yaw.toFixed(3), y: +(v.kind === 'heli' ? v.floor || 0 : v.y || 0).toFixed(2), hi: v.hi === 1 ? 1 : 0 };
      }
      const f = g.focus();
      w.pos = { x: +f.x.toFixed(2), y: +(v ? 0 : player.pos.y).toFixed(2), z: +f.z.toFixed(2), yaw: +g.heading().toFixed(3) };
      w.zone = zoneName(f.x, f.z);
    }
    return w;
  }
  const ic = () => $('saveic');
  function blink() {
    const el = ic(); if (!el) return;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(blink.t); blink.t = setTimeout(() => el.classList.remove('on'), 1600);
  }
  // take the snapshot (if clean) and write; force skips the throttle
  function attempt(reason, force = false) {
    const why = unsafe();
    if (why) { stats.skipped++; stats.lastWhy = why; return false; }
    if (!force && Date.now() - lastWrite < MIN_GAP) return false;
    world = snapshot(); savedAt = Date.now(); lastWrite = savedAt; stats.lastWhy = null;
    const ok = write();
    if (ok && reason !== 'hidden' && reason !== 'manual') blink();
    if (ok && reason === 'auto') stats.autos++;
    return ok;
  }

  // ---- resume -------------------------------------------------------------------------------------
  const inSolid = (x, z, r) => game.L.solids.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  const footOK = (x, z) => onLand(x, z) && !inSolid(x, z, 0.8) && !onRoad(x, z, 0.4);
  // a spot to stand: the saved one if it is on a roof / deck or on dry land off the carriageways, else the nearest
  // such spot within 90 m, else the start
  function safeFoot(p) {
    const L = game.L;
    if (p.y > 0.3) { const g = L.surf.at(p.x, p.z, p.y + 0.6); if (g > 0.3 && Math.abs(g - p.y) < 0.5) return { x: p.x, y: g, z: p.z, snapped: false }; }
    if (footOK(p.x, p.z)) return { x: p.x, y: 0, z: p.z, snapped: false };
    for (let r = 1.5; r <= 90; r += 1.5) {
      const n = Math.max(8, Math.round(r * 2));
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (footOK(x, z)) return { x, y: 0, z, snapped: true }; }
    }
    return { x: START.x, y: 0, z: START.z, snapped: true };
  }
  function restoreVehicle(sv) {
    const { vehicles, player, cam } = game;
    if (sv.kind !== 'heli' && (!onLand(sv.x, sv.z) || inSolid(sv.x, sv.z, 0.6))) return false;
    let c = null;
    if (sv.kind === 'heli') {
      if (!onLand(sv.x, sv.z) && sv.y < 0.3) return false;
      c = vehicles.spawnHeli(sv.x, sv.z, sv.yaw, sv.hi, sv.y);
    } else {
      const T = vehicles.VTYPES[sv.type], type = T && T.kind === sv.kind ? sv.type : (sv.kind === 'bike' ? 'comet' : 'sedan');
      c = vehicles.cars.find((k) => k.spare && k.kind === sv.kind && k.off && !k.driven) || vehicles.cars.find((k) => k.spare && k.kind === sv.kind && !k.driven);
      if (!c) return false;
      vehicles.setType(c, type, sv.color);
      let y = 0;
      if (sv.y > 0.3) { const g = game.L.surf.at(sv.x, sv.z, sv.y + 0.6); if (Math.abs(g - sv.y) < 0.5) y = g; }
      Object.assign(c, { off: false, x: sv.x, z: sv.z, y, yaw: sv.yaw, vx: 0, vy: 0, vz: 0, spin: 0, tvx: 0, tvz: 0, air: false, park: { x: sv.x, z: sv.z, yaw: sv.yaw }, wreck: false, burn: 0 });
      vehicles.retint(c);
    }
    c.driven = true; game.vehicle = c; game.mode = c.kind;
    player.pos.set(c.x, c.y || 0, c.z); player.vel.set(0, 0, 0); player.vy = 0;
    player.setHidden(c.kind !== 'bike');
    cam.yaw = c.yaw; cam.pitch = 0.2; cam.snap(c);
    return true;
  }
  function resume() {
    const w = world, g = game;
    if (!w) return { where: 'start' };
    const { env, places, player } = g;
    g.money = w.cash; g.health = w.health; g.wanted = 0;
    if (g.stats) g.stats.jobs = jobs0;
    env.tod = w.tod; env.target = null;
    env.setWeather(w.weather, 3);
    const W = WEATHER[w.weather]; for (const k in env.w) if (k in W) env.w[k] = W[k];
    env.wet = W.rain > 0 ? 0.7 : 0;
    let where = 'start';
    const p = w.venue && places.byKey(w.venue);
    if (p && !p.hidden && p.home && save.homes.includes(p.key)) {
      // your own home: you wake up inside (by the bed if you slept there)
      const r = places.roomOf(p), sp = r.spawn || [0, r.hz - 2.6];
      places.enterRoom(p.key, sp[0], sp[1]); where = 'home:' + p.key;
    } else if (p && !p.hidden) {
      const [x, z] = places.outside(p); places.putOutside(x, z, places.faceYaw(p)); where = 'door:' + p.key;
    } else if (w.vehicle && restoreVehicle(w.vehicle)) where = 'vehicle';
    else if (w.pos) {
      const s = safeFoot(w.vehicle ? { x: w.vehicle.x + Math.cos(w.vehicle.yaw) * 3, y: 0, z: w.vehicle.z - Math.sin(w.vehicle.yaw) * 3 } : w.pos);
      places.putOutside(s.x, s.z, w.pos.yaw);
      if (s.y > 0.3) { player.pos.y = s.y; player.fallFrom = s.y; player.onGround = true; g.cam.snap(player.pos); }
      where = s.snapped ? 'snapped' : 'foot';
    }
    stats.restored = where;
    return { where };
  }

  // ---- the profile: REWIND and NEW GAME clear the same things
  function resetProfile() {
    Object.assign(save, profileDefaults());
    const g = game;
    if (g.combat) g.combat.reset();
    if (g.player) { g.player.model.setOutfit(OUTFITS.find((o) => o.id === 'classic') || OUTFITS[0]); g.player.model.setHair(save.hair, true); }
  }
  function newGame() {
    resetProfile();
    world = null; savedAt = 0; jobs0 = 0; has = false;
    if (game.stats) game.stats.jobs = 0;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ }
  }

  // ---- export / import
  function exportCode() {
    if (game.started) attempt('export', true);
    const json = JSON.stringify(payload());
    return `${CODE_TAG}.${toB64(json)}.${checksum(json)}`;
  }
  function exportFile() {
    const p = payload(), json = JSON.stringify(p);
    return JSON.stringify({ format: 'neon-coast-save', sum: checksum(json), save: p }, null, 1);
  }
  // text: a pasted code or a file's contents. Returns { slot } or { error }
  function parseImport(text) {
    const t = String(text || '').trim();
    let json = null, sum = null;
    const m = /^NEONCOAST2\.([A-Za-z0-9+/=\s]+)\.([0-9a-f]{8})$/.exec(t.replace(/\s+/g, ''));
    if (m) { try { json = fromB64(m[1]); } catch (e) { return { error: 'THAT CODE IS DAMAGED' }; } sum = m[2]; }
    else if (t[0] === '{') {
      let f; try { f = JSON.parse(t); } catch (e) { return { error: 'NOT A SAVE FILE' }; }
      if (!f || f.format !== 'neon-coast-save' || !f.save) return { error: 'NOT A NEON COAST SAVE' };
      json = JSON.stringify(f.save); sum = f.sum;
    } else return { error: 'NOT A NEON COAST SAVE CODE' };
    if (checksum(json) !== sum) return { error: 'CHECKSUM MISMATCH: THE CODE WAS CUT SHORT OR CHANGED' };
    let raw; try { raw = JSON.parse(json); } catch (e) { return { error: 'THAT CODE IS DAMAGED' }; }
    if (!raw || !OK_V(raw.v)) return { error: 'UNKNOWN SAVE VERSION' };
    const s = cleanSlot(raw);
    return s ? { slot: s, raw } : { error: 'THAT SAVE DOESN\'T LOOK RIGHT' };
  }
  function importText(text) {
    const r = parseImport(text);
    if (r.error) return r;
    if (!storage) return { error: 'SAVING UNAVAILABLE IN THIS BROWSER' };
    const o = { v: VERSION, at: r.slot.at || Date.now(), ...r.slot.profile, jobs: r.slot.jobs, world: r.slot.world };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); localStorage.removeItem(OLD_KEY); } catch (e) { return { error: 'SAVING UNAVAILABLE IN THIS BROWSER' }; }
    return { ok: true };
  }

  // ---- the title card's summary line
  function summary() {
    const w = world || {};
    const parts = [];
    parts.push('$' + (w.cash ?? 250).toLocaleString('en-US'));
    if (fin(w.tod)) { const h = Math.floor(w.tod), mm = Math.floor((w.tod - h) * 60); parts.push(String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0')); }
    if (w.zone) parts.push(w.zone);
    parts.push(save.story < MISSIONS.length ? `CHAPTER ${save.story + 1}: ${MISSIONS[save.story].title}` : 'STORY COMPLETE');
    return parts.join(' · ');
  }
  function ago() {
    if (!savedAt) return '';
    const s = Math.max(0, (Date.now() - savedAt) / 1000);
    return s < 90 ? 'SAVED JUST NOW' : s < 5400 ? `SAVED ${Math.round(s / 60)} MIN AGO` : s < 172800 ? `SAVED ${Math.round(s / 3600)} H AGO` : `SAVED ${Math.round(s / 86400)} DAYS AGO`;
  }

  // ---- when: page hidden / closed, a timer, and soon after the situation changes
  // (not while an import reloads the page: the imported slot is already written)
  const flush = () => { if (game.started && !game.importing) attempt('hidden', true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('pagehide', flush);
  addEventListener('beforeunload', flush);
  function tick(dt) {
    if (!game.started || game.paused) return;
    const A = game.story && game.story.active, v = game.vehicle;
    const key = (game.inside ? game.inside.key : '-') + '|' + (game.busy || '') + '|' + (A ? (A.m.id || A.m.title) + ':' + A.si : '') + '|' + save.story + '|' + (v ? v.kind + (v.idx ?? '') : '') + '|' + (game.spire && game.spire.on ? 1 : 0);
    if (key !== lastKey) { lastKey = key; soon = Math.min(soon, 1.2); }
    if (soon < 1e8 && (soon -= dt) <= 0) soon = attempt('event') ? 1e9 : 4;
    if ((autoT -= dt) <= 0) autoT = attempt('auto') ? AUTOSAVE_S : 5;
  }

  const api = {
    save, stats, attempt, write, unsafe, resume, resetProfile, newGame, summary, ago, tick,
    exportCode, exportFile, parseImport, importText, safeFoot,
    get has() { return has && !!(world || savedAt || slot); },
    get storage() { return storage; },
    get world() { return world; },
    // a profile change (a purchase, a haircut, a job done...): write it now, with a fresh snapshot if the moment is clean
    persist() { if (!attempt('profile', true)) write(); },
    // the motel bed: a deliberate save (the same slot)
    manual() {
      if (!storage) return { ok: false, why: 'SAVING UNAVAILABLE IN THIS BROWSER' };
      const why = unsafe();
      if (why && why !== 'busy door') return { ok: false, why: why === 'heat' ? 'NOT WITH HEAT ON YOU' : 'NOT RIGHT NOW' };
      // the bed's fade holds busy = 'door': take the snapshot as if it weren't there
      const b = game.busy; if (b === 'door') game.busy = null;
      const ok = attempt('manual', true);
      game.busy = b;
      return { ok, why: ok ? null : 'COULD NOT SAVE IN THIS BROWSER' };
    },
    warnOnce() { if (!storage && !warned) { warned = true; game.hud.toast('SAVING UNAVAILABLE IN THIS BROWSER', 'THE GAME STILL PLAYS · PROGRESS WON\'T SURVIVE A RELOAD'); } },
  };
  return api;
}

// ---- Settings: Export / Import (works with touch: plain buttons, a textarea, a file picker)
export function bindSaveUI(game, saves) {
  const box = $('savebox'), code = $('savecode'), msg = $('savemsg'), exp = $('sexpwrap'), imp = $('simpwrap'), file = $('sfilein');
  if (!box) return;
  const say = (t, bad = false) => { msg.textContent = t; msg.classList.toggle('bad', bad); };
  const show = (mode) => { box.hidden = false; exp.hidden = mode !== 'export'; imp.hidden = mode !== 'import'; };
  code.addEventListener('focus', () => { game.input.typing = true; });
  code.addEventListener('blur', () => { game.input.typing = !!(game.cheats && game.cheats.open); });
  $('sexport').addEventListener('click', () => {
    show('export'); code.readOnly = true; code.value = saves.exportCode();
    say(saves.storage ? 'COPY THIS CODE, OR DOWNLOAD IT AS A FILE. IMPORT IT ON ANY DEVICE.' : 'SAVING IS UNAVAILABLE HERE, BUT THIS CODE STILL HOLDS YOUR PROGRESS.');
    if (!game.input.touchMode) { code.focus(); code.select(); }
  });
  $('simport').addEventListener('click', () => { show('import'); code.readOnly = false; code.value = ''; say('PASTE A SAVE CODE, OR LOAD A .JSON FILE. THIS REPLACES YOUR CURRENT SAVE.'); code.focus(); });
  $('scopy').addEventListener('click', async () => {
    let ok = false;
    try { if (navigator.clipboard) { await navigator.clipboard.writeText(code.value); ok = true; } } catch (e) { ok = false; }
    if (!ok) { try { code.readOnly = false; code.select(); ok = document.execCommand('copy'); code.readOnly = true; } catch (e) { ok = false; } }
    say(ok ? 'COPIED' : 'SELECT THE CODE AND COPY IT BY HAND', !ok);
  });
  $('sdown').addEventListener('click', () => {
    try {
      const url = URL.createObjectURL(new Blob([saves.exportFile()], { type: 'application/json' })), a = document.createElement('a');
      a.href = url; a.download = 'neon-coast-save.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); say('DOWNLOADED NEON-COAST-SAVE.JSON');
    } catch (e) { say('DOWNLOAD NOT AVAILABLE HERE: COPY THE CODE INSTEAD', true); }
  });
  const apply = (text) => {
    game.importing = true;
    const r = saves.importText(text);
    if (r.error) game.importing = false;
    if (r.error) { say(r.error, true); game.audio.blip(false); return false; }
    say('SAVE IMPORTED · RELOADING…'); game.importing = true;
    setTimeout(() => location.reload(), 400);
    return true;
  };
  $('sload').addEventListener('click', () => apply(code.value));
  $('sfile').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files && file.files[0]; if (!f) return;
    if (f.size > 200000) { say('THAT FILE IS TOO BIG TO BE A SAVE', true); return; }
    const rd = new FileReader();
    rd.onload = () => { code.value = String(rd.result || ''); apply(code.value); file.value = ''; };
    rd.onerror = () => say('COULD NOT READ THAT FILE', true);
    rd.readAsText(f);
  });
}
