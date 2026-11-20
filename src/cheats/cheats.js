// Retro cheat console. All codes are original to Neon Coast.
import { pushOut } from '../core/util.js';
import { clampToWorld } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

export const CODES = {
  HEAVYMETAL: 'Spawn the Disco Tank (click / F to fire)',
  ROTORWASH: 'Spawn a helicopter (E to board)',
  TWOWHEELS: 'Bring a Comet sport bike to you',
  NIGHTSHIFT: 'Toggle night',
  STORMFRONT: 'Toggle a thunderstorm',
  CLEARSKIES: 'Clear weather',
  GREYSKIES: 'Overcast',
  DRIZZLE: 'Steady rain, wet roads',
  PEASOUP: 'Thick fog',
  LOWPROFILE: 'Lose the heat',
  TIPJAR: '+$500',
  MOONBOOTS: 'Toggle low gravity',
  NEONRIDE: 'Paint every car hot pink and make it glow',
  PITSTOP: 'Fix the vehicle you are in (or the nearest one)',
  SPARKCRATE: 'Every neon blaster and firework, fully loaded',
  HIGHTIDE: 'Drop into the sea off the beach (swim: C dives, Space rises)',
  FINSUP: 'Call a shark (it keeps attacking in deep water: swim for the beach, a pier ladder or shallows)',
  REWIND: 'Forget the saved story, outfits, blasters, the motel save, the vest and the arcade best',
  HELP: 'List codes',
};

