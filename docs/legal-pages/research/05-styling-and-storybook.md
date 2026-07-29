# Area 5 — Theme, Prose Styling & Storybook (Legal & Product Pages, issue #219)

## Scope

How to render long-form legal/product prose (Privacy, Terms, IP Disclaimer, About) so it looks native to Inkweave's dark-fantasy theme and passes the story-coverage gate. Covers: the exact design tokens in `theme.ts` and how CLAUDE.md's "Design Token Reference" maps onto them; the styling mechanism (inline styles with tokens, no CSS-modules / no markdown renderer); a recommended readable-prose container and heading rhythm; the Storybook conventions and a copy-paste story scaffold; and the WCAG-AA color rules long text must follow. Everything below is evidence-cited to real files. Open design decisions (chiefly: the type scale tops out body text at 13px, small for multi-paragraph reading) are flagged, not guessed.

---

## 1. Design tokens (the source of truth)

All tokens live in **`apps/web/src/shared/constants/theme.ts`** and are re-exported through the barrel **`apps/web/src/shared/constants/index.ts`** (import from `'../shared/constants'`, never deep-import `theme.ts`). Import what you need: `COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, EASING`.

### 1.1 Type scale — `FONT_SIZES` (`theme.ts:80-89`)

```ts
export const FONT_SIZES = {
  xs: 10, sm: 11, md: 12, base: 13, lg: 14, xl: 16, xxl: 20, xxxl: 22,
} as const;
```

CLAUDE.md's "Design Token Reference" locks a smaller subset. Mapping to the real exports:

| CLAUDE.md role | px | `FONT_SIZES` token | Use for legal pages |
|---|---|---|---|
| Display | 20 | `FONT_SIZES.xxl` | Page title (`<h1>`, e.g. "Privacy Policy") |
| Section | 16 | `FONT_SIZES.xl` | Section headings (`<h2>`) |
| Body | 13 | `FONT_SIZES.base` | Default UI text; **too small for long prose, see §7 open question** |
| Form exception | 14 | `FONT_SIZES.lg` | Search inputs only (documented exception) |
| Micro | 10 | `FONT_SIZES.xs` | Metadata ("Last updated ..."), badges |

`sm` (11), `md` (12), `xxxl` (22) exist but the locked scale says "No 11px, 12px, 22px" for new UI. The Typography story explicitly labels `md`/`sm` as legacy-ish ("Compact labels", "Small labels, metadata") and `xxxl` as "Reserved, rarely used" (`apps/web/src/docs/Typography.stories.tsx:128-143`). Prefer `xxl / xl / base / xs` plus the `lg` form exception.

### 1.2 Font families — `FONTS` (`theme.ts:17-20`)

```ts
export const FONTS = {
  body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  hero: "'Tinos', 'Georgia', serif",
} as const;
```

Both are **self-hosted woff2** declared in `apps/web/src/index.css:5-47` (Tinos 400/700; Plus Jakarta Sans 400/500/600/700). `:root` sets `font-family` to the Plus Jakarta stack and `line-height: 1.5` globally (`index.css:55-73`), so body text inherits the right face without a per-element `fontFamily`. In practice every page still sets `fontFamily: FONTS.body` on its root for safety. For legal pages: body copy = `FONTS.body`; the page `<h1>` may use `FONTS.hero` (Tinos serif) to match the hero/404 convention (`NotFoundPage.tsx:84,113` both use `FONTS.hero` for headings), or stay on `FONTS.body` for a plainer document feel. This is a design check-in item.

### 1.3 Text-color palette — `COLORS` (`theme.ts:92-175`)

The locked 4-color text palette maps to these exact exports (all WCAG AA on `#0d0d14`, per `Typography.stories.tsx:147-205`):

