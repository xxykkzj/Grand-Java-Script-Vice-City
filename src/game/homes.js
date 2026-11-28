// Homes: four places of your own, bought at the two estate agencies (rooms in game/homerooms.js, street doors
// in world/homefronts.js). Buying puts a house on the minimap, lights the door ring and lets you in; until
// then the door says FOR SALE. Inside, E at things: the TV (fake channels painted on its screen), the bed
// (sleep to morning / evening / night, a little health and a manual save), the shower or the tub (REFRESHED,
// longer in better homes), the wardrobe (outfits you own), the fridge / galley / espresso / bar cart (a free
// snack, then it needs a minute), the radio or the record player (any of the game's themes), F to sit or lie
// down and, where there is a view, wait for the sunset or the night. The villa's pool takes a swim, its den a
// console game; the houseboat's stern takes a fishing rod. The villa and the penthouse have a parking bay in
// the street: leave a car in it and it is there next time (kept with the save). Walking into your home with
// stars on you and no patrol close by works as a safehouse: a star drops every few seconds.
import { clamp, lerp, PI, timeU, reducedMotion, VIEW, angleDelta } from '../core/util.js';
import { OY } from './interiors.js';
import { OUTFITS } from './story.js';
import { TV } from './homerooms.js';
import { THEMES } from '../audio/themes.js';
import { quality } from '../core/quality.js';
import { POSES, applyPose } from '../player/swim.js';
import { resetDamage } from '../vehicles/vehicles.js';

const $ = (id) => document.getElementById(id);
// the four homes (prices against the economy: a story job pays $300-1000, Dee's odd jobs $300-750, a stunt
// jump $200-800; the studio is a first-evening buy, the penthouse a long-term goal)
export const HOMES = [
  { id: 'studio', name: 'SEAFRONT STUDIO 2B', district: 'OLD TOWN · LUMINA BOULEVARD', agency: 'realty', tier: 'STARTER', price: 1800, refresh: 30, heal: 0,
    features: 'Above a shop on the beachfront: single bed, kitchenette, CRT TV (3 channels), a tiny shower, a radio, a balcony over the sea and the Starlight Wheel.' },
  { id: 'houseboat', name: 'THE DRIFTWOOD DORY', district: 'SOLANO KEY · STARBOARD MARINA', agency: 'estates', tier: 'CHARACTER', price: 9500, refresh: 60, heal: 0,
    features: 'A houseboat off the marina boardwalk: a bunk, a tiny galley, a vintage radio, a wet room, an aft deck to fish from and watch the sun go down.' },
  { id: 'villa', name: 'VILLA PALOMA', district: 'OLD TOWN · BACK AVENUE 1', agency: 'realty', tier: 'COMFORT', price: 14500, refresh: 60, heal: 0, bay: { x: -95.2, z: -27, yaw: PI },
    features: 'Art-deco courtyard villa: a pool to swim in, a curved stair to the gallery, big TV and a games console, a clawfoot tub, a bar cart, a garage bay.' },
  { id: 'penthouse', name: 'THE SKYLINE PENTHOUSE', district: 'SOLANO KEY · GLASSWATER, FLOOR 27', agency: 'estates', tier: 'LUXURY', price: 45000, refresh: 90, heal: 15, bay: { x: -555.2, z: -125, yaw: PI },
    features: 'The whole corner of the top floor: glass to the floor on two sides, a double-height living room with a sunken lounge, a chef\'s kitchen, a bar, a fireplace, a grand piano, a primary suite with a spa bath, a terrace with a hot tub, a private parking bay.' },
];
export const HOME_IDS = HOMES.map((h) => h.id);
const H = Object.fromEntries(HOMES.map((h) => [h.id, h]));
const AGENCY = { realty: { name: 'CORAL KEYS REALTY', agent: 'BRENDA', who: 'BRENDA' }, estates: { name: 'SKYLINE ESTATES', agent: 'VAUGHN', who: 'VAUGHN' } };
const CHANNELS = {
  studio: ['weather', 'aerobics', 'test'],
  villa: ['weather', 'aerobics', 'cartoon', 'sitcom', 'music', 'test'],
  penthouse: ['weather', 'aerobics', 'cartoon', 'sitcom', 'music', 'test'],
};
const CH_NAME = { weather: 'CH 4 · COASTAL WEATHER', aerobics: 'CH 7 · SUNRISE STRETCH', cartoon: 'CH 9 · CAPTAIN CRAB', sitcom: 'CH 11 · BOARDWALK BUDDIES', music: 'CH 22 · NEON VIDEO HOUR', test: 'CH 86 · TEST CARD' };
const FOOD = {
  fridge: { title: 'THE FRIDGE', items: [{ id: 'cw', name: 'COOLWAVE COLA', note: 'A cold can from the door shelf.', heal: 10 }, { id: 'lime', name: 'KEY LIME SLICE', note: 'Left over, still perfect.', heal: 18 }] },
  galley: { title: 'THE GALLEY', items: [{ id: 'tea', name: 'SWEET ICED TEA', note: 'Brewed in a jar on the deck.', heal: 10 }, { id: 'stack', name: 'SKILLET PANCAKES', note: 'Two-ring hob, one good pan.', heal: 22 }] },
  espresso: { title: 'THE ESPRESSO MACHINE', items: [{ id: 'coffee', name: 'WINDOW ESPRESSO', note: 'Pulled at the glass, the bay below.', heal: 12 }, { id: 'shake', name: 'AFFOGATO SHAKE', note: 'Espresso over ice cream.', heal: 20 }] },
  skybar: { title: 'THE BAR', items: [{ id: 'negroni', name: 'FLOOR 27 NEGRONI', note: 'Stirred, over one big cube, an orange twist.', heal: 12 }, { id: 'fizzwine', name: 'SPARKLING ROSÉ', note: 'A chilled flute from the wine fridge.', heal: 10 }, { id: 'oldfash', name: 'SKYLINE OLD FASHIONED', note: 'Bourbon, bitters, the bay at your back.', heal: 14 }] },
  bar: { title: 'THE BAR CART', items: [{ id: 'sundown', name: 'PALOMA SPRITZ', note: 'Grapefruit, fizz, a pink umbrella.', heal: 12 }, { id: 'cooler', name: 'COURTYARD COOLER', note: 'Mint, lime, crushed ice.', heal: 10 }, { id: 'fizz', name: 'POOLSIDE FIZZ', note: 'Blue, for reasons.', heal: 14 }] },
};
// the penthouse island: cooked to order (a short scene at the hob, then you eat it; game/eat.js has the models)
const COOK = [{ id: 'snapper', name: 'SEARED SNAPPER, LEMON BUTTER', note: 'Crisp skin, capers, a squeeze of lemon. Takes a moment.', heal: 32 },
  { id: 'sliders', name: 'WAGYU SLIDERS', note: 'Three little burgers on brioche. Worth the smoke alarm.', heal: 28 },
  { id: 'stack', name: 'RICOTTA PANCAKES', note: 'Fluffy, with berries and maple. Any time is breakfast time.', heal: 24 },
  { id: 'tartlet', name: 'KEY LIME TARTLET', note: 'Out of the fridge, torched meringue on top.', heal: 18 }];
const SLEEP = [
  { id: 'morning', name: 'WAKE IN THE MORNING', note: 'Sleep till 8:00. A little health back, and the game is saved.', tag: '8:00', to: 8 },
  { id: 'evening', name: 'WAKE IN THE EVENING', note: 'Nap till 18:30, golden hour. Saves the game.', tag: '18:30', to: 18.5 },
  { id: 'night', name: 'WAKE AT NIGHT', note: 'Sleep till 22:00, the neon is on. Saves the game.', tag: '22:00', to: 22 },
  { id: 'save', name: 'JUST SAVE', note: 'Write the save without sleeping.', tag: 'SAVE' },
];
// the radio / record player can play any of the game's own themes
const RADIO = [['studio', 'BOARDWALK AM · SOFT ROCK'], ['houseboat', 'HARBOUR LIGHTS · STEEL PAN'], ['villa', 'PALOMA NIGHTS · ITALO'], ['penthouse', 'SKYLINE AFTER DARK · QUIET STORM'],
  ['bar', 'VELVET FLAMINGO · LOUNGE SOUL'], ['salon', 'FADE & FRINGE · SOUL RADIO'], ['diner', 'SUNSET STRIP · JUKEBOX'], ['rooftop', 'SOLSTICE · DOWNTEMPO'], ['wear', 'ZIGZAG · SYNTH-POP'],
  ['lounge', 'BLUE PELICAN · JAZZ COMBO'], ['bait', 'STARBOARD · COUNTRY FOLK'], ['motel', 'MOONLITE · LATE NIGHT'], ['arcade', 'SEAHORSE · CHIPTUNE'], ['mall', 'GALLERIA · AMBIENT'], ['realty', 'CORAL KEYS · OFFICE BOSSA'], ['estates', 'SKYLINE ESTATES · LOBBY GROOVE']].filter(([id]) => id in THEMES);
