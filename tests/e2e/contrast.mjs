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