| Role | Hex | `COLORS` token | Contrast on `#0d0d14` |
|---|---|---|---|
| Primary text | `#e8e8e8` | `COLORS.text` (also `COLORS.white`, `gray800`) | ~14.9:1 |
| Muted text | `#90a1b9` | `COLORS.textMuted` | ~6.9:1 |
| Gold accent | `#d4af37` | `COLORS.primary500` / `primary600` | ~8.0:1 |
| Gold accent (brighter) | `#ffb900` | `COLORS.primary` | ~10.6:1 |
| Description / educational | `#c8c8d8` | `COLORS.descriptionText` | ~12.4:1 |
| Placeholder / empty-state only | `#aaaaaa` | (no token; literal) | ~9.0:1 |

> **Superseded 2026-07-22 by the one-gold ruling.** This section used to say to
> pick between two golds. There is now exactly ONE: `COLORS.primary` (`#ffb900`).
> `primary500`/`600`/`700` (`#d4af37`, and 500 and 600 are the same hex) are the
> LEGACY accent, grandfathered only — `inkweave/no-legacy-gold` blocks new uses.
> Build glows and rings from `SHADOWS.glowSm/Md/Lg` and `GOLD_GLOW.*`.

Both golds are AA, so the contrast table above stays accurate as a reference. Do not introduce new hex values; the multi-pass audit rule (CLAUDE.md "Color/Contrast") checks every `color:` against this palette.

Recommended legal-prose color assignment:
- `<h1>` page title: `COLORS.text` (`#e8e8e8`).
- `<h2>` section headings: `COLORS.text`.
- Body paragraphs (bulk long-form): `COLORS.descriptionText` (`#c8c8d8`) — it exists precisely for "supplementary/educational content, slightly softer than primary" (`theme.ts:161`), which is exactly what legal copy is. Alternatively `COLORS.text` for maximum crispness.
- Inline links: `COLORS.primary` (`#ffb900`), underlined for affordance.
- Metadata ("Last updated: ...", contact email): `COLORS.textMuted` (`#90a1b9`).

### 1.4 Spacing — `SPACING` (`theme.ts:44-52`)

```ts
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 14 } as const;
```

The locked spacing system (CLAUDE.md "Design Session Workflow > Spacing System") uses these: panel padding `16` (`lg`), text-box padding `12` (`md`), section gaps `20` (`xl`) / `24` (`xxl`). For legal pages: container padding `SPACING.lg`+ on desktop, paragraph vertical rhythm around `SPACING.lg`, heading top-margin `SPACING.xxl`.

### 1.5 Radius & easing (rarely needed for prose)

`RADIUS` (`theme.ts:55-62`): `xs:2, sm:4, md:6, lg:8, card:12, xl:14`. Use `RADIUS.lg` for any callout box (matches BetaNotice). `EASING` (`theme.ts:70-77`): spring `linear()` curves `bounce / snappy / smooth`; only relevant if a legal page has interactive elements (it should not).

### 1.6 Layout constants (`theme.ts:23-36`)

`LAYOUT` has `headerHeight: 56`, `compactHeaderHeight: 52`, etc. There is **no** content-max-width token; pages define their own local const (see §2).

---

## 2. Content container patterns (how existing pages center content)

There is **no shared page-shell / container component**. Every page hand-rolls a `<main>` with an inline `maxWidth + margin: '0 auto'`. Two established shapes:

**A. Simple admin/utility container** (narrow-ish, left-aligned, side-padded):

```tsx
// TuningAdminPage.tsx:14, ImageAdminPage.tsx:13, RevealAdminPage.tsx:18
<main style={{maxWidth: 1000, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
```

Values in the wild: TuningAdmin/RevealAdmin `maxWidth: 1000`, ImageAdmin `900`, DeckViewPage/DecksPage `900` (`DeckViewPage.tsx:16`, `DecksPage.tsx:21`).

**B. Wide centered content column** (RevealsPage, `RevealsPage.tsx:26,142`):

```tsx
const CONTENT_MAX_WIDTH = 1180;               // local const, not a token
...
<div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `0 ${sidePad}px`}}>
```

Both shapes are **too wide for readable prose**. A comfortable line length (measure) is ~60-75 characters. None of the above targets that. The skeleton loader on PlaystyleDetailPage hints at the intended prose measure: its description-line skeleton is capped at `maxWidth: 640` (`PlaystyleDetailPage.tsx:649`), the closest thing to a "reading column" width in the codebase.

