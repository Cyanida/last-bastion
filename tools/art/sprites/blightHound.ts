/**
 * #276: the Blight Hound, the Barrowvale's wolf. The Wolf's build and leap (sprites/wolf.ts), but sick with the barrow plague: a
 * rotting grey-green coat, a bone-pale belly, a mossy saddle and a sickly green eye; the leap leaves a streak of venom. Where he dies
 * the ground stays foul (config/damage.ts PLAGUE_GROUND).
 */
import { wolfSprite } from './wolf';

export const sprite = wolfSprite('blightHound', { coat: 'rot', belly: ['bone', 3], saddle: 'moss', eye: ['poison', 5], trail: 'venom' });
