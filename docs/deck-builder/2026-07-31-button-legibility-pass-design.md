# Button legibility pass — design

**Date:** 2026-07-31
**Issue:** none yet (to be drafted)
**Related:** #508 (design-token enforcement), #544 (typography tokenization), #511 (spacing sweep)

## Problem

Buttons carrying muted-grey text read as thin and hard to scan. The owner's words:
weight 600 works for that grey on buttons but not for body text, and "some buttons
are hard to read due to the small font size too."

**Contrast is not the cause.** `COLORS.textMuted` (`#90a1b9`) measures comfortably
above WCAG AA on every ground it lands on:

| On | Ratio | |
|---|---|---|
| `background` `#0d0d14` | 7.36:1 | above AAA (7.0) |
| `surface` `#1a1a2e` | 6.49:1 | above AA (4.5) |
| `surfaceRaised` `#1e1e35` | 6.18:1 | above AA |

What makes it *feel* unreadable is **12–13px at weight 500**: thin stems at small
sizes on a dark ground, where anti-aliasing erodes the strokes. This is the same
problem the desktop nav had, and raising it to 14px/600 (`410d828c`) visibly fixed
it.

That matters for scoping: the fix is size and weight, **not colour**. Changing
`textMuted` would disturb 188 references across 91 files, most of which are not
buttons.

## Scope

**In:** the six shared kit components — `CtaButton`, `Chip`, `TabList`,
`LinkButton`, `FiltersButton`, `IconButton`.

**Out, by owner ruling:** body text, labels, counts, captions, metadata — anything
not a kit button. Also out: the domain-exempt families that behave like buttons but
are not kit components (quantity steppers, vote pickers, tile toggles), which
`no-adhoc-buttons` lists explicitly.

## The rule

> **Every button in the kit renders at `FONT_SIZES.lg` (14px), weight 600.**

That is the default, and it is stated as one sentence on purpose: a kit whose rule
can be recalled without opening a table survives contact with future contributors.

It is not exception-free, and pretending otherwise would be the wrong kind of tidy.
There are exactly **two** carve-outs, both listed below with their reasons, and
both are *additive* to the rule rather than contradictions of it: one raises a
weight above the default, one preserves an opt-in size a caller asked for. Any
third exception should be treated as evidence the rule is wrong, not as another row.

| Component | Now | After |
|---|---|---|
| `CtaButton` base | 13px / 500 | **14px / 600** |
| `CtaButton` `filled` | 13px / 600 | 14px / 600 (weight already present) |
| `TabList` inactive | **12px** / 500 | 14px / 600 |
| `TabList` active | 12px / 700 | 14px / **700** — exception 1 |
| `Chip` toggle | 13px / 500 | 14px / 600 |
| `Chip` dismiss ✕ | 13px / 600 | 14px / 600 |
| `LinkButton` `base` | 13px / 500 | 14px / 600 |
| `LinkButton` `sm` | 11px / 500 | **unchanged** — exception 2 |
| `FiltersButton` | inherits `CtaButton` | inherits |
| `IconButton` | no text | unchanged |

### Exceptions, and why each earns its place

1. **`TabList` active keeps 700.** It sits one step above its siblings today.
   Flattening it to 600 immediately after raising the inactive tabs would delete
   the active tab's weight cue at exactly the moment its neighbours got heavier.
2. **`LinkButton size="sm"` (11px) stays.** `size` is an opt-in prop a caller chose
   for a tight space. Overriding it would make the prop a lie.
3. **`CTA_FILLED_STYLE` KEEPS its `fontWeight: 600`, and the base gains 600 too.**

   The tempting move is to delete the weight from the filled recipe now that 600 is
   universal — one variant should not carry what the others inherit. **That would
   break the header.** `CompactHeader`'s `RevealsPill` is a `NavLink`, not a
   `CtaButton`: it spreads `CTA_FILLED_STYLE` and sets its own `fontSize`, but no
   `fontWeight`. It relies entirely on the recipe supplying 600. Removing it drops
   the pill to `:root`'s 400 silently — no error, no failing test, just a lighter
   pill nobody notices.

   So the duplication is load-bearing: `CTA_FILLED_STYLE` must stay self-sufficient
   because a non-button consumes it. Verified 2026-07-31 — the recipe has three
   consumers: `CtaButton`'s `filled` and `pill` variants, and `CompactHeader:203`.

   *(This corrects an earlier version of this spec, which called for the move. It
   was wrong.)*

## Density: measured, not assumed

