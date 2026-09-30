# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

139 tests across 20 spec files — all active (no `describe.skip`'d suites). Tests run on 5 browser projects: `chromium`, `firefox`, `webkit` (desktop), `mobile-chrome`, and `mobile-safari`. Each file skips irrelevant viewports via `startsWith('mobile-')` checks.

The Playwright webServer launches with `VITE_IS_REVEAL_SEASON=true` so the reveal-season active code paths are exercised. Flag-off behavior is covered by unit tests (`useRevealPhase.test.ts` and the route gate).

**Warm-up before the first test (#664):** `e2e/global-setup.ts` opens the 7 pages `accessibility.spec.ts` visits, up to 3 at a time (never more than the run's workers), on the run's fresh Vite, and waits until no module request has been in flight for 1 s. So the app shell every page shares and those pages compile before any test (every module on its first request, every TSX file through the React Compiler's Babel pass), not inside the first wave's 30 s, and the run log shows `E2E warm-up: 7 routes in N s`. A page that fails to load, or takes over 180 s, stops the run with an `E2E warm-up:` error naming it. What stays cold still compiles on first use, inside a test: the card modal (loaded on the first interaction), the mobile-only search sheet, and pages the warm-up doesn't open (`/compare`, `/vote`, `/reveals`, `/admin/analytics`). The mobile projects skip `accessibility.spec.ts`, so their first tests start on such pages, with only the shell warm. Skipped under `PWDEBUG`, whose Inspector would otherwise pause on the warm-up's own browser.

**Global console-error guard:** the shared `page` fixture (`e2e/fixtures/test-fixtures.ts`) fails any test that logs a `console.error` or throws an uncaught exception, except messages matching the documented `BENIGN_CONSOLE` allowlist. This turns silent runtime faults — most importantly React's "Maximum update depth exceeded" render loop, which a loading-skeleton assertion otherwise passes through — into red builds across every spec.

## `accessibility.spec.ts` — 7 tests (desktop only)

| Test | What it verifies |
|---|---|
| home page should have no axe violations | `/` passes axe-core audit with zero violations |
| browse page should have no axe violations | `/browse` passes axe-core audit |
| card detail page should have no axe violations | `/card/1939` passes axe-core audit |
| playstyle gallery should have no axe violations | `/playstyles` passes axe-core audit |
| playstyle detail should have no axe violations | `/playstyles/discard` passes axe-core audit |
| ink gallery should have no axe violations | `/inks` passes axe-core audit (#530: a card-count contrast violation there shipped because the ink pages had no axe coverage) |
| ink hub should have no axe violations | `/ink/steel` passes axe-core audit (#530) |

## `app-load.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should display hero home page when app loads | Hero section, search input, featured cards, and ethereal background all render at `/` |
| should display search input on home page | Hero search input is visible |
| should show featured cards after loading | Featured cards grid has 1-12 card tiles |
| should open the overview modal when a card is selected | Clicking a featured card opens the modal overlay-style; URL stays `/`, no compact header |

## `card-detail.spec.ts` — 13 tests (10 desktop only, 3 on every project at a 390px viewport)

Two surfaces: the crawlable `/card/:id` **page** (#486 — renders, not-found, empty state; slug URLs `/card/:id/:slug` with the id as the lookup key and the slug decorative, #498) and the
CardOverviewModal opened from a tile (render, close, empty, scroll lock, show-all, sibling nav). The
modal is opened via `appPage.openCardOverview(name)` (Browse `?q=` + tile click) since `/card/:id`
is a real page now, not a modal shortcut.

The page's mobile-layout tests (the #631 overflow guard, the × back flow) force a 390px viewport with
`setViewportSize` instead of skipping `mobile-*`: `isMobile` is width-based, so they render the mobile
layout on every project and also run in the chromium-only Windows pre-push.

| Test | What it verifies |
|---|---|
| should render card name and image inside the overview modal | Modal shows an h1 with the card name and the card art named after it (found by name, not as the first `<img>`: a card with an alternate printing puts the pills' decorative rarity symbols first) |
| should show synergy chips or empty state once data loads | Modal renders synergy groups, empty state, or error after async load |
| renders the crawlable card page when deep-linking to /card/:id | `/card/1947` renders the real page (#486): URL stays, `<title>` baked in, canonical is the slug URL (#498), synergy section visible, no modal |
| a wrong slug still renders the card by id and canonicalizes to the correct slug (#498) | `/card/1947/wrong-slug-here` resolves card 1947 by id (slug decorative); canonical rewritten to the derived slug, not the URL's |
| shows a not-found page for an invalid card ID | `/card/99999999` → noindex "Card not found" page; URL stays, no modal |
| should close the modal when Escape is pressed | Escape dismisses the modal, hero reappears |
| shows the empty state on the page for a card with no synergies | `/card/1936` (no synergy file) → page "No synergies found for this card" notice |
| should lock background scroll while the modal is open | `document.body` overflow is `hidden` while open, restored on close |
| Show More reveals the full expanded group, and Back returns to default | Modal opened on card 2095 via Browse (`openCardOverview`); ramp group: one "+N more" click → `data-state="expanded"` with a "Back to all synergies" link; Back → `data-state="default"` |
| arrows navigate to a sibling card from the Browse grid | Opening a card from `/browse` shows prev/next arrows; clicking "Next card" changes the modal's h1 to the adjacent grid card |
| a card with many synergy groups does not scroll the page sideways (#631) | At 390px, `/card/2978` (6 groups, fixture-guarded from its synergy JSON): the chip row's content is wider than the page (precondition), `document.documentElement.scrollWidth <= clientWidth` (no page-level horizontal overflow), and the chip row scrolls inside its own box (`scrollWidth > clientWidth`, with computed `overflow-x` `auto` or `scroll`, since `hidden`/`clip` would pass the width checks while stranding the off-screen chips). Compares against `clientWidth`, not `innerWidth`, because mobile emulation zooms out to fit an overflowing page |
| × returns to the card before, and opens Browse on the page the visit started on | At 390px, `/card/2095`: tapping a synergy tile opens that card's page, × returns to `/card/2095` (history back); × again, on the page the visit started on, navigates to `/browse` instead of leaving the app (`useBackOrNavigate`: the entry page has React Router's `history.state.idx === 0`) |
| × on a card page reached by the /compare/X/X redirect opens Browse | At 390px, `/compare/2095/2095` redirects (a replace, so a new location key) to `/card/2095`; × still counts it as the page the visit started on and navigates to `/browse`. Without #653's `history.state.idx` check it stepped back to `about:blank`, out of the site |

## `card-printings.spec.ts`: 3 tests (2 desktop only, 1 on every project at a 360px viewport)

The alternate-printing switcher (#625) on card 1938 (Pongo - Determined Father), whose one alternate printing is Enchanted; a module-level guard reads that from `allCards.json` and throws "Fixture broken" if the pool changes. The 360px test forces its viewport like card-detail's mobile-layout tests, so it also runs in the chromium-only Windows pre-push.

| Test | What it verifies |
|---|---|
| the card page switches to the Enchanted printing, and enlarges that one | `/card/1938`: Standard is checked first; the Enchanted pill's rarity symbol loads (`naturalWidth > 0`, it is a separate `?no-inline` file); clicking the pill checks it and lands the art strip on slide 1; "Enlarge Enchanted printing" opens the lightbox named for the Enchanted printing, not the card's own scan |
| the modal's arrow keys move between printings, not to the next card | Modal opened on Pongo from `/browse?q=father` (four matches, so "Next card" exists). First lets the dialog's initial-focus timer run (`useDialogFocus` moves focus to the × 100ms after opening, and would otherwise take it back from the pills mid-test) by awaiting a 100ms timer of its own in the page, which runs after the dialog's. It does not wait for the × to be focused: headless WebKit has not started the enter transition by then, so the dialog is still hidden and the focus call does nothing. ArrowRight on the focused Standard pill checks and focuses Enchanted, and the modal's h1 is still Pongo (the radio group owns the arrow keys) |
| four printings fit a 360px phone as symbols, and jumping to the last checks only it | `page.route` adds Epic and Iconic printings to card 1938 (no real card has more than one yet): four pills; the Epic pill has no text but keeps its name (`aria-label`) and `title`; the row and the page fit `documentElement.clientWidth`. Clicking Iconic lands the strip on slide 3 while a MutationObserver records the checked pill: exactly `['Iconic']`, since the strip's own scroll past Enchanted and Epic must not read as swipes (each would check its pill in passing and count as a view) |

## `card-modal-on-demand.spec.ts`: 2 tests (every project)

The card overview modal loads on demand (#640). Both tests hold the modal's module request (`**/components/CardOverviewModal.tsx*`, the dev server's source path) so the cold path is deterministic.

| Test | What it verifies |
|---|---|
| a cold open shows the loading shell, then the modal takes over | Clicking a featured card while the modal's chunk is held shows `card-overview-fallback` and no modal; releasing the chunk shows the modal and removes the shell |
| the loading shell closes on a scrim click, like the modal | A click on `card-overview-fallback-backdrop` removes the shell, and the chunk arriving afterwards opens no modal |

## `card-search.spec.ts` — 7 tests (desktop only)

The browse/playstyle search input lives in the toolbar (next to Filters), not the header. Both pages filter the grid in place.

| Test | What it verifies |
|---|---|
| should navigate to browse when searching from hero | Typing in hero search navigates to `/browse?q=Elsa`, hides hero, shows CardList |
| should open filter modal on browse page | "Browse all cards" CTA navigates to `/browse`, clicking Filters opens modal with Character/Action type buttons |
| should deep link to browse with ink filter in URL | Direct navigation to `/browse?ink=Sapphire` shows filtered browse page |
| should navigate to browse via Browse all cards CTA | "Browse all cards" CTA navigates to `/browse`, hero gone, CardList visible |
| should preserve search query in URL on browse page | Hero search for "Ariel" puts `q=Ariel` in URL, browse search input shows "Ariel" |
| should deep link to browse with filters | Direct navigation to `/browse?q=Elsa&ink=Sapphire` populates the search input |
| should filter a playstyle page in place without navigating to browse | Typing in the playstyle toolbar search filters in place: URL stays `/playstyles/ramp` and gains `q=elsa` (no jump to `/browse`) |

## `card-selection.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show home state at root URL | Hero + featured cards visible, URL is `/` |
| should open the card overview modal when a card is selected | Selecting a card opens the modal overlay-style; URL stays `/`, backdrop visible |
| should show synergy results area when card is selected | Modal renders synergy groups, empty state, or error after async load |
| should clear selection by closing the modal | ✕ button closes the modal; hero reachable, URL stays `/` |
| should close the modal when the backdrop is clicked | Backdrop click closes the modal; hero reachable, URL stays `/` |

## `mobile.spec.ts` — 16 tests (mobile only)

| Test | What it verifies |
|---|---|
| should display hero home page on mobile | Hero, search input, and featured cards render on mobile viewport |
| should show search input on home | "Search for a card..." placeholder is visible |
| should open the overview modal when selecting a featured card | Card tap opens the modal overlay-style; synergies load |
| should show filter drawer on mobile browse | Navigate to `/browse`, tap filter icon, drawer shows Amber/Sapphire ink buttons |
| should navigate to browse when searching from hero | Typing "Elsa" + Enter navigates to `/browse?q=Elsa`, hero hidden, browse heading visible |
| should navigate to browsing view via Browse all cards CTA | "Browse all cards" CTA navigates away from hero, shows browse heading |
| should open search bottom sheet and focus input when tapping search icon | Tap search icon in bottom nav, sheet opens with focused input |
| a search tap that beats the sheet chunk opens it, with a proxy input holding focus | With the lazy sheet's module held (#640), a Search tap focuses AppLayout's hidden proxy input (what raises the iOS keyboard); once released, the sheet opens. The navigation waits for DOMContentLoaded, not `load` (see Patterns) |
| should close search bottom sheet on backdrop click | Open search sheet, click backdrop, sheet dismisses, focus returns to the Search nav button (not the hidden iOS proxy input) |
| should navigate to browse when pressing Enter in search bottom sheet | Type query in search sheet, press Enter, navigates to `/browse?q=Elsa`, sheet stays closed (the Enter must not also click the refocused Search button) |
| should show sort dropdown in browse toolbar | Sort select and Filters button both visible in browse toolbar |
| should lock background scroll when filter drawer is open | Opening filter drawer sets body overflow to hidden |
| should open filter drawer in mobile browsing view | From browsing view, tap Filters button, drawer shows Amber/Sapphire/Steel ink buttons |
| should close the overview modal via the close button | ✕ button dismisses the modal on mobile |
| should close the overview modal via backdrop tap | Backdrop tap dismisses the modal on mobile |
| should open and dismiss the Mechanics bottom sheet on a playstyle page | Mechanics button opens the `Mechanics filter` sheet; backdrop tap dismisses it |

## `playstyle-pages.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should navigate to playstyle gallery via CTA | "Explore playstyles" CTA navigates to `/playstyles`, renders page heading |
| should render playstyle gallery with playstyle cards | `/playstyles` shows h1 + at least 2 playstyle cards (role="button" elements) |
| should navigate to playstyle detail page | Clicking a playstyle card navigates to `/playstyles/:id`, shows heading |
| should deep link to playstyle detail page | Direct navigation to `/playstyles/lore-denial` shows heading + card tiles |
| should navigate back from playstyle detail to gallery | Back link from detail returns to `/playstyles` (or logo to `/`) |

## `responsive-images.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should use eager loading for above-fold featured cards | Featured card images have `loading="eager"` + `decoding="sync"` |
| should render images in featured cards grid | Featured grid has images with valid `src` attributes |
| should render image in the card overview modal | The modal's card art (the image named after the card) renders with a valid `src` |
| should use lazy loading for synergy card images | Synergy card images (below fold) use `loading="lazy"` |

## `search-autocomplete.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show autocomplete dropdown when typing 2+ characters | Typing "El" in hero search shows listbox with options |
| should open card overview modal when clicking a suggestion | Clicking a suggestion opens the card modal; URL stays `/` |
| should open card overview modal via keyboard (ArrowDown + Enter) | ArrowDown + Enter on a suggestion opens the card modal |
| should close dropdown on Escape | Escape key dismisses autocomplete dropdown |
| should NOT show autocomplete on browse page search | Typing in browse page search does NOT show autocomplete (browse filters inline) |

## `seo.spec.ts` — 18 tests (both viewports)

Route-level metadata coverage (#524). Before this, the file asserted only home-page
properties, so #486's central acceptance criterion — every route self-references its own
canonical — was unguarded. `/vote` shipped into the sitemap without a `<Seo>` as a direct
consequence.

Note the title assertion checks the *effective* `document.title`, not a count of `<title>`
elements: React 19 hoists the `<Seo>` title but leaves `index.html`'s shell `<title>` in
the DOM, and `prerender.mjs` strips the duplicate only at capture time (#492). E2E runs
against the dev server, where both are present.

| Test | What it verifies |
|---|---|
| should have valid JSON-LD structured data on home page | `@graph` carries Organization + WebSite + WebApplication, cross-linked by `@id`, with the WebSite's SearchAction |
| should have correct heading hierarchy on home page | Exactly one h1; its accessible name comes from the logo img's `alt` |
| should preload the self-hosted body font only | `link[rel=preload][as=font]` for plus-jakarta-sans-400 (self-hosted, not a CDN), and none for tinos-400, which `/` never renders (#640) |
| should own its title and canonical: `/` | Title leaves the shell fallback; canonical self-references |
| should own its title and canonical: `/browse` | As above |
| should own its title and canonical: `/playstyles` | As above |
| should own its title and canonical: `/playstyles/lore-denial` | As above |
| should own its title and canonical: `/card/1989/elsa-snow-queen` | As above, on a slug card route (#498) |
| should own its title and canonical: `/inks` | As above, on the ink gallery (#530) |
| should own its title and canonical: `/ink/steel` | As above, on an ink hub (#530) |
| card page has exactly one h1 at a mobile viewport | 412×915 — CardPage gates the desktop `CardDetailPanel` behind `!isMobile` while `CardDetail` owns the h1 below it (`headingLevel="h1"`, set by `SynergyResults` from `flowInPage`). Googlebot renders mobile, so a regression in either branch is invisible at desktop width |
| card page links to all six ink hubs at a mobile viewport | The footer's ink nav is what puts every hub one click from all 1,024 card pages (#530) |
| ink hub emits one crawlable anchor per card, identically on mobile | `CardGrid`, not the Virtuoso-windowed `BrowseCardGrid` — windowing would emit a fraction of the anchors to a crawler (#530) |
| unknown ink slug renders the 404 page, not an empty hub | Junk URLs under `/ink/` declare themselves unindexable instead of returning a thin 200 (#525) |
| reveals page owns its title and canonical when in season | Self-gating (skips off-season, when `/reveals` redirects to `/`). `/reveals` has no prerendered file, so production answers it with the HOME page's HTML; those tags carry `data-seo`, the sweep strips them, and with no `<Seo>` of its own the page shipped with no title and no canonical at all |
| every tag `<Seo>` emits carries the data-seo sweep marker | #535 — an unmarked tag escapes `sweepPrerenderedSeoTags()` and silently duplicates on every real visit |
| client navigation swaps metadata in place instead of accumulating it | #535 — two `<link rel="canonical">` makes Google ignore canonicalisation entirely, which is worse than emitting none |
| sweep preserves index.html site-level constants | #535 — `og:type` / `og:locale` / `og:image:width` / `og:image:height` / `twitter:card` are not emitted by `<Seo>`; widening the sweep selector would strip them on every load |

The three #535 specs cannot observe the duplication itself: it requires the prerendered
HTML, and E2E runs against the dev server, which serves the shell. They guard the marker
contract and the client-navigation path instead — the two things that actually regress.
Verifying the fix end-to-end needs a real `prerender.mjs` build.

## `synergy-groups.spec.ts` — 4 tests (2 desktop, 2 mobile)

CardOverviewModal default-mode interactions — chip filtering (→ focused single-group) and "+N more" one-click expansion (→ full ExpandedGroupView). The modal is opened on the fixture card via `appPage.openCardOverview(name)` (Browse `?q=` + tile click) — `/card/:id` is a real page now (#486), not a modal shortcut.

| Test | What it verifies |
|---|---|
| a group chip toggles the modal between focused and default (desktop) | Clicking the Discard chip → `data-state="focused"`, one group; clicking again clears it |
| the "+N more" tile opens the full expanded group view (desktop) | Clicking the discard `more-tile` once → `data-state="expanded"` with a "Back to all synergies" link |
| a group chip filters the modal to that group (mobile) | Clicking the Discard chip → `data-state="focused"`, one group |
| the "+N more" tile opens the full expanded group view (mobile) | Clicking the discard `more-tile` once → `data-state="expanded"` with a "Back to all synergies" link |

## `synergy-detail-modal.spec.ts` — 11 tests (4 desktop, 5 mobile, 2 deep-link)

Comparison mode — clicking a synergy card tile (a crawlable `a.card-tile`, #486) transitions CardOverviewModal in-place to the side-by-side comparison view. Desktop uses two columns; mobile uses the tabbed `MobileComparisonView` (#332 #5). Setup opens the modal on the fixture card via `appPage.openCardOverview(name)` (Browse `?q=` + tile click). Deep links open comparison directly via `/compare/A/B/groupKey`.

| Test | What it verifies |
|---|---|
| should enter comparison mode when clicking a synergy card | (desktop) Clicking a shift-targets tile shows the BACK button; URL stays `/` |
| should show engine column with rule explanations in comparison mode | (desktop) `section[aria-label="Engine score"]` renders with Shift rule explanations |
| should exit comparison mode via the BACK button | (desktop) BACK returns the modal to `data-mode="default"`, URL stays `/` |
| should switch comparison pairs across exit and re-entry | (desktop) Enter → BACK → enter a different pair; consecutive comparisons work cleanly |
| should enter comparison mode on mobile | (mobile) Tapping a synergy tile shows the BACK button |
| should render the tabbed comparison layout on mobile | (mobile) MobileComparisonView's Engine/Community section-switch pill buttons render |
| should switch to the Community tab on mobile | (mobile) Tapping the Community pill moves `aria-current="true"` onto it, and scrolls only the tab strip: once the strip has landed on Community, the page and every scroll container around it are where they were before the tap (#653, the strip now uses `useScrollSnapIndex` instead of `scrollIntoView`, which also scrolls ancestors; the old code did not move them in this layout either, so this guards the outcome) |
| should open and dismiss the card lightbox on mobile | (mobile) Tapping a comparison card opens the portal-to-body `Enlarged:` dialog; its close button dismisses it |
| should exit comparison mode via BACK on mobile | (mobile) BACK returns the modal to `data-mode="default"` |
| opens directly in comparison with no BACK button (desktop) | (deep link) `/compare/A/B/groupKey` opens straight into comparison; BACK button suppressed (hideBackButton) |
| opens the mobile tabbed comparison view (mobile) | (deep link) `/compare/A/B/groupKey` opens the mobile MobileComparisonView |

## `playstyle-detail.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render hero with name and breadcrumb | `/playstyles/discard` shows h1 "Discard" and the breadcrumb nav with "Playstyles" link |
| should show and use role filter chips | "Forced Discard" mechanic chip filters to a subset; toggling it off restores the full grid |
| should render card tiles in grid | `/playstyles/location-control` renders 5+ card tiles |
| should open the card overview modal from playstyle detail | Clicking a card tile opens the modal; URL stays on the playstyle page |

## `voting.spec.ts` — 17 tests (12 desktop, 5 mobile)

| Test | What it verifies |
|---|---|
| should navigate to /vote and display a card pair | Page loads, URL correct, 2+ card images visible |
| should display score picker with 10 buttons | All 10 score buttons (1-10) rendered |
| should display synergy description | "How strong is this synergy?" prompt visible |
| should show skip button with keyboard hint | Skip button shows "(S)" on desktop |
| should advance to next pair when score is clicked | Click score → pair changes |
| should advance to next pair when skip is clicked | Skip → pair changes |
| should show toast after voting | Toast with "Vote recorded" appears |
| should support keyboard shortcut for scoring (1-9) | Key '5' → pair advances |
| should support keyboard shortcut 0 for score 10 | Key '0' → pair advances |
| should support keyboard shortcut S for skip | Key 's' → pair advances |
| should navigate to /vote from nav strip | Vote nav-strip link click → /vote |
| should show compact header with nav strip | Header + Browse/Vote links visible |
| should display compact card layout on mobile | Cards + score picker visible on mobile |
| should show skip button without keyboard hint on mobile | No "(S)" on mobile |
| should advance to next pair on score click (mobile) | Mobile score click → pair changes |
| should advance on skip (mobile) | Mobile skip → pair changes |
| should show mobile bottom navigation | Mobile nav with Browse/Playstyles visible |

## `page-shell-loading.spec.ts` — 4 tests (desktop only)

Regression guard for issue #268 (skeleton-loading UI). Each test intercepts `/data/allCards.json` and `/data/synergies/**` with a 1500 ms delay, navigates to the page, and asserts the chrome landmark + skeleton are both visible during the loading window. (CardPage is now a thin redirect that opens the global modal, so its old skeleton case no longer applies — see the NOTE in the spec.)

| Test | What it verifies |
|---|---|
| PlaystyleDetailPage renders skeleton + CompactHeader while card data loads | CompactHeader visible; aria-busy skeleton visible; `<h1>` with playstyle display name visible after load |
| PlaystyleGalleryPage renders skeleton inside preserved shell | `<h1>` "playstyles" title visible (shell was already preserved before #268); `[aria-label="Loading playstyles"]` visible, then hidden after load |
| VotePage renders pair + score picker skeleton while queue loads | CompactHeader visible; `[aria-label="Loading vote pair"]` visible |
| InDepthVotePage renders pair + form skeleton while pair data loads | CompactHeader visible; `[aria-label="Loading vote pair and form"]` visible |

## `in-depth-vote.spec.ts` — 1 test (all browsers)

Terminal-state guard for the in-depth vote page (`/vote/:a/:b`). Complements `page-shell-loading`'s skeleton assertion, which a stuck/looping page mimics; this asserts the page reaches its loaded, interactive state.

| Test | What it verifies |
|---|---|
| loads the pair and renders the interactive vote form | Navigates to `/vote/2730/2718`; the `[aria-label="Loading vote pair and form"]` skeleton becomes hidden, then "Is this synergy real?" + the "Yes" radio are visible (a loop/hang fails by timeout) |

## `reveals-page.spec.ts` — 8 tests (7 desktop, 1 mobile)

**Season-independent by design.** The `beforeEach` reads the reveal set (the `previewCards.json` entry with the latest `releaseDate`) and the tests build their matchers from its `name` and `number`; the franchise label is read off the tile's own `aria-label`. Starting a new season needs no edit here. The suite skips itself once `releaseDate` has passed, and resumes when the next set's dates land. Three tests additionally skip while `cards` is empty.

| Test | What it verifies |
|---|---|
| renders the tracker: hero, six ink trackers, and the debut franchises | sr-only `h1` containing the set name, the set logo (alt = set name), 6 `ink-tracker-tile`s, the "Ink board" section, and at least one "View … cards" franchise button all render |
| desktop nav shows Reveals entry with NEW badge | `/browse` has a Reveals link with a "NEW" badge child |
| mobile nav shows Reveals tab | On mobile, `/browse`'s bottom nav has a "Set N reveals" link |
| promo modal appears on landing page and not on /reveals | `role="complementary" name="Set N reveals"` visible on `/`, absent on `/reveals` |
| mosaic card click opens the card overview modal | Clicking a `reveal-card-slot` on `/reveals` opens the modal; URL stays `/reveals` (skips with no cards) |
| franchise card click opens the franchise cards modal | Clicking the first "View … cards" tile opens the `dialog` named "<franchise> cards"; a card-tile inside opens the overview modal on top (card click skips with no cards) |
| ?ink= param selects the starting mosaic ink | `/reveals?ink=emerald` makes the Emerald `ink-tracker-tile` the `aria-pressed` (featured) one |
| clicking a rarity chip dims the other revealed cards | A "Highlight ... cards" chip toggles `aria-pressed`; other-rarity slots get `data-dimmed`; clicking again clears it (skips when <2 rarities revealed) |

## `admin-analytics.spec.ts` — 1 test (flag-gated, self-skipping)

Requires `VITE_SHOW_ADMIN_ANALYTICS=true` (playwright `webServer.env` + `apps/web/.env.local`) and the build-time `vote-analytics.json` artifact. The test skips gracefully when the flag is off (route redirects home) or the artifact is absent, so it never false-fails an unset environment. Flag-off redirect is also covered by `AdminGate` unit tests.

| Test | What it verifies |
|---|---|
| renders the calibration + activity tabs | `/admin/analytics` shows the `Engine Calibration` h1 and the verdict scale + `Total votes` on the Calibration tab, then switches to the Activity tab and confirms the day-by-day log header |

## Patterns

- **URL assertions** (`toHaveURL`) verify route-based navigation on every transition
- **Hero visibility** is the marker for "home state" vs other pages
- **Deep linking** is tested via direct navigation to `/browse?q=...&ink=...`, `/card/:id`, `/playstyles/:id`, `/compare/A/B/groupKey`
- **CardOverviewModal** is the quick-look surface: clicking a card tile (anywhere) opens it overlay-style with the URL unchanged. **`/card/:id` is also a real, crawlable page** (#486) — deep-linking or middle-clicking a tile lands on the routed `CardPage` (which reuses the same `CardDetailPanel` + `SynergyResults` composition). To open the modal on a *specific* card in a test, use `appPage.openCardOverview(name)` (Browse `?q=` + tile click); `/card/:id` no longer opens the modal.
- **Synergy card tiles** render as crawlable `a.card-tile` anchors (#486), not `button.card-tile` — plain-click is intercepted for in-app behavior (comparison in the modal, page-to-page nav on the card page), modified/middle-click follows the link.
- **Navigation back** is tested via both clear/back button and logo click
- **Image loading** is verified via `loading` and `decoding` attributes (not `src` URLs, which differ between dev proxy and production AVIF)
- **Holding a request the page makes while it loads** (a lazy chunk behind `page.route`): navigate with `waitUntil: 'domcontentloaded'`. WebKit holds the `load` event until a pending module request ends (Chromium does not), so a `load` wait can wait on the held request and time out. Whether the page makes that request before `load` is a race, so mobile-safari fails some runs and passes others (#663)

## Debugging a failed E2E run

- **Read the failure screenshot before theorizing.** Playwright writes one per failed test to `apps/web/test-results/{test-name}-chromium/test-failed-1.png`. It shows the rendered DOM at the moment of failure, the fastest way to distinguish "test is stale" / "UI refactored" / "route gate fired" / "feature flag off."
- Common patterns visible in the screenshot:
  - **Unexpected page** (e.g., home rendered when the test navigated to `/reveals`) → a route gate redirected; check the corresponding phase/flag hook.
  - **Correct page but expected text missing** → the UI may have been refactored (element moved to `<img alt>`, or hidden via `position: absolute; left: -10000` for screen readers, which `toBeVisible()` excludes). Query the `<section>` by role/name instead, or use `.toHaveCount(1)`.
  - **Flash of initial state** → async state (fetch, localStorage) had not resolved; check what the page is waiting for before asserting.
- **`ERR_CONNECTION_REFUSED` on most tests means the run's Vite died mid-run.** A local run always starts its own Vite, on a free port in 5200-5299 unless `E2E_PORT` pins one (`playwright.config.ts`), and never reuses another server. Its `[WebServer]` lines show that server's banner and port. Playwright stops watching the server once it is up, so nothing else reports the death. On Windows, check the Application log for headless Chrome out-of-memory crashes at the same time (Event 1000, `chrome-headless-shell.exe`, exception `0xe0000008`). They mean the machine ran out of commit memory under other load, not a code bug: retry once there is headroom, or lower the worker count (`PRE_PUSH_E2E_WORKERS` for the pre-push, `--workers` otherwise; local Windows runs default to 3).
- **The first tests time out with blank white screenshots and `page.goto: net::ERR_ABORTED; maybe frame was detached?`, while every later test passes**: the cold-compile signature. A fresh Vite compiles each module on its first request, and before the warm-up (#664) the first wave paid that whole compile inside its 30 s; `ERR_ABORTED` is Playwright tearing the page down at the timeout, not a reload. Check the `E2E warm-up` line in the run log: if it is missing, the run predates #664 or the warm-up did not run. With the line present, a cold compile can still slow a test that opens something the warm-up leaves cold (listed above), most likely the first mobile tests.
- **`[WebServer] ... hmr update` followed by `Failed to load url .../synergy-engine/dist/index.js`** means something rebuilt the engine in the same checkout mid-run (the engine auto-rebuild hook after an engine edit, or another typecheck or pre-push), and pages loading at that moment failed. Re-run once the other build is done.
