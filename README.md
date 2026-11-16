# Neon Coast

A pocket-sized 80s sunset island you can skate, ride, drive and fly around, in **one self-contained HTML file**.
Pastel art-deco hotels, palms, neon signs, live traffic and pedestrians, a patrol that chases you when you misbehave, a four-job story with cutscenes, a bar, a nightclub, a clothes shop and a corner store you can walk into, a sport bike, weather, a full day/night cycle, a synthwave soundtrack and a retro cheat console.
Every model, texture and sound is generated in code at load time: there are **0 asset files**.

An original homage to 80s open-world games. Not affiliated with or using assets from any existing game.

## Play

Just double-click `dist/index.html` (any current desktop Chrome, Edge, Firefox or Safari). No server, no install, no network. Click to start; that also unlocks audio.
The `index.html` in the repo root only redirects there, so GitHub Pages serves the game from the repo root.

To rebuild it yourself: `npm install && npm run build`, then open `dist/index.html`.

You play Skye, a roller-skating courier on Lumina Boulevard, summer 1986. The story, the cast and the full script are in [STORY.md](STORY.md).

## The story

Dee's bar, the Velvet Flamingo, owes $5,000 by Sunday. Marty Glitz at Club Prism wants the bar, and is running Saturday's $5,000 Dance-Off with the scorecards already filled in. Four short jobs: **Fizz Run**, **Paper Trail**, **Cold Feet**, **Last Dance**.

- The pulsing star on the minimap is where the next job starts. Skate into the ring at that door.
- The current objective sits under the minimap. A countdown only appears on the legs that need one.
- Fail a job (time, knocked out, caught) and you get JOB BLOWN: `Enter` retries from the last checkpoint, `Esc` drops it.
- Finishing a job shows the pass card with the reward. Finishing the story unlocks the Flamingo Royale jacket and better pay on Dee's repeatable odd jobs (`E` at her counter).
- Progress, your outfit and the outfits you own are kept in the browser's local storage. The `REWIND` code clears them.

## Places you can walk into

Each has its own coloured ring at the door on Lumina Boulevard, a short walk-in scene and an interior that is only built and drawn while you are in it. Walk into the white ring by the door to leave. While you are indoors the patrol cannot see you, so heat cools off.

| Place | Ring | Inside |
| --- | --- | --- |
| **The Velvet Flamingo** | pink | Dee's bar. Story scenes, and `E` at the counter for a timed delivery. |
| **Club Prism** | violet | Dance floor with animated light tiles, a dancing crowd, DJ Kilowatt in the booth, a mirror ball and sweeping beams. The soundtrack gets louder and gains claps and open hats. Hosts two story jobs, including the finale on the dance floor. |
| **Zigzag Threads** | orange | Step onto the podium and press `E` to try on six colourways: Courier Classic, Sunset Stripe, Midnight Arcade, Mint Condition, Cherry Bomb, Flamingo Royale. They cost cash once and are yours for good. Putting on a different outfit while wanted knocks one star off (once every 45 seconds). |
| **Pelican Pantry 24** | green | Gus's corner store. `E` at the counter: Pelican Pop ($5, +15 health), Boardwalk Hot Dog ($12, +35), Turbo Crunch Bar ($20, +60). |

## What's in town

