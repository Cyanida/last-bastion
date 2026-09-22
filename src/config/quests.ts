/**
 * Side quests (v0.5). At the start of every Act a board offers `QUEST_BOARD.offered` of them, rolled from the seed; the player
 * takes up to `QUEST_BOARD.take`. They are optional: a failed quest costs nothing, and whatever is still open when the Act ends
 * simply fails. A finished quest pays its reward and opens the next wing (config/regions.ts). State machines: systems/quests.ts.
 * HP numbers are scaled like enemy damage (so a unit survives about as many hits on wave 25 as on wave 2).
 */
export const QUESTS = {
  caravan: { name: 'Protect the caravan', short: 'Caravan', icon: '🐂', desc: 'A supply wagon crosses the field while the waves come. Keep it alive through two cleared waves.', hp: 700, speed: 34, waves: 2 },
  camps: { name: 'Destroy the siege camps', short: 'Camps', icon: '⛺', desc: 'Three siege camps muster the levy against you. Burn them all.', count: 3 },
  monk: { name: 'Escort the monk', short: 'Monk', icon: '🙏', desc: 'A monk must reach the chapel on the far side. He waits while enemies are near him, and he is frail.', hp: 170, speed: 52, wait: 150, chapelDist: 700 },
  elite: {
    name: 'Hunt the named elite', short: 'Hunt', icon: '☠️', desc: 'A champion of the horde arrives with the next wave, far from you. Bring back its head.', hpMult: 5, dist: 700,
    names: ['Grimwald the Flayer', 'Osric Bonebreaker', 'Maud of the Red Hand', 'Aldous the Hollow', 'Berengar Oathless', 'Ysolde the Gaunt'],
  },
  shrine: { name: 'Hold the shrine', short: 'Shrine', icon: '🕯️', desc: 'Stand in the old circle for 60 seconds in total while a wave is on.', radius: 110, seconds: 60 },
  chest: { name: 'Find the hidden chest', short: 'Hidden chest', icon: '🗝️', desc: 'A chest lies hidden on the open map, marked nowhere. It glints when you come close.', glint: 320, reach: 36 },
};
export type QuestKind = keyof typeof QUESTS;
export const QUEST_KINDS = Object.keys(QUESTS) as QuestKind[];

export const QUEST_BOARD = { offered: 3, take: 2, linger: 3 }; // linger: seconds a finished quest stays on the tracker

/** What a quest pays, rolled with it. 'fragment' is the sacred treasures' hook (v0.5 treasures): defined, never rolled yet. */
export const REWARDS = {
  relic: { name: 'A relic', icon: '🏺', desc: 'Choose one of three relics.' },
  gold: { name: 'Gold', icon: '🪙', desc: 'Gold to spend this run; more in every later Act.', amount: 90 }, // times the Act
  rune: { name: 'A Rune', icon: '◆', desc: 'A Rune for the Keep, banked when the run ends, on top of what the bosses pay.' }, // RUNES.quest
  talent: { name: 'A talent point', icon: '✦', desc: 'One more talent point, to spend from the pause menu.' },
  fragment: { name: 'A treasure fragment', icon: '🧩', desc: 'A piece of a sacred treasure.' },
};
export type RewardKind = keyof typeof REWARDS;
export const REWARD_ROLL: RewardKind[] = ['relic', 'gold', 'rune', 'talent'];
