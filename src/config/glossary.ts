import { STATUS_TUNING, STATUSES } from './damage';
import { ELITES } from './elites';
import { SKILL } from './game';
import { OATHS } from './oaths';
import { ATTUNEMENT, DUO_SIX_STRENGTH, RELIC_MAX_TIER, TIER_NUMERALS } from './relics';

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
  { name: 'Set bonus', forms: ['set bonus', 'set bonuses', '2-set', '4-set', '6-set'], def: `What a family gives for holding 2, 4 and 6 of its relics, each changing how you play (Flame: Stoked, Pyre, Inferno). A duo counts toward both its families. Your champion can reach the 6 of its three preferred families with their relics alone; a 6 completed with a duo works at ${pct(DUO_SIX_STRENGTH)} strength.` },
  { name: 'Duo', forms: ['duo', 'duos'], def: 'A relic made of two: hold one named relic from each of two families and a wave boss or a lair can offer their duo as a gold fourth card (it takes the pick). It counts toward both families, and each relic feeds only one duo.' },
  { name: 'Cursed relic', forms: ['cursed relic', 'cursed relics'], def: 'A relic of no family, far stronger than the others but with a drawback. At most one is offered an Act, as the purple third card of a wave boss or lair. Awakening it lifts the curse.' },
];
