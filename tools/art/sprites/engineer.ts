/** #157: the Siege Engineer: a leather apron over wool, a padded cap with goggles, tools at his belt and a heavy hammer. */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'wool', hand: 'leather',
  back(f, torso) {
    f.part(torso.child(-6, -9, -0.2), [[-2.4, -5], [2.4, -5], [2.4, 7], [-2.4, 7]], 'straw', 0.2, { folds: [0.4, 2, 1] }); // a coil of rope
  },
  body(f, torso, p) {
    tunic(f, torso, p, 'wool', 'leather');
    f.part(torso, [[-1.6, -12], [6.6, -12], [7.6, 6], [-1, 6]], 'leather', 3.4, { profile: 'flat' }); // apron
    f.part(torso, [[-5.6, -4.6], [-3.6, -4.6], [-3.6, 1], [-5.6, 1]], 'darksteel', 3.45); // a wrench at the belt
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-4.6, -4], [-4.6, -8.6], [-1.6, -11], [2.6, -10.8], [4.8, -8.4], [4.8, -6.8], [-3.6, -6.6], [-4, -3]], 'leather', 5.2); // padded cap
    f.part(head, [[-4.4, -8], [4.8, -8], [4.8, -6.8], [-4.4, -6.8]], 'darksteel', 5.3); // goggle strap
    f.part(head, ell(3.6, -8.6, 1.5, 1.3), 'steel', 5.35);
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 16);
    f.part(grip, [[-0.9, -13], [0.9, -13], [0.9, 4], [-0.9, 4]], 'leather', p.zw);
    f.part(grip, [[-4, -17], [4, -17], [4, -12.6], [-4, -12.6]], 'darksteel', p.zw + 0.1); // hammer head
  },
};

export const sprite = humanSprite('engineer', 51, kit, pose({ fist: [6, 11], far: [3, 9], weapon: 0.3 }), CHOP, 4);
