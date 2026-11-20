// Neon Coast: boot, world generation with a loading bar, and the main loop.
import * as THREE from 'three';
import { timeU, pointScaleU, pushOut, pause, reducedMotion, createGrid, beatU, beatNow, BEAT_LEN, nightU } from './core/util.js';
import { createInput } from './core/input.js';
import { makeLayout, clampToWorld, onLand, propsOnRoad, zoneName } from './world/layout.js';
import { buildKey } from './world/keyCity.js';
import { buildAds } from './world/ads.js';
import { createDistricts } from './world/districts.js';
import { createLoose, LAMP_BREAK } from './world/loose.js';
import { LAMP_GAIN } from './world/city.js';
import { CLUB_CROWD } from './game/story.js';
import { createHorizon } from './world/horizon.js';
import { createAnimals } from './actors/animals.js';
import { createSky, createOcean } from './world/sky.js';
import { buildGround, buildCity } from './world/city.js';
import { createEnvironment } from './world/environment.js';
import { createFx } from './vehicles/effects.js';
import { createVehicles } from './vehicles/vehicles.js';
import { createPlayer } from './player/player.js';
import { createFollowCamera } from './player/camera.js';
import { createCockpit } from './player/cockpit.js';
import { createAudio } from './audio/audio.js';
import { createMusic } from './audio/music.js';
import { THEME_OF } from './audio/themes.js';
import { createHud } from './ui/hud.js';
import { createTouch, coarse } from './ui/touch.js';
import { createCheats } from './cheats/cheats.js';
import { makeRoads, buildSignals, signal } from './world/roads.js';
import { createTraffic } from './actors/traffic.js';
import { createPeds } from './actors/peds.js';
import { createDirector } from './game/cutscene.js';
import { createPlaces } from './game/places.js';
import { createVenues } from './game/venues.js';
import { createStory } from './game/missions.js';
import { createRules } from './game/rules.js';
import { createActivity } from './game/activity.js';
import { createDamage } from './game/damage.js';
import { createCombat } from './game/combat.js';
import { createEvents } from './game/events.js';
import { createPursuit } from './game/pursuit.js';
import { createParking } from './game/parking.js';
import { createHeatHint } from './ui/heathint.js';
import { createRooftops } from './game/rooftops.js';
import { createStunts } from './game/stunts.js';
import { createSwim } from './player/swim.js';
import { createUnderwater } from './world/underwater.js';
import { createMarine } from './actors/marine.js';
import { createSinking } from './vehicles/sinking.js';
import { WL, bedAt, depthAt, islandDist } from './world/sea.js';
import { quality } from './core/quality.js';
import { createAdaptive } from './core/adaptive.js';
import { createBloom } from './world/bloom.js';
import { createMotes } from './world/motes.js';
import { createCinematic } from './game/cinematic.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');

function noWebGL() {
  $('title').hidden = true; $('hud').hidden = true; canvas.hidden = true; $('nogl').hidden = false;
}
function progress(p, text) {
  $('bar').firstElementChild.style.width = Math.round(p * 100) + '%';
  $('status').textContent = text;
  return pause(20);
}

