import { ATTUNEMENT, FAMILIES, relicDef, type RelicId, type SetLevel } from '../../config/relics';
import type { Game, Player } from '../../core/types';
import { timer } from '../../entities/hazards';
import { applyStatus, nearestEnemy } from '../combat';
import { burst, ring } from '../effects';
import * as scale from '../../logic/abilities';
import { clamp } from '../../core/math';
import { aOf, awakened, bonus, credit, isCursed, nOf, nova, raiseSkeleton, relicDamage, relicHeal, sOf, skeletonsBy, type RelicHooks } from '../relicCore';
import { addWork, corpsesNear, deadCount, wightBurst } from '../../logic/relics';

/**
 * 💀 Grave (RELICS.md): corpses, summons and curse. Relics raise skeletons (for any class), curse, or feed on corpses; the sets make corpses
 * last (Charnel), raise a skeleton every 10th kill (Undying Host) and let minions carry your on-hit relics (Legion, relicCore.attackHit).
 */
const F = FAMILIES.grave;
const shadow = { radius: 70, color: F.color, dtype: 'shadow' as const };
/** #280: takes these corpses off the ground (they rise as skeletons, are laid to rest or burst; a rising one never rises then). */
function takeCorpses(g: Game, taken: Game['corpses']): void {
  for (const c of taken) g.corpses.splice(g.corpses.indexOf(c), 1);
}
/** #280: curses every enemy within `radius` of (x, y). */
function curseAround(g: Game, x: number, y: number, radius: number, stacks: number): void {
  for (const e of g.hash.query(x, y, radius, [])) if (!e.dead) applyStatus(e, { apply: [{ id: 'curse', stacks }] }, g);
}
const corpseBursts = timer('deathmask.burst', (g, a: { p: Player; x: number; y: number }) => nova(g, a.x, a.y, shadow.radius, relicDamage(a.p, aOf('deathmask').damage), 140, F.color, 'shadow'));

