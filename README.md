# Neon Coast

A pocket-sized 80s sunset island you can skate, drive and fly around, in **one self-contained HTML file**.
Pastel art-deco hotels, palms, neon signs, live traffic and pedestrians, a patrol that chases you when you misbehave, a neon bar that hands out delivery jobs, weather, a full day/night cycle, a synthwave soundtrack and a retro cheat console.
Every model, texture and sound is generated in code at load time: there are **0 asset files**.

An original homage to 80s open-world games. Not affiliated with or using assets from any existing game.

## Play

Just double-click `dist/index.html` (any current desktop Chrome, Edge, Firefox or Safari). No server, no install, no network. Click to start; that also unlocks audio.

To rebuild it yourself: `npm install && npm run build`, then open `dist/index.html`.

You play Skye, a roller-skating courier on Lumina Boulevard.

## What's in town

- **Traffic.** About 26 AI cars plus Coast Patrol cars follow a lane graph built from the road layout: they keep right, turn at junctions, queue behind each other, and brake for you, for pedestrians and for red lights. You can see the drivers through the glass; headlights, tail lights and light pools on the road come on at dusk. Empty parked cars are still there for the taking.
- **Pedestrians.** 52 people in assorted outfits stroll the sidewalks and wait for the walk light at crossings. Bump them and they tumble (cartoon style) and get back up; explosions, tank fire and sirens send them running; they shout "hey!".
- **Carjacking.** Press `E` next to an occupied car: Skye opens the door and hauls the driver out, who stumbles, shakes a fist and legs it. Costs one star of heat.
- **Heat.** 0 to 5 stars. Carjacking, knocking people over, ramming cars, firing the tank and running a red light in view of a patrol car all add stars. Out of the patrol's sight the stars start blinking and drop off after roughly 25 seconds. From 2 stars the teal-and-white **Coast Patrol** comes after you with lights and siren. If they pin you while you are on foot or stopped: **CAUGHT**, you wake up at the station with a fine. If your health runs out: **KNOCKED OUT**, you wake up at the Seabreeze Clinic with a bill.
- **The Velvet Flamingo.** The bar with the neon flamingo on the boulevard. Skate into the pink ring of light at its door for a short letterboxed cutscene (skip with `Space` / `Enter`) in which Dee, the bartender, gives you a timed delivery. Follow the yellow diamond on the minimap to the yellow ring. Cash on delivery; come back for another.
- **Traffic lights** at all 15 junctions with green / amber / red per direction and walk / wait lamps. You can run reds. Don't do it in front of the patrol.
- **Weather.** Clear, cloudy, rain, thunderstorm and fog blend into each other and change by themselves every few game hours. Rain is drawn on the GPU; roads get wet, dark and reflective (lamp streaks, sky sheen, rain speckle) and dry out afterwards.
- **Day and night.** One real second is one game minute (a 24-minute day). The sun and moon cross the sky; sky, fog and light colours blend through night, dawn, day, golden hour and dusk; street lamps, neon, windows and car lights fade on at dusk and off at dawn.
- **Pickups.** Floating cash bundles and two health kits around town; they respawn.
- **HUD.** Top left: a round minimap that turns with the camera (roads, buildings, cars, patrol cars, pickups, the bar, the delivery target, a north marker) and beside it the clock, cash, health bar and heat stars. Context hints sit bottom left.

## Controls

| Key | On skates | Car | Disco Tank | Helicopter |
| --- | --- | --- | --- | --- |
| `W A S D` / arrows | skate | accelerate, brake / reverse, steer | drive, turn on the spot | `W`/`S` forward / back, `A`/`D` yaw |
| `Shift` | sprint | | | |
| `Space` | jump | handbrake (drift) | | climb |
| `C` or `Ctrl` | | | | descend |
| `E` | get in the nearest vehicle, or take an occupied car | get out | get out | get out (land first) |
| Mouse drag | orbit the camera | orbit | aim the turret | orbit |
| Click or `F` | | | fire | |

Anywhere:

| Key | Does |
| --- | --- |
| `~` or `T` | open the cheat console |
| `N` | skip to the next part of the day (dawn, day, golden hour, dusk, night) |
| `[` / `]` | slow down / speed up the clock (frozen, x0.25, x0.5, x1, x2, x5, x15, x60) |
| `Space` / `Enter` | skip a cutscene |
| `M` | mute |
| `P` | perf panel (FPS, draw calls, triangles, AI cars, pedestrians, page size) |

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut.

## Cheat codes

Press `~` or `T`, type a code (not case-sensitive), press Enter.

