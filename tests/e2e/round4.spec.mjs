import { test, expect } from '@playwright/test';
import { PAGES, OLD_ADDRESSES, records, saved } from './helpers.mjs';
import { mapsLine, mapsOffLine } from '../../src/data/outside-maps.js';

// Fix round 4, items 1, 7, 10 and 14: outside map links, empty topics, two columns, old addresses.
const LINE = 'We do not control these sites. On 19 November 2026 at least one showed story content by default, so set its own spoiler option before you look.';
const OFF = 'Outside maps exist; they appear here once Places is on.';
const MAPS = 'a[href*="gtamap"]:visible, a[href*="fullsweep"]:visible';
const WHERE = 'where is the gun shop';

test('the one shared line and the no-link sentence are the ones the owner gave', () => {
  expect(mapsLine).toBe(LINE);
  expect(mapsOffLine).toBe(OFF);
});

const noMapAnywhere = async (page, label) => {
  for (const path of ['/', '/places/', '/topics/places/']) {
    await page.goto(path);
    if (path === '/') {
      await page.getByRole('searchbox').fill(WHERE).catch(() => {}); // no script: no search box to type in
    }
    await expect(page.locator(MAPS), `${label} ${path}`).toHaveCount(0);
    const text = await page.locator('main').innerText();
    expect(text, `${label} ${path}`).not.toMatch(/gtamap|fullsweep|story content by default/i);
  }
};

test('at Off no map link or site name shows on Ask, the where-is note or the Places gate; the gate says outside maps exist', async ({ page }) => {
  await noMapAnywhere(page, 'Off');
  for (const path of ['/places/', '/topics/places/']) {
    await page.goto(path);
    await expect(page.locator('.gate').getByText(OFF)).toBeVisible();
  }
});

test.describe('without script (the dial is unknown)', () => {
  test.use({ javaScriptEnabled: false });
  test('no map link shows, and the gate says outside maps exist', async ({ page }) => {
    await noMapAnywhere(page, 'no script');
    await page.goto('/places/');
    await expect(page.locator('.gate').getByText(OFF)).toBeVisible();
  });
});

for (const dial of ['places', 'mild']) {
  test(`at ${dial} the map links and the one dated line show: Places gate, topic page and the where-is note`, async ({ page }) => {
    await saved(page, { dial });
    for (const path of ['/places/', '/topics/places/']) {
      await page.goto(path);
      const box = page.locator('.maps');
      await expect(box.getByRole('link', { name: /gtamap\.io/ })).toHaveAttribute('href', 'https://gtamap.io');
      await expect(box.getByRole('link', { name: /FullSweep/ })).toHaveAttribute('href', 'https://fullsweepmap.com');
      await expect(box.locator('.maps__line')).toHaveText(LINE);
      await expect(page.locator('.gate')).toBeHidden();
    }
    await page.goto('/');
    await page.getByRole('searchbox').fill(WHERE);
    const note = page.locator('#q-where');
    await expect(note.getByRole('link', { name: /gtamap\.io/ })).toBeVisible();
    await expect(note.getByRole('link', { name: /FullSweep/ })).toBeVisible();
    await expect(note.locator('.maps__line')).toHaveText(LINE);
    await expect(note.locator('.where-off')).toBeHidden();
  });
}

test('the dial moves the map links in and out without a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill(WHERE);
  await expect(page.locator(MAPS)).toHaveCount(0);
  await page.evaluate(() => (document.documentElement.dataset.dial = 'places')); // what settings.js sets on a change
  await expect(page.locator(MAPS)).toHaveCount(2);
  await page.evaluate(() => (document.documentElement.dataset.dial = 'off'));
  await expect(page.locator(MAPS)).toHaveCount(0);
});

// The false promise: no page says an outside site hides spoilers.
test('no page says an outside site hides spoilers', async ({ page }) => {
  const found = [];
  for (const path of PAGES) {
    const html = await (await page.request.get(path)).text();
    if (/hides? spoilers|spoilers (are )?hidden by default|default-on spoiler/i.test(html)) found.push(path);
  }
  expect(found).toEqual([]);
});

// ---- Item 7: Topics ----
const row = (page, name) => page.locator('.tiles li:visible').filter({ hasText: name });

test('a topic whose answers all sit at Mild is a quiet row, not a link, at Off and Places; a link with a count at Mild', async ({ page }) => {
  for (const dial of ['off', 'places']) {
    await saved(page, { dial });
    await page.goto('/topics/');
    const r = row(page, 'Getting around');
    await expect(r).toHaveText(/Hidden until Mild/);
    await expect(r.getByRole('link')).toHaveCount(0);
    await expect(r.locator('svg')).toHaveCount(0);
    await expect(r).not.toContainText(/0 answers|No answers/);
  }
  await saved(page, { dial: 'mild' });
  await page.goto('/topics/');
  const r = row(page, 'Getting around');
  await expect(r.getByRole('link')).toHaveAttribute('href', '/topics/getting-around/');
  await expect(r).toContainText('1 answer');
  await expect(r.locator('svg')).toBeVisible();
});

