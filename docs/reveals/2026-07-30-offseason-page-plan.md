# Off-season /reveals page implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/reveals` stops redirecting to `/` when out of season and instead renders a simple notice styled like the 404.

**Architecture:** The 404's page shell (centred `<main>`, glow, sparkles, watermark, divider, hero-serif title, two prose lines, CTA) is extracted into a shared `FullPageNotice` with an optional `hero` slot, so `NotFoundPage` keeps its gradient numeral and the new page renders title-first. `RevealsGate` swaps its `<Navigate>` for `<RevealsOffSeason phase={phase} />`, which varies copy between the two off-season phases.

**Tech Stack:** React 19, TypeScript, react-router-dom, inline styles with design tokens, vitest + @testing-library/react, Storybook 10.

**Spec:** [`2026-07-30-offseason-page-design.md`](2026-07-30-offseason-page-design.md)

**Branch:** stay on `deck-builder`. Do NOT cut a feature branch.

---

## Repo gotchas that will bite you

- **`docs/superpowers/` is gitignored** (`.gitignore:98`). Never write docs there; they silently fail to commit. This plan and its spec live in `docs/reveals/`.
- **Chain `git add` and `git commit` with `&&`.** A refused path makes `git add` exit non-zero, and an unchained `git commit` then commits a partial index — producing a commit whose message overstates it. Verify with `git show --stat`, not `git log -1`.
- **Subagents cannot `git commit`** (the `git-write-protection` hook blocks it even with `USER_APPROVED=1`). The controller commits.
- **`preview_start`'s in-app pane does not composite frames**, so screenshots time out and hover/transition UI is unreachable. Use the `claude-in-chrome` extension for visual checks.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `apps/web/src/features/reveals/revealDates.ts` | Fetch + cache the reveal set's dates | Add `name`; add a `useRevealDates` hook |
| `apps/web/src/shared/components/FullPageNotice.tsx` | The shared full-page notice shell | **create** |
| `apps/web/src/shared/components/FullPageNotice.test.tsx` | Its tests | **create** |
| `apps/web/src/shared/components/FullPageNotice.stories.tsx` | Story coverage (gate requires) | **create** |
| `apps/web/src/pages/NotFoundPage.tsx` | The 404 | Consume the shell |
| `apps/web/src/features/reveals/RevealsOffSeason.tsx` | Off-season copy, two phases | **create** |
| `apps/web/src/features/reveals/RevealsOffSeason.test.tsx` | Its tests | **create** |
| `apps/web/src/features/reveals/RevealsOffSeason.stories.tsx` | Story coverage | **create** |
| `apps/web/src/features/reveals/RevealsGate.tsx` | Route gate | Render the notice, not a redirect |
| `apps/web/src/features/reveals/RevealsGate.test.tsx` | Its tests | **create** (none exist today) |
| `apps/web/src/features/reveals/index.ts` | Feature barrel | Export the new pieces |
| `apps/web/scripts/check-story-coverage.mjs` | Story gate | Update a stale comment |

**Pure/impure split.** `RevealsOffSeason.tsx` exports two things: `OffSeasonNotice` (pure, takes `phase` + `dates`, trivially testable) and `RevealsOffSeason` (thin wrapper supplying `dates` from the hook). This mirrors `computePhase`, which the codebase already exports purely for testing.

---

### Task 1: `RevealDates` carries the set name

**Files:**
- Modify: `apps/web/src/features/reveals/revealDates.ts`

No test: the spec does not require one, mocking `fetch` for a one-field parse change is disproportionate, and the value is exercised through `OffSeasonNotice`'s tests in Task 4.

- [ ] **Step 1: Widen the interface and the parsed JSON shape**

Replace the `RevealDates` interface and `PreviewCardsJSON` interface:

