import { test, expect } from '@playwright/test';
import { press, setDial } from './helpers.mjs';

// Fix round 8, item 1: with no network a tap on a hidden detail never leaves the page. It says, inline and in plain words, that the detail
// cannot load without a connection; the control stays; a detail opened online before opens again offline. Everything runs on the local
// fixture build with the service worker active; no live site and no /api/progress call (serve.mjs answers that locally).
const NOTE = 'cannot load without a connection. Once you have opened';
const DETAIL = 'Wombat note one'; // sample-02's mild detail
const REMEDY = 'Wombat remedy one'; // loss-01's mild detail
const cachedPaths = (page) => page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat());

/** Opens the page with the worker in control and the default cache complete, so going offline leaves a working copy. */
async function ready(page, path) {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(async () => (await cachedPaths(page)).includes('/__lfg-ready')).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
/** Nothing replaced the document: it is the same page, with its own heading, not the browser's error page. */
const stayed = async (page, url) => {
  expect(page.url()).toBe(url);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('No internet');
};
const showMild = (page) => page.locator('.reveal[data-tier="mild"] .reveal__btn');

test('(a) offline, the show control on an answer stays on the page, says why inline, and keeps its button; online it works', async ({ page, context }) => {
  await ready(page, '/a/sample-02/');
  const url = page.url();
  await context.setOffline(true);
  await press(showMild(page));
  const note = page.locator('.reveal[data-tier="mild"] [role="status"]');
  await expect(note).toContainText(`This detail ${NOTE}`);
  await expect(note).toContainText('it will work offline');
  await stayed(page, url);
  await expect(showMild(page)).toBeVisible();
  await expect(page.getByText(DETAIL)).toHaveCount(0);
  await press(showMild(page)); // a second tap says it again, never navigates
  await expect(note).toContainText(NOTE);
  expect(page.url()).toBe(url);

  await context.setOffline(false);
  await press(showMild(page));
  await expect(page.getByText(DETAIL)).toBeVisible();
  await expect(note).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('(b) offline, the loss button in a search result card and on the topic card stays in place and says the same', async ({ page, context }) => {
  await ready(page, '/');
  await context.setOffline(true);
  await page.getByRole('searchbox').fill('lose my zorp');
  const card = page.locator('#q-results li.ask-loss').first();
  await expect(card).toBeVisible();
  const url = page.url();
  await press(card.locator('.reveal__btn'));
  await expect(card.getByRole('status')).toContainText(`This detail ${NOTE}`);
  await expect(card.locator('.reveal__btn')).toBeVisible();
  await expect(card.getByText(REMEDY)).toHaveCount(0);
  await stayed(page, url);

  await ready(page, '/topics/money/');
  await context.setOffline(true);
  const topicUrl = page.url();
  const btn = page.locator('.reveal--warn .reveal__btn').first();
  await press(btn);
  await expect(page.locator('.reveal--warn').first().getByRole('status')).toContainText(`This detail ${NOTE}`);
  await expect(btn).toBeVisible();
  await stayed(page, topicUrl);
});

test('(c) dial up while offline: the stored value changes, nothing navigates, and the places list, the gate and the sheet say why in place', async ({ page, context }) => {
  // The Places topic gate: its Show places button sets the dial; the list it would fill cannot load.
  await ready(page, '/topics/places/');
  await context.setOffline(true);
  const url = page.url();
  await press(page.getByRole('button', { name: 'Show places' }));
  await expect(page.locator('#hidden-list').getByRole('status')).toContainText(`These answers ${NOTE}`);
  expect(await page.evaluate(() => document.documentElement.dataset.dial)).toBe('places');
  await stayed(page, url);

  // A hidden page's gate: the dial reaching the tier would forward to the explicit page, which is not on the device. It stays and says so.
  // The stored dial is cleared while still offline: coming back online with it at Places would (rightly) fetch the hidden files at once.
  await page.evaluate(() => localStorage.clear());
  await context.setOffline(false);
  await ready(page, '/places/list/');
  await context.setOffline(true);
  const gate = page.url();
  await setDial(page, 'Places');
  await expect(page.locator('.guard').getByRole('status')).toContainText(`This page ${NOTE}`);
  await expect(page.getByRole('link', { name: 'Show this page' })).toBeVisible();
  await stayed(page, gate);

  // The connection returns: the gate forwards then, as it would have the first time.
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/places\/list\/show\//);
  // The sheet's dial on an answer: set offline, no navigation; the auto-opened detail cannot load, and says so under its control.
  await page.evaluate(() => localStorage.clear());
  await ready(page, '/a/sample-02/');
  await context.setOffline(true);
  const answer = page.url();
  await setDial(page, 'Mild');
  expect(await page.evaluate(() => document.documentElement.dataset.dial)).toBe('mild');
  await expect(page.locator('.reveal[data-tier="mild"]').getByRole('status')).toContainText(`This detail ${NOTE}`);
  await stayed(page, answer);
});

test('(d) a detail opened online opens again offline, from the cache, after a reload', async ({ page, context }) => {
  await ready(page, '/a/sample-02/');
  await press(showMild(page));
  await expect(page.getByText(DETAIL)).toBeVisible();
  await expect.poll(async () => (await cachedPaths(page)).includes('/h/mild/a/sample-02/')).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(DETAIL)).toHaveCount(0); // the page starts closed again
  await press(showMild(page));
  await expect(page.getByText(DETAIL)).toBeVisible();
  await expect(page.locator('.reveal[data-tier="mild"] [role="status"]')).toHaveCount(0);
});

test('(e) lowering the dial removes a detail the player opened with a tap; raising it leaves it', async ({ page }) => {
  await ready(page, '/a/sample-02/');
  await press(showMild(page));
  await expect.poll(async () => (await cachedPaths(page)).includes('/h/mild/a/sample-02/')).toBe(true);
  await setDial(page, 'Places'); // up: stays
  await page.waitForTimeout(500);
  expect(await cachedPaths(page)).toContain('/h/mild/a/sample-02/');
  await setDial(page, 'Off'); // down: every hidden tier that is off goes
  await expect.poll(async () => (await cachedPaths(page)).filter((p) => p.startsWith('/h/')).length).toBe(0);
  await expect(page.getByText(DETAIL)).toHaveCount(0);
});

test('(f) offline, a navigation to a hidden address that is not on the device gets a small notice with a way back and no hidden text', async ({ page, context }) => {
  await ready(page, '/');
  await context.setOffline(true);
  for (const path of ['/mild/sample-02/show/?reveal=1', '/places/list/show/?reveal=1']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Not available offline' })).toBeVisible();
    await expect(page.locator('body')).toContainText(`This page ${NOTE}`);
    await expect(page.getByRole('link', { name: 'Go back to Ask' })).toHaveAttribute('href', '/');
    expect((await page.getByRole('link', { name: 'Go back to Ask' }).boundingBox()).height).toBeGreaterThanOrEqual(47.5);
    expect(await page.locator('body').innerText()).not.toMatch(/wombat|quokka/i); // the fixtures' hidden words
  }
});
