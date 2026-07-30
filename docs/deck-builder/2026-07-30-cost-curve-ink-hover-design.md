# Cost-curve ink hover: design

**Status:** agreed with the owner 2026-07-30. Scope is the `CostCurveStrip` hover only.

## Problem

`CostCurveStrip` (the mini cost histogram at the top of the deck panel, shipped as
part of #468) stacks each bar into ink-colored bands, but the counts behind those
bands are unreadable. The only hover affordance is a native `title` on the whole
bar giving the bucket total ("9 cards at cost 3"), so a player can see that cost 3
is mostly Amber without ever learning how many Amber cards that is.

Dreamborn surfaces this on hover. The owner's ask: hovering a colored band shows
that ink's symbol and its card count.

## Decisions

Each was chosen against alternatives; the rejected options are recorded so a later
session does not reopen them by accident.

| Decision | Chosen | Rejected |
|---|---|---|
| Hover content | The hovered ink only: glyph, name, count | Full per-bucket breakdown; total header plus highlighted ink |
| Placement | Floating tooltip, portalled | Inline readout in the strip's spare top padding; per-breakpoint split |
| Thin bands | Minimum band height, shortfall absorbed from the largest band | Exact proportions with thin targets; a taller `CHART_HEIGHT` |
| Existing bar total | Removed | Kept as a tooltip second line; moved onto the axis label |

**Dual-ink cards: the plain count ships, and it will not add up.** Owner ruling
2026-07-30, made after a review surfaced it. `deckStats.tallyCard` counts a
dual-ink card toward BOTH of its inks, so a bucket of four Amber-Steel cards is
`{Amber: 4, Steel: 4}`: eight ink units on a bar of four cards, each band at
`pct: 50` and `count: 4`. The tooltip therefore reports "Amber 4" on a half-height
band of a four-card bar, and the two bands sum to eight.

Every one of those numbers is true: a dual-ink Amber-Steel card genuinely is an
Amber card, and "4" answers "how many cards here have Amber in them". The ruling is
to keep that, on the grounds that the count is honest and the alternative (a
half-card share matching the band height) would report a card count that does not
exist in the deck. The accepted risk is that a dual-ink-heavy bucket looks
arithmetically wrong at a glance. Rejected alternatives: annotating the tooltip
with a dual-ink tally (needs data `deckStats` does not produce, and a taller
tooltip); reporting the band's share instead of the count.

`InkSegment`'s doc comment states this explicitly, so the next reader does not
"fix" it into a share.

**Why segment-level content forced the floating tooltip.** These two decisions are
coupled. Segment-level content plus a *fixed* readout has an ambiguity hole: when
bands are only a few pixels tall, the readout gives a number with no way to confirm
which band the cursor actually hit. Precise targeting needs colocated feedback, so
the tooltip is the only placement that pairs with the chosen content.

**Why the bar's native `title` must go.** Native tooltips fire from ancestors, so
a segment-level custom tooltip would render immediately while the browser's own
tooltip appeared a second later, with different content, from one gesture.

## Changes

### `costCurveColumns.ts` (pure, unit-tested)

1. `InkSegment` gains `count: number` beside the existing `pct`. `inkSegments()`
   already computes the raw count on its way to the percentage and currently
   discards it; it now carries it through. `pct` stays exact.

No second pure function is needed. See below.

### The minimum band height is a CSS concern, not an arithmetic one

The floor is a physical hover-target size in pixels, but the chart area is
`flex: 1` with `minHeight: CHART_HEIGHT`, so its real pixel height is decided at
layout time by the enclosing panel. A pure `segmentPixelHeights(segments,
barHeightPx, minPx)` helper would therefore need a `ResizeObserver` just to learn
its own input. That is machinery the strip does not otherwise need, and
`ResizeObserver` is also the API that silently never fires in a non-compositing
preview, which would make the floor untestable in exactly the environment used to
check it.

Flexbox already implements the rule. Each band renders as a flex item with:

- `flex: ${seg.count} 1 0` — a grow factor proportional to the ink's count and a
  zero basis, so bands are sized in proportion to their counts.
- `minHeight: MIN_BAND_PX` — a floor the browser honors before distributing the
  remainder.

The browser then floors the small bands and shares what is left among the others
in proportion to their grow factors. That is the approved behavior, with the
shortfall spread proportionally across the unfloored bands rather than taken
solely from the largest. For the common two-ink bar the two are identical, and for
three or more the proportional spread is the better of the two.

**The degenerate case is prevented rather than handled.** A bar shorter than
`MIN_BAND_PX * bandCount` cannot satisfy every floor; flex items cannot shrink
below `min-height`, so they would overflow and the bar's `overflow: hidden` would
silently clip the topmost ink. The bar's own floor therefore rises from
`minHeight: col.count > 0 ? 2 : 0` to
`minHeight: col.count > 0 ? Math.max(2, MIN_BAND_PX * col.segments.length) : 0`,
which makes the overflow unreachable.

**Accepted cost of that floor:** a bar with very few copies is drawn slightly
taller than its true proportion, so the shortest bars understate how short they
are. This extends a tradeoff the component already made (nonzero bars were
already floored at 2px to stay visible) rather than introducing a new one.

`pct` remains on `InkSegment`, unused for sizing now, because the strip still uses
it to pick each bar's dominant ink for the glow.

### `shared/components/Tooltip.tsx`

`content` widens from `string` to `ReactNode` so it can hold an `InkIcon`.
Additive: existing string callers are unaffected, and `whiteSpace: 'pre-line'`
remains correct for them.

### `CostCurveStrip.tsx`

1. Remove the per-bar `title`.
2. Size each band with `flex: ${seg.count} 1 0` plus `minHeight: MIN_BAND_PX`,
   and raise the bar's own `minHeight` to `Math.max(2, MIN_BAND_PX *
   col.segments.length)` so the floors always fit.
3. Wrap each band in `Tooltip`. Content is the ink glyph at `ICON_SIZE.sm`, the
   ink name, and the count. `Tooltip` wraps its trigger in a `<span>`, which
   becomes the flex item inside the bar, so the band's height moves onto that span
   via `triggerStyle` and the band itself renders at `height: 100%`.
4. Each band gets `role="img"` and an `aria-label` of the form
   `"Emerald, 4 cards at cost 3"`. Bands stay non-focusable: this is a
   presentational strip, and 16 tab stops would be worse than none.
5. Update the component's doc comment, which currently states that copy counts
   live on the bar's hover title and that the strip carries no numeric labels.

**Anchoring: to the band, not the bar's top edge.** An earlier draft of this spec
said the tooltip should anchor above the bar's top edge so it always clears the
chart. That is not what the chosen component does: `Tooltip` positions relative to
its own trigger, and the trigger here is the band. Delivering bar-top anchoring
would mean adding an anchor-override prop to a shared component.

Band anchoring ships first, for two reasons. The chart area is only ~52px tall, so
the worst case puts the tooltip about 50px lower than bar-top anchoring would, not
halfway down the panel; and `Tooltip` already flips above/below on available
headroom, which handles the top-of-panel case. Whether the remaining occlusion of
the neighbouring costs actually reads as a problem is a judgement best made from
the built thing, at the owner visual review, rather than pre-empted with a prop
nobody has asked for. If it does read badly, add the anchor override then.

## Verification

**Unit** (`costCurveColumns.test.ts`, extending the existing file):
- `inkSegments` carries `count` for each present ink and still omits zero-count inks.
- `count` matches the input `costCurveByInk` entry exactly, including a lopsided
  bucket (8 Amber / 1 Emerald), so the tooltip's number is the real card count and
  not a rounded share of `pct`.

Note that moving the floor into CSS deliberately gives up unit-testable arithmetic
for it: jsdom does not lay out flexbox, so the floor cannot be asserted in a unit
test. That is the accepted trade for deleting the measurement machinery. It is
covered instead by the story below, which is inspected visually, and by the bar's
`minHeight` expression, which is assertable as a style value.

**Component** (`CostCurveStrip.test.tsx`, which already exists and whose four
`getByTitle` assertions this change breaks; they are migrated to role and axis-label
queries in the same commit that removes the title):
- A lopsided deck renders a tooltip whose text contains the ink name and count.
- No bar carries a `title` attribute.
- A bar's inline `minHeight` equals `MIN_BAND_PX * bandCount` when that exceeds 2,
  which is the guard that keeps the floors from overflowing the bar.

**Stories**: a lopsided-bucket story, since that is the case the floor exists for.

**Visual**: an owner look-review of the tooltip before commit, per the Visual
Iteration Protocol. Note that the in-app preview pane currently does not composite
frames, which prevents both screenshots and hover-driven verification, so this
needs either the Chrome extension connected or the owner's own browser.

## Out of scope

- **Touch.** Hover has no touch equivalent, and the mobile builder does not exist
  yet (PLAN item 26 and the mobile sheet are both deferred). A tap-to-reveal
  affordance should be designed when mobile lands, not invented here.
- **Hover emphasis on the band.** Brightening the hovered band was considered and
  left out: the tooltip's arrow already identifies the band, and the token rules
  reserve selection styling for `GOLD_GLOW` rather than `outline`. Cheap to add
  later if the tooltip alone reads as ambiguous.
- **The bucket total.** Deliberately removed, not relocated. Bar height already
  conveys it comparatively.

## Related

- [`BUILDER_LAYOUT.md`](BUILDER_LAYOUT.md): the strip is part of the right-hand
  deck panel, which the 2026-07-28 ruling declares done apart from changes like
  this one. Nothing here adds a card-surfacing surface, so the left/right split is
  untouched.
- [`.claude/rules/design-tokens.md`](../../.claude/rules/design-tokens.md):
  `ICON_SIZE`, `Z_INDEX.popover`, no raw values.
- [`.claude/rules/overlays.md`](../../.claude/rules/overlays.md): the tooltip
  contract (`role="tooltip"`, `pointerEvents: none`, `Z_INDEX.popover`).
