import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS, saved, press, NIGHT, DAY } from './helpers.mjs';

const states = [
  ...SCREENS.map((path) => ({ name: path, path, settings: {} })),
  { name: '/ with the settings sheet open', path: '/', settings: {}, open: true },
  { name: '/topics/settings/ with everything shown', path: '/topics/settings/', settings: { dial: 'mild' } },
  { name: '/places/ with places shown', path: '/places/', settings: { dial: 'places' } },
  { name: '/a/sample-04/ on Xbox', path: '/a/sample-04/', settings: { console: 'xbox-x' } },
  { name: '/a/sample-02/ with details shown', path: '/a/sample-02/', settings: { dial: 'mild' } },
  { name: '/ with a search', path: '/', settings: {}, search: 'thing' },
];

for (const [theme, bg] of [['day', DAY], ['night', NIGHT]]) {
  for (const s of states) {
    test(`${s.name} in ${theme}: no axe violations`, async ({ page }) => {
      await saved(page, { ...s.settings, theme });
      await page.goto(s.path);
      await expect(page.locator('body')).toHaveCSS('background-color', bg);
      if (s.open) {
        await press(page.locator('.chip--console'));
        await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished))); // axe reads colours; not while the sheet fades in
      }
      if (s.search) await page.getByRole('searchbox').fill(s.search);
      if (s.settings.dial) await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
}
