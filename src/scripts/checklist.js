// Checklist ticks, progress, and the export/import panel. Reads and writes only through settings.js;
// the code format lives in state-code.js.
import { absorb, read, state, write } from './settings.js';
import { encode, decode } from './state-code.js';

const $ = (sel, root = document) => root.querySelector(sel);

function paint() {
  const done = new Set(read().done);
  let ticked = 0;
  let total = 0;
  for (const section of document.querySelectorAll('[data-stage]')) {
    const boxes = section.querySelectorAll('input[data-todo]');
    for (const box of boxes) box.checked = done.has(box.value);
    const n = [...boxes].filter((b) => b.checked).length;
    ticked += n;
    total += boxes.length;
    if (boxes.length) show(section, n, boxes.length);
  }
  const overall = $('[data-overall]');
  if (overall) show(overall, ticked, total);
}

function show(root, n, of) {
  $('[data-count]', root).textContent = `${n} of ${of} done`;
  $('progress', root).value = n;
}

addEventListener('change', (e) => {
  const box = e.target;
  if (!box.matches?.('input[data-todo]')) return;
  const done = new Set(read().done);
  box.checked ? done.add(box.value) : done.delete(box.value);
  write({ done: [...done] });
  paint();
  fillExport();
});
addEventListener('storage', () => { paint(); fillExport(); }); // another tab changed it
addEventListener('lfg:change', () => { paint(); fillExport(); }); // the sync brought in a change from another device

// Export and import
const out = $('#export-code');
const input = $('#import-code');
const say = (note, text, error = false) => {
  note.textContent = text;
  note.toggleAttribute('data-error', error);
};
function fillExport() {
  if (out) out.value = encode(state());
}

$('#backup')?.addEventListener('toggle', fillExport);
$('#copy-code')?.addEventListener('click', async () => {
  const note = $('#export-note');
  try {
    await navigator.clipboard.writeText(out.value);
    say(note, 'Copied.');
  } catch {
    out.select(); // no clipboard here: leave the code selected for the player to copy
    say(note, 'Copying did not work here. The code is selected, so copy it by hand.', true);
  }
});
$('#import-go')?.addEventListener('click', () => {
  const note = $('#import-note');
  const result = decode(input.value);
  if (!result.ok) return say(note, result.error, true);
  absorb(result.state); // merged in: a newer tick or setting on this device is kept
  dispatchEvent(new Event('lfg:write')); // so the sync copies it on (lfg:change has already repainted)
  input.value = '';
  say(note, 'Progress restored on this device.');
});

paint();
fillExport();
