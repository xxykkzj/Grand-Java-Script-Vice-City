// Regenerates assets/README.md (including the contents table) from assets/manifest.json. Run after build-asset-manifest.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const A=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','assets')+'/';
const m=JSON.parse(fs.readFileSync(A+'manifest.json','utf8'));
const c={};m.forEach(x=>(c[x.category]??=[]).push(x));
let t='';
for(const k of Object.keys(c).sort()){t+=`\n### ${k} (${c[k].length})\n\n| Model | Source | Licence | Tris | Packed KB | Animations |\n|---|---|---|---:|---:|---|\n`;
for(const x of c[k]){const [s,n]=x.id.split('/');t+=`| ${n} | ${s} | ${x.license} | ${x.tris} | ${x.packed_kb} | ${x.animations.length||'-'} |\n`;}}
const B='`'; const F=B+B+B;
const readme=`# Neon Coast asset library

Reusable, properly licensed 3D assets (glTF binary, ${B}.glb${B}) for the Neon Coast Three.js game, plus the tools that index, pack and preview them.

## Licence policy

Only assets under **CC0**, **MIT**, or **CC-BY (with attribution recorded in ${B}CREDITS.md${B})** may enter the library. Never add ripped or fan-extracted game assets, or anything whose licence we cannot point to. Every source gets its licence text in ${B}licenses/<slug>.txt${B} and an entry in ${B}CREDITS.md${B} in the same change that adds it.

## Layout

${F}
assets/
  models/<slug>/<file>.glb        original files (Kenney kits keep Textures/colormap.png beside them)
  packed/<slug>/<file>.glb        self-contained copies (texture embedded) - use these in the game
  licenses/<slug>.txt             exact licence text from the source
  manifest.json                   generated index of every model
  gallery/index.html              generated viewer (serve over http)
  inbox/                          drop-in folder for new packs (git-ignored)
  CREDITS.md
tools/
  glb-info.mjs                    inspect a GLB (node tools/glb-info.mjs file.glb)
  pack-glb.mjs                    embed external textures (node tools/pack-glb.mjs in.glb out.glb)
  build-asset-manifest.mjs        pack every model + write manifest.json
  build-gallery.mjs               bundle tools/gallery-src into gallery/index.html
  build-readme-table.mjs          regenerate this README (contents table) from manifest.json
  convert-obj.mjs                 OBJ+MTL -> GLB via obj2gltf installed outside the repo
${F}

## Adding a pack

1. Confirm the licence is CC0, MIT or CC-BY. Download the **official** zip only.
2. Put the zip in ${B}assets/inbox/${B} (see ${B}inbox/README.md${B}), extract it somewhere you do not run code from, and copy the ${B}.glb${B} files (and any texture folder they reference) to ${B}assets/models/<slug>/${B}.
3. Save the licence text to ${B}assets/licenses/<slug>.txt${B} and add the source to ${B}assets/CREDITS.md${B}.
3b. Formats other than GLB: convert first. OBJ+MTL: \`npm install --prefix /home/claude/ext/tools obj2gltf\` (outside the repo, Apache-2.0), then \`node tools/convert-obj.mjs /home/claude/ext/tools assets/models/<slug> path/*.obj\`. Only copy or convert downloaded files; never run anything from a pack.
4. Register the slug in ${B}SOURCES${B} in ${B}tools/build-asset-manifest.mjs${B} (source name, licence, author, URL) and, if needed, add category rules in ${B}RULES${B}.
5. Regenerate (below), open the gallery and check the new models.

## Regenerating

${F}
node tools/build-asset-manifest.mjs   # packs models/ -> packed/ (re-parsing each output) and writes manifest.json
node tools/build-gallery.mjs          # rebuilds assets/gallery/index.html (needs node_modules from the repo root)
node tools/build-readme-table.mjs     # refreshes the contents table in this README
python3 -m http.server 8000           # from the repo root, then open /assets/gallery/index.html
${F}

Requires Node 18+. No extra npm dependencies (uses the repo's ${B}three${B} and ${B}esbuild${B}).

## Contents (${m.length} models)
${t}`;
fs.writeFileSync(A+'README.md',readme);
