# Neon Coast

A pocket-sized 80s sunset island you can skate, drive and fly around, in **one self-contained HTML file**.
Pastel art-deco hotels, palms, neon signs, a synthwave soundtrack and a retro cheat console.
Every model, texture and sound is generated in code at load time: there are **0 asset files**.

An original homage to 80s open-world games. Not affiliated with or using assets from any existing game.

## Play

Open `dist/index.html` in a desktop browser (double-click it, or serve the repo with GitHub Pages). Click to start; that also unlocks audio.

You play Skye, a roller-skating courier on Lumina Boulevard.

| Key | On skates | Car | Disco Tank | Helicopter |
| --- | --- | --- | --- | --- |
| `W A S D` / arrows | skate | accelerate, brake / reverse, steer | drive, turn on the spot | `W`/`S` forward / back, `A`/`D` yaw |
| `Shift` | sprint | | | |
| `Space` | jump | handbrake (drift) | | climb |
| `C` or `Ctrl` | | | | descend |
| `E` | get in the nearest vehicle | get out | get out | get out (land first) |
| Mouse drag | orbit the camera | orbit | aim the turret | orbit |
| Click or `F` | | | fire | |

Anywhere: `~` or `T` opens the cheat console, `N` skips to the next time of day (day, sunset, night), `M` mutes, `P` toggles the perf panel (FPS, draw calls, triangles, page size).

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut.

## Cheat codes

Press `~` or `T`, type a code (not case-sensitive), press Enter.

| Code | Effect |
| --- | --- |
| `HEAVYMETAL` | Drops the Disco Tank in front of you. The turret follows the camera; click or `F` fires a shell that sends parked cars flying. |
| `ROTORWASH` | Drops a helicopter in front of you. `E` to board. |
| `NIGHTSHIFT` | Toggles night: neon, lit windows, stars. |
| `STORMFRONT` | Toggles rain, thunder and lightning. |
| `MOONBOOTS` | Toggles low gravity for jumps. |
| `NEONRIDE` | Paints every car hot pink and makes it glow (toggle). |
| `HELP` | Lists the codes in the console. |

## Build

```sh
npm install && npm run build
```

then open `dist/index.html`. `npm run dev` rebuilds (unminified) whenever a file in `src/` changes.

`build.mjs` bundles `src/main.js` with esbuild (minified IIFE) and inlines it into the `src/index.html` template. `dist/index.html` is committed so the game can be opened straight from the repo.

## How it works

- **Single file.** No images, models, audio files, fonts or CDN requests. System font stacks only.
- **Procedural town.** `src/world/layout.js` lays out the island from a seeded random generator; the ground, the collision boxes and the minimap are all drawn from that one description.
- **Few draw calls.** All buildings are merged into one mesh with vertex colours, all neon tubes into another. Windows (about 9,000), palms, street lamps, beach umbrellas and the car fleet are each one `InstancedMesh`. A typical frame is 20 to 30 draw calls and about 130k triangles.
- **Textures from canvas.** The ground (roads, markings, promenade tiles, sand) is one 2048x1024 canvas; the 16 neon signs share one 1024x1024 atlas.
- **Shaders.** Gradient sky with a striped sun, stars and moon; animated ocean with surf at the shoreline; windows that light up at night from a per-instance seed; palms swaying in the vertex shader; rain as wrapped line segments.
- **Cheap glow.** No post-processing. Lights get additive point sprites whose brightness follows the clock. No realtime shadows, just blob shadows.
- **Sound.** Web Audio only: bass arpeggio, pad, pluck arp and a drum machine on a look-ahead scheduler, plus engine, rotor, skates, rain, thunder and explosions built from oscillators and filtered noise.
- **Considerate.** `prefers-reduced-motion` removes camera bob, shake and lightning flashes; rendering and audio pause when the tab is hidden; there is a plain fallback message without WebGL.

### Size

| Part | Minified |
| --- | --- |
| three.js 0.187.0 (tree-shaken) | about 571 KB |
| Game code | about 62 KB |
| HTML + CSS | about 9 KB |
| **`dist/index.html`** | **about 641 KB** |

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers
  world/            layout, canvas textures, sky + ocean, city builder, glow sprites, day/night + weather
  player/           the courier model + skating controller, follow camera
  vehicles/         car / tank / helicopter models and physics, explosion particles
  cheats/           cheat console and codes
  audio/            synthesised music and effects
  ui/               clock, minimap, hints, toast, perf panel
```
