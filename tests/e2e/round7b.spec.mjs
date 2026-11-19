import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { press } from './helpers.mjs';

// Fix round 7, the screen parts: a whole row that looks tappable, the Copied confirmation, the themed clear button on search,
// a locked topic with the Places gate's pattern, and the settings sheet that rises from the bottom and keeps Done in reach.
// Never the owner's real progress record: every test answers /api/progress itself.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
});
const touch = () => test.info().project.use.hasTouch;

/** The computed colour of a token, resolved the way the browser paints it. */
const token = (page, name, prop = 'background-color') =>
  page.evaluate(([n, p]) => {
    const probe = document.createElement('i');
    probe.style.setProperty(p, `var(${n})`);
    document.body.append(probe);
    const v = getComputedStyle(probe).getPropertyValue(p);
    probe.remove();
    return v;
  }, [name, prop]);
const rowLayer = (row) => row.evaluate((li) => { const s = getComputedStyle(li, '::before'); return { bg: s.backgroundColor, w: parseFloat(s.width), h: parseFloat(s.height) }; });
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

// ---- Item 5: the whole row tints on press (and on hover with a fine pointer), Checklist and Ask ----
for (const [name, path, rows, parts] of [
  ['Checklist', '/checklist/', '.tap-list > .todo', ['.todo__tick', '.todo__open']],
  ['Ask stage list', '/', '.todo-list > .todo', ['label', '.todo__open']],
]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`${name}: a press tints the whole row, label and arrow alike, and hover does only with a fine pointer (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
      await page.goto(path);
      const row = page.locator(rows).filter({ visible: true }).first();
      await expect(row).toBeVisible();
      const [press22, wash12] = [await token(page, '--press'), await token(page, '--wash')];
      const resting = await rowLayer(row);
      expect(resting.bg, 'at rest the row layer is clear').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      const rowBox = await row.boundingBox();
      // The layer spans the row from edge to edge, not just the label.
      expect(resting.w).toBeGreaterThanOrEqual(rowBox.width);
      expect(resting.h).toBeGreaterThanOrEqual(rowBox.height - 1);
      for (const part of parts) {
        await row.scrollIntoViewIfNeeded();
        const { x, y } = await centre(row.locator(part));
        await page.mouse.move(x, y);
        await page.mouse.down();
        await expect.poll(async () => (await rowLayer(row)).bg, `pressing ${part} tints the row`).toBe(press22);
        await page.mouse.move(2, 2); // slide off before letting go: no tick and no navigation, only the press
        await page.mouse.up();
        await expect.poll(async () => (await rowLayer(row)).bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      }
      // Hover: only where a fine pointer can hover. A touch screen has no hover to get stuck on.
      const hoverable = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
      expect(hoverable).toBe(!touch());
      for (const part of parts) {
        await row.locator(part).hover();
        await expect.poll(async () => (await rowLayer(row)).bg, `hovering ${part}`).toBe(hoverable ? wash12 : resting.bg);
        await page.mouse.move(2, 2);
      }
      expect(press22, 'the pressed tint is not the hover tint').not.toBe(wash12);
    });
  }
}

test('Next up rows keep their whole-row hover and press tint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lfg:v1', JSON.stringify({ console: 'ps5' })));
  await page.goto('/');
  const link = page.locator('.next-up__list a').first();
  await expect(link).toBeVisible();
  const { x, y } = await centre(link);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect.poll(() => link.evaluate((a) => getComputedStyle(a).backgroundColor)).toBe(await token(page, '--press'));
  await page.mouse.move(2, 2); // let go off the link: no navigation
  await page.mouse.up();
});

// ---- Item 5: Copied ----
const openBackup = async (page) => {
  await page.goto('/checklist/');
  await page.locator('#backup summary').click();
  await expect(page.locator('#export-code')).toBeVisible();
};

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Copy code: the button says Copied and a status line says Copied the code for about two seconds, then both go back (${reducedMotion})`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.emulateMedia({ reducedMotion });
    await openBackup(page);
    const btn = page.locator('#copy-code');
    const note = page.locator('#export-note');
    await expect(note).toHaveAttribute('role', 'status');
    const before = (await btn.boundingBox()).width;
    await press(btn);
    await expect(btn).toHaveText('Copied');
    await expect(note).toHaveText('Copied the code');
    expect(Math.abs((await btn.boundingBox()).width - before), 'the button does not change width').toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.locator('#export-code').inputValue());
    // Reduced motion: nothing animates; the words are the whole feedback.
    if (reducedMotion === 'reduce') expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await page.waitForTimeout(1500);
    await expect(btn).toHaveText('Copied'); // still there before the two seconds are up
    await expect(btn).toHaveText('Copy code', { timeout: 2500 });
    await expect(note).toHaveText('');
  });
}

