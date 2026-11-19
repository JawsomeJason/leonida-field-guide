# Design inspiration: spoiler-safe second-screen quick reference

Collected 2026-11-18 for the design owner. Patterns only, no designs. No assets copied; links and descriptions only.

## Evidence key (read this first)

- **[OPENED]** I fetched the page today and read its text or metadata. Fetches were server-side HTML only, so I did NOT see rendered layouts, JS-driven UI or behaviour at different widths.
- **[SEARCH]** Taken from a web-search result summary today. I did not open the page itself.
- **[MEMORY]** Described from prior knowledge. Not checked today. Verify before relying on it.

Phone/tablet/desktop behaviour below is mostly [MEMORY] or from design-system docs [SEARCH]. Treat it as a hypothesis to test, not an observation.

## Gallery access report

| Site | Result |
|---|---|
| Mobbin https://mobbin.com | Home loads [OPENED] (claims 600,000+ screens). Full browsing needs login; public category pages exist, e.g. https://mobbin.com/explore/mobile/screens/search and https://mobbin.com/explore/mobile/ui-elements/search-bar [SEARCH]. Could not see into the library. |
| Refero https://refero.design | Home loads [OPENED]. Full search and screenshots are gated. Could not see into it. |
| Godly https://godly.website | Loads [OPENED] but the HTML was a bare shell (nav, categories); gallery cards are JS-rendered. Not inspected. |
| Land-book https://land-book.com | 403 to my fetch. Not seen. |
| Pageflows https://pageflows.com | Home loads [OPENED]; flows are login-gated. Not seen into. |
| Lapa Ninja https://www.lapa.ninja | 403. Not seen. |
| Screenlane https://screenlane.com | Redirected to the Page Flows site [OPENED]. Not seen. |
| Page Collective https://pagecollective.com | Same redirect to Page Flows [OPENED]. Not seen. |
| Dark Mode Design https://www.darkmodedesign.com | Loads [OPENED]; only site names visible (no images). |
| Minimal Gallery https://minimal.gallery | Loads [OPENED]; metadata only. |

Honest summary: the galleries gave me almost no visual evidence. Most of the value below comes from real products and design-system docs. Someone with a login should spend 20 minutes in Mobbin (search, bottom sheet, tab bar, settings toggles) and Refero (dark UIs) to confirm the visuals.

## Patterns (11)

### 1. Search as the home, with a peeking sheet
- **Problem:** Player has one question mid-fight. A category menu costs taps.
- **Seen:** Mobbin search-screen and search-bar collections https://mobbin.com/explore/mobile/screens/search, https://mobbin.com/explore/mobile/ui-elements/search-bar [SEARCH: Grubhub "Recent Searches" screen, Google Maps / Lyft search bar plus bottom sheet]. Mobbin's command-palette glossary https://mobbin.com/glossary/command-palette [SEARCH]. Bottom-sheet-as-search-home write-up https://www.eleken.co/blog-posts/bottom-sheet-ui [SEARCH]. Devhints https://devhints.io [OPENED, a cheat-sheet index with a search field and every sheet one tap away].
- **Behaviour:** Phone: search field pinned at thumb height (bottom), recents and "common questions" as chips under it. Tablet: same, with results in a side pane. Desktop: `/` or Cmd-K focuses it; results and detail sit side by side. (Hypothesis, [MEMORY].)
- **Game app:** Home is one search box, five "most asked" chips and recents; any answer is query + one tap = two taps.

