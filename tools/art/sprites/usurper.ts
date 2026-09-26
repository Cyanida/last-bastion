/**
 * #158: The Usurper, the last foe and the tallest boss: 1.4× the Paladin (84 art px with the crown, above the Warden's 66 and the
 * Black Knight's 63; the game draws every boss at 4/3, so about 2× the Paladin on screen). Heavy gilded plate with broad pauldrons,
 * a royal red cloak to the ground with an ermine collar, a tall crown over a helm with a burning eye slit, a red shield with a gold
 * chevron and a greatsword. His special is the charge down the line (armoured.ts), a fire streak behind him: the crown's wrath.
 */
import { armouredSprite } from '../armoured';
import { scaled, type Px } from '../robed';

const S = 1.4;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'usurper', S, tall: 84, h: 124, regal: true,
  plate: 'gold', accent: 'red', trim: 'steel', cape: 'red', blade: 'steel', fx: 'flame', special: 'charge',
  head(f, head, p) {
    const slit: Px[] = [-3, -2, -1, 0, 1, 2, 3, 4].map((x) => [x + 0.5, -4.5, 'flame', x > 1 ? 6 : 4]);
    f.part(head, sc([[-5, 0.8], [-5.4, -5.4], [-4.6, -9.4], [-1.8, -11], [2.4, -11], [5, -9.4], [5.9, -5.4], [5.7, 0.8], [2.8, 1.8], [-2.8, 1.6]]), 'gold', 5, {
      details: dt([...slit, [4.6, -1.5, 'gold', 0], [4.6, 0, 'gold', 0]]),
    }); // gilded helm
    f.part(head, sc([[-5.8, -9.2], [6.4, -9.2], [6.4, -12.4], [6, -17.5], [3.6, -13.6], [1.8, -19.5], [0.2, -13.8], [-1.6, -19.2], [-3.4, -13.6], [-5.4, -17.5], [-5.8, -12.4]]), 'gold', 5.1, {
      details: dt([[0.2, -11.2, 'red', 5], [3.6, -11, 'blue', 5], [-3.2, -11, 'blue', 5], [1.8, -18.8, 'gold', 6], [-1.6, -18.5, 'gold', 6], [6, -16.8, 'gold', 6], [-5.4, -16.8, 'gold', 6]]),
    }); // the stolen crown, tall and spiked
    f.part(head.child(-5 * S, -3 * S, 0.4 + p.crest), sc([[0, 0], [1.6, 0], [0.4, 9], [-2.4, 11], [-1.4, 5]]), 'red', 4.8, { profile: 'flat', folds: [0.4, 2, 1], dim: 1 }); // a mantle's tail from the helm
  },
});
