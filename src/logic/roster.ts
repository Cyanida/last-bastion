import type { ClassDef } from '../config/classes';
import type { StatKey } from '../core/types';
import { statLabel } from './upgrades';

/** #65: a champion's base stat as a share of the roster's highest (0..1), for the bars on the champion select. */
export function statShare(roster: readonly ClassDef[], key: StatKey, value: number): number {
  const max = Math.max(0, ...roster.map((c) => c.base[key]));
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}

/** #65: what the stat bars don't show: how it attacks, its armour and regeneration, its ability's cooldown. */
export function classFacts(c: ClassDef): { label: string; value: string }[] {
  return [
    { label: 'Attack', value: `${c.attack.kind === 'melee' ? 'Melee' : 'Ranged'} · ${statLabel(c.attack.scaling, c)}` },
    { label: 'Reach', value: String(c.attack.range) },
    { label: 'Armor', value: `${Math.round(c.armor * 100)}%` },
    { label: 'Regen', value: `${c.regen} HP/s` },
    { label: 'Cooldown', value: `${c.ability.cooldown}s` },
  ];
}
