/**
 * #228: The Cinder Colossus, the Cinderlands' crown boss, 1.45× the Paladin (80 art px with his flames: above the Iron King's 74, under
 * the Usurper's 84): a hulk of blackened cinder plate split by glowing seams (the fire inside shows through), ember studs and chevron, a
 * scorched coal cloak, a basalt maul, and a horned cinder helm with burning eyes under a crown of flame that sways as he moves. His
 * special is the slam (armoured.ts): the maul high over the telegraph, then down, the ground bursting in fire.
 */
import { armouredSprite } from '../armoured';
import { scaled } from '../robed';

const S = 1.45;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'cinderColossus', S, tall: 80, h: 118,
  plate: 'black', accent: 'ember', trim: 'stone', cape: 'coal', blade: 'stone', fx: 'flame', special: 'slam', mace: true, cracks: 'ember',
  head(f, head, p) {
    f.part(head, sc([[-5.6, 1.8], [-6, -8.6], [-4.4, -11.2], [0.4, -12], [4.6, -11], [6.4, -8], [6.6, 1.4], [3, 2.6], [-2.8, 2.4]]), 'black', 5, {
      trim: ['stone', 0.7], details: dt([[2.6, -5, 'ember', 5], [3.6, -5, 'ember', 6], [5.2, -5, 'ember', 5], [4.2, -1.5, 'ember', 3], [-3, -8.5, 'black', 5]]),
    }); // a heavy cinder helm: burning eyes, a glowing mouth seam
    f.part(head, sc([[-4.6, -9.6], [-7.4, -11.6], [-9.6, -15.8], [-8.6, -16.4], [-6.2, -13.6], [-3.4, -11.4]]), 'stone', 4.9, { dim: 1 }); // the far horn
    f.part(head, sc([[3.4, -10.2], [6.6, -12], [8.6, -16.6], [9.6, -16], [8.6, -11.8], [5.2, -8.8]]), 'stone', 5.2); // the near horn
    const k = p.crest;
    f.part(head, sc([[-4, -11.4], [4.4, -11.4], [3.6, -15 - 2 * k], [2.2, -13.6], [1.2, -19 - 3 * k], [-0.4, -14.2], [-1.8, -17.4 - 2 * k], [-2.8, -13.8]]), 'flame', 4.95, {
      profile: 'flat', outline: false, details: dt([[0.8, -14.6, 'flame', 6], [-1.4, -14, 'flame', 5], [2.6, -13.4, 'flame', 5]]),
    }); // a crown of flame rising from the helm
  },
});
