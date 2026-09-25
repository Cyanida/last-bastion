import { NET, type NetConditions } from '../config/net';
import type { Rng } from '../core/types';
import type { Command } from '../sim/commands';
import type { Snapshot } from '../sim/snapshot';

/**
 * v0.8 (#31, ARCHITECTURE.md): how copies of the game talk. The same commands step() takes go one way, snapshots of the Game
 * the other. A Transport is unreliable like the real thing will be: messages are late, jittered, reordered or lost (config/net.ts),
 * except choice commands, which are sent again until every other window has acknowledged them.
 * A room holds up to NET.maxPlayers windows. The first one hosts it and is player 0; it hands each window that joins the lowest free
 * player id. Two loopbacks: in memory (tests) and a BroadcastChannel (windows on one machine, ?net=<room>).
 */

export type NetMessage = { t: 'command'; cmd: Command } | { t: 'snapshot'; tick: number; snap: Snapshot };

export interface Transport {
  /** At least one other window is in the room, and this one hasn't closed. */
  readonly connected: boolean;
  /** This window's player id: 0 for the host. Null while joining, or when the room was full. */
  readonly player: number | null;
  /** How many other windows are in the room. */
  readonly peers: number;
  send(m: NetMessage): void;
  /** Every message that has arrived by now, in arrival order, each once. Also resends what is unacknowledged: call it every frame. */
  receive(): NetMessage[];
  close(): void;
}

/** Between windows. hello, here and bye skip the simulated network; msg and ack go through it. seq 0 is a message not resent. */
type Wire =
  | { t: 'hello'; from: string }
  | { t: 'here'; from: string; to: string; player: number | null; assign?: number | null }
  | { t: 'bye'; from: string }
  | { t: 'msg'; from: string; seq: number; m: NetMessage }
  | { t: 'ack'; from: string; to: string; seq: number };
type Delayed = Extract<Wire, { t: 'msg' | 'ack' }>;

/** What a room is carried over: a BroadcastChannel, or memoryRoom() in tests. Never hands a window its own posts. */
export type Channel = { post(w: Wire): void; listen(fn: (w: Wire) => void): void; close(): void };

/** The receiving end of the simulated network: each message is dropped, or held for its latency and jitter. */
class Inbox {
  private q: { at: number; w: Delayed }[] = [];
  constructor(
    private net: NetConditions,
    private rng: Rng,
    private clock: () => number,
  ) {}
  push(w: Delayed): void {
    if (this.rng() < this.net.loss) return;
    const delay = Math.max(0, this.net.latencyMs + this.net.jitterMs * (2 * this.rng() - 1));
    this.q.push({ at: this.clock() + delay, w });
  }
  take(): Delayed[] {
    const now = this.clock();
    const due = this.q.filter((e) => e.at <= now).sort((a, b) => a.at - b.at);
    if (due.length) this.q = this.q.filter((e) => e.at > now);
    return due.map((e) => e.w);
  }
}

const reliable = (m: NetMessage): boolean => m.t === 'command' && m.cmd.kind === 'choice';