test('Copy code with no clipboard: no Copied, the code is selected and the note says to copy it by hand', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } }); });
  await openBackup(page);
  await press(page.locator('#copy-code'));
  await expect(page.locator('#export-note')).toHaveText(/copy it by hand/);
  await expect(page.locator('#copy-code')).toHaveText('Copy code');
});

// ---- Item 7a: the themed clear button on the search field ----
for (const colorScheme of ['light', 'dark']) {
  test(`search: our own 48px Clear search button replaces the browser's cross, in the theme (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const q = page.getByRole('searchbox');
    const clear = page.getByRole('button', { name: 'Clear search' });
    await expect(clear, 'hidden while the field is empty').toBeHidden();
    await q.fill('save');
    await expect(clear).toBeVisible();
    expect(await clear.evaluate((b) => b.type)).toBe('button');
    const box = await clear.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    const css = await clear.evaluate((b) => { const s = getComputedStyle(b); return { border: s.borderTopColor, color: s.color, bg: s.backgroundColor }; });
    expect(css.border, 'the edge token').toBe(await token(page, '--edge', 'color'));
    expect(css.color, 'the text token').toBe(await token(page, '--text', 'color'));
    expect(css.bg, 'the surface token').toBe(await token(page, '--surface', 'color'));
    // The browser's own cross is gone, so there is only one.
    // (getComputedStyle does not report this shadow part, so the shipped rule itself is read.)
    expect(await page.evaluate(() => [...document.styleSheets].flatMap((sh) => [...sh.cssRules]).some((r) => r.selectorText?.includes('::-webkit-search-cancel-button') && r.style.display === 'none')), 'the native cross is hidden').toBe(true);
    // Beside the field, 8px or more away (two touching targets fail the touch rule), and on the same row.
    const field = await q.boundingBox();
    expect(box.x - (field.x + field.width), 'gap between the field and the button').toBeGreaterThanOrEqual(8);
    expect(Math.abs(box.y + box.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(1);
    expect(box.x + box.width, 'inside the screen').toBeLessThanOrEqual(page.viewportSize().width);
    await press(clear);
    await expect(q).toHaveValue('');
    await expect(q).toBeFocused();
    await expect(clear).toBeHidden();
    await expect(page.locator('#q-results')).toBeHidden(); // the empty state is back
  });
}

test('search: with script off the field has no clear button, and the form still works', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.ask-clear')).toBeHidden();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await ctx.close();
});

// ---- Item 7b: a locked topic opened by address gets the Places gate's pattern ----
test('a locked topic by address says what is hidden, why, and has the control (at Off), and the control sets the dial', async ({ page }) => {
  await page.goto('/topics/getting-around/');
  const gate = page.locator('.topic-hidden');
  await expect(gate).toBeVisible();
  await expect(gate.locator('h2')).toHaveText('Hidden until the spoiler setting is Mild');
  await expect(gate).toContainText('The answers on this topic are hidden.');
  await expect(gate).toContainText('The spoiler setting is below Mild');
  await expect(gate).toContainText("how the game's systems work in play");
  const btn = gate.getByRole('button', { name: 'Show Mild topics' });
  const box = await btn.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(48);
  await expect(gate.getByRole('link', { name: 'Show Mild topics' }), 'the plain link is only the no-script floor').toBeHidden();
  await press(btn);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lfg:v1')).settings.dial.value)).toBe('mild');
  await expect(gate).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-dial', 'mild');
});

test('a locked topic by address, no script: the gate is words and a plain link to that level\'s page', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/topics/getting-around/');
  const link = page.locator('.topic-hidden').getByRole('link', { name: 'Show Mild topics' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/mild/');
  expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(48);
  await expect(page.locator('.topic-hidden').getByRole('button')).toBeHidden();
  await ctx.close();
});

test('the Places topic by address has the same gate pattern with its Show places button', async ({ page }) => {
  await page.goto('/topics/places/');
  const gate = page.locator('.gate');
  await expect(gate.locator('h2')).toBeVisible();
  await expect(gate.getByRole('button', { name: 'Show places' })).toBeVisible();
  await expect(gate).toContainText('Nothing about them is on this page');
});

// ---- Item 7c and 7d: the settings sheet rises from the bottom, and Done stays in reach ----
/** Click the chip and, in the same task, sample the sheet's box on every frame for `ms`. */
const sampleOpen = (page, ms = 600) =>
  page.evaluate((ms) => new Promise((resolve) => {
    const sheet = document.getElementById('settings');
    const samples = [];
    const t0 = performance.now();
    document.querySelector('.chip--dial').click();
    const frame = () => {
      const r = sheet.getBoundingClientRect();
      samples.push({ t: performance.now() - t0, top: r.top, bottom: r.bottom, open: sheet.matches(':popover-open') });
      if (performance.now() - t0 < ms) requestAnimationFrame(frame);
      else resolve({ samples, vh: innerHeight, h: r.height, origin: getComputedStyle(sheet).transformOrigin });
    };
    requestAnimationFrame(frame);
  }), ms);

test('the sheet rises: its top only moves up toward where it rests, starting below the screen, with its origin at the bottom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const { samples, vh, h, origin } = await sampleOpen(page);
  const rest = samples.at(-1).top;
  const tops = samples.map((s) => s.top);
  expect(samples.length, 'enough frames to see it move').toBeGreaterThan(6);
  expect(tops[0], 'the first frame is the sheet below its resting place, off the bottom edge').toBeGreaterThan(rest + h * 0.5);
  expect(samples[0].bottom, 'it starts below the bottom of the screen').toBeGreaterThanOrEqual(vh);
  for (let i = 1; i < tops.length; i++) expect(tops[i], `frame ${i} is not lower than the one before`).toBeLessThanOrEqual(tops[i - 1] + 0.5);
  for (const t of tops) expect(t, 'never above the resting top (not dropped from the top)').toBeGreaterThanOrEqual(rest - 0.5);
  expect(Math.abs(samples.at(-1).bottom - vh)).toBeLessThanOrEqual(1);
  // The origin is the bottom edge of the sheet.
  const [, oy] = origin.split(' ').map(parseFloat);
  expect(Math.abs(oy - h), 'transform-origin y is the sheet height').toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('settings')).opacity), 'the sheet itself is not faded in').toBe('1');
});

test('closing is the same movement back: the top only moves down, never above where it rests', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const { samples } = await sampleOpen(page, 500);
  const rest = samples.at(-1).top;
  const out = await page.evaluate(() => new Promise((resolve) => {
    const sheet = document.getElementById('settings');
    const tops = [];
    sheet.hidePopover();
    const t0 = performance.now();
    const frame = () => {
      tops.push(sheet.getBoundingClientRect().top);
      if (sheet.matches(':popover-open') || performance.now() - t0 < 700) requestAnimationFrame(frame);
      else resolve(tops);
    };
    requestAnimationFrame(frame);
  }));
  const seen = out.filter((t) => t > 0); // once it is display:none the box is gone
  expect(seen.length).toBeGreaterThan(3);
  for (let i = 1; i < seen.length; i++) expect(seen[i], 'moving down').toBeGreaterThanOrEqual(seen[i - 1] - 0.5);
  for (const t of seen) expect(t).toBeGreaterThanOrEqual(rest - 0.5);
});

test('reduced motion: the sheet is at its place on the first frame and nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const { samples } = await sampleOpen(page, 300);
  const rest = samples.at(-1).top;
  for (const s of samples.filter((s) => s.open)) expect(Math.abs(s.top - rest), 'no movement at all').toBeLessThanOrEqual(0.5);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

for (const [w, h] of [[375, 664], [320, 640]]) {
  test(`the sheet's Done button is fully on a ${w}x${h} screen and tappable without scrolling the sheet, and the header can be reached`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await press(page.locator('.chip--dial'));
    await expect(page.locator('#settings')).toBeVisible();
    await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
    const done = page.locator('#settings').getByRole('button', { name: 'Done' });
    const box = await done.boundingBox();
    expect(box.y, 'inside the top edge').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'inside the bottom edge').toBeLessThanOrEqual(h);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    expect(box.height).toBeGreaterThanOrEqual(48);
    const state = await page.evaluate(() => {
      const s = document.getElementById('settings');
      const r = document.querySelector('#settings .sheet__done .btn').getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { scrollTop: s.scrollTop, hitDone: !!hit?.closest('.sheet__done .btn'), scrolls: s.scrollHeight > s.clientHeight };
    });
    expect(state.scrollTop, 'the sheet has not been scrolled').toBe(0);
    expect(state.hitDone, 'a tap on Done lands on Done').toBe(true);
    // The heading is reachable by scrolling the sheet up (here it is already at the top).
    expect((await page.locator('#settings h2').boundingBox()).y).toBeGreaterThanOrEqual(0);
    await press(done);
    await expect(page.locator('#settings')).toBeHidden();
  });
}
