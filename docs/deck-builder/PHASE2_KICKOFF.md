# Phase 2 kickoff brief

Start-of-session brief for the three threads that follow the 2026-07-31 close-out.
Delete this file when Phase 2 task issues exist and #452 is underway.

Read alongside [`PLAN.md`](PLAN.md) Phase 1 (the v1 three items) and Part B
"Collection & migration (Phase 2)", plus the latest #474 comment.

**A and B are both done.** A closed #208; B was decided 2026-08-01 (see below).
**C is the remaining work**, and it no longer depends on B: signing in is optional
everywhere, so nothing gates the collection import. **Start at Thread C**, after
applying B's consequences (the `/decks` rename and tabs, the `MobileBottomNav`
label, and #454's route change).

---

## Thread A: reconcile #208 — DONE

**#208 was closed as completed** after both open spot-checks below passed. Kept
here for the mapping and for the one deviation worth knowing about. Nothing left to
do; skip to Thread B.

**Verdict: fully shipped under #473.** Verified against the tree, not assumed.

#208 "Dreamborn Import / Text Export" describes **decklist** import/export. Every
line of its checklist landed under #473:

| #208 requirement | Where it lives |
|---|---|
| Parse `Nx Card Name - Title` | `parseDecklist()` in `apps/web/src/features/deck/deckTransfer.ts` |
| Match against the card database | `resolveDecklist(lines, pool)` |
| Report lines that failed to match | `resolveDecklist` returns `unmatched`; `parseDecklist` returns `unparsed` |
| Text export | `formatDecklist()` |
| Import UI + summary | `ImportDeckDialog.tsx`, `DeckActionsBar.tsx` |
| 4-copy / 2-ink validation | `deckStats.ts` (drives the legality errors and the Duels gate) |

Both items that needed checking passed:

- **Duplicate merging**: `resolveDecklist` sums repeated lines per card, then clamps
  with `Math.min(MAX_COPIES, ...)`.
- **Comments and blank lines**: `isDecklistChrome()` skips blanks plus `//` and `#`
  headers silently. `unparsed` is deliberately reserved for lines that *look* like
  cards but are not, so section headers never surface as errors.

**One deliberate deviation, worth knowing.** #208 asked for "X imported, Y errors".
The dialog shows a receipt **only when something was skipped**; a clean import
closes silently, because the deck itself is the receipt. The success-path counter
was dropped on purpose, not missed.

Note the stale file path: #208 names `deck/utils/deckParser.ts`, which never
existed. The real module is `deck/deckTransfer.ts`.

**Why this matters beyond tidiness.** #208 and #452 both say "Dreamborn import"
and are different features. #208 is a **decklist** (60 cards, one deck). #452 is a
**collection** (everything you own). Leaving #208 open invites the next session to
think collection import is half-done when it has not started.

---

## Thread B: the mobile sign-in gap — DECIDED 2026-08-01

**Both rulings are in `PLAN.md` Phase 1. Summary:**

- **`/decks` is the community hub with a "Yours" tab.** Not personal. So there is
  no `/decks/feed`; **#454 needs its task line updated.** Interim, show only the
  Yours tab until Phase 4 has content.
- **Sign-in is contextual plus the header.** `HeaderAuth` stays; `/decks` also
  explains what signing in buys. That **closes the mobile regression**, because
  `/decks` renders on mobile and `CompactHeader` does not.

**The reframing that settled it:** signing in is an **upgrade, not a gate**. The
builder already works fully signed out (localStorage drafts via `deckStorage`, and
`useFirstSignInMigration` lifts the anonymous draft into the account on first
sign-in). Nothing in v1 needs auth, **including #452** under its localStorage-first
scope. An earlier note in this file said the mobile gap blocked #452. It does not.

Also now wrong and needing a copy change: `MobileBottomNav` labels the tab
**"Build a deck"**, which is both personal and an action, while `/decks` is a
destination and `/decks/new` is the builder.

The original analysis is kept below for the constraints it records.

---

### Original analysis (superseded by the ruling above)

**The regression.** `7dfb4dd3` moved auth into `HeaderAuth`, which lives in
`CompactHeader`, which returns `null` when `isMobile`. The `/decks` block it
replaced was **not** mobile-gated: it rendered inside `<main>` and was reachable
from the mobile Decks tab. `SignInDialog` now has exactly one production render
site. **Mobile cannot sign in at all.** The E2E added in `09f9a52d` asserts desktop
pages only, so it cannot catch this.

**The constraint that shapes the options.** `MobileBottomNav` already carries
**two full five-tab sets**, switched on reveal season:

- Reveal season: Browse · Search · Reveals · Playstyles · Decks
- Off-season: Browse · Search · Playstyles · Vote · Decks

So a sixth tab is not an addition, it is a redesign of a nav that is already at
capacity, and it would have to be designed twice.

**Options, cheapest first:**

