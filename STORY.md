# Neon Coast: the story

Everything here is original to Neon Coast. The lines live in [`src/game/story.js`](src/game/story.js); edit them there and rebuild. The script section below mirrors that file.

## Setting

Summer 1986. Neon Coast is a sandbar with one boulevard, one pier and more neon than sense. Everybody on Lumina Boulevard owes somebody, and most of them pay in favours.

West of town, the Halcyon Causeway runs over the water to Solano Key: glass towers in Glasswater, the Sunbowl stadium, the Starboard Marina and the Tradewind Docks. Last winter's storm took out a span and the causeway sat behind barriers all spring. The repair crews finished this week; Wave 86 News announces the reopening the morning the game starts (the toast after the helicopter's), and the boulevard's traffic is pouring over to the key again. The story still plays out on Lumina Boulevard; the key is there to explore, with its rooftops, its stunt ramps and a helicopter waiting on the Glasswater Tower helipad.

Skye delivers those favours on eight wheels. Parcels, crates of Flamingo Fizz, the occasional apology. The best customer is Dee Marlowe, who owns the Velvet Flamingo and is three months behind on its lease: $5,000 by Sunday, or the landlord sells to Marty Glitz, the promoter next door at Club Prism, who wants the bar as a "VIP annexe".

Saturday is the Neon Coast Dance-Off at Club Prism. The prize is $5,000. Dee has entered. Marty is running it, and Marty is a very organised man.

## Characters

| Who | Where | What they are like |
| --- | --- | --- |
| **Skye** | everywhere | The courier you play. Roller skates, a bomber jacket or a party dress depending on the day, a smart answer for everything and a soft spot for robots with feelings. |
| **Dee Marlowe** | The Velvet Flamingo | Owner and bartender. Pink beehive, never stops polishing a glass. Back Bay roller-disco champion, 1979. Bad at business, good at people. |
| **Marty Glitz** | Club Prism | Promoter. Purple suit, gold tie, mirrored shades indoors. Believes in reach, shoulders and filling in paperwork ahead of time. |
| **Gus Pibble** | Pelican Pantry 24 | Night clerk. Maroon Pantry polo with a name badge, a shop cap, permanently startled. Owes Marty for the slush machine. Owns a Comet sport bike that is his whole savings. |
| **DJ Kilowatt** | Club Prism, the booth | Headphones, yellow cap, one hand always in the air. Has not forgiven Marty for the smoke machine incident. |
| **Mimi Zig** | Zigzag Threads | Sells jackets. Has opinions about your shorts. |
| **Zizi Sparks** | Volt & Spark Supply | Pyrotechnician and blaster tinkerer. Tangerine overalls over a dark long-sleeve, yellow straps, teal hair under a goggle band. Everything she sells is "certified toy-grade": it zaps cars and rattles bins and only ever gives people a fright. Takes safety very seriously, in the loudest possible way. |
| **Officer Duarte** | Coast Patrol, in a patrol car | The friendly voice on the patrol car's loudspeaker during street events. Pays a reward for a good tackle. The Coast Patrol only ever appears in its cars. |
| **Patrol Dispatch** | the radio | Calls in the street events: alarms at shops, suspects on foot. |

## The arc

1. **Fizz Run.** A simple delivery for Dee: fetch a crate from Gus, run it to the pier against the clock, come home. Gus is jumpy about men in shiny jackets, and Dee admits the lease is due.
2. **Paper Trail.** Marty hires the fastest wheels on the boulevard to flyer the town for the Dance-Off, then lets slip that the scorecards are "already organised".
3. **Cold Feet.** Gus cracks: the pre-filled scorecards are in a shoebox in his freezer. Skye takes the box and Gus's Comet, shakes Marty's bouncers through the back streets and brings the evidence to Dee, who knows exactly who should read it out.
4. **Last Dance.** Saturday night. DJ Kilowatt reads the cards over the PA, the crowd takes over the judging, and Skye dances for the Velvet Flamingo on skates. The prize goes home to Dee. Paid in full.

