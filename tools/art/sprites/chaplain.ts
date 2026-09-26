/** #157: the Chaplain (commander): a black cassock and a white cowl, swinging a smoking brass censer on a chain; his blessing heals the horde green. */
import { face, humanSprite, pose, RAISE, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'coal', boots: 'leather', sleeve: 'coal', hand: 'skin',
  body(f, torso, p) {
    tunic(f, torso, p, 'coal', 'red', true);
    f.part(torso, [[-6.8, -17], [6.8, -17], [7.6, -11], [-7.4, -11]], 'white', 3.6, { folds: [0.4, 2.4, 0] }); // cowl
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-4.4, -4], [-4.6, -8.4], [-2.4, -10.2], [1.6, -10.2], [-1.2, -7.4], [-1.8, -3]], 'white', 5.1, { dim: 2 }); // grey hair
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 14, 'poison');
    // the chain hangs from the fist, the censer swings at its end
    const c = grip.child(0, 0, -grip.a + 0.3 * p.sway - 0.6 * p.smear);
    f.part(c, [[-0.4, 0], [0.4, 0], [0.4, 9], [-0.4, 9]], 'gold', p.zw, { profile: 'flat' });
    f.part(c, ell(0, 11.6, 2.8, 3), 'gold', p.zw + 0.05, { details: [[-1, 11.6, 'gold', 1], [1, 11.6, 'gold', 1]] });
    f.part(c, ell(0.6, 6.6, 1.4, 1.4), 'white', p.zw + 0.1, { dim: 2, outline: false }); // smoke
  },
};

export const sprite = humanSprite('chaplain', 53, kit, pose({ fist: [6, 8], far: [3, 9], weapon: 0 }), RAISE, 4);
