import { test, expect } from '@playwright/test';

// Fix round 4, item 16 (a fresh-eyes read): a screen named in words on About is a link to it.
// Everything runs against the local build: nothing here reaches the live site or /api/progress.

test('About: the Places page and the Checklist are named as links, not only in words', async ({ page }) => {
  await page.goto('/about/');
  const prose = page.locator('main .prose');
  await expect(prose.getByRole('link', { name: 'Places page' })).toHaveAttribute('href', '/places/');
  const checklist = prose.getByRole('link', { name: 'Checklist', exact: true });
  await expect(checklist).toHaveCount(2); // "The Checklist says whether the last sync worked" and "On the Checklist screen"
  for (const link of await checklist.all()) await expect(link).toHaveAttribute('href', '/checklist/');
});

test('the settings sheet says what each level holds in the words of the dial rule', async ({ page }) => {
  await page.goto('/');
  await page.locator('.chip--dial').click();
  const levels = page.locator('#settings .levels');
  await expect(levels).toContainText('the basics: setup, settings, controls, saving, fixes');
  await expect(levels).toContainText('adds where things are');
  await expect(levels).toContainText("adds how the game's systems work in play");
  await expect(levels).not.toContainText('teaches every player');
  await expect(levels).not.toContainText('rather find out by playing');
});
