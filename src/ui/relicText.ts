import { CLASSES } from '../config/classes';
import { duoOf, DUOS, FAMILIES, isCursedRelic, isDuo, isFamily, RELIC_MAX_TIER, relicDef, relicDesc, TIER_NUMERALS, type DuoId, type RelicId, type RelicKey } from '../config/relics';
import { EVOLUTIONS } from '../config/evolutions';
import { nearlyReady, requirementNames, requirementText, type BuildState } from '../logic/evolutions';

let recipeBuild: BuildState | null = null;
/** v0.6: the build the tooltips read evolution recipes against. main.ts sets it while a run is on and clears it in the menus. */
export function setRecipeBuild(b: BuildState | null): void {
  recipeBuild = b;
}
/** v0.6: "one step from an evolution" lines for a relic or talent that is the missing half of a recipe. */
export function recipeLines(what: { relic?: RelicId; talent?: string }): string[] {
  if (!recipeBuild) return [];
  return nearlyReady(recipeBuild)
    .filter((n) => requirementNames(n.missing, what))
    .map((n) => `✦ One step from ${EVOLUTIONS[n.id].icon} ${EVOLUTIONS[n.id].name}: it needs ${requirementText(n.missing)}`);
}

/** Everything a relic tooltip says: family, rarity, tier, this tier's effect, what attunement brings next, and the evolution recipes. */
export function relicTip(id: RelicId, tier: number, held: RelicId[] = []): string {
  const r = relicDef(id);
  const fam = r.family && FAMILIES[r.family];
  const count = held.filter((h) => relicDef(h).family === r.family).length;
  const lines = [`${r.name} · ${fam ? `${fam.icon} ${fam.name} · ${r.rarity}` : '☠ cursed'}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}${tier > 0 ? ` · tier ${TIER_NUMERALS[tier]} of ${TIER_NUMERALS[RELIC_MAX_TIER]}` : ''}`];
  lines.push(relicDesc(id, Math.max(1, tier)));
  if (tier > 0 && tier < RELIC_MAX_TIER) lines.push('Attunes as it does its work (the bar under it): damage, healing or protection through it, and a little every wave and elite.');
  if (tier < 2) lines.push(`Tier II: ${relicDesc(id, 2)}`);
  if (tier < RELIC_MAX_TIER) lines.push(`Awakens at tier III, ${r.awaken.name}: ${r.awaken.desc}`);
  lines.push(fam ? `${fam.name} (${fam.mechanic}), ${count} held: ${([2, 4, 6] as const).map((n) => `${n} ${fam.sets[n][0]}`).join(' · ')}` : 'A cursed relic: no family, so it counts toward no set bonus. Awakening it lifts the curse.');
  const duo = duoOf(id);
  if (duo) lines.push(`Duo: with ${relicDef(DUOS[duo].from.find((s) => s !== id)!).name} it forms ${DUOS[duo].icon} ${DUOS[duo].name}`);
  lines.push(...recipeLines({ relic: id }));
  return lines.join('\n');
}

/**
 * v0.7 A5: a duo's tooltip: its families, sources and effect. v0.7.5 (#96): a formed duo (`tier` > 0) is the one relic its sources became, so it
 * lists their effects at its tier too.
 */
export function duoTip(id: DuoId, tier = 0): string {
  const d = DUOS[id];
  const head = `${d.name} · duo · ${d.families.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' + ')}${tier > 0 ? ` · tier ${TIER_NUMERALS[tier]} of ${TIER_NUMERALS[RELIC_MAX_TIER]}` : ''}`;
  const joined = tier > 0 ? d.from.map((r) => `${relicDef(r).icon} ${relicDef(r).name}: ${relicDesc(r, tier)}`) : [];
  return [head, d.desc, ...joined, `Combines ${d.from.map((r) => relicDef(r).name).join(' + ')} into one relic that attunes as one, up to tier ${TIER_NUMERALS[RELIC_MAX_TIER]}; each family keeps its count.`].join('\n');
}
/** A relic's, a duo's or a set's tooltip. `held` may hold duos and sets too (the results table's rows): only the relics count for the family line. */
export const keyTip = (id: RelicKey, tier: number, held: RelicKey[] = []): string =>
  isDuo(id) ? duoTip(id, tier) : isFamily(id) ? `${FAMILIES[id].name} set bonuses: ${([2, 4, 6] as const).map((n) => `${n} ${FAMILIES[id].sets[n][0]}`).join(' · ')}` : relicTip(id, tier, held.filter((k): k is RelicId => !isDuo(k) && !isFamily(k)));

/** v0.7.1 B6: a relic's style: its rarity, or cursed (purple). */
export const relicClass = (id: RelicId): string => (isCursedRelic(id) ? 'cursed' : relicDef(id).rarity);

export const tierBadge = (tier: number): string => (tier > 1 ? `<i class="tier">${TIER_NUMERALS[tier]}</i>` : '');

/** A relic in a list: icon, name, tier, and the tooltip. */
export function relicLine(id: RelicId, tier: number, held: RelicId[]): string {
  const r = relicDef(id);
  return `<span class="relic-line ${relicClass(id)}" tabindex="0" data-tip="${esc(relicTip(id, tier, held))}">${r.icon} ${r.name}${tier > 1 ? ` ${TIER_NUMERALS[tier]}` : ''}</span>`;
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
