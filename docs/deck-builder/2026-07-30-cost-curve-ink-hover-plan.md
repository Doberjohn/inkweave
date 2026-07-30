# Cost-curve ink hover implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering an ink band in the deck panel's cost curve shows that ink's glyph, name and card count in a floating tooltip.

**Architecture:** `InkSegment` starts carrying the raw `count` it already computes. Bands become flex items sized by a count-proportional grow factor with a `minHeight` floor, so the browser guarantees a hoverable target without any pixel measurement. Each band is wrapped in the existing shared `Tooltip`, whose `content` prop widens to `ReactNode` to hold an `InkIcon`. The per-bar native `title` is removed because native tooltips fire from ancestors and would double up.

**Tech Stack:** React 19, TypeScript, inline styles with design tokens, vitest + @testing-library/react, Storybook 10.

**Spec:** [`2026-07-30-cost-curve-ink-hover-design.md`](2026-07-30-cost-curve-ink-hover-design.md)

**Branch:** stay on `deck-builder`. Do NOT cut a feature branch: this epic's commits are unmerged to production and the hooks are wired to the main checkout by absolute path.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `apps/web/src/features/deck/components/costCurveColumns.ts` | Pure projection of the histogram onto columns and ink segments | Add `count` to `InkSegment` |
| `apps/web/src/features/deck/components/costCurveColumns.test.ts` | Unit tests for that projection | Add `count` coverage; fix one existing `toEqual` |
| `apps/web/src/shared/components/Tooltip.tsx` | Shared floating tooltip | Widen `content` to `ReactNode` |
| `apps/web/src/features/deck/components/CostCurveStrip.tsx` | The chart itself | Flex band sizing, per-band tooltip, aria labels, drop the native title |
| `apps/web/src/features/deck/components/CostCurveStrip.test.tsx` | Component tests | Migrate 4 title assertions; add hover + no-title tests |
| `apps/web/src/features/deck/components/CostCurveStrip.stories.tsx` | Visual review surface | Add a lopsided-bucket story; drop a dead SB8 param |

**Two pre-existing assertions break and must be migrated, not deleted:**
1. `costCurveColumns.test.ts` asserts segments with `toEqual([{ink, pct}])`. Adding a third property fails an exact-match assertion.
2. `CostCurveStrip.test.tsx` asserts `getByTitle('2 cards at cost 1')` and three siblings. Removing the title removes those queries' target.

---

### Task 1: `InkSegment` carries its count

**Files:**
- Modify: `apps/web/src/features/deck/components/costCurveColumns.ts` (interface at 17-21, `inkSegments` at 43-49)
- Test: `apps/web/src/features/deck/components/costCurveColumns.test.ts`

- [ ] **Step 1: Update the existing exact-match assertion first, so you see it fail for the right reason**

In `costCurveColumns.test.ts`, replace the body of the `'carries each bucket its ink segments'` test (lines 44-51):

```ts
  it('carries each bucket its ink segments', () => {
    const cols = toColumns({1: 10}, {1: {Amber: 5, Emerald: 5}});
    const one = cols.find((c) => c.bucket === 1)!;
    expect(one.segments).toEqual([
      {ink: 'Amber', pct: 50, count: 5},
      {ink: 'Emerald', pct: 50, count: 5},
    ]);
  });
```

- [ ] **Step 2: Add the failing test for the count itself**

Append inside the `describe('inkSegments', ...)` block:

```ts
  it('carries each ink its raw count, not a rounded share', () => {
    // A lopsided bucket: the tooltip must say 1, never a percentage of anything.
    const segs = inkSegments({Amber: 8, Emerald: 1});
    expect(segs.map((s) => s.count)).toEqual([8, 1]);
  });
```

- [ ] **Step 3: Run both to verify they fail**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/costCurveColumns.test.ts
```

Expected: FAIL. The `toEqual` test reports missing `count` on the received objects; the new test reports `[undefined, undefined]`.

- [ ] **Step 4: Add `count` to the interface**

In `costCurveColumns.ts`, replace the `InkSegment` interface (lines 16-21):

```ts
/** One ink's share of a bucket's bar: its raw copy count, and that as a percent height. */
export interface InkSegment {
  ink: Ink;
  /** Share of this bucket's ink units, 0..100. */
  pct: number;
  /** Copies of this ink in this bucket. The number the hover tooltip reports. */
  count: number;
}
```

- [ ] **Step 5: Carry it through `inkSegments`**

Replace the return statement in `inkSegments` (line 48):

```ts
  return present.map((ink) => ({ink, pct: ((byInk[ink] ?? 0) / total) * 100, count: byInk[ink] ?? 0}));
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/costCurveColumns.test.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 7: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/costCurveColumns.ts apps/web/src/features/deck/components/costCurveColumns.test.ts
USER_APPROVED=1 git commit -m "feat(deck): InkSegment carries its raw copy count (#468)"
```

---

### Task 2: `Tooltip` accepts a ReactNode

**Files:**
- Modify: `apps/web/src/shared/components/Tooltip.tsx` (import at 1, prop at 13)

No test of its own: this is a type widening with no behavioural change, and Task 4's hover test exercises it end to end. `ReactNode` is already imported in this file.

- [ ] **Step 1: Widen the prop**

Replace the `content` prop declaration (lines 12-13):

```ts
  /** Tooltip body. A plain string keeps its newlines via `white-space: pre-line`; nodes render as given. */
  content: ReactNode;
