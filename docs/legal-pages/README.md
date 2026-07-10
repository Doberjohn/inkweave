# Issue #219 — Legal & Product Pages: Research & Implementation Plan

**Status:** Research complete (read-only session, 2026-07-09). No code changed.
**Issue:** [#219 "Legal & Product Pages"](https://github.com/Doberjohn/inkweave/issues/219) (label `feature`, no milestone).
**Goal:** ship four static content pages before public launch: Privacy Policy, Terms of Use, IP Disclaimer, About/Who-We-Are. Wire them into routing, make them reachable from a footer/nav, style them to the theme, keep them accessible and static.

This file is the synthesis. The evidence lives in six area docs under [`research/`](research/):

| Doc | Area | What it answers |
|-----|------|-----------------|
| [`01-routing-and-pages.md`](research/01-routing-and-pages.md) | Routing & page components | Exact recipe to add the 4 routes to `router.tsx`; page conventions; title/meta reality; URL scheme |
| [`02-navigation-and-footer.md`](research/02-navigation-and-footer.md) | Navigation & footer | Where links get surfaced; the missing-footer problem; nav inventory |
| [`03-data-collection-privacy-facts.md`](research/03-data-collection-privacy-facts.md) | Data-collection audit | Every byte the app collects, with file:line evidence (the Privacy Policy's factual basis) |
| [`04-third-party-services-gdpr.md`](research/04-third-party-services-gdpr.md) | Services, regions, GDPR, IP facts | Subprocessor inventory, CSP host list, EU regions, IP-disclaimer facts |
| [`05-styling-and-storybook.md`](research/05-styling-and-storybook.md) | Prose styling & Storybook | Theme tokens for long-form text; the story-coverage gate |
| [`06-about-content-a11y-testing.md`](research/06-about-content-a11y-testing.md) | About facts, a11y, testing | Real About content; accessibility gates; E2E/unit/story requirements |
| [`07-community-code-and-footer.md`](research/07-community-code-and-footer.md) | Community Code & footer | Ravensburger's Community Code as the legal basis; standardized disclaimer; duels.ink footer pattern |

---

## 1. Executive summary (what actually matters)

Issue #219 looks like a low-effort "add four text pages" task, and the *routing* half is. The research surfaced five things that make it more than a copy-paste job:

1. **The issue's `Files` section is stale.** It names `apps/web/src/App.tsx` for route registration. That file does not exist: the app migrated to a `createBrowserRouter` data router in `apps/web/src/router.tsx`. All route wiring goes there. (Docs 01 §6, 04 §6, 06.)

2. **There is no footer, and no global header.** The "accessible from footer or navigation" acceptance criterion has zero existing surface to hook into. A `Footer` is entirely net-new, and where it mounts is non-trivial because the tool pages pin themselves to `height:100vh` (a globally-mounted footer lands below the fold or behind the fixed mobile nav). (Doc 02.)

3. **The hard part is the Privacy Policy, not the UI.** Writing a *truthful* policy requires the data-collection audit in doc 03/04. The single most consequential finding: the voter IP is hashed with a **static (non-rotating) salt**, which makes `votes.ip_hash` a stable pseudonymous identifier (source-verified, see §5). That is likely "personal data" under GDPR and shapes the whole policy.

4. **Cloud deck storage is NOT live.** OAuth sign-in code exists (Google/Discord), but decks are localStorage-only and there is no `decks` table (source-verified). The policy must describe the current state, not the auth code's intent. (Docs 03, 04 §3b.)

5. **Several product facts the About/legal pages need are missing or contradictory:** no LICENSE file despite README saying "MIT"; version says `0.1.0` in code but `v1.0.0` in docs; no contact email exists; Sentry's region is not in the repo. These are user decisions, not things to invent. (Docs 04, 06.)

**Bottom line:** the code scaffolding is ~1 day. The blockers are content decisions and legal-copy approval (§7), which the user must resolve before the Privacy/Terms/Disclaimer/About text can be finalized.

---

## 2. The four pages and recommended routes

Routes are single lowercase words, matching the dominant convention (`browse`, `vote`, `playstyles`). Avoid a `legal/*` namespace (the app only namespaces functional groups like `admin/*`). All four are **ungated** children of `<AppLayout/>`, added before the `*` catch-all in `router.tsx`.

| Page | Route | Component file | Notes |
|------|-------|----------------|-------|
| Privacy Policy | `/privacy` | `apps/web/src/pages/PrivacyPage.tsx` | Content gated on the §5 audit + legal review |
| Terms of Use | `/terms` | `apps/web/src/pages/TermsPage.tsx` | Acceptable-use + warranty disclaimer |
| IP Disclaimer | `/disclaimer` | `apps/web/src/pages/DisclaimerPage.tsx` | `disclaimer` reads clearer than `ip`; also surface a one-line version in the footer |
| About | `/about` | `apps/web/src/pages/AboutPage.tsx` | Mission + creator + contact (contact is TBD) |

---

## 3. Implementation plan (build sequence)

Ordered so each step compiles on its own. File paths are exact.

### Step A — Shared building blocks (net-new, in `apps/web/src/shared/components/`)
- **`Footer.tsx`** (new shared component). Links: Privacy, Terms, Disclaimer, About, plus the one-line IP-affiliation disclaimer, and optionally a GitHub/contact link (decision, §7). Uses tokens from `shared/constants/theme.ts`. Re-export from the `shared/components/index.ts` barrel.
  - **Requires `Footer.stories.tsx`** with a `MemoryRouter` decorator (it renders router `Link`s). The `check:stories` pre-push gate scans `shared/components` and `features/*/components`, so a shared component with no story fails the build. (Docs 02, 05, 06.)
- **Optional `ProsePage.tsx` / `LegalPageLayout.tsx`** (a shared readable-content shell). Recommended to avoid four near-duplicate page wrappers. If placed in `shared/components/`, it also needs its own story. Decision in §7.
- **Optional `useDocumentTitle(title)` hook** (`shared/hooks/`). There is no per-page `<title>` mechanism today (doc 01 §3): all pages show the static `index.html` title. For SEO on legal pages, a tiny `useEffect`-based hook is the low-cost option. Net-new infra, so flag it. Decision in §7.

### Step B — The four page components (`apps/web/src/pages/`)
Each is a **named-export, zero-prop** function component (the router's `lazyWithRetry` reads the named export, and lazy routes must be prop-free). Template (doc 01 §5):
```tsx
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';

const CONTENT_MAX_WIDTH = 720; // prose measure, narrower than the 1180 card-grid width

export function PrivacyPage() {
  return (
    <main style={{minHeight: '100vh', fontFamily: FONTS.body, color: COLORS.text}}>
      <div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `${SPACING.xxl}px ${SPACING.lg}px`}}>
        <h1 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text}}>Privacy Policy</h1>
        {/* body copy in COLORS.descriptionText at the chosen reading size */}
      </div>
    </main>
  );
}
```
- Copy is authored as **JSX** (no markdown renderer is installed, doc 05). A typed content array fed to a shared `ProsePage` is the DRY alternative.
- Exactly one `<h1>` per page, wrapped in `<main>`. Decorative elements get `aria-hidden`. (Docs 01 §2.5, 06.)
- Body reading size is an open decision (the locked scale caps body at 13px, small for legal reading; see §7).

### Step C — Router wiring (`apps/web/src/router.tsx`)
For each page, add a `lazyWithRetry` declaration near lines 33-66:
```tsx
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');
```
and a route object inside `children`, **before** the `*` catch-all (before line 288), ungated, default `SuspenseWrapper`:
```tsx
{ path: 'privacy', element: (<SuspenseWrapper><PrivacyPage /></SuspenseWrapper>) },
```
(RR v7 ranks by specificity so array order is not functionally load-bearing, but keep `*` last by convention. Doc 01 §1.5.)

### Step D — Discovery surface (the "accessible from footer/nav" criterion)
Do **not** mount the footer globally in `AppLayout` (it collides with the `height:100vh` tool pages). Recommended (doc 02):
- Render `<Footer/>` on the four legal pages (they are scrollable content shells).
- Render `<Footer/>` on `HomePage` (below `FeaturedCards`); HomePage already grows naturally and hides the mobile bottom nav.
- Leave the fixed `MobileBottomNav` unchanged (its 5 icon slots are geometry-baked and cannot hold text links).
- A truly site-wide footer would require refactoring the 100vh tool-page height model, which is out of #219 scope. Confirm in §7.

### Step E — Stories, tests, docs (the gates)
- **Stories:** `Footer.stories.tsx` (mandatory). Page stories (`PrivacyPage.stories.tsx`, etc.) are convention, not gate-enforced (the gate skips `pages/`), but `NotFoundPage.stories.tsx` is the template and the project ships stories for pages anyway. Use `@storybook/react-vite`, `layout:'fullscreen'`, `tags:['autodocs']`, `title:'Pages/...'`. (Docs 05, 06.)
- **E2E:** add a smoke spec (navigate to each route, assert the `<h1>` and `<main>`), covered by the axe-core a11y audit in `apps/web/e2e/tests/accessibility.spec.ts`. **Update `apps/web/e2e/E2E_TESTS.md`** (currently "107 tests across 17 spec files"). Runs on 5 browsers. (Doc 06.)
- **Unit:** optional per-page tests in `pages/__tests__/`, style per `.claude/rules/tests.md` (5-15 focused tests). Template: `HomePage.test.tsx`.
- **a11y:** WCAG AA palette only; `eslint-plugin-jsx-a11y` runs in pre-commit; axe-core runs in E2E.

---

## 4. Content the pages must state (grounded in the audit)

### 4.1 Privacy Policy — verified data inventory
Every row is source-anchored in docs 03/04. "PII?" is a factual read, not legal advice.

| Data | Purpose | Stored where / region | PII? | Evidence |
|------|---------|----------------------|------|----------|
| Salted IP hash (`votes.ip_hash`) | Rate-limit voting (200 pairs/IP/day) | Supabase Postgres, eu-central-1 (Frankfurt) | Pseudonymous (stable, static salt) | `supabase/migrations/20260330000000_initial_schema.sql:14,29`; `..._0005:34` |
| Vote payloads (card ids, scores, accuracy, etc.) | Community synergy scores | Supabase, EU. Read via aggregate `pair_scores` view | No user link | `database.types.ts:17-58`; `..._votes_table.sql` |
| OAuth identity (email, provider id, tokens) | Deck sign-in (Google/Discord) | Supabase `auth.users`, EU | Yes (signed-in users only) | `shared/contexts/SessionContext.tsx:51-58`; `shared/lib/supabase.ts:29-39` |
| Product analytics events (card ids/enums, search query string) | Usage analytics | Vercel Web Analytics, cookieless, no account id | Search text is free-form | `shared/lib/analytics.ts:11-64`; `AppLayout.tsx:126` |
| Core Web Vitals | Performance monitoring | Vercel Speed Insights, cookieless | No | `AppLayout.tsx:127` |
| Error diagnostics (stack, URL, UA, breadcrumbs) | Prod error monitoring | Sentry, region unverified (§7) | May incidentally capture IP; no `setUser`, no `beforeSend` scrub | `main.tsx:24-55` |
| localStorage keys (`inkweave:deck:draft`, `inkweave:vote:*`, `inkweave:voted-pairs`, `inkweave-recent-searches`, `inkweave:auth`, admin PAT) | Device-local app state | Browser only, never transmitted (except auth session used against Supabase) | Auth session is sensitive | doc 03 §"Eight browser-storage keys" |

Facts to state plainly: **no cookies are set** (localStorage + cookieless analytics); **no `decks` table exists** (cloud sync deferred to #464), so no deck content is server-side today; **fonts and card images are self-hosted** in production (no Google Fonts / no Ravensburger runtime fetch); network egress is bounded by the CSP `connect-src` (self, `api.github.com` admin-only, `*.supabase.co`, `*.sentry.io`, two Vercel analytics hosts).

### 4.2 IP Disclaimer — use Ravensburger's Community Code notice (see doc 07)
Fan Lorcana projects operate under **Ravensburger's Community Code Policy**, not generic fair use (this corrects doc 04 §5). The Code provides a standardized attribution notice that fan sites (duels.ink, Lorcana Player, Mushu Report) display near-verbatim. Proposed Inkweave wording (confirm current text against the [Community Code PDF](https://cdn.ravensburger.com/lorcana/community-code-en) before publishing):
> Inkweave uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under Ravensburger's Community Code Policy. We are expressly prohibited from charging you to use or access this content. Inkweave is not published, endorsed, or specifically approved by Disney or Ravensburger. For more information about Disney Lorcana TCG, visit disneylorcana.com.

- Show this notice in the **footer sitewide** (the duels.ink pattern) AND on the dedicated `/disclaimer` page.
- Card **images** come from Ravensburger; card **data** from LorcanaJSON (`lorcanajson.org`, build-time only). These are supporting lines on the page.
- The issue body's strings ("not affiliated with, endorsed by, or sponsored by ...") are compatible supporting copy, but the Community Code wording is the primary notice. (Doc 07.)

### 4.3 About — facts found vs. decisions needed
- Found in repo: name "Inkweave", tagline "Master Lorcana Synergies", live at inkweave.ink, repo `Doberjohn/inkweave`, card data from LorcanaJSON, images from Ravensburger.
- Needs a decision (do not invent): version (code `0.1.0` vs docs `v1.0.0`), open-source status (README says MIT but no LICENSE file and packages are `private:true`), contact mechanism (issue marks TBD; only a personal Gmail is known), how to credit the creator. (Doc 06.)

### 4.4 Terms of Use — the non-commercial constraint
The Community Code's "expressly prohibited from charging" clause is a real term: Inkweave must keep the card content free to access. The Terms should state this, and it constrains any future monetization of the card content (a premium tier over Lorcana content would violate the Code; verify donations/ads against the Code before relying on them). (Doc 07 §3.)

---

## 5. Source-verified high-stakes facts

These two were independently corroborated by two agents and then re-checked at the source by the controller:

1. **Static IP-hash salt.** `internal.hash_client_ip()` computes `sha256(client_ip || salt)` where `salt` is seeded once via `gen_random_bytes(32)` at migration time (`20260330000000_initial_schema.sql:14,29`), and a later migration explicitly renamed the key `daily_salt` -> `static_salt` to correct the misleading name (`20260330000005_fix_review_findings.sql:34-35`). The salt does not rotate, so the same IP always yields the same hash: a stable pseudonymous identifier.
2. **No cloud deck storage.** The generated `database.types.ts` public schema contains exactly one table (`votes`) and the `pair_scores` view. No `decks`/`deck_cards`. Confirmed by grep (zero hits) and by reading the schema.

---

## 6. Gotchas and discrepancies for the implementer

- **Stale `App.tsx` reference** in the issue: use `router.tsx`. Note this in the PR.
- **No per-page `<title>`/meta infra** exists (no react-helmet, no `useDocumentTitle`). Legal pages will inherit the global title unless a small hook is added.
- **No markdown renderer** installed: author copy as JSX (or a typed content array), not `.md`.
- **Body font is 13px** (the locked type scale). That is small for long legal reading; pick a reading size deliberately (§7).
- **Footer vs 100vh tool pages:** a global footer breaks on Browse/Vote/Playstyle-detail. Use per-page + HomePage placement.
- **`check:stories` gate** enforces stories for `shared/components` and `features/*/components` only, not `pages/`. So a shared `Footer`/`ProsePage` must have a story; the four page files technically need not (but convention says add them).
- **Sentry has no PII scrubbing** (`beforeSend` absent, no `setUser`), and its region is env-only, not in the repo. The transfers section of the policy depends on resolving this.
- **License / version / contact are unresolved** (§4.3). Blocks the About page's factual claims.

---

## 7. Decisions needed from the user (blockers)

Grouped and de-duplicated across all six docs. These gate finalizing the pages.

**Legal copy (must be authored/approved, not invented):**
1. Privacy Policy final text, once the data facts in §4.1 are confirmed. Key legal calls: is the static-salt IP hash treated as personal data with an erasure path? Is any consent/cookie banner needed given no cookies but localStorage + IP-hash + analytics? What is the vote-data retention period (none exists today)?
2. IP Disclaimer: largely resolved. Use the standardized Community Code notice (doc 07 §2, drafted in §4.2). Remaining calls: confirm the current required wording against the source PDF, and confirm footer-sitewide prominence.
3. Terms of Use scope (acceptable use of voting, warranty disclaimer, content guidelines) AND the mandatory non-commercial / free-access clause from the Community Code (doc 07 §3).

**Product facts:**
4. Contact mechanism for the About page and data-subject requests (dedicated email/form vs personal Gmail). None exists in the repo.
5. Version string to display (`0.1.0` vs `v1.0.0`).
6. Open-source status: add a real LICENSE file (README claims MIT) or drop the open-source claim? Packages are `private:true`.
7. Creator credit (real name / "Doberjohn" / "the Inkweave team").
8. Sentry region (EU/DE vs US) and whether `sendDefaultPii` is left at default: needed for the transfers section. Check the live `VITE_SENTRY_DSN`.

**Design / architecture:**
9. Footer scope: per-page + HomePage (recommended, in-scope) vs a site-wide footer that would need a tool-page height refactor (out of scope).
10. Should legal pages render `CompactHeader` (nav + logo-home) or be chrome-less like the 404?
11. Shared `ProsePage` layout + typed content vs four hand-rolled page wrappers.
12. Add a `useDocumentTitle` hook for per-page `<title>` (better SEO) or ship with the shared default title?
13. Body reading size for prose: add a documented ~15px reading exception to the type scale, reuse 14px form size, or stay at 13px?
14. Route naming: confirm `privacy` / `terms` / `disclaimer` / `about` (flat single words).
15. Whether a user-facing GitHub/contact link belongs in the footer, and whether the repo is public.

**Cross-issue timing:**
16. If cloud deck sync (#464) ships before public launch, the Privacy Policy must additionally cover per-user deck content in Supabase. Confirm which state is live at launch.

---

## 8. Gate checklist (per new component/page)

- [ ] Named-export, zero-prop component (page) / named export re-exported from barrel (shared).
- [ ] `Footer.stories.tsx` and any shared-component story (mandatory for `shared/components`).
- [ ] Page stories by convention (`NotFoundPage.stories.tsx` template).
- [ ] Exactly one `<h1>`, wrapped in `<main>`, WCAG AA colors, decorative elements `aria-hidden`.
- [ ] Route added to `router.tsx` (ungated, before `*`).
- [ ] E2E smoke + a11y (axe) pass on 5 browsers; `E2E_TESTS.md` updated.
- [ ] Optional unit tests per `.claude/rules/tests.md`.
- [ ] PR notes the stale-`App.tsx` discrepancy.
