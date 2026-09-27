/** #157: the Plague Doctor: a long black coat, a wide hat, the white beak mask with glass eyes, and a flask he hurls in a green trail. */
import { face, humanSprite, pose, RAISE, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'coal', boots: 'leather', sleeve: 'coal', hand: 'leather',
  body(f, torso, p) {
    tunic(f, torso, p, 'coal', 'leather', true);
    f.part(torso, [[-5.6, -4.6], [-3.4, -4.6], [-3.2, -0.6], [-5.8, -0.6]], 'poison', 3.45); // a vial at the belt
  },
  head(f, head, p) {
    face(f, head, 'white', false);
    f.part(head, [[3.6, -6], [5.4, -6], [12, -1.4], [11.6, -0.4], [4.4, -1.6]], 'white', 5.1); // beak
    f.part(head, ell(3, -5.2, 1.4, 1.3), 'poison', 5.15); // glass eye
    f.part(head.child(0, -8, 0.05 * p.sway), ell(0.4, 0, 8.4, 1.8), 'coal', 5.3); // brim
    f.part(head, [[-3.8, -8.6], [-3.4, -12.8], [3.6, -13], [4.2, -8.6]], 'coal', 5.35); // crown
    f.part(head, [[-3.8, -9.8], [4.1, -9.8], [4.1, -8.8], [-3.8, -8.8]], 'leather', 5.4); // band
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 8, 'poison');
    f.part(grip, ell(0, -2.6, 2.6, 2.8), 'poison', p.zw); // the flask
    f.part(grip, [[-0.8, -7], [0.8, -7], [0.8, -5], [-0.8, -5]], 'white', p.zw + 0.05); // neck
  },
};

export const sprite = humanSprite('plagueDoctor', 54, kit, pose({ fist: [6, 8], far: [3, 9], weapon: 0 }), RAISE, 4);