export function createCheats(game) {
  const { input, hud, audio, env, vehicles, player, L } = game;
  const box = $('console'), form = $('cform'), cmd = $('cmd'), log = $('log');
  const lines = [];
  const print = (text, err = false) => {
    lines.push({ text, err });
    while (lines.length > 150) lines.shift();
    log.textContent = '';
    for (const l of lines) { const d = document.createElement('div'); d.textContent = l.text; if (l.err) d.className = 'err'; log.appendChild(d); }
    log.scrollTop = log.scrollHeight;
  };

  // a free spot `dist` ahead of whatever the player is controlling
  function spotAhead(dist, side, radius) {
    const f = game.focus(), yaw = game.heading();
    const p = { x: f.x + Math.sin(yaw) * dist - Math.cos(yaw) * side, z: f.z + Math.cos(yaw) * dist + Math.sin(yaw) * side };
    for (let i = 0; i < 3; i++) for (const b of L.solids) pushOut(p, radius + 0.5, b);
    clampToWorld(p, radius + 0.5);
    return { ...p, yaw };
  }

  const run = {
    HEAVYMETAL() { const s = spotAhead(10, 0, 3); vehicles.spawnTank(s.x, s.z, s.yaw); return 'DISCO TANK DELIVERED'; },
    ROTORWASH() { const s = spotAhead(11, vehicles.tank ? 9 : 0, 3); vehicles.spawnHeli(s.x, s.z, s.yaw); return 'CHOPPER ON THE DECK'; },
    TWOWHEELS() {
      const b = vehicles.cars.find((c) => c.kind === 'bike' && !c.ai && !c.driven), s = spotAhead(4, 0, 1);
      if (!b) return 'NO COMET TO SPARE';
      Object.assign(b, { x: s.x, z: s.z, yaw: s.yaw, y: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
      return 'ONE COMET, KEYS IN';
    },
    REWIND() {
      Object.assign(game.save, { outfit: 'classic', owned: [], story: 0, gift: {}, arms: {}, armsIntro: 0, vest: 0, motel: null, arcade: 0 });
      if (game.combat) game.combat.reset();
      game.persist();
      player.model.setOutfit({ jacket: '#12b5a6', trim: '#e6258f', light: '#f7f5ef', bag: '#f2b63a' });
      return 'TAPE REWOUND: STORY, WARDROBE AND BLASTERS RESET';
    },
    HIGHTIDE() {
      if (game.vehicle) game.rules.leaveVehicle();
      const x = Math.max(-240, Math.min(240, player.pos.x));
      player.pos.set(x, 0, 150 + 32); player.vel.set(0, 0, 3); player.yaw = 0; player.vy = 0;
      game.cam.yaw = 0; game.cam.pitch = 0.3;
      return 'SPLASH. MIND THE CURRENT PAST THE REEF';
    },
    FINSUP() { return game.marine.spawnShark() ? 'SOMETHING IS CIRCLING...' : 'THE WATER HERE IS TOO SHALLOW FOR A SHARK'; },
    NIGHTSHIFT() { return env.toggleNight() ? 'LIGHTS OUT, NEON ON' : 'BACK TO GOLDEN HOUR'; },
    STORMFRONT() { const on = env.weather !== 'storm'; env.setWeather(on ? 'storm' : 'clear'); return on ? 'HERE COMES THE RAIN' : 'SKIES CLEARING'; },
    CLEARSKIES() { env.setWeather('clear'); return 'NOT A CLOUD IN SIGHT'; },
    GREYSKIES() { env.setWeather('cloudy'); return 'CLOUDS ROLLING IN'; },
    DRIZZLE() { env.setWeather('rain'); return 'SLICK STREETS AHEAD'; },
    PEASOUP() { env.setWeather('fog'); return 'CAN\'T SEE THE PIER FROM HERE'; },
    LOWPROFILE() { game.wanted = 0; return 'COAST PATROL FORGOT YOUR FACE'; },
    TIPJAR() { game.money += 500; return 'KEEP THE CHANGE'; },
    MOONBOOTS() { player.lowGravity = !player.lowGravity; return player.lowGravity ? 'LOW GRAVITY ON' : 'GRAVITY RESTORED'; },
    NEONRIDE() { vehicles.setNeon(!vehicles.neon); return vehicles.neon ? 'EVERY RIDE HOT PINK' : 'FACTORY PAINT RESTORED'; },
    SPARKCRATE() { game.combat.giveAll(); return 'ZIZI SENDS HER REGARDS: 1-5 OR Q TO PICK'; },
    PITSTOP() {
      let v = game.vehicle;
      if (!v) { let bd = 7; for (const o of vehicles.all()) { const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z); if (d < bd) { bd = d; v = o; } } }
      if (!v) return 'NOTHING TO FIX AROUND HERE';
      game.damage.repair(v);
      return v.kind === 'heli' ? 'ROTORS BALANCED, GOOD AS NEW' : 'PANEL-BEATEN AND GOOD AS NEW';
    },
  };

  const api = {
    // a helicopter waits near the start so the city can be explored from the air without a code
    parkHeli() { const s = spotAhead(14, 8, 3); vehicles.spawnHeli(s.x, s.z, s.yaw); },
    open: false,
    toggle(on = !api.open) {
      api.open = on; box.hidden = !on; input.typing = on;
      if (on) { input.clearKeys(); cmd.value = ''; if (!input.touchMode) setTimeout(() => cmd.focus(), 0); if (!lines.length) print('NEON-DOS 1.986 READY. Type HELP for codes.'); }
      else cmd.blur();
    },
    exec(raw) {
      const code = String(raw).trim().toUpperCase();
      if (!code) return false;
      if (code === 'HELP') {
        lines.length = 0;                                   // start the list at the top so every code shows
        print('> HELP  (' + Object.keys(CODES).length + ' codes, scroll for more)');
        for (const [k, v] of Object.entries(CODES)) print(`  ${k.padEnd(11)} ${v}`);
        log.scrollTop = 0;
        audio.blip(true);
        return true;
      }
      if (run[code]) {
        const msg = run[code]();
        print(`> ${code}  ..OK  ${msg}`);
        hud.toast(`CHEAT ACTIVATED: ${code}`, msg);
        audio.blip(true);
        return true;
      }
      print(`> ${code}  ..UNKNOWN CODE (try HELP)`, true);
      audio.blip(false);
      return false;
    },
  };

  // tappable list of codes (shown in touch mode, works with a mouse too) and a close button
  const codes = $('codes');
  for (const k of Object.keys(CODES)) {
    if (k === 'HELP') continue;
    const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.title = CODES[k];
    b.addEventListener('click', () => { if (api.exec(k)) api.toggle(false); });
    codes.appendChild(b);
  }
  $('cclose').addEventListener('click', () => api.toggle(false));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = api.exec(cmd.value);
    const wasHelp = cmd.value.trim().toUpperCase() === 'HELP';
    cmd.value = '';
    if (ok && !wasHelp) api.toggle(false);
  });
  cmd.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); api.toggle(false); }
    e.stopPropagation();
  });
  return api;
}
