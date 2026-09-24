import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_POINTS, showWhatsNewNow, whatsNew } from '../src/logic/whatsNew';

describe("What's new (v0.7.1)", () => {
  it('reads the top entry of the real CHANGELOG.md: its version, theme, first sentence and bold-named points', () => {
    const w = whatsNew(readFileSync('CHANGELOG.md', 'utf8'))!;
    const top = readFileSync('CHANGELOG.md', 'utf8').split('\n').find((l) => l.startsWith('## '))!;
    expect(top).toContain(`v${w.version}`);
    expect(w.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(w.points.length).toBeGreaterThan(0);
    expect(w.points.length).toBeLessThanOrEqual(MAX_POINTS);
    for (const p of [...w.points, { name: w.title, text: w.intro }]) expect(`${p.name} ${p.text}`).not.toMatch(/\*\*|`|\]\(/);
  });

  it('reduces an entry to its main points: first clauses, no sub-bullets, no developer lines, no second entry', () => {
    const w = whatsNew(`# Changelog

## v1.2.3 — Bells and whistles

The theme of it: bells ring. Then more words nobody needs.

- **Bells**: every arena rings a *bell* at dawn. It is loud.
  - a sub-point about the bell
- **\`npm run bells\`**: a script for developers.
- a bullet without a name
### A section
- **Whistles** (new): see [the guide](https://example.com) for them. Also more.
- **Quiet**
- **Loud**: first; then the rest.

## v1.2.2 — Old news

- **Old**: not this one.
`)!;
    expect(w).toEqual({
      version: '1.2.3',
      title: 'Bells and whistles',
      intro: 'The theme of it: bells ring.',
      points: [
        { name: 'Bells', text: 'every arena rings a bell at dawn' },
        { name: 'Whistles', text: '(new)' },
        { name: 'Quiet', text: '' },
        { name: 'Loud', text: 'first' },
      ],
      more: 0,
    });
  });

  it('keeps the first points and counts the rest; a patch heading without a theme works; no entry gives nothing', () => {
    const many = `## v0.3.1\n\n${Array.from({ length: MAX_POINTS + 4 }, (_, i) => `- **Point ${i}**: text ${i}.`).join('\n')}\n`;
    const w = whatsNew(many)!;
    expect(w.title).toBe('');
    expect(w.intro).toBe('');
    expect(w.points.map((p) => p.name)).toEqual(Array.from({ length: MAX_POINTS }, (_, i) => `Point ${i}`));
    expect(w.more).toBe(4);
    expect(whatsNew('# Changelog\n\nNothing yet.\n')).toBeNull();
  });

  it('opens once per version, only for the version the entry is about, and not on a first start ever', () => {
    expect(showWhatsNewNow('0.7.0', '0.7.1', '0.7.1', true)).toBe(true); // an update
    expect(showWhatsNewNow('0.7.1', '0.7.1', '0.7.1', true)).toBe(false); // seen: the title screen button only
    expect(showWhatsNewNow(null, '0.7.1', '0.7.1', true)).toBe(true); // played before the flag existed (v0.7.0 and older)
    expect(showWhatsNewNow(null, '0.7.1', '0.7.1', false)).toBe(false); // a new player: nothing is new to them
    expect(showWhatsNewNow('0.7.0', '0.7.0', '0.7.1', true)).toBe(false); // the build's entry is not this version
    expect(showWhatsNewNow('0.7.0', undefined, '0.7.1', true)).toBe(false);
  });
});
