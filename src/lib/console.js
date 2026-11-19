// Which records fit which console. Plain JS: the build and the browser scripts both use it. See "Console" in docs/spec.md.

/** The `data-only` value of a record: the consoles it is for, or nothing when its text fits every console. */
export const onlyOf = (consoles) => (consoles === 'all' ? undefined : consoles.join(' '));

/** True when a record shows in the main list for this console. Until a console is chosen ('') only every-console records do. */
export const applies = (only, console) => !only || only.split(' ').includes(console);
