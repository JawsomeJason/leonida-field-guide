import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';

// What's new: never only "nothing has changed". With no confirmed problems it says so plainly and links the crash answer.
for (const width of [320, 390]) {
  test(`the New screen says plainly that no problems are confirmed and links the crash answer at ${width} wide`, async ({ page }) => {
    // Never touch the owner's real progress record.
    await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/new/');

    await expect(page.getByRole('heading', { name: 'Known problems' })).toBeVisible();
    await expect(page.getByText('No game-wide problems are confirmed yet')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/nothing has changed/i);

    const link = page.getByRole('link', { name: 'What to do if the game crashes' });
    await expect(link).toHaveAttribute('href', '/a/crashes-and-launch-problems/');
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
