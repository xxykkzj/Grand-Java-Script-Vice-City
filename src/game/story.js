// NEON COAST: the whole script lives here. Edit lines freely, nothing else needs to change.
//
// A dialogue line is  [SPEAKER, 'text', shot, act]
//   SPEAKER  a key of CAST
//   shot     'ots' over the listener's shoulder (default) · 'cu' close-up · 'two' side-on two-shot · 'wide' the room
//   (CAST.voice is the pitch of that character's typewriter blip)
//   act      'talk' (default) · 'point' · 'shrug' · 'nod' · 'wave' · 'think'
//
// A mission is { id, title, giver (a place key), blurb, reward, intro: [lines], steps: [...], passed, unlock? }
// Step types:
//   { type: 'visit', place, text, talk: [lines], stay? }      go inside a place; the talk plays there
//   { type: 'drop', at: [x, z], tag, text, time? }             reach a spot on the island (yellow ring)
//   { type: 'route', points: [[x, z], ...], text, time, bonus } hit the rings in order; each one adds `bonus` seconds
//   { type: 'mount', text }                                    get on the Comet parked outside the giver
//   { type: 'tiles', count, time, text }                       Club Prism dance floor: skate over the lit tiles
//   { type: 'dance', target, rival, time, rivalName, lose, text }  Club Prism dance-off: fill the vibe meter (moves on the beat)
//                                                              before the rival's meter (rises `rival` % a second) fills
// Any step can carry `checkpoint: true`: a failed job restarts from the latest one.
// Place keys: bar (The Velvet Flamingo) · club (Club Prism) · wear (Zigzag Threads) · mart (Pelican Pantry 24)

export const CAST = {
  SKYE: { name: 'SKYE', color: '#27e8ff', voice: 1.25 },
  DEE: { name: 'DEE', color: '#ff6ac1', voice: 1.0 },
  GLITZ: { name: 'MARTY GLITZ', color: '#ffd166', voice: 0.7 },
  GUS: { name: 'GUS', color: '#8dffb0', voice: 1.45 },
  KILO: { name: 'DJ KILOWATT', color: '#b9a0ff', voice: 0.85 },
  MIMI: { name: 'MIMI', color: '#ff9a5c', voice: 1.35 },
  ZIZI: { name: 'ZIZI SPARKS', color: '#ffb14a', voice: 1.3 },
  // the venues (game/venues.js)
  DOT: { name: 'DOT', color: '#7fffd0', voice: 1.2 },
  TOKEN: { name: 'TOKEN', color: '#ffe14a', voice: 1.1 },
  HAZEL: { name: 'HAZEL', color: '#d8b8ff', voice: 0.95 },
  KIKI: { name: 'KIKI', color: '#ffd166', voice: 1.4 },
  RUDY: { name: "CAP'N RUDY", color: '#9dffb0', voice: 0.65 },
  BIRDIE: { name: 'BIRDIE', color: '#8fb8ff', voice: 0.9 },
  LEO: { name: 'LEO', color: '#ffcf7a', voice: 0.8 },
  JUNE: { name: 'JUNE', color: '#ff9f6a', voice: 1.3 },
  // voices of the street events (game/events.js): subtitles only, no scene
  DISPATCH: { name: 'PATROL DISPATCH', color: '#5ff0e0', voice: 0.9 },
  OFFICER: { name: 'OFFICER DUARTE', color: '#19d8c8', voice: 0.8 },
  SHOPPER: { name: 'SHOPPER', color: '#ffd166', voice: 1.2 },
  SHOPKEEP: { name: 'SHOPKEEPER', color: '#ff9ac8', voice: 1.05 },
};

