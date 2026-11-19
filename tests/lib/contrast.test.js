// Every text-on-surface pair the site uses, computed from src/styles/tokens.css, in both themes: 4.5 to 1 or the build fails.
// Hover and pressed tints (--wash, --press) are pairs too: a link under a thumb is still read. The browser walk in
// tests/e2e/contrast.mjs checks what is on screen at rest; this one checks the tokens, tints and pressed states included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (open) => {
  const from = css.indexOf(open);
  assert.ok(from >= 0, `${open} not found in tokens.css`);
  const body = css.slice(css.indexOf('{', from) + 1, css.indexOf('}', from));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, k, v]) => [k, v.toLowerCase()]));
};
const themes = {
  day: block(':root {'),
  night: block(":root[data-theme='night']"),
};
// The device-setting copy of the night tokens must match the explicit one, or the two ways into night differ.
const media = block(":root:not([data-theme='day']) {");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, pct) => hex(rgb(a).map((v, i) => (v * pct) / 100 + (rgb(b)[i] * (100 - pct)) / 100)); // color-mix(in srgb, a pct%, b)
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// The surfaces text sits on: the page, a raised card or row, the hover/current tint and the pressed tint (tokens.css: --wash 12%, --press 22%).
const surfaces = (t) => ({ bg: t.bg, surface: t.surface, wash: mix(t.accent, t.surface, 12), press: mix(t.accent, t.surface, 22) });
// [text token, surfaces it is read on]. accent-2 is the error note only (checklist), never on a tint. A filled control carries --bg text.
const PAIRS = [
  ['text', ['bg', 'surface', 'wash', 'press']],
  ['muted', ['bg', 'surface', 'wash', 'press']],
  ['accent', ['bg', 'surface', 'wash', 'press']],
  ['accent-2', ['bg', 'surface']],
];
const FILLS = ['accent', 'action']; // a filled button or selected control: --bg text on it
const FLOOR = 4.5; // no pair is large text (24px, or 18.66px bold), so none gets the 3 to 1 allowance

test('the device-setting night block holds the same colours as the explicit night block', () => {
  for (const k of Object.keys(themes.night)) if (k !== 'shadow') assert.equal(media[k], themes.night[k], `--${k}`);
});

for (const [theme, t] of Object.entries(themes)) {
  const on = surfaces(t);
  for (const [token, where] of PAIRS) {
    for (const surface of where) {
      test(`${theme}: --${token} on ${surface} is at least ${FLOOR} to 1`, () => {
        const r = ratio(t[token], on[surface]);
        assert.ok(r >= FLOOR, `${t[token]} on ${on[surface]} is ${r.toFixed(2)} to 1`);
      });
    }
  }
  for (const fill of FILLS) {
    test(`${theme}: --bg text on a --${fill} fill is at least ${FLOOR} to 1`, () => {
      const r = ratio(t.bg, t[fill]);
      assert.ok(r >= FLOOR, `${t.bg} on ${t[fill]} is ${r.toFixed(2)} to 1`);
    });
  }
}

test('the check can fail: the old day muted on the pressed tint is under the floor', () => {
  const t = { ...themes.day, muted: '#55666b', accent: '#0b6f75' };
  assert.ok(ratio(t.muted, surfaces(t).press) < FLOOR);
});

// ---- Non-text contrast (WCAG 1.4.11): the parts of a control that show where it is or what state it is in, 3 to 1 against what is next to them.
// [part, colour token, what it is next to]. Exempt, on purpose: a text-labelled button or link whose label names it (Show more, the console
// buttons, the Ask rows and cards: their --line border is a hairline, not what identifies them), a card's own border, a hairline between rows,
// and disabled controls (there are none). tests/e2e/contrast.mjs measures the same parts on the real screens.
const NON_TEXT = [
  ['progress track edge', 'edge', ['bg', 'surface', 'wash']],
  ['progress fill on the track', 'accent', ['line']], // the empty part of the track is --line
  ['search box and text area border', 'muted', ['bg', 'surface']],
  ['text area border (backup code boxes)', 'edge', ['bg', 'surface']],
  ['chip border', 'edge', ['bg', 'surface', 'wash']],
  ['dial, console and theme options: border of an unselected option', 'edge', ['bg', 'surface', 'wash']],
  ['dial, console and theme options: the selected fill against the unselected one', 'accent', ['surface']],
  ['sheet level row: border of an unselected row', 'edge', ['bg', 'surface', 'wash']],
  ['sheet level row: the selected row border against the unselected one', 'accent', ['surface']],
  ['sheet radio ring', 'muted', ['surface', 'wash']],
  ['sheet radio, selected fill', 'accent', ['surface', 'wash']],
  ['tick box border', 'muted', ['bg', 'surface', 'wash']],
  ['tick box, ticked fill', 'accent', ['bg', 'surface', 'wash']],
  ['focus ring', 'accent', ['bg', 'surface', 'wash', 'press']],
];
const FLOOR_NON_TEXT = 3;

for (const [theme, t] of Object.entries(themes)) {
  const on = { ...surfaces(t), line: t.line };
  for (const [part, token, where] of NON_TEXT) {
    for (const next of where) {
      test(`${theme}, non-text: ${part}: --${token} on ${next} is at least ${FLOOR_NON_TEXT} to 1`, () => {
        const r = ratio(t[token], on[next]);
        assert.ok(r >= FLOOR_NON_TEXT, `${t[token]} on ${on[next]} is ${r.toFixed(2)} to 1`);
      });
    }
  }
  for (const [mark, ground] of [['bg', 'accent']]) {
    test(`${theme}, non-text: the tick and the radio dot (--${mark}) on the --${ground} fill are at least ${FLOOR_NON_TEXT} to 1`, () => {
      assert.ok(ratio(t[mark], t[ground]) >= FLOOR_NON_TEXT);
    });
  }
}

test('the check can fail: the old progress track (--line) was under 3 to 1 on the page, in both themes', () => {
  for (const t of Object.values(themes)) assert.ok(ratio(t.line, t.bg) < FLOOR_NON_TEXT);
  assert.ok(ratio(themes.night.line, themes.night.bg) < 1.7 && ratio(themes.day.line, themes.day.bg) < 1.4); // 1.62 and 1.35 as measured
});
