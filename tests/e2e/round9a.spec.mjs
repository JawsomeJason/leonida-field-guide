import { test, expect } from '@playwright/test';
import { slowProxy, slowCpu } from './slow4g.mjs';

// Fix round 9, item 1: a page the player has opened works offline within a second or two of the first visit.
// Slow 4G (150 ms, 1.6 Mbps, shared by the page and the service worker) and a 4x slower CPU, the local gate-less build, no live site;
// /api/progress is answered by the local server. The round 8 worker registered after load + 3 s + idle and cached the whole site inside
// install, so at 3 seconds there was no worker and every reopen below was the browser's error page.
const WITHIN = 3000;
let proxy;
test.beforeAll(async ({ baseURL }) => void (proxy = await slowProxy(baseURL)));
test.afterAll(() => proxy.close());

async function visit(browser) {
  const { viewport, hasTouch, isMobile } = test.info().project.use;
  const context = await browser.newContext({ baseURL: proxy.url, viewport, hasTouch, isMobile });
  const page = await context.newPage();
  await slowCpu(context, page);
  return { context, page, t0: Date.now() };
}
const waitUntilElapsed = (page, t0, ms) => page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
/** Reopens each path with the network cut: it must be the guide's own page, its scripts included, with the offline note, never the browser's error page. */
async function reopen(page, context, paths) {
  const lost = [];
  page.on('requestfailed', (r) => r.url().includes('/_astro/') && lost.push(r.url()));
  for (const path of paths) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await expect(page.locator('h1').first(), path).toBeVisible();
    await expect(page.locator('body')).not.toContainText('No internet');
    // Chromium reports navigator.onLine true in a document opened under emulated offline; a real device says false. Flip the emulation so the page hears it.
    await context.setOffline(false);
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'You are offline. Pages you have opened still work' }), path).toBeVisible();
  }
  expect(lost, 'every script of an opened page is on the device').toEqual([]);
}

test('three pages opened in the first 3 seconds, then the network cut: all three and the home screen open offline', async ({ browser }) => {
  const { context, page, t0 } = await visit(browser);
  await page.goto('/');
  await page.goto('/topics/');
  await page.goto('/checklist/');
  await waitUntilElapsed(page, t0, WITHIN);
  await context.setOffline(true);
  await reopen(page, context, ['/', '/topics/', '/checklist/', '/']);
  await context.close();
});

test('the worker is registered, active and in control of the page within 3 seconds of the first visit', async ({ browser }) => {
  const { context, page } = await visit(browser);
  await page.addInitScript(() => navigator.serviceWorker?.addEventListener('controllerchange', () => (window.__controlled = Math.round(performance.now()))));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__controlled), { timeout: WITHIN }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__controlled), 'ms after navigation start').toBeLessThan(WITHIN);
  // The shell is in the cache by then; the rest of the site follows in the background and never held activation up.
  const held = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat());
  expect(held).toContain('/');
  expect(held.some((p) => p.startsWith('/_astro/'))).toBe(true);
  await context.close();
});

test('a detail revealed online inside the first seconds opens again offline, and a detail never revealed says it cannot load', async ({ browser }) => {
  const { context, page, t0 } = await visit(browser);
  await page.goto('/');
  await page.goto('/a/sample-02/');
  // The tap goes through the worker once it is in control (a human is slower than the first second).
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const show = page.locator('.reveal[data-tier="mild"] .reveal__btn');
  await show.click();
  await expect(page.getByText('Wombat note one')).toBeVisible();
  await page.goto('/a/loss-01/'); // opened, but its detail never revealed
  await waitUntilElapsed(page, t0, WITHIN);
  await context.setOffline(true);
  await reopen(page, context, ['/a/sample-02/']);
  await page.locator('.reveal[data-tier="mild"] .reveal__btn').click();
  await expect(page.getByText('Wombat note one')).toBeVisible();
  // A detail that was never revealed is not on the device: the note says so, in place.
  await reopen(page, context, ['/a/loss-01/']);
  await page.locator('.reveal__btn').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'cannot load without a connection' })).toBeVisible();
  await context.close();
});

test('the rest of the default site is filled in the background once the player rests, and hidden files are never part of it', async ({ browser }) => {
  const { context, page } = await visit(browser);
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => { for (const k of await caches.keys()) if (await (await caches.open(k)).match('/__lfg-ready')) return true; return false; }), { timeout: 20_000 }).toBe(true);
  const held = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat());
  expect(held).toContain('/about/');
  expect(held.filter((p) => /^\/(places|mild|h)\//.test(p))).toEqual([]);
  await context.close();
});
