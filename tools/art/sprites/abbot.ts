/**
 * #158: The Plague Abbot. A hunched monk in a moss-grey habit, 1.15× the Paladin (63 art px; about 1.5× on screen): a beaked plague
 * mask under a deep cowl, gloved hands, a rope girdle, and a crook hung with a smoking censer. His special is the flask volley
 * (robed.ts): a poison flask brews in his far hand, he draws it back over his head on the telegraph, then flings it: it arcs
 * ahead and shatters, and the ground spatters (poison: green).
 */
import { robedSprite, scaled } from '../robed';

const S = 1.15;
const { sc, E, dt } = scaled(S);

export const sprite = robedSprite({
  id: 'abbot', S, tall: 63,
  robe: 'moss', panel: 'leather', trim: 'leather', hand: 'leather', fx: 'venom', throw: true,
  head(f, head) {
    f.part(head, sc([[-5.4, 1], [-6, -5], [-4.6, -10], [0, -11.6], [4.4, -10], [6, -6], [5.8, 1], [0, 2.4]]), 'moss', 4.9, { folds: [0.4, 2.4, 1] }); // cowl
    f.part(head, sc([[-1.2, -8.2], [3.6, -8.2], [4.6, -5], [4.2, -1], [0.4, 0.6], [-1.6, -2]]), 'white', 5, { details: dt([[2.4, -5.8, 'venom', 5], [2.4, -5, 'darksteel', 0]]) }); // mask, a glass eye
    f.part(head, sc([[3.2, -5.4], [7, -3.6], [11.4, -1.2], [11.6, 0], [7, 0.4], [3.4, 0.4]]), 'leather', 5.1, { details: dt([[5.2, -2.4, 'leather', 1], [7.4, -1.6, 'leather', 1]]) }); // the beak
  },
  top(f, st, p) {
    f.part(st, sc([[-0.9, -24], [0.9, -24], [4, -27.5], [5.6, -25.2], [4.6, -23], [3.4, -24.8], [1.4, -23]]), 'leather', 6.85); // crook
    f.part(st, sc([[4.1, -24.8], [4.7, -24.8], [4.7, -20], [4.1, -20]]), 'darksteel', 6.84, { outline: false }); // chain
    f.part(st, E(4.4, -18.4, 2.2, 2.2), 'darksteel', 6.86, { details: dt([[4, -18.8, 'venom', 5]]) }); // censer
    f.part(st, E(3.4 - p.magic * 0.3, -22.2 - p.magic, 1.4 + p.magic * 0.4, 1.4 + p.magic * 0.4), 'venom', 6.87, { profile: 'flat', outline: false }); // its green smoke
  },
});
