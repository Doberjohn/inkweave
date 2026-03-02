# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

28 active tests across 5 spec files. Each file runs on both `chromium` (desktop) and `mobile-chrome` projects but skips the irrelevant viewport, so 28 unique tests execute per run.

## `app-load.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should display hero home page when app loads | Hero section, search input, featured cards, and ethereal background all render at `/` |
| should display search input on home page | Hero search input is visible |
| should show featured cards after loading | Featured cards grid has 1-12 card tiles |
| should transition to card page when card is selected | Clicking a featured card navigates to `/card/:id`, shows compact header, hides hero |

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

## `mobile.spec.ts` — 8 tests (mobile only)

| Test | What it verifies |
|---|---|
| should display hero home page on mobile | Hero, search input, and featured cards render on mobile viewport |
| should show search input on home | "Search for a card..." placeholder is visible |
| should navigate to card page when selecting a featured card | Card click navigates to `/card/:id`, shows synergy breakdown or "no synergies" |
| should show filter drawer on mobile browse | Navigate to `/browse`, tap filter icon, drawer shows Amber/Sapphire ink buttons |
| should return to home when clearing selection on mobile | Clear selection navigates back to `/`, hero reappears |
| should navigate to browse when searching from hero | Typing "Elsa" + Enter navigates to `/browse?q=Elsa`, hero hidden, CardList visible |
| should navigate to browsing view via Browse all cards CTA | "Browse all cards" CTA navigates away from hero, shows browse search input |
| should open filter drawer in mobile browsing view | From browsing view, tap Filters button, drawer shows Amber/Sapphire/Steel ink buttons |

## `search-autocomplete.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show autocomplete dropdown when typing 2+ characters | Typing "El" in hero search shows listbox with options |
| should navigate to card page when clicking a suggestion | Clicking an autocomplete suggestion navigates to `/card/:id` |
| should navigate to card via keyboard (ArrowDown + Enter) | ArrowDown + Enter selects suggestion and navigates to card page |
| should close dropdown on Escape | Escape key dismisses autocomplete dropdown |
| should show autocomplete on browse page search | Typing in browse page search shows autocomplete dropdown |

## Patterns

- **URL assertions** (`toHaveURL`) verify route-based navigation on every transition
- **Hero visibility** is the marker for "home state" vs other pages
- **Deep linking** is tested via direct navigation to `/browse?q=...&ink=...`
- **Navigation back** is tested via both clear/back button and logo click
