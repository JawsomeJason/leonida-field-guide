import { test, expect } from '@playwright/test';
import { saved, press, setDial } from './helpers.mjs';

const width = (page) => page.viewportSize().width;
const rects = (locator) => locator.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: r.width, h: r.height }; }));

test('the home screen says what the guide is, and that spoilers are off, right under the title', async ({ page }) => {
  await page.goto('/');
  const lede = page.locator('h1 + .lede');
  await expect(lede).toContainText('Spoilers stay off until you turn them on');
});

test('Most asked is a grid of equal-height cells where there is room', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  const cells = await rects(page.locator('.most-asked__list a:visible'));
  expect(cells.length).toBeGreaterThanOrEqual(6);
  const rows = Map.groupBy(cells, (c) => c.y);
  for (const [y, row] of rows) expect(new Set(row.map((c) => Math.round(c.h))).size, `row at ${y} has cells of different heights`).toBe(1);
  const columns = new Set(cells.map((c) => c.x)).size;
  if (width(page) >= 820) expect(columns, 'tablet and desktop use more than one column').toBeGreaterThan(1);
  if (width(page) < 600) expect(columns, 'a phone is one column').toBe(1);
});

test('on desktop the questions sit beside the stage; below that they stack', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  const ask = (await rects(page.locator('.home__ask')))[0];
  const stage = (await rects(page.locator('.home__stage')))[0];
  if (width(page) >= 1024) expect(stage.x).toBeGreaterThan(ask.x + ask.w - 1);
  if (width(page) < 820) expect(stage.y).toBeGreaterThan(ask.y);
});

