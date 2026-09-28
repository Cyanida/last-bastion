import { describe, expect, it } from 'vitest';
import { GAME } from '../src/config/game';
import { LRUCache } from '../src/logic/lruCache';

describe('v0.8.3 sprite frame cache is bounded (#168)', () => {
  it('never holds more than its cap', () => {
    const c = new LRUCache<number, string>(3);
    for (let i = 0; i < 10; i++) c.set(i, `v${i}`);
    expect(c.size).toBe(3);
  });

  it('evicts the least recently used entry first', () => {
    const c = new LRUCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.get('a'); // touch a, so b is now the oldest
    c.set('d', 4); // evicts b
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('re-setting an existing key updates it without growing the cache', () => {
    const c = new LRUCache<string, number>(2);
    c.set('a', 1);
    c.set('a', 2);
    expect(c.size).toBe(1);
    expect(c.get('a')).toBe(2);
  });

  it("GAME's cap keeps the sprite gallery (well over a thousand distinct frames) far below its old half-gigabyte", () => {
    // 37 sheets, ~6 anims and ~4 frames each: comfortably more distinct frames than the cap holds at once.
    expect(GAME.spriteFrameCacheCap).toBeGreaterThan(0);
    expect(GAME.spriteFrameCacheCap).toBeLessThan(1000);
  });
});
