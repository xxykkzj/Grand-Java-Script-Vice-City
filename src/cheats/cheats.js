// Retro cheat console. All codes are original to Neon Coast.
import { pushOut } from '../core/util.js';
import { clampToWorld } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

export const CODES = {
  HEAVYMETAL: 'Spawn the Disco Tank (click / F to fire)',
  ROTORWASH: 'Spawn a helicopter (E to board)',
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
  HELP: 'List codes',
};

export function createCheats(game) {
  const { input, hud, audio, env, vehicles, player, L } = game;
  const box = $('console'), form = $('cform'), cmd = $('cmd'), log = $('log');
  const lines = [];
  const print = (text, err = false) => {
    lines.push({ text, err });
    while (lines.length > 9) lines.shift();
    log.textContent = '';
    for (const l of lines) { const d = document.createElement('div'); d.textContent = l.text; if (l.err) d.className = 'err'; log.appendChild(d); }
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
  };

  const api = {
    open: false,
    toggle(on = !api.open) {
      api.open = on; box.hidden = !on; input.typing = on;
      if (on) { input.clearKeys(); cmd.value = ''; setTimeout(() => cmd.focus(), 0); if (!lines.length) print('NEON-DOS 1.986 READY. Type HELP for codes.'); }
      else cmd.blur();
    },
    exec(raw) {
      const code = String(raw).trim().toUpperCase();
      if (!code) return false;
      if (code === 'HELP') {
        print('> HELP');
        for (const [k, v] of Object.entries(CODES)) print(`  ${k.padEnd(11)} ${v}`);
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