const FISH = [['SPECKLED SNAPPER', 24], ['NEON TETRA (LOST?)', 5], ['SILVER MULLET', 12], ['PINK GROUPER', 38], ['AN OLD SNEAKER', 1], ['YELLOWTAIL', 18], ['BLUE RUNNER', 15], ['A VERY SURPRISED CRAB', 8], ['MOONFISH', 55]];
const SUNSET = 19.5, NIGHT = 22;

export function createHomes(game) {
  const { player, hud, audio, save, env, camera, cut } = game;
  const stats = { bought: 0, tours: 0, sleeps: 0, showers: 0, snacks: 0, tv: 0, songs: 0, waits: 0, casts: 0, catches: 0, safe: 0, stored: 0, restored: 0, swims: 0, soaks: 0, outfits: 0 };
  const owned = (k) => save.homes.includes(k);
  const S = { act: null, tv: {}, music: {}, cool: {}, touring: false, safeT: 0, wait: null, camK: 0, swim: false, boost: false, lastCar: null, soakT: 0, soakCd: 0, bays: {}, started: false, msgN: 0, chT: 0, sndT: 0, rock: 0 };
  let menuKind = null, menuMode = 'top', menuSel = 0, cur = null, sitWas = false;
  const room = () => game.inside && game.inside.room;
  const homeKey = () => (game.inside && H[game.inside.key] ? game.inside.key : null);

  // ---- the listings photo in the shop panel ----------------------------------------------------------------
  let ph = null;
  function photoEl() {
    if (ph) return ph;
    ph = document.createElement('canvas'); ph.width = 320; ph.height = 150; ph.id = 'shopph';
    ph.style.cssText = 'display:block;width:100%;max-width:320px;height:auto;margin:4px auto 6px;border:2px solid #ffe14a;border-radius:4px;image-rendering:auto';
    const box = $('shop'), l = $('shopl'); if (box && l) box.insertBefore(ph, l);
    return ph;
  }
  function paint(id) {
    const c = photoEl().getContext('2d'), W = 320, Hh = 150;
    const sky = (a, b) => { const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, Hh); };
    const sun = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); };
    if (id === 'studio') {
      sky('#ff8ab0', '#ffd9a0'); sun(250, 70, 22, '#fff0a0'); c.fillStyle = '#5fc8e0'; c.fillRect(0, 96, W, 54);
      c.fillStyle = '#7fe0ff'; c.fillRect(30, 20, 150, 130); c.fillStyle = '#fff6ec'; for (let f = 0; f < 4; f++) c.fillRect(30, 40 + f * 28, 150, 4);
      c.fillStyle = '#ff9ac8'; c.fillRect(60, 64, 90, 26); c.fillStyle = '#fff'; for (let i = 0; i < 9; i++) c.fillRect(62 + i * 10, 76, 3, 14); c.fillStyle = '#2a3a5a'; c.fillRect(85, 48, 40, 28);
      c.strokeStyle = '#ffe14a'; c.lineWidth = 3; c.beginPath(); c.arc(265, 60, 30, 0, 6.3); c.stroke(); for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(265, 60); c.lineTo(265 + Math.cos(i * 0.785) * 30, 60 + Math.sin(i * 0.785) * 30); c.stroke(); }
    } else if (id === 'houseboat') {
      sky('#3a1a6a', '#ff8a6a'); sun(230, 92, 26, '#ffd447'); c.fillStyle = '#2a4a8a'; c.fillRect(0, 100, W, 50);
      c.fillStyle = 'rgba(255,212,71,.5)'; for (let i = 0; i < 6; i++) c.fillRect(200 + i * 4 - 10, 104 + i * 7, 60 - i * 6, 2);
      c.fillStyle = '#f6f1e7'; c.fillRect(40, 88, 190, 18); c.fillStyle = '#ff8a6a'; c.fillRect(40, 86, 190, 4); c.fillStyle = '#a5e6cf'; c.fillRect(60, 56, 110, 32); c.fillStyle = '#fff6ec'; c.fillRect(56, 52, 118, 6);
      c.fillStyle = '#ffd9a0'; for (const x of [76, 110, 144]) { c.beginPath(); c.arc(x, 72, 7, 0, 6.3); c.fill(); }
      c.fillStyle = '#ffe14a'; for (let i = 0; i < 8; i++) c.fillRect(176 + i * 7, 60 + Math.sin(i / 7 * PI) * 6, 3, 3);
    } else if (id === 'villa') {
      sky('#7fd0ff', '#ffe0f0'); c.fillStyle = '#ffe0d0'; c.fillRect(20, 30, 280, 120); c.fillStyle = '#ff9ad5'; c.fillRect(20, 30, 280, 8);
      c.fillStyle = '#e8a07a'; c.fillRect(20, 110, 280, 40); c.fillStyle = '#3fb8d8'; c.fillRect(80, 118, 150, 24); c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 5; i++) c.fillRect(90 + i * 28, 124 + (i % 2) * 6, 16, 2);
      c.fillStyle = '#fff6ec'; for (const x of [60, 120, 180, 240]) c.fillRect(x, 60, 8, 50); c.fillStyle = '#2a3a5a'; c.fillRect(30, 46, 260, 10);
      c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.arc(270, 110, 40, PI, PI * 1.5); c.stroke(); c.fillStyle = '#2f9f6a'; c.beginPath(); c.arc(40, 104, 14, 0, 6.3); c.fill();
    } else {
      sky('#0a0a2a', '#5a2a7a'); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect((i * 97) % W, (i * 41) % 60, 1.5, 1.5);
      c.fillStyle = '#1a1438'; for (const [x, w, h] of [[10, 30, 70], [44, 26, 50], [230, 34, 64], [270, 40, 46]]) c.fillRect(x, Hh - h, w, h);
      c.fillStyle = '#2a3a6a'; c.fillRect(110, 10, 100, 140); c.fillStyle = '#ffd36a'; c.fillRect(110, 10, 100, 26); c.fillStyle = '#fff0c0'; for (let y = 44; y < Hh; y += 10) for (let x = 116; x < 206; x += 12) if ((x + y) % 3) c.fillRect(x, y, 6, 4);
      c.fillStyle = '#7fe0ff'; c.fillRect(0, 140, W, 10); c.fillStyle = '#ff9ad5'; c.fillRect(110, 34, 100, 2);
    }
    c.fillStyle = 'rgba(10,6,24,.72)'; c.fillRect(0, Hh - 22, W, 22); c.fillStyle = '#ffe14a'; c.font = 'bold 13px monospace'; c.textAlign = 'left'; c.fillText(H[id].name, 8, Hh - 7);
    c.textAlign = 'right'; c.fillStyle = owned(id) ? '#8dff5a' : '#fff'; c.fillText(owned(id) ? 'YOURS' : '$' + H[id].price.toLocaleString('en-US'), W - 8, Hh - 7);
  }
  const showPhoto = (on) => { const e = photoEl(); e.style.display = on ? 'block' : 'none'; };

  // ---- menus (the shop panel: game/places.js asks game.venues.menu(kind), which falls back to us) ----------
  const listOf = (ag) => [...HOMES.filter((h) => h.agency === ag), ...HOMES.filter((h) => h.agency !== ag)];
  const say = (ag, line) => `${AGENCY[ag].who === 'BRENDA' ? 'BRENDA' : 'VAUGHN'}: “${line}”`;
  function listings(ag) {
    return {
      get title() { return menuMode === 'top' ? `${AGENCY[ag].name} · LISTINGS` : cur.name; },
      get label() { return menuMode === 'top' ? 'DETAILS' : 'CHOOSE'; },
      get mode() { return menuMode; },
      open() { menuMode = 'top'; cur = null; showPhoto(true); paint(listOf(ag)[0].id); },
      close() { showPhoto(false); menuMode = 'top'; cur = null; },
      greet: () => say(ag, ag === 'realty' ? 'Four homes on the books, sugar, two of them mine to brag about. Pick one and I will walk you through.' : 'Four residences currently available. The two on Solano Key are, naturally, ours.'),
      items() {
        if (menuMode === 'top') return listOf(ag).map((h) => ({ name: h.name, note: `${h.district} · ${h.tier}${h.agency === ag ? ' · OUR LISTING' : ''} · ${h.features}`, tag: owned(h.id) ? 'YOURS' : '$' + h.price.toLocaleString('en-US'), home: h }));
        return [{ name: 'VIEW', note: 'A short tour of the place (X skips). Back here afterwards.', tag: 'TOUR', act: 'view' },
          { name: owned(cur.id) ? 'ALREADY YOURS' : 'BUY', note: owned(cur.id) ? 'The keys are on your ring.' : `Pay $${cur.price.toLocaleString('en-US')} and move in today. A house goes on your map.`, tag: owned(cur.id) ? 'OWNED' : '$' + cur.price.toLocaleString('en-US'), act: 'buy' },
          { name: 'BACK', note: 'The other listings.', tag: '', act: 'back' }];
      },
      preview(o) { if (o && o.home) paint(o.home.id); },
      pick(o, i) {
        if (menuMode === 'top') { cur = o.home; menuMode = 'home'; menuSel = 0; paint(cur.id); audio.blip(true); return say(ag, PITCH[cur.id]); }
        if (o.act === 'back') { menuMode = 'top'; menuSel = HOMES.indexOf(cur) >= 0 ? listOf(ag).indexOf(cur) : 0; return ''; }
        if (o.act === 'view') { const h = cur; game.places.closeShop(); tour(h.id, ag); return null; }
        if (owned(cur.id)) { audio.blip(false); return 'IT IS ALREADY YOURS'; }
        if (game.money < cur.price) { audio.blip(false); return `NOT ENOUGH CASH: ${cur.name} IS $${cur.price.toLocaleString('en-US')} (YOU HAVE $${Math.floor(game.money).toLocaleString('en-US')})`; }
        return buy(cur.id, ag);
      },
      takeSel() { const k = menuSel; menuSel = null; return k; },
      back() { if (menuMode !== 'top') { menuSel = listOf(ag).indexOf(cur); menuMode = 'top'; return true; } return false; },
    };
  }
  const PITCH = {
    studio: 'Small, sweet, and the balcony looks straight at the Wheel. The shower has moods.',
    houseboat: 'It floats, it rocks, it has a fishing deck. The sunsets are included at no extra charge.',
    villa: 'A pool in the courtyard, a stair that curves like a compliment, a garage for the car.',
    penthouse: 'Floor twenty-seven, the whole corner. Glass to the floor, a sunken lounge, a chef\'s kitchen, a hot tub on the terrace. And every third night, fireworks over the bay.',
  };
  function buy(id, ag) {
    const h = H[id];
    game.money -= h.price; save.homes.push(id); save.lastHome = id; stats.bought++;
    audio.cash(); audio.pickup(); game.persist();
    hud.toast('SOLD! ' + h.name, `THE KEYS ARE YOURS · A HOUSE ON THE MAP MARKS THE DOOR${h.bay ? ' · IT HAS A PARKING BAY' : ''}`);
    paint(id);
    return say(ag, 'Congratulations! Sign here, here and... there. Welcome home.');
  }
  const sleepMenu = { title: 'SLEEP', label: 'SLEEP', items: () => SLEEP, greet: () => (game.wanted > 0 ? 'THE SIRENS OUTSIDE WON\'T LET YOU SLEEP' : 'WHEN DO YOU WANT TO WAKE UP?'), pick: (o) => sleepPick(o) };
  const tvMenu = {
    title: 'TV', label: 'WATCH',
    items() { const k = homeKey(); return [...(CHANNELS[k] || []).map((c) => ({ name: CH_NAME[c], note: CH_NOTE[c], tag: S.tv[k] === c ? 'ON' : '', ch: c })), { name: 'TURN IT OFF', note: 'Back to the quiet.', tag: S.tv[k] ? '' : 'OFF', ch: null }]; },
    greet: () => (S.tv[homeKey()] ? 'CHANNEL SURFING' : 'THE TUBE WARMS UP WITH A HUM'),
    preview(o) { if (o) setTv(o.ch); },
    pick(o) { setTv(o.ch); stats.tv++; game.places.closeShop(); return null; },
  };
  const CH_NOTE = { weather: 'The coast forecast with Stormy Gale and a magnetic map.', aerobics: 'Leg warmers, a grid floor, a very upbeat instructor.', cartoon: 'Captain Crab sails again. He is a crab.', sitcom: 'Two roommates, one boardwalk, a laugh track.', music: 'Neon shapes to the beat. The stereo plays along.', test: 'Colour bars and a tone. Very calming.' };
  const wardrobeMenu = {
    title: 'WARDROBE', label: 'WEAR', fit: true,
    items: () => OUTFITS.filter((o) => !o.price || save.owned.includes(o.id) || (o.gift && save.gift[o.id])).map((o) => ({ ...o, tag: save.outfit === o.id ? 'WEARING' : 'OWNED', note: o.note })),
    greet: () => 'EVERYTHING YOU OWN, ON HANGERS. NEW CLOTHES COME FROM THE SHOPS.',
    preview(o) { if (o) player.model.setOutfit(o); },
    pick(o) { if (save.outfit === o.id) return 'YOU ARE WEARING IT'; save.outfit = o.id; player.model.setOutfit(o); stats.outfits++; game.persist(); audio.pickup(); return 'CHANGED INTO: ' + o.name; },
  };
  const radioMenu = {
    get title() { return homeKey() === 'penthouse' ? 'RECORD PLAYER' : 'RADIO'; },
    label: 'PLAY',
    items() { const k = homeKey(), cur0 = S.music[k]; return [{ name: 'THE HOUSE SOUND', note: 'This home\'s own tune.', tag: cur0 === undefined ? 'ON' : '', id: undefined }, ...RADIO.map(([id, n]) => ({ name: n, note: homeKey() === 'penthouse' ? 'Drop the needle on this one.' : 'Turn the dial.', tag: cur0 === id ? 'ON' : '', id })), { name: 'SWITCH OFF', note: 'Silence (the M key still rules all music).', tag: cur0 === null ? 'OFF' : '', id: null }]; },
    greet: () => (homeKey() === 'penthouse' ? 'THE VINYL WALL: PICK A SLEEVE' : 'THE DIAL GLOWS AMBER'),
    pick(o) { S.music[homeKey()] = o.id; stats.songs++; audio.blip(true); return o.id === null ? 'SWITCHED OFF' : '♪ ' + o.name; },
  };
  const foodMenu = (kind) => ({
    title: FOOD[kind].title, label: 'HAVE',
    items: () => FOOD[kind].items.map((o) => ({ ...o, price: 0, tag: 'FREE' })),
    greet: () => (coolLeft(kind) > 0 ? `EMPTY FOR NOW · BACK IN ${Math.ceil(coolLeft(kind))} S` : 'HELP YOURSELF'),
    pick(o) {
      const left = coolLeft(kind);
      if (left > 0) { audio.blip(false); return `NOTHING LEFT · RESTOCKED IN ${Math.ceil(left)} S`; }
      S.cool[homeKey() + ':' + kind] = timeU.value + 60; stats.snacks++;
      audio.pickup(); return game.eat.consume(o);
    },
  });
  const cookMenu = {
    title: 'THE ISLAND · COOK SOMETHING', label: 'COOK',
    items: () => COOK.map((o) => ({ ...o, price: 0, tag: 'FREE' })),
    greet: () => (coolLeft('cook') > 0 ? `STILL FULL · COOK AGAIN IN ${Math.ceil(coolLeft('cook'))} S` : 'THE HOB CLICKS ON. WHAT ARE WE MAKING?'),
    pick(o) {
      const left = coolLeft('cook');
      if (left > 0) { audio.blip(false); return `STILL FULL · COOK AGAIN IN ${Math.ceil(left)} S`; }
      S.cool[homeKey() + ':cook'] = timeU.value + 60;
      const r = room(), u = shopUse();
      game.places.closeShop();
      startCook(r, u, o);
      return null;
    },
  };
  const shopUse = () => game.places.shopUse || (room() && room().uses.find((q) => q.kind === 'cook'));
  const coolLeft = (kind) => Math.max(0, (S.cool[homeKey() + ':' + kind] || 0) - timeU.value);
  const MENUS = { listings_realty: listings('realty'), listings_estates: listings('estates'), homesleep: sleepMenu, hometv: tvMenu, wardrobe: wardrobeMenu, homeradio: radioMenu, ...Object.fromEntries(Object.keys(FOOD).map((k) => ['food_' + k, foodMenu(k)])), food_cook: cookMenu };

  // ---- the TV ---------------------------------------------------------------------------------------------
  function setTv(ch) {
    const k = homeKey(), r = room(); if (!k || !r || !r.tv) return;
    S.tv[k] = ch || null; r.tv.userData.on(!!ch);
    if (ch) { audio.blip(true); drawTv(ch, 0); S.chT = 0; }
  }
  function drawTv(ch, t) {
    const c = TV.ctx, W = 256, Hh = 176;
    c.save();
    if (ch === 'weather') {
      const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#1a3a8a'); g.addColorStop(1, '#2a6ac8'); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
      c.fillStyle = '#f4e2b0'; c.fillRect(140, 40, 90, 52); c.fillRect(40, 30, 60, 80); c.fillStyle = '#c8b8a0'; c.fillRect(100, 66, 40, 6);
      const cx = 60 + ((t * 18) % 200); c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(cx + i * 12, 54 + (i % 2) * 6, 12, 0, 6.3); c.fill(); }
      c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(200, 34, 14, 0, 6.3); c.fill(); c.font = 'bold 15px monospace'; c.fillStyle = '#fff'; c.textAlign = 'left';
      c.fillText(`${Math.round(82 + Math.sin(t * 0.3) * 3)}°`, 150, 70); c.fillText('81°', 52, 72); c.fillStyle = '#ff6a8a'; c.fillRect(0, Hh - 34, W, 34); c.fillStyle = '#fff'; c.font = 'bold 12px monospace';
      c.fillText('COASTAL WEATHER · ' + String(env.weather).toUpperCase(), 8, Hh - 20); c.fillText('SURF 3-4 FT · UV HIGH · STAY PASTEL', 8, Hh - 6);
    } else if (ch === 'aerobics') {
      c.fillStyle = '#ff9ac8'; c.fillRect(0, 0, W, Hh); c.strokeStyle = '#ffe14a'; c.lineWidth = 2; for (let i = -10; i < 20; i++) { c.beginPath(); c.moveTo(W / 2 + i * 30, 90); c.lineTo(W / 2 + i * 90, Hh); c.stroke(); } c.fillStyle = '#7fe0ff'; c.fillRect(0, 0, W, 90);
      const b = Math.sin(t * 6), x = 128;
      c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(x, 52 + b * 4, 10, 0, 6.3); c.fill(); c.fillStyle = '#8dff5a'; c.fillRect(x - 10, 62 + b * 4, 20, 36);
      c.strokeStyle = '#f1c9a5'; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 10, 66 + b * 4); c.lineTo(x - 30, 40 - b * 16); c.moveTo(x + 10, 66 + b * 4); c.lineTo(x + 30, 40 - b * 16); c.stroke();
      c.strokeStyle = '#ff2bd1'; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 6, 98); c.lineTo(x - 14 - b * 8, 132); c.moveTo(x + 6, 98); c.lineTo(x + 14 + b * 8, 132); c.stroke();
      c.fillStyle = '#fff'; c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.fillText(`AND ${['ONE', 'TWO', 'THREE', 'FOUR'][Math.floor(t * 2) % 4]}!`, W / 2, 160);
    } else if (ch === 'cartoon') {
      c.fillStyle = '#7fd0ff'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#2a6ac8'; for (let x = 0; x < W; x += 4) c.fillRect(x, 110 + Math.sin(x * 0.06 + t * 3) * 6, 4, 80);
      const bx = 60 + Math.sin(t * 0.8) * 50; c.fillStyle = '#c8945e'; c.fillRect(bx, 96, 90, 18); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(bx + 45, 30); c.lineTo(bx + 45, 94); c.lineTo(bx + 85, 94); c.fill();
      c.fillStyle = '#ff3f3a'; c.beginPath(); c.arc(bx + 22, 88, 12, 0, 6.3); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx + 17, 78, 4, 0, 6.3); c.arc(bx + 27, 78, 4, 0, 6.3); c.fill();
      c.fillStyle = BLK0; c.beginPath(); c.arc(bx + 17, 78, 2, 0, 6.3); c.arc(bx + 27, 78, 2, 0, 6.3); c.fill();
      c.font = 'bold 16px monospace'; c.fillStyle = '#ffe14a'; c.textAlign = 'center'; c.fillText('CAPTAIN CRAB', W / 2, 22);
    } else if (ch === 'sitcom') {
      c.fillStyle = '#f4e2b0'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#ff9ac8'; c.fillRect(0, 100, W, 76); c.fillStyle = '#7fe0d0'; c.fillRect(30, 70, 110, 40); c.fillStyle = '#c8945e'; c.fillRect(160, 30, 60, 60);
      for (const [x, col] of [[70, '#3a6ac8'], [120, '#ff6a3d']]) { c.fillStyle = '#e0a878'; c.beginPath(); c.arc(x, 64 + Math.sin(t * 4 + x) * 2, 10, 0, 6.3); c.fill(); c.fillStyle = col; c.fillRect(x - 10, 74, 20, 28); }
      if (Math.floor(t / 2.4) % 2) { c.fillStyle = 'rgba(10,6,24,.75)'; c.fillRect(30, 132, 196, 30); c.fillStyle = '#ffe14a'; c.font = 'bold 15px monospace'; c.textAlign = 'center'; c.fillText('[ STUDIO AUDIENCE LAUGHS ]', W / 2, 152); }
    } else if (ch === 'music') {
      c.fillStyle = '#12082a'; c.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 7; i++) { const a = t * (0.6 + i * 0.13) + i, r = 20 + i * 12; c.strokeStyle = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff', '#ffffff'][i]; c.lineWidth = 3; c.beginPath(); for (let k = 0; k < 4; k++) { const b = a + k * PI / 2; c.lineTo(W / 2 + Math.cos(b) * r, Hh / 2 + Math.sin(b) * r * 0.7); } c.closePath(); c.stroke(); }
      c.fillStyle = '#ff2bd1'; for (let x = 0; x < W; x += 16) { const h = 8 + Math.abs(Math.sin(t * 7 + x)) * 26; c.fillRect(x, Hh - h, 12, h); }
    } else {
      const bars = ['#f6f1e7', '#ffe14a', '#18f0ff', '#8dff5a', '#ff2bd1', '#ff3f5a', '#3a5aff']; bars.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * W / 7, 0, W / 7 + 1, Hh * 0.68); });
      c.fillStyle = '#22203a'; c.fillRect(0, Hh * 0.68, W, Hh * 0.32); c.fillStyle = '#fff'; c.font = 'bold 15px monospace'; c.textAlign = 'center'; c.fillText('WAVE 86 · PLEASE STAND BY', W / 2, Hh * 0.86);
    }
    // a soft CRT look: scanlines and a vignette (the penthouse projector gets a cleaner picture)
    if (homeKey() !== 'penthouse') { c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < Hh; y += 3) c.fillRect(0, y, W, 1); }
    c.restore();
    TV.tex.needsUpdate = true;
  }
  const BLK0 = '#22203a';
  function tvSound(ch, t) {
    if (ch === 'test') audio.tvTone && audio.tvTone(1000, 0.25, 0.012);
    else if (ch === 'sitcom' && Math.floor(t / 2.4) % 2) audio.laugh && audio.laugh();
    else if (ch === 'aerobics') audio.tvTone && audio.tvTone(220, 0.08, 0.02);
    else if (ch === 'cartoon') audio.tvTone && audio.tvTone(330 + Math.random() * 400, 0.12, 0.016, true);
    else if (ch === 'weather') audio.tvTone && audio.tvTone([523, 659, 784][Math.floor(t) % 3], 0.2, 0.012);
  }

  // ---- sleeping -------------------------------------------------------------------------------------------
  function bedSeat(r) { const s = r.seats.find((q) => q.home === 'bed'); return s && { x: r.ox + s.x, z: r.oz + s.z, y: s.y, yaw: s.yaw, kind: s.kind, ref: s, floorY: OY + (s.fy || 0) }; }
  function sleepPick(o) {
    if (game.wanted > 0) { audio.blip(false); return 'NOT WITH HEAT ON YOU: THE SIRENS KEEP YOU AWAKE'; }
    const k = homeKey(), r = room();
    game.places.closeShop();
    if (o.to === undefined) { const res = game.saves.manual(); save.lastHome = k; hud.toast(res.ok ? 'GAME SAVED' : res.why, res.ok ? 'YOUR KEYS ARE ON THE HOOK' : ''); if (res.ok) audio.pickup(); return null; }
    const s = bedSeat(r); if (s) { game.act.reset(); game.act.sit(s); }
    S.act = { kind: 'sleep', t: 0, to: o.to, k, done: false };
    return null;
  }
  function sleepTick(dt) {
    const A = S.act; A.t += dt;
    if (A.t > (reducedMotion ? 0.4 : 1.2) && !A.done) {
      A.done = true; game.busy = 'door'; cut.fade(true);
      setTimeout(() => {
        if (A.to < env.tod) env.day = (env.day || 1) + 1;     // slept past midnight: a new day (world/fireworks.js counts nights)
        env.tod = A.to; env.target = null; game.health = Math.min(100, game.health + 25); stats.sleeps++; save.lastHome = A.k;
        const res = game.saves.manual();
        game.busy = null; S.act = null;
        setTimeout(() => cut.fade(false), 150);
        const boat = A.k === 'houseboat';
        hud.toast(res.ok ? 'GAME SAVED' : res.why, `${boat ? 'THE WAVES ROCKED YOU TO SLEEP' : 'RESTED'} · ${clock()} · +25 HEALTH`);
        audio.pickup();
      }, reducedMotion ? 400 : 1400);
    }
  }
  const clock = () => { const h = Math.floor(env.tod), m = Math.floor((env.tod - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  // ---- showers, baths, the hot tub --------------------------------------------------------------------------
  function refresh(k, extra = '') {
    const h = H[k], sec = h.refresh;
    game.eat.refresh(sec);
    if (h.heal) game.health = Math.min(100, game.health + h.heal);
    hud.toast('+ REFRESHED', `${sec} S OF EXTRA SPRINT${h.heal ? ` · +${h.heal} HEALTH` : ''}${extra}`);
  }
  function startShower(r, u) {
    game.act.reset();
    S.act = { kind: 'shower', t: 0, u, k: homeKey(), cold: homeKey() === 'studio' && Math.random() < 0.7 ? 1.2 + Math.random() * 1.4 : -1, coldOn: 0 };
    stats.showers++; audio.blip(true);
  }
  function showerTick(dt, ctl, r) {
    const A = S.act, u = A.u, T = 4.5; A.t += dt;
    const look = u.look || [u.x, u.z - 1];
    player.pos.set(r.ox + look[0], OY + (u.fy || 0), r.oz + look[1]); player.speed = 0; player.animate(dt, 0, null);
    const c = camera.position; player.yaw += angleDelta(player.yaw, Math.atan2(c.x - player.pos.x, c.z - player.pos.z)) * (1 - Math.exp(-4 * dt));
    player.model.armR.rotation.set(-2.6 + Math.sin(A.t * 5) * 0.2, 0, -0.3); player.model.armL.rotation.set(-2.4 - Math.sin(A.t * 5) * 0.2, 0, 0.3); player.model.head.rotation.x = -0.2;
    const st = r.steam; if (st) st.userData.on(Math.min(1, A.t * 1.5) * Math.min(1, (T - A.t) * 2 + 0.2));
    // the studio's old shower: the water goes cold for a moment, then warm again
    if (A.cold > 0 && A.t > A.cold && !A.coldOn) { A.coldOn = A.t; hud.toast('BRRR! COLD!', 'THE OLD BOILER COUGHS'); audio.tvTone && audio.tvTone(880, 0.2, 0.03, true); }
    if (A.coldOn && A.t > A.coldOn + 1.2 && A.coldOn > 0) { A.coldOn = -1; hud.toast('AH, WARM AGAIN', ''); }
    S.water = A.coldOn > 0 ? 0.5 : 1;
    // camera: just outside the stall, looking in
    camRoom(r, u.cam || [1.4, 1.9, 1.6], [look[0], (u.fy || 0) + 1.3, look[1]], u.fy || 0);
    if (A.t > 0.4 && (Math.abs(ctl.move) > 0.1 || Math.abs(ctl.strafe) > 0.1)) return endShower(r, A.t > 2.5);
    if (A.t >= T) return endShower(r, true);
    return true;
  }
  function endShower(r, done) {
    const k = S.act.k; S.act = null; S.water = 0;
    if (r.steam) r.steam.userData.on(0);
    player.resetPose();
    if (done) refresh(k, k === 'studio' ? ' · THE PIPES SAY GOODBYE' : ''); else hud.toast('OUT OF THE SHOWER', 'STILL A BIT SOAPY');
    return true;
  }
  // ---- cooking at the penthouse island: a few seconds at the hob (sizzle, a flip of the pan), then you eat it ----
  function startCook(r, u, o) {
    game.act.reset();
    S.act = { kind: 'cook', t: 0, u: u || { x: 0, z: 0 }, o, k: homeKey(), sz: 0 };
    stats.cooks = (stats.cooks || 0) + 1; audio.blip(true);
    hud.toast('COOKING: ' + o.name, 'A MINUTE AT THE HOB · WASD STOPS');
  }
  function cookTick(dt, ctl, r) {
    const A = S.act, u = A.u, T = reducedMotion ? 1.6 : 3.4; A.t += dt;
    const look = u.look || [u.x + 1, u.z];
    player.pos.set(r.ox + u.x, OY + (u.fy || 0), r.oz + u.z); player.speed = 0; player.animate(dt, 0, null);
    player.yaw += angleDelta(player.yaw, Math.atan2(look[0] - u.x, look[1] - u.z)) * (1 - Math.exp(-8 * dt));
    const m = player.model, flip = Math.max(0, Math.sin(A.t * 2.2)) ** 6;
    m.armR.rotation.set(-1.25 - flip * 0.6, 0, -0.15); m.armL.rotation.set(-1.0 + Math.sin(A.t * 9) * 0.08, 0, 0.2); m.head.rotation.x = 0.3;
    if ((A.sz -= dt) <= 0) { A.sz = 0.22 + Math.random() * 0.2; if (audio.sizzle) audio.sizzle(); }
    camRoom(r, u.cam || [2.2, 2.0, 2.2], [u.x, (u.fy || 0) + 1.0, u.z], u.fy || 0);
    if (A.t > 0.4 && (Math.abs(ctl.move) > 0.1 || Math.abs(ctl.strafe) > 0.1)) { S.act = null; player.resetPose(); hud.toast('LEFT IT ON THE COUNTER', 'THE HOB CLICKS OFF'); return true; }
    if (A.t >= T) { S.act = null; player.resetPose(); hud.toast('SERVED: ' + A.o.name, 'STRAIGHT FROM THE PAN'); game.eat.consume(A.o); stats.cooked = (stats.cooked || 0) + 1; }
    return true;
  }
  // ---- the piano: a short phrase on the baby grand (a different one each time) ----
  const PHRASES = [[60, 64, 67, 72, 71, 67, 64], [62, 65, 69, 72, 69, 65], [57, 60, 64, 67, 64, 60, 57], [65, 69, 72, 76, 74, 72, 69, 65], [64, 67, 71, 74, 72, 71, 67]];
  function playPiano() {
    const ph = PHRASES[(stats.piano = (stats.piano || 0) + 1) % PHRASES.length];
    ph.forEach((n, i) => setTimeout(() => { if (audio.tvTone) audio.tvTone(440 * 2 ** ((n - 69) / 12), 0.9, 0.035); }, i * 210));
    hud.toast('♪ A FEW BARS ON THE BABY GRAND', 'THE ROOM HAS GOOD ACOUSTICS');
  }
  const camRoom = (r, cs, look, fy) => {
    camera.position.set(r.ox + look[0] + cs[0], OY + fy + cs[1], r.oz + look[2] + cs[2]);
    camera.lookAt(r.ox + look[0], OY + look[1], r.oz + look[2]);
    cut.setFov(50);
  };

  // ---- fishing (the houseboat's stern) ------------------------------------------------------------------------
  let fishEl = null;
  function fishUI(on, text = '', bar = null) {
    if (!fishEl) {
      fishEl = document.createElement('div'); fishEl.id = 'fishui';
      fishEl.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);width:min(340px,80vw);padding:10px 12px;background:rgba(14,8,30,.86);border:2px solid #8dffcf;border-radius:8px;color:#fff;font:700 13px ui-monospace,Menlo,Consolas,monospace;text-align:center;z-index:30;pointer-events:none';
      fishEl.innerHTML = '<div id="fisht"></div><div style="position:relative;height:16px;margin-top:8px;background:#2a2a48;border-radius:8px;overflow:hidden"><div id="fishz" style="position:absolute;top:0;bottom:0;background:#8dff5a"></div><div id="fishm" style="position:absolute;top:-2px;bottom:-2px;width:6px;background:#ffe14a;border-radius:3px"></div></div>';
      document.body.appendChild(fishEl);
    }
    fishEl.hidden = !on; if (!on) return;
    fishEl.querySelector('#fisht').textContent = text;
    const z = fishEl.querySelector('#fishz'), m = fishEl.querySelector('#fishm');
    z.parentElement.style.visibility = bar ? 'visible' : 'hidden';
    if (bar) { z.style.left = (bar.z0 * 100).toFixed(1) + '%'; z.style.width = ((bar.z1 - bar.z0) * 100).toFixed(1) + '%'; m.style.left = (bar.m * 100).toFixed(1) + '%'; }
  }
  function startFish(r, u) {
    game.act.reset();
    S.act = { kind: 'fish', phase: 'cast', t: 0, u, bite: 2 + Math.random() * 4, z0: 0, z1: 0, m: 0 };
    stats.casts++; audio.jump();
  }
  function fishTick(dt, ctl, r) {
    const A = S.act, u = A.u; A.t += dt;
    player.pos.set(r.ox + u.x - 0.3, OY, r.oz + u.z); player.yaw += angleDelta(player.yaw, PI / 2) * (1 - Math.exp(-6 * dt)); player.speed = 0; player.animate(dt, 0, null);
    const m = player.model, tug = A.phase === 'bite' ? Math.sin(A.t * 18) * 0.12 : 0;
    m.armR.rotation.set(-1.1 + (A.phase === 'cast' ? Math.sin(Math.min(1, A.t / 0.6) * PI) * -1.2 : 0) + tug, 0, -0.2); m.armL.rotation.set(-1.0 + tug, 0, 0.25);
    const bob = r.bobber; if (bob) { const k = A.phase === 'cast' ? Math.min(1, A.t / 0.6) : 1; bob.visible = A.phase !== 'cast' || A.t > 0.3; bob.position.set(u.x + 0.4 + k * 3.2, -0.9 + (A.phase === 'bite' ? Math.sin(A.t * 20) * 0.05 - 0.05 : Math.sin(A.t * 2) * 0.03), u.z); }
    camRoom(r, [-3.0, 1.6, 2.2], [u.x + 1.2, 0.6, u.z], 0);
    if (A.t > 0.4 && (Math.abs(ctl.move) > 0.1 || Math.abs(ctl.strafe) > 0.1)) { endFish(r); hud.toast('REEL IT IN', 'THE ROD GOES BACK IN ITS HOLDER'); return true; }
    if (A.phase === 'cast' && A.t > 0.7) { A.phase = 'wait'; A.t = 0; audio.splash(0.3); }
    else if (A.phase === 'wait') { fishUI(true, 'WAITING FOR A BITE…'); if (A.t > A.bite) { A.phase = 'bite'; A.t = 0; const w = 0.18 + Math.random() * 0.08; A.z0 = 0.15 + Math.random() * (0.7 - w); A.z1 = A.z0 + w; audio.blip(true); } }
    else if (A.phase === 'bite') {
      A.m = A.fixM ?? 0.5 + 0.5 * Math.sin(A.t * 4.2 - PI / 2);
      fishUI(true, game.input.touchMode ? 'A BITE! TAP REEL IN THE GREEN' : 'A BITE! PRESS E IN THE GREEN', { z0: A.z0, z1: A.z1, m: A.m });
      if (A.t > 3.2) { hud.toast('IT GOT AWAY', 'TOO SLOW · E TO CAST AGAIN'); endFish(r); }
    } else if (A.phase === 'done' && A.t > 1.4) endFish(r);
    return true;
  }
  function reel() {
    const A = S.act;
    if (A.phase === 'wait') { hud.toast('TOO SOON', 'THE FISH SWIMS OFF · WAIT FOR THE BITE'); A.phase = 'done'; A.t = 0; fishUI(false); return; }
    if (A.phase !== 'bite') return;
    if (A.m >= A.z0 && A.m <= A.z1) {
      const [name, cash] = FISH[Math.floor(Math.random() * FISH.length)];
      stats.catches++; game.money += cash; audio.cash(); audio.splash(0.5);
      hud.toast('CAUGHT: ' + name, `SOLD TO CAP'N RUDY'S COOLER · +$${cash}`);
    } else { audio.blip(false); hud.toast('SNAP!', 'THE LINE WENT SLACK · E TO CAST AGAIN'); }
    A.phase = 'done'; A.t = 0; fishUI(false);
  }
  function endFish(r) { S.act = null; fishUI(false); if (r && r.bobber) r.bobber.visible = false; player.resetPose(); }

  // ---- the console in the villa's den: Tide Rider (the Skate Surge engine, game/venues.js) ------------------------
  // ---- the view: sitting where there is one, waiting for the sunset or the night ---------------------------------
  const seatRef = () => (game.act.mode === 'sit' && !game.act.rising && game.act.seat && game.act.seat.ref) || null;
  const seatedView = () => { const s = seatRef(); return !!(s && s.view && homeKey()); };
  function wait(which) {
    if (!seatedView()) return false;
    const h = env.tod, to = which === 'sunset' ? SUNSET : NIGHT;
    if (which === 'sunset' && h >= SUNSET - 0.2 && h < 21) { hud.toast('THE SUN IS ALREADY GOING DOWN', 'SIT BACK AND WATCH IT'); return true; }
    if (which === 'night' && (h >= NIGHT - 0.2 || h < 4.5)) { hud.toast('IT IS ALREADY NIGHT', 'THE NEON IS ON'); return true; }
    env.target = to; env.ffRate = (d) => clamp(d * 0.55, 0.3, 2.4);
    S.wait = which; stats.waits++;
    hud.toast(which === 'sunset' ? 'WAITING FOR THE SUNSET' : 'WAITING FOR THE NIGHT', 'F / E / WASD: GET UP ANY TIME'); audio.blip(true);
    return true;
  }
  function endWait(reached) {
    if (!S.wait) return;
    const w = S.wait; S.wait = null; env.ffRate = null;
    if (!reached) { env.target = null; hud.toast('BACK ON YOUR FEET', `IT IS ${clock()}`); return; }
    hud.toast(w === 'sunset' ? 'SUNSET FROM HOME' : 'NIGHT FALLS', `${clock()} · NOT A BAD VIEW`);
  }

  // ---- the parking bays (villa, penthouse) --------------------------------------------------------------------
  const bayHome = (v) => HOMES.find((h) => h.bay && owned(h.id) && Math.hypot(v.x - h.bay.x, v.z - h.bay.z) < 5);
  function spawnAtBay(h, sv) {
    const { vehicles } = game, T = vehicles.VTYPES[sv.type], type = T && T.kind === 'car' ? sv.type : 'sedan';
    const c = vehicles.cars.find((k) => k.spare && k.kind === 'car' && k.off && !k.driven) || vehicles.cars.find((k) => k.spare && k.kind === 'car' && !k.driven && !k.homeCar && Math.hypot(k.x - player.pos.x, k.z - player.pos.z) > 60);
    if (!c) return null;
    vehicles.setType(c, type, sv.color);
    Object.assign(c, { off: false, x: h.bay.x, z: h.bay.z, y: 0, yaw: h.bay.yaw, vx: 0, vy: 0, vz: 0, spin: 0, tvx: 0, tvz: 0, air: false, park: { x: h.bay.x, z: h.bay.z, yaw: h.bay.yaw }, wreck: false, burn: 0, homeCar: h.id });
    resetDamage(c); vehicles.retint(c); stats.restored++;
    return c;
  }
  const bayCar = (id) => game.vehicles.cars.find((c) => c.homeCar === id && !c.off);
  let bayT = 0;
  function bays(dt) {
    const v = game.vehicle;
    // getting out of a car parked in your bay stores it; driving it off frees the bay
    if (v && v.kind === 'car' && !v.police) S.lastCar = v;
    else if (!v && S.lastCar) {
      const c = S.lastCar; S.lastCar = null;
      const h = bayHome(c);
      if (h && !c.wreck && !(c.burn > 0) && !c.sink) {
        for (const o of game.vehicles.cars) if (o !== c && o.homeCar === h.id) o.homeCar = null;
        Object.assign(c, { x: h.bay.x, z: h.bay.z, yaw: h.bay.yaw, vx: 0, vz: 0, park: { x: h.bay.x, z: h.bay.z, yaw: h.bay.yaw }, homeCar: h.id });
        save.garage[h.id] = { type: c.type || 'sedan', color: typeof c.color === 'string' ? c.color : '#ff4fa3' }; stats.stored++; game.persist();
        hud.toast(h.id === 'villa' ? 'PARKED IN THE VILLA\'S GARAGE BAY' : 'PARKED IN YOUR PRIVATE BAY', 'IT WILL BE HERE NEXT TIME · KEPT WITH THE SAVE');
      }
    }
    if ((bayT -= dt) > 0) return; bayT = 1;
    for (const h of HOMES) {
      if (!h.bay) continue;
      const c = bayCar(h.id);
      if (c && c.driven && Math.hypot(c.x - h.bay.x, c.z - h.bay.z) > 12) { c.homeCar = null; save.garage[h.id] = null; game.persist(); hud.toast('OUT OF THE GARAGE', 'PARK IT BACK IN THE BAY TO KEEP IT'); continue; }
      const sv = owned(h.id) && save.garage[h.id];
      if (sv && !c && !game.busy && (game.inside || Math.hypot(player.pos.x - h.bay.x, player.pos.z - h.bay.z) > 60 || !S.started)) spawnAtBay(h, sv);
    }
    S.started = true;
  }

  // ---- music for the room you are in -----------------------------------------------------------------------
  function themeFor(key) {
    if (!H[key]) return undefined;
    if (S.music[key] !== undefined) return S.music[key];
    if (S.tv[key] === 'music') return 'wear';
    return undefined;
  }

  const api = {
    HOMES, stats, S,
    owned,
    get touring() { return S.touring; },
    get act() { return S.act; },
    menu: (kind) => MENUS[kind] || null,
    bark(key) { if (H[key]) return owned(key) ? `${H[key].name}: HOME SWEET HOME · E AT THINGS TO USE THEM` : ''; return ''; },
    forSale(q) { const h = H[q.key]; if (!h) return; audio.blip(false); hud.toast('FOR SALE: ' + h.name, `$${h.price.toLocaleString('en-US')} · ASK AT ${AGENCY[h.agency].name}${h.agency === 'realty' ? ' (LUMINA BOULEVARD)' : ' (STADIUM WAY)'}`); },
    themeFor,
    get water() { return S.water || 0; },
    get waves() { const k = homeKey(); return k === 'houseboat' ? (S.act && S.act.kind === 'sleep' ? 1 : 0.4) : 0; },
    // E in a room (game/places.js): true when handled here
    use(p, u) {
      const k = u.kind, r = p.room;
      if (k === 'listings') { game.places.openShop('listings_' + u.agency); return true; }
      if (!H[p.key]) return false;
      if (k === 'tv') { game.places.openShop('hometv'); return true; }
      if (k === 'bed') { game.places.openShop('homesleep'); return true; }
      if (k === 'shower') { startShower(r, u); return true; }
      if (k === 'bath') { const s = (u.seat && r.seats.find((q) => q.steam === u.seat)) || r.seats.find((q) => q.tub); if (s) { game.act.reset(); game.act.sit({ x: r.ox + s.x, z: r.oz + s.z, y: s.y, yaw: s.yaw, kind: s.kind, ref: s, floorY: OY + (s.fy || 0) }); } return true; }
      if (k === 'wardrobe') { game.places.openShop('wardrobe'); return true; }
      if (FOOD[k]) { game.places.openShop('food_' + k); return true; }
      if (k === 'radio' || k === 'records') { game.places.openShop('homeradio'); return true; }
      if (k === 'fish') { startFish(r, u); return true; }
      if (k === 'console') { if (game.venues.playConsole) game.venues.playConsole(); return true; }
      // the penthouse: cook at the island, the blinds, the fire, the piano
      if (k === 'cook') { game.places.openShop('food_cook'); return true; }
      if (k === 'blinds' && r.blinds) { const c = r.blinds.userData.toggle(); stats.blinds = (stats.blinds || 0) + 1; audio.blip(true); hud.toast(c ? 'THE BLINDS COME DOWN' : 'THE BLINDS GO UP', c ? 'LINEN OVER THE GLASS · E AGAIN TO OPEN' : 'THE VIEW IS BACK'); return true; }
      if (k === 'fireplace' && r.fire) { const f = r.fire.userData; f.want = f.want ? 0 : 1; stats.fires = (stats.fires || 0) + 1; audio.blip(!!f.want); hud.toast(f.want ? 'THE FIRE IS LIT' : 'THE FIRE GOES DOWN', f.want ? 'A LONG ROW OF FLAMES BEHIND THE GLASS' : 'THE STONE STAYS WARM A WHILE'); return true; }
      if (k === 'piano') { playPiano(); return true; }
      return false;
    },
    // E while something is running: reel in, or step out of the shower
    press() {
      const A = S.act; if (!A) return false;
      if (A.kind === 'fish') { if (A.phase === 'done') return true; reel(); return true; }
      if (A.kind === 'shower') { endShower(room(), A.t > 2.5); return true; }
      return true;
    },
    // every frame indoors before walking: an activity owns the courier and the camera (true)
    drive(dt, ctl, r) {
      const A = S.act; if (!A) return false;
      if (A.kind === 'shower') return showerTick(dt, ctl, r);
      if (A.kind === 'fish') return fishTick(dt, ctl, r);
      if (A.kind === 'cook') return cookTick(dt, ctl, r);
      if (A.kind === 'sleep') { game.act.update(dt, { move: 0, strafe: 0 }, null); const s = game.act.seat; if (s && s.ref && s.ref.cam) api.seatCam(r, s.ref.cam, dt); else { const b = bedSeat(r); if (b) camRoom(r, [1.6, 2.2, 1.8], [b.x - r.ox, (b.ref.fy || 0) + 0.6, b.z - r.oz], b.ref.fy || 0); } sleepTick(dt); return true; }
      return false;
    },
    // after walking: the villa pool (a swim)
    afterWalk(dt, ctl, r, ly) {
      const sw = !!(r.inPool && ly < -0.5);
      if (sw !== S.swim) { S.swim = sw; r.swimming = sw; audio.splash(sw ? 0.9 : 0.4); if (sw) { stats.swims++; S.ph = 0; } else player.resetPose(); }
      if (!sw) return;
      S.ph = (S.ph || 0) + dt * (2 + player.speed);
      const moving = player.speed > 0.6;
      applyPose(player.model, moving ? POSES.crawl(S.ph * 1.4, 0.5) : POSES.tread(S.ph), player.pos.y + (moving ? 0.86 : 0));
      if (moving && Math.random() < dt * 1.5) audio.stroke(0.6);
    },
    // the seated view camera (eases out towards the seat's camera and looks where it points)
    seatCam(r, c, dt) {
      S.camK = Math.min(1, S.camK + dt * 0.8);
      const k = 1 - Math.exp(-(1.5 + S.camK * 2) * dt), p = camera.position;
      p.set(lerp(p.x, r.ox + c[0], k), lerp(p.y, OY + c[1], k), lerp(p.z, r.oz + c[2], k));
      camera.lookAt(r.ox + c[3], OY + c[4], r.oz + c[5]);
      cut.setFov(lerp(camera.fov, 58, k));
    },
    seatedView,
    wait,
    hint() {
      const A = S.act;
      if (A && A.kind === 'fish') return A.phase === 'bite' ? [['E', 'reel in now, in the green!'], ['WASD', 'stop fishing']] : [['E', 'wait for the bite'], ['WASD', 'stop fishing']];
      if (A && A.kind === 'shower') return [['E / WASD', 'step out']];
      if (A && A.kind === 'cook') return [['', 'cooking…'], ['WASD', 'stop']];
      if (A && A.kind === 'sleep') return [['Zzz', 'sleeping']];
      if (seatedView()) return [['1', 'wait for sunset (19:30)'], ['2', 'wait for night (22:00)'], ['F / E / WASD', 'get up']];
      if (S.swim) return [['WASD', 'swim'], ['', 'the steps are at the end by the umbrella']];
      return null;
    },
    touchButtons() {
      if (!homeKey() || game.busy) return null;
      const A = S.act;
      if (A && A.kind === 'fish') return [['KeyE', 'REEL IN']];
      if (A && A.kind === 'shower') return [['KeyE', 'STEP OUT']];
      if (seatedView()) return [['Digit1', 'SUNSET'], ['Digit2', 'NIGHT'], ['KeyF', 'GET UP']];
      return null;
    },
    // the agency's viewing: a short tour (X skips), then back at the desk
    tour(id, ag) { tour(id, ag); },
    // every frame (main.js, after the places)
    update(dt) {
      if (!game.started) return;
      bays(dt);
      const k = homeKey(), r = room();
      if (game.fronts && game.fronts.boat) game.fronts.boat.visible = k !== 'houseboat';
      // the penthouse sees further: a view boost like the Solstice Terrace's while inside
      const boost = !!(r && r.view && r.view.boost);
      if (boost !== S.boost) { S.boost = boost; VIEW.far = boost ? (quality.high ? 2.4 : 1.7) : 1; VIEW.fog = boost ? 1.75 : 1; }
      if (!k || S.touring) { if (S.act && S.act.kind !== 'sleep') S.act = null; S.safeT = 0; if (fishEl && !fishEl.hidden) fishUI(false); S.swim = false; return; }
      // the TV: a fresh picture about 12 times a second, a sound now and then
      const ch = S.tv[k];
      if (game.busy === 'arcade' && k === 'villa' && game.venues.canvas) { TV.ctx.drawImage(game.venues.canvas, 0, 0, 256, 176); TV.tex.needsUpdate = true; if (r.tv && !r.tv.material.map) r.tv.userData.on(true); }
      else if (ch) { if (r.tv && !r.tv.material.map) r.tv.userData.on(true); S.chT -= dt; if (S.chT <= 0) { S.chT = 1 / 12; drawTv(ch, timeU.value); } S.sndT -= dt; if (S.sndT <= 0) { S.sndT = 0.7 + Math.random() * 0.6; tvSound(ch, timeU.value); } }
      else if (r.tv && r.tv.material.map) r.tv.userData.on(false);
      // the stored car shows in the villa's garage
      if (r.garageCar) r.garageCar(owned(k) && save.garage[k] ? save.garage[k].color : null);
      // a soak in the tub or the hot tub: steam, and after five seconds the reward (once a minute)
      const s = seatRef(), tub = !!(s && s.tub);
      if (k === 'penthouse') for (const key of ['steam2', 'steam3']) if (r[key]) r[key].userData.on(tub && (s.steam || 'steam2') === key ? 0.8 : 0);
      if (k === 'villa' && r.steam && !S.act) r.steam.userData.on(tub ? 0.8 : 0);
      S.soakCd = Math.max(0, S.soakCd - dt);
      if (tub) { S.soakT += dt; if (S.soakT > 5 && S.soakCd <= 0) { S.soakCd = 60; stats.soaks++; refresh(k, k === 'villa' ? ' · A LONG SOAK' : ' · THE BUBBLES DID IT'); } } else S.soakT = 0;
      // waiting with a view
      const sv = seatedView();
      if (!sv) { if (S.wait) endWait(false); S.camK = 0; } else if (S.wait && env.target === null) endWait(true);
      if (sv && !sitWas) hud.toast('A SEAT WITH A VIEW', game.input.touchMode ? 'SUNSET or NIGHT to wait · GET UP any time' : '1: WAIT FOR SUNSET · 2: WAIT FOR NIGHT · F: GET UP');
      sitWas = sv;
      // the safehouse: stars on you, no patrol within reach of the door: one star off every few seconds
      if (game.wanted > 0 && owned(k)) {
        const p = game.inside, near = game.traffic && game.traffic.police.some((c) => !c.off && Math.hypot(c.x - p.x, c.z - p.z) < 45);
        if (near) S.safeT = 0;
        else if ((S.safeT += dt) > 5) { S.safeT = 0; game.wanted--; stats.safe++; hud.toast('SAFEHOUSE', game.wanted ? `THE PATROL IS LOSING YOUR TRAIL · ${game.wanted} STAR${game.wanted > 1 ? 'S' : ''} LEFT` : 'THE HEAT IS OFF · NOBODY KNOWS YOU LIVE HERE'); }
      } else S.safeT = 0;
    },
    // after the camera is final: the houseboat rocks gently
    camLate(dt) {
      const k = game.inside && game.inside.key;
      if (k !== 'houseboat' || reducedMotion) return;
      const t = timeU.value, sl = S.act && S.act.kind === 'sleep' ? 2 : 1;
      camera.position.y += Math.sin(t * 0.9) * 0.035 * sl;
      camera.rotateZ(Math.sin(t * 0.7) * 0.012 * sl);
    },
    reset() { S.act = null; S.tv = {}; S.music = {}; fishUI(false); },
    state() { const k = homeKey(), r = room(); return { inside: k, owned: [...save.homes], garage: { ...save.garage }, lastHome: save.lastHome, act: S.act && { kind: S.act.kind, phase: S.act.phase }, tv: k ? S.tv[k] || null : null, music: k ? themeFor(k) : undefined, swim: S.swim, wait: S.wait, seatedView: seatedView(), safeT: +S.safeT.toFixed(1), refreshed: game.eat.refreshed, boost: S.boost, view: { ...VIEW }, stats: { ...stats }, bayCars: HOMES.filter((h) => h.bay).map((h) => { const c = bayCar(h.id); return c ? { id: h.id, type: c.type, color: c.color, x: +c.x.toFixed(1), z: +c.z.toFixed(1) } : null; }), menu: menuMode, tvMap: r && r.tv ? !!r.tv.material.map : null }; },
    // debug: start a bite now
    biteNow() { if (S.act && S.act.kind === 'fish') { S.act.phase = 'wait'; S.act.t = 99; } },
    fishState() { return S.act && S.act.kind === 'fish' ? { phase: S.act.phase, m: +S.act.m.toFixed(2), z0: +S.act.z0.toFixed(2), z1: +S.act.z1.toFixed(2) } : null; },
    fishSetM(m) { if (S.act && S.act.kind === 'fish') { S.act.m = m; S.act.fixM = m; S.act.t = 0; } },
  };

  function tour(id, ag) {
    const places = game.places, h = H[id], back = places.byKey(ag);
    const homeR = places.roomOf(places.byKey(id)), shots = homeR.tour;
    stats.tours++; S.touring = true;
    const beats = [{ dur: 0.35, start() { cut.fade(true); } }];
    shots.forEach((sh, i) => {
      const nx = shots[i + 1] || sh;
      beats.push({
        dur: reducedMotion ? 1.2 : 2.2,
        start() {
          if (i === 0) { places.enterRoom(id, ...(homeR.spawn || [0, homeR.hz - 2.6])); player.yaw = homeR.faceIn ?? PI; cut.fade(false); hud.toast('VIEWING: ' + h.name, `${h.district} · $${h.price.toLocaleString('en-US')} · X SKIPS`); }
          cut.setFov(56);
        },
        tick(k) {
          const e = k * k * (3 - 2 * k) * 0.35, r = homeR;
          camera.position.set(r.ox + lerp(sh[0], nx[0], e), OY + lerp(sh[1], nx[1], e), r.oz + lerp(sh[2], nx[2], e));
          camera.lookAt(r.ox + sh[3], OY + sh[4], r.oz + sh[5]);
          r.idle(timeU.value, 1 / 60, reducedMotion);
          player.speed = 0; player.animate(1 / 60, 0, null);
        },
      });
    });
    cut.run(beats, () => {
      S.touring = false;
      const r = places.roomOf(back), u = r.uses[0];
      places.enterRoom(ag, u.x, u.z);
      hud.toast(AGENCY[ag].name, owned(id) ? 'IT LOOKS EVEN BETTER WITH YOUR THINGS IN IT' : `${AGENCY[ag].who}: “WELL? E AT THE DESK WHEN YOU ARE READY TO SIGN.”`);
    }, true);
  }

  return api;
}
