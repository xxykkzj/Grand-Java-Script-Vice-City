# Neon Coast

A pocket-sized 80s sunset island you can skate, ride, drive and fly around, in **one self-contained HTML file**.
Pastel art-deco hotels, palms, neon signs, live traffic and pedestrians, a patrol with roof lasers that chases you when you misbehave, a four-job story with cutscenes, a bar, a nightclub with a booth lounge, a clothes shop, a corner store and a neon blaster shop you can walk into, vehicles that smoke, burn and blow up in cartoon style, random street events that reward good deeds, a sport bike, weather, a full day/night cycle, a synthwave soundtrack and a retro cheat console.
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
- Progress, your outfit, the outfits you own and your blasters and ammo are kept in the browser's local storage. The `REWIND` code clears them.

## Places you can walk into

Each has its own coloured ring at the door on Lumina Boulevard, a short walk-in scene and an interior that is only built and drawn while you are in it. Walk into the white ring by the door to leave. While you are indoors the patrol cannot see you, so heat cools off.

| Place | Ring | Inside |
| --- | --- | --- |
| **The Velvet Flamingo** | pink | Dee's bar. Story scenes, and `E` at the counter for a timed delivery. |
| **Club Prism** | violet | A big room on one shared beat: DJ Kilowatt on a raised booth (decks, a mixer of blinking LEDs, speaker stacks that thump with the kick), a light-tile floor whose pattern changes every bar, a mirror ball throwing moving spots, lasers through the haze, a bar with a bartender, a roped-off VIP corner and a coat check. Through a neon doorway on the right is the **booth lounge**: four curved upholstered booths round low tables with drinks and candle lamps, pendant lights, neon dividers, a softer and duller mix of the music. The crowd follows the story: before Paper Trail it is nearly empty (7 people, the DJ warming up, quieter music, dimmer lights), after it 29, and 45 for the Dance-Off. Its own club track. **You can dance here** (see below). Hosts two story jobs, including the dance-off finale; its conversations are played seated in the lounge's far booth. |
| **Zigzag Threads** | orange | Step onto the podium and press `E` to try on eleven looks: Courier Classic, Sunset Stripe, Midnight Arcade, Mint Condition, Cherry Bomb, the Neon Slip dress, the Tie-Break pleated skirt with a cropped jacket, the sequinned Mirrorball party dress, the Boardwalk Sundress, Sea Breeze Slacks and Flamingo Royale. Skirts and dresses swing with the legs while skating, sitting and dancing. They cost cash once and are yours for good. Putting on a different outfit while wanted knocks one star off (once every 45 seconds). |
| **Pelican Pantry 24** | green | Gus's corner store. `E` at the counter: Pelican Pop ($5, +15 health), Boardwalk Hot Dog ($12, +35), Turbo Crunch Bar ($20, +60). Behind the counter is a teal wall of products and a dark back counter, so Gus in his maroon Pantry polo and cap stands out. |
| **Volt & Spark Supply** | blue | Zizi Sparks's neon blaster and firework shop, east of the start on the boulevard (a lightning bolt and a firework burst in neon by the door). Small and brightly lit: a pale checked floor, a violet counter with a case of firework bangs, and behind Zizi (tangerine overalls, teal hair, goggles) a dark display wall of glowing blasters; crates of fireworks along the left wall, a practice target on the right. The first visit plays her safety talk. `E` at the counter: buy the five weapons below, or more ammo for the ones you own. Weapons and ammo are kept with your save. |

Characters indoors are lit with a soft rim light so they read against light and dark walls alike.

## Dancing at Club Prism

Step onto the dance floor and press `F` to dance. Skye picks up the beat and the camera eases into a slow orbit (gentler with reduced motion).