### 2. Spoiler gate by tap-to-reveal, per item
- **Problem:** A player needs the answer to one thing without learning the next.
- **Seen:** Portal Wiki spoiler template blacks out text and images, with a Spoilers tab to toggle https://theportalwiki.com/wiki/Help:Spoilers [SEARCH]. StrategyWiki spoiler template https://strategywiki.org/wiki/Template:Spoiler [SEARCH]. Fandom SpoilerTags (toggle all on a page) https://dev.fandom.com/wiki/SpoilerTags [SEARCH]. GameFAQs spoiler button in the editor https://gamefaqs.gamespot.com/boards/2000094-gamefaqs-contributors-faqs-and-guides/74841033 [SEARCH].
- **Trust:** Portal Wiki's blacked-out block is the clearest model (content is hidden, not just blurred, with one global switch). The Fandom Spoilers extension is reported to fail on mobile: the button never appears and content stays hidden https://help.fandom.com/wiki/Extension:Spoilers [SEARCH]. That is a fail-closed behaviour but a dead end. Lesson: reveal must work by touch.
- **Behaviour:** Phone: whole-block tap target, min 44px. Tablet/desktop: also keyboard (Enter/Space) and a page-level "reveal all" control.
- **Game app:** Every spoilable fact renders as a labelled redacted bar ("Spoiler: late game"), never the text in the DOM until revealed.

### 3. Global spoiler level, set once, enforced everywhere
- **Problem:** Per-item taps get tiring and one slip ruins the evening.
- **Seen:** PS5 system "Spoiler Warnings" with a choice between hiding everything you have not seen and hiding only developer-flagged content https://tech.yahoo.com/gaming/articles/gta-6-turn-playstation-5-181700801.html [SEARCH]. NBA "Hide Scores" toggle https://support.watch.nba.com/hc/en-us/articles/115000587174-Hide-Scores [SEARCH].
- **Trust:** The PS5 two-tier choice is the most trustworthy because it states what is hidden. Hide Scores is binary and clear. Ambiguous labels ("safe mode") would not be.
- **Behaviour:** One setting reachable from the top bar on every screen (phone: icon in header; desktop: persistent chip). Stored on device.
- **Game app:** A 3-step slider "I've finished: nothing / the early game / most / everything", with per-category overrides under it. Search results obey it too, including result titles and snippets.

### 4. Navigation that changes shape with width
- **Problem:** A bottom bar is right on a phone and wasteful on a 27-inch monitor.
- **Seen:** Material 3 guidance: compact (<600dp) navigation bar; medium (600-839) bar or rail; expanded (840+) rail; 3-5 destinations for a bar, 3-7 for a rail https://m3.material.io/components/navigation-bar/guidelines, https://m3.material.io/components/navigation-rail/overview [SEARCH]. Android responsive navigation https://developer.android.com/develop/ui/views/layout/build-responsive-navigation [SEARCH]. Material 3 Expressive moves drawers to expanded rails https://9to5google.com/2025/05/14/material-3-expressive-navigation/ [SEARCH].
- **Behaviour:** Phone: bottom bar, 4-5 items, search as the centre or first item. Tablet: rail on the left edge (left-handed or landscape thumb reach is a risk to test). Desktop: expanded rail with labels, or sidebar with the list and detail panes beside it.
- **Game app:** Same four destinations (Search, Guide, Checklist, Settings) at every width; only the container changes.

### 5. Big-type, one-answer-per-screen "cook mode" card
- **Problem:** Glancing from 1 m away, one hand, dim room.
- **Seen:** Recipe cook modes: one step per screen, large step text (examples cite 32sp native, 20-22pt web), big next/back targets, swipe, screen kept awake, a small "screen awake" pill https://github.com/Famick-com/FamickHomeManagement/pull/171, https://github.com/christopherjohnson1535/recipe-box/issues/13, https://www.slrp.com.au/features/cook-mode [SEARCH]. Wake Lock caveat: needs HTTPS, re-acquire on `visibilitychange`, hide the toggle where unsupported [SEARCH].
- **Behaviour:** Phone: one card fills the screen, swipe or big buttons. Tablet: card plus a thin list of the next items. Desktop: card column with the full list beside it.
- **Game app:** "Focus" view for any answer: headline fact in very large type, 2-3 supporting lines, a Back-to-results button that is the biggest target.