export function roomTransport(ch: Channel, rng: Rng, net: NetConditions, clock: () => number): Transport {
  const me = Math.random().toString(36).slice(2, 10);
  const joinedAt = clock();
  const inbox = new Inbox(net, rng, clock);
  const peers = new Map<string, number | null>(); // other window -> its player id, null while it joins
  const seen = new Map<string, Set<number>>(); // the reliable seqs taken from each window. ponytail: kept for the whole session
  const unacked = new Map<number, { w: Wire; left: Set<string>; at: number }>();
  let player: number | null = null;
  let joining = true;
  let seq = 0;
  let open = true;

  const free = (): number | null => {
    const taken = new Set([player, ...peers.values()]);
    for (let i = 0; i < net.maxPlayers; i++) if (!taken.has(i)) return i;
    return null;
  };
  const welcome = (to: string) => {
    const assign = free();
    peers.set(to, assign);
    ch.post({ t: 'here', from: me, to, player, assign });
  };
  /**
   * No host has answered in joinMs: host the room, unless a host is known or an earlier-sorting window is also still joining
   * (that one hosts and welcomes this one). ponytail: a host that leaves hands nothing over; a window joining later hosts again.
   */
  const settle = () => {
    if (!joining || clock() - joinedAt < net.joinMs) return;
    for (const [id, p] of peers) if (p === 0 || (p === null && id < me)) return;
    player = 0;
    joining = false;
    for (const [id, p] of peers) if (p === null) welcome(id);
  };
  const forget = (id: string) => {
    peers.delete(id);
    for (const [s, u] of unacked) if (u.left.delete(id) && !u.left.size) unacked.delete(s);
  };

  ch.listen((w) => {
    if (!open || w.from === me || ('to' in w && w.to !== me)) return;
    if (w.t === 'hello') {
      settle();
      if (player === 0) welcome(w.from);
      else {
        peers.set(w.from, null);
        ch.post({ t: 'here', from: me, to: w.from, player });
      }
    } else if (w.t === 'here') {
      peers.set(w.from, w.player);
      if (w.assign !== undefined && joining) {
        player = w.assign;
        joining = false;
      }
    } else if (w.t === 'bye') forget(w.from);
    else inbox.push(w);
  });
  ch.post({ t: 'hello', from: me });
  settle();

  return {
    get connected() {
      return open && peers.size > 0;
    },
    get player() {
      settle();
      return player;
    },
    get peers() {
      return peers.size;
    },
    send(m) {
      if (!open) return;
      const w: Wire = { t: 'msg', from: me, seq: reliable(m) ? ++seq : 0, m };
      ch.post(w);
      if (w.seq && peers.size) unacked.set(w.seq, { w, left: new Set(peers.keys()), at: clock() });
    },
    receive() {
      if (!open) return [];
      settle();
      const now = clock();
      for (const u of unacked.values())
        if (now - u.at >= net.resendMs) {
          ch.post(u.w);
          u.at = now;
        }
      const out: NetMessage[] = [];
      for (const w of inbox.take()) {
        if (w.t === 'ack') {
          const u = unacked.get(w.seq);
          if (u?.left.delete(w.from) && !u.left.size) unacked.delete(w.seq);
          continue;
        }
        if (w.seq) {
          ch.post({ t: 'ack', from: me, to: w.from, seq: w.seq }); // every copy: the last ack may have been lost
          const got = seen.get(w.from) ?? seen.set(w.from, new Set()).get(w.from)!;
          if (got.has(w.seq)) continue;
          got.add(w.seq);
        }
        out.push(w.m);
      }
      return out;
    },
    close() {
      if (!open) return;
      ch.post({ t: 'bye', from: me });
      ch.close();
      open = false;
      peers.clear();
      unacked.clear();
    },
  };
}

/** An in-memory room: each call is one window's channel. Posts are structured-cloned like BroadcastChannel does, and delivered at once. */
export function memoryRoom(): () => Channel {
  const ends = new Set<(w: Wire) => void>();
  return () => {
    let mine: ((w: Wire) => void) | null = null;
    return {
      post: (w) => [...ends].forEach((fn) => fn !== mine && fn(structuredClone(w))),
      listen: (fn) => void ends.add((mine = fn)),
      close: () => void (mine && ends.delete(mine)),
    };
  };
}

/** Windows in one memory room; the first hosts at once (joinMs 0), so with a fixed clock they all have their player ids. */
export function loopbackRoom(n: number, rng: Rng, net: NetConditions = NET, clock: () => number = () => performance.now()): Transport[] {
  const room = memoryRoom();
  return Array.from({ length: n }, () => roomTransport(room(), rng, { ...net, joinMs: 0 }, clock));
}

/** Two connected ends in memory: player 0 and player 1. */
export function loopbackPair(rng: Rng, net: NetConditions = NET, clock: () => number = () => performance.now()): [Transport, Transport] {
  const [a, b] = loopbackRoom(2, rng, net, clock);
  return [a, b];
}

/** One window's end of a room on a BroadcastChannel. */
export function broadcastTransport(room: string, rng: Rng = Math.random, net: NetConditions = NET, clock: () => number = () => performance.now()): Transport {
  const bc = new BroadcastChannel(`${NET.channel}:${room}`);
  return roomTransport(
    {
      post: (w) => bc.postMessage(w),
      listen: (fn) => (bc.onmessage = (e: MessageEvent<Wire>) => fn(e.data)),
      close: () => bc.close(),
    },
    rng,
    net,
    clock,
  );
}