The obvious worry is that wider text pushes `Chip` rows (22 call sites, often
horizontal) into wrapping. Measured in a mockup with nine chips — the full ink +
type filter set:

| Variant | Row width | Free space right |
|---|---|---|
| current (13px/500) | 684px | 1732px |
| **14px/600** | 743px | 1673px |
| 13px/600 | 711px | 1705px |

14px costs **59px, +8.6%**, on a row with over 1600px of slack. The chip row would
need to be roughly four times longer before that mattered. A tiered variant
(chips held at 13px) was drafted and **rejected**: it saved 32px nobody needed, and
its chips visibly lagged its own buttons, reading as an inconsistency rather than a
considered exception.

## Implementation shape

Six components, one edit each. Call sites inherit; none change.

Call sites passing their own `style` still win, because the kit merges caller
`style` last. That is deliberate and stays: anything deliberately sized remains
sized.

The known case is `DeckActionsBar`'s `ACTION_STYLE`, which pins `minHeight: 32` and
`FONT_SIZES.md` for the deck toolbar. It will now render visibly smaller than the
new kit default. **Required action, concretely:** after the kit change lands,
screenshot the deck toolbar and show the owner beside a default-sized button, then
stop. Do not adjust `ACTION_STYLE` in this work — it is a deliberate size choice
from `89b9b833`, and overriding it without a ruling would silently reverse a
decision made three commits ago.

## Testing

- Storybook story per component, existing ones unchanged in count.
- `getComputedStyle` read back for each — a declared weight is not a rendered one
  (`font-synthesis: none` is set on `:root`; a weight with no loaded face silently
  falls back to the nearest that exists). 600 has a self-hosted face, so this
  passes — but it is checked, not assumed.
- `no-raw-font-size` stays clean: `FONT_SIZES.lg` is a token.
- `no-unloaded-font-weight` stays clean: 600 is loaded.
- Full suite + `check:stories` + `check:design` + E2E.

**Checked, 2026-07-31:** no E2E uses `toHaveScreenshot`/`toMatchSnapshot`, and no
test in `e2e/` or `src/` asserts on a button's `fontSize`/`fontWeight`. The single
typography assertion in the codebase is `AbilityTag.test.tsx:26`
(`expect(tag.style.fontSize).toBe('16px')`) — `AbilityTag` is a tag, not a kit
button, and is out of scope. So no existing test constrains this change; all E2E
button selectors are text-based (`getByRole('button', {name})`).

## Scope extension (owner ruling, same day — supersedes the note below)

The pass was scoped to the six kit components, with call-site overrides explicitly
out. After seeing the result the owner extended it:

1. **The deck toolbar loses `ACTION_STYLE` entirely.** Its three buttons become
   plain kit buttons — 44px, 14/600, kit padding and gap — matching the landing
   CTAs. The override is not trimmed, it is deleted, so nothing is left to drift.
2. **`/decks`'s "+ New deck" becomes the same filled CTA.** It stays a `<Link>`,
   not a `CtaButton`: it navigates, so middle-click, open-in-new-tab and
   crawlability all matter. It previously hand-rolled a flat `COLORS.primary` with
   no gradient, shadow, hover or press.
3. **`CTA_BASE_STYLE` is extracted** into `ctaStyles.ts` beside `CTA_FILLED_STYLE`.
   Point 2's first attempt hand-copied `CtaButton`'s base metrics into `DecksPage`
   — lint-clean once tokenised, and still a second copy that would silently stop
   tracking the kit. The base now lives in one place and both the button and the
   anchor spread it. `display` stays with each consumer: `CtaButton` needs `flex`
   (block-level, so `margin: 0 auto` centres it — `AppLayout`'s retry button relies
   on that), an inline anchor wants `inline-flex`.

**Call-site overrides that remain, deliberately.** Six `CtaButton` call sites still
pin `fontSize` and so did NOT get 14px: `SuggestionList` (12px — parked advisor
code, renders nowhere), `DecksPage`'s Sign in (13px) and Sign out (12px), and the
three admin pages (11px each). The admin pages are internal tools where dense
buttons are a reasonable choice. `DecksPage`'s two are a live inconsistency on a
page whose own primary button is now 14px, and are the obvious next candidates.

## Recorded, not solved

- **`ACTION_STYLE`** — resolved by the ruling above; the original note read "review
  it, do not change it", which the owner overrode after seeing it rendered.
- This is a **design change**, distinct from #544, which tokenizes `fontWeight`
  with explicitly zero visual change. Doing this first means #544 renames the new
  values rather than the old ones — no extra churn, but the two must not be
  conflated.
