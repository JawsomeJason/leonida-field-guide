// A page for one console, opened by a player on another: its rest is folded (a native <details>, open until then), and the
// note above it and its summary show (console.css). Runs on load and whenever a setting changes.
const fold = () => {
  const owned = document.documentElement.dataset.console;
  for (const d of document.querySelectorAll('details.other-fold')) d.open = !(owned && d.dataset.for.split(' ').includes(owned));
};
addEventListener('lfg:change', fold);
fold();
