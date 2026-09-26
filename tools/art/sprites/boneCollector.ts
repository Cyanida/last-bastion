/** #157: the Bone Collector: a hunched, pale ghoul in rags under a sack bristling with bones, swinging a thighbone club. */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';
import { ell } from '../rig';

const kit: Kit = {
  legs: 'wool', boots: 'wool', sleeve: 'wool', hand: 'white',
  back(f, torso, p) {
    const s = torso.child(-7, -10 + 0.5 * p.sway, -0.2);
    for (const [x, a] of [[-3, -0.4], [1, 0.2], [3.6, 0.5]] as const) f.part(s.child(x, -7, a), [[-0.8, 0], [0.8, 0], [0.8, -7], [-0.8, -7]], 'white', 0.1); // bones jutting out
    f.part(s, ell(0, 0, 6.4, 8.4), 'leather', 0.2, { folds: [0.5, 2.4, 0] }); // the sack
  },
  body(f, torso, p) {
    tunic(f, torso, p, 'wool', 'leather');
    f.part(torso, [[-4, -10], [4, -10], [4, -7], [-4, -7]], 'white', 3.4, { details: [[-2, -8.5, 'white', 1], [2, -8.5, 'white', 1]] }); // a necklace of teeth
  },
  head(f, head) {
    face(f, head, 'white', false);
    f.part(head, ell(2.8, -5, 1.2, 1.2), 'coal', 5.1, { details: [[2.8, -5, 'green', 5]] }); // a sunken, sickly eye
    f.part(head, [[-4.4, -4], [-4.6, -8.4], [-2.6, -10.2], [0.6, -9.8], [-1.6, -7], [-2, -3]], 'coal', 5.1); // lank hair
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 14);
    f.part(grip, [[-1, -12], [1, -12], [1, 3], [-1, 3]], 'white', p.zw); // thighbone
    f.part(grip, ell(-1, -13, 2, 1.8), 'white', p.zw + 0.05);
    f.part(grip, ell(1.2, -13.4, 1.8, 1.8), 'white', p.zw + 0.05);
  },
};

// hunched: he leans forward even at rest
export const sprite = humanSprite('boneCollector', 50, kit, pose({ lean: 0.25, head: -0.1, fist: [6, 12], far: [4, 12], weapon: 0.6 }), CHOP, 4);
