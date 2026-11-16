// The cutscene director: a tiny sequencer of "beats" (camera moves, dialogue lines) with a
// letterbox, coloured speaker names, typewriter subtitles and a shot grammar for conversations:
// wide establishing shots, over-the-shoulder, close-ups and side-on two-shots. Speakers turn to
// face whoever they are talking to and gesture while they talk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, damp, angleDelta, timeU, PI, reducedMotion } from '../core/util.js';
import { CAST } from './story.js';
import { OY } from './interiors.js';

const $ = (id) => document.getElementById(id);
export const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const CPS = 42;                                  // typewriter speed, characters per second

export function createDirector(camera, game) {
  const { player, audio } = game;
  const cine = $('cine'), sub = $('sub'), fade = $('fade');
  const who = document.createElement('b'), typed = document.createElement('span'), rest = document.createElement('span');
  rest.className = 'rest';
  const look = new THREE.Vector3(), pos = new THREE.Vector3();
  let beats = [], bi = -1, bt = 0, done = null, ending = false, savedFov = 62, fov = 40;

  const setFov = (f) => { if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); } };
  const say = (line) => {
    sub.textContent = '';
    if (!line) return;
    const c = CAST[line[0]] || { name: line[0], color: '#fff' };
    who.textContent = c.name; who.style.color = c.color;
    typed.textContent = reducedMotion ? line[1] : ''; rest.textContent = reducedMotion ? '' : line[1];
    sub.append(who, typed, rest);
  };

  // ---- conversation staging
  // talk(room, lines) -> beats. Actors: the courier at room.me plus the room's cast.
  function talkBeats(room, lines) {
    const O = { x: room.ox, z: room.oz };
    const me = { key: 'SKYE', x: room.me[0], y: 0, z: room.me[1], yaw: PI, isMe: true };
    const actor = (k) => (k === 'SKYE' ? me : room.npc[k]);
    const firstNpc = (lines.find((l) => l[0] !== 'SKYE') || [])[0];
    let lastNpc = actor(firstNpc) || me;
    me.yaw = Math.atan2(lastNpc.x - me.x, lastNpc.z - me.z);
    const pose = (a, yaw, dt) => {
      a.yaw += angleDelta(a.yaw, yaw) * (dt ? 1 - Math.exp(-7 * dt) : 1);
      if (a.isMe) { player.pos.set(O.x + a.x, OY, O.z + a.z); player.yaw = a.yaw; player.speed = 0; } else a.g.rotation.y = a.yaw;
    };
    const parts = (a) => (a.isMe ? player.model : a);
    const gesture = (a, act, t, on) => {
      const m = parts(a), R = m.armR.rotation, Lr = m.armL.rotation, H = m.head.rotation, w = reducedMotion ? 0 : 1;
      if (!on) return;
      if (act === 'point') R.set(-1.4 + Math.sin(t * 3) * 0.05 * w, 0, 0.1);
      else if (act === 'shrug') { R.set(-0.5, 0, -0.75 - Math.sin(t * 4) * 0.08 * w); Lr.set(-0.5, 0, 0.75 + Math.sin(t * 4) * 0.08 * w); H.z = 0.12; }
      else if (act === 'wave') R.set(0, 0, -2.6 + Math.sin(t * 10) * 0.35 * w);
      else if (act === 'nod') { H.x = Math.sin(t * 8) * 0.2 * Math.max(0, 1 - t * 0.6); R.set(-0.3, 0, 0); }
      else if (act === 'think') { R.set(-2.2, 0, 0.35); H.z = 0.14; H.x = 0.06; }
      else { R.set(-0.75 + Math.sin(t * 7) * 0.22 * w, 0, 0.05 + Math.sin(t * 3.1) * 0.1 * w); H.x = Math.sin(t * 9) * 0.035 * w; }
    };
    const lim = (v, m) => clamp(v, -m, m);
    return lines.map((line) => {
      const S = actor(line[0]) || me;
      const Lr = S.isMe ? lastNpc : me;
      if (!S.isMe) lastNpc = S;
      const kind = line[2] || 'ots', act = line[3] || 'talk', side = S.isMe ? -1 : 1;
      const dur = Math.max(2.4, line[1].length / CPS + 1.5 + line[1].length * 0.022) * (reducedMotion ? 1.15 : 1);
      let n = 0;
      return {
        dur, line,
        start() { say(line); n = 0; },
        full() { return n >= line[1].length; },
        reveal() { n = line[1].length; typed.textContent = line[1]; rest.textContent = ''; },
        tick(k, dt, t) {
          if (!reducedMotion && n < line[1].length) {
            const m = Math.min(line[1].length, Math.floor(t * CPS));
            if (m !== n) { if (Math.floor(m / 3) !== Math.floor(n / 3) && line[1][m - 1] !== ' ') audio.talk((CAST[line[0]] || {}).voice || 1); n = m; typed.textContent = line[1].slice(0, n); rest.textContent = line[1].slice(n); }
          }
          room.idle(timeU.value, dt, reducedMotion);
          const dx = Lr.x - S.x, dz = Lr.z - S.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, px = uz * side, pz = -ux * side;
          pose(S, Math.atan2(dx, dz), dt); pose(Lr, Math.atan2(-dx, -dz), dt);
          for (const key in room.npc) { const o = room.npc[key]; if (o !== S && o !== Lr) pose(o, o.home, dt); }
          player.animate(dt, 0, null);
          const talking = reducedMotion || n < line[1].length || act !== 'talk';
          gesture(S, act, t, talking);
          const sy = S.y + 1.56, ly = Lr.y + 1.56, push = reducedMotion ? 0 : k;
          if (kind === 'wide') { const w = room.wide; pos.set(w[0], w[1], w[2]); look.set(lerp(w[3], S.x, 0.5), w[4], lerp(w[5], S.z, 0.5)); pos.lerp(look, push * 0.07); fov = 46; }
          else if (kind === 'cu') { pos.set(S.x + ux * 1.45 + px * 0.34, sy + 0.04, S.z + uz * 1.45 + pz * 0.34); look.set(S.x, sy + 0.04, S.z); pos.lerp(look, push * 0.1); fov = 30; }
          else if (kind === 'two') { const mx = (S.x + Lr.x) / 2, mz = (S.z + Lr.z) / 2; pos.set(mx + px * (2.6 + d * 0.5), (sy + ly) / 2 - 0.15, mz + pz * (2.6 + d * 0.5)); look.set(mx, (sy + ly) / 2 - 0.2, mz); pos.x += ux * push * 0.25; pos.z += uz * push * 0.25; fov = 40; }
          else { pos.set(Lr.x + ux * 0.95 + px * 0.55, ly + 0.2, Lr.z + uz * 0.95 + pz * 0.55); look.set(S.x - px * 0.25, sy - 0.05, S.z - pz * 0.25); pos.lerp(look, push * 0.06); fov = 36; }
          pos.x = lim(pos.x, room.hx - 0.45); pos.z = lim(pos.z, room.hz - 0.45); pos.y = Math.min(pos.y, room.h - 0.35);
          camera.position.set(O.x + pos.x, OY + pos.y, O.z + pos.z);
          setFov(fov);
          camera.lookAt(O.x + look.x, OY + look.y, O.z + look.z);
        },
        end() { for (const a of [S, Lr]) { const m = parts(a); m.head.rotation.set(0, 0, 0); if (!a.isMe) { m.armR.rotation.set(0, 0, 0); m.armL.rotation.set(0, 0, 0); } } },
      };
    });
  }

  function finish() {
    for (; bi < beats.length; bi++) { const b = beats[bi]; if (b && b.end) b.end(); const nx = beats[bi + 1]; if (nx && nx.start) nx.start(); }
    cine.classList.remove('on'); $('hud').classList.remove('cine'); say(null);
    setFov(savedFov);
    cut.active = false; ending = false; game.busy = null;
    const d = done; done = null; beats = [];
    if (d) d();
  }

  const cut = {
    active: false, talkBeats,
    // run a list of beats: { dur, start?(), tick?(k, dt, t), end?() }. `outFade` blacks out before onDone.
    run(list, onDone, outFade = true) {
      cut.active = true; game.busy = 'cut'; beats = list; bi = 0; bt = 0; done = onDone; ending = false; cut.outFade = outFade;
      savedFov = 62;
      cine.classList.add('on'); $('hud').classList.add('cine');
      player.vel.set(0, 0, 0);
      if (beats[0].start) beats[0].start();
    },
    // Space / Enter: finish typing the line, or move on to the next beat
    next() {
      if (!cut.active || ending) return;
      const b = beats[bi];
      if (b.line && !b.full()) { b.reveal(); return; }
      bt = b.dur;
    },
    // X / Esc: leave the scene now (every remaining state change still happens)
    skip() { if (cut.active && !ending) cut.close(); },
    close() {
      ending = true;
      if (!cut.outFade) { finish(); return; }
      fade.classList.add('on');
      setTimeout(() => { finish(); setTimeout(() => fade.classList.remove('on'), 60); }, 330);
    },
    update(dt) {
      if (ending || !cut.active) return;
      const b = beats[bi];
      bt += dt;
      if (b.tick) b.tick(b.dur > 0 ? clamp(bt / b.dur, 0, 1) : 1, dt, bt);
      if (bt >= b.dur) {
        if (bi >= beats.length - 1) { cut.close(); return; }
        if (b.end) b.end();
        bi++; bt = 0;
        if (beats[bi].start) beats[bi].start();
      }
    },
    fade(on) { fade.classList.toggle('on', on); },
    setFov,
  };
  return cut;
}

// Pulsing marker: a tall see-through column of light standing on a bright ground ring.
export function makeMarker(scene, hex, radius = 1.5, height = 9) {
  const col = new THREE.CylinderGeometry(radius, radius, height, 28, 1, true);
  col.translate(0, height / 2, 0);
  const ring = new THREE.RingGeometry(radius, radius * 1.4, 28);
  ring.rotateX(-PI / 2); ring.translate(0, 0.07, 0);
  const uv = ring.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0, -1);
  const m = new THREE.Mesh(mergeGeometries([col, ring]), new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uCol: { value: new THREE.Color(hex) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      void main(){
        float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
        float a = vUv.y < 0.0 ? 0.9 * pulse : pow(1.0 - vUv.y, 2.2) * (0.42 + 0.14 * sin(vUv.y * 26.0 - uTime * 5.0)) * pulse;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  }));
  m.renderOrder = 4; m.visible = false;
  scene.add(m);
  return m;
}
