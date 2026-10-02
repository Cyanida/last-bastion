import { ATTUNEMENT, FAMILIES, relicDef, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy, Game, Player } from '../../core/types';
import { addField, timer } from '../../entities/hazards';
import { applyStatus, nearestEnemy } from '../combat';
import { burst, ring } from '../effects';
import { aOf, awakened, bonus, credit, isCursed, nOf, nova, raiseSkeleton, relicDamage, relicHeal, sOf, skeletonsBy, type RelicHooks } from '../relicCore';
import { addWork } from '../../logic/relics';
import { censerLays, guardCut, stompable, tollCorpses } from '../../logic/graveRelics';

/**
 * 💀 Grave (RELICS.md): corpses, summons and curse. Relics raise skeletons (for any class), curse, or feed on corpses; the sets make corpses
 * last (Charnel), raise a skeleton every 10th kill (Undying Host) and let minions carry your on-hit relics (Legion, relicCore.attackHit).
 */
const F = FAMILIES.grave;
const shadow = { radius: 70, color: F.color, dtype: 'shadow' as const };
const curse = (g: Game, e: Enemy, stacks: number) => applyStatus(e, { apply: [{ id: 'curse', stacks }] }, g);
/** Plague Censer (#279): does `e` stand in the censer's plague ground? */
const inCenser = (g: Game, e: Enemy): boolean => g.fields.some((f) => f.by === 'plagueCenser' && (f.x - e.x) ** 2 + (f.y - e.y) ** 2 <= f.r * f.r);
/** Crown of Antlers (#279): the barrow guard: your skeletons (not a quest's or an evolution's units) standing within `radius` of you. */
const guardsNear = (g: Game, p: Player, radius: number): number =>
  g.minions.reduce((n, m) => n + (!m.kind && m.hp > 0 && (m.x - p.x) ** 2 + (m.y - p.y) ** 2 <= radius * radius ? 1 : 0), 0);
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

  // ---------------------------------------------------------------- v0.13 (#279): the Barrowvale
  barrowBoots: {
    tick(g, _dt, p) {
      const n = nOf(p, 'barrowBoots');
      for (const c of stompable(g.corpses, p.x, p.y, p.r, n.reach)) {
        c.stomped = true; // once per corpse: it stays a corpse (Raise Dead, the Spade, Charnel)
        const stacks = awakened(p, 'barrowBoots') ? aOf('barrowBoots').curse : 0; // Grave Stomp
        nova(g, c.x, c.y, n.radius, relicDamage(p, n.damage), 90, F.color, 'shadow', stacks ? (e) => curse(g, e, stacks) : undefined);
        burst(g, c.x, c.y, '#6b5843', 8, 110); // grave dirt
      }
    },
  },

  plagueCenser: {
    onKill(g, ev, p) {
      const n = nOf(p, 'plagueCenser');
      const kills = (g.vars['censer.kills'] = (g.vars['censer.kills'] ?? 0) + 1);
      const laid = g.fields.reduce((c, f) => c + (f.by === 'plagueCenser' ? 1 : 0), 0);
      if (!censerLays(kills, n.every, laid, n.max, inCenser(g, ev.enemy), awakened(p, 'plagueCenser'))) return; // awakened: Blight Bloom
      const dps = relicDamage(p, n.dps);
      addField(g, { x: ev.enemy.x, y: ev.enemy.y, r: n.radius, life: n.life, dps, hostile: false, color: '#6f8f4e', dtype: 'shadow', apply: { id: 'poison', power: relicDamage(p, n.poison) } });
      burst(g, ev.enemy.x, ev.enemy.y, '#6f8f4e', 8, 100);
    },
  },

  sextonsBell: {
    tick(g, dt, p) {
      const n = nOf(p, 'sextonsBell');
      if ((g.vars['bell.t'] = (g.vars['bell.t'] ?? 0) + dt) < n.every) return;
      const risen = tollCorpses(g.corpses, p.x, p.y, n.radius, n.count);
      if (!risen.length) return; // no corpse near: the bell waits for one
      g.vars['bell.t'] = 0;
      for (const c of risen) {
        g.corpses.splice(g.corpses.indexOf(c), 1); // a thrall's corpse rises for you, and never against you
        raiseSkeleton(g, p, c.x, c.y, 'sextonsBell', { hp: n.hp, damage: n.damage, life: n.life });
      }
      ring(g, p.x, p.y, n.radius, F.color, 0.5);
      if (awakened(p, 'sextonsBell')) // Death Toll
        for (const e of g.hash.query(p.x, p.y, n.radius, [])) if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= n.radius * n.radius) curse(g, e, aOf('sextonsBell').curse);
    },
  },

  crownOfAntlers: {
    tick(g, dt, p) {
      const a = aOf('crownOfAntlers');
      if (awakened(p, 'crownOfAntlers') && guardsNear(g, p, nOf(p, 'crownOfAntlers').radius) >= a.need) relicHeal(g, p, p.stats.hp * a.heal * dt); // Court of Bones
    },
    onKill(g, ev, p) {
      const n = nOf(p, 'crownOfAntlers');
      if (ev.enemy.def.boss || skeletonsBy(g, 'crownOfAntlers') >= n.max || g.rng() >= n.chance) return;
      raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'crownOfAntlers', { hp: n.hp, damage: n.damage, life: n.life });
    },
    onIncoming(g, ev, p) {
      if (ev.blocked) return;
      const n = nOf(p, 'crownOfAntlers');
      const cut = guardCut(guardsNear(g, p, n.radius), n.per, n.guards);
      if (cut <= 0) return;
      credit(g, p, 'crownOfAntlers', 'prevented', ev.amount * cut, true);
      ev.amount *= 1 - cut;
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
