import type { AffixId } from '../config/elites';
import { ENEMIES, type EnemyId } from '../config/enemies';
import { MODIFIERS, WAVES } from '../config/waves';
import { sfx } from '../core/audio';
import { emit } from '../core/events';
import { TAU } from '../core/math';
import type { Enemy, Game } from '../core/types';
import { createEnemy } from '../entities/actors';
import { waveClearGold } from '../logic/economy';
import { generateWave } from '../logic/waves';
import { floatText } from './effects';

const MIN_SPAWN_DIST = 380;

/** Point on the arena edge in a random direction from the player, not right on top of them. */
function edgePoint(g: Game): { x: number; y: number } {
  const { w, h, wall } = g.arena;
  const p = g.player;
  const inset = wall + 20;
  let x = inset;
  let y = inset;
  for (let tries = 0; tries < 8; tries++) {
    const a = g.rng() * TAU;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const tx = dx > 0 ? (w - inset - p.x) / dx : dx < 0 ? (inset - p.x) / dx : Infinity;
    const ty = dy > 0 ? (h - inset - p.y) / dy : dy < 0 ? (inset - p.y) / dy : Infinity;
    const t = Math.min(tx, ty);
    x = p.x + dx * t;
    y = p.y + dy * t;
    if (t >= MIN_SPAWN_DIST) break;
  }
  return { x, y };
}

export function spawnEnemy(g: Game, id: EnemyId, x?: number, y?: number, affixes: AffixId[] = []): Enemy {
  const at = x === undefined || y === undefined ? edgePoint(g) : { x, y };
  const e = createEnemy(ENEMIES[id], at.x, at.y, g.waveHpMult * g.tier.enemyHp, g.waveDmgMult * g.tier.enemyDmg, affixes);
  g.enemies.push(e);
  if (e.def.boss) {
    g.bossHit = false; // "flawless" is judged per boss
    g.banner = { text: e.def.name, t: 3 };
    sfx('warn');
  }
  return e;
}

function startWave(g: Game): void {
  g.wave++;
  const plan = generateWave(g.wave, g.rng, { bosses: g.arena.bosses, eliteMult: g.tier.eliteMult });
  g.waveHpMult = plan.hpMult;
  g.waveDmgMult = plan.dmgMult;
  g.modifier = plan.modifier;
  g.spawnQueue = plan.spawns.map((id, i) => ({ id, affixes: plan.elites[i] ?? [] }));
  g.spawnInterval = plan.spawnInterval;
  g.spawnTimer = 0;
  if (g.wave === 10) g.wave10Time = g.time;
  const title = plan.boss ? `Wave ${g.wave} — Boss` : `Wave ${g.wave}`;
  g.banner = { text: plan.modifier ? `${title} · ${MODIFIERS[plan.modifier].name}` : title, t: plan.modifier ? 3 : 2 };
  sfx('wave');
  emit(g, 'onWaveStart', { wave: g.wave });
}

export function updateSpawning(g: Game, dt: number): void {
  if (g.breather > 0) {
    g.breather -= dt;
    if (g.breather <= 0) startWave(g);
    return;
  }
  if (g.spawnQueue.length > 0) {
    g.spawnTimer -= dt;
    while (g.spawnTimer <= 0 && g.spawnQueue.length > 0) {
      const next = g.spawnQueue.shift()!;
      spawnEnemy(g, next.id, undefined, undefined, next.affixes);
      g.spawnTimer += g.spawnInterval;
    }
    return;
  }
  // wave over: everything dead, or the stragglers have had their time (no stalemates, no safe farming)
  g.vars.overtime = (g.vars.overtime ?? 0) + dt;
  const cleared = g.enemies.length === 0;
  if (cleared || (g.vars.overtime > WAVES.overtime && !g.enemies.some((e) => e.def.boss))) {
    g.vars.overtime = 0;
    g.breather = cleared ? WAVES.breather : 0.01;
    g.wavesCleared = g.wave;
    g.modifier = null;
    const bonus = waveClearGold(g.wave, g.player.mods.gold * g.tier.gold);
    g.gold += bonus;
    floatText(g, g.player.x, g.player.y - 60, `+${bonus} gold`, '#c9a227', 15);
    g.banner = { text: cleared ? 'Wave cleared' : 'They keep coming', t: 1.5 };
  }
}
