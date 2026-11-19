import { test, expect } from '@playwright/test';
import { PAGES, saved, DAY, NIGHT } from './helpers.mjs';

// Fix round 6. One rule for links: a link in running text is the underlined accent link; a link that is a whole row, card or
// button is that component. The walk below fails on any anchor that is neither, on every screen, in both themes.

/** Anchors that are neither a component nor running text on purpose, by selector (spec "Look", Links). */
export const EXEMPT = [
  '.site-name', // the logo link: the sun mark and the site name
  '.nav a', // the tab bar and the rail: the current tab is lit, the others are labels in a bar
];

/** The anchors on the open page that are not a row, card or button with a visible affordance, and not an underlined accent link. */
export const strayLinks = (page, exempt = EXEMPT) => page.evaluate((exempt) => {
  const probe = (token) => {
    const s = document.createElement('span');
    s.style.color = `var(${token})`;
    document.body.append(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  };
  const link = [probe('--accent'), probe('--action')];
  const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    if (!a.checkVisibility({ checkVisibilityCSS: true })) continue;
    if (exempt.some((sel) => a.matches(sel))) continue;
    const cs = getComputedStyle(a);
    // (a) a component: a button, a chip, a card, or a row that shows it can be tapped (a card edge, or an arrow at its end).
    const arrow = a.querySelector('svg') || getComputedStyle(a, '::after').content !== 'none';
    const row = a.matches('.tap-list a, .tile') && (a.closest('.tap-list--cards') || arrow);
    const component = a.matches('.btn, .chip, .gate__on, .reveal__btn, .guard__show, .guard__back') || a.closest('.card__q') || row;
    // (b) running text: underlined, in the accent (or action) colour.
    const text = cs.textDecorationLine.includes('underline') && link.includes(cs.color);
    if (!component && !text) {
      const path = [];
      for (let n = a; n && n !== document.body && path.length < 3; n = n.parentElement) path.unshift(n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/)[0] : ''));
      out.push(`${path.join(' > ')} "${a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}" (${cs.textDecorationLine}, ${cs.color})`);
    }
  }
  return out;
}, exempt);

