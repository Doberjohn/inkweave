# Desktop nav redesign — design

**Date:** 2026-07-31
**Issue:** none yet (to be drafted; the nav gap is covered by no existing issue)
**Related:** #452 (Phase 2 — Collection), #454 (Phase 4 — Social Layer), #544 (typography tokens)

## Problem

`/decks` is unreachable from the desktop UI. The mobile bottom nav has carried a
Decks tab all along (`MobileBottomNav.tsx`, both the reveal-season and off-season
tab sets), but the desktop header never gained one — so on desktop the entire deck
builder is reachable only by typing the URL.

The gap is invisible to every automated gate in the repo. It lints, typechecks,
tests and E2Es clean, because "no link points here" is not a defect any of them
can express.

Fixing it exposes a second problem. The desktop nav is a bordered capsule holding
three items, absolutely centred between a pinned logo and the search box. Adding
Decks makes four; Collection (#452) makes five; the seasonal Reveals pill sits
beside them. The capsule's chrome makes that feel crowded well before the space
actually runs out.

## Scope

**In:** the desktop nav inside `CompactHeader` — visual treatment, item list, and
support for auth-gated items.

**Out, deliberately:**

- **Mobile bottom nav.** Unchanged. It already carries Decks, and whether it
  should also carry Collection is a separate question about a nav that already
  has five tabs.
- **The Decks page.** "Community/public decks with a switch to my decks" is its
  own project — it needs public decks to exist, be shareable, and have read
  policies (Phase 4 Social Layer, #454). It is cleanly independent: the nav links
  to `/decks` whatever that page becomes, so nothing here blocks or presumes it.
- **Account / sign-in UI in the header.** The header has no auth awareness today;
  account controls live inside `DecksPage`. Worth fixing, but it is not what was
  asked for and would roughly double this change.

## Visual specification

| | Current | Target |
|---|---|---|
| Container | capsule: `1px solid surfaceBorder`, `background`, `RADIUS.lg`, `overflow: hidden`, `height: 38` | none — bare links |
| Font size | `FONT_SIZES.base` (13) | `FONT_SIZES.lg` (14) |
| Font weight | 500; 600 when active | **600 always** |
| Default colour | `COLORS.textMuted` | unchanged |
| Hover | `COLORS.primary` + `GOLD_GLOW.hoverBg` + `GOLD_GLOW.shadow` | **`COLORS.primary` only** |
| Active | `COLORS.primary` + `COLORS.surfaceHover` background | **`COLORS.primary` + 2px `COLORS.primary` underline** |
| Item spacing | per-item `padding: 0 14px` inside the capsule | `SPACING.xl` (20) gap between links |

`getNavItemBackground` and `getNavItemBoxShadow` are deleted — with no chrome,
neither has anything to return. `getNavItemColor` survives.

The Reveals pill is untouched: same gradient, radius, NEW badge, and position
beside the links.

### Why the underline is not optional

Stripping the background removes the active page's only structural cue, leaving
colour alone to carry it. That is weak as a position signal and fails WCAG 1.4.1
(information conveyed by colour alone). A 2px underline restores the cue at
negligible visual cost. A dot was evaluated and rejected: at 4px it reads as a
rendering artefact rather than a marker.

14px was chosen over 16px so the nav stays subordinate to the logo in the
hierarchy. 16px was legible but began competing for attention.

Font weight 600 is a raw numeric literal. No `FONT_WEIGHT` token exists yet
(#544); this matches the existing precedent in `CTA_FILLED_STYLE`. When #544
lands, both convert together.

## Nav model

`NAV_ITEMS` becomes four public entries:

```
/browse      Browse
/playstyles  Playstyles
/vote        Vote
/decks       Decks
```

Decks is public, not auth-scoped, because the Decks page is intended to show
community decks with a switch to the signed-in user's own. That makes it a peer
of Browse/Playstyles/Vote rather than personal-area content.

`NavItem` gains an optional `requiresAuth?: boolean`, and the list is filtered
against `isSignedIn` before render.

**No item sets `requiresAuth` in this change.** `/collection` has no route and no
page — it is Phase 2 (#452). Shipping the item now would link signed-in users to
the 404 page. When #452 lands, adding Collection is a single list entry.

**Accepted cost, stated plainly:** with no gated item, the filter is unexercised
machinery until #452. Signed-in and signed-out render identically, so no story can
prove the filter works — a `SignedIn` story would be indistinguishable from
`Default`. This is the known price of building the gating ahead of its first
consumer, taken deliberately so Collection is a one-line addition later. The
alternative (add the filter together with Collection) would be defensible YAGNI;
it was not chosen.

Two consequences follow, and both are requirements:

1. The filter must be trivial enough to be correct by inspection: a single
   `.filter()` over the list, no branching.
2. `useIsSignedIn` itself IS directly testable without a gated nav item, and must
   be unit-tested — both inside a provider and, critically, outside one (its whole
   reason for existing is not throwing there). That test is the only real coverage
   this mechanism gets before #452.

## Component API

`SessionContext.tsx` exports a new hook:

```ts
/** Signed-in state for components that REACT to auth without REQUIRING it.
 *  Returns false outside a SessionProvider instead of throwing (cf. useSession). */
export function useIsSignedIn(): boolean
```

`DesktopNav` calls it and filters `NAV_ITEMS`. `CompactHeader` gains no new prop.

### Why a hook, and why a new one

Two obvious alternatives were measured and rejected.

**A prop threaded from the call site.** `CompactHeader` is rendered at **18 sites**
across 13 files — it is not rendered by `AppLayout` at all. Threading `isSignedIn`
through all of them makes correctness depend on every page remembering to pass it,
and a page that forgets silently hides the nav item. That is the same
copy-the-value-and-hope drift this milestone has spent its time removing.

**Calling the existing `useSession()` inside the header.** It throws outside a
`SessionProvider`, and `CompactHeader.stories.tsx` wraps in `MemoryRouter` only —
so this breaks all five stories and the `check:stories` gate. It could be fixed by
adding a provider decorator (`SessionProvider` is Storybook-safe: with no Supabase
env it resolves `loading` immediately and yields `user: null`), but that makes the
header permanently *require* an auth provider it does not depend on. Every future
consumer would inherit that requirement.

`useIsSignedIn` avoids both. It reads the same context and returns `false` when
absent, so the header stays provider-optional, the stories need no decorator, and
no call site changes. `SessionContext` is currently module-private, so the hook
must live in `SessionContext.tsx` beside it.

This matches the precedent already in the file: `CompactHeader` calls
`useRevealPhase()` internally, a hook that reads a cache and needs no provider.

## Testing

**Stories** (`CompactHeader.stories.tsx`) — the existing five (`Default`,
`WithBackArrow`, `WithSearch`, `Mobile`, `MobileWithBackArrow`) keep working
unchanged, and are the real regression net for this change: they cover the bare
links, the active underline, and the header at both viewports.

No `SignedIn` story is added. With nothing gated it would render identically to
`Default`, and a story that cannot fail is worse than no story — it implies
coverage that does not exist. It arrives with Collection in #452.

**E2E** — one spec touches this nav: `reveals-page.spec.ts:74` queries
`Main navigation` for the Reveals link; adding Decks does not affect it. Add an
assertion that Decks is reachable from the desktop nav, since that is the actual
defect being fixed. Update `apps/web/e2e/E2E_TESTS.md` accordingly.

**Design gates** — `FONT_SIZES.lg` and `SPACING.xl` are tokens, so
`no-raw-font-size` and the value gate stay clean. `CompactHeader.tsx` was removed
from the `no-raw-duration` ledger earlier today (`1da74c47`) and must stay clean:
any new transition uses `DURATION.*`.

## Recorded, not solved

When Collection eventually ships behind `requiresAuth`, `useSession()` returns
`user: null` while `loading` is true, so the item appears only after auth
resolves. Because the nav is `position: absolute; left: 50%`, that appearance
shifts the entire bar sideways on first paint.

Not an issue in this change — nothing is gated, so the item count is stable. It
is recorded here so it is not rediscovered as a bug when #452 adds the item. The
options at that point are: gate on `!loading && user` and accept one shift, or
reserve the item's width while loading.

## Out-of-scope findings worth acting on separately

- **#208 "Dreamborn Import / Text Export" is stale.** Its entire checklist —
  parse `Nx Card Name - Title`, match against the database, report failed lines,
  validate rules, text export — was delivered under #473. It should be closed or
  reconciled. Note it concerns *decklists*, which is a different feature from the
  *collection* CSV import in #452.
- **Desktop and mobile nav sets have diverged.** Mobile carries Search and Decks
  and swaps Reveals/Vote by season; desktop carries Vote permanently and neither
  of the other two. This change closes the Decks half of that gap. Whether the
  two should converge further is an open question, not addressed here.
