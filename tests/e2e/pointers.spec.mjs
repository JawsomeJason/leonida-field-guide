import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { saved } from './helpers.mjs';

// A pointer in an answer's text is a link, and the link is the one for the player's console (spec "First content", Pointers).
// Never touch the owner's real progress record.
test.beforeEach(async ({ page }) => page.route('**/api/progress', (route) => route.fulfill({ json: empty() })));

for (const [console, href, hidden] of [['ps5', '/a/console-ps5/', '/a/console-xbox/'], ['xbox-x', '/a/console-xbox/', '/a/console-ps5/'], ['xbox-s', '/a/console-xbox/', '/a/console-ps5/']]) {
  test(`the body's "short of room" sentence links the page for ${console} and shows no other`, async ({ page }) => {
    await saved(page, { v: 2, settings: { console: { value: console, at: 1 } }, items: {} });
    await page.goto('/a/pointer-body/');
    const link = page.getByRole('link', { name: 'How to clear space' });
    await expect(link).toHaveCount(1); // the other console's link is display:none, so it is not in the accessibility tree
    await expect(link).toHaveAttribute('href', href);
    await expect(page.locator(`.prose a[href="${hidden}"]`)).toBeHidden();
    await expect(page.locator('.prose')).toContainText('Short of room?');
  });
}

test('before a console is chosen no console-only link shows, and the sentence that always applies still does', async ({ page }) => {
  await page.goto('/a/pointer-body/');
  await expect(page.getByRole('link', { name: 'How to clear space' })).toHaveCount(0);
  await expect(page.locator('.prose')).toContainText('Check your free space, then clear the difference.');
});
