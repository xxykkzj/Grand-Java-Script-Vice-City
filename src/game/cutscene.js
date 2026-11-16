// The Velvet Flamingo: a pocket bar interior (one merged unlit mesh, parked far below the
// island and only visible during the scene) and the letterboxed cutscene that hands out jobs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, merge, lerp, clamp, timeU, PI, reducedMotion } from '../core/util.js';

const OY = -90;
const $ = (id) => document.getElementById(id);
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

function buildBar() {
  const g = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) g.push(box(1.5, 0.1, 1.5, -5.25 + i * 1.5, -0.05, -3.75 + j * 1.5, (i + j) % 2 ? '#3d1f5c' : '#1b0f30'));
  g.push(box(12.4, 4.4, 0.2, 0, 2.1, -4.6, '#34185a'), box(12.4, 4.4, 0.2, 0, 2.1, 4.6, '#241040'), box(0.2, 4.4, 9.4, -6.1, 2.1, 0, '#2c1450'), box(0.2, 4.4, 9.4, 6.1, 2.1, 0, '#2c1450'));
  g.push(box(12.4, 0.2, 9.4, 0, 4.3, 0, '#120822'));
  // counter with a glowing lip, stools
  g.push(box(7, 1.1, 0.8, 0, 0.55, -2.2, '#5a2468'), box(7.3, 0.08, 1.05, 0, 1.14, -2.2, '#ffc7ea'), box(7, 0.06, 0.06, 0, 0.22, -1.78, '#ff2bd1'), box(7.3, 0.05, 0.05, 0, 1.07, -1.68, '#18f0ff'));
  for (const x of [-2.6, -1.3, 1.7, 2.9]) g.push(cyl(0.27, 0.27, 0.09, 10, x, 0.78, -1.15, '#ff4fa3'), cyl(0.05, 0.09, 0.76, 6, x, 0.38, -1.15, '#c9c0d8'), cyl(0.22, 0.24, 0.04, 8, x, 0.02, -1.15, '#c9c0d8'));
  // back bar: shelves, bottles, a mirror, the house flamingo in neon
  const BOT = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff'];
  for (const y of [1.55, 2.2]) {
    g.push(box(6.6, 0.07, 0.34, 0, y, -4.3, '#7a3d78'));
    for (let i = 0; i < 15; i++) if ((i * 7 + (y > 2 ? 3 : 0)) % 5) g.push(box(0.13, 0.3 + (i % 3) * 0.07, 0.13, -3 + i * 0.43, y + 0.2 + (i % 3) * 0.035, -4.3, BOT[(i + (y > 2 ? 2 : 0)) % 6]));
  }
  g.push(box(6.8, 0.06, 0.06, 0, 2.95, -4.45, '#18f0ff'), box(6.8, 0.06, 0.06, 0, 1.38, -4.45, '#18f0ff'));
  const P = '#ff4fc0', nx = 4.4, nz = -4.45;
  g.push(box(0.07, 1, 0.07, nx, 1.5, nz, P), box(0.9, 0.5, 0.07, nx - 0.1, 2.25, nz, P, 0, 0, 0.25), box(0.07, 0.9, 0.07, nx + 0.5, 2.9, nz, P, 0, 0, -0.35), box(0.3, 0.24, 0.07, nx + 0.7, 3.4, nz, P), box(0.28, 0.07, 0.07, nx + 0.95, 3.27, nz, '#ffe14a', 0, 0, -0.5));
  // jukebox
  g.push(box(1.2, 1.5, 0.7, -5.4, 0.75, 1.2, '#7a1a6a'), cyl(0.6, 0.6, 0.7, 12, -5.4, 1.5, 1.2, '#7a1a6a', PI / 2), box(0.06, 1.3, 0.5, -4.78, 0.9, 1.2, '#ffe14a'),
    box(0.07, 0.5, 0.36, -4.77, 1.45, 1.2, '#18f0ff'), box(0.07, 0.12, 0.5, -4.77, 0.5, 1.2, '#ff2bd1'), box(0.07, 0.12, 0.5, -4.77, 0.3, 1.2, '#8dff5a'));
  // tables, door with the sunset behind it, ceiling tubes
  for (const [x, z] of [[4.2, 1.6], [3.4, -0.4]]) g.push(cyl(0.55, 0.55, 0.06, 12, x, 0.8, z, '#ffc7ea'), cyl(0.06, 0.06, 0.8, 6, x, 0.4, z, '#c9c0d8'), cyl(0.05, 0.05, 0.14, 6, x, 0.9, z, '#ffe14a'));
  g.push(box(1.7, 2.7, 0.08, 0, 1.35, 4.48, '#ffa64a'), box(1.9, 0.1, 0.1, 0, 2.75, 4.44, P), box(0.1, 2.8, 0.1, -0.9, 1.4, 4.44, P), box(0.1, 2.8, 0.1, 0.9, 1.4, 4.44, P));
  g.push(box(10, 0.06, 0.06, 0, 4.1, -1.5, '#18f0ff'), box(10, 0.06, 0.06, 0, 4.1, 1.5, '#ff2bd1'));
  return merge(g);
}

