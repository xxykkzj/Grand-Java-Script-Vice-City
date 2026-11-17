# Neon Coast

A pocket-sized 80s sunset island you can skate, ride, drive and fly around, in **one self-contained HTML file**.
Pastel art-deco hotels, palms, neon signs, live traffic and pedestrians, a patrol that chases you when you misbehave, a four-job story with cutscenes, a bar, a nightclub, a clothes shop and a corner store you can walk into, a sport bike, weather, a full day/night cycle, a synthwave soundtrack and a retro cheat console.
Every model, texture and sound is generated in code at load time: there are **0 asset files**.

An original homage to 80s open-world games. Not affiliated with or using assets from any existing game.

## Play

Just double-click `dist/index.html` (any current desktop Chrome, Edge, Firefox or Safari). No server, no install, no network. Click to start; that also unlocks audio.
The `index.html` in the repo root only redirects there, so GitHub Pages serves the game from the repo root. **That GitHub Pages link also works on phones and tablets** (portrait or landscape) with the on-screen touch controls.

**Choosing controls.** The title screen has a *Keyboard & mouse* / *Touch controls* choice. It is pre-selected for your device (touch on phones and tablets) and remembered on that device. You can change it any time with the gear button under the clock (top right), which also pauses the game.

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
| **Club Prism** | violet | A big room on one shared beat: DJ Kilowatt on a raised booth (decks, a mixer of blinking LEDs, speaker stacks that thump with the kick), a light-tile floor whose pattern changes every bar, a mirror ball throwing moving spots, lasers through the haze, a bar with a bartender, booths, a roped-off VIP corner, a coat check and a crowd of 29 (dancing in time with eight moves, sipping at the bar, sitting in the booths). Its own club track. **You can dance here** (see below). Hosts two story jobs, including the dance-off finale. |
| **Zigzag Threads** | orange | Step onto the podium and press `E` to try on six colourways: Courier Classic, Sunset Stripe, Midnight Arcade, Mint Condition, Cherry Bomb, Flamingo Royale. They cost cash once and are yours for good. Putting on a different outfit while wanted knocks one star off (once every 45 seconds). |
| **Pelican Pantry 24** | green | Gus's corner store. `E` at the counter: Pelican Pop ($5, +15 health), Boardwalk Hot Dog ($12, +35), Turbo Crunch Bar ($20, +60). |

## Dancing at Club Prism

Step onto the dance floor and press `F` to dance. Skye picks up the beat and the camera eases into a slow orbit (gentler with reduced motion).

- **Moves:** `1` Step-Touch, `2` Shoulder Bounce, `3` Neon Wave, `4` Turntable Spin, `5` Boardwalk Glide, `6` Sky Point, `7` Low Tide, `8` Circuit Bot. `←` / `→` step to the previous / next move, `↑` / `↓` repeat the current one. Moves blend into each other and always stay on the beat.
- **Rhythm:** the panel at the bottom shows the four beats of the bar and a ring that closes on each beat. Press a move key on the beat (PERFECT within about 60 ms, GOOD within about 125 ms) to build a **combo** and fill the **vibe** meter. Off-beat presses, or two on one beat, break the combo; so does stopping for a couple of beats. Repeating the same move over and over earns less ("MIX IT UP").
- **The room answers:** every hit flares the floor around you, nearby dancers turn to you, cheer at every fourth hit and copy your move, and every 8 in a row earns a small cash tip.
- `F` again, or `W A S D`, stops dancing.
- **Last Dance** (the finale) is now a real dance-off: fill your vibe meter before Chip Glitz fills his.

The club track (kick, clap, hats, an offbeat bass line, chord stabs, a sixteenth-note arpeggio) runs in 16-bar phrases with a 2-bar breakdown and a 2-bar build (snare roll and riser) before each drop. The floor, lasers, mirror-ball spots, speakers, LEDs and the crowd all follow the same clock, which is locked to the synth's scheduler.

## Sitting down

Walk up to a seat and press `F` (the hint shows `F: sit`): Skye sits down onto it facing the right way, then idles (looks around, leans back, on the sand lies back with arms behind the head). `F`, `E` or moving gets up. Seats: benches on the boulevard, the promenade, the pier and the sand by the pier; sun loungers and towels under the beach umbrellas; café chairs at the tables outside the Sunset Strip Diner; the bleacher steps by the volleyball court; the seawall coping; the pier edge by the rail; bar stools and booths indoors. On the beach you can also just sit on the sand anywhere (stand still first). Pedestrians use the same seats: some sit on benches and at the café, on loungers and towels and the sand by day, and the club crowd fills the booths.

## What's in town

