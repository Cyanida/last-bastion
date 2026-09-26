/** #157: the Armored Knight: dark plate under a red surcoat, a bascinet with a red crest, a heater shield and an arming sword brought down overhead. */
import { humanSprite, pose, type Kit } from '../human';
import { ell, type Pt } from '../rig';

const arc = (t0: number, t1: number, r: number, n = 9): Pt[] => Array.from({ length: n }, (_, i) => {
  const t = t0 + ((t1 - t0) * i) / (n - 1);
  return [r * Math.sin(t), -r * Math.cos(t)];
});

const kit: Kit = {
  legs: 'darksteel', boots: 'darksteel', sleeve: 'darksteel', hand: 'darksteel',
  body(f, torso, p) {
    f.part(torso, [[-6.8, -15.5], [6.8, -15.5], [7.6, -9], [7, -3], [-6.6, -3], [-7.4, -9]], 'darksteel', 3); // breastplate
    f.part(torso, [[-4.8, -14], [5.4, -14], [6.4, 5], [0.8, 5.6], [-5.6, 5]], 'red', 3.2, { profile: 'flat', folds: [0.5, 3, 0] }); // surcoat
    f.part(torso, [[-6.8, -4.4], [7.2, -4.4], [7.2, -2.2], [-6.8, -2.2]], 'leather', 3.5); // sword belt
    f.part(torso, [[-4, -18.5], [4.6, -18.5], [5, -15], [-4.4, -15]], 'darksteel', 3.6); // gorget
    const shield = torso.child(-6.5, -7 + 0.5 * p.sway, -0.05);
    f.part(shield, [[-5.4, -7], [5.4, -7], [5.4, 0], [3, 5], [0, 7.4], [-3, 5], [-5.4, 0]], 'steel', 4.4, { trim: ['gold', 1] }); // heater shield
    f.part(shield, [[-0.9, -6], [0.9, -6], [0.9, 6], [-0.9, 6]], 'red', 4.5, { profile: 'flat' });
    f.part(shield, [[-4.4, -1.6], [4.4, -1.6], [4.4, 0.2], [-4.4, 0.2]], 'red', 4.5, { profile: 'flat' });
  },
  head(f, head, p) {
    const slits: [number, number, 'darksteel', number][] = [2, 3, 4].map((x) => [x + 0.5, -4.5, 'darksteel', 0]);
    f.part(head, [[-4.6, 1], [-5, -5], [-3.6, -9], [0, -11.4], [3.4, -9.4], [5.6, -5.4], [6.4, -2.4], [4.6, 0.6], [1.6, 1.8]], 'steel', 5, { details: slits }); // bascinet with its visor
    f.part(head, [[-4.6, 1], [4.6, 0.6], [5.2, 3], [-5, 3]], 'steel', 5.1, { mail: true }); // aventail
    f.part(head.child(-0.2, -11, -0.1 - 0.06 * p.sway), [[1, 0.8], [0.6, -2], [-2, -3.2], [-5.4, -2.6], [-7.4, 0], [-6.6, 2], [-4.6, 0.6], [-2, 0.6]], 'red', 4.9, { folds: [0.5, 2, 1] }); // crest
  },
  weapon(f, grip, p) {
    if (p.smear) {
      const t = -1.1 * p.smear;
      f.part(grip, [...arc(t, 0, 23), ...arc(0, t * 0.5, 17), ...arc(t * 0.5, t, 21, 5)], 'smear', p.zw - 0.3, { profile: 'flat', outline: false }); // physical: a pale steel trail
    }
    f.part(grip, [[-0.9, -2], [0.9, -2], [0.9, 3.5], [-0.9, 3.5]], 'leather', p.zw); // grip
    f.part(grip, ell(0, 4.3, 1.4, 1.3), 'darksteel', p.zw + 0.1); // pommel
    f.part(grip, [[-3.8, -3], [3.8, -3], [4, -1.8], [-4, -1.8]], 'darksteel', p.zw + 0.1); // crossguard
    f.part(grip, [[-1.6, -2.8], [1.6, -2.8], [1.5, -18], [0, -21], [-1.5, -18]], 'steel', p.zw + 0.05); // blade
  },
};

// sword low and ready; the blow: ready, raise, overhead, down with the trail, impact (held), recovery
const rest = pose({ fist: [6, 11], far: [2, 10], weapon: 0.35 });
export const sprite = humanSprite('knight', 56, kit, rest, [
  [250, {}],
  [110, { hip: [-1, 0], lean: -0.1, fist: [4, -7], weapon: -0.4, zw: 4.6 }],
  [130, { hip: [-1, -1], lean: -0.14, fist: [2, -11], weapon: -1, zw: 4.6 }],
  [60, { hip: [1, 0], lean: 0.06, fist: [10, -4], weapon: 0.9, smear: 0.8, feet: [[-4, 0, 0], [7, 1.5, -0.1]] }],
  [180, { hip: [2, 1], lean: 0.18, fist: [11, 5], weapon: 2, smear: 1, feet: [[-5, 1, 0.3], [9, 0, 0]] }],
  [130, { hip: [1, 0], lean: 0.08, fist: [9, 9], weapon: 1.4, feet: [[-5, 0, 0], [8, 0, 0]] }],
], 4);
