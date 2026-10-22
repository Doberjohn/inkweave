# E2E Test Inventory

> **Keep this file updated** whenever E2E tests are added, removed, or edited.

215 tests across 25 spec files, all active (no `describe.skip`'d suites). Tests run on 5 browser projects: `chromium`, `firefox`, `webkit` (desktop), `mobile-chrome`, and `mobile-safari`. Each file skips irrelevant viewports via `startsWith('mobile-')` checks.

The Playwright webServer launches with `VITE_IS_REVEAL_SEASON=true` so the reveal-season active code paths are exercised. Flag-off behavior is covered by unit tests (`useRevealPhase.test.ts` and the route gate). The specs that need the reveal season itself (`reveals-page.spec.ts`, the `/reveals` check in `seo.spec.ts`, and the franchise audit and reflow tests in `accessibility.spec.ts`) start the page's clock two days before the reveal set's `releaseDate` (`e2e/helpers/revealSeason.ts`), so they run on any date.

**Two servers (#869):** `E2E_SERVER` picks what the run tests (`playwright.config.ts`). `dev`, the default, is Vite's dev server, where React logs its development-only errors and the console guard below fails on them. `preview` builds the app into `apps/web/dist/e2e` and serves that production bundle with `vite preview`: a page loads as a few chunks instead of hundreds of modules compiled on request, so the chromium project ran in about half the time (184 s against 358 on two workers in a 4-vCPU container), and the tests run the code that ships. CI runs chromium and mobile-chrome on `dev` (their shared job) and firefox, webkit and mobile-safari on `preview`; a plain `pnpm test:e2e` uses `dev`, and the pre-push hook always does, whatever the shell has set. To reproduce a CI failure from one of those three, run `E2E_SERVER=preview pnpm test:e2e --project=<name>`, which sets it for that one command. PowerShell has no such prefix, and `$env:` would keep the value for the rest of the session, so run it in a child shell there: `powershell -NoProfile -Command { $env:E2E_SERVER = 'preview'; pnpm test:e2e --project=<name> }`. The build doesn't refresh synergy data the way the dev server does, so after an engine change run `pnpm precompute-synergies` first. On either server every context blocks service workers (the production build registers one), and the `page` fixture answers `/_vercel/` (where production loads Vercel's analytics scripts, which only Vercel serves) with an empty script. `webServer.env` also blanks `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` and `SENTRY_AUTH_TOKEN`, so a production build never reports a run's errors or events, or uploads its source maps. Specs that hold a lazy chunk name it through `holdLazyModule` (`e2e/helpers/lazyModule.ts`), which matches the dev server's source file and the production chunk alike.

**Warm-up before the first test (#664):** on the dev server only (a production build has nothing to compile), `e2e/global-setup.ts` opens the 7 pages `accessibility.spec.ts` audits first, up to 3 at a time (never more than the run's workers), on the run's fresh Vite, and waits until no module request has been in flight for 1 s. So the app shell every page shares and those pages compile before any test (every module on its first request, every TSX file through the React Compiler's Babel pass), not inside the first wave's 30 s, and the run log shows `E2E warm-up: 7 routes in N s`. A page that fails to load, or takes over 180 s, stops the run with an `E2E warm-up:` error naming it. What stays cold still compiles on first use, inside a test: the card modal (loaded on the first interaction), the mobile-only search sheet, and pages the warm-up doesn't open (`/compare`, `/vote`, `/reveals`, `/about`, `/release-notes`, `/account`). The mobile projects skip `accessibility.spec.ts`'s axe audits, so their first tests start on such pages, with only the shell warm. Skipped under `PWDEBUG`, whose Inspector would otherwise pause on the warm-up's own browser.

**Global console-error guard:** the shared `page` fixture (`e2e/fixtures/test-fixtures.ts`) fails any test that logs a `console.error` or throws an uncaught exception, except messages matching the documented `BENIGN_CONSOLE` allowlist. This turns silent runtime faults — most importantly React's "Maximum update depth exceeded" render loop, which a loading-skeleton assertion otherwise passes through — into red builds across every spec.

## `accessibility.spec.ts`: 11 tests (9 desktop only, 2 on every project at a 320px viewport)

| Test | What it verifies |
|---|---|
| home page should have no axe violations | `/` passes axe-core audit with zero violations |
| browse page should have no axe violations | `/browse` passes axe-core audit |
| card detail page should have no axe violations | `/card/1939` passes axe-core audit, run once its footer has mounted (the footer waits for the synergies, #532) |
| playstyle gallery should have no axe violations | `/playstyles` passes axe-core audit |
| playstyle detail should have no axe violations | `/playstyles/discard` passes axe-core audit |
| ink gallery should have no axe violations | `/inks` passes axe-core audit (#530: a card-count contrast violation there shipped because the ink pages had no axe coverage) |
| ink hub should have no axe violations | `/ink/steel` passes axe-core audit (#530) |
| in-depth vote page should have no axe violations | `/vote/3286/2983` (the Free Play pair the weekly accessibility check audits) passes axe-core audit once its form shows: it had no title and no h1 (#835) |
| reveals page with a franchise open should have no axe violations | With the clock in the reveal season, the first franchise's cards dialog on `/reveals` passes axe-core audit once its fade ends and its first card tile shows: the spotlight tiles' labels left out their visible text, and the dialog's title bar was a second banner (#835) |
| /inks fits a 320px viewport without scrolling sideways | At 320×640, with the clock in the reveal season, `/inks` is no wider than its layout viewport (`documentElement.clientWidth`: a phone project's `innerWidth` widens to fit the page, and mobile-safari's visual viewport is 8px narrower), and once the ink cards (`main ul > li`) have rendered, none runs past its grid's right edge (WCAG 1.4.10, accessibility check 2026-10-19: phones got the desktop header, whose Reveals pill stuck out 37px, and the ink cards' 300px columns ran 20px into the right gutter) |
| /ink/steel fits a 320px viewport without scrolling sideways | The same on `/ink/steel`, whose grid items are its card tiles (`card-tile`) |

## `app-load.spec.ts` — 4 tests (desktop only)

| Test | What it verifies |
|---|---|
| should display hero home page when app loads | Hero section, search input, featured cards, and ethereal background all render at `/` |
| should display search input on home page | Hero search input is visible |
| should show featured cards after loading | Featured cards grid has 1-12 card tiles |
| should open the overview modal when a card is selected | Clicking a featured card opens the modal overlay-style; URL stays `/`, no compact header |

## `card-detail.spec.ts` — 17 tests (10 desktop only, 3 on every project at a 390px viewport, 2 on every project at a 1024×768 touch viewport, 2 on every project at any viewport)

Two surfaces: the crawlable `/card/:id` **page** (#486 — renders, not-found, empty state; slug URLs `/card/:id/:slug` with the id as the lookup key and the slug decorative, #498) and the
CardOverviewModal opened from a tile (render, close, empty, scroll lock, show-all, sibling nav). The
modal is opened via `appPage.openCardOverview(name)` (Browse `?q=` + tile click) since `/card/:id`
is a real page now, not a modal shortcut.

The page's mobile-layout tests (the #631 overflow guard, the × back flow) force a 390px viewport with
`setViewportSize` instead of skipping `mobile-*`: `isMobile` is width-based, so they render the mobile
layout on every project and also run in the chromium-only Windows pre-push.

The touch-screen tests run on every project at 1024×768 with `hasTouch` (`test.use`) and press tiles with
`tap()`: no project is a tablet otherwise (the desktop ones have no touch, the phone ones are under 768px),
which is how synergy tiles came to ignore every tap at 768px and wider without a test noticing.

| Test | What it verifies |
|---|---|
| should render card name and image inside the overview modal | Modal shows an h1 with the card name and the card art named after it (found by name, not as the first `<img>`: a card with an alternate printing puts the pills' decorative rarity symbols first) |
| should show synergy chips or empty state once data loads | Modal renders synergy groups, empty state, or error after async load |
| renders the crawlable card page when deep-linking to /card/:id | `/card/1947` renders the real page (#486): URL stays, `<title>` baked in, canonical is the slug URL (#498), synergy section visible, no modal |
| a wrong slug still renders the card by id and canonicalizes to the correct slug (#498) | `/card/1947/wrong-slug-here` resolves card 1947 by id (slug decorative); canonical rewritten to the derived slug, not the URL's |
| shows a not-found page for an invalid card ID | `/card/99999999` → noindex "Card not found" page; URL stays, no modal |
| should close the modal when Escape is pressed | Escape dismisses the modal, hero reappears |
| shows the empty state on the page for a card with no synergies | `/card/2228` (no synergy file; guarded by a fixture check) → page "No synergies found for this card" notice |
| should lock background scroll while the modal is open | `document.body` overflow is `hidden` while open, restored on close |
| Show More reveals the full expanded group, and Back returns to default | Modal opened on card 2095 via Browse (`openCardOverview`); ramp group: one "+N more" click → `data-state="expanded"` with a "Back to all synergies" link; Back → `data-state="default"` |
| arrows navigate to a sibling card from the Browse grid | Opening a card from `/browse` shows prev/next arrows; clicking "Next card" changes the modal's h1 to the adjacent grid card |
| a card with many synergy groups does not scroll the page sideways (#631) | At 390px, `/card/2978` (6 groups, fixture-guarded from its synergy JSON): the chip row's content is wider than the page (precondition), `document.documentElement.scrollWidth <= clientWidth` (no page-level horizontal overflow), and the chip row scrolls inside its own box (`scrollWidth > clientWidth`, with computed `overflow-x` `auto` or `scroll`, since `hidden`/`clip` would pass the width checks while stranding the off-screen chips). Compares against `clientWidth`, not `innerWidth`, because mobile emulation zooms out to fit an overflowing page |
| × returns to the card before, and opens Browse on the page the visit started on | At 390px, `/card/2095`: tapping a synergy tile opens that card's page, × returns to `/card/2095` (history back); × again, on the page the visit started on, navigates to `/browse` instead of leaving the app (`useBackOrNavigate`: the entry page has React Router's `history.state.idx === 0`) |
| × on a card page reached by the /compare/X/X redirect opens Browse | At 390px, `/compare/2095/2095` redirects (a replace, so a new location key) to `/card/2095`; × still counts it as the page the visit started on and navigates to `/browse`. Without #653's `history.state.idx` check it stepped back to `about:blank`, out of the site |
| keeps the footer out until the card and its synergies have loaded | `/card/2095` with `allCards.json` and its synergy file held: under the loading skeleton there is no `footer[aria-label="Site footer"]`; with the cards released, the card renders (its `<Seo>` title is set) and there is still no footer; with the synergies released, the footer is attached. Rendered under the loading page, the footer was pushed past the fold as the content arrived, which was the card page's whole layout shift (#532) |
| shows the synergy skeleton, not the empty notice, until the synergies load | `/card/2095` with its synergy file held: the synergy column shows its skeleton (`synergy-results-loading`) and no "No synergies found for this card" notice; with the file released, the ramp group renders and neither the skeleton nor the notice remains. The empty list during the load used to render the notice on every card page, so a card with synergies flashed "No synergies found" first |
| a tap on a synergy tile opens its card page | At 1024×768 with touch, `/card/2095`: `tap()` on the first tile of a "Synergy cards" list navigates to that tile's `/card/<data-card-id>/` page. SynergyCard used to drop any click within 1 s of a touchstart when `isMobile` was false, and a tap's own click always lands inside that second (#843) |
| a tap on a synergy tile in the card window opens the comparison | At 1024×768 with touch, the modal opened on card 2095 via `openCardOverview`: `tap()` on its first tile switches it to `data-mode="comparison"`, the same path a mouse click takes |

## `card-printings.spec.ts`: 6 tests (5 desktop only, 1 on every project at a 360px viewport)

The alternate-printing switcher (#625) on card 1938 (Pongo - Determined Father), whose one alternate printing is Enchanted, and on card 1949 (Mickey Mouse - True Friend), whose four promo printings are 25/P1, 15/P2, 36/P2 and 10/P3 (#805); module-level guards read both from `allCards.json` and throw "Fixture broken" if the pool changes. The 360px test forces its viewport like card-detail's mobile-layout tests, so it also runs in the chromium-only Windows pre-push.

| Test | What it verifies |
|---|---|
| the card page switches to the Enchanted printing, and enlarges that one | `/card/1938`: Standard is checked first; the Enchanted pill's rarity symbol loads (`naturalWidth > 0`, it is a separate `?no-inline` file); clicking the pill checks it and lands the art strip on slide 1; "Enlarge Enchanted printing" opens the lightbox named for the Enchanted printing, not the card's own scan |
| the modal's arrow keys move between printings, not to the next card | Modal opened on Pongo from `/browse?q=father` (four matches, so "Next card" exists). First lets the dialog's initial-focus timer run (`useDialogFocus` moves focus to the × 100ms after opening, and would otherwise take it back from the pills mid-test) by awaiting a 100ms timer of its own in the page, which runs after the dialog's. It does not wait for the × to be focused: headless WebKit has not started the enter transition by then, so the dialog is still hidden and the focus call does nothing. ArrowRight on the focused Standard pill checks and focuses Enchanted, and the modal's h1 is still Pongo (the radio group owns the arrow keys) |
| the modal's arrow keys scroll a focused printings strip, not to the next card | The same modal and timer wait. The art strip takes a tab stop (WCAG 2.1.1, accessibility check 2026-10-19), so with it focused ArrowRight lands the strip on slide 1, the Enchanted pill follows, and the h1 is still Pongo (the strip owns the arrow keys too) |
| a card's promo printings follow its Standard, each by its printed code, and one picked shows its art | `/card/1949`: five chips, named in order "Standard", "Promo 25/P1", "Promo 15/P2", "Promo 36/P2", "Promo 10/P3" (a promo's chip is named "Promo" and its code, #802). Clicking "Promo 25/P1" checks it alone and lands the strip on slide 1, and its art loads (`naturalWidth > 0`): the owner's scan, a preview AVIF the app serves itself, so the check never waits on Ravensburger's servers |
| the card window draws every card's art one height, printings or not, and paging keeps its top and arrows still (#826) | Playwright's 1280x720 is too short for a full-size window with pills, so every card shrinks alike there (`modalCardSize`, owner 2026-10-20). Modal opened on Pongo from `/browse?q=father`; once the window has scaled in (its computed transform reads `matrix(1, 0, 0, 1, 0, 0)`), the printing pills sit inside it. "Next card" pages to a card without printings (no `Card printing` radiogroup): its art (`[data-comparison-card-a]`) is the same height, the window's top and the Next arrow's middle have not moved (the frame holds the pills' room under a card without them), and the window ends higher. The arrow is measured by its middle because it can open under the cursor that clicked the card, and its hover boop, a scale about the middle, moves its edges for a moment |
| four printings fit a 360px phone without widening it, and jumping to the last checks only it | `page.route` adds Epic and Iconic printings to card 1938: four chips; the Epic chip reads "Epic" beside its symbol, which loads (#802: no chip is a symbol alone, the row wraps instead); the row and the page fit `documentElement.clientWidth`. Clicking Iconic lands the strip on slide 3 while a MutationObserver records the checked chip's visible name: exactly `['Iconic']`, since the strip's own scroll past Enchanted and Epic must not read as swipes (each would check its chip in passing and count as a view) |

## `card-modal-on-demand.spec.ts`: 2 tests (every project)

The card overview modal loads on demand (#640). Both tests hold the modal's module request (`holdLazyModule(page, 'CardOverviewModal')`: the dev server's `CardOverviewModal.tsx` or the production build's `CardOverviewModal-<hash>.js`) so the cold path is deterministic.

| Test | What it verifies |
|---|---|
| a cold open shows the loading shell, then the modal takes over | Clicking a featured card while the modal's chunk is held shows `card-overview-fallback` and no modal; releasing the chunk shows the modal and removes the shell |
| the loading shell closes on a scrim click, like the modal | A click on `card-overview-fallback-backdrop` removes the shell, and the chunk arriving afterwards opens no modal |

## `card-data-loading.spec.ts`: 6 tests (every project; the search test desktop only)

The homepage renders its featured cards from a small prebuilt file, `/data/featuredCards.json`, and loads the full card database only when something needs it, or on its own 2 s after the page has loaded and gone idle (#641). The card loader and the reveal dates share one `previewCards.json` request. Some tests hold `**/data/allCards.json` with `page.route` to keep that database from arriving; others replace `requestIdleCallback` (and `cancelIdleCallback`) with a version that never runs, so the deferred load waits for a trigger.

| Test | What it verifies |
|---|---|
| the featured cards render, each linking to its card page, while the card list is held | With `allCards.json` held, six `card-tile` links render in the featured section, each `href` a `/card/<id>/<slug>` path |
| the homepage requests the card list only once something needs it | With idle callbacks never running, `/` shows its six tiles and makes no `allCards.json` request within 1s; focusing `hero-search` makes exactly one |
| previewCards.json loads once per page | `/browse` (reveal flag on, so the reveal dates read the file too) makes exactly one `previewCards.json` request by the time its card tiles show, plus 1s |
| every other page requests the card list at once | With idle callbacks never running, `/browse` still requests `allCards.json` |
| a featured card pressed before the card list lands opens once it does | With `allCards.json` held, a featured-card click shows no modal; releasing the file opens `card-overview-modal` |
| a search typed before the card list lands keeps its text and gets suggestions | Desktop only. With `allCards.json` held, "Elsa" typed into `hero-search` stays; releasing the file shows the autocomplete `listbox` with an option, and the text is unchanged |

## `card-search.spec.ts` — 7 tests (desktop only)

The browse/playstyle search input lives in the toolbar (next to Filters), not the header. Both pages filter the grid in place.

| Test | What it verifies |
|---|---|
| should navigate to browse when searching from hero | Typing in hero search navigates to `/browse?q=Elsa`, hides hero, shows CardList |
| should toggle the docked filters panel on browse page | "Browse all cards" CTA navigates to `/browse`, where the docked `Filters` panel is open by default (its Ink Cost "Cost 1" button shows); Filters closes it, and a second click reopens it. Narrower screens open the Filters dialog instead |
| should deep link to browse with ink filter in URL | Direct navigation to `/browse?ink=Sapphire` shows filtered browse page |
| should navigate to browse via Browse all cards CTA | "Browse all cards" CTA navigates to `/browse`, hero gone, CardList visible |
| should preserve search query in URL on browse page | Hero search for "Ariel" puts `q=Ariel` in URL, browse search input shows "Ariel" |
| should deep link to browse with filters | Direct navigation to `/browse?q=Elsa&ink=Sapphire` populates the search input |
| should filter a playstyle page in place without navigating to browse | Typing in the playstyle toolbar search filters in place: URL stays `/playstyles/ramp` and gains `q=elsa` (no jump to `/browse`) |

## `browse-filters.spec.ts`: 7 tests (6 desktop only, 1 mobile only)

Every other spec sets Browse's filters through the URL. These press the filter buttons and check `aria-pressed` and the URL param each one writes (`useFilterParams.ts`), which is what a shared link carries. The desktop tests use the panel docked beside the cards at 1024px and wider (`complementary` "Filters"), where Type, Keyword, Classification and Set start folded behind a header button; the phone test uses the Filters drawer, which applies only on Apply.

| Test | What it verifies |
|---|---|
| an ink cost | "Cost 3" turns `aria-pressed` and the URL gains `cost=3` |
| Uninkable, which redraws the cost buttons as uninkable hexagons | "Cost 1" has no `<polygon>` before; "Uninkable" turns pressed and writes `inkwell=uninkable`, and "Cost 1" then draws `CostIcon`'s uninkable hexagon |
| a rarity | "Legendary" turns pressed and writes `rarity=Legendary` |
| a card type, a keyword and a classification, each in its folded section | Unfolds Type, Keyword and Classification (`aria-expanded`); Character, Evasive and Hero each turn pressed and write `type=Character`, `keyword=Evasive` and `classification=Hero` |
| an ink, then Dual-ink cards | "Filter by Amber" writes `ink=Amber`, and the "Dual-ink cards" toggle it reveals writes `inkmatch=dual` |
| with the panel closed, the active chips list the filters and one can be dismissed | After Cost 3 and Evasive, the Filters button closes the panel; the chips "Cost: 3" and "Evasive" show (only while it is closed), and dismissing "Cost: 3" drops `cost=` and keeps `keyword=Evasive` |
| a pick applies only on Apply | Phone drawer: "Cost 3" turns pressed with no `cost=` in the URL yet; "Apply" writes `cost=3` and closes the drawer |

## `card-selection.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should show home state at root URL | Hero + featured cards visible, URL is `/` |
| should open the card overview modal when a card is selected | Selecting a card opens the modal overlay-style; URL stays `/`, backdrop visible |
| should show synergy results area when card is selected | Modal renders synergy groups, empty state, or error after async load |
| should clear selection by closing the modal | ✕ button closes the modal; hero reachable, URL stays `/` |
| should close the modal when the backdrop is clicked | Backdrop click closes the modal; hero reachable, URL stays `/` |

## `mobile.spec.ts` — 19 tests (mobile only)

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
| the search sheet shows highlighted results, and a picked one opens its card window | Types "Elsa" in the sheet and waits out its 150ms debounce, which the Enter test above never does: "N results" shows and the first row's match is a `<mark>` reading "Elsa". Picking the row (it picks on mousedown) opens the card window named "<that card> synergies" |
| a picked result comes back as a recent search that searches again | Picks the first "Elsa" result, closes the card window and reopens the sheet: the card's full name is a button under "Recent", and pressing it fills the field with that name and lists that card first |
| Clear search empties the field, and Clear removes the recent searches | With one recent search seeded in `localStorage['inkweave-recent-searches']`, "Mickey" shows results; "Clear search" (the field's ×) empties the field and brings the recent search back; "Clear" shows "Search for a card to see its synergies" and removes the key |
| should show sort dropdown in browse toolbar | Sort select and Filters button both visible in browse toolbar |
| should lock background scroll when filter drawer is open | Opening filter drawer sets body overflow to hidden |
| should open filter drawer in mobile browsing view | From browsing view, tap Filters button, drawer shows Amber/Sapphire/Steel ink buttons |
| should close the overview modal via the close button | ✕ button dismisses the modal on mobile |
| should close the overview modal via backdrop tap | Backdrop tap dismisses the modal on mobile |
| should open and dismiss the Mechanics bottom sheet on a playstyle page | Mechanics button opens the `Mechanics filter` sheet; backdrop tap dismisses it |

## `playstyle-pages.spec.ts` — 7 tests (desktop only)

| Test | What it verifies |
|---|---|
| should navigate to playstyle gallery via CTA | "Explore playstyles" CTA navigates to `/playstyles`, renders page heading |
| should render playstyle gallery with playstyle cards | `/playstyles` shows h1 + at least 2 playstyle cards (role="button" elements) |
| should navigate to playstyle detail page | Clicking a playstyle card navigates to `/playstyles/:id`, shows heading |
| should deep link to playstyle detail page | Direct navigation to `/playstyles/lore-denial` shows heading + card tiles |
| should navigate back from playstyle detail to gallery | Back link from detail returns to `/playstyles` (or logo to `/`) |
| the header search opens a card window from the keyboard, staying on the gallery | On `/playstyles`, the one page whose header has a search field: typing "Elsa" lists suggestions, ArrowDown marks the first `aria-selected`, Enter opens its card window (named after it) and the URL stays `/playstyles` |
| Enter in the header search goes to Browse with the query | On `/playstyles`, "Elsa" then Enter with nothing highlighted goes to `/browse?q=Elsa` |

## `account-header.spec.ts` — 4 tests (3 desktop only)

Covers the accounts surface, which ships behind `VITE_SHOW_ACCOUNTS` (default OFF). `playwright.config.ts` pins the flag ON **and** pins placeholder `VITE_SUPABASE_*` values. Both pins matter: without credentials `isSupabaseConfigured()` is false, `enabled` is false and `AuthButton` renders nothing, so these would pass locally off a developer's `.env.local` and fail in CI, which supplies no Supabase env. Pinning makes the state identical everywhere.

At page load, supabase-js is downloaded only when there is a session to restore (#729): a stored `inkweave:auth` entry, or an OAuth code (`/auth/callback`, or `?code=` on any path). After that it loads on demand, on first use: sign-in or sign-out, a vote, a pair's community scores, a profile call. The two SDK tests cover the page-load gate and watch the network for it; under Vite dev it arrives as `supabaseClient.ts` plus the prebundled `@supabase_supabase-js` dependency, and in a production build as the `supabaseClient-<hash>.js` chunk. They pair up: the stored-session test proves the matcher sees the SDK, so the anonymous test's empty list is not a blind spot.

| Test | What it verifies |
|---|---|
| the header carries a sign-in control on every page | `compact-header` shows a "Sign in" button on `/browse` AND `/playstyles`, proving the header carries it rather than the page |
| an anonymous visit never downloads the Supabase SDK | With nothing stored, `/browse` renders the "Sign in" control and reaches network idle without one SDK request |
| a stored session downloads the Supabase SDK to restore it | An `inkweave:auth` entry seeded before load makes `/browse` request the SDK (all projects) |
| the sign-in control opens the provider dialog | Clicking it opens the `SignInDialog`. Stops at the provider choice: signing in needs a real round-trip no placeholder project can serve |

## `collection-mode.spec.ts`: 25 tests (1 every project, 2 chromium only, 21 desktop only, 1 on every project at a 390px viewport)

Covers Browse's collection mode (#553 Phase C), which ships behind `VITE_SHOW_COLLECTION` (default OFF). The flag REQUIRES `VITE_SHOW_ACCOUNTS`, and `playwright.config.ts` pins both ON. The Collection button is gated on sign-in (owner ruling 2026-10-07).

**Signed in without signing in.** An OAuth round-trip is out of E2E's reach, but a session supabase-js restores needs none. `signInAsCollector` stores an unexpired session under `inkweave:auth` (`storedSession` in `e2e/helpers/session.ts`, which `friends.spec.ts` shares), which `getSession()` hands back without a network check, and the collector's collection twice: as the local copy (`inkweave:collection`, stamped `source: 'server'` so it is never uploaded back) and as the `collections` row its own `page.route` serves, which the sync adopts on every load (`resolveCollectionSync`). That route is registered after the fixture's catch-all stub, so it wins for that table. It keeps the row as the table does: an upload (a POST, `upsertCollection`) replaces it, every later read answers with it, and `signInAsCollector` returns the uploads for a test to read (#826). Tests that open the mode from the button first wait for the header's "Account" control, so the click never lands while the session is still restoring. The collection is drawn from the card data, not hardcoded: the newest Core set's first three cards and its first alt-art printing (`newestCoreSet`, `setCards`, `setPrintings` in `e2e/helpers/cardData.ts`), so the counts follow the data when a set graduates.

The desktop signed-in tests skip the mobile projects: they find the numbers in the docked collection panel and the art presets in the docked Filters panel, and phones get the set strip (numbers behind a toggle) and the filter drawer instead. The strip has its own test, run on every project at a forced 390px viewport: the layout is chosen by width (`useResponsive`), so a desktop browser renders it too, and the chromium-only Windows pre-push covers it. The tablet rail's figures have a unit test (`CollectionBinderSection.test.tsx`). Reading an import file and the sync's conflict paths stay with the unit tests (`ImportCollectionDialog.test.tsx`, `collectionParser.test.ts`, `__tests__/collectionSync.test.ts`, `CollectionContext.test.tsx`).

| Test | What it verifies |
|---|---|
| the Collection button asks a signed-out visitor to sign in | `/browse` shows "Show my collection" and no "Collection actions" gear (its actions need an account, owner 2026-10-20); clicking Collection opens the sign-in dialog and renders no binder |
| a visit that never opens collection mode loads none of it | Loading `/browse` to network idle requests no `/data/collection/` chunk and no `CollectionBinderSection` module. Chromium only: it asserts the network, which the other browsers would only repeat |
| signed out, a binder link keeps the grid and a Set filter picked on it | #790. Signed out on `/browse?binder=<set>`, the grid shows; a Set logo clicked in the Filters panel turns `aria-pressed` and keeps `set=` in the URL, with no binder. The page dropped the filter as a stray whenever `binder=` was in the URL, honoured or not. Chromium only: it asserts the URL, and the panel is the desktop one |
| the Collection button opens a collector's binder on the whole collection, with its numbers | Signed in with a collection, "Show my collection" puts `binder=all` in the URL (the whole collection, not the newest set: owner, 2026-10-20) and shows the `Binder` region, with "Complete collection" in the `Collection numbers` region. The tests below open the collection's set by URL |
| on a new browser, the Collection button waits for the account instead of offering an import | The collection is the server row alone (no local copy), and the server holds its answer. The page goes out through Home and back (client-side), so the providers mount with the account already known, the case StrictMode's dev double effect makes hard. A click before the answer opens the binder to wait (`binder=` in the URL) rather than the Import dialog; once the server answers, the whole collection's "Complete collection" shows and no Import dialog opens |
| when the account answers with no collection, the wait offers the import and drops the binder param | No collection anywhere (no local copy, no server row), and the server holds its answer. A click before the answer opens the binder to wait (`binder=` in the URL); once the server answers with nothing, the Import dialog opens and `binder=` leaves the URL. Left behind, the dead param reloaded into a loading binder |
| on a new browser, the account page checks the account before offering an import | The collection is the server row alone, and the server holds its answer. On /account the Collection section reads "Checking your account for a collection…" with Import collection disabled; once the server answers, "Cards owned" shows and Re-import is enabled |
| the panel counts every pocket of the set, the alt-art printings among them | `/browse?binder=<set>`: the numbers read "H of N cards", H the held pockets and N the set's cards plus its Epic, Enchanted and Iconic printings |
| a count changed from a pocket shows at once and is still there after a reload (#826) | `/browse?binder=<set>`: a mouse on the first pocket the collector holds none of (the pocket after the three held) opens its copies stripe, labelled "0 normal, 0 foil", and the + of Normal (under `aria-hidden`, so found with `includeHidden`) adds a copy. With the mouse gone, the binder holds one more "1 normal" count and the numbers read "H+1 of N cards". The stubbed account receives the upload a moment later (the batch, `UPLOAD_DELAY_MS`), and after a reload, which adopts the account's row, the count and the numbers still read the same |
| in Missing, copies added from a pocket and from the card window keep both cards and the spread (#826) | `/browse?binder=<set>&owned=missing`, turned with `Next spread` to spread 2 (the map's current spread reads "Spread 2 of N"). A mouse on its first pocket opens its copies stripe, labelled "0 normal, 0 foil"; the + of Normal (under `aria-hidden`, so found with `includeHidden`) makes it read "1 normal, 0 foil", and leaves the focus off that + (a click would otherwise focus a button no Tab reaches). A click near the second pocket's top, clear of the open stripe that takes every press on the card's foot, opens its window, whose stripe takes a first copy from the keyboard ("Your copies: 1 normal, 0 foil"), and ArrowLeft opens the first card, kept in the listing the arrows walk. Escape closes the window over the mouse still resting on the second pocket, whose stripe opens again with no move. Both cards, now held, keep their pockets and the binder its spread (owner, 2026-10-20): dropped from the view at once, a card reopened the binder at spread 1. The stubbed account receives both copies |
| the card window's stripe changes its copies by mouse and by keyboard, on the grid's windows too (#826) | `/browse?set=<set>&q=<name>`, the grid (not collection mode), signed in as the collector: the first held card's window carries the copies stripe over its card's foot in its slot (`card-overview-copies-slot`), always open, a group named "Your copies: 1 normal, 0 foil". After the dialog's 100ms initial-focus timer, a click on the + of Normal makes it "2 normal, 0 foil"; then, from that + focused, Tab twice (through the foil −, at 0 but still a stop) lands on the + of Foil, and Enter makes it "2 normal, 1 foil". The stubbed account receives {normal: 2, foil: 1} |
| Owned keeps the held cards alone, and leaving the mode drops that view | The `Binder shows` group's "Owned" adds `owned=owned` and leaves exactly the held tiles; turning collection mode off removes the binder and both the `binder` and `owned` params |
| under Master set, Owned and Missing ask for a copy in each finish | `/browse?binder=<set>&owned=owned` holds the H held tiles; the "Master set" headline leaves only the printing's (a held printing's one finish counts as both, `isHeld`), and "Missing" then leads with the three base cards held in one finish only. Missing asked only for a copy before, so Set 3's Nani - Protective Sister, held as a normal copy, hid from it while Master read 99% (owner, 2026-10-20). The page holds the choice: after a switch to the whole collection, "Master collection" is still chosen and Owned still holds only the printing |
| the set picker's All sets opens the whole collection in the binder | The `Binder set` menu's first row, "All sets" in the `Standard sets` list (owner, 2026-10-20: each list starts with it), gives `binder=all` and relabels the picker "Binder set: All sets, the whole collection" (the toolbar button reads "All sets"), and the rest follows: "Complete collection" in the numbers and a tile in the binder |
| the keyboard pages the binder end to end without losing the focus | #790. `/browse?binder=<set>`: from the first pocket, one Tab reaches the spread map's Previous, focused and `aria-disabled` at the first spread (the pockets are one Tab stop). Enter on Next through to the last spread (counted from the current spread's "Spread 1 of N" name, asserted above 1) leaves the focus on Next, `aria-disabled`: a disabled Next dropped it to the page |
| a search narrows the binder, and the panel's numbers count only what it finds | A held card's full name (one with no alt-art printing) in `browse-search` leaves one tile, and the numbers read "1 of 1 cards" under the headline "Complete": filtered, it names no set. Skips when none of the set's first three cards lacks a printing |
| Alt art cards picks the alt-art rarities, and the binder counts only those printings | The Filters panel's "Alt art cards" preset turns `aria-pressed`, sets `rarity` to Enchanted, Epic, Iconic and Special (the promos, #805, which a set's binder holds none of: they are its promo sets'), and the numbers read "1 of P cards", P the set's printings. Skips a set with none |
| the set picker lists the promo sets under their own tab, and a promo set's binder holds a pocket per number | The collector also holds one promo of the first promo set whose numbers skip one (`promoSetWithOpenPocket` reads `public/data/collection/promos.json`). The `Binder set` menu's "Promo" tab lists it in the `Promo sets` list as "Promo set <code>, ..."; picking it gives `binder=<code>`, the numbers read "1 of N promos", N its promos with a card, with no Master headline (#805), and, turned with `Next spread` to the spread holding it (the binder opens on the front cover, #806), the binder shows the open pocket's code (its first skipped number, "19/C2", whatever the pocket says about why it is open) |
| the set picker's Promo tab opens every promo set at once, counted as promos, with no Rarity filter (owner, 2026-10-20) | The collector also holds one promo (`promoSetWithOpenPocket`). The page opens on the set's binder with `rarity=Common`, its Filters panel showing the `Rarity filters` group. In the `Binder set` menu, the "Promo" tab's first row, "All sets, every promo set", gives `binder=promos`, drops the `rarity` param and the Rarity section (every card is a promo, so a hidden filter could only empty the binder), and relabels the picker "Binder set: Promos, every promo set"; the numbers read "Complete promos" and "1 of N promos", N every promo set's promos with a card, with no Master headline |
| the set picker opens the whole collection's menu on Promo while the Rarity filter picks the promos (owner, 2026-10-20) | `/browse?binder=all&rarity=Special`: the `Binder set` menu opens with its "Promo" tab pressed and the `Promo sets` list showing, where the whole collection otherwise opens on Standard. The URL reaching the picker is what it guards; the rule itself has unit tests |
| the gear after Collection opens the import from its menu, on the grid too (owner, 2026-10-20) | Signed in with a collection, on `/browse` (the grid, not the binder): the `Collection actions` gear opens its menu, whose "Import collection" opens the `Import your collection` dialog, the Account page's import, and closes the menu |
| a card glows gold when pointed at, more strongly on the binder's parchment (owner, 2026-10-21) | The one way the app highlights a card. On `/browse?set=<set>` (the grid), a mouse on the first tile gives it a box-shadow with the soft gold glow (`rgba(255, 185, 0, 0.42) 0px 0px 22px 3px`, `CARD_TILE_GLOW`) over its resting shadow, `z-index` 1 so the glow lies over its neighbours, and no `::after` (the gold ring it replaced). On `/browse?binder=<set>`, a mouse on the first held pocket gives the stronger gold (`0.85`, `22px 4px`) that shows on the parchment. A box-shadow set inline would beat the rule and fail it: the tile keeps its resting shadow in `--tile-shadow` |
| a signed-in visitor without a collection is asked to import one | Signed in with no local copy and no server row, "Show my collection" opens the `Import your collection` dialog and renders no binder |
| a pre-Core card's window offers its Enchanted, and the Enchanted's pocket opens the card on it (#891) | `preCoreCardWithEnchanted` (`e2e/helpers/cardData.ts`) reads, from `public/data/collection/{set}.json`, the first card of Sets 1-8 whose one printing in its set is an Enchanted; `/browse?binder=<set>&q=<its name>` narrows the binder to its two pockets. A click near the card's pocket top opens its window on `Standard` (`aria-checked`), with an unchecked `Enchanted` radio in the `Card printing` group: Sets 1-8 keep a card's printings as cards of their own, which collection mode gathers into its `variants`. After the dialog's 100ms initial-focus timer, Escape closes it, and a click on the Enchanted's pocket opens the card itself, titled with its name, on `Enchanted`. Before #891 the window offered no printings, and the Enchanted's pocket opened as a lone card |
| the set strip reads the set's two percentages and opens its numbers inline | Every project at 390x844, `/browse?binder=<set>`: no `Collection actions` gear shows (owner, 2026-10-20: it wrapped Collection onto a second toolbar row), and the `Set` strip's "Show the numbers" toggle reads the Complete and Master percentages, rounded down as the panel rounds them (`percentOf`), and no `Collection numbers` region shows; clicking it opens the region ("Complete set" visible, the toggle now "Hide the numbers", `aria-expanded`), and a second click folds it away |

## `friends.spec.ts`: 6 tests (5 every project, 1 desktop only)

Covers the Friends section on `/account` (#852), which ships behind `VITE_SHOW_FRIENDS` (default OFF). The flag REQUIRES `VITE_SHOW_ACCOUNTS`, and `playwright.config.ts` pins both ON. The player signs in from a stored session (`signInAs` in `e2e/helpers/session.ts`). Every friends call answers from a world the test keeps (`serveFriends` in `e2e/helpers/friends.ts`): `claim_handle`, `claim_friend_code`, `profiles`, `friendships` (a GET, or the delete of one row) and the `send_friend_request` and `accept_friend_request` RPCs. The world changes as the database would, in the migration's order (a send answers your own code, then a pair that already has a row by accepting theirs or echoing it, then the 20-request cap ahead of an unknown code, then adds a waiting row; an accept makes a friendship), so each test acts and then reads what the section loads back. Its routes are registered after the fixture's catch-all stub, so they win. That stub answers `claim_friend_code` with `E2E_FRIEND_CODE` on its own, so any signed-in spec opening `/account` (`collection-mode.spec.ts` does) gets a ready section, not its failed state. Everything else stays with the unit tests: decline, cancel and remove, the copy button, focus after a row leaves (`FriendsSection.test.tsx`), the tab-return reload (`useFriends.test.ts`) and each refusal's words (`friendRepository.test.ts`).

| Test | What it verifies |
|---|---|
| /account shows the player's friend code, and no one yet | Signed in with no friendships, the Friends section shows the code as `ABCD-2345` and "No friends yet. Share your code, or enter a friend's." |
| a friend's code sends a request, which shows under Sent with their name | `sp77-m3xt` (lower case, with the hyphen) sends Steel Pirate 777's code: the section's status line reads "Request sent to Steel Pirate 777.", `Sent (1)` lists them by name, and the field is empty again |
| accepting a request moves it to Your friends | With Ruby Hero 042's request waiting, "Accept request from Ruby Hero 042" leaves `Your friends (1)` holding "Remove Ruby Hero 042", and no Requests heading |
| a code no one has says so, and changes nothing | `M3PZ-8RQT` matches no one: the section's alert reads "No one has that friend code. Check it with your friend.", the code stays in the field, and the world holds no new row |
| with 20 requests waiting, a further code is refused and nothing is added | With `Sent (20)` listed, Steel Pirate 777's real code gets the alert "You have 20 requests waiting. Cancel one to send another." (at the cap even a code someone holds answers `too_many`), and the world still holds 20 rows |
| /account with requests, sent requests and friends has no axe violations | With a request, a sent request and a friend listed, the whole page passes axe-core. Desktop only, as `accessibility.spec.ts`'s audits are |

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
| should close dropdown on Escape | Escape key dismisses autocomplete dropdown, within the default timeout (a debounce pending at the keypress used to reopen it, #746) |
| should NOT show autocomplete on browse page search | Typing in browse page search does NOT show autocomplete (browse filters inline) |

## `seo.spec.ts` — 23 tests (both viewports)

Route-level metadata coverage (#524). Before this, the file asserted only home-page
properties, so #486's central acceptance criterion — every route self-references its own
canonical — was unguarded. `/vote` shipped into the sitemap without a `<Seo>` as a direct
consequence.

Note the title assertion checks the *effective* `document.title`, not a count of `<title>`
elements: React 19 hoists the `<Seo>` title but leaves `index.html`'s shell `<title>` in
the DOM, and `prerender.mjs` strips the duplicate only at capture time (#492). Neither E2E
server prerenders (the dev server and `vite preview` both serve the shell), so both are present.

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
| should own its title and canonical: `/release-notes` | As above, on a page built on `LegalPage` (#765) |
| card page has exactly one h1 at a mobile viewport | 412×915 — CardPage gates the desktop `CardDetailPanel` behind `!isMobile` while `CardDetail` owns the h1 below it (`headingLevel="h1"`, always set by `SynergyResults`). Googlebot renders mobile, so a regression in either branch is invisible at desktop width |
| vote page has exactly one h1 while its pair loads and once it shows | Holds `_pairs_index.json` to pin the loading state, then releases it. The vote screen shows no heading, so its h1 is visually hidden (`VotePageShell`), and nothing on screen goes missing without it, which is how `/vote` sat in the sitemap with no h1 |
| vote page has exactly one h1 when its pairs fail to load | `_pairs_index.json` answers 500, so `VoteErrorView` renders, with its own copy of the hidden h1 |
| comparison owns a title naming its pair | `/compare/3286/2983/free-play`'s tab reads "\<A\> + \<B\> \| Compare \| Inkweave", the names read from `allCards.json`: the page rendered no `<Seo>`, so once the prerendered tags were swept the tab showed the bare address (#835) |
| in-depth vote page owns a title naming its pair, and exactly one h1 | `/vote/3286/2983`'s tab reads "\<A\> + \<B\> \| Vote \| Inkweave", and its one h1 is the visually hidden "Vote on \<A\> and \<B\>" (#835) |
| card page links to all six ink hubs at a mobile viewport | The footer's ink nav is what puts every hub one click from all 1,024 card pages (#530) |
| ink hub emits one crawlable anchor per card, identically on mobile | `CardGrid`, not the Virtuoso-windowed `BrowseCardGrid` — windowing would emit a fraction of the anchors to a crawler (#530) |
| unknown ink slug renders the 404 page, not an empty hub | Junk URLs under `/ink/` declare themselves unindexable instead of returning a thin 200 (#525) |
| reveals page owns its title and canonical when in season | Starts the page's clock inside the reveal season, so it runs on any date. `/reveals` has no prerendered file, so production answers it with the HOME page's HTML; those tags carry `data-seo`, the sweep strips them, and with no `<Seo>` of its own the page shipped with no title and no canonical at all |
| every tag `<Seo>` emits carries the data-seo sweep marker | #535 — an unmarked tag escapes `sweepPrerenderedSeoTags()` and silently duplicates on every real visit |
| client navigation swaps metadata in place instead of accumulating it | #535 — two `<link rel="canonical">` makes Google ignore canonicalisation entirely, which is worse than emitting none |
| sweep preserves index.html site-level constants | #535 — `og:type` / `og:locale` / `og:image:width` / `og:image:height` / `twitter:card` are not emitted by `<Seo>`; widening the sweep selector would strip them on every load |

The three #535 specs cannot observe the duplication itself: it requires the prerendered
HTML, and both E2E servers serve the shell. They guard the marker
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

## `synergy-detail-modal.spec.ts` — 12 tests (5 desktop, 5 mobile, 2 deep-link)

Comparison mode — clicking a synergy card tile (a crawlable `a.card-tile`, #486) transitions CardOverviewModal in-place to the side-by-side comparison view. Desktop uses two columns; mobile uses the tabbed `MobileComparisonView` (#332 #5). Setup opens the modal on the fixture card via `appPage.openCardOverview(name)` (Browse `?q=` + tile click). Deep links open comparison directly via `/compare/A/B/groupKey`.

| Test | What it verifies |
|---|---|
| should enter comparison mode when clicking a synergy card | (desktop) Clicking a shift-targets tile shows the BACK button, and card A settles 0 to 40px below the × (the chip row and gold divider give up their space: no empty band under BACK, and no overlap with the BACK + × row); URL stays `/` |
| should show engine column with rule explanations in comparison mode | (desktop) `section[aria-label="Engine score"]` renders with Shift rule explanations |
| should exit comparison mode via the BACK button | (desktop) BACK returns the modal to `data-mode="default"`, URL stays `/` |
| should switch comparison pairs across exit and re-entry | (desktop) Enter → BACK → enter a different pair; consecutive comparisons work cleanly |
| keeps the score help under the pointer, and Escape hides it before the card view hears it | (desktop) In a comparison, the Engine column's "What does this score mean?" tooltip stays while the pointer slides from the button onto it and rests there past its 150 ms close delay, and closes once the pointer leaves both. With the button focused, its accessible description holds "Perfect"; the first Escape hides the tooltip with focus unmoved and the view still in comparison, and the second steps back to `data-mode="default"` (WCAG 1.4.13 and 1.3.1, #836: the tooltip ignored the pointer, wasn't announced, and Escape closed the view instead) |
| should enter comparison mode on mobile | (mobile) Tapping a synergy tile shows the BACK button, and card A settles 0 to 40px below the × (MobileComparisonView covers the hidden chip row but not the BACK + × row) |
| should render the tabbed comparison layout on mobile | (mobile) MobileComparisonView's Engine/Community section-switch pill buttons render |
| should switch to the Community tab on mobile | (mobile) Tapping the Community pill moves `aria-current="true"` onto it, and scrolls only the tab strip: once the strip has landed on Community, the page and every scroll container around it are where they were before the tap (#653, the strip now uses `useScrollSnapIndex` instead of `scrollIntoView`, which also scrolls ancestors; the old code did not move them in this layout either, so this guards the outcome) |
| should open and dismiss the card lightbox on mobile | (mobile) Tapping a comparison card opens the portal-to-body `Enlarged:` dialog; its close button dismisses it |
| should exit comparison mode via BACK on mobile | (mobile) BACK returns the modal to `data-mode="default"` |
| opens directly in comparison with no BACK button (desktop) | (deep link) `/compare/A/B/groupKey` opens straight into comparison; BACK button suppressed (hideBackButton) |
| opens the mobile tabbed comparison view (mobile) | (deep link) `/compare/A/B/groupKey` opens the mobile MobileComparisonView |

## `playstyle-detail.spec.ts` — 5 tests (desktop only)

| Test | What it verifies |
|---|---|
| should render hero with name and breadcrumb | `/playstyles/discard` shows h1 "Discard" and the breadcrumb nav with "Playstyles" link |
| should show and use role filter chips | "Forced Discard" mechanic chip filters to a subset; toggling it off restores the full grid |
| should render card tiles in grid | `/playstyles/location-control` renders 5+ card tiles. It first waits for discard's tiles, since leaving while discard's playstyle data loads aborts that fetch, and WebKit's "TypeError: Load failed" for the abort fails the console guard (#854) |
| should open the card overview modal from playstyle detail | Clicking a card tile opens the modal; URL stays on the playstyle page |
| keeps a tile tooltip under the pointer, ignores clicks on it, and hides on Escape | The "Forced Discard" tile's description tooltip stays while the pointer slides onto it and rests there past its 150 ms close delay; a click on it leaves the tile `aria-pressed="false"` (it renders beside the tile's button, so the click no longer bubbles to it through the portal); Escape hides it (WCAG 1.4.13, #836) |

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

## `reveals-page.spec.ts`: 11 tests (9 desktop, 1 mobile, 1 on every project at a 390px viewport)

**Season-independent by design.** The `beforeEach` reads the reveal set (the `previewCards.json` entry with the latest `releaseDate`) and the tests build their matchers from its `name` and `number`; the franchise's name is read off the tile's own heading. Starting a new season needs no edit here. The `beforeEach` also starts the page's clock two days before that `releaseDate` (`e2e/helpers/revealSeason.ts`), so the suite runs on any date, release day and the weeks before the next set's dates land included: graduation keeps the set's dates in `previewCards.json` and its cards in `allCards.json`. Four tests additionally skip while `cards` is empty.

| Test | What it verifies |
|---|---|
| renders the tracker: hero, six ink trackers, and the debut franchises | sr-only `h1` containing the set name, the set logo (alt = set name), the hero's countdown labelled "Until store release" (the pinned clock is past the pre-release), 6 `ink-tracker-tile`s, the "Ink board" section, and at least one franchise button, named by its text and ending "View cards", all render |
| desktop nav shows Reveals entry with NEW badge | `/browse` has a Reveals link with a "NEW" badge child |
| mobile nav shows Reveals tab | On mobile, `/browse`'s bottom nav has a "Set N reveals" link |
| promo modal appears on landing page and not on /reveals | `role="complementary" name="Set N reveals"` visible on `/`, absent on `/reveals` |
| on a phone, the page leaves room under the promo and scrolls focus clear of it | At 390px on `/`, the root's `scroll-padding-bottom` equals the promo's height, and the footer's last link, focused from the top of the page, scrolls into view above the promo (WCAG 2.4.11, accessibility check 2026-10-19) |
| mosaic card click opens the card overview modal | Clicking a `reveal-card-slot` on `/reveals` opens the modal; URL stays `/reveals` (skips with no cards) |
| the card modal's arrows step through the board's cards in mosaic order | Opening the first `reveal-card-slot`, then "Next card", shows the second slot's card in the modal's `h1` (slot labels read "View <card>"; skips with fewer than two revealed cards) |
| franchise card click opens the franchise cards modal | Clicking the first franchise tile (ending "View cards") opens the `dialog` named "<franchise> cards", the franchise read from the tile's `h3`; a card-tile inside opens the overview modal on top (card click skips with no cards) |
| ?ink= param selects the starting mosaic ink | `/reveals?ink=emerald` makes the Emerald `ink-tracker-tile` the `aria-pressed` (featured) one |
| clicking a rarity chip dims the other revealed cards | A kit chip in the "Highlight a rarity" group toggles `aria-pressed`; other-rarity slots get `data-dimmed`; clicking again clears it (skips when <2 rarities revealed) |
| an alt art opens the card modal on that printing | On `/reveals?ink=amber`, clicking the first `reveal-printing-slot` opens the modal with that rarity's radio `aria-checked` in the "Card printing" group (skips until the Amber board has a revealed Epic/Enchanted/Iconic) |

## `release-notes.spec.ts`: 3 tests (every project; the last at a 390px viewport)

The `/release-notes` page (#765), which shows one committed JSON file per week, newest first. The tests read the week of September 28, 2026 by name, so they stay true as later weeks are added.

| Test | What it verifies |
|---|---|
| shows a week with its sections in order | The h1 "Release notes", and the "September 28 to October 4, 2026" region's h3s read New, Improved, Fixed, Synergy engine |
| the footer links to it | From `/about`, the site footer's "Release notes" link opens `/release-notes` |
| does not scroll sideways on a phone | At 390px, `document.documentElement.scrollWidth <= clientWidth` once the week has rendered |

## Patterns

- **URL assertions** (`toHaveURL`) verify route-based navigation on every transition
- **Hero visibility** is the marker for "home state" vs other pages
- **Deep linking** is tested via direct navigation to `/browse?q=...&ink=...`, `/card/:id`, `/playstyles/:id`, `/compare/A/B/groupKey`
- **CardOverviewModal** is the quick-look surface: clicking a card tile (anywhere) opens it overlay-style with the URL unchanged. **`/card/:id` is also a real, crawlable page** (#486) — deep-linking or middle-clicking a tile lands on the routed `CardPage` (its own `CardDetailPanel` + `SynergyResults` composition; the modal renders neither). To open the modal on a *specific* card in a test, use `appPage.openCardOverview(name)` (Browse `?q=` + tile click); `/card/:id` no longer opens the modal.
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
- **A test fails in CI on firefox, webkit or mobile-safari but passes on the Chromium job**: those three test the production build (`E2E_SERVER=preview`, #869), so check whether the build is the difference: run the test on chromium with `E2E_SERVER=preview` (see **Two servers** above). A route matched by a source path (`**/Foo.tsx`) never sees the production chunk (`/assets/Foo-<hash>.js`); hold a lazy chunk through `holdLazyModule`.
- **`[WebServer] ... hmr update` followed by `Failed to load url .../synergy-engine/dist/index.js`** means something rebuilt the engine in the same checkout mid-run (the engine auto-rebuild hook after an engine edit, or another typecheck or pre-push), and pages loading at that moment failed. Re-run once the other build is done.