- **Moves:** `1` Step-Touch, `2` Shoulder Bounce, `3` Neon Wave, `4` Turntable Spin, `5` Boardwalk Glide, `6` Sky Point, `7` Low Tide, `8` Circuit Bot. `←` / `→` step to the previous / next move, `↑` / `↓` repeat the current one. Moves blend into each other and always stay on the beat.
- **Rhythm:** the panel at the bottom shows the four beats of the bar and a ring that closes on each beat. Press a move key on the beat (PERFECT within about 60 ms, GOOD within about 125 ms) to build a **combo** and fill the **vibe** meter. Off-beat presses, or two on one beat, break the combo; so does stopping for a couple of beats. Repeating the same move over and over earns less ("MIX IT UP").
- **The room answers:** every hit flares the floor around you, nearby dancers turn to you, cheer at every fourth hit and copy your move, and every 8 in a row earns a small cash tip.
- `F` again, or `W A S D`, stops dancing.
- **Last Dance** (the finale) is now a real dance-off: fill your vibe meter before Chip Glitz fills his.

The club track (kick, clap, hats, an offbeat bass line, chord stabs, a sixteenth-note arpeggio) runs in 16-bar phrases with a 2-bar breakdown and a 2-bar build (snare roll and riser) before each drop. The floor, lasers, mirror-ball spots, speakers, LEDs and the crowd all follow the same clock, which is locked to the synth's scheduler.

## Vehicle damage

Every vehicle has a condition: your car, traffic, Coast Patrol cars, the Comet, the Disco Tank and the helicopter. Crashes wear it down by how hard you hit (normal driving, scrapes and light bumps do nothing; repeated big crashes add up), and so do tank shells, patrol lasers, your blasters, firework bangs and nearby explosions.

- **Stages:** light white smoke from the bonnet (below 72 %), then grey-black smoke and a sputtering engine that coughs and loses a little top speed and acceleration (below 45 %), then flames (18 % and less). A few seconds after it catches fire it goes up in a cartoon explosion: a flash, a fireball, debris, a shockwave ring that throws loose props about, knocks nearby pedestrians off their feet (they tumble, get up and run) and damages the vehicles around it. What is left is a charred wreck that is cleared once nobody is looking. The paint darkens and the bonnet crumples and the bumpers hang askew as it goes.
- **HUD:** a condition bar under the health bar while you are in a vehicle, and a flashing **GET OUT!** while it burns. Still inside when it blows: **KNOCKED OUT**.
- **The Comet** throws you over the bars instead when it is wrecked at speed. **The helicopter** loses lift, spins down and crash-lands, then burns: get out before it goes.
- **AI drivers** pull over when their car is badly damaged and bail out and run when it catches fire. A disabled patrol car stops chasing you. Wrecking a patrol car adds a star.
- `PITSTOP` fixes whatever you are in (or the nearest vehicle).

## Neon blasters and fireworks

Bought at Volt & Spark Supply. Original toy-grade designs: they only ever damage vehicles (see above) and knock loose props about. **People are never hurt by them**: anyone near a shot or a bang flinches (ducks, arms over the head), shouts "hey!" and runs.

| # | Weapon | Price (ammo) | More ammo | How it works |
| --- | --- | --- | --- | --- |
| 1 | **Zap Popper** | $150 (60) | +60 for $40 | Compact pop blaster: fast pink bolts, short range (34 m), a little spread. Hold to keep firing. |
| 2 | **Prism Rifle** | $480 (36) | +36 for $90 | Three-shot bursts of split light, instant, very accurate, long range (75 m). |
| 3 | **Arc Coil** | $620 (24) | +24 for $110 | Short-range lightning (16 m) that jumps on to up to three more vehicles nearby, weaker each jump. |
| 4 | **Firework Bangs** | $200 (5) | +5 for $120 | Thrown in an arc on a short fuse (they also go off when a car rolls over them): a colourful burst, area damage to vehicles (7 m), props go flying, people scatter. |
| 5 | **Starfall Candle** | $750 (20) | +20 for $150 | A volley of five firework stars that curve towards the locked target and pop in small bursts. |

