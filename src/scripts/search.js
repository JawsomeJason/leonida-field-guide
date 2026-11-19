import { read } from './settings.js';
import { match } from './search-match.js';

// Each tier's records live under that tier's own paths; hidden tiers load only when the dial allows them.
const tiers = {
  none: { index: '/search/none.json', page: (id) => `/a/${id}/`, label: '' },
  places: { index: '/h/places/search.json', page: (id) => `/places/a/${id}/`, label: 'Places' },
  mild: { index: '/h/mild/search.json', page: (id) => `/mild/a/${id}/`, label: 'Mild' },
};
const allowed = { off: ['none'], places: ['none', 'places'], mild: ['none', 'places', 'mild'] };

const form = document.querySelector('#ask');
const input = document.querySelector('#q');
const status = document.querySelector('#q-status');
const list = document.querySelector('#q-results');

const cache = new Map();
function load(tier) {
  if (!cache.has(tier)) {
    cache.set(
      tier,
      fetch(tiers[tier].index)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rows) => rows.map((r) => ({ ...r, tier })))
        .catch(() => (cache.delete(tier), [])), // a failed load is retried on the next keystroke
    );
  }
  return cache.get(tier);
}

function row(r) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  const q = document.createElement('span');
  const s = document.createElement('span');
  a.href = tiers[r.tier].page(r.id);
  q.className = 'q';
  q.textContent = r.question;
  s.className = 's';
  s.textContent = (tiers[r.tier].label ? `${tiers[r.tier].label}. ` : '') + r.short;
  a.append(q, s);
  li.append(a);
  return li;
}

let run = 0;
async function update() {
  const n = ++run;
  const query = input.value;
  const records = (await Promise.all((allowed[read().dial] ?? allowed.off).map(load))).flat();
  if (n !== run) return; // a newer keystroke is already running
  const found = match(records, query);
  list.replaceChildren(...found.map(row));
  list.hidden = !query.trim();
  status.textContent = !query.trim() ? '' : found.length ? `${found.length} ${found.length === 1 ? 'answer' : 'answers'}` : 'No answers match. Try fewer words.';
}

input.addEventListener('input', update);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur(); // closes the keyboard so the results are in view
});
// Registered after settings.js, so the dial has already been saved when this runs.
addEventListener('change', (e) => e.target.matches?.('input[name="dial"]') && update());
