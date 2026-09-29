/**
 * #216: The Iron King, the Iron Hold's crown boss, 1.3× the Paladin (74 art px with the crown: above the Warden's and the Forgemaster's
 * 66, under the Usurper's 84): dark iron plate with a red chevron and a red cape, spiked pauldrons and poleyns (his thorns), a tall iron
 * tower shield studded red (his shield), a greatsword, and a closed great helm under a heavy crown of iron with red stones. His special is
 * the charge down the line (armoured.ts): the rush behind his shield, a pale steel streak behind him.
 */
import { armouredSprite } from '../armoured';
import { scaled } from '../robed';

const S = 1.3;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'ironKing', S, tall: 74, h: 112,
  plate: 'darksteel', accent: 'red', trim: 'steel', cape: 'red', blade: 'steel', fx: 'smear', special: 'charge', tower: true, spiked: true,
  head(f, head, p) {
    const slit: [number, number, 'coal', number][] = [-2, -1, 0, 1, 2, 3, 4].map((x) => [x + 0.5, -4.8, 'coal', 0]);
    f.part(head, sc([[-5.2, 1.4], [-5.6, -9.6], [-4.2, -11], [4, -11], [5.8, -9.6], [6, 1.2], [2.8, 2.2], [-2.8, 2]]), 'darksteel', 5, {
      trim: ['steel', 0.7], details: dt([...slit, [4.8, -1.4, 'coal', 0], [4.8, 0, 'coal', 0], [1.2, -8.6, 'steel', 6]]),
    }); // a closed great helm, an eye slit and breaths
    f.part(head, sc([[-6, -8.8], [6.6, -8.8], [6.6, -11.8], [6.2, -16], [4, -12.6], [2, -17], [0.2, -12.8], [-1.6, -17], [-3.6, -12.6], [-5.6, -16], [-6, -11.8]]), 'steel', 5.1, {
      trim: ['darksteel', 0.8], details: dt([[0.3, -10.4, 'red', 5], [3.8, -10.3, 'red', 4], [-3.4, -10.3, 'red', 4], [2, -16.2, 'steel', 6], [-1.6, -16.2, 'steel', 6]]),
    }); // the iron crown: heavy points, three red stones
    f.part(head.child(-5 * S, -3 * S, 0.35 + p.crest), sc([[0, 0], [1.4, 0], [0.4, 7], [-2, 8.6], [-1.2, 4]]), 'red', 4.8, { profile: 'flat', folds: [0.4, 2, 1], dim: 1 }); // a red mantle tail from the helm
  },
});
