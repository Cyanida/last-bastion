export type Formation = 'line' | 'wedge' | 'circle';

export interface Vec {
  x: number;
  y: number;
}

/**
 * Slot offsets in the squad's local frame: +x is "forward" (towards the target), +y is to its right.
 * The commander is not one of the n members; see commanderOffset.
 */
export function formationOffsets(kind: Formation, n: number, spacing: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === 'line') out.push({ x: 0, y: (i - (n - 1) / 2) * spacing });
    else if (kind === 'wedge') {
      // tip first, then pairs falling back on both sides: 0 / 1 2 / 3 4 ...
      const row = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
      out.push({ x: -row * spacing * 0.8, y: side * row * spacing * 0.6 });
    } else {
      const radius = Math.max(spacing, (n * spacing) / (Math.PI * 2));
      const a = (i / n) * Math.PI * 2;
      out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    }
  }
  return out;
}

/** Where the commander stands: behind a line or wedge, in the middle of a circle. */
export function commanderOffset(kind: Formation, n: number, spacing: number): Vec {
  if (kind === 'circle') return { x: 0, y: 0 };
  const depth = kind === 'wedge' ? Math.ceil((n - 1) / 2) * spacing * 0.8 : 0;
  return { x: -depth - spacing * 1.5, y: 0 };
}

/** Local offset -> world position for a squad anchored at `anchor` and facing `facing` (radians). */
export function slotPosition(anchor: Vec, facing: number, offset: Vec): Vec {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return { x: anchor.x + offset.x * c - offset.y * s, y: anchor.y + offset.x * s + offset.y * c };
}
