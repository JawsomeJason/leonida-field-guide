import { test } from '@playwright/test';
import { loadRecords } from '../../scripts/check-leak.mjs';

export const records = loadRecords('tests/fixtures/answers');
/** The none answers ranked 1 to 20, best first. */
export const ranked = records.filter((a) => a.tier === 'none' && a.rank <= 20).sort((a, b) => a.rank - b.rank);

/** One screen of every kind, as paths of the fixture build. */
export const SCREENS = ['/', '/topics/', '/topics/settings/', '/a/sample-02/', '/checklist/', '/new/', '/places/', '/about/'];

export const NIGHT = 'rgb(24, 19, 32)';
export const DAY = 'rgb(246, 239, 226)';

/** Tap on a touch project, click otherwise. */
export const press = (locator) => (test.info().project.use.hasTouch ? locator.tap() : locator.click());

/** Start the page with these saved settings (runs before every load of the page). */
export const saved = (page, settings) => page.addInitScript((s) => localStorage.setItem('lfg:v1', JSON.stringify(s)), settings);

export const setDial = (page, label) => press(page.getByRole('radio', { name: label, exact: true }));
export const setTheme = async (page, label) => {
  await press(page.locator('.chip'));
  await press(page.locator('#settings').getByRole('radio', { name: label, exact: true }));
};

/**
 * The real touch targets of the page, measured by what receives a tap, not by what the markup says.
 * For every interactive element, sample the points around it (every 2px, over the element and the row, card or label that holds it)
 * and keep the ones where document.elementFromPoint() lands on a thing that activates that element: itself, a child, its label,
 * or a link stretched over a card. The bounding box of those points is the hit area. A 24px checkbox in a 48px label is judged
 * as the label, and a control another element covers is judged as what is left. Nothing is skipped for being "part of" something
 * bigger. The page is measured in one tall viewport, so nothing needs scrolling.
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
    // A link inside a sentence is exempt (spec "Touch"): inline, and the text around it is more than the link.
    const inSentence = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement.textContent.trim() !== el.textContent.trim();

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
      if (!pts.length) { areas.push({ name, covered: true, layer: layerOf(el), pts }); continue; }
      // Pixel-exact edges: walk each side outward from the coarse points while a tap still reaches the control.
      const xs = [...new Set(pts.map((p) => p[0]))], ys = [...new Set(pts.map((p) => p[1]))];
      const reach = (x, y) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && activates(x, y) === el;
      let l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
      while (ys.some((y) => reach(l - 1, y))) l--;
      while (ys.some((y) => reach(r + 1, y))) r++;
      while (xs.some((x) => reach(x, t - 1))) t--;
      while (xs.some((x) => reach(x, b + 1))) b++;
      areas.push({ name, layer: layerOf(el), x: l - 0.5, y: t - 0.5, w: r - l + 1, h: b - t + 1, pts });
    }
    // Sampling to the pixel is good to about a pixel: sizes under 47 and gaps under 7 are the failures.
    const problems = [];
    for (const a of areas) {
      if (a.covered) problems.push(`${a.name} is covered: a tap on it lands elsewhere`);
      else if (a.w < 47 || a.h < 47) problems.push(`${a.name} has a hit area of ${Math.round(a.w)}x${Math.round(a.h)}`);
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
    const live = areas.filter((a) => !a.covered);
    const small = live.reduce((m, a) => (Math.min(a.w, a.h) < Math.min(m.w, m.h) ? a : m), live[0]);
    return { problems, smallest: `${Math.round(small.w)}x${Math.round(small.h)} ${small.name}`, count: live.length };
  });
  await page.setViewportSize({ width, height: was });
  return result;
}
