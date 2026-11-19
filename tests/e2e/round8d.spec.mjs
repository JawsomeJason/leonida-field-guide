import { test, expect } from '@playwright/test';
import { empty } from '../../src/lib/merge.js';
import { PAGES, SCREENS, saved, press } from './helpers.mjs';

// Fix round 8, items 5 and 8 to 10: a label per claim, the dial's accent and its lede, a smaller sheet, and the small accessibility details.
// Never the owner's real progress record: every test answers /api/progress itself.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/progress', (route) => route.fulfill({ json: empty() }));
});

// ---- Item 5: a label per claim where one answer mixes sources of different standing ----
test('a mixed-source answer names its label per claim, not one badge, and the meaning text agrees with About', async ({ page }) => {
  await page.goto('/about/');
  const about = await page.locator('li:has(> strong)').allInnerTexts();
  await page.goto('/a/sample-20/'); // the fixture has one official-host source and one other
  await expect(page.locator('.facts dt').first()).toHaveText('How sure we are');
  const line = (await page.locator('.trust__now').innerText()).trim();
  expect(line).toBe('The part the publisher states, official (from the publisher or platform); the part a news site adds, reported (from news sites or creators).');
  await expect(page.locator('.trust__now strong')).toHaveText(['official', 'reported']);
  expect(line, 'no single bare badge for the whole answer').not.toMatch(/^(Official|Reported|Community), /);
  await press(page.locator('.trust summary'));
  const meanings = (await page.locator('.trust p').allInnerTexts()).map((t) => t.trim());
  expect(meanings.length, 'one meaning per label used').toBe(2);
  for (const m of meanings) expect(about, 'About lists the same definition').toContain(m.replace(/\n/g, ' '));
});

test('a single-label answer still shows its one badge', async ({ page }) => {
  await page.goto('/a/sample-02/');
  await expect(page.locator('.trust__now')).toHaveText('Community, from players');
});

// ---- Item 8: the dial is plain at a glance, and no line says spoilers are off when they are on ----
const contrast = (a, b) => {
  const lum = (c) => { const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const scheme of ['light', 'dark']) {
  test(`the header chip shows a raised level in the accent (AA on the chip), Off in the text colour, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [dial, accent] of [['off', false], ['places', true], ['mild', true]]) {
      await saved(page, { dial });
      await page.goto('/');
      const v = await page.evaluate(() => {
        const probe = (n) => { const i = document.createElement('i'); i.style.color = `var(${n})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
        const chip = document.querySelector('.chip--dial');
        const word = [...chip.querySelectorAll('.chip__v > span')].find((s) => getComputedStyle(s).display !== 'none');
        return { word: word.textContent, color: getComputedStyle(chip.querySelector('.chip__v')).color, bg: getComputedStyle(chip).backgroundColor, accent: probe('--accent'), text: probe('--text') };
      });
      expect(v.color, `${dial}: ${accent ? 'accent' : 'text colour'}`).toBe(accent ? v.accent : v.text);
      expect(contrast(v.color, v.bg), `${dial} on the chip, ${scheme}`).toBeGreaterThanOrEqual(4.5);
      expect(v.word.toLowerCase()).toBe(dial);
    }
  });
}

test('the line under the Ask title is true at every level, and no other line says spoilers are off when they are not', async ({ page }) => {
  for (const [dial, say, notSay] of [
    ['off', /Spoilers stay off until you turn them on/, /Spoilers are on/],
    ['places', /Spoilers are on at Places: that adds where things are/, /stay off|are off/i],
    ['mild', /Spoilers are on at Mild: that adds where things are and how the game's systems work/, /stay off|are off/i],
  ]) {
    await saved(page, { dial });
    await page.goto('/');
    const lede = (await page.locator('.lede').innerText()).trim();
    expect(lede, `${dial}: the lede`).toMatch(say);
    expect(lede, `${dial}: the lede is not stale`).not.toMatch(notSay);
    expect(lede.startsWith('Plain answers about setup, settings and getting started.')).toBe(true);
  }
  // Every screen, at Places and Mild: no visible line that says spoilers are off (the sheet and the gate pages name the level they stand for, so only default screens are read).
  for (const dial of ['places', 'mild']) {
    await saved(page, { dial });
    for (const path of ['/', '/topics/', '/checklist/', '/new/', '/about/', '/a/sample-02/']) {
      await page.goto(path);
      const text = await page.locator('main').innerText();
      expect(text, `${path} at ${dial}`).not.toMatch(/spoilers (stay|are|is) off/i);
    }
  }
});

// ---- Item 9: the phone settings sheet is about two thirds of the screen, the spoiler level nearest the thumb, nothing clipped ----
for (const [w, h] of [[320, 568], [320, 640], [375, 664], [390, 844], [430, 932]]) {
  test(`the settings sheet on ${w}x${h}: at most 70% of the screen (90% under 700px tall), spoiler options lowest, nothing clipped, Done in view, it scrolls`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await press(page.locator('.chip--dial'));
    await expect(page.locator('#settings')).toBeVisible();
    const m = await page.evaluate(() => {
      const sheet = document.getElementById('settings');
      const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const s = box(sheet);
      const controls = [...sheet.querySelectorAll('label, button, summary, a, legend, h2, p')].filter((e) => e.checkVisibility()).map(box);
      const mid = (e) => { const r = e.getBoundingClientRect(); return r.top - s.t + sheet.scrollTop + r.height / 2; };
      const sec = (name) => sheet.querySelector(`input[name=${name}]`).closest('fieldset');
      sheet.scrollTop = sheet.scrollHeight; // the last section is reachable
      const done = box(sheet.querySelector('.btn'));
      const lastRow = box([...sheet.querySelectorAll('input[name=dial]')].at(-1).closest('label'));
      return {
        vh: innerHeight, sheet: s, height: s.b - s.t, content: sheet.scrollHeight, shown: sheet.clientHeight, hscroll: sheet.scrollWidth - sheet.clientWidth,
        outside: controls.filter((c) => c.l < s.l - 0.5 || c.r > s.r + 0.5).length,
        theme: mid(sec('theme')), console: mid(sec('console')), dial: mid(sec('dial')),
        done, lastRowBottom: lastRow.b, scrolled: sheet.scrollTop,
      };
    });
    expect(m.height, 'sheet height against the screen').toBeLessThanOrEqual(m.vh * (m.vh <= 700 ? 0.9 : 0.7)); // fix round 9: nine tenths on a screen under 700px tall, so all three levels show
    expect(m.theme < m.console && m.console < m.dial, 'theme, then console, then the spoiler level at the bottom').toBe(true);
    expect(m.dial, 'the spoiler options sit in the lower half of the sheet content').toBeGreaterThan(m.content / 2);
    expect(m.hscroll, 'no horizontal clipping or scroll inside the sheet').toBeLessThanOrEqual(0);
    expect(m.outside, 'every control inside the sheet sideways').toBe(0);
    expect(m.done.b, 'Done inside the screen').toBeLessThanOrEqual(m.vh);
    expect(m.done.t, 'Done is inside the sheet').toBeGreaterThanOrEqual(m.sheet.t);
    expect(m.lastRowBottom, 'scrolled to the end, the last level sits above Done').toBeLessThanOrEqual(m.done.t + 1);
    if (m.content > m.shown) expect(m.scrolled, 'the sheet scrolls inside itself').toBeGreaterThan(0);
  });
}

