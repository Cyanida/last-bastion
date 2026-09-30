import { STATUS_TUNING, STATUSES } from './damage';
import { ELITES } from './elites';
import { SKILL } from './game';
import { OATHS } from './oaths';
import { ATTUNEMENT, RELIC_MAX_TIER, TIER_NUMERALS } from './relics';
import { WORLD } from './world';
import type { SlotBlock } from '../logic/champions';
import type { TourStep } from '../logic/tour';

/**
 * v0.7.1: the game's own words, defined once. Every tooltip underlines the ones it uses and adds their definitions (ui/tooltip.ts);
 * the Glossary page (pause menu, the Keep) lists them all. `forms` are the words that count as the term, matched whole and in any case.
 * Numbers come from the config they describe, so a balance change cannot leave a definition behind.
 */
export interface Term {
  name: string;
  forms: string[];
  def: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const s = STATUSES;
const t = STATUS_TUNING;

export const GLOSSARY: Term[] = [
  { name: 'Burn', forms: ['burn', 'burns', 'burning', 'burned', 'burnt'], def: `Fire damage over time. Stacks up to ${s.burn.maxStacks} times and lasts ${s.burn.duration} s, renewed by every new burn.` },
  { name: 'Chill', forms: ['chill', 'chills', 'chilled', 'chilling'], def: `Slows by ${pct(t.slowPerStack)} a stack. At ${t.freezeAt} stacks it becomes a freeze. Bosses cannot be chilled.` },
  { name: 'Freeze', forms: ['freeze', 'freezes', 'freezing', 'frozen', 'froze'], def: `${t.freezeAt} stacks of chill freeze a target: it cannot move or act for ${t.freezeTime} s, and cannot be chilled again for ${t.freezeImmunity} s.` },
  { name: 'Bleed', forms: ['bleed', 'bleeds', 'bleeding'], def: `Physical damage over time. Stacks up to ${s.bleed.maxStacks} times and lasts ${s.bleed.duration} s.` },
  { name: 'Poison', forms: ['poison', 'poisons', 'poisoned', 'poisonous'], def: `Shadow damage over time. It does not stack: the strongest dose counts, and each new one adds time, up to ${t.poisonMaxTime} s.` },
  { name: 'Curse', forms: ['curse', 'curses', 'cursed'], def: `A cursed target takes ${pct(t.cursePerStack)} more damage a stack, up to ${s.curse.maxStacks} stacks. On the champion select screen, curses are hardships you choose that raise the gold and class XP a run earns.` },
  { name: 'Evolution', forms: ['evolution', 'evolutions', 'evolve', 'evolves', 'evolved'], def: 'A signature or second ability transformed. Complete one of its recipes in a run (an ability upgrade plus a keystone, a talent or a relic) and the next level-up offers it as a gold card.' },
  { name: 'Elite', forms: ['elite', 'elites'], def: `A stronger version of a regular enemy, with ${ELITES.hpMult}× HP, one or more affixes and an orange outline. Worth more XP and gold.` },
  { name: 'Commander', forms: ['commander', 'commanders'], def: 'An enemy that does not fight but makes the enemies around it hit harder, move faster or heal. It wears a gold outline, and its squad reacts when it falls: kill it first.' },
  { name: 'Perfect dodge', forms: ['perfect dodge', 'perfect dodges'], def: `Step out of a marked attack in its last ${SKILL.perfect.window} s (or roll, blink or leap through it) for ${pct(SKILL.perfect.damage - 1)} more damage for ${SKILL.perfect.time} s and ${pct(SKILL.perfect.refund)} of your signature ability's cooldown back.` },
  { name: 'Last Stand', forms: ['last stand'], def: `Once a run, the blow that would kill you leaves you at 1 HP, untouchable for ${SKILL.lastStand.time} s, while your signature ability cools down ${pct(SKILL.lastStand.cooldownRate - 1)} faster.` },
  { name: 'Oath', forms: ['oath', 'oaths'], def: `Open once a champion has won. Oaths 1 to ${OATHS.length} each add one fixed hardship on top of those below it; the first win at each Oath pays Runes and gold.` },
  // v0.7.1 B5: the relic words
  { name: 'Attunement', forms: ['attunement', 'attune', 'attunes', 'attuned'], def: `A relic's growth. Its bar fills as the relic does its work (damage through it, healing, ward or damage prevented, statuses it applies, skeletons it raises), up to ${pct(ATTUNEMENT.workCap)} of a bar a wave, plus a little for every wave cleared and elite slain. A full bar raises it a tier: II strengthens it, ${TIER_NUMERALS[RELIC_MAX_TIER]} awakens it.` },
  { name: 'Awakened', forms: ['awakened', 'awaken', 'awakens', 'awakening'], def: `A relic attuned to tier ${TIER_NUMERALS[RELIC_MAX_TIER]}, its last: it keeps tier II's numbers and gains an extra behaviour with its own name (Hoarfrost, Wyrmfire, Covenant...). A cursed relic's awakening lifts its curse.` },
  { name: 'Set bonus', forms: ['set bonus', 'set bonuses', '2-set', '4-set', '6-set'], def: `What a family gives for holding 2, 4 and 6 of its relics, each changing how you play (Flame: Stoked, Pyre, Inferno). Only one family reaches its 6 in a run; any other stops at its 4.` },
  { name: 'Duo', forms: ['duo', 'duos'], def: 'A relic made of two: hold one named relic from each of two families and a wave boss or a lair can offer their duo as a gold fourth card (it takes the pick). It combines the two into one relic with both their effects and its own, attuning as one up to tier III; the families keep the counts of both relics, and each relic feeds only one duo.' },
  { name: 'Cursed relic', forms: ['cursed relic', 'cursed relics'], def: 'A relic of no family, far stronger than the others but with a drawback. At most one is offered an Act, as the purple third card of a wave boss or lair. Awakening it lifts the curse.' },
];

const L = WORLD.loadout;

/** #239: why a relic can't go in a slot (logic/champions slotBlock), in the player's words: the champion screen says it on hover and tap. */
export const SLOT_BLOCK_TEXT: Record<SlotBlock, string> = {
  cursed: 'A cursed relic never goes in a loadout.',
  otherClass: "Another class's relic.",
  slotted: 'In a slot already: tap the slot to take it out.',
  slots: 'No free slot for it.',
  double: `A legendary takes ${L.legendarySlots} slots, and only 1 is free.`,
  family: `At most ${L.perFamily} relics of one family.`,
  legendary: `At most ${L.legendaries} legendary (${L.legendariesFinale} in the Last Bastion).`,
  classRelics: `At most ${L.classRelics} class relics.`,
};

/** #239: the champion screen's ⓘ explanations, one or two plain sentences each (#240's tabs and tour reuse them). */
export const CHAMPION_HELP = {
  slots: `The relics in your slots go into the level with you; locked slots open on later levels, and the Keep adds more. A legendary takes ${L.legendarySlots} slots, and a loadout holds at most ${L.perFamily} relics of one family, ${L.legendaries} legendary (${L.legendariesFinale} in the Last Bastion) and ${L.classRelics} class relics.`,
  sets: 'Slotted relics of one family count toward its set: 2, 4 and 6 of them each add a bonus in the level. A lit chip has its bonus on; hover or tap a chip to read them.',
  talents: 'A level starts with a head start: your champion is already some levels up, with talent points to spend. The plan spends them for you, in its order; a point it can’t place yet is yours to spend.',
} as const;

/** #240: the champion screen's own tabs: one shows at a time, and PLAY stays under all three. */
export const CHAMPION_TABS = [
  { id: 'loadout', label: 'Loadout' },
  { id: 'build', label: 'Build' },
  { id: 'talents', label: 'Talents' },
] as const;
export type ChampionTab = (typeof CHAMPION_TABS)[number]['id'];

/** #240: the Build tab until champion levels fill it (#241): one plain line. */
export const CHAMPION_BUILD_TEXT = 'Stat points come with champion levels: once your champion earns them, you spend them here.';

/** #240: the champion screen's tour, shown the first time the screen opens and again from its ⓘ: one sentence a step, each at the part it names. */
export const CHAMPION_TOUR: readonly TourStep[] = [
  { id: 'slots', at: '.cs-slots', text: 'These are your slots: the relics in them go into the level with you.' },
  { id: 'inventory', at: '.cs-inventory', text: 'Your inventory holds the relics this champion has won: tap one to put it in a slot, and tap a slot to take it out again.' },
  { id: 'legendary', at: '.cs-slots', text: `A legendary relic takes ${L.legendarySlots} slots, and a loadout holds only ${L.legendaries} of them.` },
  { id: 'build', at: '.cs-tabs', text: 'Build and Talents are the other tabs: your champion’s stat points, and the talents its head start takes.' },
  { id: 'play', at: '.cs-go', text: 'PLAY starts the next level of the road with this loadout, from any tab.' },
];
