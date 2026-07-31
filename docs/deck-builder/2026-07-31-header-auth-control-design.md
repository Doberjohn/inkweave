# Header auth control — design

**Date:** 2026-07-31
**Issue:** none yet (to be drafted)
**Related:** #463 (auth), #466 (`/decks` scaffold), #452 (Phase 2 — the first `requiresAuth` nav item)

## Problem

Signing in and out is only reachable from `/decks`. A user on any other page has no
way to tell whether they are signed in, and no way to act on it — the convention
almost every site follows is a persistent auth control at the far right of the
header, and Inkweave has none.

`CompactHeader` has **zero** auth awareness today: no `useSession`, no avatar, no
sign-in. The controls live inside `DecksPage`, which is also the only consumer of
`SignInDialog`.

Success: the auth state is visible and actionable from every desktop page, and
`DecksPage` is no longer the custodian of app-wide auth UI.

## Scope

**In:** a right-aligned auth control in `CompactHeader` (desktop), and the removal
of the equivalent block from `DecksPage`.

**Out, by owner ruling:**

- **Mobile.** `CompactHeader` returns `null` on mobile; chrome lives in
  `MobileBottomNav`, which already carries five tabs with no obvious room. Mobile
  keeps reaching auth through the deck flow. Recorded as a gap, not solved badly.
- **An account menu.** A dropdown holding email, Collection, settings and sign-out
  is where this eventually goes, but it needs the overlay contract (focus trap,
  Escape, scrim) and a reason to exist beyond one action. One button is enough for
  one action.
- **The email display.** `/decks` shows the address beside the button today; it is
  dropped rather than moved. The user knows who they are, and a long address
  crowds a header on every page.

## The control

A new internal subcomponent, `HeaderAuth`, in `CompactHeader.tsx` beside
`HeaderLogo` and `DesktopNav`. It owns the `signInOpen` state and renders
`SignInDialog`.

| State | Renders |
|---|---|
| `!enabled` — Supabase not configured | nothing |
| `loading` | nothing |
| signed out | `<CtaButton variant="ghost">Sign in</CtaButton>` |
| signed in | `<CtaButton variant="neutral">Sign out</CtaButton>` |

Both are plain kit buttons — 14px/600/44px, no `style` override — consistent with
the legibility pass that just converged every button in the app.

**Rendering nothing while `loading` is deliberate.** `user` is `null` during that
window, so a naive implementation shows "Sign in", then swaps to "Sign out" once
auth resolves — the wrong state, flashed on every page load for every returning
user. The nav spec recorded this loading-window problem as deferred; here it is
visible enough to handle now.

**Placement:** after `<DesktopNav>` in the header, with `marginLeft: 'auto'`.

`DesktopNav` is `position: absolute; left: 50%`, so it is out of the flex flow
entirely — the header's actual flow is logo, then this. Nothing competes for the
right edge.

## Session access

`HeaderAuth` calls `useSession()` directly, and the five `CompactHeader` stories
gain a `SessionProvider` decorator.

### Why not a non-throwing hook

This morning `useIsSignedIn` was added precisely to avoid requiring a provider —
`useSession()` throws outside one, and `CompactHeader` is rendered at 18 call sites
whose stories wrap in `MemoryRouter` alone. The same reasoning does **not** apply
here, and the difference is the point:

- Then, the header merely **reacted** to auth (one boolean, to filter a nav item).
  Demanding a provider for that was disproportionate.
- Now it **renders** auth. That is a genuine dependency, and throwing outside the
  provider is correct — it reports a real mounting error rather than silently
  omitting the control.

All 18 call sites already sit under `AppLayout`'s `SessionProvider` at runtime.
Only Storybook does not, and one decorator fixes that. `SessionProvider` is
Storybook-safe: with no Supabase env it yields `enabled: false` and resolves
`loading` immediately.

The alternative — a `useOptionalSession()` returning `SessionContextValue | null` —
was rejected because it would make `useIsSignedIn` redundant
(`useOptionalSession()?.user != null` is the same thing). Two overlapping
optional-session hooks is worse than one decorator.

**Consequence, recorded:** once `CompactHeader` requires the provider,
`useIsSignedIn`'s provider-optional property no longer buys anything *inside this
component*. It stays — it is tested, has a consumer in `DesktopNav`, and removing
it is churn for no gain — but it is now belt-and-braces rather than load-bearing.
A future simplification could collapse both onto `useSession`.

## What `DecksPage` loses

All of it: both buttons, `SignInDialog`, the `signInOpen` state, and the
`useSession` call. The page keeps `+ New deck` and its content.

`DecksPage` is currently the only consumer of `SignInDialog`; that ownership moves
to the header. `SignInDialog` itself is unchanged — it already rides `DialogShell`,
so the overlay contract (focus trap, Escape, token scrim, backdrop-closes) comes
for free and this change does not touch it.

## Testing

**Stories** — the five existing `CompactHeader` stories gain a `SessionProvider`
decorator, so they do not throw.

**What those stories will show is environment-dependent, and that is a caveat, not
a feature.** `getSupabase()` reads `import.meta.env` at call time, Storybook has no
env config of its own, and Storybook runs on Vite — so it loads `.env.local` exactly
as the app does. On a machine with Supabase configured the control renders "Sign
in"; on CI, or a checkout without `.env.local`, it renders nothing (`enabled:
false`). Same leak that let a `SessionContext` test build a real client earlier
today.

Two consequences, both accepted:

1. **No `SignedOut` story.** A story cannot stub `import.meta.env` the way
   `vi.stubEnv` does in vitest, so a story claiming to show the signed-out control
   would be lying on half the machines that open it. Better absent than misleading.
2. **The stories are not the review surface for this control.** They exist so the
   header keeps rendering; the control's four states are verified in the running
   app, where a real session can actually exist. That is the only place "signed in"
   can be seen at all.

The alternative — splitting `HeaderAuth` into a container plus a presentational
view so stories could drive the states directly — was considered and rejected as
disproportionate machinery for one button with four trivial branches. Revisit if
this becomes an account menu.

**E2E** — assert the Sign in control is present in the header on a standard page
(`/browse`). Update `apps/web/e2e/E2E_TESTS.md`.

**Unit** — no new unit test. The stories cannot cover the states deterministically
(above), and a unit test would face the same obstacle from the other side: it would
need `vi.stubEnv` plus `_resetClient` to force `enabled`, then assert which of two
buttons rendered. That tests the four-line branch, not the behaviour that matters
(`signOut` actually ending a session), which needs a real Supabase session.

If this is wanted later, the honest shape is the container/view split noted above —
then the view is trivially testable without touching env at all.

**Gates** — kit buttons carry no `style` override, so nothing new to check against
`no-raw-font-size` or the value gate. `CompactHeader.tsx` is off the
`no-raw-duration` ledger as of `2aa4d854`, so any new transition must use
`DURATION.*`.

## Recorded, not solved

- **Mobile has no auth entry point.** The header returns `null` there. A signed-in
  mobile user cannot sign out except by reaching the deck flow. Accepted; revisit
  when `MobileBottomNav` is next redesigned.
- **`headerActions` is a dead prop.** Zero consumers, despite a doc comment naming
  "the filters button on CardPage". It is the natural slot for a right-side control
  and this change does not use it (the auth control is internal, not injected).
  It should be deleted, but that is a separate cleanup — deleting it here would mix
  an unrelated removal into an auth change.
- **No email display anywhere now.** `/decks` was the only place showing which
  account is signed in, and it is being removed. If that turns out to matter, the
  account-menu option is where it returns.