```

- [ ] **Step 2: Verify nothing else broke**

```bash
pnpm --filter inkweave-web exec tsc -b --noEmit false --emitDeclarationOnly false
```

Expected: no errors. Widening a prop cannot break existing string callers.

- [ ] **Step 3: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/Tooltip.tsx
USER_APPROVED=1 git commit -m "refactor(ui): Tooltip content accepts a ReactNode (#468)"
```

---

### Task 3: Bands become floored flex items

**Files:**
- Modify: `apps/web/src/features/deck/components/CostCurveStrip.tsx` (consts at 5-6, bar at 52-70)
- Test: `apps/web/src/features/deck/components/CostCurveStrip.test.tsx`

- [ ] **Step 1: Write the failing test for the bar's floor**

Add to `CostCurveStrip.test.tsx` inside the existing `describe('CostCurveStrip', ...)`:

```tsx
  it('floors a bar tall enough to fit every band, so no ink is clipped away', () => {
    // 1 copy per ink in the shortest bucket: without the floor the bar would be
    // 2px tall and both bands would overflow their 8px minimum.
    const {container} = render(
      <CostCurveStrip costCurve={{1: 20, 2: 2}} costCurveByInk={{1: {Amber: 20}, 2: {Amber: 1, Emerald: 1}}} />,
    );
    const bars = container.querySelectorAll('[data-bucket]');
    const twoDrop = [...bars].find((b) => b.getAttribute('data-bucket') === '2') as HTMLElement;
    expect(twoDrop.style.minHeight).toBe('16px');
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/CostCurveStrip.test.tsx
```

Expected: FAIL. `bars` is empty because no element carries `data-bucket` yet, so `twoDrop` is undefined.

- [ ] **Step 3: Add the constants**

In `CostCurveStrip.tsx`, after `CHART_HEIGHT` (line 6):

```ts
/**
 * Smallest a single ink band may render. This is a hover-target size, not a
 * spacing step, so it sits outside ICON_SIZE deliberately (same reasoning as
 * DeckProfile's SYMBOL_SIZE). Flex honours it before distributing the remainder.
 */
const MIN_BAND_PX = 8;

/** Smallest a nonzero bar may render when it has no bands to fit. */
const MIN_BAR_PX = 2;
```

- [ ] **Step 4: Replace the bar and band styles**

Replace the bar `<div>` and its segment map (lines 52-70) with:

```tsx
            <div
              key={col.bucket}
              data-bucket={col.bucket}
              style={{
                flex: 1,
                height: `${col.heightPct}%`,
                // A bar must be tall enough for every band's floor, or the bands
                // overflow and `overflow: hidden` silently clips an entire ink.
                minHeight: col.count > 0 ? Math.max(MIN_BAR_PX, MIN_BAND_PX * col.segments.length) : 0,
                borderRadius: '2px 2px 0 0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse',
                background: COLORS.surfaceAlt,
                boxShadow: col.count > 0 ? `0 0 5px ${hexRgba(glow, 0.5)}, 0 0 12px ${hexRgba(glow, 0.24)}` : 'none',
              }}>
              {col.segments.map((seg) => (
                <div
                  key={seg.ink}
                  // Grow proportionally to the count from a zero basis, but never
                  // below MIN_BAND_PX: flex floors the small bands and shares what
                  // is left among the rest, which is the sizing rule we want.
                  style={{
                    flex: `${seg.count} 1 0`,
                    minHeight: MIN_BAND_PX,
                    width: '100%',
                    background: INK_COLORS[seg.ink].border,
                  }}
                />
              ))}
            </div>
```

- [ ] **Step 5: Run tests to verify the new one passes**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/CostCurveStrip.test.tsx
```

Expected: the floor test PASSES. The four `getByTitle` assertions still pass, because the title has not been removed yet.

- [ ] **Step 6: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/CostCurveStrip.tsx apps/web/src/features/deck/components/CostCurveStrip.test.tsx
USER_APPROVED=1 git commit -m "feat(deck): floor cost-curve ink bands to a hoverable height (#468)"
```

---

### Task 4: Per-band tooltip, and the native title goes