1. **Restore a mobile-only auth control on `/decks`.** Literally what was removed,
   now gated on `isMobile` so it does not double up with the header. Smallest
   diff, fully reversible, no nav redesign. Weakness: it re-couples auth to one
   page, which is the coupling the move set out to break.
2. **An account affordance in the mobile header or as a sheet.** Mobile has no top
   header today, so this means introducing one surface or hanging a control off
   `MobileBottomNav` without spending a tab.
3. **A sixth tab, or swap one out.** Most consistent with "auth is global", most
   expensive, and needs a ruling on which existing tab loses its slot.

**Recommendation: option 1 now, option 2 or 3 when the mobile builder gets its own
design pass.** #452's Collection is the first auth-gated surface, so mobile needs
*a* path before then, and option 1 is the only one that does not require a design
session first.

Also dropped in the move and worth deciding on: the `user.email` readout that used
to sit beside Sign out.

---

## Thread C: the Dreamborn collection CSV (#452)

`#452` is an **epic**, not a task issue. Its six tasks are unwritten. Expect to
draft task issues via `/draft-issue` rather than `/implement-issue 452`.

### What the file actually is (measured, not assumed)

`.knowledge/folder/download.csv`, 304 KB, **5329 data rows**.

```
Set Number,Card Number,Variant,Count,Name,Color,Rarity
013,1,normal,0,"Woody - Helping a Friend",Amber,Rare
013,1,foil,0,"Woody - Helping a Friend",Amber,Rare
```

- **Set Number is zero-padded** (`001`..`013`). Parse it as an integer before
  joining; `allCards.json` stores `setCode` as an unpadded string (`"9"`).
- **Two rows per card**, one `normal` and one `foil` (2660 normal, 2669 foil).
- `Count` is the owned quantity, and is `0` for cards you do not own. The file is a
  full census of every printed card, not a list of what you have.
- Sets 1 through 13 are all present, roughly 408 to 417 rows each.

### The join is a perfect bijection

`(parseInt(Set Number), Card Number)` against `(setCode, number)` in
`allCards.json`:

```
distinct core (set, number) pairs in CSV:  1024
matched against allCards.json:             1024
unmatched:                                    0
```

`allCards.json` holds exactly 1024 cards, so this is an exact one-to-one match.

**This changes the plan.** PLAN Part B says "resolve via name/set index, report
unmatched" and "(research the export format)". The research is done: **no name
matching is needed**, and for this file there is nothing to report. Keep the
unmatched-reporting path anyway, because it costs little and future sets, hand-
edited files, or a Dreamborn format change will need it. But do not build fuzzy
name resolution on spec.

Watch for one edge: `allCards.json` contains a card with `number === 0`, and the
CSV matched it, so the numbering is not 1-based everywhere. Do not assume
`number >= 1`.

### Two product questions the owner should settle before coding

1. **Fold `normal` + `foil` into one quantity?** A playset is four copies
   regardless of finish, and the builder has no concept of finish. Recommendation:
   **sum them** into a single `quantity` per card, and do not model finish at all
   until something needs it. Flagging because it is lossy and irreversible without
   a re-import.
2. **What does the import summary say about non-Core cards?** Of 3395 owned rows,
   only **1014 are in Core sets (9+)**. Roughly **70% of a real collection is
   outside what Inkweave can show.** Silently discarding that will read as a broken
   import. Recommendation: state it plainly in the summary, something like "1014
   Core cards imported. 2381 owned cards are from sets 1 to 8, which Core format
   does not use."

### Scope already proposed (carried from the 2026-07-31 pivot)

Ship **parser + own/don't-own + an "only cards I own" filter against localStorage
first**, deferring the `collections` migration and RLS. Two reasons: it delivers
value without a live-DB step, and a live-DB migration needs the owner's
authorization, so deferring it keeps the work runnable headless. `CollectionContext`
should be written so the storage layer swaps later without touching consumers, the
same shape `DeckContext` uses for drafts.

`replacements.ts` (PLAN item 35) is the expensive half of Phase 2 and is **not**
part of this scope. Import plus own/don't-own is the shippable slice.

---

## Session-start checklist

1. `git status` clean, on `deck-builder`. Last commit should be `cf3b300a`.
2. Read the latest #474 comment and this file.
3. ~~**Thread A**: close #208.~~ **Done.**
4. ~~**Thread B**: get the owner's ruling on mobile auth placement.~~ **Done.**
   Apply its consequences: `/decks` renamed to "Decks" with a `TabList` (Yours only
   until Phase 4), a contextual sign-in explainer on `/decks`, the
   `MobileBottomNav` label off "Build a deck", and #454's `/decks/feed` task line
   corrected.
5. **Thread C**: read #452 and PLAN Part B, settle the two product questions, then
   `/draft-issue` the parser task. Stay on `deck-builder`; do not cut a
   `feature/` branch (this epic's commits are unmerged to production).
