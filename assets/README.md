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
  build-readme-table.mjs          regenerate this README (contents table) from manifest.json
  convert-obj.mjs                 OBJ+MTL -> GLB via obj2gltf installed outside the repo
```

## Adding a pack

1. Confirm the licence is CC0, MIT or CC-BY. Download the **official** zip only.
2. Put the zip in `assets/inbox/` (see `inbox/README.md`), extract it somewhere you do not run code from, and copy the `.glb` files (and any texture folder they reference) to `assets/models/<slug>/`.
3. Save the licence text to `assets/licenses/<slug>.txt` and add the source to `assets/CREDITS.md`.
3b. Formats other than GLB: convert first. OBJ+MTL: `npm install --prefix /home/claude/ext/tools obj2gltf` (outside the repo, Apache-2.0), then `node tools/convert-obj.mjs /home/claude/ext/tools assets/models/<slug> path/*.obj`. Only copy or convert downloaded files; never run anything from a pack.
4. Register the slug in `SOURCES` in `tools/build-asset-manifest.mjs` (source name, licence, author, URL) and, if needed, add category rules in `RULES`.
5. Regenerate (below), open the gallery and check the new models.

## Regenerating

```
node tools/build-asset-manifest.mjs   # packs models/ -> packed/ (re-parsing each output) and writes manifest.json
node tools/build-gallery.mjs          # rebuilds assets/gallery/index.html (needs node_modules from the repo root)
node tools/build-readme-table.mjs     # refreshes the contents table in this README
python3 -m http.server 8000           # from the repo root, then open /assets/gallery/index.html
```

Requires Node 18+. No extra npm dependencies (uses the repo's `three` and `esbuild`).

## Contents (149 models)

### building (26)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| building-garage | kenney-city-builder | MIT | 196 | 28.6 | - |
| building-small-a | kenney-city-builder | MIT | 452 | 48.6 | - |
| building-small-b | kenney-city-builder | MIT | 600 | 58.5 | - |
| building-small-c | kenney-city-builder | MIT | 834 | 78.3 | - |
| building-small-d | kenney-city-builder | MIT | 448 | 48.3 | - |
| house_type01 | kenney-city-suburban | CC0-1.0 | 340 | 21.6 | - |
| house_type02 | kenney-city-suburban | CC0-1.0 | 766 | 50.1 | - |
| house_type03 | kenney-city-suburban | CC0-1.0 | 580 | 37.2 | - |
| house_type04 | kenney-city-suburban | CC0-1.0 | 344 | 24.8 | - |
| house_type05 | kenney-city-suburban | CC0-1.0 | 381 | 27.7 | - |
| house_type06 | kenney-city-suburban | CC0-1.0 | 776 | 48.4 | - |
| house_type07 | kenney-city-suburban | CC0-1.0 | 298 | 21.9 | - |
| house_type08 | kenney-city-suburban | CC0-1.0 | 688 | 48 | - |
| house_type09 | kenney-city-suburban | CC0-1.0 | 428 | 29.4 | - |
| house_type10 | kenney-city-suburban | CC0-1.0 | 718 | 47.2 | - |
| house_type11 | kenney-city-suburban | CC0-1.0 | 470 | 32.5 | - |
| house_type12 | kenney-city-suburban | CC0-1.0 | 630 | 40.6 | - |
| house_type13 | kenney-city-suburban | CC0-1.0 | 576 | 37.8 | - |
| house_type14 | kenney-city-suburban | CC0-1.0 | 442 | 31.8 | - |
| house_type15 | kenney-city-suburban | CC0-1.0 | 316 | 23 | - |
| house_type16 | kenney-city-suburban | CC0-1.0 | 346 | 25.9 | - |
| house_type17 | kenney-city-suburban | CC0-1.0 | 572 | 39 | - |
| house_type18 | kenney-city-suburban | CC0-1.0 | 496 | 31.8 | - |
| house_type19 | kenney-city-suburban | CC0-1.0 | 398 | 25.5 | - |
| house_type20 | kenney-city-suburban | CC0-1.0 | 460 | 28 | - |
| house_type21 | kenney-city-suburban | CC0-1.0 | 400 | 23.4 | - |

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

### fence (7)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| fence_large | kenney-city-suburban | CC0-1.0 | 64 | 5.3 | - |
| fence_medium | kenney-city-suburban | CC0-1.0 | 64 | 5.3 | - |
| fence_open | kenney-city-suburban | CC0-1.0 | 56 | 4.9 | - |
| fence_rectangle | kenney-city-suburban | CC0-1.0 | 64 | 5.4 | - |
| fence_short | kenney-city-suburban | CC0-1.0 | 64 | 5.3 | - |
| fence_small | kenney-city-suburban | CC0-1.0 | 64 | 5.3 | - |
| fence_wide | kenney-city-suburban | CC0-1.0 | 64 | 5.3 | - |

### fx (2)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| brick-particle | kenney-platformer | MIT | 44 | 16.4 | - |
| dust | kenney-platformer | MIT | 336 | 43.5 | - |

### light (5)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| Streetlight_Double | quaternius-street | CC0-1.0 | 2486 | 124.4 | - |
| Streetlight_Single | quaternius-street | CC0-1.0 | 1028 | 54.3 | - |
| Streetlight_Triple | quaternius-street | CC0-1.0 | 2792 | 139.1 | - |
| TrafficLight | quaternius-street | CC0-1.0 | 352 | 26 | - |
| TrafficLight_2 | quaternius-street | CC0-1.0 | 398 | 28 | - |

### nature (8)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| grass-trees-tall | kenney-city-builder | MIT | 472 | 55.8 | - |
| grass-trees | kenney-city-builder | MIT | 380 | 47.2 | - |
| grass | kenney-city-builder | MIT | 30 | 14.4 | - |
| tree_large | kenney-city-suburban | CC0-1.0 | 48 | 5 | - |
| tree_small | kenney-city-suburban | CC0-1.0 | 48 | 5 | - |
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

### prop (4)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| box | kenney-car-kit | CC0-1.0 | 124 | 25.2 | - |
| cone-flat | kenney-car-kit | CC0-1.0 | 172 | 27.7 | - |
| cone | kenney-car-kit | CC0-1.0 | 172 | 27.7 | - |
| coin | kenney-platformer | MIT | 252 | 31.5 | - |

### road (29)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| pavement-fountain | kenney-city-builder | MIT | 152 | 23.6 | - |
| pavement | kenney-city-builder | MIT | 20 | 13.4 | - |
| road-corner | kenney-city-builder | MIT | 126 | 20.7 | - |
| road-intersection | kenney-city-builder | MIT | 154 | 22.7 | - |
| road-split | kenney-city-builder | MIT | 100 | 19.1 | - |
| road-straight-lightposts | kenney-city-builder | MIT | 190 | 27.7 | - |
| road-straight | kenney-city-builder | MIT | 54 | 15.9 | - |
| driveway_long | kenney-city-suburban | CC0-1.0 | 12 | 2.7 | - |
| driveway_short | kenney-city-suburban | CC0-1.0 | 12 | 2.7 | - |
| path_long | kenney-city-suburban | CC0-1.0 | 12 | 2.7 | - |
| path_short | kenney-city-suburban | CC0-1.0 | 12 | 2.7 | - |
| path_tilesLong | kenney-city-suburban | CC0-1.0 | 76 | 6.5 | - |
| path_tilesShort | kenney-city-suburban | CC0-1.0 | 44 | 4.7 | - |
| Street_3Way | quaternius-street | CC0-1.0 | 672 | 29.7 | - |
| Street_3Way_2 | quaternius-street | CC0-1.0 | 188 | 9.9 | - |
| Street_4Way | quaternius-street | CC0-1.0 | 896 | 38.4 | - |
| Street_4Way_2 | quaternius-street | CC0-1.0 | 232 | 11.6 | - |
| Street_Bridge | quaternius-street | CC0-1.0 | 1412 | 45.9 | - |
| Street_Bridge_Ramp | quaternius-street | CC0-1.0 | 1618 | 54.1 | - |
| Street_Bridge_Underpass | quaternius-street | CC0-1.0 | 1084 | 38.2 | - |
| Street_Bridge_Water | quaternius-street | CC0-1.0 | 1412 | 46.8 | - |
| Street_Bridge_WaterRamp | quaternius-street | CC0-1.0 | 1104 | 42.9 | - |
| Street_Curve | quaternius-street | CC0-1.0 | 290 | 14.8 | - |
| Street_Deadend | quaternius-street | CC0-1.0 | 308 | 12 | - |
| Street_Elevated | quaternius-street | CC0-1.0 | 394 | 14.9 | - |
| Street_Elevated_Ramp | quaternius-street | CC0-1.0 | 362 | 19.8 | - |
| Street_Empty | quaternius-street | CC0-1.0 | 12 | 2 | - |
| Street_Empty_Water | quaternius-street | CC0-1.0 | 44 | 3 | - |
| Street_Straight | quaternius-street | CC0-1.0 | 356 | 14 | - |

### sign (3)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| Sign_NoParking | quaternius-street | CC0-1.0 | 244 | 14 | - |
| Sign_Stop | quaternius-street | CC0-1.0 | 300 | 16 | - |
| Sign_Triangle | quaternius-street | CC0-1.0 | 60 | 5.9 | - |

### track (5)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| track-bump | kenney-racing | MIT | 166 | 27.5 | - |
| track-corner | kenney-racing | MIT | 1136 | 111.1 | - |
| track-finish | kenney-racing | MIT | 274 | 34 | - |
| track-straight | kenney-racing | MIT | 106 | 20.8 | - |
| track-tents | kenney-racing | MIT | 1900 | 174.1 | - |

### vehicle (25)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| ambulance | kenney-car-kit | CC0-1.0 | 2804 | 239.3 | - |
| delivery-flat | kenney-car-kit | CC0-1.0 | 2574 | 220.7 | - |
| delivery | kenney-car-kit | CC0-1.0 | 2476 | 245.9 | - |
| firetruck | kenney-car-kit | CC0-1.0 | 2767 | 238.3 | - |
| garbage-truck | kenney-car-kit | CC0-1.0 | 3124 | 273.2 | - |
| hatchback-sports | kenney-car-kit | CC0-1.0 | 2088 | 204.5 | - |
| police | kenney-car-kit | CC0-1.0 | 2304 | 202 | - |
| race-future | kenney-car-kit | CC0-1.0 | 2068 | 180.4 | - |
| race | kenney-car-kit | CC0-1.0 | 1952 | 174.6 | - |
| sedan-sports | kenney-car-kit | CC0-1.0 | 2088 | 184.8 | - |
| sedan | kenney-car-kit | CC0-1.0 | 2032 | 179.5 | - |
| suv-luxury | kenney-car-kit | CC0-1.0 | 2086 | 183.1 | - |
| suv | kenney-car-kit | CC0-1.0 | 2474 | 214 | - |
| taxi | kenney-car-kit | CC0-1.0 | 2072 | 182.8 | - |
| tractor-police | kenney-car-kit | CC0-1.0 | 2278 | 203 | - |
| tractor-shovel | kenney-car-kit | CC0-1.0 | 2646 | 228.6 | - |
| tractor | kenney-car-kit | CC0-1.0 | 2044 | 183.1 | - |
| truck-flat | kenney-car-kit | CC0-1.0 | 2488 | 213.8 | - |
| truck | kenney-car-kit | CC0-1.0 | 2082 | 183.5 | - |
| van | kenney-car-kit | CC0-1.0 | 2082 | 182.9 | - |
| vehicle-motorcycle | kenney-racing | MIT | 960 | 104.8 | - |
| vehicle-truck-green | kenney-racing | MIT | 1104 | 111.6 | - |
| vehicle-truck-purple | kenney-racing | MIT | 814 | 86.6 | - |
| vehicle-truck-red | kenney-racing | MIT | 946 | 100.1 | - |
| vehicle-truck-yellow | kenney-racing | MIT | 989 | 101.1 | - |

### vehicle-part (22)

| Model | Source | Licence | Tris | Packed KB | Animations |
|---|---|---|---:|---:|---|
| debris-bolt | kenney-car-kit | CC0-1.0 | 36 | 16.1 | - |
| debris-bumper | kenney-car-kit | CC0-1.0 | 116 | 22.4 | - |
| debris-door-window | kenney-car-kit | CC0-1.0 | 74 | 18.8 | - |
| debris-door | kenney-car-kit | CC0-1.0 | 68 | 18.3 | - |
| debris-drivetrain-axle | kenney-car-kit | CC0-1.0 | 200 | 29.7 | - |
| debris-drivetrain | kenney-car-kit | CC0-1.0 | 412 | 47.4 | - |
| debris-nut | kenney-car-kit | CC0-1.0 | 40 | 16 | - |
| debris-plate-a | kenney-car-kit | CC0-1.0 | 40 | 16.3 | - |
| debris-plate-b | kenney-car-kit | CC0-1.0 | 44 | 16.7 | - |
| debris-plate-small-a | kenney-car-kit | CC0-1.0 | 28 | 15.5 | - |
| debris-plate-small-b | kenney-car-kit | CC0-1.0 | 44 | 16.7 | - |
| debris-spoiler-a | kenney-car-kit | CC0-1.0 | 48 | 16.9 | - |
| debris-spoiler-b | kenney-car-kit | CC0-1.0 | 88 | 19.8 | - |
| debris-tire | kenney-car-kit | CC0-1.0 | 288 | 37.3 | - |
| wheel-dark | kenney-car-kit | CC0-1.0 | 332 | 39.8 | - |
| wheel-default | kenney-car-kit | CC0-1.0 | 332 | 37.6 | - |
| wheel-racing | kenney-car-kit | CC0-1.0 | 332 | 39.8 | - |
| wheel-tractor-back | kenney-car-kit | CC0-1.0 | 428 | 47.2 | - |
| wheel-tractor-dark-back | kenney-car-kit | CC0-1.0 | 428 | 47.2 | - |
| wheel-tractor-dark-front | kenney-car-kit | CC0-1.0 | 332 | 39.9 | - |
| wheel-tractor-front | kenney-car-kit | CC0-1.0 | 332 | 39.9 | - |
| wheel-truck | kenney-car-kit | CC0-1.0 | 428 | 44.9 | - |
