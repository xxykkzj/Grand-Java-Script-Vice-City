// Neon Coast: boot, world generation with a loading bar, and the main loop.
import * as THREE from 'three';
import { timeU, pointScaleU, pushOut, pause, reducedMotion, createGrid, beatU, beatNow, BEAT_LEN } from './core/util.js';
import { createInput } from './core/input.js';
import { makeLayout, clampToWorld, onIsland, PIER, CAUSEWAY, HX } from './world/layout.js';
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
import { createHud } from './ui/hud.js';
import { createCheats } from './cheats/cheats.js';
import { makeRoads, buildSignals, signal } from './world/roads.js';
import { createTraffic } from './actors/traffic.js';
import { createPeds } from './actors/peds.js';
import { createDirector } from './game/cutscene.js';
import { createPlaces } from './game/places.js';
import { createStory } from './game/missions.js';
import { createRules } from './game/rules.js';
import { createActivity } from './game/activity.js';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 2600);
  const cockpit = createCockpit(scene);     // first-person dashboards, fixed to the vehicle
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  await progress(0.06, 'MIXING THE SUNSET…');
  const sky = createSky(scene), ocean = createOcean(scene);
  const L = makeLayout();
  await progress(0.2, 'PAVING LUMINA BOULEVARD…');
  const groundCanvas = buildGround(scene, L, renderer);
  await progress(0.38, 'RAISING DECO HOTELS…');
  const city = buildCity(scene, L);
  const horizon = createHorizon(scene, city.blinkers);
  await progress(0.62, 'PARKING THE CARS…');
  const audio = createAudio();
  const fx = createFx(scene);
  const vehicles = createVehicles(scene, L, fx, audio);
  await progress(0.76, 'LACING UP THE SKATES…');
  const player = createPlayer(scene, L);
  const cam = createFollowCamera(camera, L.solids);
  const env = createEnvironment(scene, sky, ocean, city, camera, audio);
  const input = createInput(canvas);
  const hud = createHud(L, groundCanvas, renderer);
  const R = makeRoads();
  const signals = buildSignals(scene, R, city.bodyMat, L.props);
  L.props.build();
  const grid = createGrid(14);

  const game = {
    mode: 'foot', vehicle: null, started: false,
    input, hud, audio, env, vehicles, player, L, cam, camera, renderer, scene, fx, R, grid, wanted: 0, busy: null,
    focus: () => (game.vehicle ? game.vehicle : player.pos),
    heading: () => (game.vehicle ? game.vehicle.yaw : player.yaw),
  };
  await progress(0.84, 'FILLING THE STREETS…');
  const traffic = game.traffic = createTraffic(R, vehicles, grid, game);
  const peds = game.peds = createPeds(scene, R, grid, game);
  const animals = game.animals = createAnimals(scene, game);
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
  const places = game.places = createPlaces(game, scene, camera);
  const story = game.story = createStory(game, scene);
  const act = game.act = createActivity(game);
  // indoors the camera renders layer 1 only: the room, the courier, the rings and the lights
  scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
  player.model.root.traverse((o) => o.layers.enable(1)); player.shadow.layers.enable(1);
  const cheats = createCheats(game);
  game.cheats = cheats;
  const me = { x: 0, z: 0, isPed: true, isPlayer: true };
  window.__neon = game;                       // handy for poking around in devtools
  // debug helpers (devtools / automated checks): __neon.debug.warp('club'), .skip(), .bike()
  game.debug = {
    warp: (key) => places.warp(key),
    skip: () => cut.skip(),
    bike: () => { const b = vehicles.cars.find((c) => c.kind === 'bike' && !c.ai); player.pos.set(b.x + 1.6, 0, b.z); return b; },
    to: (x, z) => { if (game.vehicle) { game.vehicle.x = x; game.vehicle.z = z; } else player.pos.set(x, player.floor, z); },
    // set the clock (hours, e.g. 3 or 8.5); the traffic and the crowd follow it over the next seconds
    time: (h) => { env.tod = ((h % 24) + 24) % 24; env.target = null; return env.tod; },
    counts: () => ({ cars: traffic.count(), carTarget: traffic.target, peds: peds.active, pedTarget: peds.target, animals: animals.count(), ...animals.stats, dog: { ...animals.dog } }),
    interact: () => interact(),
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
  };
  game.signalAt = (n, h) => signal(n, h, timeU.value);

  function interact() {
    const v = game.vehicle;
    if (game.busy) return;
    if (act.mode) { act.toggle(); return; }
    if (game.inside) { places.use(); return; }
    if (v) {
      if (v.kind === 'heli' && v.y > 0.6) { hud.toast('LAND FIRST', 'HOLD C TO DESCEND'); return; }
      const dry = onIsland(v.x, v.z) || (v.x > PIER.x0 - 1 && v.x < PIER.x1 + 1 && v.z < PIER.z1 + 1) || (v.x > CAUSEWAY.x0 && v.x < -HX && v.z > CAUSEWAY.z0 && v.z < CAUSEWAY.z1);
      if (v.kind === 'heli' && !dry) { hud.toast('NOWHERE TO STAND', 'FLY BACK OVER LAND FIRST'); return; }
      v.driven = false;
      const side = v.radius + 1.1;
      player.pos.set(v.x + Math.cos(v.yaw) * side, 0, v.z - Math.sin(v.yaw) * side);
      for (let i = 0; i < 2; i++) for (const b of L.solids) pushOut(player.pos, 0.6, b);
      clampToWorld(player.pos, 0.6);
      player.vel.set(0, 0, 0); player.vy = 0; player.yaw = v.yaw;
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

  input.onKey = (e) => {
    if (game.busy === 'cut') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') cut.next();
      else if (e.code === 'KeyX' || e.code === 'Escape') cut.skip();
      return;
    }
    if (game.busy === 'shop') { places.key(e); return; }
    if (game.busy === 'fail') { story.key(e); return; }
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
      case 'KeyM': hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON'); break;
      case 'KeyP': hud.togglePerf(); break;
      case 'KeyV': hud.toast('CAMERA', cam.cycleView().name); break;
    }
  };

  await progress(0.92, 'SWITCHING ON THE NEON…');
  const ctl = { move: 0, strafe: 0, sprint: false, jump: false, throttle: 0, steer: 0, hand: false, up: false, down: false };
  const sound = { engine: 0, engineRev: 0, heavy: false, skate: 0, rotor: 0, rain: 0, siren: 0, duck: false, room: 0 };
  let last = performance.now(), raf = 0, frameN = 0, turnT = 0;

  const hudState = { env, game, vehicles, counts: [0, peds.count], blips: [], focus: null, heading: 0, camYaw: 0, inVehicle: null };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const raw = Math.min(Math.max((now - last) / 1000, 0), 0.5), dt = Math.min(raw, 0.05);
    last = now;
    timeU.value += dt;
    // the shared music clock: free-runs on real time, pulled onto the synth's own position when there is sound
    {
      beatU.value += raw / BEAT_LEN;
      const ab = audio.beatNow();
      if (ab !== null) { const d = ab - beatU.value; if (Math.abs(d) > 0.5) beatU.value = ab; else beatU.value += d * Math.min(1, raw * 4); }
      beatU.t = now / 1000;
    }

    const live = game.started && !cheats.open && !game.busy;
    frameN++;
    ctl.move = live ? input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) : 0;
    ctl.strafe = live ? input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) : 0;
    ctl.sprint = live && input.isDown('ShiftLeft', 'ShiftRight');
    ctl.jump = live && game.mode === 'foot' && input.isDown('Space');
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

    if (game.mode === 'bike' && game.vehicle) { /* posed after the bike has moved */ }
    else if (!game.busy && !game.inside && act.mode && !game.vehicle) act.update(dt, ctl, input);
    else if (!game.busy && !game.inside) player.update(dt, ctl, cam.yaw, vehicles, audio);
    signals.update(timeU.value);
    traffic.update(dt, timeU.value);
    vehicles.update(dt, ctl, cam, player);
    if (game.mode === 'bike' && game.vehicle) player.ride(game.vehicle);
    peds.update(dt, timeU.value, frameN, vehicles.cars);
    animals.update(dt);
    if (game.started) { rules.update(dt); story.update(dt); places.update(dt, ctl); }
    city.tick(timeU.value);
    fx.update(dt);

    const v = game.vehicle;
    const speed = v ? (v.kind === 'tank' ? v.speed : Math.hypot(v.vx, v.vz)) : player.speed;
    if (!game.started && !reducedMotion) cam.yaw += dt * 0.04;
    if (cut.active) cut.update(dt);
    else if (game.inside) { /* places.update owns the camera indoors */ }
    else cam.update(dt, input, game.mode, game.focus(), game.heading(), speed, fx, player.phase);
    // in first person on foot the courier's own body would sit inside the camera
    cockpit.update(dt, v, cam.first && !cut.active && !game.inside && !!v, ctl.steer);
    const hideBody = cam.first && !cut.active && !game.inside && game.mode === 'foot';
    if (player.model.root.visible === hideBody && !player.hidden) player.model.root.visible = !hideBody;
    pointScaleU.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    env.update(dt);
    horizon.update(env);
    // out at sea in the helicopter: a soft boundary with a fuel warning instead of a wall
    if (v && v.kind === 'heli' && v.turnBack && game.started && !game.busy) {
      turnT -= dt;
      if (turnT <= 0) { hud.toast('TURNING BACK: LOW FUEL', 'HEAD FOR THE ISLAND'); turnT = 3.5; }
    } else turnT = 0;

    // context hints
    if (game.started) {
      if (game.busy === 'shop') hud.setHint(places.hint());
      else if (game.busy) hud.setHint(game.busy === 'cut' ? [['Space / Enter', 'next line'], ['X', 'skip scene']] : game.busy === 'fail' ? [['Enter', 'retry from checkpoint'], ['Esc', 'walk away']] : []);
      else if (game.inside) hud.setHint(places.hint());
      else if (!v && act.mode) hud.setHint(act.hint());
      else if (!v) {
        const n = vehicles.nearest(player.pos), f = act.fHint();
        hud.setHint(n ? [['E', n.ai ? `take the ${n.label} (heat!)` : n.kind === 'bike' ? 'ride the Comet' : `enter ${n.label}`], ...(f ? [f] : []), ['V', 'camera view'], ['~ / T', 'cheat console']]
          : [...(f ? [f] : []), ['WASD', 'skate'], ['Shift', 'sprint'], ['Space', 'jump'], ['Drag', 'look'], ['V', 'camera view'], ['~ / T', 'cheat console']]);
      } else if (v.kind === 'car') hud.setHint([['E', 'exit car'], ['WASD', 'drive'], ['Space', 'handbrake'], ['V', 'camera view']]);
      else if (v.kind === 'bike') hud.setHint([['E', 'get off'], ['W', 'throttle (wheelie from low speed)'], ['A D', 'lean'], ['S', 'brake'], ['V', 'camera view']]);
      else if (v.kind === 'tank') hud.setHint([['E', 'exit tank'], ['WASD', 'drive'], ['Drag', 'aim turret'], ['Click / F', 'fire'], ['V', 'camera view']]);
      else hud.setHint([['W S', 'forward / back'], ['A D', 'yaw'], ['Space', 'up'], ['C / Ctrl', 'down'], ['E', v.y > 0.6 ? 'land to exit' : 'exit helicopter'], ['V', 'camera view']]);
      hudState.focus = game.focus(); hudState.heading = game.heading(); hudState.camYaw = cam.yaw; hudState.inVehicle = v;
      hudState.counts[0] = traffic.count(); hudState.counts[1] = peds.active; hudState.blips = rules.blips;
      hudState.counts[2] = traffic.target; hudState.counts[3] = peds.target; hudState.counts[4] = animals.count();
      hud.update(dt, hudState);
    }

    sound.engine = v && v.kind !== 'heli' ? 1 : 0;
    sound.heavy = !!v && v.kind === 'tank';
    sound.engineRev = v ? Math.min(Math.abs(speed) / (v.kind === 'tank' ? 13 : v.kind === 'bike' ? 40 : 44), 1) * (v.kind === 'bike' ? 1.5 : 1) : 0;
    sound.skate = !v && player.onGround && !cut.active && !act.mode ? Math.min(player.speed / 13.5, 1) : 0;
    sound.rotor = vehicles.heli ? vehicles.heli.spool * (v === vehicles.heli ? 1 : 0.35) : 0;
    sound.rain = env.rainAmt; sound.siren = game.siren || 0; sound.duck = cut.active;
    sound.room = !game.inside ? 0 : game.inside.key === 'club' ? 2 : 1;
    audio.update(sound);

    renderer.render(scene, camera);
    input.endFrame();
  }

  // compile shaders + draw one frame behind the title card before declaring ready
  env.update(0);
  horizon.update(env);
  cam.update(0.016, input, 'foot', player.pos, player.yaw, 0, fx, 0);
  renderer.compile(scene, camera);
  await progress(1, 'READY');
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; audio.suspend(); input.clearKeys(); }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); if (game.started) audio.resume(); }
  });

  const title = $('title'), go = $('go');
  $('bar').hidden = true; $('status').hidden = true; go.hidden = false; $('keys').hidden = false;
  const start = () => {
    if (game.started) return;
    game.started = true;
    audio.start();
    cam.yaw = Math.PI / 2; cam.pitch = 0.2;
    cheats.parkHeli();
    title.classList.add('out');
    setTimeout(() => { title.hidden = true; }, 700);
    hud.show();
    hud.toast('HELICOPTER PARKED NEARBY', 'WALK UP AND PRESS E · CODES: PRESS T');
    input.enabled = true;
    go.blur();
  };
  title.addEventListener('click', start);
  go.focus({ preventScroll: true });
}

boot().catch((err) => {
  console.error(err);
  $('status').textContent = 'SOMETHING WENT WRONG — SEE THE CONSOLE';
});