for (const [theme, bg, scheme] of [['day', DAY, 'light'], ['night', NIGHT, 'dark']]) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`every anchor on every page is a component or an underlined accent link (${theme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await saved(page, { theme });
      const found = [];
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.locator('body')).toHaveCSS('background-color', bg);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
        found.push(...(await strayLinks(page)).map((f) => `${path}: ${f}`));
      }
      expect(found).toEqual([]);
    });

    // The states a page only reaches by doing something: the search with no answer, the where-is note at Off and at Places, the Places gate
    // at each level, an answer with outside sources, a page for another console.
    const states = [
      { name: 'search with no answer', path: '/', settings: {}, search: 'zzqx nothing here', waits: 'a[href="/topics/"]' },
      { name: 'where-is note at Off', path: '/', settings: {}, search: 'where is the beach', waits: '.where-off a' },
      { name: 'where-is note at Places', path: '/', settings: { dial: 'places' }, search: 'where is the beach', waits: '[data-maps] a' },
      { name: 'Places gate at Places', path: '/places/', settings: { dial: 'places' }, waits: '#hidden-list a, .tap-list a' },
      { name: 'Places gate at Mild', path: '/places/', settings: { dial: 'mild' }, waits: '#hidden-list a, .tap-list a' },
      { name: 'answer with sources, Series S', path: '/a/sample-04/', settings: { console: 'xbox-s' }, waits: '[data-outside] a' },
    ];
    for (const s of states) {
      test(`${s.name} (${theme}): no anchor looks like plain text`, async ({ page }) => {
        await saved(page, { ...s.settings, theme });
        await page.goto(s.path);
        if (s.search) await page.getByRole('searchbox').fill(s.search);
        await page.waitForLoadState('networkidle');
        await expect(page.locator(s.waits).first()).toBeVisible();
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
        expect(await strayLinks(page)).toEqual([]);
      });
    }
  });
}

test('the link walk can fail: it flags a bare link in a paragraph and a bare link in a list row, and passes the real ones', async ({ page }) => {
  await page.goto('/about/');
  const stray = await page.evaluate(() => {
    const main = document.querySelector('main');
    main.insertAdjacentHTML('beforeend', '<p><a id="plain" href="/x/" style="text-decoration:none;color:inherit">plain text link</a></p><ul style="all:revert"><li><a id="bare" href="/y/" style="text-decoration:none;color:inherit">bare row</a></li></ul>');
    return null;
  });
  expect(stray).toBeNull();
  const found = await strayLinks(page);
  expect(found.some((f) => f.includes('plain text link'))).toBe(true);
  expect(found.some((f) => f.includes('bare row'))).toBe(true);
  expect(found.filter((f) => !/plain text link|bare row/.test(f))).toEqual([]);
});

// ---- Item 3: the 8px between stacked rows is the list's own gap (dead space), never margin inside a row's label or link.
test('every stacked list of tappable rows has an 8px gap of its own and no margin inside its rows', async ({ page }) => {
  test.setTimeout(120_000);
  await saved(page, { console: 'xbox-s', dial: 'mild' });
  const found = [];
  for (const path of ['/', '/topics/', '/topics/settings/', '/checklist/', '/a/sample-02/', '/new/', '/places/', '/about/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    found.push(...(await page.evaluate(() => {
      const out = [];
      for (const list of document.querySelectorAll('.tap-list, .tiles, .cards')) {
        if (!list.checkVisibility({ checkVisibilityCSS: true })) continue;
        const rows = [...list.children].filter((li) => li.checkVisibility({ checkVisibilityCSS: true }));
        if (rows.length < 2) continue;
        const cs = getComputedStyle(list);
        const gap = parseFloat(cs.rowGap);
        const name = `${list.tagName.toLowerCase()}.${list.className.split(' ')[0]}`;
        if (!(gap >= 7.99)) out.push(`${name} has a row gap of ${cs.rowGap}`);
        for (const t of list.querySelectorAll('a:not(.card__q a), label')) { // a card's question link pads itself 48px and takes it back with a negative margin: not spacing
          const m = getComputedStyle(t);
          if (t.checkVisibility() && (parseFloat(m.marginTop) || parseFloat(m.marginBottom))) out.push(`${name}: "${t.textContent.trim().slice(0, 30)}" has margin ${m.marginTop} / ${m.marginBottom} inside the row`);
        }
      }
      return out;
    })).map((f) => `${path}: ${f}`));
  }
  expect(found).toEqual([]);
});

// ---- Item 7, each with computed styles.
for (const [theme, scheme] of [['night', 'dark'], ['day', 'light']]) {
  test.describe(`item 7 in ${theme}`, () => {
    test.use({ colorScheme: scheme });

    test('(a) one filled-button colour: the Done button, the Show places button and a selected option all fill with the accent', async ({ page }) => {
      await saved(page, { theme });
      await page.goto('/');
      const accent = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--accent)'; document.body.append(s); return getComputedStyle(s).color; });
      await page.locator('.chip--dial').click();
      await expect(page.locator('#settings .btn')).toBeVisible();
      await expect(page.locator('#settings .btn')).toHaveCSS('background-color', accent);
      await expect(page.locator('#settings .seg label:has(:checked)').first()).toHaveCSS('background-color', accent);
      await page.keyboard.press('Escape');
      await page.goto('/places/');
      await expect(page.locator('button.gate__on')).toHaveCSS('background-color', accent);
    });

    test('(b) search result titles are a step heavier than their snippets', async ({ page }) => {
      await saved(page, { theme });
      await page.goto('/');
      await page.getByRole('searchbox').fill('sample');
      const q = page.locator('#q-results .q').first();
      await expect(q).toBeVisible();
      const [title, snippet] = await Promise.all([q.evaluate((e) => +getComputedStyle(e).fontWeight), page.locator('#q-results .s').first().evaluate((e) => +getComputedStyle(e).fontWeight)]);
      expect(title).toBeGreaterThanOrEqual(600);
      expect(snippet).toBeLessThanOrEqual(400);
    });

    test('(c) the Works offline notice is information: a neutral edge on the surface, not the accent', async ({ page }) => {
      await saved(page, { theme });
      await page.goto('/new/');
      await page.evaluate(() => (document.querySelector('[data-offline]').hidden = false)); // offline.js shows it once the cache is ready
      const note = page.locator('[data-offline]');
      const [line, surface, accent] = await page.evaluate(() => ['--line', '--surface', '--accent'].map((t) => { const s = document.createElement('span'); s.style.color = `var(${t})`; document.body.append(s); return getComputedStyle(s).color; }));
      await expect(note).toHaveCSS('border-top-color', line);
      await expect(note).toHaveCSS('background-color', surface);
      expect(await note.evaluate((e) => getComputedStyle(e).borderTopColor)).not.toBe(accent);
    });

    test('(d) the tab for the section stays lit: Ask on /, an answer and its siblings; Topics on a cheat sheet; the others on their own page', async ({ page }) => {
      await saved(page, { theme });
      const lit = async (path) => {
        await page.goto(path);
        return page.locator('.nav a[aria-current]').evaluateAll((as) => as.map((a) => a.textContent.trim()));
      };
      expect(await lit('/')).toEqual(['Ask']);
      expect(await lit('/a/sample-02/')).toEqual(['Ask']);
      expect(await lit('/topics/')).toEqual(['Topics']);
      expect(await lit('/topics/settings/')).toEqual(['Topics']);
      expect(await lit('/checklist/')).toEqual(['Checklist']);
      expect(await lit('/new/')).toEqual(['New']);
      await page.goto('/a/sample-02/');
      const ask = page.locator('.nav a', { hasText: 'Ask' });
      const accent = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--accent)'; document.body.append(s); return getComputedStyle(s).color; });
      await expect(ask).toHaveCSS('color', accent);
    });
  });
}
