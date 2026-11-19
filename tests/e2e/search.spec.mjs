import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saved, measure, press, records } from './helpers.mjs';
import { FIXTURE_QUERIES } from '../search/queries.mjs';

// A service worker would answer from its cache and skip the stubbed routes below, depending on how fast the machine is: block it here.
test.use({ serviceWorkers: 'block' });

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
const NONE = ['zzyzx qqqq', 'how do i get a million dollars fast', 'my kid wants to play too', 'how do i get a better weapon', 'what is the best car'];
for (const query of NONE) {
  test(`"${query}" has no answer: the floor line and a way to Topics, no Possibly related`, async ({ page }) => {
    await ask(page, query);
    await expect(page.getByRole('status')).toHaveText('This guide has no answer for that yet.');
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
  await expect(page.locator('#q-where')).toBeVisible(); // the last query is a places question: its note, not a count line
  await expect(page.getByRole('status')).toHaveText('');
});

// The honest reason at Off for what the guide deliberately does not show: every NONE row of the question table that names a note.
const STORY = 'This guide carries no story content, by design.';
const noted = JSON.parse(readFileSync(new URL('../search/questions.json', import.meta.url), 'utf8')).filter((r) => r.note && r.first === 'NONE' && !r.dial);
for (const { q, note } of noted) {
  test(`"${q}" at Off gets the ${note} reason and a way to Topics`, async ({ page }) => {
    await ask(page, q);
    const where = page.locator('#q-where');
    if (note === 'places') {
      await expect(where.locator('.where-off p')).toHaveText('Places are hidden by design. Outside maps exist; they appear here once Places is on.');
      await expect(where.getByRole('link', { name: 'Places: turn them on' })).toHaveAttribute('href', '/places/');
      await expect(page.getByRole('status')).toHaveText('');
    } else {
      await expect(page.getByRole('status')).toHaveText(STORY);
      await expect(where).toBeHidden();
    }
    await expect(results(page).getByRole('link')).toHaveText(['Browse all topics']);
  });
}

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
  expect((await more.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
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
    await expect(results(page).getByRole('link')).toHaveCount(1); // the Topics row only
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

// Known problems: a query with a listed word starts with one real row to /new/; it is the answer when nothing else matches.
const crash = { id: 'crash-widget', question: 'Why does the widget crash?', short: 'Restart it.', topic: 'fixes', consoles: 'all', rank: 1 };
const KNOWN_ROW = { name: 'Known problems and what changed' };
test.describe('known problems', () => {
  for (const query of ['known bugs', 'known problems', 'any issues at launch', 'is it broken', 'are there glitches', 'is the game down', 'server outage', 'not working error']) {
    test(`"${query}" leads to the known-problems list: one 48px row, no no-answer line`, async ({ page }) => {
      await page.route('**/search/none.json', (route) => route.fulfill({ json: [crash] }));
      await ask(page, query);
      const links = results(page).getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links.first()).toHaveAttribute('href', '/new/');
      await expect(links.first()).toHaveText(KNOWN_ROW.name);
      expect((await links.first().boundingBox()).height).toBeGreaterThanOrEqual(47.5);
      expect(await links.first().evaluate((a) => getComputedStyle(a, '::after').content)).not.toBe('none'); // the chevron: it is a row you can tap
      await expect(page.getByRole('status')).toHaveText('');
      await expect(page.getByRole('status')).not.toHaveAttribute('data-floor');
      await expect(page.getByText('This guide has no answer for that yet.')).toHaveCount(0);
      if (test.info().project.use.hasTouch) expect((await measure(page)).problems).toEqual([]);
    });
  }

  test('real answer matches follow the row; Show more moves focus past it', async ({ page }) => {
    await page.route('**/search/none.json', (route) => route.fulfill({ json: [crash, ...many] }));
    await ask(page, 'widget crash bug');
    await expect(results(page).getByRole('link')).toHaveText([KNOWN_ROW.name, `${crash.question}${crash.short}`]);
    await expect(page.getByRole('status')).toHaveText('1 answer');
    await ask(page, 'rotate widget broken');
    const links = results(page).getByRole('link');
    await expect(links).toHaveCount(6); // the row and five answers
    await expect(links.first()).toHaveAttribute('href', '/new/');
    await press(page.getByRole('button', { name: 'Show more' }));
    await expect(links).toHaveCount(9);
    await expect(links.nth(6)).toBeFocused();
  });

  test('a crash question without a listed word is unchanged: the crash answer first, no known-problems row', async ({ page }) => {
    await page.route('**/search/none.json', (route) => route.fulfill({ json: [crash] }));
    await ask(page, 'my game keeps crashing');
    await expect(results(page).getByRole('link')).toHaveAttribute('href', '/a/crash-widget/');
    await expect(results(page).locator('a[href="/new/"]')).toHaveCount(0);
  });
});

// A console's name lists that console's answers (tagged first, then by rank); the other console's too when the player asks for it.
const consoleIndex = [
  { id: 'size', question: 'How big is the install?', short: 'Big.', topic: 'setup', consoles: 'all', forConsoles: ['ps5', 'xbox-x', 'xbox-s'], rank: 1 },
  { id: 'xbox-stuck', question: 'Why is my download stuck?', short: 'Wait.', topic: 'fixes', consoles: ['xbox-x', 'xbox-s'], forConsoles: ['xbox-x', 'xbox-s'], rank: 4 },
  { id: 'xbox-space', question: 'How do I free space?', short: 'Delete.', topic: 'fixes', consoles: ['xbox-x', 'xbox-s'], forConsoles: ['xbox-x', 'xbox-s'], rank: 3 },
  { id: 'ps5-space', question: 'How do I free space on the drive?', short: 'Delete.', topic: 'fixes', consoles: ['ps5'], forConsoles: ['ps5'], rank: 2 },
  { id: 'save', question: 'How do I save?', short: 'Press.', topic: 'saving', consoles: 'all', forConsoles: [], rank: 5 },
];
test.describe('a console name', () => {
  test.beforeEach(({ page }) => page.route('**/search/none.json', (route) => route.fulfill({ json: consoleIndex })));
  const hrefs = (page) => results(page).getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));

  for (const query of ['xbox', 'x box', 'xbox series', 'series x', 'sx']) {
    test(`"${query}" with Series X chosen lists its answers, tagged first`, async ({ page }) => {
      await saved(page, { console: 'xbox-x' });
      await ask(page, query);
      await expect(page.getByRole('status')).toHaveText('3 answers');
      await expect(page.getByRole('status')).not.toHaveAttribute('data-floor');
      expect(await hrefs(page)).toEqual(['/a/xbox-space/', '/a/xbox-stuck/', '/a/size/']);
    });
  }
  test('"playstation" with Series X chosen lists the PS5 answers, each linking as normal', async ({ page }) => {
    await saved(page, { console: 'xbox-x' });
    await ask(page, 'ps 5');
    expect(await hrefs(page)).toEqual(['/a/ps5-space/', '/a/size/']);
  });
  test('with no console chosen any named console works', async ({ page }) => {
    await ask(page, 'xbox');
    expect(await hrefs(page)).toEqual(['/a/xbox-space/', '/a/xbox-stuck/', '/a/size/']);
  });
  test('a console name with other words keeps the ordinary search', async ({ page }) => {
    await saved(page, { console: 'xbox-x' });
    await ask(page, 'xbox download stuck');
    expect(await hrefs(page)).toEqual(['/a/xbox-stuck/']);
  });
});

test('the built index says which consoles each answer speaks to, and "xbox" finds the Xbox answer with Series S chosen', async ({ page }) => {
  const rows = await (await page.request.get('/search/none.json')).json();
  expect(rows.every((r) => Array.isArray(r.forConsoles))).toBe(true);
  expect(rows.find((r) => r.id === 'find-xbox').forConsoles).toEqual(['xbox-x', 'xbox-s']);
  await saved(page, { console: 'xbox-s' });
  await ask(page, 'xbox');
  await expect(results(page).locator('a[href="/a/find-xbox/"]')).toHaveCount(1);
  await expect(results(page).locator('a[href="/a/find-ps5/"]')).toHaveCount(0);
});
