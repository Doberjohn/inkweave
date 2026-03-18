# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

79 active tests across 15 spec files. Tests run on 5 browser projects: `chromium`, `firefox`, `webkit` (desktop), `mobile-chrome`, and `mobile-safari`. Each file skips irrelevant viewports via `startsWith('mobile-')` checks.

## `accessibility.spec.ts` — 6 tests (desktop only)

| Test | What it verifies |
|---|---|
| home page should have no axe violations | `/` passes axe-core audit with zero violations |
| browse page should have no axe violations | `/browse` passes axe-core audit |
| card detail page should have no axe violations | `/card/1041` passes axe-core audit |
| card synergies page should have no axe violations | `/card/1041/synergies` passes axe-core audit |
| playstyle gallery should have no axe violations | `/playstyles` passes axe-core audit |
| playstyle detail should have no axe violations | `/playstyles/discard` passes axe-core audit |

## `app-load.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should display hero home page when app loads | Hero section, search input, featured cards, and ethereal background all render at `/` |
| should display search input on home page | Hero search input is visible |
| should show featured cards after loading | Featured cards grid has 1-12 card tiles |
| should transition to card page when card is selected | Clicking a featured card navigates to `/card/:id`, shows compact header, hides hero |

## `card-detail.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render card name and image in detail panel | Card detail panel shows image, h1 heading with card name |
| should render synergy breakdown when synergies exist | Either synergy breakdown or "no synergies" message is visible |
| should deep link directly to a card page | Direct navigation to `/card/957` renders card detail panel + compact header |
| should show card not found for invalid card ID | `/card/99999999` shows "Card not found" + Go Home button |

## `card-search.spec.ts` — 6 tests (desktop only)

| Test | What it verifies |
|---|---|
| should navigate to browse when searching from hero | Typing in hero search navigates to `/browse?q=Elsa`, hides hero, shows CardList |
| should open filter modal on browse page | "Browse all cards" CTA navigates to `/browse`, clicking Filters opens modal with Amber/Sapphire ink buttons |
| should deep link to browse with ink filter in URL | Direct navigation to `/browse?ink=Sapphire` shows filtered browse page |
| should navigate to browse via Browse all cards CTA | "Browse all cards" CTA navigates to `/browse`, hero gone, CardList visible |
| should preserve search query in URL on browse page | Hero search for "Ariel" puts `q=Ariel` in URL, browse search input shows "Ariel" |
| should deep link to browse with filters | Direct navigation to `/browse?q=Elsa&ink=Sapphire` populates the search input |

## `card-selection.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show home state at root URL | Hero + featured cards visible, URL is `/` |
| should display card detail panel when card is selected | Selecting a card navigates to `/card/:id`, shows detail panel + compact header |
| should show synergy results area when card is selected | Card page shows either synergy count or "no synergies" message |
| should clear selection and return to home | Back button navigates to `/`, hero reappears |
| should return to home when clicking logo | Logo click navigates to `/`, hero reappears |

## `mobile.spec.ts` — 13 tests (mobile only)

| Test | What it verifies |
|---|---|
| should display hero home page on mobile | Hero, search input, and featured cards render on mobile viewport |
| should show search input on home | "Search for a card..." placeholder is visible |
| should navigate to card page when selecting a featured card | Card click navigates to `/card/:id`, shows synergies heading or "no synergies" |
| should show filter drawer on mobile browse | Navigate to `/browse`, tap filter icon, drawer shows Amber/Sapphire ink buttons |
| should return to home when clearing selection on mobile | Clear selection navigates back to `/`, hero reappears |
| should navigate to browse when searching from hero | Typing "Elsa" + Enter navigates to `/browse?q=Elsa`, hero hidden, browse heading visible |
| should navigate to browsing view via Browse all cards CTA | "Browse all cards" CTA navigates away from hero, shows browse heading |
| should open search bottom sheet and focus input when tapping search icon | Tap search icon in bottom nav, sheet opens with focused input |
| should close search bottom sheet on backdrop click | Open search sheet, click backdrop, sheet dismisses |
| should navigate to browse when pressing Enter in search bottom sheet | Type query in search sheet, press Enter, navigates to `/browse?q=Elsa` |
| should show sort dropdown in browse toolbar | Sort select and Filters button both visible in browse toolbar |
| should lock background scroll when filter drawer is open | Opening filter drawer sets body overflow to hidden |
| should open filter drawer in mobile browsing view | From browsing view, tap Filters button, drawer shows Amber/Sapphire/Steel ink buttons |

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
| should use eager loading for above-fold featured cards | Featured card images have `loading="eager"` + `fetchpriority="high"` |
| should render images in featured cards grid | Featured grid has images with valid `src` attributes |
| should render image in card detail panel | Detail panel image is visible, not lazy-loaded, has valid src |
| should use lazy loading for synergy card images | Synergy card images (below fold) use `loading="lazy"` |

