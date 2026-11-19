import { test, expect } from '@playwright/test';
import { press, openFold } from './helpers.mjs';

// "Next up" (spec "Screens"): under the search, before "Most asked", the next two unticked steps of the stored stage for the console.
// Fixture order for the first stage: 01, 05, 13, 17, then the step for one console only.
const strip = (page) => page.locator('.next-up');
const rows = (page) => strip(page).locator('.next-up__list a').allInnerTexts();
const count = (page) => strip(page).locator('.next-up__count');
// `saved` re-seeds on every load; here a later visit must see what the earlier one stored, so seed once per tab.
const saved = (page, settings) => page.addInitScript((s) => { if (!sessionStorage.seeded) { sessionStorage.seeded = 1; localStorage.setItem('lfg:v1', JSON.stringify(s)); } }, settings);
const done = (...ids) => ({ done: ids });

test('shows the next two unticked steps and how many are done, each a 48px link to its answer', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  expect(await rows(page)).toEqual(['Do sample thing 01', 'Do sample thing 05']);
  await expect(count(page)).toContainText('0 of 5 done');
  await expect(count(page)).toHaveAttribute('href', '/checklist/');
  await expect(strip(page).getByRole('link', { name: 'Do sample thing 01' })).toHaveAttribute('href', '/a/sample-01/');
  for (const link of await strip(page).locator('a').all()) expect((await link.boundingBox()).height, await link.innerText()).toBeGreaterThanOrEqual(47.5);
});

test('sits under the search and before Most asked, on the first screen', async ({ page }) => {
  await saved(page, { console: 'xbox-s' });
  await page.goto('/');
  const y = async (loc) => (await loc.boundingBox()).y;
  const search = await y(page.getByRole('searchbox'));
  const next = await y(strip(page));
  const most = await y(page.getByRole('heading', { name: 'Most asked' }));
  expect(search).toBeLessThan(next);
  expect(next).toBeLessThan(most);
  const box = await strip(page).boundingBox();
  expect(box.y + box.height, 'the whole strip is on the first screen').toBeLessThan(page.viewportSize().height);
});

test('skips what is ticked: the next steps move on, and the count follows', async ({ page }) => {
  await saved(page, { console: 'ps5', ...done('sample-01') });
  await page.goto('/');
  expect(await rows(page)).toEqual(['Do sample thing 05', 'Do sample thing 13']);
  await expect(count(page)).toContainText('1 of 5 done');
});

test('ticking a step in the stage list below updates it at once', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  await openFold(page);
  await press(page.getByRole('checkbox', { name: 'Do sample thing 01' }));
  expect(await rows(page)).toEqual(['Do sample thing 05', 'Do sample thing 13']);
  await expect(count(page)).toContainText('1 of 5 done');
  await page.reload(); // and it is still so on the next visit
  expect(await rows(page)).toEqual(['Do sample thing 05', 'Do sample thing 13']);
});

test('a tick made on the checklist shows on the next visit', async ({ page }) => {
  await saved(page, { console: 'xbox-x' });
  await page.goto('/checklist/');
  await press(page.getByRole('checkbox', { name: 'Do sample thing 01' }));
  await page.goto('/');
  expect(await rows(page)).toEqual(['Do sample thing 05', 'Do sample thing 13']);
});

test('follows the stored stage', async ({ page }) => {
  await saved(page, { console: 'ps5', stage: 'day-1' });
  await page.goto('/');
  expect(await rows(page)).toEqual(['Do sample thing 07', 'Do sample thing 11']);
  await expect(count(page)).toContainText('0 of 3 done');
});

test('a step for one console only shows for that console', async ({ context }) => {
  for (const [console, step] of [['ps5', 'Do the PS5 only sample step'], ['xbox-x', 'Do the Xbox only sample step']]) {
    const page = await context.newPage(); // a fresh tab, so it seeds again
    await saved(page, { console, ...done('sample-01', 'sample-05', 'sample-13') });
    await page.goto('/');
    expect(await rows(page), console).toEqual(['Do sample thing 17', step]);
  }
});

test('with every step ticked it says so and still opens the checklist', async ({ page }) => {
  await saved(page, { console: 'ps5', ...done('sample-01', 'sample-05', 'sample-13', 'sample-17', 'console-ps5') });
  await page.goto('/');
  expect(await rows(page)).toEqual(['All done in this stage. See the checklist']);
  await expect(count(page)).toContainText('5 of 5 done');
});

test('on a never-chosen device the console prompt is where the strip would be, and choosing swaps them', async ({ page }) => {
  await page.goto('/');
  await expect(strip(page)).toBeHidden();
  const prompt = page.locator('.console-card');
  await expect(prompt.getByRole('button')).toHaveCount(3);
  // The prompt comes first: under the search, before Most asked.
  const y = async (loc) => (await loc.boundingBox()).y;
  expect(await y(prompt)).toBeGreaterThan(await y(page.getByRole('searchbox')));
  expect(await y(prompt)).toBeLessThan(await y(page.getByRole('heading', { name: 'Most asked' })));
  await press(prompt.getByRole('button', { name: 'Xbox Series S', exact: true }));
  await expect(prompt).toBeHidden();
  await expect(strip(page)).toBeVisible();
  expect(await rows(page)).toEqual(['Do sample thing 01', 'Do sample thing 05']);
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });
  test('the strip shows the first two steps that fit every console, each a link', async ({ page }) => {
    await page.goto('/');
    expect(await rows(page)).toEqual(['Do sample thing 01', 'Do sample thing 05']);
    await expect(count(page)).toHaveAttribute('href', '/checklist/');
  });
});

test('at 130% text on a phone the first Next up row is still fully above the bottom bar, even when a step title wraps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await saved(page, { console: 'xbox-s' });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  // Real step titles are longer than the fixtures': this one takes two lines at this size.
  await page.evaluate(() => { for (const a of document.querySelectorAll('.next-up__list a')) a.textContent = 'Redeem the code from your boxed copy, then update the console'; });
  const first = await strip(page).locator('.next-up__list a').first().boundingBox();
  const bar = await page.locator('.nav').boundingBox();
  expect(bar.y, 'the bottom bar is at the bottom').toBeGreaterThan(600);
  expect(first.y + first.height, 'the first row ends above the bottom bar').toBeLessThanOrEqual(bar.y);
});
