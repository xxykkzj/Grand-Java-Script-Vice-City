// Culling by district: the old town and Solano Key each keep their detailed meshes in one group. When the
// camera is far from a district its group is hidden and a silhouette (a few dozen hazed boxes with night
// windows, one draw call, see world/horizon.js) stands in for it, so either district costs the same handful
// of draw calls from the other side of the bay.
import { HX, HZ, KEY } from './layout.js';
import { VIEW } from '../core/util.js';

const rectDist = (x, z, x0, x1, z0, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));

export function createDistricts(horizon, L, cityGroup, keyGroup) {
  // the old town: a sand slab and its buildings; the key: its slab, buildings, the stadium, the cranes
  const A = [[-HX, HX, -HZ, HZ, 0.6, '#d9c7a8', 0]];
  for (const b of L.buildings) A.push([b.x0, b.x1, b.z0, b.z1, b.h + 1.4, b.color]);
  const K = L.key, B = [[KEY.x0, KEY.x1, KEY.z0, KEY.z1, 0.6, '#cdbfc4', 0]];
  for (const b of K.buildings) B.push([b.x0, b.x1, b.z0, b.z1, b.roofY, b.color]);
  const st = K.stadium;
  B.push([st.x0, st.x1, st.z0, st.z0 + 13, 15, '#e9d8c4', 0], [st.x0, st.x1, st.z1 - 13, st.z1, 15, '#e9d8c4', 0], [st.x0, st.x0 + 13, st.z0, st.z1, 13, '#e9d8c4', 0], [st.x1 - 13, st.x1, st.z0, st.z1, 13, '#e9d8c4', 0]);
  for (const c of K.docks.cranes) B.push([c.x - 1, c.x + 1, c.z - 26, c.z + 18, 28, '#ffb000', 0]);
  for (const h of K.houses) B.push([h.x - 5, h.x + 5, h.z - 4.5, h.z + 4.5, 5, h.color, 0]);
  const silA = horizon.silhouette(A), silB = horizon.silhouette(B);
  let showA = true, showB = true;
  const api = {
    silA, silB,
    get showA() { return showA; }, get showB() { return showB; },
    update(cam) {
      const p = cam.position;
      const dA = rectDist(p.x, p.z, -HX, HX, -HZ, HZ + 110), dB = rectDist(p.x, p.z, KEY.x0, KEY.x1, KEY.z0, KEY.z1 + 90);
      // a little hysteresis so nothing flickers at the threshold
      const f = VIEW.far;
      showA = showA ? dA < 250 * f : dA < 230 * f;
      showB = showB ? dB < 250 * f : dB < 230 * f;
      cityGroup.visible = showA; silA.visible = !showA;
      keyGroup.visible = showB; silB.visible = !showB;
    },
  };
  return api;
}
