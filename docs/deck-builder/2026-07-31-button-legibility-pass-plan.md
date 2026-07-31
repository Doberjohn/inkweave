# Button Legibility Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every button in the shared kit renders at `FONT_SIZES.lg` (14px), weight 600.

**Architecture:** Six shared components, one typography edit each. All call sites inherit — none change. Five of the six also carry raw `transition` durations and are on the `no-raw-duration` grandfather ledger, so touching them triggers that ledger's shrink-only obligation: converge and remove the entry, exactly as `CompactHeader` did in `1da74c47`.

**Tech Stack:** React 19 + TypeScript, inline styles with design tokens from `shared/constants`, Vitest + Testing Library, Storybook 10.

**Spec:** [`2026-07-31-button-legibility-pass-design.md`](./2026-07-31-button-legibility-pass-design.md)

**Branch:** stay on `deck-builder`. Do NOT cut a feature branch — this epic's commits are unmerged to production (CLAUDE.md, epic-issue convention).

---

## File Structure

| File | Typography change | Ledger obligation |
|---|---|---|
| `CtaButton.tsx` | base 13/500 → 14/600 | `no-raw-duration` ×1 (`all 0.25s`) |
| `ctaStyles.ts` | **none** — keeps `fontWeight: 600` (see Task 1) | not ledgered |
| `TabList.tsx` | 12/500 → 14/600; active weight stays 700 | `no-raw-duration` ×2 (`0.2s` twice) |
| `Chip.tsx` | 13/500 → 14/600; dismiss `×` glyph 13 → 14 | `no-raw-duration` ×1 (`all 0.25s`) |
| `LinkButton.tsx` | `base` → 14/600; `sm` stays 11px | `no-raw-duration` ×1 (`color 0.15s`) |
| `IconButton.tsx` | none (no text) | `no-raw-duration` ×1 (`all 0.15s`) |
| `FiltersButton.tsx` | none — inherits `CtaButton` | not ledgered |
| `known-offenders.js` | remove 5 entries from `no-raw-duration` | — |

**Duration conversions** (2026-07-29 ruling: `fast` 150 / `base` 200 / `slow` 300; 250 converges to `base`, per the `CompactHeader` precedent):

| Raw | Token |
|---|---|
| `0.25s` | `${DURATION.base}ms` |
| `0.2s` | `${DURATION.base}ms` |
| `0.15s` | `${DURATION.fast}ms` |

No new components. No call sites change.

---

### Task 1: `CtaButton` — the kit default

**Files:**
- Modify: `apps/web/src/shared/components/CtaButton.tsx`

This is the highest-leverage change: 51 call sites inherit it, including `FiltersButton`, which needs no edit of its own.

- [ ] **Step 1: Raise size and weight**

In `CtaButton.tsx`, `baseStyle` currently reads:

```tsx
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 500,
```

Replace with:

```tsx
    // The kit baseline (2026-07-31 ruling): every button is 14/600. Muted-grey
    // labels at 13/500 read thin on a dark ground — contrast was never the issue
    // (textMuted is 6.18-7.36:1, above AA everywhere), stroke weight was.
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: 600,
```

- [ ] **Step 2: Converge the raw duration**

Line 107 currently reads:

```tsx
    transition: `all 0.25s ${EASING.snappy}`,
```

Replace with:

```tsx
    transition: `all ${DURATION.base}ms ${EASING.snappy}`,
```

Add `DURATION` to the `../constants` import on line 2 (it currently imports `COLORS, DISABLED_STYLE, EASING, FONTS, FONT_SIZES, PRESS_SCALE, RADIUS, hexRgba`).

- [ ] **Step 3: Do NOT touch `ctaStyles.ts`**

It is tempting to delete `fontWeight: 600` from `CTA_FILLED_STYLE` now that the base carries 600. **Do not.** `CompactHeader`'s `RevealsPill` is a `NavLink`, not a `CtaButton` — it spreads `CTA_FILLED_STYLE` and sets its own `fontSize` but no `fontWeight`, so it depends on the recipe supplying 600. Removing it drops the header pill to `:root`'s 400 silently: no error, no failing test.

Confirm the trap is still real before moving on:

```bash
sed -n '/function RevealsPill/,/^}/p' apps/web/src/shared/components/CompactHeader.tsx | grep -c fontWeight
```
Expected: `1` — and that one is the `NEW` badge's 700, not the link's. If it returns 2, someone re-added a local weight and this note needs revisiting.

