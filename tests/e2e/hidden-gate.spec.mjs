// Hidden pages have two addresses: a gate that holds none of the hidden text, and an explicit page that holds it all.
// The server (tests/e2e/serve.mjs applies the same pure rule as middleware.ts) backs the spoiler dial with the lfg_dial cookie.
import { test, expect } from '@playwright/test';
import { press, saved, setDial } from './helpers.mjs';

// [gate address, explicit address, tier, a phrase only the hidden text holds, the hidden keyword]
const pages = [
  ['/places/list/', '/places/list/show/', 'places', /quokka marker/i, 'zebra kiosk'],
  ['/places/place-01/', '/places/place-01/show/', 'places', /quokka marker/i, 'zebra kiosk'],
  ['/places/sample-02/', '/places/sample-02/show/', 'places', /Quokka note one/, 'zebra kiosk'],
  ['/mild/mild-01/', '/mild/mild-01/show/', 'mild', /wombat switch/i, 'wallaby lever'],
  ['/mild/sample-02/', '/mild/sample-02/show/', 'mild', /Wombat note one/, 'wallaby lever'],
];
const hiddenRequest = /\/(h\/(places|mild)\/|(places|mild)\/[^/]+\/show\/)/;
const body = (page) => page.evaluate(() => document.body.innerText);
const noFollow = (page, path, headers) => page.request.get(path, { maxRedirects: 0, headers });

test.describe('the gate address holds none of the hidden text, the explicit address all of it', () => {
  for (const [gate, explicit, tier, secret, keyword] of pages) {
    test(`${gate}`, async ({ page }) => {
      const html = await (await page.request.get(gate)).text();
      expect(html, 'hidden text in the gate page markup').not.toMatch(secret);
      expect(html).not.toContain(keyword);
      expect(html).toMatch(/<title>Hidden page · /);
      expect(html).toMatch(/<meta name="description" content="[^"]*closed until the spoiler setting allows it/);
      expect(html).toContain(`href="${explicit}?reveal=1"`);
      expect(html).not.toMatch(/rel="?(prefetch|prerender|preload|modulepreload)"?[^>]*href="?\/(places|mild|h)\//);
      expect(html).not.toContain('speculationrules');

      await page.goto(gate);
      const text = await body(page);
      expect(text).toContain('Hidden page');
      expect(text).toContain(tier === 'places' ? 'a places page' : 'a mild gameplay detail');
      expect(text).toContain('below');
      expect(await page.title()).toBe('Hidden page · Leonida Field Guide');
      await expect(page.getByRole('link', { name: 'Go back to Ask' })).toHaveAttribute('href', '/');

      expect(await (await page.request.get(`${explicit}?reveal=1`)).text(), 'the explicit address holds the text').toMatch(secret);
    });
  }

  test('the tier gates /places/ and /mild/ say nothing hidden', async ({ page }) => {
    for (const path of ['/places/', '/mild/']) {
      const html = await (await page.request.get(path)).text();
      for (const [, , , secret, keyword] of pages) {
        expect(html).not.toMatch(secret);
        expect(html).not.toContain(keyword);
      }
    }
  });
});

test.describe('the server backs the dial', () => {
  test('at Off (or with no cookie) a typed explicit address, fragment, index or list goes to its gate page', async ({ page }) => {
    const cases = [
      ...pages.map(([gate, explicit]) => [explicit, gate]),
      ['/h/mild/a/sample-02/', '/mild/sample-02/'],
      ['/h/places/a/sample-02/', '/places/sample-02/'],
      ['/h/places/a/', '/places/'],
      ['/h/places/search.json', '/places/'],
      ['/h/mild/search.json', '/mild/'],
      ['/h/mild/offline-urls.json', '/mild/'],
    ];
    for (const cookie of [undefined, 'lfg_dial=off', 'lfg_dial=bogus']) {
      for (const [path, to] of cases) {
        const res = await noFollow(page, path, cookie && { cookie });
        expect(res.status(), `${path} ${cookie}`).toBe(302);
        expect(res.headers().location).toBe(to);
      }
    }
    await page.goto(pages[3][1]); // typed into the address bar
    await expect(page).toHaveURL(pages[3][0]);
    expect(await body(page)).not.toMatch(pages[3][3]);
  });

  test('Places opens the places pages and sends the mild ones to their gate; Mild opens both', async ({ page }) => {
    const get = async (path, dial) => (await noFollow(page, path, { cookie: `lfg_dial=${dial}` })).status();
    for (const [, explicit, tier] of pages) {
      expect(await get(explicit, 'places'), explicit).toBe(tier === 'places' ? 200 : 302);
      expect(await get(explicit, 'mild'), explicit).toBe(200);
    }
    expect(await get('/h/places/search.json', 'places')).toBe(200);
    expect(await get('/h/mild/search.json', 'places')).toBe(302);
    expect(await get('/h/mild/search.json', 'mild')).toBe(200);
    expect(await get('/h/mild/a/sample-02/', 'places')).toBe(302);
    expect(await get('/h/mild/a/sample-02/', 'mild')).toBe(200);
  });

  test('one explicit reveal opens one item at Off: the header or the query, never an index or a list', async ({ page }) => {
    const header = { 'x-lfg-reveal': '1' };
    expect((await noFollow(page, '/h/mild/a/sample-02/', header)).status()).toBe(200);
    expect((await noFollow(page, '/mild/mild-01/show/', header)).status()).toBe(200);
    expect((await noFollow(page, '/mild/mild-01/show/?reveal=1')).status()).toBe(200);
    expect((await noFollow(page, '/places/list/show/?reveal=1')).status()).toBe(200);
    for (const path of ['/h/mild/search.json', '/h/places/search.json', '/h/places/a/', '/h/mild/offline-urls.json']) {
      expect((await noFollow(page, path, header)).status(), path).toBe(302);
      expect((await noFollow(page, `${path}?reveal=1`)).status(), path).toBe(302);
    }
  });

  test('dot segments and encoded dots do not get round it', async ({ page }) => {
    for (const path of ['/places/%2e%2e/places/place-01/show/', '/%70laces/place-01/show/', '/h/%6dild/search.json']) {
      const res = await noFollow(page, path);
      expect(res.status(), path).toBe(302);
    }
  });
});

