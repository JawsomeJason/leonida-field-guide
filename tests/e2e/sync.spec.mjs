import { test, expect } from '@playwright/test';
import { emptyTicks, mergeTicks } from '../../src/lib/merge.js';
import { setDial } from './helpers.mjs';

// /api/progress is stubbed with the real merge, so no network and no token: the owner's real record is never
// touched. `mode` says how the stub answers; `puts` keeps every body the page sent; `answer` overrides the reply.
function stubbed() {
  const server = { state: emptyTicks(), mode: 'ok', puts: [], answer: null };
  server.attach = (context) =>
    context.route('**/api/progress', async (route) => {
      if (server.mode === 'abort') return route.abort('internetdisconnected');
      if (server.mode === '500') return route.fulfill({ status: 500, json: { error: 'down' } });
      if (route.request().method() === 'PUT') {
        server.puts.push(route.request().postDataJSON());
        server.state = mergeTicks(server.state, route.request().postDataJSON());
      }
      return route.fulfill({ status: 200, json: server.answer ?? server.state });
    });
  return server;
}

// An answer from an old server (or a bad one): settings that must change nothing on this device.
const polluted = (items = {}) => ({
  v: 2,
  settings: { dial: { value: 'mild', at: 4e12 }, console: { value: 'xbox-s', at: 4e12 }, theme: { value: 'night', at: 4e12 }, stage: { value: 'week-1', at: 4e12 } },
  items,
});
const html = (page) => page.evaluate(() => ({ ...document.documentElement.dataset }));

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const status = (page) => page.getByRole('status').filter({ hasText: /synced|saved on this device only/ });

// Opens the checklist and returns its first to-do (the fixture content always has some).
async function firstBox(page) {
  await page.goto('/checklist/');
  await expect(page.locator('input[data-todo]').first()).toBeVisible();
  return page.locator('input[data-todo]').first();
}
const tick = async (box) => box.locator('xpath=ancestor::label').tap();

test('a tick made in one browser appears in a second after reload', async ({ browser }) => {
  const server = stubbed();
  const a = await browser.newContext(phone);
  const b = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  await server.attach(a);
  await server.attach(b);
  const pa = await a.newPage();
  const box = await firstBox(pa);
  await tick(box);
  await expect(box).toBeChecked();
  await expect.poll(() => JSON.stringify(server.state)).toContain('"done":true'); // the tick reached the server, not just the page-load sync

  const pb = await b.newPage();
  await firstBox(pb);
  await pb.reload();
  await expect(pb.locator('input[data-todo]').first()).toBeChecked();
  await expect(status(pb)).toContainText('Ticks synced');
  await a.close();
  await b.close();
});

for (const mode of ['500', 'abort']) {
  test(`with the endpoint failing (${mode}) ticks persist and the line says saved on this device only`, async ({ browser }) => {
    const server = stubbed();
    server.mode = mode;
    const ctx = await browser.newContext(phone);
    await server.attach(ctx);
    const page = await ctx.newPage();
    const box = await firstBox(page);
    if (mode === 'abort') await ctx.setOffline(true);
    await tick(box);
    await expect(box).toBeChecked();
    await expect(status(page)).toHaveText('Ticks saved on this device only');
    expect(await page.evaluate(() => localStorage.getItem('lfg:v1'))).toContain('"done":true');

    if (mode === '500') {
      await page.reload();
      await expect(page.locator('input[data-todo]').first()).toBeChecked(); // survived the reload with the server down
      await expect(status(page)).toHaveText('Ticks saved on this device only');
    }

    // The server comes back: the retry copies the tick up without another action from the player.
    server.mode = 'ok';
    await ctx.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(status(page)).toContainText('Ticks synced');
    expect(JSON.stringify(server.state)).toContain('"done":true');
    await ctx.close();
  });
}

test('settings are never sent: every PUT body is ticks only, even after the dial, console and theme change', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await setDial(page, 'Mild');
  for (const input of ['console][value=xbox-s', 'theme][value=night']) await page.locator(`input[name=${input}]`).evaluate((el) => el.click());
  await expect.poll(() => html(page)).toMatchObject({ dial: 'mild', console: 'xbox-s' });
  await tick(box);
  await expect.poll(() => JSON.stringify(server.state)).toContain('"done":true');
  expect(server.puts.length).toBeGreaterThan(0);
  for (const body of server.puts) {
    expect(Object.keys(body).sort()).toEqual(['items', 'v']);
    expect(body.v).toBe(3);
    expect(JSON.stringify(body)).not.toMatch(/settings|dial|console|theme|stage|mild|xbox|night|week-1/);
  }
  // The settings stayed on the device.
  expect(await page.evaluate(() => localStorage.getItem('lfg:v1'))).toContain('"mild"');
  await ctx.close();
});

