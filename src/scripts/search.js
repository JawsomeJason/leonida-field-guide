import { read } from './settings.js';
import { answersFor, asksWhere, asksStory, asksKnown, pagePath } from './search-match.js';
import { textHtml } from '../lib/console.js';

// Each tier's records live under that tier's own paths; hidden tiers load only when the dial allows them.
const tiers = {
  none: { index: '/search/none.json', label: '' },
  places: { index: '/h/places/search.json', label: 'Places' },
  mild: { index: '/h/mild/search.json', label: 'Mild' },
};
const allowed = { off: ['none'], places: ['none', 'places'], mild: ['none', 'places', 'mild'] };

const form = document.querySelector('#ask');
const input = document.querySelector('#q');
const status = document.querySelector('#q-status');
const list = document.querySelector('#q-results');
const where = document.querySelector('#q-where');
const more = document.querySelector('#q-more');

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
  a.href = pagePath(r.tier, r.id);
  q.className = 'q';
  q.textContent = r.question;
  s.className = 's';
  s.innerHTML = textHtml((tiers[r.tier].label ? `${tiers[r.tier].label}. ` : '') + r.short); // button tokens become button names (both consoles' until one is chosen)
  a.append(q, s);
  li.append(a);
  return li;
}

// A link row in the results list, for the way out when nothing matches.
function link(href, text, className = '') {
  const li = document.createElement('li');
  li.className = className;
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  li.append(a);
  return li;
}

const FIRST = 5; // the list is cut here until the player asks for more
let run = 0;
let asked = ''; // the query the list was last built for, so a new question starts cut again
let all = false;
let lead = 0; // rows ahead of the answers
async function update() {
  const n = ++run;
  const query = input.value;
  const { dial, console: owned } = read();
  const records = (await Promise.all((allowed[dial] ?? allowed.off).map(load))).flat();
  if (n !== run) return; // a newer keystroke is already running
  // An answer for other consoles stays out of the way, like the cards do; a console's own name asks for its answers.
  const found = answersFor(records, query, owned);
  if (query !== asked) all = false;
  asked = query;
  const typed = !!query.trim();
  const known = typed && asksKnown(query); // the row to the known-problems list is an answer by itself
  const none = typed && !found.length && !known;
  const cut = typed && !all && found.length > FIRST;
  lead = known ? 1 : 0;
  list.replaceChildren(...(known ? [link('/new/', 'Known problems and what changed', 'ask-known')] : []), ...(cut ? found.slice(0, FIRST) : found).map(row), ...(none ? [link('/topics/', 'Browse all topics')] : []));
  list.hidden = !typed;
  more.hidden = !cut;
  // A question about where something is gets the where-is note (the Off sentence shows by CSS until the dial allows Places; maps.js then fills OutsideMaps from the Places tier). At Off the note says it all: no count above it.
  where.hidden = !(typed && asksWhere(query));
  const offNote = !where.hidden && dial === 'off';
  status.toggleAttribute('data-floor', none && !offNote);
  status.textContent = !typed || offNote || (known && !found.length) ? '' : found.length ? `${found.length} ${found.length === 1 ? 'answer' : 'answers'}` : asksStory(query) ? 'This guide carries no story content, by design.' : 'This guide has no answer for that yet.';
}

input.addEventListener('input', update);
more.addEventListener('click', async () => {
  all = true;
  await update();
  list.children[FIRST + lead]?.querySelector('a')?.focus(); // focus lands on the first new answer, not on a button that has gone
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur(); // closes the keyboard so the results are in view
});
// Registered after settings.js, so the dial has already been saved when this runs.
addEventListener('change', (e) => e.target.matches?.('input[name="dial"]') && update());
