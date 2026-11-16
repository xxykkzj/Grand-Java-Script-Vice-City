// Neon Coast: boot, world generation with a loading bar, and the main loop.
import * as THREE from 'three';
import { timeU, pointScaleU, pushOut, pause, reducedMotion } from './core/util.js';
import { createInput } from './core/input.js';
import { makeLayout, clampToWorld } from './world/layout.js';
import { createSky, createOcean } from './world/sky.js';
import { buildGround, buildCity } from './world/city.js';
import { createEnvironment } from './world/environment.js';
import { createFx } from './vehicles/effects.js';
import { createVehicles } from './vehicles/vehicles.js';
import { createPlayer } from './player/player.js';
import { createFollowCamera } from './player/camera.js';
import { createAudio } from './audio/audio.js';
import { createHud } from './ui/hud.js';
import { createCheats } from './cheats/cheats.js';

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
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1500);
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

  const game = {
    mode: 'foot', vehicle: null, started: false,
    input, hud, audio, env, vehicles, player, L, cam, renderer, scene,
    focus: () => (game.vehicle ? game.vehicle : player.pos),
    heading: () => (game.vehicle ? game.vehicle.yaw : player.yaw),
  };
  const cheats = createCheats(game);
  game.cheats = cheats;
  window.__neon = game;                       // handy for poking around in devtools

  function interact() {
    const v = game.vehicle;
    if (v) {
      if (v.kind === 'heli' && v.y > 0.6) { hud.toast('LAND FIRST', 'HOLD C TO DESCEND'); return; }
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
      if (!n) return;
      n.driven = true; game.vehicle = n; game.mode = n.kind;
      player.setHidden(true);
      audio.thud(0.3);
    }
  }
  const fire = () => { if (game.mode === 'tank') vehicles.fire(); };

  input.onKey = (e) => {
    switch (e.code) {
      case 'Backquote': case 'KeyT': e.preventDefault(); cheats.toggle(true); break;
      case 'KeyE': interact(); break;
      case 'KeyF': fire(); break;
      case 'KeyN': env.cycle(); hud.toast('TIME SKIP', 'FAST-FORWARDING THE CLOCK'); break;
      case 'KeyM': hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON'); break;
      case 'KeyP': hud.togglePerf(); break;
    }
  };

  await progress(0.92, 'SWITCHING ON THE NEON…');
  const ctl = { move: 0, strafe: 0, sprint: false, jump: false, throttle: 0, steer: 0, hand: false, up: false, down: false };
  const sound = { engine: 0, engineRev: 0, heavy: false, skate: 0, rotor: 0, rain: 0 };
  let last = performance.now(), raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    timeU.value += dt;

    const live = game.started && !cheats.open;
    ctl.move = live ? input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) : 0;
    ctl.strafe = live ? input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) : 0;
    ctl.sprint = live && input.isDown('ShiftLeft', 'ShiftRight');
    ctl.jump = live && game.mode === 'foot' && input.isDown('Space');
    ctl.throttle = ctl.move; ctl.steer = -ctl.strafe;
    ctl.hand = live && game.mode === 'car' && input.isDown('Space');
    ctl.up = live && input.isDown('Space');
    ctl.down = live && input.isDown('KeyC', 'ControlLeft', 'ControlRight');
    if (live && input.clicked) fire();

    player.update(dt, ctl, cam.yaw, vehicles, audio);
    vehicles.update(dt, ctl, cam, player);
    fx.update(dt);

    const v = game.vehicle;
    const speed = v ? (v.kind === 'tank' ? v.speed : Math.hypot(v.vx, v.vz)) : player.speed;
    if (!game.started && !reducedMotion) cam.yaw += dt * 0.04;
    cam.update(dt, input, game.mode, game.focus(), game.heading(), speed, fx, player.phase);
    pointScaleU.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    env.update(dt);

    // context hints
    if (game.started) {
      if (!v) {
        const n = vehicles.nearest(player.pos);
        hud.setHint(n ? [['E', `enter ${n.label}`], ['~ / T', 'cheat console']]
          : [['WASD', 'skate'], ['Shift', 'sprint'], ['Space', 'jump'], ['Drag', 'look'], ['~ / T', 'cheat console']]);
      } else if (v.kind === 'car') hud.setHint([['E', 'exit car'], ['WASD', 'drive'], ['Space', 'handbrake']]);
      else if (v.kind === 'tank') hud.setHint([['E', 'exit tank'], ['WASD', 'drive'], ['Drag', 'aim turret'], ['Click / F', 'fire']]);
      else hud.setHint([['W S', 'forward / back'], ['A D', 'yaw'], ['Space', 'up'], ['C / Ctrl', 'down'], ['E', v.y > 0.6 ? 'land to exit' : 'exit helicopter']]);
      hud.update(dt, env, game.focus(), game.heading(), vehicles, v);
    }

    sound.engine = v && v.kind !== 'heli' ? 1 : 0;
    sound.heavy = !!v && v.kind === 'tank';
    sound.engineRev = v ? Math.min(Math.abs(speed) / (v.kind === 'tank' ? 13 : 44), 1) : 0;
    sound.skate = !v && player.onGround ? Math.min(player.speed / 13.5, 1) : 0;
    sound.rotor = vehicles.heli ? vehicles.heli.spool * (v === vehicles.heli ? 1 : 0.35) : 0;
    sound.rain = env.stormAmt;
    audio.update(sound);

    renderer.render(scene, camera);
    input.endFrame();
  }

  // compile shaders + draw one frame behind the title card before declaring ready
  env.update(0);
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
    title.classList.add('out');
    setTimeout(() => { title.hidden = true; }, 700);
    hud.show();
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
