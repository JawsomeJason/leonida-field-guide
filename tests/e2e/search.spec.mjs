import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saved, measure, press, records } from './helpers.mjs';
import { FIXTURE_QUERIES } from '../search/queries.mjs';

// The sync call never leaves this machine: the page is served locally and this answers it with an empty record.
test.beforeEach(({ page }) => page.route('**/api/progress', (route) => route.fulfill({ json: { v: 2, settings: {}, items: {} } })));

const results = (page) => page.locator('#q-results');
const ask = async (page, text) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill(text);
};

test.describe('plain sentences find the right answer', () => {
  for (const [query, id] of FIXTURE_QUERIES) {
    test(`"${query}" finds ${id}`, async ({ page }) => {
      await ask(page, query);
      await expect(results(page).getByRole('link').first()).toHaveAttribute('href', `/a/${id}/`);
    });
  }
  test('typing it letter by letter ends at the same answer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').pressSequentially('how do i quicksave');
    await expect(results(page).getByRole('link').first()).toHaveAttribute('href', '/a/find-save/');
  });
});

// No real match (no meaningful word of the question found in an answer's question or keywords): the floor line and the way to Topics, nothing else. Never a dead end, never a weak card.
const NONE = ['zzyzx qqqq', 'how do i get a million dollars fast', 'my kid wants to play too', 'how do i unlock the secret car', 'where is the nearest gun shop in the city', 'how do i get a better weapon', 'who is the main character', 'what is the best car'];
for (const query of NONE) {
  test(`"${query}" has no answer: the floor line and a way to Topics, no Possibly related`, async ({ page }) => {
    await ask(page, query);
    const where = await page.locator('#q-where').isVisible(); // a place question shows its own note instead of the floor line
    if (!where) await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.');
    await expect(page.getByText('Possibly related')).toHaveCount(0);
    const links = results(page).getByRole('link');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute('href', '/topics/');
    await expect(page.getByRole('button', { name: 'Show more' })).toBeHidden();
    if (test.info().project.use.hasTouch) {
      const { problems } = await measure(page);
      expect(problems).toEqual([]);
    }
  });
}

test('one word that only an unrelated answer holds is no answer: no cards under the floor line or the places note', async ({ page }) => {
  await page.route('**/search/none.json', (route) =>
    route.fulfill({ json: [{ id: 'bonus', question: 'Does the city edition include a bonus pack?', short: 'It does.', topic: 'setup', consoles: 'all', rank: 1 }, { id: 'timing', question: 'When does the unlock happen?', short: 'At night.', topic: 'setup', consoles: 'all', rank: 2 }] }),
  );
  for (const query of ['where is the nearest gun shop in the city', 'how do i unlock the secret car']) {
    await ask(page, query);
    await expect(results(page).getByRole('link')).toHaveCount(1);
    await expect(results(page).getByRole('link')).toHaveAttribute('href', '/topics/');
    await expect(page.locator('#q-results a[href^="/a/"]')).toHaveCount(0);
  }
  await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.');
});

