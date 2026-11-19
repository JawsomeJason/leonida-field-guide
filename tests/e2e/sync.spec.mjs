import { test, expect } from '@playwright/test';
import { emptyTicks, mergeTicks } from '../../src/lib/merge.js';
import { setDial } from './helpers.mjs';

// /api/progress is stubbed with the real merge, so no network and no token: the owner's real record is never
// touched. `mode` says how the stub answers; `puts` keeps every body the page sent; `answer` overrides the reply.
function stubbed() {
  const server = { state: emptyTicks(), mode: 'ok', puts: [], gets: 0, answer: null };
  server.attach = (context) =>
    context.route('**/api/progress', async (route) => {
      if (server.mode === 'abort') return route.abort('internetdisconnected');
      if (server.mode === '500') return route.fulfill({ status: 500, json: { error: 'down' } });
      if (server.mode === '404') return route.fulfill({ status: 404, body: 'Not found' }); // a build with no sync endpoint
      if (server.mode === 'hang') return; // never answers
      if (route.request().method() === 'GET') server.gets++;
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
// The three things the status line may say, in the words a player reads (the line is one role=status region).
const SYNCED = /^Synced at .+: your ticks are saved on this device and in this site's private store\.$/;
const KEPT = 'Could not reach the sync store. Your ticks are kept on this device for now and will be sent later.';
const NOT_HERE = 'Syncing is not available here. Your ticks are saved on this device only.';
const status = (page) => page.locator('[data-sync]');

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
  await expect(status(pb)).toHaveText(SYNCED);
  await a.close();
  await b.close();
});

for (const mode of ['500', 'abort']) {
  test(`with the endpoint failing (${mode}) ticks persist and the line says the store could not be reached`, async ({ browser }) => {
    const server = stubbed();
    server.mode = mode;
    const ctx = await browser.newContext(phone);
    await server.attach(ctx);
    const page = await ctx.newPage();
    const box = await firstBox(page);
    if (mode === 'abort') await ctx.setOffline(true);
    await tick(box);
    await expect(box).toBeChecked();
    await expect(status(page)).toHaveText(KEPT);
    expect(await page.evaluate(() => localStorage.getItem('lfg:v1'))).toContain('"done":true');

    if (mode === '500') {
      await page.reload();
      await expect(page.locator('input[data-todo]').first()).toBeChecked(); // survived the reload with the server down
      await expect(status(page)).toHaveText(KEPT);
    }

    // The server comes back: the retry copies the tick up without another action from the player.
    server.mode = 'ok';
    await ctx.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(status(page)).toHaveText(SYNCED);
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
  await expect(status(page)).toHaveText(SYNCED); // the page-load sync
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
  await expect(status(page)).toHaveText(SYNCED);
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
  await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
  await expect.poll(() => server.gets).toBeGreaterThan(0); // the sync ran
  expect(await html(page)).toMatchObject({ dial: 'off' });
  await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Off, change');
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

test('About: "Turning the spoiler setting down removes the hidden pages from that copy" (lowering the dial clears that tier; turning it on caches it again)', async ({ browser }) => {
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

// The status line: each state says exactly what is happening, in one calm line.
test('status line, synced: the store answered, so the line says the ticks are on this device and in the private store', async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  await stubbed().attach(ctx);
  const page = await ctx.newPage();
  await firstBox(page);
  await expect(status(page)).toHaveText(SYNCED);
  await expect(status(page)).toHaveAttribute('role', 'status');
  await ctx.close();
});

test('status line, could not reach: a 500 and an unreachable store both say ticks are kept here and will be sent later', async ({ browser }) => {
  for (const mode of ['500', 'abort']) {
    const server = stubbed();
    server.mode = mode;
    const ctx = await browser.newContext(phone);
    await server.attach(ctx);
    const page = await ctx.newPage();
    await firstBox(page);
    await expect(status(page)).toHaveText(KEPT);
    await ctx.close();
  }
});

test('status line, not available: a build with no sync endpoint says syncing is not available and does not keep trying', async ({ browser }) => {
  const server = stubbed();
  server.mode = '404';
  let asked = 0;
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  ctx.on('request', (r) => r.url().includes('/api/progress') && asked++);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await expect(status(page)).toHaveText(NOT_HERE);
  await page.waitForTimeout(2500); // a failing store is retried with backoff from 2 s; a missing one is not
  expect(asked).toBe(1);
  await tick(box);
  await expect(box).toBeChecked(); // ticking still works, on this device
  await expect(status(page)).toHaveText(NOT_HERE);
  await ctx.close();
});

test('status line, script off: the line says syncing is not available, and no state is claimed while script waits for the store', async ({ browser }) => {
  const off = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await off.newPage();
  await nojs.goto('/checklist/');
  await expect(status(nojs)).toHaveText(NOT_HERE);
  await off.close();

  const server = stubbed();
  server.mode = 'hang';
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  await firstBox(page);
  await page.waitForTimeout(800);
  await expect(status(page)).toBeHidden(); // script runs, the store has not answered: no claim either way
  await ctx.close();
});

// Reads before writes.
test('a page load with nothing changed sends a read and no write; one tick sends exactly one write', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await expect(status(page)).toHaveText(SYNCED);
  expect(server.gets).toBe(1);
  expect(server.puts).toEqual([]);
  await page.reload();
  await expect(status(page)).toHaveText(SYNCED);
  expect(server.puts).toEqual([]); // still nothing to say
  await tick(box);
  await expect.poll(() => server.puts.length).toBe(1);
  await page.waitForTimeout(1000);
  expect(server.puts.length).toBe(1);
  await page.reload(); // the server now holds the tick: the read finds nothing to add
  await expect(status(page)).toHaveText(SYNCED);
  expect(server.puts.length).toBe(1);
  await ctx.close();
});

test('a tick this device holds and the server lacks is written once on the next load', async ({ browser }) => {
  const server = stubbed();
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  await ctx.addInitScript(() => localStorage.getItem('lfg:v1') ?? localStorage.setItem('lfg:v1', JSON.stringify({ v: 2, settings: {}, items: { 'first-thing': { done: true, at: 5 } } })));
  const page = await ctx.newPage();
  await page.goto('/checklist/');
  await expect(status(page)).toHaveText(SYNCED);
  expect(server.gets).toBe(1);
  expect(server.puts.length).toBe(1);
  await ctx.close();
});

// About and Checklist: one test per group of sentences about storage, cookies and sync.
const bytes = (text) => Buffer.from(text, 'base64url').toString();

test('About: "Nothing here is tracked: no analytics, no ads, no accounts" (every request on every screen goes to this site)', async ({ page, baseURL }) => {
  const hosts = new Set();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  for (const path of ['/', '/topics/', '/a/sample-02/', '/checklist/', '/new/', '/about/', '/places/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect([...hosts]).toEqual([new URL(baseURL).host]);
});

test('About: "The only cookies are the sign-in cookie and a spoiler-level cookie that holds just the word off, places or mild"', async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  await stubbed().attach(ctx);
  const page = await ctx.newPage();
  await firstBox(page);
  for (const level of ['Places', 'Mild', 'Off']) {
    await setDial(page, level);
    const cookies = await ctx.cookies();
    expect(cookies.map((c) => c.name)).toEqual(['lfg_dial']); // the sign-in cookie is set by the live site's gate, not by the pages
    expect(cookies[0].value).toBe(level.toLowerCase());
    expect(cookies[0].domain.startsWith('.')).toBe(false); // no Domain attribute: sent to this site only
    expect(await page.evaluate(() => document.cookie)).toBe(`lfg_dial=${level.toLowerCase()}`);
  }
  await ctx.close();
});

test('About: "This device keeps your settings and ticks in the browser\'s storage" (one key, settings and ticks, nothing else)', async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  await stubbed().attach(ctx);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await setDial(page, 'Places');
  await tick(box);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['lfg:v1']);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('lfg:v1')));
  expect(saved.settings.dial.value).toBe('places');
  expect(Object.values(saved.items).some((i) => i.done)).toBe(true);
  await ctx.close();
});

test('About: "It also keeps a copy of the guide\'s pages, so they work offline"', async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  await stubbed().attach(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length > 0 && Boolean(await caches.match('/about/')))).toBe(true);
  await ctx.setOffline(true);
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About this guide');
  await ctx.close();
});

