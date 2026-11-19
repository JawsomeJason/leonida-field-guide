// A topic whose answers all sit behind a higher level has no count in the page. Once the dial reaches that level, count its answers from the hidden index (loaded only when the dial allows it).
import { read } from './settings.js';

const tiers = { off: [], places: ['places'], mild: ['places', 'mild'] };
const spans = [...document.querySelectorAll('[data-count-topic]')];
async function count() {
  const rows = (await Promise.all((tiers[read().dial] ?? []).map((t) => fetch(`/h/${t}/search.json`).then((r) => (r.ok ? r.json() : [])).catch(() => [])))).flat();
  for (const span of spans) {
    const n = rows.filter((r) => r.topic === span.dataset.countTopic).length;
    span.textContent = n ? `${n} ${n === 1 ? 'answer' : 'answers'}` : '';
  }
}
if (spans.length) {
  count();
  // Registered after settings.js, so the dial has already been saved when this runs.
  addEventListener('change', (e) => e.target.matches?.('input[name="dial"]') && count());
}
