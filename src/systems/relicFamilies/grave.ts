import { ATTUNEMENT, FAMILIES, relicDef, type RelicId, type SetLevel } from '../../config/relics';
import type { Player } from '../../core/types';
import { timer } from '../../entities/hazards';
import { applyStatus, nearestEnemy } from '../combat';
import { awakened, bonus, credit, isCursed, nOf, nova, raiseSkeleton, relicDamage, sOf, skeletonsBy, type RelicHooks } from '../relicCore';
import { addWork } from '../../logic/relics';

/**
 * 💀 Grave (RELICS.md): corpses, summons and curse. Relics raise skeletons (for any class), curse, or feed on corpses; the sets make corpses
 * last (Charnel), raise a skeleton every 10th kill (Undying Host) and let minions carry your on-hit relics (Legion, relicCore.attackHit).
 */
const F = FAMILIES.grave;
const shadow = { radius: 70, color: F.color, dtype: 'shadow' as const };
const corpseBursts = timer('deathmask.burst', (g, a: { p: Player; x: number; y: number }) => nova(g, a.x, a.y, shadow.radius, relicDamage(a.p, 18), 140, F.color, 'shadow'));

export const GRAVE_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  soulLantern: {
    onKill(g, ev, p) {
      const n = nOf(p, 'soulLantern');
      if (ev.enemy.def.boss || skeletonsBy(g, 'soulLantern') >= n.max || p.rng() >= n.chance) return;
      const m = raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'soulLantern', { hp: n.hp, damage: n.damage, life: n.life });
      if (awakened(p, 'soulLantern')) m.onEnd = { ...shadow, damage: relicDamage(p, 14) }; // Lantern of the Lost
    },
  },

  hexDoll: {
    onHit(g, ev, p) {
      if (ev.source === 'ability') applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: nOf(p, 'hexDoll').stacks }] }, g);
    },
    onKill(g, ev, p) {
      const c = ev.enemy.statuses.curse;
      if (!awakened(p, 'hexDoll') || !c) return;
      const to = nearestEnemy(g, ev.enemy.x, ev.enemy.y, 220, ev.enemy); // Voodoo
      if (to) applyStatus(to, { apply: [{ id: 'curse', stacks: c.stacks }] }, g);
    },
  },

  gravePact: {
    onAbilityUsed(g, _ev, p) {
      const time = nOf(p, 'gravePact').time;
      if (!g.minions.length) raiseSkeleton(g, p, p.x + 30, p.y, 'gravePact', { hp: 60, damage: 10, life: time }); // no minions: one skeleton
      for (const m of g.minions) m.blessedT = time;
    },
    onHit(g, ev, p) {
      if (awakened(p, 'gravePact') && ev.source === 'minion' && g.minions.some((m) => m.blessedT > 0)) applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: 1 }] }, g); // Unholy Pact
    },
  },

  gravediggersSpade: {
    tick(g, dt, p) {
      const n = nOf(p, 'gravediggersSpade');
      const near = g.corpses.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < n.radius);
      bonus(p, 'damage', Math.min(n.max, near.length) * n.per);
      if (!awakened(p, 'gravediggersSpade') || !near.length || (p.vars['exhume.t'] = (p.vars['exhume.t'] ?? 0) + dt) < 20) return;
      p.vars['exhume.t'] = 0; // Exhume: the oldest corpse near you rises
      const oldest = near.reduce((a, b) => (a.t > b.t ? a : b));
      g.corpses.splice(g.corpses.indexOf(oldest), 1);
      raiseSkeleton(g, p, oldest.x, oldest.y, 'gravediggersSpade', { hp: 50, damage: 10, life: 20 });
    },
  },

  deathmask: {
    onHit(g, ev, p) {
      if (ev.source !== 'relic' && ev.source !== 'hazard' && p.rng() < nOf(p, 'deathmask').chance) applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: 1 }] }, g); // A8: its own curses
    },
    onIncoming(g, ev, p) {
      if (!ev.attacker || !isCursed(ev.attacker)) return;
      const n = nOf(p, 'deathmask');
      credit(g, p, 'deathmask', 'prevented', ev.amount * n.reduce, true);
      ev.amount *= 1 - n.reduce;
    },
    onKill(g, ev, p) {
      if (!awakened(p, 'deathmask') || !isCursed(ev.enemy)) return;
      const { x, y } = ev.enemy; // Mark of the Grave: its corpse bursts a second later
      corpseBursts(g, 1, { p, x, y });
    },
  },

  boneChime: {
    tick(_g, _dt, p) {
      const n = nOf(p, 'boneChime');
      bonus(p, 'minionAtkSpd', p.stats.atkSpd * n.inherit + sOf(p) * n.perSoul);
    },
    onHit(g, ev, p) {
      if (!awakened(p, 'boneChime') || ev.source !== 'minion') return;
      if ((p.vars['knell.hits'] = (p.vars['knell.hits'] ?? 0) + 1) % 20 === 0) nova(g, ev.enemy.x, ev.enemy.y, 90, relicDamage(p, 20), 120, F.color, 'shadow'); // Death Knell
    },
  },
};


export const GRAVE_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  2: {
    tick(g, _dt, p) {
      g.vars['corpse.mult'] = F.n.corpseMult; // Charnel: game.ts keeps corpses this much longer
      for (const c of g.corpses) {
        if (c.walked || Math.hypot(c.x - p.x, c.y - p.y) > p.r + 12) continue;
        c.walked = true; // and walking over one attunes your Grave relics
        for (const id of p.relics.held) if (relicDef(id).family === 'grave') addWork(p.relics, id, ATTUNEMENT.corpse);
      }
    },
  },
  4: {
    onKill(g, ev, p) {
      if ((p.vars['host.kills'] = (p.vars['host.kills'] ?? 0) + 1) % F.n.every !== 0) return; // Undying Host
      if (skeletonsBy(g, 'grave') >= F.n.max + Math.floor(sOf(p) / 10) * F.n.maxPer10S) return;
      raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'grave', { hp: F.n.hp, damage: F.n.damage, life: F.n.life });
    },
  },
  // 6 Legion lives in relicCore.attackHit: minion hits count as attacks for on-hit relics
};
