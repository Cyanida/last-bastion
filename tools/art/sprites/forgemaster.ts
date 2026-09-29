/**
 * #215: The Forgemaster, the Iron Hold's level-3 boss, 1.2× the Paladin (66 art px tall, like the Warden): blackened plate with an ember
 * chevron and shield, a scorched leather apron and cape, a closed furnace helm whose grille glows with the fire inside, and a square forge
 * hammer whose face still glows. His special is the slam (armoured.ts): the hammer high over the telegraph, then down, the ground
 * bursting in fire.
 */
import { armouredSprite } from '../armoured';
import { scaled } from '../robed';

const S = 1.2;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'forgemaster', S, tall: 66,
  plate: 'black', accent: 'ember', trim: 'darksteel', cape: 'leather', blade: 'darksteel', fx: 'flame', special: 'slam', hammer: true, apron: 'leather',
  head(f, head) {
    f.part(head, sc([[-5.2, 1.6], [-5.6, -7], [-4, -11], [0.6, -12.2], [4.6, -11], [6.2, -7], [6.2, 1.6], [0.6, 2.6]]), 'black', 5, {
      trim: ['darksteel', 0.8], details: dt([[-3.5, -9.5, 'black', 5], [-2.5, -10.5, 'black', 5]]),
    }); // a rounded furnace helm, closed
    f.part(head, sc([[0.8, -6.6], [6.4, -6.6], [6.4, -0.6], [0.8, -0.6]]), 'ember', 5.1, {
      profile: 'flat', details: dt([2, 3.4, 4.8].map((x): [number, number, 'darksteel', number] => [x, -3.6, 'darksteel', 1])),
    }); // its grille: the fire inside shows between the bars
    f.part(head, sc([[-1.2, -11.6], [2.2, -11.6], [2, -15], [-1, -15]]), 'darksteel', 5.05, { trim: ['black', 0.6] }); // a short flue on top
  },
});
