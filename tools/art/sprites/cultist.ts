/** #157: the Cultist: a ragged purple robe and a deep hood with a shadowed face, running in with a sputtering powder bomb held high. */
import { face, humanSprite, pose, RAISE, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'coal', boots: 'leather', sleeve: 'purple', hand: 'skin',
  body(f, torso, p) {
    tunic(f, torso, p, 'purple', 'coal', true);
  },
  head(f, head) {
    face(f, head, 'skin', false);
    f.part(head, [[-5.4, 3], [-5.8, -5], [-3.6, -10.4], [1.4, -11.4], [5.4, -8.2], [6.6, -3], [5.2, -3.4], [4.2, -7], [0.6, -7.6], [0.4, 0], [1.6, 3.4]], 'purple', 5.2, { folds: [0.4, 2.4, 1] }); // hood
    f.part(head, [[1.6, -7], [4.2, -6.6], [5, -3.2], [2, -1.6]], 'coal', 5.1, { profile: 'flat', details: [[3.4, -4.6, 'red', 4]] }); // the dark in the hood, one red eye
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 8, 'fire');
    f.part(grip, ell(0, -3.4, 3.4, 3.4), 'coal', p.zw); // the bomb
    f.part(grip, [[-0.5, -6.6], [0.5, -6.6], [1, -9], [0, -9]], 'leather', p.zw + 0.05, { profile: 'flat' }); // fuse
    f.part(grip, ell(0.6, -10, 1.3 + 0.3 * Math.abs(p.sway), 1.3), 'fire', p.zw + 0.1, { outline: false }); // spark
  },
};

// bomb held at the chest; the throw: ready, raise, overhead, hurl with a fiery trail, release (held), lower
export const sprite = humanSprite('cultist', 50, kit, pose({ fist: [6, 5], far: [5, 7], weapon: 0 }), RAISE, 4);