- **Traffic.** About 26 AI cars plus Coast Patrol cars follow a lane graph built from the road layout: they keep right, turn at junctions, queue behind each other, and brake for you, for pedestrians and for red lights. You can see the drivers through the glass; headlights, tail lights and light pools on the road come on at dusk. Empty parked cars are still there for the taking.
- **Pedestrians.** 52 people in assorted outfits stroll the sidewalks and wait for the walk light at crossings. Bump them and they tumble (cartoon style) and get back up; explosions, tank fire and sirens send them running; they shout "hey!".
- **Carjacking.** Press `E` next to an occupied car: Skye opens the door and hauls the driver out, who stumbles, shakes a fist and legs it. Costs one star of heat.
- **The Comet.** An 80s sport bike with a wedge fairing. Four are parked around town (outside the Pantry, by the club, on the promenade near the start, at the foot of the pier) and two ride with the traffic. `E` to get on or off. It leans into turns, lifts the front wheel when you open the throttle from low speed, and tops out well above the cars. It is fragile: hit a wall or a car hard and you go over the bars and lose health.
- **Heat.** 0 to 5 stars. Taking an occupied car or bike, running people over, firing the tank and running a red light in view of a patrol car add stars. Bumping into other cars never does: a fender bender is just traffic. Out of the patrol's sight the stars start blinking and drop off after roughly 25 seconds. From 2 stars the teal-and-white **Coast Patrol** comes after you with lights and siren. If they pin you while you are on foot or stopped: **CAUGHT**, you wake up at the station with a fine. If your health runs out: **KNOCKED OUT**, you wake up at the Seabreeze Clinic with a bill.
- **Traffic lights** at all 15 junctions with green / amber / red per direction and walk / wait lamps. You can run reds. Don't do it in front of the patrol.
- **Weather.** Clear, cloudy, rain, thunderstorm and fog blend into each other and change by themselves every few game hours. Rain is drawn on the GPU; roads get wet, dark and reflective (lamp streaks, sky sheen, rain speckle) and dry out afterwards.
- **Day and night.** One real second is one game minute (a 24-minute day). The sun and moon cross the sky; sky, fog and light colours blend through night, dawn, day, golden hour and dusk; street lamps, neon, windows and car lights fade on at dusk and off at dawn.
- **Pickups.** Floating cash bundles and two health kits around town; they respawn.
- **HUD.** Top right: cash, health bar, heat stars and the clock. Top left: a round minimap that turns with the camera (roads, buildings, cars, bikes, patrol cars, pickups, the four doors as coloured squares, the next job as a star, the current target as a yellow diamond, a north marker), the district name and the current objective. Context hints sit bottom left.

### City detail

Chosen to make the street read as a place without adding draw calls (almost everything is merged into the existing city meshes):

- Rooftops: air-conditioning units, vents, water tanks, aerials with red beacons, satellite dishes, set-back penthouse tiers with their own neon band.
- Billboards with made-up ads on roofs and on stilts along the promenade (Flamingo Fizz, Wave 86 FM, Comet 500, Dance-Off Saturday and friends).
- Shopfronts on the back streets: striped awnings, wide lit windows, neon blade signs in five shapes.
- Door emblems in neon for the four places (flamingo, prism, zigzag, "24").
- Street furniture: benches, bins, fire hydrants, solid phone booths with a light inside.
- Ground paint: kerbs, parking bays, manhole covers, sidewalk seams, a skate lane on the promenade, a volleyball court and beach towels.
- Beach and pier: volleyball net, surfboards stuck in the sand, lifeguard chairs, crates, benches and life rings on the pier, moored boats that bob, buoys.
- Life: a flock of gulls circling the pier and the beach (one instanced mesh, animated in the vertex shader).
- Palm variety: squat and lanky palms with slightly different greens.

## Controls

| Key | On skates | Car | Comet bike | Disco Tank | Helicopter |
| --- | --- | --- | --- | --- | --- |
| `W A S D` / arrows | skate | accelerate, brake / reverse, steer | throttle (wheelie from low speed), brake, lean | drive, turn on the spot | `W`/`S` forward / back, `A`/`D` yaw |
| `Shift` | sprint | | | | |
| `Space` | jump | handbrake (drift) | | | climb |
| `C` or `Ctrl` | | | | | descend |
| `E` | get in or on the nearest vehicle, or take an occupied one | get out | get off | get out | get out (land first) |
| Mouse drag | orbit the camera | orbit | orbit | aim the turret | orbit |
| Click or `F` | | | | fire | |

Indoors: `W A S D` walk (the camera looks in from the door, so `W` is further in), `Shift` hurry, `E` at the yellow ring (Dee's counter, the podium, Gus's counter), walk into the white ring to leave. In a shop menu: `W`/`S` or arrows choose, `Enter` buys or wears, `Esc` closes.

Anywhere:

| Key | Does |
| --- | --- |
| `~` or `T` | open the cheat console |
| `N` | skip to the next part of the day (dawn, day, golden hour, dusk, night) |
| `[` / `]` | slow down / speed up the clock (frozen, x0.25, x0.5, x1, x2, x5, x15, x60) |
| `Space` / `Enter` | in a scene: finish the line, then next line |
| `X` or `Esc` | skip the scene |
| `Enter` / `Esc` | on the JOB BLOWN card: retry from the checkpoint / drop the job |
| `M` | mute |
| `P` | perf panel (FPS, draw calls, triangles, AI cars, pedestrians, page size) |

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut.

## Cheat codes

Press `~` or `T`, type a code (not case-sensitive), press Enter.

