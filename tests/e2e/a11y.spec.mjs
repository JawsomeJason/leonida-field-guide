import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS, saved, press, NIGHT, DAY } from './helpers.mjs';
import { lowContrast } from './contrast.mjs';

const states = [
  ...SCREENS.map((path) => ({ name: path, path, settings: {} })),
  { name: '/ with the settings sheet open', path: '/', settings: {}, open: true },
  { name: '/topics/settings/ with everything shown', path: '/topics/settings/', settings: { dial: 'mild' } },
  { name: '/places/ with places shown', path: '/places/', settings: { dial: 'places' } },
  { name: '/a/sample-04/ on Xbox', path: '/a/sample-04/', settings: { console: 'xbox-x' } },
  { name: '/a/sample-02/ with details shown', path: '/a/sample-02/', settings: { dial: 'mild' } },
  { name: '/ with a search', path: '/', settings: {}, search: 'thing' },
];

// Each theme is forced two ways at once, the stored setting and the device's colour scheme, and the run proves the theme really is
// on screen (data-theme and the computed --bg) before it measures anything: a run that measured the wrong theme passed for rounds.
for (const [theme, bg, scheme, token] of [['day', DAY, 'light', '#f6efe2'], ['night', NIGHT, 'dark', '#181320']]) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const s of states) {
      test(`${s.name} in ${theme}: no axe violations and every text reads at 4.5 to 1`, async ({ page }) => {
        await saved(page, { ...s.settings, theme });
        await page.goto(s.path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('body')).toHaveCSS('background-color', bg);
        expect((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg'))).trim()).toBe(token);
        if (s.open) {
          await press(page.locator('.chip--console'));
          await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished))); // colours are read; not while the sheet fades in
        }
        if (s.search) await page.getByRole('searchbox').fill(s.search);
        if (s.settings.dial) await page.waitForLoadState('networkidle');
        // Pass 2 first: it settles every running fade, which would otherwise blend the colours.
        expect(await lowContrast(page), 'text under the contrast floor, as drawn').toEqual([]);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      });
    }
  });
}

test('the contrast walk can fail: it flags text drawn under the floor', async ({ page }) => {
  await page.goto('/about/');
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'faint';
    p.style.cssText = 'color:#bbb;background:#fff;font-size:15px';
    document.querySelector('main').append(p);
  });
  expect((await lowContrast(page)).map((f) => f.text)).toContain('faint');
});