export const MISSIONS = [
  {
    id: 'fizz', title: 'FIZZ RUN', giver: 'bar', reward: 300,
    blurb: 'Dee is out of syrup and the pier is out of patience.',
    intro: [
      ['DEE', 'Skye! Tell me those wheels are warmed up.', 'wide', 'wave'],
      ['SKYE', "They're skates, Dee. They run on gossip and tips.", 'ots', 'shrug'],
      ['DEE', "Then here's both. The pier kiosk ordered a crate of Flamingo Fizz and I'm clean out of syrup.", 'ots'],
      ['DEE', 'Gus at Pelican Pantry is holding my last case. Grab it, run it to the pier, come home.', 'cu', 'point'],
      ['SKYE', 'Pantry, pier, home. And the tip?', 'ots'],
      ['DEE', "The tip is I don't tell anyone you cried at that robot movie.", 'cu'],
      ['SKYE', 'It had feelings, Dee.', 'cu', 'point'],
    ],
    steps: [
      {
        type: 'visit', place: 'mart', text: 'Pick up the syrup crate from Gus at Pelican Pantry 24', checkpoint: true,
        talk: [
          ['GUS', 'W-welcome to Pelican Pantry, open twenty-four hours, please do not lean on the slush machine.', 'wide', 'wave'],
          ['SKYE', "Easy, Gus. I'm here for Dee's syrup.", 'ots'],
          ['GUS', "Oh! Oh, good. It's just you. Crate's right here. It's heavy. It's also sticky. Sorry.", 'ots', 'point'],
          ['SKYE', "Who'd you think I was?", 'cu'],
          ['GUS', 'Nobody! Nobody in a shiny jacket asked about the Flamingo. Twice. Have a nice night!', 'cu', 'shrug'],
        ],
      },
      { type: 'drop', at: [40, 233], tag: 'DRIFTWOOD PIER KIOSK', text: 'Get the crate to the kiosk at the end of Driftwood Pier before the ice gives up', time: 55, checkpoint: true },
      {
        type: 'visit', place: 'bar', text: 'Head back to Dee at the Velvet Flamingo',
        talk: [
          ['DEE', 'The pier just called. They said the fizz arrived cold and the courier arrived smug.', 'two'],
          ['SKYE', "Both true. Dee, why's Gus jumping at shadows in shiny jackets?", 'ots'],
          ['DEE', "Because Marty Glitz wants this bar for a 'VIP annexe', and I'm three months behind on the lease.", 'cu'],
          ['DEE', 'Five grand by Sunday, or my flamingo gets a velvet rope and a cover charge.', 'ots', 'shrug'],
          ['SKYE', "Five grand. That's a lot of fizz.", 'cu'],
          ['DEE', "It's exactly one Dance-Off prize. Saturday. Club Prism. Keep your ears open over there.", 'cu', 'point'],
        ],
      },
    ],
    passed: 'THE PIER IS FIZZY AGAIN',
  },
  {
    id: 'paper', title: 'PAPER TRAIL', giver: 'club', reward: 350,
    blurb: 'Club Prism needs flyers on every corner by showtime.',
    intro: [
      ['GLITZ', "There she is! The fastest wheels on the boulevard. Marty Glitz. I'm sure you've heard of me.", 'wide', 'wave'],
      ['SKYE', "I've heard your sound system. From the far end of the pier.", 'ots'],
      ['GLITZ', "That's called reach, kid. Saturday is the Neon Coast Dance-Off. Five-thousand-dollar prize. My floor.", 'ots', 'point'],
      ['GLITZ', 'I need flyers on every corner before the hairspray sets. You skate, I pay. Simple as a drum machine.', 'cu'],
      ['SKYE', "Who's judging this thing?", 'cu'],
      ['GLITZ', 'Trusted professionals. Hand-picked. By hand. Mine. Now roll, the ink is still wet!', 'cu', 'shrug'],
    ],
    steps: [
      {
        type: 'route', text: 'Paper the town with Dance-Off flyers', time: 45, bonus: 26, checkpoint: true,
        points: [[100, 64.5], [0, -12], [-100, -76], [-200, 4.5], [-120, 66]],
      },
      {
        type: 'visit', place: 'club', text: 'Collect your pay from Marty Glitz at Club Prism',
        talk: [
          ['GLITZ', 'Every lamp post from here to Back Bay. Beautiful. You could go far, kid. Further, even.', 'two'],
          ['SKYE', "So who's the favourite for Saturday?", 'ots'],
          ['GLITZ', "Favourite? Ha! Let's just say the prize money isn't leaving the building.", 'cu'],
          ['GLITZ', "The scorecards are already... organised. I'm a very organised man.", 'cu', 'think'],
          ['SKYE', 'Organised. Right.', 'cu'],
          ['GLITZ', "Here's your cash. Buy yourself a jacket with shoulders. Shoulders are the future.", 'ots', 'point'],
        ],
      },
    ],
    passed: 'EVERY CORNER COVERED',
  },
  {
    id: 'cold', title: 'COLD FEET', giver: 'mart', reward: 400,
    blurb: 'Gus has something in the freezer that is not a popsicle.',
    intro: [
      ['GUS', 'Skye! Shut the door. Is anyone behind you? Anyone shiny?', 'wide', 'wave'],
      ['SKYE', 'Just a guy asleep in the phone booth. Talk to me, Gus.', 'ots'],
      ['GUS', "Mr Glitz lent me money for the slush machine. Now he keeps a shoebox in my freezer. I looked. I shouldn't have looked.", 'ots'],
      ['GUS', "Scorecards. For Saturday. Already filled in. In pen! His nephew wins by a landslide and the kid can't even moonwalk.", 'cu', 'shrug'],
      ['SKYE', 'Gus, you beautiful, clammy man. Give me the box.', 'cu', 'point'],
      ['GUS', "His bouncers check on it every hour. Take my bike, the Comet's out front. She's fast. She's also my whole savings. Please.", 'ots', 'point'],
    ],
    steps: [
      { type: 'mount', text: "Get on Gus's Comet, parked outside the Pantry (E)", checkpoint: true },
      {
        type: 'route', text: 'Shake the bouncers: thread the back streets', time: 30, bonus: 13, checkpoint: true,
        points: [[100, -4], [0, -68], [-100, -4], [-200, 53], [-60, 53]],
      },
      {
        type: 'visit', place: 'bar', text: 'Bring the shoebox to Dee at the Velvet Flamingo',
        talk: [
          ['DEE', 'You smell like burnt rubber and frozen peas. What did you do?', 'two'],
          ['SKYE', "Borrowed a shoebox. Marty's already filled in Saturday's scorecards.", 'ots', 'point'],
          ['DEE', "That glitter-plated weasel. I trained for this! I bought leg warmers!", 'cu'],
          ['SKYE', 'So we take it to the Coast Patrol?', 'ots'],
          ['DEE', "Honey, the Patrol are his best customers. No. We take it to the one person in that club Marty can't turn down.", 'cu', 'think'],
          ['DEE', "DJ Kilowatt. He's got the microphone, and he's hated Marty since the smoke machine incident. Saturday night. Wear something nice.", 'cu', 'point'],
        ],
      },
    ],
    passed: 'THE BOX IS IN SAFE HANDS',
  },
  {
    id: 'dance', title: 'LAST DANCE', giver: 'club', reward: 1000, night: true, unlock: 'royale',
    blurb: 'Saturday night. One shoebox, one microphone, one dance floor.',
    intro: [
      ['KILO', "Skye on skates! You're not on the list. I like that about you.", 'wide', 'wave'],
      ['SKYE', "Kilowatt. Before the contest starts, you'll want to read what's in this box. Out loud.", 'ots', 'point'],
      ['KILO', "'First place: Chip Glitz. Ten, ten, ten.' These are dated today. The contest hasn't started.", 'cu', 'think'],
      ['KILO', 'Neon Coast! Quick word from the booth. It seems tonight was judged LAST TUESDAY!', 'wide', 'point'],
      ['GLITZ', "That's a draft! A rehearsal! Everybody rehearses their paperwork!", 'cu', 'shrug'],
      ['KILO', "New rules. The crowd judges. And Dee's knee is out, so somebody dances for the Velvet Flamingo. Skye?", 'ots', 'point'],
      ['SKYE', 'On skates? Obviously on skates.', 'cu', 'nod'],
    ],
    steps: [
      { type: 'dance', target: 100, rival: 2.6, time: 50, rivalName: 'CHIP', lose: 'CHIP GLITZ WON THE CROWD', text: 'DANCE-OFF! Hit your moves on the beat: fill the vibe before Chip Glitz does', stay: true, checkpoint: true },
      {
        type: 'visit', place: 'club', text: 'Take your bow', stay: false,
        talk: [
          ['KILO', "The crowd has spoken, and the crowd is hoarse. Five thousand dollars to the Velvet Flamingo!", 'wide', 'point'],
          ['GLITZ', "Fine. FINE. Take the oversized cheque. It doesn't even fit in my office.", 'cu', 'shrug'],
          ['SKYE', 'Pleasure doing business, Marty. Great shoulders, by the way.', 'cu', 'wave'],
          ['GLITZ', "...They ARE great shoulders.", 'cu', 'think'],
        ],
      },
      {
        type: 'visit', place: 'bar', text: 'Carry the prize back to Dee at the Velvet Flamingo', checkpoint: true,
        talk: [
          ['DEE', "I heard the cheering from here. Either you won or Marty fell in the fountain again.", 'two'],
          ['SKYE', 'Five thousand dollars, one giant cheque. The Flamingo stays a flamingo.', 'ots', 'point'],
          ['DEE', "Paid in full. Do you know how long I've waited to say that to a landlord?", 'cu'],
          ['DEE', "Here's your cut. And this. I wore it the night I won Back Bay roller-disco, nineteen seventy-nine.", 'cu', 'point'],
          ['SKYE', "Dee, it's pink and gold. It's the loudest jacket I've ever seen.", 'cu'],
          ['DEE', "It's called Flamingo Royale, and Mimi's holding it for you at Zigzag Threads. Now go. This coast isn't going to deliver itself.", 'two', 'wave'],
        ],
      },
    ],
    passed: 'PAID IN FULL',
  },
];

