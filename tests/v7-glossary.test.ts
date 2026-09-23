import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../src/config/glossary';
import { glossed } from '../src/ui/tooltip';

const REQUIRED = ['burn', 'chill', 'freeze', 'bleed', 'poison', 'curse', 'evolution', 'elite', 'commander', 'perfect dodge', 'Last Stand', 'Oath'];
const underlined = (html: string) => [...html.matchAll(/<u>(.*?)<\/u>/g)].map((m) => m[1]);

describe('glossary (v0.7.1)', () => {
  it('defines every required term once, each in full sentences with its numbers filled in', () => {
    const names = GLOSSARY.map((t) => t.name.toLowerCase());
    for (const term of REQUIRED) expect(names).toContain(term.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const forms = GLOSSARY.flatMap((t) => t.forms);
    expect(new Set(forms).size).toBe(forms.length); // a word belongs to one term
    for (const t of GLOSSARY) {
      expect(t.forms).toContain(t.name.toLowerCase());
      expect(t.def).toMatch(/^[A-Z0-9].*\.$/);
      expect(t.def).not.toMatch(/undefined|NaN|\$\{/);
    }
  });

  it('underlines every term in a tooltip, in any form and case, and never inside another word', () => {
    for (const t of GLOSSARY) for (const f of t.forms) expect(underlined(glossed(`It is ${f.toUpperCase()} now.`))).toEqual([f.toUpperCase()]);
    expect(underlined(glossed('Burnished oathkeepers bleedingly elitist'))).toEqual([]);
    expect(underlined(glossed('A perfect dodge; a perfect aim.'))).toEqual(['perfect dodge']);
  });

  it('adds each definition once, in the order the terms came up, and escapes the tip itself', () => {
    const html = glossed('Chilled <b>foes</b> & burning ones: chill them more. Burns stack.');
    expect(underlined(html)).toEqual(['Chilled', 'burning', 'chill', 'Burns']);
    expect(html).toContain('&lt;b>foes&lt;/b> &amp; ');
    const defs = html.split('<div class="gloss">')[1];
    expect(defs.match(/<b>(.*?)<\/b>/g)).toEqual(['<b>Chill</b>', '<b>Burn</b>']);
    expect(glossed('Nothing to explain here.')).toBe('Nothing to explain here.');
  });
});
