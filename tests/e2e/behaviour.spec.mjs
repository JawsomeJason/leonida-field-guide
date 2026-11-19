import { test, expect } from '@playwright/test';
import { ranked, records, press, setDial, setTheme, saved, shown, SCREENS, NIGHT, DAY } from './helpers.mjs';

test.describe('two taps from the home screen', () => {
  for (const a of ranked) {
    test(`#${a.rank} "${a.question}"`, async ({ page }) => {
      await page.goto('/');
      if (a.rank <= 8) {
        await press(page.getByRole('region', { name: 'Most asked' }).getByRole('link', { name: a.question, exact: true }));
        await expect(page.getByRole('heading', { level: 1, name: a.question })).toBeVisible();
      } else {
        await press(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Topics', exact: true }));
        await press(page.locator(`a[href="/topics/${a.topic}/"]`));
        await expect(page.getByRole('heading', { level: 2, name: a.question })).toBeVisible();
        await expect(page.getByText(a.short)).toBeVisible();
      }
    });
  }
});

test('a ticked to-do survives a reload', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('checkbox', { name: 'Do sample thing 01' });
  await expect(box).not.toBeChecked();
  await press(box);
  await expect(box).toBeChecked();
  await page.reload();
  await expect(box).toBeChecked();
  await expect(page.getByText(/^\d+ of \d+ done$/).first()).toBeVisible();
});

test('search finds an answer and takes you to it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('thing 07');
  await press(page.getByRole('search').getByRole('link', { name: /Sample question 07/ }));
  await expect(page.getByRole('heading', { level: 1, name: /Sample question 07/ })).toBeVisible();
});

test('the dial at Off shows no places and at Places shows them', async ({ page }) => {
  await page.goto('/places/');
  await expect(page.getByRole('heading', { name: 'Places are switched off' })).toBeVisible();
  await expect(page.getByText('quokka marker', { exact: false })).toHaveCount(0);
  await page.goto('/topics/');
  await expect(page.locator('a[href="/topics/places/"]').getByText(/Hidden until the spoiler setting is raised to Places/)).toBeVisible();

  await page.goto('/places/');
  await setDial(page, 'Places');
  await expect(page.getByRole('heading', { name: 'Where is the quokka marker?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Places are switched off' })).toBeHidden();
  await page.goto('/topics/');
  await expect(page.locator('a[href="/topics/places/"]').getByText(/Shown, because the spoiler setting/)).toBeVisible();

  await setDial(page, 'Off');
  await expect(page.locator('a[href="/topics/places/"]').getByText(/Hidden until the spoiler setting is raised to Places/)).toBeVisible();
});

test('search shows places only once the dial allows them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('quokka marker');
  const hit = page.getByRole('search').getByRole('link', { name: /quokka marker/i });
  await expect(hit).toHaveCount(0);
  await setDial(page, 'Places');
  await page.getByRole('searchbox').fill('quokka marker x');
  await page.getByRole('searchbox').fill('quokka marker');
  await expect(hit).toBeVisible();
});

test('mild stays hidden until the dial is Mild', async ({ page }) => {
  const mild = page.getByRole('heading', { name: 'What does the wombat switch do?' });
  await page.goto('/topics/settings/');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(mild).toHaveCount(0);
  await setDial(page, 'Places');
  await expect(mild).toHaveCount(0);
  await setDial(page, 'Mild');
  await expect(mild).toBeVisible();
});

test('tap to show opens a hidden detail in place and leaves the dial alone', async ({ page }) => {
  await page.goto('/a/sample-02/');
  const note = page.getByText('Wombat note one');
  await expect(note).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
  await expect(note).toBeVisible();
  await expect(page).toHaveURL(/\/a\/sample-02\/$/);
  await expect(chip(page, 'dial')).toHaveAccessibleName('Spoilers: Off, change');
  await expect(page.getByText('Quokka note one')).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 places detail hidden. Show' }));
  await expect(page.getByText('Quokka note one')).toBeVisible();
  await expect(chip(page, 'dial')).toHaveAccessibleName('Spoilers: Off, change');
});

test('the theme switch works and is remembered', async ({ page }) => {
  await page.goto('/about/');
  await setTheme(page, 'Night');
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await page.goto('/new/');
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await setTheme(page, 'Day');
  await expect(page.locator('body')).toHaveCSS('background-color', DAY);
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', DAY);
});

