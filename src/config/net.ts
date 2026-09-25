/** v0.8 (#31): the loopback transport's simulated network, so co-op can be tried on one machine as if it were online. */
export const NET = {
  latencyMs: 60, // one-way delay of every message
  jitterMs: 20, // plus or minus up to this much, per message (so messages can arrive out of order)
  loss: 0.02, // chance a message never arrives
  joinMs: 300, // a window that hears no host this long after joining hosts the room itself (player 0)
  resendMs: 200, // a choice command not yet acknowledged by every peer is sent again this often (over one round trip)
  maxPlayers: 4, // windows past this many join the room without a player
  channel: 'last-bastion-net', // BroadcastChannel name prefix; the room name follows it
};

export type NetConditions = Pick<typeof NET, 'latencyMs' | 'jitterMs' | 'loss' | 'joinMs' | 'resendMs' | 'maxPlayers'>;
