/** #157: the Shield Bearer: a kettle helm, a mail shirt over a wool tunic and a big round wooden shield held square in front, a short sword behind it. */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'darksteel', hand: 'leather',
  body(f, torso, p) {
    tunic(f, torso, p, 'wool', 'leather');
    f.part(torso, [[-6.4, -15], [6.2, -15], [7, -4], [-6.8, -4]], 'darksteel', 3.2, { mail: true }); // mail shirt
    // the round shield, boss and rim, in front of the body
    const s = torso.child(6.5, -7 + 0.4 * p.sway, 0);
    f.part(s, ell(0, 0, 5.2, 10.5), 'leather', 6.5, { trim: ['darksteel', 1], folds: [0.3, 2, 0] });
    f.part(s, ell(0.4, 0, 1.8, 2.4), 'darksteel', 6.6);
  },
  head(f, head) {
    face(f, head);
    f.part(head, ell(0.2, -7.2, 7, 1.5), 'darksteel', 5.2); // brim
    f.part(head, [[-4.4, -7.4], [-3.6, -10.6], [0.2, -11.8], [3.8, -10.6], [4.6, -7.4]], 'darksteel', 5.3); // bowl
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 14);
    f.part(grip, [[-0.8, -1.6], [0.8, -1.6], [0.8, 3], [-0.8, 3]], 'leather', p.zw);
    f.part(grip, [[-3, -2.6], [3, -2.6], [3, -1.6], [-3, -1.6]], 'darksteel', p.zw + 0.1);
    f.part(grip, [[-1.4, -2.4], [1.4, -2.4], [1.2, -12], [0, -14], [-1.2, -12]], 'steel', p.zw + 0.05);
  },
};

export const sprite = humanSprite('shieldBearer', 52, kit, pose({ fist: [5, 11], far: [4, 8], weapon: 0.4 }), CHOP, 4);