- [ ] **Step 4: Verify**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
pnpm --filter inkweave-web lint
```
Expected: typecheck exit 0; lint `0 errors` (17 pre-existing warnings). `CtaButton.tsx` is still ledgered at this point, so its duration change will not show — that entry comes out in Task 6.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/CtaButton.tsx && USER_APPROVED=1 git commit -m "refactor(ui): CtaButton is 14/600, the new kit baseline (#508)"
```

The `&&` is required: `git add` failing must abort the commit, or a partial index commits silently.

---

### Task 2: `TabList` — the worst offender

**Files:**
- Modify: `apps/web/src/shared/components/TabList.tsx`

At 12px/500 inactive this is the smallest text in the kit, and it is the deck-stats tab strip.

- [ ] **Step 1: Raise size, raise inactive weight, keep active at 700**

Lines 28-29 currently read:

```tsx
    fontSize: `${FONT_SIZES.md}px`,
    fontWeight: isActive ? 700 : 500,
```

Replace with:

```tsx
    fontSize: `${FONT_SIZES.lg}px`,
    // Active keeps 700: it sits one step above its siblings, and flattening it to
    // the kit's 600 would delete the active cue exactly as the neighbours got heavier.
    fontWeight: isActive ? 700 : 600,
```

- [ ] **Step 2: Converge both raw durations**

Line 31 currently reads:

```tsx
    transition: `background 0.2s ${EASING.snappy}, color 0.2s ${EASING.snappy}`,
```

Replace with:

```tsx
    transition: `background ${DURATION.base}ms ${EASING.snappy}, color ${DURATION.base}ms ${EASING.snappy}`,
```

Add `DURATION` to the `../constants` import.

- [ ] **Step 3: Verify**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/TabList.tsx && USER_APPROVED=1 git commit -m "refactor(ui): TabList is 14/600, active keeps 700 (#508)"
```

---

### Task 3: `Chip`

**Files:**
- Modify: `apps/web/src/shared/components/Chip.tsx`

22 call sites. Measured: nine chips at 14px cost 59px (+8.6%) on a row with 1673px of slack — no wrapping risk.

- [ ] **Step 1: Raise the label**

Lines 61-62 currently read:

```tsx
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 500,
```

Replace with:

```tsx
        fontSize: `${FONT_SIZES.lg}px`,
        fontWeight: 600,
```

- [ ] **Step 2: Raise the dismiss glyph to match**

The `×` is a separate `<span>` around line 92, currently:

```tsx
            fontSize: `${FONT_SIZES.base}px`,
```

Replace with:

```tsx
            fontSize: `${FONT_SIZES.lg}px`,
```

Leave its `fontWeight: 600` — it already matches the new baseline. The glyph is sized to sit with the label; leaving it at 13 while the label moves to 14 would make it read undersized.

- [ ] **Step 3: Converge the raw duration**

Line 65 currently reads:

```tsx
        transition: `all 0.25s ${EASING.snappy}`,
```

Replace with:

```tsx
        transition: `all ${DURATION.base}ms ${EASING.snappy}`,
```

Add `DURATION` to the `../constants` import.

- [ ] **Step 4: Verify**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/Chip.tsx && USER_APPROVED=1 git commit -m "refactor(ui): Chip is 14/600, dismiss glyph follows (#508)"
```

---

### Task 4: `LinkButton` — breaking a naming coincidence

**Files:**
- Modify: `apps/web/src/shared/components/LinkButton.tsx`

**Read this before editing.** The component currently does `fontSize: ${FONT_SIZES[size]}px` where `size` is `'sm' | 'base'`. That works only because the prop values happen to be keys of `FONT_SIZES`. The rule breaks that coincidence: `size="base"` must now mean **14px** (`FONT_SIZES.lg`), while `size="sm"` stays **11px** (`FONT_SIZES.sm`). An explicit map is required — indexing `FONT_SIZES` directly would silently keep `base` at 13.

- [ ] **Step 1: Add the explicit size map**

Add near the top of the file, after the imports:

