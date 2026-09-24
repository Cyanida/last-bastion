// scratch (B8): a class-value variant against sim -- deep's seeds and setups. VARIANT=name CLS=archer npx vite-node scratch-b8.ts
import { CLASSES, type ClassId } from './src/config/classes';
import { MASTERY, META, META_IDS } from './src/config/economy';
import { simulateRun } from './src/sim/bot';

const cls = process.env.CLS as ClassId;
const variant = process.env.VARIANT ?? 'base';
const c = CLASSES[cls] as unknown as { base: Record<string, number>; growth: Record<string, number>; attack: Record<string, number>; ability: Record<string, number>; regen: number };
const PATCHES: Record<string, () => void> = {
  base: () => {},
  hp: () => (c.base.hp += 15),
  hpRegen: () => ((c.base.hp += 15), (c.regen += 0.3)),
  dmg: () => ((c.attack.damage *= 1.15), (c.ability.damage && (c.ability.damage *= 1.15)), (c.ability.minionDamage && (c.ability.minionDamage *= 1.15))),
  hpDmg: () => ((c.base.hp += 15), (c.attack.damage *= 1.1), (c.ability.damage && (c.ability.damage *= 1.1)), (c.ability.minionDamage && (c.ability.minionDamage *= 1.1))),
  minions: () => ((c.ability.minions += 1)),
  hpMinions: () => ((c.base.hp += 15), (c.ability.minions += 1)),
  growth: () => ((c.growth.hp += 2)),
  hpGrowth: () => ((c.base.hp += 10), (c.growth.hp += 2)),
  archerA: () => ((c.base.hp = 105), (c.growth.hp = 6), (c.attack.damage = 13)),
  necroA: () => ((c.base.hp = 100), (c.growth.hp = 6), (c.ability.minionDamage = 12.5)),
  necroB: () => ((c.base.hp = 100), (c.growth.hp = 6), (c.ability.minions = 3)),
};
PATCHES[variant]();
const maxed = Object.fromEntries(META_IDS.map((id) => [id, META[id].max]));
const setups = { fresh: { tier: 0, arena: 'courtyard' as const }, maxed: { tier: 0, arena: 'courtyard' as const, meta: maxed, classXp: MASTERY[MASTERY.length - 1].xp, treasure: 3 } };
const out: string[] = [];
for (const [name, opts] of Object.entries(setups).filter(([n]) => !process.env.SETUP || n === process.env.SETUP)) {
  const rs = Array.from({ length: Number(process.env.SEEDS ?? 6) }, (_, i) => simulateRun(cls, 1000 + i, opts, i % 2, 60 * 60, true));
  const w = rs.map((r) => r.wave);
  out.push(`${name} ${(w.reduce((a, b) => a + b, 0) / w.length).toFixed(1)} [${w.join(',')}] won ${rs.filter((r) => r.won).length}`);
}
console.log(`${cls} ${variant}: ${out.join(' · ')}`);