// The repeatable odd job Dee hands out between (and after) the story jobs.
export const ODD_JOB = {
  title: 'SPECIAL DELIVERY',
  drops: [
    { name: 'the kiosk at the end of Driftwood Pier', tag: 'DRIFTWOOD PIER KIOSK', x: 40, z: 233 },
    { name: 'the west lifeguard hut on Coral Beach', tag: 'WEST LIFEGUARD HUT', x: -113, z: 101 },
    { name: 'the east lifeguard hut on Coral Beach', tag: 'EAST LIFEGUARD HUT', x: 157, z: 105 },
    { name: 'the garden party on the Back Bay lawn', tag: 'BACK BAY LAWN', x: -236, z: -143 },
    { name: 'the night market at the east end of Midtown', tag: 'MIDTOWN, EAST END', x: 262, z: -11.5 },
  ],
  lines: (drop, secs, pay) => [
    ['DEE', 'Back for more? Good. I have a hot one.', 'two', 'wave'],
    ['SKYE', "Hot costs extra, Dee. So does 'right now'.", 'ots', 'shrug'],
    ['DEE', `One crate of Flamingo Fizz for ${drop.name}. They ran dry an hour ago.`, 'ots', 'point'],
    ['DEE', `${secs} seconds before the ice gives up. $${pay} when it lands. Roll!`, 'cu'],
  ],
};