Payoff: the Flamingo keeps its lease, Skye gets a cut of the prize and Dee's 1979 jacket (the Flamingo Royale outfit at Zigzag Threads), and Dee's odd jobs pay better from then on.

## Club Prism fills up with the story

The flyers are what bring people in. The club's crowd is data in `CLUB_CROWD` (story.js), picked by `clubTier()` from how far the story has got:

| When | Crowd | Room |
| --- | --- | --- |
| Before **Paper Trail** is finished | quiet: 3 dancers, a regular at the bar, one on a stool, one couple in the lounge, the coat check (7) | DJ Kilowatt warming up (one hand on the deck), music quieter and duller, lights dimmed |
| After Paper Trail | busy: 18 dancers and a full bar, lounge and VIP corner (29) | full system, full light show |
| During **Last Dance** | packed: 28 dancers and every stool (45) | a touch louder and brighter |

New arrivals walk in from the door. The club's conversations are played sitting down in the far booth of the lounge: Skye and the speaker face each other across the table, a second speaker takes the back of the booth, and the dancers keep out of the space round the booth while anyone is talking.

## Volt & Spark Supply

A new shop on Lumina Boulevard, east of the spawn, in the old Aqua Deco Suites front (the hotel name moved to the far east end of the strip). A blue ring at the door, a neon lightning bolt and a firework burst beside it. Inside it is small and brightly lit: a pale checked floor, light walls and ceiling panels, a violet counter with a glass case of firework bangs, and behind Zizi a dark display wall of glowing blasters. Crates of fireworks and rocket bundles line the left wall, a practice target hangs on the right.

The first time you walk in, Zizi gives you the safety talk:

> **ZIZI:** Welcome to Volt and Spark! Goggles on, fingers off the glowy ones.  
> **SKYE:** Zizi, is any of this actually legal?  
> **ZIZI:** Certified toy-grade! It zaps cars, rattles bins and gives people a fright. Nobody gets hurt.  
> **ZIZI:** Bangs are for the road, not the boardwalk. And never zap a patrol car unless you want new friends with sirens.  
> **SKYE:** Shiny things for cars only. Got it.  

## Street events

Between jobs, Neon Coast gets on with its own business. Every few minutes (never during a job, a scene, indoors or while you are wanted) something happens near you, marked with a blinking blip on the minimap:

- **Bag snatcher.** A shopper yells as someone grabs their handbag and runs. Tackle the snatcher, pick up the bag, hand it back: *"My bag! Everything's still in it, even the emergency mints. Here, for your trouble!"*
- **Getaway car.** A shop alarm rings, a dark getaway car tears off with a patrol car behind it, and Dispatch calls it in. Ram it or stop it and Officer Duarte takes over: *"Nice driving, citizen! We'll take it from here."* The stolen takings fall out; the shopkeeper gives you a share for bringing them back.
- **Suspect on foot.** *"All units: suspect on foot near Deco Row! Wanted for swapping price stickers at the Pantry."* Tackle the runner and the officer pays out: *"Textbook tackle! The Coast Patrol owes you one."*

Every line is in `src/game/events.js`; the voices are in the cast list in `src/game/story.js`.

## How a job plays

- The pulsing star on the minimap is where the next job starts. Skate into the ring at that door.
- Every job is a few steps with one objective each, shown under the minimap. A clock only appears on the legs where it matters: the melting ice, the flyer run, the bouncers, the song.
- Steps marked as checkpoints are where a retry puts you. Run out of time, get knocked out or get caught and you see JOB BLOWN: `Enter` retries from the last checkpoint, `Esc` drops the job (it is offered again at the same door).
- Finish the last step and the pass card shows the reward.
- In a scene, `Space`, `Enter`, a click or a tap finishes the line being typed, then moves to the next one; otherwise a line stays up for about 1 s plus 60 ms a character once it is fully shown. `X` skips the scene.

## Full script

### 1. Fizz Run

*Starts at The Velvet Flamingo. Reward $300. Dee is out of syrup and the pier is out of patience.*

**Briefing (The Velvet Flamingo)**

