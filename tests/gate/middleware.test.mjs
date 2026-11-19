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
