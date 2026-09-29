/**
 * #212: the Iron Knight, the Iron Hold's knight. Heavy dark-iron plate with bright riveted edges, a round pauldron, a pointed visor and
 * a war hammer brought down overhead. His plates break under blows: `bare` draws the same man once they are gone (sprites/ironKnightBare.ts),
 * in a mail shirt over a padded coat, his face in a mail coif. No gold and no white, so he never reads as the Paladin.
 */
import { CHOP, face, humanSprite, trail, type Kit } from '../human';
import type { Pt } from '../rig';

const rivets = (pts: Pt[]): [number, number, 'steel', number][] => pts.map(([x, y]) => [x, y, 'steel', 6]);

export function ironKnightKit(bare: boolean): Kit {
  return {
    legs: bare ? 'leather' : 'darksteel', boots: 'darksteel', sleeve: bare ? 'darksteel' : 'darksteel', hand: bare ? 'leather' : 'darksteel',
    body(f, torso, p) {
      if (bare) {
        f.part(torso, [[-6.4, -15.5], [6.4, -15.5], [7.2, -4], [7.6, 4], [-7, 4], [-6.8, -4]], 'darksteel', 3, { mail: true }); // mail shirt
        f.part(torso, [[-6.9, -4.6], [7.1, -4.6], [7.1, -2.6], [-6.9, -2.6]], 'leather', 3.5); // belt
        f.part(torso, [[-6.8, 3.4], [7.4, 3.4], [7.8, 6], [-7.2, 6]], 'leather', 3.2, { profile: 'flat', folds: [0.4, 2.6, 0] }); // the padded coat below the mail
        f.part(torso, [[1, -12], [3.4, -9], [2, -7]], 'coal', 3.6, { profile: 'flat', outline: false }); // a torn strap where the breastplate hung
        return;
      }
      f.part(torso, [[-7.2, -16], [7.2, -16], [8.2, -9], [7.6, -2.6], [-7, -2.6], [-7.8, -9]], 'steel', 3, {
        trim: ['darksteel', 1], details: rivets([[-5, -14], [5.4, -14], [-5.6, -4.6], [6, -4.6]]),
      }); // breastplate of polished iron, riveted, its edges blackened
      f.part(torso, [[-0.4, -15], [0.8, -15], [0.8, -4], [-0.4, -4]], 'darksteel', 3.1, { profile: 'flat' }); // the ridge down the middle
      f.part(torso, [[-6.8, -3], [7.2, -3], [8, 3.6], [0.6, 4.6], [-7.2, 3.6]], 'darksteel', 3.2, { trim: ['steel', 0.8] }); // tassets
      f.part(torso.child(0.6, -3, 0.04 * p.sway), [[-3.4, 0], [4, 0], [4.4, 8.4], [0.4, 9.6], [-3.6, 8.4]], 'wool', 3.3, { profile: 'flat', folds: [0.4, 2.4, 0], trim: ['leather', 0.8] }); // a short tabard of undyed wool
      f.part(torso, [[-6.9, -4], [7.3, -4], [7.3, -2.2], [-6.9, -2.2]], 'leather', 3.5); // sword belt
      f.part(torso, [[-4.2, -19], [4.8, -19], [5.2, -15.4], [-4.6, -15.4]], 'darksteel', 3.6, { trim: ['steel', 0.8] }); // gorget
      const pauldron = torso.child(4.6, -14.4 + 0.3 * p.sway, 0.1);
      f.part(pauldron, [[-4, -2], [-1.4, -4.4], [2.6, -4], [4.8, -1], [4.4, 2.6], [-3.6, 2.6]], 'steel', 7.3, { trim: ['darksteel', 0.9], details: rivets([[0.6, -2.6]]) }); // near pauldron, over the arm
    },
    head(f, head) {
      if (bare) {
        face(f, head);
        f.part(head, [[-4.6, 1.6], [-5.2, -5], [-4, -9.6], [0.6, -10.6], [4.6, -9], [5.4, -6.6], [2.4, -6.6], [1.6, -3], [2.6, 0.4], [1, 2]], 'darksteel', 5.2, { mail: true }); // mail coif round the face
        return;
      }
      // a bascinet with a pointed "hounskull" visor: the snout juts forward, a dark slit and breaths
      const slit: [number, number, 'coal', number][] = [2, 3, 4, 5].map((x) => [x + 0.5, -5.8, 'coal', 0]);
      const breaths: [number, number, 'coal', number][] = [[5.5, -3, 'coal', 0], [6.5, -3, 'coal', 0], [5.5, -1.8, 'coal', 0]];
      f.part(head, [[-4.8, 2], [-5.3, -5.6], [-4.2, -10], [0, -12], [3.8, -10.4], [5.4, -7.4], [8.8, -4.2], [5.8, -0.6], [4.8, 1.8], [0, 2.8]], 'steel', 5, { trim: ['darksteel', 0.7], details: [...slit, ...breaths] });
      f.part(head, [[-5.2, 1], [4.6, 1], [5, 3.2], [-5.4, 3.2]], 'darksteel', 5.1, { mail: true }); // the aventail under the helm
    },
    weapon(f, grip, p) {
      trail(f, grip, p, 21); // physical: pale steel
      f.part(grip, [[-0.9, -14], [0.9, -14], [0.9, 5], [-0.9, 5]], 'leather', p.zw); // haft
      f.part(grip, [[-1.3, 3], [1.3, 3], [1.3, 5.6], [-1.3, 5.6]], 'darksteel', p.zw + 0.05); // butt cap
      f.part(grip, [[-4.6, -20.5], [3.6, -20.5], [3.6, -15], [-4.6, -15]], 'steel', p.zw + 0.1); // hammer head, its flat face forward
      f.part(grip, [[-4.6, -19.4], [-7.6, -18], [-4.6, -16.2]], 'darksteel', p.zw + 0.08); // the back spike
      f.part(grip, [[-0.8, -20.5], [0.8, -20.5], [0.6, -23.6], [-0.6, -23.6]], 'darksteel', p.zw + 0.09); // top spike
    },
  };
}

// hammer low and ready; the blow is the shared overhead chop, impact on frame 4
export const sprite = humanSprite('ironKnight', 57, ironKnightKit(false), { fist: [6, 11], far: [2, 10], weapon: 0.35 }, CHOP, 4);
