// Which records fit which console. Plain JS: the build and the browser scripts both use it. See "Console" in docs/spec.md.

/** The `data-only` value of a record: the consoles it is for, or nothing when its text fits every console. */
export const onlyOf = (consoles) => (consoles === 'all' ? undefined : consoles.join(' '));

/** True when a record shows in the main list for this console. Until a console is chosen ('') only every-console records do. */
export const applies = (only, console) => !only || only.split(' ').includes(console);

/** Button names in text: write `{cross}`; both console labels are emitted and CSS shows the chosen console's.
 *  Until a console is chosen both show, with a real " / " between them (CSS reveals it), so copied or read text is never "L3LS". */
const buttons = {
  cross: ['✕', 'A'], circle: ['○', 'B'], square: ['□', 'X'], triangle: ['△', 'Y'],
  l1: ['L1', 'LB'], r1: ['R1', 'RB'], l2: ['L2', 'LT'], r2: ['R2', 'RT'], l3: ['L3', 'LS'], r3: ['R3', 'RS'],
  options: ['Options', 'Menu'], create: ['Create', 'View'],
};
export const withButtons = (text) =>
  text.replace(/\{(\w+)\}/g, (m, k) => (buttons[k] ? `<kbd><span class="ps">${buttons[k][0]}</span><span class="sep"> / </span><span class="xb">${buttons[k][1]}</span></kbd>` : m));

export const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Plain text to safe HTML with button names. */
export const textHtml = (s) => withButtons(escapeHtml(s));
