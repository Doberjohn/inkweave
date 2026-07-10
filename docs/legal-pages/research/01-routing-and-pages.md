# Legal & Product Pages — Research 01: Routing & Page-Component Architecture

**Scope:** How to add four static content routes (Privacy, Terms, IP Disclaimer, About) to the Inkweave web app (issue #219). This doc is the concrete recipe for wiring new pages into `router.tsx`, the page-component conventions a new page must follow (export shape, theme tokens, layout wrapper), how page titles/meta are handled app-wide, and the correct URL scheme. Read-only research; no code was changed. Every claim is anchored to `apps/web/src/...` with line numbers.

---

## 1. Router structure (`apps/web/src/router.tsx`)

The app uses **react-router-dom `^7.18.0`** (`apps/web/package.json`) with a single `createBrowserRouter` data router. React is `^19.2.7`.

### 1.1 The `lazyWithRetry` helper (lines 12–30)

Every page is code-split via a local helper that wraps `React.lazy` with a retry-then-hard-reload fallback for stale-chunk recovery after a deploy:

```tsx
function lazyWithRetry(
  importFn: () => Promise<{[key: string]: React.ComponentType}>,
  exportName: string,
  retries = 2,
) {
  return lazy(() => {
    const load = (attempt: number): Promise<{default: React.ComponentType}> =>
      importFn()
        .then((m) => ({default: m[exportName]}))   // picks the NAMED export
        .catch((err) => {
          if (attempt < retries) return load(attempt + 1);
          reloadForStaleChunk();                    // loop-guarded hard reload
          throw err;
        });
    return load(0);
  });
}
```

Key detail: **the second argument is the named export string.** `m[exportName]` is re-wrapped as `{default: ...}`, so page modules export a **named** component (not a default). Example declaration (line 50):

```tsx
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');
```

The `importFn` signature is typed as returning `{[key: string]: React.ComponentType}` — i.e. a component **with no required props** (the type is bare `React.ComponentType`). New legal pages must therefore be zero-prop components. (This also matches the known pre-push gotcha: "router.tsx lazy routes export only zero-prop components".)

### 1.2 `GenericFallback` and `SuspenseWrapper` (lines 69–103)

- `GenericFallback` (lines 69–99): a 3-line skeleton on a full-height (`minHeight: '100vh'`) `COLORS.background` backdrop, `aria-busy` + `aria-label="Loading page"`. Used by every route except `/` (home uses `HomePageSkeleton`).
- `SuspenseWrapper` (lines 101–103): `<Suspense fallback={fallback ?? <GenericFallback />}>`. Every lazy page is wrapped in one.

```tsx
function SuspenseWrapper({children, fallback}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  return <Suspense fallback={fallback ?? <GenericFallback />}>{children}</Suspense>;
}
```

Legal pages should use the **default** `GenericFallback` (omit the `fallback` prop), matching every non-home route.

### 1.3 Route-object shape and nesting under `AppLayout` (lines 105–298)

There is exactly **one** top-level route: `path: '/'` whose `element` is `<AppLayout />`, with all real pages as **`children`** (line 109). `AppLayout` renders `<Outlet />` (see `AppLayout.tsx:102`), so every child route renders inside the layout shell (providers, mobile nav, analytics).

A standard ungated child route looks like this (the Browse route, lines 118–125):

```tsx
{
  path: 'browse',
  element: (
    <SuspenseWrapper>
      <BrowsePage />
    </SuspenseWrapper>
  ),
},
```

Note child paths are **relative** (no leading slash): `'browse'`, `'card/:cardId'`, `'admin/reveal'`, etc.

### 1.4 Gated vs ungated routes

Two gate wrappers exist and wrap the `SuspenseWrapper`:
- `RevealsGate` — `/reveals` (lines 188–196), imported from `./features/reveals` (router.tsx:6).
- `AdminGate` — `/admin/analytics` (lines 227–235), imported from `./features/admin-analytics/AdminGate` (router.tsx:5).

**Legal pages must NOT be gated** — follow the plain Browse pattern (§1.3), no gate wrapper.

### 1.5 The catch-all `*` route and ordering (lines 288–295)

```tsx
{
  path: '*',
  element: (
    <SuspenseWrapper>
      <NotFoundPage />
    </SuspenseWrapper>
  ),
},
```

It is the **last** entry in the `children` array (by convention).

**Ordering rule — important nuance for RR v7:** React Router v6/v7 does **not** match by array order. `createBrowserRouter` internally ranks routes by specificity (`matchRoutes`), and a splat `*` scores lowest, so a concrete static path like `privacy` always beats `*` **regardless of where it sits in the array**. So functionally you *could* insert new routes anywhere. **But the codebase convention is to keep `*` last and add new routes above it** — follow that convention for readability. Add the four legal routes immediately before the `*` entry (e.g. after `auth/callback` at line 287).

### 1.6 Redirects (for reference)

Two redirect patterns exist if a legacy alias is ever needed (lines 158–162, 221–225):

```tsx
{path: 'playstyles/vinelings', element: <Navigate to="/playstyles/floodborn" replace />},
{path: 'reveal-admin', element: <Navigate to="/admin/reveal" replace />},
```

`Navigate` is imported from `react-router-dom` (router.tsx:2). Not needed for a fresh set of legal pages, but available.

---

## 2. Page-component conventions

Representative pages read: `NotFoundPage.tsx` (closest analog — pure static, no data), `RevealsPage.tsx`, `HomePage.tsx`, `ComparePage.tsx`.

### 2.1 Export shape

| Page | Export style | Evidence |
|------|-------------|----------|
| `NotFoundPage` | **named only** (`export function NotFoundPage()`) | `NotFoundPage.tsx:5` |
| `HomePage` | **named only** (`export function HomePage()`) | `HomePage.tsx:19` |
| `RevealsPage` | **named only** (`export function RevealsPage()`) | `RevealsPage.tsx:100` |
| `ComparePage` | named **plus** a redundant `export default ComparePage` | `ComparePage.tsx:27,63` |

**Recipe:** export a **named** function component matching the `exportName` passed to `lazyWithRetry`. A `default` export is optional and unused by the router (`lazyWithRetry` reads the named export). Follow `NotFoundPage`/`HomePage` — named export only. The component takes **no props**.

### 2.2 Top-level wrapper structure

Every page renders its own `<main>` as the outermost element (the layout shell does **not** provide one — `AppLayout` only wraps `<Outlet />` in a padding `<div>`, `AppLayout.tsx:101`). Patterns:

- `NotFoundPage.tsx:9` — `<main style={{minHeight: '100vh', display:'flex', ...}}>`
- `HomePage.tsx:40` — `<main style={{...mainStyle, ...}}>` where `mainStyle` has `minHeight:'100vh'` (lines 11–17).
- `RevealsPage.tsx:140` — `<main style={{minHeight:'100vh', ...}}>` wrapped in `<ErrorBoundary>` + `<EtherealBackground />` + `<CompactHeader />` (lines 137–139).

**Every page sets `minHeight: '100vh'` on its `<main>`.** Content pages that need a top navigation bar render `<CompactHeader isMobile={isMobile} />` themselves (RevealsPage does; NotFoundPage/HomePage do not — home is the landing hero, 404 is chrome-less). For legal pages, rendering `CompactHeader` gives users the standard nav + logo-home affordance; decide per design (see §6 open questions).

### 2.3 Readable-content width / container pattern

There is **no shared page container component.** Content-width is done inline per page with a `maxWidth` constant + `margin: '0 auto'`:

- `RevealsPage.tsx:26` — `const CONTENT_MAX_WIDTH = 1180;` then `RevealsPage.tsx:142`:
  ```tsx
  <div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `0 ${sidePad}px`}}>
  ```
  where `sidePad = isMobile ? SPACING.lg : 36` (line 133).
- `LAYOUT` (theme.ts:23–36) has layout constants but **no `contentMaxWidth` / prose-width token** — legal pages will need to define their own readable measure (a legal/prose page typically wants ~680–760px, narrower than the 1180 used for card grids). Define a local `const` in the page, matching the `CONTENT_MAX_WIDTH` idiom.

### 2.4 Theme-token usage

Tokens are imported from `../shared/constants` (barrel at `apps/web/src/shared/constants/index.ts`) — never hardcoded hex where a token exists. Confirmed imports in pages:

- `NotFoundPage.tsx:2` — `import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';`
- `RevealsPage.tsx:4` — `import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';`

Relevant tokens (from `apps/web/src/shared/constants/theme.ts`):

| Token | Value | Use |
|-------|-------|-----|
| `COLORS.background` | `#0d0d14` | page bg (theme.ts:94) |
| `COLORS.surface` | `#1a1a2e` | card/surface (theme.ts:95) |
| `COLORS.text` | `#e8e8e8` | primary text (theme.ts:106) |
| `COLORS.textMuted` | `#90a1b9` | secondary/muted (theme.ts:107) |
| `COLORS.descriptionText` | `#c8c8d8` | body/prose copy (theme.ts:161) |
| `COLORS.primary` / `primary500` | `#ffb900` / `#d4af37` | gold accents/links (theme.ts:101,133) |
| `COLORS.surfaceBorder` | `#333355` | dividers/borders (theme.ts:98) |
| `FONTS.body` | Plus Jakarta Sans stack | body text (theme.ts:18) |
| `FONTS.hero` | Tinos/Georgia serif | headings (theme.ts:19) |
| `FONT_SIZES` | `xs:10 sm:11 md:12 base:13 lg:14 xl:16 xxl:20 xxxl:22` | type scale (theme.ts:80–89) |
| `SPACING` | `xs:4 sm:8 md:12 lg:16 xl:20 xxl:24 section:14` | spacing (theme.ts:44–52) |
| `RADIUS` | `xs:2 sm:4 md:6 lg:8 card:12 xl:14` | radii (theme.ts:55–62) |

Note the type scale is small (base body = 13px, largest = 22px). The **design-token reference in `CLAUDE.md`** ("Design Session Workflow") locks prose to: Display 20 / Section 16 / Body 13 / Micro 10, with `#e8e8e8` primary, `#90a1b9` muted, `#c8c8d8` description text, gold accents. Legal-page copy should use `FONT_SIZES.base` (13) body with `COLORS.descriptionText`, `FONT_SIZES.xxl` (20) for the page `<h1>`, `FONT_SIZES.xl` (16) for section `<h2>`.

### 2.5 Accessibility conventions observed

- Exactly **one `<h1>` per page** (`NotFoundPage.tsx:81`; RevealsPage uses a visually-hidden `<h1>` via an `srOnly` style, `RevealsPage.tsx:38–48,141`).
- Decorative elements get `aria-hidden="true"` (NotFoundPage glows/sparkles, lines 22,39,100).
- Error/status regions use `role="alert"` (RevealsPage.tsx:77; AppLayout.tsx:78).
- `<main>` landmark wraps page content (all pages).

### 2.6 Reusable building blocks available (no need to reinvent)

From `apps/web/src/shared/components/`:
- `CtaButton` (`CtaButton.tsx`, used `NotFoundPage.tsx:146`) — gold primary button.
- `BackLink` (`BackLink.tsx`) — styled "← label" back button (`onClick`, `label` props). Uses `COLORS.primary500` hover, `FONTS.body`, `FONT_SIZES.base`.
- `CompactHeader` (`CompactHeader.tsx`) — the desktop top nav/header (renders `null` on mobile, line 482). Optional `showBackArrow`, `searchQuery`, `headerActions` props.
- `EtherealBackground` (`EtherealBackground.tsx`) — the ambient glow backdrop (used on Home/Reveals).
- `ErrorBoundary` (`ErrorBoundary.tsx`).

---

## 3. Page title / meta / SEO handling (app-wide)

**There is no per-page title/meta mechanism in the SPA.** Findings:

- **No `react-helmet`, `react-helmet-async`, or any head/meta/SEO library** is a dependency (verified: `apps/web/package.json` has no package matching `helmet|head|meta|seo|title`).
- **No `useDocumentTitle` hook** and **no `document.title = ...` assignments** anywhere in `apps/web/src` (grep for `document.title|useDocumentTitle|helmet|<title` returns only: `index.html`, `public/404.html`, and unrelated `public/mockups/*` weekly-report HTML).
- The **only** title source is the static tag in `apps/web/index.html:12`:
  ```html
  <title>Inkweave — Master Lorcana Synergies</title>
  ```
  plus full OG/Twitter/canonical/JSON-LD meta in the same `<head>` (index.html:13–72). These are global and never change per route.
- `public/404.html:7` has its own `<title>404 — Inkweave</title>` + `<meta name="robots" content="noindex">` — but that is the **static server 404 shell**, separate from the in-app React `NotFoundPage`.

**Implication for legal pages:** as things stand, all four pages will show the global `<title>` "Inkweave — Master Lorcana Synergies" and share the site's OG/canonical meta. If per-page titles are desired (recommended for legal/SEO — e.g. "Privacy Policy — Inkweave"), that requires **new** infrastructure that does not exist today. Two low-cost options (flagged as a decision, not a given — see §6):
1. A tiny `useDocumentTitle(title)` hook (`useEffect(() => { document.title = title; return () => { document.title = DEFAULT; }; }, [title])`) called at the top of each legal page. No new dependency.
2. Adopt React Router v7's built-in route `handle` + a `meta`/title effect in `AppLayout` reading `useMatches()`. More plumbing; only worth it if title-per-route becomes a broader need.

Either is out of the minimal scope; the pages will work and render correctly without a title change, they will just share the default document title. **Do not invent claims about existing SEO plumbing — there is none beyond static `index.html`.**

---

## 4. URL scheme

### 4.1 Existing path conventions (from router.tsx §1.5 grep)

| Existing path | Style |
|---------------|-------|
| `browse`, `playstyles`, `vote`, `reveals`, `decks` | single lowercase word |
| `card/:cardId`, `compare/:idA/:idB`, `vote/:a/:b` | word + params |
| `admin/reveal`, `admin/image`, `admin/tuning`, `admin/analytics` | slash-namespaced group |
| `auth/callback` | slash-namespaced group |
| `reveal-admin` (redirect), `playstyles/vinelings` (redirect) | kebab-case appears only in legacy redirects |

**Dominant convention: single lowercase word, no leading slash in the route object.** Kebab-case exists but only in legacy redirect aliases. Multi-word groups use a `namespace/child` slash form.

### 4.2 Recommended paths for the four pages

| Page | Recommended path | Rationale |
|------|-----------------|-----------|
| Privacy Policy | `privacy` | single word, matches `browse`/`vote` |
| Terms of Use | `terms` | single word |
| IP Disclaimer | `disclaimer` | single word, unambiguous (`ip` is cryptic) |
| About / Who We Are | `about` | single word, universal convention |

These are single lowercase words, consistent with the established scheme. Avoid a `legal/` namespace unless the team wants them grouped (the app only namespaces `admin/*` and `auth/*`, which are functional groupings, not content groupings) — flag as a minor decision (§6).

---

## 5. Copy-pasteable "add a route" checklist

For each new page (example uses **Privacy**):

**1. Create the page component** at `apps/web/src/pages/PrivacyPage.tsx` with a **named** export and a props-free signature:

```tsx
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
// optional: import {CompactHeader} from '../shared/components'; useResponsive from '../shared/hooks';

const CONTENT_MAX_WIDTH = 720; // prose measure; narrower than the 1180 card-grid width

export function PrivacyPage() {
  return (
    <main style={{minHeight: '100vh', fontFamily: FONTS.body, color: COLORS.text}}>
      <div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `${SPACING.xxl}px ${SPACING.lg}px`}}>
        <h1 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text}}>Privacy Policy</h1>
        {/* body copy in COLORS.descriptionText at FONT_SIZES.base */}
      </div>
    </main>
  );
}
```

**2. Create the co-located story** `apps/web/src/pages/PrivacyPage.stories.tsx` (the `check:stories` pre-push gate **fails the build if a new visual component has no story** — see `CLAUDE.md` + `.claude/rules/stories.md`). Copy the `NotFoundPage.stories.tsx` shape (it is the closest analog):

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';   // NOT '@storybook/react'
import {MemoryRouter} from 'react-router-dom';                 // needed if the page uses router hooks/links
import {PrivacyPage} from './PrivacyPage';

const meta: Meta<typeof PrivacyPage> = {
  title: 'Pages/PrivacyPage',
  component: PrivacyPage,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [(Story) => (<MemoryRouter><Story /></MemoryRouter>)],
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
```
(The `MemoryRouter` decorator is only required if the page renders `Link`/`NavLink`/router hooks — e.g. if it uses `CompactHeader` or `BackLink`-with-navigate. A purely static page with no router usage can drop the decorator, but including it is harmless.)

**3. Add the lazy import** in `apps/web/src/router.tsx` alongside the other `lazyWithRetry` declarations (near lines 33–66):

```tsx
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');
```

**4. Register the route** inside the `children` array, **before** the `*` catch-all (before line 288). Ungated, `SuspenseWrapper` with the default fallback:

```tsx
{
  path: 'privacy',
  element: (
    <SuspenseWrapper>
      <PrivacyPage />
    </SuspenseWrapper>
  ),
},
```

**5. Repeat** for `terms` → `TermsPage`, `disclaimer` → `DisclaimerPage`, `about` → `AboutPage`.

**6. Wire discovery links** — issue #219 requires the pages be "Accessible from footer or navigation". There is **no footer component today** (verified: no site `<footer>` in `apps/web/src`; the only "footer" matches are a `DeckPanel` doc comment and a modal footer in `FilterDialog`). This is a separate build item (a new `SiteFooter` shared component mounted in `AppLayout`, and/or entries in `CompactHeader`'s `NAV_ITEMS` / `MobileBottomNav` tabs). Covered in a separate research area — **do not silently skip it**; the routes alone don't satisfy the "accessible from footer/nav" acceptance criterion.

---

## 6. Open questions / decisions to surface

1. **Per-page `<title>`**: none exists app-wide (§3). Ship with the shared default title, or add a `useDocumentTitle` hook / RR `handle`-based title? Recommended: a small `useDocumentTitle` hook, but confirm scope — it is net-new infra not currently present.
2. **Footer**: no footer component exists (§5 step 6). Legal pages need a discovery surface; building `SiteFooter` + mounting it in `AppLayout` is required to meet issue #219's "accessible from footer or navigation" checkbox. Confirm whether that lands in this issue or a follow-up.
3. **URL naming**: `disclaimer` vs `ip` for the IP Disclaimer; flat single-words vs a `legal/*` namespace. Recommendation: flat single-words (`privacy`, `terms`, `disclaimer`, `about`) per §4.
4. **`CompactHeader` on legal pages?** Content pages that want the top nav render `<CompactHeader />` themselves (RevealsPage does; Home/404 don't). Decide whether legal pages show the header (recommended, for the logo-home + nav affordance) or are chrome-less like the 404.
5. **Issue #219 "Files" section is stale**: it names `apps/web/src/App.tsx` for route registration, but **that file does not exist** — the app migrated to `apps/web/src/router.tsx` (the data router in §1). All route wiring goes in `router.tsx`. Note this in the implementation PR so the discrepancy is on record.
6. **Prose width token**: `LAYOUT` (theme.ts:23–36) has no readable-measure / prose-width constant. Each page defines a local `CONTENT_MAX_WIDTH` (~680–760px). Consider adding a shared `LAYOUT.proseMaxWidth` if all four pages should match — minor.
7. **Privacy Policy factual content** must be built from verified data-handling facts (Supabase votes, IP hashing, Vercel Analytics, Sentry EU region per issue #219) — not guessed. That is a content-research area separate from this routing doc.
