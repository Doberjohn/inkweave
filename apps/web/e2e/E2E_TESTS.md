# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

107 tests across 17 spec files — all active (no `describe.skip`'d suites). Tests run on 5 browser projects: `chromium`, `firefox`, `webkit` (desktop), `mobile-chrome`, and `mobile-safari`. Each file skips irrelevant viewports via `startsWith('mobile-')` checks.

The Playwright webServer launches with `VITE_IS_REVEAL_SEASON=true` so the reveal-season active code paths are exercised. Flag-off behavior is covered by unit tests (`useRevealPhase.test.ts` and the route gate).

**Global console-error guard:** the shared `page` fixture (`e2e/fixtures/test-fixtures.ts`) fails any test that logs a `console.error` or throws an uncaught exception, except messages matching the documented `BENIGN_CONSOLE` allowlist. This turns silent runtime faults — most importantly React's "Maximum update depth exceeded" render loop, which a loading-skeleton assertion otherwise passes through — into red builds across every spec.

## `accessibility.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| home page should have no axe violations | `/` passes axe-core audit with zero violations |
| browse page should have no axe violations | `/browse` passes axe-core audit |
| card detail page should have no axe violations | `/card/1041` passes axe-core audit |
| playstyle gallery should have no axe violations | `/playstyles` passes axe-core audit |
| playstyle detail should have no axe violations | `/playstyles/discard` passes axe-core audit |

## `app-load.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should display hero home page when app loads | Hero section, search input, featured cards, and ethereal background all render at `/` |
| should display search input on home page | Hero search input is visible |
| should show featured cards after loading | Featured cards grid has 1-12 card tiles |
| should open the overview modal when a card is selected | Clicking a featured card opens the modal overlay-style; URL stays `/`, no compact header |

## `card-detail.spec.ts` — 7 tests (desktop only)

CardOverviewModal — opening, closing, empty state, scroll lock.

| Test | What it verifies |
|---|---|
| should render card name and image inside the overview modal | Modal shows card image + h1 with the card name |
| should show synergy chips or empty state once data loads | Modal renders synergy groups, empty state, or error after async load |
| should open the modal when deep-linking to /card/:id | `/card/957` opens the modal; URL redirects to `/` |
| should not open the modal for an invalid card ID | `/card/99999999` → home, modal stays hidden |
| should close the modal when Escape is pressed | Escape dismisses the modal, hero reappears |
| should show the empty state for a card with no synergies | `/card/957` (no synergy file) renders `card-overview-empty` |
| should lock background scroll while the modal is open | `document.body` overflow is `hidden` while open, restored on close |

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

## `mobile.spec.ts` — 15 tests (mobile only)

| Test | What it verifies |
|---|---|
| should display hero home page on mobile | Hero, search input, and featured cards render on mobile viewport |
| should show search input on home | "Search for a card..." placeholder is visible |
| should open the overview modal when selecting a featured card | Card tap opens the modal overlay-style; synergies load |
| should show filter drawer on mobile browse | Navigate to `/browse`, tap filter icon, drawer shows Amber/Sapphire ink buttons |
| should navigate to browse when searching from hero | Typing "Elsa" + Enter navigates to `/browse?q=Elsa`, hero hidden, browse heading visible |
| should navigate to browsing view via Browse all cards CTA | "Browse all cards" CTA navigates away from hero, shows browse heading |
| should open search bottom sheet and focus input when tapping search icon | Tap search icon in bottom nav, sheet opens with focused input |
| should close search bottom sheet on backdrop click | Open search sheet, click backdrop, sheet dismisses |
| should navigate to browse when pressing Enter in search bottom sheet | Type query in search sheet, press Enter, navigates to `/browse?q=Elsa` |
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
| should render image in the card overview modal | The modal's primary card image renders with a valid `src` |
| should use lazy loading for synergy card images | Synergy card images (below fold) use `loading="lazy"` |

## `search-autocomplete.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show autocomplete dropdown when typing 2+ characters | Typing "El" in hero search shows listbox with options |
| should open card overview modal when clicking a suggestion | Clicking a suggestion opens the card modal; URL stays `/` |
| should open card overview modal via keyboard (ArrowDown + Enter) | ArrowDown + Enter on a suggestion opens the card modal |
| should close dropdown on Escape | Escape key dismisses autocomplete dropdown |
| should NOT show autocomplete on browse page search | Typing in browse page search does NOT show autocomplete (browse filters inline) |

## `seo.spec.ts` — 3 tests (both viewports)

| Test | What it verifies |
|---|---|
| should have valid JSON-LD structured data on home page | JSON-LD script tag with WebApplication type |
| should have correct heading hierarchy on home page | h1 exists, h2 headings present |
| should have font preconnect hints | Preconnect links for Google Fonts |

## `synergy-groups.spec.ts` — 4 tests (2 desktop, 2 mobile)

CardOverviewModal default-mode interactions — chip filtering and "+N more" expansion. Both set `activeGroupFilter` → the focused single-group state (`data-state="focused"`).

| Test | What it verifies |
|---|---|
| a group chip toggles the modal between focused and default (desktop) | Clicking the Discard chip → `data-state="focused"`, one group; clicking again clears it |
| the "+N more" tile expands its group (desktop) | Clicking the discard `more-tile` → `data-state="focused"`, only the discard group |
| a group chip filters the modal to that group (mobile) | Clicking the Discard chip → `data-state="focused"`, one group |
| the "+N more" tile expands its group (mobile) | Clicking the discard `more-tile` → `data-state="focused"` |

## `synergy-detail-modal.spec.ts` — 11 tests (4 desktop, 5 mobile, 2 deep-link)

Comparison mode — clicking a synergy card tile transitions CardOverviewModal in-place to the side-by-side comparison view. Desktop uses two columns; mobile uses the tabbed `MobileComparisonView` (#332 #5). Deep links open it directly via `/compare/A/B/groupKey`.

| Test | What it verifies |
|---|---|
| should enter comparison mode when clicking a synergy card | (desktop) Clicking a shift-targets tile shows the BACK button; URL stays `/` |
| should show engine column with rule explanations in comparison mode | (desktop) `section[aria-label="Engine score"]` renders with Shift rule explanations |
| should exit comparison mode via the BACK button | (desktop) BACK returns the modal to `data-mode="default"`, URL stays `/` |
| should switch comparison pairs across exit and re-entry | (desktop) Enter → BACK → enter a different pair; consecutive comparisons work cleanly |
| should enter comparison mode on mobile | (mobile) Tapping a synergy tile shows the BACK button |
| should render the tabbed comparison layout on mobile | (mobile) MobileComparisonView's Engine/Community section-switch pill buttons render |
| should switch to the Community tab on mobile | (mobile) Tapping the Community pill moves `aria-current="true"` onto it |
| should open and dismiss the card lightbox on mobile | (mobile) Tapping a comparison card opens the portal-to-body `Enlarged:` dialog; its close button dismisses it |
| should exit comparison mode via BACK on mobile | (mobile) BACK returns the modal to `data-mode="default"` |
| opens directly in comparison with no BACK button (desktop) | (deep link) `/compare/A/B/groupKey` opens straight into comparison; BACK button suppressed (hideBackButton) |
| opens the mobile tabbed comparison view (mobile) | (deep link) `/compare/A/B/groupKey` opens the mobile MobileComparisonView |

## `playstyle-detail.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render hero with name, description, and breadcrumb | `/playstyles/discard` shows h1 "Discard", description, breadcrumb nav with "Playstyles" link |
| should toggle strategy tips section | Strategy Tips button toggles tip list visibility |
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

| Test | What it verifies |
|---|---|
| renders the tracker: hero, six ink trackers, and franchise cards | sr-only `h1`, the "Attack of the Vine!" logo, 6 `ink-tracker-tile`s, the "Ink board" section, and the 3 "View … cards" franchise buttons all render |
| desktop nav shows Reveals entry with NEW badge | `/` has a Reveals link with a "NEW" badge child |
| mobile nav shows Reveals tab | On mobile, `/browse`'s bottom nav has a "Set 13 reveals" link |
| promo modal appears on landing page and not on /reveals | `role="complementary" name=/Set 13 reveals/` visible on `/`, absent on `/reveals` |
| mosaic card click opens the card overview modal | Clicking a `reveal-card-slot` on `/reveals` opens the modal; URL stays `/reveals` |
| franchise card click opens the franchise cards modal | Clicking "View Monsters, Inc. cards" opens the `dialog`; a card-tile inside opens the overview modal on top |
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
- **CardOverviewModal** is the post-#320 replacement for the routed card page — clicking a card (anywhere) opens it overlay-style with the URL unchanged, rather than navigating to `/card/:id`
- **Navigation back** is tested via both clear/back button and logo click
- **Image loading** is verified via `loading` and `decoding` attributes (not `src` URLs, which differ between dev proxy and production AVIF)