- **On foot:** the camera slides over your shoulder and a crosshair appears. Aim with the camera; there is a soft auto-aim at the nearest vehicle in a narrow cone (the crosshair turns pink when it locks). Click or `R` fires (hold `R` to keep firing); hold the right mouse button to look around and every left click fires straight away. `G` throws a firework bang (hold for distance).
- **In a car or on the Comet:** click / `R` fires forwards with auto-aim at whatever is ahead; `G` drops a bang behind you to shake off a chase (it goes off under whoever runs into it).
- **Switching:** `Q` or the mouse wheel cycles (including putting it away), `1`-`5` pick one (when you are not dancing). The chip under the health bar shows the weapon's icon, name and ammo.
- **Heat:** shooting a patrol car adds a star (every few seconds you keep it up), so does shooting up cars in front of a patrol car that can see it, and wrecking a patrol car. Shooting at the getaway car in a street event is fine.

## Coast Patrol lasers

From **3 stars** the patrol cars' roof-mounted pulse lasers come on. A car that can see you telegraphs first with a thin flickering aim line (about 0.6 s, with a rising hum), then fires a burst of three short neon beams. The hit chance falls with distance and with how fast you cross its line of fire, and buildings block it, so weaving and breaking line of sight work. Hits damage your vehicle; on foot they are stun shots: a little health and a brief stagger. At 4 and 5 stars there are more patrol units (up to six) and they fire faster.

## Street events

Every few minutes, when you are not on a job, not in a scene, not indoors and not wanted, something happens near you: a short toast, a couple of subtitle lines, a blinking blip on the minimap and an objective in the HUD (with a timer).

- **Bag snatcher:** someone grabs a shopper's bag and runs along the sidewalks. Chase them on foot, on skates or on the Comet and bump into them to tackle them (a cartoon tumble), pick up the bag and give it back for a share of the cash. Lost if they get too far ahead.
- **Getaway car:** a shop alarm rings and a getaway car speeds off with a patrol car in pursuit. Ram it or stop it with the damage system (blasters, bangs) until it gives up: the patrol thanks you with a reward and, if you had picked up any heat, knocks a star off. The stolen takings drop out: return them to the shopkeeper for an extra share.
- **Suspect on foot:** a patrol radio call; tackle the runner before they get away and the officer pays you.

## Sitting down

Walk up to a seat and press `F` (the hint shows `F: sit`; touch: **Sit**): Skye sits down onto it facing the right way, then idles (looks around, leans back, on the sand lies back with arms behind the head). `F`, `E` or moving gets up. Seats: benches on the boulevard, the promenade, the pier and the sand by the pier; sun loungers and towels under the beach umbrellas; café chairs at the tables outside the Sunset Strip Diner; the bleacher steps by the volleyball court; the seawall coping; the pier edge by the rail; bar stools, the club lounge booths and the VIP sofa indoors. On the beach you can also just sit on the sand anywhere (stand still first). Pedestrians use the same seats: some sit on benches and at the café, on loungers and towels and the sand by day, and the club crowd fills the booths.

## The sea

Walk off the beach and the sand shelves away: ankle-deep wading (slower, no skates), then past about 1.2 m Skye swims. Jump off the pier edge (or drive off it) for a splash.

- **Keys:** `WASD` swim, `Shift` faster stroke (uses stamina), `C` dive, `Space` rise. Underwater you swim along where the camera points. `E` climbs out at a pier ladder (three of them) or just walk up the beach.
- **Touch:** while wet the buttons become **Dive**, **Up** and (at a ladder) **Climb**; the stick swims.
- **Breath:** the bubble meter on the HUD drains while submerged (about 24 s). At zero you lose health; at 0 health the usual KNOCKED OUT flow runs. Breath refills at the surface.
- **Current:** past the reef a strong current pushes swimmers back (HUD: STRONG CURRENT). The bed drops into dark murk out there.
- **Underwater:** depth fog that darkens with depth and at night, caustics, light shafts, plankton, a wavy ceiling with a bright window, muffled sound with bubbles. Seabed: ripples, rocks, seaweed, coral, a boat wreck, tyres, a beach ball. Reduced motion calms the caustics and sway.
- **Sea life:** fish schools, rays, glowing jellyfish at night, sea turtles, dolphins leaping far offshore.
- **Sharks:** rare, likelier far from shore and at night, never in water under 2 m. A fin circles with a sting, then lunges for a chomp (health loss, splash, shake). Reach the beach or a ladder to escape. HUD shows SHARK! and a minimap blip. Firing a weapon scares it off; it is never killed.
- **Vehicles in the sea:** cars, the Comet and the tank sink slowly with bubbles (you bail out); a helicopter that lands on water sinks too. Wrecks are cleaned up later.
- **Cheats:** `HIGHTIDE` (drop into the sea), `FINSUP` (call a shark).

