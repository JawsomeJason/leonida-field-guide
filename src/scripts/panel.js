// The settings sheet closes after a choice, and CSS learns how tall the sticky header is (the rail and the sheet sit below it).
const sheet = document.getElementById('settings');
sheet?.addEventListener('change', () => sheet.hidePopover?.());

const header = document.querySelector('.site-header');
if (header) new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)).observe(header);

// A tap on the scrim closes the sheet and goes no further: the browser still sends the click on to whatever sits under the scrim
// (a link behind it would open). A press that starts on the scrim, outside the sheet and its chips, loses the click that follows it.
let scrimAt = -1e4;
addEventListener('pointerdown', (e) => {
  const r = sheet?.getBoundingClientRect();
  const inside = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  scrimAt = sheet?.matches(':popover-open') && !inside && !e.target.closest('.chip') ? e.timeStamp : -1e4;
}, true);
addEventListener('click', (e) => {
  if (e.timeStamp - scrimAt < 1000) {
    scrimAt = -1e4;
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
