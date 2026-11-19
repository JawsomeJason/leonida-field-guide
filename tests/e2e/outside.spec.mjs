import { test, expect } from '@playwright/test';
import { PAGES, saved, press } from './helpers.mjs';

const NOTE = 'Links go to other sites, which may contain spoilers.';

// Item: one note per list of outside links, not one on every link (spec "Links out").
test('every list of outside links carries the note once, and nothing links out without it nearby', async ({ page }) => {
  test.setTimeout(120_000);
  const found = [];
  let lists = 0;
  for (const path of PAGES) {
    await page.goto(path);
    const out = await page.evaluate((NOTE) => {
      const bad = [];
      for (const a of document.querySelectorAll('a[href^="http"]')) {
        const text = a.textContent;
        if (a.closest('.prose')) { if (!text.includes('outside site, may contain spoilers')) bad.push(`inline link "${text.trim().slice(0, 30)}" has no marker`); continue; }
        const list = a.closest('[data-outside]');
        if (!list) { bad.push(`link "${text.trim().slice(0, 30)}" is in no outside list`); continue; }
        if (/outside site/i.test(text)) bad.push(`link "${text.trim().slice(0, 30)}" carries its own note`);
        if (!/\S+\.\S+/.test(text)) bad.push(`link "${text.trim().slice(0, 30)}" shows no host`);
      }
      const lists = [...document.querySelectorAll('[data-outside]')];
      for (const l of lists) {
        const notes = [...l.querySelectorAll('.outside-note')];
        if (notes.length !== 1 || notes[0].textContent.trim() !== NOTE) bad.push(`an outside list has ${notes.length} notes`);
        if (!l.querySelector('a[href^="http"]')) bad.push('an outside list has no link');
      }
      return { bad, lists: lists.length };
    }, NOTE);
    lists += out.lists;
    found.push(...out.bad.map((b) => `${path}: ${b}`));
  }
  expect(found).toEqual([]);
  expect(lists, 'answers, the Places gate, the About page and the where-is note all have one').toBeGreaterThan(20);
});

test('the sources block says it once, and the About page and Places gate too', async ({ page }) => {
  await page.goto('/a/sample-02/');
  const sources = page.locator('.facts [data-outside]');
  await expect(sources.getByText(NOTE)).toHaveCount(1);
  await page.goto('/about/');
  await expect(page.locator('main [data-outside]').getByText(NOTE)).toHaveCount(1);
  await expect(page.locator('main a[href^="http"]')).toHaveCount(3);
  await page.goto('/places/');
  await expect(page.locator('main [data-outside]').getByText(NOTE)).toHaveCount(1);
});

// Item 6: a source with a `console` shows for that console; the rest wait under "Other consoles".
const shown = (page) => page.locator('.facts [data-outside] > ul a:visible').allInnerTexts();
test('sources for the other console wait in a fold; with no console chosen all show', async ({ page }) => {
  await page.goto('/a/sample-06/');
  expect((await shown(page)).join('|')).toMatch(/Fixture source.*Fixture PlayStation page.*Fixture Xbox page/s);
  await expect(page.locator('.other-sources')).toBeHidden();

  await saved(page, { console: 'ps5' });
  await page.goto('/a/sample-06/');
  let list = (await shown(page)).join('|');
  expect(list).toContain('Fixture PlayStation page');
  expect(list).not.toContain('Fixture Xbox page');
  const fold = page.locator('.other-sources');
  await expect(fold).toBeVisible();
  await expect(fold).not.toHaveAttribute('open', '');
  await press(fold.locator('summary'));
  await expect(fold.getByRole('link', { name: /Fixture Xbox page/ })).toBeVisible();
  await expect(fold.getByRole('link', { name: /Fixture PlayStation page/ })).toBeHidden();

  for (const console of ['xbox-x', 'xbox-s']) {
    await saved(page, { console });
    await page.goto('/a/sample-06/');
    list = (await shown(page)).join('|');
    expect(list, console).toContain('Fixture Xbox page');
    expect(list, console).not.toContain('Fixture PlayStation page');
    await expect(page.locator('.other-sources summary')).toBeVisible();
  }
});

test('an answer whose sources fit every console has no fold', async ({ page }) => {
  await saved(page, { console: 'xbox-s' });
  await page.goto('/a/sample-02/');
  await expect(page.locator('.other-sources')).toHaveCount(0);
  await expect(page.locator('.facts [data-outside] > ul a')).toHaveCount(1);
});
