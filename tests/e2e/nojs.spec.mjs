import { test, expect } from '@playwright/test';
import { records, press, NIGHT, DAY } from './helpers.mjs';

test.use({ javaScriptEnabled: false });

test('the search floor lists every answer and the links work', async ({ page }) => {
  await page.goto('/');
  const all = page.getByRole('region', { name: 'All answers' });
  await expect(all.getByRole('link')).toHaveCount(records.filter((a) => a.tier === 'none').length);
  await press(all.getByRole('link', { name: /Sample question 07/ }));
  await expect(page.getByRole('heading', { level: 1, name: /Sample question 07/ })).toBeVisible();
});

test('a topic page lists its answers', async ({ page }) => {
  await page.goto('/topics/');
  await press(page.locator('a[href="/topics/setup/"]'));
  await expect(page.getByRole('heading', { level: 2, name: /Sample question 01/ })).toBeVisible();
});

// Hidden pages without script: hidden-gate.spec.mjs.

test('the device theme still applies', async ({ browser }, info) => {
  for (const [colorScheme, bg] of [['dark', NIGHT], ['light', DAY]]) {
    const context = await browser.newContext({ ...info.project.use, colorScheme });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', bg);
    await context.close();
  }
});
