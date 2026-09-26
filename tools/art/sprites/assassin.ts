/** #157: the Assassin: a lean figure in charcoal, hood and face scarf, a dark red sash and a long dagger he stabs with a shadow trail. */
import { face, humanSprite, pose, THRUST, trail, type Kit } from '../human';

const kit: Kit = {
  legs: 'coal', boots: 'coal', sleeve: 'coal', hand: 'coal',
  back(f, torso, p) {
    f.part(torso.child(-4, -15, 0.08 * p.sway), [[-2, 0], [3, -1], [1, 16], [-5, 14]], 'coal', 0.3, { profile: 'flat', dim: 1 }); // short cape
  },
  body(f, torso) {
    f.part(torso, [[-5.8, -15], [5.6, -15], [6.4, -4], [6.6, 3], [-6, 3], [-6.2, -4]], 'coal', 3, { folds: [0.4, 2.6, 1] });
    f.part(torso, [[-6.2, -5], [6.6, -5], [6.6, -2.6], [-6.2, -2.6]], 'red', 3.3, { profile: 'flat' }); // sash
    f.part(torso, [[-7.8, -3], [-5.8, -3.6], [-5.4, 1], [-7.4, 1.6]], 'red', 3.25, { profile: 'flat', dim: 1 }); // its knot
  },
  head(f, head) {
    face(f, head, 'skin', false);
    f.part(head, [[-5, 2], [-5.4, -5], [-3.4, -10.2], [1.6, -11], [5.4, -7.6], [5.8, -6], [0.8, -6.4], [0.6, -4], [6, -3.6], [5.6, 0.6], [1.6, 2.6]], 'coal', 5.2, { details: [[3.4, -5.2, 'white', 5]] }); // hood and scarf, a glint of eye
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 12, 'purple');
    f.part(grip, [[-0.7, -1.6], [0.7, -1.6], [0.7, 2.6], [-0.7, 2.6]], 'leather', p.zw);
    f.part(grip, [[-2.2, -2.4], [2.2, -2.4], [2.2, -1.6], [-2.2, -1.6]], 'black', p.zw + 0.1);
    f.part(grip, [[-1, -2.2], [1, -2.2], [0.8, -10], [0, -12], [-0.8, -10]], 'steel', p.zw + 0.05);
  },
};

export const sprite = humanSprite('assassin', 52, kit, pose({ fist: [6, 9], far: [5, 8], weapon: 1.2, lean: 0.08 }), THRUST, 4);
