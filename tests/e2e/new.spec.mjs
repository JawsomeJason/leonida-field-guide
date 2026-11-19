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
    // The line is a claim: it says when it was checked (the date of the answer that carries its sources) and links that answer.
    await page.goto('/a/crashes-and-launch-problems/');
    const checked = await page.locator('.facts time').innerText();
    await page.goBack();
    await expect(page.getByText(`We checked on ${checked}`)).toBeVisible();
    // Known problems is the first section; what changed follows it.
    expect(await page.locator('main h2').first().innerText()).toBe('Known problems');
    await expect(page.locator('main h2').nth(1)).toHaveText(/\d{4}/);
    await expect(page.locator('main')).not.toContainText(/nothing has changed/i);

    const link = page.getByRole('link', { name: 'What to do if the game crashes' });
    await expect(link).toHaveAttribute('href', '/a/crashes-and-launch-problems/');
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

// Round 5: the screen leads with known problems, then at most three plain lines per date, with nothing about the site's own fixes.
test('the New screen leads with known problems, shows at most three lines per date and no word about the site\'s own fixes', async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
  await page.goto('/new/');
  expect(await page.locator('main h2').first().innerText()).toBe('Known problems');
  const dates = page.locator('section.entry').filter({ has: page.locator('time') }).filter({ hasNot: page.getByRole('heading', { name: 'Known problems' }) });
  expect(await dates.count()).toBeLessThanOrEqual(3);
  for (const d of await dates.all()) {
    const lines = await d.locator('li').allInnerTexts();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(l).toMatch(/^(New answer|Corrected|Checked on)/);
  }
  await expect(page.locator('main')).not.toContainText(/\b(fixed|bug|button|wording|layout|colou?r|design|the site)\b/i);
});