test('About: "Nothing else is sent" and "settings stay on this device, so every new device starts with spoilers off" (the saved ticks are the only body)', async ({ browser }) => {
  const server = stubbed();
  server.answer = polluted({ 'first-thing': { done: true, at: 1 } });
  const ctx = await browser.newContext(phone);
  await server.attach(ctx);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await expect(status(page)).toHaveText(SYNCED);
  await setDial(page, 'Mild');
  await tick(box);
  await expect.poll(() => server.puts.length).toBeGreaterThan(0);
  for (const body of server.puts) expect(Object.keys(body).sort()).toEqual(['items', 'v']);
  const fresh = await browser.newContext(phone);
  await server.attach(fresh);
  const other = await fresh.newPage();
  await other.goto('/');
  await expect(other.locator('.chip--dial')).toHaveText('Spoilers: Off', { useInnerText: true });
  await ctx.close();
  await fresh.close();
});

test('Checklist: "The code is text that holds your ticks only ... Copying it sends it nowhere by itself"', async ({ browser }) => {
  const ctx = await browser.newContext(phone);
  await stubbed().attach(ctx);
  const page = await ctx.newPage();
  const box = await firstBox(page);
  await setDial(page, 'Mild');
  await tick(box);
  await page.getByText('Back up or move your progress').click();
  const code = await page.locator('#export-code').inputValue();
  const body = JSON.parse(bytes(code));
  expect(Object.keys(body).sort()).toEqual(['items', 'v']); // ticks only: no dial, console, theme or stage
  expect(JSON.stringify(body)).not.toMatch(/mild|settings|dial|console|theme|stage/);
  const note = page.locator('#backup').getByText(/is text that holds your ticks only/);
  await expect(note).toContainText('Copying it sends it nowhere by itself');
  await expect(note).not.toContainText('stays on this device');
  await page.waitForTimeout(600);
  let sent = 0;
  ctx.on('request', () => sent++);
  await page.locator('#copy-code').click();
  await expect(page.locator('#export-note')).not.toBeEmpty();
  await page.waitForTimeout(800);
  expect(sent).toBe(0); // copying makes no request at all
  await ctx.close();
});

