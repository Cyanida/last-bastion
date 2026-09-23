import { sfx } from '../core/audio';
import type { Enemy, Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { angleTo, hitDamage, move, moveTo, POISON, touch, type Target } from './aiHelpers';
import { burst, floatText, line, ring } from './effects';
import { spawnEnemy } from './spawning';

/**
 * Type-specific actions the state machine runs in its 'special' state (config/ai.ts names them).
 * Called every tick while in that state; return true when the action is over. e.state / e.timer are scratch,
 * reset to 0 when the state is entered.
 */
export type Special = (g: Game, e: Enemy, t: Target, dt: number) => boolean;

export const SPECIALS: Record<string, Special> = {
  // crouch -> leap in a straight line. Wolves do it quickly, cavalry does it long and telegraphed.
  lunge(g, e, t, dt) {
    const def = e.def;
    if (e.state === 0) {
      e.state = 1;
      e.timer = def.windup!;
      e.angle = angleTo(e, t);
      e.flip = t.x < e.x;
      // v0.6: an elite's leap is heavy: it always shows its line
      if (def.telegraphLunge || e.elite) e.telegraph = { angle: e.angle, length: def.lungeSpeed! * def.lungeTime!, width: e.r * 2, t: 0, dur: def.windup! };
      return false;
    }
    e.timer -= dt;
    if (e.state === 1) {
      if (e.telegraph) e.telegraph.t += dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = def.lungeTime!;
        e.telegraph = null;
      }
      return false;
    }
    move(e, e.angle, def.lungeSpeed!, dt);
    touch(g, e, t, 1.5);
    return e.timer <= 0;
  },

  // plants itself and blows up after a telegraphed fuse. Killing it first cancels the blast; it never "finishes".
  fuse(g, e, _t, dt) {
    if (e.state === 0) {
      e.state = 1;
      e.timer = e.def.fuse!;
      addZone(g, { x: e.x, y: e.y, r: e.def.blastRadius!, delay: e.def.fuse!, damage: hitDamage(e), hostile: true, color: '#e07b28', owner: e, killsOwner: true });
      sfx('warn');
    } else e.timer -= dt; // only drives the blink; the zone kills its owner when it detonates
    return false;
  },

  // tops up the most wounded ally in reach
  heal(g, e) {
    let worst: Enemy | null = null;
    for (const o of g.hash.query(e.x, e.y, e.def.healRange!, [])) {
      if (o !== e && !o.dead && o.hp < o.maxHp && (!worst || o.hp / o.maxHp < worst.hp / worst.maxHp)) worst = o;
    }
    if (worst) {
      const amount = Math.min(worst.maxHp - worst.hp, e.def.healAmount! * g.waveHpMult);
      worst.hp += amount;
      line(g, e.x, e.y - 10, worst.x, worst.y, '#6fdc6f');
      floatText(g, worst.x, worst.y - worst.r - 8, `+${Math.round(amount)}`, '#6fdc6f', 12);
    }
    return true;
  },

  // engineer: hammers a ballista together; kill him before it stands, or kill the ballista after
  build(g, e, _t, dt) {
    if (e.combo >= e.def.summonCount!) return true;
    if (e.state === 0) {
      e.state = 1;
      e.timer = e.def.windup!;
      floatText(g, e.x, e.y - 30, 'building…', '#8a6a42', 12);
    }
    if ((e.timer -= dt) > 0) return false;
    e.combo++;
    spawnEnemy(g, e.def.summon!, e.x + (e.flip ? -34 : 34), e.y);
    ring(g, e.x, e.y, 40, '#8a6a42');
    return true;
  },

  // plague doctor: a telegraphed flask that leaves a poison cloud, and once in his life he raises a fallen unit
  plague(g, e, t) {
    const def = e.def;
    addZone(g, {
      x: t.x, y: t.y, r: def.zoneRadius!, delay: def.windup!, damage: hitDamage(e), hostile: true, color: POISON, owner: e, dtype: 'shadow',
      leaveField: { life: def.poolLife!, dps: def.poolDps! * g.waveDmgMult, color: POISON, dtype: 'shadow', apply: { id: 'poison', power: def.poolDps! * 0.5 * g.waveDmgMult } },
    });
    const corpse = e.charged ? undefined : g.corpses.find((c) => Math.hypot(c.x - e.x, c.y - e.y) < 240);
    if (corpse) {
      e.charged = true;
      g.corpses.splice(g.corpses.indexOf(corpse), 1);
      const risen = spawnEnemy(g, def.summon!, corpse.x, corpse.y);
      risen.hp = Math.round(risen.maxHp * 0.6);
      line(g, e.x, e.y - 10, corpse.x, corpse.y, POISON);
      floatText(g, corpse.x, corpse.y - 20, 'revived', POISON, 13);
    }
    return true;
  },

  // hound master: the pack answers. Faster, meaner, and every wolf is ready to leap right now.
  whistle(g, e) {
    for (const m of e.squad?.members ?? []) {
      Object.assign(m, { buffSpd: 1.5, buffDmg: 1.3, buffT: 3.5, special: 0 });
      line(g, e.x, e.y - 12, m.x, m.y, '#e8e2d0');
    }
    ring(g, e.x, e.y, 120, '#e8e2d0', 0.5);
    sfx('warn');
    return true;
  },

  // siege tower: the door drops and more of them pile out, until it is a heap of planks
  deploy(g, e) {
    if (g.enemies.length > 70) return true;
    for (let i = 0; i < e.def.summonCount!; i++) spawnEnemy(g, g.rng() < 0.6 ? 'peasant' : 'crossbow', e.x + (i ? 36 : -36), e.y + 34);
    ring(g, e.x, e.y + 20, 50, '#8a6a42');
    return true;
  },

  // v0.5 siege camp (a quest target): one more of the levy, only while a wave is on. Side content, like the camp itself.
  muster(g, e) {
    if (g.breather > 0 || g.enemies.length > 70) return true;
    spawnEnemy(g, 'peasant', e.x, e.y + e.r + 14).side = true;
    ring(g, e.x, e.y + 10, 40, '#8a6a42');
    return true;
  },

  // assassin: vanish -> slip round to the far side of the target -> reappear -> stab
  ambush(g, e, t, dt) {
    e.timer -= dt;
    if (e.state === 0) {
      e.state = 1;
      e.timer = 0.4;
      e.hidden = true;
      burst(g, e.x, e.y, '#2b2b33', 10, 120);
    } else if (e.state === 1 && e.timer <= 0) {
      e.state = 2;
      e.timer = 1.8;
      e.angle = angleTo(e, t); // he started on this side, so "behind" is the other one
    } else if (e.state === 2) {
      const left = moveTo(e, t.x + Math.cos(e.angle) * 38, t.y + Math.sin(e.angle) * 38, e.baseSpeed * 3, dt);
      if (left < 12 || e.timer <= 0) {
        e.state = 3;
        e.timer = e.def.windup!;
        e.windupT = e.def.windup!; // v0.6: glows while the stab winds up
        e.hidden = false;
        e.flip = t.x < e.x;
        floatText(g, e.x, e.y - 26, '!', '#c23a2e', 20);
      }
    } else if (e.state === 3 && e.timer <= 0) {
      e.attackTimer = 0;
      touch(g, e, t, e.def.specialMult!);
      return true;
    }
    return false;
  },

  // bone collector: corpses first. Each one makes him bigger, and is one the Necromancer does not get.
  collect(g, e, _t, dt) {
    const grow = e.def.grow!;
    if (e.combo >= grow.max) return true;
    let corpse = null;
    let best = 520;
    for (const c of g.corpses) {
      const d = Math.hypot(c.x - e.x, c.y - e.y);
      if (d < best) (best = d), (corpse = c);
    }
    if (!corpse) return true;
    e.flip = corpse.x < e.x;
    if (moveTo(e, corpse.x, corpse.y, e.speed * 1.25, dt) > 14) return false;
    g.corpses.splice(g.corpses.indexOf(corpse), 1);
    e.combo++;
    e.maxHp = Math.round(e.maxHp * (1 + grow.hp));
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * grow.hp);
    e.damage *= 1 + grow.damage;
    e.r += grow.radius;
    ring(g, e.x, e.y, 36, '#d8d2bd');
    floatText(g, e.x, e.y - e.r - 12, 'grows', '#d8d2bd', 12);
    return true;
  },
};
