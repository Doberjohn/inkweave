# Area 2 — Navigation, Footer & Layout Research (Issue #219 Legal & Product Pages)

> **Since #593 (2026-09-30):** the admin tools moved to `Doberjohn/inkweave-admin`. The app no longer has `/admin/*` routes, `AdminGate`, the GitHub PAT in `localStorage` (`inkweave.reveal-admin.gh-token`), `githubCommit.ts`, the admin pages, or `api.github.com` in its CSP `connect-src`. Mentions of them below describe the app as researched.

## Scope

Where do the four legal/product pages (Privacy, Terms, IP Disclaimer, About) get *surfaced* to
users? This doc maps the current layout shell (`AppLayout`), the desktop header/nav
(`CompactHeader`), the mobile bottom nav (`MobileBottomNav`), and the (non-existent) footer.
It documents the exact mount points, the design tokens available, existing branding/attribution
text, and a concrete, evidence-backed footer recommendation. **Read-only research** — no source
was modified. Every claim cites `apps/web/src/...` with line numbers; unknowns are called out as
Open Questions rather than guessed.

---

## 1. The layout shell (`AppLayout.tsx`)

`apps/web/src/AppLayout.tsx` (131 lines) is the **root route element** — it is mounted at
`path: '/'` in `router.tsx:107-109` and every page renders through its `<Outlet/>`.

### Provider / render tree

```
AppLayout()                                          (AppLayout.tsx:116-130)
└─ <ErrorBoundary>
   ├─ <SessionProvider>
   │  └─ <CardDataProvider>
   │     └─ <CardModalProvider>
   │        └─ <AppContent/>                         (the actual layout body)
   ├─ <Analytics/>        (@vercel/analytics)        (line 126)
   └─ <SpeedInsights/>    (@vercel/speed-insights)   (line 127)
```

`AppContent()` (lines 53-114) is the body that wraps the routed page:

```tsx
return (
  <>
    <div style={showBottomNav ? {paddingBottom: MOBILE_NAV_HEIGHT} : undefined}>
      <Outlet />                                       {/* the routed page */}
    </div>
    {showBottomNav && <MobileBottomNav onSearchClick={openSearch} />}
    {isMobile && <SearchBottomSheet ... />}
    {showRevealsPromo && <RevealsPromoCard />}
    {shouldShowBetaNotice({isHome, isMobile}) && <BetaNotice />}
  </>
);
```
(`AppLayout.tsx:99-113`)

Key visibility flags (`AppLayout.tsx:55-60`):

| Flag | Definition | Line |
|------|-----------|------|
| `isHome` | `pathname === '/'` | 57 |
| `showBottomNav` | `isMobile && !isHome` | 58 |
| `isMobile` | from `useResponsive()` — `width < 768` (`BREAKPOINTS.tablet`) | 55 |

