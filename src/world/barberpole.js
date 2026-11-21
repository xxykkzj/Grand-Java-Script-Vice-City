// A barber pole: a glass cylinder whose red, white and blue stripes spiral up as it turns (the stripes are
// drawn and moved in the shader on the shared clock, so it never needs an update). One small mesh, one draw
// call while it is in view. The chrome ends and the bracket are merged into whatever it hangs on.
import * as THREE from 'three';
import { timeU } from '../core/util.js';

export function barberPole(r = 0.1, h = 0.95, { fog = true, speed = 0.55 } = {}) {
  const geo = new THREE.CylinderGeometry(r, r, h, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = timeU;
    sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = position;');
    sh.fragmentShader = 'uniform float uT; varying vec3 vP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float a = atan(vP.z, vP.x) / 6.2831853, u = fract(a * 2.0 + vP.y * ${(1.6 / h).toFixed(3)} - uT * ${speed.toFixed(3)});
        vec3 c = u < 0.32 ? vec3(0.95, 0.12, 0.2) : u < 0.5 ? vec3(1.0, 0.97, 0.94) : u < 0.82 ? vec3(0.16, 0.32, 0.9) : vec3(1.0, 0.97, 0.94);
        float rim = 0.78 + 0.22 * abs(sin(a * 6.2831853));
        diffuseColor.rgb = c * rim;
      }`);
  };
  mat.customProgramCacheKey = () => `barberpole-${h}-${speed}-${fog}`;
  const m = new THREE.Mesh(geo, mat);
  m.name = 'barber pole';
  return m;
}
