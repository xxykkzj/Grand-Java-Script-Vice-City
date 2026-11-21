// Fade & Fringe, the barber and salon (room: game/venuerooms.js buildSalon). Dolly's chair works like the
// fitting podiums: the shop panel lists what you can change, every line you highlight shows on Skye at once
// (with the camera framing her head and shoulders beside the menu, game/places.js), and Enter pays for it.
//   top list   HAIRSTYLE ›  COLOUR ›  FACIAL HAIR ›  BACKWARDS CAP (on / off, free)  ALL DONE
//   sub-lists  every hairstyle, colour or facial hair (actors/blocky.js HAIR_STYLES, HAIR_COLORS, FACIAL) with its price
// Each change is paid for once, when you buy it; it is kept with the save (save.hair, save.cap) like the clothes.
// While she works the cap comes off, so you always see the cut; it goes back on (if you wear it) when you get up.
// A new cut, like a new outfit, sheds a star of heat now and then.
import { HAIR_STYLES, HAIR_COLORS, FACIAL } from '../actors/blocky.js';
import { BARKS, CAST } from './story.js';
import { timeU } from '../core/util.js';

const LISTS = { style: HAIR_STYLES, color: HAIR_COLORS, facial: FACIAL };
const LABEL = { style: 'HAIRSTYLE', color: 'COLOUR', facial: 'FACIAL HAIR' };
const KINDS = ['style', 'color', 'facial'];
const DONE = { style: 'FRESH CUT', color: 'NEW COLOUR', facial: 'NEW FACE FUZZ' };
export const DEFAULT_HAIR = { style: 'shag', color: 'plum', facial: 'none' };
// a saved look with every id checked (an old or edited save falls back to Skye's own)
export const fixHair = (h) => {
  const o = { ...DEFAULT_HAIR };
  for (const k of KINDS) if (h && LISTS[k].some((x) => x.id === h[k])) o[k] = h[k];
  return o;
};

export function createSalon(game) {
  const { player, save, audio } = game;
  let mode = 'top', want = null, heatCd = 0, n = 0;
  const stats = { cuts: 0, spent: 0, caps: 0 };
  const cur = () => (save.hair = fixHair(save.hair));
  const room = () => (game.inside && game.inside.room) || null;
  const show = (h) => player.model.setHair(h, false);
  const find = (k, id) => LISTS[k].find((x) => x.id === id) || LISTS[k][0];
  const api = {
    stats,
    get mode() { return mode; },
    get title() { return mode === 'top' ? "FADE & FRINGE · DOLLY'S CHAIR" : 'FADE & FRINGE · ' + LABEL[mode]; },
    get label() { return mode === 'top' ? 'CHOOSE' : 'BUY'; },
    get foot() { return mode === 'top' ? 'W/S choose · Enter pick · Esc done' : 'W/S see it on you · Enter buy · Esc back'; },
    items() {
      const h = cur();
      if (mode === 'top') {
        const st = find('style', h.style);
        return [
          { id: 'style', name: 'HAIRSTYLE', note: `${st.name}. ${HAIR_STYLES.length} cuts from $${Math.min(...HAIR_STYLES.map((x) => x.price))}`, tag: '›' },
          { id: 'color', name: 'COLOUR', note: `${find('color', h.color).name}. Naturals, silvers and three loud dyes`, tag: '›' },
          { id: 'facial', name: 'FACIAL HAIR', note: `${find('facial', h.facial).name}. Stubble, moustache, goatee or a full beard`, tag: '›' },
          { id: 'cap', name: 'BACKWARDS CAP', note: save.cap ? 'On when you get up. Free to take off.' : 'Off when you get up. Free to put back on.', tag: save.cap ? 'WEARING' : 'OFF' },
          { id: 'done', name: 'ALL DONE', note: 'Thank Dolly and get up.', tag: '' },
        ];
      }
      return LISTS[mode].map((o) => ({ ...o, tag: h[mode] === o.id ? 'CURRENT' : '$' + o.price }));
    },
    greet() { const b = BARKS.barber; return `${CAST[b[0]].name}: “${b[1][n++ % b[1].length]}”`; },
    open() { mode = 'top'; want = null; const r = room(); if (r) r.cutting = true; show(cur()); },
    close() { mode = 'top'; const r = room(); if (r) r.cutting = false; player.model.setHair(cur(), !!save.cap); },
    // the highlighted line, on Skye (the top list shows what you have)
    preview(o) { if (mode === 'top' || !o) show(cur()); else show({ ...cur(), [mode]: o.id }); },
    back() { if (mode === 'top') return false; want = KINDS.indexOf(mode); mode = 'top'; show(cur()); return true; },
    takeSel() { const w = want; want = null; return w; },
    pick(o) {
      const h = cur();
      if (mode === 'top') {
        if (o.id === 'done') { game.places.closeShop(); return null; }
        if (o.id === 'cap') { save.cap = save.cap ? 0 : 1; stats.caps++; game.persist(); audio.blip(true); return save.cap ? 'THE CAP GOES BACK ON WHEN YOU GET UP' : 'NO CAP: THE WHOLE STREET GETS TO SEE THE CUT'; }
        mode = o.id; want = Math.max(0, LISTS[mode].findIndex((x) => x.id === h[mode]));
        audio.step(1); show(h);
        return `${LABEL[mode]}: PICK ONE TO SEE IT ON YOU`;
      }
      if (h[mode] === o.id) { audio.blip(false); return "THAT'S WHAT YOU'VE GOT, SUGAR"; }
      if (game.money < o.price) { audio.blip(false); return `NOT ENOUGH CASH: ${o.name} IS $${o.price}`; }
      game.money -= o.price; stats.cuts++; stats.spent += o.price;
      save.hair = { ...h, [mode]: o.id }; game.persist();
      audio.cash(); audio.pickup();
      let msg = `${DONE[mode]}: ${o.name} · -$${o.price}`;
      if (game.wanted > 0 && timeU.value > heatCd) { game.wanted--; heatCd = timeU.value + 45; msg += ' · THE PATROL WANTS THE OLD HAIRDO: -1 HEAT'; }
      want = KINDS.indexOf(mode); mode = 'top'; show(save.hair);
      return msg;
    },
  };
  return api;
}
