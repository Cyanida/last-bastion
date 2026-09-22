import { QUALITY, type QualitySetting } from '../config/game';

/**
 * Render quality. The setting picks a level ('auto' starts high and drops to low once if the first waves are slow).
 * On top of that, `detail` (0..1) reacts every frame: when frames run over budget it falls and the renderer
 * spends less (fewer particles, no shadows, no rings); it climbs back slowly when frames are cheap again.
 */
export const quality = { setting: 'auto' as QualitySetting, level: 'high' as 'low' | 'high', detail: 1, ...QUALITY.high };

let sum = 0;
let frames = 0;
let ema = 0;

function apply(level: 'low' | 'high'): void {
  Object.assign(quality, { level }, QUALITY[level]);
}

export function setQuality(setting: QualitySetting): void {
  quality.setting = setting;
  apply(setting === 'low' ? 'low' : 'high');
  quality.detail = 1;
  sum = frames = 0;
  ema = 0;
}

/** Pure decision, so it can be tested: should auto mode downshift after this sample window? */
export function shouldDownshift(avgFrameMs: number): boolean {
  return avgFrameMs > QUALITY.auto.maxFrameMs;
}

/** Pure: the next detail level given the smoothed frame time. Drops fast above the budget, recovers slowly below it. */
export function nextDetail(detail: number, emaMs: number): number {
  const d = QUALITY.dynamic;
  if (emaMs > d.overMs) return Math.max(d.minDetail, detail - d.dropPerFrame);
  if (emaMs < d.underMs) return Math.min(1, detail + d.risePerFrame);
  return detail;
}

/** Feed one rendered frame's duration while a run is being played. */
export function sampleFrame(ms: number, wave: number): void {
  if (ms > 250) return; // a stall (tab switch, texture upload): not a signal
  ema = ema === 0 ? ms : ema * 0.9 + ms * 0.1;
  quality.detail = nextDetail(quality.detail, ema);
  if (quality.setting !== 'auto' || quality.level === 'low' || wave < 1 || wave > QUALITY.auto.untilWave) return;
  sum += ms;
  if (++frames < QUALITY.auto.windowFrames) return;
  if (shouldDownshift(sum / frames)) apply('low');
  sum = frames = 0;
}

/** Effective particle budget fraction and whether the decorative layers are drawn this frame. */
export const particleBudget = (): number => quality.particles * (0.35 + 0.65 * quality.detail);
export const drawShadows = (): boolean => quality.shadows && quality.detail > 0.5;
export const drawRings = (): boolean => quality.detail > 0.3;
