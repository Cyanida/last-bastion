/**
 * #158: The Grand Inquisitor. A tall zealot in red and white vestments, 1.2× the Paladin (70 art px with the mitre; about 1.7× on
 * screen): a stern face under a gold-trimmed mitre, and a cross-staff crowned with a burning brazier. His special is the line of
 * pyres (robed.ts): fire gathers in his far hand over the telegraph, then he drives the staff down and the ground bursts into
 * flame (fire: orange).
 */
import { robedSprite, scaled } from '../robed';

const S = 1.2;
const { sc, E, dt } = scaled(S);

export const sprite = robedSprite({
  id: 'inquisitor', S, tall: 70,
  robe: 'red', panel: 'white', trim: 'gold', hand: 'flesh', fx: 'flame',
  head(f, head) {
    f.part(head, sc([[-4.2, -1], [-4.6, -6], [-3.4, -9], [3.6, -9], [5, -6], [5.4, -3], [4.6, 0.6], [2.6, 2.2], [-1.6, 2]]), 'flesh', 5, {
      details: dt([[1.8, -6, 'flesh', 0], [2.8, -6.4, 'flesh', 0], [3.8, -6.2, 'flesh', 0], [2.8, -5, 'white', 6], [3.6, -5, 'darksteel', 0], [5.4, -3.4, 'flesh', 1], [5.4, -2.6, 'flesh', 1], [2.8, -0.6, 'flesh', 0], [3.8, -0.6, 'flesh', 0], [-1.6, -4, 'flesh', 1], [-1.6, -3, 'flesh', 1]]),
    }); // gaunt face, a hard brow
    f.part(head, sc([[-5, -7.6], [5.4, -7.6], [5, -12], [3, -16], [0.2, -18.4], [-2.8, -16], [-4.8, -12]]), 'white', 5.1, { trim: ['gold', 1], details: dt([[0.2, -13, 'red', 4], [0.2, -12, 'red', 4], [0.2, -11, 'red', 4], [-0.8, -12, 'red', 4], [1.2, -12, 'red', 4]]) }); // mitre with a red cross
    f.part(head.child(-4.4 * S, -8 * S, 0.3), sc([[-1, 0], [1.2, 0], [0.6, 10], [-1.4, 11]]), 'red', 4.8, { profile: 'flat', dim: 1 }); // lappet
  },
  top(f, st, p) {
    f.part(st, sc([[-4, -21], [4, -21], [4, -19.4], [-4, -19.4]]), 'gold', 6.85); // the cross-bar
    f.part(st, sc([[-3, -24], [3, -24], [2.2, -21], [-2.2, -21]]), 'gold', 6.86); // brazier bowl
    f.part(st, sc([[-2.4, -24], [2.4, -24], [1.6, -27 - p.magic * 0.8], [0.4, -25.6], [-0.6, -29 - p.magic], [-1.4, -25.8]]), 'flame', 6.87, { profile: 'flat' }); // its flame
    f.part(st, E(0, -24.8, 1, 1), 'flame', 6.88, { outline: false });
  },
});
