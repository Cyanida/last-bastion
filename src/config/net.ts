/** v0.8 (#31): the loopback transport's simulated network, so co-op can be tried on one machine as if it were online. */
export const NET = {
  latencyMs: 60, // one-way delay of every message
  jitterMs: 20, // plus or minus up to this much, per message (so messages can arrive out of order)
  loss: 0.02, // chance a message never arrives
  channel: 'last-bastion-net', // BroadcastChannel name prefix; the room name follows it
};

export type NetConditions = Pick<typeof NET, 'latencyMs' | 'jitterMs' | 'loss'>;