> **DEE:** Skye! Tell me those wheels are warmed up.  
> **SKYE:** They're skates, Dee. They run on gossip and tips.  
> **DEE:** Then here's both. The pier kiosk ordered a crate of Flamingo Fizz and I'm clean out of syrup.  
> **DEE:** Gus at Pelican Pantry is holding my last case. Grab it, run it to the pier, come home.  
> **SKYE:** Pantry, pier, home. And the tip?  
> **DEE:** The tip is I don't tell anyone you cried at that robot movie.  
> **SKYE:** It had feelings, Dee.  

**Step 1 (checkpoint):** Pick up the syrup crate from Gus at Pelican Pantry 24.

> **GUS:** W-welcome to Pelican Pantry, open twenty-four hours, please do not lean on the slush machine.  
> **SKYE:** Easy, Gus. I'm here for Dee's syrup.  
> **GUS:** Oh! Oh, good. It's just you. Crate's right here. It's heavy. It's also sticky. Sorry.  
> **SKYE:** Who'd you think I was?  
> **GUS:** Nobody! Nobody in a shiny jacket asked about the Flamingo. Twice. Have a nice night!  

**Step 2 (checkpoint):** Get the crate to the kiosk at the end of Driftwood Pier before the ice gives up. Timed: 55 s.

**Step 3:** Head back to Dee at the Velvet Flamingo.

> **DEE:** The pier just called. They said the fizz arrived cold and the courier arrived smug.  
> **SKYE:** Both true. Dee, why's Gus jumping at shadows in shiny jackets?  
> **DEE:** Because Marty Glitz wants this bar for a 'VIP annexe', and I'm three months behind on the lease.  
> **DEE:** Five grand by Sunday, or my flamingo gets a velvet rope and a cover charge.  
> **SKYE:** Five grand. That's a lot of fizz.  
> **DEE:** It's exactly one Dance-Off prize. Saturday. Club Prism. Keep your ears open over there.  

**Pass card:** THE PIER IS FIZZY AGAIN

### 2. Paper Trail

*Starts at Club Prism. Reward $350. Club Prism needs flyers on every corner by showtime.*

**Briefing (Club Prism)**

> **MARTY GLITZ:** There she is! The fastest wheels on the boulevard. Marty Glitz. I'm sure you've heard of me.  
> **SKYE:** I've heard your sound system. From the far end of the pier.  
> **MARTY GLITZ:** That's called reach, kid. Saturday is the Neon Coast Dance-Off. Five-thousand-dollar prize. My floor.  
> **MARTY GLITZ:** I need flyers on every corner before the hairspray sets. You skate, I pay. Simple as a drum machine.  
> **SKYE:** Who's judging this thing?  
> **MARTY GLITZ:** Trusted professionals. Hand-picked. By hand. Mine. Now roll, the ink is still wet!  

**Step 1 (checkpoint):** Paper the town with Dance-Off flyers. Timed: 45 s, +26 s per ring. 5 rings.

**Step 2:** Collect your pay from Marty Glitz at Club Prism.

> **MARTY GLITZ:** Every lamp post from here to Back Bay. Beautiful. You could go far, kid. Further, even.  
> **SKYE:** So who's the favourite for Saturday?  
> **MARTY GLITZ:** Favourite? Ha! Let's just say the prize money isn't leaving the building.  
> **MARTY GLITZ:** The scorecards are already... organised. I'm a very organised man.  
> **SKYE:** Organised. Right.  
> **MARTY GLITZ:** Here's your cash. Buy yourself a jacket with shoulders. Shoulders are the future.  

**Pass card:** EVERY CORNER COVERED

### 3. Cold Feet

*Starts at Pelican Pantry 24. Reward $400. Gus has something in the freezer that is not a popsicle.*

**Briefing (Pelican Pantry 24)**

> **GUS:** Skye! Shut the door. Is anyone behind you? Anyone shiny?  
> **SKYE:** Just a guy asleep in the phone booth. Talk to me, Gus.  
> **GUS:** Mr Glitz lent me money for the slush machine. Now he keeps a shoebox in my freezer. I looked. I shouldn't have looked.  
> **GUS:** Scorecards. For Saturday. Already filled in. In pen! His nephew wins by a landslide and the kid can't even moonwalk.  
> **SKYE:** Gus, you beautiful, clammy man. Give me the box.  
> **GUS:** His bouncers check on it every hour. Take my bike, the Comet's out front. She's fast. She's also my whole savings. Please.  

