import { NET, type NetConditions } from '../config/net';
import type { Rng } from '../core/types';
import type { Command } from '../sim/commands';
import type { Snapshot } from '../sim/snapshot';

/**
 * v0.8 (#31, ARCHITECTURE.md): how two copies of the game talk. The same commands step() takes go one way, snapshots of the Game
 * the other. A Transport is unreliable like the real thing will be: messages are late, jittered, reordered or lost (config/net.ts).
 * Two loopbacks: an in-memory pair (tests) and a BroadcastChannel (two windows on one machine, ?net=<room>).
 */

export type NetMessage = { t: 'command'; cmd: Command } | { t: 'snapshot'; tick: number; snap: Snapshot };

export interface Transport {
  /** A peer answered, and neither side has closed. */
  readonly connected: boolean;
  send(m: NetMessage): void;
  /** Every message that has arrived by now, in arrival order. */
  receive(): NetMessage[];
  close(): void;
}

/** The receiving end of the simulated network: each message is dropped, or held for its latency and jitter. */
class Inbox {
  private q: { at: number; m: NetMessage }[] = [];
  constructor(
    private net: NetConditions,
    private rng: Rng,
    private clock: () => number,
  ) {}
  push(m: NetMessage): void {
    if (this.rng() < this.net.loss) return;
    const delay = Math.max(0, this.net.latencyMs + this.net.jitterMs * (2 * this.rng() - 1));
    this.q.push({ at: this.clock() + delay, m });
  }
  take(): NetMessage[] {
    const now = this.clock();
    const due = this.q.filter((e) => e.at <= now).sort((a, b) => a.at - b.at);
    if (due.length) this.q = this.q.filter((e) => e.at > now);
    return due.map((e) => e.m);
  }
}

/** Two connected ends in memory. Messages are structured-cloned like BroadcastChannel does, so nothing shared leaks across. */
export function loopbackPair(rng: Rng, net: NetConditions = NET, clock: () => number = () => performance.now()): [Transport, Transport] {
  let open = true;
  const inboxes = [new Inbox(net, rng, clock), new Inbox(net, rng, clock)];
  const end = (i: number): Transport => ({
    get connected() {
      return open;
    },
    send: (m) => open && inboxes[1 - i].push(structuredClone(m)),
    receive: () => inboxes[i].take(),
    close: () => void (open = false),
  });
  return [end(0), end(1)];
}

type Wire = NetMessage | { t: 'hello'; reply: boolean } | { t: 'bye' };

/**
 * One window's end of a room on a BroadcastChannel. It says hello on connect and whoever is there says hello back.
 * The hello and bye skip the simulated network. ponytail: every window in the room hears everything; fine for two, a peer id when 3-4 join.
 */
export function broadcastTransport(room: string, rng: Rng = Math.random, net: NetConditions = NET, clock: () => number = () => performance.now()): Transport {
  const ch = new BroadcastChannel(`${NET.channel}:${room}`);
  const inbox = new Inbox(net, rng, clock);
  let connected = false;
  ch.onmessage = (e: MessageEvent<Wire>) => {
    const m = e.data;
    if (m.t === 'hello') {
      if (!m.reply) ch.postMessage({ t: 'hello', reply: true } satisfies Wire);
      connected = true;
    } else if (m.t === 'bye') connected = false;
    else inbox.push(m);
  };
  ch.postMessage({ t: 'hello', reply: false } satisfies Wire);
  return {
    get connected() {
      return connected;
    },
    send: (m) => ch.postMessage(m),
    receive: () => inbox.take(),
    close() {
      ch.postMessage({ t: 'bye' } satisfies Wire);
      ch.close();
      connected = false;
    },
  };
}