## What's in town

- **Traffic.** Up to 26 AI cars plus Coast Patrol cars follow a lane graph built from the road layout: they keep right, turn at junctions, queue behind each other, and brake for you, for pedestrians and for red lights. You can see the drivers through the glass; headlights, tail lights and light pools on the road come on at dusk. Empty parked cars are still there for the taking.
- **Pedestrians.** Up to 52 people in assorted outfits stroll the sidewalks and wait for the walk light at crossings. Bump them and they tumble (cartoon style) and get back up; explosions, tank fire and sirens send them running; they shout "hey!". Blaster shots and firework bangs never hurt them: they flinch, shout and run.
- **Rush hour and nightlife.** Traffic and crowds follow the clock: busiest in the 07:00-09:00 and 17:00-19:00 rush, moderate through the day, a lively evening on the boulevard, and nearly empty streets between about 01:00 and 05:00 (a handful of cars, a few late walkers). Cars and people are parked or brought back only out of sight (far away, behind you or behind a building), so nobody pops in or out in view. At night a crowd hangs around outside Club Prism and the Velvet Flamingo; by day people sit and sunbathe by the umbrellas on the beach. The `P` panel shows the live counts next to the target for the hour.
- **Carjacking.** Press `E` next to an occupied car: Skye opens the door and hauls the driver out, who stumbles, shakes a fist and legs it. Costs one star of heat.
- **The Comet.** An 80s sport bike with a wedge fairing. Four are parked around town (outside the Pantry, by the club, on the promenade near the start, at the foot of the pier) and two ride with the traffic. `E` to get on or off. It leans into turns, lifts the front wheel when you open the throttle from low speed, and tops out well above the cars. It is fragile: hit a wall or a car hard and you go over the bars and lose health.
- **Heat.** 0 to 5 stars. Taking an occupied car or bike, running people over, firing the tank, running a red light in view of a patrol car, shooting patrol cars (or cars in front of them) and wrecking a patrol car add stars. Bumping into other cars never does: a fender bender is just traffic. Out of the patrol's sight the stars start blinking and drop off after roughly 25 seconds. From 2 stars the teal-and-white **Coast Patrol** comes after you with lights and siren; from 3 stars they fire their roof lasers (see above), and at 4 and 5 stars more units join (up to six). If they pin you while you are on foot or stopped: **CAUGHT**, you wake up at the station with a fine. If your health runs out: **KNOCKED OUT**, you wake up at the Seabreeze Clinic with a bill.
- **Traffic lights** at all 15 junctions with green / amber / red per direction and walk / wait lamps. You can run reds. Don't do it in front of the patrol.
- **Weather.** Clear, cloudy, rain, thunderstorm and fog blend into each other and change by themselves every few game hours. Rain is drawn on the GPU; roads get wet, dark and reflective (lamp streaks, sky sheen, rain speckle) and dry out afterwards.
- **Day and night.** One real second is one game minute (a 24-minute day). The sun and moon cross the sky; sky, fog and light colours blend through night, dawn, day, golden hour and dusk; street lamps, neon, windows and car lights fade on at dusk and off at dawn.
- **Pickups.** Floating cash bundles and two health kits around town; they respawn.
- **Vending machines.** Eleven of them, Coolwave (drinks) and Snaxx 24 (snacks), against shop walls, on the promenade and on the pier. Their fronts glow at night and they hum when you are close. Stand at the front and press `F` (touch: **Buy**): pick an item ($2 to $5), a can drops out of the tray with a clunk and you get 6 to 20 health back.
- **Knocking things over.** Loose street furniture has mass. Light things (bins, cones, café chairs, potted plants, crates, newspaper boxes, beach balls) fly when anything moving hits them, the courier on fast skates included. Medium things (benches, café tables, vending machines, sandwich boards) block you on foot and get shoved along by cars; they only tumble at speed (a vending machine needs about 50 km/h). A car above about 45 km/h bends a street lamp over (sparks, a clank, its light goes out); slower, the car just stops. Hydrants never move, but one hit at speed sprays a fountain for about 20 seconds. Palms, walls, buildings and signal masts never give. The Disco Tank flattens lamps, palms, hydrants and everything loose. Knocked props tumble, settle and rest, and go back to their spot a few minutes later once nobody is looking. None of it adds heat.
- **Night streets.** Every street lamp throws a warm pool of light on the ground, lit shop windows and doors spill onto the pavement, the side streets and the far side of both back avenues have their own lamps now, and the night ambient is a little brighter, so the inner city reads at midnight without losing the mood.
- **Beach life.** Crabs scuttle sideways over the sand and dive into it when anything comes within a few metres (more of them come out at night). Sandpipers run up and down the wet sand chasing the wave edge and burst into short flights when approached; most leave at night and they huddle under the lifeguard huts when it rains. Pelicans sit on the pier posts, stretch their wings now and then, and one takes off for a lazy glide over the water. A friendly beach dog trots about, runs over when you are on foot nearby, follows you for a bit, then wanders off. Around dusk a few sea turtles surface in the shallows. Cars and pedestrians only ever make them scatter. Quiet synthesised gull cries, peeps and a woof.
- **The edge of the world.** The island ends at things you can see: a seawall with a railing and lamps around the city, banks of rocks where the beach meets the sides, and the surf. Lumina Boulevard runs west onto a causeway stub that stops at a storm closure (water barriers, sawhorses, cones, flashing amber lamps, a CAUSEWAY CLOSED – STORM REPAIRS sign, a repair barge in the missing span); the east end is a turnaround at the wall, and the other streets end at chevron boards and bollards. On the horizon: a mainland skyline across the bay, the Key (a little island town at the far end of the old causeway, with traffic lights streaming to the mainland at night), a hilly island to the south-east, a lighthouse with a turning beam and a cargo ship crawling along the horizon. Windows light up and twinkle at night; everything fades into the sea haze, and the sky melts into the fogged ocean so the water has no visible edge. The helicopter can fly well out to sea (about 700 m from the town centre); past that a TURNING BACK: LOW FUEL warning eases it round and pushes it home. You can only step out of it over land.
- **Solid street furniture.** Palms, street lamps, signal masts, hydrants, phone booths, planting beds, bike racks, umbrella poles, lifeguard huts and chairs, volleyball posts, billboard stilts, surfboards and the pier rail all block you, and cars stop against them (a thud and a small bounce, never any heat; a hard hit on the Comet still throws you). Cars collide with a row of circles along the body (bike, tank and helicopter too), so the bonnet stops at the wall instead of sinking into it. The helicopter only minds the tall ones, and only when low. You can still jump over the low ones on skates. Traffic and pedestrians follow their own lanes and sidewalks, so they never snag on them.
- **HUD.** Top right: cash, health bar, the condition of the vehicle you are in, the weapon chip (icon, name, ammo), heat stars and the clock. Top left: a round minimap that turns with the camera (roads, buildings, cars, bikes, patrol cars, pickups, the five doors as coloured squares, the next job as a star, the current target as a yellow diamond, street events as a blinking blip, a north marker), the district name and the current objective. Context hints sit bottom left; a crosshair in the middle while a blaster is out on foot.

