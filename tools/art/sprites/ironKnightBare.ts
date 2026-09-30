/** #212: the Iron Knight once his plates are broken: the same man and hammer, in his mail shirt and coif (sprites/ironKnight.ts). */
import { CHOP, humanSprite } from '../human';
import { ironKnightKit } from './ironKnight';

export const sprite = humanSprite('ironKnightBare', 56, ironKnightKit(true), { fist: [6, 11], far: [2, 10], weapon: 0.35 }, CHOP, 4);
