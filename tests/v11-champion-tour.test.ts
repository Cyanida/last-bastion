import { describe, expect, it } from 'vitest';
import { showTourNow, tourBubble, tourNext } from '../src/logic/tour';
import { CHAMPION_BUILD_TEXT, CHAMPION_TABS, CHAMPION_TOUR } from '../src/config/glossary';
import { WORLD } from '../src/config/world';

const sentences = (t: string) => t.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length;

describe('champion screen: tabs and the first-visit tour (#240)', () => {
  it('has three tabs, Loadout first', () => {
    expect(CHAMPION_TABS.map((t) => t.id)).toEqual(['loadout', 'build', 'talents']);
    expect(CHAMPION_TABS.map((t) => t.label)).toEqual(['Loadout', 'Build', 'Talents']);
  });

  it('the tour is 4-5 steps of one sentence: slots, inventory, the legendary rule, Build, PLAY', () => {
    expect(CHAMPION_TOUR.map((s) => s.id)).toEqual(['slots', 'inventory', 'legendary', 'build', 'play']);
    for (const s of CHAMPION_TOUR) {
      expect(sentences(s.text), s.id).toBe(1);
      expect(s.at, s.id).toMatch(/^\.cs-/);
    }
    const legendary = CHAMPION_TOUR.find((s) => s.id === 'legendary')!.text;
    expect(legendary).toContain(`${WORLD.loadout.legendarySlots} slots`); // the rule's number comes from config
    expect(sentences(CHAMPION_BUILD_TEXT)).toBe(1);
    expect(CHAMPION_BUILD_TEXT).toMatch(/champion levels/);
  });

  it('opens by itself only while nothing is stored under its key', () => {
    expect(showTourNow(null)).toBe(true);
    expect(showTourNow('1')).toBe(false);
  });

  it('steps through to the last step, then ends', () => {
    const seen = [0];
    for (let i = tourNext(0, 5); i !== null; i = tourNext(i, 5)) seen.push(i);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(tourNext(4, 5)).toBeNull();
    expect(tourNext(0, 1)).toBeNull();
  });

  it('puts a step\'s bubble under its part, else over it, else beside it, and always inside the view', () => {
    const view = { w: 1280, h: 720 }, b = { w: 360, h: 120 };
    // a row of slots in the upper half: under it, centred on it
    expect(tourBubble({ left: 200, top: 300, width: 300, height: 70 }, b, view)).toEqual({ left: 170, top: 380 });
    // PLAY at the bottom: over it
    expect(tourBubble({ left: 400, top: 600, width: 480, height: 60 }, b, view)).toEqual({ left: 460, top: 470 });
    // the inventory, a tall column on the right: left of it, at its middle
    expect(tourBubble({ left: 650, top: 100, width: 600, height: 540 }, b, view)).toEqual({ left: 280, top: 310 });
    // a tall column on the left: right of it
    expect(tourBubble({ left: 20, top: 100, width: 600, height: 540 }, b, view).left).toBe(630);
    // a part that fills the view: on its middle
    expect(tourBubble({ left: 0, top: 0, width: 1280, height: 720 }, b, view)).toEqual({ left: 460, top: 300 });
    // near the left edge: kept on screen
    expect(tourBubble({ left: 0, top: 10, width: 40, height: 40 }, b, view).left).toBe(6);
    const phone = tourBubble({ left: 700, top: 300, width: 140, height: 50 }, { w: 340, h: 110 }, { w: 844, h: 390 });
    expect(phone.left + 340).toBeLessThanOrEqual(844 - 6);
    expect(phone.top).toBe(180);
  });
});