// ---- Item 10a: nothing under 14px ----
test('no visible text is set under 14px at the default text size, on every screen and in the open sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const small = () =>
    page.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!n.textContent.trim() || !el.checkVisibility() || el.closest('script, style, noscript, [aria-hidden=true]')) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14) out.push(`${el.tagName.toLowerCase()}.${el.className}: ${size}px "${n.textContent.trim().slice(0, 30)}"`);
      }
      return out;
    });
  for (const dial of ['off', 'mild']) {
    await saved(page, { dial, console: 'xbox-s' });
    for (const path of [...SCREENS, '/a/sample-20/', '/topics/settings/', '/no-such-page/']) {
      await page.goto(path);
      expect(await small(), `${path} at ${dial}`).toEqual([]);
    }
  }
  await page.goto('/');
  await press(page.locator('.chip--dial'));
  await expect(page.locator('#settings')).toBeVisible();
  expect(await small(), 'the open sheet').toEqual([]);
});

test('the header stays on one row at 320, with the console chip and the raised dial, at 130% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await saved(page, { console: 'xbox-x', dial: 'places' });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  const ys = await page.evaluate(() => [...document.querySelectorAll('.site-header__row > *')].map((e) => Math.round(e.getBoundingClientRect().y)));
  expect(new Set(ys).size, 'one row').toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll').toBe(true);
});

// ---- Item 10b: an inline link in running text is at least 24px tall ----
test('every inline link in running text is at least 24px tall, at the default text size and at 130%', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const inline = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main a, .site-footer a')]
        .filter((a) => a.checkVisibility() && getComputedStyle(a).display === 'inline')
        .flatMap((a) => [...a.getClientRects()].map((r) => ({ text: a.textContent.trim().slice(0, 30), h: r.height })))
        .filter((r) => r.h < 24));
  await saved(page, { dial: 'mild', console: 'xbox-s' });
  let seen = 0;
  for (const scale of ['100%', '130%']) {
    for (const path of ['/about/', '/a/pointer-body/', ...PAGES.filter((p) => p.startsWith('/a/')), '/', '/topics/', '/checklist/']) {
      await page.goto(path);
      await page.addStyleTag({ content: `html { font-size: ${scale}; }` });
      seen += await page.locator('main a').count();
      expect(await inline(), `${path} at ${scale}`).toEqual([]);
    }
  }
  expect(seen, 'links were found').toBeGreaterThan(20);
});

// ---- Item 10c: hover only where a fine pointer can hover ----
test('every :hover rule in every page\'s CSS sits inside @media (hover: hover) and (pointer: fine)', async ({ page }) => {
  test.setTimeout(120_000);
  const bad = [];
  let hovers = 0;
  for (const path of PAGES) {
    await page.goto(path);
    const found = await page.evaluate(() => {
      const out = [];
      let n = 0;
      const walk = (rules, ok) => {
        for (const r of rules) {
          if (r instanceof CSSMediaRule) walk(r.cssRules, ok || (/hover: hover/.test(r.conditionText) && /pointer: fine/.test(r.conditionText)));
          else if (r instanceof CSSStyleRule || r.cssRules) {
            if (r.selectorText?.includes(':hover')) { n++; if (!ok) out.push(r.selectorText.slice(0, 80)); }
            if (r.cssRules) walk(r.cssRules, ok);
          }
        }
      };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, false); } catch {} }
      return { out, n };
    });
    hovers += found.n;
    bad.push(...found.out.map((s) => `${path}: ${s}`));
  }
  expect(hovers, 'the hover rules were found at all').toBeGreaterThan(5);
  expect([...new Set(bad)]).toEqual([]);
});
