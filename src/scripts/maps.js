// The outside map links live in the Places tier. This fills each [data-maps] mount from /h/places/maps/ only while the dial allows
// Places, and empties it again when the dial drops. Below Places the server refuses the file (302 to the gate): a redirect is a refusal.
import { read } from './settings.js';

let page;
const load = () => (page ??= fetch('/h/places/maps/').then((r) => (r.ok && !r.redirected ? r.text() : Promise.reject(r.status))).catch((e) => ((page = undefined), Promise.reject(e))));

let seq = 0;
async function sync() {
  const n = ++seq;
  const on = read().dial !== 'off';
  let nodes = [];
  if (on) {
    try {
      const { content } = Object.assign(document.createElement('template'), { innerHTML: await load() });
      content.querySelectorAll('style').forEach((s) => s.remove()); // the page already has the list's CSS
      nodes = [content];
    } catch {
      nodes = [Object.assign(document.createElement('p'), { textContent: 'Outside maps did not load. Check your connection and try again.', role: 'status' })];
    }
  }
  if (n !== seq) return; // the dial moved again while loading
  for (const m of document.querySelectorAll('[data-maps]')) m.replaceChildren(...(m.closest('[hidden]') ? [] : nodes.map((x) => x.cloneNode(true)))); // a mount inside a hidden note (the search's where-is note) holds nothing
}
addEventListener('lfg:change', sync);
addEventListener('lfg:note', sync); // the search showed or hid its where-is note
sync();
