# Leonida Field Guide: build spec

The goal: a player opens this on a phone or tablet beside the console, gets an answer in two taps, and never sees a spoiler they did not ask for. It also works on desktop.

This spec is the contract. Where it is silent, pick the smallest thing that works and say so in your report.

## What it is not

- No story content, at any setting. No mission names, plot, character fates or endings, anywhere in the repo.
- No interactive map. Link to one (see "Links out").
- No accounts, no ads, no analytics, no trackers. The one cookie is the gate token (see "Access gate"). Synced ticks are a single shared record behind the password gate, not an account: no sign-up, no user ids, no per-person data. Settings never sync. The About screen says exactly this.
- No Rockstar logos, artwork, screenshots, fonts or trade dress. The footer says the site is unofficial.
- No copied guide text. Restate each fact in our own words and link the source.
- No web fonts and no UI framework. No runtime dependency ships to the browser.

## Stack

- Astro, static output, deployed by Vercel on push to `main` (the project is already linked). Check the current Astro docs through context7 before scaffolding.
- Content is data: one file per answer in an Astro content collection, validated by a schema. A record that fails the schema fails the build.
- Multi-page site. Navigation is plain links, with cross-document view transitions as an enhancement. The pages work with JavaScript off, except the things listed under "Needs JavaScript".
- Vanilla CSS with custom properties, and small vanilla JS modules. Tests use Playwright and axe.

## Data shape

```ts
type Tier = 'none' | 'places' | 'mild';            // there is no 'story' tier
type Console = 'ps5' | 'xbox-x' | 'xbox-s';
type Topic = 'setup' | 'settings' | 'controls' | 'saving' | 'money'
           | 'getting-around' | 'bonuses' | 'fixes' | 'good-to-know' | 'places';
type Stage = 'before' | 'hour-1' | 'day-1' | 'week-1';

type Answer = {
  id: string;                    // slug, stable for ever (checklists store it)
  question: string;              // plain words, as a player would ask it
  short: string;                 // the answer in at most 240 characters
  body?: string;                 // markdown, optional detail
  topic: Topic;
  stage: Stage;
  tier: Tier;                    // the tier of the whole record, title included
  consoles: Console[] | 'all';
  byConsole?: Partial<Record<Console, string>>;   // replaces `short` for that console
  confidence: 'official' | 'reported' | 'community';
  sources: { url: string; title: string }[];      // at least one
  checked: string;               // ISO date the sources were last checked
  rank?: number;                 // 1 = most asked; drives "Most asked"
  todo?: string;                 // if set, the record is a checklist item with this label
  reveal?: { tier: Exclude<Tier, 'none'>; text: string }[];  // hidden details inside a 'none' answer
};
```

Rules the schema or the checks enforce:

- `confidence: 'official'` requires a source on rockstargames.com, support.rockstargames.com, take2games.com, playstation.com or xbox.com that a person or agent opened and read. Otherwise use `reported`.
- A `places` or `mild` record's `question`, `short`, `body` and `todo` are all hidden text. So is every `reveal[].text`.
- `topic: 'places'` implies `tier: 'places'`.

## The spoiler dial

One setting for the whole app: **Off** (the default), **Places**, **Mild**.

- Off shows `none` records only. Places adds `places`. Mild adds `places` and `mild`.
- Hidden text is never in a page the default setting loads. The build writes each hidden tier to its own files (pages under `/places/` and `/mild/`, fragments and a search index under `/h/<tier>/`). Default pages, the default search index and the offline cache contain none of it.
- Tap to show: a `none` answer with hidden details shows a control such as "1 mild detail hidden. Show". It is a link to the detail's own page. JavaScript upgrades it to fetch the fragment and insert it in place. The dial does not change.
- The Places section opens on a gate that says places are off, with the switch to turn them on. With JavaScript off, the gate is a plain link to the places pages.
- The dial is on the first screen at every width, in the header.

## Screens

