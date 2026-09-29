import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIcons, iconPaths, ICONS } from '../tools/art/ui/icons';
import * as kit from '../src/ui/kit';

describe('#184 UI kit icon atlas', () => {
  it('the committed atlas and its CSS match their definitions (run `npm run art` when this fails)', () => {
    const { png, css } = buildIcons();
    expect(Buffer.compare(png, readFileSync(iconPaths.png)) === 0, `${iconPaths.png} is out of date`).toBe(true);
    expect(readFileSync(iconPaths.css, 'utf8').replace(/\r\n/g, '\n')).toBe(css);
    expect(buildIcons().png.equals(png)).toBe(true); // deterministic
  });

  it('kit.ts lists the atlas in its order (#185)', () => {
    expect([...kit.ICON_IDS]).toEqual(ICONS.map(([id]) => id));
  });

  it('the atlas has what the next screens need (#185)', () => {
    const need = ['steel', 'flame', 'frost', 'storm', 'holy', 'blood', 'grave', 'common', 'rare', 'legendary', 'class', 'signature',
      'crown', 'crown-squire', 'crown-knight', 'crown-champion', 'crown-legend', 'map', 'champion', 'keep', 'relics', 'deeds',
      'settings', 'back', 'close', 'sound', 'music', 'lock', 'gold', 'runes'];
    for (const id of need) expect(kit.ICON_IDS as readonly string[], id).toContain(id);
  });

  it('every icon the screens ask for is in the atlas', () => {
    const ids = new Set(ICONS.map(([id]) => id));
    const src = readFileSync('src/ui/screens.ts', 'utf8');
    const used = [...src.matchAll(/kit-icon i-([a-z-]+)|kit\.(?:icon|pill)\('([a-z-]+)'|icon: '([a-z-]+)'/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(ids.has(id), id).toBe(true);
  });
});

// No DOM in the unit tests (node, no jsdom): the markup is checked as text here, and rendered and clicked in the play test.
describe('#185 UI kit helpers', () => {
  it('button: kind, size, icon, extra classes and attributes, disabled; wood by default', () => {
    expect(kit.button('Fight!', { kind: 'gold', size: 'big', icon: 'crown', cls: 'x', attrs: 'data-go="start"' })).toBe(
      '<button class="kit-btn gold big x" data-go="start"><i class="kit-icon i-crown"></i>Fight!</button>',
    );
    expect(kit.button('Rest')).toBe('<button class="kit-btn wood">Rest</button>');
    expect(kit.button('Locked', { disabled: true })).toBe('<button class="kit-btn wood" disabled>Locked</button>');
  });

  it('frame, parchment, ribbon, rarity frame, pill, row, close', () => {
    expect(kit.frame(kit.parch('<b>Hi</b>', { cls: 'contracts' }))).toBe('<div class="kit-frame"><div class="kit-parch contracts"><b>Hi</b></div></div>');
    expect(kit.ribbon('The Marches')).toBe('<div class="kit-ribbon">The Marches</div>');
    expect(kit.rarityIcon('signature', 'holy', { title: 'Saint' })).toBe('<span class="kit-rarity signature" title="Saint"><i class="kit-icon i-holy"></i></span>');
    expect(kit.pill('gold', 12480)).toBe('<span class="kit-pill"><i class="kit-icon i-gold"></i>12,480</span>');
    expect(kit.icon('lock', 2)).toBe('<i class="kit-icon i-lock" style="--s:2"></i>');
    expect(kit.row('<b>Relic</b>', { lead: 'L', end: 'E', cls: 'on' })).toBe('<div class="kit-row on">L<div class="kit-row-body"><b>Relic</b></div>E</div>');
    expect(kit.closeButton('back')).toBe('<button class="kit-close" aria-label="Back"><i class="kit-icon i-back"></i></button>');
  });

  it('toggle and slider carry their setting', () => {
    expect(kit.toggle('Music', 'music', true)).toContain('<input type="checkbox" data-set="music" checked>');
    expect(kit.toggle('Music', 'music', false)).not.toContain('checked');
    expect(kit.slider('Volume', 'volume', 40)).toContain('<input type="range" data-set="volume" min="0" max="100" step="1" value="40">');
  });

  it('the tab bar opens exactly the given tab', () => {
    const html = kit.tabs(kit.MAIN_TABS, 'champion');
    expect(html.match(/class="kit-tab(?: on)?"/g)).toEqual(['class="kit-tab"', 'class="kit-tab on"', 'class="kit-tab"', 'class="kit-tab"', 'class="kit-tab"']);
    expect(html.match(/i-[a-z]+/g)).toEqual(['i-map', 'i-champion', 'i-keep', 'i-relics', 'i-deeds']);
  });
});