test('the console switch changes the button names', async ({ page }) => {
  await page.goto('/a/sample-04/');
  const answer = page.locator('.answer__a');
  // What is on screen, not the text of hidden spans: both consoles' names are in the page.
  const shows = (text) => expect.poll(() => answer.innerText()).toContain(text);
  await shows('Press ✕ / A to open the sample menu.'); // nothing chosen yet: both names, with a spaced slash
  await press(page.getByRole('button', { name: 'Xbox Series X', exact: true }));
  await shows('Press A to open the sample menu on this console.');
  await press(page.getByRole('button', { name: 'PS5', exact: true }));
  await shows('Press ✕ to open the sample menu.');
  await setTheme(page, 'Auto'); // opens the menu
  await press(page.getByRole('radio', { name: 'Xbox Series S', exact: true }));
  await shows('Press A to open the sample menu.');
});

test('the checklist and the other tabs are reachable by the bar', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Topics', 'Checklist', 'New', 'Ask']) {
    await press(nav.getByRole('link', { name, exact: true }));
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('no screen logs an error to the console, with everything shown', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await saved(page, { dial: 'mild' });
  for (const path of [...SCREENS, '/a/sample-04/', '/places/list/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});

// ---- Console choice ----
const forConsole = (c) => records.filter((a) => a.tier === 'none' && a.todo && (a.consoles === 'all' || a.consoles.includes(c)));
const consoleScreens = ['/', '/topics/', '/topics/setup/', '/a/sample-04/', '/checklist/'];
// What a player reads: steps, answers and cards. The controls that name every console (header, console buttons) are left out; so is a closed fold.
const seen = async (page) => {
  await page.addStyleTag({ content: '.site-header, .setting, .console-card { display: none !important; }' });
  return page.evaluate(() => document.body.innerText);
};

test('first open: search comes first, then a slim one-row console prompt, and the choice sticks', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Which console do you play on?' });
  await expect(card).toBeVisible();
  const search = await box(page.getByRole('searchbox'));
  const prompt = await box(card);
  expect(search.y, 'search is above the prompt').toBeLessThan(prompt.y);
  expect(prompt.b, 'the prompt is on the first screen').toBeLessThanOrEqual(page.viewportSize().height);
  const buttons = card.getByRole('button');
  await expect(buttons).toHaveCount(3);
  const rows = new Set();
  for (const name of ['PS5', 'Xbox Series X', 'Xbox Series S']) {
    const b = await box(card.getByRole('button', { name, exact: true }));
    expect(b.h, `${name} is a 48px target`).toBeGreaterThanOrEqual(48);
    rows.add(Math.round(b.y));
  }
  expect(rows.size, 'the three buttons share one row').toBe(1);
  expect(prompt.h, 'a slim prompt, not a card').toBeLessThanOrEqual(120);
  await press(card.getByRole('button', { name: 'Xbox Series S', exact: true }));
  await expect(card).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.reload();
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.console)).toBe('xbox-s');
});

// Both consoles' button names show until one is chosen, always with a spaced slash: never "L3LS" or "✕A".
const GLUED = /✕A|○B|□X|△Y|L1LB|R1RB|L2LT|R2RT|L3LS|R3RS|OptionsMenu|CreateView/;
test('button names on a never-chosen device read "L3 / LS", on screen and in search results', async ({ page }) => {
  await page.goto('/a/sample-04/');
  const answer = await page.locator('.answer__a').innerText();
  expect(answer).toContain('✕ / A');
  expect(answer).not.toMatch(GLUED);
  await page.goto('/');
  await page.getByRole('searchbox').fill('sample menu');
  const results = page.locator('#q-results');
  await expect(results).toContainText('✕ / A');
  expect(await results.innerText()).not.toMatch(GLUED);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(GLUED);
});

test('until a console is chosen only every-console steps show, the rest wait in the Other consoles fold', async ({ page }) => {
  for (const path of ['/', '/topics/setup/', '/checklist/']) {
    await page.goto(path);
    const text = await seen(page);
    expect(text, path).not.toContain('PS5 only sample step');
    expect(text, path).not.toContain('Xbox only sample step');
    expect(text, path).toContain('Other consoles');
    await press(page.getByText('Other consoles', { exact: true }).first());
    const fold = page.locator('.other-consoles').first();
    await expect(fold.getByRole('link')).toHaveCount(2);
  }
  await page.goto('/a/sample-04/');
  const text = await page.locator('.answer__a').innerText();
  expect(text).toContain('✕');
  expect(text).toContain('A');
});

for (const [c, label, gone, shown] of [['xbox-x', 'Xbox Series X', /PS5|PlayStation/, 'Xbox only sample step'], ['xbox-s', 'Xbox Series S', /PS5|PlayStation/, 'Xbox only sample step'], ['ps5', 'PS5', /Xbox/, 'PS5 only sample step']]) {
  test(`after choosing ${label}, no screen mentions another console outside the fold`, async ({ page }) => {
    await saved(page, { console: c });
    for (const path of consoleScreens) {
      await page.goto(path);
      const text = await seen(page);
      expect(text, `${path} names another console`).not.toMatch(gone);
    }
    await page.goto('/');
    await expect(page.getByRole('checkbox', { name: shown })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Which console do you play on?' })).toBeHidden();
    // The other console's step is a link in the fold, not a tick box.
    await press(page.getByText('Other consoles', { exact: true }));
    await expect(page.locator('.other-consoles a:visible')).toHaveCount(1);
    await page.goto('/a/sample-04/');
    const answer = await page.locator('.answer__a').innerText();
    if (c === 'ps5') expect(answer).toMatch(/Press ✕ to open the sample menu\.$/);
    else expect(answer).toMatch(/Press A to open the sample menu/);
  });
}

test('progress counts only the steps for the chosen console', async ({ page }) => {
  for (const c of ['ps5', 'xbox-s']) {
    await saved(page, { console: c });
    await page.goto('/checklist/');
    await expect(page.locator('[data-overall] [data-count]')).toHaveText(`0 of ${forConsole(c).length} done`);
  }
});

test('the checklist lists steps in the order the Ask screen does', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  for (const [stage, label] of [['before', 'Before'], ['day-1', 'Day 1']]) {
    await page.goto('/');
    await press(page.getByRole('radio', { name: label, exact: true }));
    const home = await page.locator(`.stage[data-stage="${stage}"] .todo-list .todo:visible label`).allInnerTexts();
    await page.goto('/checklist/');
    const checklist = await page.locator(`section[aria-labelledby="${stage}"] .todo:visible .todo__tick`).allInnerTexts();
    expect(home.length).toBeGreaterThan(1);
    expect(checklist.map((t) => t.trim())).toEqual(home.map((t) => t.trim()));
  }
});

// ---- Header and settings sheet ----
const tapAt = (page, x, y) => (test.info().project.use.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; });
const chip = (page, which = 'console') => page.locator(`.chip--${which}`);
const sheet = (page) => page.locator('#settings');
const rowsOf = (page, ...locators) => Promise.all(locators.map((l) => box(l)));

