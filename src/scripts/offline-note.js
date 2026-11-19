// What a hidden fetch that failed says. The page stays where it is and says this inline, in a role=status line; it never
// follows a link to an address that cannot load (offline that is the browser's own error page and the player's place is lost).
export const cannotLoad = (what, them = 'it') => `${what} cannot load without a connection. Once you have opened ${them} online, it will work offline.`;

/** Puts (or replaces) the line right after `anchor`. The line is emptied first so a second tap is read out again; `keep` leaves a line that is already there alone. */
export function say(anchor, text, keep) {
  let p = anchor.nextElementSibling;
  if (!p?.matches('[data-offline-note]')) {
    p = Object.assign(document.createElement('p'), { className: 'reveal__note' });
    p.setAttribute('role', 'status');
    p.dataset.offlineNote = '';
    anchor.after(p);
  }
  if (keep && p.textContent === text) return;
  p.textContent = '';
  setTimeout(() => (p.textContent = text), 50); // a live region announces a change, not a line that arrives with its element
}

/** Takes the line after `anchor` away (the load worked, or the dial dropped). */
export const unsay = (anchor) => {
  if (anchor.nextElementSibling?.matches('[data-offline-note]')) anchor.nextElementSibling.remove();
};