test('a setting changed on its own does not start a sync', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  await firstBox(page);
  await expect(status(page)).toContainText('Ticks synced'); // the page-load sync
  const before = server.puts.length;
  await setDial(page, 'Places');
  await page.waitForTimeout(1200); // well past the 400 ms debounce
  expect(server.puts.length).toBe(before);
  await ctx.close();
});

test('a server answer that carries settings changes nothing locally, and its ticks still arrive', async ({ browser }) => {
  const server = stubbed();
  server.answer = polluted({ 'first-thing': { done: true, at: 1 } });
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  await firstBox(page);
  await expect(status(page)).toContainText('Ticks synced');
  expect(await html(page)).toMatchObject({ dial: 'off' });
  expect(await html(page)).not.toHaveProperty('theme');
  expect(await html(page)).not.toHaveProperty('console'); // never chosen on this device, whatever the server holds
  const local = await page.evaluate(() => localStorage.getItem('lfg:v1'));
  expect(local ?? '').not.toMatch(/mild|xbox-s|night|week-1/);
  // The same with a v3 answer that has a settings key added.
  server.answer = { v: 3, settings: polluted().settings, items: {} };
  await page.reload();
  expect(await html(page)).toMatchObject({ dial: 'off' });
  await ctx.close();
});

test('a new device starts with the dial at Off, whatever the server holds', async ({ browser }) => {
  const server = stubbed();
  server.answer = polluted();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
  await expect.poll(() => server.puts.length).toBeGreaterThan(0); // the sync ran
  expect(await html(page)).toMatchObject({ dial: 'off' });
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
  await ctx.close();
});

test('an older local record keeps its settings and its ticks on the device, and only the ticks sync', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  await ctx.addInitScript(() => localStorage.getItem('lfg:v1') ?? localStorage.setItem('lfg:v1', JSON.stringify({ console: 'xbox-x', dial: 'places', theme: 'night', stage: 'day-1', done: ['first-thing'] })));
  const page = await ctx.newPage();
  await page.goto('/checklist/');
  expect(await html(page)).toMatchObject({ dial: 'places', console: 'xbox-x', theme: 'night' });
  await expect.poll(() => JSON.stringify(server.state)).toContain('first-thing');
  expect(JSON.stringify(server.puts)).not.toMatch(/places|xbox|night|day-1/);
  await ctx.close();
});

test('lowering the dial removes that tier from the offline cache; turning it on caches it again', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  const cached = () => page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)))).flat());
  const hidden = (paths, tier) => paths.filter((p) => p.startsWith(`/${tier}/`) || p.startsWith(`/h/${tier}/`));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(async () => (await cached()).includes('/__lfg-ready')).toBe(true);
  expect(hidden(await cached(), 'places')).toEqual([]); // the default cache holds no hidden tier

  await setDial(page, 'Mild');
  await expect.poll(async () => hidden(await cached(), 'mild').length).toBeGreaterThan(0);
  expect(hidden(await cached(), 'places').length).toBeGreaterThan(0);

  await setDial(page, 'Places'); // Mild lowered to Places
  await expect.poll(async () => hidden(await cached(), 'mild')).toEqual([]);
  expect(hidden(await cached(), 'places').length).toBeGreaterThan(0);

  await setDial(page, 'Off'); // Places lowered to Off
  await expect.poll(async () => hidden(await cached(), 'places')).toEqual([]);
  expect((await cached()).includes('/')).toBe(true); // default pages stay

  await setDial(page, 'Mild');
  await expect.poll(async () => hidden(await cached(), 'mild').length).toBeGreaterThan(0);
  await ctx.close();
});

test('the About page says what is true about saving and privacy', async ({ page }) => {
  await page.goto('/about/');
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(text).toContain("ticked to-dos are copied to this site's own private store");
  expect(text).toMatch(/spoiler setting, console, theme and stage stay on this device/);
  expect(text).toMatch(/every new device starts with spoilers off/);
  expect(text).toMatch(/no analytics/i);
  expect(text).toMatch(/one cookie is the sign-in cookie/);
  expect(text).not.toMatch(/no cookies|settings are saved on this device only/i);
});
