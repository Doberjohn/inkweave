# Header Auth Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in / sign out is visible and actionable from the rightmost slot of the desktop header on every page.

**Architecture:** A new internal `HeaderAuth` subcomponent inside `CompactHeader.tsx`, beside `HeaderLogo` and `DesktopNav`. It calls `useSession()` directly and owns both the `signInOpen` state and `SignInDialog`. `DecksPage` loses all four of its auth concerns. Because the header now renders auth, it genuinely requires `SessionProvider` — so the four stories gain a decorator rather than the code gaining another non-throwing hook.

**Tech Stack:** React 19 + TypeScript, react-router, Supabase Auth via `SessionContext`, inline styles with tokens from `shared/constants`, Storybook 10, Playwright.

**Spec:** [`2026-07-31-header-auth-control-design.md`](./2026-07-31-header-auth-control-design.md)

**Branch:** stay on `deck-builder`. Do NOT cut a feature branch — this epic's commits are unmerged to production (CLAUDE.md, epic-issue convention).

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/shared/components/CompactHeader.tsx` | add `HeaderAuth`; render it after `<DesktopNav>`; new imports |
| `apps/web/src/shared/components/CompactHeader.stories.tsx` | add a `SessionProvider` decorator |
| `apps/web/src/pages/DecksPage.tsx` | remove both buttons, `SignInDialog`, `signInOpen`, `useSession`, and the now-dead imports |
| `apps/web/e2e/tests/navigation.spec.ts` | add the header-auth assertion |
| `apps/web/e2e/E2E_TESTS.md` | inventory it |

No new files. `SignInDialog` is unchanged — it already rides `DialogShell`, so the overlay contract comes for free.

**Two things this plan deliberately does NOT do**, both recorded in the spec:

- **Does not touch `headerActions`.** It is a dead prop with zero consumers, and the natural slot for a right-side control — but `HeaderAuth` is internal, not injected, so it stays unused. Deleting it here would mix an unrelated cleanup into an auth change.
- **Does not add a `SignedOut` story.** Storybook runs on Vite and loads `.env.local`, so a story cannot pin the auth state; it would render "Sign in" on a configured machine and nothing on CI. See Task 4.

---

### Task 1: `HeaderAuth` in the header

**Files:**
- Modify: `apps/web/src/shared/components/CompactHeader.tsx`

- [ ] **Step 1: Add the imports**

At the top of `CompactHeader.tsx`, extend the existing constants import and add three lines. The file currently imports `{COLORS, DURATION, EASING, FONT_SIZES, FONTS, LAYOUT, RADIUS, SHADOWS, SPACING, Z_INDEX}` from `'../constants'` — leave that as is. Add:

```tsx
import {useSession} from '../contexts/SessionContext';
import {CtaButton} from './CtaButton';
import {SignInDialog} from './SignInDialog';
```

`useIsSignedIn` is already imported from the same context module; keep it — `DesktopNav` still uses it for the `requiresAuth` filter.

- [ ] **Step 2: Add the component**

Insert directly ABOVE `function DesktopNav(` (after the `RevealsPill` component ends):

```tsx
/**
 * The header's rightmost slot: sign in when signed out, sign out when signed in.
 *
 * Renders NOTHING while `loading`, and that is deliberate. `user` is null during
 * that window, so the naive version shows "Sign in" and then swaps to "Sign out"
 * once auth resolves — the wrong state, flashed on every page load for every
 * returning user. Also renders nothing when auth is not configured at all
 * (`enabled: false`), which is how the app degrades without Supabase env.
 *
 * Calls useSession() directly rather than taking props. CompactHeader now RENDERS
 * auth, so depending on SessionProvider is honest — a throw outside one reports a
 * real mounting error. (Contrast useIsSignedIn, added the same day for DesktopNav,
 * which only REACTS to auth and must not demand a provider.) All 18 CompactHeader
 * call sites already sit under AppLayout's provider; the stories get a decorator.
 */
function HeaderAuth() {
  const {user, enabled, loading, signOut} = useSession();
  const [signInOpen, setSignInOpen] = useState(false);

  if (!enabled || loading) return null;

  return (
    <div style={{marginLeft: 'auto'}}>
      {user ? (
        <CtaButton variant="neutral" onClick={() => void signOut()}>
          Sign out
        </CtaButton>
      ) : (
        <CtaButton variant="ghost" onClick={() => setSignInOpen(true)}>
          Sign in
        </CtaButton>
      )}
      <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
```

`marginLeft: 'auto'` is what pushes it right. `DesktopNav` is `position: absolute; left: 50%`, so it is out of the flex flow — the header's actual flow is logo, then this, and nothing competes for the right edge.

No `style` override on either button: they are plain kit buttons at 14px/600/44px, matching the legibility pass.

- [ ] **Step 3: Render it**

In `export function CompactHeader`, the return currently reads:

```tsx
    <header data-testid="compact-header" style={getHeaderStyle(viewport)}>
      <HeaderLogo viewport={viewport} showBackArrow={showBackArrow} onClick={onLogoClick} />
      <DesktopNav isRevealSeason={isRevealSeason} />
      {headerActions}
    </header>
```

Add one line after `<DesktopNav …/>`:

```tsx
      <HeaderAuth />
```

Leave `{headerActions}` where it is.

- [ ] **Step 4: Verify it compiles**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: exit 0.

`useState` is already imported in this file (`DesktopNav` uses it for hover state) — confirm rather than assume:

```bash
head -1 apps/web/src/shared/components/CompactHeader.tsx
```
Expected: `import {type ReactNode, useState} from 'react';`

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/CompactHeader.tsx && USER_APPROVED=1 git commit -m "feat(header): sign in / sign out in the rightmost header slot (#463)"
```

The `&&` is required: `git add` failing must abort the commit, or a partial index commits silently.

---

### Task 2: Stories get a provider

**Files:**
- Modify: `apps/web/src/shared/components/CompactHeader.stories.tsx`

Without this, all four stories throw — `useSession()` requires a `SessionProvider` and the stories wrap in `MemoryRouter` alone. Run them BEFORE editing to see the failure, so the fix is verified rather than assumed.

- [ ] **Step 1: Watch it break**

```bash
pnpm --filter inkweave-web storybook
```
Open `http://localhost:6006/iframe.html?id=components-compactheader--default&viewMode=story`.

Expected: the story fails to render. The error names `useSession must be used within a SessionProvider`.

- [ ] **Step 2: Add the decorator**

Add the import:

```tsx
import {SessionProvider} from '../contexts/SessionContext';
```

Then replace the existing `decorators` array:

```tsx
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/browse']}>
        <Story />
      </MemoryRouter>
    ),
  ],
```

with:

```tsx
  decorators: [
    (Story) => (
      // CompactHeader renders auth (HeaderAuth), so it now genuinely requires a
      // SessionProvider — useSession throws without one. Storybook-safe: with no
      // Supabase env the provider yields enabled:false and resolves loading at once.
      //
      // NOTE the auth control's rendered state here is ENVIRONMENT-DEPENDENT.
      // Storybook runs on Vite and loads .env.local exactly as the app does, so on
      // a configured machine this shows "Sign in" and on CI it shows nothing.
      // These stories are not the review surface for that control; the running app
      // is, since a signed-in session cannot exist anywhere else.
      <MemoryRouter initialEntries={['/browse']}>
        <SessionProvider>
          <Story />
        </SessionProvider>
      </MemoryRouter>
    ),
  ],
```

- [ ] **Step 3: Watch it work**

Reload the same story URL. Expected: renders normally.

Check all four: `--default`, `--with-back-arrow`, `--mobile`, `--mobile-with-back-arrow`. (There were five until `de4ad640` retired `WithSearch` along with the header search bar.)

**Do NOT add a `SignedOut` story.** A story cannot stub `import.meta.env` the way `vi.stubEnv` does in vitest, so one claiming to show the signed-out control would be lying on half the machines that open it.

- [ ] **Step 4: Story coverage gate**

```bash
pnpm --filter inkweave-web run check:stories
```
Expected: `✅ Story coverage check passed.` (`HeaderAuth` is internal and not exported, so it needs no story of its own.)

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/CompactHeader.stories.tsx && USER_APPROVED=1 git commit -m "test(header): CompactHeader stories get a SessionProvider (#463)"
```

---

### Task 3: `DecksPage` gives up auth

**Files:**
- Modify: `apps/web/src/pages/DecksPage.tsx`

- [ ] **Step 1: Delete the auth block**

Remove this entire block from inside the header `<div>` — both conditionals:

```tsx
          {enabled && !loading && user && (
            <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
              <span style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textMuted}}>
                {user.email ?? 'Signed in'}
              </span>
              <CtaButton variant="neutral" onClick={() => void signOut()}>
                Sign out
              </CtaButton>
            </div>
          )}
          {enabled && !loading && !user && (
            <CtaButton variant="ghost" onClick={() => setSignInOpen(true)}>
              Sign in
            </CtaButton>
          )}
```

The wrapping `<div style={{display: 'flex', justifyContent: 'space-between', …}}>` now holds only the `<h1>`. Leave it: `space-between` on a single child is harmless, and `/decks` will gain a deck-count or filter control in that row with #473.

- [ ] **Step 2: Delete the dialog and its state**

Remove:

```tsx
        <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
```

and:

```tsx
  const [signInOpen, setSignInOpen] = useState(false);
```

and:

```tsx
  const {user, enabled, loading, signOut} = useSession();
```

- [ ] **Step 3: Let the compiler find the dead imports**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```

Expected: errors naming unused imports. Remove exactly what it names. Based on the current file that will be `useState`, `useSession`, `SignInDialog`, `CtaButton`, and possibly `FONT_SIZES` / `FONTS` / `COLORS` — but **delete only what tsc reports**, since the `<h1>` and the description paragraph still use several of them.

Re-run until exit 0.

- [ ] **Step 4: Confirm nothing else referenced them**

```bash
grep -n "signInOpen\|SignInDialog\|useSession\|signOut" apps/web/src/pages/DecksPage.tsx
```
Expected: no output.

```bash
grep -rn "SignInDialog" apps/web/src --include=*.tsx | grep -v "SignInDialog.tsx\|SignInDialog.stories"
```
Expected: one line only — the new import in `CompactHeader.tsx`. `DecksPage` was previously the sole consumer; that ownership has moved.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/pages/DecksPage.tsx && USER_APPROVED=1 git commit -m "refactor(decks): auth moves to the header, page keeps its content (#463)"
```

---

### Task 4: E2E — the control is really there

**Files:**
- Modify: `apps/web/e2e/tests/navigation.spec.ts`
- Modify: `apps/web/e2e/E2E_TESTS.md`

The Playwright run has no Supabase session, so it exercises the **signed-out** path: `enabled` is true (the webServer inherits env) and `user` is null, so "Sign in" renders.

- [ ] **Step 1: Add the test**

Append inside the existing `test.describe('Desktop nav', …)` block in `apps/web/e2e/tests/navigation.spec.ts`:

```ts
  test('the header carries a sign-in control on every page', async ({page}, testInfo) => {
    // Desktop-only: CompactHeader returns null on mobile, where auth has no entry
    // point yet (recorded gap in the header-auth design doc).
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const header = page.getByTestId('compact-header');

    // Two unrelated pages, to prove it is the header carrying this and not the page.
    for (const path of ['/browse', '/playstyles']) {
      await page.goto(path);
      await expect(header.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });
```

- [ ] **Step 2: Free port 5173 and run it**

Playwright reuses any server already on 5173 instead of starting its own, which makes the run non-deterministic. Check first:

```bash
netstat -ano | grep :5173
```
If something is listening, stop it before continuing.

```bash
pnpm --filter inkweave-web exec playwright test navigation --project=chromium
```
Expected: 2 passed (this test plus the existing Decks-reachability one).

If it fails, READ the screenshot at `apps/web/test-results/<test-name>-chromium/test-failed-1.png` before theorising — the documented triage step in `apps/web/e2e/E2E_TESTS.md`.

- [ ] **Step 3: Prove it fails shut**

A test that cannot fail is worthless. Temporarily change `'Sign in'` to `'Sign in-nope'`, re-run, confirm a real failure, then revert and confirm green again.

- [ ] **Step 4: Update the inventory**

In `apps/web/e2e/E2E_TESTS.md`, find the `## navigation.spec.ts` section added earlier and update its heading count from `1 test` to `2 tests`, add a row to its table:

| the header carries a sign-in control on every page | `/browse` and `/playstyles` both show a "Sign in" button inside `compact-header` |

and bump the file-header totals from `108 tests across 18 spec files` to `109 tests across 18 spec files`.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/e2e/tests/navigation.spec.ts apps/web/e2e/E2E_TESTS.md && USER_APPROVED=1 git commit -m "test(header): the sign-in control is present on every desktop page (#463)"
```

---

### Task 5: Verify and show the owner

**Files:** none — verification only.

- [ ] **Step 1: Full suite and gates**

```bash
pnpm test:web
pnpm --filter inkweave-web run check:stories
pnpm --filter inkweave-web run check:design
pnpm --filter inkweave-web lint
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: 150 files / 1065 passed / 3 skipped; both gates pass; lint `0 errors` (17 pre-existing warnings); typecheck exit 0.

- [ ] **Step 2: Check for spacing violations the disabled rule cannot show**

`inkweave/no-raw-spacing` is `'off'`, so a green lint run says NOTHING about spacing. Measure directly:

```bash
sed -i "s|'inkweave/no-raw-spacing': 'off'|'inkweave/no-raw-spacing': 'error'|" apps/web/eslint.config.js
pnpm --filter inkweave-web exec eslint src/shared/components/CompactHeader.tsx src/pages/DecksPage.tsx
git show HEAD:apps/web/eslint.config.js > apps/web/eslint.config.js
```
Expected: no `no-raw-spacing` findings, then a clean `git diff --stat apps/web/eslint.config.js`.

(`marginLeft: 'auto'` is a keyword, not a length, so it is not a spacing violation.)

- [ ] **Step 3: Read the rendered control back**

Start the dev server, open `/browse`, and evaluate in the page:

```js
const h = document.querySelector('[data-testid="compact-header"]');
const b = [...h.querySelectorAll('button')].filter(x => /Sign in|Sign out/.test(x.textContent));
JSON.stringify(b.map(x => {
  const c = getComputedStyle(x), r = x.getBoundingClientRect();
  return {label: x.textContent.trim(), size: c.fontSize, weight: c.fontWeight,
          height: Math.round(r.height), rightEdge: Math.round(window.innerWidth - r.right)};
}))
```
Expected: one button, `14px` / `600` / `44` tall, sitting near the right edge (`rightEdge` roughly equal to the header's 32px padding).

- [ ] **Step 4: Exercise it**

Click "Sign in" and confirm `SignInDialog` opens; press Escape and confirm it closes and focus returns. That is the `DialogShell` contract, inherited unchanged — verify it survived the move rather than assuming.

- [ ] **Step 5: Confirm `/decks` lost nothing it needed**

Open `/decks`. Expected: the `Your Decks` heading, the description, and `+ New deck` — with NO sign-in/out block, and the auth control now in the header above it instead.

- [ ] **Step 6: Visual check-in**

Screenshot the header on `/browse` and `/decks` and show the owner before considering this done. Per the Visual Iteration Protocol, self-verification catches mistakes but does not replace the design check-in.

**State plainly which states were actually seen.** The signed-out control is verifiable locally; "Sign out" requires a real signed-in session and may not be. Report which one was observed rather than implying both.

---

## Self-review notes

**Spec coverage.** The control and its four states → Task 1. Session access + story decorator → Tasks 1-2. `DecksPage` losing all four concerns → Task 3. E2E → Task 4. Gates and rendered verification → Task 5. The "stories are not the review surface" ruling → Task 2 Step 3 (no `SignedOut` story) and Task 5 Step 6 (state what was seen).

**Deliberately not covered**, per the spec's "Recorded, not solved": mobile has no auth entry point; `headerActions` stays a dead prop; no email is displayed anywhere now. All three are noted in the File Structure section so their absence reads as a decision.

**Type consistency.** `HeaderAuth` takes no props and is referenced only in Task 1 Steps 2-3. `SignInDialog`'s existing `{isOpen, onClose}` signature is used unchanged. `useSession()`'s destructured fields (`user`, `enabled`, `loading`, `signOut`) all exist on `SessionContextValue`.

**Ordering matters.** Task 2 must follow Task 1 — the stories only break once `HeaderAuth` exists, and Task 2 Step 1 depends on seeing that break. Task 3 can follow either, but is written to assume the header already works so `/decks` is never without auth mid-sequence.
