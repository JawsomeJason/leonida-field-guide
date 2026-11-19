// The one place that touches localStorage key `lfg:v1`. Later modules import read() and write().
const KEY = 'lfg:v1';
const defaults = { console: 'ps5', dial: 'off', theme: 'system', stage: 'before', done: [] };

export function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...defaults };
  }
}

function apply(s) {
  const html = document.documentElement;
  html.dataset.console = s.console;
  html.dataset.dial = s.dial;
  if (s.theme === 'day' || s.theme === 'night') html.dataset.theme = s.theme;
  else delete html.dataset.theme;
  for (const input of document.querySelectorAll('input[data-setting]')) input.checked = input.value === s[input.name];
}

export function write(patch) {
  const s = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {} // blocked storage: the setting still applies for this page
  apply(s);
  return s;
}

addEventListener('change', (e) => {
  if (e.target.matches?.('input[data-setting]')) write({ [e.target.name]: e.target.value });
});
addEventListener('storage', (e) => e.key === KEY && apply(read()));
apply(read());
