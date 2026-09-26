/** #157: the War Priest: a white robe with a red stole, a shaved head and a flanged mace he brings down; his heals glow gold. */
import { CHOP, face, humanSprite, pose, trail, tunic, type Kit } from '../human';

const kit: Kit = {
  legs: 'white', boots: 'leather', sleeve: 'white', hand: 'skin',
  body(f, torso, p) {
    tunic(f, torso, p, 'white', 'leather', true);
    f.part(torso, [[0.6, -15], [3.2, -15], [3.4, 10], [0.8, 10]], 'red', 3.4, { profile: 'flat' }); // stole
    f.part(torso, [[1.4, -8], [2.6, -8], [2.6, -3], [1.4, -3]], 'white', 3.5, { profile: 'flat' });
    f.part(torso, [[0, -6.4], [4, -6.4], [4, -5.4], [0, -5.4]], 'white', 3.5, { profile: 'flat' }); // its cross
  },
  head(f, head) {
    face(f, head);
    f.part(head, [[-4.2, -4.6], [-3.4, -1], [-1.6, 0.4], [-1.8, -5]], 'wool', 5.05, { dim: 1 }); // the ring of hair
  },
  weapon(f, grip, p) {
    trail(f, grip, p, 16, 'glow');
    f.part(grip, [[-0.9, -12], [0.9, -12], [0.9, 4], [-0.9, 4]], 'leather', p.zw); // haft
    f.part(grip, [[-2.8, -17], [2.8, -17], [3.4, -14], [2.8, -11.4], [-2.8, -11.4], [-3.4, -14]], 'steel', p.zw + 0.1); // flanged head
    f.part(grip, [[-0.8, -18.6], [0.8, -18.6], [0.8, -16.8], [-0.8, -16.8]], 'steel', p.zw + 0.1);
  },
};

export const sprite = humanSprite('priest', 52, kit, pose({ fist: [6, 11], far: [3, 9], weapon: 0.3 }), CHOP, 4);