async function boot() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { noWebGL(); return; }
  renderer.info.autoReset = false;            // reset once per frame (draw()), so the count includes the bloom passes
  // adaptive resolution (core/adaptive.js): the pixel ratio follows the frame time
  const adaptive = createAdaptive(() => fit(), 0.6);
  const bloom = createBloom(renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 2600);
  const cockpit = createCockpit(scene);     // first-person dashboards, fixed to the vehicle
  // Follow the window live: size, orientation, the phone's visual viewport and the device pixel
  // ratio (browser zoom, moving to another monitor) are all re-read on every change, not once at load.
  // Phones and tablets get a slightly lower pixel ratio cap (1.5) to stay smooth.
  let fitQueued = 0, fitKey = '';
  const fit = () => {
    fitQueued = 0;
    const w = Math.max(1, canvas.clientWidth || innerWidth), h = Math.max(1, canvas.clientHeight || innerHeight);
    adaptive.setBase(Math.min(window.devicePixelRatio || 1, coarse() ? 1.5 : 2));
    const pr = adaptive.ratio();
    const key = w + 'x' + h + '@' + pr.toFixed(3);
    if (key === fitKey) return;
    fitKey = key;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (game && game.hud) game.hud.resize();
  };
  const refit = () => { if (!fitQueued) fitQueued = requestAnimationFrame(fit); };
  let game = null;
  fit();
  addEventListener('resize', refit);
  addEventListener('orientationchange', () => { refit(); setTimeout(refit, 250); setTimeout(refit, 700); });
  if (window.visualViewport) visualViewport.addEventListener('resize', refit);
  if (window.ResizeObserver) new ResizeObserver(refit).observe(canvas);
  // devicePixelRatio changes do not always fire 'resize' (dragging to another monitor): watch it directly
  const watchDpr = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const on = () => { mq.removeEventListener('change', on); refit(); watchDpr(); };
    mq.addEventListener('change', on);
  };
  try { watchDpr(); } catch (e) { /* old browsers: the resize event still covers zoom */ }

  await progress(0.06, 'MIXING THE SUNSET…');
  const sky = createSky(scene), ocean = createOcean(scene);
  const L = makeLayout();
  await progress(0.2, 'PAVING LUMINA BOULEVARD…');
  const groundCanvas = buildGround(scene, L, renderer);
  await progress(0.38, 'RAISING DECO HOTELS…');
  const city = buildCity(scene, L);
  await progress(0.5, 'OPENING THE HALCYON CAUSEWAY…');
  const keyCity = buildKey(scene, L, renderer, L.adSigns);
  const ads = buildAds(scene, L.adSigns);
  const horizon = createHorizon(scene, city.blinkers);
  const districts = createDistricts(horizon, L, city.group, keyCity.group);
  { const set = city.setLights; city.setLights = (n, l, g) => { set(n, l, g); keyCity.setLights(n, l, g); ads.setLights(n); }; }
  await progress(0.62, 'PARKING THE CARS…');
  const audio = createAudio();
  const music = createMusic(audio);
  const fx = createFx(scene);
  const vehicles = createVehicles(scene, L, fx, audio);
  await progress(0.76, 'LACING UP THE SKATES…');
  const player = createPlayer(scene, L);
  const cam = createFollowCamera(camera, L.solids);
  const env = createEnvironment(scene, sky, ocean, city, camera, audio);
  const input = createInput(canvas);
  const hud = createHud(L, groundCanvas, renderer, keyCity.groundCanvas);
  const motes = createMotes(scene, L, camera, env);
  // graphics quality: the bloom, the neon pools on the street, the shoreline foam, the moths and fireflies
  const applyQuality = () => {
    bloom.set(quality.high);
    ocean.uniforms.uFoam.value = quality.high ? 1 : 0;
    L.lampMap.repaint(); L.key.lampMap.repaint();
  };
  quality.on(applyQuality); applyQuality();
  const R = makeRoads();
  const signals = buildSignals(scene, R, city.bodyMat, L.props);
  L.props.build();
  // dev builds: nothing may stand on a carriageway
  if (typeof __DEV__ !== 'undefined' && __DEV__) { const bad = propsOnRoad(L); if (bad.length) console.error('PROPS ON THE ROAD', bad); else console.info('prop placement OK: nothing on the carriageways'); }
  const grid = createGrid(14);

  game = {
    mode: 'foot', paused: false, vehicle: null, started: false,
    input, hud, audio, music, env, vehicles, player, L, cam, camera, renderer, scene, fx, R, grid, wanted: 0, busy: null, districts, adaptive, bloom, motes, quality,
    focus: () => (game.vehicle ? game.vehicle : player.pos),
    heading: () => (game.vehicle ? game.vehicle.yaw : player.yaw),
  };
  await progress(0.84, 'FILLING THE STREETS…');
  const traffic = game.traffic = createTraffic(R, vehicles, grid, game);
  const peds = game.peds = createPeds(scene, R, grid, game);
  const animals = game.animals = createAnimals(scene, game);
  const loose = game.loose = createLoose(scene, game, city, fx, audio);
  // what survives a reload: the outfit you wear and own, and how far the story has got
  const SAVE = 'neon-coast-save-1';
  const save = game.save = { outfit: 'classic', owned: [], story: 0, gift: {} };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) { /* private mode, file:// quirks: play without saving */ }
  if (!Array.isArray(save.owned)) save.owned = [];
  if (!save.gift || typeof save.gift !== 'object') save.gift = {};
  save.story = Math.max(0, Math.floor(+save.story || 0));
  game.persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* ignore */ } };
  const cut = game.cut = createDirector(camera, game);
  const rules = game.rules = createRules(game, scene);
  const damage = game.damage = createDamage(game);
  const places = game.places = createPlaces(game, scene, camera);
  const venues = game.venues = createVenues(game);
  const story = game.story = createStory(game, scene);
  const act = game.act = createActivity(game);
  venues.restore();                           // a motel save brings back its cash and clock
  const combat = game.combat = createCombat(game, scene);
  const events = game.events = createEvents(game, scene);
  const pursuit = game.pursuit = createPursuit(game, scene);
  const parking = game.parking = createParking(game);
  const heatHint = createHeatHint(game);
  const roofs = game.roofs = createRooftops(game);
  const stunts = game.stunts = createStunts(game);
  const cine = game.cine = createCinematic(game);
  // a second helicopter waits on the Glasswater Tower helipad downtown
  const padT = L.key.buildings.find((b) => b.name === 'Glasswater Tower');
  vehicles.spawnHeli(padT.pad.x, padT.pad.z, Math.PI / 2, 1, padT.roofY);
  // the sea: swimming, everything under the surface, sea life, sinking vehicles
  const sea = game.sea = createUnderwater(scene, camera, sky, ocean, env, game);
  const swim = game.swim = createSwim(game);
  const marine = game.marine = createMarine(scene, game, sea);
  const sinking = game.sinking = createSinking(game);
  // indoors the camera renders layer 1 only: the room, the courier, the rings and the lights
  scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
  player.model.root.traverse((o) => o.layers.enable(1)); player.shadow.layers.enable(1);
  const cheats = createCheats(game);
  game.cheats = cheats;
  const touch = game.touch = createTouch(game);
  const me = { x: 0, z: 0, isPed: true, isPlayer: true };
  window.__neon = game;                       // handy for poking around in devtools
  // debug helpers (devtools / automated checks): __neon.debug.warp('club'), .skip(), .bike()
  game.debug = {
    warp: (key) => places.warp(key),
    camYaw: (y) => { cam.yaw = y; cam.pitch = 0.12; },
    engine: () => audio.engineGain(),
    skate: () => audio.skateGain(),
    skip: () => cut.skip(),
    bike: () => { const b = vehicles.cars.find((c) => c.kind === 'bike' && !c.ai); player.pos.set(b.x + 1.6, 0, b.z); return b; },
    to: (x, z) => { if (game.vehicle) { game.vehicle.x = x; game.vehicle.z = z; } else player.pos.set(x, player.floor, z); },
    // set the clock (hours, e.g. 3 or 8.5); the traffic and the crowd follow it over the next seconds
    time: (h) => { env.tod = ((h % 24) + 24) % 24; env.target = null; return env.tod; },
    counts: () => ({ cars: traffic.count(), carTarget: traffic.target, peds: peds.active, pedTarget: peds.target, animals: animals.count(), ...animals.stats, dog: { ...animals.dog } }),
    interact: () => interact(),
    // ---- the sea (automated checks): everything is placed directly, software GL is slow
    sea: () => ({ ...sea.stats(), swim: swim.state(), marine: { ...marine.stats }, sink: { ...sinking.stats }, cam: { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(1) } }),
    swim: () => swim.state(),
    breath: (v) => { swim.S.breath = v; return v; },
    seaFn: (x, z) => ({ bed: +bedAt(x, z).toFixed(2), depth: +depthAt(x, z).toFixed(2), d: +islandDist(x, z).toFixed(1) }),
    marineSample: () => marine.sample(),
    marineForce: (s = 5) => marine.force(s),
    shark: () => marine.sharkState(),
    sharkSpawn: () => marine.spawnShark(),
    sink: (v) => sinking.sink(v || game.vehicle),
    sunk: (v) => !!(v && v.sink) && { y: +v.y.toFixed(2), settled: v.sink.settled, t: +v.sink.t.toFixed(1) },
    audioUnder: () => ({ under: sound.under, ctxFilter: audio.ready }),
    foot: (x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.vy = 0; return player.pos.toArray(); },
    key: (code) => input.onKey({ code, repeat: false, preventDefault() {} }),
    // the courier's sitting / dancing state, and the rhythm game
    act: () => ({ mode: act.mode, seat: act.seat && act.seat.kind, move: act.move, combo: act.combo, best: act.best, vibe: act.vibe, rival: act.rival, x: player.pos.x, z: player.pos.z, y: player.pos.y }),
    beat: () => beatNow(),
    // press a dance move key exactly on the next beat (for automated checks at a few fps)
    onBeat: (code) => new Promise((res) => { const wait = (Math.ceil(beatNow() + 0.02) - beatNow()) * BEAT_LEN * 1000; setTimeout(() => { input.onKey({ code, repeat: false, preventDefault() {} }); res(act.combo); }, Math.max(0, wait)); }),
    inside: (k) => places.warpInside(k),
    floor: () => { const r = game.inside && game.inside.room; if (r) player.pos.set(r.ox + 0.6, player.floor, r.oz - 1.5); },
    props: () => ({ colliders: L.props.cols.length, seats: L.props.seats.length, lines: L.props.lines.length }),
    moving: () => peds.peds.filter((p) => !p.off && p.v > 0.3).length,
    sittingPeds: () => peds.peds.filter((p) => !p.off && p.hang && p.hang.kind === 'seat').length,
    // ---- checks for the new systems
    propsOnRoad: () => propsOnRoad(L),
    club: () => {
      const r = game.inside && game.inside.key === 'club' ? game.inside.room : L.places.club.room;
      if (!r) return null;
      const on = r.crowd.filter((d) => d.on), zones = r.exclude || [];
      const inZone = on.filter((d) => d.kind !== 'sit' && zones.some((z) => Math.hypot(d.x - z.x, d.z - z.z) < z.r)).length;
      return { tier: r.tier, people: on.length, dancers: on.filter((d) => d.kind === 'dance').length, zones: zones.length, dancersInZone: inZone,
        seated: act.mode === 'sit' && act.seat && act.seat.kind, npcSeated: Object.keys(r.npc).filter((k) => r.npc[k].seated), cut: cut.active };
    },
    tiers: () => CLUB_CROWD,
    outfit: () => ({ id: save.outfit, bottom: player.model.look.bottom, skirt: player.model.skirt.visible }),
    loose: (kind, i = 0) => { const b = loose.bodies.filter((o) => o.kind === kind)[i]; return b && loose.status(b); },
    looseBody: (kind, i = 0) => loose.bodies.filter((o) => o.kind === kind)[i],
    lamp: (i) => { const l = L.lamps[i]; return { x: l.x, z: l.z, yaw: l.yaw, off: l.col.off, dead: !!l.dead }; },
    lampBreak: LAMP_BREAK,
    // ground lamp-light term under a lamp head at full night, and the night ambient
    nightLight: (x, z) => ({ lampTerm: L.lampMap.sample(x, z) * LAMP_GAIN * nightU.value, mapValue: L.lampMap.sample(x, z), night: nightU.value, hemi: env.hemi.intensity }),
    drawCalls: () => renderer.info.render.calls,
    // ---- graphics (automated checks)
    gfx: (l) => { if (l) quality.set(l, false); return { level: quality.level, bloom: bloom.on, bloomPasses: bloom.stats.passes, foam: ocean.uniforms.uFoam.value, pools: quality.high && L.neonPools.length, calls: renderer.info.render.calls }; },
    adaptive: () => ({ scale: +adaptive.scale.toFixed(3), ratio: +adaptive.ratio().toFixed(3), drops: adaptive.drops, rises: adaptive.rises, avg: +adaptive.avg.toFixed(1), enabled: adaptive.enabled, base: adaptive.base, dpr: renderer.getPixelRatio() }),
    motes: () => motes.stats(),
    cine: () => ({ active: cine.active, hud: getComputedStyle($('hud')).display, bars: $('cine').classList.contains('cm') }),
    pools: () => ({ old: L.neonPools.length, key: L.key.lampMap && true }),
    // ---- damage, weapons, patrol lasers (automated checks set velocities directly: software GL is slow)
    cheat: (code) => cheats.exec(code),
    parked: (i = 0) => vehicles.cars.filter((k) => k.kind === 'car' && !k.traffic && !k.police && !k.off)[i],
    drive: (c) => { if (game.vehicle) game.vehicle.driven = false; act.reset(); c.driven = true; game.vehicle = c; game.mode = c.kind; player.setHidden(c.kind !== 'bike'); return c.idx; },
    leave: () => { if (game.vehicle) rules.leaveVehicle(); },
    put: (v, x, z, yaw) => Object.assign(v, { x, z, yaw: yaw ?? v.yaw, vx: 0, vy: 0, vz: 0, y: v.kind === 'heli' ? v.y : 0, spin: 0 }),
    vel: (vx, vz, v = game.vehicle) => { v.vx = vx; v.vz = vz; if (v.kind !== 'heli') v.yaw = Math.atan2(vx, vz); },
    dmg: (v) => damage.state(v || game.vehicle),
    hit: (v, n) => damage.hit(v || game.vehicle, n, 'player'),
    repair: (v) => damage.repair(v || game.vehicle),
    wanted: (n) => { game.wanted = n; return n; },
    // a patrol car on the lane `dist` m behind (x, z), heading along yaw, chasing
    copBehind: (i, dist = 22) => { const c = traffic.police[i], f = game.focus(), y = game.heading(); traffic.railNear(c, f.x - Math.sin(y) * dist, f.z - Math.cos(y) * dist, y); vehicles.paint(c, '#19b8b0'); damage.repair(c); return c; },
    police: () => combat.lasers(),
    combat: () => ({ ...combat.stats, cur: combat.inv.cur, ammo: { ...combat.inv.ammo }, held: combat.held }),
    fireAt: (v) => combat.fireAt(v),
    bang: (charge = 0.3, behind = true) => combat.throwBang(charge, behind),
    weapon: (id) => combat.set(id),
    projectiles: () => combat.projectiles(),
    fx: () => fx.stats(),
    // street events: start one now ('bag' | 'getaway' | 'suspect'), read its state, jump to what you are after
    event: (type) => events.start(type),
    evt: () => events.state(),
    evtStats: () => ({ ...events.stats }),
    // ---- the key, rooftops, stunts (automated checks)
    spots: () => ({ causeway: [-390, 53], keyAve: [-640, 53], stadium: [-790, -40], downtown: [-600, -46], park: [-790, 20], grove: [-1000, 0], marina: [-790, 140], docks: [-960, 110] }),
    roofOf: (name) => { const b = [...L.buildings, ...L.key.buildings].find((k) => k.name === name); return b && { x: b.cx, z: b.cz, y: b.roofY, door: { x: b.door.x, z: b.door.z, out: b.door.out }, pad: b.pad || null }; },
    onRoof: (name) => { const b = [...L.buildings, ...L.key.buildings].find((k) => k.name === name); if (game.vehicle) rules.leaveVehicle(); player.pos.set(b.cx, b.roofY + 0.05, b.cz + (b.pad ? b.pad.r + 2 : 0)); player.vel.set(0, 0, 0); player.vy = 0; player.onGround = true; return player.pos.toArray(); },
    ground: (x, z, y = 999) => L.surf.at(x, z, y),
    helis: () => vehicles.helis.map((h) => ({ x: +h.x.toFixed(1), y: +h.y.toFixed(2), z: +h.z.toFixed(1), floor: +(h.floor || 0).toFixed(2), driven: h.driven, hp: Math.round(h.hp) })),
    roofs: () => ({ ...roofs.stats, near: !!roofs.near(), y: +player.pos.y.toFixed(2), onGround: player.onGround, health: Math.round(game.health), busy: game.busy }),
    roofDoor: () => roofs.down(),
    stunt: (id, speed) => stunts.line(id, speed),
    stunts: () => ({ ...stunts.stats, found: stunts.found(), total: stunts.total, scale: stunts.scale, money: game.money, v: game.vehicle && { x: +game.vehicle.x.toFixed(1), y: +game.vehicle.y.toFixed(2), z: +game.vehicle.z.toFixed(1), air: !!game.vehicle.air, hp: Math.round(game.vehicle.hp) } }),
    districts: () => ({ a: districts.showA, b: districts.showB }),
    zone: () => { const f = game.focus(); return zoneName(f.x, f.z); },
    nearCount: (r = 150) => { const f = game.focus(); return { cars: vehicles.cars.filter((c) => !c.off && c.ai && Math.hypot(c.x - f.x, c.z - f.z) < r).length, peds: peds.peds.filter((p) => !p.off && Math.hypot(p.x - f.x, p.z - f.z) < r).length, kit: vehicles.cars.filter((c) => !c.off && c.model && c.ai).length }; },
    // ---- the venues (automated checks)
    venue: () => {
      const p = game.inside, r = p && p.room;
      return { inside: p ? p.key : null, busy: game.busy, shop: places.shop, msg: places.msg, money: game.money, health: Math.round(game.health), tod: +env.tod.toFixed(2),
        calls: renderer.info.render.calls, meshes: r ? r.drawn() : 0, arcade: { mode: venues.arcade.mode, score: Math.floor(venues.arcade.score), best: save.arcade || 0 }, vest: !!save.vest, motel: save.motel || null, stats: { ...venues.stats },
        x: +(player.pos.x - (r ? r.ox : 0)).toFixed(2), z: +(player.pos.z - (r ? r.oz : 0)).toFixed(2) };
    },
    // stand on a room's use spot (i) and press E; choose(i) picks a line in an open menu
    useAt: (i = 0) => { const r = game.inside && game.inside.room; if (!r) return null; const u = (r.uses || [r.use])[i]; player.pos.set(r.ox + u.x, player.floor, r.oz + u.z); places.use(); return game.busy; },
    choose: (i) => places.choose(i),
    exitRoom: () => places.exit(),
    // the Blue Pelican's record player and its now-playing card
    music: () => { const S = music.state, el = document.getElementById('nowplay'); return { status: S.status, tracks: S.tracks.length, note: S.note, playing: S.playing, level: +S.level.toFixed(2), rec: +music.rec.toFixed(2), skips: S.skips, room: sound.room, card: el && !el.hidden ? el.textContent : null }; },
    // Coast Patrol escalation: what is out (patrol cars, roadblocks, the helicopter, the tank) and their shots
    pursuit: () => ({ wanted: game.wanted, patrols: traffic.police.filter((c) => !c.off).length, blocks: traffic.blocks, heli: pursuit.heli, tank: pursuit.tank, ...pursuit.stats, laserShots: combat.stats.laserShots, laserHits: combat.stats.laserHits, stuns: combat.stats.stuns }),
    pursuitWarp: () => pursuit.warp(),
    deathState: () => ({ busy: game.busy, slow: game.slow || 1, card: document.getElementById('card').className, title: document.getElementById('cardt').textContent, dead: document.body.classList.contains('dead'), totalled: rules.stats.totalled, x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), clinic: [L.clinic.x, L.clinic.z], vehicle: !!game.vehicle, health: Math.round(game.health), money: game.money }),
    heatHint: () => heatHint.state(),
    mapDots: () => ({ ...hud.dots }),
    star: () => story.starState(),
    parking: () => parking.check(),
    nearestVacant: () => parking.nearest(),
    footSpots: (n) => parking.samples(n),
    // music: which theme plays, the auto-off and the M switch
    musicState: () => ({ ...audio.musicState(), room: sound.room, want: sound.theme }),
    musicAuto: (sec) => audio.musicAuto(sec),
    venueKeys: () => [...Object.keys(L.places), ...Object.keys(L.venues)],
    evtGo: (off = 0.6) => { const t = events.target(); if (!t) return null; const v = game.vehicle; if (v) { v.x = t.x + off; v.z = t.z; v.vx = v.vz = 0; } else player.pos.set(t.x + off, 0, t.z); return t; },
  };
  game.signalAt = (n, h) => signal(n, h, timeU.value);

  function interact() {
    const v = game.vehicle;
    if (game.busy) return;
    if (!v && swim.wet) { swim.interact(); return; }
    if (act.mode) { act.toggle(); return; }
    if (game.inside) { places.use(); return; }
    if (v) {
      const floor = v.floor || 0;
      if (v.kind === 'heli' && v.y - floor > 0.6) { hud.toast('LAND FIRST', 'HOLD C TO DESCEND'); return; }
      const dry = onLand(v.x, v.z) || floor > 0.3;
      if (v.kind === 'heli' && !dry) { hud.toast('NOWHERE TO STAND', 'FLY BACK OVER LAND FIRST'); return; }
      v.driven = false;
      // step out beside it, on whatever it stands on (a roof, a deck); if that side is off the edge, try the other
      const side = v.radius + 1.1;
      let px = v.x + Math.cos(v.yaw) * side, pz = v.z - Math.sin(v.yaw) * side;
      if (floor > 0.3 && Math.abs(L.surf.at(px, pz, floor + 0.5) - floor) > 0.4) { px = v.x - Math.cos(v.yaw) * side; pz = v.z + Math.sin(v.yaw) * side; }
      if (floor > 0.3 && Math.abs(L.surf.at(px, pz, floor + 0.5) - floor) > 0.4) { px = v.x - Math.sin(v.yaw) * (v.radius + 1.6); pz = v.z - Math.cos(v.yaw) * (v.radius + 1.6); }
      player.pos.set(px, floor > 0.3 ? L.surf.at(px, pz, floor + 0.5) : 0, pz);
      if (player.pos.y < 0.3) for (let i = 0; i < 2; i++) for (const b of L.solids) pushOut(player.pos, 0.6, b);
      clampToWorld(player.pos, 0.6);
      player.vel.set(0, 0, 0); player.vy = 0; player.yaw = v.yaw; player.fallFrom = player.pos.y;
      player.setHidden(false);
      game.vehicle = null; game.mode = 'foot';
      audio.thud(0.25);
    } else {
      const n = vehicles.nearest(player.pos);
      if (!n || n.jacking) return;
      if (n.ai) { rules.startJack(n); return; }
      n.driven = true; game.vehicle = n; game.mode = n.kind;
      player.setHidden(n.kind !== 'bike');
      audio.thud(0.3);
    }
  }
  const fire = () => { if (game.mode === 'tank') vehicles.fire(); };

  // a tap or click during a scene: finish the line, then move on
  canvas.addEventListener('click', () => { if (game.busy === 'cut') cut.next(); });
  input.onKey = (e) => {
    if (game.busy === 'cut') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') cut.next();
      else if (e.code === 'KeyX' || e.code === 'Escape') cut.skip();
      return;
    }
    if (game.busy === 'shop') { places.key(e); return; }
    if (game.busy === 'arcade') { venues.key(e); return; }
    if (game.busy === 'fail') { story.key(e); return; }
    // weapons: 1-5 pick one (when not dancing), Q cycles (and holsters)
    const wd = /^(Digit|Numpad)([1-5])$/.exec(e.code);
    if (wd && !act.dancing && game.started && !game.busy && !cheats.open) { combat.select(+wd[2]); return; }
    // dancing: 1-8 pick a move and hit the beat, arrows step through the moves
    if (act.dancing && !game.busy) {
      const d = /^(Digit|Numpad)([1-8])$/.exec(e.code);
      if (d) { act.press(+d[2] - 1); return; }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { act.press(act.move + (e.code === 'ArrowRight' ? 1 : -1)); return; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { act.press(act.move); return; }
    }
    switch (e.code) {
      case 'BracketLeft': case 'BracketRight': { const sp = env.stepSpeed(e.code === 'BracketLeft' ? -1 : 1); hud.toast(sp ? `TIME ×${sp}` : 'TIME FROZEN', sp ? `ONE GAME MINUTE = ${+(1 / sp).toFixed(2)} S` : 'THE CLOCK IS STOPPED'); break; }
      case 'Backquote': case 'KeyT': e.preventDefault(); cheats.toggle(true); break;
      case 'KeyE': interact(); break;
      case 'KeyF': if (game.mode === 'tank') fire(); else if (game.started && !game.busy && !cheats.open) act.toggle(); break;
      case 'KeyN': hud.toast('TIME SKIP', 'FAST-FORWARDING TO ' + env.cycle().replace('GOLDEN', 'GOLDEN HOUR')); break;
      case 'KeyM':
        if (e.shiftKey) { hud.toast(audio.toggleMute() ? 'ALL SOUND OFF' : 'ALL SOUND ON', 'SHIFT+M · M ALONE SWITCHES THE MUSIC'); break; }
        { const r = audio.toggleMusic(); syncMusicBtn();
          if (r === 'off') hud.toast('MUSIC OFF', 'SOUND EFFECTS STAY ON · M (TOUCH: ♪) TURNS IT BACK ON');
          else hud.toast('MUSIC ON', r === 'street' ? 'THE STREET MUSIC IS BACK · M AGAIN SWITCHES ALL MUSIC OFF' : 'STREET AND INDOOR THEMES · M TO SWITCH OFF'); }
        break;
      case 'KeyP': hud.togglePerf(); break;
      case 'KeyK': if (game.started && !game.busy && !cheats.open && !cine.start()) hud.toast('CINEMATIC MODE', 'NOT AVAILABLE INDOORS OR IN A SCENE'); break;
      case 'KeyV': hud.toast('CAMERA', cam.cycleView().name); break;
      case 'KeyQ': if (game.started && !game.busy && !cheats.open) combat.cycle(1); break;
    }
  };

  await progress(0.92, 'SWITCHING ON THE NEON…');
  const ctl = { move: 0, strafe: 0, sprint: false, jump: false, throttle: 0, steer: 0, hand: false, up: false, down: false };
  // the touch top bar's music button shows whether the street music is on
  const syncMusicBtn = () => { const b = $('bmute'); if (b) { b.classList.toggle('off', !audio.streetOn); b.setAttribute('aria-pressed', String(audio.streetOn)); } };
  audio.onAutoOff = () => { syncMusicBtn(); hud.toast('MUSIC OFF', 'PRESS M (TOUCH: ♪) TO TURN IT BACK ON'); };
  syncMusicBtn();
  const sound = { engine: 0, engineRev: 0, heavy: false, skate: 0, rotor: 0, rain: 0, siren: 0, duck: false, room: 0 };
  let last = performance.now(), raf = 0, frameN = 0, turnT = 0;

  const hudState = { env, game, vehicles, counts: [0, peds.count], blips: [], focus: null, heading: 0, camYaw: 0, inVehicle: null };
  // one frame's drawing: the scene, then (High) the bloom over it
  function draw() {
    renderer.info.reset();
    renderer.render(scene, camera);
    // a room can tone the bloom down (Zigzag Threads' pale walls would glow otherwise)
    if (bloom.on) bloom.render(nightU.value * (game.inside && game.inside.room && game.inside.room.bloomK != null ? game.inside.room.bloomK : 1), game.inside ? 0 : env.glare);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (game.paused) { last = now; music.update(0, true, true); draw(); input.endFrame(); return; }
    adaptive.tick(now - last);
    const raw = Math.min(Math.max((now - last) / 1000, 0), 0.5);
    last = now;
    stunts.update(Math.min(raw, 0.05));
    const dt = Math.min(raw, 0.05) * stunts.scale * (game.slow || 1);   // slow motion: a stunt jump in the air, TOTALLED
    timeU.value += dt; game.dt = dt;
    // the shared music clock: free-runs on real time, pulled onto the synth's own position when there is sound
    {
      beatU.value += raw / BEAT_LEN;
      const ab = audio.beatNow();
      if (ab !== null) { const d = ab - beatU.value; if (Math.abs(d) > 0.5) beatU.value = ab; else beatU.value += d * Math.min(1, raw * 4); }
      beatU.t = now / 1000;
    }

    const live = game.started && !cheats.open && !game.busy && !cine.active;
    frameN++;
    ctl.move = live ? input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) : 0;
    ctl.strafe = live ? input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) : 0;
    ctl.sprint = live && input.isDown('ShiftLeft', 'ShiftRight');
    ctl.jump = live && game.mode === 'foot' && input.isDown('Space');
    // the touch stick: analog, used whenever no movement key (or on-screen brake) is held
    const st = input.stick;
    if (live && st.on) {
      if (!ctl.move) ctl.move = -st.y;
      if (!ctl.strafe) ctl.strafe = st.x;
      if (game.mode === 'foot' && Math.hypot(st.x, st.y) > 0.92) ctl.sprint = true;
    }
    // a patrol stun shot: a moment of wobbly legs
    if (player.stagger > 0 && !game.vehicle) { ctl.move = ctl.strafe = 0; ctl.jump = false; ctl.sprint = false; }
    ctl.throttle = ctl.move; ctl.steer = -ctl.strafe;
    ctl.hand = live && game.mode === 'car' && input.isDown('Space');
    ctl.up = live && input.isDown('Space');
    ctl.down = live && input.isDown('KeyC', 'ControlLeft', 'ControlRight');
    if (live && input.clicked) fire();

    // neighbour grid for this frame: every car, every pedestrian, and the courier on foot
    grid.clear();
    for (const c of vehicles.cars) if (!c.off) grid.add(c);
    if (vehicles.tank) grid.add(vehicles.tank);
    for (const p of peds.peds) if (!p.off) grid.add(p);
    if (!game.vehicle && !player.hidden && game.busy !== 'cut') { me.x = player.pos.x; me.z = player.pos.z; grid.add(me); }

    if (game.busy || game.inside || game.vehicle) swim.sleep(cam);
    if (game.mode === 'bike' && game.vehicle) { /* posed after the bike has moved */ }
    else if (!game.busy && !game.inside && act.mode && !game.vehicle) act.update(dt, ctl, input);
    else if (!game.busy && !game.inside && swim.update(dt, ctl, cam)) { /* in the water: player/swim.js drives the courier */ }
    else if (!game.busy && !game.inside) player.update(dt, ctl, cam.yaw, vehicles, audio);
    signals.update(timeU.value);
    traffic.update(dt, timeU.value);
    sinking.update(dt);
    vehicles.update(dt, ctl, cam, player);
    loose.update(dt);
    damage.update(dt);
    combat.update(dt);
    if (game.mode === 'bike' && game.vehicle) player.ride(game.vehicle);
    peds.update(dt, timeU.value, frameN, vehicles.cars);
    animals.update(dt);
    if (game.started) { rules.update(dt); pursuit.update(dt); parking.update(raw); heatHint.update(raw); story.update(dt); story.tickStar(dt); places.update(dt, ctl); venues.tick(dt); events.update(dt); marine.blips(rules.blips); roofs.update(dt); }
    city.tick(timeU.value);
    fx.update(dt);
    player.tickFace(dt);
    combat.pose();

    const v = game.vehicle;
    const speed = v ? (v.kind === 'tank' ? v.speed : Math.hypot(v.vx, v.vz)) : player.speed;
    if (!game.started && !reducedMotion) cam.yaw += dt * 0.04;
    if (game.deathCam) rules.deathCam(camera, Math.min(raw, 0.05));
    else if (cut.active) cut.update(dt);
    else if (game.inside) { /* places.update owns the camera indoors */ }
    else if (stunts.cam) stunts.camUpdate(dt);
    else if (cine.active) cine.update(dt);
    else cam.update(dt, input, game.mode, game.focus(), game.heading(), speed, fx, player.phase);
    // in first person on foot the courier's own body would sit inside the camera
    cockpit.update(dt, v, cam.first && !cut.active && !game.inside && !!v, ctl.steer);
    const hideBody = cam.first && !cut.active && !game.inside && game.mode === 'foot';
    if (player.model.root.visible === hideBody && !player.hidden) player.model.root.visible = !hideBody;
    pointScaleU.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    env.update(dt);
    horizon.update(env);
    sea.update(dt);
    marine.update(dt);
    // out at sea in the helicopter: a soft boundary with a fuel warning instead of a wall
    if (v && v.kind === 'heli' && v.turnBack && game.started && !game.busy) {
      turnT -= dt;
      if (turnT <= 0) { hud.toast('TURNING BACK: LOW FUEL', 'HEAD FOR THE ISLAND'); turnT = 3.5; }
    } else turnT = 0;

    // context hints
    if (game.started) {
      if (game.busy === 'shop') hud.setHint(places.hint());
      else if (game.busy === 'arcade') hud.setHint(venues.hint());
      else if (game.busy) hud.setHint(game.busy === 'cut' ? [['Space / Enter', 'next line'], ['X', 'skip scene']] : game.busy === 'fail' ? [['Enter', 'retry from checkpoint'], ['Esc', 'walk away']] : []);
      else if (game.inside) hud.setHint(places.hint());
      else if (!v && swim.wet) hud.setHint(swim.hint());
      else if (!v && act.mode) hud.setHint(act.hint());
      else if (!v) {
        const n = vehicles.nearest(player.pos), f = act.fHint(), wh = combat.hints();
        hud.setHint(n ? [['E', n.ai ? `take the ${n.label} (heat!)` : n.kind === 'bike' ? 'ride the Comet' : `enter ${n.label}`], ...(f ? [f] : []), ...wh, ['V', 'camera view'], ['~ / T', 'cheat console']]
          : [...(f ? [f] : []), ...wh, ['WASD', 'skate'], ['Shift', 'sprint'], ['Space', 'jump'], ['Drag', 'look'], ['V', 'camera view'], ['~ / T', 'cheat console']]);
      } else if (v.kind === 'car') hud.setHint([['E', 'exit car'], ['WASD', 'drive'], ['Space', 'handbrake'], ...combat.hints(), ['V', 'camera view']]);
      else if (v.kind === 'bike') hud.setHint([['E', 'get off'], ['W', 'throttle (wheelie from low speed)'], ['A D', 'lean'], ['S', 'brake'], ...combat.hints(), ['V', 'camera view']]);
      else if (v.kind === 'tank') hud.setHint([['E', 'exit tank'], ['WASD', 'drive'], ['Drag', 'aim turret'], ['Click / F', 'fire'], ['V', 'camera view']]);
      else hud.setHint([['W S', 'forward / back'], ['A D', 'yaw'], ['Space', 'up'], ['C / Ctrl', 'down'], ['E', v.y - (v.floor || 0) > 0.6 ? 'land to exit' : 'exit helicopter'], ['V', 'camera view']]);
      hudState.focus = game.focus(); hudState.heading = game.heading(); hudState.camYaw = cam.yaw; hudState.inVehicle = v;
      hudState.counts[0] = traffic.count(); hudState.counts[1] = peds.active; hudState.blips = rules.blips;
      hudState.counts[2] = traffic.target; hudState.counts[3] = peds.target; hudState.counts[4] = animals.count();
      hudState.res = adaptive.scale.toFixed(2) + 'x (' + adaptive.ratio().toFixed(2) + ' px)' + (adaptive.enabled ? '' : ' FIXED');
      hudState.gfx = quality.level.toUpperCase() + (bloom.on ? ' + BLOOM' : '');
      hudState.districts = (districts.showA ? 'OLD TOWN ' : '') + (districts.showB ? 'SOLANO KEY' : '');
      hud.update(dt, hudState);
      touch.update();
    }

    sound.engine = v && v.kind !== 'heli' ? 1 : 0;
    sound.heavy = !!v && v.kind === 'tank';
    sound.engineRev = v ? Math.min(Math.abs(speed) / (v.kind === 'tank' ? 13 : v.kind === 'bike' ? 40 : 44), 1) * (v.kind === 'bike' ? 1.5 : 1) : 0;
    sound.under = sea.under;
    sound.skate = !v && player.onGround && !player.swimming && !cut.active && !act.mode ? Math.min(player.speed / 13.5, 1) : 0;
    sound.rotor = vehicles.heli ? vehicles.heli.spool * (v === vehicles.heli ? 1 : 0.35) : 0;
    sound.rain = env.rainAmt; sound.siren = game.siren || 0; sound.duck = cut.active;
    sound.room = !game.inside ? 0 : game.inside.key === 'club' ? 2 : game.inside.key === 'lounge' ? 3 : 1;
    sound.theme = !game.inside ? 'street' : game.busy === 'arcade' ? 'arcadeGame' : THEME_OF[game.inside.key] || null;
    sound.night = nightU.value; sound.wanted = game.wanted;
    music.update(dt, !!game.inside && game.inside.key === 'lounge' && game.busy !== 'door' && audio.musicOn, game.paused);
    sound.rec = music.rec;
    sound.club = game.inside && game.inside.key === 'club' ? game.inside.room.level.music : 1;
    sound.lounge = game.inside && game.inside.room.inLounge && game.inside.room.inLounge(player.pos.x - game.inside.room.ox) ? 1 : 0;
    sound.hum = game.inside ? 0 : loose.sound.hum; sound.spray = game.inside ? 0 : loose.sound.spray;
    sound.fire = damage.sound.fire; sound.cough = !!(v && v.cut && v.stage >= 2);
    audio.update(sound);

    districts.update(camera);
    keyCity.update(camera);
    motes.update(dt);
    draw();
    input.endFrame();
  }

  // compile shaders + draw one frame behind the title card before declaring ready
  env.update(0);
  horizon.update(env);
  cam.update(0.016, input, 'foot', player.pos, player.yaw, 0, fx, 0);
  sea.warm(true); marine.warm(true);
  // compile both districts and both silhouettes up front (no shader hitch on the causeway)
  city.group.visible = keyCity.group.visible = districts.silA.visible = districts.silB.visible = true;
  renderer.compile(scene, camera);
  sea.warm(false); marine.warm(false);
  districts.update(camera);
  draw();                                   // warms the bloom shaders too
  adaptive.reset();
  await progress(1, 'READY');
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; audio.suspend(); music.update(0, true, true); input.clearKeys(); }
    else if (!raf) { last = performance.now(); adaptive.reset(); raf = requestAnimationFrame(frame); if (game.started && !game.paused) audio.resume(); }
  });

  const title = $('title'), go = $('go');
  $('bar').hidden = true; $('status').hidden = true; go.hidden = false; $('keys').hidden = false; $('tkeys').hidden = false; $('ctlpick').hidden = false;
  const start = () => {
    if (game.started) return;
    touch.save();
    game.started = true;
    audio.start();
    cam.yaw = Math.PI / 2; cam.pitch = 0.2;
    cheats.parkHeli();
    title.classList.add('out');
    setTimeout(() => { title.hidden = true; }, 700);
    hud.show();
    hud.toast('HELICOPTER PARKED NEARBY', input.touchMode ? 'WALK UP AND TAP E · CODES: TAP CODES' : 'WALK UP AND PRESS E · CODES: PRESS T');
    // the local news: the causeway is open again (once the helicopter toast has had its turn)
    setTimeout(() => hud.toast('WAVE 86 NEWS: HALCYON CAUSEWAY REOPENS', 'STORM REPAIRS DONE · SOLANO KEY IS A SHORT DRIVE WEST'), 3200);
    input.enabled = true;
    go.blur();
  };
  title.addEventListener('click', (e) => { if (!e.target.closest('#ctlpick,#tlinks')) start(); });
  go.focus({ preventScroll: true });
}

boot().catch((err) => {
  console.error(err);
  $('status').textContent = 'SOMETHING WENT WRONG — SEE THE CONSOLE';
});
