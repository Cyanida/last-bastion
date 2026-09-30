/**
 * #226: the Cinder Hound, the Cinderlands' wolf. The Wolf's build and leap (sprites/wolf.ts), but his coat is charred black, his
 * belly and the stripe down his back glow like coals through the cracks, his eye is a spark, and flames stand along his spine and at
 * the tip of his tail; the leap leaves a streak of fire. As he falls the fire flares up: he bursts where he dies (config/damage.ts
 * DEATH_BURSTS).
 */
import { wolfSprite } from './wolf';

export const sprite = wolfSprite('cinderHound', { coat: 'coal', belly: ['ember', 2], saddle: 'ember', eye: ['glow', 5], trail: 'fire', fire: true });
