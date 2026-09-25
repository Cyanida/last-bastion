import type { EvolutionId } from '../config/evolutions';
import type { DuoId, FamilyId, RelicId, SetLevel } from '../config/relics';
import { withPlayer } from '../logic/players';
import type { DamageSource, Enemy, Game, Player } from './types';

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
  onChain: { enemy: Enemy; from: Enemy; amount: number }; // a chain jumped from `from` to `enemy` for `amount` (Storm)
  onRevive: Record<string, never>; // a revive charge was spent (Phoenix Feather's Rebirth)
  onRelicTier: { id: RelicId; tier: number }; // A4: attunement raised a relic a tier (the hook for the 0.7.1 stinger)
  onWaveCleared: { wave: number };
  onDuoFormed: { id: DuoId }; // A5: a duo was taken (the run log; a stinger in 0.7.1)
  // v0.7.1: moments the run music marks with a stinger (main.ts listens; the simulation itself stays silent)
  onSetBonus: { family: FamilyId; level: SetLevel }; // a family's set reached a new level (2, 4, 6)
  onEvolved: { id: EvolutionId };
  onBossPhase: { enemy: Enemy; phase: number };
}
export type EventName = keyof GameEvents;
export type Handlers = { [K in EventName]?: (g: Game, ev: GameEvents[K], p: Player) => void };

/** v0.8 (#28): every event carries its player `p`: who hit, killed, was hurt, healed or cast. */
type Listener = <K extends EventName>(g: Game, name: K, ev: GameEvents[K], p: Player) => void;
const listeners: { l: Listener; each: boolean }[] = [];

/** The run's own moments: a per-player listener hears each of them once for every player, with the focus on that player. */
const WORLD = new Set<EventName>(['onWaveStart', 'onWaveCleared', 'onBossPhase']);

/** `each`: the listener is about one player's things (their relics, talents, ability, evolutions), so it hears world events per player. */
export function addListener(l: Listener, each = false): void {
  listeners.push({ l, each });
}

/** Calls handlers[name] if present. The cast is sound: name and ev share the same K. */
export function dispatch<K extends EventName>(handlers: Handlers | undefined, g: Game, name: K, ev: GameEvents[K], p: Player): void {
  (handlers?.[name] as ((g: Game, ev: GameEvents[K], p: Player) => void) | undefined)?.(g, ev, p);
}

/** `p` defaults to the player whose turn it is (logic/players.ts focus), which is the one acting at every emit site today. */
export function emit<K extends EventName>(g: Game, name: K, ev: GameEvents[K], p: Player = g.player): void {
  const world = WORLD.has(name);
  for (const { l, each } of listeners) {
    if (world && each) for (const q of g.players) withPlayer(g, q, () => l(g, name, ev, q));
    else l(g, name, ev, p);
  }
}
