import { test } from '@playwright/test';
import { loadRecords } from '../../scripts/check-leak.mjs';

export const records = loadRecords('tests/fixtures/answers');
/** The none answers ranked 1 to 20, best first. */
export const ranked = records.filter((a) => a.tier === 'none' && a.rank <= 20).sort((a, b) => a.rank - b.rank);

/** One screen of every kind, as paths of the fixture build. */
export const SCREENS = ['/', '/topics/', '/topics/settings/', '/a/sample-02/', '/checklist/', '/new/', '/places/', '/about/'];

/** Every page of the fixture build (a test keeps this list equal to what the build wrote): screens, cheat sheets, answers, the hidden
 *  tiers' gate and explicit pages, and the 404 (served for any unknown path). */
const TOPICS = ['setup', 'settings', 'controls', 'saving', 'money', 'getting-around', 'bonuses', 'fixes', 'good-to-know', 'places'];
export const PAGES = [
  '/', '/topics/', ...TOPICS.map((t) => `/topics/${t}/`), '/checklist/', '/new/', '/about/', '/places/', '/mild/', '/places/list/', '/places/list/show/', '/no-such-page/',
  ...records.flatMap((a) => {
    const tiers = a.tier === 'none' ? [...new Set((a.reveal ?? []).map((r) => r.tier))] : [a.tier];
    return [...(a.tier === 'none' ? [`/a/${a.id}/`] : []), ...tiers.flatMap((t) => [`/${t}/${a.id}/`, `/${t}/${a.id}/show/`])];
  }),
];

/** The old /a/<id>/ addresses of hidden-tier records: redirect pages in the build, not screens (the page list leaves them out). */
export const OLD_ADDRESSES = records.filter((a) => a.tier !== 'none').map((a) => `/a/${a.id}/`);

export const NIGHT = 'rgb(24, 19, 32)';
export const DAY = 'rgb(246, 239, 226)';

/** Tap on a touch project, click otherwise. */
export const press = (locator) => (test.info().project.use.hasTouch ? locator.tap() : locator.click());

/** Ask, with a console chosen: the full stage list is folded behind "See all N steps"; open it (the player's open or close stays). */
export const openFold = async (page) => {
  const row = page.locator('.stage-fold > summary');
  await row.waitFor();
  if (!(await page.locator('.stage-fold').evaluate((el) => el.open))) await press(row);
};

/** Start the page with these saved settings (runs before every load of the page). */
export const saved = (page, settings) => page.addInitScript((s) => localStorage.setItem('lfg:v1', JSON.stringify(s)), settings);

/** The spoiler level lives in the settings sheet: open it from its chip, then choose (a choice closes the sheet). */
export const setDial = async (page, label) => {
  await press(page.locator('.chip--dial'));
  await press(page.locator('#settings').getByRole('radio', { name: new RegExp(`^${label}\\b`) })); // a level's name carries its meaning: "Places adds where things are"
};
export const setTheme = async (page, label) => {
  await press(page.locator('.chip--console'));
  await press(page.locator('#settings').getByRole('radio', { name: label, exact: true }));
};

/**
 * The real touch targets of the page, measured by what receives a tap, not by what the markup says.
 * For every interactive element, sample the points around it (every 2px, over the element and the row, card or label that holds it)
 * and keep the ones where document.elementFromPoint() lands on a thing that activates that element: itself, a child, its label,
 * or a link stretched over a card. The bounding box of those points is the hit area. A 24px checkbox in a 48px label is judged
 * as the label, and a control another element covers is judged as what is left. Nothing is skipped for being "part of" something
 * bigger. The page is measured in one tall viewport, so nothing needs scrolling.
 * A link, button or summary must ALSO be 48px in its own box (getBoundingClientRect): a link stretched over a card passes the tap test
 * because the card is the target, but a tool that reads boxes (a reviewer, Lighthouse, voice control) sees the bare 20px line, so both
 * must hold. Inputs are judged by the tap only: a 24px tick box inside a 48px label is the label's target.
 * Problems: a hit area under 48px either way; a hit area with another control's hit area closer than 8px (measured between the
 * tappable points, so a button inside a stretched card is judged by the padding around it). Fixed and sticky layers (the header,
 * the tab bar, an open sheet) are neighbours only of what is in the same layer: they float over the page and move against it.
 */