- **Traffic.** Up to 26 AI cars plus Coast Patrol cars follow a lane graph built from the road layout: they keep right, turn at junctions, queue behind each other, and brake for you, for pedestrians and for red lights. You can see the drivers through the glass; headlights, tail lights and light pools on the road come on at dusk. Empty parked cars are still there for the taking.
- **Pedestrians.** Up to 52 people in assorted outfits stroll the sidewalks and wait for the walk light at crossings. Bump them and they tumble (cartoon style) and get back up; explosions, tank fire and sirens send them running; they shout "hey!".
- **Rush hour and nightlife.** Traffic and crowds follow the clock: busiest in the 07:00-09:00 and 17:00-19:00 rush, moderate through the day, a lively evening on the boulevard, and nearly empty streets between about 01:00 and 05:00 (a handful of cars, a few late walkers). Cars and people are parked or brought back only out of sight (far away, behind you or behind a building), so nobody pops in or out in view. At night a crowd hangs around outside Club Prism and the Velvet Flamingo; by day people sit and sunbathe by the umbrellas on the beach. The `P` panel shows the live counts next to the target for the hour.
- **Carjacking.** Press `E` next to an occupied car: Skye opens the door and hauls the driver out, who stumbles, shakes a fist and legs it. Costs one star of heat.
- **The Comet.** An 80s sport bike with a wedge fairing. Four are parked around town (outside the Pantry, by the club, on the promenade near the start, at the foot of the pier) and two ride with the traffic. `E` to get on or off. It leans into turns, lifts the front wheel when you open the throttle from low speed, and tops out well above the cars. It is fragile: hit a wall or a car hard and you go over the bars and lose health.
- **Heat.** 0 to 5 stars. Taking an occupied car or bike, running people over, firing the tank and running a red light in view of a patrol car add stars. Bumping into other cars never does: a fender bender is just traffic. Out of the patrol's sight the stars start blinking and drop off after roughly 25 seconds. From 2 stars the teal-and-white **Coast Patrol** comes after you with lights and siren. If they pin you while you are on foot or stopped: **CAUGHT**, you wake up at the station with a fine. If your health runs out: **KNOCKED OUT**, you wake up at the Seabreeze Clinic with a bill.
- **Traffic lights** at all 15 junctions with green / amber / red per direction and walk / wait lamps. You can run reds. Don't do it in front of the patrol.
- **Weather.** Clear, cloudy, rain, thunderstorm and fog blend into each other and change by themselves every few game hours. Rain is drawn on the GPU; roads get wet, dark and reflective (lamp streaks, sky sheen, rain speckle) and dry out afterwards.
- **Day and night.** One real second is one game minute (a 24-minute day). The sun and moon cross the sky; sky, fog and light colours blend through night, dawn, day, golden hour and dusk; street lamps, neon, windows and car lights fade on at dusk and off at dawn.
- **Pickups.** Floating cash bundles and two health kits around town; they respawn.
- **Beach life.** Crabs scuttle sideways over the sand and dive into it when anything comes within a few metres (more of them come out at night). Sandpipers run up and down the wet sand chasing the wave edge and burst into short flights when approached; most leave at night and they huddle under the lifeguard huts when it rains. Pelicans sit on the pier posts, stretch their wings now and then, and one takes off for a lazy glide over the water. A friendly beach dog trots about, runs over when you are on foot nearby, follows you for a bit, then wanders off. Around dusk a few sea turtles surface in the shallows. Cars and pedestrians only ever make them scatter. Quiet synthesised gull cries, peeps and a woof.
- **The edge of the world.** The island ends at things you can see: a seawall with a railing and lamps around the city, banks of rocks where the beach meets the sides, and the surf. Lumina Boulevard runs west onto a causeway stub that stops at a storm closure (water barriers, sawhorses, cones, flashing amber lamps, a CAUSEWAY CLOSED – STORM REPAIRS sign, a repair barge in the missing span); the east end is a turnaround at the wall, and the other streets end at chevron boards and bollards. On the horizon: a mainland skyline across the bay, the Key (a little island town at the far end of the old causeway, with traffic lights streaming to the mainland at night), a hilly island to the south-east, a lighthouse with a turning beam and a cargo ship crawling along the horizon. Windows light up and twinkle at night; everything fades into the sea haze, and the sky melts into the fogged ocean so the water has no visible edge. The helicopter can fly well out to sea (about 700 m from the town centre); past that a TURNING BACK: LOW FUEL warning eases it round and pushes it home. You can only step out of it over land.
- **Solid street furniture.** Palms, street lamps, signal masts, benches, bins, hydrants, phone booths, umbrella poles, lifeguard huts and chairs, volleyball posts, billboard stilts, surfboards, café tables, pier crates and the pier rail all block you, and cars stop against them (a thud and a small bounce, never any heat; a hard hit on the Comet still throws you). The helicopter only minds the tall ones, and only when low. You can still jump over the low ones on skates. Traffic and pedestrians follow their own lanes and sidewalks, so they never snag on them.
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
| `F` | sit down near a seat or on the sand, get up; on the club dance floor: dance | | | fire | |
| Mouse drag | orbit the camera | orbit | orbit | aim the turret | orbit |
| Click | | | | fire | |

