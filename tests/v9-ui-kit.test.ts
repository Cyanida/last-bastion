import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIcons, iconPaths, ICONS } from '../tools/art/ui/icons';

describe('#184 UI kit icon atlas', () => {
  it('the committed atlas and its CSS match their definitions (run `npm run art` when this fails)', () => {
    const { png, css } = buildIcons();
    expect(Buffer.compare(png, readFileSync(iconPaths.png)) === 0, `${iconPaths.png} is out of date`).toBe(true);
    expect(readFileSync(iconPaths.css, 'utf8').replace(/\r\n/g, '\n')).toBe(css);
    expect(buildIcons().png.equals(png)).toBe(true); // deterministic
  });

  it('every icon the screens ask for is in the atlas', () => {
    const ids = new Set(ICONS.map(([id]) => id));
    const used = [...readFileSync('src/ui/screens.ts', 'utf8').matchAll(/kit-icon i-([a-z]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(ids.has(id), id).toBe(true);
  });
});