// One-liners from the people behind the counters.
export const BARKS = {
  wear: ['MIMI', ["Darling! Those shorts are a cry for help. Step up.", 'Zigzag Threads: if it clashes, it matches.', 'New jacket, new you. Same wheels, sadly.']],
  mart: ['GUS', ['Welcome to Pelican Pantry, please do not lean on the slush machine.', 'The hot dogs are from today. Mostly.', "You didn't see a shoebox. There is no shoebox."]],
  bar: ['DEE', ["Skates off the stools, Skye.", 'First fizz is free. The second one is also free. I am bad at business.']],
  club: ['KILO', ['This next one goes out to everybody on eight wheels.', 'Floor is open. Hairspray is optional.']],
  diner: ['DOT', ["Sit anywhere, hon. Anywhere that isn't sticky.", 'Pie of the day is lime. Pie of yesterday is also lime.', 'Coffee refills are free. Opinions cost extra.', 'Skates are fine. Wheelies are not.']],
  arcade: ['TOKEN', ['One token a go. Skate Surge eats quarters and dreams.', 'High score board gets wiped every full moon. Allegedly.', 'No leaning on the cabinets. They have feelings. And alarms.']],
  motel: ['HAZEL', ['Fresh towels, fresh sheets, same old ice machine.', 'Checkout is whenever you wake up, sugar.', "The pool's closed. The pool has been closed since 1979."]],
  mall: ['KIKI', ["Kiki's Knots! Warm pretzels, warmer smiles!", 'Toss a coin in the fountain. The fountain likes shiny things.', "Escalator's been broken all week. Call it stairs with ambition."]],
  lounge: ['BIRDIE', ['Welcome to the Pelican, sugar. Shoes optional, manners required.', 'The band plays what the records tell them. Ask the jukebox.', 'Requests go in the jar. The jar is the jukebox.', 'Skates by the door, please. The floor is older than both of us.']],
  spire: ['LEO', ['Good evening. The terrace is on twenty-three, and the view is on the house.', 'Skates are welcome. Just not on the marble, if you can help it.', 'The lift is an express. Mind your ears.', 'Sunset is at about half past seven. Daily, without fail.']],
  bait: ['RUDY', ['Ahoy. Mind the bait fridge, it bites back.', "Forty years on the water and I still can't swim. Ask me how.", 'Tides are up, prices are down. Mostly.']],
  arms: ['ZIZI', ['Goggles on, fingers off the glowy ones.', 'Everything here is certified toy-grade. Mostly.', 'Bangs are for the road, not the boardwalk.', 'It only zaps cars and bins. People just get a fright.']],
};

