import { GAME } from '../../config/game';
import { FAMILIES, type RelicId, type RelicKey, type SetLevel } from '../../config/relics';
import { emit } from '../../core/events';
import type { Enemy, Game } from '../../core/types';
import { addField } from '../../entities/hazards';
import * as scale from '../../logic/abilities';
import { applyStatus, damageEnemy, nearestEnemy } from '../combat';
import { ring } from '../effects';
import { addChill, attackHit, awakened, bonus, credit, gainWard, isChilled, isFrozen, nOf, nova, relicDamage, relicHeal, sOf, type RelicHooks } from '../relicCore';
import { relicContext } from '../relicContext';

/**
 * ❄️ Frost (RELICS.md): chill → freeze → shatter. Relics chill, reward frozen enemies or protect you while the horde is cold; the sets build
 * chill faster (Biting Cold, in combat.applyStatus), shatter the frozen on death (Shatter) and freeze whatever touches you (Rimewalker).
 */
const F = FAMILIES.frost;
const NEAR = 300;

/** Freeze an enemy for `time` seconds outright (Frozen Volley, Rimewalker). */
export function freeze(g: Game, e: Enemy, time: number): void {
  if (e.def.boss) return;
  applyStatus(e, { apply: [{ id: 'stun', time }] }, g);
  e.frozenT = Math.max(e.frozenT, g.time + time);
  emit(g, 'onFreeze', { enemy: e }); // as a chill that tips over does (combat.applyStatus)
}

const touchCd = new WeakMap<Enemy, number>();
const legion = new WeakSet<object>();

