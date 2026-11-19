// A second contrast pass that does not trust axe. It reads the page as a player sees it: every visible text node's colour (with the
// opacity of every ancestor) against the pixels actually painted behind it. Those pixels come from a screenshot taken with all text
// made transparent, so gradients, tints, overlays and semi-transparent layers are what they really are, not what a stylesheet says.
// It returns the text under the WCAG AA floor: 4.5 to 1, or 3 to 1 for large text (24px or more, or 18.66px or more at weight 700).
// Hover and pressed tints are not on screen here: tests/lib/contrast.test.js holds those pairs by token.

const HIDE = `*, *::before, *::after { transition: none !important; color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }
::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }`;
const settle = (page) => page.evaluate(() => Promise.allSettled([document.fonts?.ready, ...document.getAnimations().map((a) => a.finished)])); // a fade still running blends colours

// Every piece of visible text: where it is (CSS px, line by line), its colour, its size and the opacity it is drawn at.
const collect = () => {
  const sheet = document.querySelector(':popover-open'); // an open sheet puts a scrim over the page: judge the sheet only
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  const name = (el) => `${el.localName}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const items = [];
  const add = (el, text, color, rects) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || (sheet && !sheet.contains(el))) return;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    // Only what is not cut off: a box that clips its content (the 1px visually-hidden spans) leaves nothing to read outside it.
    const clips = [];
    for (let n = el; n; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowX !== 'visible' || o.overflowY !== 'visible') clips.push(n.getBoundingClientRect());
    }
    const boxes = rects
      .map((r) => clips.reduce((b, c) => ({ left: Math.max(b.left, c.left), top: Math.max(b.top, c.top), right: Math.min(b.right, c.right), bottom: Math.min(b.bottom, c.bottom) }), r))
      .filter((b) => b.right - b.left >= 2 && b.bottom - b.top >= 2)
      .map((b) => [b.left, b.top, b.right - b.left, b.bottom - b.top]);
    if (boxes.length) items.push({ text: text.trim().slice(0, 40), el: name(el), size: px, color, opacity: opacity(el), need: large ? 3 : 4.5, boxes });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.nodeValue.trim() || /^(script|style|noscript|textarea)$/i.test(el.localName) || el.closest('[hidden], template')) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    add(el, t.nodeValue, getComputedStyle(el).color, [...range.getClientRects()]);
  }
  for (const el of document.querySelectorAll('input:not([type=checkbox], [type=radio]), textarea')) {
    const r = el.getBoundingClientRect();
    const inner = { x: r.x + 6, y: r.y + 6, width: r.width - 12, height: r.height - 12 };
    if (el.value) add(el, el.value, getComputedStyle(el).color, [inner]);
    else if (el.placeholder) add(el, el.placeholder, getComputedStyle(el, '::placeholder').color, [inner]);
  }
  return items;
};

// In the page: the screenshot is an image, so read its pixels with a canvas. `shot` is the PNG as base64.
const judge = async ({ shot, items }) => {
  const bytes = Uint8Array.from(atob(shot), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const read = document.createElement('canvas');
  read.width = bitmap.width;
  read.height = bitmap.height;
  const ctx = read.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const one = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  one.canvas.width = one.canvas.height = 1;
  const rgba = (css) => {
    one.clearRect(0, 0, 1, 1);
    one.fillStyle = css;
    one.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = one.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const channel = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const found = [];
  for (const it of items) {
    const fg = rgba(it.color);
    const alpha = fg[3] * it.opacity;
    let worst = Infinity;
    let on = null;
    for (const [x, y, w, h] of it.boxes) {
      const [sx, sy] = [Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y))];
      const [sw, sh] = [Math.min(bitmap.width - sx, Math.ceil(w)), Math.min(bitmap.height - sy, Math.ceil(h))];
      if (sw < 1 || sh < 1) continue;
      const px = ctx.getImageData(sx, sy, sw, sh).data;
      const step = Math.max(1, Math.floor((sw * sh) / 60)); // about 60 points a box
      for (let i = 0; i < sw * sh; i += step) {
        const bg = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
        const drawn = [0, 1, 2].map((k) => fg[k] * alpha + bg[k] * (1 - alpha));
        const r = ratio(drawn, bg);
        if (r < worst) [worst, on] = [r, bg];
      }
    }
    if (worst < it.need) found.push({ text: it.text, el: it.el, size: it.size, color: it.color, on: `rgb(${on})`, ratio: Math.round(worst * 100) / 100, need: it.need });
  }
  return found;
};

export async function lowContrast(page) {
  const was = page.viewportSize();
  await settle(page);
  // One tall viewport, so nothing needs scrolling and fixed bars sit where the screenshot shows them.
  const height = await page.evaluate(() => Math.min(Math.max(document.documentElement.scrollHeight, innerHeight), 12000));
  await page.setViewportSize({ width: was.width, height });
  try {
    await settle(page);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))); // the resize has reached every layout
    // The page may still be moving (a note that appears when the offline copy is ready): take the text and the picture until they agree.
    for (let tries = 0; ; tries++) {
      const items = await page.evaluate(collect);
      const style = await page.addStyleTag({ content: HIDE });
      const shot = (await page.screenshot({ scale: 'css' })).toString('base64');
      const where = (list) => JSON.stringify(list.map((i) => i.boxes)); // text is transparent now: compare where it is, not what colour
      const still = where(await page.evaluate(collect)) === where(items);
      await style.evaluate((n) => n.remove());
      await settle(page); // the colours fade back in
      if (still || tries === 4) return await page.evaluate(judge, { shot, items });
    }
  } finally {
    await page.setViewportSize(was);
  }
}

// ---- Non-text pass (WCAG 1.4.11): the parts of a control that show where it is or what state it is in, 3 to 1 against what is next to them.
// Measured on the real screen, from computed styles (no screenshot: a border is a colour, not a painted pixel row): the colour of a control's
// edge or fill against what is painted behind it, the selected option against an unselected one, the progress fill on its track, and the focus
// ring. Exempt, on purpose: a text-labelled button or link whose label names it, a card's own border, a hairline between rows, and disabled
// controls (there are none). tests/lib/contrast.test.js holds the same parts by token.
const nonText = () => {
  const one = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  one.canvas.width = one.canvas.height = 1;
  const rgba = (css) => {
    one.clearRect(0, 0, 1, 1);
    one.fillStyle = '#000';
    one.fillStyle = css;
    one.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = one.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, back) => [...[0, 1, 2].map((k) => top[k] * top[3] + back[k] * (1 - top[3])), 1];
  const under = (el) => {
    const layers = [];
    for (let n = el.parentElement; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    return layers.reduceRight((back, c) => over(c, back), [255, 255, 255, 1]);
  };
  const fill = (el) => over(rgba(getComputedStyle(el).backgroundColor), under(el));
  const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const sheet = document.querySelector(':popover-open');
  const shown = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && (!sheet || sheet.contains(el));
  const name = (el) => `${el.localName}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const css = (c) => `rgb(${c.slice(0, 3).map(Math.round)})`;
  const found = [];
  const check = (part, el, colour, back) => {
    const r = ratio(colour, back);
    if (r < 3) found.push({ part, el: name(el), colour: css(colour), on: css(back), ratio: Math.round(r * 100) / 100 });
  };

  const PARTS = {
    'progress track': 'progress',
    'text box': 'textarea, input[type=search], input[type=text]',
    chip: '.chip',
    'option of the dial, console, theme and stage': '.seg label',
    'level row': '.levels label',
    'tick box': '.todo input',
    'radio ring': '.levels input',
  };
  for (const [part, sel] of Object.entries(PARTS)) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el)) continue;
      const cs = getComputedStyle(el);
      const back = under(el);
      const own = fill(el);
      const edge = parseFloat(cs.borderTopWidth) >= 1 && !['none', 'hidden'].includes(cs.borderTopStyle) ? over(rgba(cs.borderTopColor), own) : null;
      // The control shows where it is by its edge or by its fill: the better of the two against what is behind it.
      const best = [edge, rgba(cs.backgroundColor)[3] > 0 ? own : null].filter(Boolean).sort((a, b) => ratio(b, back) - ratio(a, back))[0];
      if (!best) found.push({ part, el: name(el), colour: 'no edge and no fill', on: css(back), ratio: 1 });
      else check(part, el, best, back);
      // The fill is drawn with --accent (the pseudo-element's own style cannot be read), on the track's own fill.
      if (el.matches('progress')) check('progress fill on its track', el, rgba(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), own);
    }
  }
  // A selected option against an unselected one.
  for (const group of document.querySelectorAll('.seg, .levels')) {
    if (!shown(group)) continue;
    const [on, off] = group.matches('.seg') ? ['label:has(:checked)', 'label:not(:has(:checked))'] : ['input:checked', 'input:not(:checked)'];
    const [a, b] = [group.querySelector(on), group.querySelector(off)];
    if (a && b && shown(a)) check('selected option against an unselected one', a, fill(a), fill(b));
  }
  return found;
};