export const GRAVE_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  soulLantern: {
    onKill(g, ev, p) {
      const n = nOf(p, 'soulLantern');
      if (ev.enemy.def.boss || skeletonsBy(g, 'soulLantern') >= n.max || g.rng() >= n.chance) return;
      const m = raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'soulLantern', { hp: n.hp, damage: n.damage, life: n.life });
      if (awakened(p, 'soulLantern')) m.onEnd = { ...shadow, damage: relicDamage(p, aOf('soulLantern').damage) }; // Lantern of the Lost
    },
  },

  hexDoll: {
    onHit(g, ev, p) {
      if (ev.source === 'ability') applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: nOf(p, 'hexDoll').stacks }] }, g);
    },
    onKill(g, ev, p) {
      const c = ev.enemy.statuses.curse;
      if (!awakened(p, 'hexDoll') || !c) return;
      const to = nearestEnemy(g, ev.enemy.x, ev.enemy.y, aOf('hexDoll').range, ev.enemy); // Voodoo
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
      const a = aOf('gravediggersSpade');
      if (!awakened(p, 'gravediggersSpade') || !near.length || (g.vars['exhume.t'] = (g.vars['exhume.t'] ?? 0) + dt) < a.every) return;
      g.vars['exhume.t'] = 0; // Exhume: the oldest corpse near you rises
      const oldest = near.reduce((a, b) => (a.t > b.t ? a : b));
      g.corpses.splice(g.corpses.indexOf(oldest), 1);
      raiseSkeleton(g, p, oldest.x, oldest.y, 'gravediggersSpade', { hp: a.hp, damage: a.damage, life: a.life });
    },
  },

  deathmask: {
    onHit(g, ev, p) {
      if (ev.source !== 'relic' && ev.source !== 'hazard' && g.rng() < nOf(p, 'deathmask').chance) applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: 1 }] }, g); // A8: its own curses
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
      corpseBursts(g, aOf('deathmask').delay, { p, x, y });
    },
  },

  boneChime: {
    tick(_g, _dt, p) {
      const n = nOf(p, 'boneChime');
      bonus(p, 'minionAtkSpd', p.stats.atkSpd * n.inherit + sOf(p) * n.perSoul);
    },
    onHit(g, ev, p) {
      if (!awakened(p, 'boneChime') || ev.source !== 'minion') return;
      const a = aOf('boneChime');
      if ((g.vars['knell.hits'] = (g.vars['knell.hits'] ?? 0) + 1) % a.every === 0) nova(g, ev.enemy.x, ev.enemy.y, a.radius, relicDamage(p, a.damage), 120, F.color, 'shadow'); // Death Knell
    },
  },

  // ---------------------------------------------------------------- v0.13 (#280): the Barrowvale's class relics
  ossuarySeal: {
    onAbilityEnd(g, _ev, p) {
      if (p.cls.ability.id !== 'divineShield') return;
      const n = nOf(p, 'ossuarySeal');
      const dead = corpsesNear(g.corpses, p.x, p.y, n.radius, deadCount(sOf(p), n.base, n.per));
      takeCorpses(g, dead);
      for (const c of dead) raiseSkeleton(g, p, c.x, c.y, 'ossuarySeal', { hp: n.hp, damage: n.damage, life: n.life });
    },
    onBlocked(g, ev, p) {
      // Sworn Dead: a blow the shield turns curses whoever struck it
      if (awakened(p, 'ossuarySeal') && p.cls.ability.id === 'divineShield' && p.abilityTime > 0 && ev.attacker && !ev.attacker.dead) applyStatus(ev.attacker, { apply: [{ id: 'curse', stacks: aOf('ossuarySeal').stacks }] }, g);
    },
  },

  draugrMead: {
    onKill(g, ev, p) {
      if (p.cls.ability.id !== 'berserkerRage' || p.abilityTime <= 0 || ev.source !== 'attack' || ev.enemy.def.boss) return;
      const n = nOf(p, 'draugrMead');
      if (skeletonsBy(g, 'draugrMead') >= deadCount(sOf(p), n.base, n.per)) return;
      raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'draugrMead', { hp: n.hp, damage: n.damage, life: n.life });
    },
    onAbilityEnd(g, _ev, p) {
      if (!awakened(p, 'draugrMead') || p.cls.ability.id !== 'berserkerRage') return;
      const a = aOf('draugrMead'); // Einherjar: the draugr howl as Rage ends
      for (const m of g.minions) if (m.relicBy === 'draugrMead' && m.hp > 0) nova(g, m.x, m.y, a.radius, relicDamage(p, a.damage), 90, F.color, 'shadow');
    },
  },

  lastRites: {
    onAbilityUsed(g, _ev, p) {
      const ability = p.cls.ability;
      if (ability.id !== 'heavenlyRadiance') return;
      const n = nOf(p, 'lastRites');
      const dead = corpsesNear(g.corpses, p.x, p.y, scale.heavenlyRadiance(ability, sOf(p)).radius, deadCount(sOf(p), n.base, n.per));
      if (!dead.length) return;
      takeCorpses(g, dead);
      relicHeal(g, p, p.stats.hp * n.heal * dead.length, true);
      const a = aOf('lastRites');
      for (const c of dead) {
        ring(g, c.x, c.y, 24, F.color, 0.5);
        if (awakened(p, 'lastRites')) curseAround(g, c.x, c.y, a.radius, a.stacks); // Psychopomp
      }
    },
  },

  wightboneArrows: {
    onAbilityUsed(g, _ev, p) {
      const ability = p.cls.ability;
      if (ability.id !== 'arrowVolley') return;
      // the Volley's own target point (systems/abilities.ts: the aim, clamped to its cast range); a Ballista bolt calls the same ground
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d, 0, ability.castRange) / d;
      const dead = corpsesNear(g.corpses, p.x + dx * k, p.y + dy * k, ability.radius, g.corpses.length);
      if (!dead.length) return;
      takeCorpses(g, dead);
      const n = nOf(p, 'wightboneArrows');
      const dmg = wightBurst(relicDamage(p, n.damage), n.perFocus, sOf(p));
      for (const c of dead) {
        nova(g, c.x, c.y, n.radius, dmg, 80, F.color, 'shadow');
        burst(g, c.x, c.y, '#e8e2d0', 10, 200); // bone splinters
      }
    },
    onKill(g, ev, p) {
      if (!awakened(p, 'wightboneArrows') || ev.source !== 'ability' || ev.enemy.def.boss) return;
      const a = aOf('wightboneArrows'); // Barrow Wights
      if (skeletonsBy(g, 'wightboneArrows') < a.max) raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'wightboneArrows', { hp: a.hp, damage: a.damage, life: a.life });
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
      if ((g.vars['host.kills'] = (g.vars['host.kills'] ?? 0) + 1) % F.n.every !== 0) return; // Undying Host
      if (skeletonsBy(g, 'grave') >= F.n.max + Math.floor(sOf(p) / 10) * F.n.maxPer10S) return;
      raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'grave', { hp: F.n.hp, damage: F.n.damage, life: F.n.life });
    },
  },
  // 6 Legion lives in relicCore.attackHit: minion hits count as attacks for on-hit relics
};
