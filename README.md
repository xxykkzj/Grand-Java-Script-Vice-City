# Neon Coast

A pocket-sized 80s sunset coast you can skate, ride, drive and fly around, in **one self-contained HTML file**: the old town on Lumina Boulevard and, across the reopened Halcyon Causeway, Solano Key with its glass towers, a stadium, a marina and the docks.
Pastel art-deco hotels, palms, neon signs, live traffic and pedestrians, a patrol with roof lasers that chases you when you misbehave, a four-job story with cutscenes, a bar, a nightclub with an open booth lounge, a clothes shop, a corner store and a neon blaster shop you can walk into, vehicles that smoke, burn and blow up in cartoon style, random street events that reward good deeds, a beach with its own crowd on a timetable (joggers at dawn, volleyball by day, a fire pit at night), food and drinks you can see Skye eat, a sport bike, weather, a full day/night cycle, a synthwave soundtrack and a retro cheat console.
Almost everything is generated in code at load time: the town, every texture and every sound. A handful of licensed low-poly models (Kenney and Quaternius, CC0, see [Credits](#credits)) are baked into the same file at build time, so the game is still one file with nothing to load next to it.

An original homage to 80s open-world games. Not affiliated with or using assets from any existing game.

## Play

Just double-click `dist/index.html` (any current desktop Chrome, Edge, Firefox or Safari). No server, no install, no network. Click to start; that also unlocks audio.
The `index.html` in the repo root only redirects there, so GitHub Pages serves the game from the repo root. **That GitHub Pages link also works on phones and tablets** (portrait or landscape) with the on-screen touch controls.

**Choosing controls.** The title screen has a *Keyboard & mouse* / *Touch controls* choice. It is pre-selected for your device (touch on phones and tablets) and remembered on that device. You can change it any time with the gear button under the clock (top right), which also pauses the game.

To rebuild it yourself: `npm install && npm run build`, then open `dist/index.html`.

You play Skye, a roller-skating courier on Lumina Boulevard, summer 1986. The story, the cast and the full script are in [STORY.md](STORY.md).

## The story

Dee's bar, the Velvet Flamingo, owes $5,000 by Sunday. Marty Glitz at Club Prism wants the bar, and is running Saturday's $5,000 Dance-Off with the scorecards already filled in. Four short jobs: **Fizz Run**, **Paper Trail**, **Cold Feet**, **Last Dance**.

- The pulsing star on the minimap is where the next job starts. Skate into the ring at that door. In the street a slowly spinning, gently bobbing yellow 3D star floats in the light pillar of whatever the current objective is (the next job's door, the place to visit, the drop or checkpoint, the bike to get on; a soft pillar of its own where there is none); it hides indoors and when there is no objective.
- The current objective sits under the minimap. A countdown only appears on the legs that need one.
- Fail a job (time, knocked out, caught) and you get JOB BLOWN: `Enter` retries from the last checkpoint, `Esc` drops it.
- Finishing a job shows the pass card with the reward. Finishing the story unlocks the Flamingo Royale jacket and better pay on Dee's repeatable odd jobs (`E` at her counter).
- Progress, your outfit, the outfits you own, your blasters and ammo, the snorkel vest and your Skate Surge best are kept in the browser's local storage; sleeping at the Moonlite Motor Inn also saves your cash and the clock. The `REWIND` code clears them.

## Places you can walk into

Each has its own coloured ring at the door (and a square blip on the minimap), a short walk-in scene and an interior that is only built and drawn while you are in it. Walk into the white ring by the door to leave; a yellow ring marks the spot where `E` (the USE button on touch) does something. While you are indoors the patrol cannot see you, so heat cools off.

| Place | Ring | Inside |
| --- | --- | --- |
| **The Velvet Flamingo** | pink | Dee's bar. Story scenes, and `E` at the counter for a timed delivery. |
| **Club Prism** | violet | A big room on one shared beat: DJ Kilowatt on a raised booth (decks, a mixer of blinking LEDs, speaker stacks that thump with the kick), a light-tile floor whose pattern changes every bar, a mirror ball throwing moving spots, lasers through the haze, a bar with a bartender, a roped-off VIP corner and a coat check. Through a wide opening in the right wall is the **booth lounge**: four open lounge booths (low-backed curved sofas round low tables with drinks and candle lamps, pendant lights) in two rows, all facing the dance floor, with aisles of 2.2 m and more between them and a neon strip along the main aisle; a softer and duller mix of the music. Each booth is one simple collision box (sofa and table together, run to the wall where it stands against one), so there are no thin walls or pockets to get stuck in; sit on either end of a booth with `F`. `E` at the bar: **Taps** pours the drinks on the board over it (Laser Lemonade $3, Floor Filler $4, Ultraviolet $5, Mirrorball $6, The Kilowatt $7). The crowd follows the story: before Paper Trail it is nearly empty (7 people, the DJ warming up, quieter music, dimmer lights), after it 29, and 45 for the Dance-Off. Its own club track. **You can dance here** (see below). Hosts two story jobs, including the dance-off finale; its conversations are played seated in the lounge's front far booth. |
| **Zigzag Threads** | orange | Step onto the podium and press `E` to try on eleven looks: Courier Classic, Sunset Stripe, Midnight Arcade, Mint Condition, Cherry Bomb, the Neon Slip dress, the Tie-Break pleated skirt with a cropped jacket, the sequinned Mirrorball party dress, the Boardwalk Sundress, Sea Breeze Slacks and Flamingo Royale. Skirts and dresses swing with the legs while skating, sitting and dancing. They cost cash once and are yours for good. While you try things on, the camera frames Skye in the part of the screen the menu leaves free (to its right, or above it on a portrait phone, where the menu sits along the bottom). Putting on a different outfit while wanted knocks one star off (once every 45 seconds). |
| **Pelican Pantry 24** | green | Gus's corner store. `E` at the counter: Pelican Pop ($5, +15 health), Boardwalk Hot Dog ($12, +35), Turbo Crunch Bar ($20, +60). You eat it there and then (see [Eating and drinking](#eating-and-drinking)). Behind the counter is a teal wall of products and a dark back counter, so Gus in his maroon Pantry polo and cap stands out. |
| **Volt & Spark Supply** | blue | Zizi Sparks's neon blaster and firework shop, east of the start on the boulevard (a lightning bolt and a firework burst in neon by the door). Small and brightly lit: a pale checked floor, a violet counter with a case of firework bangs, and behind Zizi (tangerine overalls, teal hair, goggles) a dark display wall of glowing blasters; crates of fireworks along the left wall, a practice target on the right. The first visit plays her safety talk. `E` at the counter: buy the five weapons below, or more ammo for the ones you own. Weapons and ammo are kept with your save. |

Characters indoors are lit with a soft rim light so they read against light and dark walls alike.

**Finer dressing.** Every interior has painted signs, menus, posters, shelf fronts and neon pieces (all invented text, painted into one canvas per room), cheap fake mirror reflections (the Flamingo's back bar, the Zigzag fitting mirror, the lounge, the Pantry's round security mirror), rugs, plants, ceiling fans, pipes and light rigs, baked lighting with soft light pools, and small animated touches: a fish tank and a cycling jukebox glow at the Flamingo, a flickering tube at the Pantry, a plasma globe at Volt & Spark, a spinning sunglasses stand at Zigzag. Light shafts under lamps only show on High graphics; with reduced motion the fans, fish and flicker calm down. Each room stays within about 25 draw calls (the club, the busiest, about 23 on High).

### More places to walk into

Seven venues, each with a resident, a few lines of their own and something to do. They hang off existing buildings: only their door ring is new on the street.

| Place | Where | Ring | Inside, and what you can do |
| --- | --- | --- | --- |
| **Sunset Strip Diner** | Lumina Boulevard, old town (under its sign) | orange | Checkered floor, a pink counter with red stools, booths with painted windows, a pie case, a kitchen pass with heat lamps, a big menu board, a flickering EAT sign and a jukebox. **Dot** (mint uniform, paper cap). `E` at the gap in the counter: order a meal that restores health (Bottomless Coffee $2 +10 up to The Blue Plate $24, full health, and a Midnight Milkshake $5 +18). `E` at the jukebox picks a song. `F` sits you at the counter or in a booth. |
| **Seahorse Arcade** | the Seahorse Cinema lobby, old town | yellow | A dark room with a cosmic carpet, eight cabinets of invented games, two pinball tables, air hockey and the token counter. **Token** runs it. `E` at the back cabinet plays **Skate Surge** ($1 a go): steer a skater down a neon road (`←` `→` / `A` `D`, the stick or the on-screen arrows), dodge cones, puddles and cars, grab stars. The score climbs the longer you last; your best is saved and shown on the cabinet's attract screen. `Enter` plays again, `Esc` quits. |
| **Moonlite Motor Inn, room 7** | Solano Key, by the Sunbowl (east face) | pink | The safehouse: a rattan bed under a flamingo painting, a TV that flickers on channel 86, a window with VACANCY glowing outside, a kitchenette. **Hazel** (lilac perm, cat-eye glasses). `E` by the bed: **Sleep till morning** (8:00) or **Nap till golden hour** (18:30), both with full health and no heat, or **Just save**. Saving writes your cash and the clock to local storage; a reload puts them back. |
| **Seafoam Galleria** | Solano Key, Halcyon Avenue (north face) | teal | A skylit atrium: a three-tier fountain, five painted shopfronts (Tape Deck Tropics, Sole Patrol, Byte Shack, Glow Getter, Seashell Sweets) and four more up on the mezzanine, an escalator that is out of order, benches, palms, a directory. **Kiki** and her pretzel cart: `E` for a Classic Knot ($6, +25) or a Cinnamon Swirl ($9, +40). `E` at the fountain tosses a coin ($1) for a wish; every fifth wish Kiki throws you a free pretzel. |
| **Starboard Bait & Tackle** | Solano Key, Starboard Marina (west face) | green | Planked walls, rods in a rack, Big Bertha on the wall, a tide chart, LIVE BAIT in flickering neon, a fish tank, life rings, the marina through the back window, a canoe on the ceiling. **Cap'n Rudy** (captain's hat, yellow slicker, a big white beard). `E` at the counter: the **Buoy-O Snorkel Vest** ($90, you can stay under water 75% longer, kept with your save), **Tackle Trivia** (a sea question, $10 for a right answer) and Saltwater Taffy ($4, +12). |
| **The Solstice Spire** | Solano Key, Stadium Way (north face of the waterfront tower) | amber | The lobby of the key's waterfront tower: a marble floor with brass inlays and a sun medallion, walnut wainscot, a coffered ceiling with ring chandeliers, a pair of sofas round a coffee table, a skyline painting, a brass sun sculpture, palms in big pots and the lift bank. **Leo** (teal tailcoat, gold epaulettes, silver hair) at the curved concierge desk: `E` for a word. `E` at the middle lift (touch: **Use**) rides up: the doors close, the floor counter races to 23, and the doors open on the roof, out on the **Solstice Terrace** (see [The Solstice Terrace](#the-solstice-terrace)). `F` sits you on a sofa. |
| **The Blue Pelican Lounge** | Lumina Boulevard, old town, downstairs at Tidewater Records | blue | A small jazz and country bar: a low wooden stage under a truss of warm cans, with an upright piano, an upright bass, a drum kit, a sunburst guitar on its stand and a mic in front of a velvet curtain; booths in red leather along the left wall, café tables on a diamond rug, a walnut jukebox, a chalkboard line-up of invented acts and THE BLUE PELICAN in blue neon over the back bar. **Birdie** (tan cowboy hat, silver bob, teal waistcoat, bolo tie) runs the bar: `E` for Sweet Porch Tea ($3, +8), a Blue Pelican Fizz ($6, +14, with a paper umbrella), Hot Honey Cider ($9, +20) or a Porch Light Lager ($4, +6). `F` sits you on a stool, in a booth or at a table. It plays **recorded music** (see [Live music](#live-music-at-the-blue-pelican)); `E` at the jukebox or the front of the stage puts on the next track. |

### The Solstice Terrace

The roof of the Solstice Spire, 79 m up, outdoors at the tower's real height: you look east over the causeway to the old town (where the sun goes down), south over Halcyon Avenue to the sea, and across the key behind you. The tower has a lit name crown (its name on all four faces under amber neon bands, corner fins with lit tips, a mast with a red light on the lift hut) and the name in lights over its lobby canopy.

- **The deck:** teak planks behind a **glass balustrade** all round. It is solid and taller than any jump, and you are kept inside it: there is no way to drop off. The lift hut is the only way up and down (there is no stair door).
- **Seats:** six loungers along the east edge facing the old town and the sunset, benches along the south edge facing the sea, a sofa corner round a fire table, stools at the bar. `F` sits; the camera eases out to a wide view over the city and the sea, and you can **wait for the sunset** (`1`, the clock fast-forwards smoothly to 19:30) or **wait for the night** (`2`, to 22:00). Touch: **Sunset** / **Night**. `F`, `E` or moving gets you up any time and stops the clock where it is. `K` (cinematic mode) works up here too.
- **The Afterglow Bar** under a pergola strung with lights: **June** (rust waistcoat, coral bob) mixes a Causeway Cooler ($4), a Terrace Lager ($5), a Skyline Sour ($6), a Sundown Spritz ($7) or a Midnight Nightcap ($9) (`E` at the bar; see [Eating and drinking](#eating-and-drinking)).
- **String lights** zigzag across the deck on poles and throw warm pools on the planks at night; planters with shrubs and small trees, standing tables with candle lamps.
- **Guests** by the clock: one early riser in the morning, a few by day, the place fills up in the evening (12), a handful late at night, nobody between 2:00 and 6:00, and nobody at all in rain or a storm (half as many in fog). They lean on the glass, take loungers, benches, the sofas and the bar stools; while you are up there they come and go only where you are not looking.
- **The view reaches further** while you are on the deck: the street-tree and street-light cut-offs and the district culling go out 2.4x (1.7x on Low), and the haze is pushed back 1.75x, so both districts, the causeway and the sea read at sunset and at night. It all goes back as you ride down.
- **Not a helipad:** a helicopter that comes down over the deck is held a few metres up and eased off the edge (NO LANDING ON THE TERRACE); the Glasswater Tower pad is just up the street.
- Its own music: a mellow downtempo theme (warm pad, offbeat electric piano, a lazy bass, rim clicks, a vibes arpeggio, a soft flute-like line), which also plays in the lobby.

## Eating and drinking

Everything you can buy to eat or drink (Pelican Pantry, the street vending machines, the diner, Kiki's pretzel cart, Rudy's taffy, the Blue Pelican, the Club Prism bar, the Afterglow Bar on the Solstice Terrace and the Coconut Shack on the beach) is consumed on the spot, **at any health**:

- It always charges you. Below full health it heals by its amount, never past 100.
- At full health it still plays and gives a short **REFRESHED** buff instead (a toast with a "+"): for 40 seconds Skye sprints about 8 % faster on skates and indoors, and a fast swimming stroke costs less stamina.
- Each item has its own little low-poly model in Skye's hand: a soda can, an iced-tea glass with lemon and straw, a hot dog, a candy bar, chip and gummy bags, a coffee mug, a slice of key lime pie, a pancake stack, a burger (with a carton of fries in the other hand), the Blue Plate, a milkshake with cream and a cherry, pretzels, taffy, cocktails with paper umbrellas, a beer glass with a head of foam, a smoothie, a soft-serve cone and a coconut with a straw.
- She lifts it, takes it to her mouth three times (a drink tips back with the head) and it is gone: about two seconds. At a counter or a machine she turns three-quarters towards the camera so you can see it; moving (keys or the touch stick) cuts it short. You can eat sitting down too.

## Music

All of the music is original, composed for the game and synthesised live with Web Audio (no samples, no files; `src/audio/themes.js`). Every indoor place has its own short theme, with A/B sections and small changes each time round (a different motif, a shifted phrase, dropped or ornamented notes, a different comping rhythm), and the music crossfades as you walk in and out:

| Place | Theme |
|---|---|
| **Velvet Flamingo** | laid-back lounge soul: electric-piano chords, a round bass, brushed drums, a soft keys melody |
| **Club Prism** | its own phrase-built dance track (12 bars of groove, a breakdown, a build, the drop), locked to the dance floor and the Dance-Off; the arpeggio turns round every other phrase |
| **Blue Pelican Lounge** | with no recorded tracks: a jazz combo in AABA form (walking bass, ride cymbal, piano comping, a muted horn on the head) |
| **Sunset Strip Diner** | a 50s/60s jukebox shuffle: doo-wop changes with piano triplets, then a twelve-bar with a sax riff, slap bass and handclaps |
| **Seahorse Arcade** | chiptune (square lead, triangle bass, noise drums); **Skate Surge** on the cabinet has its own quicker loop while you play |
| **Zigzag Threads** | bright boutique synth-pop: four-on-the-floor, claps, offbeat chord stabs, an arpeggio, a bell lead |
| **Pelican Pantry 24** | easy-listening store muzak: bossa-ish bass and rim clicks, nylon-style plucks, vibes |
| **Volt & Spark Supply** | a tense electro / industrial pulse: a filter-swept sixteenth bass, metal clanks, a rising alarm |
| **Moonlite Motor Inn** | a mellow late-night slow tune on electric piano with a soft flute-like line |
| **Seafoam Galleria** | airy mall ambience: a slow pad, sparkles and a soft bell melody with a long echo |
| **Starboard Bait & Tackle** | gentle country / folk: fingerpicked guitar, brushes, a harmonica-like lead |
| **The Solstice Spire and its terrace** | a mellow downtempo sunset groove: a warm pad, offbeat electric-piano stabs, a lazy bass, rim clicks and a shaker, a vibes arpeggio, a soft flute-like line (darker at night). Up on the terrace it plays like an indoor theme: it ignores the street music's fade-out, and `M` switches it off with the rest |

**The street.** Out on the street the score picks its next section as it goes from a set of sections with their own chords, grooves and bass lines (a four-on-the-floor drive, a sunny clap groove, a half-time cruise, a moody night section, a sparse "rain" section on a ride cymbal, a quiet lull with no drums, and a faster chase when the patrol is after you). The lead voice changes from section to section (bell, saw, soft triangle, square). By day it is brighter and a little faster; at night it moves to the darker sections, slower, with darker pads; with no heat it is calmer (lighter drums, no chase).

**Music on / off (`M`, touch: ♪ in the top bar).** The street music plays for about two and a half minutes after you start, then fades out gently and stays off, with a note: *Music off · press M (touch: ♪) to turn it back on*. The indoor themes still play when you walk into a place. `M` works like this: after that fade it brings the street music back (and it then stays on); otherwise it switches **all** music (street, indoor themes and the Blue Pelican's records) off or on. Sound effects are never affected (`Shift+M` mutes everything). Your choice is remembered on this device: turned on, the street music no longer fades out; turned off, the game starts silent apart from the effects.

## Live music at the Blue Pelican

The lounge is the one place in the game with **recorded** music instead of the synthesiser. A small player (`src/audio/music.js`) reads `assets/music/manifest.json` (each track: `file`, `title`, `artist`, `licence`, `source`, `genre`) and streams the files next to it through the game's own audio graph, so the volume follows the game and `M` (music off) silences it too. The music fades in as you walk in and out as you leave, a track that ends moves on to the next one, and a **now-playing card** shows the title, the artist and the licence (also after each skip). Only tracks marked public domain, CC0 or CC BY are played; anything else in the manifest is skipped.

The repo ships **no music**: the manifest is empty. With no tracks, or when the files can't be fetched (for example when `dist/index.html` is opened straight from disk, `file://`), the lounge plays its own synthesised jazz combo theme instead, and the card says why. To add tracks, see [assets/music/README.md](assets/music/README.md) (which licences are fine, the manifest format, how to test). `npm run build` writes the credits below from the manifest.

### Music credits

<!-- music-credits:start -->
_No recorded tracks yet: `assets/music/manifest.json` is empty, so the lounge plays the game's synthesised music. See [assets/music/README.md](assets/music/README.md) to add some._
<!-- music-credits:end -->

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
- **HUD:** a condition bar under the health bar while you are in a vehicle, and a flashing **GET OUT!** while it burns. Still inside when it blows: **TOTALLED**: slow motion, the colour drains out, the camera pulls back from the wreck and a big red title card comes up, then you wake up at the Seabreeze Clinic with the usual bill. Getting out of a burning car before it goes up still saves you.
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

From **3 stars** the patrol cars' roof-mounted pulse lasers come on. A car that can see you telegraphs first with a thin flickering aim line (about 0.6 s, with a rising hum), then fires a burst of three short neon beams. The hit chance falls with distance and with how fast you cross its line of fire, and buildings block it, so weaving and breaking line of sight work. Hits damage your vehicle. **They never fire at you on foot**: on foot the patrol chases you and tries to arrest you (CAUGHT), that's all. At 4 and 5 stars there are more patrol units (up to six) and they fire faster.

**Escalation.** 1-2 stars: patrol cars chase. 3 stars: more cars that drive harder and lean on you, roadblocks (a patrol car ahead of you on the road stops across it, then joins the chase) and the roof lasers at the vehicle you're in. 4 stars: a **patrol helicopter** circles overhead with a searchlight that tracks you (it lags a little, so keep moving) and fires laser bursts at your vehicle while the light is on you. 5 stars: also a **patrol tank** that hunts you along the streets and lobs shells in an arc (muzzle flash, a glowing shell, a blast that damages vehicles and throws props about; pedestrians only scatter, nobody on foot is hurt by the patrol's fire). One helicopter and one tank at most; they leave when the stars drop.

**Too hot?** While you have stars, a small panel slides in on the right edge every so often (about 6 s, then 20 s away) with the cheat code that clears them (`LOWPROFILE`) and how to open the console (`T` or `~`, on touch the **Codes** button). It stops when the heat is gone.

## Street events

Every few minutes, when you are not on a job, not in a scene, not indoors and not wanted, something happens near you: a short toast, a couple of subtitle lines, a blinking blip on the minimap and an objective in the HUD (with a timer).

- **Bag snatcher:** someone grabs a shopper's bag and runs along the sidewalks. Chase them on foot, on skates or on the Comet and bump into them to tackle them (a cartoon tumble), pick up the bag and give it back for a share of the cash. Lost if they get too far ahead.
- **Getaway car:** a shop alarm rings and a getaway car speeds off with a patrol car in pursuit. Ram it or stop it with the damage system (blasters, bangs) until it gives up: the patrol thanks you with a reward and, if you had picked up any heat, knocks a star off. The stolen takings drop out: return them to the shopkeeper for an extra share.
- **Suspect on foot:** a patrol radio call; tackle the runner before they get away and the officer pays you.

## Sitting down

Walk up to a seat and press `F` (the hint shows `F: sit`; touch: **Sit**): Skye sits down onto it facing the right way, then idles (looks around, leans back, on the sand lies back with arms behind the head). `F`, `E` or moving gets up. Seats: benches on the boulevard, the promenade, the pier and the sand by the pier; sun loungers and towels under the rental umbrellas, the towels laid out on the sand and the driftwood logs round the fire pit; café chairs at the tables outside the Sunset Strip Diner; the bleacher steps by the volleyball court; the seawall coping; the pier edge by the rail; bar stools, the club lounge booths and the VIP sofa indoors. On the beach you can also just sit on the sand anywhere (stand still first). Pedestrians use the same seats: some sit on benches and at the café, the beach crowd takes loungers, towels and the logs by the fire, and the club crowd fills the booths.

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

- **Traffic.** Up to 36 AI cars and 4 two-wheelers of [many types](#vehicle-types) plus Coast Patrol cars follow a lane graph built from the road layout: they keep right, turn at junctions, queue behind each other, and brake for you, for pedestrians and for red lights. You can see the drivers through the glass; headlights, tail lights and light pools on the road come on at dusk: every car with its lights on (traffic, the taxis and trucks, the patrol, the Comets) throws a soft ellipse of light on the road ahead, and yours throws a longer, brighter one. Empty parked cars are still there for the taking, and there are more of them: besides the parked cars and Comets, a small pool of spare cars and bikes is parked in the nearest free slot out of view whenever you are on foot with nothing to drive within about 50 m (kerbside parking lanes along the avenues and side streets, the stadium car park, footpath edges for the bikes; never in junctions, doorways, on the sand, in the stadium, in water, on roofs or against props).
- **Pedestrians.** Up to 52 people in assorted outfits stroll the sidewalks and wait for the walk light at crossings. Bump them and they tumble (cartoon style) and get back up; explosions, tank fire and sirens send them running; they shout "hey!". Blaster shots and firework bangs never hurt them: they flinch, shout and run.
- **People walk round cars.** Everyone on foot outdoors (street walkers, the beach crowd, the people a street event directs, anyone hanging about outside the club or the bar) treats every vehicle as solid: its type's own footprint (length x width from `src/vehicles/types.js`, turned with the car, padded by a person's radius; the 10.6 m bus included). Walkers look a few metres ahead along their path and sidestep along a parked car, a car stopped at the lights or across a crossing, or your own parked ride, then drift back onto their line once past it; anyone a car is parked or spawned onto steps straight out of it. Moving cars still knock people over as before (they tumble and get up, never harmed). Cheap: the per-frame neighbour grid gives the few cars within reach, and the whole thing costs a few hundredths of a millisecond a frame with everyone out (`peds.carStats`).
- **Rush hour and nightlife.** Traffic and crowds follow the clock: busiest in the 07:00-09:00 and 17:00-19:00 rush, moderate through the day, a lively evening on the boulevard, and nearly empty streets between about 01:00 and 05:00 (a handful of cars, a few late walkers). Cars and people are parked or brought back only out of sight (far away, behind you or behind a building), so nobody pops in or out in view. At night a crowd hangs around outside Club Prism and the Velvet Flamingo; the beach has a crowd of its own on a timetable (see [Coral Beach](#coral-beach)). The `P` panel shows the live counts next to the target for the hour.
- **Carjacking.** Press `E` next to an occupied car: Skye opens the door and hauls the driver out, who stumbles, shakes a fist and legs it. Costs one star of heat.
- **The Comet.** An 80s sport bike with a wedge fairing. Four are parked around town (outside the Pantry, by the club, on the promenade near the start, at the foot of the pier) and two ride with the traffic. `E` to get on or off. It leans into turns, lifts the front wheel when you open the throttle from low speed, and tops out well above the cars. It is fragile: hit a wall or a car hard and you go over the bars and lose health.
- **Heat.** 0 to 5 stars. Taking an occupied car or bike, running people over, firing the tank, shooting patrol cars (or cars in front of them) and wrecking a patrol car add stars. Bumping into other cars or running a red light never does: that is just traffic. Out of the patrol's sight the stars start blinking and drop off after roughly 25 seconds. From 2 stars the teal-and-white **Coast Patrol** comes after you with lights and siren; from 3 stars they fire their roof lasers (see above), and at 4 and 5 stars more units join (up to six). If they pin you while you are on foot or stopped: **CAUGHT**, you wake up at the station with a fine. If your health runs out: **KNOCKED OUT**, you wake up at the Seabreeze Clinic with a bill.
- **Traffic lights** at all 15 junctions with green / amber / red per direction and walk / wait lamps. You can run reds. Don't do it in front of the patrol.
- **Weather.** Clear, cloudy, rain, thunderstorm and fog blend into each other and change by themselves every few game hours. Rain is drawn on the GPU; roads get wet, dark and reflective (lamp streaks, sky sheen, rain speckle) and dry out afterwards.
- **Day and night.** One real second is one game minute (a 24-minute day). The sun and moon cross the sky; sky, fog and light colours blend through night, dawn, day, golden hour and dusk; street lamps, neon, windows and car lights fade on at dusk and off at dawn.
- **Pickups.** Floating cash bundles and two health kits around town; they respawn.
- **Vending machines.** Eleven of them, Coolwave (drinks) and Snaxx 24 (snacks), against shop walls, on the promenade and on the pier. Their fronts glow at night and they hum when you are close. Stand at the front and press `F` (touch: **Buy**): pick an item ($2 to $5), a can drops out of the tray with a clunk and Skye drinks or eats it (6 to 20 health back, or REFRESHED at full health; see [Eating and drinking](#eating-and-drinking)).
- **Knocking things over.** Loose street furniture has mass. Light things (bins, cones, café chairs, potted plants, crates, newspaper boxes, beach balls) fly when anything moving hits them, the courier on fast skates included. Medium things (benches, café tables, vending machines, sandwich boards) block you on foot and get shoved along by cars; they only tumble at speed (a vending machine needs about 50 km/h). A car above about 45 km/h bends a street lamp over (sparks, a clank, its light goes out); slower, the car just stops. Hydrants never move, but one hit at speed sprays a fountain for about 20 seconds. Palms, walls, buildings and signal masts never give. The Disco Tank flattens lamps, palms, hydrants and everything loose. Knocked props tumble, settle and rest, and go back to their spot a few minutes later once nobody is looking. None of it adds heat.
- **Night streets.** Every street lamp throws a warm pool of light on the ground, lit shop windows and doors spill onto the pavement, the side streets and the far side of both back avenues have their own lamps now, and the night ambient is a little brighter, so the inner city reads at midnight without losing the mood. Solano Key gets the same: pools under its street lights and warm light spilling out of its shopfronts and lobbies onto the pavement.
- **Beach life.** Crabs scuttle sideways over the sand and dive into it when anything comes within a few metres (more of them come out at night). Sandpipers run up and down the wet sand chasing the wave edge and burst into short flights when approached; most leave at night and they huddle under the lifeguard huts when it rains. Pelicans sit on the pier posts, stretch their wings now and then, and one takes off for a lazy glide over the water. A friendly beach dog trots about, runs over when you are on foot nearby, follows you for a bit, then wanders off. When it is close, `F` (touch: **PAT**) pats it: Skye crouches down for a few pats, the dog sits with its tail going, a few little hearts float up, it gives a happy yip and then tags along for longer. Once every few seconds, no more. Around dusk a few sea turtles surface in the shallows. Cars and pedestrians only ever make them scatter. Quiet synthesised gull cries, peeps and a woof.
- **The edge of the world.** The town ends at things you can see: a seawall with a railing and lamps around the city, banks of rocks where the beach meets the sides, and the surf. Lumina Boulevard runs west over the **Halcyon Causeway** (reopened: the storm repairs are finished, a pair of pylons with neon tops marks the new span) to Solano Key, which has its own seawall all round; the east end of the boulevard is a turnaround at the wall, and the other streets end at chevron boards and bollards. On the horizon: a mainland skyline across the bay with a bridge out to the key's north shore (traffic lights stream along it at night), a hilly island to the south-east, a lighthouse with a turning beam and a cargo ship crawling along the horizon. Windows light up and twinkle at night; everything fades into the sea haze, and the sky melts into the fogged ocean so the water has no visible edge. The helicopter can fly well out to sea (about 640 m from the line between the two islands); past that a TURNING BACK: LOW FUEL warning eases it round and pushes it home. You can only step out of it over land, on a roof or on a deck.
- **People walk round street furniture.** The same sidestep now works for fixed props: lamp posts, signal poles, sign and billboard legs, palms and street trees, benches, bus shelters, phone booths, newsstands, vending machines, planters, bins and dumpsters, hydrants, bike racks, café tables and chairs, scaffolding legs, lobby planters, the beach huts, kiosk, showers, rental stand, fire pit, logs, umbrella poles and loungers. One static grid (4 m cells, built on the first frame, `src/actors/pedprops.js`) holds ~2,000 oriented boxes from the solid colliders, the footprint registry (`FOOTPRINTS` / `FOOTBOXES`) and the loungers, plus the loose props; a knocked-about loose prop leaves the grid and is checked at its current spot until it goes home, and a knocked-down lamp or sheared hydrant stops counting. Street walkers use the same look-ahead as for cars, but a sidestep must stay on the sidewalk (not out into the road); if a prop and a neighbour leave no way through they stop short and turn round after 3 s. The beach crowd steers round props on the way in, out and when fleeing; props at a person's goal or at the spot they are leaving (the lounger, a fire log, the kiosk counter) are exempt, so sitting, queueing and the fire pit still work, and a person who makes no progress for 3.5 s ignores props for a moment rather than stand there for good. Cost: about 0.05 ms a frame with everyone out. `peds.avoidProps = false` switches it off for comparison, `peds.props.stats` has the counts.
- **Drivers have arms.** Drivers in cars and on scooters / bikes now hold the wheel or the handlebars: two-segment arms (one extra instanced mesh, one draw call) from the shoulders to the wheel rim, turning a little with the steering; hidden with the driver.
- **Solid street furniture.** Palms, street lamps, signal masts, hydrants, phone booths, planting beds, bike racks, umbrella poles, lifeguard huts and chairs, volleyball posts, billboard stilts, surfboards, the Coconut Shack, the rental stand, beach showers, bins, the fire pit and its logs, sandcastles, kayaks and the pier rail all block you, and cars stop against them (a thud and a small bounce, never any heat; a hard hit on the Comet still throws you). Cars collide with a row of circles along the body (bike, tank and helicopter too), so the bonnet stops at the wall instead of sinking into it. The helicopter only minds the tall ones, and only when low. You can still jump over the low ones on skates. Traffic and pedestrians follow their own lanes and sidewalks, so they never snag on them.
- **HUD.** Top right: cash, health bar, the condition of the vehicle you are in, the weapon chip (icon, name, ammo), heat stars and the clock. Top left: a round minimap that turns with the camera (a little bigger than it used to be on desktop and touch, back to the old size on narrow or short screens: roads, buildings, moving traffic, patrol cars and the patrol helicopter and tank (vacant parked cars and bikes aren't drawn), pickups, the five doors as coloured squares, the next job as a star, the current target as a yellow diamond, street events as a blinking blip, a north marker), the district name and the current objective. Context hints sit bottom left; a crosshair in the middle while a blaster is out on foot.

### The old town's streets

The old town's lots are varied from a seed per lot (`src/world/streetscape.js`), so neighbours rarely look alike:

- **Colour.** Each block has its own pastel palette (corals, mints, lemons, lilacs, skies, peaches) and neighbouring buildings never share a colour. Eyebrow ledges come in cream, white, blush or the building's accent.
- **Silhouettes.** Rounded corner turrets (from the first floor to above the roof, with eyebrow rings, wrap-round windows and a dome or a stepped cap with a mast), stepped crowns over the front with fluting and a neon edge, vertical fins with a neon strip and a spire, roof terraces with a pergola, planters and loungers, rooftop neon pictograms on a frame (a palm, a cocktail, a star, waves). The hotels' towers end in one of four tops (the stepped spire, a drum with a mast, a triple step with a neon ball, twin pylons with a crossbar) and carry two to four neon fins.
- **Façades.** Balconies with coloured railings, porthole columns, glass-block strips over the entrance, and murals on rear walls (the windows behind them are left out).
- **Shops.** 24 invented names on lit fascias over the awnings (Seashell Café, Lido Laundromat, Vinyl Lagoon, Gelato Galaxy, Wavelength TV Repair, Pink Palm Pawn, Moonbeam Video...), glowing a little more as the neon comes on.
- **Murals.** Six original paintings (a striped sunset with "Greetings from Lumina", flamingos with confetti, layered waves, a neon grid horizon, monstera and hibiscus, an art-deco sunburst) on the backs of the beachfront hotels and the midtown blocks.
- **The inner streets.** Street trees in pits with grates along the back avenues, café terraces (tables with parasols and chairs, all loose props you can knock about and sit at) outside the cafés and behind the hotels, six bus shelters (roof, glass back, bench, an ad panel, a stop pole), more bike racks, planters and newspaper boxes, three more phone booths, scooters at the kerb, utility covers and hairline cracks painted on the sidewalks.
- **The alleys** (the 4 m gaps between buildings): paved with a drain down the middle; dumpsters with bin bags, fire escapes (landings, rails, flights, a drop ladder), laundry lines with pastel washing, and string lights zigzagging overhead in some.
- **Rules.** Nothing goes in a junction, on a carriageway, in a doorway, on a venue or story ring or on top of what is already there; colliders are added for everything solid; the new pieces add one draw call (the fascia and mural atlas) and about 40,000 triangles to the merged town.

### Street trees

Besides the Kenney suburban tree, the streets of both districts are planted with seven original low-poly species (`src/world/streettrees.js`): **royal palms** (a tall smooth grey trunk, a green crownshaft, arching fronds), **coconut palms** (curved, leaning, drooping fronds and nuts), **fan palms** (a short ringed trunk with round fan leaves), **fig trees** (a thick trunk under a broad bushy canopy), **jacarandas** (violet-blue flowering canopies), **sea grapes** (low spreading shrub-trees with big round leaves) and slim **cypresses**. Every street has a dominant species and some variety (Back Avenue 1 under coconut palms, Back Avenue 2 under figs; on the key, royal palms along Stadium Way, figs and cypresses downtown on Glasswater Street, jacarandas on Marina Street, sea grapes and coconuts on Dockside Road, the suburban tree and jacarandas in Mango Grove), and each tree its own height, width, turn and a slight shade of its foliage; palms sway a little. One instanced mesh per species for the whole coast (at most seven draw calls), only the trees within about 230 m (160 m on Low) drawn; on Low each species uses a simpler model (fewer fronds and leaf clusters).

**Nothing stands on a road.** Everything that is built straight into the town meshes and stands on the ground (sign and billboard legs, the causeway's pylons and lamps, bus shelters and stop poles, phone booths, trees, racks, planters, dumpsters, bollards, dead-end boards) is registered as a footprint and checked against every carriageway and the causeway lanes in both districts, together with the props (`debug.footprints()`, `debug.propsOnRoad()`, both `[]`; dev builds report it in the console). The welcome sign on the Halcyon Causeway used to stand on two legs in the middle of the lanes: it now hangs from the crossbeam between the two pylons, which stand outside the railings.

### City detail

Chosen to make the street read as a place without adding draw calls (almost everything is merged into the existing city meshes):

- Rooftops: air-conditioning units, vents, water tanks, aerials with red beacons, satellite dishes, set-back penthouse tiers with their own neon band.
- Billboards with made-up ads on roofs and on stilts along the promenade (Flamingo Fizz, Wave 86 FM, Comet 500, Dance-Off Saturday and friends).
- Shopfronts on the back streets: awnings in four styles (striped, a rounded hood with a scalloped valance, a dark box canopy with a neon edge, steep candy stripes), wide lit windows, neon blade signs in five shapes, and a lit fascia with the shop's name over each (see [The old town's streets](#the-old-towns-streets)).
- Door emblems in neon for the five places (flamingo, prism, zigzag, "24", a lightning bolt with a firework burst).
- Street furniture: benches, bins, fire hydrants, solid phone booths with a light inside, vending machines, newspaper boxes, bike racks, sandwich boards outside shops, potted plants by shop doors and cafés, and raised concrete planting beds with flowering shrubs and grasses along the promenade, the Deco Row façades and the pier foot. Every piece is checked against the carriageways at build time (nothing stands in a lane), and dev builds (`npm run dev`) report any prop on a road in the console.
- Ground paint: kerbs, parking bays, manhole covers, sidewalk seams, a skate lane on the promenade, a volleyball court (raked darker inside its lines) and soft shade under the boardwalks.
- Beach and pier: see [Coral Beach](#coral-beach); on the pier, crates, benches and life rings, moored boats that bob, buoys.
- Life: a flock of gulls circling the pier and the beach (one instanced mesh, animated in the vertex shader).
- Palm variety: squat and lanky palms with slightly different greens.

## Coral Beach

The old town's beach (Solano Key has a seawall all round, so this is the only sand). It used to be wall-to-wall palms and loungers, with palms even on the volleyball court; now it has room to breathe.

- **Palms** stand in seven small groves by the promenade and the dunes: 17 on the sand instead of 33, with open sand between them.
- **Umbrellas and loungers** come in four rental clusters in neat rows (each in its own colour with a rental sign): 15 instead of 32.
- **New things on the sand** (all low-poly, merged into the town's one static mesh, so no extra draw calls): the **Coconut Shack** (a pastel hut with a thatched roof, a counter with a blender and fruit, a chalk menu; `F` at the counter, touch **Buy**, from 7:00 to 20:00 for a Sunset Smoothie, a soft-serve cone or a fresh coconut), a **rental stand** with a stack of loungers and a rack of surfboards, three wooden **boardwalks** across the dunes, **beach showers** on slatted platforms, trash and recycling **bins**, a **fire pit** ringed with stones and four driftwood logs to sit on (the fire is lit at night: flickering flames, a glow and a warm pool on the sand), **sandcastles** with a bucket and spade, **towels** with a bag and flip-flops, **kayaks and paddleboards** drawn up at the waterline, surfboards stuck in the sand, **dune grass** along the back of the beach, shells and driftwood, and a **buoy line** marking the swimming area offshore. The lifeguard huts and tall chairs and the volleyball net (with bleachers moved back off the run-off) stay.
- **Exclusion zones.** Nothing may stand on the volleyball court and its 3 m run-off, the Dune Run ramp and landing, the lifeguard huts and chairs, the boardwalks, the fire pit, the kiosk and its queue, or the wet strip along the waterline (`BEACH_ZONES` in `src/world/beach.js`). `checkBeach()` tests every palm, umbrella, lounger and towel, collider, loose prop and beach item against them; dev builds report any offender in the console and `__neon.debug.beachCheck()` returns the list (empty).
- **The beach crowd** (up to 27 people, the same refined blocky pedestrians and the same few draw calls, plus one instanced mesh of props and one of balls while you are near the beach) follows the clock:

| Time | Who is on the beach |
| --- | --- |
| Morning (6-10) | joggers on the wet sand, dog walkers (with dogs on leads), a yoga group on mats with an instructor (tree, warrior, forward fold), surfers sitting on their boards past the shallows, now and then lying down to paddle |
| Day (10-17) | sunbathers on loungers and towels, swimmers in the shallows, a four-player volleyball game (the ball really goes over the net: dig, set, spike), a frisbee pair and a bat-and-ball pair, kids building sandcastles, a queue at the Coconut Shack (served one by one) |
| Sunset (17-20) | people sitting on the sand watching the sun go down, couples strolling the shoreline, photographers with cameras, a last jogger |
| Night (20-6) | a few people on the logs round the lit fire pit, a couple of late walkers; nobody sunbathes or swims |
| Rain / storm | the beach empties (one walker and one jogger in the rain, nobody in a storm) |

  The Coconut Shack has someone behind the counter while it is open. When the hour or the weather changes, whoever is not wanted any more walks off up the beach and newcomers appear out of sight or walk in from the promenade. They react like everyone else (they flinch and run from shots, bangs and sirens, a car sends them tumbling) and are never harmed. People far away tick at a quarter rate; nothing runs or draws while you are away from the beach.

## Solano Key (across the causeway)

Drive, ride or skate west along Lumina Boulevard and over the Halcyon Causeway (a news toast at the start says it has reopened). The key is about as big as the old town, with its own road grid (signalled junctions, traffic, a sidewalk graph with crossings) joined to the boulevard, so the same traffic, Comets, Coast Patrol and pedestrians drive and walk both districts. The fleet and the crowd follow you: cars and people left far behind are brought round to where you are, out of sight.

| District | What is there |
| --- | --- |
| **Glasswater** (downtown) | Glass towers up to 112 m with rooftop helipads (lit pad rings, a red beacon on a mast) and the **Solstice Spire** on the waterfront with its roof terrace (see [The Solstice Terrace](#the-solstice-terrace)), office blocks with ribbon windows, the Pelican Point Lofts and other apartment blocks with balconies. A helicopter waits on the Glasswater Tower helipad. |
| **Sunbowl** | An open-air stadium: stepped stands in team colours with a crowd, canopies, four floodlight masts that glare at dusk and night, a pitch with its markings, a dot-matrix scoreboard (STINGRAYS 3, PILOTS 1) and a big car park with a pay booth. |
| **Moonlite** | The Moonlite Motor Inn: two storeys with an open walkway, and a roadside sign with VACANCY in red neon. |
| **Fernwood Park** | Lawns, paths, a pond, a bandstand, benches you can sit on, palms and trees, low hedges, and a grassy hill with a kicker on top. |
| **Mango Grove** | A suburban street of pastel houses (Kenney City Kit Suburban, recoloured) with fenced front yards, driveways, porch lights and trees, plus a row of houses along Halcyon Avenue. |
| **Halcyon Avenue** | Art-deco hotels (Hotel Mirabel, The Azure Palms) by the causeway landing, the pastel Seafoam Galleria mall with a glass atrium, a fountain plaza, apartment blocks. |
| **Starboard Marina** | Boardwalk, a pier with pontoons, ladders and moored boats, the marina office. |
| **Tradewind Docks** | Warehouses, rows of stacked containers, three gantry cranes on the quay, and an unfinished raised overpass. |

Street lights in the key are Quaternius models (the glass is see-through, the bulbs glow at night) and the junctions have stop, give-way and no-parking signs.

**Downtown street level** (`src/world/keyscape.js`). The key is the dense, high-rise side of the coast, so its streets are dressed the downtown way rather than with the old town's alleys:

- **Lobbies** on the glass towers, offices and apartment blocks: a canopy on brass posts with a neon edge, a glass revolving door, a doorman's lectern with a lamp, planter boxes either side and two flags over the canopy; ornate double-globe lamp posts beside the towers' lobbies.
- **Ground-floor shops** on every street face of the offices and apartment blocks: shop windows between cream piers under deep sign bands, with 24 invented names on their own painted atlas (Skyline Deli, Corner Bodega 24, Glasswater Bagels, Penthouse Pizza, Bluebird Books, Nightowl Diner, Steam & Bean, Neon Noodle Bar...), lit at night, and café tables outside the food places on the deepest sidewalks.
- **Metro entrances** (Glasswater, Sunbowl, Halcyon and Marina stations): railed stairwells going down, two globe lamps (one green) and a name board. **Newsstands** (a green kiosk with magazines and an awning), **food carts** under striped umbrellas, **steam** curling up from utility covers downtown (one points mesh, risen in the shader; thinner on Low), plain utility covers elsewhere.
- **Building work:** a sidewalk shed with scaffolding up three floors on two buildings; **loading bays** with roller shutters, a dock platform, bumpers and bollards on side walls; **water towers** (a wooden tank on steel legs) on the office and apartment roofs, clear of the stair huts, billboards and roof clutter.
- **Street furniture:** street clocks, mailboxes, fire hydrants (loose, like the old town's), taxi stands with a yellow kerb in front of the hotels and the galleria, bike-share docks, bus shelters on Halcyon Avenue and Stadium Way, phone booths, bike racks, newspaper boxes and planters, all on the kerb line or against the buildings so the walking line in between stays clear; street trees in pits along every street (see [Street trees](#street-trees)).
- **A pocket park** beside the way down to the marina pier: lawn and path, four benches you can sit on, four trees, two ornate lamps and a low railing.
- **Rules.** Nothing goes on a carriageway, in a junction, in the stadium or its approaches, the car park, Fernwood Park, the marina boardwalk or the docks, on a stunt ramp, its run-up or landing, in a doorway or on a roof exit, a venue ring, a parking slot, or on top of what is already there. Everything merges into the key's two meshes except the shop fascias (one atlas mesh) and the steam (one points mesh): two draw calls and about 45,000 triangles.

**The Moonlite fix.** The motel blocks built their upper walkway, railing, stairs and doors along the building's x width whichever way they faced. Both motels face east (Mango Grove), so their 50 m walkways ran past the 30 m and 20 m lots: the lilac block's walkway, railing and end stair stuck out about 3 m into **Stadium Way**'s lanes, and the Moonlite's ran 10 m past both ends of its lot; the roof overhang was stretched the wrong way and the VACANCY sign's pole stood inside the building. Everything now runs along the street face, the overhang reaches over the walkway, and the sign stands 5 m out in front of the north end of the lot. Every ground-level part (below 5 m) of every lot built in keyCity.js (bodies, walkways, stairs, canopies, sign poles, fins) is now registered as a box (`FOOTBOXES` in `layout.js`) and checked against every carriageway by `debug.footprints()` / `debug.propsOnRoad()`, so an overlap like this is reported. The minimap shows both islands, the causeway, the helipads, the stadium and the stunt ramps; the district name under it covers both.

## Billboards

Rooftop billboards, wall ads on the end walls that face the side streets in the old town, and billboards on stilts, all with invented 80s ads (Hyperwave Cassettes, Glo-Cola, Laser Lanes Bowling, Radvision VHS, Sunset Sneakers, Mega Byte Arcade, Starlite Drive-In, Synthwave 99.1 and more). Each has lamps on arms over it; they and the ads brighten at night.

## Vehicle types

The traffic, the parked cars and the spares are a mix of fifteen types (`src/vehicles/types.js`). Each drives differently, has a collision body sized to it (a row of circles along its length; people on foot walk round its length x width box), its own condition, eye height and chase-camera distance, and **its own engine sound**. All of them can be taken (`E`; a car with a driver is a carjack), driven, damaged (smoke, sputter, fire, cartoon explosion, charred wreck; the procedural sedan dents, the others darken), sunk and shown on the minimap (the long ones as bigger dots). All designs are generic: no real makes, models or liveries.

| Type | Model | Handling | Engine sound |
| --- | --- | --- | --- |
| **Sedan** | procedural (the original wedge-nosed 80s car) | the all-rounder | the classic soft saw hum |
| **Hatchback** | Kenney Car Kit | light, nimble, grippy, modest top speed | small four, higher and thinner |
| **Convertible** | original: top down, chrome windscreen and roll hoop, red seats | quick, fastest of the cars, sharp | sports engine: a bright saw pair an octave apart that opens up with the revs |
| **Muscle car** | original: long bonnet with a scoop, haunches, quad lamps, two stripes | hardest pull, heavy, loose at the back (it slides) | deep V8 rumble: low, a resonant growl |
| **Pickup truck** | Kenney Car Kit | heavy, softer grip | V8-ish, a lighter growl |
| **SUV** | Kenney Car Kit | heavy, steady | smooth low six |
| **Taxi** | Kenney Car Kit (a plain yellow cab) | like the sedan, a touch heavier | a slightly lower sedan |
| **Van** | Kenney Car Kit | slow to pull, wide | small diesel |
| **Delivery van** | Kenney Car Kit | heavy, slow, wide turns | diesel: a softer, rounder tone with a faint grit of noise |
| **Ice-cream truck** | original: pastel box with a cream drip band, a serving hatch and awning, a giant cone on the roof | slowest of the vans | diesel |
| **Bus** | original: 10.6 m, two-tone with a window band, kerb-side doors | very heavy (shoves cars aside), slow, wide turns; high eye, far camera | deep bus diesel: very low, a little grit |
| **Garbage truck** | Kenney Car Kit | heavy and slow | deep diesel |
| **Ambulance** | Kenney Car Kit | brisk for its size | van engine |
| **Comet** | procedural sport bike | wheelies, leans, fastest of all, fragile | sport-bike whine |
| **Scooter** | original: step-through with an apron and a round lamp | light, slow, twitchy | light two-stroke tone: one smooth rise (like a CVT), quiet |

**Engine sound.** Deliberately soft and smooth, the same design for every type: the revs follow the speed quickly going up and slowly (about a second) coming down, and the pitch is a continuous function of them, so there are no gear steps and lifting off the throttle is a smooth fall, never a jump. The level and the filter glide with long time constants; there is no amplitude pulsing at all. Every type keeps the level rules: louder only while the revs change, settling to a soft hum after a few seconds at a steady speed, ducked under the music. What differs per type is subtle (`ENGINES` in `src/audio/audio.js`): the two oscillators' waveforms and ratio, the base pitch and its range, how far the filter opens and its resonance (a V8's thicker growl), a faint band of noise under the diesels, and the loudness. The sense of speed comes from a quiet **tyre and wind** noise layer that rises with speed. (An earlier design stepped through gears and wobbled the level at a fraction of the pitch for burble and clatter; on lift-off the pitch dropped a whole gear in one go, tens of hertz in a frame, and the wobble chopped at low revs.) The table's "engine sound" column now describes the character: the bright, burbling or clattering ones are timbre only.

**The mix in traffic** depends on where and when (each car is given a type whenever it is put on the road out of sight): taxis come out at night (about four times as many downtown on the key), delivery vans and vans run by day, the garbage truck in the early morning, the ice-cream truck on old-town afternoons, convertibles and muscle cars cruise at night, SUVs and pickups are commoner on the key, and there are never more than two buses, one garbage truck, one ice-cream truck and one ambulance at once. Long vehicles keep their distance in queues.

**Parked.** The kerbs start with a seeded mix of the everyday types (no buses or trucks), the Sunbowl car park has vans, pickups, delivery vans and taxis, four scooters stand at the back-avenue kerbs, and the spare pool (on foot with nothing to drive nearby) has ten cars of different sizes up to a bus: a long one only goes to a slot where its whole body fits (both ends on the parking lane, clear of junctions, doorways, buildings, street furniture and other vehicles).

**Cost.** The sedan and the Comet keep their instanced meshes; every other type, Kenney model or original, is an instance in one `BatchedMesh` (one draw call for all). Past about 90 m (55 m on Low) a batched car is drawn as a 70-triangle stand-in.

## Rooftops

Every flat roof is solid, in both districts: the cornice ring and the raised parapet step in the old town, the roof slabs and helipads in the key, and the container tops at the docks.

- **The helicopter can land** on any flat roof or helipad (except the Solstice Terrace); `E` gets you out onto the roof (on the side with room to stand).
- **Walk the roofs.** Rooftop clutter (air-con units, water tanks, aerials, dishes, plant rooms, penthouse tiers, sign frames, billboards) is solid.
- **Mind the edge.** Walk off and you fall: a short drop is nothing, a few storeys hurts (OUCH), a long way knocks you out (**KNOCKED OUT**, the usual clinic bill).
- **Roof doors.** Every roof (but the Solstice Spire's, which has its lift) has a stair hut with a lit door: `F` (touch: **Stairs down**) takes the stairs down and you come out at the street door below.

## Stunt jumps

Eight ramps, painted in hazard stripes with neon edges and chevrons on the run-up (orange arrows on the minimap):

| Jump | Where |
| --- | --- |
| Dune Run | Old town: off the promenade across the beach |
| Promenade Leap | Old town: along the promenade |
| Sunbowl Kicker | Over the show cars in the stadium car park |
| Fernwood Hill | Up the park hill and off the kicker on top |
| Container Leap | Over a container across the docks yard |
| Overpass Gap | Up the unfinished overpass and across the gap to the other deck |
| Marina Splash | Off the end of the marina pier into the sea |
| Galleria Hop | Over the mall's fountain plaza |

The **Overpass Gap** is forgiving now: the landing deck and the ramp down are 15 m wide (the run-up is 9), the gap is 6 m instead of 10, the landing zone covers the whole of it, and the parapets along both decks are solid guard rails, so a car that lands a little off line stays on the deck instead of sliding off the side.

Cars and bikes now have vertical physics: they follow ramps and decks, fly on with the speed the ramp gave them and land on whatever is below (a bad landing dents the car a little; the side of a ramp or a deck is a wall). Hit a ramp fast enough and land in its zone for a clean jump: a moment of slow motion with the camera off to the side (no camera move with reduced motion), the **AIRTIME!** card with the distance, height and flips (steer hard as you leave a kicker for a barrel roll), and cash (more the first time). The pause panel shows **stunts found x/8**; found jumps are kept with your save.

## Controls

| Key | On skates | Car | Comet bike | Disco Tank | Helicopter |
| --- | --- | --- | --- | --- | --- |
| `W A S D` / arrows | skate | accelerate, brake / reverse, steer | throttle (wheelie from low speed), brake, lean | drive, turn on the spot | `W`/`S` forward / back, `A`/`D` yaw |
| `Shift` | sprint | | | | |
| `Space` | jump | handbrake (drift) | | | climb |
| `C` or `Ctrl` | | | | | descend |
| `E` | get in or on the nearest vehicle, or take an occupied one; on the Solstice Terrace: the lift down, June's bar | get out | get off | get out | get out (land first, on the ground or a roof) |
| `F` | sit down near a seat or on the sand, get up; buy from a vending machine or the Coconut Shack; on the club dance floor: dance; at a roof door: take the stairs down | | | fire | |
| Mouse drag | orbit the camera (right-drag too) | orbit | orbit | aim the turret | orbit |
| Click / `R` | fire the blaster (aim with the camera; hold `R` to keep firing) | fire ahead (auto-aim) | fire ahead (auto-aim) | fire | |
| `G` | throw a firework bang (hold for distance) | drop a bang behind you | drop a bang behind you | | |
| `Q` / wheel, `1`-`5` | switch blaster / put it away, pick one (seated on the Solstice Terrace: `1` wait for the sunset, `2` wait for the night) | switch | switch | | |

Indoors: `W A S D` walk (the camera looks in from the door, so `W` is further in), `Shift` hurry, `E` at the yellow ring (Dee's counter, the podium, Gus's counter, Zizi's counter, the Club Prism bar, the venues' counters, the Solstice Spire's lift and concierge desk), `F` to sit on a stool or a booth or to dance on the club floor, walk into the white ring to leave. In a shop menu: `W`/`S` or arrows choose, `Enter` buys or wears, `Esc` closes. Blasters stay holstered indoors.

Anywhere:

| Key | Does |
| --- | --- |
| `~` or `T` | open the cheat console |
| `N` | skip to the next part of the day (dawn, day, golden hour, dusk, night) |
| `[` / `]` | slow down / speed up the clock (frozen, x0.25, x0.5, x1, x2, x5, x15, x60) |
| `Space` / `Enter` / click | in a scene: finish the line, then next line (lines also move on by themselves after a reading time: about 1 s plus 60 ms a character) |
| `X` or `Esc` | skip the scene |
| `Enter` / `Esc` | on the JOB BLOWN card: retry from the checkpoint / drop the job |
| `M` | music on / off (see [Music](#music)); `Shift+M` mutes all sound, effects included |
| `P` | perf panel (FPS, draw calls, triangles, the current render resolution scale and graphics level, AI cars and pedestrians with the target for the hour, animals, page size) |
| `K` | **cinematic camera** (see [Graphics and cinematic mode](#graphics-and-cinematic-mode)); any key, click, tap or scroll ends it |
| `V` | switch camera: third person, close third person, first person (remembered between visits). In first person, vehicles get a cockpit: pillars and a dashboard with live gauges in cars, handlebars and a speedo on the bike, canopy frame and altimeter in the helicopter, a vision slit and reticle in the tank |

Tip: in the helicopter prefer `C` to descend. `Ctrl` works too, but `Ctrl+W` is still the browser's "close tab" shortcut. For the same reason the blasters fire with a click or `R`, not `Ctrl`: you would be holding `W` at the same time.

## Touch controls

- **Left thumb:** touch anywhere on the left half and a stick appears under your thumb. It skates or walks; in a car, on the Comet, in the tank or the helicopter it steers and gives throttle (pull back to brake or reverse). Push it all the way out to sprint on foot.
- **Right side:** swipe on the empty right half to turn the camera (or look around in first person, or aim the tank's turret).
- **Buttons, bottom right:** they change with what you are doing and match the keyboard: **Jump**; **Enter / Ride / Take** (`E`) next to a vehicle; **Sit / Dance / Buy** (`F`) near a seat, on the club floor or at a vending machine; **Use** (`E`) at a counter; **Lift** and **Order** on the Solstice Terrace, **Sunset** / **Night** / **Get up** seated up there; in a car **Drift** (handbrake), **Brake** and **Exit**; on the bike **Brake** and **Get off**; in the tank **Fire**; in the helicopter **Up**, **Down** and **Exit** (**Land** in the air); in a scene **Next** and **Skip**; on the JOB BLOWN card **Retry** and **Drop**.
- **Blasters:** with a weapon out, **Fire** becomes the big button (on foot it auto-aims at the nearest vehicle in a wide cone in front of the camera, or fires straight ahead; in a car or on the Comet it fires ahead with auto-aim), **Bang** throws a firework bang (hold for distance; **Drop** in a vehicle drops it behind you) and **Swap** cycles the weapons.
- **Top right:** **View** (camera view, like `V`), **Codes** (the cheat console with a tappable list of every code; tap the input line if you would rather type), **♪** (music on / off, like `M`; struck through while the street music is off), and the gear (pause + controls + subtitle size).
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
| `REWIND` | Forgets the saved story progress, outfits, blasters, the motel save, the snorkel vest and the arcade best. |
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

## Graphics and cinematic mode

The pause / settings panel (gear button, top right) has a **Graphics** choice, **Low** or **High**, remembered on the device. It defaults to High on desktop and Low on phones and tablets.

| Effect | High | Low |
| --- | --- | --- |
| **Night bloom** | A half-resolution bloom (bright pixels, a two-pass blur, added over the frame): neon signs, lamps, headlights and lasers glow. It is strong at night and a faint sheen by day. Three full-screen passes, only while it is on. | off |
| **Neon pools** | The big neon signs (hotel names, shopfront blades, the stadium, the marina gate and so on) throw a pool of light in their own colour on the street at night, painted into the same canvas as the street-lamp pools, so it costs nothing per frame. | lamp pools only |
| **Street trees** | Full models, drawn within about 230 m | simpler models (fewer fronds and leaf clusters), within about 160 m |
| **Vent steam** | All the puffs | about half of them |
| **Shoreline foam** | Swells that roll in with a sharp crest and a lacy tail, a wash that runs up the waterline and back (on the beach and along both seawalls), and foam rings round the pier posts, all inside the ocean shader (no extra draw call). | the plain surf line |
| **Night ambience** | Moths fluttering round the street lamps near you; fireflies blinking over Fernwood Park and in nearby palms. One instanced `Points` draw, only at night, not in rain, not indoors. | off |

**People and cars under street lights.** At night the street-lamp and neon pools light characters (Skye, pedestrians, the beach crowd, drivers, everyone outdoors) and vehicles too, not just the ground: their materials (`src/world/lamplight.js`, patched into the shared blocky-character material and the two car materials) read the same lamp-pool canvases and uniforms as the ground shader by world position, add the light as diffuse (a little more on the legs than the head, nothing above about 5 m), fade it in under the same night and sunset-glare terms and roll it off softly so pale clothes don't blow out. No extra cost per character; indoors it is switched off (the rooms have their own light); by day nothing changes.

**Resolution** (also in the panel): *Auto* watches the frame time. If frames stay slow for a couple of seconds the render pixel ratio steps down (about 15 % at a time, never below 0.6 pixels per CSS pixel); when there is headroom for a good while it creeps back up, waiting longer each time a climb was followed by another drop. *Full* keeps the full pixel ratio. The `P` panel shows the current scale and the graphics level.

**Cinematic mode.** Press `K`, or choose *Start cinematic mode* in the pause panel (that is the touch button too). The HUD and touch controls hide, letterbox bars slide in and the camera flies a slow orbit round Skye (or the vehicle), drifting in and out and up and down. It pulls in or lifts over buildings that would block the view. Any key, click, tap or scroll ends it (that input is not passed on to the game). It is not available during a scene, in a shop or indoors (the Solstice Terrace is outdoors, so it works there, seated or not). With reduced motion the orbit is much slower and level.

## Hardware notes

- Built for integrated laptop graphics: a typical street frame is about 52 to 56 draw calls in the old town (two more near the beach for the beach crowd's props and balls, one more at night for the fire pit) and 40 to 52 in Solano Key (57 on the causeway, where both districts are in view) with all traffic, pedestrians, beach animals, loose props, planters and the horizon on screen. The new effects add at most a handful while something is happening: smoke and debris, beams, shockwave rings, projectiles, the blaster in your hand and an event's bag and ring are each one pooled or instanced draw call, drawn only while in use. Indoors the camera only renders the room's layer (the room, the cast, the courier, the rings), so Club Prism with its whole crowd, lasers, lights and lounge is about 28 draw calls. No shadow maps. The only post-processing is the High-quality bloom (three full-screen passes at half and quarter resolution, only while it is on; the frame is copied once, the scene is not re-rendered). The other new effects add at most one draw call (the night ambience points, only at night). Interiors are built the first time you walk in and hidden when you leave. Each district keeps its detailed meshes in one group; from more than about 240 m away the group is hidden and a one-draw-call silhouette (hazed boxes with night windows) stands in for it. The key's walls all take their windows from one shader (punched, curtain glass or ribbon windows from the world position, lit at random at night), so its whole skyline is one draw call; its detailed street lights are drawn only within about 190 m (their glow sprites carry them further at night).
- **The Solstice Terrace** sees both districts in full: about 85 draw calls and 0.72 M triangles on Low, about 90 and 0.75 M on High (at sunset with a full terrace), roughly the causeway's cost plus a handful for the terrace's own pieces (the glass, the warm light pools, June, the lift doors and the guests' four instanced meshes, all hidden unless the camera can see the deck). Everything solid up there is merged into the key's one solid mesh. The Spire's lobby is 9 draw calls on Low, 13 on High.
- The pixel ratio is capped at 2 (1.5 on phones and tablets), and it is checked again whenever the window, the zoom or the screen changes. On top of that the adaptive resolution (above) lowers it by itself when the frame rate suffers. You can also pick **Low** graphics, zoom the page in (`Ctrl` / `Cmd` + `+`) or shrink the window: fewer pixels is the big lever.
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

- **Single file.** No images, audio files, fonts or CDN requests; system font stacks only. The few licensed models (see [Credits](#credits)) are flattened by `tools/bake-models.mjs` at build time into one compact binary (positions quantised to 16 bits, colours baked per vertex from the material colours or Kenney's colormap into a small palette, flags for car paint, glass and lamp bulbs), which esbuild embeds; `src/world/kits.js` expands a model into a flat-shaded vertex-coloured geometry that merges and instances like the procedural town.
- **Procedural town.** `src/world/layout.js` lays out the island from a seeded random generator; the ground, the collision boxes and the minimap are all drawn from that one description. `src/world/roads.js` derives the lane graph and signal timing from the same road numbers.
- **Few draw calls.** All buildings, rooftop clutter, street furniture and beach props are merged into one mesh with vertex colours, all neon tubes into another. Windows (about 9,000), palms, street lamps, umbrellas, signal masts and signal lamps are each one `InstancedMesh`. The whole car fleet is one instanced mesh for bodies, one for glass, one for shadows, one for headlight pools; the Comets are one more. All pedestrians and drivers together are five: torsos, heads, limbs, hats, blob shadows.
- **Daily curves.** `TRAFFIC_CURVE` (actors/traffic.js) and `CROWD_CURVE` (actors/peds.js) give the share of the fleet and the crowd out at each hour; a small manager parks or returns one car or person at a time, only where the camera cannot see (`unseen` / `outOfSight` in core/util.js).
- **The beach.** `src/world/beach.js` is the beach as data (palm groves, rental clusters, the kiosk, the fire pit and every other beach prop, the exclusion zones and `checkBeach()`) plus their geometry; `src/actors/beachgoers.js` is the beach crowd: slots for every activity, a timetable (`PLAN`), the ball games, the kiosk queue and the poses, drawn in the pedestrians' instanced meshes.
- **Eating.** `src/game/eat.js`: the food and drink models, the hand-to-mouth animation on the courier's arm pivots, healing capped at 100 and the REFRESHED buff.
- **Animals.** `src/actors/animals.js`: one InstancedMesh per species. Legs, wings, flippers and the dog's tail are moved in the vertex shader from a per-instance action attribute; the meshes are hidden and the logic idles when the camera is far from the beach.
- **Horizon.** `src/world/horizon.js`: all distant scenery is one merged mesh with its own distance haze and night windows, plus one point-light set (also used for a pair of blinking amber lamps left on the causeway) and the lighthouse beam; the same material draws each district's silhouette. The ocean plane follows the camera out to the far plane. `src/world/edges.js` builds the seawall, rocks, causeway and dead ends into the city's merged meshes, and `clampToWorld` in layout.js lines up with them.
- **Solano Key.** `src/world/key.js` is the key as data (buildings, roads, lamps, the stadium, park, grove, marina, docks, stunt ramps); `src/world/keyCity.js` builds it (ground canvas, one solid mesh with shader windows, neon, Quaternius lamps with LOD, palms, glow); `src/world/districts.js` swaps each district for its silhouette from far away; `src/world/ads.js` is one atlas and one mesh for every billboard and venue sign in the key and the old town's wall ads.
- **Rooftops and ramps.** `src/world/surfaces.js`: every flat roof, helipad, container top, ramp and deck is a surface in a static grid; the courier, cars, bikes and the helicopter ask it for the ground height. `src/game/rooftops.js` does the roof doors and fall damage, `src/game/stunts.js` the jumps (takeoff and landing come from `vehicles.js`), the slow motion, the side camera and the AIRTIME card.
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
- **Sound.** Web Audio only: the street score and one theme per indoor place (`src/audio/themes.js`) on look-ahead schedulers (each theme keeps its own tempo clock; Club Prism's track runs on the shared beat clock the dance floor uses), crossfaded between places, a small synth kit (electric piano, plucks, a muted horn, a harmonica-like reed, bells, chip voices, pads, brushes, ride, claps) with one or two oscillators per note, per-character subtitle blips, plus engine, rotor, skates, rain, thunder, explosions, siren, horns, cash ticks and the pedestrians' "hey!" built from oscillators and filtered noise.

### Size

**The game's own code** (what we wrote, in `src/`, borrowed assets left out):

| Part | Files | Source size |
| --- | --- | --- |
| JavaScript (game logic, world, actors, UI) | 72 | about 1.2 MB, ~18,700 lines |
| HTML + CSS (`src/index.html`: HUD, menus, styles) | 1 | about 47 KB |
| **Core game source** | **73** | **about 1.25 MB, ~19,400 lines** |

Not counted above: `src/actors/figure.js` (about 133 KB), an experimental character generator that the game no longer uses.

**What ships** (`dist/index.html`, one minified file):

| Part | Minified |
| --- | --- |
| Game code (our JS) | about 683 KB |
| HTML + CSS | about 47 KB |
| three.js 0.187.0 (tree-shaken, MIT) | about 602 KB |
| Borrowed models, embedded (Kenney / Quaternius, CC0) | about 343 KB |
| **Total** | **about 1.67 MB** |

So the game itself is roughly two thirds of a megabyte once minified; the rest is the three.js library and a few borrowed CC0 models.
The `assets/` folder (about 19 MB, 149 models with their licences and a gallery) is a reference library: only the models listed in Credits are embedded in the game.

### Source layout

```
src/
  index.html        page template, HUD markup and CSS
  main.js           boot, loading bar, main loop
  core/             input, shared helpers, spatial grid, quality (Low / High), adaptive (resolution scaling)
  world/            layout, roads + traffic lights, canvas textures, sky + ocean, city builder, details (rooftops, props,
                    billboards, boats, gulls), edges (seawall, causeway), horizon (distant scenery + silhouettes),
                    streetscape (the old town's lot variety, inner streets and alleys), key + keyCity (Solano Key), keyscape (the key's downtown street level), spire (the Solstice Spire's crown, lobby front and roof terrace), streettrees (the street-tree species), lamplight (lamp pools on characters and cars), districts (culling), ads (billboard atlas), surfaces (roofs, ramps),
                    rampGeo, kits (the embedded models),
                    glow sprites, day/night + weather, props (solid street furniture + seats, spatial grid),
                    loose (knock-over physics, lamps / hydrants / palms, vending machines), beach (Coral Beach props + exclusion zones),
                    bloom (post effect), motes (moths + fireflies), neonpools (street light pools of the neon signs)
  actors/           AI traffic + Coast Patrol, pedestrians + drivers, the beach crowd (beachgoers.js), beach animals, dance moves (shared by courier and crowd)
  game/             story.js (all dialogue + mission data), missions (story engine), cutscene (director), activity (sitting, dancing + rhythm),
                    interiors (the five rooms + cast), places (doors, walking indoors, shops),
                    rules (heat, cash, health, pickups, carjack), eat (food and drink models, eating animation), damage (vehicle condition, fire, explosions),
                    combat (blasters, fireworks, patrol lasers), pursuit (the patrol helicopter and tank), parking (spare cars and bikes,
                    parking slots), events (random street events), rooftops, stunts, cinematic (orbit camera mode),
                    spire + spireroom (the Solstice Spire: lift, terrace, guests, waiting for the sunset; its lobby)
  player/           the courier model + skating controller, follow camera
  vehicles/         car / bike / tank / helicopter models and physics, types.js (the fifteen vehicle types: handling, size, sound,
                    traffic mix, the original convertible / muscle car / ice-cream truck / bus / scooter), effect pools
  cheats/           cheat console and codes
  audio/            audio.js (synth kit, schedulers, effects, music on / off), themes.js (the street score and the indoor themes),
                    music.js (the Blue Pelican's record player)
  ui/               minimap, cash / health / heat / clock, objective, hints, toast, perf panel; heathint.js: the cheat-code reminder; touch.js: touch controls,
                    control-mode choice, pause + settings
```

## Credits

Neon Coast's town, characters, story, textures and sound are original and generated in code (recorded tracks for the Blue Pelican Lounge, if you add any, live outside the game file and are credited under [Music credits](#music-credits)). These licensed models are embedded in `dist/index.html` (baked at build time from `assets/packed/`, recoloured in places to the Neon Coast palette):

| Pack | Author | Licence | Used for |
| --- | --- | --- | --- |
| [Car Kit](https://www.kenney.nl/assets/car-kit) 2.0 | Kenney (www.kenney.nl) | CC0 1.0 | hatchback, SUV, taxi, van, delivery van, pickup truck, garbage truck, ambulance |
| [City Kit Suburban](https://www.kenney.nl/assets/city-kit-suburban) 1.0 | Kenney (www.kenney.nl) | CC0 1.0 | eight houses, a fence, two trees (also one of the street-tree species in both districts) |
| Street Pack | Quaternius | CC0 1.0 | the street light, stop / give-way / no-parking signs |

CC0 needs no attribution; it is given here with thanks. None of the MIT-licensed Kenney starter-kit models are embedded. Licence texts are in `assets/licenses/`; the whole asset library is described in `assets/README.md` and `assets/CREDITS.md`.