**Step 1 (checkpoint):** Get on Gus's Comet, parked outside the Pantry (E).

**Step 2 (checkpoint):** Shake the bouncers: thread the back streets. Timed: 30 s, +13 s per ring. 5 rings.

**Step 3:** Bring the shoebox to Dee at the Velvet Flamingo.

> **DEE:** You smell like burnt rubber and frozen peas. What did you do?  
> **SKYE:** Borrowed a shoebox. Marty's already filled in Saturday's scorecards.  
> **DEE:** That glitter-plated weasel. I trained for this! I bought leg warmers!  
> **SKYE:** So we take it to the Coast Patrol?  
> **DEE:** Honey, the Patrol are his best customers. No. We take it to the one person in that club Marty can't turn down.  
> **DEE:** DJ Kilowatt. He's got the microphone, and he's hated Marty since the smoke machine incident. Saturday night. Wear something nice.  

**Pass card:** THE BOX IS IN SAFE HANDS

### 4. Last Dance

*Starts at Club Prism. Reward $1,000 and the Flamingo Royale jacket. Saturday night. One shoebox, one microphone, one dance floor.*

**Briefing (Club Prism)**

> **DJ KILOWATT:** Skye on skates! You're not on the list. I like that about you.  
> **SKYE:** Kilowatt. Before the contest starts, you'll want to read what's in this box. Out loud.  
> **DJ KILOWATT:** 'First place: Chip Glitz. Ten, ten, ten.' These are dated today. The contest hasn't started.  
> **DJ KILOWATT:** Neon Coast! Quick word from the booth. It seems tonight was judged LAST TUESDAY!  
> **MARTY GLITZ:** That's a draft! A rehearsal! Everybody rehearses their paperwork!  
> **DJ KILOWATT:** New rules. The crowd judges. And Dee's knee is out, so somebody dances for the Velvet Flamingo. Skye?  
> **SKYE:** On skates? Obviously on skates.  

**Step 1 (checkpoint):** DANCE-OFF! Hit your moves on the beat and fill the vibe meter before Chip Glitz fills his (his rises steadily, about 38 s to the top). Timed: 50 s.

**Step 2:** Take your bow.

> **DJ KILOWATT:** The crowd has spoken, and the crowd is hoarse. Five thousand dollars to the Velvet Flamingo!  
> **MARTY GLITZ:** Fine. FINE. Take the oversized cheque. It doesn't even fit in my office.  
> **SKYE:** Pleasure doing business, Marty. Great shoulders, by the way.  
> **MARTY GLITZ:** ...They ARE great shoulders.  

**Step 3 (checkpoint):** Carry the prize back to Dee at the Velvet Flamingo.

> **DEE:** I heard the cheering from here. Either you won or Marty fell in the fountain again.  
> **SKYE:** Five thousand dollars, one giant cheque. The Flamingo stays a flamingo.  
> **DEE:** Paid in full. Do you know how long I've waited to say that to a landlord?  
> **DEE:** Here's your cut. And this. I wore it the night I won Back Bay roller-disco, nineteen seventy-nine.  
> **SKYE:** Dee, it's pink and gold. It's the loudest jacket I've ever seen.  
> **DEE:** It's called Flamingo Royale, and Mimi's holding it for you at Zigzag Threads. Now go. This coast isn't going to deliver itself.  

**Pass card:** PAID IN FULL

### Odd jobs (repeatable)

*Press E at Dee's counter when no job is running. One timed crate to a random drop; pays half as much again once the story is finished.*

> **DEE:** Back for more? Good. I have a hot one.  
> **SKYE:** Hot costs extra, Dee. So does 'right now'.  
> **DEE:** One crate of Flamingo Fizz for [the drop]. They ran dry an hour ago.  
> **DEE:** [N] seconds before the ice gives up. $[pay] when it lands. Roll!  