// Volt & Spark Supply: Zizi's neon blasters and fireworks (combat in game/combat.js). They only ever
// damage vehicles and knock props about: people flinch, shout and run, they are never hurt.
// price buys it with `ammo` shots; once owned, `refill` buys another `ammo` (up to `max`).
//   kind: 'bolt' (projectile) · 'beam' (instant, bursts) · 'arc' (lightning that chains between cars)
//         · 'throw' (firework bang with a fuse) · 'volley' (homing firework stars)
export const ARMS = [
  { id: 'pop', name: 'ZAP POPPER', note: 'Compact pop blaster. Cheap, quick, short reach.', price: 150, refill: 40, ammo: 60, max: 240,
    kind: 'bolt', dmg: 7, rate: 0.15, range: 34, spread: 0.035, speed: 85, color: '#ff3fb4', auto: true },
  { id: 'prism', name: 'PRISM RIFLE', note: 'Three-shot bursts of split light. Long reach, dead accurate.', price: 480, refill: 90, ammo: 36, max: 144,
    kind: 'beam', dmg: 10, rate: 0.62, burst: 3, gap: 0.075, range: 75, spread: 0.008, color: '#27e8ff' },
  { id: 'arc', name: 'ARC COIL', note: 'Short-range lightning that jumps from car to car.', price: 620, refill: 110, ammo: 24, max: 96,
    kind: 'arc', dmg: 16, rate: 0.7, range: 16, chain: 3, jump: 10, color: '#b388ff' },
  { id: 'bang', name: 'FIREWORK BANGS', note: 'Throw them (hold to throw further) or drop them behind your car. Short fuse.', price: 200, refill: 120, ammo: 5, max: 20,
    kind: 'throw', dmg: 60, radius: 7, fuse: 1.5, rate: 0.5, color: '#ffe14a' },
  { id: 'candle', name: 'STARFALL CANDLE', note: 'A volley of five homing stars. Pricey, very pretty.', price: 750, refill: 150, ammo: 20, max: 60,
    kind: 'volley', dmg: 18, radius: 3.2, rate: 1.6, shots: 5, gap: 0.11, range: 60, speed: 34, turn: 4.5, color: '#ff8a3d' },
];
// the first time you walk into Volt & Spark Supply
export const ARMS_INTRO = [
  ['ZIZI', "Welcome to Volt and Spark! Goggles on, fingers off the glowy ones.", 'wide', 'wave'],
  ['SKYE', 'Zizi, is any of this actually legal?', 'ots', 'shrug'],
  ['ZIZI', "Certified toy-grade! It zaps cars, rattles bins and gives people a fright. Nobody gets hurt.", 'ots', 'point'],
  ['ZIZI', "Bangs are for the road, not the boardwalk. And never zap a patrol car unless you want new friends with sirens.", 'cu'],
  ['SKYE', 'Shiny things for cars only. Got it.', 'cu', 'nod'],
];

// Zigzag Threads: jacket / trim / light (shorts, boots) / bag colours. `price: 0` is yours from the start.
// bottom: 'shorts' (default) · 'trousers' (legs colour) · 'skirt' (skirt colour, pleat for alternate pleats)
//         · 'dress' (jacket is the bodice, bare arms). len / flare shape the skirt; sequin sparkles; boot colours the skates.
export const OUTFITS = [
  { id: 'classic', name: 'COURIER CLASSIC', note: 'Teal bomber, magenta trim. The original.', price: 0, jacket: '#12b5a6', trim: '#e6258f', light: '#f7f5ef', bag: '#f2b63a' },
  { id: 'sunset', name: 'SUNSET STRIPE', note: 'Tangerine with lemon piping.', price: 120, jacket: '#ff7a2f', trim: '#ffd84a', light: '#fff3d6', bag: '#7a3cff' },
  { id: 'arcade', name: 'MIDNIGHT ARCADE', note: 'Deep violet, cyan trim, black shorts.', price: 180, jacket: '#3a1d8a', trim: '#18f0ff', light: '#22203a', bag: '#ff2bd1' },
  { id: 'mint', name: 'MINT CONDITION', note: 'Pistachio and peach. Very poolside.', price: 150, jacket: '#8fe8c0', trim: '#ff9a7a', light: '#ffffff', bag: '#ffd166' },
  { id: 'cherry', name: 'CHERRY BOMB', note: 'Lipstick red, white stripes, no apologies.', price: 220, jacket: '#e0213f', trim: '#ffffff', light: '#1b1830', bag: '#27e8ff' },
  { id: 'slip', name: 'NEON SLIP', note: 'A hot-pink slip dress with cyan straps. Glows under a mirror ball.', price: 200, bottom: 'dress', jacket: '#ff2bd1', trim: '#18f0ff', light: '#f7f5ef', skirt: '#ff2bd1', len: 0.46, flare: 0.2, boot: '#f7f5ef', bag: '#18f0ff' },
  { id: 'tennis', name: 'TIE-BREAK', note: 'Pleated white tennis skirt, cropped mint jacket. Game, set, skate.', price: 170, bottom: 'skirt', jacket: '#8fe3d9', trim: '#ff4fa3', light: '#f7f5ef', skirt: '#f7f5ef', pleat: '#d8f4ee', len: 0.3, flare: 0.3, boot: '#f7f5ef', bag: '#ff4fa3' },
  { id: 'mirrorball', name: 'MIRRORBALL', note: 'Sequinned lilac party dress. Every light in the room finds you.', price: 320, bottom: 'dress', jacket: '#b8a8ff', trim: '#ffe14a', light: '#ffffff', skirt: '#b8a8ff', len: 0.38, flare: 0.24, sequin: true, boot: '#ffe14a', bag: '#ffe14a' },
  { id: 'sundress', name: 'BOARDWALK SUNDRESS', note: 'Lemon sundress with a tangerine hem. Made for the promenade.', price: 140, bottom: 'dress', jacket: '#ffe36a', trim: '#ff8a3d', light: '#fff6ec', skirt: '#ffe36a', pleat: '#ffd23f', len: 0.52, flare: 0.34, boot: '#fff6ec', bag: '#ff8a3d' },
  { id: 'slacks', name: 'SEA BREEZE SLACKS', note: 'Navy bomber, wide cream trousers. Yacht club, no yacht.', price: 160, bottom: 'trousers', jacket: '#2a4a9a', trim: '#ffd166', light: '#f6f1e7', legs: '#efe6d2', boot: '#f6f1e7', bag: '#ffd166' },
  { id: 'royale', name: 'FLAMINGO ROYALE', note: "Dee's 1979 roller-disco jacket. Pink and gold.", price: 750, jacket: '#ff5fa8', trim: '#ffcf3a', light: '#fff6ec', bag: '#ffcf3a', gift: 'Finish the story and Dee gives it to you' },
];

