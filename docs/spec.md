# Leonida Field Guide: build spec

The goal: a player opens this on a phone or tablet beside the console, gets an answer in two taps, and never sees a spoiler they did not ask for. It also works on desktop.

This spec is the contract. Where it is silent, pick the smallest thing that works and say so in your report.

## What it is not

- No story content, at any setting. No mission names, plot, character fates or endings, anywhere in the repo.
- No interactive map. Link to one (see "Links out").
- No accounts, no ads, no analytics, no trackers, no cookies.
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
- Night uses colour for state only (selected tab, links, the dial); surfaces stay quiet. Day is warm and flat.
- System font stack for text. `ui-monospace` for anything a player copies or reads as a value: sizes, button names, times, version numbers.
- Button names are text in `<kbd>`, switched by the console setting (✕ ○ □ △ and L1/R1, or A B X Y and LB/RB). No glyph images.
- One decorative touch only: a thin sunset gradient rule under the header, built from the two accents.
- Models to borrow from, not copy: Vercel Docs (mono values, tabs that swap the answer in place), Dash0 (warm accent on a dark ground, mono labels), Refero (search-first home). From rivals: FullSweep's bottom bar and default-on spoiler shield, gtamap.io's plain spoiler switch, thegta6guide.com's key number on the first screen. See `docs/design-inspiration.md`.

## Saved on the device

One `localStorage` key, `lfg:v1`: `{ console, dial, theme, stage, done: string[] }`. The checklist export code is that object, base64url-encoded. Import validates before it writes. Nothing leaves the device.

## Access gate

While the site is private, a Vercel Routing Middleware (`middleware.ts` at the repo root, one self-contained file whose pure `decide()` is exported for the tests) stands in front of every page and asset. Output stays static Astro; no adapter, no runtime dependency, nothing added to the browser.

- **Password.** The Vercel env var `SITE_PASSWORD` (production and preview). It never appears in the repo, a commit, a log or a test. If it is unset or empty, the gate answers 503 to everything: closed, never open.
- **No valid cookie.** 401 and a small login page: inline styles from the tokens in both themes, one labelled password field (16px or more), one big button, 48px targets, `no-store`, `noindex`, and a CSP that allows no script. Posting the right password sets the cookie and answers 303 to the page first asked for. Only a same-origin path is followed (a path starting `//` or `/\` goes to `/`). A wrong password re-shows the page, 401, with one plain error line.
- **Cookie.** `lfg_gate` holds SHA-256 of the password plus a fixed salt, never the password. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age` one year. Compared in constant time. This is the only cookie on the site. It is a gate token, not an account and not tracking, and it holds no preference: "No accounts" and the `lfg:v1` shape do not change.
- **Open to everyone.** `/manifest.webmanifest`, `/icons/**` and `/favicon.svg`, so the app can be installed (a manifest is fetched without cookies). Nothing with content is open: `/search/**`, `/h/**`, `/places/**` and `/mild/**` stay behind the gate. `/sw.js` stays gated too: browsers send cookies when they fetch it, and only a page that got through registers it.
- **Offline.** The gate runs only on the network. Pages a signed-in device already cached stay readable offline, and the service worker is unchanged.
- **Rotate.** Change `SITE_PASSWORD` and redeploy; every old cookie stops working.
- **Tests.** `npm run test:unit` runs `node:test` over `tests/**` with invented passwords and no network. Run against the live site only by the build orchestrator.

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
