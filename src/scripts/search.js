import { read } from './settings.js';
import { answersFor, asksWhere, asksStory, asksKnown, pagePath } from './search-match.js';
import { textHtml } from '../lib/console.js';
import './reveal.js'; // the loss rows' button opens in place, as on an answer page

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
const notes = { off: document.querySelector('#q-where-off'), on: document.querySelector('#q-where-on') };
const more = document.querySelector('#q-more');

const cache = new Map();
const ready = new Set(); // the tiers whose file has arrived
/** A tier's rows, or null when its file could not load (a refusal or a redirect to the gate is a failure too). */
function load(tier) {
  if (!cache.has(tier)) {
    cache.set(
      tier,
      fetch(tiers[tier].index)
        .then((r) => (r.ok && !r.redirected ? r.json() : Promise.reject()))
        .then((rows) => (ready.add(tier), rows.map((r) => ({ ...r, tier }))))
        .catch(() => (cache.delete(tier), null)), // a failed load is retried on the next keystroke
    );
  }
  return cache.get(tier);
}

function row(r) {
  const li = document.createElement('li');
  li.className = r.loss ? 'ask-loss' : '';
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
  if (r.loss) li.append(lossBox(r)); // a result that warns of a loss never ends on the warning alone: the button is right under it
  return li;
}

// The same markup Reveal.astro writes, with the Off-safe label; reveal.js does the rest.
function lossBox({ id, loss: { tier, label } }) {
  const box = document.createElement('div');
  box.className = 'reveal reveal--warn';
  box.dataset.reveal = '';
  box.dataset.tier = tier;
  box.innerHTML = `<a class="reveal__btn" href="/${tier}/${id}/show/?reveal=1" data-src="/h/${tier}/a/${id}/"><span class="reveal__t"></span></a><div class="reveal__out" tabindex="-1" hidden></div>`;
  box.querySelector('.reveal__t').textContent = label;
  return box;
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

const name = (ts) => tiers[ts.at(-1)].label.toLowerCase() || 'guide'; // "places", "mild"; the default file is "guide"
const FIRST = 5; // the list is cut here until the player asks for more
let run = 0;
let asked = ''; // the query the list was last built for, so a new question starts cut again
let all = false;
let lead = 0; // rows ahead of the answers
async function update() {
  const n = ++run;
  const query = input.value;
  const { dial, console: owned } = read();
  // The note needs no records, so it follows the dial and the query at once, before any file is awaited.
  // A question about where something is gets the where-is note: at Off the no-link sentence and the gate to Places, at Places or Mild "shown at your level" and the outside map links (maps.js fills them from the Places tier once the note is shown). Nothing else carries the gate or a map link. At Off the note says it all: no count above it.
  const typed = !!query.trim();
  const asksPlace = typed && asksWhere(query);
  const was = where.hidden;
  where.querySelector(':scope > .where-off, :scope > .where-on')?.remove();
  if (asksPlace) where.prepend(notes[dial === 'off' ? 'off' : 'on'].content.cloneNode(true));
  where.hidden = !asksPlace;
  if (where.hidden !== was) dispatchEvent(new Event('lfg:note')); // the map links come and go with the note
  const offNote = asksPlace && dial === 'off';
  const on = allowed[dial] ?? allowed.off;
  const waiting = on.filter((t) => !ready.has(t));
  // A file that has not arrived is not "no answer": say what is happening, and run the query again when it is here.
  if (typed && waiting.length) {
    status.removeAttribute('data-floor');
    status.textContent = `Loading the ${name(waiting)} answers...`;
    list.hidden = more.hidden = true;
  }
  const loaded = await Promise.all(on.map(load));
  if (n !== run) return; // a newer keystroke is already running
  const records = loaded.flat().filter(Boolean);
  const failed = on.filter((_, i) => !loaded[i]);
  // An answer for other consoles stays out of the way, like the cards do; a console's own name asks for its answers.
  const found = answersFor(records, query, owned);
  if (query !== asked) all = false;
  asked = query;
  const known = typed && asksKnown(query); // the row to the known-problems list is an answer by itself
  const none = typed && !found.length && !known && !failed.length; // answers that could not load are not "no answer"
  const cut = typed && !all && found.length > FIRST;
  lead = known ? 1 : 0;
  list.replaceChildren(...(known ? [link('/new/', 'Known problems and what changed', 'ask-known')] : []), ...(cut ? found.slice(0, FIRST) : found).map(row), ...(none ? [link('/topics/', 'Browse all topics')] : []));
  list.hidden = !typed;
  more.hidden = !cut;
  status.toggleAttribute('data-floor', none && !offNote);
  status.textContent = typed && failed.length ? `The ${name(failed)} answers cannot load right now. Check your connection and type again.` : !typed || offNote || (known && !found.length) ? '' : found.length ? `${found.length} ${found.length === 1 ? 'answer' : 'answers'}` : asksStory(query) ? 'This guide carries no story content, by design.' : 'This guide has no answer for that yet.';
}

input.addEventListener('input', update);
addEventListener('online', update); // a file that could not load is tried again when the connection returns
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
if (input.value) update(); // typed before this script arrived: answer it without another keystroke
