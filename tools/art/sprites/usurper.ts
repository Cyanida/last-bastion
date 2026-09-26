/**
 * #158: The Usurper, the last foe. The Paladin's size (60 art px with the crown); the game draws him at 5/3, about 1.8× the Paladin
 * on screen. Gilded plate over steel, a royal red cape, a crowned helm with a burning eye slit, a red shield with a gold chevron and
 * a gilded greatsword. His special is the charge down the line (armoured.ts), a fire streak behind him: the crown's wrath.
 */
import { armouredSprite } from '../armoured';
import { scaled, type Px } from '../robed';

const S = 1.0;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'usurper', S, tall: 60,
  plate: 'gold', accent: 'red', trim: 'steel', cape: 'red', blade: 'steel', fx: 'fire', special: 'charge',
  head(f, head, p) {
    const slit: Px[] = [-3, -2, -1, 0, 1, 2, 3, 4].map((x) => [x + 0.5, -4.5, 'fire', x > 1 ? 6 : 4]);
    f.part(head, sc([[-5, 0.8], [-5.4, -5.4], [-4.6, -9.4], [-1.8, -11], [2.4, -11], [5, -9.4], [5.9, -5.4], [5.7, 0.8], [2.8, 1.8], [-2.8, 1.6]]), 'gold', 5, {
      details: dt([...slit, [4.6, -1.5, 'gold', 0], [4.6, 0, 'gold', 0]]),
    }); // gilded helm
    f.part(head, sc([[-5.4, -9.2], [6, -9.2], [6, -11.2], [5.2, -15], [3.2, -12], [1.6, -15.8], [0, -12], [-1.8, -15.6], [-3.2, -12], [-5, -15], [-5.4, -11.2]]), 'gold', 5.1, {
      details: dt([[0.1, -11, 'red', 5], [3.4, -10.4, 'blue', 5], [-3, -10.4, 'blue', 5]]),
    }); // the stolen crown
    f.part(head.child(-5 * S, -3 * S, 0.4 + p.crest), sc([[0, 0], [1.6, 0], [0.4, 9], [-2.4, 11], [-1.4, 5]]), 'red', 4.8, { profile: 'flat', folds: [0.4, 2, 1], dim: 1 }); // a mantle's tail from the helm
  },
});
