// Synced progress: one Vercel Function, one private Vercel Blob. GET returns the saved state, PUT merges a
// state into it and returns the result. Runs behind the password gate (middleware.ts matches every request),
// so there is no auth, cookie, user id or database here. BLOB_READ_WRITE_TOKEN is read by @vercel/blob itself.
// If this function returns 500 on the live site, check the merge import first: it must keep its .js extension.
import { get, put } from '@vercel/blob';
import { empty, merge, parse } from '../src/lib/merge.js';

const PATH = 'progress/state.json';
const MAX_BODY = 64 * 1024;
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });

const store = {
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
  if (request.method !== 'GET' && request.method !== 'PUT') return new Response(null, { status: 405, headers: { allow: 'GET, PUT' } });

  let incoming = empty();
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
    const state = parse(body);
    if (!state) return reply(400, { error: 'Not a progress state' });
    incoming = state;
  }

  try {
    const saved = parse(await store.read()) ?? empty(); // a missing or damaged blob counts as empty
    if (request.method === 'GET') return reply(200, saved);
    // Read, merge, write with no lock. Two PUTs at the same moment can lose one update, but merge is idempotent
    // and commutative, so the loser's next sync puts it back. Not worth a lock for one owner's progress.
    const merged = merge(saved, incoming);
    if (JSON.stringify(merged) !== JSON.stringify(saved)) await store.write(merged);
    return reply(200, merged);
  } catch {
    return reply(500, { error: 'Storage is not available' });
  }
}

// `store` rides along so tests can swap it; the platform only calls `fetch`.
export default { fetch: handle, store };
