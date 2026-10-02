/**
 * #278: The Barrow King, the Barrowvale's crown boss, 1.38× the Paladin (77 art px with his antlers: above the Iron King's 74, under the
 * Cinder Colossus's 80): an old king out of his barrow mound, in grave-green corroded bronze plate (dull, no glints: it has lain in the
 * earth) under a tattered grave shroud, a pale bone death mask with cold soul-lit eyes in a closed barrow helm, and a crown of bone antler
 * tines on a black iron circlet. Not the Lich (no bare skull, no gold crown, no robes) and not the Plague Abbot (no habit, no beak). His
 * special is the slam (armoured.ts): the blade high over the telegraph, then the Reap, a pale steel sweep.
 */
import { armouredSprite } from '../armoured';
import { scaled } from '../robed';

const S = 1.38;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'barrowKing', S, tall: 77, h: 116,
  plate: 'barrowBronze', accent: 'darksteel', trim: 'bone', cape: 'rot', blade: 'darksteel', fx: 'smear', special: 'slam',
  head(f, head, p) {
    f.part(head, sc([[-5.4, 1.6], [-5.8, -9], [-4.2, -11], [3.8, -11], [5.8, -9.2], [6.2, 1.2], [3, 2.4], [-2.8, 2.2]]), 'barrowBronze', 5, {
      trim: ['darksteel', 0.7], details: dt([[-3.2, -8.6, 'barrowBronze', 5], [-3.6, -3, 'barrowBronze', 1]]),
    }); // a closed barrow helm, green with age
    f.part(head, sc([[0.6, -8.4], [6, -8.4], [6.4, -3.4], [5.4, 0.6], [3.4, 1.8], [1.4, 0.8], [0.4, -3]]), 'bone', 5.05, {
      details: dt([[2.4, -5.6, 'soul', 6], [4.8, -5.6, 'soul', 5], [3.6, -5.6, 'darksteel', 0], [3.4, -1.2, 'darksteel', 1], [4.4, -1.2, 'darksteel', 1], [2.4, -1.2, 'darksteel', 1]]),
    }); // a pale bone death mask: soul-lit eye holes, a grim slotted mouth
    f.part(head, sc([[-5.6, -9.2], [6.2, -9.2], [6.2, -11.4], [-5.6, -11.4]]), 'darksteel', 5.1, { details: dt([[0.3, -10.3, 'soul', 5]]) }); // the black iron circlet, one cold stone
    const k = p.crest * 0.6;
    f.part(head, sc([[3.2, -11], [4.6, -11], [6.4, -15.6 - k], [8.8, -17.4 - k], [8.4, -18.4 - k], [6.6, -17.4], [5.4, -19.8 - k], [4.4, -19.4 - k], [4.8, -16.4], [3.6, -14]]), 'bone', 5.15); // the near antler
    f.part(head, sc([[-3.6, -11], [-2.2, -11], [-2.8, -14], [-4.4, -16.6], [-4, -19.6 - k], [-5, -19.8 - k], [-6, -17.4], [-7.8, -18.2 - k], [-8, -17 - k], [-5.4, -14.8]]), 'bone', 4.9, { dim: 1 }); // the far antler
    f.part(head.child(-5 * S, -3 * S, 0.3 + p.crest), sc([[0, 0], [1.6, 0], [0.8, 8.4], [-1.6, 10], [-1, 5]]), 'rot', 4.8, { profile: 'flat', folds: [0.4, 2, 1], dim: 1 }); // a rag of grave shroud from the helm
  },
});
