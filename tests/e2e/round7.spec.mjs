import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { press, saved } from './helpers.mjs';
import { lowContrast, lowNonText } from './contrast.mjs';
import { emptyTicks } from '../../src/lib/merge.js';

// Fix round 7, item 1: a loss warning is a warning plus one filled button under it, on the answer, in a search result and on a topic card.
// The fixture record loss-01 (tests/fixtures/answers/loss-01.yaml) is the warning; the real records are checked against the real build below.
const WARNING = 'You can lose in-game zorp. There is a simple way to keep it safe.';
const LABEL = 'Show how to keep it safe';
const REMEDY = 'Wombat remedy one';

/** The primary button's fill and the box's own width, as the browser draws them. */
const look = (btn) =>
  btn.evaluate((el) => {
    const probe = Object.assign(document.createElement('i'), { style: 'background: var(--action); color: var(--bg)' });
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const s = getComputedStyle(el);
    const out = { bg: s.backgroundColor, wantBg: want.backgroundColor, color: s.color, wantColor: want.color, borderStyle: s.borderTopStyle, width: el.getBoundingClientRect().width, container: el.closest('.reveal').getBoundingClientRect().width, height: el.getBoundingClientRect().height };
    probe.remove();
    return out;
  });
const expectPrimary = async (btn) => {
  const l = await look(btn);
  expect(l.bg).toBe(l.wantBg);
  expect(l.color).toBe(l.wantColor);
  expect(l.borderStyle).not.toBe('dashed');
  expect(Math.abs(l.width - l.container)).toBeLessThan(1); // full width of its container
  expect(l.height).toBeGreaterThanOrEqual(47.5);
};

for (const theme of ['day', 'night']) {
  test.describe(`${theme}`, () => {
    test.beforeEach(({ page }) => saved(page, { theme }));

    test('the answer page: the warning, then directly under it the one filled full-width button; it opens in place, the dial stays Off, Hide is first', async ({ page }) => {
      await page.goto('/a/loss-01/');
      await expect(page.locator('.answer__a')).toHaveText(WARNING);
      const btn = page.locator('.reveal--warn .reveal__btn');
      await expect(btn).toHaveText(LABEL);
      await expectPrimary(btn);
      // Directly under: nothing sits between the warning and the button's block.
      expect(await page.locator('.answer__a + .reveal--warn').count()).toBe(1);
      await expect(page.getByText(REMEDY)).toHaveCount(0); // not in the page at all before the tap
      await press(btn);
      await expect(page.getByText(REMEDY).first()).toBeVisible();
      await expect(page).toHaveURL(/\/a\/loss-01\/$/);
      await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
      // The detail is short paragraphs (four sentences, two a paragraph) with Hide first, above the text, still a 48px button.
      const out = page.locator('.reveal--warn .reveal__out');
      expect(await out.locator('> p').count()).toBe(2);
      expect(await out.evaluate((el) => el.firstElementChild.className)).toBe('reveal__hide');
      const hide = out.getByRole('button', { name: 'Hide this detail' });
      expect((await hide.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
      expect((await hide.boundingBox()).y).toBeLessThan((await out.locator('> p').first().boundingBox()).y);
      await press(hide);
      await expect(page.getByText(REMEDY)).toHaveCount(0);
      await expect(btn).toBeFocused();
    });

    test('a search result for the warning is a card: the warning, the answer link and the button; the button opens the remedy in place at Off', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('searchbox').fill('lose my zorp');
      const card = page.locator('#q-results li.ask-loss').first();
      await expect(card).toContainText('You can lose in-game zorp. There is a simple way to keep it safe.');
      await expect(card.getByRole('link', { name: /can I lose my zorp/ })).toHaveAttribute('href', '/a/loss-01/');
      const btn = card.locator('.reveal__btn');
      await expect(btn).toHaveText(LABEL);
      await expectPrimary(btn);
      // Two controls (the link, the button) at least 8px apart.
      const link = await card.locator('a:not(.reveal__btn)').boundingBox();
      const b = await btn.boundingBox();
      expect(b.y - (link.y + link.height)).toBeGreaterThanOrEqual(7.5);
      expect(link.height).toBeGreaterThanOrEqual(47.5);
      await expect(page.getByText(REMEDY)).toHaveCount(0);
      await press(btn);
      await expect(card.getByText(REMEDY).first()).toBeVisible();
      await expect(page).toHaveURL(/\/(\?.*)?$/); // still the Ask screen
      await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lfg:v1') ?? '{}').dial ?? 'off')).toBe('off');
      expect(await card.locator('.reveal__out > p').count()).toBe(2);
      expect(await card.locator('.reveal__out').evaluate((el) => el.firstElementChild.className)).toBe('reveal__hide');
      expect(await lowContrast(page), 'text under the contrast floor').toEqual([]);
      expect(await lowNonText(page), 'control parts under 3 to 1').toEqual([]);
      await press(card.getByRole('button', { name: 'Hide this detail' }));
      await expect(page.getByText(REMEDY)).toHaveCount(0);
      await expect(btn).toBeFocused();
    });

    test('the topic card carries the same pair, and its reveal opens in place', async ({ page }) => {
      await page.goto('/topics/money/');
      const card = page.locator('.card', { hasText: 'Sample loss question' });
      await expect(card.locator('.card__a')).toHaveText(WARNING);
      const btn = card.locator('.reveal--warn .reveal__btn');
      await expect(btn).toHaveText(LABEL);
      await expectPrimary(btn);
      await expect(page.getByText(REMEDY)).toHaveCount(0);
      await press(btn);
      await expect(card.getByText(REMEDY).first()).toBeVisible();
      await expect(page).toHaveURL(/\/topics\/money\/$/);
      await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
    });
  });
}

test('a result with no loss warning stays a plain link row', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('thing 03');
  await expect(page.locator('#q-results li').first()).toBeVisible();
  await expect(page.locator('#q-results li.ask-loss, #q-results .reveal')).toHaveCount(0);
});

