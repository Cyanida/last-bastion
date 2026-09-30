import { describe, expect, it } from 'vitest';
import { CARD_IDS, CARDS, TUTORIAL, TUTORIAL_CARDS, cardInfo, iconCard, type TutorialCard } from '../src/config/cards';
import { inTutorial, statusSeen, tutorialCard, type TutorialView } from '../src/logic/cards';
import { defaultSave, migrate } from '../src/logic/save';

const view = (more: Partial<TutorialView> = {}): TutorialView => ({ realm: 'marches', level: 1, tick: 0, held: 0, setLevel: 0, utility: false, levelUp: false, status: false, ...more });
const ALL = Object.keys(TUTORIAL_CARDS) as TutorialCard[];

describe('v0.10 the Marches tutorial on flash cards (#60)', () => {
  it('only the Marches levels 1 and 2 teach', () => {
    expect(inTutorial({ realm: 'marches', level: 1 })).toBe(true);
    expect(inTutorial({ realm: 'marches', level: TUTORIAL.levels })).toBe(true);
    expect(inTutorial({ realm: 'marches', level: 3 })).toBe(false);
    expect(inTutorial({ realm: 'ironHold', level: 1 })).toBe(false);
    expect(inTutorial({})).toBe(false); // a full run
    expect(tutorialCard(view({ realm: undefined, level: undefined, held: 3, tick: 9999, utility: true, setLevel: 2, status: true }), [])).toBeNull();
    expect(tutorialCard(view({ level: 3 }), [])).toBeNull();
  });

  it('moving first, then relics once one is held, then the ability a few seconds in', () => {
    expect(tutorialCard(view(), [])).toBe('move');
    expect(tutorialCard(view({ held: 1, tick: TUTORIAL.relicsAfter - 1 }), ['move'])).toBeNull(); // not on top of the move card
    expect(tutorialCard(view({ held: 1, tick: TUTORIAL.relicsAfter }), ['move'])).toBe('relics');
    expect(tutorialCard(view({ tick: TUTORIAL.relicsAfter }), ['move'])).toBeNull(); // no relic held: nothing to explain yet
    expect(tutorialCard(view({ held: 1, tick: TUTORIAL.abilityAfter }), ['move', 'relics'])).toBe('ability');
  });

  it('each basic shows the moment it first comes up', () => {
    const seen = ['move', 'relics', 'ability'];
    expect(tutorialCard(view({ tick: 600 }), seen)).toBeNull();
    expect(tutorialCard(view({ tick: 600, utility: true }), seen)).toBe('utility');
    expect(tutorialCard(view({ tick: 600, setLevel: 2 }), seen)).toBe('sets');
    expect(tutorialCard(view({ tick: 600, status: true }), seen)).toBe('status');
    expect(tutorialCard(view({ level: 2, tick: 30, status: true }), seen)).toBe('status'); // level 2's Flame brings Burning
  });

  it('with a choice screen due only the level-up card shows, before its screen', () => {
    expect(tutorialCard(view(), [], true)).toBeNull(); // the opening pick opens first; moving waits for play
    expect(tutorialCard(view({ levelUp: true }), [], true)).toBeNull(); // #238: no level-up screen in a level: the XP card waits for play like the rest
    expect(tutorialCard(view({ levelUp: true }), ['move', 'relics', 'ability'])).toBe('levelUp');
    expect(tutorialCard(view({ levelUp: true }), ['move', 'relics', 'ability', 'levelUp'])).toBeNull();
  });

  it('seen once, never again', () => {
    const all = view({ held: 2, tick: 9999, utility: true, setLevel: 2, status: true, levelUp: true });
    expect(tutorialCard(all, ALL)).toBeNull();
    expect(tutorialCard(all, ALL, true)).toBeNull();
    const shown: string[] = [];
    for (let id = tutorialCard(all, shown); id; id = tutorialCard(all, shown)) shown.push(id);
    expect(shown.sort()).toEqual([...ALL].sort());
  });

  it('a status counts on the champion, or on a foe met, alive and visible', () => {
    const foe = (more = {}) => ({ x: 100, y: 0, dead: false, hidden: false, statuses: {}, ...more });
    expect(statusSeen([foe()], 0, 0, {})).toBe(false);
    expect(statusSeen([foe({ statuses: { immune: { stun: 1 } } })], 0, 0, {})).toBe(false); // only an immunity left
    expect(statusSeen([foe({ statuses: { burn: { stacks: 1, time: 2, power: 3 } } })], 0, 0, {})).toBe(true);
    expect(statusSeen([foe({ x: CARDS.meetRadius + 1, statuses: { burn: { stacks: 1, time: 2, power: 3 } } })], 0, 0, {})).toBe(false);
    expect(statusSeen([foe({ dead: true, statuses: { burn: { stacks: 1, time: 2, power: 3 } } })], 0, 0, {})).toBe(false);
    expect(statusSeen([], 0, 0, { poison: { stacks: 1, time: 2, power: 3 } })).toBe(true);
  });

  it('the cards are flash cards: short, with an icon, kept by the save', () => {
    for (const id of ALL) {
      expect(CARD_IDS).toContain(id);
      expect(iconCard(id)?.icon.length, id).toBeGreaterThan(0);
      expect(cardInfo(id).boss).toBe(false);
      expect(cardInfo(id).text.split(' ').length, `${id}: keep it short`).toBeLessThanOrEqual(14);
    }
    expect(migrate({ ...defaultSave(), cards: ['move', 'status', 'wolf', 'nonsense'] }).cards.sort()).toEqual(['move', 'status', 'wolf']);
  });
});
