/** #157: the Mirror Knight: blackened plate under a purple surcoat, a horned helm and his great round mirror shield, polished to a glare. */
import { CHOP, humanSprite, pose, trail, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'black', boots: 'black', sleeve: 'black', hand: 'black',
  body(f, torso, p) {
    f.part(torso, [[-6.8, -15.5], [6.8, -15.5], [7.6, -9], [7, -3], [-6.6, -3], [-7.4, -9]], 'black', 3);
    f.part(torso, [[-4.8, -14], [5.4, -14], [6.4, 5], [0.8, 5.6], [-5.6, 5]], 'purple', 3.2, { profile: 'flat', folds: [0.5, 3, 0] });
    f.part(torso, [[-6.8, -4.4], [7.2, -4.4], [7.2, -2.2], [-6.8, -2.2]], 'leather', 3.5);
    // the mirror: a wide bright disc in a black rim, held out in front
    const s = torso.child(5.5, -8 + 0.4 * p.sway, 0);
    f.part(s, ell(0, 0, 6.4, 10.6), 'white', 6.5, { trim: ['black', 1.2] });
    f.part(s, [[-3, -6], [-1.6, -6.6], [1.4, 2], [0, 2.6]], 'glow', 6.6, { profile: 'flat', outline: false }); // the glare
  },
  head(f, head) {
    f.part(head, [[-4.8, 2], [-5.2, -6], [-3.8, -10], [0.4, -11.4], [4.4, -10], [6.2, -6], [6.4, -2], [5.4, 1.6], [0, 2.6]], 'black', 5, { details: [3, 4, 5].map((x) => [x + 0.5, -5.5, 'purple', 5] as [number, number, 'purple', number]) });
    f.part(head, [[-2, -9.6], [-4, -13], [-6.6, -14], [-4.6, -11.4], [-3.6, -8.4]], 'white', 4.9); // horn
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 21);
    f.part(grip, [[-0.9, -2], [0.9, -2], [0.9, 3.5], [-0.9, 3.5]], 'leather', p.zw);
    f.part(grip, [[-3.8, -3], [3.8, -3], [4, -1.8], [-4, -1.8]], 'black', p.zw + 0.1);
    f.part(grip, [[-1.6, -2.8], [1.6, -2.8], [1.5, -18], [0, -21], [-1.5, -18]], 'steel', p.zw + 0.05);
  },
};

export const sprite = humanSprite('mirrorKnight', 56, kit, pose({ fist: [6, 11], far: [2, 10], weapon: 0.35 }), CHOP, 4);
