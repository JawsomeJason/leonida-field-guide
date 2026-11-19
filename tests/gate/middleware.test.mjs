import test from 'node:test';
import assert from 'node:assert/strict';

// Loads the real middleware file the way the platform does: a bad relative import fails here, not only on Vercel.
test('middleware loads and refuses everything when the password variable is unset', async () => {
  delete process.env.SITE_PASSWORD;
  const { default: middleware } = await import('../../middleware.ts');
  const res = await middleware(new Request('https://example.test/'));
  assert.equal(res.status, 503);
});

// The login page is a 200 for a page navigation only (browsers log every 401 document), and a 401 for anything else.
const login = async (init = {}, url = 'https://example.test/topics/money/') => {
  process.env.SITE_PASSWORD = 'a-made-up-test-password';
  const { default: middleware } = await import('../../middleware.ts');
  return middleware(new Request(url, init));
};
const document = { 'sec-fetch-dest': 'document' };

test('login page: a document navigation gets 200, no-store and x-lfg-gate, and no site content', async () => {
  const res = await login({ headers: document });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-lfg-gate'), 'login');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.match(body, /<label for="password">/);
  assert.ok(!body.includes('<script') && !body.includes('/topics/money'));
});

test('the same path without Sec-Fetch-Dest: document stays 401', async () => {
  for (const headers of [{}, { 'sec-fetch-dest': 'empty' }, { 'sec-fetch-dest': 'script' }, { 'sec-fetch-dest': 'image' }, { 'sec-fetch-dest': 'iframe' }, { accept: 'application/json' }]) {
    for (const url of ['https://example.test/topics/money/', 'https://example.test/search/none.json', 'https://example.test/api/other']) {
      const res = await login({ headers }, url);
      assert.equal(res.status, 401, `${url} ${JSON.stringify(headers)}`);
      assert.equal((await res.text()).includes('Password'), true);
    }
  }
});

test('a wrong password from a form post (a document) re-shows the page as 200 with the error; a fetch gets 401', async () => {
  const post = (headers) => login({ method: 'POST', headers, body: new URLSearchParams({ password: 'wrong' }) });
  const doc = await post(document);
  assert.equal(doc.status, 200);
  assert.equal(doc.headers.get('x-lfg-gate'), 'login');
  assert.match(await doc.text(), /class="error"/);
  assert.equal((await post({})).status, 401);
});

test('the right password still redirects (303) and sets the cookie', async () => {
  const res = await login({ method: 'POST', headers: document, body: new URLSearchParams({ password: 'a-made-up-test-password' }) });
  assert.equal(res.status, 303);
  assert.match(res.headers.get('set-cookie'), /^lfg_gate=/);
  assert.equal(res.headers.get('x-lfg-gate'), null);
});

// Signed in, the spoiler dial is still enforced on the server: a hidden-tier address below the cookie's level goes to its gate page.
test('signed in: hidden addresses are refused (302 to the gate page) below the dial cookie, allowed at or above it, or with the marker', async () => {
  process.env.SITE_PASSWORD = 'a-made-up-test-password';
  const { default: middleware } = await import('../../middleware.ts');
  const signIn = await middleware(new Request('https://example.test/', { method: 'POST', body: new URLSearchParams({ password: 'a-made-up-test-password' }) }));
  const gate = signIn.headers.get('set-cookie').split(';')[0];
  const get = (path, dial, headers = {}) => middleware(new Request(`https://example.test${path}`, { headers: { cookie: dial ? `${gate}; lfg_dial=${dial}` : gate, ...headers } }));

  for (const [path, to] of [['/h/mild/a/x/', '/mild/x/'], ['/h/places/search.json', '/places/'], ['/places/x/show/', '/places/x/'], ['/places/x/show/?reveal=0', '/places/x/']]) {
    const res = await get(path, 'off');
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get('location'), to);
    assert.equal(res.headers.get('x-lfg-redirect'), 'dial');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await get('/places/x/show/')).status, 302); // no dial cookie: Off
  const through = (res) => res.status !== 302 && !res.headers.get('x-lfg-redirect');
  assert.ok(through(await get('/places/x/show/', 'places')));
  assert.equal((await get('/mild/x/show/', 'places')).status, 302);
  assert.ok(through(await get('/mild/x/show/', 'mild')));
  assert.ok(through(await get('/mild/x/show/?reveal=1', 'off')));
  assert.ok(through(await get('/h/mild/a/x/', 'off', { 'x-lfg-reveal': '1' })));
  assert.equal((await get('/h/mild/search.json', 'off', { 'x-lfg-reveal': '1' })).status, 302);
  assert.ok(through(await get('/places/', 'off')));
  assert.ok(through(await get('/places/x/', 'off')));
  // Not signed in, a hidden address is the login page, not a redirect that would show a gate page's existence.
  assert.equal((await middleware(new Request('https://example.test/mild/x/show/', { headers: { 'sec-fetch-dest': 'document', cookie: 'lfg_dial=mild' } }))).headers.get('x-lfg-gate'), 'login');
});
