import { test, expect } from '@playwright/test';
import { ranked, records, press, setDial, setTheme, saved, SCREENS, NIGHT, DAY } from './helpers.mjs';

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
  await expect(page.locator('a[href="/topics/places/"]').getByText('Locked')).toBeVisible();

  await page.goto('/places/');
  await setDial(page, 'Places');
  await expect(page.getByRole('heading', { name: 'Where is the quokka marker?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Places are switched off' })).toBeHidden();
  await page.goto('/topics/');
  await expect(page.locator('a[href="/topics/places/"]').getByText('Open')).toBeVisible();

  await setDial(page, 'Off');
  await expect(page.locator('a[href="/topics/places/"]').getByText('Locked')).toBeVisible();
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
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
  await expect(page.getByText('Quokka note one')).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 places detail hidden. Show' }));
  await expect(page.getByText('Quokka note one')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
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
  await shows('Press ✕A to open the sample menu.'); // nothing chosen yet: both names
  await press(page.getByRole('button', { name: 'Xbox X', exact: true }));
  await shows('Press A to open the sample menu on this console.');
  await press(page.getByRole('button', { name: 'PS5', exact: true }));
  await shows('Press ✕ to open the sample menu.');
  await setTheme(page, 'Auto'); // opens the menu
  await press(page.getByRole('radio', { name: 'Xbox S', exact: true }));
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

test('first open asks which console, with three big buttons, and the choice sticks', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Which console do you play on?' });
  await expect(card).toBeVisible();
  const first = await page.evaluate(() => document.querySelector('main').firstElementChild.className);
  expect(first).toContain('console-card');
  for (const name of ['PS5', 'Xbox Series X', 'Xbox Series S']) expect((await card.getByRole('button', { name, exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(60);
  await press(card.getByRole('button', { name: 'Xbox Series S', exact: true }));
  await expect(card).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.reload();
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.console)).toBe('xbox-s');
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

for (const [c, label, gone, shown] of [['xbox-x', 'Xbox X', /PS5|PlayStation/, 'Xbox only sample step'], ['xbox-s', 'Xbox S', /PS5|PlayStation/, 'Xbox only sample step'], ['ps5', 'PS5', /Xbox/, 'PS5 only sample step']]) {
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
const chip = (page) => page.locator('.chip');
const sheet = (page) => page.locator('#settings');

test('the header takes at most a fifth of the screen, also at 130% text', async ({ page }) => {
  await page.goto('/');
  const vh = page.viewportSize().height;
  expect((await box(page.locator('.site-header'))).h).toBeLessThanOrEqual(vh * 0.2);
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  const big = (await box(page.locator('.site-header'))).h;
  expect(big, `header is ${big}px at 130% text`).toBeLessThanOrEqual(Math.max(170, vh * 0.2));
});

test('the header stays on screen while you scroll, with the dial and the console in reach', async ({ page }) => {
  await saved(page, { console: 'xbox-s' });
  await page.goto('/checklist/');
  await page.evaluate(() => scrollTo(0, 600));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect((await box(page.locator('.site-header'))).y).toBe(0);
  await expect(chip(page)).toHaveText(/Xbox S/);
  await setDial(page, 'Places');
  await expect(page.getByRole('radio', { name: 'Places', exact: true })).toBeChecked();
});

test('every screen names the console in use in the header', async ({ page }) => {
  for (const [c, name] of [['ps5', 'PS5'], ['xbox-x', 'Xbox X'], ['xbox-s', 'Xbox S']]) {
    await saved(page, { console: c });
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(chip(page), path).toContainText(name);
    }
  }
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(chip(page)).toContainText('Console'); // never chosen: it asks
});

test('the settings sheet sits below the dial and closes on Escape, a tap outside, a choice and Done', async ({ page }) => {
  await page.goto('/about/');
  const open = async () => { await press(chip(page)); await expect(sheet(page)).toBeVisible(); };
  await open();
  const vh = page.viewportSize().height;
  await expect.poll(async () => Math.round((await box(sheet(page))).b), 'it settles at the bottom of the screen, in thumb reach').toBe(vh);
  const s = await box(sheet(page));
  const d = await box(page.locator('.dial'));
  const h = await box(page.locator('.site-header'));
  expect(s.y, 'the sheet starts below the header').toBeGreaterThanOrEqual(h.b - 1);
  expect(d.b <= s.y || d.y >= s.b, 'the sheet covers the dial').toBe(true);
  // what is under the middle of the dial is the dial
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.dial') !== null, [d.x + d.w / 2, d.y + d.h / 2])).toBe(true);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();

  await open();
  await tapAt(page, 4, Math.round((h.b + s.y) / 2)); // the page margin between the header and the sheet
  await expect(sheet(page)).toBeHidden();

  await open();
  await press(sheet(page).getByRole('radio', { name: 'Night', exact: true }));
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);

  await open();
  await press(sheet(page).getByRole('button', { name: 'Done' }));
  await expect(sheet(page)).toBeHidden();

  await open(); // the dial works while it is open, in the same tap that closes the sheet
  await setDial(page, 'Places');
  await expect(page.getByRole('radio', { name: 'Places', exact: true })).toBeChecked();
});

test('the sheet explains the three dial levels', async ({ page }) => {
  await page.goto('/');
  await press(chip(page));
  const help = sheet(page).locator('#dial-help');
  await expect(help).toContainText('Off');
  await expect(help).toContainText('how-to answers only');
  await expect(help).toContainText('adds where things are');
  await expect(help).toContainText('adds light gameplay hints');
});

// ---- Hidden pages, outside links, footer ----
const hiddenPages = [
  ['/places/list/', 'places', /quokka marker/i],
  ['/places/place-01/', 'places', /quokka marker/i],
  ['/places/sample-02/', 'places', /Quokka note one/],
  ['/mild/mild-01/', 'mild', /wombat switch/i],
  ['/mild/sample-02/', 'mild', /Wombat note one/],
];
const on = (page) => page.evaluate(() => document.body.innerText);

for (const [path, tier, secret] of hiddenPages) {
  test(`${path} opens closed at Off, and one tap shows it`, async ({ page }) => {
    await page.goto(path);
    const closed = await on(page);
    expect(closed, 'hidden text is on screen at Off').not.toMatch(secret);
    expect(closed).toContain('Show this page');
    expect(closed).toContain('Go back');
    expect(closed).toMatch(tier === 'places' ? /places and collectibles/ : /mild gameplay hints/);
    expect(closed).toContain('below');
    await press(page.getByText('Show this page', { exact: true }));
    expect(await on(page)).toMatch(secret);
  });

  test(`${path} opens by itself only when the dial reaches ${tier}`, async ({ page }) => {
    for (const dial of ['places', 'mild']) {
      await saved(page, { dial });
      await page.goto(path);
      const opens = tier === 'places' || dial === 'mild';
      if (opens) await expect.poll(() => on(page)).toMatch(secret);
      else expect(await on(page)).not.toMatch(secret);
    }
  });
}

test('every link out says it is an outside site that may contain spoilers, before you tap', async ({ page }) => {
  for (const path of ['/', '/a/sample-02/', '/a/sample-04/', '/places/', '/topics/places/']) {
    await page.goto(path);
    const links = page.locator('main a[href^="http"]');
    const n = await links.count();
    for (let i = 0; i < n; i++) expect(await links.nth(i).innerText(), `${path} link ${i}`).toContain('outside site, may contain spoilers');
  }
  await page.goto('/a/sample-02/');
  expect(await page.locator('main a[href^="http"]').count()).toBeGreaterThan(0);
  await page.goto('/places/');
  expect(await page.locator('main a[href^="http"]').count()).toBe(2);
});

test('the footer About link is a 48px target', async ({ page }) => {
  await page.goto('/');
  const b = await box(page.locator('.footer-link'));
  expect(b.h).toBeGreaterThanOrEqual(48);
  expect(b.w).toBeGreaterThanOrEqual(48);
});
