// Vercel Routing Middleware: the password gate in front of every page and asset. Thin wrapper over src/lib/gate.ts.
import { decide, loginPage } from './src/lib/gate';

declare const process: { env: Record<string, string | undefined> };

const headers = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

const page = (error: boolean) =>
  new Response(loginPage(error), { status: 401, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });

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
    case 'allow':
      return new Response(null, { headers: { 'x-middleware-next': '1' } }); // what next() from @vercel/functions sends
    case 'set-cookie-redirect':
      return new Response(null, { status: 303, headers: { ...headers, location: d.location, 'set-cookie': d.setCookie } });
    case 'refuse':
      return new Response('This site is closed.', { status: 503, headers });
    default:
      return page(d.action === 'login-error');
  }
}
