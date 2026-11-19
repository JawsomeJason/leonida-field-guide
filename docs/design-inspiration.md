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