### 6. Dense reference that survives a dim room
- **Problem:** Tables of stats are unreadable at arm's length on a dark OLED.
- **Seen:** Destiny Item Manager, a PWA that runs on PC, tablet or phone https://www.destinyitemmanager.com [OPENED, text confirms PWA and multi-device]; its dense dark UI is [MEMORY]. Dark Mode Design gallery https://www.darkmodedesign.com [OPENED, names only]. Devhints sheets use compact two-column cards https://devhints.io [OPENED text; layout from MEMORY].
- **Behaviour:** Phone: single column, 17-18px body minimum, the key number at 28px+. Tablet: two columns of cards. Desktop: three-column grid or table with sticky header. Target contrast 7:1 for body text on near-black (not pure #000, to limit halation and OLED smear) [MEMORY, WCAG AAA figure].
- **Game app:** Cards lead with the answer in one line; detail collapses under a disclosure.

### 7. Checklists saved on the device, with export
- **Problem:** Players will not make an account to tick off a collectible.
- **Seen:** trackr.games (data only in the browser) https://trackr.games/ ; achievementguides.com (auto-save in browser, "Export sync code / Import sync code") https://achievementguides.com/ ; Skyrim tracker with guest mode https://skyrimtracker.strangelabs.io/ ; gamecompletion.net warns that clearing site data erases ticks https://gamecompletion.net/ ; FN Tracker saves to localStorage with no export https://fntracker.org/ [all SEARCH].
- **Trust:** Export/import code is the one that earns trust. FN Tracker's silent loss risk is what to avoid.
- **Behaviour:** Phone: full-row tap target, progress bar in header. Tablet/desktop: group by category in columns with a sticky progress summary.
- **Game app:** Save on device, show "Saved on this device" plus an Export button; ask for persistent storage (`navigator.storage.persist()`, [MEMORY]) once installed.

### 8. Source and freshness as a quiet footer line
- **Problem:** Players need to know whether a tip matches their game version, without a wall of citations.
- **Seen:** Wikipedia mobile "Last edited" footer link to history https://en.wikipedia.org/wiki/Help:Page_history [SEARCH]; a 2014 mobile "last edited by" bar at the top was tried then, per mailing-list notes [SEARCH, weak]. Mobbin shows nothing comparable, I found no strong gallery example.
- **Behaviour:** Phone: one muted line per card ("Checked 12 Nov, game v1.2, source: tap"), source opens in a sheet. Desktop: same line plus hover tooltip. Show a visible state only when something is stale or disputed.
- **Game app:** Per-fact `checked` date and `patch` field; stale facts get a small amber dot, not a banner.

### 9. Offline and install signalling
- **Problem:** Console rooms often have poor Wi-Fi; players need to know the guide is usable offline.
- **Seen:** DIM offers install per OS from its landing page https://www.destinyitemmanager.com [OPENED]. web.dev PWA installation guide https://web.dev/learn/pwa/installation [OPENED, headings]. Offline-ready conventions: one-shot "ready for offline" toast after the service worker activates, a persistent banner only while offline, an update toast with an Update button; a permanent "Offline ready" pill is criticised as marketing https://github.com/vite-pwa/vite-plugin-pwa/pull/960, https://github.com/d-oit/do-knowledge-studio/issues/874, https://github.com/StanleyLl0yd/SeaBattle/issues/19 [SEARCH]. Merlin Bird ID uses downloadable regional packs and advises downloading before a trip https://support.ebird.org/en/support/solutions/articles/48001185783-sound-id [SEARCH; third-party claims conflicted on what works offline].
- **Behaviour:** Phone: install hint after the second visit, not the first. Desktop: install icon in the address bar plus a Settings entry.
- **Game app:** Toast "Ready offline" once, then a banner only when offline; show "Content as of <date>" next to it.

### 10. Platform switcher for button glyphs
- **Problem:** "Press Triangle" means nothing to an Xbox player.
- **Seen:** I found no guide site with a true glyph toggle [SEARCH]. Closest: VULKK Elden Ring controls guide with a column per platform https://vulkk.com/2022/02/26/elden-ring-pc-and-console-controls-guide-and-lists/ ; keymap.io Xbox-to-PlayStation conversion on three drawn controllers https://keymap.io/xbox-to-playstation-buttons/ ; Ys VIII lets the player choose numbers, PlayStation symbols or Xbox letters https://steamcommunity.com/app/579180/discussions/0/3288067088104143307/ [all SEARCH]. Free CC0 prompt art exists https://opengameart.org/content/free-controller-prompts-xbox-playstation-switch-pc [SEARCH, licence to be checked by whoever uses it].
- **Behaviour:** Phone: segmented control (PlayStation / Xbox / Keyboard) in Settings, remembered. Controller diagram: a single labelled controller with numbered callouts, callouts become a list under the drawing on narrow screens. Desktop: diagram left, list right.
- **Game app:** Store tokens (`btn.confirm`) in content and render by platform; "Square / X" text labels are the fallback if glyph art is not licensed.

### 11. Spoiler-safe search results
- **Problem:** The search box is the biggest spoiler leak (titles, snippets, suggestions).
- **Seen:** Hide Scores hides every surface, not just the score page https://support.watch.nba.com/hc/en-us/articles/115000587174-Hide-Scores [SEARCH]. PS5 "hide everything unseen" tier [SEARCH, see 3]. Not verified in any gallery.
- **Behaviour:** All widths: results over the user's spoiler level show a neutral title ("Locked: later in the game") and no snippet; autocomplete never offers them.
- **Game app:** Filter before rendering, in the index; never rely on CSS blur.

## Three visual directions

Palettes are starting ideas, not tokens. Fonts are on Google Fonts [MEMORY, check availability]. None copy any game's branding.

### A. "Dusk Terminal" (night-first, neon accents)
- **Look:** Deep navy base, a thin sunset gradient used only as a header rule, neon only on state (reveal, progress). Highest legibility; best for the dim room.
- **Fonts:** Chakra Petch (headings), Inter (body), JetBrains Mono (numbers, coordinates).
- **Palette:** base #0D0221 to #151A28; text #F4F6FA; accent teal #2DE2E6; accent pink #FF5FA2; warn amber #FFD166.
- **References:** palette ideas https://www.media.io/color-palette/teal-coral-color-palette.html and https://devpalettes.com/neon-color-palettes/ [SEARCH]; browse https://www.darkmodedesign.com [OPENED, names only] and https://godly.website [OPENED, shell] for dark references.

### B. "Sun-Bleached Pastel" (coastal day look with a night variant)
- **Look:** Warm sand and sea-glass surfaces, coral for actions, dark-teal text; the dark theme inverts to deep teal. Friendlier, lower drama; contrast needs care.
- **Fonts:** Fraunces (display, soft serif), DM Sans (body), Space Mono (labels).
- **Palette:** sand #F4EAD5; teal #0A8A8A; coral #FF4F6D; mint #B9F3E4; ink #151A28.
- **References:** https://www.media.io/color-palette/teal-coral-color-palette.html and https://www.media.io/color-palette/sunset-color-palette.html [SEARCH]; https://minimal.gallery [OPENED, metadata only] for restrained layouts.

### C. "Vanishing Point" (retro-grid, outrun horizon)
- **Look:** Perspective grid and banded sun as a decorative hero only; content cards stay flat and plain. Most recognisable, most risk of costume. Use for the splash and empty states, never behind data.
- **Fonts:** Monoton for the logotype only (illegible small), Outfit (headings), Space Grotesk (body).
- **Palette:** "Miami sunset" #FF5FA2, #FF8A3D, #FFD166, #2DE2E6 on #1B1F3A.
- **References:** https://codefronts.com/design-styles/css-retro-designs/vaporwave-aesthetic-website-theme-design/ , https://digitalheroesco.com/styles/vaporwave/ , https://devpalettes.com/neon-color-palettes/ [SEARCH]; https://dribbble.com/treshasweb/shots [SEARCH]. Caution: vaporwave is a generic aesthetic, but keep palms, specific logo shapes and any named-place lettering out to stay clear of existing game branding.

**Pick:** A for the working screens, borrowing C only for the splash. (My view, about 65% sure. Untested on real screens.)

## Five things to avoid

1. **Ad clutter and pop-ups over the answer.** GameFAQs: floating video ad that follows you and covers over half the screen, per forum posters https://gamefaqs.gamespot.com/boards/2-message-board-help/80621257 [SEARCH]. Also see MapGenie's ad-supported footer (AdChoices, IGN) https://www.mapgenie.io [OPENED]; how intrusive its map pages are I did not see.
2. **Autoplay and auto-unmuting video.** Ads unmuting themselves: https://gamefaqs.gamespot.com/boards/2-message-board-help/80901462 ; autoplay video ads crashing wiki pages on PS5 boards: https://gamefaqs.gamespot.com/boards/264562-playstation-5/80538613?page=5 [SEARCH, user reports].
3. **Spoilers in headings, titles and snippets.** I found no page I could verify today. Common on wikis whose section titles name later content [MEMORY, unverified]. A mild contrary example: Serebii puts a "be warned, this contains spoilers" line beside links https://www.serebii.net [OPENED text], which warns but leaves the link text open.
4. **Layout shift as ads or images load.** Ad boxes that grow and push content down: https://forums.anandtech.com/threads/ads-cause-page-to-shift-while-loading.2485060 ; Google guidance to reserve ad slot sizes https://developers.google.com/publisher-ads-audits/reference/audits/cumulative-ad-shift [SEARCH; neither is a game-site example]. A moving tap target is worse on a second screen, where you tap without looking.
5. **Tiny tap targets in dense link lists.** Serebii's home page is a very dense run of text links (nav of hundreds of game names) https://www.serebii.net [OPENED text; size of targets not measured, inferred from link density]. Fandom's Spoilers extension button not appearing on mobile https://help.fandom.com/wiki/Extension:Spoilers [SEARCH] is the related failure.

## Not covered or weak

- No rendered screenshots seen; all layout claims are textual.
- Not reached: Land-book, Lapa Ninja (403), Merlin site (403), speedrun.com (403). Not looked at at all: Hades or Elden Ring fan reference sites, Pokémon tracker apps beyond Serebii, transit and score apps (NBA Hide Scores only via help page).
- Pattern 8 (freshness) has the weakest evidence.
- Tablet behaviours are the most speculative.

## Rivals seen in a real browser (2026-11-18)

Method: Orca embedded browser, 390x844 at 2x with touch emulation, then 1280x800 for desktop. Read-only, no sign-ins, no walkthrough or story pages opened. Screenshots are kept outside the repo. Tap sizes are measured from the DOM (smallest link or button) unless marked "eyeballed". Everything below was observed on launch eve (the countdown read under 24 hours), so pages are in their busiest, most-edited state.

Correction to the earlier notes: sixcountdown.com is a separate countdown site. The spoiler-safe map and tracker called Checkpoint Six lives at checkpointsix.com.

| Site | First screen on a phone | Ads / pop-ups / consent / video | Spoilers | Checklist saves without account | Taps to a basic answer | Tap size and type (phone) | Maintained? |
|---|---|---|---|---|---|---|---|
| FullSweep (fullsweepmap.com) | A full-screen map with a slim countdown bar, a progress chip, and a five-tab bottom bar (Map, Checklist, Wiki, Guides, More) | No ads, no consent wall, no video. One dismissible launch-alert email strip at the top | A "Spoiler shield" selector, default "Prologue only", with steps up to "Show everything". Gating is by story act. On desktop the selector sits in the top bar; on a phone it is inside the filter panel | Page copy says "No account", progress "on your device". Not ticked or reloaded by me, so claimed, not tested | Install size: not found on home or the launch page within 2 taps (a map-size guide exists). Launch info: 2 taps (home, Launch plan) | Bottom tabs about 78x56 px (eyeballed), clear. Page text 14 px Inter, tight. Content pages are 16 px type on a dark page, readable | Yes: launch page dated 24 Sep, a public changelog, 9 languages. A small bug: the home says "in 1 days" while a sub-page says "0 days" |
| Checkpoint Six (checkpointsix.com, plus sixcountdown.com) | A hero with the game's own logo, a live countdown, two big pill buttons | No ads or consent. A dismissible top banner pushes a trailer. Heavy full-bleed background image; a "Scroll" label overlaps the legal line at the bottom of the phone hero | Page copy promises "spoiler-safe by default, nothing unlocks until you find it". I did not find the control itself: the map page I opened is a long editorial article, not an interactive map. Home shows a character section with no hiding | No tracker seen. Not verified either way | Install size: 1 tap from the countdown site's chip row ("How big is it?"), but that is the sister domain. On checkpointsix.com the home does not answer it | Smallest links 15-23 px, so small. Body 17 px Public Sans, condensed all-caps display type; low contrast grey paragraph text over an image | Map article dated 29 Aug, countdown ticking, so lightly maintained. The product described on the home is not what the map page delivers |
| gtamap.io | A full-height interactive map with a top bar (logo, Menu, search, language, theme, sign in) and a Filters button | Ad slots exist in the markup (five `ins` or iframe nodes) but rendered empty, so none seen. No consent wall. A site-wide "Skip to content" link | A "Spoiler-safe mode" switch, ON by default in my fresh session. It hides community-mapped landmarks and keeps only Rockstar-confirmed places. Pin labels (Official, Community-estimated, Unverified) explain what is shown | Local save plus a JSON and GeoJSON export and import. Sign-in is optional, for sync. Not ticked by me | Install size: not on home. The FAQ is 2 taps (Menu, FAQ) and opens with an at-a-glance table. Release date and price are on that page | Smallest controls about 19 px. Top-bar buttons about 44 px. Body 16 px rounded system font with a condensed display face. Readable | Yes: the FAQ says last edited 19 Nov, fact-checked 18 Nov, with the latest official announcement linked |
| thegta6guide.com | An editorial hero: a large serif headline "Unlocks at midnight local time", a live countdown, and "up to 212 GB" printed under it. Two big buttons below | No ads, consent, pop-ups or autoplay. Light cream page, no tracking banner | None. The home lists a "Latest GTA 6 news" block whose headlines are walkthrough-style task titles. Nothing is hidden or gated. This is the main reason it fails a spoiler-safe test | Yes, stated twice: ticks are stored in the browser, no account, with a "Reset progress" button. 22 checkboxes counted. It labels the list "expected", not confirmed | Install size: 0 taps, on the first screen (212 GB). Release time: 0 taps | Primary buttons about 44 px tall. Smallest links 19-24 px. 16 px body, large serif headings. Very readable | Yes: items dated 19 Nov, 19-language switcher |

### Phone and desktop observations

- FullSweep desktop: a three-column app. Search and category filters with live counts on the left, the map in the middle, a launch-alert card and a progress panel on the right. It is the closest thing here to a real tool.
- gtamap.io desktop: left panel with search, the spoiler switch, then layers with counts; map on the right. Same structure as FullSweep, plainer.
- Checkpoint Six desktop: a marketing page, with the key art as a full-bleed image. Nothing app-like.
- thegta6guide desktop: a two-column editorial hero, serif type on cream, nav of five links. Calm and legible, not an app.

### Verdict

Is any one of them already good enough that a new app adds little? No, with one close call. FullSweep is the nearest: a free, no-ads, no-account map with a default-on spoiler shield and a dated changelog. But its first phone screen is a map, not an answer. Install size and best settings are not within two taps, the spoiler control is buried on a phone and only gates by story act, and it sells a paid Pro tier. gtamap.io has the cleanest spoiler switch but carries ad slots and is map-only. thegta6guide answers questions fastest but has no spoiler control and shows task-style headlines on the home. Checkpoint Six's map is an article, not a tool.

What a new app would need to do better to be worth building:
1. Put the answers first: install size, best settings, controls and launch status on the first phone screen, zero or one tap, with no map load.
2. A spoiler control that is visible on the first screen on a phone, defaults to hidden, works per item and not only per story act, and stays hidden through search results and share links.
3. A checklist that saves on the device, can be exported and imported without any account, and still works offline.
4. One-handed layout: bottom navigation, controls of at least 44 px, no overlapping or low-contrast text, nothing that auto-opens.
5. No ads, no tracker banner, no paid tier on the core answers, and a visible "last checked" date on every fact.
6. Original look. Two of the four sites lean on the game's own logo and key art. A new app should not.

Not seen: the FullSweep and Checkpoint Six checklists in use (I did not tick or reload), the spoiler shield's behaviour once changed, any best-settings page on any of the four, whether FullSweep and gtamap.io count from a returning visitor's saved state, and the Checkpoint Six tracker if one exists (the claim was not confirmed).

## Galleries seen in a real browser (2026-11-18)

Method as above, desktop width 1280. About 11 gallery visits and 5 live-site visits at phone width. Fonts are read from the live page's computed style where I opened it; font names inside gallery tiles were not listed by any gallery.

### What each gallery offers

- godly.website redirects to recent.design, a general design feed (Design, Launch Videos, Websites, OG Images, App Screenshots, App Icons, Tools). Filter chips: All, Web, Interface, Branding, Motion, Illustration, Posters, Print. A sponsor tile and a jobs panel. Mostly motion and 3D showpieces, little documentation or tool design. Not useful for this brief.
- land-book.com: search box, a cookie banner with Reject all, and a promo banner. Filters: Industry, Style, Type, Typography, Color, Platform, plus a Mobile view and a Sections view. A detail page shows a desktop and phone preview side by side, a swatch strip of extracted colours, tags (for example Sans Serif, Big Footer, Saas), but no named fonts. Best gallery for this brief.
- lapa.ninja: dark site with a large category list (SaaS, Dev Tools, Productivity, App, Software, Dashboard-adjacent). Category pages carry a third-party ad block above the grid. Fonts have their own section.
- darkmodedesign.com: a two-column grid of large dark-site cards, no categories or search, a sponsor card. Useful only as a mood board.
- minimal.gallery: a black page with tag chips (SAAS, Tools, Software, Programming, Finance, Directory). Three-column grid with dates. Weekly email form at the top.
- refero.design: a dark, search-first home: a prompt box with Web apps, iOS apps and Styles tabs and suggested searches such as data tables with filters and empty states. Filtering by page type (for example Dashboard) shows five results, then a sign-in wall ("1,449 more pages hidden"). A promo pop-up covers the lower left.
- mobbin.com: the public home is a sign-up pitch with a cookie bar (Accept or Deny). I did not open the discover pages, so the screen library itself was not seen.

### Designs worth borrowing (8)

| # | Product | Gallery | Live | Layout | Colour and type | Borrow |
|---|---|---|---|---|---|---|
| 1 | Vercel Docs | lapa.ninja (Vercel listing, lapa.ninja/post/vercel-3/) | vercel.com/docs | Phone: slim top bar (mark, "Docs", more, menu), then a 48 px headline, short intro, three small pill buttons, a tab row (Deploy, Set up, Call a model) over a code card with a copy icon | Pure black ground, light grey text (237), Geist Sans and Geist Mono, green only on code tokens | One row of tabs that swaps the answer in place, and mono type for anything copyable |
| 2 | Dash0 | land-book.com/websites/72595-opentelemetry-native-observability-dash0 | dash0.com | Phone: a coloured announcement strip, a floating rounded nav pill (logo, search, grid menu), a small mono label chip, a 32 px two-tone headline, one email field with a coral button, then a product screenshot | Near-black (16,16,16) with warm coral and amber accents; Roobert for text, Martian Mono for labels. Swatch strip on land-book: charcoal, brown, coral | A warm neon accent on charcoal and mono micro-labels. One accent, used sparingly |
| 3 | Mintlify | land-book.com (documentation search; two Mintlify listings) | mintlify.com | Phone: logo and menu, a small live "agent traffic" ticker, a 40 px serif headline, a white primary button, then a docs-app mock with a left rail and card grid. Floating "Ask assistant" button | Dark teal-black ground, lime green line art, Inter plus a serif display face (Arizona Flare) | A persistent floating ask or search button, and a lime-on-dark accent that reads as neon without being pink |
| 4 | Refero | refero.design (also listed on lapa.ninja) | refero.design | Desktop: a narrow left rail (New research, Web apps, iOS apps, Styles), a huge serif headline, then one wide prompt box with four mode chips and six suggested searches in two columns | Near-black ground, grey subtext, white pill for the active item, a serif display face and a clean sans for UI | The search-first home: one box, a handful of chips, suggested queries underneath |
| 5 | Mercury (dashboard shots) | refero.design/search?page_types[id][]=28 (Dashboard filter) | mercury.com (not visited) | Light dashboards: a left rail, a welcome row, balance card with a chart, an accounts card, tabbed sub-pages | Light grey and white with one indigo accent, small dense type | Dense cards with one clear number each. Light, so only the structure applies |
| 6 | The GTA 6 Guide | not in a gallery (found in Part 1) | thegta6guide.com | See table above: first screen is one answer, a countdown, then two full-width buttons | Cream ground, black and rust accent, a serif display face and a system sans | Answer-first hero: the thing people came for is on screen with no tap. Needs a dark skin and a spoiler gate |
| 7 | FullSweep | not in a gallery (found in Part 1) | fullsweepmap.com | Phone: a map filling the screen, a bottom bar of five tabs, one floating menu and one floating stats button. Desktop: filters, map, side panel | Near-black UI, Inter, category colours as small rounded pins | The bottom tab bar and category colour coding; the filter panel behind a single floating button |
| 8 | Vitrine and Lime Duo | darkmodedesign.com (first two cards) | joinvitrine.com, limeduo.com (not visited) | Centred hero on black, a single glowing object, a one-line headline | Black with one saturated accent (lime, cobalt) | Only the mood: one glowing accent on near-black. Not a layout to copy |

### The three strongest models and why

1. Vercel Docs: the clearest dark reference page, with one primary action, mono type for copyable values, and a tab strip that changes the answer without leaving the page.
2. Dash0: proves a warm coral or amber accent on charcoal can feel neon and coastal at once, with mono micro-labels, and it stays legible at 16 px on a phone.
3. Refero (with Mintlify's floating ask button as the second half): a search-first home where the box is the page, plus a persistent one-thumb search entry on every screen.
Runner-up for structure: FullSweep's bottom tab bar, the only one of the Part 1 sites that suits one-handed use.
Avoid: Checkpoint Six's use of the game's own logo and key art; every tile on godly.website and darkmodedesign.com as a layout model (they are showpieces, not tools).

### Not seen

- Mobbin discover, search and filter pages (only the home was opened). Its dashboard, checklist and mobile-web screens were not seen.
- Any named font inside a gallery tile; names above come only from sites I opened.
- Mercury, Vitrine and Lime Duo live pages (gallery thumbnails only).
- Most of Refero's results past the first five (sign-in wall).
- Dark theme and light theme toggles on the live sites, except where the default was dark.
- Any page at tablet width.