test('the header is one row: a sun mark, the console chip and a spoiler chip that says the level in words, each with its full name for a screen reader', async ({ page }) => {
  await saved(page, { console: 'xbox-s', dial: 'places' });
  await page.goto('/');
  await expect(chip(page, 'dial')).toHaveAccessibleName('Spoilers: Places, change');
  expect(await shown(chip(page, 'dial')), 'the level word only: short enough for 320px').toBe('Spoilers: Places');
  expect(await shown(chip(page)), 'the short console name').toBe('Series S');
  await expect(chip(page)).toHaveAccessibleName('Console: Xbox Series S, change');
  const [mark, c, d] = await rowsOf(page, page.locator('.site-name'), chip(page), chip(page, 'dial'));
  expect(new Set([mark, c, d].map((r) => Math.round(r.y))).size, 'one row').toBe(1);
  expect(c.h).toBeGreaterThanOrEqual(48);
  expect(d.h).toBeGreaterThanOrEqual(48);
  await expect(page.getByRole('link', { name: 'Leonida Field Guide' })).toBeVisible(); // the mark is named, whether or not its text shows
  for (const level of ['mild', 'off']) {
    await setDial(page, level === 'mild' ? 'Mild' : 'Off');
    await expect(chip(page, 'dial')).toHaveAccessibleName(`Spoilers: ${level === 'mild' ? 'Mild' : 'Off'}, change`);
  }
});

