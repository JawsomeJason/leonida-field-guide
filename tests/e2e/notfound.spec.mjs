import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saved, measure, press } from './helpers.mjs';

const GONE = '/zzz-not-a-page/';

test('an unknown path gets the themed page: 404 status, header, tab bar, links to Ask and Topics', async ({ page }) => {
  const res = await page.goto(GONE);
  expect(res.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("That page isn't here");
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Ask a question' })).toHaveAttribute('href', '/');
  await expect(main.getByRole('link', { name: 'Browse topics' })).toHaveAttribute('href', '/topics/');
  await press(main.getByRole('link', { name: 'Browse topics' }));
  await expect(page).toHaveURL(/\/topics\/$/);
});

for (const theme of ['day', 'night']) {
  test(`the not-found page in ${theme}: no axe violations, every target 48px with 8px clear`, async ({ page }) => {
    await saved(page, { theme, console: 'ps5' });
    await page.goto(GONE);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    expect((await measure(page)).problems).toEqual([]);
  });
}

test('the not-found page does not scroll sideways from 320 up', async ({ page }) => {
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(GONE);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflow at ${width}`).toBeLessThanOrEqual(0);
  }
});
