/**
 * #158: The Lich. A skeleton king in purple robes, 1.2× the Paladin (66 art px tall with the crown; bosses draw at 4/3, about 1.6×
 * on screen): a skull under a gold crown with soul-lit eyes, bone hands, and a staff topped with a soul orb. His special is the hex
 * (robed.ts): soulfire gathers in his far hand over the telegraph, then he casts it down (shadow: purple).
 */
import { robedSprite, scaled } from '../robed';

const S = 1.2;
const { sc, E, dt } = scaled(S);

export const sprite = robedSprite({
  id: 'lich', S, tall: 66,
  robe: 'purple', panel: 'darksteel', trim: 'gold', hand: 'white', fx: 'soul',
  head(f, head) {
    f.part(head, sc([[-4.6, -1], [-5, -6], [-3.6, -9.6], [0, -10.6], [3.8, -9.6], [5.4, -6], [5, -2], [3.6, 1.6], [0, 2.2], [-2.8, 1.2]]), 'white', 5, {
      details: dt([[3.8, -2, 'darksteel', 1], [0.5, 0.5, 'darksteel', 1], [1.5, 0.5, 'white', 5], [2.5, 0.5, 'darksteel', 1], [3.4, 0.5, 'white', 5]]),
    }); // skull
    f.part(head, sc([[0.8, -6.4], [4.6, -6.4], [4.4, -3.4], [3.4, -2.8], [2.6, -3.8], [1.8, -3], [0.8, -3.6]]), 'darksteel', 5.05, { profile: 'flat', outline: false, details: dt([[1.7, -4.8, 'soul', 6], [3.8, -4.8, 'soul', 5]]) }); // eye sockets, soul-lit
    f.part(head, sc([[4.8, -2.6], [5.6, -2.6], [5.4, -1.4]]), 'darksteel', 5.06, { profile: 'flat', outline: false }); // nose hole
    f.part(head, sc([[-5, -8.6], [5.4, -8.6], [5.4, -10.6], [4.8, -14], [3, -11.4], [1.6, -14.8], [0, -11.4], [-1.8, -14.6], [-3, -11.4], [-4.8, -14], [-5, -10.6]]), 'gold', 5.1, { details: dt([[0.1, -10.2, 'red', 5]]) }); // crown
  },
  top(f, st, p) {
    f.part(st, sc([[-2.6, -23], [2.6, -23], [3.4, -27], [1.2, -26], [0, -30], [-1.2, -26], [-3.4, -27]]), 'darksteel', 6.85); // claw
    f.part(st, E(0, -28, 2.6 + p.magic * 0.4, 2.6 + p.magic * 0.4), 'soul', 6.9); // soul orb
  },
});