// The real build (dist, written by `npm run build` before the tests run), served locally from a throwaway server: the live site and its
// /api/progress are never called. The three queries a reviewer typed must each end on the button, and the remedy is not in the page until the tap.
test.describe('the real records', () => {
  let server;
  let base;
  test.beforeAll(async () => {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    server = createServer(async (req, res) => {
      try {
        const { pathname } = new URL(req.url, 'http://x');
        if (pathname === '/api/progress') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(emptyTicks()));
        let path = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
        if (path.endsWith('/')) path += 'index.html';
        res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(await readFile(join('dist', path)));
      } catch {
        res.writeHead(404).end('Not found');
      }
    }).listen(0, '127.0.0.1');
    await new Promise((ok) => server.once('listening', ok));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  test.afterAll(() => server.close());

  for (const query of ['can i get banned or lose my money', 'lose my money', 'keep my cash', 'will i lose anything']) {
    test(`"${query}" ends on the button, opens the remedy in place, and leaves the dial at Off`, async ({ page }) => {
      await page.goto(`${base}/`);
      await page.getByRole('searchbox').fill(query);
      const cards = page.locator('#q-results li.ask-loss');
      await expect(cards.first()).toBeVisible();
      const btn = cards.first().locator('.reveal__btn');
      await expect(btn).toHaveText(LABEL);
      await expectPrimary(btn);
      // The warning never ends the result: the button follows it in the same card.
      expect(await cards.first().evaluate((li) => li.lastElementChild.classList.contains('reveal'))).toBe(true);
      expect(await page.content()).not.toMatch(/ATM/);
      await press(btn);
      await expect(cards.first().locator('.reveal__out')).toContainText('ATM'); // the remedy arrived by the tap, from the real mild fragment
      await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lfg:v1') ?? '{}').dial ?? 'off')).toBe('off');
    });
  }

  test('the real answer pages and the money topic card show the pair', async ({ page }) => {
    for (const id of ['keep-your-cash', 'will-i-lose-anything']) {
      await page.goto(`${base}/a/${id}/`);
      await expect(page.locator('.answer__a')).toContainText('You can lose in-game money. There is a simple way to keep it safe.');
      await expect(page.locator('.answer__a + .reveal--warn .reveal__btn')).toHaveText(LABEL);
      await expect(page.getByText('ATM')).toHaveCount(0);
    }
    await page.goto(`${base}/topics/money/`);
    const card = page.locator('.card', { hasText: 'keep my cash from being lost' });
    await expect(card.locator('.reveal--warn .reveal__btn')).toHaveText(LABEL);
  });
});
