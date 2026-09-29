/**
 * #189: a walk through every menu and choice screen, played through their real buttons: test mode and a test run (the quest board,
 * a level-up, a relic moment, both upgrades, the peddler, the Merchant, the road fork, the shrine, the pause menu and its talents, the
 * crash report), then the title's What's new and Daily Trial, the Keep's run history, treasures, Chronicle and mastery, and Settings'
 * save data. `at(name)` runs with each screen up. The review screenshots (ui-previews.mjs) and the play check (play-test.mjs) share it.
 * An older build (the "before" pictures) may lack a way in: that screen is skipped and named in the returned list.
 * The page must be on the title of a `?debug&dev=1` build (test mode needs dev).
 */
export async function tour(page, at, { touch = false } = {}) {
  const skipped = [];
  const press = (sel) => (touch ? page.locator(sel).first().tap() : page.locator(sel).first().click());
  const has = async (sel) => (await page.locator(sel).count()) > 0;
  const shot = async (name) => {
    await page.waitForTimeout(150);
    await at(name);
  };
  const screen = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      skipped.push(`${name} (${String(e.message ?? e).split('\n')[0].slice(0, 80)})`);
    }
  };
  /** Sets a screen up in the run and steps the game until `sel` is on screen, answering whatever comes first (a flash card, another choice). */
  const bring = (setup, sel) =>
    page.evaluate(async ({ setup, sel }) => {
      const lb = window.__lb;
      new Function('g', 'lb', setup)(lb.game, lb);
      for (let i = 0; i < 400; i++) {
        if (document.querySelector(sel)) return true;
        if (lb.state === 'choice' || document.querySelector('[data-card]')) {
          (document.querySelector('[data-card] [data-leave]') ?? document.querySelector('#overlay [data-pick]') ?? document.querySelector('#overlay [data-leave]'))?.click();
          await new Promise((r) => setTimeout(r, 30));
        } else lb.run(1, false, true);
      }
      throw new Error(`${sel} never came up (state ${lb.state})`);
    }, { setup, sel });

  // ---- test mode, and a test run on a fixed seed (test mode seeds from the clock)
  await screen('testmode', async () => {
    await press('[data-go="settings"]');
    await press('[data-act="test"]');
    await page.evaluate(() => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('tm-class', 'viking');
      set('tm-level', '12');
      for (const [id, v] of [['brimstoneOil', '2'], ['frostBrand', '1'], ['serratedEdge', '1']]) {
        const s = document.querySelector(`select[data-relic="${id}"]`);
        if (s) s.value = v;
      }
    });
    await shot('testmode');
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => 2654435761;
      try {
        [...document.querySelectorAll('button')].find((b) => /start test run/i.test(b.textContent)).click();
      } finally {
        Date.now = now;
      }
      window.__lb.game.player.invulnerable = true;
    });
  });
  if (!(await page.evaluate(() => !!window.__lb.game))) return { skipped: [...skipped, 'the whole run'] };

  const run = [
    ['board', '', '[data-quest]', '[data-leave]'],
    ['levelup', 'g.pendingLevelUps++', '.levelup [data-reroll]', '[data-pick="0"]'],
    ['relics', "g.player.relics.offers.push({ from: 'boss', options: ['butchersHook', 'guardiansAegis', 'stormPennant'], rerolls: 1, duo: null })", '[data-skip]', '[data-skip]'],
    ['ability', 'g.pendingAbilityTiers.push(0)', '.or', '[data-pick]'],
    ['utility', 'g.pendingUtilityTiers.push(0)', '.or', '[data-pick]'],
    ['peddler', "g.gold = 300; g.player.hp = Math.round(g.player.stats.hp / 2); g.event = { kind: 'peddler', x: g.player.x, y: g.player.y, unit: null, foe: null, used: false, t: 0, stock: 1 }", '[data-buy="1"]', '[data-leave]'],
    ['merchant', 'g.gold = 600; g.player.hp = Math.round(g.player.stats.hp / 2); g.pendingMerchant = true', '[data-heal]', '[data-leave]'],
    ['routes', '', '.route[data-pick]', '[data-pick="0"]'],
    ['shrine', "g.pendingShrine = ['valor', 'mending', 'swiftness']", '[data-pick="valor"]', '[data-pick="valor"]'],
  ];
  for (const [name, setup, sel, answer] of run) {
    await screen(name, async () => {
      await bring(setup, sel);
      await shot(name);
      await press(answer);
    });
  }
  await screen('pause', async () => {
    await bring('g.talentPoints = 1', '#overlay.hidden');
    await (touch && (await has('#btn-pause')) ? press('#btn-pause') : page.keyboard.press('Escape'));
    await page.locator('[data-resume]').waitFor({ timeout: 2000 });
    await shot('pause');
  });
  await screen('talents', async () => {
    await press('[data-talents]');
    await shot('talents');
    await press('[data-back]');
    await press('[data-resume]');
  });
  await screen('crash', async () => {
    await page.evaluate(() => {
      const g = window.__lb.game;
      let texts = g.texts, thrown = false;
      Object.defineProperty(g, 'texts', {
        configurable: true,
        get() {
          if (thrown) return texts;
          thrown = true;
          throw new Error('screen tour: a crash report to look at'); // once, in a real frame
        },
        set(v) {
          texts = v;
        },
      });
    });
    await page.locator('#crash [data-continue]').waitFor({ timeout: 3000 });
    await shot('crash');
    await press('#crash [data-continue]');
  });
  // ---- back to the title (a test run leaves no trace, and its results are #186's)
  await page.reload();
  await page.getByText('Take up arms').first().waitFor();

  // ---- the menus
  const menu = async (name, way, back) => {
    await screen(name, async () => {
      for (const sel of way) await press(sel);
      await shot(name);
      for (const sel of back) await press(sel);
    });
  };
  if (await has('[data-go="whatsNew"]')) await menu('whatsnew', ['[data-go="whatsNew"]'], ['[data-back]']);
  else skipped.push('whatsnew (no What’s new on this build)');
  await menu('daily', ['[data-go="daily"]'], ['[data-back]']);
  await menu('history', ['[data-go="keep"]', '[data-history]'], ['[data-back]']);
  await menu('treasures', ['[data-treasures]'], ['[data-back]']);
  await menu('chronicle', ['[data-chronicle]'], ['[data-back]']);
  await menu('mastery', ['[data-mastery]'], ['[data-back]', '[data-back]']);
  await menu('save', ['[data-go="settings"]', '[data-act="save"]'], ['[data-act="back"]', '[data-act="back"]']);
  return { skipped };
}
