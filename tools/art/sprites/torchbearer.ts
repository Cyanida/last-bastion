/**
 * #225: the Torchbearer, the Cinderlands' peasant. The same build as the Peasant (sprites/peasant.ts), a head shorter than the Paladin,
 * but he has traded the pitchfork for a pitch-soaked torch that burns upright whichever way he swings it, and his clothes show the forge
 * country: a soot-dark hood, a scorched leather apron over his wool tunic. His blows set you alight (config/damage.ts ENEMY_STATUS).
 */
import { CHOP, face, humanSprite, pose, trail, type Kit } from '../human';
import { Bone, ell } from '../rig';

const kit: Kit = {
  legs: 'leather', boots: 'wool', sleeve: 'wool', hand: 'skin',
  body(f, torso, p) {
    f.part(torso, [[-6, -15], [5.8, -15], [6.8, -4], [7.4, 4], [-6.8, 4], [-6.6, -4]], 'wool', 3, { folds: [0.5, 3, 0] }); // tunic
    f.part(torso.child(0, 4, 0.04 * p.sway), [[-6.8, -0.5], [7.4, -0.5], [7.8, 4], [2, 4.6], [-7, 4.2]], 'wool', 3.1, { profile: 'flat', folds: [0.4, 2.6, 0] }); // hem
    // the scorched leather apron, singed dark at the hem
    f.part(torso, [[-1.5, -13], [5.6, -13], [7.2, 5.5], [0.5, 6]], 'leather', 3.2, { folds: [0.4, 2.4, 0], trim: ['coal', 1] });
    f.part(torso, [[-6.8, -4.8], [7, -4.8], [7, -3], [-6.8, -3]], 'coal', 3.3); // cord belt
  },
  head(f, head) {
    face(f, head);
    // a soot-dark hood drawn over the head, the face left open
    f.part(head, [[-5.2, 1.6], [-5.6, -5], [-4, -10], [0.6, -11.4], [4.4, -9.6], [5.6, -7], [2.6, -6.8], [1.4, -4], [0.6, 1.8]], 'coal', 5.3, { folds: [0.3, 2, 1] });
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 22, 'fire');
    f.part(grip, [[-1, -18], [1, -18], [0.9, 8], [-0.9, 8]], 'leather', p.zw); // the haft
    f.part(grip, [[-2.4, -24], [2.4, -24], [2.2, -17], [-2.2, -17]], 'coal', p.zw + 0.1, { folds: [0.5, 1.5, 1] }); // pitch-soaked rags
    // the flame burns upward whatever the swing: a bone at the torch head that keeps the world's up
    const [hx, hy] = grip.at(0, -24);
    const flick = 0.8 * Math.sin(p.sway * 3);
    const fl = new Bone(hx, hy, 0);
    f.part(fl, [[-3.6, 1], [-3.2, -4], [-1 + flick, -9], [0.4 + flick, -13], [1.6, -8], [3.4, -4.4], [3.6, 1]], 'fire', p.zw + 0.2);
    f.part(fl, [[-1.8, 0.6], [-1.2, -3.4], [0.2 + flick * 0.5, -7], [1.4, -3.4], [1.8, 0.6]], 'glow', p.zw + 0.25, { profile: 'flat', outline: false });
    f.part(fl, ell(0, 0.4, 2.8, 1.4), 'ember', p.zw + 0.22, { profile: 'flat', outline: false }); // the glowing rim of the rags
  },
};

// holds the torch up by his side; the blow: the shared overhead chop, with a trail of fire
export const sprite = humanSprite('torchbearer', 50, kit, pose({ fist: [4, 10], far: [4, 7], weapon: 0.1 }), CHOP, 4);
