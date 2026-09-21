import { QUALITY, type QualitySetting } from '../config/game';

/**
 * Render quality. 'auto' starts high, measures frame time during the first waves and drops to low once if needed
 * (never back up mid-run: flapping looks worse than either level).
 */
export const quality = { setting: 'auto' as QualitySetting, level: 'high' as 'low' | 'high', ...QUALITY.high };

let sum = 0;
let frames = 0;

function apply(level: 'low' | 'high'): void {
  Object.assign(quality, { level }, QUALITY[level]);
}

export function setQuality(setting: QualitySetting): void {
  quality.setting = setting;
  apply(setting === 'low' ? 'low' : 'high');
  sum = frames = 0;
}

/** Pure decision, so it can be tested: should auto mode downshift after this sample window? */
export function shouldDownshift(avgFrameMs: number): boolean {
  return avgFrameMs > QUALITY.auto.maxFrameMs;
}

/** Feed one rendered frame's duration while a run is being played. */
export function sampleFrame(ms: number, wave: number): void {
  if (quality.setting !== 'auto' || quality.level === 'low' || wave < 1 || wave > QUALITY.auto.untilWave || ms > 250) return;
  sum += ms;
  if (++frames < QUALITY.auto.windowFrames) return;
  if (shouldDownshift(sum / frames)) apply('low');
  sum = frames = 0;
}
