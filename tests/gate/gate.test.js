// Every password below is invented for the test. Nothing here reads the environment or the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, loginPage } from '../../src/lib/gate.js';

const PASS = 'fake-pass-one';
const base = { path: '/', method: 'GET', expectedPassword: PASS };

// Sign in the way a player does and return the cookie the gate hands back.
async function signIn(password = PASS) {
  const d = await decide({ ...base, expectedPassword: password, method: 'POST', formPassword: password });
  assert.equal(d.action, 'set-cookie-redirect');
  return d.setCookie;
}

test('no cookie: login page', async () => {
  assert.equal((await decide(base)).action, 'login');
  assert.equal((await decide({ ...base, cookie: '' })).action, 'login');
  assert.equal((await decide({ ...base, cookie: 'other=1' })).action, 'login');
});

test('wrong cookie: login page', async () => {
  assert.equal((await decide({ ...base, cookie: 'lfg_gate=deadbeef' })).action, 'login');
  assert.equal((await decide({ ...base, cookie: `lfg_gate=${PASS}` })).action, 'login');
  const other = (await signIn('fake-pass-two')).split(';')[0];
  assert.equal((await decide({ ...base, cookie: other })).action, 'login');
});

test('right cookie: allowed, among other cookies too', async () => {
  const pair = (await signIn()).split(';')[0];
  assert.equal((await decide({ ...base, cookie: pair })).action, 'allow');
  assert.equal((await decide({ ...base, path: '/a/x/', cookie: `a=b; ${pair}; c=d` })).action, 'allow');
});

test('wrong password: login again with an error', async () => {
  const d = await decide({ ...base, method: 'POST', formPassword: 'nope' });
  assert.equal(d.action, 'login-error');
  assert.equal((await decide({ ...base, method: 'POST', formPassword: '' })).action, 'login-error');
});

test('right password: cookie set, redirect to the page asked for', async () => {
  const d = await decide({ ...base, path: '/topics/money/?x=1', method: 'POST', formPassword: PASS });
  assert.equal(d.action, 'set-cookie-redirect');
  assert.equal(d.location, '/topics/money/?x=1');
  for (const part of ['Path=/', 'Max-Age=31536000', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    assert.ok(d.setCookie.includes(part), part);
  }
  assert.ok(!d.setCookie.includes(PASS), 'the cookie never holds the password');
  assert.match(d.setCookie, /^lfg_gate=[0-9a-f]{64};/);
});

test('the password counts only when posted', async () => {
  assert.equal((await decide({ ...base, formPassword: PASS })).action, 'login');
});

test('variable unset or empty: refuse everything', async () => {
  for (const expectedPassword of [undefined, null, '']) {
    for (const path of ['/', '/manifest.webmanifest', '/icons/a.png']) {
      const d = await decide({ path, method: 'POST', formPassword: 'x', cookie: 'lfg_gate=x', expectedPassword });
      assert.equal(d.action, 'refuse');
    }
  }
});

test('install files are open; nothing with content is', async () => {
  for (const path of ['/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/maskable/512.png']) {
    assert.equal((await decide({ ...base, path })).action, 'allow', path);
  }
  const gated = [
    '/sw.js', '/search/none.json', '/h/places/index.json', '/h/mild/x.json', '/places/', '/places/x/', '/mild/x/',
    '/manifest.webmanifest.bak', '/favicon.svg/x', '/icons', '/icons/../search/none.json', '/icons/%2e%2e/places/',
  ];
  for (const path of gated) {
    assert.equal((await decide({ ...base, path })).action, 'login', path);
  }
});

test('open redirect: only same-origin paths are followed', async () => {
  const to = async (path) => (await decide({ ...base, path, method: 'POST', formPassword: PASS })).location;
  assert.equal(await to('//evil.example/x'), '/');
  assert.equal(await to('/\\evil.example'), '/');
  assert.equal(await to('https://evil.example/'), '/');
  assert.equal(await to('/ok\r\nSet-Cookie: x=1'), '/');
  assert.equal(await to('/a/b/?q=1'), '/a/b/?q=1');
});

test('login page: one labelled password field, no script, error only after a miss', () => {
  const page = loginPage(false);
  assert.match(page, /<label for="password">Password<\/label>/);
  assert.equal(page.match(/<input /g).length, 1);
  assert.match(page, /type="password"/);
  assert.match(page, /prefers-color-scheme: dark/);
  assert.ok(!page.includes('<script') && !page.includes('class="error"'));
  const miss = loginPage(true);
  assert.match(miss, /class="error"/);
  assert.match(miss, /aria-invalid="true"/);
});
