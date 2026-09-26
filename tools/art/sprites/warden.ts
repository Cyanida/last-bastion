/**
 * #158: The Warden, keeper of the Keep, 1.2× the Paladin (66 art px tall; about 1.6× on screen): bright steel plate, a gold-barred
 * bucket helm, a blue surcoat colour on his shield and chest, a grey cape and a flanged mace. His special is the slam
 * (armoured.ts): mace high over the telegraph, then smashed into the ground, which bursts into his ring of stone (physical).
 */
import { armouredSprite } from '../armoured';
import { scaled } from '../robed';

const S = 1.2;
const { sc, dt } = scaled(S);

export const sprite = armouredSprite({
  id: 'warden', S, tall: 66,
  plate: 'steel', accent: 'blue', trim: 'gold', cape: 'darksteel', blade: 'darksteel', fx: 'smear', special: 'slam', mace: true,
  head(f, head) {
    f.part(head, sc([[-5, 1], [-5.2, -10], [-3.6, -11.4], [3.8, -11.4], [5.6, -10], [5.8, 1], [2.8, 2], [-2.8, 1.8]]), 'steel', 5, {
      details: dt([...[-3, -2, -1, 0, 1, 2, 3, 4, 5].map((x): [number, number, 'steel', number] => [x + 0.5, -5, 'steel', 0]), [4.6, -1, 'steel', 1], [4.6, 0.4, 'steel', 1]]),
    }); // bucket helm, an eye slit
    f.part(head, sc([[1.6, -9], [3, -9], [3, 1.4], [1.6, 1.4]]), 'gold', 5.1); // gold bar
    f.part(head, sc([[-5.4, -9.4], [6, -9.4], [6, -7.8], [-5.4, -7.8]]), 'gold', 5.1); // brow band
    f.part(head, sc([[-1.2, -11], [1.6, -11], [1.2, -13.4], [-0.8, -13.4]]), 'gold', 5.05); // crest knob
  },
});