| Code | Effect |
| --- | --- |
| `HEAVYMETAL` | Drops the Disco Tank in front of you. The turret follows the camera; click or `F` fires a shell that sends cars flying (and the heat up). |
| `ROTORWASH` | Drops a helicopter in front of you. `E` to board. |
| `NIGHTSHIFT` | Toggles night: neon, lit windows, stars. |
| `STORMFRONT` | Toggles a thunderstorm: rain, lightning, thunder, wet roads. |
| `CLEARSKIES` | Clear weather. |
| `GREYSKIES` | Overcast. |
| `DRIZZLE` | Steady rain and wet roads, no lightning. |
| `PEASOUP` | Thick fog. |
| `MOONBOOTS` | Toggles low gravity for jumps. |
| `NEONRIDE` | Paints every car hot pink and makes it glow (toggle). |
| `LOWPROFILE` | Clears your heat. |
| `TIPJAR` | +$500. |
| `HELP` | Lists the codes in the console. |

A forced weather holds for about four game hours before the sky starts making its own mind up again.

## Hardware notes

- Built for integrated laptop graphics: a typical frame is about 35 to 45 draw calls and roughly 175k triangles with all traffic and pedestrians on screen. No shadow maps, no post-processing.
- The pixel ratio is capped at 2. If it still struggles on a high-DPI screen, zoom the page in (`Ctrl` / `Cmd` + `+`) or shrink the window: fewer pixels is the big lever.
- Needs WebGL 2. Without it you get a plain explanatory message instead of a black page. Make sure hardware acceleration is switched on in the browser.
- Rendering and audio pause while the tab is hidden.
- With `prefers-reduced-motion` there are no lightning flashes, no camera bob or shake, steady patrol lights and gentler cutscene cameras.
- Keyboard and mouse only; no touch controls.

## Build

```sh
npm install && npm run build
```

then open `dist/index.html`. `npm run dev` rebuilds (unminified) whenever a file in `src/` changes.

`build.mjs` bundles `src/main.js` with esbuild (minified IIFE) and inlines it into the `src/index.html` template. `dist/index.html` is committed so the game can be opened straight from the repo.

## How it works

- **Single file.** No images, models, audio files, fonts or CDN requests. System font stacks only.
- **Procedural town.** `src/world/layout.js` lays out the island from a seeded random generator; the ground, the collision boxes and the minimap are all drawn from that one description. `src/world/roads.js` derives the lane graph and signal timing from the same road numbers.
- **Few draw calls.** All buildings are merged into one mesh with vertex colours, all neon tubes into another. Windows (about 9,000), palms, street lamps, umbrellas, signal masts and signal lamps are each one `InstancedMesh`. The whole car fleet is one instanced mesh for bodies, one for glass, one for shadows, one for headlight pools. All pedestrians and drivers together are five: torsos, heads, limbs, hats, blob shadows.
- **Cheap AI.** Traffic follows lane polylines kinematically and only falls back to physics for a couple of seconds when something hits it. Neighbour queries go through a uniform spatial hash rebuilt each frame. Cars and people far from the player tick at a third or a quarter of the frame rate.
- **Textures from canvas.** The ground (roads, markings, crossings, promenade tiles, sand) is one 2048x1024 canvas; the 16 neon signs share one 1024x1024 atlas.
- **Shaders.** Gradient sky with a striped sun, stars, a moon and a drifting procedural cloud deck; animated ocean with surf; windows that light up at night from a per-instance seed; palms swaying in the vertex shader; rain as wrapped line segments animated in the vertex shader; wet-road highlights computed in the ground's fragment shader from a formula for the lamp positions.
- **Cheap glow.** Lights get additive point sprites whose brightness follows the clock. Day/night and weather only ever change uniforms and colours.
- **Sound.** Web Audio only: bass arpeggio, pad, pluck arp and a drum machine on a look-ahead scheduler, plus engine, rotor, skates, rain, thunder, explosions, siren, horns, cash ticks and the pedestrians' "hey!" built from oscillators and filtered noise.

### Size

| Part | Minified |
| --- | --- |
| three.js 0.187.0 (tree-shaken) | about 572 KB |
| Game code | about 104 KB |
| HTML + CSS | about 13 KB |
| **`dist/index.html`** | **about 690 KB** |

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers, spatial grid
  world/            layout, roads + traffic lights, canvas textures, sky + ocean, city builder, glow sprites, day/night + weather
  actors/           AI traffic + Coast Patrol, pedestrians + drivers
  game/             heat, cash, health, pickups, carjack, the delivery job; bar interior + cutscene
  player/           the courier model + skating controller, follow camera
  vehicles/         car / tank / helicopter models and physics, explosion particles
  cheats/           cheat console and codes
  audio/            synthesised music and effects
  ui/               clock, minimap, hints, toast, perf panel
```
