import { AI, AI_TUNING, AURA_PULSE, DEFAULT_AI } from '../config/ai';
import { AFFIXES } from '../config/elites';
import type { EnemyId } from '../config/enemies';
import { MODIFIERS } from '../config/waves';
import { sfx } from '../core/audio';
import { dist2, TAU } from '../core/math';
import type { Enemy, Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { nextState, type AiProfile, type AiState } from '../logic/fsm';
import { slotPosition } from '../logic/squads';
import { angleTo, distTo, enraged, keepRange, move, moveTo, POISON, seek, shootAt, specialDamage, summon, touch, type Target } from './aiHelpers';
import { hurtTarget } from './combat';
import { burst, ring, shake } from './effects';
import { SPECIALS } from './specials';

const HOSTILE = '#c23a2e';

/** Enemies go for whatever is closest, so minions genuinely tank for the Necromancer. A marching squad shares one target. */
function pickTarget(g: Game, e: Enemy): Target {
  if (e.squad?.marching && e.squad.target) return e.squad.target;
  let best: Target = g.player;
  let bestD = dist2(e.x, e.y, best.x, best.y);
  for (const m of g.minions) {
    const d = dist2(e.x, e.y, m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

// ---------------------------------------------------------------- the state machine (regular enemies)

/** The slower checks, every AI_TUNING.thinkEvery: are friends queueing in front of me, where is the nearest healer. */
function think(g: Game, e: Enemy, t: Target, profile: AiProfile): void {
  const a = angleTo(e, t);
  const ahead = g.hash.query(e.x + Math.cos(a) * AI_TUNING.crowdProbe, e.y + Math.sin(a) * AI_TUNING.crowdProbe, AI_TUNING.crowdRadius, []);
  e.crowded = ahead.filter((o) => o !== e && !o.dead).length >= AI_TUNING.crowdCount;
  if (profile.fleeToHealer) {
    e.healer = null;
    let best = AI_TUNING.healerSearch ** 2;
    for (const o of g.enemies) {
      if (o.dead || o === e || !(o.def.healAmount || o.def.aura?.kind === 'heal')) continue;
      const d = dist2(e.x, e.y, o.x, o.y);
      if (d < best) (best = d), (e.healer = o);
    }
  }
}

/** What each state does. Transitions are decided by logic/fsm.ts; this is only movement and attacks. */
const STATES: Record<AiState, (g: Game, e: Enemy, t: Target, p: AiProfile, dt: number) => void> = {
  idle() {},

  approach: (_g, e, t, _p, dt) => seek(e, t, e.speed, dt),

  // swing round the target instead of queueing behind the front rank
  flank(_g, e, t, _p, dt) {
    const d = distTo(e, t);
    const around = Math.atan2(e.y - t.y, e.x - t.x) + e.flankDir * AI_TUNING.flankAngle;
    const r = Math.max(e.r + t.r, d * 0.75);
    e.flip = t.x < e.x;
    e.angle = angleTo(e, t);
    moveTo(e, t.x + Math.cos(around) * r, t.y + Math.sin(around) * r, e.speed, dt);
  },

  attack(g, e, t, p, dt) {
    if (p.reach === 'melee') {
      seek(e, t, e.speed, dt);
      touch(g, e, t);
      return;
    }
    e.flip = t.x < e.x;
    e.angle = angleTo(e, t);
    if (e.strafeT > 0) {
      e.strafeT -= dt; // reposition between shots
      move(e, e.angle + (Math.PI / 2) * e.flankDir, e.speed, dt);
    }
    if (p.reach !== 'ranged') return; // support units hold their ground and let their aura work
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = e.def.fireCd!;
      shootAt(g, e, e.angle);
      if (p.strafe) {
        e.strafeT = AI_TUNING.strafeTime;
        if (g.rng() < 0.5) e.flankDir = -e.flankDir as 1 | -1;
      }
    }
  },

  // ranged: back away from whoever got too close. melee: wheel away after a special (hit and run).
  retreat(_g, e, t, p, dt) {
    e.flip = t.x < e.x;
    const away = angleTo(e, t) + Math.PI + (p.reach === 'melee' ? e.flankDir * 0.7 : 0);
    move(e, away, e.speed * (p.reach === 'melee' ? 1 : 0.85), dt);
  },

  // towards a healer when there is one, otherwise just away
  flee(g, e, _t, _p, dt) {
    e.telegraph = null;
    const h = e.healer && !e.healer.dead ? e.healer : null;
    if (h && distTo(e, h) > 50) moveTo(e, h.x, h.y, e.speed * AI_TUNING.fleeSpeed, dt);
    else if (!h) move(e, angleTo(e, g.player) + Math.PI, e.speed * AI_TUNING.fleeSpeed, dt);
    e.flip = g.player.x > e.x;
  },

  // keep my slot in the formation while the squad marches
  regroup(_g, e, _t, _p, dt) {
    const sq = e.squad!;
    const slot = slotPosition(sq, sq.facing, e.slot < 0 ? sq.commanderSlot : sq.offsets[e.slot]);
    moveTo(e, slot.x, slot.y, e.speed * AI_TUNING.regroupSpeed, dt);
    e.angle = sq.facing;
    e.flip = Math.cos(sq.facing) < 0;
  },

  special() {}, // handled in runStateMachine: it needs the "done" result
};

function runStateMachine(g: Game, e: Enemy, dt: number): void {
  const profile = AI[e.def.id] ?? DEFAULT_AI;
  const t = pickTarget(g, e);
  e.aiT += dt;
  e.retreatT -= dt;
  e.fleeCd -= dt;
  e.special -= dt;
  if ((e.thinkT -= dt) <= 0) {
    e.thinkT = AI_TUNING.thinkEvery * (0.8 + e.flankRoll * 0.4); // spread the work over ticks
    think(g, e, t, profile);
  }

  let specialDone = false;
  if (e.ai === 'special') {
    specialDone = SPECIALS[profile.special!.id](g, e, t, dt);
    if (specialDone) {
      e.special = profile.special!.cd;
      e.retreatT = profile.retreatAfterSpecial ?? 0;
      e.state = 0;
    }
  }
  const next = nextState(profile, e.ai, {
    dist: distTo(e, t),
    reach: e.r + t.r + 2,
    hpFrac: e.hp / e.maxHp,
    timeInState: e.aiT,
    timeAlive: g.time - e.born,
    feared: e.fearT > 0,
    fleeOnCooldown: e.fleeCd > 0,
    squadMarching: e.squad?.marching === true,
    specialReady: e.special <= 0,
    specialDone,
    retreating: e.retreatT > 0,
    crowded: e.crowded,
    flankRoll: e.flankRoll,
  });
  if (next !== e.ai) {
    if (e.ai === 'flee') e.fleeCd = AI_TUNING.fleeCooldown;
    if (e.ai === 'special') e.telegraph = null; // interrupted (feared mid-windup)
    e.ai = next;
    e.aiT = 0;
    if (next === 'special') e.state = 0;
  }
  if (e.ai !== 'special') STATES[e.ai](g, e, t, profile, dt);
}

/** Commanders: a pulse every AURA_PULSE.every that buffs (or heals and rallies) everyone around them. */
function pulseAura(g: Game, e: Enemy, dt: number): void {
  const aura = e.def.aura!;
  if ((e.auraT -= dt) > 0) return;
  const healing = aura.kind === 'heal';
  e.auraT = healing ? aura.every! : AURA_PULSE.every;
  for (const o of g.hash.query(e.x, e.y, aura.radius, [])) {
    if (o === e || o.dead || o.def.boss) continue;
    if (healing) {
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * aura.value);
      o.fearT = o.slowT = 0; // cleanse
    } else {
      if (aura.kind === 'damage') o.buffDmg = Math.max(o.buffT > 0 ? o.buffDmg : 1, aura.value);
      else o.buffSpd = Math.max(o.buffT > 0 ? o.buffSpd : 1, aura.value);
      o.buffT = Math.max(o.buffT, AURA_PULSE.lasts);
    }
  }
  if (healing) ring(g, e.x, e.y, aura.radius, '#6fdc6f', 0.5);
}

// ---------------------------------------------------------------- bosses: scripted, branching on e.phase

const BOSSES: Partial<Record<EnemyId, (g: Game, e: Enemy, dt: number) => void>> = {
  // Black Knight: telegraphed line charge. Phase 2: chains several charges back to back.
  blackKnight(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    e.timer -= dt;
    const windUp = (scale: number) => {
      e.state = 1;
      e.timer = def.windup! * scale;
      e.angle = angleTo(e, t);
      e.telegraph = { angle: e.angle, length: def.chargeDist!, width: e.r * 2.4, t: 0, dur: e.timer };
      sfx('warn');
    };
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      touch(g, e, t);
      e.special -= dt;
      if (e.special <= 0 && distTo(e, t) < def.chargeDist!) windUp(1);
    } else if (e.state === 1) {
      e.telegraph!.t += dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = def.chargeDist! / def.chargeSpeed!;
        e.telegraph = null;
        e.charged = false;
      }
    } else if (e.state === 2) {
      move(e, e.angle, def.chargeSpeed!, dt);
      for (const v of [g.player, ...g.minions]) {
        if (distTo(e, v) > e.r + v.r + 6 || (v === g.player && e.charged)) continue;
        if (v === g.player) e.charged = true;
        hurtTarget(g, v, specialDamage(e), true, e);
      }
      if (e.timer <= 0) {
        if (e.phase >= 2 && e.combo < def.p2Combo!) {
          e.combo++;
          windUp(0.55);
        } else {
          e.combo = 0;
          e.state = 3;
          e.timer = 0.7;
        }
      }
    } else if (e.timer <= 0) {
      e.state = 0;
      e.special = def.specialCd!;
    }
  },

  // Warlord: telegraphed ground slam around himself, then calls the pack. Phase 2: hurls boulders after every slam.
  warlord(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      touch(g, e, t);
      e.special -= dt;
      if (e.special <= 0 && distTo(e, t) < def.slamRadius! * 1.3) {
        e.state = 1;
        e.timer = def.windup!;
        addZone(g, { x: e.x, y: e.y, r: def.slamRadius!, delay: def.windup!, damage: specialDamage(e), hostile: true, color: HOSTILE, owner: e });
        sfx('warn');
      }
    } else {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 0;
        e.special = def.specialCd!;
        summon(g, e);
        if (e.phase >= 2) {
          for (let i = 0; i < def.p2Boulders!; i++) {
            const a = g.rng() * TAU;
            const off = i === 0 ? 0 : 40 + g.rng() * 110;
            addZone(g, { x: g.player.x + Math.cos(a) * off, y: g.player.y + Math.sin(a) * off, r: 70, delay: 0.9 + i * 0.35, damage: specialDamage(e) * 0.7, hostile: true, color: '#8a6a42', owner: e });
          }
        }
      }
    }
  },

  // Lich: keeps its distance, fans of bolts, telegraphed hexes under the player's feet. Phase 2: bolt rings and more hexes.
  lich(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    const d = keepRange(e, t, dt);
    e.timer -= dt;
    if (e.timer <= 0 && d < def.range! * 1.5) {
      e.timer = def.fireCd!;
      for (const spread of [-0.3, 0, 0.3]) shootAt(g, e, angleTo(e, t) + spread);
      if (e.phase >= 2 && e.combo++ % 2 === 0) for (let i = 0; i < def.p2RingBolts!; i++) shootAt(g, e, (i / def.p2RingBolts!) * TAU);
    }
    e.special -= dt;
    if (e.special <= 0) {
      e.special = def.specialCd!;
      sfx('warn');
      const p = g.player;
      const count = def.zoneCount! + (e.phase >= 2 ? def.p2ExtraZones! : 0);
      for (let i = 0; i < count; i++) {
        const off = i === 0 ? 0 : 60 + g.rng() * 140; // first hex is dead on, the rest cut off escape routes
        const a = g.rng() * TAU;
        addZone(g, { x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off, r: def.zoneRadius!, delay: def.windup! + i * 0.12, damage: specialDamage(e), hostile: true, color: '#7a4fa0', owner: e });
      }
    }
  },

  // Grand Inquisitor: walks you down and sends a line of pyres racing at you. Phase 2: a fan of lines, plus cultists.
  inquisitor(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    if (e.state === 1) {
      e.timer -= dt; // stands still while casting
      if (e.timer <= 0) e.state = 0;
      return;
    }
    seek(e, t, e.speed, dt);
    touch(g, e, t);
    e.special -= dt;
    if (e.special > 0 || distTo(e, t) > def.lineZones! * def.lineSpacing!) return;
    e.special = def.specialCd!;
    e.state = 1;
    e.timer = 0.6;
    sfx('warn');
    const lines = e.phase >= 2 ? def.p2Lines! : 1;
    for (let k = 0; k < lines; k++) {
      const a = angleTo(e, t) + (k - (lines - 1) / 2) * 0.5;
      for (let i = 1; i <= def.lineZones!; i++) {
        addZone(g, { x: e.x + Math.cos(a) * def.lineSpacing! * i, y: e.y + Math.sin(a) * def.lineSpacing! * i, r: def.zoneRadius!, delay: def.windup! + i * 0.09, damage: specialDamage(e), hostile: true, color: '#e07b28', owner: e });
      }
    }
    if (e.phase >= 2) summon(g, e);
  },

  // Plague Abbot: lobs flasks that leave poison pools. Phase 2: a ring of flasks closes in around you.
  abbot(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    const d = keepRange(e, t, dt);
    e.timer -= dt;
    if (e.timer <= 0 && d < def.range! * 1.5) {
      e.timer = def.fireCd!;
      shootAt(g, e, angleTo(e, t));
    }
    e.special -= dt;
    if (e.special > 0) return;
    e.special = def.specialCd!;
    sfx('warn');
    const p = g.player;
    const pool = { life: def.poolLife!, dps: def.poolDps! * g.waveDmgMult * g.tier.enemyDmg, color: POISON };
    const flask = (x: number, y: number, delay: number) =>
      addZone(g, { x, y, r: def.zoneRadius!, delay, damage: specialDamage(e), hostile: true, color: POISON, owner: e, leaveField: pool });
    for (let i = 0; i < def.flasks!; i++) {
      const a = g.rng() * TAU;
      const off = i === 0 ? 0 : 70 + g.rng() * 120;
      flask(p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, def.windup! + i * 0.2);
    }
    if (e.phase >= 2) {
      const gap = Math.floor(g.rng() * def.p2RingFlasks!); // one way out
      for (let i = 0; i < def.p2RingFlasks!; i++) {
        if (i !== gap) flask(p.x + Math.cos((i / def.p2RingFlasks!) * TAU) * 190, p.y + Math.sin((i / def.p2RingFlasks!) * TAU) * 190, def.windup! + 0.4);
      }
    }
  },
};

