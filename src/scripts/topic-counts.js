// A topic whose answers all sit behind a higher level has no count in the page. Once the dial reaches that level, count its answers from the hidden index (loaded only when the dial allows it).
import { read } from './settings.js';
import { cannotLoad } from './offline-note.js';

const tiers = { off: [], places: ['places'], mild: ['places', 'mild'] };
const spans = [...document.querySelectorAll('[data-count-topic]')];
const line = Object.assign(document.createElement('p'), { textContent: cannotLoad('The counts', 'them'), role: 'status', hidden: true });
spans[0]?.closest('ul')?.after(line);
async function count() {
  let failed = false;
  const rows = (await Promise.all((tiers[read().dial] ?? []).map((t) => fetch(`/h/${t}/search.json`).then((r) => (r.ok ? r.json() : Promise.reject())).catch(() => ((failed = true), []))))).flat();
  line.hidden = !failed; // the page stays as it is and says why the counts are missing
  for (const span of spans) {
    const n = rows.filter((r) => r.topic === span.dataset.countTopic).length;
    span.textContent = n ? `${n} ${n === 1 ? 'answer' : 'answers'}` : '';
  }
}
if (spans.length) {
  count();
  addEventListener('online', count);
  // Registered after settings.js, so the dial has already been saved when this runs.
  addEventListener('change', (e) => e.target.matches?.('input[name="dial"]') && count());
}
