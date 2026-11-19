// Synced progress, client side. Local first: settings.js has already saved the change; this only copies the
// ticks (never a setting) to the owner's private record through /api/progress and merges the answer's ticks back.
// Read first (GET), merge, and write (PUT) only when this device holds a tick the server lacks or a tick was just made,
// so a page load with nothing new sends no write. If anything fails the page is unchanged (nothing is blocked, no
// dialog) and the push is retried quietly. The checklist's status line ([data-sync]) says which of three things is true.
import { ticksOf } from '../lib/merge.js';
import { absorb, state } from './settings.js';

const ENDPOINT = '/api/progress';
const SAYS = {
  synced: (at) => `Synced at ${at}: your ticks are saved on this device and in this site's private store.`,
  kept: () => 'Could not reach the sync service for this site. Your ticks are kept on this device for now and will be sent later.',
  off: () => 'Syncing is not available here. Your ticks are saved on this device only.',
};
const DELAY = 400; // debounce after a change, ms
const MAX_RETRIES = 5; // then wait for the next change, page load or the online event
let timer;
let failures = 0;
let busy = false;
let again = false;
let changes = 0; // ticks made on this device; unsent while `sent` is behind
let sent = 0;

const say = (kind, ...args) =>
  document.querySelectorAll('[data-sync]').forEach((el) => {
    el.dataset.state = kind;
    el.textContent = SAYS[kind](...args);
  });
const time = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const same = (a, b) => {
  const ids = Object.keys(a.items);
  return ids.length === Object.keys(b.items).length && ids.every((id) => b.items[id]?.done === a.items[id].done && b.items[id]?.at === a.items[id].at);
};

function schedule(ms = DELAY) {
  clearTimeout(timer);
  timer = setTimeout(push, ms);
}

// One request; a status or a bad answer is thrown as itself so push() can tell "no endpoint" (404, 405) from "down".
async function call(init) {
  const res = await fetch(ENDPOINT, init);
  if (!res.ok) throw res.status;
  const ticks = ticksOf(await res.json());
  if (!ticks || !absorb(ticks)) throw 0;
  return ticks;
}

async function push() {
  if (busy) return void (again = true); // a change landed mid-flight: go once more when this one ends
  busy = true;
  const seen = changes;
  try {
    const theirs = seen === sent ? await call() : null; // nothing new here: read first
    const ours = ticksOf(state());
    if (seen !== sent || !same(ours, theirs)) {
      await call({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ours) });
      sent = seen;
    }
    failures = 0;
    say('synced', time());
  } catch (e) {
    if (e === 404 || e === 405) say('off'); // no endpoint on this build: nothing to retry
    else {
      say('kept'); // offline, signed out, a 5xx or a bad answer: never claim a sync that did not happen
      if (++failures <= MAX_RETRIES) schedule(Math.min(60000, 1000 * 2 ** failures));
    }
  }
  busy = false;
  if (again) {
    again = false;
    schedule();
  }
}

addEventListener('lfg:write', () => {
  failures = 0;
  changes++;
  schedule();
});
addEventListener('online', () => {
  failures = 0;
  schedule(0);
});
schedule(0);
