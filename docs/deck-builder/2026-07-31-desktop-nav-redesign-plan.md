# Desktop Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a Decks link in the desktop nav and restyle that nav as bare weight-600 links with an underlined active state.

**Architecture:** All visual work is confined to `CompactHeader.tsx` — the nav's capsule chrome is deleted, its two chrome helpers go with it, and `NAV_ITEMS` gains a fourth entry. Auth gating is added as a filter fed by a new non-throwing `useIsSignedIn()` hook in `SessionContext.tsx`, so the header stays provider-optional and none of its 18 call sites change.

**Tech Stack:** React 19 + TypeScript, react-router `NavLink`, inline styles with design tokens from `shared/constants`, Vitest + Testing Library, Storybook 10, Playwright.

**Spec:** [`docs/deck-builder/2026-07-31-desktop-nav-redesign-design.md`](./2026-07-31-desktop-nav-redesign-design.md)

**Branch:** stay on `deck-builder`. Do NOT cut a feature branch — this epic's commits are unmerged to production (CLAUDE.md, epic-issue convention).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/shared/contexts/SessionContext.tsx` | modify | add `useIsSignedIn()` beside the private `SessionContext` |
| `apps/web/src/shared/contexts/__tests__/SessionContext.test.tsx` | create or extend | prove `useIsSignedIn` returns false outside a provider |
| `apps/web/src/shared/components/CompactHeader.tsx` | modify | nav items, auth filter, bare-link styling |
| `apps/web/e2e/tests/navigation.spec.ts` | create or extend | Decks is reachable from the desktop nav |
| `apps/web/e2e/E2E_TESTS.md` | modify | inventory the new E2E assertion |

No new components. `NavItemLink` keeps its name and shape; only its styles change.

---

### Task 1: `useIsSignedIn` hook

**Files:**
- Modify: `apps/web/src/shared/contexts/SessionContext.tsx`
- Test: `apps/web/src/shared/contexts/__tests__/SessionContext.test.tsx`

First check whether the test file already exists:

```bash
ls apps/web/src/shared/contexts/__tests__/
```

If `SessionContext.test.tsx` exists, ADD the describe block below to it. If not, create the file with the imports plus the block.

- [ ] **Step 1: Write the failing test**

Create or extend `apps/web/src/shared/contexts/__tests__/SessionContext.test.tsx`:

```tsx
import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SessionProvider, useIsSignedIn} from '../SessionContext';

function Probe() {
  return <span data-testid="probe">{String(useIsSignedIn())}</span>;
}

describe('useIsSignedIn', () => {
  // The whole point of this hook: the desktop nav reacts to auth without
  // requiring it, so it must not throw the way useSession does.
  it('returns false outside a SessionProvider instead of throwing', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  it('returns false inside a provider when nobody is signed in', () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter inkweave-web exec vitest run src/shared/contexts/__tests__/SessionContext.test.tsx
```

Expected: FAIL. The import of `useIsSignedIn` does not resolve — `SessionContext.tsx` does not export it yet.

- [ ] **Step 3: Implement the hook**

In `apps/web/src/shared/contexts/SessionContext.tsx`, add this directly below the existing `useSession` function at the bottom of the file:

```tsx
/**
 * Signed-in state for components that REACT to auth without REQUIRING it.
 *
 * Unlike `useSession`, this returns false outside a SessionProvider rather than
 * throwing. The desktop nav needs it: CompactHeader is rendered at 18 call sites
 * and by Storybook stories that wrap in MemoryRouter alone, so demanding a
 * provider there would break all of them for a single boolean.
 */
export function useIsSignedIn(): boolean {
  const context = useContext(SessionContext);
  return context?.user != null;
}
```

No import change is needed: line 5 of the file is already
`import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';`

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter inkweave-web exec vitest run src/shared/contexts/__tests__/SessionContext.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/contexts/SessionContext.tsx apps/web/src/shared/contexts/__tests__/SessionContext.test.tsx && USER_APPROVED=1 git commit -m "feat(auth): useIsSignedIn, a non-throwing signed-in probe (#508)"
```

The `&&` is required: `git add` failing must abort the commit, or a partial index commits silently.

---

### Task 2: Decks joins the nav, with auth-gating support

**Files:**
- Modify: `apps/web/src/shared/components/CompactHeader.tsx:28-37`

This task is verified by Storybook and E2E (Task 4), not a unit test — `NAV_ITEMS`
is a module-private constant with no exported seam, and adding one purely to
assert a four-item array would test the literal rather than the behaviour.

- [ ] **Step 1: Extend the type and the list**

Replace lines 28-37 of `apps/web/src/shared/components/CompactHeader.tsx`:

```tsx
interface NavItem {
  path: string;
  label: string;
  /** Hide unless signed in. No item uses this yet — Collection (#452) is the
   *  first, once /collection exists. Until then the filter is a no-op. */
  requiresAuth?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/vote', label: 'Vote'},
  // Public, not personal: /decks shows community decks with a switch to your own.
  {path: '/decks', label: 'Decks'},
];
```

- [ ] **Step 2: Import the hook**

Add to the imports at the top of `CompactHeader.tsx`, after the `useRevealPhase` import:

```tsx
import {useIsSignedIn} from '../contexts/SessionContext';
```

- [ ] **Step 3: Filter in DesktopNav**

In `function DesktopNav({isRevealSeason})`, add the hook call and filter directly
below the existing `useState` line:

```tsx
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const isSignedIn = useIsSignedIn();
  const items = NAV_ITEMS.filter((item) => !item.requiresAuth || isSignedIn);
