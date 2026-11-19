import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { PAGES, OLD_ADDRESSES, saved, measure } from './helpers.mjs';

// Every page of the build, at 320, 390 and 820 wide with touch (the projects own the widths): every link, button, summary, input,
// select, textarea and [tabindex] is 48px in its real hit area AND in its own box, with 8px clear of the next. A first-time visitor,
// and a player with a console chosen, everything shown, every fold open. The only exemption is a link inside a sentence of an
// answer body or a text page (spec "Touch").
const states = [
  { name: 'first run', settings: {} },
  { name: 'Series S, all shown, folds open', settings: { console: 'xbox-s', dial: 'mild' }, unfold: true },
];

test('the page list is every page the build wrote', () => {
  const built = readdirSync('.e2e-dist', { recursive: true })
    .filter((f) => f.endsWith('index.html') && !f.startsWith('h/') && f !== 'index.html')
    .map((f) => `/${f.replace(/index\.html$/, '')}`)
    .filter((p) => !OLD_ADDRESSES.includes(p)); // a redirect page, not a screen
  expect(PAGES.filter((p) => p !== '/no-such-page/' && p !== '/').sort()).toEqual(built.sort());
});

for (const state of states) {
  test(`every control on every page (${state.name}) is 48px, in its hit area and its own box`, async ({ page }) => {
    test.setTimeout(240_000);
    await saved(page, state.settings);
    const found = [];
    let smallest = null;
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      if (state.unfold) await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const m = await measure(page);
      found.push(...m.problems.map((p) => `${path}: ${p}`));
      if (!smallest || parseInt(m.smallest) < parseInt(smallest.m)) smallest = { path, m: m.smallest };
    }
    test.info().annotations.push({ type: 'smallest', description: `every page|${state.name}|${smallest.m} on ${smallest.path}` });
    expect(found).toEqual([]);
  });
}

// The measure must catch the link the first version let through: a 20px link stretched over a card by a pseudo-element.
test('the measure catches a bare 20px link inside a stretched card', async ({ page }) => {
  await page.setContent(`<style>.c{position:relative;height:60px;margin:20px 0}.c a{color:#000;text-decoration:none;line-height:20px}.c a::after{content:'';position:absolute;inset:0}</style>
    <div class="c"><h2 style="margin:0"><a href="#x">a card question</a></h2></div>`);
  const { problems } = await measure(page);
  expect(problems.some((p) => /itself, though a tap reaches it/.test(p)), problems.join('\n')).toBe(true);
});