### Recommended readable-prose container

```tsx
<main
  style={{
    minHeight: '100vh',
    background: COLORS.background,            // #0d0d14 (also set globally on body)
    fontFamily: FONTS.body,
  }}>
  <CompactHeader isMobile={isMobile} />        {/* desktop nav; renders null on mobile — see §6 */}
  <article
    style={{
      maxWidth: 680,                            // ~68-72ch at 14-15px; between the 640 skeleton and admin 900
      margin: '0 auto',
      padding: `${SPACING.xxl}px ${SPACING.lg}px 64px`,
      color: COLORS.descriptionText,           // #c8c8d8 body
      lineHeight: 1.7,                          // looser than the global 1.5 for long reading
    }}>
    <h1 style={{fontSize: FONT_SIZES.xxl, fontFamily: FONTS.hero, color: COLORS.text, margin: 0}}>
      Privacy Policy
    </h1>
    <p style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, margin: `${SPACING.sm}px 0 ${SPACING.xxl}px`}}>
      Last updated: 9 July 2026
    </p>
    <h2 style={{fontSize: FONT_SIZES.xl, color: COLORS.text, margin: `${SPACING.xxl}px 0 ${SPACING.md}px`}}>
      What we collect
    </h2>
    <p style={{margin: `0 0 ${SPACING.lg}px`}}>Body copy ...</p>
  </article>
</main>
```

Heading rhythm: `<h2>` top margin `SPACING.xxl` (24) to separate sections, bottom margin `SPACING.md` (12) to bind to its paragraph; paragraphs `0 0 SPACING.lg` (16) so the last line of a section does not crowd the next heading. `line-height: 1.7` on the container beats the global `1.5` for multi-paragraph comfort (the global `1.5` is fine for chips/labels, loose-ish for body prose).

---

## 3. Styling mechanism (confirmed: inline styles + tokens; no CSS modules; no markdown)

**Inline `style={{...}}` objects fed by imported tokens is the universal convention.** Verified across every page and component read (`NotFoundPage.tsx`, `BetaNotice.tsx`, `PlaystyleDetailPage.tsx`, `CompactHeader.tsx`, all admin pages). Evidence and constraints:

| Question | Finding | Evidence |
|---|---|---|
| CSS Modules? | **None.** No `*.module.css` anywhere. | (no glob matches) |
| styled-components / Emotion? | **None** in `package.json` deps. | `apps/web/package.json:27-39` |
| Global CSS? | One file, `index.css` — fonts, reset, scrollbars, focus ring, keyframe animations, mobile rules. Not for per-component prose. | `apps/web/src/index.css` |
| Radix typography/prose primitive? | **No.** Only `@radix-ui/react-dialog` is installed (used for modals/drawers). No Text/Heading primitive. | `package.json:28` |
| Markdown renderer (react-markdown / MDX / remark / rehype)? | **Not a dependency.** Only a transitive match in `pnpm-lock.yaml`; nothing in `package.json`. | grep: only `pnpm-lock.yaml` hit; `package.json` has none |
| `dangerouslySetInnerHTML`? | Not used for content (grep found no app-source usage). | grep |

**Consequence for authoring legal copy:** there is no markdown pipeline. Copy must be authored as **JSX** (or a typed content array rendered to JSX). Two viable approaches, both convention-compliant:

1. **Plain JSX per page** (simplest, matches every existing page): each page file (`PrivacyPolicyPage.tsx`, etc.) hand-writes its `<h2>`/`<p>` tree inside the recommended `<article>` container. Duplicated container styling across 4 pages.
2. **Shared `<ProsePage>` / `<LegalPage>` layout + typed content** (recommended, DRY): one shared component in `apps/web/src/shared/components/` owns the `<article>` container, heading/paragraph styling, and the `CompactHeader`. Each page passes `title`, `lastUpdated`, and a `sections: {heading: string; body: ReactNode}[]` array (or children). This centralizes the token usage so a future tweak (e.g. the §7 body-size decision) is one edit. **Caveat:** a shared component in `shared/components/` is story-gate-required (see §5.2); a page in `pages/` is not.

