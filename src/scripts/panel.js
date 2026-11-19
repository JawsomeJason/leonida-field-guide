// The settings sheet closes after a choice, and CSS learns how tall the sticky header is (the rail and the sheet sit below it).
const sheet = document.getElementById('settings');
sheet?.addEventListener('change', () => sheet.hidePopover?.());

const header = document.querySelector('.site-header');
if (header) new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)).observe(header);
