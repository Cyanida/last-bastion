/**
 * #227: The Ember Queen, the Cinderlands' level-3 boss, 1.2× the Paladin (68 art px with her crown, like the Inquisitor): a proud
 * face under a gold crown set with embers, hair of living flame streaming back, coal-black robes over an ember-lit panel, and a gold
 * sceptre that cradles a fire. Her special is the kindling (robed.ts): fire gathers in her far hand over the telegraph, then she drives
 * the sceptre down and the ground bursts into flame (fire: orange).
 */
import { robedSprite, scaled } from '../robed';

const S = 1.2;
const { sc, E, dt } = scaled(S);

export const sprite = robedSprite({
  id: 'emberQueen', S, tall: 68,
  robe: 'coal', panel: 'ember', trim: 'gold', hand: 'skin', fx: 'flame',
  head(f, head, p) {
    const sway = p.robe * 6; // the flames stream back with the robe's sway
    f.part(head, sc([[-4.4, -8], [-7.4 + sway, -6], [-10.4 + sway, -1], [-9.2 + sway, 3], [-11.6 + sway, 7.4], [-7.4 + sway, 6.4], [-5.6, 9.6], [-3.4, 4], [-3, -2]]), 'fire', 4.8, { profile: 'flat', dim: 1 }); // hair of flame, streaming back
    f.part(head, sc([[-4, -1], [-4.4, -6], [-3.2, -9], [3.4, -9], [4.8, -6], [5, -3], [4.4, 0.4], [2.4, 2], [-1.6, 1.8]]), 'skin', 5, {
      details: dt([[2.8, -5, 'white', 6], [3.6, -5, 'darksteel', 0], [2.4, -6.2, 'hair', 1], [3.6, -6.4, 'hair', 1], [3.6, -0.6, 'red', 3], [2.8, -0.6, 'red', 2]]),
    }); // her face, a dark brow and red lips
    f.part(head, sc([[-4.6, -8.2], [-5.4, -3], [-3.6, 0.4], [-2.4, -4], [-1, -8.4]]), 'fire', 5.05, { profile: 'flat' }); // flame hair framing the face
    f.part(head, sc([[-4.6, -8.2], [4.6, -8.2], [4.8, -10.6], [4.2, -14.6], [2.6, -11.2], [1, -15.6], [-0.4, -11.2], [-2, -15], [-3.2, -11.2], [-4.6, -14], [-4.8, -10.6]]), 'gold', 5.1, {
      details: dt([[0.8, -9.8, 'ember', 6], [-2.4, -9.8, 'ember', 5], [3.4, -9.8, 'ember', 5]]),
    }); // crown set with embers
    f.part(head, sc([[0.6, -15.4], [1.4, -15.4], [1.2, -18 - p.magic * 0.6], [0.9, -17]]), 'flame', 5.12, { profile: 'flat', outline: false }); // a flicker on its tallest point
  },
  top(f, st, p) {
    f.part(st, sc([[-2.8, -24], [2.8, -24], [2, -21.6], [0, -20.6], [-2, -21.6]]), 'gold', 6.85); // the sceptre's cup
    f.part(st, sc([[-3, -24], [-2.2, -24], [-1.8, -29], [-2.8, -28]]), 'gold', 6.86); // its claws
    f.part(st, sc([[2.2, -24], [3, -24], [2.8, -28], [1.8, -29]]), 'gold', 6.86);
    f.part(st, sc([[-2.2, -24], [2.2, -24], [1.6, -27.4 - p.magic], [0.4, -26], [-0.4, -30 - p.magic * 1.2], [-1.4, -26.2]]), 'flame', 6.87, { profile: 'flat' }); // the fire it cradles
    f.part(st, E(0, -25, 1.1, 1.1), 'fire', 6.88, { outline: false });
  },
});
