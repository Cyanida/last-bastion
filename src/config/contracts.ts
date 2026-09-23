/**
 * v0.6 weekly contracts: three seeded objectives a week (Monday to Sunday, UTC), shown on the title screen, paying Runes when banked.
 * `sum`: the count adds up over the week's runs; otherwise the best single run counts. `{n}` and `{class}` are filled in.
 */
export type ContractKind = 'kills' | 'elites' | 'bosses' | 'quests' | 'commanders' | 'waveWith' | 'acts' | 'evolve' | 'relics';

export const CONTRACTS: Record<ContractKind, { text: string; targets: [number, number, number]; runes: number; sum: boolean }> = {
  kills: { text: 'Slay {n} enemies', targets: [1500, 2500, 4000], runes: 2, sum: true },
  elites: { text: 'Slay {n} elites', targets: [30, 60, 100], runes: 2, sum: true },
  bosses: { text: 'Defeat {n} bosses', targets: [4, 8, 12], runes: 2, sum: true },
  quests: { text: 'Complete {n} quests', targets: [3, 6, 9], runes: 2, sum: true },
  commanders: { text: 'Slay {n} squad commanders', targets: [8, 16, 25], runes: 2, sum: true },
  waveWith: { text: 'Reach wave {n} with the {class}', targets: [10, 15, 20], runes: 3, sum: false },
  acts: { text: 'Clear {n} Acts in one run', targets: [1, 2, 3], runes: 3, sum: false },
  evolve: { text: 'Evolve an ability {n} times', targets: [1, 2, 3], runes: 3, sum: true },
  relics: { text: 'Carry {n} relics at once', targets: [5, 7, 9], runes: 2, sum: false },
};
export const CONTRACT_KINDS = Object.keys(CONTRACTS) as ContractKind[];
export const CONTRACTS_PER_WEEK = 3;
