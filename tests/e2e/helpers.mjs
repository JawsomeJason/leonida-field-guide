import { test } from '@playwright/test';
import { loadRecords } from '../../scripts/check-leak.mjs';

export const records = loadRecords('tests/fixtures/answers');
/** The none answers ranked 1 to 20, best first. */
export const ranked = records.filter((a) => a.tier === 'none' && a.rank <= 20).sort((a, b) => a.rank - b.rank);

/** One screen of every kind, as paths of the fixture build. */
export const SCREENS = ['/', '/topics/', '/topics/settings/', '/a/sample-02/', '/checklist/', '/new/', '/places/', '/about/'];

export const NIGHT = 'rgb(11, 16, 32)';
export const DAY = 'rgb(246, 239, 226)';

/** Tap on a touch project, click otherwise. */
export const press = (locator) => (test.info().project.use.hasTouch ? locator.tap() : locator.click());

/** Start the page with these saved settings (runs before every load of the page). */
export const saved = (page, settings) => page.addInitScript((s) => localStorage.setItem('lfg:v1', JSON.stringify(s)), settings);

export const setDial = (page, label) => press(page.getByRole('radio', { name: label, exact: true }));
export const setTheme = async (page, label) => {
  await press(page.getByText('Settings', { exact: true }));
  await press(page.getByRole('radio', { name: label, exact: true }));
};

/** Every tappable thing a player sees: its box, and its name for reports. Inputs count as their whole label. */
export function targets(page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, summary, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const layer = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.position === 'sticky' || (cs.position === 'absolute' && cs.zIndex !== 'auto')) return [...document.querySelectorAll('*')].indexOf(n);
      }
      return -1; // the page itself
    };
    const inSentence = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement.textContent.trim() !== el.textContent.trim();
    // A label is the target of its input; a link stretched by ::after is a target as big as the card it covers.
    const hit = (el) => (el.labels?.[0] ?? (getComputedStyle(el, '::after').position === 'absolute' && el.offsetParent) ) || el;
    const els = new Set(document.querySelectorAll(sel));
    const boxes = [...els]
      .map((el) => ({ el, r: hit(el).getBoundingClientRect(), cs: getComputedStyle(el) }))
      .filter(({ el, r, cs }) => r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && el.checkVisibility() /* not inside a closed <details> */ && !inSentence(el))
      .filter(({ el }, _, all) => !all.some((o) => o.el !== el && o.el.contains(el))) // an inner part of a bigger target
      .map(({ el, r }) => ({
        name: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 30)}"`,
        x: r.left, y: r.top, w: r.width, h: r.height, layer: layer(el),
      }));
    return boxes.filter((b, i) => boxes.findIndex((o) => o.x === b.x && o.y === b.y && o.w === b.w && o.h === b.h) === i);
  });
}

/** Fails to report: the targets under 48px, and neighbours closer than 8px. Also returns the smallest. */
export function judge(boxes) {
  const problems = [];
  for (const b of boxes) if (b.w < 47.5 || b.h < 47.5) problems.push(`${b.name} is ${Math.round(b.w)}x${Math.round(b.h)}`);
  boxes.forEach((a, i) => {
    for (const b of boxes.slice(i + 1)) {
      if (a.layer !== b.layer) continue; // a fixed bar or open panel floats over the page; it is not a neighbour
      const holds = (o, i) => o.x <= i.x && o.y <= i.y && o.x + o.w >= i.x + i.w && o.y + o.h >= i.y + i.h;
      if (holds(a, b) || holds(b, a)) continue; // a control inside a card is not the card's neighbour
      const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
      const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
      if (Math.hypot(dx, dy) < 7.5) problems.push(`${a.name} and ${b.name} are ${Math.round(Math.hypot(dx, dy))}px apart`);
    }
  });
  const smallest = boxes.reduce((m, b) => (Math.min(b.w, b.h) < Math.min(m.w, m.h) ? b : m), boxes[0]);
  return { problems, smallest: `${Math.round(smallest.w)}x${Math.round(smallest.h)} ${smallest.name}` };
}
