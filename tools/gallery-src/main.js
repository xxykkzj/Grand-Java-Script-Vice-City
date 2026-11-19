import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const $ = (s) => document.querySelector(s);
const state = { loaded: 0, failed: 0, total: 0 };
window.__gallery = state;

const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); }
addEventListener('resize', resize); resize();

const loader = new GLTFLoader();
const cache = new Map(); // id -> { gltf }

function makeScene(entry, gltf) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x4a2a6a, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3dcb, 1.4); rim.position.set(-4, 2, -3); scene.add(rim);
  const root = SkeletonUtils.clone(gltf.scene);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.001, size.length() / 2);
  const pivot = new THREE.Group();
  root.position.sub(center);
  pivot.add(root); scene.add(pivot);
  let mixer = null, actions = [];
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(root);
    actions = gltf.animations.map((c) => mixer.clipAction(c));
    actions[0].play();
  }
  return { scene, pivot, root, mixer, actions, radius, size };
}
function fitCamera(cam, radius, aspect) {
  cam.aspect = aspect; cam.near = radius / 50; cam.far = radius * 50;
  const fov = THREE.MathUtils.degToRad(cam.fov);
  const dist = (radius * 1.15) / Math.sin(Math.min(fov, fov * aspect) / 2);
  cam.position.set(0.7, 0.5, 1).normalize().multiplyScalar(dist);
  cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
}

let manifest = [];
const cards = []; // { entry, el, thumb, inst, cam, visible }

function fmtKB(k) { return k >= 1024 ? (k / 1024).toFixed(2) + ' MB' : k.toFixed(1) + ' KB'; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const shortName = (e) => e.id.split('/')[1];

function buildCards() {
  const grid = $('#grid');
  manifest.forEach((entry) => {
    const el = document.createElement('div');
    el.className = 'card'; el.tabIndex = 0; el.setAttribute('role', 'button');
    const anims = entry.animations.map((a) => a.name);
    el.innerHTML = `<div class="thumb wait"></div><div class="meta"><div class="name">${esc(shortName(entry))}</div>
      <div class="src">${esc(entry.source)}</div>
      <div class="row"><span class="tag cat">${esc(entry.category)}</span><span class="tag lic">${esc(entry.license)}</span>
      <span class="tag">${entry.tris.toLocaleString()} tris</span><span class="tag">${fmtKB(entry.packed_kb)}</span></div>
      ${anims.length ? `<div class="anim">${anims.length} anim: ${esc(anims.slice(0, 4).join(', '))}${anims.length > 4 ? ', ...' : ''}</div>` : ''}</div>`;
    const c = { entry, el, thumb: el.querySelector('.thumb'), inst: null, cam: new THREE.PerspectiveCamera(35, 1, 0.1, 100), gltf: null };
    el.addEventListener('click', () => openModal(c));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(c); } });
    grid.appendChild(el); cards.push(c);
  });
}