test.describe('with script', () => {
  test('the dial is mirrored into a device cookie: the level word, once on load and on every change', async ({ page, context }) => {
    const dial = async () => (await context.cookies()).find((c) => c.name === 'lfg_dial');
    await saved(page, { dial: 'mild' }); // an existing device: the dial is stored, the cookie is not there yet
    await page.goto('/');
    await expect.poll(async () => (await dial())?.value).toBe('mild');
    const c = await dial();
    expect(c).toMatchObject({ path: '/', sameSite: 'Lax', httpOnly: false });
    expect(c.expires - Date.now() / 1000).toBeGreaterThan(300 * 24 * 3600);
    await setDial(page, 'Places');
    await expect.poll(async () => (await dial())?.value).toBe('places');
    await setDial(page, 'Off');
    await expect.poll(async () => (await dial())?.value).toBe('off');
  });

  test('at Off nothing fetches a hidden address, and the gate does not either', async ({ page }) => {
    const seen = [];
    page.on('request', (r) => hiddenRequest.test(new URL(r.url()).pathname) && seen.push(r.url()));
    for (const path of ['/', '/topics/', '/topics/places/', '/a/sample-02/', '/places/', '/mild/', ...pages.map(([gate]) => gate)]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(seen).toEqual([]);
  });

  test('the Show control on an answer is one tap that fills in place, asks with the reveal marker, and never navigates', async ({ page }) => {
    await page.goto('/a/sample-02/');
    await expect(page.getByText('Wombat note one')).toHaveCount(0);
    const asked = page.waitForRequest((r) => hiddenRequest.test(new URL(r.url()).pathname));
    await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
    expect((await asked).headers()['x-lfg-reveal']).toBe('1');
    await expect(page.getByText('Wombat note one')).toBeVisible();
    await expect(page).toHaveURL(/\/a\/sample-02\/$/);
    expect(await page.evaluate(() => document.documentElement.dataset.dial ?? 'off')).toBe('off'); // the dial does not change
  });

  // Revealed detail (spec "The spoiler dial", Tap to show): a calm gold rule, a Hide control, and nothing left behind when the dial drops.
  const inDom = (page, text) => page.evaluate((t) => document.documentElement.outerHTML.includes(t), text);
  const showMild = (page) => page.getByRole('link', { name: '1 mild detail hidden. Show' });

  test('a revealed detail has the gold rule the answer uses, not the coral one, and a 48px Hide button that puts it away', async ({ page }) => {
    await page.goto('/a/sample-02/');
    await press(showMild(page));
    await expect(page.getByText('Wombat note one')).toBeVisible();
    const rule = await page.locator('.reveal__out:not([hidden])').evaluate((el) => getComputedStyle(el).borderInlineStartColor);
    const answerRule = await page.locator('.answer__a').evaluate((el) => getComputedStyle(el).borderInlineStartColor);
    const coral = await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--accent-2)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    expect(rule, 'the same gold as the answer block').toBe(answerRule);
    expect(rule, 'not the error colour').not.toBe(coral);
    const hide = page.getByRole('button', { name: /^Hide/ });
    expect((await hide.boundingBox()).height).toBeGreaterThanOrEqual(47.5);
    await press(hide);
    await expect(page.getByText('Wombat note one')).toHaveCount(0);
    expect(await inDom(page, 'Wombat note one'), 'the text is out of the page, not only out of sight').toBe(false);
    await expect(showMild(page)).toBeVisible(); // the control is back, and works again
    await press(showMild(page));
    await expect(page.getByText('Wombat note one')).toBeVisible();
  });

  test('lowering the dial takes revealed text out of the page at once, without a reload, and raising it brings the text back', async ({ page }) => {
    await page.goto('/a/sample-02/');
    await setDial(page, 'Places');
    await press(showMild(page)); // below its tier, so a tap still reveals one detail
    await expect(page.getByText('Wombat note one')).toBeVisible();
    await setDial(page, 'Off');
    expect(await body(page), 'gone from what a player reads').not.toContain('Wombat note one');
    expect(await inDom(page, 'Wombat note one'), 'gone from the DOM').toBe(false);
    await expect(showMild(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Hide/ })).toHaveCount(0);
    await setDial(page, 'Mild'); // the dial itself shows it again
    await expect(page.getByText('Wombat note one')).toBeVisible();
    await setDial(page, 'Off');
    expect(await inDom(page, 'Wombat note one')).toBe(false);
  });

  test('lowering the dial also empties a topic list that script filled with hidden answers', async ({ page }) => {
    await page.goto('/topics/settings/');
    await setDial(page, 'Mild');
    await expect(page.getByRole('heading', { name: 'What does the wombat switch do?' })).toBeVisible();
    await setDial(page, 'Places');
    expect(await inDom(page, 'What does the wombat switch do?'), 'mild answers leave at once when Mild goes').toBe(false);
    await setDial(page, 'Mild');
    await expect(page.getByRole('heading', { name: 'What does the wombat switch do?' })).toBeVisible();
    await setDial(page, 'Off');
    expect(await inDom(page, 'wombat switch'), 'and at Off').toBe(false);
  });

  test('Show on a gate is a link to the explicit address and opens the page, whatever the dial', async ({ page }) => {
    for (const [gate, explicit, , secret] of pages) {
      await page.goto(gate);
      expect(await body(page)).not.toMatch(secret);
      await press(page.getByRole('link', { name: 'Show this page' }));
      await expect(page).toHaveURL(`${explicit}?reveal=1`);
      await expect.poll(() => body(page)).toMatch(secret);
    }
  });

  test('a dial at or above the tier forwards the gate to the explicit address; below it the gate stays', async ({ page }) => {
    for (const dial of ['places', 'mild']) {
      await saved(page, { dial });
      for (const [gate, explicit, tier, secret] of pages) {
        await page.goto(gate);
        if (tier === 'places' || dial === 'mild') {
          await expect(page).toHaveURL(new RegExp(`${explicit}`));
          await expect.poll(() => body(page)).toMatch(secret);
        } else {
          await expect(page).toHaveURL(gate);
          expect(await body(page)).not.toMatch(secret);
        }
      }
    }
  });

  test('raising the dial while on a gate forwards it', async ({ page }) => {
    await page.goto('/places/place-01/');
    await setDial(page, 'Places');
    await expect(page).toHaveURL(/\/places\/place-01\/show\//);
    await expect.poll(() => body(page)).toMatch(/quokka marker/i);
  });

  test('gate controls are 48px with 8px between them', async ({ page }) => {
    await page.goto(pages[0][0]);
    const [a, b] = await Promise.all(['Show this page', 'Go back to Ask'].map((name) => page.getByRole('link', { name }).boundingBox()));
    expect(a.height).toBeGreaterThanOrEqual(47.5);
    expect(b.height).toBeGreaterThanOrEqual(47.5);
    expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(7.5);
  });
});

