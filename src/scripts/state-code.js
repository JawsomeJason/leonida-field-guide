// Export and import of the saved state as a code: JSON, UTF-8, base64url. Pure: no DOM, no storage.
// Import checks everything here before the caller writes anything.
// The enums repeat src/data/stages.ts and the Settings controls; tests/checklist/state-code.test.js guards the stages.
const ENUMS = {
  console: ['ps5', 'xbox-x', 'xbox-s'],
  dial: ['off', 'places', 'mild'],
  theme: ['system', 'day', 'night'],
  stage: ['before', 'hour-1', 'day-1', 'week-1'],
};
const KEYS = [...Object.keys(ENUMS), 'done'];
export const LIMITS = { code: 32768, done: 300, id: 64 };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function encode(state) {
  const json = JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, state[k]])));
  let bin = '';
  for (const byte of new TextEncoder().encode(json)) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

const fail = (error) => ({ ok: false, error });
const BAD = 'That code is not valid. Copy it again from the other device.';

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

  const ok =
    data && typeof data === 'object' && !Array.isArray(data) &&
    Object.keys(data).length === KEYS.length &&
    KEYS.every((k) => k in data) &&
    Object.entries(ENUMS).every(([k, values]) => values.includes(data[k])) &&
    Array.isArray(data.done) && data.done.length <= LIMITS.done &&
    data.done.every((id) => typeof id === 'string' && id.length <= LIMITS.id && SLUG.test(id));
  if (!ok) return fail('That code is not from this guide, or it was changed.');

  return { ok: true, state: { ...data, done: [...new Set(data.done)] } };
}
