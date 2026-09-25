import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

// v0.8 (#26): the simulation is pure. Everything the run code reaches, following value imports from these roots,
// touches no DOM, audio, storage or wall clock. It talks to the device only through src/sim/view.ts.
const ROOTS = ['src/game.ts', 'src/systems', 'src/sim', 'src/entities'];
const DEVICE = /^src\/(core\/(audio|music|storage|platform|pwa|perf|quality)|ui\/|render\/|input\/|main)/;
const GLOBALS = /(?<![.\w$])(document|window|localStorage|sessionStorage|indexedDB|navigator|location|performance\.now|requestAnimationFrame|AudioContext|Date\.now|new Date)\b(?!\s*:)/;

const files = (p: string): string[] => (p.endsWith('.ts') ? [p] : readdirSync(p, { withFileTypes: true }).flatMap((e) => files(`${p}/${e.name}`)));
/** The code without comments and string contents. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'/g, "''");
/** Value imports only: `import type …` and `import { type X }` are erased at build time. */
const imports = (src: string) =>
  [...src.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+'(\.[^']+)'/gm)].filter((m) => !m[1] && !/^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(m[2])).map((m) => m[3]);

/** What the files, and everything they import, do that the simulation must not. */
function violations(start: string[], read: (file: string) => string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (DEVICE.test(file)) {
      out.push(`${file} is device code`);
      continue;
    }
    const src = read(file);
    const hit = code(src).match(GLOBALS);
    if (hit) out.push(`${file} uses ${hit[0]}`);
    for (const rel of imports(src)) queue.push(normalize(join(dirname(file), rel)).replace(/\\/g, '/') + '.ts');
  }
  return out;
}

describe('pure simulation (v0.8 #26)', () => {
  it('reaches no DOM, audio, storage or wall clock', () => {
    expect(violations(ROOTS.flatMap(files), (f) => readFileSync(f, 'utf8'))).toEqual([]);
  });

  it('catches a device import or a clock, and lets types, comments and strings through', () => {
    const fake: Record<string, string> = {
      'src/sim/a.ts': "import { sfx } from '../core/audio';\nimport type { SfxName } from '../core/audio';",
      'src/sim/b.ts': "// Date.now() in a comment\nimport { type Aim } from '../input/mapping';\nexport const t = () => Date.now();",
      'src/sim/c.ts': "import { b } from './b';\nexport const s = 'window';",
    };
    const check = (file: string) => violations([file], (f) => fake[f] ?? '');
    expect(check('src/sim/a.ts')).toEqual(['src/core/audio.ts is device code']);
    expect(check('src/sim/b.ts')).toEqual(['src/sim/b.ts uses Date.now']);
    expect(check('src/sim/c.ts')).toEqual(['src/sim/b.ts uses Date.now']); // reached through an import
  });
});