async function loadAll() {
  state.total = cards.length;
  let i = 0;
  const worker = async () => {
    while (i < cards.length) {
      const c = cards[i++];
      try {
        const gltf = await loader.loadAsync('../' + c.entry.packed);
        c.gltf = gltf; c.thumb.classList.remove('wait'); state.loaded++;
      } catch (err) {
        console.warn('load failed', c.entry.id, err); c.thumb.classList.remove('wait'); c.thumb.classList.add('err'); state.failed++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

// ---------- filters ----------
const filt = { q: '', cat: 'all', src: 'all' };
function applyFilters() {
  const q = filt.q.trim().toLowerCase(); let n = 0;
  cards.forEach((c) => {
    const e = c.entry;
    const hay = (e.id + ' ' + e.source + ' ' + e.category + ' ' + e.tags.join(' ') + ' ' + e.license + ' ' + e.animations.map((a) => a.name).join(' ')).toLowerCase();
    const ok = (filt.cat === 'all' || e.category === filt.cat) && (filt.src === 'all' || e.source === filt.src) && (!q || q.split(/\s+/).every((t) => hay.includes(t)));
    c.el.style.display = ok ? '' : 'none'; if (ok) n++;
  });
  $('#count').textContent = `${n} / ${cards.length} models`;
  $('#empty').style.display = n ? 'none' : 'block';
}
function buildFilters() {
  const cats = ['all', ...[...new Set(manifest.map((m) => m.category))].sort()];
  const box = $('#cats');
  cats.forEach((cat) => {
    const b = document.createElement('button'); b.className = 'chip' + (cat === 'all' ? ' on' : ''); b.textContent = cat;
    b.onclick = () => { filt.cat = cat; box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); applyFilters(); };
    box.appendChild(b);
  });
  const sel = $('#src');
  sel.innerHTML = '<option value="all">All sources</option>' + [...new Set(manifest.map((m) => m.source))].sort().map((s) => `<option>${esc(s)}</option>`).join('');
  sel.onchange = () => { filt.src = sel.value; applyFilters(); };
  $('#q').oninput = (e) => { filt.q = e.target.value; applyFilters(); };
}

// ---------- modal ----------
const modal = { open: false, inst: null, cam: new THREE.PerspectiveCamera(40, 1, 0.01, 1000), controls: null, entry: null };
function openModal(c) {
  if (!c.gltf) return;
  const e = c.entry;
  const inst = makeScene(e, c.gltf);
  inst.pivot.rotation.set(0, 0, 0);
  const grid = new THREE.GridHelper(inst.radius * 6, 24, 0xff3dcb, 0x33205e); grid.position.y = -inst.size.y / 2; inst.scene.add(grid);
  modal.inst = inst; modal.entry = e; modal.open = true;
  $('#modal').classList.add('open'); document.body.style.overflow = 'hidden';
  const view = $('#view'); const r = view.getBoundingClientRect();
  fitCamera(modal.cam, inst.radius, r.width / r.height);
  if (modal.controls) modal.controls.dispose();
  modal.controls = new OrbitControls(modal.cam, view);
  modal.controls.enableDamping = true; modal.controls.target.set(0, 0, 0);
  const anims = e.animations;
  $('#side').innerHTML = `<h2>${esc(shortName(e))}</h2><div class="src">${esc(e.category)} &middot; ${esc(e.id.split('/')[0])}</div>
    <dl><dt>Source</dt><dd><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.source)}</a></dd>
    <dt>Author</dt><dd>${esc(e.author)}</dd><dt>Licence</dt><dd>${esc(e.license)}</dd>
    <dt>Triangles</dt><dd>${e.tris.toLocaleString()}</dd><dt>Materials</dt><dd>${e.materials}</dd><dt>Textures</dt><dd>${e.textures}</dd>
    <dt>Size</dt><dd>${fmtKB(e.size_kb)} (packed ${fmtKB(e.packed_kb)})</dd>
    <dt>BBox</dt><dd>${e.bbox ? e.bbox.size.map((v) => v.toFixed(2)).join(' x ') : 'n/a'}</dd>
    <dt>File</dt><dd>${esc(e.packed)}</dd><dt>Tags</dt><dd>${esc(e.tags.join(', '))}</dd></dl>
    ${anims.length ? `<label for="anim">Animation</label><select id="anim"><option value="-1">(none / bind pose)</option>${anims.map((a, i) => `<option value="${i}"${i === 0 ? ' selected' : ''}>${esc(a.name)} (${a.duration}s)</option>`).join('')}</select>` : '<div class="src">No animations</div>'}`;
  const sel = $('#anim');
  if (sel) sel.onchange = () => {
    inst.mixer.stopAllAction(); const i = +sel.value;
    if (i >= 0) { inst.actions[i].reset().play(); }
  };
}
function closeModal() {
  modal.open = false; modal.inst = null; $('#modal').classList.remove('open'); document.body.style.overflow = '';
  if (modal.controls) { modal.controls.dispose(); modal.controls = null; }
}
$('#close').onclick = closeModal;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.open) closeModal(); });

// ---------- render loop ----------
const clock = new THREE.Clock();
function drawRect(scene, cam, rect, clearHex, clipTop = 0) {
  const W = window.innerWidth, H = window.innerHeight;
  const x = Math.max(0, rect.left), y = Math.max(clipTop, rect.top), r = Math.min(W, rect.right), b = Math.min(H, rect.bottom);
  if (r <= x || b <= y) return;
  // viewport covers the full rect (for correct aspect); scissor clips to visible part
  renderer.setViewport(rect.left, H - rect.bottom, rect.width, rect.height);
  renderer.setScissor(x, H - b, r - x, b - y);
  renderer.setScissorTest(true);
  if (clearHex !== null) { renderer.setClearColor(clearHex, 0); }
  renderer.render(scene, cam);
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, window.innerWidth, window.innerHeight); renderer.clear();
  const H = window.innerHeight;
  const headerBottom = document.querySelector('header').getBoundingClientRect().bottom;
  if (modal.open && modal.inst) {
    const rect = $('#view').getBoundingClientRect();
    modal.cam.aspect = rect.width / rect.height; modal.cam.updateProjectionMatrix();
    modal.controls.update();
    if (modal.inst.mixer) modal.inst.mixer.update(dt);
    drawRect(modal.inst.scene, modal.cam, rect, null);
    return;
  }
  for (const c of cards) {
    if (!c.gltf || c.el.style.display === 'none') continue;
    const rect = c.thumb.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > H || rect.right < 0 || rect.left > window.innerWidth) continue; // offscreen
    if (!c.inst) { c.inst = makeScene(c.entry, c.gltf); }
    const inst = c.inst;
    inst.pivot.rotation.y = t * 0.8 + c.entry.id.length;
    if (inst.mixer) inst.mixer.update(dt);
    fitCamera(c.cam, inst.radius, rect.width / rect.height);
    drawRect(inst.scene, c.cam, rect, null, headerBottom);
  }
}

(async function init() {
  try {
    manifest = await (await fetch('../manifest.json')).json();
  } catch (e) { console.error('manifest load failed', e); state.failed = 1; state.total = 1; return; }
  buildCards(); buildFilters(); applyFilters();
  frame();
  await loadAll();
})();
