import { test, expect } from '@playwright/test';
import { empty, merge } from '../../src/lib/merge.js';

// /api/progress is stubbed with the real merge, so no network and no token. `mode` says how the stub answers.
function stubbed() {
  const server = { state: empty(), mode: 'ok' };
  server.attach = (context) =>
    context.route('**/api/progress', async (route) => {
      if (server.mode === 'abort') return route.abort('internetdisconnected');
      if (server.mode === '500') return route.fulfill({ status: 500, json: { error: 'down' } });
      if (route.request().method() === 'PUT') server.state = merge(server.state, route.request().postDataJSON());
      return route.fulfill({ status: 200, json: server.state });
    });
  return server;
}

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const status = (page) => page.getByRole('status').filter({ hasText: /Synced|Saved on this device only/ });

// Opens the checklist and returns its first to-do. A build with no to-do records has nothing to tick: skip, say so.
async function firstBox(page) {
  await page.goto('/checklist/');
  test.skip(!(await page.locator('input[data-todo]').count()), 'no to-do records in this build');
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
  await expect(status(pb)).toContainText('Synced');
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
    await expect(status(page)).toHaveText('Saved on this device only');
    expect(await page.evaluate(() => localStorage.getItem('lfg:v1'))).toContain('"done":true');

    if (mode === '500') {
      await page.reload();
      await expect(page.locator('input[data-todo]').first()).toBeChecked(); // survived the reload with the server down
      await expect(status(page)).toHaveText('Saved on this device only');
    }

    // The server comes back: the retry copies the tick up without another action from the player.
    server.mode = 'ok';
    await ctx.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(status(page)).toContainText('Synced');
    expect(JSON.stringify(server.state)).toContain('"done":true');
    await ctx.close();
  });
}
