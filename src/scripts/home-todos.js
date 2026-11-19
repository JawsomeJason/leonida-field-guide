import { read, write } from './settings.js';
import { applies } from '../lib/console.js';

// Ticks live in the `done` array of lfg:v1, the same list the checklist page uses.
const boxes = [...document.querySelectorAll('input[data-todo]')];
const next = document.querySelector('.next-up');
const fold = document.querySelector('.stage-fold');
let chosen; // whether a console was chosen at the last sync; the fold opens or closes only when that changes, so a player's own open or close stays

const doneSet = () => new Set(Array.isArray(read().done) ? read().done : []); // storage is user-editable

const h = (tag, props, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

// The steps of the stored stage that fit the console.
const stepsOf = ({ console, stage }) => [...document.querySelectorAll(`.stage[data-stage="${stage}"] .todo-list .todo`)]
  .filter((li) => applies(li.dataset.only, console))
  .map((li) => ({ id: li.querySelector('input').dataset.todo, label: li.querySelector('span').textContent, href: li.querySelector('.todo__open').getAttribute('href') }));

// "See all N steps": the fold's row counts the same steps; with a console chosen the fold starts closed.
function drawFold(steps, console) {
  if (!fold) return;
  const summary = fold.querySelector('summary');
  summary.hidden = !steps.length;
  if (!steps.length) fold.open = true; // nothing to fold: the empty-stage line must show
  summary.textContent = `See all ${steps.length} step${steps.length === 1 ? '' : 's'}`;
  if (chosen !== undefined && chosen !== !!console) fold.open = !console;
  chosen = !!console;
}

// "Next up": the next two unticked steps of the stored stage that fit the console, and how far along the stage is.
function drawNext(done, steps) {
  if (!next) return;
  next.hidden = !steps.length;
  const left = steps.filter((s) => !done.has(s.id));
  const rows = left.length ? left.slice(0, 2) : [{ label: 'All done in this stage. See the checklist', href: '/checklist/' }];
  next.querySelector('.next-up__list').replaceChildren(...rows.map((r) => h('li', {}, h('a', { href: r.href, textContent: r.label }))));
  next.querySelector('.next-up__count').replaceChildren(`${steps.length - left.length} of ${steps.length} done`, h('span', { className: 'sr-only', textContent: '. Open the checklist' }));
}

function sync() {
  const done = doneSet();
  const settings = read();
  const { console } = settings;
  for (const b of boxes) b.checked = done.has(b.dataset.todo);
  for (const el of document.querySelectorAll('[data-count]')) {
    // Only the to-dos for this console count; a console-only one for another console sits in the fold.
    const mine = boxes.filter((b) => b.closest('[data-stage]') === el.closest('[data-stage]') && applies(b.closest('[data-only]')?.dataset.only, console));
    el.textContent = `${mine.filter((b) => b.checked).length} of ${mine.length} done`;
  }
  const steps = stepsOf(settings);
  drawFold(steps, console);
  drawNext(done, steps);
}

addEventListener('change', (e) => {
  const id = e.target.dataset?.todo;
  if (!id) return;
  const done = doneSet();
  e.target.checked ? done.add(id) : done.delete(id);
  write({ done: [...done] });
  sync();
});
addEventListener('pageshow', sync); // also fires when the page comes back from the back-forward cache
addEventListener('storage', sync);
addEventListener('lfg:change', sync); // a setting or a tick changed here, or the sync brought in a change from another device
