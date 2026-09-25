import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import type { Cfg } from '../config/classes';
import { EVOLUTIONS, type EvolutionId, type EvolutionSlot } from '../config/evolutions';
import { UTILITIES } from '../config/utility';
import { sfx } from '../sim/view';
import { addListener, dispatch, emit, type GameEvents, type Handlers } from '../core/events';
import { TAU } from '../core/math';
import type { Enemy, Game, Minion } from '../core/types';
import { createMinion } from '../entities/actors';
import { addField, addZone, fireProjectile, timer } from '../entities/hazards';
import * as scale from '../logic/abilities';
import type { BuildState } from '../logic/evolutions';
import { attackDamage } from '../logic/formulas';
import { freeVolley } from './abilities';
import { applyStatus, damageEnemy, healPlayer, nearestEnemy, rollPlayerHit } from './combat';
import { burst, floatText, line, ring, shake, swingArc } from './effects';
import { skeletonCount } from './minions';
import { clampToArena } from './movement';
import { markEvolution } from './runlog';

/**
 * v0.6 evolutions (config/evolutions.ts): what each one does. The signature ability's and the utility's own hooks run as ever;
 * an evolution adds to them (cast, tick, expire, passive, events, utility) or takes the cast over (replaceCast, replaceUtility).
 * Every number that grows with the class's secondary stat is `x + xPer * stat`.
 */
export interface EvolutionHook {
  cast?(g: Game): void; // after the signature ability's own cast went through
  replaceCast?(g: Game): boolean; // instead of it (false: nothing happened, the cooldown is kept)
  tick?(g: Game, dt: number): void; // every tick while the ability is active, after its own tick
  expire?(g: Game): void; // when it ends, after its own expire
  passive?(g: Game, dt: number): void; // every tick
  on?: Handlers;
  utility?(g: Game, from: { x: number; y: number }): void; // after the utility's own effect; `from`: where you stood before it
  replaceUtility?(g: Game, from: { x: number; y: number }): boolean;
}

const near: Enemy[] = [];
const sec = (g: Game) => g.player.stats.secondary;
const per = (g: Game, n: Record<string, number>, key: string) => n[key] + (n[`${key}Per`] ?? 0) * sec(g); // "x + xPer * secondary"
const N = <K extends EvolutionId>(id: K) => EVOLUTIONS[id].n as Record<string, number>;

// v0.8 (#27): the delayed parts of evolutions, as timer kinds
const judgementRing = timer('dayOfJudgement.ring', (g, a: { x: number; y: number; inner: number; outer: number; dmg: number; kb: number }) => {
  const { x, y, inner, outer } = a;
  for (const e of g.hash.query(x, y, outer, near)) {
    const d = Math.hypot(e.x - x, e.y - y) || 1;
    if (d < inner) continue;
    damageEnemy(g, e, a.dmg, false, ((e.x - x) / d) * a.kb, ((e.y - y) / d) * a.kb, 'ability', 'holy');
  }
  ring(g, x, y, outer, '#f2e6a0', 0.5);
  shake(g, 8);
});
const judgementSword = timer('dayOfJudgement.sword', (g, a: { target: Enemy; dmg: number }) => {
  const { target } = a;
  if (target.dead) return;
  line(g, target.x, target.y - 320, target.x, target.y, '#f2e6a0');
  damageEnemy(g, target, a.dmg * per(g, N('dayOfJudgement'), 'sword'), true, 0, 0, 'ability', 'holy');
  burst(g, target.x, target.y, '#f2e6a0', 30, 300);
  floatText(g, target.x, target.y - 40, 'JUDGED', '#f2e6a0', 18);
  shake(g, 12);
  sfx('boom');
});
const meteorLands = timer('meteorArrow.lands', (g, a: { x: number; y: number; r: number }) => {
  ring(g, a.x, a.y, a.r, '#e07b28', 0.6);
  burst(g, a.x, a.y, '#e07b28', 50, 420);
  shake(g, 16);
  sfx('boom');
});
const huntGoesOn = timer('huntersMark.volley', (g, a: { x: number; y: number }) => freeVolley(g, a.x, a.y));
const raging = (g: Game) => g.player.abilityTime > 0;
const until = (g: Game, key: string) => g.time < (g.vars[key] ?? 0);
/** The player's plain attack damage, with its scaling stat and every damage mod: what "x% of an attack" means below. */
const attackHit = (g: Game) => {
  const p = g.player;
  return attackDamage(p.cls.attack.damage, p.stats[p.cls.attack.scaling], p.buff.damage * p.mods.damage);
};