// Pelican Pantry 24
export const SNACKS = [
  { id: 'soda', name: 'PELICAN POP', note: 'Fizzy, blue, suspiciously cold. +15 health', price: 5, heal: 15 },
  { id: 'dog', name: 'BOARDWALK HOT DOG', note: 'From today. Mostly. +35 health', price: 12, heal: 35 },
  { id: 'bar', name: 'TURBO CRUNCH BAR', note: 'Oats, glucose and optimism. +60 health', price: 20, heal: 60 },
];

// Street vending machines (F at the front). All brands made up.
// ---- the venues (game/venues.js) -------------------------------------------------------------------
export const DINER_MENU = [
  { id: 'coffee', name: 'BOTTOMLESS COFFEE', note: 'Hot, black, refills till sunrise. +10 health', price: 2, heal: 10 },
  { id: 'lime', name: 'KEY LIME SLICE', note: 'Tart enough to fix your posture. +25 health', price: 6, heal: 25 },
  { id: 'stack', name: 'SUNRISE STACK', note: 'Three pancakes, one sunny egg, all the syrup. +45 health', price: 10, heal: 45 },
  { id: 'burger', name: 'STRIP BURGER & FRIES', note: 'Grilled on the boulevard since 1971. +70 health', price: 16, heal: 70 },
  { id: 'plate', name: 'THE BLUE PLATE', note: "Meatloaf, mash, greens. Dot's mother's recipe. Full health", price: 24, heal: 100 },
  { id: 'shake', name: 'MIDNIGHT MILKSHAKE', note: 'Strawberry, a mountain of cream, a cherry on top. +18 health', price: 5, heal: 18 },
];
export const DINER_SIT = ['Dot slides a glass of ice water down the counter. It stops exactly in front of you.', 'The jukebox hums. The coffee pot gurgles. Nobody is in a hurry.'];
export const JUKEBOX = ['SUNSET BOULEVARD SHUFFLE', 'NEON HEARTBREAK (EXTENDED)', 'CHROME BUMPER BLUES', 'PALM TREE PROMISE', 'MIDNIGHT MILKSHAKE', 'SKATE KEY SERENADE'];
export const MOTEL_MENU = [
  { id: 'morning', name: 'SLEEP TILL MORNING', note: 'Wake at 8:00 with full health. Saves your cash and the clock.', tag: '8:00', to: 8 },
  { id: 'sunset', name: 'NAP TILL GOLDEN HOUR', note: 'Wake at 18:30. Saves your cash and the clock.', tag: '18:30', to: 18.5 },
  { id: 'save', name: 'JUST SAVE', note: 'Write it all down in the guest book and stay up.', tag: 'SAVE' },
];
export const MOTEL_WAKE = ['Hazel slipped a mint under the door. It says GOOD MORNING in icing.', 'The ice machine coughed all night. You slept like a log anyway.', 'Somebody in room 6 was practising the saxophone. Badly. Lovingly.'];
export const PRETZELS = [
  { id: 'wish', name: 'TOSS A COIN', note: 'Make a wish in the fountain. The fountain answers. Sort of.', price: 1 },
  { id: 'knot', name: "KIKI'S CLASSIC KNOT", note: 'Salty, warm, the size of your face. +25 health', price: 6, heal: 25 },
  { id: 'swirl', name: 'CINNAMON SWIRL', note: 'Sugar, spice and a little bit of glitter. +40 health', price: 9, heal: 40 },
];
export const WISHES = [
  'The fountain gurgles. You feel 3% luckier.',
  'A coin lands heads up. Somewhere, a parking ticket forgives you.',
  'The water glitters. Your next green light lasts a little longer.',
  'You wish for world peace. The fountain says it will see what it can do.',
  'Plink. A seagull outside nods, as if it understood.',
  'Your coin skips twice and sinks. That counts as a double wish.',
];
export const BAIT_MENU = [
  { id: 'vest', name: 'BUOY-O SNORKEL VEST', note: 'Bright orange, very sensible. You can stay under 75% longer.', price: 90 },
  { id: 'trivia', name: 'TACKLE TRIVIA', note: "Answer one of Rudy's sea questions. $10 for every right answer.", tag: 'FREE' },
  { id: 'taffy', name: 'SALTWATER TAFFY', note: 'Chewy, pink, no actual sea water. +12 health', price: 4, heal: 12 },
];
// [question, [answers], index of the right one]
export const TRIVIA = [
  ['Which fish can puff itself up like a balloon?', ['PUFFERFISH', 'SWORDFISH', 'TUNA'], 0],
  ['What do you call a baby fish?', ['A FRY', 'A CUB', 'A TADPOLE'], 0],
  ['How does a crab usually walk?', ['SIDEWAYS', 'BACKWARDS ONLY', 'IT HOPS'], 0],
  ['Which sea animal has eight arms?', ['OCTOPUS', 'STARFISH', 'SQUID HAS SIX'], 0],
  ['What do fish breathe through?', ['GILLS', 'SNORKELS', 'FINS'], 0],
  ['Which of these is NOT a fish?', ['DOLPHIN', 'SNAPPER', 'GROUPER'], 0],
  ['What makes the tides go in and out?', ['THE MOON', 'THE WIND', 'BIG BOATS'], 0],
  ['A seahorse dad does what?', ['CARRIES THE EGGS', 'BUILDS A NEST', 'SINGS TO THEM'], 0],
];
export const TRIVIA_RIGHT = ["Shiver me timbers, that's right!", 'Spot on, deckhand. Ten bucks.', 'You know your fish. Rudy is impressed. Mildly.'];
export const TRIVIA_WRONG = ["Nope! Back to the shallow end.", 'Close. Not really. But close.', "Rudy shakes his head so hard his hat nearly falls off."];

