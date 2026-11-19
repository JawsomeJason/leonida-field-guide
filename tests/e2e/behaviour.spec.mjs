import { test, expect } from '@playwright/test';
import { ranked, press, setDial, setTheme, saved, SCREENS, NIGHT, DAY } from './helpers.mjs';

test.describe('two taps from the home screen', () => {
  for (const a of ranked) {
    test(`#${a.rank} "${a.question}"`, async ({ page }) => {
      await page.goto('/');
      if (a.rank <= 8) {
        await press(page.getByRole('region', { name: 'Most asked' }).getByRole('link', { name: a.question, exact: true }));
        await expect(page.getByRole('heading', { level: 1, name: a.question })).toBeVisible();
      } else {
        await press(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Topics', exact: true }));
        await press(page.locator(`a[href="/topics/${a.topic}/"]`));
        await expect(page.getByRole('heading', { level: 2, name: a.question })).toBeVisible();
        await expect(page.getByText(a.short)).toBeVisible();
      }
    });
  }
});

test('a ticked to-do survives a reload', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('checkbox', { name: 'Do sample thing 01' });
  await expect(box).not.toBeChecked();
  await press(box);
  await expect(box).toBeChecked();
  await page.reload();
  await expect(box).toBeChecked();
  await expect(page.getByText(/^\d+ of \d+ done$/).first()).toBeVisible();
});

test('search finds an answer and takes you to it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('thing 07');
  await press(page.getByRole('search').getByRole('link', { name: /Sample question 07/ }));
  await expect(page.getByRole('heading', { level: 1, name: /Sample question 07/ })).toBeVisible();
});

test('the dial at Off shows no places and at Places shows them', async ({ page }) => {
  await page.goto('/places/');
  await expect(page.getByRole('heading', { name: 'Places are switched off' })).toBeVisible();
  await expect(page.getByText('quokka marker', { exact: false })).toHaveCount(0);
  await page.goto('/topics/');
  await expect(page.locator('a[href="/topics/places/"]').getByText('Locked')).toBeVisible();

  await page.goto('/places/');
  await setDial(page, 'Places');
  await expect(page.getByRole('heading', { name: 'Where is the quokka marker?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Places are switched off' })).toBeHidden();
  await page.goto('/topics/');
  await expect(page.locator('a[href="/topics/places/"]').getByText('Open')).toBeVisible();

  await setDial(page, 'Off');
  await expect(page.locator('a[href="/topics/places/"]').getByText('Locked')).toBeVisible();
});

test('search shows places only once the dial allows them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('quokka marker');
  const hit = page.getByRole('search').getByRole('link', { name: /quokka marker/i });
  await expect(hit).toHaveCount(0);
  await setDial(page, 'Places');
  await page.getByRole('searchbox').fill('quokka marker x');
  await page.getByRole('searchbox').fill('quokka marker');
  await expect(hit).toBeVisible();
});

test('mild stays hidden until the dial is Mild', async ({ page }) => {
  const mild = page.getByRole('heading', { name: 'What does the wombat switch do?' });
  await page.goto('/topics/settings/');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(mild).toHaveCount(0);
  await setDial(page, 'Places');
  await expect(mild).toHaveCount(0);
  await setDial(page, 'Mild');
  await expect(mild).toBeVisible();
});

test('tap to show opens a hidden detail in place and leaves the dial alone', async ({ page }) => {
  await page.goto('/a/sample-02/');
  const note = page.getByText('Wombat note one');
  await expect(note).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 mild detail hidden. Show' }));
  await expect(note).toBeVisible();
  await expect(page).toHaveURL(/\/a\/sample-02\/$/);
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
  await expect(page.getByText('Quokka note one')).toHaveCount(0);
  await press(page.getByRole('link', { name: '1 places detail hidden. Show' }));
  await expect(page.getByText('Quokka note one')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
});

test('the theme switch works and is remembered', async ({ page }) => {
  await page.goto('/about/');
  await setTheme(page, 'Night');
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await page.goto('/new/');
  await expect(page.locator('body')).toHaveCSS('background-color', NIGHT);
  await setTheme(page, 'Day');
  await expect(page.locator('body')).toHaveCSS('background-color', DAY);
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', DAY);
});

test('the console switch changes the button names', async ({ page }) => {
  await page.goto('/a/sample-04/');
  const answer = page.locator('.answer__a');
  // What is on screen, not the text of hidden spans: both consoles' names are in the page.
  const shows = (text) => expect.poll(() => answer.innerText()).toContain(text);
  await shows('Press ✕ to open the sample menu.');
  await press(page.getByRole('button', { name: 'Xbox X', exact: true }));
  await shows('Press A to open the sample menu on this console.');
  await press(page.getByRole('button', { name: 'PS5', exact: true }));
  await shows('Press ✕ to open the sample menu.');
  await setTheme(page, 'Auto'); // opens the menu
  await press(page.getByRole('radio', { name: 'Xbox S', exact: true }));
  await shows('Press A to open the sample menu.');
});

test('the checklist and the other tabs are reachable by the bar', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Topics', 'Checklist', 'New', 'Ask']) {
    await press(nav.getByRole('link', { name, exact: true }));
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('no screen logs an error to the console, with everything shown', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await saved(page, { dial: 'mild' });
  for (const path of [...SCREENS, '/a/sample-04/', '/places/list/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});
