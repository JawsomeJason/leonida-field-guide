import { read, write } from './settings.js';

// Ticks live in the `done` array of lfg:v1, the same list the checklist page uses.
const boxes = [...document.querySelectorAll('input[data-todo]')];

const doneSet = () => new Set(Array.isArray(read().done) ? read().done : []); // storage is user-editable

function sync() {
  const done = doneSet();
  for (const b of boxes) b.checked = done.has(b.dataset.todo);
  for (const el of document.querySelectorAll('[data-count]')) {
    const mine = boxes.filter((b) => b.closest('[data-stage]') === el.closest('[data-stage]'));
    el.textContent = `${mine.filter((b) => b.checked).length} of ${mine.length} done`;
  }
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