export function createCutscene(scene, camera, game) {
  const { player, L } = game;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const room = new THREE.Mesh(buildBar(), mat);
  room.position.y = OY;
  // Dee, the bartender: tall pink beehive, yellow shirt, dark vest
  const dee = new THREE.Group();
  dee.add(new THREE.Mesh(merge([
    box(0.46, 0.6, 0.26, 0, 1.2, 0, '#ffe14a'), box(0.48, 0.5, 0.2, 0, 1.15, -0.04, '#22203a'), box(0.36, 0.9, 0.24, 0, 0.45, 0, '#22203a'),
    box(0.25, 0.26, 0.25, 0, 1.68, 0, '#c98d62'), box(0.3, 0.42, 0.3, 0, 1.98, -0.03, '#ff5fa8'), box(0.27, 0.2, 0.1, 0, 1.72, -0.11, '#ff5fa8'),
    box(0.05, 0.05, 0.02, -0.07, 1.7, 0.127, '#1b1830'), box(0.05, 0.05, 0.02, 0.07, 1.7, 0.127, '#1b1830'), box(0.1, 0.025, 0.02, 0, 1.6, 0.127, '#b0304a'),
    box(0.13, 0.5, 0.14, -0.3, 1.22, 0, '#ffe14a'), box(0.1, 0.1, 0.1, -0.3, 0.93, 0, '#c98d62'),
  ]), mat));
  const arm = new THREE.Mesh(merge([box(0.13, 0.5, 0.14, 0, -0.22, 0, '#ffe14a'), box(0.1, 0.1, 0.1, 0, -0.5, 0, '#c98d62'), box(0.2, 0.04, 0.16, 0, -0.56, 0.02, '#fff6ec')]), mat);
  arm.position.set(0.3, 1.46, 0);
  dee.add(arm);
  dee.position.set(-0.3, OY, -3.15);
  room.visible = dee.visible = false;
  scene.add(room, dee);

  const cine = $('cine'), sub = $('sub'), fade = $('fade');
  const look = new THREE.Vector3();
  const say = (line) => {
    sub.textContent = '';
    if (!line) return;
    const b = document.createElement('b');
    b.textContent = line[0]; if (line[0] === 'SKYE') b.className = 'me';
    sub.append(b, line[1]);
  };
  let t = 0, lines = [], done = null, shown = -2, ending = false, saved = null;
  const T_OUT = 3.2, T_IN = 3, T_LINE = reducedMotion ? 4 : 3.5;

  const cut = {
    active: false,
    start(dialogue, onDone) {
      cut.active = true; t = 0; lines = dialogue; done = onDone; shown = -2; ending = false;
      saved = { fov: camera.fov };
      cine.classList.add('on'); $('hud').classList.add('cine');
      camera.fov = 40; camera.updateProjectionMatrix();
    },
    skip() { if (cut.active && !ending) cut.end(); },
    end() {
      ending = true;
      fade.classList.add('on');
      setTimeout(() => {
        room.visible = dee.visible = false; game.env.indoor = false;
        cine.classList.remove('on'); $('hud').classList.remove('cine'); say(null);
        camera.fov = saved.fov; camera.updateProjectionMatrix();
        cut.active = false;
        done();
        setTimeout(() => fade.classList.remove('on'), 60);
      }, 380);
    },
    update(dt) {
      if (ending) return;
      t += dt;
      const bx = L.bar.x, bz = L.bar.z, b = L.bar.b;
      if (t < T_OUT) {
        // exterior: low angle, tilting from the sign down to the courier skating to the door
        const k = t / T_OUT, e = ease(k);
        player.pos.set(bx, 0, lerp(bz, b.z1 + 2.2, ease(k * 1.15))); player.yaw = PI; player.speed = k < 0.85 ? 4 : 0;
        camera.position.set(bx + 9 - e * 3, 1.1 + e * 0.6, bz + 9 - e * 1.5);
        look.set(bx + 1.2 * (1 - e), lerp(b.h - 2.4, 1.5, e), b.z1 + 1.5);
        if (k > 0.85) fade.classList.add('on');
      } else {
        if (!room.visible) { room.visible = dee.visible = true; game.env.indoor = true; fade.classList.remove('on'); }
        const ti = t - T_OUT;
        if (ti < T_IN) {
          // interior wide: Skye rolls in from the door to the counter
          const k = ti / T_IN, e = ease(k);
          player.pos.set(lerp(0, 0.7, e), OY, lerp(3.9, -0.85, e)); player.yaw = PI + 0.15; player.speed = k < 0.9 ? 3.5 : 0;
          camera.position.set(4.8 - e * 1.2, OY + 2.5 - e * 0.5, 3.2 - e * 0.6);
          look.set(-0.5, OY + 1.25, -1.6);
        } else {
          const li = Math.floor((ti - T_IN) / T_LINE), k = ((ti - T_IN) / T_LINE) % 1;
          if (li >= lines.length) { cut.end(); return; }
          if (li !== shown) { shown = li; say(lines[li]); }
          player.pos.set(0.7, OY, -0.85); player.yaw = PI + 0.3; player.speed = 0;
          const me = lines[li][0] === 'SKYE', push = reducedMotion ? 0 : k * 0.25;
          if (me) { camera.position.set(-1.5 + push, OY + 1.65, -2.9 + push); look.set(0.7, OY + 1.55, -0.85); }
          else { camera.position.set(-1.35 + push * 0.5, OY + 1.6, -0.45 - push); look.set(-0.3, OY + 1.55, -3.15); }
          // Dee talks with her whole head and never stops polishing
          dee.children[0].rotation.x = me ? 0 : Math.sin(timeU.value * 9) * 0.03;
        }
        arm.rotation.set(-1.15, 0, Math.sin(timeU.value * 5) * 0.35 - 0.3);
        dee.rotation.y = 0.25;
      }
      player.animate(dt, 0, null);
      player.model.root.visible = true;
      camera.lookAt(look);
    },
  };
  return cut;
}

// Pulsing mission marker: a tall see-through column of light standing on a bright ground ring.
export function makeMarker(scene, hex) {
  const col = new THREE.CylinderGeometry(1.5, 1.5, 9, 28, 1, true);
  col.translate(0, 4.5, 0);
  const ring = new THREE.RingGeometry(1.5, 2.1, 28);
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
