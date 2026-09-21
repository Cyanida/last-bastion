import type { Body } from './types';

/** Uniform grid. Items are bucketed by centre; queries pad by the largest radius seen. */
export class SpatialHash<T extends Body> {
  private cells = new Map<number, T[]>();
  private maxR = 0;

  constructor(private size: number) {}

  clear(): void {
    for (const c of this.cells.values()) c.length = 0;
    this.maxR = 0;
  }

  private key(cx: number, cy: number): number {
    return (cx + 64) * 4096 + (cy + 64);
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.size), Math.floor(item.y / this.size));
    let cell = this.cells.get(k);
    if (!cell) this.cells.set(k, (cell = []));
    cell.push(item);
    if (item.r > this.maxR) this.maxR = item.r;
  }

  /** Fills `out` with every item whose circle touches the circle (x, y, r). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const pad = r + this.maxR;
    const x0 = Math.floor((x - pad) / this.size);
    const x1 = Math.floor((x + pad) / this.size);
    const y0 = Math.floor((y - pad) / this.size);
    const y1 = Math.floor((y + pad) / this.size);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const dx = item.x - x;
          const dy = item.y - y;
          const rr = r + item.r;
          if (dx * dx + dy * dy <= rr * rr) out.push(item);
        }
      }
    }
    return out;
  }
}