### Counter one-liners

**MIMI** (Zigzag Threads)

- Darling! Those shorts are a cry for help. Step up.
- Zigzag Threads: if it clashes, it matches.
- New jacket, new you. Same wheels, sadly.

**GUS** (Pelican Pantry 24)

- Welcome to Pelican Pantry, please do not lean on the slush machine.
- The hot dogs are from today. Mostly.
- You didn't see a shoebox. There is no shoebox.

**DEE** (The Velvet Flamingo)

- Skates off the stools, Skye.
- First fizz is free. The second one is also free. I am bad at business.

**DJ KILOWATT** (Club Prism)

- This next one goes out to everybody on eight wheels.
- Floor is open. Hairspray is optional.

**ZIZI** (Volt & Spark Supply)

- Goggles on, fingers off the glowy ones.
- Everything here is certified toy-grade. Mostly.
- Bangs are for the road, not the boardwalk.
- It only zaps cars and bins. People just get a fright.

### Shop lists

| Zigzag Threads | Price | Notes |
| --- | --- | --- |
| COURIER CLASSIC | yours | Teal bomber, magenta trim. The original. |
| SUNSET STRIPE | $120 | Tangerine with lemon piping. |
| MIDNIGHT ARCADE | $180 | Deep violet, cyan trim, black shorts. |
| MINT CONDITION | $150 | Pistachio and peach. Very poolside. |
| CHERRY BOMB | $220 | Lipstick red, white stripes, no apologies. |
| NEON SLIP | $200 | A hot-pink slip dress with cyan straps. Glows under a mirror ball. |
| TIE-BREAK | $170 | Pleated white tennis skirt, cropped mint jacket. Game, set, skate. |
| MIRRORBALL | $320 | Sequinned lilac party dress. Every light in the room finds you. |
| BOARDWALK SUNDRESS | $140 | Lemon sundress with a tangerine hem. Made for the promenade. |
| SEA BREEZE SLACKS | $160 | Navy bomber, wide cream trousers. Yacht club, no yacht. |
| FLAMINGO ROYALE | $750 | Dee's 1979 roller-disco jacket. Pink and gold. Free once the story is finished. |

| Volt & Spark Supply | Price | More ammo | Notes |
| --- | --- | --- | --- |
| ZAP POPPER | $150 (60 shots) | +60 for $40 | Compact pop blaster. Cheap, quick, short reach. |
| PRISM RIFLE | $480 (36 shots) | +36 for $90 | Three-shot bursts of split light. Long reach, dead accurate. |
| ARC COIL | $620 (24 shots) | +24 for $110 | Short-range lightning that jumps from car to car. |
| FIREWORK BANGS | $200 (5) | +5 for $120 | Throw them (hold to throw further) or drop them behind your car. Short fuse. |
| STARFALL CANDLE | $750 (20 stars) | +20 for $150 | A volley of five homing stars. Pricey, very pretty. |

| Pelican Pantry 24 | Price | Notes |
| --- | --- | --- |
| PELICAN POP | $5 | Fizzy, blue, suspiciously cold. +15 health |
| BOARDWALK HOT DOG | $12 | From today. Mostly. +35 health |
| TURBO CRUNCH BAR | $20 | Oats, glucose and optimism. +60 health |

| Coolwave (vending) | Price | Notes |
| --- | --- | --- |
| COOLWAVE CLASSIC | $3 | Blue, fizzy, tastes like a sea breeze. +10 health |
| COOLWAVE ZERO | $3 | All of the wave, none of the sugar. +8 health |
| TIDAL ICED TEA | $4 | Peach and lemon. Very refreshing, very orange. +14 health |

| Snaxx 24 (vending) | Price | Notes |
| --- | --- | --- |
| SNAXX CHEESE CURLS | $3 | Crunchy, glowing slightly. +12 health |
| STARDUST GUMMIES | $2 | Shaped like little comets. +6 health |
| SNAXX TRAIL MIX | $5 | Nuts, raisins and a single heroic chocolate drop. +20 health |
