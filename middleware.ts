// Vercel Routing Middleware: the password gate in front of every page and asset. Thin wrapper over src/lib/gate.js.
import { next } from '@vercel/functions';
import { decide, dialRule, loginPage } from './src/lib/gate.js';

declare const process: { env: Record<string, string | undefined> };

const headers = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

// A page navigation gets the login page as a 200: browsers log every 401 document in the console. Anything else
// (assets, JSON, fetches, curl) still gets 401, so no content leaks. x-lfg-gate lets the service worker refuse to cache it.
const page = (error: boolean, request: Request) =>
  new Response(loginPage(error), {
    status: request.headers.get('sec-fetch-dest') === 'document' ? 200 : 401,
    headers: { ...headers, 'x-lfg-gate': 'login', 'content-type': 'text/html; charset=utf-8' },
  });

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  let formPassword: string | null = null;
  if (request.method === 'POST') {
    try {
      const value = (await request.formData()).get('password');
      if (typeof value === 'string') formPassword = value;
    } catch {
      // not a form post: treated as no password
    }
  }

  const d = await decide({
    path: url.pathname + url.search,
    method: request.method,
    cookie: request.headers.get('cookie'),
    formPassword,
    expectedPassword: process.env.SITE_PASSWORD,
  });

  switch (d.action) {
    case 'allow': {
      // Signed in. Now the spoiler dial: a hidden-tier address below the player's level goes to its gate page.
      const rule = dialRule({ path: url.pathname, search: url.search, cookie: request.headers.get('cookie'), revealHeader: request.headers.get('x-lfg-reveal') });
      if (rule.action === 'redirect') return new Response(null, { status: 302, headers: { 'cache-control': 'no-store', location: rule.location, 'x-lfg-redirect': 'dial' } });
      return next();
    }
    case 'set-cookie-redirect':
      return new Response(null, { status: 303, headers: { ...headers, location: d.location, 'set-cookie': d.setCookie } });
    case 'refuse':
      return new Response('This site is closed.', { status: 503, headers });
    default:
      return page(d.action === 'login-error', request);
  }
}

// /api/progress is not matched here: the function checks the cookie itself with decide() (see api/progress.ts).
export const config = { matcher: ['/((?!api/progress$).*)'] };
