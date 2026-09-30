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
export const rarityIcon = (rarity: KitRarity, id: IconId, o: Extra & { title?: string } = {}): string => rarityFrame(rarity, icon(id), o);

/** #187: a glyph (a relic's own emoji, or ? for one not found yet) in the frame of its rarity. */
export const rarityGlyph = (rarity: KitRarity, glyph: string, o: Extra & { title?: string } = {}): string =>
  rarityFrame(rarity, `<b class="kit-glyph">${glyph}</b>`, o);

const rarityFrame = (rarity: KitRarity, inner: string, o: Extra & { title?: string }): string =>
  `<span class="${cls('kit-rarity', rarity, o.cls)}"${o.title ? ` title="${o.title}"` : ''}${at(o.attrs)}>${inner}</span>`;

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

/** #239: a small ⓘ that explains the part beside it; wireInfo opens and closes its text. `key` picks the text, `label` names it. */
export const infoButton = (key: string, label: string): string =>
  `<button class="kit-info" data-info="${key}" aria-label="${label}" aria-expanded="false">i</button>`;

/**
 * #239: the ⓘ buttons under `root`: a tap opens `texts[key]` in a small parchment popup beside the button; the same ⓘ, its ×, a tap
 * elsewhere or close() shuts it. Returns close(), true when a popup was open, so a screen's Escape closes the popup before the screen.
 * `root` is the screen's own frame, not the overlay: the listener has to go when the screen does.
 */
export function wireInfo(root: HTMLElement, texts: Record<string, string>): { close: () => boolean } {
  const pop = root.appendChild(Object.assign(document.createElement('div'), { className: 'kit-info-pop', role: 'dialog', hidden: true }));
  let owner: HTMLElement | null = null;
  const close = () => {
    if (!owner) return false;
    owner.setAttribute('aria-expanded', 'false');
    owner = null;
    pop.hidden = true;
    return true;
  };
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLElement>('[data-info]');
    if (pop.contains(t) && !t.closest('.kit-close')) return;
    const was = owner;
    close();
    if (!btn || btn === was) return;
    owner = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.setAttribute('aria-label', btn.getAttribute('aria-label') ?? '');
    pop.innerHTML = `<p>${texts[btn.dataset.info!] ?? ''}</p>${closeButton('close')}`;
    pop.hidden = false;
    // beside the button, kept on screen; the zoomed overlay's pixels are the window's over --ui-scale (tooltip.ts)
    const s = Number(document.documentElement.style.getPropertyValue('--ui-scale')) || 1;
    const r = btn.getBoundingClientRect(), p = pop.getBoundingClientRect();
    const top = r.bottom + 6 + p.height <= innerHeight ? r.bottom + 6 : Math.max(6, r.top - 6 - p.height);
    pop.style.top = `${top / s}px`;
    pop.style.left = `${Math.min(Math.max(6, r.left + r.width / 2 - p.width / 2), innerWidth - p.width - 6) / s}px`;
  });
  return { close };
}

/** The main-screen tabs of the road to the crown. */
export const MAIN_TABS = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'champion', label: 'Champion', icon: 'champion' },
  { id: 'keep', label: 'Keep', icon: 'keep' },
  { id: 'relics', label: 'Relics', icon: 'relics' },
  { id: 'deeds', label: 'Deeds', icon: 'deeds' },
] as const;
