/**
 * Frame profiler behind the F3 overlay (and the perf test). Sections are timed with begin()/end(),
 * canvas draw calls are counted by patching the context's draw methods while the overlay is on.
 * Everything here is a no-op cost of one boolean check when disabled.
 */
export interface PerfCounts {
  enemies: number;
  projectiles: number;
  particles: number;
  fields: number;
  zones: number;
  texts: number;
  draws: number;
}

const HISTORY = 300;

export const perf = {
  enabled: false,
  frameMs: 0, // last frame, wall clock between animation frames
  updateMs: 0, // all simulation steps of the frame
  renderMs: 0,
  sections: {} as Record<string, number>, // ms per section, last completed frame
  counts: { enemies: 0, projectiles: 0, particles: 0, fields: 0, zones: 0, texts: 0, draws: 0 } as PerfCounts,
  history: new Float32Array(HISTORY), // frame times, ring buffer
  head: 0,
  filled: 0,
};

const current: Record<string, number> = {};
let draws = 0;
let patched: CanvasRenderingContext2D | null = null;

export const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function begin(): number {
  return perf.enabled ? now() : 0;
}
export function end(section: string, start: number): void {
  if (perf.enabled) current[section] = (current[section] ?? 0) + now() - start;
}

/** Called once per frame by the loop with the three headline numbers; rolls the sections and the history. */
export function frameDone(frameMs: number, updateMs: number, renderMs: number, counts: Omit<PerfCounts, 'draws'>): void {
  perf.history[perf.head] = frameMs;
  perf.head = (perf.head + 1) % HISTORY;
  perf.filled = Math.min(HISTORY, perf.filled + 1);
  sumUpdate += updateMs;
  sumRender += renderMs;
  sumFrames += frameMs;
  nFrames++;
  if (!perf.enabled) return;
  perf.frameMs = frameMs;
  perf.updateMs = updateMs;
  perf.renderMs = renderMs;
  perf.sections = { ...current };
  for (const k of Object.keys(current)) current[k] = 0;
  perf.counts = { ...counts, draws };
  draws = 0;
}

/** Sorted percentile of the recent frame times (a copy: cheap at 300 entries, only done when displayed). */
export function percentile(p: number): number {
  if (perf.filled === 0) return 0;
  const arr = Array.from(perf.history.subarray(0, perf.filled)).sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
}

let sumUpdate = 0;
let sumRender = 0;
let sumFrames = 0;
let nFrames = 0;

export function resetHistory(): void {
  perf.head = perf.filled = 0;
  sumUpdate = sumRender = sumFrames = nFrames = 0;
}

/** What the perf test reads after letting the real loop run: percentiles of frame-to-frame time and the averages. */
export function summary(): { frames: number; avg: number; p95: number; max: number; update: number; render: number } {
  return { frames: nFrames, avg: nFrames ? sumFrames / nFrames : 0, p95: percentile(0.95), max: percentile(1), update: nFrames ? sumUpdate / nFrames : 0, render: nFrames ? sumRender / nFrames : 0 };
}

const DRAW_METHODS = ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'clearRect'] as const;

/** Counts draw calls on this context while the overlay is on. Patching the instance costs one extra call per draw. */
export function setEnabled(on: boolean, ctx: CanvasRenderingContext2D): void {
  perf.enabled = on;
  if (on && patched !== ctx) {
    for (const m of DRAW_METHODS) {
      const orig = ctx[m] as (...args: unknown[]) => unknown;
      (ctx as unknown as Record<string, unknown>)[m] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        draws++;
        return orig.apply(this, args);
      };
    }
    patched = ctx;
  } else if (!on && patched) {
    for (const m of DRAW_METHODS) delete (patched as unknown as Record<string, unknown>)[m]; // back to the prototype's method
    patched = null;
  }
}

/** One line per number, for the overlay `<pre>`. */
export function overlayText(): string {
  const s = perf.sections;
  const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const c = perf.counts;
  return [
    `frame ${perf.frameMs.toFixed(1)} ms   p95 ${percentile(0.95).toFixed(1)}   max ${percentile(1).toFixed(1)}`,
    `update ${perf.updateMs.toFixed(2)}   render ${perf.renderMs.toFixed(2)}   draws ${c.draws}`,
    `enemies ${c.enemies}  proj ${c.projectiles}  particles ${c.particles}  fields ${c.fields}  zones ${c.zones}  texts ${c.texts}`,
    ...top.map(([k, v]) => `  ${k.padEnd(14)} ${v.toFixed(2)}`),
  ].join('\n');
}
