/** #157: the Hound Master: a grey wolf-fur mantle over leather, a bare head with a beard, and a long whip he cracks. */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';

const kit: Kit = {
  legs: 'leather', boots: 'leather', sleeve: 'leather', hand: 'skin',
  back(f, torso, p) {
    f.part(torso.child(-4, -15, 0.05 * p.sway), [[-3, 0], [3, -1], [2, 18], [-4, 17]], 'fur', 0.3, { folds: [0.5, 2, 0] }); // the mantle behind
  },
  body(f, torso, p) {
    tunic(f, torso, p, 'leather', 'darksteel');
    f.part(torso, [[-7, -17], [6.4, -17], [7.6, -10], [-7.6, -10]], 'fur', 3.6, { folds: [0.6, 1.8, 0] }); // mantle over the shoulders
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-4.2, -4.6], [-4.4, -8], [-2.4, -10], [2, -10], [4.4, -8], [-1.8, -7.4], [-1.8, -3]], 'wool', 5.1); // hair
    f.part(head, [[0.6, -2.2], [5, -1.8], [4.6, 1.6], [1, 2.4]], 'wool', 5.15); // beard
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 22);
    f.part(grip, [[-0.9, -5], [0.9, -5], [0.9, 3], [-0.9, 3]], 'leather', p.zw); // handle
    // the lash: a thin line that curls further with the swing
    const bend = 0.5 - 0.8 * p.smear;
    let b = grip.child(0, -5, 0);
    for (let i = 0; i < 5; i++) {
      f.part(b, [[-0.6, 0], [0.6, 0], [0.4, -4.2], [-0.4, -4.2]], 'leather', p.zw - 0.05, { profile: 'flat' });
      b = b.child(0, -4, bend * 0.35);
    }
  },
};

export const sprite = humanSprite('houndmaster', 53, kit, pose({ fist: [6, 11], far: [3, 9], weapon: 0.9 }), CHOP, 4);
