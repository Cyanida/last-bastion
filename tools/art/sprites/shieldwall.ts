/** #157: the Shieldwall Spearman: a nasal helm, a red tunic, a tall red and black tower shield in front and a long spear thrust over it, leaving a straight streak. */
import { face, humanSprite, pose, THRUST, tunic, type Kit } from '../human';

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'darksteel', hand: 'leather',
  body(f, torso, p) {
    tunic(f, torso, p, 'red', 'leather');
    const s = torso.child(6.5, -4 + 0.4 * p.sway, 0);
    f.part(s, [[-4.6, -14], [4.6, -14], [4.8, 13], [-4.8, 13]], 'red', 6.5, { trim: ['black', 1.2] }); // tower shield
    f.part(s, [[-0.8, -12.6], [0.8, -12.6], [0.8, 11.6], [-0.8, 11.6]], 'black', 6.6, { profile: 'flat' });
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-4.6, -3], [-4.8, -7.4], [-2.4, -11], [1.6, -11.6], [4.8, -8.4], [5, -6.4], [-3, -6.4], [-3.4, -3]], 'steel', 5.2); // helm
    f.part(head, [[3.4, -6.8], [4.6, -6.8], [4.8, -2.8], [3.8, -2.8]], 'steel', 5.3); // nasal
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.8, -30], [0.8, -30], [0.8, 14], [-0.8, 14]], 'leather', p.zw); // shaft
    f.part(grip, [[-1.8, -30], [1.8, -30], [1.4, -36], [0, -39], [-1.4, -36]], 'steel', p.zw + 0.05); // leaf blade
    if (p.smear) f.part(grip, [[-1.2, -39], [1.2, -39], [0.6, -39 + 20 * p.smear], [-0.6, -39 + 20 * p.smear]], 'smear', p.zw - 0.3, { profile: 'flat', outline: false });
  },
};

export const sprite = humanSprite('shieldwall', 53, kit, pose({ fist: [4, 11], far: [4, 7], weapon: 0.15 }), THRUST, 4);
