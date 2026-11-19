# Neon Coast asset library

Reusable, properly licensed 3D assets (glTF binary, `.glb`) for the Neon Coast Three.js game, plus the tools that index, pack and preview them.

## Licence policy

Only assets under **CC0**, **MIT**, or **CC-BY (with attribution recorded in `CREDITS.md`)** may enter the library. Never add ripped or fan-extracted game assets, or anything whose licence we cannot point to. Every source gets its licence text in `licenses/<slug>.txt` and an entry in `CREDITS.md` in the same change that adds it.

## Layout

```
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
```

## Adding a pack

1. Confirm the licence is CC0, MIT or CC-BY. Download the **official** zip only.
2. Put the zip in `assets/inbox/` (see `inbox/README.md`), extract it somewhere you do not run code from, and copy the `.glb` files (and any texture folder they reference) to `assets/models/<slug>/`.
3. Save the licence text to `assets/licenses/<slug>.txt` and add the source to `assets/CREDITS.md`.
4. Register the slug in `SOURCES` in `tools/build-asset-manifest.mjs` (source name, licence, author, URL) and, if needed, add category rules in `RULES`.
5. Regenerate (below), open the gallery and check the new models.

## Regenerating

```
node tools/build-asset-manifest.mjs   # packs models/ -> packed/ (re-parsing each output) and writes manifest.json
node tools/build-gallery.mjs          # rebuilds assets/gallery/index.html (needs node_modules from the repo root)
python3 -m http.server 8000           # from the repo root, then open /assets/gallery/index.html
```

Requires Node 18+. No extra npm dependencies (uses the repo's `three` and `esbuild`).

## Contents (44 models)

### building (5)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| building-garage | kenney-city-builder | MIT | 196 | 28.6 | - |
| building-small-a | kenney-city-builder | MIT | 452 | 48.6 | - |
| building-small-b | kenney-city-builder | MIT | 600 | 58.5 | - |
| building-small-c | kenney-city-builder | MIT | 834 | 78.3 | - |
| building-small-d | kenney-city-builder | MIT | 448 | 48.3 | - |

### character (2)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| character | kenney-platformer | MIT | 550 | 94.8 | 4 |
| RobotExpressive | quaternius-robot-expressive | CC0-1.0 | 3237 | 453.1 | 14 |

### decoration (3)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| decoration-empty | kenney-racing | MIT | 596 | 64.5 | - |
| decoration-forest | kenney-racing | MIT | 2006 | 195.3 | - |
| decoration-tents | kenney-racing | MIT | 1900 | 174.1 | - |

### fx (2)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| brick-particle | kenney-platformer | MIT | 44 | 16.4 | - |
| dust | kenney-platformer | MIT | 336 | 43.5 | - |

### nature (6)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| grass-trees-tall | kenney-city-builder | MIT | 472 | 55.8 | - |
| grass-trees | kenney-city-builder | MIT | 380 | 47.2 | - |
| grass | kenney-city-builder | MIT | 30 | 14.4 | - |
| cloud | kenney-platformer | MIT | 204 | 33.1 | - |
| grass-small | kenney-platformer | MIT | 72 | 18.7 | - |
| grass | kenney-platformer | MIT | 72 | 18.7 | - |

### platform (8)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| block-coin | kenney-platformer | MIT | 788 | 74.4 | - |
| brick | kenney-platformer | MIT | 188 | 31.8 | - |
| flag | kenney-platformer | MIT | 132 | 22.9 | - |
| platform-falling | kenney-platformer | MIT | 180 | 26.5 | - |
| platform-grass-large-round | kenney-platformer | MIT | 124 | 20.9 | - |
| platform-large | kenney-platformer | MIT | 254 | 33.4 | - |
| platform-medium | kenney-platformer | MIT | 188 | 27.4 | - |
| platform | kenney-platformer | MIT | 144 | 22.9 | - |

### prop (1)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| coin | kenney-platformer | MIT | 252 | 31.5 | - |

### road (7)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| pavement-fountain | kenney-city-builder | MIT | 152 | 23.6 | - |
| pavement | kenney-city-builder | MIT | 20 | 13.4 | - |
| road-corner | kenney-city-builder | MIT | 126 | 20.7 | - |
| road-intersection | kenney-city-builder | MIT | 154 | 22.7 | - |
| road-split | kenney-city-builder | MIT | 100 | 19.1 | - |
| road-straight-lightposts | kenney-city-builder | MIT | 190 | 27.7 | - |
| road-straight | kenney-city-builder | MIT | 54 | 15.9 | - |

### track (5)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| track-bump | kenney-racing | MIT | 166 | 27.5 | - |
| track-corner | kenney-racing | MIT | 1136 | 111.1 | - |
| track-finish | kenney-racing | MIT | 274 | 34 | - |
| track-straight | kenney-racing | MIT | 106 | 20.8 | - |
| track-tents | kenney-racing | MIT | 1900 | 174.1 | - |

### vehicle (5)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| vehicle-motorcycle | kenney-racing | MIT | 960 | 104.8 | - |
| vehicle-truck-green | kenney-racing | MIT | 1104 | 111.6 | - |
| vehicle-truck-purple | kenney-racing | MIT | 814 | 86.6 | - |
| vehicle-truck-red | kenney-racing | MIT | 946 | 100.1 | - |
| vehicle-truck-yellow | kenney-racing | MIT | 989 | 101.1 | - |
