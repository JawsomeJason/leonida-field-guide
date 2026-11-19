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
  // A detail the player opened with a tap can be put away again; one the dial itself shows goes when the dial drops.
  if (!auto) out.append(Object.assign(document.createElement('button'), { type: 'button', className: 'reveal__hide', innerHTML: 'Hide<span class="sr-only"> this detail</span>' }));
  box.dataset.open = auto ? 'auto' : 'tap';
  btn.hidden = true;
  out.hidden = false;
  if (!auto) out.focus();
}

// Takes the revealed text out of the page, not just out of sight, and brings the Show control back.
function close(box) {
  const out = box.querySelector('.reveal__out');
  const btn = box.querySelector('.reveal__btn');
  const focused = out.contains(document.activeElement);
  out.replaceChildren();
  out.hidden = true;
  btn.hidden = false;
  delete box.dataset.open;
  if (focused) btn.focus();
}

let seq = 0;
let level = read().dial;
async function sync() {
  const n = ++seq;
  const lowered = RANK[read().dial] < RANK[level];
  level = read().dial;
  // A gate page forwards to its explicit address once the dial reaches its tier. The link carries the marker, so a missing cookie cannot loop.
  for (const gate of document.querySelectorAll('[data-gate]')) if (allowed(gate.dataset.gate)) return location.replace(gate.querySelector('.guard__show').href);
  for (const box of document.querySelectorAll('[data-reveal]')) {
    if (allowed(box.dataset.tier)) box.dataset.open || open(box, true);
    else if (box.dataset.open && (lowered || box.dataset.open === 'auto')) close(box); // lowering the dial takes every revealed detail out of the page at once
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
addEventListener('click', (e) => {
  const hide = e.target.closest?.('.reveal__hide');
  if (hide) close(hide.closest('[data-reveal]'));
});
addEventListener('lfg:change', sync);
sync();