```tsx
/**
 * `size` names the KIT role, not a FONT_SIZES key. `base` is the kit baseline
 * (14px, 2026-07-31 ruling); `sm` is an opt-in smaller size a caller chose for a
 * tight space, deliberately left at 11px so the prop does not become a lie.
 * Indexing FONT_SIZES by `size` directly would silently pin `base` back to 13.
 */
const LINK_BUTTON_SIZE_PX = {sm: FONT_SIZES.sm, base: FONT_SIZES.lg} as const;
```

- [ ] **Step 2: Use it, and raise the weight**

Lines 41-42 currently read:

```tsx
        fontSize: `${FONT_SIZES[size]}px`,
        fontWeight: 500,
```

Replace with:

```tsx
        fontSize: `${LINK_BUTTON_SIZE_PX[size]}px`,
        fontWeight: 600,
```

Note the weight rises for **both** sizes — `sm` keeps its 11px but still gets 600, because thin strokes at 11px are the worst case of the problem this change exists to fix.

- [ ] **Step 3: Converge the raw duration**

Line 46 currently reads:

```tsx
        transition: `color 0.15s ${EASING.snappy}`,
```

Replace with:

```tsx
        transition: `color ${DURATION.fast}ms ${EASING.snappy}`,
```

`fast` (150), not `base` — this is an exact match, and `fast` is the documented intent for hover colour changes.

Add `DURATION` to the `../constants` import.

- [ ] **Step 4: Verify both sizes resolve**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
grep -n "FONT_SIZES\[size\]" apps/web/src/shared/components/LinkButton.tsx
```
Expected: typecheck exit 0; the grep returns **nothing** (if it returns a line, the old indexing survived and `base` is still 13px).

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/LinkButton.tsx && USER_APPROVED=1 git commit -m "refactor(ui): LinkButton base is 14/600, sm keeps 11px (#508)"
```

---

### Task 5: `IconButton` — duration only

**Files:**
- Modify: `apps/web/src/shared/components/IconButton.tsx`

No text, so no typography change. It is here solely because it is on the `no-raw-duration` ledger and Task 6 removes its entry.

- [ ] **Step 1: Converge the raw duration**

Line 39 currently reads:

```tsx
        transition: `all 0.15s ${EASING.snappy}`,
```

Replace with:

```tsx
        transition: `all ${DURATION.fast}ms ${EASING.snappy}`,
```

Add `DURATION` to the `../constants` import.

- [ ] **Step 2: Verify**

```bash
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/shared/components/IconButton.tsx && USER_APPROVED=1 git commit -m "refactor(ui): IconButton duration to the token scale (#508)"
```

---

### Task 6: Pay the ledger

**Files:**
- Modify: `apps/web/eslint-rules/known-offenders.js`

The ledger's own header: *"When you touch a listed file, converge it and REMOVE its entry."* Five entries come out.

- [ ] **Step 1: Confirm each file is genuinely clean first**

Removing an entry on faith is how a ledger stops meaning anything.

```bash
grep -nE "[0-9]*\.[0-9]+s |[0-9]{1,3}ms" apps/web/src/shared/components/{CtaButton,Chip,TabList,LinkButton,IconButton}.tsx | grep -v "DURATION\."
```
Expected: **no output**. Any line here is a raw duration still in place — fix it before continuing.

- [ ] **Step 2: Remove the five entries**

In `apps/web/eslint-rules/known-offenders.js`, under the `'no-raw-duration'` block, delete these five lines:

```js
    'src/shared/components/Chip.tsx', // x1
    'src/shared/components/CtaButton.tsx', // x1
    'src/shared/components/IconButton.tsx', // x1
    'src/shared/components/LinkButton.tsx', // x1
    'src/shared/components/TabList.tsx', // x2
```

Leave every other entry untouched. The ledger only shrinks.

- [ ] **Step 3: Verify with the amnesty gone**

This is the only check that proves the removals were honest — leaving the entries in place would also be green.

```bash
pnpm --filter inkweave-web lint
```
Expected: `0 errors`. Those five files are now fully held to `no-raw-duration`; a leftover raw value fails here rather than being forgiven.

- [ ] **Step 4: Commit**

```bash
USER_APPROVED=1 git add apps/web/eslint-rules/known-offenders.js && USER_APPROVED=1 git commit -m "refactor(design): five kit buttons leave the no-raw-duration ledger (#508)"
```

---

### Task 7: Verify rendered output and show the owner

**Files:** none — verification only.

- [ ] **Step 1: Full suite and gates**

