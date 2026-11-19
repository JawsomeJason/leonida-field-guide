import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { saved, press, openFold } from './helpers.mjs';

// Fix round 9, items 6, 9 and 10, at the width of the project that runs it (320, 390, 820, 1440). Never the owner's real progress record.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
});

const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const style = (loc, props, pseudo) => loc.evaluate((el, [p, ps]) => Object.fromEntries(p.map((k) => [k, getComputedStyle(el, ps)[k]])), [props, pseudo ?? null]);
const tokens = (page) => page.evaluate(() => {
  const probe = (n, prop) => { const i = document.createElement('i'); i.style[prop] = `var(${n})`; document.body.append(i); const c = getComputedStyle(i)[prop === 'color' ? 'color' : 'backgroundColor']; i.remove(); return c; };
  return { accent: probe('--accent', 'color'), bg: probe('--bg', 'color'), surface: probe('--surface', 'color'), text: probe('--text', 'color') };
});
/** Count of pixels in the top-right corner (18 by 10, above the label's text) of a control that are at least 3 to 1 away from the control's own fill: the check mark, read from a real screenshot. */
const markPixels = async (page, loc, whole = false) => {
  const png = (await loc.screenshot()).toString('base64');
  return page.evaluate(async ([b64, whole]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const L = (d, i) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); };
    const all = g.getImageData(0, 0, img.width, img.height).data;
    const fill = L(all, (Math.floor(img.height / 2) * img.width + 2) * 4); // the left edge, mid height: plain fill (or its border, the same colour)
    const [x0, x1, y0, y1] = whole ? [4, img.width - 4, 4, img.height - 4] : [img.width - 20, img.width - 2, 3, 13]; // the corner, above the label's text where only the mark is; or a tick box's inside
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const l = L(all, (y * img.width + x) * 4);
      const [hi, lo] = [l, fill].sort((a, b) => b - a);
      if ((hi + 0.05) / (lo + 0.05) >= 3) n++;
    }
    return n;
  }, [png, whole]);
};
const showPrompt = (page) => page.addStyleTag({ content: 'html[data-console] .console-card { display: block !important; }' }); // the prompt hides after a choice: show it to look at its states

for (const theme of ['day', 'night']) {
  test(`item 6: the chosen console is unmistakable on the prompt, the sheet and the header chip, ${theme}`, async ({ page }) => {
    await saved(page, { theme });
    await page.goto('/');
    const t = await tokens(page);
    const btn = (id) => page.locator(`.console-card .console-btn[data-value="${id}"]`);
    await press(btn('ps5'));
    await expect(page.locator('html')).toHaveAttribute('data-console', 'ps5');
    await showPrompt(page);
    // The pressed state follows at once, and only the chosen one is pressed.
    await expect(btn('ps5')).toHaveAttribute('aria-pressed', 'true');
    await expect(btn('xbox-x')).toHaveAttribute('aria-pressed', 'false');
    await expect(btn('xbox-s')).toHaveAttribute('aria-pressed', 'false');
    const on = await style(btn('ps5'), ['backgroundColor', 'color']);
    const off = await style(btn('xbox-x'), ['backgroundColor', 'color']);
    expect(on.backgroundColor, 'selected is the accent fill').toBe(t.accent);
    expect(contrast(on.backgroundColor, off.backgroundColor), 'selected against unselected').toBeGreaterThanOrEqual(3);
    expect(contrast(on.backgroundColor, t.bg), 'selected against the page').toBeGreaterThanOrEqual(3);
    expect(contrast(on.color, on.backgroundColor), 'its label on the fill').toBeGreaterThanOrEqual(4.5);
    // More than colour: a check mark is painted in its corner (read from pixels), and the unselected ones have none.
    expect((await style(btn('ps5'), ['content'], '::after')).content).not.toBe('none');
    expect((await style(btn('xbox-x'), ['content'], '::after')).content).toBe('none');
    expect(await markPixels(page, btn('ps5')), 'check mark pixels on the selected button').toBeGreaterThan(10);
    expect(await markPixels(page, btn('xbox-x')), 'none on the others').toBe(0);

    // The header chip: a ring in the accent and a check mark once a console is chosen; "Pick console" has neither.
    const chip = page.locator('.chip--console');
    const c = await style(chip, ['borderTopColor']);
    expect(c.borderTopColor).toBe(t.accent);
    expect(contrast(c.borderTopColor, t.bg), 'chip ring against the header').toBeGreaterThanOrEqual(3);
    expect((await style(chip, ['content'], '::after')).content).not.toBe('none');
    expect(await markPixels(page, chip), 'check mark pixels on the chip').toBeGreaterThan(8);

    // Changed from the sheet: the prompt's buttons follow, and the sheet's own choice is filled and ticked.
    await press(chip);
    const radio = page.locator('#settings').getByRole('radio', { name: 'Xbox Series X', exact: true });
    await press(radio);
    await expect(btn('xbox-x')).toHaveAttribute('aria-pressed', 'true');
    await expect(btn('ps5')).toHaveAttribute('aria-pressed', 'false');
    await press(chip);
    const seg = (name) => page.locator('#settings .seg label', { hasText: name });
    const sOn = await style(seg('Series X'), ['backgroundColor']);
    const sOff = await style(seg('PS5'), ['backgroundColor']);
    expect(contrast(sOn.backgroundColor, sOff.backgroundColor), 'sheet: selected against unselected').toBeGreaterThanOrEqual(3);
    expect((await style(seg('Series X'), ['content'], '::after')).content).not.toBe('none');
    expect((await style(seg('PS5'), ['content'], '::after')).content).toBe('none');
    expect(await markPixels(page, seg('Series X')), 'check mark pixels in the sheet').toBeGreaterThan(10);
    // The selected spoiler row has the accent ring and its dot.
    const row = page.locator('#settings .levels label:has(:checked)');
    expect((await style(row, ['borderTopColor'])).borderTopColor).toBe(t.accent);
    expect((await style(row, ['boxShadow'])).boxShadow, 'a thick ring, not colour alone').toContain('2px');
  });
}