export const FROST_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  frostBrand: {
    onHit(g, ev, p) {
      const n = nOf(p, 'frostBrand');
      if (!attackHit(p, ev.source) || g.rng() >= n.chance) return;
      addChill(g, p, ev.enemy, n.chill);
    },
    onIncoming(g, ev, p) {
      if (!awakened(p, 'frostBrand') || !ev.attacker || !isChilled(ev.attacker)) return;
      credit(g, p, 'frostBrand', 'prevented', ev.amount * 0.2);
      ev.amount *= 0.8; // Hoarfrost
    },
  },

  wintersGrasp: {
    onHit(g, ev, p) {
      if (ev.source !== 'ability') return;
      const was = isFrozen(g, ev.enemy);
      addChill(g, p, ev.enemy, nOf(p, 'wintersGrasp').chill);
      if (!was && isFrozen(g, ev.enemy) && awakened(p, 'wintersGrasp') && ev.enemy.statuses.stun) {
        ev.enemy.statuses.stun.time += 1; // Deep Freeze
        ev.enemy.frozenT += 1;
      }
    },
  },

  shatterglass: {
    onHit(g, ev, p) {
      if (ev.source === 'relic' || ev.source === 'hazard' || !isFrozen(g, ev.enemy)) return;
      const n = nOf(p, 'shatterglass');
      // a hit on a frozen enemy always crits: the missing crit (or the extra crit damage) as relic damage on top
      const extra = ev.crit ? (ev.amount * n.critDamage) / GAME.critMult : ev.amount * (GAME.critMult - 1 + n.critDamage);
      damageEnemy(g, ev.enemy, extra, true, 0, 0, 'relic', 'frost');
      if (!awakened(p, 'shatterglass')) return;
      // Splinter: three ice shards at the nearest enemies
      let from: Enemy = ev.enemy;
      for (let i = 0; i < 3; i++) {
        const to = nearestEnemy(g, ev.enemy.x, ev.enemy.y, 180, from);
        if (!to) break;
        damageEnemy(g, to, relicDamage(p, 10), false, 0, 0, 'relic', 'frost');
        addChill(g, p, to, 1);
        from = to;
      }
    },
  },

  glacialHeart: {
    onIncoming(g, ev, p) {
      const n = nOf(p, 'glacialHeart');
      if (g.hash.query(p.x, p.y, n.radius, []).filter(isChilled).length < n.count) return;
      credit(g, p, 'glacialHeart', 'prevented', ev.amount * n.reduce, true);
      ev.amount *= 1 - n.reduce;
    },
    onFreeze(g, ev, p) {
      if (awakened(p, 'glacialHeart') && Math.hypot(ev.enemy.x - p.x, ev.enemy.y - p.y) < NEAR) g.vars['coldBlood.until'] = g.time + 2; // Cold Blood
    },
    tick(g, _dt, p) {
      if (g.time < (g.vars['coldBlood.until'] ?? 0)) bonus(p, 'atkSpd', 0.2);
    },
  },

  everfrostCrown: {
    tick(g, dt, p) {
      const n = nOf(p, 'everfrostCrown');
      if ((g.vars['crown.t'] = (g.vars['crown.t'] ?? 0) + dt) < n.every) return;
      g.vars['crown.t'] = 0;
      for (const e of g.hash.query(p.x, p.y, n.radius, [])) addChill(g, p, e, n.chill);
      ring(g, p.x, p.y, n.radius, F.color, 0.5);
      if (awakened(p, 'everfrostCrown')) addField(g, { x: p.x, y: p.y, r: n.radius * 0.8, life: 3, dps: relicDamage(p, 6), hostile: false, color: F.color, dtype: 'frost', apply: { id: 'slow', stacks: 1 } }); // Blizzard
    },
  },

  rimebow: {
    onHit(g, ev, p) {
      const n = nOf(p, 'rimebow');
      if (ev.source === 'ability' && awakened(p, 'rimebow')) freeze(g, ev.enemy, 0.5); // Frozen Volley
      if (attackHit(p, ev.source) && ev.crit) addChill(g, p, ev.enemy, n.chill, 3 * (1 + n.perFocus * sOf(p)));
    },
  },

  frostwardHalo: {
    onHit(g, ev, p) {
      if (ev.source === 'ability') addChill(g, p, ev.enemy, nOf(p, 'frostwardHalo').chill);
    },
    onAbilityUsed(g, _ev, p) {
      const ability = p.cls.ability;
      if (ability.id !== 'heavenlyRadiance') return;
      const n = nOf(p, 'frostwardHalo');
      const frozen = Math.min(n.max, g.hash.query(p.x, p.y, NEAR, []).filter((e) => isFrozen(g, e)).length);
      if (frozen) relicHeal(g, p, scale.heavenlyRadiance(ability, sOf(p)).heal * n.heal * frozen, true);
    },
    onFreeze(g, ev, p) {
      if (awakened(p, 'frostwardHalo') && Math.hypot(ev.enemy.x - p.x, ev.enemy.y - p.y) < NEAR) gainWard(g, p, p.stats.hp * 0.02); // Winter Grace
    },
  },

  lichLantern: {
    onHit(g, ev, p) {
      if (ev.source === 'minion') addChill(g, p, ev.enemy, 1 + Math.floor(sOf(p) / nOf(p, 'lichLantern').per));
    },
    tick(g, _dt, p) {
      if (!awakened(p, 'lichLantern')) return;
      for (const m of g.minions) {
        // Frost Legion: every skeleton (not the quest and event units) bursts in a frost nova when it falls or fades
        if (m.kind || m.onEnd || legion.has(m)) continue;
        legion.add(m);
        m.onEnd = { radius: 80, damage: relicDamage(p, 12), color: F.color, dtype: 'frost' };
      }
    },
  },
};

export const FROST_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  // 2 Biting Cold lives in combat.applyStatus: chill from the player builds 50% faster
  4: {
    onKill(g, ev, p) {
      const e = ev.enemy;
      if (!isFrozen(g, e) || e.def.boss) return; // Shatter
      relicContext.acting = (e.statuses.stun?.by as RelicKey | undefined) ?? 'frost'; // the relic whose chill froze it made the shatter (A8)
      nova(g, e.x, e.y, F.n.shatterRadius, e.maxHp * (F.n.shatterFrac + F.n.shatterPerS * sOf(p)), 140, F.color, 'frost');
      relicContext.acting = 'frost';
    },
  },
  6: {
    tick(g, dt, p) {
      const n = F.n;
      if ((g.vars['rime.t'] = (g.vars['rime.t'] ?? 0) + dt) >= n.trailEvery) {
        g.vars['rime.t'] = 0;
        addField(g, { x: p.x, y: p.y, r: n.trailRadius, life: n.trailLife, dps: 0, hostile: false, color: F.color, dtype: 'frost', apply: { id: 'slow', stacks: 1 } });
      }
      for (const e of g.hash.query(p.x, p.y, p.r + 30, [])) {
        if (g.time < (touchCd.get(e) ?? 0) || Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.r + 4) continue;
        touchCd.set(e, g.time + n.touchCd);
        freeze(g, e, n.touchFreeze);
      }
    },
  },
};

