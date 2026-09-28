/**
 * #168: a bounded cache keyed by recency. `get` promotes a hit to most-recently-used; `set` evicts the least-recently-used
 * entry once the cap is reached. Backed by a Map, whose keys iterate in insertion order, so the oldest key is always first.
 */
export class LRUCache<K, V> {
  private readonly map = new Map<K, V>();
  constructor(private readonly cap: number) {}

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key); // re-insert so it's last (most recently used)
      this.map.set(key, v);
    }
    return v;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.cap) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
}
