import { CURSED, type RelicId } from '../../config/relics';
import { dist2 } from '../../core/math';
import type { Enemy, Game, Player } from '../../core/types';
import { damageEnemy } from '../combat';
import { floatText } from '../effects';
import { awakened, bonus, cutMaxHp, nOf, nova, relicHeal, type RelicHooks } from '../relicCore';

/**
 * ☠ Cursed relics (v0.7.1 B6, RELICS.md): no family and no set, far stronger than a family relic, each with a curse. Awakening one (tier III)
 * lifts its curse. The curses that reach outside the player (the horde's speed, how many elites come) are numbers updateRelics resets every
 * tick and enemyAI or spawning reads.
 */
const cursed = (p: Player, id: RelicId): boolean => !awakened(p, id);
const near = (p: Player, e: Enemy, radius: number): boolean => dist2(p.x, p.y, e.x, e.y) <= radius * radius;
/** A curse that costs HP: never below 1 (the curse hurts, it does not kill), with a word over the player. */
function bleedHp(g: Game, p: Player, amount: number, text: string): void {
  p.hp = Math.max(1, p.hp - amount);
  floatText(g, p.x, p.y - p.r - 30, text, CURSED.color, 14);
}

export const CURSED_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  hungeringBlade: {
    onWaveStart(_g, _ev, p) {
      p.vars['hunger.kills'] = 0;
    },
    onKill(g, _ev, p) {
      p.vars['hunger.kills'] = (p.vars['hunger.kills'] ?? 0) + 1;
      p.vars['hunger.fed'] = g.time;
    },
    tick(g, _dt, p) {
      const n = nOf(p, 'hungeringBlade');
      bonus(p, 'damage', Math.min(n.max, (p.vars['hunger.kills'] ?? 0) * n.per));
      // the curse: it only starves you in a fight
      if (!cursed(p, 'hungeringBlade') || g.breather > 0 || !g.enemies.length) p.vars['hunger.fed'] = g.time;
      else if (g.time - (p.vars['hunger.fed'] ??= g.time) >= n.starve) {
        p.vars['hunger.fed'] = g.time;
        bleedHp(g, p, p.stats.hp * n.bite, 'HUNGER');
      }
    },
  },

  doomBell: {
    onKill(g, ev, p) {
      const n = nOf(p, 'doomBell');
      nova(g, ev.enemy.x, ev.enemy.y, n.radius, ev.enemy.maxHp * n.frac, 60, CURSED.color, 'shadow'); // a burst that kills tolls again (proc depth 2)
    },
    tick(g, _dt, p) {
      if (cursed(p, 'doomBell')) g.vars['relic.enemySpeed'] = 1 + nOf(p, 'doomBell').speed; // enemyAI reads it
    },
  },

  scepterOfRuin: {
    // the cooldown cut is a plain mod (config); the curse is the price of every cast
    onAbilityUsed(g, _ev, p) {
      if (cursed(p, 'scepterOfRuin')) bleedHp(g, p, p.hp * nOf(p, 'scepterOfRuin').cost, 'RUIN');
    },
  },

  abyssalEye: {
    onHit(g, ev, p) {
      const n = nOf(p, 'abyssalEye');
      if ((ev.source === 'attack' || ev.source === 'ability') && near(p, ev.enemy, n.radius)) damageEnemy(g, ev.enemy, ev.amount * n.bonus, false, 0, 0, 'relic');
    },
    onIncoming(_g, ev, p) {
      const n = nOf(p, 'abyssalEye');
      if (cursed(p, 'abyssalEye') && ev.attacker && near(p, ev.attacker, n.radius)) ev.amount *= 1 + n.taken;
    },
  },

  crimsonChalice: {
    acquire(g, p) {
      cutMaxHp(g, p, 'chaliceHp', cursed(p, 'crimsonChalice') ? nOf(p, 'crimsonChalice').hp : 1); // a tier-up calls it again: the awakening gives it back
    },
    remove(g, p) {
      cutMaxHp(g, p, 'chaliceHp', 1);
    },
    onHit(g, ev, p) {
      if (ev.source !== 'hazard') relicHeal(g, p, ev.amount * nOf(p, 'crimsonChalice').leech);
    },
  },

  tyrantsBanner: {
    onKill(_g, ev, p) {
      if (ev.enemy.elite) p.vars['banner.elites'] = (p.vars['banner.elites'] ?? 0) + 1;
    },
    tick(g, _dt, p) {
      const n = nOf(p, 'tyrantsBanner');
      const b = Math.min(n.max, (p.vars['banner.elites'] ?? 0) * n.per);
      bonus(p, 'damage', b);
      bonus(p, 'atkSpd', b);
      if (cursed(p, 'tyrantsBanner')) g.vars['relic.eliteMult'] = n.elites; // spawning reads it when it plans a wave
    },
  },
};