```ts
export interface RevealDates {
  prereleaseDate: Date;
  releaseDate: Date;
  /** The set's display name, e.g. "Attack of the Vine!". Empty string when the JSON omits it. */
  name: string;
}

interface PreviewCardsJSON {
  sets?: Record<string, {prereleaseDate?: string; releaseDate?: string; name?: string}>;
}
```

- [ ] **Step 2: Carry the name through the cache**

In `fetchRevealDates`, replace the `cache = {...}` assignment:

```ts
      cache = {
        prereleaseDate: parseLocalMidnight(set.prereleaseDate),
        releaseDate: parseLocalMidnight(set.releaseDate),
        // Not part of the null-guard above: a missing name degrades the notice's
        // copy, while missing dates would make the whole phase calculation wrong.
        name: set.name ?? '',
      };
```

- [ ] **Step 3: Add the `useRevealDates` hook**

Append to the end of `revealDates.ts` (and add `useEffect`/`useState` to its imports — the file currently imports nothing from react, so add `import {useEffect, useState} from 'react';` as the FIRST line):

```ts
/**
 * The resolved reveal dates, or null while loading or when the JSON lacks them.
 * `fetchRevealDates` memoises, so mounting this in several places costs one fetch.
 */
export function useRevealDates(): RevealDates | null {
  const [dates, setDates] = useState<RevealDates | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchRevealDates().then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return dates;
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter inkweave-web exec tsc -b
```

Expected: clean, exit 0. `useRevealPhase` builds its own `RevealDates` only from `fetchRevealDates`, so the added required property breaks no construction site.

- [ ] **Step 5: Report for commit** (do NOT commit; the controller does)

---

### Task 2: `FullPageNotice`, the extracted shell

**Files:**
- Create: `apps/web/src/shared/components/FullPageNotice.tsx`
- Create: `apps/web/src/shared/components/FullPageNotice.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `FullPageNotice.test.tsx`:

```tsx
import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FullPageNotice} from './FullPageNotice';