```bash
pnpm test:web
pnpm --filter inkweave-web run check:stories
pnpm --filter inkweave-web run check:design
pnpm --filter inkweave-web exec tsc -b --pretty false
```
Expected: 150 files / 1065 passed / 3 skipped; both gates pass; typecheck exit 0.

- [ ] **Step 2: Read the rendered values back**

A declared weight is not a rendered one — `:root` sets `font-synthesis: none`, so a weight with no loaded face silently falls back to the nearest that exists. 600 has a self-hosted face, but verify rather than assume.

Start Storybook (`pnpm --filter inkweave-web storybook`) and open the CtaButton
matrix, which renders every variant at once:

`http://localhost:6006/iframe.html?id=shared-ctabutton--matrix&viewMode=story`

Note the story-title prefixes are **not** uniform in this repo — `CtaButton`,
`TabList` and `LinkButton` live under `Shared/`, but `Chip` lives under
`Components/`. The ids are therefore `shared-ctabutton--matrix`,
`shared-tablist--*`, `shared-linkbutton--*`, and `components-chip--*`.

Evaluate in the page:

```js
[...document.querySelectorAll('button')].map(b => ({
  label: b.textContent.trim(),
  size: getComputedStyle(b).fontSize,
  weight: getComputedStyle(b).fontWeight,
  family: getComputedStyle(b).fontFamily.split(',')[0],
}))
```
Expected: every entry `14px` / `600` / `"Plus Jakarta Sans"`.

Repeat for `TabList` (inactive `600`, active `700`), `Chip`, and `LinkButton` (`base` → 14px, `sm` → 11px, both weight 600).

- [ ] **Step 3: Confirm the header pill did NOT change**

The `CTA_FILLED_STYLE` trap from Task 1, Step 3, verified at runtime:

```bash
pnpm --filter inkweave-web storybook
```
Open `http://localhost:6006/iframe.html?id=components-compactheader--default&viewMode=story` and check the Reveals pill still computes to `fontWeight: 600`. If the pill is absent (it drops off-season), instead confirm `CTA_FILLED_STYLE` in `ctaStyles.ts` still contains `fontWeight: 600`.

- [ ] **Step 4: Screenshot for the owner — then STOP**

`DeckActionsBar`'s `ACTION_STYLE` pins `minHeight: 32` and `FONT_SIZES.md`, so the deck toolbar will now render visibly smaller than the new kit default.

Screenshot the deck toolbar beside a default-sized button and show the owner. **Do not adjust `ACTION_STYLE`.** It is a deliberate size choice from `89b9b833`; changing it here would silently reverse a decision made a few commits ago. It needs its own ruling.

Also worth surfacing in the same screenshot: `CompactHeader`'s Reveals pill sets its own `fontSize: FONT_SIZES.base` (13px) and now sits beside 14px nav links. Out of scope (it is a `NavLink`, not a kit button) — flag it, do not change it.

- [ ] **Step 5: Visual check-in**

Per the Visual Iteration Protocol, show the owner the rendered kit before considering this done. Self-verification catches mistakes; it does not replace the design check-in.

---

## Self-review notes

**Spec coverage.** The rule → Tasks 1-5. Exception 1 (`TabList` active 700) → Task 2 Step 1. Exception 2 (`LinkButton sm` 11px) → Task 4 Step 1. Exception 3 (`CTA_FILLED_STYLE` keeps its weight) → Task 1 Step 3, with a runtime check in Task 7 Step 3. Density finding → no task needed; it justified choosing 14px over a tiered variant. Testing section → Task 7. `ACTION_STYLE` carry-forward → Task 7 Step 4.

**Added beyond the spec, deliberately.** The spec did not mention the `no-raw-duration` ledger. Five of the six files are on it, and the ledger's rule is triggered by *touching* a listed file — so Tasks 1-6 must pay it or the change quietly violates a documented convention. This is the same obligation `CompactHeader` met in `1da74c47`.

**Type consistency.** `LINK_BUTTON_SIZE_PX` is the only new identifier and is defined in Task 4 Step 1 before use in Step 2. `DURATION` is imported in each of Tasks 1-5 from `../constants`, matching the existing barrel import in every one of those files.

**Not covered, by design.** `FiltersButton` and `ctaStyles.ts` get no edit — the first inherits, the second must not change. Both are named in the File Structure table so their absence reads as a decision rather than an oversight.
