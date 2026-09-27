/** #157: the Crossbowman: green padded gambeson, kettle hat over a wool coif, a bolt quiver on his back, a crossbow he levels and looses. */
import { humanSprite, pose, type Kit } from '../human';
import { Bone, ell } from '../rig';

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'green', hand: 'skin',
  back(f, torso) {
    const q = torso.child(-6, -13, -0.35);
    f.part(q, [[-2.2, -2], [2.2, -2], [2, 13], [-2, 13]], 'leather', 0.2); // quiver
    for (const x of [-1.2, 0.4]) f.part(q, [[x - 0.6, -5], [x + 0.6, -5], [x + 0.6, -2], [x - 0.6, -2]], 'white', 0.1, { profile: 'flat' }); // fletching
  },
  body(f, torso, p) {
    f.part(torso, [[-6.2, -15], [6, -15], [7, -4], [7.4, 4], [-6.8, 4], [-6.8, -4]], 'green', 3, { folds: [0.6, 2.4, 1] }); // quilted gambeson
    f.part(torso.child(0, 4, 0.04 * p.sway), [[-6.8, -0.5], [7.4, -0.5], [7.6, 3.5], [-7, 3.8]], 'green', 3.1, { profile: 'flat', folds: [0.4, 2.4, 0] });
    f.part(torso, [[-6.9, -4.8], [7.1, -4.8], [7.1, -2.6], [-6.9, -2.6]], 'leather', 3.3); // belt
    f.part(torso, [[2, -4.9], [4, -4.9], [4, -2.5], [2, -2.5]], 'steel', 3.35); // buckle
    f.part(torso, [[-5.2, -16.8], [5.6, -16.8], [6, -14], [-5.6, -14]], 'wool', 3.4); // coif's collar
  },
  head(f, head) {
    f.part(head, [[-4.2, 0.6], [-4.6, -5], [-3, -8.6], [1, -9], [4.4, -7], [5.2, -4], [5.6, -2.2], [4.4, -1.4], [4.4, 0.6], [1.2, 1.6]], 'skin', 5, { details: [[3.2, -5, 'skin', 0]] }); // face
    f.part(head, [[-4.8, 1.8], [-5.2, -5], [-3.4, -8.4], [-0.6, -8.4], [-0.4, -6], [-1.2, -2.4], [-1.6, 1.8]], 'wool', 5.05); // coif
    f.part(head, ell(0.2, -7.2, 7.4, 1.6), 'steel', 5.2); // the kettle hat's brim
    f.part(head, [[-4.4, -7.4], [-3.6, -10.6], [0.2, -11.8], [3.8, -10.6], [4.6, -7.4]], 'steel', 5.3); // bowl
  },
  weapon(f, grip, p) {
    // the stock runs forward along local -y from the grip; the prod sits across its tip
    f.part(grip, [[-1.3, -13], [1.3, -13], [1.6, 5], [-1.6, 5]], 'leather', p.zw); // stock
    f.part(grip, [[-8, -10], [-4, -12.4], [4, -12.4], [8, -10], [8, -8.8], [4, -11.2], [-4, -11.2], [-8, -8.8]], 'darksteel', p.zw + 0.1); // prod
    for (const x of [-1, 1]) f.part(grip, [[7.6 * x, -9.6], [7.6 * x, -8.4], [0, -2.4], [0, -3.6]], 'white', p.zw - 0.05, { profile: 'flat', outline: false }); // string, drawn back to the nut
    if (p.smear < 1) f.part(grip, [[-0.6, -16], [0.6, -16], [0.6, -3], [-0.6, -3]], 'steel', p.zw + 0.2); // the bolt, until loosed
    if (p.smear) {
      // loosed: the bolt streaks away in pale steel
      const w = new Bone(grip.x, grip.y, grip.a);
      f.part(w, [[-0.8, -44], [0.8, -44], [0.5, -18], [-0.5, -18]], 'smear', p.zw + 0.2, { profile: 'flat', outline: false });
      f.part(w, [[-0.8, -46], [0.8, -46], [0.8, -42], [-0.8, -42]], 'steel', p.zw + 0.3);
    }
  },
};

// carries it low; the shot: ready, raise, aim (held), loose with the streak, recoil, lower
const rest = pose({ fist: [4, 10], far: [8, 8], weapon: 0.9 });
export const sprite = humanSprite('crossbow', 51, kit, rest, [
  [150, {}],
  [120, { fist: [6, 4], far: [10, 3], weapon: 1.35 }],
  [200, { hip: [-1, 0], lean: -0.05, head: 0.1, fist: [6, 1], far: [11, 0], weapon: 1.55, feet: [[-5, 0, 0], [5, 0, 0]] }],
  [150, { hip: [-2, 0], lean: -0.1, head: 0.05, fist: [4, 0], far: [9, -1], weapon: 1.45, smear: 1, feet: [[-5, 0, 0], [5, 0, 0]] }],
  [120, { hip: [-1, 0], lean: -0.06, fist: [5, 3], far: [9, 2], weapon: 1.35, smear: 0 }],
  [120, { fist: [5, 7], far: [9, 6], weapon: 1.1 }],
], 3);
