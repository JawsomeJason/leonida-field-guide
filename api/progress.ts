// Synced progress: one Vercel Function, one private Vercel Blob. GET returns the saved ticks, PUT merges
// ticks into them and returns the result. Ticks only: a body with settings or any unknown field is a 400.
// The password gate is checked here with decide(), so there is no auth, cookie, user id or database of its own. BLOB_READ_WRITE_TOKEN is read by @vercel/blob itself.
// If this function returns 500 on the live site, check the merge import first: it must keep its .js extension.
import { del, get, put } from '@vercel/blob';
import { emptyTicks, mergeTicks, parseTicks } from '../src/lib/merge.js';
import { decide } from '../src/lib/gate.js';

declare const process: { env: Record<string, string | undefined> };

const PATH = 'progress/ticks.json';
const OLD_PATH = 'progress/state.json'; // held settings from every device; abandoned
const MAX_BODY = 64 * 1024;
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });

// shortcut: one-off retirement of the old blob, best effort, once per instance and never fails a request.
// Delete this and OLD_PATH once progress/state.json is gone from the store.
let retired = false;

const store = {
  async retire() {
    await del(OLD_PATH);
  },
  async read(): Promise<unknown> {
    const blob = await get(PATH, { access: 'private', useCache: false });
    if (blob?.statusCode !== 200) return null;
    return JSON.parse(await new Response(blob.stream).text());
  },
  async write(state: unknown) {
    await put(PATH, JSON.stringify(state), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
  },
};

async function handle(request: Request) {
  // The password gate (middleware.ts) skips this path because the platform answered 404 when middleware handed
  // requests on to a function, so the function asks the same decide() itself: one rule, two callers.
  const gate = await decide({ path: '/api/progress', method: 'GET', cookie: request.headers.get('cookie'), formPassword: null, expectedPassword: process.env.SITE_PASSWORD });
  if (gate.action !== 'allow') return reply(gate.action === 'refuse' ? 503 : 401, { error: 'Sign in first' });
  if (request.method !== 'GET' && request.method !== 'PUT') return new Response(null, { status: 405, headers: { allow: 'GET, PUT' } });

  if (!retired) {
    retired = true;
    await store.retire().catch(() => {});
  }

  let incoming = emptyTicks();
  if (request.method === 'PUT') {
    // JSON only: a cross-site form cannot send this content type without a preflight.
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(400, { error: 'JSON only' });
    if (Number(request.headers.get('content-length')) > MAX_BODY) return reply(413, { error: 'Too large' });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY) return reply(413, { error: 'Too large' });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: 'Not JSON' });
    }
    const state = parseTicks(body);
    if (!state) return reply(400, { error: 'Ticks only' });
    incoming = state;
  }

  try {
    const saved = parseTicks(await store.read()) ?? emptyTicks(); // a missing, damaged or old-shape blob counts as empty
    if (request.method === 'GET') return reply(200, saved);
    // Read, merge, write with no lock. Two PUTs at the same moment can lose one update, but merge is idempotent
    // and commutative, so the loser's next sync puts it back. Not worth a lock for one owner's progress.
    const merged = mergeTicks(saved, incoming);
    if (JSON.stringify(merged) !== JSON.stringify(saved)) await store.write(merged);
    return reply(200, merged);
  } catch {
    return reply(500, { error: 'Storage is not available' });
  }
}

// `store` rides along so tests can swap it; the platform only calls `fetch`.
export default { fetch: handle, store };