CSS class hooks (`.subtle-scrollbar`, `.touch-target`, focus ring) live in `index.css`; reuse `.touch-target` (`index.css:438-441`, `min 44px`) on any tap target and let the global `:focus-visible` gold outline (`index.css:154-158`) handle keyboard focus. No new global CSS should be needed for prose.

---

## 4. Storybook: config, conventions, and what a page story needs

### 4.1 Global config (`apps/web/.storybook/preview.tsx`)

Every story is auto-wrapped in a dark full-bleed frame and dark docs theme:

```tsx
decorators: [(Story) => (
  <div style={{background: '#0d0d14', minHeight: '100vh', padding: 0}}><Story /></div>
)],
parameters: { layout: 'fullscreen', docs: {theme: themes.dark}, controls: {...} },
```

So you do **not** need to add a dark background yourself. `layout: 'fullscreen'` is already the global default; page stories restate it for clarity.

### 4.2 Import + shape rules (`.claude/rules/stories.md`, auto-loaded when editing `*.stories.tsx`)

- Import `Meta` / `StoryObj` from **`@storybook/react-vite`** (NOT `@storybook/react` — Storybook 10 lint rule flags it). Confirmed in every story file.
- Story sits **next to** the component: `PrivacyPolicyPage.stories.tsx` beside `PrivacyPolicyPage.tsx`.
- **React Router components need a `MemoryRouter` decorator.** Legal pages will use `<Link>`/`CompactHeader` (which uses `<Link>`/`<NavLink>`), so this is required. Pattern from `NotFoundPage.stories.tsx:10-16` and `CompactHeader.stories.tsx:11-17`.
- Components using `useCardPreview` or rendering `SearchAutocomplete` need a `CardPreviewProvider` decorator. **Legal pages need neither** (static text). If a legal page mounts `CompactHeader` **without** search props, no card-preview/autocomplete provider is needed — `CompactHeader.stories.tsx` mounts it with only `MemoryRouter` and it renders fine, because `useRevealPhase()` has a safe default (no provider required).
- Mock data uses the real `LorcanaCard` shape (`textSections: string[]`) — not relevant to static legal pages.

### 4.3 Title / category naming (observed)

| Category prefix | Used by | Example |
|---|---|---|
| `Pages/` | page-level components | `title: 'Pages/NotFoundPage'` (`NotFoundPage.stories.tsx:6`), `'Pages/AdminAnalyticsPage'` |
| `Components/` | shared components | `'Components/CompactHeader'` (`CompactHeader.stories.tsx:7`) |
| `Shared/` | some shared components (inconsistent w/ `Components/`) | `'Shared/BetaNotice'` (`BetaNotice.stories.tsx:5`) |
| `Design System/` | token docs | `'Design System/Typography'` (`Typography.stories.tsx:213`), `.../Colors`, `.../Spacing & Layout` |

Recommendation: title the four legal page stories `Pages/PrivacyPolicyPage`, `Pages/TermsOfUsePage`, `Pages/IpDisclaimerPage`, `Pages/AboutPage`. If a shared `<ProsePage>`/`<Footer>` is created, title it `Components/ProsePage` / `Components/Footer` (prefer `Components/` over `Shared/`; both exist, `Components/` is the newer convention).

### 4.4 Copy-paste story scaffold (per legal page)

