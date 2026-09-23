import { STATUS_TUNING, STATUSES } from './damage';
import { ELITES } from './elites';
import { SKILL } from './game';
import { OATHS } from './oaths';

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
];