| Route | Screen | Content |
| --- | --- | --- |
| `/` | Ask | Search box, "Most asked" (top 8 by `rank`), then "Your stage": the stage picker and that stage's to-dos |
| `/topics/` | Topics | Ten tiles, one per topic. Places shows as locked while the dial is Off |
| `/topics/<topic>/` | Cheat sheet | Every answer of the topic on one page as compact cards with anchors |
| `/a/<id>/` | Answer | Question, short answer, console switch, optional body, hidden-detail controls, confidence, sources, date checked, related answers |
| `/checklist/` | Checklist | All to-dos by stage with progress, plus export and import of the saved state as a code |
| `/new/` | New | What the last refreshes changed, and known problems with fixes |
| `/places/` | Places gate | See "The spoiler dial" |
| `/about/` | About | How spoilers are handled, how facts are sourced, links out, the unofficial notice |

Two-tap rule: from `/`, every answer with `rank` 1 to 20 is reachable in at most two taps (a "Most asked" chip is one tap; Topics then a tile is two, because the cheat sheet shows the answers inline).

## Layout

- Phone (under 600px): a bottom tab bar with Ask, Topics, Checklist, New. One column. Tap targets at least 48px. Body text 17px or larger.
- Tablet (600px to 1023px): the bar becomes a left rail. One column of content.
- Desktop (1024px and up): rail, a list column and a detail column. On an answer page the list column shows the other answers of the same topic. This is CSS grid only, no script.
- Header on every screen: the site name, the console switch (PS5 or Xbox) and the spoiler dial. A theme switch sits in the same menu.
- Use container queries for the cards and media queries for the page frame. No horizontal scrolling at any width from 320px up. Respect the user's text size setting.

## Touch

The app is used mostly by touch, on a phone or tablet. Every screen holds to these rules, and later work reuses the shared tokens (`--tap`, `--gap-tap`, `--safe-*`, `--text-input`) and classes (`.tap-list`, `.seg`) in `tokens.css` and `global.css`.

- Every tappable thing is at least 48 by 48 CSS px (`--tap`), with at least 8px (`--gap-tap`) between neighbours. Links inside a sentence are exempt.
- The whole row is the target, not a small link inside it.
- The tab bar sits at the bottom on phones. Leave clear space around the spoiler dial and the reveal controls.
- Respect the safe-area insets in both orientations: `viewport-fit=cover` and `env(safe-area-inset-*)` on the header, bars, rail, content and footer.
- Nothing depends on hover, long-press, double-tap, drag or swipe. Hover styles live under `@media (hover: hover)`. Taps show a pressed state with `:active`, and `touch-action: manipulation` removes the double-tap delay.
- Text inputs are 16px or larger. Body text is 17px or larger.
- No layout shift on a state change: a selected control changes fill or colour, never size or weight.
- `overscroll-behavior-y: contain` on the page, so pulling down does not fight a refresh.

## Look

Two themes from one set of named tokens. The app follows the device setting, and the theme switch overrides it and is remembered.

| Token | Night | Day |
| --- | --- | --- |
| `--bg` | `#0b1020` | `#f6efe2` |
| `--surface` | `#141b34` | `#fffaf0` |
| `--line` | `#2a3460` | `#dccfb6` |
| `--text` | `#eef1ff` | `#1c2a2e` |
| `--muted` | `#a3acd0` | `#55666b` |
| `--accent` | `#3ee6e0` | `#0b6f75` |
| `--accent-2` | `#ff6f91` | `#c2401f` |

