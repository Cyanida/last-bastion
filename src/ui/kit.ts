/**
 * #185: the UI kit's markup, so screens don't repeat it. Each helper returns an HTML string in the kit's classes (kit.css), for
 * the screens' templates. Labels and inner parts are HTML: escape player text (esc in relicText.ts) before it goes in.
 */

/** The rig's icon atlas (tools/art/ui/icons.ts), in atlas order; tests/v9-ui-kit.test.ts keeps the two the same. */
export const ICON_IDS = [
  'gold', 'runes', 'crown', 'steel', 'flame', 'frost', 'storm', 'holy', 'blood', 'grave', 'map', 'keep',
  'champion', 'relics', 'deeds', 'settings', 'back', 'close', 'sound', 'music', 'lock',
  'crown-squire', 'crown-knight', 'crown-champion', 'crown-legend',
  'common', 'rare', 'legendary', 'class', 'signature',
] as const;
export type IconId = (typeof ICON_IDS)[number];
export type KitRarity = 'common' | 'rare' | 'legendary' | 'class' | 'signature';

/** Extra classes and attributes, e.g. `{ cls: 'whatsnew-link', attrs: 'data-go="whatsNew"' }`. */
interface Extra {
  cls?: string;
  attrs?: string;
}
const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const at = (attrs?: string) => (attrs ? ` ${attrs}` : '');

/** An atlas icon; `s` scales it (whole steps stay crisp). */
export const icon = (id: IconId, s?: number): string => `<i class="kit-icon i-${id}"${s ? ` style="--s:${s}"` : ''}></i>`;

/** A button: gold for the one main action per screen, go (green) for go, wood for the rest. */
export function button(label: string, o: Extra & { kind?: 'gold' | 'go' | 'wood'; size?: 'big' | 'small'; icon?: IconId; disabled?: boolean } = {}): string {
  return `<button class="${cls('kit-btn', o.kind ?? 'wood', o.size, o.cls)}"${at(o.attrs)}${o.disabled ? ' disabled' : ''}>${o.icon ? icon(o.icon) : ''}${label}</button>`;
}

/** The round close (×) or back (←) button in a panel's corner. */
export const closeButton = (kind: 'close' | 'back', o: Extra = {}): string =>
  `<button class="${cls('kit-close', o.cls)}" aria-label="${kind === 'close' ? 'Close' : 'Back'}"${at(o.attrs)}>${icon(kind)}</button>`;

export const ribbon = (html: string, o: Extra = {}): string => `<div class="${cls('kit-ribbon', o.cls)}"${at(o.attrs)}>${html}</div>`;

/** Parchment, for anything you read. */
export const parch = (html: string, o: Extra = {}): string => `<div class="${cls('kit-parch', o.cls)}"${at(o.attrs)}>${html}</div>`;

/** The wood frame with its brass line and rivets. */
export const frame = (html: string, o: Extra = {}): string => `<div class="${cls('kit-frame', o.cls)}"${at(o.attrs)}>${html}</div>`;

/** An icon in the frame of its rarity. */
export const rarityIcon = (rarity: KitRarity, id: IconId, o: Extra & { title?: string } = {}): string =>
  `<span class="${cls('kit-rarity', rarity, o.cls)}"${o.title ? ` title="${o.title}"` : ''}${at(o.attrs)}>${icon(id)}</span>`;

/** A currency: its icon and amount. */
export const pill = (id: IconId, amount: number | string, o: Extra & { title?: string } = {}): string =>
  `<span class="${cls('kit-pill', o.cls)}"${o.title ? ` title="${o.title}"` : ''}${at(o.attrs)}>${icon(id)}${typeof amount === 'number' ? amount.toLocaleString('en') : amount}</span>`;

/** A list row or card: an optional leading icon (in its rarity frame or bare), the body, an optional trailing part (a button, a number). */
export const row = (body: string, o: Extra & { lead?: string; end?: string } = {}): string =>
  `<div class="${cls('kit-row', o.cls)}"${at(o.attrs)}>${o.lead ?? ''}<div class="kit-row-body">${body}</div>${o.end ?? ''}</div>`;

/** An on/off switch for Settings; `name` goes on the checkbox (data-set) for the screen to read. */
export const toggle = (label: string, name: string, on: boolean): string =>
  `<label class="kit-toggle"><span>${label}</span><input type="checkbox" data-set="${name}"${on ? ' checked' : ''}><i></i></label>`;

/** A slider for Settings (volume and the like). */
export const slider = (label: string, name: string, value: number, min = 0, max = 100, step = 1): string =>
  `<label class="kit-slider"><span>${label}</span><input type="range" data-set="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;

/** The tab bar; `on` is the open tab. Wire it with wireTabs. */
export const tabs = (list: readonly { id: string; label: string; icon: IconId }[], on: string): string =>
  `<nav class="kit-tabs" role="tablist">${list.map((t) => `<button class="${cls('kit-tab', t.id === on && 'on')}" role="tab" aria-selected="${t.id === on}" data-tab="${t.id}">${icon(t.icon)}${t.label}</button>`).join('')}</nav>`;

/** The tab bar's clicks: moves .on to the tapped tab and tells the screen. */
export function wireTabs(root: ParentNode, onPick: (id: string) => void): void {
  for (const bar of root.querySelectorAll<HTMLElement>('.kit-tabs')) {
    bar.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('.kit-tab');
      if (!tab || tab.classList.contains('on')) return;
      for (const t of bar.querySelectorAll('.kit-tab')) {
        t.classList.toggle('on', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      }
      onPick(tab.dataset.tab!);
    });
  }
}

/** The main-screen tabs of the road to the crown. */
export const MAIN_TABS = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'champion', label: 'Champion', icon: 'champion' },
  { id: 'keep', label: 'Keep', icon: 'keep' },
  { id: 'relics', label: 'Relics', icon: 'relics' },
  { id: 'deeds', label: 'Deeds', icon: 'deeds' },
] as const;
