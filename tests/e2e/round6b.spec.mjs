import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { press } from './helpers.mjs';

// Fix round 6: the settings sheet (position, scrim, scroll lock), the Ask fold, and the New heading.
// Never the owner's real progress record: every test answers /api/progress itself.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
});

// ---- Settings sheet (spec "Layout"): a bottom sheet, a scrim, no scroll behind it, closes three ways ----
const open = async (page, chip) => {
  await press(page.locator(`.chip--${chip}`));
  await expect(page.locator('#settings')).toBeVisible();
  // Settle: the sheet slides in; measure where it stops.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
};
const isOpen = (page) => page.evaluate(() => document.getElementById('settings').matches(':popover-open'));
/** Tap or click at a point that is not on the sheet (the scrim). */
const tapAt = (page, x, y) => (test.info().project.use.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

for (const colorScheme of ['light', 'dark']) {
  for (const chip of ['console', 'dial']) {
    test(`the settings sheet from the ${chip} chip is a bottom sheet with a scrim, locks the page and closes three ways (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
      await page.goto('/checklist/');
      const { width: vw, height: vh } = page.viewportSize();
      // Something to scroll: the page must be taller than the screen, or the lock would be tested against nothing.
      const tall = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(tall, 'the page has room to scroll').toBeGreaterThan(100);
      await open(page, chip);
      // (Opened first: Playwright's own tap on a chip scrolls the page to its top.) Put the page 100px down behind the sheet.
      await page.evaluate(() => scrollTo(0, 100));
      expect(await page.evaluate(() => scrollY)).toBe(100);
      const box = await page.evaluate(() => {
        const r = document.getElementById('settings').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, width: r.width };
      });
      // Anchored to the bottom edge, never hanging from the top.
      expect(Math.abs(box.bottom - vh), 'bottom edge is the screen bottom').toBeLessThanOrEqual(1);
      if (vw < 600) expect(Math.abs(box.width - vw), 'full width on a phone').toBeLessThanOrEqual(1);
      else {
        expect(box.width, 'centred strip of at most 30rem from 600px').toBeLessThanOrEqual(480.5);
        expect(Math.abs(box.left + box.width / 2 - vw / 2), 'centred (a desktop scrollbar may shift it by half its width)').toBeLessThanOrEqual(8);
      }
      expect(box.top, 'not hung from the top').toBeGreaterThan(0);
      expect(vh - box.top, 'taller content scrolls inside at 90dvh').toBeLessThanOrEqual(vh * 0.9 + 1);

      // The scrim: not transparent, and fixed over the whole screen (the tap below lands on it, so it must not reach what is under it).
      const scrim = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('settings'), '::backdrop'); return { bg: c.backgroundColor, position: c.position, inset: [c.top, c.right, c.bottom, c.left] }; });
      expect(scrim.bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(scrim.position).toBe('fixed');
      expect(scrim.inset).toEqual(['0px', '0px', '0px', '0px']);

      // The page behind does not scroll: wheel over the scrim and over the sheet, and a touch drag where touch is on.
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
      await page.mouse.move(vw / 2, box.top / 2);
      await page.mouse.wheel(0, 400);
      await page.mouse.move(vw / 2, box.top + 40);
      await page.mouse.wheel(0, 400);
      if (test.info().project.use.hasTouch) {
        const cdp = await page.context().newCDPSession(page);
        for (const y of [box.top / 2, box.top + 40]) await cdp.send('Input.synthesizeScrollGesture', { x: vw / 2, y, yDistance: -300, gestureSourceType: 'touch' });
      }
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => scrollY), 'the page behind stayed put').toBe(100);

      // An outside tap closes it, and the page is free again.
      const url = page.url();
      await tapAt(page, vw / 2, box.top / 2);
      await expect.poll(() => isOpen(page)).toBe(false);
      expect(page.url(), 'the tap closed the sheet and went no further').toBe(url);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('visible');
      expect(await page.evaluate(() => scrollY)).toBe(100);

      // The chip is still on screen and tappable: the tap reaches it, and it opens the sheet again.
      const where = await page.locator(`.chip--${chip}`).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, reaches: el.contains(hit) };
      });
      expect(where).toEqual({ inside: true, reaches: true });

      // Escape closes it and gives focus back to the chip.
      await open(page, chip);
      await page.keyboard.press('Escape');
      await expect.poll(() => isOpen(page)).toBe(false);
      await expect(page.locator(`.chip--${chip}`)).toBeFocused();

      // Choosing a setting closes it.
      await open(page, chip);
      await press(page.locator('#settings').getByRole('radio', { name: /^Places\b/ }));
      await expect.poll(() => isOpen(page)).toBe(false);
    });
  }
}

// ---- Ask: the full stage list folds behind one row once a console is chosen ----
const saved = (page, settings) => page.addInitScript((s) => localStorage.setItem('lfg:v1', JSON.stringify(s)), settings);
const fold = (page) => page.locator('.stage-fold');
const rowsShown = (page) => page.locator('.stage-fold .todo-list .todo:visible');
const denominator = async (page) => Number((await page.locator('.next-up__count').innerText()).match(/of (\d+) done/)[1]);

test('with a console chosen the stage steps are folded behind "See all N steps", under the stage picker', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  await expect(fold(page)).not.toHaveAttribute('open', '');
  const summary = page.locator('.stage-fold > summary');
  const n = await denominator(page);
  await expect(summary).toHaveText(`See all ${n} steps`);
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
  const y = async (loc) => (await loc.boundingBox()).y;
  expect(await y(page.locator('.stage-pick'))).toBeLessThan(await y(summary));
  await expect(page.locator('.next-up')).toBeVisible();
  await expect(rowsShown(page)).toHaveCount(0);
});

test('opening the fold shows the full list; ticking inside updates Next up and keeps it open; the count follows the stage', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  const summary = page.locator('.stage-fold > summary');
  const n = await denominator(page);
  await press(summary);
  await expect(fold(page)).toHaveAttribute('open', '');
  await expect(rowsShown(page)).toHaveCount(n);

  await press(rowsShown(page).first().locator('label'));
  await expect(page.locator('.next-up__count')).toContainText(`1 of ${n} done`);
  await expect(fold(page)).toHaveAttribute('open', '');
  await expect(rowsShown(page).first().locator('input')).toBeChecked();

  // Another stage: the row's count is that stage's steps for this console, and the fold stays as the player left it.
  await press(page.locator('.stage-pick label', { hasText: 'Hour 1' }));
  const m = await denominator(page);
  await expect(summary).toHaveText(`See all ${m} step${m === 1 ? '' : 's'}`);
  await expect(fold(page)).toHaveAttribute('open', '');
  await expect(rowsShown(page)).toHaveCount(m);
});

test('before a console is chosen nothing is folded; choosing one folds the list', async ({ page }) => {
  await page.goto('/');
  await expect(fold(page)).toHaveAttribute('open', '');
  await expect(page.locator('.stage-fold > summary')).toBeHidden();
  await expect(page.locator('.stage-pick')).toBeVisible();
  await press(page.locator('.chip--console'));
  await press(page.locator('#settings').getByRole('radio', { name: 'Xbox Series X', exact: true }));
  await expect(fold(page)).not.toHaveAttribute('open', '');
  await expect(page.locator('.stage-fold > summary')).toBeVisible();
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });
  test('the whole list shows and there is no fold row', async ({ page }) => {
    await page.goto('/');
    await expect(fold(page)).toHaveAttribute('open', '');
    await expect(page.locator('.stage-fold > summary')).toBeHidden();
    await expect(page.locator('.stage .todo-links a:visible').first()).toBeVisible();
  });
});

// ---- New: the tab keeps its name, the screen says what it holds ----
test('the New tab keeps its name; its heading and title say "Known problems and what changed", with Known problems first below', async ({ page }) => {
  await page.goto('/new/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Known problems and what changed');
  await expect(page).toHaveTitle(/^Known problems and what changed/);
  expect(await page.locator('main h2').first().innerText()).toBe('Known problems');
  await expect(page.locator('.nav a[aria-current="page"], nav[aria-label="Main"] a[aria-current="page"]').first()).toHaveText('New');
});
