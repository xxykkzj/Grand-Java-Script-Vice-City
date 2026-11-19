// Up on the roofs: the stair doors (F takes you down to the street door below, with a quick fade), and
// what a fall off the edge does to you. Roof shapes and doors live in world/surfaces.js.
import { reducedMotion } from '../core/util.js';

const $ = (id) => document.getElementById(id);

export function createRooftops(game) {
  const { player, L, hud, audio, cam } = game;
  const stats = { stairs: 0, falls: 0, worst: 0 };
  let t = 0, door = null;
  const api = {
    stats,
    // a roof door within reach (you have to be up on that roof)
    near() { return !game.vehicle && !game.inside && player.onGround && player.pos.y > 2 ? L.surf.doorNear(player.pos.x, player.pos.y, player.pos.z) : null; },
    down(d = api.near()) {
      if (!d || game.busy) return false;
      door = d; t = 0; game.busy = 'stairs';
      $('fade').classList.add('on');
      audio.thud(0.2);
      return true;
    },
    update(dt) {
      if (!door) return;
      t += dt;
      if (t > (reducedMotion ? 0.15 : 0.45) && door.t !== 1) {
        const o = door.out;
        player.pos.set(o.x, 0, o.z); player.vel.set(0, 0, 0); player.vy = 0; player.yaw = o.yaw; player.onGround = true; player.fallFrom = 0;
        cam.yaw = o.yaw; cam.pitch = 0.18; cam.snap(player.pos);
        door.t = 1;
      }
      if (t > (reducedMotion ? 0.3 : 0.8)) {
        door.t = 0; door = null; game.busy = null; stats.stairs++;
        $('fade').classList.remove('on');
        hud.toast('DOWN THE STAIRS', 'OUT ON THE STREET');
      }
    },
    // the courier landed at `v` m/s after a drop of about `drop` m (player.js)
    fall(v, drop) {
      stats.falls++; stats.worst = Math.max(stats.worst, drop);
      if (v > 25) { hud.toast('THAT WAS A LONG WAY DOWN', ''); game.rules.hurt(999); return 'ko'; }
      const dmg = Math.round((v - 13.6) * 5);
      game.rules.hurt(dmg);
      player.stagger = Math.max(player.stagger || 0, 0.5);
      audio.thud(0.6);
      if (dmg >= 15) hud.toast('OUCH', 'MIND THE DROP');
      return dmg;
    },
  };
  player.onFall = (v, drop) => api.fall(v, drop);
  return api;
}
