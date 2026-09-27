/** #157: the Bannerman (commander): a sallet and a red brigandine, bearing a tall pole with a swallow-tailed red banner he waves to rally the horde. */
import { face, humanSprite, pose, tunic, type Kit } from '../human';

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'red', hand: 'leather',
  body(f, torso, p) {
    tunic(f, torso, p, 'red', 'black');
    for (const y of [-12, -8]) f.part(torso, [[-6, y], [6.4, y], [6.4, y + 1], [-6, y + 1]], 'darksteel', 3.4, { profile: 'flat', details: [[-3, y + 0.5, 'steel', 5], [0, y + 0.5, 'steel', 5], [3, y + 0.5, 'steel', 5]] }); // brigandine rivets
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-6.4, -2], [-4.8, -8], [-1.4, -11.2], [3, -10.8], [5.2, -7.6], [5.2, -6], [-2.6, -6], [-4, -2]], 'darksteel', 5.2); // sallet
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.8, -32], [0.8, -32], [0.8, 10], [-0.8, 10]], 'leather', p.zw); // pole
    f.part(grip, [[-1.6, -32], [1.6, -32], [0, -35]], 'darksteel', p.zw + 0.1); // finial
    // the banner hangs back from the pole's top and streams further with the sway and the wave
    const fl = grip.child(0, -31, 0), w = 1 + 0.5 * p.smear, s = p.sway;
    f.part(fl, [[0, 0], [-12 * w, 0.4 + s], [-10 * w, 6 + s], [-13 * w, 12 + s], [-6 * w, 10], [0, 13]], 'red', p.zw - 0.1, { profile: 'flat', folds: [0.6, 3, 0] });
    f.part(fl, [[-3, 3], [-7, 3], [-7, 5], [-3, 5]], 'black', p.zw - 0.05, { profile: 'flat' }); // a black bar across it
  },
};

// the pole stays in both hands at the chest (a raised banner would leave the cell); the rally: ready, dip back, sweep forward
// with the trail, the banner thrust out (held), recovery
export const sprite = humanSprite('bannerman', 53, kit, pose({ fist: [4, 9], far: [4, 6], weapon: 0.05 }), [
  [200, {}],
  [140, { hip: [-1, 0], lean: -0.1, fist: [2, 6], far: [2, 4], weapon: -0.35 }],
  [150, { hip: [-1, 0], lean: -0.14, fist: [1, 5], far: [1, 3], weapon: -0.5, sway: -1 }],
  [70, { hip: [1, 0], lean: 0.08, fist: [6, 5], far: [5, 3], weapon: 0.5, smear: 0.8, sway: 1, feet: [[-4, 0, 0], [6, 1, -0.1]] }],
  [220, { hip: [2, 1], lean: 0.14, fist: [8, 5], far: [6, 4], weapon: 0.95, smear: 1, sway: 2, feet: [[-5, 1, 0.2], [8, 0, 0]] }],
  [140, { hip: [1, 0], lean: 0.06, fist: [6, 7], far: [5, 5], weapon: 0.45, sway: 1 }],
], 4);