test('no answer says so plainly and hints at nothing hidden: no Mild line, no settings button', async ({ page }) => {
  await ask(page, 'zzyzx qqqq');
  await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.');
  await expect(page.getByText(/behind the Mild/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spoiler settings' })).toHaveCount(0);
  await expect(page.locator('#q-mild')).toHaveCount(0);
});

test('an answer shows no floor line', async ({ page }) => {
  await ask(page, 'how do i save my game');
  await expect(page.getByRole('status')).not.toHaveText(/no answer/);
  await expect(page.getByText('Possibly related')).toHaveCount(0);
});

test('a weaker match (short text only) is not offered at all', async ({ page }) => {
  await page.route('**/search/none.json', (route) =>
    route.fulfill({ json: [{ id: 'a-one', question: 'Alpha question?', short: 'Mentions the zebra kiosk here.', topic: 'setup', consoles: 'all', rank: 1 }] }),
  );
  await ask(page, 'zebra kiosk');
  await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.');
  await expect(results(page).getByRole('link')).toHaveCount(1);
  await expect(results(page).getByRole('link')).toHaveAttribute('href', '/topics/');
});

// Five answers show; a real 48px button shows the rest.
const many = Array.from({ length: 8 }, (_, i) => ({ id: `row-${i + 1}`, question: `How do I rotate the widget, part ${i + 1}?`, short: 'Fixture.', topic: 'setup', consoles: 'all', rank: i + 1 }));
test('five answers show, Show more shows the rest, a new question starts cut again', async ({ page }) => {
  await page.route('**/search/none.json', (route) => route.fulfill({ json: many }));
  await ask(page, 'rotate widget');
  const links = results(page).getByRole('link');
  const more = page.getByRole('button', { name: 'Show more' });
  await expect(links).toHaveCount(5);
  await expect(page.getByRole('status')).toHaveText('8 answers');
  await expect(more).toBeVisible();
  expect((await more.boundingBox()).height).toBeGreaterThanOrEqual(48);
  if (test.info().project.use.hasTouch) {
    const { problems } = await measure(page);
    expect(problems).toEqual([]);
  }
  await press(more);
  await expect(links).toHaveCount(8);
  await expect(more).toBeHidden();
  await expect(links.nth(5)).toBeFocused();
  await page.getByRole('searchbox').fill('rotate widget part');
  await expect(links).toHaveCount(5);
  await expect(more).toBeVisible();
});

test('two swapped letters are one typo', async ({ page }) => {
  await ask(page, 'how do i svae my game');
  await expect(results(page).getByRole('link').first()).toHaveAttribute('href', '/a/find-save/');
});

test('where is something at Off: places are hidden by design, outside maps exist, one link to the Places gate and no map link', async ({ page }) => {
  await ask(page, 'where is the gun shop');
  const note = page.locator('#q-where');
  await expect(note).toBeVisible();
  await expect(note.locator('.where-off p')).toHaveText('Places are hidden by design. Outside maps exist; they appear here once Places is on.');
  await expect(note.getByRole('link')).toHaveCount(1);
  await expect(note.getByRole('link', { name: /Places/ })).toHaveAttribute('href', '/places/');
  if (test.info().project.use.hasTouch) {
    const { problems } = await measure(page);
    expect(problems).toEqual([]);
  }
  await page.getByRole('searchbox').fill('where can I put the game');
  await expect(note).toBeHidden();
});

test('hidden keywords are not searched at Off, and are at Places', async ({ page }) => {
  await ask(page, 'zebra kiosk');
  await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.'); // no match, so nothing from the hidden tier
  await expect(results(page).locator('a[href^="/places/"]')).toHaveCount(0);
  expect(await (await page.request.get('/search/none.json')).text()).not.toContain('zebra');

  await saved(page, { dial: 'places' });
  await ask(page, 'zebra kiosk');
  await expect(results(page).getByRole('link').first()).toHaveAttribute('href', '/places/place-01/');
});

test('answers for the other console stay out of the results', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await ask(page, 'download will not start');
  await expect(results(page).getByRole('link').first()).toHaveAttribute('href', '/a/find-ps5/');
  await expect(results(page).locator('a[href="/a/find-xbox/"]')).toHaveCount(0);

  await saved(page, { console: 'xbox-s' });
  await ask(page, 'download will not start');
  await expect(results(page).getByRole('link').first()).toHaveAttribute('href', '/a/find-xbox/');
  await expect(results(page).locator('a[href="/a/find-ps5/"]')).toHaveCount(0);
});

// At Mild every tier is searched. Each record's own question must give a result link that opens and that a tap follows.
test.describe('every result link opens', () => {
  for (const r of records) {
    test(`${r.tier} ${r.id}`, async ({ page }) => {
      // An answer for one console shows only to that console's owner.
      await saved(page, { dial: 'mild', console: Array.isArray(r.consoles) ? r.consoles[0] : 'ps5' });
      await ask(page, r.question);
      const link = results(page).getByRole('link', { name: r.question });
      const href = await link.first().getAttribute('href');
      expect((await page.request.get(href)).status()).toBe(200);
      await press(link.first());
      await expect(page).toHaveURL(new RegExp(`${href}(show/)?`)); // at the dial a hidden gate forwards to its explicit address
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
});

for (const scheme of ['light', 'dark']) {
  test(`the no-match list and the where-is note have no axe violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await ask(page, 'where is the zzyzx');
    await expect(page.locator('#q-where')).toBeVisible();
    await expect(results(page).getByRole('link')).toHaveCount(4);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