## `search-autocomplete.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show autocomplete dropdown when typing 2+ characters | Typing "El" in hero search shows listbox with options |
| should navigate to card page when clicking a suggestion | Clicking an autocomplete suggestion navigates to `/card/:id` |
| should navigate to card via keyboard (ArrowDown + Enter) | ArrowDown + Enter selects suggestion and navigates to card page |
| should close dropdown on Escape | Escape key dismisses autocomplete dropdown |
| should NOT show autocomplete on browse page search | Typing in browse page search does NOT show autocomplete (browse filters inline) |

## `seo.spec.ts` — 3 tests (both viewports)

| Test | What it verifies |
|---|---|
| should have valid JSON-LD structured data on home page | JSON-LD script tag with WebApplication type |
| should have correct heading hierarchy on home page | h1 exists, h2 headings present |
| should have font preconnect hints | Preconnect links for Google Fonts |

## `synergy-groups.spec.ts` — 6 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render both direct and playstyle synergy groups | Card 1041 shows both `shift-targets` (direct) and `discard` (playstyle) groups |
| should show synergy breakdown sidebar with group labels | Breakdown sidebar contains "Shift Targets" and "Discard" labels |
| should filter synergy groups when clicking a group chip | Clicking "Discard" chip hides shift-targets group; "All" chip resets |
| should show all direct group cards inline without more tile | Shift-targets group shows all 3 cards, no "+N more" tile |
| should truncate playstyle group and show more tile | Discard group truncates at 10 cards with "+24 more" tile |
| should display group description callout text | Both groups render description callout text |

## `synergy-detail-modal.spec.ts` — 5 tests (4 desktop, 1 mobile)

| Test | What it verifies |
|---|---|
| should open modal when clicking a synergy card | Clicking a synergy card tile opens `role="dialog"` modal |
| should display connection explanations in modal | Modal contains explanation text about the synergy connection |
| should close modal on backdrop click | Clicking backdrop dismisses the modal |
| should navigate to card page via CTA button | CTA button navigates to the synergy card's detail page |
| should open modal on mobile | Tapping a synergy card on mobile viewport opens the modal |

## `synergy-expanded-view.spec.ts` — 4 tests (3 desktop, 1 mobile)

| Test | What it verifies |
|---|---|
| should show toolbar in expanded view | Expanded discard group shows sort select |
| should show all cards without truncation in expanded view | Expanded view shows all 34 discard cards, no more tile |
| should navigate back from expanded view | "Back to all synergies" returns to multi-group view |
| should expand playstyle group on mobile | Mobile expand shows all 34 discard cards |

## `playstyle-detail.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render hero with name, description, and breadcrumb | `/playstyles/discard` shows h1 "Discard", description, breadcrumb nav with "Playstyles" link |
| should toggle strategy tips section | Strategy Tips button toggles tip list visibility |
| should show and use role filter chips | "Enabler" chip filters to subset; "All" chip resets |
| should render card tiles in grid | `/playstyles/location-control` renders 5+ card tiles |
| should navigate to card page from playstyle detail | Clicking a card tile navigates to `/card/:id` |

## `show-all-ux.spec.ts` — 4 tests (2 desktop, 2 mobile)

| Test | What it verifies |
|---|---|
| should expand playstyle group and scroll to expanded view | Clicking "+N more" tile renders `ExpandedGroupView`, "Back to all synergies" is in viewport after smooth scroll |
| should show all direct group cards inline without truncation | Direct (Shift Targets) group has no "+N more" tile — all cards shown inline |
| should expand playstyle group and scroll to expanded view on mobile | Same expand + scroll check on mobile viewport |
| should show all direct group cards inline without truncation on mobile | Same no-truncation check on mobile viewport |

## Patterns

- **URL assertions** (`toHaveURL`) verify route-based navigation on every transition
- **Hero visibility** is the marker for "home state" vs other pages
- **Deep linking** is tested via direct navigation to `/browse?q=...&ink=...`, `/card/:id`, `/playstyles/:id`
- **Navigation back** is tested via both clear/back button and logo click
- **Image loading** is verified via `loading` and `fetchpriority` attributes (not `src` URLs, which differ between dev proxy and production AVIF)
