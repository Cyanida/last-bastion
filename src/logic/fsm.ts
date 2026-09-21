/**
 * Enemy state machine, as a pure transition function. systems/enemyAI.ts gathers the context, asks for the next
 * state and then runs that state's movement / attack. Per-type differences are data: config/ai.ts.
 */
export type AiState = 'idle' | 'approach' | 'flank' | 'attack' | 'retreat' | 'flee' | 'regroup' | 'special';

export interface AiProfile {
  reach: 'melee' | 'ranged' | 'support'; // support: keeps its distance and never attacks (commanders)
  flank: number; // 0..1: how readily a melee unit circles round instead of queueing up behind its friends
  range?: [number, number]; // ranged/support: back off when closer than [0], close in when farther than [1]
  strafe?: boolean; // ranged: sidestep after every shot
  fleeBelow?: number; // HP fraction under which it runs...
  fleeToHealer?: boolean; // ...towards the nearest healer, if there is one
  special?: { id: string; cd: number; range: number; minRange?: number }; // see systems/specials.ts
  retreatAfterSpecial?: number; // seconds of backing off after the special (hit and run)
}

export interface AiContext {
  dist: number; // to the current target
  reach: number; // distance at which a melee hit lands
  hpFrac: number;
  timeInState: number;
  timeAlive: number;
  feared: boolean;
  fleeOnCooldown: boolean; // fled recently: do not yo-yo
  squadMarching: boolean; // its squad is still advancing in formation
  specialReady: boolean;
  specialDone: boolean; // only meaningful while in 'special'
  retreating: boolean; // hit-and-run timer running
  crowded: boolean; // friends are already queueing between it and the target
  flankRoll: number; // fixed 0..1 per enemy, compared with profile.flank
}

export const FLEE_MAX_TIME = 6;
export const FLEE_RECOVER = 0.2; // comes back once HP is this far above fleeBelow
export const FLANK_MAX_TIME = 4;
export const FLANK_RANGE = 440;
const SPAWN_IDLE = 0.35;

export function nextState(p: AiProfile, state: AiState, c: AiContext): AiState {
  if (state === 'special' && !c.specialDone) return 'special'; // a special always plays out
  if (c.feared) return 'flee';
  if (c.timeAlive < SPAWN_IDLE) return 'idle';

  if (p.fleeBelow !== undefined) {
    const fleeing = state === 'flee';
    if (fleeing && c.timeInState < FLEE_MAX_TIME && c.hpFrac < p.fleeBelow + FLEE_RECOVER) return 'flee';
    if (!fleeing && !c.fleeOnCooldown && c.hpFrac < p.fleeBelow) return 'flee';
  }
  if (c.squadMarching) return 'regroup';

  const sp = p.special;
  if (sp && c.specialReady && c.dist <= sp.range && c.dist >= (sp.minRange ?? 0)) return 'special';

  if (p.reach !== 'melee') {
    const [near, far] = p.range ?? [160, 300];
    if (c.dist < near) return 'retreat';
    if (c.dist > far) return 'approach';
    return 'attack';
  }

  if (c.retreating) return 'retreat';
  if (c.dist <= c.reach) return 'attack';
  if (state === 'flank' && c.timeInState < FLANK_MAX_TIME) return 'flank'; // commit to the manoeuvre
  if (c.crowded && c.dist < FLANK_RANGE && c.flankRoll < p.flank && state !== 'flank') return 'flank';
  return 'approach';
}