Indoors: `W A S D` walk (the camera looks in from the door, so `W` is further in), `Shift` hurry, `E` at the yellow ring (Dee's counter, the podium, Gus's counter), `F` to sit on a stool or a booth or to dance on the club floor, walk into the white ring to leave. In a shop menu: `W`/`S` or arrows choose, `Enter` buys or wears, `Esc` closes.

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
| `P` | perf panel (FPS, draw calls, triangles, AI cars and pedestrians with the target for the hour, animals, page size) |
| `V` | switch camera: third person, close third person, first person (remembered between visits). In first person, vehicles get a cockpit: pillars and a dashboard with live gauges in cars, handlebars and a speedo on the bike, canopy frame and altimeter in the helicopter, a vision slit and reticle in the tank |

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut.

## Touch controls

- **Left thumb:** touch anywhere on the left half and a stick appears under your thumb. It skates or walks; in a car, on the Comet, in the tank or the helicopter it steers and gives throttle (pull back to brake or reverse). Push it all the way out to sprint on foot.
- **Right side:** swipe on the empty right half to turn the camera (or look around in first person, or aim the tank's turret).
- **Buttons, bottom right:** they change with what you are doing and match the keyboard: **Jump**; **Enter / Ride / Take** (`E`) next to a vehicle; **Sit / Dance** (`F`) near a seat or on the club floor; **Use** (`E`) at a counter; in a car **Drift** (handbrake), **Brake** and **Exit**; on the bike **Brake** and **Get off**; in the tank **Fire**; in the helicopter **Up**, **Down** and **Exit** (**Land** in the air); in a scene **Next** and **Skip**; on the JOB BLOWN card **Retry** and **Drop**.
- **Top right:** **View** (camera view, like `V`), **Codes** (the cheat console with a tappable list of every code; tap the input line if you would rather type), **Mute**, and the gear (pause + controls).
- **Dancing:** a ring of eight move buttons round a **Stop** button. Tap a move on the beat, just like the number keys; the beat panel sits bottom left.
- **Shops:** tap a line to pick it (and try it on), tap it again or **Buy** to buy, **Done** to leave.
- The page doesn't scroll, zoom or show long-press menus while you play. Touch mode hides the keyboard hints and shows only the ones that match a button. Keyboard mode hides all the touch controls, and the mouse still works in touch mode.

## Cheat codes

Press `~` or `T`, type a code (not case-sensitive), press Enter.

| Code | Effect |
| --- | --- |
| `HEAVYMETAL` | Drops the Disco Tank in front of you. The turret follows the camera; click or `F` fires a shell that sends cars flying (and the heat up). |
| `ROTORWASH` | Brings the helicopter to you. One is also parked near the start. `E` to board. |
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

- Built for integrated laptop graphics: a typical street frame is about 45 to 50 draw calls and roughly 240k triangles with all traffic, pedestrians, beach animals and the horizon on screen. Indoors the camera only renders the room's layer (the room, the courier, the rings), so Club Prism with its whole crowd, lasers and lights is about 22 draw calls. No shadow maps, no post-processing. Interiors are built the first time you walk in and hidden when you leave.
- The pixel ratio is capped at 2 (1.5 on phones and tablets), and it is checked again whenever the window, the zoom or the screen changes. If it still struggles on a high-DPI screen, zoom the page in (`Ctrl` / `Cmd` + `+`) or shrink the window: fewer pixels is the big lever.
- Needs WebGL 2. Without it you get a plain explanatory message instead of a black page. Make sure hardware acceleration is switched on in the browser.
- Rendering and audio pause while the tab is hidden.
- With `prefers-reduced-motion` there are no lightning flashes, no camera bob or shake, no wheelies, steady patrol lights, static cutscene cameras and subtitles that appear whole instead of being typed.
- The HUD (minimap, info stack, hints, dance panel, console, toasts, title screen, scene subtitles) scales and moves with the window in CSS, from small phones in portrait up to 1440p desktops. It keeps clear of notches and rounded corners (`viewport-fit=cover` and the safe-area insets).

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
- **Daily curves.** `TRAFFIC_CURVE` (actors/traffic.js) and `CROWD_CURVE` (actors/peds.js) give the share of the fleet and the crowd out at each hour; a small manager parks or returns one car or person at a time, only where the camera cannot see (`unseen` / `outOfSight` in core/util.js).
- **Animals.** `src/actors/animals.js`: one InstancedMesh per species. Legs, wings, flippers and the dog's tail are moved in the vertex shader from a per-instance action attribute; the meshes are hidden and the logic idles when the camera is far from the beach.
- **Horizon.** `src/world/horizon.js`: all distant scenery is one merged mesh with its own distance haze and night windows, plus one point-light set (also used for the closure's flashing lamps) and the lighthouse beam. The ocean plane follows the camera out to the far plane. `src/world/edges.js` builds the seawall, rocks, causeway stub and dead ends into the city's merged meshes, and `clampToWorld` in layout.js lines up with them.
- **Cheap AI.** Traffic follows lane polylines kinematically and only falls back to physics for a couple of seconds when something hits it. Neighbour queries go through a uniform spatial hash rebuilt each frame. Cars and people far from the player tick at a third or a quarter of the frame rate.
- **Textures from canvas.** The ground (roads, markings, crossings, promenade tiles, sand) is one 2048x1024 canvas; the 16 neon signs, 8 billboards and 2 edge signs share one 1024x1664 atlas.
- **Shaders.** Gradient sky with a striped sun, stars, a moon and a drifting procedural cloud deck; animated ocean with surf; windows that light up at night from a per-instance seed; palms swaying in the vertex shader; rain as wrapped line segments animated in the vertex shader; wet-road highlights computed in the ground's fragment shader from a formula for the lamp positions.
- **Cheap glow.** Lights get additive point sprites whose brightness follows the clock. Day/night and weather only ever change uniforms and colours.
- **Story as data.** `src/game/story.js` holds the cast, every line of dialogue (with its camera shot and gesture), the mission steps, the shop lists and the counter one-liners. `missions.js` plays it; `cutscene.js` is the director (letterbox, typewriter subtitles with coloured speaker names, wide / over-the-shoulder / close-up / two-shot cameras, actors that turn to face each other and gesture).
- **Interiors.** Each room is one merged unlit mesh plus a few animated extras, parked 90 units under its own building, on its own render layer. The Club Prism dance floor is a single quad whose tiles, per-bar patterns, breakdown and build are drawn in the fragment shader; the lasers and haze are additive meshes animated in their shaders; the mirror-ball spots are one instanced quad (rays from the ball to the walls, worked out on the CPU); the crowd of 29 is four instanced meshes (torsos, heads, arms, legs) posed from the same move library as the courier (`src/actors/moves.js`). One music clock (`beatU` in core/util.js) is free-running on real time and pulled onto the synth's scheduler position every frame; key presses are judged against it to the millisecond, between frames too.
- **Props and seats.** `src/world/props.js`: the world builders register each solid prop as a circle or a box and each seat as a point (or a line, like the seawall); a static spatial grid means the courier and cars only test the handful in their own cells. `src/game/activity.js` does sitting and dancing.
- **Sound.** Web Audio only: bass arpeggio, pad, pluck arp and a drum machine on a look-ahead scheduler, a low-pass on the music bus for the muffled shop radio, Club Prism's own phrase-structured track, per-character subtitle blips, plus engine, rotor, skates, rain, thunder, explosions, siren, horns, cash ticks and the pedestrians' "hey!" built from oscillators and filtered noise.

### Size

| Part | Minified |
| --- | --- |
| three.js 0.187.0 (tree-shaken) | about 576 KB |
| Game code | about 238 KB |
| HTML + CSS | about 29 KB |
| **`dist/index.html`** | **about 845 KB** |

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers, spatial grid
  world/            layout, roads + traffic lights, canvas textures, sky + ocean, city builder, details (rooftops, props,
                    billboards, boats, gulls), edges (seawall, causeway closure), horizon (distant scenery),
                    glow sprites, day/night + weather, props (solid street furniture + seats, spatial grid)
  actors/           AI traffic + Coast Patrol, pedestrians + drivers, beach animals, dance moves (shared by courier and crowd)
  game/             story.js (all dialogue + mission data), missions (story engine), cutscene (director), activity (sitting, dancing + rhythm),
                    interiors (the four rooms + cast), places (doors, walking indoors, shops),
                    rules (heat, cash, health, pickups, carjack)
  player/           the courier model + skating controller, follow camera
  vehicles/         car / bike / tank / helicopter models and physics, explosion particles
  cheats/           cheat console and codes
  audio/            synthesised music and effects
  ui/               minimap, cash / health / heat / clock, objective, hints, toast, perf panel; touch.js: touch controls,
                    control-mode choice, pause + settings
```
