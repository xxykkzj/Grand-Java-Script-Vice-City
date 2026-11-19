#!/usr/bin/env node
// Scans assets/models/<slug>/*.glb, packs each into assets/packed/<slug>/, and writes assets/manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glbInfo } from './glb-info.mjs';
import { packGLB } from './pack-glb.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

export const SOURCES = {
  'kenney-city-builder': { source: 'Kenney Starter Kit City Builder', license: 'MIT', author: 'Kenney', url: 'https://github.com/KenneyNL/Starter-Kit-City-Builder' },
  'kenney-racing': { source: 'Kenney Starter Kit Racing', license: 'MIT', author: 'Kenney', url: 'https://github.com/KenneyNL/Starter-Kit-Racing' },
  'kenney-platformer': { source: 'Kenney Starter Kit 3D Platformer', license: 'MIT', author: 'Kenney', url: 'https://github.com/KenneyNL/Starter-Kit-3D-Platformer' },
  'kenney-city-suburban': { source: 'Kenney City Kit Suburban', license: 'CC0-1.0', author: 'Kenney', url: 'https://www.kenney.nl/assets/city-kit-suburban' },
  'kenney-car-kit': { source: 'Kenney Car Kit', license: 'CC0-1.0', author: 'Kenney', url: 'https://www.kenney.nl/assets/car-kit' },
  'quaternius-street': { source: 'Quaternius Street Pack', license: 'CC0-1.0', author: 'Quaternius (converted OBJ to GLB with obj2gltf)', url: 'https://www.patreon.com/quaternius' },
  'quaternius-robot-expressive': { source: 'RobotExpressive (three.js examples)', license: 'CC0-1.0', author: 'Tomas Laulhe (Quaternius); modifications Don McCurdy', url: 'https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive' },
};

const RULES = [ // [regex, category], first match wins
  [/^vehicle|^car|truck|motorcycle/, 'vehicle'],
  [/^building/, 'building'],
  [/^road|^pavement/, 'road'],
  [/^track/, 'track'],
  [/^decoration/, 'decoration'],
  [/^grass-trees|^grass|^tree|^cloud|^rock/, 'nature'],
  [/^dust|particle|smoke/, 'fx'],
  [/^platform|^block|^brick|^flag/, 'platform'],
  [/^coin/, 'prop'],
  [/^character|robot/, 'character'],
];
const SLUG_RULES = {
  'kenney-car-kit': [[/^wheel|^debris/, 'vehicle-part'], [/^box|^cone/, 'prop'], [/./, 'vehicle']],
  'kenney-city-suburban': [[/^house/, 'building'], [/^fence/, 'fence'], [/^driveway|^path/, 'road'], [/^tree/, 'nature']],
  'quaternius-street': [[/^street_|^streets/, 'road'], [/^sign/, 'sign'], [/light/, 'light']],
};
export function categorize(slug, name) {
  const n = name.toLowerCase();
  for (const [re, c] of SLUG_RULES[slug] || []) if (re.test(n)) return c;
  if (slug === 'kenney-platformer' && /^grass/.test(n)) return 'nature';
  if (/particle|dust/.test(n)) return 'fx';
  for (const [re, c] of RULES) if (re.test(n)) return c;
  return 'prop';
}

const TAGS = { 'kenney-city-suburban': ['suburban', 'lowpoly'], 'kenney-car-kit': ['cars', 'lowpoly'], 'quaternius-street': ['street', 'lowpoly'], 'kenney-city-builder': ['city', 'lowpoly'], 'kenney-racing': ['racing', 'lowpoly'], 'kenney-platformer': ['platformer', 'lowpoly'], 'quaternius-robot-expressive': ['animated', 'rigged', 'cc0'] };
const r3 = (v) => v.map((x) => +x.toFixed(3));

export function build() {
  const out = [];
  for (const slug of Object.keys(SOURCES).sort()) {
    const dir = path.join(ROOT, 'models', slug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.glb')).sort()) {
      const src = path.join(dir, f), dst = path.join(ROOT, 'packed', slug, f);
      packGLB(src, dst);
      const i = glbInfo(src), p = glbInfo(dst); // re-parse packed output to validate
      if (p.images.some((im) => im.kind !== 'embedded')) throw new Error('packed GLB still has external images: ' + dst);
      const id = f.replace(/\.glb$/, ''), meta = SOURCES[slug], category = categorize(slug, id);
      const tags = [...new Set([...id.split(/[-_]/).map((s) => s.toLowerCase()), category, ...TAGS[slug]])];
      if (i.animations.length) tags.push('animated');
      out.push({
        id: `${slug}/${id}`, file: `models/${slug}/${f}`, packed: `packed/${slug}/${f}`,
        source: meta.source, license: meta.license, author: meta.author, url: meta.url,
        category, tags: [...new Set(tags)], tris: i.triangles, materials: i.materials.length, textures: i.images.length,
        animations: i.animations, size_kb: +(i.size / 1024).toFixed(1), packed_kb: +(p.size / 1024).toFixed(1),
        bbox: i.bbox ? { min: r3(i.bbox.min), max: r3(i.bbox.max), size: r3(i.bbox.size) } : null,
      });
    }
  }
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = build();
  const raw = m.reduce((a, x) => a + x.size_kb, 0), pk = m.reduce((a, x) => a + x.packed_kb, 0);
  console.log(`manifest: ${m.length} models, raw ${raw.toFixed(1)} KB (+ textures), packed ${pk.toFixed(1)} KB`);
}