export async function measure(page) {
  const { width, height: was } = page.viewportSize();
  const height = await page.evaluate(() => Math.min(Math.max(document.documentElement.scrollHeight, 600), 7000));
  await page.setViewportSize({ width, height });
  // Settle first: a sheet still sliding in is measured off-screen.
  await page.evaluate(() => Promise.allSettled([document.fonts?.ready, ...document.getAnimations().map((a) => a.finished)])); // a cancelled animation rejects: that is settled too
  const result = await page.evaluate(() => {
    const SEL = 'a[href], button, summary, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const C = 4; // coarse grid; the edges are then found to the pixel
    const layers = new Map();
    const layerOf = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') {
          if (!layers.has(n)) layers.set(n, layers.size + 1);
          return layers.get(n);
        }
      }
      return 0;
    };
    // Which control a tap at (x, y) activates: the nearest control up the tree, or the control a label points at.
    const activates = (x, y) => {
      const hit = document.elementFromPoint(x, y)?.closest(`${SEL}, label`);
      return hit?.matches('label') ? hit.control : hit;
    };
    // The one exemption (spec "Touch"): a link inside a sentence of running text in an answer body or a text page (.prose): inline,
    // with more text around it than the link. A link that is the whole line, or a list item, is not in a sentence.
    const inSentence = (el) => el.tagName === 'A' && !!el.closest('.prose') && getComputedStyle(el).display === 'inline' && el.parentElement.textContent.trim() !== el.textContent.trim();

    // What an open sheet covers is meant to be out of reach until it closes, so only the sheet and the header are judged then.
    const sheets = [...document.querySelectorAll(':popover-open')];
    const behindSheet = (el) => {
      const zones = [el, ...(el.labels ?? []), el.closest('li, article, label, details')].filter(Boolean).map((z) => z.getBoundingClientRect());
      return !sheets.some((s) => s.contains(el)) && sheets.some((s) => {
        const q = s.getBoundingClientRect();
        return zones.some((r) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
      });
    };
    const controls = [...document.querySelectorAll(SEL)].filter((el) => {
      const r = el.getBoundingClientRect();
      return !behindSheet(el) && el.checkVisibility({ checkVisibilityCSS: true }) && (r.width > 0 && r.height > 0 || el.labels?.length) && !inSentence(el);
    });
    const areas = [];
    for (const el of controls) {
      // Where a tap could reach this control from: itself and the row, card or label around it.
      const zones = [el, ...(el.labels ?? []), el.closest('li, article, label, details')].filter(Boolean).map((z) => z.getBoundingClientRect());
      const x0 = Math.max(Math.floor(Math.min(...zones.map((r) => r.left))), 0), x1 = Math.min(Math.ceil(Math.max(...zones.map((r) => r.right))), innerWidth);
      const y0 = Math.max(Math.floor(Math.min(...zones.map((r) => r.top))), 0), y1 = Math.min(Math.ceil(Math.max(...zones.map((r) => r.bottom))), innerHeight);
      const pts = [];
      for (let y = y0 + 0.5; y < y1; y += C) for (let x = x0 + 0.5; x < x1; x += C) if (activates(x, y) === el) pts.push([x, y]);
      const name = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.id || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
      const own = el.matches('a[href], button, summary, [tabindex]') ? el.getBoundingClientRect() : null; // inputs are judged by the tap alone
      if (!pts.length) { areas.push({ name, covered: true, layer: layerOf(el), pts }); continue; }
      // Pixel-exact edges: walk each side outward from the coarse points while a tap still reaches the control.
      const xs = [...new Set(pts.map((p) => p[0]))], ys = [...new Set(pts.map((p) => p[1]))];
      const reach = (x, y) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && activates(x, y) === el;
      let l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
      while (ys.some((y) => reach(l - 1, y))) l--;
      while (ys.some((y) => reach(r + 1, y))) r++;
      while (xs.some((x) => reach(x, t - 1))) t--;
      while (xs.some((x) => reach(x, b + 1))) b++;
      areas.push({ name, layer: layerOf(el), x: l - 0.5, y: t - 0.5, w: r - l + 1, h: b - t + 1, pts, own: own && { w: own.width, h: own.height } });
    }
    // Sampling to the pixel is good to about a pixel: sizes under 47 and gaps under 7 are the failures.
    const problems = [];
    for (const a of areas) {
      if (a.covered) problems.push(`${a.name} is covered: a tap on it lands elsewhere`);
      else if (a.w < 47 || a.h < 47) problems.push(`${a.name} has a hit area of ${Math.round(a.w)}x${Math.round(a.h)}`);
      else if (a.own && (a.own.w < 47 || a.own.h < 47)) problems.push(`${a.name} is ${Math.round(a.own.w)}x${Math.round(a.own.h)} itself, though a tap reaches it`);
    }
    const closest = (as, bs) => {
      let m = Infinity;
      for (const [ax, ay] of as) for (const [bx, by] of bs) m = Math.min(m, Math.hypot(ax - bx, ay - by));
      return m;
    };
    areas.forEach((a, i) => {
      if (a.covered) return;
      for (const b of areas.slice(i + 1)) {
        if (b.covered || a.layer !== b.layer) continue;
        const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
        const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
        const gap = Math.hypot(dx, dy);
        if (gap >= 7 + C) continue;
        if (gap >= 7 && !(dx === 0 && dy === 0)) continue;
        // Boxes that overlap (a button inside a stretched card): only the tappable points count, so judge by those.
        const apart = dx === 0 && dy === 0 ? closest(a.pts, b.pts) - C : gap;
        if (apart < 7) problems.push(`${a.name} and ${b.name} are ${Math.max(Math.round(apart), 0)}px apart`);
      }
    });
    // Neighbours in one list or stack (fix round 6): the gap between two neighbouring targets must be real dead space. Take the midpoint of
    // the gap between their hit areas and ask what a tap there reaches (elementFromPoint, the same as a thumb): it must be neither of them.
    // The 8px used to sit inside each row's label as margin, so rows looked as if they touched and the check above (which measures the
    // hit areas of the tappable points) could only say "8px". Now the space is the list's own gap and this check holds it, at the middle.
    const host = (el) => (el.closest('li') ?? el.labels?.[0] ?? el).parentElement;
    const ctl = new Map(controls.map((el, i) => [el, areas[i]]));
    const groups = new Map();
    for (const [el, a] of ctl) if (!a.covered) groups.set(host(el), [...(groups.get(host(el)) ?? []), { el, a }]);
    for (const members of groups.values()) {
      members.forEach(({ el: ea, a }, i) => {
        for (const { el: eb, a: b } of members.slice(i + 1)) {
          if (a.layer !== b.layer) continue;
          const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w), oy0 = Math.max(a.y, b.y), oy1 = Math.min(a.y + a.h, b.y + b.h);
          let mid = null;
          if (ox1 > ox0 && oy1 <= oy0) mid = [(ox0 + ox1) / 2, (Math.min(a.y + a.h, b.y + b.h) + Math.max(a.y, b.y)) / 2];
          else if (oy1 > oy0 && ox1 <= ox0) mid = [(Math.min(a.x + a.w, b.x + b.w) + Math.max(a.x, b.x)) / 2, (oy0 + oy1) / 2];
          if (!mid) continue;
          const hit = activates(...mid);
          if (hit === ea || hit === eb) problems.push(`${a.name} and ${b.name} have no dead space between them: a tap in the middle of their gap activates one`);
        }
      });
    }
    const live = areas.filter((a) => !a.covered);
    const small = live.reduce((m, a) => (Math.min(a.w, a.h) < Math.min(m.w, m.h) ? a : m), live[0]);
    const bare = live.filter((a) => a.own).reduce((m, a) => (!m || Math.min(a.own.w, a.own.h) < Math.min(m.own.w, m.own.h) ? a : m), null);
    return {
      problems,
      smallest: `${Math.round(small.w)}x${Math.round(small.h)} ${small.name}` + (bare ? `; smallest box ${Math.round(bare.own.w)}x${Math.round(bare.own.h)} ${bare.name}` : ''),
      count: live.length,
    };
  });
  await page.setViewportSize({ width, height: was });
  return result;
}

