// Hidden text only ever arrives from /h/<tier>/ and only here: on a deliberate tap on a reveal
// control, or because the dial allows that tier. Never on scroll, hover or a nearby tap.
// Below the tier the server refuses these files (302 to the gate page) unless the request carries the reveal marker,
// which only a tap adds, so a redirected answer is a refusal, never content.
import { read } from './settings.js';

const RANK = { off: 0, places: 1, mild: 2 };
const allowed = (tier) => RANK[tier] <= RANK[read().dial];

const pages = new Map();
function load(url, tap) {
  if (!pages.has(url)) {
    const p = fetch(url, tap ? { headers: { 'x-lfg-reveal': '1' } } : undefined).then((r) => (r.ok && !r.redirected ? r.text() : Promise.reject(r.status)));
    p.catch(() => pages.delete(url)); // a failed load can be tried again
    pages.set(url, p);
  }
  return pages.get(url);
}
function parse(html) {
  const { content } = Object.assign(document.createElement('template'), { innerHTML: html });
  for (const s of content.querySelectorAll('style')) s.remove(); // fragments carry inlined CSS the page already has
  return content;
}

async function open(box, auto) {
  const btn = box.querySelector('.reveal__btn');
  const out = box.querySelector('.reveal__out');
  try {
    out.replaceChildren(parse(await load(btn.dataset.src, !auto)));
  } catch {
    if (!auto) location.href = btn.href; // no script path: the detail's own page
    return;
  }
  box.dataset.open = auto ? 'auto' : 'tap';
  btn.hidden = true;
  out.hidden = false;
  if (!auto) out.focus();
}

function close(box) {
  box.querySelector('.reveal__out').hidden = true;
  box.querySelector('.reveal__btn').hidden = false;
  delete box.dataset.open;
}

let seq = 0;
async function sync() {
  const n = ++seq;
  // A gate page forwards to its explicit address once the dial reaches its tier. The link carries the marker, so a missing cookie cannot loop.
  for (const gate of document.querySelectorAll('[data-gate]')) if (allowed(gate.dataset.gate)) return location.replace(gate.querySelector('.guard__show').href);
  for (const box of document.querySelectorAll('[data-reveal]')) {
    if (allowed(box.dataset.tier)) box.dataset.open || open(box, true);
    else if (box.dataset.open === 'auto') close(box);
  }
  for (const mount of document.querySelectorAll('[data-hidden-list]')) {
    const tiers = mount.dataset.tiers.split(' ').filter(allowed);
    const parts = await Promise.all(tiers.map((t) => load(`/h/${t}/a/`).catch(() => null)));
    if (n !== seq) return; // the dial moved again while loading
    const ul = Object.assign(document.createElement('ul'), { className: 'cards' });
    for (const html of parts) if (html) ul.append(parse(html));
    if (mount.dataset.topic) for (const li of [...ul.children]) if (li.dataset.topic !== mount.dataset.topic) li.remove();
    const note = (text) => Object.assign(document.createElement('p'), { textContent: text, role: 'status' });
    mount.replaceChildren(
      ...(ul.children.length ? [ul] : tiers.length && mount.dataset.empty ? [note(mount.dataset.empty)] : []),
      ...(parts.includes(null) ? [note('Some answers did not load. Check your connection and try again.')] : []),
    );
  }
}

addEventListener('click', (e) => {
  const btn = e.target.closest?.('.reveal__btn');
  if (!btn || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; // new-tab clicks keep the link
  e.preventDefault();
  open(btn.closest('[data-reveal]'), false);
});
addEventListener('lfg:change', sync);
sync();
