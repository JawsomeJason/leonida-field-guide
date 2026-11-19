import { test, expect } from '@playwright/test';
import { press, saved, DAY, NIGHT, PAGES } from './helpers.mjs';

// Fix round 5 (UI): the hidden-detail control, the sheet's dial line, places cards with their evidence, the label key, Next up rows.
const LABEL = 'Show how to keep it safe (one small game rule)'; // tests/fixtures/answers/sample-02.yaml, the mild reveal
const SHEET_LINE = 'Off names a game system only to say it exists; where you could lose something, Off says so and one tap shows how to avoid it.';

test('a reveal with a label: the control says it, is a 48px control, reveals in place, leaves the dial at Off, and Hide puts it away', async ({ page }) => {
  await page.goto('/a/sample-02/');
  const btn = page.locator('.reveal[data-tier="mild"] .reveal__btn');
  await expect(btn).toHaveText(LABEL);
  expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
  await expect(page.getByText('Wombat note one')).toHaveCount(0);
  await press(btn);
  await expect(page.getByText('Wombat note one')).toBeVisible();
  await expect(page).toHaveURL(/\/a\/sample-02\/$/);
  await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
  const hide = page.getByRole('button', { name: 'Hide this detail' });
  expect((await hide.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
  await press(hide);
  await expect(page.getByText('Wombat note one')).toHaveCount(0);
  await expect(btn).toBeFocused();
});

test('a reveal with no label says what it is and why it is hidden, not a bare "Show"', async ({ page }) => {
  await page.goto('/a/sample-02/');
  const btn = page.locator('.reveal[data-tier="places"] .reveal__btn');
  await expect(btn).toContainText('Show this detail');
  await expect(btn).toContainText('hidden until you ask');
  expect((await btn.innerText()).trim()).not.toBe('Show');
});

test('the settings sheet says once, beside the dial, what Off does with a loss', async ({ page }) => {
  await page.goto('/');
  await press(page.locator('.chip--dial'));
  const line = page.locator('#settings .levels').getByText(SHEET_LINE, { exact: true });
  await expect(line).toBeVisible();
  await expect(line).toHaveCount(1);
});

test('About says the same thing once', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('main')).toContainText(SHEET_LINE);
  expect((await page.locator('main').innerText()).split(SHEET_LINE).length - 1).toBe(1);
});

test('a places card at Places says where its source, date and label are, and that answer has all three', async ({ page }) => {
  await saved(page, { dial: 'places' });
  await page.goto('/places/');
  const cards = page.locator('#hidden-list .card');
  await expect(cards.first()).toBeVisible();
  const hrefs = await cards.locator('.card__q a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const card of await cards.all()) await expect(card).toContainText('Source, date checked and how sure we are: open the answer.');
  for (const href of hrefs) {
    await page.goto(href); // the gate forwards to the explicit page at Places
    await expect(page.locator('.trust__now')).toHaveText(/^(Official|Reported|Community), /);
    await expect(page.locator('dl.facts time')).toHaveAttribute('datetime', /^\d{4}-\d\d-\d\d$/);
    await expect(page.locator('dl.facts [data-outside] a[href^="http"]').first()).toBeVisible();
  }
});

test('the Official and Reported key appears once on every page that shows a label, beside it, and nowhere else', async ({ page }) => {
  const KEY = 'Official: from the publisher or the console maker. Reported: from a news or guide site.';
  for (const path of PAGES.filter((p) => p.startsWith('/a/') || p === '/about/' || p === '/')) {
    await saved(page, { dial: 'mild' });
    await page.goto(path);
    const labels = await page.locator('.trust__now').count();
    await expect(page.locator('.label-key'), path).toHaveCount(labels ? 1 : 0);
    if (labels) await expect(page.locator('.label-key'), path).toHaveText(KEY);
  }
});

for (const [theme, bg, scheme] of [['day', DAY, 'light'], ['night', NIGHT, 'dark']]) {
  test(`Next up rows look tappable in the ${theme} theme: a surface and border against the page, an arrow, 48px`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await saved(page, { console: 'ps5', theme });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', bg);
    const rows = page.locator('.next-up__list a');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      const s = await row.evaluate((a) => {
        const c = getComputedStyle(a), after = getComputedStyle(a, '::after');
        return { bg: c.backgroundColor, border: c.borderTopWidth, radius: c.borderTopLeftRadius, chevron: after.content, mask: after.maskImage || after.webkitMaskImage };
      });
      expect(s.bg, 'a fill that is not the page').not.toBe(bg);
      expect(parseFloat(s.border), 'a border').toBeGreaterThan(0);
      expect(parseFloat(s.radius)).toBeGreaterThan(0);
      expect(s.chevron, 'an arrow at the end').not.toBe('none');
      expect(s.mask).toContain('svg');
      expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
    }
  });
}
