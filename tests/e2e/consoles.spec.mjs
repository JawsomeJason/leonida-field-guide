import { test, expect } from '@playwright/test';
import { PAGES, saved, press, shown } from './helpers.mjs';

// One name per console, everywhere (spec "Console"): PS5, Xbox Series X, Xbox Series S. Never "Xbox X" or "Xbox S".
const states = [{}, { console: 'ps5' }, { console: 'xbox-x' }, { console: 'xbox-s', dial: 'mild' }];

test('no page, in any state, names a console "Xbox X" or "Xbox S"', async ({ page }) => {
  test.setTimeout(240_000);
  const found = [];
  for (const settings of states) {
    await saved(page, settings);
    for (const path of PAGES) {
      await page.goto(path);
      // All the text (hidden spans and closed folds too) and every attribute value: aria labels, titles, alt text, meta tags.
      const text = await page.evaluate(() => [document.documentElement.textContent, ...[...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value))].join('\n'));
      for (const m of text.matchAll(/\bXbox [XS]\b/g)) found.push(`${path} (${JSON.stringify(settings)}): "${text.slice(Math.max(m.index - 20, 0), m.index + 20).replace(/\s+/g, ' ')}"`);
    }
  }
  expect(found).toEqual([]);
});

test('search results never name a console "Xbox X" or "Xbox S"', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('xbox series console');
  await expect(page.locator('#q-results a').first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/\bXbox [XS]\b/);
});

test('the header chip always names the console in use, and asks until one is chosen', async ({ page }) => {
  const chip = page.locator('.chip--console');
  await page.goto('/');
  expect(await shown(chip)).toBe('Choose');
  await expect(chip).toHaveAccessibleName('Console: choose one, change');
  await press(chip); // tapping it opens the sheet, where the console is chosen
  await expect(page.locator('#settings')).toBeVisible();
  for (const [console, name] of [['ps5', 'PS5'], ['xbox-x', 'Xbox Series X'], ['xbox-s', 'Xbox Series S']]) {
    await saved(page, { console });
    await page.goto('/checklist/');
    await expect(page.getByRole('button', { name: `Console: ${name}, change`, exact: true })).toBeVisible();
  }
});

test('the sheet, the prompt and an answer switch call each console the same', async ({ page }) => {
  await page.goto('/');
  for (const name of ['PS5', 'Xbox Series X', 'Xbox Series S']) await expect(page.locator('.console-card').getByRole('button', { name, exact: true })).toBeVisible();
  await press(page.locator('.chip--console'));
  for (const name of ['PS5', 'Xbox Series X', 'Xbox Series S']) await expect(page.locator('#settings').getByRole('radio', { name, exact: true })).toBeAttached();
  await page.goto('/a/sample-04/');
  for (const name of ['PS5', 'Xbox Series X', 'Xbox Series S']) await expect(page.locator('.ctabs').getByRole('button', { name, exact: true })).toBeVisible();
});

test('a page for another console says which, in the full names', async ({ page }) => {
  await saved(page, { console: 'xbox-x' });
  await page.goto('/a/console-ps5/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page is for PS5, not Xbox Series X.');
  await expect(page.locator('.other-fold > summary')).toHaveText('Show the PS5 version');
});

test('the header stays one row with both chips at their longest, and nothing scrolls sideways', async ({ page }) => {
  await saved(page, { dial: 'places' }); // "Choose" and "Places"
  await page.goto('/');
  const ys = await page.evaluate(() => [...document.querySelectorAll('.site-header__row > *')].map((e) => Math.round(e.getBoundingClientRect().y)));
  expect(new Set(ys).size, 'one row').toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Header (spec "Layout"): one row at 320, short words on the chips, the full names kept for a screen reader.
const header = (page) => page.locator('.site-header').evaluate((el) => el.getBoundingClientRect().height);
const lines = (page) => page.evaluate(() => [...document.querySelectorAll('.chip__k, .chip__v > :not(.sr-only)')].filter((e) => e.offsetParent).map((e) => {
  const r = document.createRange();
  r.selectNodeContents(e);
  return { text: e.textContent, lines: r.getClientRects().length };
}));

test('the header is as tall at 320 as at 390, also at 130% text, and no chip text wraps', async ({ page }) => {
  test.setTimeout(60_000);
  for (const settings of [{ console: 'xbox-x', dial: 'places' }, { dial: 'mild' }, {}]) { // longest words, and the never-chosen "Choose"
    await saved(page, settings);
    for (const scale of ['100%', '130%']) {
      const seen = [];
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/');
        await page.addStyleTag({ content: `html { font-size: ${scale}; }` });
        seen.push(await header(page));
        const wrapped = (await lines(page)).filter((l) => l.lines !== 1);
        expect(wrapped, `chip text on one line at ${width} wide, ${scale}, ${JSON.stringify(settings)}`).toEqual([]);
        const ys = await page.evaluate(() => [...document.querySelectorAll('.site-header__row > *')].map((e) => Math.round(e.getBoundingClientRect().y)));
        expect(new Set(ys).size, `one row at ${width} wide, ${scale}`).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${width}, ${scale}`).toBe(true);
      }
      expect(seen[0], `header height at 320 and 390 wide, ${scale}, ${JSON.stringify(settings)}`).toBeCloseTo(seen[1], 0);
    }
  }
});

test('the sun mark is in the header on every screen, drawn in CSS, and the home link keeps its name', async ({ page }) => {
  for (const path of ['/', '/topics/', '/topics/settings/', '/checklist/', '/new/', '/about/', '/a/sample-01/', '/places/', '/no-such-page/']) {
    await page.goto(path);
    const mark = page.locator('.site-header .sun-mark');
    await expect(mark, path).toBeVisible();
    await expect(mark, path).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('.site-header img').count(), `${path}: no image in the header`).toBe(0);
    const { w, h, bg } = await mark.evaluate((el) => ({ ...(({ width: w, height: h }) => ({ w, h }))(el.getBoundingClientRect()), bg: getComputedStyle(el, '::before').backgroundImage }));
    expect(w, path).toBeGreaterThan(24);
    expect(h, path).toBeGreaterThan(8);
    expect(bg, `${path}: the sun uses the accent tokens`).toContain('gradient');
    await expect(page.getByRole('link', { name: 'Leonida Field Guide' })).toBeVisible();
  }
});
