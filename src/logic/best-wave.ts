/**
 * #254: what a class's stored `bestWave` is. It counts the waves played in one level (rewards and deeds count only played waves, on
 * purpose), not the realm's wave number the "Reached" line shows, so every screen says so instead of calling it a wave.
 */
export const BEST_WAVE_LABEL = 'Most waves in one level';

export const wavesText = (n: number): string => `${n} ${n === 1 ? 'wave' : 'waves'}`;
