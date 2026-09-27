/** #157: the Peasant: straw hat, wool tunic with a rope belt, a pitchfork he jabs forward. A head shorter than the Paladin. */
import { humanSprite, pose, type Kit } from '../human';
import { Bone, ell } from '../rig';

const kit: Kit = {
  legs: 'leather', boots: 'wool', sleeve: 'wool', hand: 'skin',
  body(f, torso, p) {
    f.part(torso, [[-6, -15], [5.8, -15], [6.8, -4], [7.4, 4], [-6.8, 4], [-6.6, -4]], 'wool', 3, { folds: [0.5, 3, 0] }); // tunic
    f.part(torso.child(0, 4, 0.04 * p.sway), [[-6.8, -0.5], [7.4, -0.5], [7.8, 4], [2, 4.6], [-7, 4.2]], 'wool', 3.1, { profile: 'flat', folds: [0.4, 2.6, 0] }); // hem
    f.part(torso, [[-6.8, -4.8], [7, -4.8], [7, -3], [-6.8, -3]], 'straw', 3.3); // rope belt
    f.part(torso, [[-2.6, -16.6], [3.4, -16.6], [3.6, -14.4], [-2.6, -14.4]], 'skin', 3.2); // neck
  },
  head(f, head, p) {
    const eye: [number, number, 'skin', number][] = [[3.2, -5, 'skin', 0]];
    f.part(head, [[-3.8, 0.4], [-4.2, -5], [-3, -8.6], [1, -9.4], [4.4, -7.4], [5.2, -4], [5.6, -2.2], [4.4, -1.4], [4.4, 0.6], [1.2, 1.6]], 'skin', 5, { details: eye }); // face
    f.part(head, [[-4.2, -4.6], [-3.4, -1], [-1.6, 0.4], [-1.8, -5]], 'wool', 5.05, { dim: 1 }); // hair at the nape
    f.part(head.child(0, -7.5, 0.05 * p.sway), ell(0.3, 0, 7.8, 1.9), 'straw', 5.2, { folds: [0.4, 2, 0] }); // brim
    f.part(head, [[-3.8, -7.6], [-2.8, -11.4], [2.8, -11.8], [4.6, -7.6]], 'straw', 5.3, { folds: [0.3, 2, 1] }); // crown
    f.part(head, [[-3.8, -8.6], [4.5, -8.6], [4.6, -7.6], [-3.9, -7.6]], 'leather', 5.35); // band
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.9, -24], [0.9, -24], [0.9, 12], [-0.9, 12]], 'leather', p.zw); // shaft
    f.part(grip, [[-3.8, -25.8], [3.8, -25.8], [3.2, -23.6], [-3.2, -23.6]], 'darksteel', p.zw + 0.1); // socket
    for (const x of [-3.2, 0, 3.2]) f.part(grip, [[x - 0.8, -25], [x + 0.8, -25], [x + 0.6, -32], [x, -33.5], [x - 0.6, -32]], 'steel', p.zw + 0.05); // tines
    if (p.smear) {
      // physical: pale steel streaks trailing the tines
      const w = new Bone(grip.x, grip.y, grip.a);
      for (const x of [-4.8, 4.8]) f.part(w, [[x - 0.7, -33], [x + 0.7, -33], [x + 0.3, -33 + 16 * p.smear], [x - 0.3, -33 + 16 * p.smear]], 'smear', p.zw - 0.3, { profile: 'flat', outline: false });
    }
  },
};

// holds the fork upright; the jab: ready, draw back, lunge with the trail, impact (held), recovery
const rest = pose({ fist: [4, 11], far: [4, 7], weapon: 0.15 });
export const sprite = humanSprite('peasant', 50, kit, rest, [
  [200, {}],
  [120, { hip: [-1, 0], lean: -0.12, fist: [-1, 8], far: [-1, 6], weapon: 1.2 }],
  [140, { hip: [-2, 0], lean: -0.18, fist: [-3, 7], far: [-2, 5], weapon: 1.35, feet: [[-5, 0, 0], [4, 0, 0]] }],
  [70, { hip: [1, 0], lean: 0.1, fist: [7, 5], far: [5, 3], weapon: 1.45, smear: 0.6, feet: [[-4, 0, 0], [6, 1.5, -0.1]] }],
  [170, { hip: [2, 1], lean: 0.2, fist: [11, 4], far: [9, 2], weapon: 1.5, smear: 1, feet: [[-5, 1, 0.3], [8, 0, 0]] }],
  [120, { hip: [1, 0], lean: 0.08, fist: [8, 7], far: [6, 5], weapon: 1, feet: [[-5, 0, 0], [7, 0, 0]] }],
], 4);