export const VEND = {
  coolwave: [
    { id: 'cw', name: 'COOLWAVE CLASSIC', note: 'Blue, fizzy, tastes like a sea breeze. +10 health', price: 3, heal: 10 },
    { id: 'cwz', name: 'COOLWAVE ZERO', note: 'All of the wave, none of the sugar. +8 health', price: 3, heal: 8 },
    { id: 'tide', name: 'TIDAL ICED TEA', note: 'Peach and lemon. Very refreshing, very orange. +14 health', price: 4, heal: 14 },
  ],
  snaxx: [
    { id: 'curl', name: 'SNAXX CHEESE CURLS', note: 'Crunchy, glowing slightly. +12 health', price: 3, heal: 12 },
    { id: 'gum', name: 'STARDUST GUMMIES', note: 'Shaped like little comets. +6 health', price: 2, heal: 6 },
    { id: 'trail', name: 'SNAXX TRAIL MIX', note: 'Nuts, raisins and a single heroic chocolate drop. +20 health', price: 5, heal: 20 },
  ],
};

// How full Club Prism is, by story progress. 'quiet' until Paper Trail is done (the flyers are what
// bring people in), 'busy' after it, 'packed' during Last Dance. Counts of people in each part of the
// room; music and lights scale the club track and the light show.
export const CLUB_CROWD = {
  quiet: { dancers: 3, barStand: 1, stools: 1, lounge: 1, vip: 0, coat: 1, music: 0.62, lights: 0.45, dj: 'warmup' },
  busy: { dancers: 18, barStand: 2, stools: 2, lounge: 4, vip: 2, coat: 1, music: 1, lights: 1, dj: 'live' },
  packed: { dancers: 28, barStand: 2, stools: 5, lounge: 7, vip: 2, coat: 1, music: 1.12, lights: 1.15, dj: 'live' },
};
// story = missions finished (save.story); active = the id of the job running now, if any
export const clubTier = (story, active) => (active === 'dance' ? 'packed' : story >= 2 ? 'busy' : 'quiet');

