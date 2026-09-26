/** #157: the War Drummer (commander): a feathered cap, a red and black tunic and a big war drum slung at his belly, beaten with two sticks. */
import { face, humanSprite, pose, RAISE, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'black', boots: 'leather', sleeve: 'red', hand: 'skin',
  body(f, torso, p) {
    tunic(f, torso, p, 'red', 'leather');
    f.part(torso, [[-6, -15], [0, -15], [0, 4], [-6.8, 4]], 'coal', 3.2, { profile: 'flat' }); // parti-coloured
    // the drum hangs in front: shell, a white head facing the viewer, cords
    const d = torso.child(5, -1 + 0.3 * p.sway, 0);
    f.part(d, [[-4.5, -6], [4.5, -6], [4.5, 6], [-4.5, 6]], 'red', 6.4, { trim: ['gold', 0.8] });
    f.part(d, ell(4.4, 0, 1.6, 6), 'white', 6.45);
    for (const y of [-3, 3]) f.part(d, [[-4, y - 3], [-3, y - 3], [3, y + 3], [2, y + 3]], 'white', 6.5, { profile: 'flat', dim: 1 }); // cords
  },
  head(f, head, p) {
    face(f, head);
    f.part(head, [[-4.6, -5.6], [-4.2, -9.6], [0.4, -11.2], [4.6, -9], [4.8, -6.8], [-4, -6.2]], 'coal', 5.2); // cap
    f.part(head.child(-3, -10, -0.3 - 0.1 * p.sway), [[0, 0], [-1.4, -8], [0.6, -8.6], [1.2, -1]], 'red', 5.1, { folds: [0.4, 1.6, 1] }); // feather
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.6, -9], [0.6, -9], [0.6, 2], [-0.6, 2]], 'leather', p.zw); // stick
    f.part(grip, ell(0, -9.6, 1.3, 1.3), 'white', p.zw + 0.05);
  },
};

// sticks over the drum; the beat: raise high, bring down, strike (the commander's call), lift
export const sprite = humanSprite('drummer', 52, kit, pose({ fist: [8, 6], far: [7, 5], weapon: 1.2 }), RAISE, 4);