test('item 6: a console tapped before the bundled scripts arrive is pressed and checked at once', async ({ page }) => {
  await page.route('**/_astro/**', (route) => route.abort()); // settings.js never loads: only the inline script in the head can answer
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await press(page.locator('.console-card .console-btn[data-value="xbox-s"]'));
  await expect(page.locator('html')).toHaveAttribute('data-console', 'xbox-s');
  await showPrompt(page);
  await expect(page.locator('.console-card .console-btn[data-value="xbox-s"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.console-card .console-btn[data-value="ps5"]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('#settings input[name=console][value="xbox-s"]').isChecked(), 'the sheet agrees').toBe(true);
});

test('item 9: the tick box is drawn at 28px or more on the Checklist and on Ask, in a row still 48px tall', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  for (const path of ['/checklist/', '/']) {
    await page.goto(path);
    if (path === '/') await openFold(page);
    const input = page.locator('.todo input[type=checkbox]').first();
    await expect(input).toBeVisible();
    const box = await input.evaluate((el) => { const r = el.getBoundingClientRect(); const l = el.closest('label').getBoundingClientRect(); return { w: r.width, h: r.height, rowH: l.height }; });
    expect(box.w, `${path}: drawn width`).toBeGreaterThanOrEqual(28);
    expect(box.h, `${path}: drawn height`).toBeGreaterThanOrEqual(28);
    expect(box.rowH, `${path}: the row stays a 48px target`).toBeGreaterThanOrEqual(48);
    // ...and a tick is still drawn inside it once ticked.
    await press(input);
    expect(await markPixels(page, input, true), `${path}: ticked mark`).toBeGreaterThan(20);
  }
});

test('item 10: no stray sun on tablet and desktop, and the phone sun is as it was', async ({ page }) => {
  await saved(page, { console: 'ps5' });
  await page.goto('/');
  const sun = page.locator('.sunset');
  const w = page.viewportSize().width;
  if (w >= 768) {
    await expect(sun).toBeHidden();
    await expect(page.locator('.site-header .sun-mark'), 'the masthead keeps its own sun mark').toBeVisible();
  } else {
    await expect(sun).toBeVisible();
    const m = await sun.evaluate((el) => ({ h: el.getBoundingClientRect().height, sun: getComputedStyle(el, '::before').width }));
    // Unchanged from fix round 8: 3.25rem (52px) at 390; at 320 the container is narrower than 17em and the sun is 1.75rem (28px).
    expect(m, 'the hero sun on the phone').toEqual(w === 320 ? { h: 28, sun: '56px' } : { h: 52, sun: '104px' });
  }
});