test.describe('a refused fetch', () => {
  test.use({ serviceWorkers: 'block' }); // page.route cannot see a request the worker forwards

  test('a refused fetch is quiet: the gate page is never inserted as if it were the detail', async ({ page }) => {
    await page.goto('/a/sample-02/');
    // Without the marker the real server refuses with a 302 to the gate page, which fetch follows to a 200 HTML page.
    await page.route('**/h/mild/a/sample-02/', (route) => route.continue({ headers: { ...route.request().headers(), 'x-lfg-reveal': '0' } }));
    await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
    await expect(page).toHaveURL(/\/mild\/sample-02\/show\/\?reveal=1$/); // fell back to the link
    await expect(page.getByText('Hidden page')).toHaveCount(0);
  });
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });

  test('Show is a plain link with the marker, and opens the explicit page below the tier', async ({ page }) => {
    for (const [gate, explicit, , secret] of pages) {
      await page.goto(gate);
      expect(await body(page)).not.toMatch(secret);
      await press(page.getByRole('link', { name: 'Show this page' }));
      await expect(page).toHaveURL(`${explicit}?reveal=1`);
      expect(await body(page)).toMatch(secret);
    }
  });

  test('the Show control on an answer is a link to the detail\'s explicit page', async ({ page }) => {
    await page.goto('/a/sample-02/');
    await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
    await expect(page).toHaveURL('/mild/sample-02/show/?reveal=1');
    await expect(page.getByText('Wombat note one')).toBeVisible();
  });

  test('the places gate leads by plain links to the list, then to the text', async ({ page }) => {
    await page.goto('/places/');
    await expect(page.getByText('quokka marker', { exact: false })).toHaveCount(0);
    await press(page.getByRole('link', { name: 'Show places' }));
    await expect(page).toHaveURL('/places/list/');
    await expect(page.getByText('quokka marker', { exact: false })).toHaveCount(0);
    await press(page.getByRole('link', { name: 'Show this page' }));
    await expect(page.getByRole('heading', { name: 'Where is the quokka marker?' })).toBeVisible();
  });
});
