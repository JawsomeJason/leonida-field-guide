import { test, expect } from '@playwright/test';
import { SCREENS, saved } from './helpers.mjs';

// Nothing scrolls sideways at any width from 320 up, with hidden content loaded too.
for (const width of [320, 360, 390, 600, 820, 1024, 1440]) {
  test(`no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await saved(page, { dial: 'mild' });
    for (const path of [...SCREENS, '/a/sample-05/', '/places/list/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
      expect(over, `${path} overflows by ${over}px`).toBeLessThanOrEqual(0);
    }
  });
}
