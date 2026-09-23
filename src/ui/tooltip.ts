import { GLOSSARY, type Term } from '../config/glossary';
import { clamp } from '../core/math';
import { esc } from './relicText';

/**
 * One floating tooltip for every `[data-tip]` element, menus and HUD alike (v0.5). CSS pseudo-element tooltips were clipped by
 * scrolling dialogs and the screen edge, and caught the pointer themselves, so a tooltip over a neighbour kept the wrong element
 * hovered. This one sits above its element (below when there is no room), stays inside the window and never takes the pointer.
 * Hover shows it on desktop, a tap (focus) on touch; it goes away when the pointer leaves, on a click, or on scroll.
 * v0.7.1: glossary terms in a tip are underlined and explained underneath (glossed).
 */
let box: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
const GAP = 8;
const EDGE = 6;

function place(el: HTMLElement): void {
  const text = el.dataset.tip;
  if (!text) return hide();
  box ??= document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tooltip' }));
  owner = el;
  box.innerHTML = glossed(text);
  box.classList.toggle('hud', el.closest('#hud') !== null);
  box.style.display = 'block';
  const r = el.getBoundingClientRect();
  const t = box.getBoundingClientRect();
  const above = r.top - t.height - GAP >= EDGE;
  box.style.top = `${above ? r.top - t.height - GAP : clamp(r.bottom + GAP, EDGE, window.innerHeight - t.height - EDGE)}px`;
  box.style.left = `${clamp(r.left + r.width / 2 - t.width / 2, EDGE, window.innerWidth - t.width - EDGE)}px`;
}

function hide(): void {
  if (box) box.style.display = 'none';
  owner = null;
}

const TERM_OF = new Map<string, Term>(GLOSSARY.flatMap((term) => term.forms.map((f) => [f, term] as const)));
const TERMS = new RegExp(`\\b(${[...TERM_OF.keys()].sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

/** v0.7.1: a tip as HTML: every glossary term underlined, and each one's definition once underneath, in the order they came up. */
export function glossed(text: string): string {
  const found: Term[] = [];
  const body = esc(text).replace(TERMS, (word) => {
    const term = TERM_OF.get(word.toLowerCase())!;
    if (!found.includes(term)) found.push(term);
    return `<u>${word}</u>`;
  });
  return found.length ? `${body}<div class="gloss">${found.map((term) => `<b>${term.name}</b>: ${term.def}`).join('<br>')}</div>` : body;
}

const tipOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null);

export function initTooltips(): void {
  document.addEventListener('pointerover', (e) => {
    const el = tipOf(e.target);
    if (el !== owner) (el ? place(el) : hide());
  });
  document.addEventListener('focusin', (e) => {
    const el = tipOf(e.target);
    if (el) place(el);
  });
  document.addEventListener('pointerleave', hide);
  document.addEventListener('click', () => owner && !owner.isConnected && hide(), true); // the screen it belonged to is gone
  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
}

/** A screen re-rendered under the pointer: drop a tooltip whose element no longer exists. Called by show() in screens.ts. */
export function dropStaleTooltip(): void {
  if (owner && !owner.isConnected) hide();
}
