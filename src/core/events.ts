import type { DamageSource, Enemy, Game } from './types';

/**
 * Tiny synchronous event bus. Combat and spawning emit; relics and ability upgrades listen.
 * Listeners must not reuse a caller's scratch arrays: they can run in the middle of a damage loop.
 */
export interface GameEvents {
  onHit: { enemy: Enemy; amount: number; crit: boolean; source: DamageSource };
  onKill: { enemy: Enemy; source: DamageSource };
  onDamageTaken: { amount: number; attacker: Enemy | null };
  onBlocked: { amount: number; attacker: Enemy | null }; // damage stopped by invulnerability
  onAbilityUsed: { cooldown: number };
  onWaveStart: { wave: number };
}
export type EventName = keyof GameEvents;
export type Handlers = { [K in EventName]?: (g: Game, ev: GameEvents[K]) => void };

type Listener = <K extends EventName>(g: Game, name: K, ev: GameEvents[K]) => void;
const listeners: Listener[] = [];

export function addListener(l: Listener): void {
  listeners.push(l);
}

/** Calls handlers[name] if present. The cast is sound: name and ev share the same K. */
export function dispatch<K extends EventName>(handlers: Handlers | undefined, g: Game, name: K, ev: GameEvents[K]): void {
  (handlers?.[name] as ((g: Game, ev: GameEvents[K]) => void) | undefined)?.(g, ev);
}

export function emit<K extends EventName>(g: Game, name: K, ev: GameEvents[K]): void {
  for (const l of listeners) l(g, name, ev);
}