test('checklist rows are about 70 characters wide at most, and the stages share the width on desktop', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/checklist/');
  const max = await page.evaluate(() => {
    const probe = Object.assign(document.createElement('span'), { style: 'position:absolute;inline-size:70ch' });
    document.querySelector('.todos').append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  for (const r of await rects(page.locator('.todos'))) expect(r.w).toBeLessThanOrEqual(max + 1);
  const stages = await rects(page.locator('section[data-stage]'));
  if (width(page) >= 1440) expect(new Set(stages.map((s) => s.x)).size, 'two columns of stages').toBe(2);
  if (width(page) < 820) expect(new Set(stages.map((s) => s.x)).size).toBe(1);
});

test('a cheat sheet has the list of topics beside it on desktop, with the current one marked', async ({ page }) => {
  await page.goto('/topics/setup/');
  const list = page.getByRole('complementary', { name: 'More in this topic' });
  if (width(page) < 1024) return expect(list).toBeHidden();
  await expect(list.getByRole('link', { name: 'Setup' })).toHaveAttribute('aria-current', 'page');
  await press(list.getByRole('link', { name: 'Money' }));
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
});

test('monospace is for values a player copies, never for labels or notices', async ({ page }) => {
  await saved(page, { dial: 'mild', console: 'xbox-s' });
  for (const path of ['/', '/topics/', '/topics/setup/', '/a/sample-02/', '/checklist/', '/new/', '/places/list/', '/about/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    const mono = await page.evaluate(() => [...document.body.querySelectorAll('*')]
      .filter((el) => !el.closest('kbd, code, textarea, pre, script, style') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((el) => /monospace|ui-monospace/.test(getComputedStyle(el).fontFamily))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent.trim().slice(0, 30)}`));
    expect(mono, `${path} sets text in monospace`).toEqual([]);
  }
});

test('the Places tile says it is hidden until the dial is raised, and what raising it does', async ({ page }) => {
  await page.goto('/topics/');
  const tile = page.locator('a[href="/topics/places/"]');
  await expect(tile.getByText('Hidden until the spoiler setting is raised to Places. That adds where things are.')).toBeVisible();
  await setDial(page, 'Places');
  await expect(tile.getByText(/^Hidden until/)).toBeHidden();
  await expect(tile.getByText(/^Shown/)).toBeVisible();
});

test('how sure we are is plain words, and its meaning opens from a 48px row with the same words the About page uses', async ({ page }) => {
  await page.goto('/about/');
  const about = await page.locator('li:has(> strong)').allInnerTexts();
  await page.goto('/a/sample-02/');
  await expect(page.locator('.facts dt').first()).toHaveText('How sure we are');
  const now = (await page.locator('.trust__now').innerText()).trim();
  expect(now).toBe('Community, from players');
  const summary = page.locator('.trust summary');
  await expect(summary).toHaveText('What does this mean?');
  expect((await rects(summary))[0].h, 'a 48px target').toBeGreaterThanOrEqual(48);
  const meaning = page.locator('.trust p');
  await expect(meaning).toBeHidden(); // closed until asked: no hover needed
  await press(summary);
  await expect(meaning).toBeVisible();
  const text = (await meaning.innerText()).trim();
  expect(about, 'About lists the same definition').toContain(`${now}. ${text}`);
  expect(about.some((t) => t.startsWith('Official, from the publisher or platform.')) && about.some((t) => t.startsWith('Reported, from news sites or creators.'))).toBe(true);
});

// Night identity: warm state colour, not cyan. Hue 15 to 50 degrees is amber to orange; cyan sits near 180.
const hue = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => v / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
};

test('night state colour is amber or orange on every state element, never cyan', async ({ page }) => {
  await saved(page, { theme: 'night', console: 'ps5' });
  await page.goto('/');
  const colour = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
  await page.locator('#q').focus();
  const states = {
    'selected tab': await colour(page.locator('.nav a[aria-current="page"]'), 'color'),
    'spoiler chip state': await colour(page.locator('.dial .seg label:has(:checked)'), 'backgroundColor'),
    link: await colour(page.locator('.footer-link'), 'color'),
    'focus ring': await colour(page.locator('#q'), 'outlineColor'),
  };
  for (const [name, rgb] of Object.entries(states)) {
    const h = hue(rgb);
    expect(h >= 15 && h <= 50, `${name} is ${rgb}, hue ${h}: not amber or orange`).toBe(true);
  }
  const bar = await page.locator('.site-header').evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
  expect(bar, 'the header rule runs amber to coral').toContain('rgb(255, 159, 69)');
  expect(bar).toContain('rgb(255, 111, 97)');
});

test('the main answer is raised; secondary lists are plain rows with no card and no shadow', async ({ page }) => {
  await saved(page, { theme: 'night', console: 'ps5' });
  const look = (loc) => loc.first().evaluate((el) => { const c = getComputedStyle(el); return { shadow: c.boxShadow, radius: parseFloat(c.borderTopLeftRadius), bg: c.backgroundColor }; });
  const transparent = 'rgba(0, 0, 0, 0)';
  const plain = async (name, loc) => {
    const l = await look(loc);
    expect(l, `${name} is a plain row`).toEqual({ shadow: 'none', radius: 0, bg: transparent });
  };
  const raised = async (name, loc) => {
    const l = await look(loc);
    expect(l.shadow, `${name} is raised`).not.toBe('none');
    expect(l.radius, `${name} has a card radius`).toBeGreaterThan(0);
    expect(l.bg, `${name} has a surface`).not.toBe(transparent);
  };

  await page.goto('/a/sample-02/');
  await raised('the short answer', page.locator('.answer__a'));
  await plain('a related row', page.locator('#related ~ .tap-list a'));
  await plain('a source row', page.locator('.facts .tap-list a'));
  await plain('the meaning row', page.locator('.trust summary'));

  await page.goto('/topics/');
  await plain('a topic row', page.locator('.tile:not(.tile--places)'));

  await page.goto('/checklist/');
  await plain('a checklist row', page.locator('.todo__tick'));

  await page.goto('/');
  await raised('the search field', page.locator('.ask-search input'));
  await raised('a Most asked row', page.locator('.most-asked__list a'));
  await plain('a stage row', page.locator('.todo-list .todo label'));

  await page.goto('/topics/settings/');
  await raised('a cheat sheet answer', page.locator('.card'));
});