**Critical finding — there is NO global header and NO global footer.** `AppLayout` mounts only
the mobile bottom nav, a mobile search sheet, an optional reveals promo, and an optional beta
notice. It does **not** render a `<header>` or `<footer>`. Each *page* hand-rolls its own
`<main>` + (desktop) `<CompactHeader/>`. This is confirmed by grep: the only `<footer` /
`Footer` hit in `apps/web/src` is an inline code comment in `FilterDialog.tsx:199` ("Footer
(modal only...)"), and the only `role="contentinfo"` hits are zero.

### Where a global `<Footer/>` would mount — and why it is NOT trivial

The natural spot is inside `AppContent`'s fragment, **after** the `<Outlet/>` wrapper `<div>`
(so it renders below page content on every route). **But** the current page architecture fights a
global footer:

- **Tool pages pin themselves to the full viewport.** `BrowsePage` desktop `<main>` is
  `height: '100vh'` with internal scroll (`BrowsePage.tsx:264-267`); mobile is
  `height: calc(100dvh - ${MOBILE_NAV_HEIGHT}px)` with `overflow: 'hidden'`
  (`BrowsePage.tsx:246-255`). A footer appended after such a page lands **below the fold** and is
  effectively unreachable (the page already consumes 100vh, and the inner content scrolls, not the
  document).
- **The mobile bottom nav is `position: fixed`** (`MobileBottomNav.tsx:401-411`, `zIndex: 900`,
  height 110). A global footer on mobile non-home routes would render *behind* that fixed nav.
- **Only `HomePage` grows naturally.** Its `<main>` is `minHeight: '100vh'`, `flexDirection:
  'column'` (`HomePage.tsx:11-17`) — a footer appended below `<FeaturedCards>` flows correctly and
  is reachable by scrolling on both desktop and mobile (home hides the bottom nav on mobile —
  `showBottomNav` is false when `isHome`).

**Recommendation (see §6):** do *not* bolt a footer onto `AppLayout` globally in this issue — it
would require reworking the 100vh tool-page shells (regression risk, scope creep). Instead render
the `<Footer/>` on the pages that can host it cleanly: **HomePage** (the universal discovery
surface) and the **four legal pages themselves** (which will use a scrollable content shell).

---

## 2. Desktop header & primary navigation (`CompactHeader.tsx`)

There are two header components in `shared/components`:

| Component | File | Role |
|-----------|------|------|
| `Header` | `Header.tsx` (28 lines) | Legacy/minimal — just an `<h1>{APP_NAME}</h1>` gradient bar. Exported (`index.ts:29`) but **not used by any page** (grep of `pages/` shows only `CompactHeader`/`HeroSection`). |
| `CompactHeader` | `CompactHeader.tsx` (506 lines) | **The real header.** Sticky top bar: logo + optional search + centered nav + optional actions. |

### `CompactHeader` is per-page, not global

Pages that render `<CompactHeader/>` (grep, `apps/web/src/pages`):
`BrowsePage`, `PlaystyleGalleryPage`, `PlaystyleDetailPage`, `VotePage`, `RevealsPage`,
`InDepthVotePage`. **`HomePage` does not** — it uses the big `<HeroSection>` logo hero instead
(`HomePage.tsx:44`). Example mount: `BrowsePage.tsx:257` `<CompactHeader onLogoClick={goHome} isMobile />`.

**On mobile, `CompactHeader` renders `null`** (`CompactHeader.tsx:482`: `if (isMobile) return null;`)
— desktop-only. Mobile chrome is the bottom nav + search sheet.

### Desktop nav-link inventory

The centered nav lives in `DesktopNav` (`CompactHeader.tsx:414-459`), sourced from a
module-level array:

```tsx
const NAV_ITEMS: readonly NavItem[] = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/vote', label: 'Vote'},
];
const REVEALS_PATH = '/reveals';
```
(`CompactHeader.tsx:32-38`)

| Element | Path | Component | Notes |
|---------|------|-----------|-------|
| Logo (image `/brand/logo.svg`) | `/` | `HeaderLogo` → `<Link to="/">` | `CompactHeader.tsx:179-219`; `aria-label="Go to home page"` |
| Browse | `/browse` | `NavItemLink` (`<NavLink>`) | pill group |
| Playstyles | `/playstyles` | `NavItemLink` | pill group |
| Vote | `/vote` | `NavItemLink` | pill group |
| Reveals | `/reveals` | `RevealsPill` (`<NavLink>`) | **only during reveal season** (`isRevealSeason`, line 484); has a "NEW" badge |

**Notably absent from the desktop nav: Decks.** `/decks` exists in the router
(`router.tsx:239`) and in the *mobile* bottom nav, but is **not** in the desktop `NAV_ITEMS`. So
the desktop primary nav today is a 3-item set (Browse/Playstyles/Vote) + a seasonal Reveals pill.

### How a nav link is added (desktop)

Append `{path, label}` to `NAV_ITEMS` (`CompactHeader.tsx:32-36`) → it renders as a `NavItemLink`
inside the pill group. This is the mechanism, but **legal pages should NOT be added here** — the
top nav is for primary product destinations, and `DesktopNav` is `position: absolute; left: 50%`
centered (`CompactHeader.tsx:420-428`), a fixed-width pill group with no room for four more items.
Legal links belong in a footer (§6).

---

## 3. Mobile bottom navigation (`MobileBottomNav.tsx`)

`apps/web/src/shared/components/MobileBottomNav.tsx` (443 lines). Exported alongside
`MOBILE_NAV_HEIGHT` (`index.ts:39`).

- **`MOBILE_NAV_HEIGHT = 110`** (`MobileBottomNav.tsx:6`) — the CSS px height; `AppLayout` uses it
  for the outlet's `paddingBottom` and pages subtract it from `100dvh`.
- **Positioning:** `position: 'fixed'; bottom: 0; left/right: 0; height: 110; zIndex: 900`
  (`MobileBottomNav.tsx:401-410`). A curved SVG background (`NavCurveBackground`, lines 200-259)
  gives the arched top edge + sliding gold underline on the active tab.
- **Rendered only when `showBottomNav` = `isMobile && !isHome`** (`AppLayout.tsx:58, 104`).

### Tab sets (5 fixed tabs each; layout hard-codes a 5-slot position table `POS_5`)

Off-season (`MobileBottomNav.tsx:35-41`):

| # | Tab | Path / action |
|---|-----|---------------|
| 1 | Browse collection | `/browse` |
| 2 | Search cards | action: opens `SearchBottomSheet` (button, never "active") |
| 3 | Explore playstyles | `/playstyles` |
| 4 | Rate synergies | `/vote` |
| 5 | Build a deck | `/decks` |

Reveal-season (`MobileBottomNav.tsx:27-33`): Browse, Search, **Reveals** (`/reveals`, `hasNewDot`),
Playstyles, Decks — Vote is swapped out for Reveals.

### Can legal links live in the bottom nav? No.

The bottom nav is a **5-slot, icon-only, curved rail** whose geometry is baked into
`POS_5.paddingTop` / `POS_5.dashOffset` arrays (`MobileBottomNav.tsx:50-53`) and a
`gridTemplateColumns: repeat(${tabs.length}, 1fr)` (line 418). Each tab needs a hand-drawn SVG icon
(`TabIcon`, lines 141-190). Adding four text-only legal links would break the icon-arc math and the
5-column layout, and legal pages are not frequent-use destinations. **Confirmed recommendation:
legal links are footer-only, not bottom-nav.** Mobile users reach them via the HomePage footer
(home has no bottom nav, so there is no fixed-nav collision there).

---

## 4. Should the footer be a shared component? Yes.

`shared/components` holds all reusable UI, each re-exported from a barrel `index.ts`
(`apps/web/src/shared/components/index.ts`, 45 lines). A new footer fits the existing convention:

1. Create `apps/web/src/shared/components/Footer.tsx` exporting `export function Footer(...)`.
2. Add `export {Footer} from './Footer';` to `index.ts` (alphabetical-ish; the barrel is not
   strictly sorted — e.g. `Header` at line 29).
3. **A story is mandatory.** The `check:stories` pre-push gate fails on any new visual component
   without a co-located `*.stories.tsx` (CLAUDE.md "Storybook" section; gate script
   `apps/web/scripts/check-story-coverage.mjs`). So `Footer.stories.tsx` is required. Because the
   footer uses React Router `<Link>`, its story needs a `MemoryRouter` decorator (per
   `.claude/rules/stories.md` — see `MobileBottomNav.stories.tsx:15-21` for the exact pattern).

Existing shared components that render router links and have stories to copy from:
`CompactHeader.stories.tsx`, `MobileBottomNav.stories.tsx`, `BackLink.stories.tsx`.

---

## 5. Existing "beta / about / version / credit" text a footer would consolidate

Grep results for affiliation/branding/attribution text across `apps/web/src`:

| Existing text | Where | Notes |
|---------------|-------|-------|
| `BetaNotice`: "Inkweave is in beta — you may encounter bugs. Thanks for testing!" | `BetaNotice.tsx:43` | Fixed top-left card, **home + desktop only** (`shouldShowBetaNotice`, `AppLayout.tsx:46-51`). Gated by `VITE_SHOW_BETA_NOTICE` and **turned OFF at v1.0.0 launch** (`AppLayout.tsx:21-23`, `BetaNotice.tsx:5-9`). Not a footer candidate — it is temporary. |
| "INKWEAVE" watermark | `NotFoundPage.tsx:167-179` | Decorative `aria-hidden` brand watermark, bottom-center of the 404 page. |
| Hero subtitle: "Select any Lorcana card and instantly discover powerful synergies." | `HeroSection.tsx:172-174` | Product one-liner (useful copy source for the About page). |
| `APP_NAME = 'Inkweave'` | `theme.ts:4` | Brand string constant. |

**There is NO IP / affiliation disclaimer anywhere in the app today.** Grep for
`not affiliated | affiliat | Ravensburger | Disney | disclaimer | © | copyright | All rights`
across `apps/web/src` returns **zero user-facing matches** — the only `Ravensburger` hit is the
image-CDN origin (`loader.ts:38`), and the only `Disney` hit is a code comment about reveal copy
voice (`setSpotlights.ts:25`). The "Inkweave is an unofficial fan project, not affiliated with
Disney/Ravensburger" line does **not exist yet** and must be authored.

**There is NO user-facing GitHub / repo link.** All `github.com` matches are internal API clients
(`shared/lib/githubCommit.ts`, image/reveal/tuning-admin `githubClient.ts`) and test fixtures — none
are rendered as a nav/footer link. If a GitHub/contact link is wanted in the footer, it is net-new.
(The repo is `Doberjohn/inkweave`, seen in test fixtures like
`PendingTray.stories.tsx:63` and CLAUDE.md — treat as an Open Question for confirmation.)

**No version string** is surfaced in the UI (no `import.meta.env` version or `package.json` version
rendered). A footer could add one, but nothing exists to consolidate.

---

## 6. Recommended footer design

### 6.1 What links

A single-row (desktop) / stacked (mobile) footer, dark-fantasy styled:

```
Inkweave · unofficial fan project        Privacy · Terms · IP Disclaimer · About    [· GitHub?]
Inkweave is an unofficial fan project and is not affiliated with, endorsed by, or
sponsored by Disney or Ravensburger. Disney Lorcana and all card names/images are
trademarks of their respective owners.
```

| Link | Route (to be created by Area 1) | Element |
|------|-------------------------------|---------|
| Privacy Policy | `/privacy` (TBD by routing area) | `<Link>` |
| Terms of Use | `/terms` | `<Link>` |
| IP Disclaimer | `/disclaimer` (or `/ip`) | `<Link>` |
| About | `/about` | `<Link>` |
| GitHub / contact | external `https://github.com/Doberjohn/inkweave` | `<a target="_blank" rel="noopener noreferrer">` — **Open Question: confirm the repo is public and this link is wanted** |

Use `<Link>` (react-router) for internal routes and `<a>` for the external GitHub link — matches the
project's Navigation Semantics (CLAUDE.md: `<a>` for external/navigation, `<button>` for actions).
The exact route paths are owned by the routing/Area-1 doc; this doc only asserts they must be
**ungated** (not wrapped in `RevealsGate`/`AdminGate` — see `router.tsx:188-235` for how gates wrap
children; legal pages must be plain `SuspenseWrapper` children like `/browse`).

### 6.2 Placement

1. **HomePage (primary universal surface):** render `<Footer/>` at the bottom of `HomePage`'s
   `<main>`, after `<FeaturedCards>` (`HomePage.tsx:57-62`). Home is `minHeight: 100vh` flex-column,
   scrollable, and hides the mobile bottom nav (`showBottomNav` false when home) — so the footer is
   reachable on **both desktop and mobile** with no fixed-nav collision. This is the single best spot
   and satisfies the issue's "accessible from footer" requirement site-wide via the landing page.
2. **The four legal pages themselves:** each renders `<CompactHeader/>` (desktop) at top and
   `<Footer/>` at bottom inside a **scrollable content shell** (`minHeight: 100vh`, `overflow` not
   hidden — unlike the 100vh tool pages) so the four pages cross-link to each other. There is no
   existing shared "content page shell" component; the legal pages will establish one (coordinate
   with Area 1 / the page-implementation doc).
3. **Do NOT** mount the footer globally in `AppLayout` in this issue (see §1 — the 100vh tool-page
   shells + fixed mobile nav make it land below the fold / behind the nav). If a truly site-wide
   footer is later desired, it is a separate refactor of the tool-page height model.

### 6.3 Responsive behavior

- Desktop: one row — brand/disclaimer left, links right (flex, `justify-content: space-between`),
  small text (`FONT_SIZES.md`/`base` = 12/13px), muted color (`COLORS.textMuted #90a1b9`, WCAG-AA on
  the `#0d0d14` bg), gold hover on links (`COLORS.primary`).
- Mobile: stack vertically, center-aligned; because the footer lives on Home (no bottom nav) there is
  no `MOBILE_NAV_HEIGHT` offset to worry about. If the footer is *also* placed on a page that shows
  the bottom nav, it must sit inside the outlet's `paddingBottom: MOBILE_NAV_HEIGHT` region — but the
  recommendation avoids that case entirely by keeping the footer off the fixed-height tool pages.
- Use `<footer role="contentinfo">` (or a `<footer>` landmark — implicit `contentinfo` when a direct
  child of `<body>`; here it is nested, so add `role="contentinfo"` explicitly) with a single `<nav
  aria-label="Legal and product links">` around the links for a11y (mirrors the `aria-label` nav
  pattern in `CompactHeader.tsx:419` and `MobileBottomNav.tsx:399`).

### 6.4 Where the one-line IP-affiliation disclaimer lives

**Both** places:
- A **short one-liner in the footer** (visible on Home + legal pages), e.g. "Inkweave is an
  unofficial fan project, not affiliated with Disney or Ravensburger." — gives the always-visible
  legal cover the IP-disclaimer requirement expects.
- The **full IP Disclaimer page** (`/disclaimer`) holds the complete trademark/fan-content notice.

This mirrors standard fan-site practice (short notice everywhere + a full dedicated page) and means
the affiliation statement is not buried one click away.

### 6.5 Design tokens to use (all from `shared/constants/theme.ts`)

| Purpose | Token | Value |
|---------|-------|-------|
| Footer bg | `COLORS.surfaceAlt` / `COLORS.background` | `#151525` / `#0d0d14` |
| Top border | `COLORS.surfaceBorder` | `#333355` |
| Body text | `COLORS.textMuted` | `#90a1b9` (AA on dark) |
| Link default | `COLORS.textMuted` → hover `COLORS.primary` | `#90a1b9` → `#ffb900` |
| Brand accent | `COLORS.primary` | `#ffb900` |
| Font | `FONTS.body` | `'Plus Jakarta Sans', ...` |
| Text size | `FONT_SIZES.base` / `.md` | 13 / 12px |
| Padding/gap | `SPACING.lg`/`.xl`/`.md` | 16 / 20 / 12px |
| Radius (if pill/chip) | `RADIUS.md`/`.lg` | 6 / 8px |

---

## Summary of concrete findings

- No global header or footer exists; `AppLayout` mounts only providers + mobile bottom nav + search
  sheet + optional reveals promo + optional beta notice (`AppLayout.tsx:99-113`). Headers are
  per-page (`CompactHeader`), and `CompactHeader` returns `null` on mobile (`CompactHeader.tsx:482`).
- Desktop nav = Browse / Playstyles / Vote (+ seasonal Reveals pill), sourced from `NAV_ITEMS`
  (`CompactHeader.tsx:32-38`). Decks is **not** in the desktop nav. Legal links do not belong here.
- Mobile nav = 5 fixed icon tabs incl. Decks (`MobileBottomNav.tsx:27-41`), `MOBILE_NAV_HEIGHT=110`,
  `position: fixed`. Cannot hold legal links (geometry + icon requirement). Footer-only confirmed.
- The 100vh/`100dvh`-`110` tool-page shells (`BrowsePage.tsx:246-267`) + the fixed mobile nav make a
  global `AppLayout` footer land below the fold / behind the nav → recommend footer on **HomePage +
  the legal pages**, not global.
- No IP/affiliation disclaimer, no user-facing GitHub link, and no version string exist today — all
  net-new. `BetaNotice` is temporary (off at v1.0.0) and not a footer candidate.
- A new `Footer` is a shared component (`shared/components/Footer.tsx` + barrel export +
  **required** `Footer.stories.tsx` with a `MemoryRouter` decorator).

## Open Questions

1. **Route paths** for the four pages (`/privacy`, `/terms`, `/disclaimer` vs `/ip`, `/about`) are
   owned by the routing area — this doc assumes them but does not decide them.
2. **GitHub/contact link:** is a user-facing link to `github.com/Doberjohn/inkweave` wanted in the
   footer, and is the repo public? Not present anywhere in the UI today.
3. **Exact disclaimer wording** (which entities to name — Disney, Ravensburger, "Disney Lorcana"
   trademark) is legal copy that must be authored/approved, not invented here.
4. **Shared content-page shell:** the legal pages need a scrollable page shell (unlike the 100vh
   tool pages). Does Area 1 create one shared shell, or does each legal page hand-roll `<main>` +
   `<CompactHeader>` + `<Footer>`? Recommend one shared shell to avoid four near-duplicate pages.
5. **Footer on tool pages:** confirm the decision to keep the footer OFF Browse/Vote/Playstyle-detail
   (the 100vh pages). If a site-wide footer is required, those shells need a height-model refactor
   (out of this issue's stated scope).
