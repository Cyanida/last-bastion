import { ACHIEVEMENTS } from '../config/achievements';
import { CLASSES, type ClassId } from '../config/classes';
import { META, META_IDS, MASTERY } from '../config/economy';
import { ENEMIES } from '../config/enemies';
import { OATHS } from '../config/oaths';
import { TIER_NUMERALS } from '../config/relics';
import { TREASURE_RULES, TREASURES } from '../config/treasures';
import { earnedTier } from './achievements';
import { currentProgress, weeklyContracts } from './contracts';
import { masteryBonus, masteryRank, metaCost } from './economy';
import { chainStep, followUpFrom, inText, nextFragmentBoss } from './treasures';
import type { Save } from './save';

export interface Goal { text: string; frac: number } // frac: how far along, 0-1

/**
 * v0.6: what to do next, for the results screen: the closest goal of each kind (a deed, the class's mastery, its treasure, its next
 * win or Oath, a weekly contract, a Keep rank), the three nearest done.
 */
export function closestGoals(save: Save, classId: ClassId, week: string, n = 3): Goal[] {
  const cls = CLASSES[classId].name;
  const best = (goals: Goal[]) => goals.filter((g) => g.frac < 1).sort((a, b) => b.frac - a.frac)[0];
  const kinds: (Goal | undefined)[] = [];

  kinds.push(best(ACHIEVEMENTS.flatMap((a) => {
    const tier = earnedTier(save, a.id);
    if (tier >= a.tiers.length || (a.hidden && tier === 0) || (a.classId && a.classId !== classId)) return [];
    const target = a.tiers[tier].target;
    const from = tier ? a.tiers[tier - 1].target : 0;
    const now = a.progress(save);
    return [{ text: `${a.name}${a.tiers.length > 1 ? ` ${TIER_NUMERALS[tier + 1]}` : ''}: ${Math.floor(now).toLocaleString('en')} of ${target.toLocaleString('en')}`, frac: Math.max(0, (now - from) / (target - from)) }];
  })));

  const xp = save.classes[classId].xp;
  const rank = masteryRank(xp);
  const next = MASTERY[rank];
  if (next) {
    const prev = rank ? MASTERY[rank - 1].xp : 0;
    kinds.push({ text: `${Math.ceil(next.xp - xp).toLocaleString('en')} class XP to ${cls} mastery ${rank + 1} (${next.name})`, frac: (xp - prev) / (next.xp - prev) });
  }

  const rec = save.treasures[classId];
  const t = TREASURES[classId];
  const unlocked = masteryBonus(xp).treasureStep;
  const step = chainStep(rec, unlocked);
  const boss = nextFragmentBoss(classId, { ...rec, unlocked });
  const chainFrac = (rec.fragments + (rec.trial ? 1 : 0) + rec.tier) / (TREASURE_RULES.fragments + 4);
  if (boss) kinds.push({ text: `Slay ${inText(ENEMIES[boss].name)} with the ${cls} for a fragment of ${inText(t.name)} (${rec.fragments}/${TREASURE_RULES.fragments})`, frac: chainFrac });
  else if (step === 'trial') kinds.push({ text: `${t.trial.name}: the trial for ${inText(t.name)}`, frac: chainFrac });
  else if (step === 'guardian') kinds.push({ text: `Slay ${inText(t.guardian.name)} for ${inText(t.name)}`, frac: chainFrac });
  else if (step === 'tierII' || step === 'tierIII') kinds.push({ text: `${followUpFrom(classId, rec.tier)!.name}: ${inText(t.name)} ${TIER_NUMERALS[rec.tier + 1]}`, frac: chainFrac });

  const oath = save.oaths[classId];
  if (save.wins[classId] === 0) kinds.push({ text: `Beat the Usurper with the ${cls} (best: wave ${save.classes[classId].bestWave} of 40)`, frac: save.classes[classId].bestWave / 40 });
  else if (oath < OATHS.length) kinds.push({ text: `Keep Oath ${oath + 1} (${OATHS[oath].name}) with the ${cls}`, frac: oath / OATHS.length });

  const progress = currentProgress(save.contracts, week);
  kinds.push(best(weeklyContracts(week).map((c, i) => ({ text: `This week: ${c.text} (${progress[i].toLocaleString('en')}/${c.target.toLocaleString('en')}) · ◆ ${c.runes}`, frac: progress[i] / c.target }))));

  kinds.push(best(META_IDS.flatMap((id) => {
    const cost = metaCost(id, save.meta[id] ?? 0, save.buildings);
    if (!cost || cost.runes > save.runes || cost.gold <= save.gold) return []; // capped, short of Runes, or already affordable
    return [{ text: `🪙 ${(cost.gold - save.gold).toLocaleString('en')} more for ${META[id].name} in the Keep`, frac: save.gold / cost.gold }];
  })));

  return kinds.filter((g): g is Goal => !!g && g.frac < 1).sort((a, b) => b.frac - a.frac).slice(0, n);
}
