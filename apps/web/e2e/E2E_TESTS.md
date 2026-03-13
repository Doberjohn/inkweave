# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

52 active tests across 10 spec files. Each file runs on both `chromium` (desktop) and `mobile-chrome` projects but skips the irrelevant viewport.

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

## `mobile.spec.ts` — 12 tests (mobile only)

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
| should show sort dropdown in browse toolbar | Sort select and Filters button both visible in browse toolbar |
| should lock background scroll when filter drawer is open | Opening filter drawer sets body overflow to hidden |
| should open filter drawer in mobile browsing view | From browsing view, tap Filters button, drawer shows Amber/Sapphire/Steel ink buttons |

## `playstyle-pages.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should navigate to playstyle gallery via CTA | "Explore playstyles" CTA navigates to `/playstyles`, renders page heading |
| should render playstyle gallery with playstyle cards | `/playstyles` shows h1 + at least 2 playstyle cards (article elements) |
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
