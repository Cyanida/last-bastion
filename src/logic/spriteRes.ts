/**
 * #138: sprites carry their own resolution (1 = the old grid, 2 = a grid twice as fine). A sprite's on-screen size is its grid divided by its
 * resolution, times the scale, so a 24×28 redraw at resolution 2 takes the same room as the 12×14 original. The canvas is rasterized at a
 * whole number of device pixels per grid pixel (rounded up), never less than the on-screen size, and drawn down to it.
 */
export function spriteSize(cols: number, rows: number, scale: number, res = 1): { w: number; h: number; cell: number } {
  return { w: Math.round((cols * scale) / res), h: Math.round((rows * scale) / res), cell: Math.max(1, Math.ceil(scale / res)) };
}
