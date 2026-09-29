import { SIGNATURE, type RelicId } from '../../config/relics';
import { damageEnemy } from '../combat';
import { line } from '../effects';
import { aOf, awakened, gainWard, nOf, nova, raiseSkeleton, relicDamage, relicHeal, sOf, type RelicHooks } from '../relicCore';

/**
 * 👑 Signature relics (v0.10, #201, RELICS.md): one per champion, no family and no set, each built on its class's signature ability. Only
 * its own class can hold one (config/relics.ts SIGNATURE), so every hook can assume the ability it names.
 */
const C = SIGNATURE.color;

export const SIGNATURE_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  oathkeepersSeal: {
    onAbilityUsed(g) {
      g.vars['seal.kept'] = 0;
    },
    onBlocked(g, ev, p) {
      if (p.abilityTime <= 0) return; // only what Divine Shield turns away
      g.vars['seal.kept'] = Math.min(p.stats.hp * nOf(p, 'oathkeepersSeal').cap, (g.vars['seal.kept'] ?? 0) + ev.amount);
    },
    onAbilityEnd(g, _ev, p) {
      const n = nOf(p, 'oathkeepersSeal');
      nova(g, p.x, p.y, n.radius, relicDamage(p, n.base) + (g.vars['seal.kept'] ?? 0) * (n.stored + n.perS * sOf(p)), 200, C, 'holy');
      g.vars['seal.kept'] = 0;
      if (awakened(p, 'oathkeepersSeal')) gainWard(g, p, p.stats.hp * aOf('oathkeepersSeal').ward); // Sanctified
    },
  },

  jarlsTorc: {
    onAbilityUsed(g) {
      g.vars['torc.extra'] = 0;
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || p.abilityTime <= 0) return;
      const n = nOf(p, 'jarlsTorc');
      for (const e of g.hash.query(ev.enemy.x, ev.enemy.y, n.radius, [])) if (e !== ev.enemy) damageEnemy(g, e, ev.amount * n.cleave, false, 0, 0, 'relic');
    },
    onKill(g, _ev, p) {
      if (!awakened(p, 'jarlsTorc') || p.abilityTime <= 0) return;
      const a = aOf('jarlsTorc'); // Saga's End
      const add = Math.min(a.per, a.max - (g.vars['torc.extra'] ?? 0));
      if (add <= 0) return;
      p.abilityTime += add;
      g.vars['torc.extra'] = (g.vars['torc.extra'] ?? 0) + add;
    },
  },

  dawnstar: {
    onAbilityUsed(g, _ev, p) {
      const n = nOf(p, 'dawnstar');
      const targets = g.hash.query(p.x, p.y, n.range, []).filter((e) => !e.dead).sort((a, b) => b.hp - a.hp).slice(0, n.beams);
      for (const e of targets) {
        line(g, e.x + 10, e.y - 240, e.x, e.y, C);
        const hit = nova(g, e.x, e.y, n.radius, relicDamage(p, n.damage + n.perS * sOf(p)), 80, C, 'holy');
        if (hit && awakened(p, 'dawnstar')) relicHeal(g, p, p.stats.hp * aOf('dawnstar').heal); // Morning Hymn
      }
    },
  },

  phylactery: {
    onAbilityUsed(g, _ev, p) {
      const n = nOf(p, 'phylactery');
      for (let i = 0; i < n.count; i++) {
        const m = raiseSkeleton(g, p, p.x - 40 + i * 80, p.y - 30, 'phylactery', { hp: n.hp, damage: n.damage, life: n.life });
        if (awakened(p, 'phylactery')) m.onEnd = { radius: 80, damage: relicDamage(p, aOf('phylactery').damage), color: C, dtype: 'shadow' }; // Lich's Crown
      }
    },
  },

  eagleFletching: {
    onHit(g, ev, p) {
      const n = nOf(p, 'eagleFletching');
      if (ev.source !== 'ability' || g.rng() >= n.chance) return;
      damageEnemy(g, ev.enemy, ev.amount * (awakened(p, 'eagleFletching') ? aOf('eagleFletching').mult : n.mult), false, 0, 0, 'relic'); // Deadeye
    },
  },
};
