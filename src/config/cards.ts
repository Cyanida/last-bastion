import { ENEMIES, type EnemyId } from './enemies';

/**
 * v0.8 (#124): flash cards. The first time a player meets an enemy, a boss or a mechanic, a short card says what it does and how to
 * answer it; once seen it never shows again (save.cards) and stays in the Glossary. Text is one or two short sentences on purpose:
 * the playtest complaint was too much to read.
 */
export const CARDS = {
  checkEvery: 15, // ticks between looks at the field (a quarter second)
  meetRadius: 520, // how close a foe must be to count as met (about the screen's half width)
};

export type MechanicCard = 'elite' | 'telegraph';
export type CardId = EnemyId | MechanicCard;

export const MECHANIC_CARDS: Record<MechanicCard, { name: string; text: string }> = {
  elite: { name: 'Elite', text: 'Orange outline: tougher, with extra powers. Worth more gold.' },
  telegraph: { name: 'Marked attack', text: 'A glow shows where it lands. Step out late for a perfect dodge.' },
};

export const ENEMY_CARDS: Record<EnemyId, string> = {
  peasant: 'Weak alone, deadly in a crowd. Keep moving.',
  wolf: 'Fast. Crouches, then leaps: step aside.',
  crossbow: 'Shoots from range. Close in or dodge the bolts.',
  knight: 'Slow and tough. Barely flinches.',
  cultist: 'Runs at you and explodes. Kill it before it arrives.',
  shieldBearer: 'Blocks arrows from the front. Hit it from the side.',
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
  usurper: 'The last foe. Put out the Royal Flames to hurt him.',
  royalFlame: 'While one burns, the Usurper cannot be hurt.',
};

export const CARD_IDS = [...(Object.keys(ENEMY_CARDS) as EnemyId[]), ...(Object.keys(MECHANIC_CARDS) as MechanicCard[])] as CardId[];

export const cardInfo = (id: CardId): { name: string; text: string; boss: boolean } =>
  id in MECHANIC_CARDS ? { ...MECHANIC_CARDS[id as MechanicCard], boss: false } : { name: ENEMIES[id as EnemyId].name, text: ENEMY_CARDS[id as EnemyId], boss: ENEMIES[id as EnemyId].boss };
