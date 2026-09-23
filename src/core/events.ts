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
  onAbilityEnd: Record<string, never>; // v0.5: the signature ability's active time ran out (after its own expire)
  onUtilityUsed: { id: string }; // v0.4
  onWaveStart: { wave: number };
  // v0.7 relic families (RELICS.md)
  onIncoming: { amount: number; attacker: Enemy | null; blocked: boolean }; // before a hit lands: listeners may shrink it or block it
  onBlock: { amount: number; attacker: Enemy | null }; // a hit blocked (Steel)
  onHeal: { amount: number; over: number }; // HP restored, and what went past full (Holy's Radiance)
  onFreeze: { enemy: Enemy }; // chill tipped over into a freeze
  onChain: { enemy: Enemy }; // a chain jumped to this enemy (Storm)
  onRevive: Record<string, never>; // a revive charge was spent (Phoenix Feather's Rebirth)
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