### City detail

Chosen to make the street read as a place without adding draw calls (almost everything is merged into the existing city meshes):

- Rooftops: air-conditioning units, vents, water tanks, aerials with red beacons, satellite dishes, set-back penthouse tiers with their own neon band.
- Billboards with made-up ads on roofs and on stilts along the promenade (Flamingo Fizz, Wave 86 FM, Comet 500, Dance-Off Saturday and friends).
- Shopfronts on the back streets: striped awnings, wide lit windows, neon blade signs in five shapes.
- Door emblems in neon for the five places (flamingo, prism, zigzag, "24", a lightning bolt with a firework burst).
- Street furniture: benches, bins, fire hydrants, solid phone booths with a light inside, vending machines, newspaper boxes, bike racks, sandwich boards outside shops, potted plants by shop doors and cafés, and raised concrete planting beds with flowering shrubs and grasses along the promenade, the Deco Row façades and the pier foot. Every piece is checked against the carriageways at build time (nothing stands in a lane), and dev builds (`npm run dev`) report any prop on a road in the console.
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
| `F` | sit down near a seat or on the sand, get up; buy from a vending machine; on the club dance floor: dance | | | fire | |
| Mouse drag | orbit the camera (right-drag too) | orbit | orbit | aim the turret | orbit |
| Click / `R` | fire the blaster (aim with the camera; hold `R` to keep firing) | fire ahead (auto-aim) | fire ahead (auto-aim) | fire | |
| `G` | throw a firework bang (hold for distance) | drop a bang behind you | drop a bang behind you | | |
| `Q` / wheel, `1`-`5` | switch blaster / put it away, pick one | switch | switch | | |