| Code | Effect |
| --- | --- |
| `HEAVYMETAL` | Drops the Disco Tank in front of you. The turret follows the camera; click or `F` fires a shell that sends cars flying (and the heat up). |
| `ROTORWASH` | Drops a helicopter in front of you. `E` to board. |
| `TWOWHEELS` | Brings a parked Comet to you. |
| `REWIND` | Forgets the saved story progress and outfits. |
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

- Built for integrated laptop graphics: a typical street frame is about 40 draw calls and roughly 205k triangles with all traffic and pedestrians on screen (about 50 draw calls inside Club Prism). No shadow maps, no post-processing. Interiors are built the first time you walk in and hidden when you leave.
- The pixel ratio is capped at 2. If it still struggles on a high-DPI screen, zoom the page in (`Ctrl` / `Cmd` + `+`) or shrink the window: fewer pixels is the big lever.
- Needs WebGL 2. Without it you get a plain explanatory message instead of a black page. Make sure hardware acceleration is switched on in the browser.
- Rendering and audio pause while the tab is hidden.
- With `prefers-reduced-motion` there are no lightning flashes, no camera bob or shake, no wheelies, steady patrol lights, static cutscene cameras and subtitles that appear whole instead of being typed.
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
- **Few draw calls.** All buildings, rooftop clutter, street furniture and beach props are merged into one mesh with vertex colours, all neon tubes into another. Windows (about 9,000), palms, street lamps, umbrellas, signal masts and signal lamps are each one `InstancedMesh`. The whole car fleet is one instanced mesh for bodies, one for glass, one for shadows, one for headlight pools; the Comets are one more. All pedestrians and drivers together are five: torsos, heads, limbs, hats, blob shadows.
- **Cheap AI.** Traffic follows lane polylines kinematically and only falls back to physics for a couple of seconds when something hits it. Neighbour queries go through a uniform spatial hash rebuilt each frame. Cars and people far from the player tick at a third or a quarter of the frame rate.
- **Textures from canvas.** The ground (roads, markings, crossings, promenade tiles, sand) is one 2048x1024 canvas; the 16 neon signs and 8 billboards share one 1024x1536 atlas.
- **Shaders.** Gradient sky with a striped sun, stars, a moon and a drifting procedural cloud deck; animated ocean with surf; windows that light up at night from a per-instance seed; palms swaying in the vertex shader; rain as wrapped line segments animated in the vertex shader; wet-road highlights computed in the ground's fragment shader from a formula for the lamp positions.
- **Cheap glow.** Lights get additive point sprites whose brightness follows the clock. Day/night and weather only ever change uniforms and colours.
- **Story as data.** `src/game/story.js` holds the cast, every line of dialogue (with its camera shot and gesture), the mission steps, the shop lists and the counter one-liners. `missions.js` plays it; `cutscene.js` is the director (letterbox, typewriter subtitles with coloured speaker names, wide / over-the-shoulder / close-up / two-shot cameras, actors that turn to face each other and gesture).
- **Interiors.** Each room is one merged unlit mesh plus a few animated extras, parked 90 units under its own building. The Club Prism dance floor is a single quad whose tiles are drawn and animated in the fragment shader; the crowd is three instanced meshes.
- **Sound.** Web Audio only: bass arpeggio, pad, pluck arp and a drum machine on a look-ahead scheduler, a low-pass on the music bus for the muffled shop radio, extra club percussion, per-character subtitle blips, plus engine, rotor, skates, rain, thunder, explosions, siren, horns, cash ticks and the pedestrians' "hey!" built from oscillators and filtered noise.

### Size

| Part | Minified |
| --- | --- |
| three.js 0.187.0 (tree-shaken) | about 574 KB |
| Game code | about 154 KB |
| HTML + CSS | about 15 KB |
| **`dist/index.html`** | **about 743 KB** |

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers, spatial grid
  world/            layout, roads + traffic lights, canvas textures, sky + ocean, city builder, details (rooftops, props,
                    billboards, boats, gulls), glow sprites, day/night + weather
  actors/           AI traffic + Coast Patrol, pedestrians + drivers
  game/             story.js (all dialogue + mission data), missions (story engine), cutscene (director),
                    interiors (the four rooms + cast), places (doors, walking indoors, shops),
                    rules (heat, cash, health, pickups, carjack)
  player/           the courier model + skating controller, follow camera
  vehicles/         car / bike / tank / helicopter models and physics, explosion particles
  cheats/           cheat console and codes
  audio/            synthesised music and effects
  ui/               minimap, cash / health / heat / clock, objective, hints, toast, perf panel
```