- These are starting values. Every text and control pairing must pass WCAG AA contrast in both themes; adjust a value if axe says it fails, and record the change here.
- **Visual pass (every change to a token or a value, in `tokens.css`).** The colour table above is unchanged.
  - New `--shadow`: Day `0 1px 2px rgb(28 42 46 / .08), 0 2px 8px rgb(28 42 46 / .05)`; Night `inset 0 1px 0 rgb(255 255 255 / .04)` (a faint top edge, so surfaces stay quiet). Used on rows, tiles, cards and controls.
  - New `--wash` (accent 12% over `--surface`, hover and current) and `--press` (accent 22%, `:active`). They replace the repeated `color-mix` values.
  - `--radius` 0.5rem to 0.75rem. `--text-h1` `clamp(1.5rem, 1.1rem + 2vw, 2.25rem)` to `clamp(1.625rem, 1.2rem + 2vw, 2.5rem)`, weight 750, letter-spacing -0.02em. `--text-h2` 1.25rem to 1.3125rem (21px, one 1.25 step above body), weight 650. New `--space-7` 3rem.
  - New motion tokens: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--press-scale` 0.98 (rows, cards) and `--press-scale-small` 0.96 (compact controls). One press recipe in `global.css`: the surface tints with no delay, shrinks slightly (70ms in), and eases back (160ms out). Under `prefers-reduced-motion: reduce` the shrink is dropped and the tint stays. Motion is `scale`, `opacity` and colour only.
  - The Settings panel drops in 6px and fades (160ms, `--ease-out`; it moves but never resizes, so its targets stay 48px); a revealed detail fades in and settles 4px (200ms); page changes crossfade in 150ms.
  - Layout: the rail is a full-height panel with a tinted current item; the spoiler dial stays on one row beside its label at 600px and up; the content column is at most 64rem; the Ask and Checklist screens share one drawn tick box.
- Night uses colour for state only (selected tab, links, the dial); surfaces stay quiet. Day is warm and flat.
- System font stack for text. `ui-monospace` for anything a player copies or reads as a value: sizes, button names, times, version numbers.
- Button names are text in `<kbd>`, switched by the console setting (✕ ○ □ △ and L1/R1, or A B X Y and LB/RB). No glyph images.
- One decorative touch only: a thin sunset gradient rule under the header, built from the two accents.
- Models to borrow from, not copy: Vercel Docs (mono values, tabs that swap the answer in place), Dash0 (warm accent on a dark ground, mono labels), Refero (search-first home). From rivals: FullSweep's bottom bar and default-on spoiler shield, gtamap.io's plain spoiler switch, thegta6guide.com's key number on the first screen. See `docs/design-inspiration.md`.

## Saved on the device

One `localStorage` key, `lfg:v1`, holding the v2 state:

```ts
type State = {
  v: 2;
  settings: { [K in 'console' | 'dial' | 'theme' | 'stage']?: { value: string; at: number } };
  items: { [id: string]: { done: boolean; at: number } };   // id = an answer id; done:false is an untick
};
```

`at` is a millisecond timestamp, set when that setting or tick last changed. Saving is local first and works offline. The state is read and written only through `src/scripts/settings.js`, which hands the rest of the code the flat shape `{ console, dial, theme, stage, done: string[] }`.

- **Settings stay on the device.** The spoiler dial, console, theme and stage are never sent to the server and never read from it or from an import code. Nothing from `/api/progress` can change a setting (`absorb()` takes ticks only and drops any `settings` it is handed). A new device starts with the dial at Off, the console on PS5, the theme on the device setting and the stage at the start. Changing a setting never starts a sync.
- **Old shape.** Before synced progress the value was `{ console, dial, theme, stage, done: string[] }`. It is still read and keeps its settings and ticks on this device. On first load it is stored as v2 with every old value at time 0, so nothing is dropped.
- **Export code.** Ticks only: `{ v: 3, items }` as JSON, base64url, no setting inside. Import validates before it writes, accepts a v3 code, an older v2 code or an old-shape code, keeps only the ticks and merges them into this device (see "Synced progress"). The settings of an old code are ignored: the player chooses the dial on each device. It does not replace what is already here.
- **What leaves the device.** Only the ticks, sent to the owner's own private blob behind the password gate (see "Synced progress"). Nothing else: no analytics, no third party.
- **Lowering the dial clears the device.** When the dial goes down (Mild to Places, Places to Off, Mild to Off) the page tells the service worker which hidden tiers are still on, and the worker deletes every other tier's files from its cache: `/places/**`, `/mild/**` and `/h/<tier>/**`, with that tier's cache mark. Turning a tier on caches it again as before (see "Offline and install").

## Synced progress

Only checklist ticks follow the owner across phone, tablet and desktop. Settings do not (see "Saved on the device"). Local first: the page works, and every change is saved, with no network at all.

- **One function, one blob.** `api/progress.ts` is a Vercel Function (default export `{ fetch }`, Node.js runtime). It keeps one private Vercel Blob at `progress/ticks.json`, in the store `leonida-progress`, using `@vercel/blob` on the server only. The store's token is the Vercel env var `BLOB_READ_WRITE_TOKEN` (production, preview and development); it never appears in the repo, a commit, a log or a test. Nothing is added to the browser bundle.
- **The old record is abandoned.** `progress/state.json` held every device's settings and is never read again. The function makes a best-effort, one-off `del()` of that pathname (once per instance, never failing a request); the code is marked `shortcut:` and is removed once the old blob is gone.
- **Behind the gate.** The route is `/api/progress`. The middleware skips this one path (see "Access gate"), so the function checks the gate cookie itself. The function adds no auth, cookie, user id, database or sync library.
- **GET** returns the saved ticks, or the empty record if there is none or the stored blob is not the ticks shape. **PUT** takes ticks, merges them into the saved ones, stores the result only if it changed, and returns it. Any other method is 405.
- **Shape (v3).** `{ v: 3, items: { [id]: { done: boolean, at: number } } }` and nothing else.
- **Checked at the boundary.** The body must be JSON (`content-type: application/json`), at most 64 KB, exactly the v3 shape: ids that are slugs of at most 64 characters, at most 300 items, whole-number times. A body with a `settings` key (the old v2 shape included) or any unknown field is 400 (413 when too large). The error body never carries storage detail.
- **Merge** (`src/lib/merge.js`, plain JS, shared by the browser and the function). Per item the newer `at` wins. A tie keeps a tick over an untick. It is idempotent, commutative and associative, so devices can sync in any order and two devices that tick different things offline both keep their ticks.
- **No lock.** Read, merge, write. Two PUTs at the same moment can lose one update, and the next sync of the loser puts it back, because merge is idempotent and commutative.
- **Client** (`src/scripts/sync.js`). On page load, and about 400 ms after a tick changes, it PUTs the ticks and merges the answer's ticks into the device; any `settings` in an answer (an old server) are dropped. A tick made on this device always gets a time later than what it replaced, even on a slow clock. On failure it retries quietly (the `online` event, the next change, then backoff up to five tries) and never blocks the page or shows a dialog. A missing or failing endpoint (JavaScript off, offline, 401, 5xx) leaves the page fully working on local data.
- **Offline cache.** `/api/` is network-only in `public/sw.js`; progress is never served from the cache.
- **Status line.** The Checklist shows one line in a `role="status"` region about ticks only: "Ticks synced at <time>" after the last attempt succeeded, otherwise "Ticks saved on this device only". It never says synced when the last attempt failed, and it says the second until the first attempt finishes.
- **Known limits.** Last write wins per tick, by clock: a device whose clock is far ahead will win ties it should not.

## Access gate

While the site is private, a Vercel Routing Middleware (`middleware.ts` at the repo root, with the pure `decide()` in `src/lib/gate.js`, plain JS so the platform's bundler can trace it) stands in front of every page and asset. Output stays static Astro; no adapter, no runtime dependency, nothing added to the browser.

- **Password.** The Vercel env var `SITE_PASSWORD` (production and preview). It never appears in the repo, a commit, a log or a test. If it is unset or empty, the gate answers 503 to everything: closed, never open.
- **No valid cookie.** A small login page (status in the next item): inline styles from the tokens in both themes, one labelled password field (16px or more), one big button, 48px targets, `no-store`, `noindex`, and a CSP that allows no script. Posting the right password sets the cookie and answers 303 to the page first asked for. Only a same-origin path is followed (a path starting `//` or `/\` goes to `/`). A wrong password re-shows the page with one plain error line.
- **Login page status.** The login page and its wrong-password page are a document response, and browsers log every 401 document in the console. So when the request is a page navigation (`Sec-Fetch-Dest: document`) the gate answers them 200 with `cache-control: no-store`; every login page carries `x-lfg-gate: login`. Every other request (assets, JSON, fetches, curl without that header) keeps 401, so no content ever leaks. A real browser with the cookie sees no error on `/` or `/checklist/`.
- **Service worker.** The worker never stores a response that carries `x-lfg-gate`, so a cached 200 login page can never replace a real page offline.
- **Cookie.** `lfg_gate` holds SHA-256 of the password plus a fixed salt, never the password. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age` one year. Compared in constant time. This is the only cookie on the site. It is a gate token, not an account and not tracking, and it holds no preference: "No accounts" and the `lfg:v1` shape do not change.
- **Open to everyone.** `/manifest.webmanifest`, `/icons/**` and `/favicon.svg`, so the app can be installed (a manifest is fetched without cookies). Nothing with content is open: `/search/**`, `/h/**`, `/places/**` and `/mild/**` stay behind the gate. `/sw.js` stays gated too: browsers send cookies when they fetch it, and only a page that got through registers it.
- **Offline.** The gate runs only on the network. Pages a signed-in device already cached stay readable offline.
- **Rotate.** Change `SITE_PASSWORD` and redeploy; every old cookie stops working.
- **Tests.** `npm run test:unit` runs `node:test` over `tests/**` with invented passwords and no network. Run against the live site only by the build orchestrator.
- **Progress sync.** `/api/progress` is a Vercel Function behind this gate (see "Synced progress"). Its Blob token is a separate env var and is never read by the gate.
- **The sync function.** `/api/progress` is the one path the middleware does not match: the platform answered 404 when middleware handed a request on to a function. The function calls the same `decide()` itself and answers 401 without a valid cookie (503 if the password variable is unset), so there is one rule and two callers.

## Needs JavaScript

Search filtering, the dial and console switches, checklist ticks, in-place reveal, theme override, offline. Each has a no-script floor: the page still lists every `none` answer, links work, the device theme applies, and hidden details open as their own pages.

## Search

A build step writes `/search/none.json` (id, question, short, topic) and one index per hidden tier under `/h/<tier>/`. The client loads only the indexes the dial allows and filters by token match in plain JS. No search library.

## Offline and install

A hand-written service worker and a web app manifest. On install it caches the pages and assets listed in a build-generated list of default-tier URLs. Hidden-tier files are cached only after the player turns that tier on. The New screen shows "Works offline" once the cache is ready.

## Links out

The About screen and the Places gate link to the best outside tools instead of rebuilding them: gtamap.io and FullSweep for maps (both hide spoilers by default), and Rockstar Support for account and code problems. Mark each as an outside site.

## First content

The research report (on the build machine only, not in this repo) is at
`/Users/jason/code/personal/leonida-field-guide/reports/GTA 6 day one player needs.md`.
Table 1 is the ranked question list and Table 3 is 30 sourced facts.

- Write one record per ranked question that has a sourced answer, and one per remaining fact worth a card. Aim for 30 to 45 records. Do not pad.
- The report's "official" tags were never checked against a live page. Open each official source (Orca's browser renders the Rockstar pages that plain fetches cannot) and keep `official` only where the page says it. Otherwise set `reported`.
- Where sources disagree, say so in `short` and cite both.
- Skip a question rather than guess. A missing answer is fine; a wrong one is not.

## Refresh

`docs/refresh.md` holds the instructions an agent follows to refresh the content: re-check the sources of the oldest records, look for new most-asked questions and known problems, add or correct records, update `rank`, write an entry for the New screen, run the checks, and push a branch named `refresh/<date>`. A GitHub Actions workflow opens a pull request for any `refresh/*` branch and merges it when the checks pass. The same instructions serve the daily cloud run and a run by hand.

## Checks

`npm run check` runs all of these, and CI runs it on every pull request:

1. **Schema.** The build fails on a record missing a source, a date, a tier or a confidence.
2. **Spoiler leak.** A script takes every hidden string (see "Data shape") and fails if it appears in any built file outside that tier's own paths. It also fails if the default search index or the offline list names a hidden record.
3. **Behaviour**, in Playwright at 390, 820 and 1440 wide: each of the top 20 answers is reached in two taps from `/`; a ticked to-do survives a reload; the dial at Off shows no places and at Places shows them; the theme switch works and is remembered; nothing scrolls sideways; the main flows work with JavaScript off.
4. **Accessibility.** axe finds no violations on every screen in both themes.
5. **Speed.** Lighthouse on the deployed address scores 100 for performance, accessibility, best practices and SEO on mobile, with largest contentful paint under 1 second. This one runs against the live site, outside `npm run check`.

Tests assert what a player sees, never internals.

## Modern web guidance

Before writing any HTML, CSS or client JS, run the `modern-web-guidance` skill and retrieve the guides for what you are building. Start with these ids and search for more: `html`, `css`, `css-layout`, `responsive-design`, `respect-os-text-scale`, `navbar`, `tabs`, `dark-mode`, `dark-mode-toggle`, `color`, `forms`, `checkbox`, `switch`, `interactive-content-reveal`, `search-hidden-content`, `accordion`, `cross-document-transitions`, `install-web-app`, `performance`, `accessibility`. Follow each guide's fallback advice for anything not yet widely available. End your report with which guides shaped which choice.