// The Blue Pelican Lounge: Birdie's bar (game/venues.js). Small drinks, a little health.
export const LOUNGE_MENU = [
  { id: 'tea', name: 'SWEET PORCH TEA', note: 'Iced, lemony, sweet enough to stand a spoon in. +8 health', price: 3, heal: 8 },
  { id: 'fizz', name: 'BLUE PELICAN FIZZ', note: 'Blueberry soda over crushed ice, a paper umbrella. +14 health', price: 6, heal: 14 },
  { id: 'cider', name: 'HOT HONEY CIDER', note: 'Warm apple, a spoon of honey, a cinnamon stick. +20 health', price: 9, heal: 20 },
  { id: 'lager', name: 'PORCH LIGHT LAGER', note: 'A cold draught in a tall glass with a collar of foam. +6 health', price: 4, heal: 6 },
];
// The Club Prism bar (E at the bar, Taps mixes it): the drinks on the painted board over the bar
export const CLUB_MENU = [
  { id: 'laser', name: 'LASER LEMONADE', note: 'Glows a little under the black lights. +8 health', price: 3, heal: 8 },
  { id: 'filler', name: 'FLOOR FILLER', note: 'A cold draught, poured on the beat. +10 health', price: 4, heal: 10 },
  { id: 'ultra', name: 'ULTRAVIOLET', note: 'Violet, fizzy, a paper umbrella. +12 health', price: 5, heal: 12 },
  { id: 'mirror', name: 'MIRRORBALL', note: 'Sky blue with a silver rim and an umbrella. +14 health', price: 6, heal: 14 },
  { id: 'kilowatt', name: 'THE KILOWATT', note: "DJ Kilowatt's own: cherry, lime, a jolt. +16 health", price: 7, heal: 16 },
];
// The Afterglow Bar on the Solstice Terrace (E at the bar, June mixes it)
export const SKYBAR_MENU = [
  { id: 'cooler', name: 'CAUSEWAY COOLER', note: 'Lime soda, mint and a lot of ice. +8 health', price: 4, heal: 8 },
  { id: 'tlager', name: 'TERRACE LAGER', note: 'A cold draught with a proper head on it. +6 health', price: 5, heal: 6 },
  { id: 'skysour', name: 'SKYLINE SOUR', note: 'Lemon, honey, a twist of orange peel. +10 health', price: 6, heal: 10 },
  { id: 'sundown', name: 'SUNDOWN SPRITZ', note: 'Blood orange and bubbles, the colour of 19:30. +12 health', price: 7, heal: 12 },
  { id: 'nightcap', name: 'MIDNIGHT NIGHTCAP', note: 'Violet, smooth, a paper umbrella for the stars. +16 health', price: 9, heal: 16 },
];
// lines from the terrace: June at the bar, Leo at the desk downstairs
export const SKYBAR_GREET = ['JUNE: “Best seat in the house is any seat. What are we drinking?”', 'JUNE: “The sun goes down over the old town. Order now, thank me later.”', 'JUNE: “Last orders are whenever I say they are. Not yet.”'];
export const LEO_LINES = ['LEO: “The terrace is open till late. The lift is the only way up, and the only way down.”', 'LEO: “If you are waiting for the sunset, take a lounger on the east side.”', 'LEO: “No helicopters on the terrace, I am afraid. We had an incident with a cocktail umbrella.”', 'LEO: “June runs the bar up there. Tell her Leo sent you. She will charge you anyway.”'];
// The Coconut Shack on Coral Beach (F at the counter, open 7:00 to 20:00)
export const KIOSK_MENU = [
  { id: 'smoothie', name: 'SUNSET SMOOTHIE', note: 'Mango, strawberry, a scoop of crushed ice. +20 health', price: 6, heal: 20 },
  { id: 'softserve', name: 'SOFT SERVE CONE', note: 'Strawberry and vanilla, melting faster than you. +12 health', price: 4, heal: 12 },
  { id: 'coconut', name: 'FRESH COCONUT', note: 'Cracked open, a straw and a tiny umbrella. +15 health', price: 5, heal: 15 },
];
