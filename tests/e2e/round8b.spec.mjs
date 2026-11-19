import { test, expect } from '@playwright/test';
import { press, saved, slowFirstPaint, scriptsLoaded } from './helpers.mjs';

// Fix round 8, item 2: every control works from the moment it is visible. A fresh context (no service worker, empty cache) on slow 4G
// with a 4x slower CPU, the bundled scripts held back, a tap at first paint: the choice must already be saved and shown.
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lfg:v1') ?? 'null'));
const setting = async (page, key) => (await stored(page))?.settings?.[key]?.value;
// What the chip shows is what CSS leaves visible (innerText), not every word in its markup.
const shown = (page, chip) => expect.poll(() => page.locator(`.chip--${chip} .chip__v`).evaluate((el) => el.innerText));
const sheet = (page) => page.locator('#settings');

test.describe('a tap at first paint, scripts still loading', () => {
  test('Pick console opens the sheet, and a console chosen there is saved and shown on the chip', async ({ page }) => {
    await slowFirstPaint(page);
    await press(page.locator('.chip--console'));
    await expect(sheet(page)).toBeVisible();
    await press(sheet(page).getByRole('radio', { name: 'Xbox Series S' }));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await setting(page, 'console')).toBe('xbox-s');
    await shown(page, 'console').toBe('Series S');
  });

  test('the console prompt button saves the choice, hides the prompt and moves focus to the heading', async ({ page }) => {
    await slowFirstPaint(page);
    await press(page.locator('.console-btn[data-value="xbox-x"]'));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await setting(page, 'console')).toBe('xbox-x');
    await expect(page.locator('.console-card')).toBeHidden();
    await shown(page, 'console').toBe('Series X');
    await expect(page.locator('#ask-title')).toBeFocused();
  });

  test('the spoiler chip opens the sheet, and a level chosen there is saved, shown and closes it', async ({ page }) => {
    await slowFirstPaint(page);
    await press(page.locator('.chip--dial'));
    await expect(sheet(page)).toBeVisible();
    await press(sheet(page).getByRole('radio', { name: /^Places\b/ }));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await setting(page, 'dial')).toBe('places');
    await shown(page, 'dial').toBe('Places');
    await expect(sheet(page)).toBeHidden();
  });

  test('the theme chosen in the sheet is saved and applied', async ({ page }) => {
    await slowFirstPaint(page);
    await press(page.locator('.chip--console'));
    await press(sheet(page).getByRole('radio', { name: 'Night', exact: true }));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await setting(page, 'theme')).toBe('night');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  });

  test('the stage picker saves the stage', async ({ page }) => {
    await slowFirstPaint(page);
    await press(page.locator('.stage-pick label', { hasText: 'Day 1' }));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await setting(page, 'stage')).toBe('day-1');
  });

  test('a tick made at first paint is kept once the scripts arrive', async ({ page }) => {
    await slowFirstPaint(page);
    const box = page.locator('.stage[data-stage="before"] input[data-todo]').first();
    await press(box);
    const id = await box.getAttribute('data-todo');
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    await expect(box).toBeChecked();
    await expect.poll(async () => (await stored(page))?.items?.[id]?.done, { timeout: 15_000 }).toBe(true); // saved when the scripts arrive, at the latest
    await expect(box).toBeChecked(); // and the page did not repaint it unticked
  });

  test('"See all steps" opens its fold', async ({ page }) => {
    await saved(page, { v: 2, settings: { console: { value: 'ps5', at: 1 } }, items: {} });
    await slowFirstPaint(page);
    const fold = page.locator('.stage-fold');
    expect(await fold.evaluate((el) => el.open)).toBe(false);
    await press(fold.locator('> summary'));
    expect(await scriptsLoaded(page), 'the tap came before any script').toBe(false);
    expect(await fold.evaluate((el) => el.open)).toBe(true);
  });

  test('text typed in the search box at first paint is kept and answered once the index loads', async ({ page }) => {
    await slowFirstPaint(page);
    const q = page.locator('#q');
    await q.focus();
    await page.keyboard.type('save');
    expect(await scriptsLoaded(page), 'typed before any script').toBe(false);
    await expect(q).toHaveValue('save');
    await expect(page.locator('#q-results li').first()).toBeVisible({ timeout: 20_000 }); // answered without another keystroke
    await expect(q).toHaveValue('save');
  });
});