describe('FullPageNotice', () => {
  it('renders the title, both prose lines, and fires the CTA', () => {
    const onCta = vi.fn();
    render(
      <FullPageNotice
        title="Reveal season has ended"
        lines={['First line.', 'Second line.']}
        ctaLabel="Return to Inkweave"
        onCta={onCta}
      />,
    );
    expect(screen.getByRole('heading', {name: 'Reveal season has ended'})).toBeInTheDocument();
    expect(screen.getByText('First line.')).toBeInTheDocument();
    expect(screen.getByText('Second line.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /return to inkweave/i}));
    expect(onCta).toHaveBeenCalledOnce();
  });

  it('renders the hero slot only when one is given', () => {
    const {rerender} = render(
      <FullPageNotice title="T" lines={['a', 'b']} ctaLabel="Go" onCta={vi.fn()} />,
    );
    expect(screen.queryByTestId('notice-hero')).not.toBeInTheDocument();
    rerender(
      <FullPageNotice
        hero={<span data-testid="notice-hero">404</span>}
        title="T"
        lines={['a', 'b']}
        ctaLabel="Go"
        onCta={vi.fn()}
      />,
    );
    expect(screen.getByTestId('notice-hero')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm it FAILS**

```bash
pnpm --filter inkweave-web exec vitest run src/shared/components/FullPageNotice.test.tsx
```

Expected: FAIL, cannot resolve `./FullPageNotice`. Report the actual message.

- [ ] **Step 3: Create the component**

Create `FullPageNotice.tsx`. This is the 404's shell moved verbatim; do not restyle it.

```tsx
import type {ReactNode} from 'react';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, SPACING} from '../constants';
import {CtaButton} from './CtaButton';

/**
 * The full-page notice scene shared by the 404 and the off-season /reveals page:
 * a centred column over a bespoke glow, an ink-tinted sparkle field and a brand
 * watermark, then an optional oversized hero mark, a gold divider, a hero-serif
 * title, exactly two prose lines and one CTA.
 *
 * The decorative layers are separate components rather than inline markup, which
 * is what keeps the composed scene under the Large Method threshold (#525 pushed
 * the 404's single-function form to 179 lines against a limit of 120).
 */

/**
 * Deliberately NOT shared with EtherealBackground: this glow is bespoke to the
 * notice scene (different size, gradient stops and offset), and unifying them
 * would change how the pages look.
 */
function EtherealGlow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 600,
        height: 400,
        borderRadius: '50%',
        background:
          'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12) 0%, rgba(212, 175, 55, 0.06) 40%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -55%)',
        pointerEvents: 'none',
      }}
    />
  );
}

// Sparkle accents read from the ink tokens rather than copied hexes: the copies
// were the OLD Amethyst/Emerald values and were orphaned by the 2026-07-30 ink
// repalette, leaving decorative colours that belonged to no ink at all.
const SPARKLES = [
  {x: '19%', y: '22%', size: 3, color: COLORS.primary500, opacity: 0.3},
  {x: '76%', y: '33%', size: 2, color: INK_COLORS.Amethyst.border, opacity: 0.25},
  {x: '24%', y: '75%', size: 4, color: COLORS.primary500, opacity: 0.2},
  {x: '73%', y: '69%', size: 2.5, color: INK_COLORS.Amethyst.border, opacity: 0.2},
  {x: '35%', y: '17%', size: 2, color: COLORS.primary500, opacity: 0.3},
  {x: '64%', y: '20%', size: 3, color: INK_COLORS.Emerald.border, opacity: 0.2},
];

function SparkleField() {
  return (
    <div aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden'}}>
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
          }}
        />
      ))}
    </div>
  );
}

function BrandWatermark() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: SPACING.xxl,
        fontFamily: FONTS.hero,
        fontSize: `${FONT_SIZES.md}px`,
        letterSpacing: 4,
        color: 'rgba(144, 161, 185, 0.25)',
      }}>
      INKWEAVE
    </span>
  );
}

/** The sparkle that leads the CTA on both pages. */
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="3.5 2 17 16" fill="none" aria-hidden="true" style={{flexShrink: 0}}>
      <path
        d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
        fill={COLORS.filterText}
        stroke={COLORS.filterText}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface FullPageNoticeProps {
  /** Oversized mark above the divider (the 404's numeral). Omit for a title-first page. */
  hero?: ReactNode;
  title: string;
  /** Exactly two lines; the second renders dimmer than the first. */
  lines: [string, string];
  ctaLabel: string;
  onCta: () => void;
}

function NoticeContent({hero, title, lines, ctaLabel, onCta}: FullPageNoticeProps) {
  return (
    <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${SPACING.xl}px`}}>
      {hero}
      <div
        aria-hidden="true"
        style={{
          width: 200,
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)',
          marginTop: SPACING.xs,
        }}
      />
      <h2
        style={{
          margin: 0,
          marginTop: SPACING.xxl,
          fontFamily: FONTS.hero,
          fontSize: `clamp(${FONT_SIZES.xxl}px, 4vw, 28px)`,
          fontWeight: 400,
          color: COLORS.text,
          letterSpacing: 2,
          textAlign: 'center',
        }}>
        {title}
      </h2>
      <p style={{margin: 0, marginTop: SPACING.md, fontSize: `${FONT_SIZES.xl}px`, color: COLORS.textMuted, textAlign: 'center'}}>
        {lines[0]}
      </p>
      <p style={{margin: 0, marginTop: SPACING.sm, fontSize: `${FONT_SIZES.lg}px`, color: 'rgba(144, 161, 185, 0.5)', textAlign: 'center'}}>
        {lines[1]}
      </p>
      <CtaButton onClick={onCta} style={{marginTop: 36}}>
        <SparkleIcon />
        {ctaLabel}
      </CtaButton>
    </div>
  );
}

export function FullPageNotice(props: FullPageNoticeProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: FONTS.body,
        position: 'relative',
        overflow: 'hidden',
      }}>
      <EtherealGlow />
      <SparkleField />
      <NoticeContent {...props} />
      <BrandWatermark />
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter inkweave-web exec vitest run src/shared/components/FullPageNotice.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Lint (the token rules are strict here)**

```bash
pnpm --filter inkweave-web lint
```

Expected: 0 errors. The two `rgba(...)` literals and the `#d4af37` gradient are moved verbatim from `NotFoundPage`, which is in the grandfather ledger; if `no-raw-rgba` or `no-raw-hex-colors` now fires on this NEW file, STOP and report it rather than adding a ledger entry — the ledger only shrinks and never gains entries.

- [ ] **Step 6: Report for commit**

---

### Task 3: `NotFoundPage` consumes the shell

**Files:**
- Modify: `apps/web/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Replace the whole file**

Everything except the 404 numeral and the SEO block now lives in `FullPageNotice`. Preserve the long `vercel.json` comment verbatim: it is load-bearing SEO documentation (#525).

```tsx
import {useLocation, useNavigate} from 'react-router-dom';
import {FONTS} from '../shared/constants';
import {FullPageNotice} from '../shared/components/FullPageNotice';
import {Seo} from '../shared/components';

/** The 404's oversized gradient numeral — the one hero mark that earns its size. */
function GoldNumeral() {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: FONTS.hero,
        fontSize: 'clamp(100px, 20vw, 180px)',
        fontWeight: 400,
        letterSpacing: 8,
        lineHeight: 1,
        background: 'linear-gradient(180deg, #d4af37 0%, #ffb900 50%, rgba(212, 175, 55, 0.5) 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
      404
    </h1>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  return (
    <>
      {/*
        vercel.json rewrites every extensionless path to dist/index.html, which prerender.mjs
        overwrote with the HOME route's render — so an unknown URL returns HTTP 200 carrying
        home's title and canonical="/" (#525). public/404.html has a noindex but is unreachable
        through that rewrite. This is the only thing that tells a crawler not to index junk URLs.
        Self-referential canonical, not "/", so Google does not consolidate junk into the homepage.
      */}
      <Seo title="Page not found | Inkweave" canonicalPath={pathname} noindex />
      <FullPageNotice
        hero={<GoldNumeral />}
        title="Lost in the Inkwell"
        lines={[
          'This page has vanished into the mists of Lorcana.',
          'Perhaps it was banished, or simply never existed.',
        ]}
        ctaLabel="Return to Inkweave"
        onCta={() => navigate('/')}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck, lint, and run the existing story**

```bash
pnpm --filter inkweave-web exec tsc -b
pnpm --filter inkweave-web lint
pnpm --filter inkweave-web check:stories
```

All expected clean. `NotFoundPage.stories.tsx` already exists and must still resolve.

- [ ] **Step 3: Run the full web suite**

```bash
pnpm --filter inkweave-web test:run
```

Expected: PASS. `NotFoundPage` has NO test of its own, so nothing here proves the refactor visually — that is what the browser check in Final Verification is for.

- [ ] **Step 4: Report for commit**

---

### Task 4: `RevealsOffSeason`

**Files:**
- Create: `apps/web/src/features/reveals/RevealsOffSeason.tsx`
- Create: `apps/web/src/features/reveals/RevealsOffSeason.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {OffSeasonNotice} from './RevealsOffSeason';

const DATES = {
  prereleaseDate: new Date(2026, 6, 17),
  releaseDate: new Date(2026, 6, 24),
  name: 'Attack of the Vine!',
};

describe('OffSeasonNotice', () => {
  it('names the set and its release date once the set is out', () => {
    render(
      <MemoryRouter>
        <OffSeasonNotice phase="released" dates={DATES} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', {name: 'Reveal season has ended'})).toBeInTheDocument();
    expect(screen.getByText(/Attack of the Vine! released on 24 July 2026\./)).toBeInTheDocument();
  });

  it('says only that there is no season when the feature is off', () => {
    render(
      <MemoryRouter>
        <OffSeasonNotice phase="hidden" dates={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', {name: 'No reveal season right now'})).toBeInTheDocument();
    expect(screen.queryByText(/Attack of the Vine!/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm FAIL**

```bash
pnpm --filter inkweave-web exec vitest run src/features/reveals/RevealsOffSeason.test.tsx
```

Expected: FAIL, cannot resolve `./RevealsOffSeason`.

- [ ] **Step 3: Create the component**

```tsx
import {useNavigate} from 'react-router-dom';
import {FullPageNotice} from '../../shared/components/FullPageNotice';
import {useRevealDates, type RevealDates} from './revealDates';

/** "24 July 2026" — the release date as the copy reads it. */
function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
}

interface OffSeasonNoticeProps {
  /** The two phases that mean "not in season". */
  phase: 'hidden' | 'released';
  dates: RevealDates | null;
}

/**
 * Pure copy component, exported for unit testing (mirrors `computePhase`).
 *
 * `released` names the set; `hidden` cannot, because no season is configured.
 * `dates` is non-null in practice whenever phase is `released` — `computePhase`
 * returns 'loading' before 'released' when dates are missing — so the null branch
 * here is a defensive default, not a specified behaviour worth testing.
 */
export function OffSeasonNotice({phase, dates}: OffSeasonNoticeProps) {
  const navigate = useNavigate();
  const canNameSet = phase === 'released' && dates !== null && dates.name !== '';

  const title = canNameSet ? 'Reveal season has ended' : 'No reveal season right now';
  const lines: [string, string] = canNameSet
    ? [
        `${dates.name} released on ${formatReleaseDate(dates.releaseDate)}.`,
        'The spoiler board is closed until the next set.',
      ]
    : [
        "Card reveals appear here when the next set's spoiler season begins.",
        'Until then, the full Core catalogue is a click away.',
      ];

  return (
    <FullPageNotice
      title={title}
      lines={lines}
      ctaLabel="Return to Inkweave"
      onCta={() => navigate('/')}
    />
  );
}

/**
 * Route-level wrapper: supplies the dates and owns the page's SEO.
 *
 * `noindex` because off-season there is genuinely nothing to index; the tag goes
 * away with the season, since in-season /reveals renders RevealsPage instead.
 * SEO lives here rather than in `OffSeasonNotice` so the pure component stays
 * free of side effects and its tests and stories emit no meta tags.
 */
export function RevealsOffSeason({phase}: {phase: 'hidden' | 'released'}) {
  return (
    <>
      <Seo title="Reveals | Inkweave" canonicalPath="/reveals" noindex />
      <OffSeasonNotice phase={phase} dates={useRevealDates()} />
    </>
  );
}
```

Add `Seo` to the imports at the top of the file:

```tsx
import {Seo} from '../../shared/components';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter inkweave-web exec vitest run src/features/reveals/RevealsOffSeason.test.tsx
```

Expected: PASS, 2 tests. If the date assertion fails, print the rendered text and match the actual `toLocaleDateString('en-GB')` output rather than changing the format to suit the test.

- [ ] **Step 5: Report for commit**

---

### Task 5: The gate renders the notice

**Files:**
- Modify: `apps/web/src/features/reveals/RevealsGate.tsx`
- Create: `apps/web/src/features/reveals/RevealsGate.test.tsx`
- Modify: `apps/web/src/features/reveals/index.ts`
- Modify: `apps/web/scripts/check-story-coverage.mjs`

- [ ] **Step 1: Write the failing tests**

`useRevealPhase` reads an env flag and fetches, so mock it. Create `RevealsGate.test.tsx`:

```tsx
import {describe, expect, it, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {RevealsGate} from './RevealsGate';
import type {RevealPhase} from './useRevealPhase';

const phase = vi.hoisted(() => ({current: 'pre-release' as RevealPhase}));
vi.mock('./useRevealPhase', () => ({useRevealPhase: () => phase.current}));
vi.mock('./revealDates', () => ({useRevealDates: () => null}));

function renderGate() {
  return render(
    <MemoryRouter>
      <RevealsGate>
        <div data-testid="reveals-page">the reveals page</div>
      </RevealsGate>
    </MemoryRouter>,
  );
}

describe('RevealsGate', () => {
  beforeEach(() => {
    phase.current = 'pre-release';
  });

  it.each(['pre-release', 'pre-release-live'] as const)('renders the page during %s', (p) => {
    phase.current = p;
    renderGate();
    expect(screen.getByTestId('reveals-page')).toBeInTheDocument();
  });

  it('renders the page while loading, so it never redirects before dates resolve', () => {
    phase.current = 'loading';
    renderGate();
    expect(screen.getByTestId('reveals-page')).toBeInTheDocument();
  });

  it.each(['hidden', 'released'] as const)('shows the off-season notice for %s, not a redirect', (p) => {
    phase.current = p;
    renderGate();
    expect(screen.queryByTestId('reveals-page')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /return to inkweave/i})).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm FAIL**

```bash
pnpm --filter inkweave-web exec vitest run src/features/reveals/RevealsGate.test.tsx
```

Expected: the two off-season cases FAIL (the gate still redirects, so no CTA renders). The three pass-through cases should already PASS.

- [ ] **Step 3: Replace the gate's body**

```tsx
import type {ReactNode} from 'react';
import {RevealsOffSeason} from './RevealsOffSeason';
import {useRevealPhase} from './useRevealPhase';

/**
 * Renders children during reveal season (`pre-release` / `pre-release-live`) and
 * an off-season notice when the phase is `hidden` (flag off) or `released` (past
 * wide release). It used to redirect to `/`, which left anyone arriving from a
 * bookmark, link or search on the homepage with no explanation.
 */
export function RevealsGate({children}: {children: ReactNode}) {
  const phase = useRevealPhase();
  // 'loading' means the flag is on but reveal dates are still being fetched —
  // let children mount (the page handles its own loading state) so we don't
  // race-redirect before dates resolve.
  if (phase === 'hidden' || phase === 'released') {
    return <RevealsOffSeason phase={phase} />;
  }
  return <>{children}</>;
}
```

Note `phase` narrows to `'hidden' | 'released'` inside the branch, which is exactly what `RevealsOffSeason` accepts. No cast is needed; if you find yourself adding one, the prop type is wrong.

- [ ] **Step 4: Export the new pieces from the barrel**

In `index.ts`, below the existing `export {RevealsGate} from './RevealsGate';` line:

```ts
export {RevealsOffSeason, OffSeasonNotice} from './RevealsOffSeason';
export {useRevealDates} from './revealDates';
```

- [ ] **Step 5: Update the stale story-coverage comment**

In `apps/web/scripts/check-story-coverage.mjs`, the exclusion reads:

```js
  'RevealsGate.tsx', // route gate: renders children or a redirect, no visual surface
```

Replace the comment (keep the exclusion — the gate still has no visual surface of its own):

```js
  'RevealsGate.tsx', // route gate: renders children or delegates to RevealsOffSeason, which has its own story
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter inkweave-web exec vitest run src/features/reveals
pnpm --filter inkweave-web check:stories
```

Expected: all PASS.

- [ ] **Step 7: Report for commit**

---

### Task 6: Stories

**Files:**
- Create: `apps/web/src/shared/components/FullPageNotice.stories.tsx`
- Create: `apps/web/src/features/reveals/RevealsOffSeason.stories.tsx`

- [ ] **Step 1: `FullPageNotice` stories**

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FullPageNotice} from './FullPageNotice';

const meta: Meta<typeof FullPageNotice> = {
  title: 'Shared/FullPageNotice',
  component: FullPageNotice,
  tags: ['autodocs'],
  args: {onCta: fn(), ctaLabel: 'Return to Inkweave'},
};
export default meta;
type Story = StoryObj<typeof meta>;

// Title-first: no hero mark. This is the shape the off-season /reveals page uses.
export const TitleFirst: Story = {
  args: {
    title: 'Reveal season has ended',
    lines: ['Attack of the Vine! released on 24 July 2026.', 'The spoiler board is closed until the next set.'],
  },
};

// With a hero mark, as the 404 uses it: an oversized gradient numeral above the divider.
export const WithHero: Story = {
  args: {
    hero: <span style={{fontSize: 120, lineHeight: 1, color: '#d4af37'}}>404</span>,
    title: 'Lost in the Inkwell',
    lines: ['This page has vanished into the mists of Lorcana.', 'Perhaps it was banished, or simply never existed.'],
  },
};
```

- [ ] **Step 2: `RevealsOffSeason` stories**

`OffSeasonNotice` calls `useNavigate`, so it needs a router decorator.

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {OffSeasonNotice} from './RevealsOffSeason';

const meta: Meta<typeof OffSeasonNotice> = {
  title: 'Reveals/OffSeasonNotice',
  component: OffSeasonNotice,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The set has shipped: the copy names it and the date it released.
export const Released: Story = {
  args: {
    phase: 'released',
    dates: {prereleaseDate: new Date(2026, 6, 17), releaseDate: new Date(2026, 6, 24), name: 'Attack of the Vine!'},
  },
};

// No season configured at all: nothing specific can be said.
export const Hidden: Story = {args: {phase: 'hidden', dates: null}};
```

- [ ] **Step 3: Verify the gate and lint**

```bash
pnpm --filter inkweave-web check:stories
pnpm --filter inkweave-web lint
```

Expected: both clean.

- [ ] **Step 4: Report for commit**

---

## Final verification

- [ ] **Full suite + all gates**

```bash
pnpm test
pnpm --filter inkweave-web lint
pnpm --filter inkweave-web check:stories
pnpm --filter inkweave-web check:design
```

Expected: all pass.

- [ ] **Browser check, `released` state (the current default)**

Start the dev server, then in real Chrome (NOT the in-app pane) open `http://localhost:5173/reveals`. Expect the notice naming Attack of the Vine! and its release date, with no redirect to `/`.

- [ ] **Browser check, the 404 (a refactored working page with no test)**

Open `http://localhost:5173/no-such-page`. It must look exactly as before: gradient 404 numeral, divider, "Lost in the Inkwell", two lines, CTA, sparkles, watermark. Compare against `git stash`-ing nothing — just confirm each element is present and positioned as it was.

- [ ] **Browser check, `hidden` state**

Set `VITE_IS_REVEAL_SEASON=false` in `apps/web/.env.local`, restart Vite (env is read at boot), reload `/reveals`, and expect the "No reveal season right now" copy. **Restore the flag to `true` afterwards** — leaving it false changes what the pre-push E2E sees.

- [ ] **Owner visual review** of both states plus the 404 before pushing.

- [ ] **Push**

```bash
USER_APPROVED=1 git push origin deck-builder
```

Free port 5173 first so Playwright owns its own server, and do not edit files while the push runs: the CodeScene gate grades the working tree.

## Notes for the implementer

- **Do not restyle anything while extracting.** Task 2 moves the 404's markup verbatim. Any visual change there is a regression in a page nobody has a test for.
- **`lines` is a two-tuple on purpose.** Both pages have exactly two prose lines with different emphasis. If a third is ever wanted, that is a design change, not a prop change.
- **Do not add ledger entries.** If a token rule fires on the new `FullPageNotice.tsx`, report it. `known-offenders.js` only shrinks, and the moved `rgba()`/hex values may need converting to tokens instead.