```

Then change the map from `NAV_ITEMS.map(...)` to `items.map(...)`. Leave the
`NavItemLink` props exactly as they are.

- [ ] **Step 4: Verify the app builds and the nav renders**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```

Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/CompactHeader.tsx && USER_APPROVED=1 git commit -m "feat(nav): Decks joins the desktop nav, plus auth-gating support (#508)"
```

---

### Task 3: Bare links — strip the capsule, restyle

**Files:**
- Modify: `apps/web/src/shared/components/CompactHeader.tsx` — `getNavItemBackground`, `getNavItemBoxShadow`, `NavItemLink`, `DesktopNav`

- [ ] **Step 1: Delete the two dead chrome helpers**

Remove these two functions entirely from `CompactHeader.tsx` (they sit around
lines 98-116, immediately before and after `getNavItemColor`):

```tsx
function getNavItemBackground(state: InteractionState): string { ... }
function getNavItemBoxShadow(state: InteractionState): string { ... }
```

KEEP `getNavItemColor` — it still drives default/hover/active colour, unchanged.

**Leave the `GOLD_GLOW` import alone.** Deleting those two functions removes its
uses at lines 100 and 113, but `HeaderSearch` still uses `GOLD_GLOW.activeBorder`
(line 132) and `GOLD_GLOW.focusRing` (line 134). Removing it from the import
breaks the search input's focus ring. Confirm after deleting:

```bash
grep -n "GOLD_GLOW" apps/web/src/shared/components/CompactHeader.tsx
```

Expected: 3 lines remain — the import, and the two `HeaderSearch` uses.

- [ ] **Step 2: Restyle NavItemLink**

Replace the whole `style={({isActive}) => {...}}` body in `NavItemLink` with:

```tsx
      style={({isActive}) => {
        const state: InteractionState = {isActive, isHovered};
        return {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING.xs}px 0`,
          color: getNavItemColor(state),
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.lg}px`,
          fontWeight: 600,
          textDecoration: 'none',
          // The active page's only structural cue now that the capsule is gone.
          // Colour alone would fail WCAG 1.4.1 and read as decoration.
          borderBottom: `2px solid ${isActive ? COLORS.primary : 'transparent'}`,
          transition: `color ${DURATION.base}ms ${EASING.snappy}, border-color ${DURATION.base}ms ${EASING.snappy}`,
          cursor: 'pointer',
        };
      }}>
```

Note `borderBottom` with a transparent fallback rather than a conditional
`::after` — it keeps every item the same height, so the bar does not jump by 2px
as the active item changes.

- [ ] **Step 3: Strip the capsule wrapper in DesktopNav**

In `DesktopNav`, replace the wrapper `<div>` that currently carries
`height: 38`, `borderRadius`, `border`, `background` and `overflow: 'hidden'`
with a plain flex row:

```tsx
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.xl}}>
        {items.map(({path, label}) => (
          <NavItemLink
            key={path}
            path={path}
            label={label}
            isHovered={hoveredNav === path}
            onMouseEnter={() => setHoveredNav(path)}
            onMouseLeave={() => setHoveredNav(null)}
          />
        ))}
      </div>
```

- [ ] **Step 4: Verify build + design gates**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
pnpm --filter inkweave-web lint
pnpm --filter inkweave-web run check:design
```

Expected: typecheck exit 0; lint `0 errors` (16 pre-existing warnings are fine);
design gate `✅ Design-token value gate passed`.

`CompactHeader.tsx` was removed from the `no-raw-duration` ledger in `1da74c47`,
so it is now held to the rule — any raw `0.2s` here fails the build.

- [ ] **Step 5: Look at it**

```bash
pnpm --filter inkweave-web storybook
```

Open `http://localhost:6006/iframe.html?id=components-compactheader--with-search&viewMode=story`.

Confirm: no capsule border or background; four links (Browse, Playstyles, Vote,
Decks) at 14px weight 600; "Browse" is gold with a 2px gold underline; hovering
another item turns it gold with no underline and no background.