/** Bosses register extra scripts here (systems/bosses.ts) without this file growing. */
export function registerBoss(id: EnemyId, script: (g: Game, e: Enemy, dt: number) => void): void {
  BOSSES[id] = script;
}
export { pickTarget };

function enterPhase(g: Game, e: Enemy, phase: number): void {
  e.phase = phase;
  e.special = Math.min(e.special, 1.2);
  g.banner = { text: `${e.def.name} is enraged`, t: 2.2 };
  ring(g, e.x, e.y, 200, HOSTILE, 0.7);
  burst(g, e.x, e.y, HOSTILE, 40, 300);
  shake(g, 14);
  sfx('warn');
  if (e.def.id === 'abbot') summon(g, e);
}

export function updateEnemies(g: Game, dt: number): void {
  const p = g.player;
  const moon = g.modifier === 'bloodMoon' ? MODIFIERS.bloodMoon.n.speed : 1;
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.attackTimer -= dt;
    e.flash -= dt;
    e.slowT -= dt;
    e.fearT -= dt;
    e.markT -= dt;
    e.buffT -= dt;
    if (e.def.boss) {
      const phases = e.def.phases ?? 2; // phase thresholds split the HP bar evenly: 2 phases -> 50%, 3 -> 66% and 33%
      if (e.phase < phases && e.hp <= e.maxHp * (1 - e.phase / phases)) enterPhase(g, e, e.phase + 1);
    }

    e.speed = e.baseSpeed * moon * (e.slowT > 0 ? e.slowMul : 1) * (enraged(e) ? AFFIXES.enraged.n.speed : 1) * (e.buffT > 0 ? e.buffSpd : 1) * (e.phase >= 2 ? (e.def.p2SpeedMult ?? 1) : 1);

    if (e.shieldMax > 0) {
      e.shieldT -= dt;
      if (e.shieldT <= 0 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + (e.shieldMax / AFFIXES.shielded.n.regenTime) * dt);
    }
    if (e.affixes.includes('frostAura') && dist2(e.x, e.y, p.x, p.y) < AFFIXES.frostAura.n.radius ** 2) p.chillT = AFFIXES.frostAura.n.linger;
    if (e.def.aura) pulseAura(g, e, dt);

    const script = BOSSES[e.def.id];
    if (script) script(g, e, dt);
    else runStateMachine(g, e, dt);
  }
}
