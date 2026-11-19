// The access gate's decision and its login page, as plain JS so the Vercel bundler can trace it from both
// middleware.ts and api/progress.ts (a .ts import failed to load on the platform).
// Pure: the password arrives as an argument, never from the environment, so tests use made-up values.
// middleware.ts and api/progress.ts are the two callers.

export const COOKIE = 'lfg_gate';
const SALT = 'lfg-gate-v1'; // fixed on purpose: the cookie is a gate token, not a stored credential
const YEAR = 31_536_000;

const token = async (password) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + SALT));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
};

// Constant time for equal lengths; both sides are SHA-256 hex, so length is not a secret.
const same = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Only what the app needs to install. No content lives here. /sw.js stays gated: browsers send cookies
// when they fetch it, and it is only registered by a page that already got through.
const exempt = (pathname) =>
  pathname === '/manifest.webmanifest' ||
  pathname === '/favicon.svg' ||
  (pathname.startsWith('/icons/') && !/\.\.|%/.test(pathname));

// Same-origin paths only: "//host" and "/\host" would send the browser to another site.
const safe = (path) => (/^\/(?![/\\])[^\x00-\x1f]*$/.test(path) ? path : '/');

/**
 * @param {{ path: string, method: string, cookie?: string | null, formPassword?: string | null, expectedPassword?: string | null }} input
 *   path is the pathname plus query, as asked for; cookie is the Cookie request header; expectedPassword is SITE_PASSWORD.
 * @returns {Promise<{ action: 'allow' | 'refuse' | 'login' | 'login-error' } | { action: 'set-cookie-redirect', location: string, setCookie: string }>}
 */