Indoors: `W A S D` walk (the camera looks in from the door, so `W` is further in), `Shift` hurry, `E` at the yellow ring (Dee's counter, the podium, Gus's counter, Zizi's counter), `F` to sit on a stool or a booth or to dance on the club floor, walk into the white ring to leave. In a shop menu: `W`/`S` or arrows choose, `Enter` buys or wears, `Esc` closes. Blasters stay holstered indoors.

Anywhere:

| Key | Does |
| --- | --- |
| `~` or `T` | open the cheat console |
| `N` | skip to the next part of the day (dawn, day, golden hour, dusk, night) |
| `[` / `]` | slow down / speed up the clock (frozen, x0.25, x0.5, x1, x2, x5, x15, x60) |
| `Space` / `Enter` / click | in a scene: finish the line, then next line (lines also move on by themselves after a reading time: about 1 s plus 60 ms a character) |
| `X` or `Esc` | skip the scene |
| `Enter` / `Esc` | on the JOB BLOWN card: retry from the checkpoint / drop the job |
| `M` | mute |
| `P` | perf panel (FPS, draw calls, triangles, AI cars and pedestrians with the target for the hour, animals, page size) |
| `V` | switch camera: third person, close third person, first person (remembered between visits). In first person, vehicles get a cockpit: pillars and a dashboard with live gauges in cars, handlebars and a speedo on the bike, canopy frame and altimeter in the helicopter, a vision slit and reticle in the tank |

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut. For the same reason the blasters fire with a click or `R`, not `Ctrl`: you would be holding `W` at the same time.

## Touch controls

- **Left thumb:** touch anywhere on the left half and a stick appears under your thumb. It skates or walks; in a car, on the Comet, in the tank or the helicopter it steers and gives throttle (pull back to brake or reverse). Push it all the way out to sprint on foot.
- **Right side:** swipe on the empty right half to turn the camera (or look around in first person, or aim the tank's turret).
- **Buttons, bottom right:** they change with what you are doing and match the keyboard: **Jump**; **Enter / Ride / Take** (`E`) next to a vehicle; **Sit / Dance / Buy** (`F`) near a seat, on the club floor or at a vending machine; **Use** (`E`) at a counter; in a car **Drift** (handbrake), **Brake** and **Exit**; on the bike **Brake** and **Get off**; in the tank **Fire**; in the helicopter **Up**, **Down** and **Exit** (**Land** in the air); in a scene **Next** and **Skip**; on the JOB BLOWN card **Retry** and **Drop**.
- **Blasters:** with a weapon out, **Fire** becomes the big button (on foot it auto-aims at the nearest vehicle in a wide cone in front of the camera, or fires straight ahead; in a car or on the Comet it fires ahead with auto-aim), **Bang** throws a firework bang (hold for distance; **Drop** in a vehicle drops it behind you) and **Swap** cycles the weapons.
- **Top right:** **View** (camera view, like `V`), **Codes** (the cheat console with a tappable list of every code; tap the input line if you would rather type), **Mute**, and the gear (pause + controls + subtitle size).
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
| `REWIND` | Forgets the saved story progress, outfits and blasters. |
| `NIGHTSHIFT` | Toggles night: neon, lit windows, stars. |
| `STORMFRONT` | Toggles a thunderstorm: rain, lightning, thunder, wet roads. |
| `CLEARSKIES` | Clear weather. |
| `GREYSKIES` | Overcast. |
| `DRIZZLE` | Steady rain and wet roads, no lightning. |
| `PEASOUP` | Thick fog. |
| `MOONBOOTS` | Toggles low gravity for jumps. |
| `NEONRIDE` | Paints every car hot pink and makes it glow (toggle). |
| `SPARKCRATE` | Every neon blaster and firework, fully loaded. |
| `PITSTOP` | Fixes the vehicle you are in (or the nearest one), wrecks included. |
| `LOWPROFILE` | Clears your heat. |
| `TIPJAR` | +$500. |
| `HELP` | Lists the codes in the console. |

A forced weather holds for about four game hours before the sky starts making its own mind up again.

## Hardware notes

- Built for integrated laptop graphics: a typical street frame is about 55 draw calls with all traffic, pedestrians, beach animals, loose props, planters and the horizon on screen. The new effects add at most a handful while something is happening: smoke and debris, beams, shockwave rings, projectiles, the blaster in your hand and an event's bag and ring are each one pooled or instanced draw call, drawn only while in use. Indoors the camera only renders the room's layer (the room, the cast, the courier, the rings), so Club Prism with its whole crowd, lasers, lights and lounge is about 28 draw calls. No shadow maps, no post-processing. Interiors are built the first time you walk in and hidden when you leave.
- The pixel ratio is capped at 2 (1.5 on phones and tablets), and it is checked again whenever the window, the zoom or the screen changes. If it still struggles on a high-DPI screen, zoom the page in (`Ctrl` / `Cmd` + `+`) or shrink the window: fewer pixels is the big lever.
- Needs WebGL 2. Without it you get a plain explanatory message instead of a black page. Make sure hardware acceleration is switched on in the browser.
- Rendering and audio pause while the tab is hidden.
- With `prefers-reduced-motion` there are no lightning flashes, no camera bob or shake, no wheelies, steady patrol lights, static cutscene cameras and subtitles that appear whole instead of being typed; explosions flash much less, and the laser aim lines, the GET OUT! warning and the event blips are steady instead of flickering.
- **Subtitles** sit on a solid dark panel above the letterbox and clear of the touch buttons, with the speaker's name on its own line in their colour, about 60 characters a line with balanced wrapping and a "▸ next" prompt once the line is complete. The pause / settings panel has a **Normal / Large** subtitle size, remembered on the device.
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
- **Damage.** `src/game/damage.js`: hp per vehicle, stages, smoke / fire / explosion effects, wreck clearing, the condition bar and GET OUT!. `vehicles.js` reports impacts (each car's change of speed in a collision, wall and prop hits) and darkens the instance colour; the dents are a per-instance attribute that sags the bonnet and skews the bumpers in the car material's vertex shader.
- **Weapons and lasers.** `src/game/combat.js`: inventory, aiming (camera ray, auto-aim cone), the five weapons, firework physics (bounces, fuse, proximity), homing stars, the patrol lasers (telegraph, bursts, hit chance), the HUD chip and crosshair. Projectiles are one instanced mesh; beams, sparks, smoke and shockwave rings are pools in `vehicles/effects.js`.
- **Street events.** `src/game/events.js`: the director and the three events. People in an event are steered through a small hook in `actors/peds.js` (stand, walk to, run along the sidewalks, sit), patrol cars get a chase target in `actors/traffic.js`.
- **Story as data.** `src/game/story.js` holds the cast, every line of dialogue (with its camera shot and gesture), the mission steps, the shop lists and the counter one-liners. `missions.js` plays it; `cutscene.js` is the director (letterbox, typewriter subtitles with coloured speaker names, wide / over-the-shoulder / close-up / two-shot cameras, actors that turn to face each other and gesture).
- **Interiors.** Each room is one merged unlit mesh plus a few animated extras, parked 90 units under its own building, on its own render layer. The Club Prism dance floor is a single quad whose tiles, per-bar patterns, breakdown and build are drawn in the fragment shader; the lasers and haze are additive meshes animated in their shaders; the mirror-ball spots are one instanced quad (rays from the ball to the walls, worked out on the CPU); the crowd (up to 45) is four instanced meshes (torsos, heads, arms, legs) posed from the same move library as the courier (`src/actors/moves.js`). One music clock (`beatU` in core/util.js) is free-running on real time and pulled onto the synth's scheduler position every frame; key presses are judged against it to the millisecond, between frames too.
- **Props and seats.** `src/world/props.js`: the world builders register each solid prop as a circle or a box and each seat as a point (or a line, like the seawall); a static spatial grid means the courier and cars only test the handful in their own cells. Lamps, palms and hydrants carry a tag and a hook decides whether a hit breaks them. `src/game/activity.js` does sitting and dancing.
- **Loose props.** `src/world/loose.js`: every loose prop is a vertex range in one merged dynamic mesh (one draw call for all of them, glowing fronts via a per-vertex attribute). Sleeping props sit in a spatial grid; only awake ones run the little rigid-body step (velocity, spin, gravity, ground friction, settle onto a face, sleep) and only their vertex ranges are re-uploaded. Mass classes and topple speeds are a table at the top of the file. `layout.js` has the carriageway rectangles, `offRoad()` (used when placing anything) and `propsOnRoad()` (the startup check).
- **Night street light.** One 600 x 300 canvas (1 px = 1 m) with a warm pool under every lamp and the shop-window spill; the ground shader adds albedo x pool x night. A broken lamp is left out of the next repaint.
- **Courier model.** `src/player/player.js`: jacket with collar, zip, cuffs and pockets, a head with brows, nose, ears, blinking eyes and a mouth that moves while Skye talks, hair under the backwards cap, hands with thumbs, knees, skates with laces and four wheels, a messenger bag on its strap, subtle breathing. Outfit colours are applied by role (jacket, sleeve, shorts, legs...), and a skirt mesh whose hem is swung by the thighs every frame gives skirts and dresses their silhouette.
- **Sound.** Web Audio only: bass arpeggio, pad, pluck arp and a drum machine on a look-ahead scheduler, a low-pass on the music bus for the muffled shop radio, Club Prism's own phrase-structured track, per-character subtitle blips, plus engine, rotor, skates, rain, thunder, explosions, siren, horns, cash ticks and the pedestrians' "hey!" built from oscillators and filtered noise.

### Size

| Part | Minified |
| --- | --- |
| three.js 0.187.0 (tree-shaken) | about 578 KB |
| Game code | about 346 KB |
| HTML + CSS | about 33 KB |
| **`dist/index.html`** | **about 957 KB** |

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers, spatial grid
  world/            layout, roads + traffic lights, canvas textures, sky + ocean, city builder, details (rooftops, props,
                    billboards, boats, gulls), edges (seawall, causeway closure), horizon (distant scenery),
                    glow sprites, day/night + weather, props (solid street furniture + seats, spatial grid),
                    loose (knock-over physics, lamps / hydrants / palms, vending machines)
  actors/           AI traffic + Coast Patrol, pedestrians + drivers, beach animals, dance moves (shared by courier and crowd)
  game/             story.js (all dialogue + mission data), missions (story engine), cutscene (director), activity (sitting, dancing + rhythm),
                    interiors (the five rooms + cast), places (doors, walking indoors, shops),
                    rules (heat, cash, health, pickups, carjack), damage (vehicle condition, fire, explosions),
                    combat (blasters, fireworks, patrol lasers), events (random street events)
  player/           the courier model + skating controller, follow camera
  vehicles/         car / bike / tank / helicopter models and physics, effect pools (sparks, smoke, beams, rings)
  cheats/           cheat console and codes
  audio/            synthesised music and effects
  ui/               minimap, cash / health / heat / clock, objective, hints, toast, perf panel; touch.js: touch controls,
                    control-mode choice, pause + settings
```
