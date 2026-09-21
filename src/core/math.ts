import type { Rng } from './types';

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Smallest absolute difference between two angles, 0..PI. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/** Small seedable PRNG so waves and upgrade rolls are testable. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(items: { weight: number; value: T }[], rng: Rng): T {
  let roll = rng() * items.reduce((s, i) => s + i.weight, 0);
  for (const i of items) {
    roll -= i.weight;
    if (roll <= 0) return i.value;
  }
  return items[items.length - 1].value;
}

/** In-place filter, keeps order, no allocation. */
export function compact<T>(arr: T[], keep: (t: T) => boolean): void {
  let n = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (keep(item)) arr[n++] = item;
  }
  arr.length = n;
}