test('the count on a tile is what the dial shows; with no script it is the default count', async ({ page, browser }) => {
  const cases = [['off', '3 answers'], ['places', '3 answers'], ['mild', '4 answers']];
  for (const [dial, text] of cases) {
    await saved(page, { dial });
    await page.goto('/topics/');
    await expect(row(page, 'Settings')).toContainText(text);
  }
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const p = await plain.newPage();
  await p.goto('http://127.0.0.1:' + (process.env.LFG_PORT ?? 4399) + '/topics/');
  await expect(p.locator('.tiles li:visible').filter({ hasText: 'Settings' })).toContainText('3 answers');
  await expect(p.locator('.tiles li:visible').filter({ hasText: 'Getting around' })).toContainText('Hidden until Mild');
  await plain.close();
});

test('every row that opens something ends in the chevron, and no row says 0 answers', async ({ page }) => {
  for (const dial of ['off', 'mild']) {
    await saved(page, { dial });
    await page.goto('/topics/');
    const links = page.locator('.tiles a:visible');
    for (const a of await links.all()) await expect(a.locator('svg')).toBeVisible();
    expect(await page.locator('.tiles').innerText()).not.toMatch(/\b0 answers/);
  }
});

test('the cheat sheet of an all-hidden topic says which level holds its answers, until the dial reaches it', async ({ page }) => {
  await page.goto('/topics/getting-around/');
  await expect(page.locator('.topic-hidden')).toHaveText('The answers on this topic are hidden until the spoiler setting is Mild.');
  await expect(page.getByText('No answers here yet.')).toHaveCount(0);
  await saved(page, { dial: 'mild' });
  await page.goto('/topics/getting-around/');
  await expect(page.locator('.topic-hidden')).toBeHidden();
});

test('a search with no answer carries no hint that hidden answers exist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('zzyzx qqqq');
  await expect(page.locator('#q-status')).toHaveText('This guide has no answer for that yet.');
  await expect(page.locator('search').getByText(/Mild/)).toHaveCount(0); // the settings sheet names the levels; the search area does not
});

test('a search for "map" points to Places, not Mild', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('map');
  const note = page.locator('#q-where');
  await expect(note).toBeVisible();
  await expect(note.getByRole('link', { name: /Places/ })).toHaveAttribute('href', '/places/');
  await expect(page.locator('search').getByText(/Mild/)).toHaveCount(0);
});

// ---- Item 10: Topics in two columns where there is room ----
test('Topics sits in two columns from 64rem and one below it', async ({ page }) => {
  await page.goto('/topics/');
  const boxes = await page.locator('.tiles li:visible').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().toJSON()));
  const wide = page.viewportSize().width >= 1024;
  if (wide) {
    expect(boxes[1].x, 'second row beside the first').toBeGreaterThan(boxes[0].x + boxes[0].width - 1);
    expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(2);
    const last = await page.locator('.tiles').evaluate((el) => el.getBoundingClientRect().right);
    expect(last, 'the right half is used').toBeGreaterThan(page.viewportSize().width * 0.6);
  } else {
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[1].x).toBeCloseTo(boxes[0].x, 0);
  }
});

// ---- Item 14: old addresses ----
test('every hidden-tier record keeps its old /a/ address: a redirect to its gate, holding none of its text', async ({ page }) => {
  expect(OLD_ADDRESSES.length).toBeGreaterThan(1);
  for (const old of OLD_ADDRESSES) {
    const rec = records.find((a) => `/a/${a.id}/` === old);
    const gate = `/${rec.tier}/${rec.id}/`;
    const res = await page.request.get(old);
    expect(res.status(), old).toBe(200);
    const html = await res.text();
    expect(html, old).toContain(`url=${gate}`);
    expect(html, `${old} must not point at the explicit address`).not.toContain('/show/');
    for (const t of [rec.question, rec.short, rec.body, ...(rec.keywords ?? [])].filter(Boolean)) expect(html, `${old} holds hidden text`).not.toContain(t);
    await page.goto(old);
    await expect(page, old).toHaveURL(new RegExp(`${gate}$`));
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(rec.question);
  }
});

test('a default-tier record keeps its own /a/ page, not a redirect', async ({ page }) => {
  for (const a of records.filter((r) => r.tier === 'none').slice(0, 3)) expect(await (await page.request.get(`/a/${a.id}/`)).text()).not.toContain('Redirecting');
});
