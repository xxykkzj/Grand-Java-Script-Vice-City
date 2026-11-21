// The street side of the homes and of Coral Keys Realty (Skyline Estates and the penthouse lobby get their glass
// doors and canopies from world/keyCity.js like every venue on the key): the realty's shopfront with its listings
// in the window, the studio's door beside the hotel lobby, the villa's gate, the houseboat at its mooring off the
// marina boardwalk with a gangway, and the two residents' parking bays (villa, penthouse). Everything is merged per
// district (one lit mesh, one glowing mesh, one painted sign atlas each) and added to that district's group, so it
// is culled with it. The houseboat is its own mesh: it is hidden while you are aboard (the room draws the boat).
import * as THREE from 'three';
import { box, cyl, merge, PI } from '../core/util.js';
import { boards, P } from '../game/dress.js';
import { DOORS, footBox, footprint } from './layout.js';
import { HOMES } from '../game/homes.js';

const CREAM = '#fbf7f0', INK = '#22203a', GOLD = '#ffd166';

export function buildHomeFronts(L, oldGroup, keyGroup) {
  const V = L.venues, out = {};
  const mk = (S, N, B, group) => {
    const parts = [];
    if (S.length) parts.push(new THREE.Mesh(merge(S), new THREE.MeshLambertMaterial({ vertexColors: true })));
    if (N.length) parts.push(new THREE.Mesh(merge(N), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const bm = B.mesh(); if (bm) parts.push(bm);
    for (const m of parts) group.add(m);
    return parts;
  };

  // ---------------------------------------------------------------- the old town
  {
    const S = [], N = [], B = boards(512);
    // Coral Keys Realty: a glass door in a peach frame, a striped canopy, a display window of listings, the name
    { const v = V.realty, b = v.b, dx = b.cx + v.along, fz = b.z1, PE = '#ffb38a';
      S.push(box(1.5, 2.4, 0.06, dx, 1.22, fz + 0.08, '#9fd0e8'), box(0.06, 2.4, 0.08, dx, 1.22, fz + 0.12, '#c8c4d4'),
        box(0.16, 2.6, 0.2, dx - 0.84, 1.3, fz + 0.1, PE), box(0.16, 2.6, 0.2, dx + 0.84, 1.3, fz + 0.1, PE), box(1.84, 0.18, 0.2, dx, 2.62, fz + 0.1, PE),
        box(3.0, 0.5, 0.22, dx + 2.6, 0.25, fz + 0.12, PE), box(3.0, 0.12, 0.22, dx + 2.6, 2.45, fz + 0.12, PE), box(0.12, 2.3, 0.22, dx + 1.16, 1.3, fz + 0.12, PE), box(0.12, 2.3, 0.22, dx + 4.04, 1.3, fz + 0.12, PE),
        box(2.4, 0.12, 1.0, dx, 0.06, fz + 0.6, '#e8e0d8'));
      // the canopy: peach and cream stripes, low enough to clear the hotel's neon band
      S.push(box(5.4, 0.08, 1.3, dx + 1.3, 2.88, fz + 0.65, CREAM, 0.22));
      for (let k = 0; k < 9; k += 2) S.push(box(0.6, 0.09, 1.32, dx + 1.3 - 2.4 + k * 0.6, 2.885, fz + 0.65, PE, 0.22));
      N.push(box(5.42, 0.05, 0.05, dx + 1.3, 2.72, fz + 1.3, '#ff9a6a'));
      for (const o of [-1.2, 4.6]) { S.push(box(0.16, 0.3, 0.16, dx + o, 2.0, fz + 0.12, INK)); N.push(box(0.12, 0.2, 0.06, dx + o, 2.0, fz + 0.22, '#ffe9b0')); }
      B.add(2.8, 1.9, dx + 2.6, 1.37, fz + 0.2, 0, (c, W, H) => {
        P.grad(c, W, H, '#ffe8d0', '#ffc8b0'); P.text(c, 'HOMES FOR SALE', W / 2, H * 0.09, H * 0.08, '#c0405a');
        const cols = ['#7fe0ff', '#ff9ac8', '#ffe14a', '#8dffcf', '#ffb38a', '#c8b0ff'], tags = ['STUDIO · $1,800', 'HOUSEBOAT · $9,500', 'VILLA · $14,500', 'PENTHOUSE · $45,000', 'JUST LISTED', 'OCEAN VIEWS'];
        for (let i = 0; i < 6; i++) { const x = 8 + (i % 3) * (W - 16) / 3, y = H * 0.18 + Math.floor(i / 3) * H * 0.4, w = (W - 16) / 3 - 8, h = H * 0.36;
          c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.fillStyle = cols[i]; c.fillRect(x + 3, y + 3, w - 6, h * 0.62); c.fillStyle = '#fff6ec'; c.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.3); c.fillStyle = '#ff6a8a'; c.beginPath(); c.moveTo(x + w * 0.25, y + h * 0.3); c.lineTo(x + w * 0.5, y + h * 0.12); c.lineTo(x + w * 0.75, y + h * 0.3); c.fill();
          P.text(c, tags[i], x + w / 2, y + h * 0.84, h * 0.12, INK, { max: w - 4 }); }
        c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(W * 0.1, 0, W * 0.06, H);
      });
      B.add(4.2, 0.55, dx + 1.3, 3.35, fz + 0.14, 0, (c, W, H) => { P.fill(c, W, H, '#1b2a4a'); P.frame(c, W, H, PE, 4); P.text(c, 'CORAL KEYS REALTY', W / 2, H / 2, H * 0.5, '#ffb38a', { italic: true, glow: 6, max: W * 0.94 }); });
      S.push(box(4.4, 0.65, 0.1, dx + 1.3, 3.35, fz + 0.06, INK));
      footBox('door: Coral Keys Realty', dx - 1.5, dx + 4.2, fz, fz + 1.4);
    }
    // the studio: a residential door beside the hotel lobby, a transom, the number 2B, an intercom, a lamp
    { const v = V.studio, b = v.b, dx = b.cx + v.along, fz = b.z1, C = '#7fe0ff';
      S.push(box(1.1, 2.3, 0.08, dx, 1.15, fz + 0.06, '#2a6a8a'), box(0.9, 0.04, 0.02, dx, 1.2, fz + 0.11, '#5fa0c0'), box(0.06, 0.06, 0.06, dx + 0.38, 1.1, fz + 0.12, GOLD),
        box(0.14, 2.8, 0.2, dx - 0.64, 1.4, fz + 0.08, CREAM), box(0.14, 2.8, 0.2, dx + 0.64, 1.4, fz + 0.08, CREAM), box(1.42, 0.16, 0.22, dx, 2.82, fz + 0.08, CREAM),
        box(1.1, 0.4, 0.06, dx, 2.55, fz + 0.06, '#9fd0e8'), box(0.2, 0.3, 0.06, dx + 0.95, 1.35, fz + 0.06, '#c8c4d4'), box(1.6, 0.1, 0.9, dx, 0.05, fz + 0.5, '#e8e0d8'),
        box(1.6, 0.07, 0.8, dx, 3.05, fz + 0.4, C, 0.15));
      N.push(box(1.62, 0.04, 0.04, dx, 2.95, fz + 0.8, C), box(0.12, 0.18, 0.06, dx - 0.95, 2.1, fz + 0.14, '#ffe9b0'));
      B.add(0.5, 0.32, dx, 2.55, fz + 0.1, 0, (c, W, H) => { c.clearRect(0, 0, W, H); P.text(c, '2B', W / 2, H / 2, H * 0.8, '#ffe14a', { italic: true, glow: 4 }); });
      B.add(1.2, 0.3, dx, 3.35, fz + 0.1, 0, (c, W, H) => { P.fill(c, W, H, CREAM); P.text(c, 'APARTMENTS', W / 2, H / 2, H * 0.6, '#2a6a8a', { max: W * 0.9 }); });
      footBox('door: Seafront Studio 2B', dx - 1.0, dx + 1.2, fz, fz + 1.0);
    }
    // the villa: a cream arch round a wrought-iron gate with a pink neon edge, the name in tiles, two lanterns
    { const v = V.villa, b = v.b, dx = b.cx + v.along, fz = b.z1, PK = '#ff9ad5';
      S.push(box(1.9, 2.6, 0.05, dx, 1.3, fz + 0.1, '#2b2440'));
      for (let x = -0.85; x <= 0.86; x += 0.17) S.push(box(0.035, 2.4, 0.04, dx + x, 1.25, fz + 0.15, '#1b1830'));
      S.push(box(1.8, 0.05, 0.04, dx, 1.2, fz + 0.15, '#1b1830'), box(1.8, 0.05, 0.04, dx, 2.3, fz + 0.15, '#1b1830'), box(0.06, 0.08, 0.06, dx + 0.15, 1.3, fz + 0.2, GOLD));
      S.push(box(0.26, 3.0, 0.3, dx - 1.1, 1.5, fz + 0.14, CREAM), box(0.26, 3.0, 0.3, dx + 1.1, 1.5, fz + 0.14, CREAM));
      for (let i = 0; i <= 8; i++) { const a = PI * i / 8; S.push(box(0.34, 0.26, 0.3, dx + Math.cos(a) * 1.1, 3.0 + Math.sin(a) * 0.55, fz + 0.14, CREAM, 0, 0, a + PI / 2)); N.push(box(0.08, 0.08, 0.06, dx + Math.cos(a) * 1.28, 3.0 + Math.sin(a) * 0.7, fz + 0.3, PK)); }
      for (const o of [-1.45, 1.45]) { S.push(box(0.16, 0.34, 0.16, dx + o, 2.3, fz + 0.18, INK)); N.push(box(0.12, 0.22, 0.06, dx + o, 2.3, fz + 0.28, '#ffe0b0')); }
      B.add(1.3, 0.3, dx, 3.15, fz + 0.31, 0, (c, W, H) => { P.fill(c, W, H, '#7fe0d0'); for (let x = 0; x < W; x += H) { c.strokeStyle = '#fff6ec'; c.strokeRect(x, 0, H, H); } P.text(c, 'VILLA PALOMA', W / 2, H / 2, H * 0.6, '#1b3a5a', { max: W * 0.94 }); });
      footBox('door: Villa Paloma', dx - 1.6, dx + 1.6, fz, fz + 0.4);
    }
    // the villa's bay round the corner on the side street: painted lines and a RESIDENT sign at the kerb
    bay(S, N, B, HOMES.find((h) => h.id === 'villa'), 'VILLA PALOMA', '#ff9ad5', 2.0);
    out.old = mk(S, N, B, oldGroup);
  }

  // ---------------------------------------------------------------- Solano Key: the houseboat, the penthouse bay
  {
    const S = [], N = [], B = boards(512);
    bay(S, N, B, HOMES.find((h) => h.id === 'penthouse'), 'SKYLINE PENTHOUSE', '#ffd36a', 2.0);
    // the gangway from the boardwalk over the seawall to the aft deck, two mooring posts, a lamp post
    const v = V.houseboat, gx = v.b.cx + v.along;
    S.push(box(1.1, 0.08, 4.4, gx, 0.55, 151.2, '#b98a5e'), box(0.05, 0.05, 4.4, gx - 0.55, 1.4, 151.2, CREAM), box(0.05, 0.05, 4.4, gx + 0.55, 1.4, 151.2, CREAM));
    for (const z of [149.4, 151.2, 153]) for (const s of [-0.55, 0.55]) S.push(box(0.05, 0.9, 0.05, gx + s, 0.98, z, CREAM));
    for (const x of [-768.5, -751.5]) S.push(cyl(0.22, 0.25, 2.4, 8, x, 0, 152.2, '#6b4a30'), cyl(0.28, 0.28, 0.12, 8, x, 1.2, 152.2, '#4a3020'));
    S.push(cyl(0.07, 0.09, 3.6, 6, gx + 1.3, 1.8, 148.2, INK)); N.push(box(0.3, 0.3, 0.3, gx + 1.3, 3.7, 148.2, '#ffe0b0'));
    B.add(1.2, 0.36, gx - 1.3, 1.2, 148.0, PI, (c, W, H) => { P.fill(c, W, H, '#2a6a8a'); P.frame(c, W, H, '#8dffcf', 3); P.text(c, 'THE DRIFTWOOD DORY', W / 2, H / 2, H * 0.46, '#fff6ec', { max: W * 0.92 }); });
    S.push(box(0.06, 1.2, 0.06, gx - 1.3, 0.6, 148.05, INK));
    footprint('houseboat lamp', gx + 1.3, 148.2, 0.12); footprint('houseboat name post', gx - 1.3, 148.05, 0.06);
    footBox('door: The Driftwood Dory gangway', gx - 0.6, gx + 0.6, 148.9, 153.4);
    DOORS.push({ what: 'The Driftwood Dory gangway', x: gx, z: v.b.z0 - 0.1 });
    out.key = mk(S, N, B, keyGroup);
    out.boat = houseboat(v.b);
    keyGroup.add(out.boat);
  }
  return out;
}

// a resident's bay: a painted box on the parking lane, the words on the tarmac, a sign at the kerb
function bay(S, N, B, h, name, col, kerb) {
  const { x, z, yaw } = h.bay, ax = Math.abs(Math.sin(yaw)) > 0.5;   // ax: the car lies along x
  const L = 5.6, W = 2.4, y = 0.012;
  const lw = (w, d, px, pz) => S.push(box(ax ? d : w, 0.01, ax ? w : d, px, y, pz, '#ffe14a'));
  if (ax) { lw(W, 0.12, x - L / 2, z); lw(W, 0.12, x + L / 2, z); lw(0.12, L, x, z - W / 2); lw(0.12, L, x, z + W / 2); }
  else { lw(W, 0.12, x, z - L / 2); lw(W, 0.12, x, z + L / 2); lw(0.12, L, x - W / 2, z); lw(0.12, L, x + W / 2, z); }
  B.add(2.0, 0.6, x, y + 0.01, z, ax ? PI / 2 : 0, (c, Wd, Hh) => { c.clearRect(0, 0, Wd, Hh); P.text(c, 'RESIDENT', Wd / 2, Hh / 2, Hh * 0.6, '#ffe14a', { max: Wd * 0.95 }); }, 110, -PI / 2);
  // the kerb sign: on the sidewalk side of the lane (east of a lane along z here)
  const sx = ax ? x : x + kerb, sz = ax ? z + kerb : z;
  S.push(cyl(0.05, 0.05, 2.2, 6, sx, 1.1, sz, '#c8c4d4'), box(0.06, 0.6, 0.8, sx, 2.1, sz, INK));
  B.add(0.74, 0.54, sx + 0.04, 2.1, sz, PI / 2, (c, Wd, Hh) => { P.fill(c, Wd, Hh, '#1b2a4a'); P.frame(c, Wd, Hh, col, 3); P.text(c, 'P · RESIDENT', Wd / 2, Hh * 0.34, Hh * 0.2, col, { max: Wd * 0.9 }); P.text(c, name, Wd / 2, Hh * 0.68, Hh * 0.14, '#fff6ec', { max: Wd * 0.9 }); });
  B.add(0.74, 0.54, sx - 0.04, 2.1, sz, -PI / 2, (c, Wd, Hh) => { P.fill(c, Wd, Hh, '#1b2a4a'); P.frame(c, Wd, Hh, col, 3); P.text(c, 'P · RESIDENT', Wd / 2, Hh * 0.34, Hh * 0.2, col, { max: Wd * 0.9 }); P.text(c, name, Wd / 2, Hh * 0.68, Hh * 0.14, '#fff6ec', { max: Wd * 0.9 }); });
  N.push(box(0.07, 0.62, 0.07, sx, 2.1, sz + 0.42, col));
  footprint('resident bay sign: ' + name, sx, sz, 0.08);
}

// the houseboat seen from the shore: a white hull with a coral stripe, the mint cabin with lit portholes, a roof
// with a rail, the aft deck with its chairs, a flag at the bow, strings of bulbs
function houseboat(b) {
  const S = [], N = [], x = b.cx, z = b.cz, CAB = '#a5e6cf';
  S.push(box(14.4, 1.0, 6.4, x, -0.45, z, '#f6f1e7'), box(14.5, 0.14, 6.5, x, 0.0, z, '#ff8a6a'), box(14.6, 0.1, 6.6, x, -0.85, z, '#2a6a8a'), box(14.2, 0.1, 6.2, x, 0.05, z, '#c8945e'));
  S.push(box(8.0, 2.5, 5.2, x - 1, 1.3, z, CAB), box(8.6, 0.16, 5.6, x - 1, 2.6, z, '#f6f1e7'), box(8.7, 0.08, 5.7, x - 1, 2.54, z, '#ff8a6a'));
  for (let y = 0.4; y < 2.5; y += 0.3) for (const s of [-1, 1]) S.push(box(8.02, 0.03, 0.02, x - 1, y, z + s * 2.61, '#8fd0bc'));
  for (const [ox, oz] of [[-3.8, -1], [-1.0, -1], [1.2, -1], [-3.8, 1], [-0.8, 1], [1.2, 1]]) N.push(cyl(0.32, 0.32, 0.06, 12, x + ox, 1.4, z + oz * 2.62, '#ffd9a0', PI / 2));
  for (const [px, pz, w, d] of [[0, -3.05, 14.2, 0.08], [0, 3.05, 14.2, 0.08], [7.05, 0, 0.08, 6], [-7.05, 0, 0.08, 6]]) S.push(box(w, 0.06, d, x + px, 0.95, z + pz, '#8a5a3a'));
  for (let i = -7; i <= 7; i += 1) for (const s of [-1, 1]) S.push(box(0.05, 0.9, 0.05, x + i, 0.5, z + s * 3.05, CREAM));
  for (const zz of [-1.4, 0.9]) S.push(box(0.6, 0.06, 1.2, x + 5.3, 0.42, z + zz, '#2a6a8a'), box(0.6, 0.7, 0.06, x + 4.8, 0.72, z + zz, '#2a6a8a', 0, PI / 2, 0.5));
  for (const [ox, oz] of [[6.9, -2.9], [6.9, 2.9], [3.1, -2.9], [3.1, 2.9]]) S.push(box(0.1, 2.4, 0.1, x + ox, 1.2, z + oz, '#8a5a3a'));
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) N.push(box(0.1, 0.1, 0.1, x + 3.2 + i * 0.45, 2.35 - Math.sin(i / 8 * PI) * 0.3, z + s * 2.7, ['#ffe14a', '#ff9ac8', '#7fe0ff'][i % 3]));
  S.push(box(0.04, 1.6, 0.04, x - 6.8, 1.7, z, '#d9d6e6'), box(0.6, 0.35, 0.02, x - 6.5, 2.3, z, '#ff6a8a'), box(1.0, 0.6, 0.8, x - 1, 2.98, z + 1.2, '#c8945e'));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(S), new THREE.MeshLambertMaterial({ vertexColors: true })), new THREE.Mesh(merge(N), new THREE.MeshBasicMaterial({ vertexColors: true })));
  return g;
}