```tsx
// apps/web/src/pages/PrivacyPolicyPage.stories.tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {PrivacyPolicyPage} from './PrivacyPolicyPage';

const meta: Meta<typeof PrivacyPolicyPage> = {
  title: 'Pages/PrivacyPolicyPage',
  component: PrivacyPolicyPage,
  parameters: {layout: 'fullscreen'},   // dark bg comes from preview.tsx global decorator
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/privacy']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

If the page reads `useResponsive()` to switch mobile/desktop layout, add a `Mobile` story that sets the viewport (or, like `CompactHeader.stories.tsx:39`, pass an `isMobile` arg if the page accepts one). Otherwise a single `Default` story satisfies coverage.

---

## 5. The `check:stories` gate — exact scope (important nuance)

`pnpm check:stories` runs **`apps/web/scripts/check-story-coverage.mjs`** (first pre-push step, ~130ms). CLAUDE.md says "every new visual component needs a `.stories.tsx`". The script is narrower than that sentence:

### 5.1 What the gate actually scans (`check-story-coverage.mjs:58-69`)

```js
function getComponentDirs() {
  const dirs = [join(srcDir, 'shared', 'components')];      // shared/components
  ... for (feature of features) dirs.push(features/<f>/components);  // features/*/components
  return dirs;
}
```

It scans **only** `src/shared/components/` and `src/features/*/components/`. It does **NOT** scan `src/pages/`. Therefore:

| Where the code lives | Story required by the gate? |
|---|---|
| `apps/web/src/pages/PrivacyPolicyPage.tsx` (a page) | **No** — `pages/` is outside the scanned dirs |
| `apps/web/src/shared/components/ProsePage.tsx` (shared layout) | **Yes** — `shared/components/` is scanned |
| `apps/web/src/shared/components/Footer.tsx` (new footer) | **Yes** — must ship `Footer.stories.tsx` |

So a **Footer** and any shared **ProsePage/LegalPage** layout each need their own `.stories.tsx` or the gate fails; the four page files technically do not. Convention (CLAUDE.md "Every new visual component needs a `.stories.tsx`" and "Story-writing mechanics ... auto-loaded") still argues for adding page stories, and existing pages (`NotFoundPage`, `AdminAnalyticsPage`, `HomePageSkeleton`) all have them. Recommendation: add stories for all four legal pages **and** any shared prose/footer component — cheap, and it keeps the pages visually reviewable in Storybook.

### 5.2 Escape hatches (if you deliberately skip a story)

The script has two allow-lists (`check-story-coverage.mjs:18-39`): `EXCLUDED` (icons, context providers, ErrorBoundary) and `KNOWN_MISSING` (pre-existing debt). A new shared component with no story must be added to one of these or given a story; do not add legal-page components to `KNOWN_MISSING` (they are new, not legacy debt).

---

## 6. Header / footer / nav integration (styling-adjacent notes)

- **There is no footer component in the app today** (confirmed: no `Footer*` files; `AppLayout.tsx` mounts only `MobileBottomNav` + Vercel `Analytics`/`SpeedInsights`). Issue #219 wants legal links reachable from a footer/nav — that footer must be **built** (Area 1/4 territory; flagged here because a `Footer.tsx` in `shared/components/` triggers the story gate, §5.1).
- **Top nav for the pages:** `CompactHeader` (`apps/web/src/shared/components/CompactHeader.tsx`) is the shared desktop header. It **returns `null` on mobile** (`CompactHeader.tsx:482`) — mobile chrome is `MobileBottomNav` + `SearchBottomSheet` from `AppLayout`. Its nav items are a hardcoded `NAV_ITEMS` list (`CompactHeader.tsx:32-36`: Browse / Playstyles / Vote); it has no "legal" slot. A legal page can mount `CompactHeader` for a consistent desktop top bar without any provider beyond `MemoryRouter` (see §4.2).
- **MobileBottomNav** menu items live in `MobileBottomNav.tsx` (`{kind, label, href}` arrays at lines 28-40); legal links would be added there or in a new footer, not styled inline per page.
- Navigation semantics from CLAUDE.md "Design Session Workflow": logo → `<a>`/`<Link>` to home (no arrow), back-nav → `<a>` with explicit text, breadcrumbs → `<nav>`. Footer legal links should be `<a>`/`<Link>` (navigation, not `<button>`).

---

## 7. Accessibility & contrast rules for long text

From CLAUDE.md ("Design Session Workflow > Multi-Pass Audit > Color/Contrast, Accessibility, Typography") and the real code:

- **WCAG AA on dark bg (>=4.5:1).** Only the 4-color palette (§1.3) is sanctioned; all four clear AA on `#0d0d14`. Do not add off-palette greys for body text.
- **One `<h1>` per page**, then `<h2>` for sections (nest `<h3>` only if a section needs sub-parts). CLAUDE.md heading hierarchy: `<h1>` = page identity, `<h2>` = major sections.
- **Landmarks:** wrap page content in `<main>` (every page does). Use `<article>` for the document body, `<nav>` for breadcrumbs/footer link lists.
- **Visually-hidden headings** when a visible title is stylized: reuse the `srOnly` pattern from `RevealsPage.tsx:38-48`:
  ```ts
  const srOnly: React.CSSProperties = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
  };
  ```
  Legal pages have a real visible `<h1>`, so this is only needed if the title is an image/decorative.
- **Focus:** global `:focus-visible { outline: 2px solid #d4af37; outline-offset: 2px }` (`index.css:154-158`) covers links/buttons automatically. Do not remove outlines.
- **Mobile input zoom guard:** `index.css:429-434` forces `font-size: 16px` on inputs/selects/textareas under 768px. Legal pages have no forms, so N/A, but relevant if an "email us" input is ever added.
- **Reduced motion:** legal pages should have no animation; nothing to guard. (The app's animations are all opt-in via classes with `prefers-reduced-motion` overrides in `index.css:297-329,393-401`.)

### Open typography decision (flag for the user / implementer)

The locked type scale caps **body text at `base` = 13px** ("Most UI text"), with the only larger allowances being `lg` = 14px (documented "search inputs only" exception) and `xl` = 16px (section headings). 13px is comfortable for chips and card metadata but **small for multi-paragraph legal reading**. Three options, in order of my recommendation:

1. **Introduce a documented "reading prose" exception at ~15px** (analogous to the existing 14px form exception), scoped to legal/product pages, recorded in `theme.ts` and the Typography story. Pair with `line-height: 1.6-1.7`. Best readability; requires a token/doc addition the user should approve.
2. **Use `FONT_SIZES.lg` (14px)** for legal body — reuses an existing token, minor scale bend, no new token.
3. **Stay at `FONT_SIZES.base` (13px)** for strict scale fidelity — safest for the audit gate, least comfortable for reading.

Because CLAUDE.md forbids silently deviating from the locked scale ("Font sizes follow type scale exactly (no custom sizes)"), this must be an explicit design decision, not an implementer guess.

---

## 8. Quick-reference checklist for the implementer

- [ ] Import tokens from `'../shared/constants'` (barrel), not `theme.ts` directly.
- [ ] Container: `<article maxWidth ~680, margin '0 auto', padding SPACING.xxl/lg, lineHeight 1.6-1.7>`.
- [ ] Colors: body `COLORS.descriptionText` (#c8c8d8) or `COLORS.text`; headings `COLORS.text`; links `COLORS.primary` (#ffb900); meta `COLORS.textMuted`.
- [ ] Fonts: `FONTS.body` for copy; `FONTS.hero` optional for `<h1>`.
- [ ] Sizes: h1 `FONT_SIZES.xxl` (20), h2 `FONT_SIZES.xl` (16), body per §7 decision, meta `FONT_SIZES.xs` (10). No 11/12/22px.
- [ ] One `<h1>`, `<h2>` sections, wrapped in `<main>` + `<article>`.
- [ ] Author copy as JSX (no markdown pipeline exists).
- [ ] Story per page: `@storybook/react-vite`, `title: 'Pages/...'`, `MemoryRouter` decorator, `layout: 'fullscreen'`, `tags: ['autodocs']`, one `Default` story.
- [ ] Any new **shared** component (`ProsePage`, `Footer`) in `shared/components/` MUST ship a co-located `.stories.tsx` (story gate). Page files in `pages/` are gate-exempt but should get stories by convention.
- [ ] Run `pnpm check:stories` before pushing.
