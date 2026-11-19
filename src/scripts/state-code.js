// Export and import of the ticks as a code: JSON, UTF-8, base64url. Pure: no DOM, no storage.
// A code carries ticks only ({ v: 3, items }); settings stay on the device. Import checks everything here before
// the caller writes anything. It also reads the older codes (a v2 state, or the old shape { console, dial, theme,
// stage, done }) but keeps only their ticks: the player chooses the dial on each device.
// The enums and id rules live in src/lib/merge.js; tests/checklist/state-code.test.js guards the stages.
import { ENUMS, LIMITS as STATE_LIMITS, fromV1, ticksOf, validId } from '../lib/merge.js';

export const LIMITS = { code: 49152, done: STATE_LIMITS.items, id: STATE_LIMITS.id };
const OLD_KEYS = [...Object.keys(ENUMS), 'done'];

export function encode(state) {
  const json = JSON.stringify(ticksOf(state)); // a v2 state, as settings.js state() returns it, or v3: only its ticks go in
  let bin = '';
  for (const byte of new TextEncoder().encode(json)) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

const fail = (error) => ({ ok: false, error });
const BAD = 'That code is not valid. Copy it again from the other device.';

const isOldShape = (data) =>
  data && typeof data === 'object' && !Array.isArray(data) &&
  Object.keys(data).length === OLD_KEYS.length &&
  OLD_KEYS.every((k) => k in data) &&
  Object.entries(ENUMS).every(([k, values]) => values.includes(data[k])) &&
  Array.isArray(data.done) && data.done.length <= LIMITS.done && data.done.every(validId);

// On success `state` is always the ticks, { v: 3, items }; an old-shape code comes back through fromV1 (time 0).
export function decode(input) {
  const code = String(input).replace(/\s+/g, ''); // pasted codes often pick up line breaks
  if (!code) return fail('Paste a code first.');
  if (code.length > LIMITS.code) return fail('That code is too long to be one of ours.');
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return fail(BAD);

  let data;
  try {
    const bin = atob(code.replaceAll('-', '+').replaceAll('_', '/'));
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return fail(BAD);
  }

  const state = ticksOf(data) ?? (isOldShape(data) ? ticksOf(fromV1(data)) : null);
  return state ? { ok: true, state } : fail('That code is not from this guide, or it was changed.');
}