test('Checklist: "Ticks from the code are now on this device" (a restore adds ticks and keeps the ones already here)', async ({ browser }) => {
  const a = await browser.newContext(phone);
  await stubbed().attach(a);
  const pa = await a.newPage();
  const box = await firstBox(pa);
  await tick(box);
  await pa.getByText('Back up or move your progress').click();
  const code = await pa.locator('#export-code').inputValue();
  const b = await browser.newContext(phone);
  await stubbed().attach(b);
  const pb = await b.newPage();
  await firstBox(pb);
  await pb.getByText('Back up or move your progress').click();
  await pb.locator('#import-code').fill(code);
  await pb.locator('#import-go').click();
  await expect(pb.locator('#import-note')).toHaveText('Ticks from the code are now on this device.');
  await expect(pb.locator('input[data-todo]').first()).toBeChecked();
  await a.close();
  await b.close();
});

test('About: no claim about what any outside site does, and no map link at Off', async ({ page }) => {
  await page.goto('/about/');
  const main = page.locator('main');
  const hrefs = await main.locator('a[href^="http"]').evaluateAll((as) => as.map((a) => new URL(a.href).host));
  expect(hrefs).toEqual(['support.rockstargames.com']);
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/hide spoilers|spoilers are hidden by default|hidden by default/i);
  expect(text).toMatch(/Outside map sites exist.* links appear on the Places page once the spoiler setting is Places or higher\. At Off no map link is shown/);
  expect(await main.getByText(/gtamap|fullsweep/i).count()).toBe(0);
});