// The focus ring, key by key: whatever draws the ring (the control, its label or its card) against what is behind it.
const ring = () => {
  const el = document.activeElement;
  if (!el || el === document.body || !el.matches(':focus-visible')) return null;
  const one = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  one.canvas.width = one.canvas.height = 1;
  const rgba = (css) => (one.clearRect(0, 0, 1, 1), (one.fillStyle = css), one.fillRect(0, 0, 1, 1), [...one.getImageData(0, 0, 1, 1).data].map((v, i) => (i < 3 ? v : v / 255)));
  const over = (top, back) => [...[0, 1, 2].map((k) => top[k] * top[3] + back[k] * (1 - top[3])), 1];
  const under = (n) => {
    const layers = [];
    for (let p = n.parentElement; p; p = p.parentElement) {
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    return layers.reduceRight((back, c) => over(c, back), [255, 255, 255, 1]);
  };
  const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const drawer = [el.closest('label'), el.closest('.card'), el].find((n) => n && parseFloat(getComputedStyle(n).outlineWidth) > 0 && getComputedStyle(n).outlineStyle !== 'none');
  const name = `${el.localName}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  if (!drawer) return { part: 'focus ring', el: name, colour: 'no ring', on: '', ratio: 1 };
  const [c, back] = [over(rgba(getComputedStyle(drawer).outlineColor), under(drawer)), under(drawer)];
  const r = ratio(c, back);
  return r < 3 ? { part: 'focus ring', el: name, colour: `rgb(${c.slice(0, 3).map(Math.round)})`, on: `rgb(${back.slice(0, 3).map(Math.round)})`, ratio: Math.round(r * 100) / 100 } : null;
};

/** The non-text parts of the page under 3 to 1, as drawn. Settles running fades first, then tabs through the page (at most 30 stops). */
export async function lowNonText(page) {
  await settle(page);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true))); // the backup code boxes sit in a closed fold
  const found = await page.evaluate(nonText);
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const bad = await page.evaluate(ring);
    if (bad) found.push(bad);
  }
  return found;
}
