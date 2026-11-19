import test from 'node:test';
import assert from 'node:assert/strict';

// Loads the real middleware file the way the platform does: a bad relative import fails here, not only on Vercel.
test('middleware loads and refuses everything when the password variable is unset', async () => {
  delete process.env.SITE_PASSWORD;
  const { default: middleware } = await import('../../middleware.ts');
  const res = await middleware(new Request('https://example.test/'));
  assert.equal(res.status, 503);
});
