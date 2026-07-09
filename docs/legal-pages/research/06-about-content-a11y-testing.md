# Area 6 — About-Page Facts, Attribution Text, Accessibility & Testing Conventions

## Scope

Research for GitHub issue **#219 "Legal & Product Pages"** (state OPEN, label `feature`, milestone **null** — it is NOT part of the Deck Builder milestone #3). This doc gathers the raw, sourced content for the **About/Who-We-Are** and **IP Disclaimer** pages, plus every **accessibility** and **testing** gate a new static route must clear. It is read-only research: every fact below is cited to a repo file with line numbers, and anything not found in the repo is flagged as an **open question / needs-user-decision** rather than invented. A Privacy Policy or About page built on guessed facts is a legal liability, so the "found vs. TBD" split is kept strict.

---

## 1. About-Page Facts (sourced)

### 1a. Found in repo — safe to state

| Fact | Value | Source |
|---|---|---|
| Project name | **Inkweave** | `README.md:1`; `apps/web/src/shared/constants/theme.ts:4` (`APP_NAME = 'Inkweave'`) |
| Tagline (title) | "Inkweave — Master Lorcana Synergies" | `apps/web/index.html:12` |
| One-line description | "A synergy finder for Disney Lorcana TCG focused on Core format. Select any card to discover what synergizes with it through pattern-based rules and archetype detection." | `README.md:5` |
| Meta description | "Discover powerful card synergies for Disney Lorcana. Inkweave analyzes every card interaction to help you build stronger decks in Core format." | `apps/web/index.html:13-15`, repeated in OG/Twitter/JSON-LD (`index.html:31-46,62-72`) |
| Live URL | **https://www.inkweave.ink/** (canonical `https://inkweave.ink`) | `README.md:7`; `apps/web/index.html:26,34` |
| Repo (public) | **Doberjohn/inkweave** on GitHub | `README.md:3` (CI badge URL `github.com/Doberjohn/inkweave`); git remote `git@github-personal:Doberjohn/inkweave.git` |
| Format scope | Core format only (sets 5+; currently sets **9–13** live post-rotation per MEMORY) | `README.md:15`; CLAUDE.md "Current State" |
| Feature list | Card Browser, Synergy Detection, Playstyle Archetypes, Synergy Scoring (1–10), Deep Linking, PWA, Responsive | `README.md:9-18` |
| Tech stack | React 19 + TypeScript, React Router v7, Vite + Vitest + Playwright, Radix UI Primitives, inline CSS design tokens; pnpm monorepo | `README.md:56-64` |
| Data source (cards) | **LorcanaJSON** (https://lorcanajson.org/) | `README.md:122`; type names `LorcanaJSONCard` used throughout `apps/web/src/features/cards/loader.ts` |
| Card images source | Ravensburger API (`api.lorcana.ravensburger.com`), self-hosted + content-addressed in prod | `vercel.json:10`; CLAUDE.md "Card images" section |
| Third-party services (for Privacy cross-ref) | Vercel Analytics + Speed Insights (`AppLayout.tsx:126-127`), Sentry (`@sentry/react`), Supabase (`@supabase/supabase-js`) | `apps/web/package.json:29-32,46` |

### 1b. Version — CONFLICTING sources (needs a decision)

| Source | Version |
|---|---|
| Root `package.json:3` | `"version": "0.1.0"` |
| `apps/web/package.json:4` | `"version": "0.1.0"` |
| CLAUDE.md "MVP Status" | "Currently implementing **v1.0.0**" |
| MEMORY / AppLayout beta flag | `SHOW_BETA_NOTICE` gated "off at **v1.0.0** launch" (`AppLayout.tsx:21-23`) |

The code says `0.1.0`; the docs/launch narrative say `v1.0.0`. **Open question:** which version string should the About page display? Do not hardcode a version that contradicts `package.json`.

### 1c. Creator info — needs "what is public?" confirmation

| Item | Value in repo | Caution |
|---|---|---|
| Git author name | `johnn` (`git config user.name`) | Handle, not necessarily a display name |
| Git author email | `johnfanidis@gmail.com` (`git config user.email`; also in session context `userEmail`) | **Personal email — confirm before publishing.** The issue explicitly lists contact as "email or form — TBD". |
| GitHub org/user | **Doberjohn** (public repo owner) | Public already (repo is public) |

**Needs-user-decision:** display name to credit, whether to expose the personal Gmail publicly vs. a dedicated contact address/form, and how to word "creator" (solo dev? handle "Doberjohn"?). The issue leaves the contact mechanism deliberately **TBD** ("Contact information (email or form — TBD)").

### 1d. Open-source status — README claims MIT, but NO LICENSE file exists

- `README.md:124-126` states: **`## License` → `MIT`**.
- **There is NO `LICENSE`/`LICENSE.md` file tracked in the repo.** `git ls-files | grep -i license` returns nothing; root dir listing shows no LICENSE.
- Both `package.json` files are `"private": true` with **no `"license"` field** (root `package.json:4`, `apps/web/package.json:4`).

So the repo is a **public GitHub repo whose README says MIT but ships no license text and marks the packages private**. This is contradictory. **Open question / needs-decision:** Is Inkweave actually MIT-licensed (if so, add a `LICENSE` file), or is the README line stale? The About page's "Open source acknowledgment (if applicable)" (issue wording) must not overstate this — recommend saying "source available on GitHub" only after the license question is resolved.

### 1e. Contact mechanism — none exists today

- No mailto, contact form, or social links found anywhere in `apps/web/src`. The only outward links are the live site, the LorcanaJSON site, and the GitHub repo (README). **TBD per the issue.**

---

## 2. Existing Attribution / Disclaimer / Copyright Text

### 2a. Headline finding: there is NO affiliation/disclaimer/copyright text in the app UI today

A repo-wide search (`affiliated|unofficial|disclaimer|copyright|trademark|all rights|fan-made|fan project`) across `apps/web/src/**` returned **zero UI copy** — only the TypeScript type name `LorcanaJSONCard` / `LorcanaJSONData` and test identifiers (`apps/web/src/features/cards/loader.ts`, `reveal-admin/*`). There is:

- **No `<footer>` anywhere.** Grep for `<footer` / `role="contentinfo"` across all `.tsx` returns nothing. The app has headers and navs but no footer component to hang a disclaimer/legal links on — one must be created.
- **No `©` / "rights reserved" / "not affiliated" string** in any app-facing file. The only `Ravensburger`/`Disney` mentions are (a) the card-image API host in `vercel.json:10` and card-data URLs in `public/data/allCards.json`, and (b) the README link to `disneylorcana.com` (`README.md:5`) and CLAUDE.md prose. None is user-visible disclaimer copy.

**Implication:** the IP Disclaimer page is greenfield — nothing to consolidate, everything to author.

### 2b. Canonical disclaimer wording — provided verbatim in issue #219

The issue body already specifies the exact IP-disclaimer strings to use (source of truth for this page):

> - "Inkweave is not affiliated with, endorsed by, or sponsored by Disney, Ravensburger, or Lorcana."
> - "Card images and game content are property of their respective owners."
> - Fan project / fair use statement

And notes: *"IP Disclaimer (could be footer text + dedicated page)"* — i.e., the short form belongs in the new footer, the full form on a dedicated page.

### 2c. Attribution the IP/About page SHOULD include (sourced from repo)

| Attribution | Because |
|---|---|
| Card data © LorcanaJSON (lorcanajson.org) | `README.md:122` — data is sourced from there |
| Card images © Ravensburger / Disney | `vercel.json:10` image host; issue wording "property of their respective owners" |
| "Disney Lorcana TCG" is a trademark of Disney / Ravensburger | Standard fan-site practice; the game is linked as `disneylorcana.com` in `README.md:5` |

---

## 3. Accessibility Conventions a New Page Must Satisfy

### 3a. Rules from CLAUDE.md (Multi-Pass Audit + Cross-Page Checklist)

| Rule | Requirement |
|---|---|
| Exactly one `<h1>` per page | `<h1>` = page identity |
| Heading hierarchy | `h1 > h2 > h3`, no skips; `<h2>` = major sections, `<h3>` = sub-groups |
| `<main>` landmark | wraps page content (every page does this — see 3b) |
| Semantic landmarks | `<header>`, `<nav>`, `<footer>` used semantically; `<nav>` needs an `aria-label` |
| Link vs button | `<a>`/`NavLink` for navigation, `<button>` for actions — "No misleading affordances" |
| WCAG AA contrast | every text `color:` ≥ 4.5:1 on dark bg; use the 4-color palette (`#e8e8e8` primary, `#90a1b9` muted, `#d4af37`/`#ffb900` gold, `#c8c8d8` description) |
| Logo semantics | logo "INKWEAVE" is an `<a>`/`NavLink` to home with `aria-label="Go to home page"` (`CompactHeader.tsx:187-189`) |
| Type scale (mockups) | 20 / 16 / 13 / 10 px + 14px forms; "Hierarchy via weight/case/color, NOT pixel nudges" |

> **Token caveat:** the mockup type-scale in CLAUDE.md says "no 11px, 12px, 22px", but `theme.ts` `FONT_SIZES` still exports `sm:11, md:12, xxxl:22` (`theme.ts:80-89`). Existing pages mix these. For a new page, prefer the documented scale (`xs:10, base:13, xl:16, xxl:20`, `lg:14` for forms) to stay AA-clean and consistent.

### 3b. How existing pages implement `<main>` / `<h1>` (patterns to copy)

- **Every routed page renders its own `<main>`** — there is no shared `<main>` in `AppLayout`. Confirmed across 18 pages (`grep '<main'`): `NotFoundPage.tsx:9`, `HomePage.tsx:40`, `BrowsePage.tsx:67`, `PlaystyleGalleryPage.tsx:89`, `RevealsPage.tsx:140`, admin pages, etc. **A new legal page must render its own `<main>`** (mirroring `NotFoundPage`, the closest static-page analog).
- **`NotFoundPage.tsx` is the ideal template**: a purely static page with a single `<h1>` (the "404", `NotFoundPage.tsx:81-96`), an `<h2>` subtitle (`:110`), body `<p>`s, decorative elements marked `aria-hidden="true"` (`:22,39,100,169`), and a `<CtaButton onClick={() => navigate('/')}>` for the action. It has a story but **no unit test**.
- **`AppLayout.tsx`** mounts providers + `<Outlet/>` + `MobileBottomNav` + Vercel `<Analytics/>`/`<SpeedInsights/>` (`AppLayout.tsx:99-130`). It renders **no header and no footer** — chrome is per-page (`CompactHeader`) or mobile-only (`MobileBottomNav`). This is where a **global `<footer>` would most naturally be added** (inside `AppContent`'s fragment, after `<Outlet/>`), so legal links appear on every route.

### 3c. Automated a11y enforcement (two gates)

1. **axe-core E2E audit** — `apps/web/e2e/tests/accessibility.spec.ts` runs `AxeBuilder(...).analyze()` and asserts `results.violations` is empty for `/`, `/browse`, `/card/1939`, `/playstyles`, `/playstyles/discard` (desktop only; mobile skipped via `startsWith('mobile-')`). **A new legal page should be added here** as another `test('X page should have no axe violations', ...)` following the same shape (`.exclude('[data-react-grab]')`, `waitForSelector('h1')`).
2. **ESLint `jsx-a11y`** — `eslint-plugin-jsx-a11y ^6.10.2` is a devDependency (`apps/web/package.json:65`); lint runs in the pre-commit hook. Storybook `@storybook/addon-a11y` (`:48`) and `vitest-axe` (`:81`) give component-level a11y too.

### 3d. Reveals-page landmark gotcha (from MEMORY / E2E_TESTS.md)

`reveals-page.spec.ts` asserts a **screen-reader-only `<h1>`** (`E2E_TESTS.md:210`, "sr-only `h1`"). MEMORY `[reference_preview_tool_reveals_limitation]` warns the headless preview tool can't render `/reveals` (ResizeObserver never fires). Relevance to legal pages: if a page hides its `<h1>` visually (e.g., a logo-as-heading), keep it in the DOM as `sr-only` so both axe and the "exactly one h1" convention pass. For a plain legal page a **visible `<h1>` is simpler and preferred** — no sr-only trick needed.

---

## 4. Testing Conventions for a New Route/Page

### 4a. E2E (Playwright)

- **Inventory doc is authoritative and MUST be updated:** `apps/web/e2e/E2E_TESTS.md` — "Keep this file updated whenever E2E tests are added, removed, or edited" (`:1-3`). It currently reports **107 tests across 17 spec files**; adding a legal-page spec means bumping the count and adding a section.
- **Spec location:** `apps/web/e2e/tests/*.spec.ts`. Import the shared harness: `import {test, expect} from '../fixtures';` (see `playstyle-pages.spec.ts:1`), NOT the raw `@playwright/test` (the fixture adds the console-error guard).
- **Browser matrix:** 5 projects — `chromium`, `firefox`, `webkit` (desktop), `mobile-chrome`, `mobile-safari` (`E2E_TESTS.md:5`). Desktop-only specs self-skip mobile with `if (testInfo.project.name.startsWith('mobile-')) test.skip();` (`accessibility.spec.ts:7-11`, `playstyle-pages.spec.ts:5-8`).
- **Console-error guard is global:** `e2e/fixtures/test-fixtures.ts:59-75` overrides the `page` fixture to fail any test that logs a `console.error` or throws, except the documented `BENIGN_CONSOLE` allowlist (`:28-55`). A new static page should produce zero console errors — a clean win.
- **Smoke-test shape for a static route** (model on `playstyle-pages.spec.ts` + `accessibility.spec.ts`):
  ```ts
  import {test, expect} from '../fixtures';
  import AxeBuilder from '@axe-core/playwright';

  test.describe('Legal pages', () => {
    test('privacy page renders and has one h1', async ({page}) => {
      await page.goto('/privacy');
      await expect(page.getByRole('heading', {level: 1})).toBeVisible({timeout: 10000});
      await expect(page.getByRole('main')).toBeVisible();
    });
    test('privacy page has no axe violations', async ({page}) => {
      await page.goto('/privacy');
      await page.waitForSelector('h1');
      const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
      expect(results.violations).toEqual([]);
    });
  });
  ```
  Assert on **route + `<h1>` + `<main>` landmark + footer link navigates** (use `getByRole('link', {name: /privacy/i})` from the footer, click, `toHaveURL('/privacy')`), not on exact prose (prose will churn).
- **Pre-push gate:** husky pre-push runs `check:stories` + E2E on chromium + webkit + mobile-chrome (CLAUDE.md hooks table). Keep port 5173 free (MEMORY `[reference_pre_push_e2e_server_reuse]`).

### 4b. Unit tests (Vitest + Testing Library)

- **Style rule** (`.claude/rules/tests.md`, auto-loaded for `*.test.ts(x)`): focused & minimal, **one behavior per test, 5–15 tests per unit**, skip trivial edge cases, readability over coverage %.
- **Location:** `apps/web/src/pages/__tests__/` (existing: `HomePage.test.tsx`, `ComparePage.test.tsx`). Note **most pages have NO unit test** — `NotFoundPage` (the static analog) has only a story, no test. So a page unit test is **encouraged but not gate-enforced**.
- **Template** (`HomePage.test.tsx`): wrap render in `<MemoryRouter>`, mock `useNavigate` via `vi.mock('react-router-dom', ...)`, mock heavy child components/contexts, then assert with `screen.getBy*`. For a static page you'd typically want ~3–5 tests:
  1. renders the `<h1>` / page heading (`screen.getByRole('heading', {level: 1})`),
  2. renders key section headings (`<h2>`s present),
  3. renders the expected static links (e.g., a mailto or GitHub link, or a "back to home" CTA), and
  4. the home CTA calls `navigate('/')` (mirroring `HomePage.test.tsx:71-91`).

### 4c. Storybook story coverage (`check:stories`)

- **The gate does NOT scan `pages/`.** `apps/web/scripts/check-story-coverage.mjs:58-69` (`getComponentDirs`) only walks `src/shared/components` and `src/features/*/components`. A new file under `src/pages/` **will not fail `check:stories`** even without a story. This contradicts CLAUDE.md's blanket claim that "every new visual component needs a `.stories.tsx`… the gate fails if a new component is added without stories" — literally true only for shared/feature components, not pages.
- **But convention still says add one.** Static pages that DO ship stories: `NotFoundPage.stories.tsx`, `AdminAnalyticsPage.stories.tsx`, `HomePageSkeleton.stories.tsx`. **Recommendation: add a story per legal page** to match `NotFoundPage`.
- **Story template** (`NotFoundPage.stories.tsx`, and `.claude/rules/stories.md`):
  ```tsx
  import type {Meta, StoryObj} from '@storybook/react-vite'; // NOT '@storybook/react'
  import {MemoryRouter} from 'react-router-dom';
  import {PrivacyPage} from './PrivacyPage';

  const meta: Meta<typeof PrivacyPage> = {
    title: 'Pages/PrivacyPage',
    component: PrivacyPage,
    parameters: {layout: 'fullscreen'},
    tags: ['autodocs'],
    decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  };
  export default meta;
  export const Default: StoryObj<typeof meta> = {};
  ```
  React Router pages need the `MemoryRouter` decorator (rules.md). **If a NEW shared/feature component is created for the footer** (e.g., `src/shared/components/SiteFooter.tsx`), that one **WILL** trip `check:stories` and MUST get a `SiteFooter.stories.tsx` (or be added to `EXCLUDED`/`KNOWN_MISSING`).

---

## 5. Implementer Checklist (per new page + the footer)

For **each** of Privacy / Terms / IP Disclaimer / About:

- [ ] Create `apps/web/src/pages/<Name>Page.tsx` exporting a **named** component (`export function PrivacyPage()`), rendering its own `<main>` with exactly one `<h1>`, `<h2>` sections, palette-only colors (`theme.ts` `COLORS`), and `FONTS.body`. Model on `NotFoundPage.tsx`.
- [ ] Wire the route in `apps/web/src/router.tsx`: add `const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');` and a `{path: 'privacy', element: <SuspenseWrapper><PrivacyPage/></SuspenseWrapper>}` child of `AppLayout` (`router.tsx:33-51,105-296`). **Do NOT wrap in `RevealsGate`/`AdminGate`** — legal pages are ungated.
- [ ] Make it reachable: add a **new `<footer>`** (recommended in `AppLayout.tsx`'s `AppContent`, after `<Outlet/>`) with `<nav aria-label="Legal">` links (`react-router` `Link`/`NavLink`, not `<button>`), plus the short IP-disclaimer line from §2b. (There is currently no footer at all.)
- [ ] Story: add `<Name>Page.stories.tsx` (`Pages/<Name>Page`, `MemoryRouter` decorator) — convention, not gate-enforced for pages. If a shared `SiteFooter` component is created, its story **is** gate-enforced.
- [ ] Unit test (encouraged): `apps/web/src/pages/__tests__/<Name>Page.test.tsx`, 3–5 focused tests (heading renders, sections present, links present, home CTA navigates), `MemoryRouter`-wrapped.
- [ ] E2E: add a section + tests to `apps/web/e2e/tests/` (route + `<h1>` + `<main>` + footer-link nav) AND an **axe-audit test** in `accessibility.spec.ts`. **Update `apps/web/e2e/E2E_TESTS.md`** (bump the 107/17 counts, add the section).
- [ ] a11y: one `<h1>`, ordered headings, AA contrast, `<a>` for nav / `<button>` for actions, `aria-label` on the footer `<nav>`. Confirm axe-clean.
- [ ] Content: IP page reuses issue #219's exact strings (§2b); About uses only §1a facts + resolves the version (§1b), creator/contact (§1c), and license (§1d) open questions with the user first.
- [ ] Docs discrepancy to note in the PR: the issue's "Files" section says `apps/web/src/App.tsx`, which **does not exist** — the app migrated to `apps/web/src/router.tsx` (routes are children of `<AppLayout/>`). Reference router.tsx instead.

---

## Open Questions (need user decisions before content is final)

1. **Version string** to display on About: code says `0.1.0`, docs say `v1.0.0` (§1b). Which is public-facing?
2. **License reality:** README says MIT but there is no `LICENSE` file and packages are `private: true` (§1d). Add a LICENSE and say "open source," or drop the MIT claim? What may the About page assert about open-source status?
3. **Contact mechanism:** email vs. form, and whether the personal `johnfanidis@gmail.com` is exposed or a dedicated address is used (issue marks this **TBD**) (§1c, §1e).
4. **Creator credit:** display name — real name, "Doberjohn", "the Inkweave team"? Is it a solo project? (§1c)
5. **Footer placement/design:** confirm a global footer in `AppLayout` (appears on every route incl. mobile) vs. per-page — the app has no footer today and MobileBottomNav occupies the mobile bottom edge, so mobile footer placement needs a design call (§3b).
6. **Privacy Policy source facts** (owned by Areas 1–5, cross-referenced here): analytics scope, Supabase anonymous votes + IP-hashing for rate limiting, Sentry EU/DE region, localStorage usage, retention/deletion — verify against actual code before drafting; issue #219 lists these as required sections.
</content>
</invoke>
