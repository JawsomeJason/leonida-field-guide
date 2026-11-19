import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { saved, press } from './helpers.mjs';

// Fix round 9, items 7 and 8: they set their own viewports. Never the owner's real progress record.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
});

const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

for (const theme of ['day', 'night']) {
  for (const [w, h] of [[320, 568], [320, 640], [360, 640], [375, 664], [390, 844]]) {
    test(`item 7: all three spoiler levels show inside the sheet with no inner scroll at ${w}x${h}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await saved(page, { theme });
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await press(page.locator('.chip--dial'));
      await expect(page.locator('#settings')).toBeVisible();
      const m = await page.evaluate(() => {
        const sheet = document.getElementById('settings');
        const s = sheet.getBoundingClientRect();
        const port = { top: s.top, bottom: s.top + sheet.clientHeight }; // the scrollport, scrolled to the top
        const rows = [...sheet.querySelectorAll('.levels label')].map((l) => { const r = l.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height, name: l.textContent.trim().slice(0, 6) }; });
        const d = sheet.querySelector('.btn').getBoundingClientRect();
        return { port, rows, done: { t: d.top, b: d.bottom, h: d.height }, scrollTop: sheet.scrollTop, content: sheet.scrollHeight, shown: sheet.clientHeight, vh: innerHeight, sheetH: s.height };
      });
      expect(m.rows.map((r) => r.name)).toEqual(['Off th', 'Places', 'Mild a']);
      for (const r of m.rows) {
        expect(r.t, `${r.name} starts inside the scrollport`).toBeGreaterThanOrEqual(m.port.top);
        expect(r.b, `${r.name} ends inside the scrollport`).toBeLessThanOrEqual(m.port.bottom);
        expect(r.h, `${r.name} is a 48px target`).toBeGreaterThanOrEqual(48);
      }
      for (let i = 1; i < m.rows.length; i++) expect(m.rows[i].t - m.rows[i - 1].b, 'the 8px between levels').toBeGreaterThanOrEqual(8);
      expect(m.content, 'no inner scroll needed').toBeLessThanOrEqual(m.shown + 1);
      expect(m.scrollTop).toBe(0);
      expect(m.done.h, 'Done is 48px').toBeGreaterThanOrEqual(48);
      expect(m.done.b, 'Done is on screen').toBeLessThanOrEqual(m.vh);
      expect(m.rows.at(-1).b, 'the last level sits above Done').toBeLessThanOrEqual(m.done.t);
      expect(m.sheetH, 'the sheet is never more than 90% of a short screen, 70% of a tall one').toBeLessThanOrEqual(m.vh * (h <= 700 ? 0.9 : 0.7));
    });
  }
}

// Item 8: "Spoilers: Off" is one line, its label in the full text colour. At 320 wide with 130% text the last-resort two lines stay, but never dim.
for (const settings of [{ dial: 'off' }, { dial: 'places', console: 'xbox-x' }, { dial: 'mild' }]) {
  test(`item 8: the Spoilers chip is one line with a legible label (${JSON.stringify(settings)})`, async ({ page }) => {
    test.setTimeout(60_000);
    await saved(page, settings);
    for (const width of [320, 360, 390]) {
      for (const scale of ['100%', '130%']) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/');
        await page.addStyleTag({ content: `html { font-size: ${scale}; }` });
        const m = await page.evaluate(() => {
          const chip = document.querySelector('.chip--dial');
          const k = chip.querySelector('.chip__k');
          const v = [...chip.querySelectorAll('.chip__v > span')].find((s) => getComputedStyle(s).display !== 'none');
          const probe = document.createElement('i');
          probe.style.color = 'var(--text)';
          document.body.append(probe);
          const text = getComputedStyle(probe).color;
          probe.remove();
          return {
            tap: parseFloat(getComputedStyle(document.documentElement).fontSize) * 3, kTop: k.getBoundingClientRect().top, vTop: v.getBoundingClientRect().top, h: chip.getBoundingClientRect().height,
            kColor: getComputedStyle(k).color, bg: getComputedStyle(chip).backgroundColor, text, rowY: new Set([...document.querySelectorAll('.site-header__row > *')].map((e) => Math.round(e.getBoundingClientRect().y))).size,
            sideways: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const tag = `${width} wide, ${scale}`;
        if (!(width === 320 && scale === '130%')) {
          expect(Math.abs(m.kTop - m.vTop), `label and level on one line, ${tag}`).toBeLessThan(4);
          expect(m.h, `the chip stays one 3rem row, ${tag}`).toBeLessThanOrEqual(m.tap + 0.5);
        }
        expect(m.kColor, `the label is the full text colour, ${tag}`).toBe(m.text);
        expect(contrast(m.kColor, m.bg), `the label is AA, ${tag}`).toBeGreaterThanOrEqual(4.5);
        expect(m.rowY, `the header is one row, ${tag}`).toBe(1);
        expect(m.sideways, `no sideways scroll, ${tag}`).toBe(false);
      }
    }
  });
}
