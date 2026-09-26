/**
 * #158: The Black Knight, 1.15× the Paladin (63 art px tall; the game draws bosses at 4/3, so about 1.5× the Paladin on screen):
 * blackened plate, a horned great helm with a red eye slit, a red horsehair crest, a torn red cape, a heater shield and a
 * greatsword. His special is the charge (armoured.ts): he braces and crouches over the telegraph, then bursts forward down the
 * line, sword levelled, with a pale steel streak behind him (physical).
 */
import { armouredSprite } from '../armoured';
import { scaled, type Px } from '../robed';

const S = 1.15;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'blackKnight', S, tall: 63,
  plate: 'darksteel', accent: 'red', trim: 'steel', cape: 'red', blade: 'steel', fx: 'smear', special: 'charge',
  head(f, head, p) {
    const slit: Px[] = [-3, -2, -1, 0, 1, 2, 3, 4].map((x) => [x + 0.5, -4.5, 'red', x > 1 ? 6 : 5]);
    f.part(head.child(-2.6 * S, -7.4 * S, -0.5), sc([[-1.4, 0], [1.4, 0], [0.6, -5], [-2.8, -8.4], [-1.2, -4]]), 'white', 4.8, { dim: 1 }); // far horn
    f.part(head, sc([[-5, 0.8], [-5.4, -5.4], [-4.6, -9.4], [-1.8, -11], [2.4, -11], [5, -9.4], [5.9, -5.4], [5.7, 0.8], [2.8, 1.8], [-2.8, 1.6]]), 'darksteel', 5, {
      details: dt([...slit, [4.6, -1.5, 'darksteel', 0], [4.6, 0, 'darksteel', 0], [3.6, -0.8, 'darksteel', 0]]),
    }); // great helm
    f.part(head, sc([[1.9, -6.2], [3.1, -6.2], [3.1, 1.2], [1.9, 1.2]]), 'darksteel', 5.1); // nose ridge
    f.part(head.child(3.2 * S, -7.8 * S, 0.45), sc([[-1.4, 0], [1.4, 0], [1.8, -4.6], [4, -8.8], [0.4, -5]]), 'white', 5.2); // near horn
    f.part(head.child(-0.2 * S, -10.8 * S, p.crest), sc([[1.5, 0.4], [1, -2.2], [-1.8, -3.4], [-5.4, -3], [-8.6, -1.2], [-10.6, 1.8], [-10, 5], [-8.2, 2.4], [-5.2, 0.8], [-2.6, 1.2]]), 'red', 4.9, { folds: [0.6, 2.2, 1] }); // crest
  },
});
