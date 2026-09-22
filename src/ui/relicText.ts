import { CLASSES } from '../config/classes';
import { RELIC_CATEGORIES, RELIC_MAX_TIER, relicDef, relicDesc, SYNERGIES, TIER_NUMERALS, type RelicId } from '../config/relics';
import { synergiesOf } from '../logic/relics';

/** Everything a relic tooltip says: rarity, category, tier, this tier's effect, the next tier's, and its synergies and clashes. */
export function relicTip(id: RelicId, tier: number, held: RelicId[] = []): string {
  const r = relicDef(id);
  const lines = [`${r.name} · ${r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''} · ${RELIC_CATEGORIES[r.category].name}${tier > 0 ? ` · tier ${TIER_NUMERALS[tier]} of ${TIER_NUMERALS[RELIC_MAX_TIER]}` : ''}`];
  lines.push(relicDesc(id, Math.max(1, tier)));
  if (tier > 0 && tier < RELIC_MAX_TIER) lines.push(`Next tier: ${relicDesc(id, tier + 1)}`);
  else if (tier >= RELIC_MAX_TIER) lines.push('Top tier.');
  for (const sid of synergiesOf(id)) {
    const s = SYNERGIES[sid];
    const others = s.relics.filter((o) => o !== id).map((o) => relicDef(o).name).join(' + ');
    const active = s.relics.every((o) => held.includes(o));
    lines.push(`${s.anti ? '⚠ Clashes with' : active ? '✦ Synergy on with' : '✧ Synergy with'} ${others}: ${s.desc}`);
  }
  return lines.join('\n');
}

export const tierBadge = (tier: number): string => (tier > 1 ? `<i class="tier">${TIER_NUMERALS[tier]}</i>` : '');

/** A relic in a list: icon, name, tier, and the tooltip. */
export function relicLine(id: RelicId, tier: number, held: RelicId[]): string {
  const r = relicDef(id);
  return `<span class="relic-line ${r.rarity}" tabindex="0" data-tip="${esc(relicTip(id, tier, held))}">${r.icon} ${r.name}${tier > 1 ? ` ${TIER_NUMERALS[tier]}` : ''}</span>`;
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
