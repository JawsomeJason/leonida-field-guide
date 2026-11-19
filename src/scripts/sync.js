// Synced progress, client side. Local first: settings.js has already saved the change; this only copies it to
// the owner's private record through /api/progress and merges the answer back. If anything fails the page is
// unchanged (nothing is blocked, no dialog) and the push is retried quietly. The checklist's status line
// ([data-sync]) shows the real result of the last attempt.
import { absorb, state } from './settings.js';

const ENDPOINT = '/api/progress';
const DELAY = 400; // debounce after a change, ms
const MAX_RETRIES = 5; // then wait for the next change, page load or the online event
let timer;
let failures = 0;
let busy = false;
let again = false;

const say = (text) => document.querySelectorAll('[data-sync]').forEach((el) => (el.textContent = text));
const time = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function schedule(ms = DELAY) {
  clearTimeout(timer);
  timer = setTimeout(push, ms);
}

async function push() {
  if (busy) return void (again = true); // a change landed mid-flight: go once more when this one ends
  busy = true;
  try {
    const res = await fetch(ENDPOINT, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state()) });
    if (!res.ok || !absorb(await res.json())) throw new Error(String(res.status));
    failures = 0;
    say(`Synced at ${time()}`);
  } catch {
    say('Saved on this device only'); // offline, signed out, a 5xx or a bad answer: never claim a sync that did not happen
    if (++failures <= MAX_RETRIES) schedule(Math.min(60000, 1000 * 2 ** failures));
  }
  busy = false;
  if (again) {
    again = false;
    schedule();
  }
}

addEventListener('lfg:write', () => {
  failures = 0;
  schedule();
});
addEventListener('online', () => {
  failures = 0;
  schedule(0);
});
say('Saved on this device only');
schedule(0);
