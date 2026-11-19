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

test('hidden details open as their own pages', async ({ page }) => {
  await page.goto('/a/sample-02/');
  await expect(page.getByText('Wombat note one')).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
  await expect(page).toHaveURL(/\/mild\/sample-02\/$/);
  await expect(page.getByText('Wombat note one')).toBeVisible();
});

test('the places gate is a plain link to the places pages', async ({ page }) => {
  await page.goto('/places/');
  await expect(page.getByText('quokka marker', { exact: false })).toHaveCount(0);
  await press(page.getByRole('link', { name: 'Show places' }));
  await expect(page.getByRole('heading', { name: 'Where is the quokka marker?' })).toBeVisible();
});

test('the device theme still applies', async ({ browser }, info) => {
  for (const [colorScheme, bg] of [['dark', NIGHT], ['light', DAY]]) {
    const context = await browser.newContext({ ...info.project.use, colorScheme });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', bg);
    await context.close();
  }
});
