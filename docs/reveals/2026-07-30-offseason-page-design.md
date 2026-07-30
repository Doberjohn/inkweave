# Off-season /reveals page: design

**Status:** agreed with the owner 2026-07-30.

## Problem

`/reveals` redirects to `/` whenever the reveal phase is `hidden` or `released`
(`RevealsGate`). A visitor arriving from a bookmark, a shared link, or search
lands on the homepage with no explanation, and cannot tell whether the page moved,
broke, or is simply out of season.

This was found while trying to visually verify the 2026-07-30 ink repalette on
`/reveals`: the route bounced to `/`, and the cause turned out not to be the flag.
`VITE_IS_REVEAL_SEASON` is `true`; Set 13 "Attack of the Vine!" released
2026-07-24, so the phase is `released`.

## Decisions

| Decision | Chosen | Rejected |
|---|---|---|
| States | Two, in one component: `released` names the set, `hidden` does not | A single generic message; a released state that also links to the set in Browse |
| Hero anchor | None; the page starts at the title | A large gradient glyph; a large gradient word |
| Design reuse | Extract a shared shell used by both this page and the 404 | Duplicating the decoration; skipping it entirely |
| SEO | `noindex` while off-season | Permanently indexable |

**Why no hero anchor.** The 404's giant numeral earns its size because it *is* the
error code. A decorative glyph or invented word in that slot carries no
information, and it would make an ordinary out-of-season state look like a failure.

**Why a large gradient word was rejected outright.** It needs uppercase to work at
that size, and the 2026-07-29 hero-type ruling dropped uppercase treatment
(Marcellus + shared `PageTitle`, no uppercase). Reinstating it here would need the
owner to overturn that ruling first.

**Why the nav does not change.** `CompactHeader` and `MobileBottomNav` keep
omitting Reveals outside season. A nav entry pointing at "nothing here right now"
is worse than no entry; the page exists for people who arrive by other means.

## Architecture

`RevealsGate` already computes the phase and then discards it by redirecting. The
change is local to the gate:

```
phase 'hidden' | 'released'        -> <RevealsOffSeason phase={phase} />
phase 'loading' | 'pre-release'
      | 'pre-release-live'         -> children            (UNCHANGED)
```

`'loading'` must keep falling through to children. It means the flag is on but the
reveal dates have not resolved yet, and the existing comment records that letting
children mount avoids a race-redirect. That is easy to break by restructuring the
conditional, and it has no test today.

### Files

| File | Change |
|---|---|
| `shared/components/FullPageNotice.tsx` | **new** — the extracted shell |
| `shared/components/FullPageNotice.stories.tsx` | **new** (`check:stories` requires it) |
| `features/reveals/RevealsOffSeason.tsx` | **new** — phase-varying copy |
| `features/reveals/RevealsOffSeason.stories.tsx` | **new** |
| `features/reveals/RevealsGate.tsx` | render the notice instead of `<Navigate>` |
| `features/reveals/revealDates.ts` | `RevealDates` gains the set `name` |
| `pages/NotFoundPage.tsx` | consume the shell |

### `FullPageNotice`

Owns everything both pages share: the centered full-height `<main>`, the
`EtherealGlow` / `SparkleField` / `BrandWatermark` decorative layers (today private
to `NotFoundPage.tsx`), the gold gradient divider, the hero-serif title, two prose
lines, and the CTA.

Props: a `title`, exactly two prose `lines`, and a CTA `label` + handler. An
optional `hero` slot renders above the divider so `NotFoundPage` can keep its
gradient `404` numeral; `RevealsOffSeason` passes nothing, which is the
title-first decision above.

**`<Seo>` stays in each page, not in the shell.** The two differ in title,
`canonicalPath` and (in principle) `noindex`, and burying SEO inside a
presentational shell would hide it from the page that owns the route.

### `revealDates.ts`

`RevealDates` gains `name: string`, read from the same `sets['13']` object the
dates already come from (`previewCards.json`). Additive; the existing null-return
behaviour when the set or its dates are missing is unchanged.

## Copy

**`released`**
- Title: "Reveal season has ended"
- "Attack of the Vine! released on 24 July 2026." (set name and date from `RevealDates`)
- "The spoiler board is closed until the next set."

**`hidden`**
- Title: "No reveal season right now"
- "Card reveals appear here when the next set's spoiler season begins."
- "Until then, the full Core catalogue is a click away."

Both CTAs read **Return to Inkweave** and navigate to `/`, matching the 404.

**The `released` copy can rely on the dates being present, and no fallback is
needed.** `computePhase` returns `'loading'` before it ever returns `'released'`
when `dates` is null (`if (!dates) return 'loading'` precedes the date
comparisons), so phase `released` implies a non-null `RevealDates`. An earlier
draft of this spec specified a fallback to the `hidden` wording for that case;
it would have been unreachable code guarded by a test that could never fail.

The type does not express that guarantee, so `RevealsOffSeason` still has to accept
the possibility structurally. It should read the set name from the resolved dates
and, if they are somehow absent, render the `hidden` wording — but as a plain
defensive default, not a specified behaviour with a test.

## Verification

**Unit.** No test exists for `RevealsGate`, `revealDates`, or `NotFoundPage` today,
so these are all new:

- `RevealsGate`: renders the notice for `hidden` and for `released`; renders
  children for `pre-release`, `pre-release-live`, **and `loading`**. The last is
  the race-guard named above and is the one worth locking.
- `RevealsOffSeason`: the `released` state names the set and its date; the `hidden`
  state does not. Do NOT test the null-dates path in the `released` state: it is
  unreachable, per the note in the Copy section.
- `FullPageNotice`: renders the title and both lines, and fires the CTA handler.

**Stories.** New ones for `FullPageNotice` and `RevealsOffSeason` (both `hidden`
and `released`). `NotFoundPage.stories.tsx` already exists and must keep rendering
after the extraction.

**Story-coverage exclusion.** `check-story-coverage.mjs` excludes
`RevealsGate.tsx` with the comment "route gate: renders children or a redirect, no
visual surface". The exclusion stays correct, because the gate still delegates its
visual surface to a component that has its own story, but the comment's wording
becomes stale and should be updated to say so.

**Visual.** Re-verify the 404 in a real browser after the extraction. It has a
story but no test, so a refactor of its layout is otherwise unguarded. Then check
both off-season states. Note the in-app preview pane cannot do this: it does not
composite, so screenshots time out and hover/transition-driven UI is unreachable.
Use the Chrome extension.

**How to reach each state locally.** `released` is the current default (Set 13 is
out). `hidden` needs `VITE_IS_REVEAL_SEASON` unset or false in
`apps/web/.env.local`, and Vite must be restarted, since `.env.local` is read at
boot. Do not rely on `playwright.config.ts`'s `webServer.env`: with
`reuseExistingServer` true locally, Playwright adopts whatever already serves 5173.

## Out of scope

- **Any change to the reveals page itself**, or to the phase boundaries in
  `computePhase`. Only the off-season branch changes.
- **Nav visibility.** Deliberately unchanged, per the decision above.
- **A Browse link for the released set.** Considered and rejected: it adds a second
  CTA and diverges from the 404's single-button shape.