/** The words a chip really shows: its label and the one visible value, without the screen-reader-only pieces ("Xbox ", ", change"). */
export const shown = (chip) => chip.evaluate((el) => [...el.querySelectorAll('.chip__k, .chip__v > :not(.sr-only)')]
  .filter((e) => getComputedStyle(e).display !== 'none')
  .map((e) => [...e.childNodes].filter((n) => !n.classList?.contains('sr-only')).map((n) => n.textContent).join('')).join(' '));

/** A slow phone: simulated slow 4G (1.6 Mbps down, 150 ms) and a CPU 4x slower, through the DevTools protocol (Chromium). */
export async function throttle(page, cpu = 4) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
}

/**
 * A fresh slow load, stopped at first paint: the page is on screen, the scripts are not. Holds every /_astro script back for
 * `hold` ms on top of the slow network, so the window is the same on any machine (a real slow phone has it too).
 * Returns once the first contentful paint has happened; the caller then taps.
 */
export async function slowFirstPaint(page, path = '/', hold = 2500) {
  await page.route('**/_astro/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, hold));
    await route.continue().catch(() => {});
  });
  await page.route('**/api/progress', (route) => route.fulfill({ json: { v: 3, items: {} } })); // never the owner's record
  await page.addInitScript(() => {
    new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) window.__painted = true;
    }).observe({ type: 'paint', buffered: true });
  });
  await throttle(page);
  await page.goto(path, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__painted === true, null, { timeout: 20_000 });
}

/** True once any bundled script of the page has finished loading: a tap before this is a tap the scripts could not hear. */
export const scriptsLoaded = (page) => page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('/_astro/') && r.name.endsWith('.js')));
