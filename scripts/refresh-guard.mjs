// Refuses a refresh branch that changes anything but answer records and the New feed.
// Input: `git diff --name-status origin/main...HEAD` lines (or bare paths) on stdin, or as arguments.
// A rename or copy lists two paths; both must be allowed. Exit 0 = allowed, 1 = violation.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ANSWERS = 'src/content/answers/';
const NEW_FEED = 'src/data/new.json';
const STATUS = /^[ACDMRTUXB]\d*$/;

export function allowed(path) {
  if (path === NEW_FEED) return true;
  if (!path.startsWith(ANSWERS)) return false;
  // shortcut: names only, so a symlink added here is caught by the workflow's mode check, not here
  if (/[\u0000-\u001f\u007f\\]/.test(path) || path.includes(' -> ')) return false;
  const rest = path.slice(ANSWERS.length).split('/');
  return rest.every((s) => s !== '' && s !== '.' && s !== '..');
}

/** Returns every offending path or unreadable line, in the order seen, without duplicates. */
export function offenders(input) {
  const bad = new Set();
  for (const line of input.split('\n')) {
    if (line === '') continue;
    const fields = line.split('\t');
    let paths = fields;
    if (fields.length > 1) {
      if (!STATUS.test(fields[0])) { bad.add(line); continue; }
      paths = fields.slice(1);
    }
    for (const p of paths) if (!allowed(p)) bad.add(p);
  }
  return [...bad];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const bad = offenders(args.length ? args.join('\n') : readFileSync(0, 'utf8'));
  if (bad.length) {
    console.error(`refresh-guard: a refresh branch may only change ${ANSWERS}** and ${NEW_FEED}. Offending paths:`);
    for (const p of bad) console.error(`  ${JSON.stringify(p)}`);
    process.exit(1);
  }
  console.log('refresh-guard: ok');
}