export async function decide({ path, method, cookie, formPassword, expectedPassword }) {
  if (!expectedPassword) return { action: 'refuse' }; // closed, never open, when the variable is missing
  if (exempt(path.split('?')[0])) return { action: 'allow' };

  const want = await token(expectedPassword);
  const have = cookie?.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (have && same(have, want)) return { action: 'allow' };

  if (method === 'POST' && typeof formPassword === 'string') {
    if (!same(await token(formPassword), want)) return { action: 'login-error' };
    return {
      action: 'set-cookie-redirect',
      location: safe(path),
      setCookie: `${COOKIE}=${want}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
    };
  }
  return { action: 'login' };
}

// The spoiler dial, mirrored into a device cookie by settings.js (the word only: off, places or mild), so the server can
// back the setting. Hidden-tier addresses are refused unless that level reaches the tier, or the request is one explicit
// reveal: the header x-lfg-reveal: 1 on an in-place fetch, or ?reveal=1 on the no-script Show link. The marker opens one
// item (an explicit page or one item's fragment), never an index, a list or an offline list.
export const DIAL_COOKIE = 'lfg_dial';
const LEVEL = { off: 0, places: 1, mild: 2 };
const TIERS = ['places', 'mild'];

// Decoded once (what the file server does), backslashes as slashes, dot segments resolved, lower-cased.
const segments = (path) => {
  let p = path;
  try {
    p = decodeURIComponent(path);
  } catch {} // a malformed escape stays as written: it still has to match a tier by name to matter
  const out = [];
  for (const s of p.replace(/\\/g, '/').toLowerCase().split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out;
};

/**
 * @param {{ path: string, search?: string, cookie?: string | null, revealHeader?: string | null }} input path is the pathname only.
 * @returns {{ action: 'allow' } | { action: 'redirect', location: string }} redirect goes to the gate page of that item or tier.
 */
export function dialRule({ path, search = '', cookie, revealHeader }) {
  const segs = segments(path);
  let tier, item, gate;
  if (TIERS.includes(segs[0])) {
    tier = segs[0];
    if (segs.length < 3) return { action: 'allow' }; // /<tier>/ and /<tier>/<id>/ are the gate pages: no hidden text
    gate = `/${tier}/${segs[1]}/`;
    item = segs[2] === 'show' ? segs[1] : undefined; // an explicit page; anything else deeper is refused without the marker
  } else if (segs[0] === 'h' && TIERS.includes(segs[1])) {
    tier = segs[1];
    item = segs[2] === 'a' && segs[3] && segs[3] !== 'index.html' ? segs[3] : undefined; // one item's fragment
    gate = item ? `/${tier}/${item}/` : `/${tier}/`;
  } else return { action: 'allow' };

  const have = LEVEL[cookie?.split(';').map((c) => c.trim()).find((c) => c.startsWith(DIAL_COOKIE + '='))?.slice(DIAL_COOKIE.length + 1)] ?? 0;
  if (have >= LEVEL[tier]) return { action: 'allow' };
  const marked = revealHeader === '1' || new URLSearchParams(search).get('reveal') === '1';
  if (marked && item) return { action: 'allow' };
  return { action: 'redirect', location: gate };
}

// Self-contained: the gate cannot serve the site's own CSS. Tokens mirror src/styles/tokens.css.
export const loginPage = (error) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f6efe2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#181320" media="(prefers-color-scheme: dark)">
<title>Leonida Field Guide</title>
<style>
:root {
  --bg: #f6efe2; --surface: #fffaf0; --text: #1c2a2e; --muted: #4d5d62; --accent: #0a6369; --accent-2: #b93a1a;
  --on-accent: var(--surface);
  --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem; --space-5: 1.5rem; --space-6: 2rem;
  --tap: 3rem; --text-input: 1rem; --text-small: 0.9375rem; --radius: 0.75rem;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #181320; --surface: #231c2a; --text: #f7efe6; --muted: #c5b6bd; --accent: #ff9f45; --accent-2: #ff6f61;
    --on-accent: var(--bg);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { background: var(--bg); overscroll-behavior-y: contain; -webkit-tap-highlight-color: transparent; }
body {
  margin: 0; min-height: 100dvh; background: var(--bg); color: var(--text);
  font: 1.0625rem/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  padding: calc(var(--space-6) + env(safe-area-inset-top, 0px)) calc(var(--space-4) + env(safe-area-inset-right, 0px))
    calc(var(--space-6) + env(safe-area-inset-bottom, 0px)) calc(var(--space-4) + env(safe-area-inset-left, 0px));
}
main { max-width: 24rem; margin-inline: auto; padding-block-start: clamp(0rem, 12vh, 6rem); }
h1 { margin: 0 0 var(--space-3); font-size: clamp(1.5rem, 1.1rem + 2vw, 2.25rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; text-wrap: balance; }
h1::after { content: ''; display: block; height: 0.25rem; margin-top: var(--space-3); border-radius: 0.25rem; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
p { margin: 0; }
.lede { margin-block-end: var(--space-5); color: var(--muted); }
.lede:has(+ .lede) { margin-block-end: var(--space-2); }
label { display: block; margin-block-end: var(--space-2); font-weight: 600; }
input {
  display: block; width: 100%; min-height: var(--tap); padding: 0 var(--space-4);
  font: inherit; font-size: max(var(--text-input), 1em);
  color: var(--text); background: var(--surface); border: 2px solid var(--muted); border-radius: var(--radius);
}
input:focus { border-color: var(--accent); }
input[aria-invalid] { border-color: var(--accent-2); }
.error { margin-block-start: var(--space-2); font-size: var(--text-small); font-weight: 600; color: var(--accent-2); }
button {
  display: block; width: 100%; min-height: 3.5rem; margin-block-start: var(--space-4);
  font: inherit; font-size: 1.125rem; font-weight: 700; color: var(--on-accent); background: var(--accent);
  border: 0; border-radius: var(--radius); cursor: pointer; touch-action: manipulation;
}
input:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button:active { opacity: 0.85; }
@media (hover: hover) and (pointer: fine) { button:hover { background: color-mix(in srgb, var(--accent) 88%, var(--text)); } }
@media (prefers-reduced-motion: no-preference) {
  input { transition: border-color 140ms var(--ease); }
  button { transition: transform 160ms var(--ease), background-color 140ms var(--ease); }
  button:active { transform: scale(0.97); opacity: 1; }
}
.note { margin-block-start: var(--space-6); font-size: var(--text-small); color: var(--muted); }
</style>
<main>
  <h1>Leonida Field Guide</h1>
  <p class="lede">This guide is private for now. Enter the password to open it.</p>
  <p class="lede">An unofficial, spoiler-safe companion guide for the game.</p>
  <form method="post">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go"${
      error ? ' autofocus aria-invalid="true" aria-describedby="error"' : ''
    }>${error ? '\n    <p class="error" id="error" role="alert">That password is not right. Try again.</p>' : ''}
    <button type="submit">Open the guide</button>
  </form>
  <p class="note">Unofficial fan guide. Not made or endorsed by any game publisher.</p>
</main>
`;