const HOOKS: Record<EvolutionId, EvolutionHook> = {
  // ---------------------------------------------------------------- Paladin
  aegisOfDawn: {
    cast(g) {
      const n = N('aegisOfDawn');
      addField(g, { x: g.player.x, y: g.player.y, r: per(g, n, 'radius'), life: g.player.abilityTime, dps: per(g, n, 'dps') * g.player.mods.damage, hostile: false, color: '#f2c94c', dtype: 'holy' });
      g.fields[g.fields.length - 1].follow = true;
    },
    tick(g) {
      // enemy shots that cross into the dome turn round as holy bolts
      const p = g.player;
      const n = N('aegisOfDawn');
      const r = per(g, n, 'radius');
      for (const pr of g.projectiles) {
        if (!pr.hostile || (pr.x - p.x) ** 2 + (pr.y - p.y) ** 2 > r * r) continue;
        pr.hostile = false;
        pr.vx = -pr.vx;
        pr.vy = -pr.vy;
        pr.damage *= per(g, n, 'reflect');
        pr.color = '#f2e6a0';
        pr.dtype = 'holy';
        pr.source = 'ability';
        pr.pierce = 2;
        burst(g, pr.x, pr.y, '#f2e6a0', 4, 90);
      }
    },
  },

  dayOfJudgement: {
    expire(g) {
      // the shield's own burst is the first ring; two more roll out after it, then a sword falls on the strongest near you
      const p = g.player;
      const n = N('dayOfJudgement');
      const c = p.cls.ability as Cfg<'divineShield'>;
      const dmg = attackDamage(scale.divineShield(c, sec(g)).burstDamage, p.stats.str, p.mods.damage) * (g.vars['shield.burst'] ?? 1); // v0.7.4 (#63)
      const { x, y } = p;
      for (let k = 1; k < n.waves; k++) {
        const inner = c.burstRadius * (1 + (k - 1) * n.grow);
        const outer = c.burstRadius * (1 + k * n.grow);
        judgementRing(g, k * n.gap, { x, y, inner, outer, dmg, kb: c.burstKnockback });
      }
      let best: Enemy | null = null;
      for (const e of g.hash.query(x, y, c.burstRadius * (1 + n.grow * (n.waves - 1)), near)) if (!e.dead && (!best || e.maxHp > best.maxHp)) best = e;
      if (best) judgementSword(g, n.waves * n.gap, { target: best, dmg });
    },
  },

  crusadersCharge: {
    cast(g) {
      // a charge toward your aim, trampling everything in the path, before the shield holds
      const p = g.player;
      const n = N('crusadersCharge');
      const c = p.cls.ability as Cfg<'divineShield'>;
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const dist = Math.min(d, per(g, n, 'dist'));
      const from = { x: p.x, y: p.y };
      p.x += (dx / d) * dist;
      p.y += (dy / d) * dist;
      clampToArena(g, p);
      const dmg = attackDamage(scale.divineShield(c, sec(g)).burstDamage, p.stats.str, p.mods.damage) * per(g, n, 'damage');
      const len = Math.hypot(p.x - from.x, p.y - from.y) || 1;
      const ux = (p.x - from.x) / len;
      const uy = (p.y - from.y) / len;
      for (const e of g.hash.query((from.x + p.x) / 2, (from.y + p.y) / 2, len / 2 + n.width, near)) {
        const along = (e.x - from.x) * ux + (e.y - from.y) * uy;
        const across = -(e.x - from.x) * uy + (e.y - from.y) * ux;
        if (along < -e.r || along > len + e.r || Math.abs(across) > n.width + e.r) continue;
        const side = across >= 0 ? 1 : -1;
        damageEnemy(g, e, dmg, false, -uy * side * n.knockback, ux * side * n.knockback, 'ability', 'holy');
      }
      for (let i = 0; i <= 4; i++) line(g, from.x + (p.x - from.x) * (i / 4) - uy * 18, from.y + (p.y - from.y) * (i / 4) + ux * 18, from.x + (p.x - from.x) * (i / 4) + uy * 18, from.y + (p.y - from.y) * (i / 4) - ux * 18, '#f2d675');
      burst(g, p.x, p.y, '#f2d675', 24, 260);
      shake(g, 10);
    },
  },

  lionsRoar: {
    utility(g) {
      const p = g.player;
      const n = N('lionsRoar');
      const hit = rollPlayerHit(g, per(g, n, 'damage') * p.mods.utilityPower, 'str');
      for (const e of g.hash.query(p.x, p.y, UTILITIES.paladin.n.radius, near)) {
        damageEnemy(g, e, hit.amount, hit.crit, 0, 0, 'ability', 'holy');
        applyStatus(e, { markMul: n.mark, markT: n.markT }, g);
      }
      ring(g, p.x, p.y, UTILITIES.paladin.n.radius * 1.15, '#f2c94c', 0.6);
      floatText(g, p.x, p.y - 50, 'ROAR', '#f2c94c', 20);
    },
  },

  standardOfFaith: {
    utility(g) {
      const p = g.player;
      const n = N('standardOfFaith');
      for (const m of g.minions) if (m.kind === 'standard') m.life = 0; // one standard at a time
      const s = createMinion(p.x, p.y, { hp: per(g, n, 'hp'), damage: 0, speed: 0, attackCd: 99, life: per(g, n, 'life'), r: 16 });
      Object.assign(s, { kind: 'standard', passive: true } satisfies Partial<Minion>);
      g.minions.push(s);
      ring(g, p.x, p.y, n.radius, '#f2d675', 0.6);
    },
    passive(g, dt) {
      const n = N('standardOfFaith');
      const p = g.player;
      for (const m of g.minions) {
        if (m.kind !== 'standard') continue;
        g.glows.push({ x: m.x, y: m.y, r: n.radius, color: '#f2d675', ring: true });
        if ((p.x - m.x) ** 2 + (p.y - m.y) ** 2 <= n.radius * n.radius) healPlayer(g, per(g, n, 'regen') * dt, false);
      }
    },
  },

  // ---------------------------------------------------------------- Viking
  avatarOfWrath: {
    tick(g) {
      g.vars.avatar = 1;
      g.player.buff.fullCircle = true;
      g.player.buff.range = Math.max(g.player.buff.range, 1.3);
    },
    expire: (g) => void (g.vars.avatar = 0),
    on: {
      onHit(g, ev) {
        if (ev.source !== 'attack' || !raging(g)) return;
        const n = N('avatarOfWrath');
        const e = ev.enemy;
        for (const o of g.hash.query(e.x, e.y, n.radius, near)) if (o !== e && !o.dead) damageEnemy(g, o, ev.amount * per(g, n, 'shock'), false, 0, 0, 'ability');
        ring(g, e.x, e.y, n.radius, '#b8322a', 0.25);
      },
    },
  },

  maelstrom: {
    tick(g, dt) {
      const n = N('maelstrom');
      g.glows.push({ x: g.player.x, y: g.player.y - 6, r: per(g, n, 'radius'), color: '#e8e2d0', ring: true }); // the storm's edge, all the while it rages
      if ((g.vars.maelstrom = (g.vars.maelstrom ?? 0) - dt) > 0) return;
      g.vars.maelstrom = n.every;
      const p = g.player;
      const r = per(g, n, 'radius');
      const dmg = attackHit(g) * n.damage;
      for (const e of g.hash.query(p.x, p.y, r, near)) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        damageEnemy(g, e, dmg, false, ((p.x - e.x) / d) * n.pull, ((p.y - e.y) / d) * n.pull, 'ability');
      }
      swingArc(g, p.x, p.y, r, g.time * 9, TAU, '#e8e2d0');
      ring(g, p.x, p.y, r, '#b8322a', 0.2);
    },
  },

  bloodTide: {
    on: {
      onKill(g, ev) {
        if (!raging(g)) return;
        const n = N('bloodTide');
        const e = ev.enemy;
        const dmg = attackHit(g) * per(g, n, 'damage');
        for (const o of g.hash.query(e.x, e.y, n.radius, near)) {
          if (o.dead) continue;
          damageEnemy(g, o, dmg, false, 0, 0, 'ability');
          applyStatus(o, { apply: [{ id: 'bleed', power: dmg * 0.2 }] }, g);
        }
        healPlayer(g, n.heal, false);
        ring(g, e.x, e.y, n.radius, '#8e1b1b', 0.35);
        burst(g, e.x, e.y, '#8e1b1b', 14, 200);
      },
    },
  },

  thunderfall: {
    utility(g) {
      const p = g.player;
      const n = N('thunderfall');
      const hit = rollPlayerHit(g, n.damage * p.mods.utilityPower, 'str');
      const targets = g.hash.query(p.x, p.y, n.range, []).filter((e) => !e.dead).sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2)).slice(0, Math.floor(per(g, n, 'chains')));
      let from = { x: p.x, y: p.y - 20 };
      for (const e of targets) {
        line(g, from.x, from.y, e.x, e.y - 10, '#f2e6a0');
        burst(g, e.x, e.y - 10, '#fff6c8', 8, 180);
        damageEnemy(g, e, hit.amount, hit.crit, 0, 0, 'ability');
        applyStatus(e, { apply: [{ id: 'stun', time: n.stun }] }, g);
        from = { x: e.x, y: e.y - 10 };
      }
      line(g, p.x, p.y - 300, p.x, p.y, '#f2e6a0');
      shake(g, 10);
    },
  },

  valkyrie: {
    utility(g) {
      const p = g.player;
      const n = N('valkyrie');
      addField(g, { x: p.x, y: p.y, r: UTILITIES.viking.n.radius, life: n.fire, dps: per(g, n, 'dps') * p.mods.utilityPower, hostile: false, color: '#e07b28', dtype: 'fire', apply: { id: 'burn', power: per(g, n, 'dps') * 0.2 } });
      if (until(g, 'valkyrieUntil')) g.vars.valkyrieUntil = 0; // that was the second leap: the cooldown stands
      else {
        g.vars.valkyrieCd = p.utilityCd;
        g.vars.valkyrieUntil = g.time + n.window;
        p.utilityCd = 0; // a second leap, straight away
        floatText(g, p.x, p.y - 50, 'AGAIN!', '#e07b28', 16);
      }
    },
    passive(g) {
      // the window closed without a second leap: the first one's cooldown comes back (less the time already waited)
      if (!g.vars.valkyrieUntil || g.time < g.vars.valkyrieUntil) return;
      g.player.utilityCd = Math.max(g.player.utilityCd, (g.vars.valkyrieCd ?? 0) - N('valkyrie').window);
      g.vars.valkyrieUntil = 0;
    },
  },

  // ---------------------------------------------------------------- Angel
  sunburst: {
    cast(g) {
      const p = g.player;
      const n = N('sunburst');
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const life = per(g, n, 'life');
      addField(g, { x: p.x, y: p.y, r: n.radius, life, dps: attackDamage(per(g, n, 'dps'), p.stats.int, p.mods.damage), hostile: false, color: '#f2c94c', dtype: 'holy' });
      Object.assign(g.fields[g.fields.length - 1], { vx: (dx / d) * n.speed, vy: (dy / d) * n.speed });
      g.vars.sunUntil = g.time + life;
    },
    passive(g, dt) {
      if (!until(g, 'sunUntil')) return;
      const n = N('sunburst');
      for (const f of g.fields) if (f.vx !== undefined) g.glows.push({ x: f.x, y: f.y, r: 16 + Math.sin(g.time * 10) * 2, color: '#fff6c8' }); // its blazing core
      healPlayer(g, attackDamage(per(g, n, 'dps'), g.player.stats.int, g.player.mods.damage) * n.heal * dt, false);
    },
  },

  choir: {
    cast(g) {
      g.vars.choirUntil = g.time + N('choir').life;
      g.vars.choirT = 0;
    },
    passive(g, dt) {
      if (!until(g, 'choirUntil')) return;
      const p = g.player;
      const n = N('choir');
      const count = Math.floor(per(g, n, 'wisps'));
      const fire = (g.vars.choirT = (g.vars.choirT ?? 0) - dt) <= 0;
      if (fire) g.vars.choirT = n.every;
      for (let i = 0; i < count; i++) {
        const a = g.time * 2.2 + (i / count) * TAU;
        const x = p.x + Math.cos(a) * n.orbit;
        const y = p.y - 10 + Math.sin(a) * n.orbit;
        g.glows.push({ x, y, r: 6, color: '#f2e6a0' });
        if (!fire) continue;
        const e = nearestEnemy(g, x, y, 380);
        if (e) fireProjectile(g, x, y, Math.atan2(e.y - y, e.x - x), { damage: attackHit(g) * n.damage, crit: false, hostile: false, pierce: 0, shape: 'orb', color: '#f2e6a0', r: 5, speed: 520, range: 420, source: 'ability', dtype: 'holy' });
      }
    },
  },

  sanctuaryWings: {
    cast(g) {
      g.vars.wingsUntil = g.time + per(g, N('sanctuaryWings'), 'life');
    },
    passive(g, dt) {
      if (!until(g, 'wingsUntil')) return;
      const p = g.player;
      const n = N('sanctuaryWings');
      g.glows.push({ x: p.x, y: p.y - 6, r: n.radius, color: '#f2e6a0', ring: true });
      healPlayer(g, p.stats.hp * n.heal * dt, false);
      if ((g.vars.wingsT = (g.vars.wingsT ?? 0) - dt) > 0) return;
      g.vars.wingsT = 0.3;
      const dmg = attackDamage(per(g, n, 'damage'), p.stats.int, p.mods.damage);
      for (const e of g.hash.query(p.x, p.y, n.radius + 30, near)) {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        if (Math.abs(d - n.radius) > 30) continue; // only where the ring is
        damageEnemy(g, e, dmg, false, ((e.x - p.x) / d) * n.knockback, ((e.y - p.y) / d) * n.knockback, 'ability', 'holy');
      }
    },
  },

  starfall: {
    utility(g, from) {
      const p = g.player;
      const n = N('starfall');
      const stars = Math.floor(per(g, n, 'stars'));
      const hit = rollPlayerHit(g, n.damage * p.mods.utilityPower, 'int');
      for (let i = 0; i < stars; i++) {
        const k = stars === 1 ? 1 : i / (stars - 1);
        addZone(g, { x: from.x + (p.x - from.x) * k, y: from.y + (p.y - from.y) * k, r: n.radius, delay: 0.25 + i * 0.08, damage: hit.amount, crit: hit.crit, hostile: false, color: '#f2e6a0', arrow: true, dtype: 'holy' });
      }
    },
  },

  phaseWalk: {
    utility(g, from) {
      const p = g.player;
      const n = N('phaseWalk');
      for (const m of g.minions) if (m.kind === 'decoy') m.life = 0;
      const decoy = createMinion(from.x, from.y, { hp: per(g, n, 'hp'), damage: 0, speed: 0, attackCd: 99, life: n.life, r: 13 });
      Object.assign(decoy, { kind: 'decoy', passive: true, flip: p.flip, onEnd: { radius: n.radius, damage: attackDamage(per(g, n, 'damage'), p.stats.int, p.mods.damage), color: '#f2e6a0', dtype: 'holy' } } satisfies Partial<Minion>);
      g.minions.push(decoy);
    },
  },

  // ---------------------------------------------------------------- Necromancer
  boneColossus: {
    replaceCast(g) {
      // the skeletons you have, and any corpses near you, fuse into one Colossus; with one already standing, they feed it
      const p = g.player;
      const n = N('boneColossus');
      const c = p.cls.ability as Cfg<'raiseDead'>;
      const s = scale.raiseDead(c, sec(g));
      const each = { hp: c.minionHp, damage: attackDamage(s.damage, p.stats.int) };
      const bones = g.minions.filter((m) => !m.kind && !m.cleave);
      const corpses = g.corpses.splice(0, Math.max(1, s.maxMinions));
      const parts = bones.length + corpses.length || 1;
      for (const m of bones) m.life = 0;
      let colossus = g.minions.find((m) => m.cleave);
      if (colossus) {
        const gain = 1 + n.grow * parts;
        colossus.maxHp *= gain;
        colossus.hp = Math.min(colossus.maxHp, colossus.hp * gain + each.hp * parts);
        colossus.damage *= 1 + (n.grow / 2) * parts;
        colossus.life = s.lifetime * 2;
      } else {
        colossus = createMinion(p.x + 40, p.y, { hp: each.hp * parts * n.hp, damage: each.damage * parts * n.damage, speed: c.minionSpeed * 0.8, attackCd: c.minionAttackCd * 1.4, life: s.lifetime * 2, r: 30, scale: n.scale });
        colossus.cleave = n.cleave;
        g.minions.push(colossus);
      }
      for (const at of corpses) line(g, at.x, at.y, colossus.x, colossus.y, c.aura);
      ring(g, colossus.x, colossus.y, 90, c.aura, 0.6);
      burst(g, colossus.x, colossus.y, '#d8d2bd', 30, 260);
      floatText(g, colossus.x, colossus.y - 70, `COLOSSUS ×${parts}`, c.aura, 17);
      p.abilityTime = p.abilityDur = 0.4;
      return true;
    },
  },

  plagueLegion: {
    cast(g) {
      const p = g.player;
      const n = N('plagueLegion');
      for (const m of g.minions) if (!m.kind && !m.onEnd) m.onEnd = { radius: n.cloud, damage: attackDamage(per(g, n, 'dps'), p.stats.int, p.mods.damage) * 3, color: '#6f8f4e', dtype: 'shadow' };
    },
    passive(g, dt) {
      if ((g.vars.plagueT = (g.vars.plagueT ?? 0) - dt) > 0) return;
      const n = N('plagueLegion');
      g.vars.plagueT = n.every;
      const dps = attackDamage(per(g, n, 'dps'), g.player.stats.int, g.player.mods.damage);
      for (const m of g.minions) {
        if (m.kind || !m.onEnd) continue; // plague-bearers only
        addField(g, { x: m.x, y: m.y, r: n.radius, life: n.life, dps, hostile: false, color: '#6f8f4e', dtype: 'shadow', apply: { id: 'poison', power: dps * 0.3 } });
      }
    },
  },

  soulHarvest: {
    cast(g) {
      const p = g.player;
      const n = N('soulHarvest');
      const souls = g.vars.souls ?? 0;
      for (let i = 0; i < souls; i++) {
        const a = (i / Math.max(1, souls)) * TAU;
        fireProjectile(g, p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, a, { damage: attackDamage(per(g, n, 'damage'), p.stats.int, p.mods.damage), crit: false, hostile: false, pierce: 0, shape: 'orb', color: '#7ec8d8', r: 6, speed: n.speed, range: 900, source: 'ability', dtype: 'shadow', seek: true });
      }
      if (souls > 0) floatText(g, p.x, p.y - 56, `${souls} souls`, '#7ec8d8', 15);
      g.vars.souls = 0;
    },
    passive(g) {
      const souls = g.vars.souls ?? 0;
      const p = g.player;
      for (let i = 0; i < souls; i++) {
        const a = g.time * 1.6 + (i / souls) * TAU;
        g.glows.push({ x: p.x + Math.cos(a) * 34, y: p.y - 12 + Math.sin(a) * 34, r: 3.5, color: '#7ec8d8' });
      }
    },
    on: {
      onKill(g, ev) {
        if (ev.source !== 'minion') return;
        g.vars.souls = Math.min(Math.floor(per(g, N('soulHarvest'), 'max')), (g.vars.souls ?? 0) + 1);
      },
    },
  },

  corpseLance: {
    replaceUtility(g) {
      // each corpse in reach hurls a bone lance at the nearest enemy instead of bursting where it lies
      const p = g.player;
      const u = UTILITIES.necromancer.n;
      const n = N('corpseLance');
      const radius = u.radius * (p.utilityUpgrades.includes('deathWave') ? 2 : 1);
      const corpses = g.corpses.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) <= radius);
      if (corpses.length === 0) return false;
      const hit = rollPlayerHit(g, u.damage * n.damage * (p.utilityUpgrades.includes('boneShards') ? 1.3 : 1) * p.mods.utilityPower, 'int');
      for (const c of corpses) {
        const e = nearestEnemy(g, c.x, c.y, n.range);
        const a = e ? Math.atan2(e.y - c.y, e.x - c.x) : g.rng() * TAU;
        fireProjectile(g, c.x, c.y, a, { damage: hit.amount, crit: hit.crit, hostile: false, pierce: 999, shape: 'arrow', color: '#d8d2bd', r: 9, speed: n.speed, range: n.range, source: 'ability', dtype: 'shadow' });
        burst(g, c.x, c.y, '#d8d2bd', 6, 140);
      }
      g.corpses = g.corpses.filter((c) => !corpses.includes(c));
      shake(g, 6);
      return true;
    },
  },

  deathsDoor: {
    utility(g) {
      // the bursting dead get up again, beyond the usual limit
      const p = g.player;
      const n = N('deathsDoor');
      const c = p.cls.ability as Cfg<'raiseDead'>;
      const s = scale.raiseDead(c, sec(g));
      const count = Math.floor(per(g, n, 'raised'));
      for (let i = 0; i < count; i++) {
        const a = g.rng() * TAU;
        const d = 60 + g.rng() * 110;
        const m = createMinion(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { hp: c.minionHp, damage: attackDamage(s.damage, p.stats.int), speed: c.minionSpeed, attackCd: c.minionAttackCd, life: s.lifetime * 0.5 });
        g.minions.push(m);
        ring(g, m.x, m.y, 30, c.aura, 0.4);
      }
      floatText(g, p.x, p.y - 56, `${count} return · ${skeletonCount(g)}`, c.aura, 14);
    },
  },

  // ---------------------------------------------------------------- Archer
  meteorArrow: {
    replaceCast(g) {
      const p = g.player;
      const n = N('meteorArrow');
      const c = p.cls.ability as Cfg<'arrowVolley'>;
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(d, c.castRange) / d;
      const x = p.x + dx * k;
      const y = p.y + dy * k;
      const hit = rollPlayerHit(g, c.damage * scale.arrowVolley(c, sec(g)).arrows * n.mult, 'dex');
      const r = per(g, n, 'radius');
      const burn = attackDamage(ABILITY_UPGRADES.burningRain.n.dps, p.stats.dex, p.mods.damage);
      addZone(g, { x, y, r, delay: n.delay, damage: hit.amount, crit: hit.crit, hostile: false, color: '#e07b28', dtype: 'fire', leaveField: { life: n.fire, dps: burn, color: '#e07b28', dtype: 'fire', apply: { id: 'burn', power: burn * 0.25 } } });
      line(g, p.x, p.y - 20, p.x + (x - p.x) * 0.3, p.y - 420, '#f2c94c'); // loosed high into the sky
      meteorLands(g, n.delay, { x, y, r });
      p.abilityTime = p.abilityDur = 0.3;
      return true;
    },
  },

  stormVolley: {
    cast(g) {
      g.vars.stormUntil = g.time + 3; // the volley (and a Double Volley) comes down over the next few seconds
    },
    on: {
      onHit(g, ev) {
        if (ev.source !== 'ability' || !until(g, 'stormUntil')) return;
        const n = N('stormVolley');
        const e = ev.enemy;
        const next = g.hash.query(e.x, e.y, n.range, near).find((o) => o !== e && !o.dead);
        if (!next) return;
        line(g, e.x, e.y - 10, next.x, next.y - 10, '#a9d8ef');
        burst(g, next.x, next.y - 10, '#e8f6ff', 6, 160);
        damageEnemy(g, next, ev.amount * per(g, n, 'mult'), false, 0, 0, 'relic', 'frost'); // 'relic': it does not chain again
      },
    },
  },

  huntersMark: {
    cast(g) {
      const p = g.player;
      const c = p.cls.ability as Cfg<'arrowVolley'>;
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(d, c.castRange) / d;
      let prey: Enemy | null = null;
      for (const e of g.hash.query(p.x + dx * k, p.y + dy * k, c.radius, near)) if (!e.dead && !e.side && (!prey || e.maxHp > prey.maxHp)) prey = e;
      if (!prey) return;
      g.prey = prey;
      g.vars.preyUntil = g.time + N('huntersMark').time;
      floatText(g, prey.x, prey.y - prey.r - 30, 'PREY', '#e0402f', 16);
    },
    passive(g, dt) {
      const prey = g.prey;
      if (!prey) return;
      if (prey.dead || !until(g, 'preyUntil')) {
        g.prey = null;
        return;
      }
      g.glows.push({ x: prey.x, y: prey.y - prey.r * 0.5, r: prey.r + 10, color: '#e0402f', ring: true });
      // your arrows bend toward it
      for (const pr of g.projectiles) {
        if (pr.hostile || pr.source !== 'attack') continue;
        const want = Math.atan2(prey.y - pr.y, prey.x - pr.x);
        const have = Math.atan2(pr.vy, pr.vx);
        const turn = Math.max(-5 * dt, Math.min(5 * dt, Math.atan2(Math.sin(want - have), Math.cos(want - have))));
        const v = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(have + turn) * v;
        pr.vy = Math.sin(have + turn) * v;
      }
    },
    on: {
      onHit(g, ev) {
        if (ev.source === 'attack' && ev.enemy === g.prey) damageEnemy(g, ev.enemy, ev.amount * per(g, N('huntersMark'), 'damage'), false, 0, 0, 'relic');
      },
      onKill(g, ev) {
        if (ev.enemy !== g.prey) return;
        g.prey = null;
        const { x, y } = ev.enemy;
        huntGoesOn(g, 0.3, { x, y }); // the hunt goes on: a volley where it fell
        floatText(g, x, y - 40, 'THE HUNT GOES ON', '#e0402f', 15);
      },
    },
  },

  shadowStep: {
    utility(g, from) {
      const p = g.player;
      const n = N('shadowStep');
      const shade = createMinion(from.x, from.y, { hp: n.hp, damage: 0, speed: 0, attackCd: 99, life: n.life, r: 12 });
      Object.assign(shade, { kind: 'shade', passive: true, flip: p.flip, shoot: { every: n.every, damage: attackHit(g) * n.damage, t: 0 } } satisfies Partial<Minion>);
      g.minions.push(shade);
    },
  },

  frostTrap: {
    utility(g, from) {
      const p = g.player;
      const n = N('frostTrap');
      const hit = rollPlayerHit(g, per(g, n, 'damage') * p.mods.utilityPower, 'dex');
      addZone(g, { x: from.x, y: from.y, r: n.radius, delay: n.delay, damage: hit.amount, crit: hit.crit, hostile: false, color: '#a9d8ef', dtype: 'frost', status: { apply: [{ id: 'stun', time: n.freeze }] } });
    },
  },
};

