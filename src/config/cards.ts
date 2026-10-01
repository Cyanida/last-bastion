import { ENEMIES, type EnemyId } from './enemies';

/**
 * v0.8 (#124): flash cards. The first time a player meets an enemy, a boss or a mechanic, a short card says what it does and how to
 * answer it; once seen it never shows again (save.cards) and stays in the Glossary. Text is one or two short sentences on purpose:
 * the playtest complaint was too much to read.
 */
export const CARDS = {
  checkEvery: 15, // ticks between looks at the field (a quarter second)
  meetRadius: 520, // how close a foe must be to count as met (about the screen's half width)
  spotDim: 0.65, // #133: how dark the arena goes around the foe while its card is open
  spotRadius: 70, // #133: the lit circle round the foe, in world pixels (plus its own size)
};

export type MechanicCard = 'elite' | 'telegraph';
export type TutorialCard = 'move' | 'relics' | 'ability' | 'levelUp' | 'utility' | 'sets' | 'status';
export type CardId = EnemyId | MechanicCard | TutorialCard;

export const MECHANIC_CARDS: Record<MechanicCard, { name: string; text: string; icon: string }> = {
  elite: { name: 'Elite', icon: '★', text: 'Orange outline: tougher, with extra powers. Worth more gold.' },
  telegraph: { name: 'Marked attack', icon: '⚠', text: 'A glow shows where it lands. Step out late for a perfect dodge.' },
};

/**
 * v0.10 (#60, docs/road-to-the-crown.md item 10): the tutorial is the Marches' levels 1 and 2, taught on the same flash cards. Each basic
 * shows the moment it first comes up there (logic/cards tutorialCard): moving once the opening pick is taken, relics once one is held, the
 * ability a few seconds in, champion XP once some is collected (#238), the utility when it unlocks (champion level 2), a set bonus when one lights, a status when one is
 * seen. Seen once, never again (save.cards), like every card; other realms and full runs never show them.
 */
export const TUTORIAL = {
  realm: 'marches' as const,
  levels: 2, // levels 1..this are the tutorial
  relicsAfter: 120, // ticks into the level before the relics card (two seconds: after the move card, not on top of it)
  abilityAfter: 480, // ticks into the level before the ability card (eight seconds: the first foes are close by then)
};

export const TUTORIAL_CARDS: Record<TutorialCard, { name: string; text: string; icon: string }> = {
  move: { name: 'Move and fight', icon: '🏃', text: 'Move with WASD, the arrows or your left thumb. Attacks are automatic.' },
  relics: { name: 'Relics', icon: '💎', text: 'Lasting powers, each of a family. Two of one family give a set bonus.' },
  ability: { name: 'Signature ability', icon: '✨', text: 'Space, right mouse or your right thumb casts it. Then it recharges.' },
  levelUp: { name: 'Champion XP', icon: '⬆', text: 'Foes give XP. Clear the level to bank it: your champion levels up after.' }, // #238: no level-up inside a level
  utility: { name: 'Utility ability', icon: '💨', text: 'A second ability: E, Shift or the small button. It has its own timer.' },
  sets: { name: 'Set bonus', icon: '🔗', text: 'Two relics of one family light its set bonus. Four and six add more.' },
  status: { name: 'Status effects', icon: '🔥', text: 'Burning hurts over time, Chilled slows. The Glossary lists every status.' },
};

export const ENEMY_CARDS: Record<EnemyId, string> = {
  peasant: 'Weak alone, deadly in a crowd. Keep moving.',
  torchbearer: 'Each blow adds a burn stack. Step back, or your utility puts it out.',
  wolf: 'Fast. Crouches, then leaps: step aside.',
  cinderHound: 'Leaps like a wolf, and bursts into fire where it dies. Step away.',
  crossbow: 'Shoots from range. Close in or dodge the bolts.',
  knight: 'Slow and tough. Barely flinches.',
  ironKnight: 'Iron plates shrug off blows. Each hit breaks one: keep swinging.',
  cultist: 'Runs at you and explodes. Kill it before it arrives.',
  shieldBearer: 'Blocks arrows from the front. Hit it from the side.',
  thornBearer: 'Spiked shield: blows struck up close bite back. Strike from range.',
  priest: 'Heals the horde. Hunt him down first.',
  cavalry: 'Winds up, then charges in a line. Step out of it.',
  bannerman: 'Commander: foes near him hit harder. Kill him first.',
  drummer: 'Commander: foes near him move faster. Kill him first.',
  chaplain: 'Commander: heals foes near him. Kill him first.',
  engineer: 'Builds ballistae. Stop him early.',
  ballista: 'A long-range bolt thrower. Break it or leave its line.',
  plagueDoctor: 'Poison clouds, and he raises the fallen.',
  houndmaster: 'His wolves turn fierce. Without him they scatter.',
  mirrorKnight: 'Throws arrows back, except just after he swings.',
  siegeTower: 'Unloads troops until it is destroyed.',
  assassin: 'Vanishes and stabs from behind. Keep moving.',
  shieldwall: 'Near untouchable from the front in a line. Flank it.',
  ironShieldwall: 'His iron shield turns blows from the front. He turns slowly: step round him.',
  boneCollector: 'Eats corpses and grows. Kill him early.',
  siegeCamp: 'Musters troops until you tear it down.',
  plagueCart: 'Rolls across the field leaking poison.',
  blackKnight: 'Boss. Charges down marked lines: sidestep.',
  warlord: 'Boss. Slams the ground and calls wolves.',
  lich: 'Boss. Bolts and cursed ground: keep off the marks.',
  inquisitor: 'Boss. Lines of fire, and cultists.',
  abbot: 'Boss. Poison flasks, and priests to heal him.',
  dragon: 'Act boss. Fire across the field: watch the ground.',
  warden: 'Act boss. Calls knights and reshapes the arena.',
  forgemaster: 'Boss. Break his plate, then dodge the hammer and the presses.',
  ironKing: 'Crown boss. Break his plate, step round his shield, beware his thorns.',
  emberQueen: 'Boss. Her blows stack a burn; her marked ground keeps burning: step out.',
  cinderColossus: 'Crown boss. His hits burn, his fire spreads, and foes burst near him.',
  usurper: 'The last foe. Put out the Royal Flames to hurt him.',
  royalFlame: 'While one burns, the Usurper cannot be hurt.',
  gravedigger: 'Boss. Trample his open graves before the dead climb out; his rot lasts.',
};

export const CARD_IDS = [...(Object.keys(ENEMY_CARDS) as EnemyId[]), ...(Object.keys(MECHANIC_CARDS) as MechanicCard[]), ...(Object.keys(TUTORIAL_CARDS) as TutorialCard[])] as CardId[];

/** A card drawn as an icon (a mechanic or a tutorial basic), or undefined for a foe's card (drawn as its sprite). */
export const iconCard = (id: CardId): { name: string; text: string; icon: string } | undefined =>
  id in MECHANIC_CARDS ? MECHANIC_CARDS[id as MechanicCard] : id in TUTORIAL_CARDS ? TUTORIAL_CARDS[id as TutorialCard] : undefined;

export const cardInfo = (id: CardId): { name: string; text: string; boss: boolean } => {
  const c = iconCard(id);
  return c ? { name: c.name, text: c.text, boss: false } : { name: ENEMIES[id as EnemyId].name, text: ENEMY_CARDS[id as EnemyId], boss: ENEMIES[id as EnemyId].boss };
};
