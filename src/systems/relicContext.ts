import type { RelicKey } from '../config/relics';

/**
 * v0.7: the relic whose hook is running right now. Relic damage and healing are credited to it (RELICS.md), its icon flashes over the player,
 * and its damage numbers take its colour. A module of its own so combat can read it without importing the relic system.
 */
export const relicContext: { acting: RelicKey | null } = { acting: null }; // v0.7 A5: or the duo whose hook is running