/** The evolution this run took for that slot, if any. */
export const evolutionIn = (g: Game, slot: EvolutionSlot): EvolutionId | undefined => g.evolutions.find((id) => EVOLUTIONS[id].slot === slot);
export const evolutionHook = (g: Game, slot: EvolutionSlot): EvolutionHook | undefined => {
  const id = evolutionIn(g, slot);
  return id && HOOKS[id];
};

/** Every tick, after the ability passives (game.ts). */
export function evolutionPassives(g: Game, dt: number): void {
  for (const id of g.evolutions) HOOKS[id].passive?.(g, dt);
}

/** Take an evolution (the gold level-up card). */
export function evolve(g: Game, id: EvolutionId): void {
  if (g.evolutions.includes(id) || evolutionIn(g, EVOLUTIONS[id].slot)) return;
  const p = g.player;
  g.evolutions = [...g.evolutions, id];
  g.banner = { text: `Evolved: ${EVOLUTIONS[id].name}`, t: 3 };
  floatText(g, p.x, p.y - 60, `${EVOLUTIONS[id].icon} ${EVOLUTIONS[id].name}`, '#f2c94c', 20);
  ring(g, p.x, p.y, 180, '#f2c94c', 0.9);
  burst(g, p.x, p.y, '#f2c94c', 50, 360);
  shake(g, 10);
  sfx('levelup');
  markEvolution(g, EVOLUTIONS[id].name);
  emit(g, 'onEvolved', { id });
}

/** What the recipe logic (logic/evolutions.ts) needs from a run. */
export const buildState = (g: Game): BuildState => ({ classId: g.player.cls.id, upgrades: g.player.upgrades, utilityUpgrades: g.player.utilityUpgrades, talents: g.player.talents, relicTiers: g.player.relics.tiers, evolutions: g.evolutions });

addListener((g, name, ev) => {
  for (const id of g.evolutions) dispatch(HOOKS[id].on, g, name, ev as GameEvents[typeof name]);
});