- [ ] **Step 6: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/CompactHeader.tsx && USER_APPROVED=1 git commit -m "refactor(nav): bare links replace the capsule, active state is an underline (#508)"
```

---

### Task 4: E2E — Decks is actually reachable

**Files:**
- Create or extend: `apps/web/e2e/tests/navigation.spec.ts`
- Modify: `apps/web/e2e/E2E_TESTS.md`

This is the defect the whole change exists to fix, so it gets the one test that
would have caught it.

- [ ] **Step 1: Check for an existing navigation spec**

```bash
ls apps/web/e2e/tests/ | grep -i nav
```

If `navigation.spec.ts` exists, add the `test.describe` block below to it.
Otherwise create the file with the import line plus the block.

- [ ] **Step 2: Write the failing test**

```ts
import {test, expect} from '../fixtures';

test.describe('Desktop nav', () => {
  test('Decks is reachable from the main nav', async ({page}, testInfo) => {
    // Desktop-only: mobile uses MobileBottomNav, which already had a Decks tab.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // Home uses a hero-first layout with no CompactHeader; use a standard page.
    await page.goto('/browse');

    const mainNav = page.getByRole('navigation', {name: 'Main navigation'});
    const decksLink = mainNav.getByRole('link', {name: 'Decks', exact: true});
    await expect(decksLink).toBeVisible();

    await decksLink.click();
    await expect(page).toHaveURL(/\/decks$/);
  });
});
```

- [ ] **Step 3: Run it against the pre-change code to confirm it fails**

Only meaningful if you stashed Task 2; if Tasks 2-3 are already committed, skip to
Step 4 and simply confirm it passes. To see it fail:

```bash
git stash && pnpm --filter inkweave-web exec playwright test navigation --project=chromium; git stash pop
```

Expected while stashed: FAIL — no link named "Decks" in Main navigation.

- [ ] **Step 4: Run it against the new code**

Free port 5173 first — Playwright reuses whatever already serves it, so a running
dev server gets borrowed instead of Playwright starting its own:

```bash
pnpm --filter inkweave-web exec playwright test navigation --project=chromium
```

Expected: PASS.

- [ ] **Step 5: Update the E2E inventory**

Add a row to `apps/web/e2e/E2E_TESTS.md` for `navigation.spec.ts` describing the
Decks-reachability assertion, matching the format of the surrounding entries.

- [ ] **Step 6: Commit**

```bash
USER_APPROVED=1 git add apps/web/e2e/tests/navigation.spec.ts apps/web/e2e/E2E_TESTS.md && USER_APPROVED=1 git commit -m "test(nav): Decks is reachable from the desktop nav (#508)"
```

---

### Task 5: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Full suite**

```bash
pnpm test:web
```

Expected: `149 passed`, `1063 passed | 3 skipped` (plus the 2 new
`useIsSignedIn` tests, so 1065 passed).

- [ ] **Step 2: Story coverage + design gates**

```bash
pnpm --filter inkweave-web run check:stories
pnpm --filter inkweave-web run check:design
pnpm --filter inkweave-web lint
```

Expected: all pass; lint `0 errors`.

- [ ] **Step 3: Confirm no CompactHeader call site needed changing**

```bash
git diff --name-only HEAD~4 HEAD
```

Expected: only `SessionContext.tsx`, its test, `CompactHeader.tsx`,
`navigation.spec.ts`, `E2E_TESTS.md`. If any file under `src/pages/` appears, the
hook approach was abandoned somewhere — stop and re-read the spec's Component API
section.

- [ ] **Step 4: Visual check against the mockup**

The approved mockup is at `apps/web/public/mockups/nav-redesign.html` (git-ignored)
— serve it with `pnpm dev` and open `/mockups/nav-redesign.html`. Row **B** is the
target. Compare against the real header in Storybook and confirm they match on
weight, size, spacing and the underline.

Delete the mockup once matched:

```bash
rm apps/web/public/mockups/nav-redesign.html
```

---

## Self-review notes

**Spec coverage.** Visual table → Task 3. Nav model + `requiresAuth` → Task 2.
`useIsSignedIn` + its mandated outside-provider test → Task 1. E2E → Task 4.
Stories: no new story by design (a `SignedIn` story would be identical to
`Default`); the existing five are the regression net and are exercised in Task 3
Step 5 and Task 5 Step 2.

**Known non-coverage, carried from the spec.** The `requiresAuth` filter has no
gated item until #452, so nothing proves the filter itself. `useIsSignedIn` is
tested; the filter is correct by inspection. This was an accepted trade, not an
oversight.

**Deferred, not forgotten.** The layout shift when Collection eventually appears
in a centre-positioned nav is recorded in the spec's "Recorded, not solved"
section. Nothing in this plan addresses it because nothing is gated yet.
