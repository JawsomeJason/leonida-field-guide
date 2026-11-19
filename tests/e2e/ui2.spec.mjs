import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS, saved, press } from './helpers.mjs';

const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });

// ---- Reduced motion ----
// Every element and pseudo-element on a screen, as "tag.class(pseudo): property" for each duration that is not 0s.
const motion = () => {
  const bad = [];
  const check = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo);
    for (const prop of ['transition-duration', 'animation-duration']) {
      if (cs.getPropertyValue(prop).split(',').some((v) => parseFloat(v) !== 0)) bad.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''} ${prop}: ${cs.getPropertyValue(prop)}`);
    }
  };
  for (const el of document.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after', ...(el.matches(':popover-open') ? ['::backdrop'] : [])]) check(el, pseudo);
  return { bad, animations: document.getAnimations().length };
};
// Is a cross-document @view-transition (navigation: auto) in force for this device? Rules inside a media query count only when it matches.
const viewTransition = () => {
  const walk = (rules) => [...rules].some((r) => (r.cssText.startsWith('@view-transition') ? /navigation:\s*auto/.test(r.cssText) : r.media ? matchMedia(r.media.mediaText).matches && walk(r.cssRules) : r.cssRules ? walk(r.cssRules) : false));
  return [...document.styleSheets].some((sheet) => walk(sheet.cssRules));
};

test('reduced motion: no transition or animation runs anywhere, and pages do not transition', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await saved(page, { console: 'ps5' });
  for (const path of [...SCREENS, '/a/sample-04/', '/places/list/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    const { bad, animations } = await page.evaluate(motion);
    expect(bad, `${path} has motion`).toEqual([]);
    expect(animations, `${path} runs animations`).toBe(0);
    expect(await page.evaluate(viewTransition), `${path} has a page transition`).toBe(false);
  }
  await page.goto('/');
  await press(page.locator('.chip--dial')); // the open sheet and its scrim too
  await expect(page.locator('#settings')).toBeVisible();
  expect((await page.evaluate(motion)).bad).toEqual([]);
});

test('with no motion preference the motion is still there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  expect(await page.evaluate(viewTransition), 'a page transition').toBe(true);
  expect(await page.locator('.nav a').first().evaluate((a) => getComputedStyle(a).transitionDuration)).toContain('0.16s');
});

// ---- Offline line ----
test('an offline device shows a calm status line, and online it is hidden', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const note = page.getByRole('status').filter({ hasText: 'offline' });
  await expect(note).toBeHidden();
  await context.setOffline(true);
  await expect(note).toBeVisible();
  await expect(note).toContainText('You are offline');
  await context.setOffline(false);
  await expect(note).toBeHidden();
});

// ---- Checklist rows, and the Ask rows they match ----
for (const path of ['/checklist/', '/']) {
  test(`${path}: the tick row and the arrow are two targets with 16px between, and the arrow has no word`, async ({ page }) => {
    await saved(page, { console: 'ps5' });
    await page.goto(path);
    const row = page.locator('.todo-list .todo:visible, .todos .todo:visible').first();
    const tick = row.locator('label');
    const open = row.locator('a.todo__open');
    const [t, o] = [await box(tick), await box(open)];
    // sub-pixel layout can give 47.9999: half a pixel of slack
    expect(t.h, 'the tick row').toBeGreaterThanOrEqual(47.5);
    expect(o.w).toBeGreaterThanOrEqual(47.5);
    expect(o.h).toBeGreaterThanOrEqual(47.5);
    expect(o.x - t.r, 'between the tick row and the arrow').toBeGreaterThanOrEqual(16);
    expect((await open.innerText()).trim(), 'an arrow, not the word Answer').toBe('');
    await expect(open).toHaveAccessibleName(/^Open (the )?answer/);
    // The 16px between them belongs to neither (a tap is judged by what is under it; touch screens still snap a near miss to the closer one).
    const y = t.y + t.h / 2;
    for (let x = t.r + 1; x < o.x; x += 3) {
      expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('label, a, input') ?? null, [x, y]), `a tap at x=${x} in the gap`).toBeNull();
    }
    // A tap on the row's text ticks it.
    await press(row.locator('label span'));
    await expect(row.getByRole('checkbox')).toBeChecked();
    // Rows sit 8px apart.
    // The label is the tick target: the rows are plain (hairline) rows, so the 8px sits inside each row as the label's margin.
    const rows = await page.locator('.todo-list .todo:visible label, .todos .todo:visible label').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).slice(0, 3));
    for (let i = 1; i < rows.length; i++) expect(rows[i].top - rows[i - 1].bottom).toBeGreaterThanOrEqual(8);
  });
}

test('the backup code is described as ticks only', async ({ page }) => {
  await page.goto('/checklist/');
  const text = await page.locator('.backup__body').textContent();
  expect(text).toContain('ticks only');
  expect(text).not.toMatch(/to-dos and settings/);
});

// ---- Wording and the search count ----
test('the Places gate and a closed hidden page tell the player what to open', async ({ page }) => {
  await page.goto('/places/');
  const gate = await page.locator('.gate').innerText();
  expect(gate).toContain('Places are off.');
  expect(gate).toContain('choose Places');
  await page.goto('/places/list/');
  const closed = await page.locator('.guard').innerText();
  expect(closed).toContain('choose Places');
  expect(closed).not.toContain('dial, at the top');
});

test('a "where is" search shows the places note and no answer count above it', async ({ page }) => {
  await page.goto('/');
  const status = page.locator('#q-status');
  await page.getByRole('searchbox').fill('thing 07');
  await expect(status).toHaveText(/\d+ answers?/);
  await page.getByRole('searchbox').fill('where is sample thing 07');
  await expect(page.locator('#q-where')).toBeVisible();
  await expect(status).toHaveText('');
});

// ---- A page for another console ----
const pageFor = async (page, console, path) => {
  await saved(page, console ? { console } : {});
  await page.goto(path);
};
const cases = [
  ['/a/console-ps5/', 'xbox-x', 'PS5', '/a/console-xbox/'],
  ['/a/console-ps5/', 'xbox-s', 'PS5', '/a/console-xbox/'],
  ['/a/console-xbox/', 'ps5', 'Xbox', '/a/console-ps5/'],
  ['/a/find-ps5/', 'xbox-x', 'PS5', '/a/find-xbox/'],
  ['/a/find-xbox/', 'ps5', 'Xbox', '/a/find-ps5/'],
];
for (const [path, owned, whom, other] of cases) {
  test(`${path} opened on ${owned}: one line, the matching page, the rest folded`, async ({ page }) => {
    await pageFor(page, owned, path);
    const note = page.locator('.other-note:visible');
    await expect(note).toHaveCount(1);
    await expect(note.getByRole('heading', { level: 1 })).toContainText(`This page is for ${whom}`);
    await expect(note.getByRole('link')).toHaveAttribute('href', other);
    expect((await box(note.getByRole('link'))).h).toBeGreaterThanOrEqual(47.5);
    const fold = page.locator('details.other-fold');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.getByRole('heading', { level: 1 })).toBeHidden();
    await expect(fold.locator(':scope > summary')).toHaveText(`Show the ${whom} version`);
    expect((await box(fold.locator(':scope > summary'))).h).toBeGreaterThanOrEqual(47.5);
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
    await press(fold.locator(':scope > summary'));
    await expect(fold.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

for (const [path, owned] of [['/a/console-ps5/', ''], ['/a/console-ps5/', 'ps5'], ['/a/console-xbox/', 'xbox-s'], ['/a/sample-04/', 'xbox-x']]) {
  test(`${path} for ${owned || 'a never-chosen console'} has no note and no fold`, async ({ page }) => {
    await pageFor(page, owned, path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.other-note:visible, .other-fold > summary:visible')).toHaveCount(0);
  });
}

test('changing console on a single-console page folds and unfolds it', async ({ page }) => {
  await pageFor(page, 'ps5', '/a/console-ps5/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await press(page.locator('.chip--console'));
  await press(page.locator('#settings').getByRole('radio', { name: 'Xbox X', exact: true }));
  await expect(page.locator('details.other-fold h1')).toBeHidden();
  await press(page.locator('.chip--console'));
  await press(page.locator('#settings').getByRole('radio', { name: 'PS5', exact: true }));
  await expect(page.locator('details.other-fold h1')).toBeVisible();
});
