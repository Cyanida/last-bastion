/**
 * #214: the Thorn Bearer, the Iron Hold's shield bearer. The same kettle helm and mail as the Shield Bearer (sprites/shieldBearer.ts), but
 * his round shield is faced with blackened iron and bristles with steel spikes round its rim and from its boss: the thorns that bite
 * back at whoever strikes him up close. A spiked crest on the helm, a rust-red tunic, and no gold, so he never reads as the Paladin.
 */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';
import { ell, type Pt } from '../rig';

/** A spike on the shield's rim at angle `a` (0 = straight ahead), its base `w` wide, `len` long. */
function spike(rx: number, ry: number, a: number, len: number, w = 1.4): Pt[] {
  const cx = Math.cos(a), cy = Math.sin(a);
  const bx = rx * cx, by = ry * cy; // on the rim
  const nx = cx / rx, ny = cy / ry, n = Math.hypot(nx, ny); // the rim's outward normal
  const ox = nx / n, oy = ny / n;
  return [[bx - oy * w, by + ox * w], [bx + ox * len, by + oy * len], [bx + oy * w, by - ox * w]];
}

const kit: Kit = {
  legs: 'wool', boots: 'leather', sleeve: 'darksteel', hand: 'leather',
  body(f, torso, p) {
    tunic(f, torso, p, 'red', 'leather');
    f.part(torso, [[-6.4, -15], [6.2, -15], [7, -4], [-6.8, -4]], 'darksteel', 3.2, { mail: true }); // mail shirt
    // the round shield faced with blackened iron, its rim bristling with spikes and a long one from the boss
    const s = torso.child(6.5, -7 + 0.4 * p.sway, 0);
    for (const a of [-1.45, -0.85, -0.3, 0.3, 0.85, 1.45]) f.part(s, spike(5.2, 10.5, a, 4, 1.7), 'steel', 6.4);
    f.part(s, ell(0, 0, 5.2, 10.5), 'black', 6.5, { trim: ['steel', 1], details: [[0.6, -6.5, 'steel', 6], [0.6, 6.5, 'steel', 6]] });
    f.part(s, ell(0.4, 0, 1.8, 2.4), 'darksteel', 6.6);
    f.part(s, [[1.6, -1.4], [7.4, 0], [1.6, 1.4]], 'steel', 6.7, { profile: 'flat' }); // the boss spike
  },
  head(f, head) {
    face(f, head);
    f.part(head, ell(0.2, -7.2, 7, 1.5), 'darksteel', 5.2); // brim
    f.part(head, [[-4.4, -7.4], [-3.6, -10.6], [0.2, -11.8], [3.8, -10.6], [4.6, -7.4]], 'darksteel', 5.3); // bowl
    f.part(head, [[-0.8, -11.4], [0.2, -14.6], [1.2, -11.4]], 'steel', 5.35, { profile: 'flat' }); // the spike on the crown
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 14);
    f.part(grip, [[-0.8, -1.6], [0.8, -1.6], [0.8, 3], [-0.8, 3]], 'leather', p.zw);
    f.part(grip, [[-3, -2.6], [3, -2.6], [3, -1.6], [-3, -1.6]], 'darksteel', p.zw + 0.1);
    f.part(grip, [[-1.4, -2.4], [1.4, -2.4], [1.2, -12], [0, -14], [-1.2, -12]], 'steel', p.zw + 0.05);
  },
};

export const sprite = humanSprite('thornBearer', 52, kit, pose({ fist: [5, 11], far: [4, 8], weapon: 0.4 }), CHOP, 4);