**Files:**
- Modify: `apps/web/src/features/deck/components/CostCurveStrip.tsx`
- Test: `apps/web/src/features/deck/components/CostCurveStrip.test.tsx`

This task removes the `title` attribute, which breaks the four existing `getByTitle` assertions. They are replaced here, in the same commit, so the suite is never left red.

- [ ] **Step 1: Rewrite the first existing test and add the new ones**

Replace the whole `'renders a labelled bar per bucket, zero-filling gaps'` test (lines 6-14) with the following three tests. Also add `fireEvent` to the import on line 2 so it reads `import {fireEvent, render, screen} from '@testing-library/react';`.

```tsx
  it('renders an axis label per bucket, zero-filling gaps', () => {
    render(<CostCurveStrip costCurve={{1: 2, 3: 4}} costCurveByInk={{1: {Amber: 2}, 3: {Amber: 1, Emerald: 3}}} />);
    // A bucket with no cards still gets its column and label, rather than being skipped.
    expect(screen.getByText('2')).toBeInTheDocument();
    // Costs >= 7 share one capped column.
    expect(screen.getByText('7+')).toBeInTheDocument();
  });

  it('names each ink band with its ink and count for assistive tech', () => {
    render(<CostCurveStrip costCurve={{3: 4}} costCurveByInk={{3: {Amber: 1, Emerald: 3}}} />);
    expect(screen.getByRole('img', {name: 'Emerald, 3 cards at cost 3'})).toBeInTheDocument();
    // Singular, because "1 cards" reads as a bug.
    expect(screen.getByRole('img', {name: 'Amber, 1 card at cost 3'})).toBeInTheDocument();
  });

  it('shows the hovered ink and its count, and exposes no competing native title', () => {
    const {container} = render(<CostCurveStrip costCurve={{3: 4}} costCurveByInk={{3: {Amber: 1, Emerald: 3}}} />);
    // The native title would fire from the ancestor bar a second after our own
    // tooltip, showing different content for one gesture.
    expect(container.querySelector('[title]')).toBeNull();

    const band = screen.getByRole('img', {name: 'Emerald, 3 cards at cost 3'});
    // Tooltip binds its handlers to the wrapper it renders around the trigger.
    fireEvent.mouseEnter(band.parentElement!);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Emerald');
    expect(tip).toHaveTextContent('3');
  });
```

- [ ] **Step 2: Run them to verify they fail**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/CostCurveStrip.test.tsx
```

Expected: FAIL. The aria test finds no `img` role; the hover test finds a `[title]` element and no `tooltip` role.

- [ ] **Step 3: Add the imports and the tooltip body component**

In `CostCurveStrip.tsx`, replace the import block (lines 1-3) with:

```tsx
import {COLORS, FONT_SIZES, FONTS, hexRgba, ICON_SIZE, INK_COLORS, SPACING} from '../../../shared/constants';
import {InkIcon} from '../../../shared/components/InkIcon';
import {Tooltip} from '../../../shared/components/Tooltip';
import type {Ink} from '../types';
import {toColumns, totalCopies} from './costCurveColumns';
```

Then add, above the `CostCurveStrip` function:

```tsx
/** Tooltip body for one band: the ink's own glyph, its name, and its copy count. */
function InkBandTip({ink, count}: {ink: Ink; count: number}) {
  return (
    <span style={{display: 'flex', alignItems: 'center', gap: SPACING.xs}}>
      <InkIcon ink={ink} size={ICON_SIZE.sm} />
      <span>{ink}</span>
      <span style={{color: COLORS.text}}>{count}</span>
    </span>
  );
}
```

- [ ] **Step 4: Wrap each band and drop the title**

Remove the `title={...}` line from the bar `<div>`. Replace the `col.segments.map(...)` body from Task 3 with:

```tsx
              {col.segments.map((seg) => (
                <Tooltip
                  key={seg.ink}
                  content={<InkBandTip ink={seg.ink} count={seg.count} />}
                  // The Tooltip wrapper becomes the flex item, so the band's
                  // sizing moves onto it and the band fills it.
                  triggerStyle={{
                    display: 'flex',
                    flex: `${seg.count} 1 0`,
                    minHeight: MIN_BAND_PX,
                    width: '100%',
                  }}>
                  <div
                    role="img"
                    aria-label={`${seg.ink}, ${seg.count} card${seg.count === 1 ? '' : 's'} at cost ${col.label}`}
                    style={{width: '100%', height: '100%', background: INK_COLORS[seg.ink].border}}
                  />
                </Tooltip>
              ))}
```

- [ ] **Step 5: Update the component doc comment**

In the block comment above `CostCurveStrip`, replace the sentence `Copy counts live on each bar's hover title (kept intentionally minimal — no numeric labels or legend).` with:

```
 * Hovering an ink band shows that ink's glyph, name and copy count in a floating
 * tooltip; the bar carries no native title, which would double up with it. The
 * chart still shows no numeric labels or legend at rest.
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter inkweave-web exec vitest run src/features/deck/components/CostCurveStrip.test.tsx
```

Expected: PASS, all five tests.

- [ ] **Step 7: Run the whole web suite, since Tooltip is shared**

```bash
pnpm --filter inkweave-web test:run
```

Expected: PASS. Watch specifically for other `Tooltip` consumers.

- [ ] **Step 8: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/CostCurveStrip.tsx apps/web/src/features/deck/components/CostCurveStrip.test.tsx
USER_APPROVED=1 git commit -m "feat(deck): hover an ink band for its symbol and card count (#468)"
```

---

### Task 5: A story for the case the floor exists for

**Files:**
- Modify: `apps/web/src/features/deck/components/CostCurveStrip.stories.tsx`

- [ ] **Step 1: Remove the dead SB8 parameter**

Replace line 8 so the meta reads:

```tsx
  component: CostCurveStrip,
  decorators: [
```

The dark canvas comes from `preview.tsx`'s `initialGlobals`; `backgrounds: {default: 'dark'}` has been inert since Storybook 8 and the stories rule names it explicitly.

- [ ] **Step 2: Add the lopsided story**

Append:

```tsx
// The case MIN_BAND_PX exists for: a single off-ink copy in an otherwise mono
// bucket. Its band must stay visible and hoverable rather than collapsing to a
// hairline, which is exactly when one off-ink card is most worth noticing.
export const LopsidedBucket: Story = {
  args: {
    costCurve: {1: 4, 2: 9, 3: 20, 4: 6, 5: 2, 6: 2, 7: 2},
    costCurveByInk: {
      1: {Amber: 4},
      2: {Amber: 8, Emerald: 1},
      3: {Amber: 19, Emerald: 1},
      4: {Amber: 5, Emerald: 1},
      5: {Amber: 1, Emerald: 1},
      6: {Amber: 2},
      7: {Amber: 1, Emerald: 1},
    },
  },
};
```

- [ ] **Step 3: Verify the story coverage gate still passes**

```bash
pnpm --filter inkweave-web check:stories
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/CostCurveStrip.stories.tsx
USER_APPROVED=1 git commit -m "test(deck): story for a lopsided cost-curve bucket (#468)"
```

---

## Final verification

- [ ] **Full suite**

```bash
pnpm test
```

Expected: PASS, engine and web.

- [ ] **Lint, for the token rules**

```bash
pnpm --filter inkweave-web lint
```

Expected: PASS. `MIN_BAND_PX` is a named const, not a raw value in a style, so `no-raw-*` should stay quiet. If a rule does fire, use the token it names rather than suppressing it.

- [ ] **Owner visual review, before pushing**

The tooltip cannot be self-verified in the in-app preview pane: it does not composite frames, so CSS enter transitions never complete and hover-driven UI is unreachable. Verify in a real browser at `http://localhost:5173/decks/new`, or with the Chrome extension connected, then show the owner the tooltip on a lopsided bucket and wait for approval. Do not skip this: the Visual Iteration Protocol is what stops a surface shipping on a design the owner never saw.

- [ ] **Push**

```bash
USER_APPROVED=1 git push origin deck-builder
```

The pre-push chain runs typecheck, story coverage, the design-token gate, E2E chromium and the CodeScene gate. Keep port 5173 free first so Playwright owns its own server, and do not edit any file while the push is in flight, because the CodeScene delta grades the working tree rather than the commit.

## Notes for the implementer

- **Ink count per deck.** A legal deck runs at most 2 inks, so a bar normally has 2 bands. The code must not assume that: `costCurveByInk` comes from the real deck, the 2-ink limit is advisory rather than enforced, and an over-ink deck legitimately renders 3+ bands.
- **`flex: ${count} 1 0`** is deliberate. A zero basis makes the grow factors the sole sizing input, so heights land proportional to counts. Do not switch to `flexBasis: 'auto'`, which would let content size interfere.
- **Do not add hover emphasis to the band.** It was considered and left out of the spec; the token rules reserve selection styling for `GOLD_GLOW`, never `outline`.
- **jsdom does not lay out flexbox**, so the floor's visual effect is unassertable in a unit test. That is why Task 3 asserts the bar's `minHeight` style value and Task 5 adds a story. Do not try to assert computed band heights.
- **The tooltip anchors to the band, deliberately.** `Tooltip` positions against its own trigger, and the trigger is the band. Do not add an anchor-override prop to the shared component to force bar-top anchoring: the spec records that decision and defers it to the visual review. If occlusion of the neighbouring costs reads badly there, that is when to add it.