test('the header and the bottom bar take at most a fifth of a phone screen, also at 130% text', async ({ page }) => {
  await page.goto('/');
  const { width, height } = page.viewportSize();
  const chrome = async () => (await box(page.locator('.site-header'))).h + (await box(page.locator('.nav'))).h;
  if (width < 600) expect(await chrome(), 'header plus bottom bar').toBeLessThanOrEqual(height * 0.2);
  else expect((await box(page.locator('.site-header'))).h, 'the header alone').toBeLessThanOrEqual(height * 0.2);
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  if (width < 600) expect(await chrome(), 'at 130% text').toBeLessThanOrEqual(height * 0.2);
  else expect((await box(page.locator('.site-header'))).h, 'at 130% text').toBeLessThanOrEqual(height * 0.2);
});

test('the header stays on screen while you scroll, with the console and the level in reach', async ({ page }) => {
  await saved(page, { console: 'xbox-s' });
  await page.goto('/checklist/');
  await page.evaluate(() => scrollTo(0, 600));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect((await box(page.locator('.site-header'))).y).toBe(0);
  await expect(chip(page)).toHaveAccessibleName('Console: Xbox Series S, change');
  await setDial(page, 'Places');
  await expect(chip(page, 'dial')).toHaveAccessibleName('Spoilers: Places, change');
});

test('every screen names the console in use and the spoiler level in the header', async ({ page }) => {
  for (const [c, name] of [['ps5', 'PS5'], ['xbox-x', 'Xbox Series X'], ['xbox-s', 'Xbox Series S']]) {
    await saved(page, { console: c });
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(chip(page), path).toHaveAccessibleName(`Console: ${name}, change`);
      await expect(chip(page, 'dial'), path).toHaveAccessibleName('Spoilers: Off, change');
    }
  }
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  expect(await shown(chip(page)), 'never chosen: it asks').toBe('Choose');
  await expect(chip(page)).toHaveAccessibleName('Console: choose one, change');
});

test('either chip opens the sheet, with a scrim behind it, and it closes on Escape, the scrim, a choice and Done', async ({ page }) => {
  await page.goto('/about/');
  const open = async (which) => { await press(chip(page, which)); await expect(sheet(page)).toBeVisible(); };
  await open('console');
  const vh = page.viewportSize().height;
  await expect.poll(async () => Math.round((await box(sheet(page))).b), 'it settles at the bottom of the screen, in thumb reach').toBe(vh);
  const s = await box(sheet(page));
  const scrim = await page.evaluate(() => getComputedStyle(document.querySelector('#settings'), '::backdrop').backgroundColor);
  expect(scrim, 'a scrim behind the sheet').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();

  await open('dial');
  const h = await box(page.locator('.site-header'));
  await tapAt(page, 4, Math.round((h.b + s.y) / 2)); // the scrim above the sheet
  await expect(sheet(page)).toBeHidden();

  await open('console');
  await press(sheet(page).getByRole('radio', { name: 'Night', exact: true }));
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);

  await open('dial');
  await press(sheet(page).getByRole('button', { name: 'Done' }));
  await expect(sheet(page)).toBeHidden();

  await setDial(page, 'Mild'); // a spoiler choice closes it too, and the chip follows
  await expect(sheet(page)).toBeHidden();
  await expect(chip(page, 'dial')).toHaveAccessibleName('Spoilers: Mild, change');
});

test('the sheet holds the three spoiler levels as radios with their meanings, the console and the theme', async ({ page }) => {
  await page.goto('/');
  await press(chip(page, 'dial'));
  const levels = sheet(page).locator('.levels');
  await expect(levels.getByRole('radio')).toHaveCount(3);
  await expect(levels.getByRole('radio', { name: /Off/ })).toBeChecked();
  await expect(levels).toContainText('the basics: setup, settings, controls, saving, fixes');
  await expect(levels).toContainText('adds where things are');
  await expect(levels).toContainText("adds how the game's systems work in play");
  await expect(sheet(page)).not.toContainText('light gameplay hints');
  await expect(sheet(page).getByRole('radio', { name: 'PS5', exact: true })).toBeVisible();
  await expect(sheet(page).getByRole('radio', { name: 'Night', exact: true })).toBeVisible();
  for (const r of await levels.locator('label').all()) expect((await box(r)).h).toBeGreaterThanOrEqual(48);
});

// ---- Outside links, footer ---- (hidden pages: hidden-gate.spec.mjs)
// Every list of outside links carries one note: outside.spec.mjs.
test('the footer About link is a 48px target', async ({ page }) => {
  await page.goto('/');
  const b = await box(page.locator('.footer-link'));
  expect(b.h).toBeGreaterThanOrEqual(48);
  expect(b.w).toBeGreaterThanOrEqual(48);
});
