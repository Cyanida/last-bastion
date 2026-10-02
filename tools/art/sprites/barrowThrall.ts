/**
 * #275: the Barrow Thrall, the Barrowvale's peasant: a villager the barrows gave back. The Peasant's build (sprites/peasant.ts), a head
 * shorter than the Paladin, but his skin has gone the grey-green of the grave, his eyes burn a cold soul-blue, a mouldering shroud hangs
 * in rags over his tunic and his pitchfork is a rusted, broken-tined thing. He rises again where he fell unless you trample his corpse
 * (config/enemies.ts RISING). Rot, not pallor: the Necromancer's pale skin stays a champion's.
 */
import { humanSprite, pose, type Kit } from '../human';
import { Bone } from '../rig';

const kit: Kit = {
  legs: 'bark', boots: 'rot', sleeve: 'hide', hand: 'rot',
  body(f, torso, p) {
    f.part(torso, [[-6, -15], [5.8, -15], [6.8, -4], [7.4, 4], [-6.8, 4], [-6.6, -4]], 'hide', 3, { folds: [0.5, 3, 0] }); // grave-stained tunic
    // the shroud, torn into rags at the hem
    f.part(torso.child(0, 4, 0.05 * p.sway), [[-6.8, -0.5], [7.4, -0.5], [7.8, 5], [5, 3.4], [3, 6], [0.6, 3.6], [-2, 6.2], [-4.4, 3.6], [-7, 5.4]], 'stone', 3.1, { profile: 'flat', folds: [0.4, 2.6, 0] });
    f.part(torso, [[-6.8, -15.4], [-1.4, -15.4], [1.2, -6], [-1.6, 1], [-7, 0]], 'stone', 3.2, { folds: [0.4, 2.4, 0] }); // the shroud over his far shoulder
    f.part(torso, [[-6.8, -4.8], [7, -4.8], [7, -3], [-6.8, -3]], 'bark', 3.3); // a rotted cord
    f.part(torso, [[-2.6, -16.6], [3.4, -16.6], [3.6, -14.4], [-2.6, -14.4]], 'rot', 3.25); // neck
  },
  head(f, head) {
    // a sunken grey-green face with a soul-blue eye; lank hair, no hat
    f.part(head, [[-3.8, 0.4], [-4.2, -5], [-3, -8.6], [1, -9.4], [4.4, -7.4], [5.2, -4], [5.4, -2.2], [4.2, -1.4], [4, 0.6], [1.2, 1.6]], 'rot', 5, { details: [[3.2, -5, 'soul', 5], [3.8, -0.4, 'rot', 0]] });
    f.part(head, [[-4.4, -4], [-3.6, 0.6], [-1.8, 1], [-2, -5], [-1, -8.8], [2.6, -9.8], [-1.6, -10.2], [-4, -8.6]], 'bark', 5.1, { folds: [0.3, 2, 1] }); // lank hair
  },
  weapon(f, grip, p) {
    f.part(grip, [[-0.9, -24], [0.9, -24], [0.9, 12], [-0.9, 12]], 'bark', p.zw); // a rotten shaft
    f.part(grip, [[-3.8, -25.8], [3.8, -25.8], [3.2, -23.6], [-3.2, -23.6]], 'darksteel', p.zw + 0.1); // socket
    // rusted tines, the middle one broken off
    for (const [x, len] of [[-3.2, 7], [0, 3], [3.2, 6]]) f.part(grip, [[x - 0.8, -25], [x + 0.8, -25], [x + 0.6, -25 - len], [x, -26.5 - len], [x - 0.6, -25 - len]], 'leather', p.zw + 0.05);
    if (p.smear) {
      const w = new Bone(grip.x, grip.y, grip.a);
      for (const x of [-4.8, 4.8]) f.part(w, [[x - 0.7, -32], [x + 0.7, -32], [x + 0.3, -32 + 16 * p.smear], [x - 0.3, -32 + 16 * p.smear]], 'smear', p.zw - 0.3, { profile: 'flat', outline: false });
    }
  },
};

// stoops a little, the fork held low; the jab is the Peasant's
const rest = pose({ fist: [4, 12], far: [4, 8], weapon: 0.25, lean: 0.08 });
export const sprite = humanSprite('barrowThrall', 50, kit, rest, [
  [200, {}],
  [120, { hip: [-1, 0], lean: -0.12, fist: [-1, 8], far: [-1, 6], weapon: 1.2 }],
  [140, { hip: [-2, 0], lean: -0.18, fist: [-3, 7], far: [-2, 5], weapon: 1.35, feet: [[-5, 0, 0], [4, 0, 0]] }],
  [70, { hip: [1, 0], lean: 0.1, fist: [7, 5], far: [5, 3], weapon: 1.45, smear: 0.6, feet: [[-4, 0, 0], [6, 1.5, -0.1]] }],
  [170, { hip: [2, 1], lean: 0.2, fist: [11, 4], far: [9, 2], weapon: 1.5, smear: 1, feet: [[-5, 1, 0.3], [8, 0, 0]] }],
  [120, { hip: [1, 0], lean: 0.08, fist: [8, 7], far: [6, 5], weapon: 1, feet: [[-5, 0, 0], [7, 0, 0]] }],
], 4);
