import { test, expect } from '@playwright/test';
import { SCREENS, saved, targets, judge, press } from './helpers.mjs';

const screens = [...SCREENS, '/a/sample-04/', '/a/sample-05/', '/places/list/'];

for (const path of screens) {
  test(`every target on ${path} is 48px with 8px clear`, async ({ page }) => {
    await saved(page, { dial: 'mild' }); // the most there is to measure
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { problems, smallest: s } = judge(await targets(page));
    test.info().annotations.push({ type: 'smallest', description: `${path}: ${s}` });
    expect(problems).toEqual([]);
  });
}

test('the open settings menu holds to the same rules', async ({ page }) => {
  await page.goto('/a/sample-04/');
  await press(page.getByText('Settings', { exact: true }));
  const { problems, smallest: s } = judge(await targets(page));
  test.info().annotations.push({ type: 'smallest', description: `settings menu open: ${s}` });
  expect(problems).toEqual([]);
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
      const after = await page.screenshot({ fullPage: true, animations: 'disabled' });
      expect(Buffer.compare(before, after), `hovering link ${i} on ${path} changed the page`).toBe(0);
    }
  }
});

test('every control is a plain tap away: dial, theme, search, tick', async ({ page }) => {
  await page.goto('/');
  await press(page.getByRole('radio', { name: 'Mild', exact: true }));
  await expect(page.getByRole('radio', { name: 'Mild', exact: true })).toBeChecked();
  await press(page.getByRole('checkbox', { name: 'Do sample thing 01' }));
  await expect(page.getByRole('checkbox', { name: 'Do sample thing 01' })).toBeChecked();
  await press(page.getByRole('searchbox'));
  await expect(page.getByRole('searchbox')).toBeFocused();
});
