# Leonida Field Guide: build spec

The goal: a player opens this on a phone or tablet beside the console, gets an answer in two taps, and never sees a spoiler they did not ask for. It also works on desktop.

This spec is the contract. Where it is silent, pick the smallest thing that works and say so in your report.

## What it is not

- No story content, at any setting. No mission names, plot, character fates or endings, anywhere in the repo.
- No interactive map. Link to one (see "Links out").
- No accounts, no ads, no analytics, no trackers. The only cookies are the gate token and the spoiler-level word (see "Access gate"). Synced ticks are a single shared record behind the password gate, not an account: no sign-up, no user ids, no per-person data. Settings never sync. The About screen says exactly this.
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
  order?: number;                // to-dos only: lower first within a stage, by what depends on what (see "Console", One order)
  todo?: string;                 // if set, the record is a checklist item with this label
  keywords?: string[];           // up to 20 short strings (40 characters each): words players use that the text does not
  reveal?: { tier: Exclude<Tier, 'none'>; text: string }[];  // hidden details inside a 'none' answer
};
```

Rules the schema or the checks enforce:

- `confidence: 'official'` requires a source on rockstargames.com, support.rockstargames.com, take2games.com, playstation.com or xbox.com that a person or agent opened and read. Otherwise use `reported`.
- A `places` or `mild` record's `question`, `short`, `body`, `todo` and `keywords` are all hidden text. So is every `reveal[].text`. The `keywords` of a `none` record are not hidden. They sit only in the search index and are never shown on a page. Hidden text may appear only in a tier's explicit-show pages (`/<tier>/<id>/show/`, `/places/list/show/`), its `/h/<tier>/` files (fragments, search index, offline list) and nowhere else, a gate page's title, meta tags, headings, labels and links included (see "The spoiler dial").
- `topic: 'places'` implies `tier: 'places'`.
- **Confidence labels.** `official`: the claim was read on rockstargames.com, support.rockstargames.com, take2games.com, playstation.com or xbox.com. `reported`: news, guides and creators, and any claim we could not read on an official page. `community`: forums and player posts only; a news site or a console maker is never `community`. A page that returned no text is never a source for a claim.
- **Console text.** `consoles: all` text (question, `short` where there is no `byConsole`, `body`, `todo`, `reveal`) names no console and uses no console's button names, except as the tokens `{cross}` `{circle}` `{square}` `{triangle}` `{l1}` `{r1}` `{l2}` `{r2}` `{l3}` `{r3}` `{options}` `{create}`. A fact that differs by console goes in `byConsole`, or in records limited with `consoles: [...]`. `scripts/check-console-text.mjs` (`npm run check:console`) reads what each console would show and fails on another console's name or buttons.
- **Units.** Sizes are in GB, never bytes or GiB. Jargon is put in plain words where it first appears, for example pre-load (the download before launch) and Safe Mode (a start-up menu with repair tools).

## The spoiler dial

One setting for the whole app: **Off** (the default), **Places**, **Mild**.

- Off shows `none` records only. Places adds `places`. Mild adds `places` and `mild`.
- **Two addresses per hidden page.** The **gate address** (`/places/<id>/`, `/mild/<id>/`, `/places/list/`, plus the tier gates `/places/` and `/mild/`) is what default pages, search results and a typed address reach. It says what kind of content is behind it ("a places page", "a mild gameplay detail") and that the spoiler setting is below it, and holds none of the hidden text: a generic title ("Hidden page"), a generic meta description, no heading, label, link text, related link or og tag taken from the record. The slug in a link is fine. Its Show control is a plain link to the **explicit address** (`/places/<id>/show/`, `/mild/<id>/show/`, `/places/list/show/`), which holds the content in full. The gate also has a Go back to Ask link. With JavaScript and the dial already at or above the tier, the gate forwards to the explicit address (`location.replace`).
- Hidden text is never in a page the default setting loads, nor in a gate page. The build writes each hidden tier to its own files (explicit pages under `/places/**/show/` and `/mild/**/show/`, fragments, a search index and an offline list under `/h/<tier>/`). Default pages, gate pages, the default search index and the offline cache contain none of it. The explicit pages carry no list of the topic's other hidden answers: with script, an empty mount fills from `/h/<tier>/a/` only when the dial allows the tier.
- Tap to show: a `none` answer with hidden details shows a control such as "1 mild detail hidden. Show". It is a link to the detail's explicit address with `?reveal=1`. JavaScript upgrades it to fetch the fragment in place (with the header `x-lfg-reveal: 1`) and insert it. The dial does not change. A fetch that was redirected is a refusal, never content; the control then follows its link.
- **Nothing fetches an explicit address ahead of the tap** while the dial is below its tier: no `<link rel=prefetch|prerender|preload|modulepreload>` to a hidden address, no `speculationrules`, no view-transition preloading, no service-worker warming. `check:leak` fails on any.
- **The server backs the dial.** `settings.js` mirrors the dial into the cookie `lfg_dial` (the word `off`, `places` or `mild` and nothing else; `Path=/`, `SameSite=Lax`, `Secure` on https, one year; not HttpOnly, because script writes it) on load and on every change. After the sign-in gate, the middleware refuses every hidden-tier address (explicit pages, `/h/<tier>/**` fragments, search indexes and offline lists) unless the cookie's level reaches the tier, or the request is one explicit reveal: the header `x-lfg-reveal: 1` (the in-place fetch) or `?reveal=1` (the no-script Show link). The marker opens one item (an explicit page or one item's fragment) and never an index, a list or an offline list. A refused request gets a 302 to that item's gate page (an index or list to the tier's gate page) with `x-lfg-redirect: dial` and `no-store`. No cookie counts as Off. The rule is the pure `dialRule()` in `src/lib/gate.js`; `tests/e2e/serve.mjs` applies the same function so Playwright proves the whole flow.
- The Places section opens on a gate that says places are off, with the switch to turn them on. With JavaScript off, the gate is a plain link to the places list's gate address, whose Show link opens the list.
- **The line between Off and Mild.** Off is what the game itself teaches every player: its menus, tutorials and the publisher's own launch material. That is settings, saving, controls, money and police basics, and travel options. Mild is what a player would rather find out by playing: what unlocks later, tricks, and effects the game does not explain up front. Places is where things are. How the game's systems work is visible at Off; the shortcuts around them are Mild. When a `none` record holds one such sentence, the sentence goes in a Mild `reveal` and the record stays at Off; when a whole record is Mild, it is a `mild` record.
- **The one-line wording** beside the dial and in the settings sheet is exactly: Off: "what the game itself teaches every player"; Places: "adds where things are"; Mild: "adds things you would rather find out by playing". The About page spells the rule out in plain words, with one example each.
- **How the line is tested** (`tests/content/tiers.test.mjs`). `tests/content/tier-rubric.json` lists every record and every `reveal` with its tier and a one-line reason from the rule, and the test fails when the file and the records disagree. The same test holds a list of Mild signal words (unlocks later, later in the game, as you progress, secret, hidden trick, cheat, easter egg, glitch, exploit, workaround, trick, ways to shake the police and similar) and fails when the visible default text of a `none` record, source titles included, holds one. Changing a tier means changing the rubric in the same commit.
- The dial is on the first screen at every width, in the header.

## Console

One stored setting, `console`: `ps5`, `xbox-x` or `xbox-s`. It is saved on the device like the dial (see "Saved on the device"). **Never chosen is a state of its own**: the key is absent, `settings.js` hands the page `console: ''`, and `<html data-console>` is not set.

- **First run.** The Ask screen opens with one card, "Which console do you play on?", above everything else: three buttons (PS5, Xbox Series X, Xbox Series S), each at least 4rem tall, stacked on a phone. Choosing saves the console, hides the card (CSS: `html[data-console] .console-card`) and moves focus to the screen heading. The card needs script; without it the card is not shown and only every-console records are.
- **Always visible.** The header chip names the console in use on every screen ("PS5", "Xbox X", "Xbox S", or "Console" when never chosen) and opens the settings sheet, where it can be changed. Answer pages that have `byConsole` text also keep their own switch.
- **Which records show.** A record with `consoles: 'all'` is console-neutral: its text names no console, and where consoles differ it uses `byConsole` text or button tokens (`{cross}`, `{circle}`, ...). A record with `consoles: ['ps5']` (or `['xbox-x', 'xbox-s']`) is only for those consoles. It shows in its list for them (`data-only="ps5"` on the row, CSS from `styles/console.css`). For any other state, a never-chosen console included, it is hidden there and its title is one plain link in that list's **Other consoles** fold, a native closed `<details>` (`OtherConsoles.astro`, copies marked `data-other`). Nothing in the fold is a tick box or repeats an id.
- **Never chosen.** Treated as "no console matches": only `consoles: 'all'` records show, the console-only ones wait in the fold, `byConsole` is not used (the base text shows) and a button name shows both consoles' labels (`✕/A`). The card above is the calm prompt; there is nothing else to dismiss.
- **Where it applies.** Everywhere answers are listed: Ask (Most asked rows, stage to-dos), Checklist, topic cheat sheets, the answer page's related list and the desktop list column. Most asked and the lists inside hidden tiers are only filtered, with no fold.
- **Counts.** Progress counts only the to-dos that show for the console (`src/lib/console.js` `applies()`, used by `home-todos.js` and `checklist.js`). A tick on a to-do for another console stays saved and is not counted.
- **One order.** The Ask screen and the Checklist list to-dos in the same order, from one function, `todosOf()` in `src/lib/answers.ts`: most asked (`rank`) first, then by id. A to-do may carry `order` (a positive whole number, lower first), set where one step must wait for another; it wins over `rank`, and to-dos with no `order` follow in `rank` order. "Before you start" runs: redeem the boxed-copy code, update the console, free the space, turn on automatic downloads, check the countdown (`tests/content/fixes.test.mjs`).
- **Test fixtures.** `tests/fixtures/answers` has a PS5-only and an Xbox-only record with a to-do each. After choosing a console the visible text of Ask, Topics, a cheat sheet, an answer and the Checklist names no other console outside the fold, and button names are that console's (`behaviour.spec.mjs`).

## Screens

| Route | Screen | Content |
| --- | --- | --- |
| `/` | Ask | The console card until a console is chosen (see "Console"), the title with one line under it saying what the guide is for and that spoilers stay off until turned on (it names no console), search box, "Most asked" (top 8 by `rank`), then "Your stage": the stage picker and that stage's to-dos |
| `/topics/` | Topics | Ten tiles, one per topic. While the dial is Off the Places tile is a full-width dashed tile that says "Hidden until the spoiler setting is raised to Places. That adds where things are."; once the dial allows places it says it is shown |
| `/topics/<topic>/` | Cheat sheet | Every answer of the topic on one page as compact cards with anchors |
| `/a/<id>/` | Answer | Question, short answer, console switch, optional body, hidden-detail controls, how sure we are, sources, date checked, related answers. "How sure we are" reads as plain words ("Official, from the publisher or platform"); under it a native disclosure (`<details>`, a 48px row labelled "What does this mean?") opens the plain-word meaning, in the words of the About page. The label, its short phrase and the meaning all come from `src/data/confidence.js`, so About and the answer page cannot disagree. Links to other sites inside the body say they are outside sites that may contain spoilers |
| `/checklist/` | Checklist | All to-dos by stage with progress, plus export and import of the saved state as a code |
| `/new/` | New | Known problems with fixes, then what the last refreshes changed. With no confirmed problem it says so plainly and links the crash answer (`/a/crashes-and-launch-problems/`); it never says only that nothing has changed |
| `/places/` | Places gate | See "The spoiler dial" |
| any unknown path | Not found | `src/pages/404.astro`, built as `404.html`, which Vercel serves with a 404 status for an unknown path on a static site. It has the header, the tab bar and links to Ask and Topics. The gate runs first, so it is shown to a signed-in player only; it is not in the offline list |
| `/about/` | About | How spoilers are handled, how facts are sourced, links out, the unofficial notice |

**Hidden-tier pages.** Each has two addresses (see "The spoiler dial"). The gate address (`/places/list/`, `/places/<id>/`, `/mild/<id>/`, `HiddenGuard.astro`) shows a generic title (the tab title is generic too), what kind of content it holds, that the spoiler dial is below that tier, one 48px link "Show this page" to the explicit address (`/places/list/show/`, `/places/<id>/show/`, `/mild/<id>/show/`, with `?reveal=1`) and one link back to Ask. With script, a dial at or above the tier forwards the gate to the explicit address (`reveal.js`). A page already open when the dial drops stays open until the player leaves it. `/mild/` is the mild tier's plain gate, where a refused index or list lands.

**Outside links.** Every link out (answer sources, the Places gate, About) is made by `OutsideLink.astro`: the link text, then a note inside the same 48px target, "<host> · outside site, may contain spoilers", so it is read before the tap and by a screen reader. `rel="noopener"`.

Two-tap rule: from `/`, every answer with `rank` 1 to 20 is reachable in at most two taps (a "Most asked" chip is one tap; Topics then a tile is two, because the cheat sheet shows the answers inline).

## Layout

- Phone (under 600px): a bottom tab bar with Ask, Topics, Checklist, New. One column. Tap targets at least 48px. Body text 17px or larger.
- Tablet (600px to 1023px): the bar becomes a left rail. One column of content, with cells where a list has room.
- Desktop (1024px and up): rail, a list column and a detail column. On an answer page the list column shows the other answers of the same topic; on a cheat sheet it shows the topics, the current one marked. This is CSS grid only, no script.
- The width is used, not stretched. Container queries decide: "Most asked" is one column on a phone, two cells across from 32rem and four from 60rem, each row of equal-height cells, each cell still one whole-row target. On Ask, from 48rem the questions sit beside the player's stage (to-dos) in two columns. On the Checklist rows are at most 70ch wide (`max-inline-size: 70ch`) and from 56rem the four stages flow in two columns. The stage picker is two by two under 600px, so its labels never wrap. Topics tiles are in a grid at most 64rem wide. Text pages stay at 40rem.
- Header on every screen, compact and sticky (`position: sticky`, so the dial and the console are always in reach). On a phone: row one is the site name and the console chip, row two is the spoiler dial with its name beside it; at 600px and up it is one row. It takes at most about a fifth of a phone screen: 123px at 390 wide, 159px with text at 130% (both measured by `behaviour.spec.mjs`, limit 170px at 844px high). Its height is published as `--header-h` (`panel.js`) so the rail and the sheet sit below it; scroll-padding keeps anchors clear of it.
- **Settings sheet.** The chip opens a native popover (`popover`, `popovertarget`), so Esc, a tap outside and the Done button close it with no script, and so does choosing a setting (`panel.js`). It is a sheet at the bottom of the screen (centred, 30rem wide, from 600px), within thumb reach, and it ends below the header, so it never covers the dial; its backdrop does not catch taps, so the dial stays usable while it is open. It holds the console and the theme, and a short list of what each dial level adds (Off: how-to answers only; Places: adds where things are; Mild: adds light gameplay hints), which the dial's fieldset also uses as its description. Without script, or in a browser without popover, the chip still names the console; the dial stays in the header.
- The footer About link is its own 48px target under the notice.
- Use container queries for the cards and media queries for the page frame. No horizontal scrolling at any width from 320px up. Respect the user's text size setting.

## Touch

The app is used mostly by touch, on a phone or tablet. Every screen holds to these rules, and later work reuses the shared tokens (`--tap`, `--gap-tap`, `--safe-*`, `--text-input`) and classes (`.tap-list`, `.seg`) in `tokens.css` and `global.css`.

- Every tappable thing is at least 48 by 48 CSS px (`--tap`), with at least 8px (`--gap-tap`) between neighbours. Links inside a sentence are exempt.
- The whole row is the target, not a small link inside it. A checklist row is one label of at least 48px with an 8px gap to the next row; the tick box is only its picture. A card's stretched link covers the card's content, and the reveal control sits 8px or more below it.
- **How it is tested** (`touch.spec.mjs`, at 320, 390 and 820 wide with touch, every screen, first-run and everything shown with every fold open, and the open settings sheet): for every interactive element the test samples the page with `elementFromPoint` (to the pixel at the edges) and keeps the points where a tap reaches that element, itself, a child, its label or a link stretched over a card. The hit area is the bounding box of those points, so a 24px box inside a bigger label is judged as the label, and a control another element covers is judged as what is left. Nothing is skipped for being part of something bigger. Under 48px either way fails; so does another control's hit area closer than 8px (judged by the tappable points). Fixed and sticky layers float over the page and are compared only within themselves, and what an open sheet covers is not judged until it closes. A self-check feeds the measure a 24px box in a 30px label, touching rows and a bare 24px link, and needs it to flag all three. `touch-report.mjs` prints the smallest hit area per screen and width.
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
| `--bg` | `#181320` | `#f6efe2` |
| `--surface` | `#231c2a` | `#fffaf0` |
| `--line` | `#43364a` | `#dccfb6` |
| `--text` | `#f7efe6` | `#1c2a2e` |
| `--muted` | `#c5b6bd` | `#55666b` |
| `--accent` | `#ff9f45` | `#0b6f75` |
| `--accent-2` | `#ff6f61` | `#c2401f` |
| `--action` | `#f0c48a` | `#0b6f75` |

- These are starting values. Every text and control pairing must pass WCAG AA contrast in both themes; adjust a value if axe says it fails, and record the change here.
- **Night warmed (design craft pass).** Night was cold navy with cyan on everything. Every non-state surface now leans warm, a dark plum-brown instead of navy, and cyan is kept for state only. Night token changes: `--bg` `#0b1020` to `#181320`, `--surface` `#141b34` to `#231c2a`, `--line` `#2a3460` to `#43364a`, `--text` `#eef1ff` to `#f7efe6`, `--muted` `#a3acd0` to `#c5b6bd`. `--accent` and `--accent-2` were unchanged then (see the fix-round note below). New `--action` (night `#f0c48a`, a sand; day `#0b6f75`, the same teal as `--accent`): the fill of the one filled button (`.btn`, Show places), the answer's left rule and the left end of the header rule. Night contrast: text on bg 16.0, muted on surface 8.5, cyan on surface 10.7, `--bg` text on a sand fill 11.3. The login page, the `theme-color` meta tags and the web manifest use the same night values. The app icons keep their own look.
  - Controls that are not state lose the cyan: the search field border is `--muted` at rest and `--accent` on focus; the console card border is `--line`.
  - New `--font-label` (`600 0.9375rem / 1.3` in the text font): small labels and notices ("Spoilers", "How sure we are", "Checked", "Sources", "PS5 only", "0 of 6 done", "10 answers", "Other consoles", the hidden-detail control, the sync line, the offline note, About notes). They were monospace.
- **Visual pass (every change to a token or a value, in `tokens.css`).** The colour table above lists the current values; the pass below was made on the earlier ones and its other tokens are unchanged.
  - New `--shadow`: Day `0 1px 2px rgb(28 42 46 / .08), 0 2px 8px rgb(28 42 46 / .05)`; Night `inset 0 1px 0 rgb(255 255 255 / .04)` (a faint top edge, so surfaces stay quiet). Used on rows, tiles, cards and controls.
  - New `--wash` (accent 12% over `--surface`, hover and current) and `--press` (accent 22%, `:active`). They replace the repeated `color-mix` values.
  - `--radius` 0.5rem to 0.75rem. `--text-h1` `clamp(1.5rem, 1.1rem + 2vw, 2.25rem)` to `clamp(1.625rem, 1.2rem + 2vw, 2.5rem)`, weight 750, letter-spacing -0.02em. `--text-h2` 1.25rem to 1.3125rem (21px, one 1.25 step above body), weight 650. New `--space-7` 3rem.
  - New motion tokens: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--press-scale` 0.98 (rows, cards) and `--press-scale-small` 0.96 (compact controls). One press recipe in `global.css`: the surface tints with no delay, shrinks slightly (70ms in), and eases back (160ms out). Under `prefers-reduced-motion: reduce` the shrink is dropped and the tint stays. Motion is `scale`, `opacity` and colour only.
  - The settings sheet slides up 1.5rem and fades in (200ms, `--ease-out`, `@starting-style`; it moves but never resizes, so its targets stay 48px; under reduced motion it only fades); a revealed detail fades in and settles 4px (200ms); page changes crossfade in 150ms.
  - Layout: the rail is a full-height panel with a tinted current item; the spoiler dial stays on one row beside its label at 600px and up; the content column is at most 80rem (text and lists cap themselves: see "Layout"); the Ask and Checklist screens share one drawn tick box.
- Night uses amber for state only (selected tab, links, the dial, focus, ticks, progress, the pressed tint); surfaces, lines and text lean warm and stay quiet, and calls to act use `--action`. Day is warm and flat.
- **Night identity and list hierarchy (fix round 2).** Cyan with a pink rule read synthwave, not a sunny coast. Night token changes (day is untouched): `--accent` `#3ee6e0` to `#ff9f45` (amber), `--accent-2` `#ff6f91` to `#ff6f61` (coral; the error and reveal rule colour), `--shadow` `inset 0 1px 0 rgb(255 255 255 / .04)` to `inset 0 1px 0 rgb(255 255 255 / .06), 0 4px 14px rgb(0 0 0 / .35)` (a faint top edge and a soft drop, so the few raised things lift off the plum ground; it is no longer on rows). `--bg`, `--surface`, `--line`, `--text`, `--muted` and `--action` stay as they were: the warm plum surfaces and the sand button sit well with amber, so nothing else moved. `--wash` and `--press` follow `--accent`, so hover and press tints are warm. The header rule is now `--accent` to `--accent-2` (night amber to coral; day gives the same teal to rust as before). The login page (`gate.js`) carries the same two night values. Night contrast, computed: `--accent` on `--bg` 8.93, on `--surface` 8.10, on `--wash` (`#3d2c2d`) 6.45, on `--press` (`#533930`) 5.16; `--bg` text on an amber fill 8.93; `--accent-2` on `--bg` 6.68, on `--surface` 6.06.
  - Three levels. **Primary** (the main answer on a screen) is raised: a `--surface` fill, a `--line` border, `--radius` and `--shadow`. That is the answer page's short answer, the Ask search field, the Most asked rows (`.tap-list--cards`), a cheat sheet's answer cards and the 404's two exits. **Secondary** lists are plain rows: no card, no fill, no radius, no shadow, a `--line` hairline between rows. That is related answers, sources, topic rows, checklist rows, the Ask stage rows, the About links and the Back-up row. **Tertiary** is a quiet text row in the link colour ("What does this mean?"). The Places topic row, the Show controls and the Other consoles fold keep a dashed outline: dashed means hidden until you ask.
  - Plain rows keep the touch rules: the row is the whole 48px target, and the 8px between rows is margin on the link (4px above and below), with the hairline in the middle of it, so padding and separators carry the spacing, not shadows. A row's tint on hover and press bleeds 8px into the page gutter so its text still lines up with the heading above. The current row (desktop list column) takes a 3px accent edge on its inline start, in a transparent edge reserved on every row so nothing shifts. Plain rows only tint when pressed; cards also shrink slightly.
  - Reduced motion: under `prefers-reduced-motion: reduce` every transition and animation is 0s, including colour fades and the press scale. Nothing moves.
- System font stack for text. `ui-monospace` only for what a player copies or reads as a value: `<kbd>` button names, `<code>` (sizes, times, version numbers, codes) and the progress code boxes. Labels, headings and notices are sans (`--font-label`). A test fails if any other text is monospace.
- Button names are text in `<kbd>`, switched by the console setting (✕ ○ □ △ and L1/R1, or A B X Y and LB/RB). No glyph images.
- One decorative touch only: a thin sunset gradient rule under the header, built from the two accents (night amber to coral; day teal to rust, unchanged).
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
- **Service worker.** The worker never stores a response that carries `x-lfg-gate` or `x-lfg-redirect`, or one that was redirected (a hidden address sent to a 200 gate page), so a cached login or gate page can never replace a real page offline. Items already cached while their tier was on stay readable offline; lowering the dial removes them (see "Saved on the device").
- **Spoiler dial rule.** After a request passes the sign-in decision, `dialRule()` (`src/lib/gate.js`, pure) decides the hidden-tier addresses by the `lfg_dial` cookie; see "The spoiler dial". Paths are decoded once, backslashes read as slashes, dot segments resolved and case folded before the rule looks, so `/places/../`, encoded dots and `//` cannot get round it. Anything deeper than a gate page under a tier is treated as hidden. It adds no state: the cookie is a copy of a setting the player already holds on the device, used for nothing else and sent only to this site.
- **Cookie.** `lfg_gate` holds SHA-256 of the password plus a fixed salt, never the password. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age` one year. Compared in constant time. It is a gate token, not an account and not tracking, and it holds no preference: "No accounts" and the `lfg:v1` shape do not change. The only other cookie is `lfg_dial` (see "Spoiler dial rule" above): the level word, readable by script.
- **Open to everyone.** `/manifest.webmanifest`, `/icons/**` and `/favicon.svg`, so the app can be installed (a manifest is fetched without cookies). Nothing with content is open: `/search/**`, `/h/**`, `/places/**` and `/mild/**` stay behind the gate (and, signed in, the hidden tiers behind the dial rule). `/sw.js` stays gated too: browsers send cookies when they fetch it, and only a page that got through registers it.
- **Offline.** The gate runs only on the network. Pages a signed-in device already cached stay readable offline.
- **Rotate.** Change `SITE_PASSWORD` and redeploy; every old cookie stops working.
- **Tests.** `npm run test:unit` runs `node:test` over `tests/**` with invented passwords and no network. Run against the live site only by the build orchestrator.
- **Progress sync.** `/api/progress` is a Vercel Function behind this gate (see "Synced progress"). Its Blob token is a separate env var and is never read by the gate.
- **The sync function.** `/api/progress` is the one path the middleware does not match: the platform answered 404 when middleware handed a request on to a function. The function calls the same `decide()` itself and answers 401 without a valid cookie (503 if the password variable is unset), so there is one rule and two callers.

## Needs JavaScript

Search filtering, the dial and console switches, checklist ticks, in-place reveal, theme override, offline. Each has a no-script floor: the page still lists every `none` answer, links work, the device theme applies, and hidden details open as their own pages.

## Search

Players type plain sentences, so search is forgiving. No search library: `src/scripts/search-match.js` is pure (no DOM) and a test imports it.

- **Index.** A build step writes `/search/none.json` and one index per hidden tier under `/h/<tier>/search.json`. Each row has `id`, `question`, `short`, `topic`, `consoles`, `rank` and, when the record has them, `keywords`. The client loads only the indexes the dial allows. A result opens `/a/<id>/` (none) or `/<tier>/<id>/`.
- **Words.** The query is lower-cased and split. Filler words are dropped (how, do, i, my, the, a, is, on, what, are, will, it, does and similar). Plurals and endings (-s, -ies, -ing, -ed, a doubled last letter, a trailing e) fold to one stem. A numbered size such as `512gb` is `512` and `gb`.
- **Typos.** One typo (a missing, extra or wrong letter, or two letters swapped) is tolerated in words of five letters or more. The last word may be unfinished: it matches the start of a word.
- **Synonyms.** `ps5`, `ps` and `playstation` are one word. `xbox`, `series`, `xsx` and `xss` are one word. `storage`, `space`, `drive`, `disk`, `ssd`, `hdd`, `gb`, `tb` and `gigabyte` are one word. `not`, `doesnt`, `dont`, `cant`, `wont`, `isnt`, `didnt`, `cannot` and `never` are one word, so "does not work" can meet a keyword "doesnt work". A single letter (the S of Series S) is dropped. Console words and the no-word count for less than other words: they say what the player owns or colour the question, they are not the thing asked.
- **Fields and ranking.** A word is found in the question (weight 4), `keywords` (3), `short` (2) or the topic name (1). A record is a result when it matches at least half of the query words the guide knows; a word that appears in no answer does not count against it. Results are ordered by how many words match (console words and the no-word count 0.3), then by the weights, with rarer words worth more, then by `rank`.
- **Natural questions.** "do I need to download a patch before I play" finds the day-one patch answer: the answer's `keywords` hold the words players use (patch, update before play, launch update). `tests/search/queries.mjs` holds the query and the answer it must return.
- **Keywords.** `keywords` is an optional array in the schema (at most 20, each 1 to 40 characters). It holds the words players use that the text does not: `quicksave`, `instal`, `doesnt work`. For a hidden-tier record they are hidden text: they are in that tier's index only, and `check:leak` searches for them.
- **Console.** Answers whose `consoles` is a list without the chosen console are left out of the results, like the cards.
- **No match.** The list shows the three closest answers (the best partial matches, else the most asked), then a row "Browse all topics" that opens `/topics/`. The status line says nothing matched exactly. It is never a dead end.
- **Where is it.** A query that asks where something is ("where is …", "where can I find …", "location of …", "nearest …") shows, at Off, a note that places are hidden by design, with three link rows: the Places gate (`/places/`), gtamap.io and FullSweep, the last two marked as outside sites. At Places and Mild the places are searched as usual and the note is not shown.
- **No script.** The page keeps its floor: the list of every default answer.
- **Link check.** `npm run check:links` (`scripts/check-links.mjs`) fails when an internal `href` or `src` in a built page, or the page a result in any search index would open, is not a built file.

## Offline and install

A hand-written service worker and a web app manifest. On install it caches the pages and assets listed in a build-generated list of default-tier URLs. Hidden-tier files are cached only after the player turns that tier on. The New screen shows "Works offline" once the cache is ready.

## Links out

The About screen and the Places gate link to the best outside tools instead of rebuilding them: gtamap.io and FullSweep for maps (both hide spoilers by default), and Rockstar Support for account and code problems. Mark each as an outside site. Every link to another site, wherever it sits, says "outside site, may contain spoilers" inside the link: the shared `<OutsideLink>` component for rows, and the same words after a link inside an answer body. A test crawls every screen for a bare one.

## First content

The research report (on the build machine only, not in this repo) is at
`/Users/jason/code/personal/leonida-field-guide/reports/GTA 6 day one player needs.md`.
Table 1 is the ranked question list and Table 3 is 30 sourced facts.

- Write one record per ranked question that has a sourced answer, and one per remaining fact worth a card. Aim for 30 to 45 records. Do not pad.
- The report's "official" tags were never checked against a live page. Open each official source (Orca's browser renders the Rockstar pages that plain fetches cannot) and keep `official` only where the page says it. Otherwise set `reported`.
- Where sources disagree, say so in `short` and cite both.
- Skip a question rather than guess. A missing answer is fine; a wrong one is not.
- **Install size** is one answer with a short per console (all three: up to 212 GB free, whether it fits, where to check free space, then clear the difference). The Series S text and the body carry the usable-space figure (about 364 GB of 512 GB, IGN's count, named as a report) and link the Series S 512 GB answer (reported: the figure is IGN's). There is one "Make room" answer per console family (PS5; Xbox). Install size ranks 1.
- **Crashes** have an answer for all consoles (status pages, a short per console, and where to report to Rockstar) and full numbered steps per console family from PlayStation's and Xbox's own support pages. The crash answer ranks in the top 8. Known problems go to the New screen when confirmed.
- **Source choice.** Where two sources support a fact equally, cite the one whose page carries no story material. Rockstar's own pages are cited for the facts only they hold.
- **Code problems.** A failed code says where to go next: Rockstar's activation help, its support request form, then the shop or console maker. The report of sealed boxes with no code inside is its own `reported` card, so the official card cites official pages only.
- **Label by the weakest source.** A record is `official` only when every claim in it rests on an official page. A claim that needs a news site is split into its own `reported` record (unlock time and US time zones; missing code and boxes with no code). The one exception is a figure that answers the page's own question and that no official page gives (the Series S usable space on the install-size answer): the sentence names the outlet and says it is a report, and the outlet is in the sources. `tests/content/fixes.test.mjs` fails an `official` record that cites a news site without saying so.
- **Numbers.** Where a cited source gives a figure that answers the question, the answer states it and names the source: the frame-rate answer carries Digital Foundry's measured dips and input lag.
- **Plain words.** A term a non-gamer may not know comes second, after a plain phrase: "a sharpening boost (PSSR)", not "PSSR". `tests/content/fixes.test.mjs` holds a list of terms and fails when one comes first.
- **Tense.** A record never speaks of a date on or before its `checked` date as still to come. `scripts/check-dates.mjs` (`npm run check:dates`, in `npm run check`) fails a sentence that holds such a date and a future cue (will, would, due, expected, coming, ...); a test plants a violation.

## Refresh

`docs/refresh.md` holds the instructions an agent follows to refresh the content: re-check the sources of the oldest records, look for new most-asked questions and known problems, add or correct records, update `rank`, write an entry for the New screen, run the checks, and push a branch named `refresh/<date>`. A GitHub Actions workflow opens a pull request for any `refresh/*` branch and merges it when the checks pass. The same instructions serve the daily cloud run and a run by hand.

## Checks

`npm run check` runs all of these, and CI runs it on every pull request:

1. **Schema.** The build fails on a record missing a source, a date, a tier or a confidence.
2. **Console text.** `scripts/check-console-text.mjs` fails on a record that shows a console another console's name or buttons (see "Rules the schema or the checks enforce").
3. **Spoiler leak.** A script takes every hidden string (see "Data shape") and fails, naming the file and the record, if it appears in any built file other than that tier's explicit-show pages and `/h/<tier>/` files: a gate page is searched with its title, meta tags and attribute values, not only its text. It also fails if the default search index or the offline list names a hidden record, or if any page prefetches a hidden address or carries `speculationrules`.
4. **Dates.** `scripts/check-dates.mjs` (`npm run check:dates`) fails a record that speaks of a past date as still to come (see "First content", Tense).
5. **Behaviour**, in Playwright at 390, 820 and 1440 wide: each of the top 20 answers is reached in two taps from `/`; a ticked to-do survives a reload; the dial at Off shows no places and at Places shows them; a typed explicit address at Off lands on its gate, and at Places the places pages open while mild ones go back to their gate; the theme switch works and is remembered; nothing scrolls sideways; the main flows work with JavaScript off.
6. **Accessibility.** axe finds no violations on every screen in both themes.
7. **Speed.** Lighthouse on the deployed address scores 100 for performance, accessibility, best practices and SEO on mobile, with largest contentful paint under 1 second. This one runs against the live site, outside `npm run check`.

Tests assert what a player sees, never internals.

## Modern web guidance

Before writing any HTML, CSS or client JS, run the `modern-web-guidance` skill and retrieve the guides for what you are building. Start with these ids and search for more: `html`, `css`, `css-layout`, `responsive-design`, `respect-os-text-scale`, `navbar`, `tabs`, `dark-mode`, `dark-mode-toggle`, `color`, `forms`, `checkbox`, `switch`, `interactive-content-reveal`, `search-hidden-content`, `accordion`, `cross-document-transitions`, `install-web-app`, `performance`, `accessibility`. Follow each guide's fallback advice for anything not yet widely available. End your report with which guides shaped which choice.
