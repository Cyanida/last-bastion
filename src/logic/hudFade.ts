/** #255: the wave and boss panel at the top centre fades while the champion or a boss stands under it, so a fight at the top wall stays visible. */
import { HUD_FADE } from '../config/game';

export interface Box { left: number; top: number; right: number; bottom: number }
export interface Body { x: number; y: number; r: number }
export interface Cam { x: number; y: number; zoom: number; dpr: number }

/** The body's box on screen, in CSS pixels: its radius plus room for the head above and the feet below. Sprites stand up from their feet. */
export function bodyBox(b: Body, cam: Cam): Box {
  const k = cam.zoom / cam.dpr; // world pixels to CSS pixels
  const sx = (b.x - cam.x) * k;
  const sy = (b.y - cam.y) * k;
  const w = (b.r + HUD_FADE.sideMargin) * k;
  return { left: sx - w, right: sx + w, top: sy - (b.r + HUD_FADE.headRoom) * k, bottom: sy + (b.r + HUD_FADE.footRoom) * k };
}

export const overlaps = (a: Box, b: Box): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** True when any body's box touches the panel. `panel` is the cached screen rect (no layout read here). */
export function panelCovers(panel: Box, bodies: readonly Body[], cam: Cam): boolean {
  for (const b of bodies) if (overlaps(panel, bodyBox(b, cam))) return true;
  return false;
}
