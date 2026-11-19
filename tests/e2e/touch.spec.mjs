import { test, expect } from '@playwright/test';
import { SCREENS, saved, measure, press, setDial } from './helpers.mjs';

const screens = [...SCREENS, '/a/sample-04/', '/a/sample-05/', '/places/list/'];
// Every screen is measured twice: as a first-time visitor sees it, and with a console chosen, everything shown and every fold open.
const states = [
  { name: 'first run', settings: {} },
  { name: 'Xbox S, all shown, folds open', settings: { console: 'xbox-s', dial: 'mild' }, unfold: true },
];

for (const path of screens) {
  for (const state of states) {
    test(`every hit area on ${path} (${state.name}) is 48px with 8px clear`, async ({ page }) => {
      await saved(page, state.settings);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      if (state.unfold) await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const { problems, smallest } = await measure(page);
      test.info().annotations.push({ type: 'smallest', description: `${path}|${state.name}|${smallest}` });
      expect(problems).toEqual([]);
    });
  }
}

for (const path of ['/', '/checklist/', '/a/sample-04/']) {
  test(`the open settings sheet on ${path} holds to the same rules`, async ({ page }) => {
    await saved(page, { console: 'ps5' });
    await page.goto(path);
    await press(page.locator(path === '/checklist/' ? '.chip--dial' : '.chip--console'));
    await expect(page.locator('#settings')).toBeVisible();
    const { problems, smallest } = await measure(page);
    test.info().annotations.push({ type: 'smallest', description: `${path}|settings sheet open|${smallest}` });
    expect(problems).toEqual([]);
  });
}

// The measuring itself must catch what the first version of this test let through.
test('the measure catches a 24px box inside a larger label, and rows with no gap', async ({ page }) => {
  await page.setContent(`<style>li{list-style:none;margin:0}label{display:flex;align-items:center;gap:8px;height:48px;padding:0 8px}
    .a li:first-child label{height:30px} input{width:24px;height:24px;margin:0} ul{padding:0;margin:0}</style>
    <ul class="a"><li><label><input type="checkbox">short row</label></li><li><label><input type="checkbox">touching row</label></li></ul>
    <p style="margin-top:60px"><span style="display:block;width:24px;height:24px"><a href="#x" style="display:block;width:24px;height:24px">x</a></span></p>`);
  const { problems } = await measure(page);
  expect(problems.some((p) => /hit area of \d+x30/.test(p)), problems.join('\n')).toBe(true); // the first label is 30px tall, whatever the checkbox is
  expect(problems.some((p) => /px apart/.test(p)), problems.join('\n')).toBe(true); // two labels with no gap
  expect(problems.some((p) => /hit area of 2[45]x2[45]/.test(p)), problems.join('\n')).toBe(true); // a bare 24px link
});

test('the device has no hover, and hovering changes nothing a player sees', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
  for (const path of ['/', '/topics/']) {
    await page.goto(path);
    await page.mouse.move(0, 0);
    const before = await page.screenshot({ fullPage: true, animations: 'disabled' });
    const links = page.locator('main a[href]:visible, .nav a:visible');
    for (let i = 0; i < Math.min(await links.count(), 8); i++) {
      await links.nth(i).hover();
      await page.evaluate(() => scrollTo(0, 0)); // hover scrolls the link into view; the sticky header would sit lower in the capture
      const after = await page.screenshot({ fullPage: true, animations: 'disabled' });
      expect(Buffer.compare(before, after), `hovering link ${i} on ${path} changed the page`).toBe(0);
    }
  }
});

test('every control is a plain tap away: dial, theme, search, tick', async ({ page }) => {
  await page.goto('/');
  await setDial(page, 'Mild');
  await expect(page.locator('.chip--dial')).toHaveAccessibleName('Spoilers: Mild, change');
  await press(page.getByRole('checkbox', { name: 'Do sample thing 01' }));
  await expect(page.getByRole('checkbox', { name: 'Do sample thing 01' })).toBeChecked();
  await press(page.getByRole('searchbox'));
  await expect(page.getByRole('searchbox')).toBeFocused();
});
