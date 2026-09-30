/**
 * #213: the Iron Shieldwall, the Iron Hold's shieldwall. A tall tower shield of blackened iron with a bright riveted rim, a ridge and a boss,
 * held square in front; a closed iron helm with an eye slit, a wool surcoat over mail and a blackened coat, and the long spear thrust over the shield.
 * Heavier and darker than the plain spearman's red pavise (sprites/shieldwall.ts), so the two never read alike.
 */
import { face, humanSprite, pose, THRUST, type Kit } from '../human';
import { ell } from '../rig';

const rim: [number, number, 'steel', number][] = [[-3.6, -13.4], [3.6, -13.4], [-3.8, 0], [3.8, 0], [-3.8, 12], [3.8, 12]].map(([x, y]) => [x, y, 'steel', 6]);

const kit: Kit = {
  legs: 'coal', boots: 'darksteel', sleeve: 'darksteel', hand: 'darksteel',
  body(f, torso, p) {
    f.part(torso, [[-6.4, -15.5], [6.4, -15.5], [7.2, -4], [7.6, 4], [-7, 4], [-6.8, -4]], 'darksteel', 3, { mail: true }); // mail shirt
    f.part(torso, [[-4.6, -14.6], [4.8, -14.6], [5.6, 5.6], [-5, 5.6]], 'wool', 3.3, { profile: 'flat', folds: [0.4, 2.4, 0], trim: ['leather', 0.8] }); // a surcoat of undyed wool, so the iron shield stands out on him
    f.part(torso, [[-6.9, -4.6], [7.1, -4.6], [7.1, -2.6], [-6.9, -2.6]], 'leather', 3.5); // belt
    f.part(torso, [[-6.8, 3.4], [7.4, 3.4], [7.8, 6.4], [-7.2, 6.4]], 'coal', 3.2, { profile: 'flat', folds: [0.4, 2.6, 0] }); // the coat below the mail
    // the tower shield: taller and broader than the plain pavise, square in front of him
    const s = torso.child(6.8, -4 + 0.4 * p.sway, 0);
    f.part(s, [[-6, -15.4], [6, -15.4], [6.4, 13.6], [0, 15.8], [-6.4, 13.6]], 'black', 6.5, { trim: ['steel', 1.4], details: rim });
    f.part(s, [[-0.7, -14], [0.7, -14], [0.7, 14], [-0.7, 14]], 'steel', 6.6, { profile: 'flat' }); // the ridge
    f.part(s, ell(0, -0.6, 2.4, 2.8), 'steel', 6.7); // boss
  },
  head(f, head) {
    face(f, head);
    // a closed iron helm: flat top, a dark eye slit, breaths below
    const slit: [number, number, 'coal', number][] = [1, 2, 3, 4].map((x) => [x + 0.5, -5.6, 'coal', 0]);
    f.part(head, [[-4.8, 2], [-5.2, -8.6], [-4, -11.4], [3.6, -11.4], [5, -9], [5.4, 1.6], [0, 2.8]], 'steel', 5.2, { trim: ['darksteel', 0.7], details: [...slit, [3.5, -2.4, 'coal', 0], [3.5, -1.2, 'coal', 0]] });
    f.part(head, [[-5.2, 1], [5, 1], [5.4, 3.4], [-5.6, 3.4]], 'darksteel', 5.1, { mail: true }); // the aventail
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.8, -30], [0.8, -30], [0.8, 14], [-0.8, 14]], 'leather', p.zw); // shaft
    f.part(grip, [[-1.2, -30.6], [1.2, -30.6], [1.2, -28.6], [-1.2, -28.6]], 'darksteel', p.zw + 0.04); // socket
    f.part(grip, [[-1.8, -30], [1.8, -30], [1.4, -36], [0, -39.5], [-1.4, -36]], 'steel', p.zw + 0.05); // leaf blade
    if (p.smear) f.part(grip, [[-1.2, -39], [1.2, -39], [0.6, -39 + 20 * p.smear], [-0.6, -39 + 20 * p.smear]], 'smear', p.zw - 0.3, { profile: 'flat', outline: false });
  },
};

export const sprite = humanSprite('ironShieldwall', 55, kit, pose({ fist: [4, 11], far: [4, 7], weapon: 0.15 }), THRUST, 4);
