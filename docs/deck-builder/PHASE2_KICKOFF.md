# Phase 2 kickoff brief

Entry point for **#452, the Dreamborn collection import** — the last of the three
v1 items in [`PLAN.md`](PLAN.md) Phase 1. Read alongside PLAN Part B, "Collection &
migration (Phase 2)".

Delete this file once #452's task issues exist and the first one is underway.

**Threads A and B are closed and their content has moved.** A closed #208 on
2026-08-01 (decklist import/export shipped whole under #473; note that #208 and
#452 both say "Dreamborn import" and are *different features*, a decklist versus a
collection). B was ruled on 2026-08-05 and lives in PLAN.md Phase 1: mobile auth is
one `AuthButton`, rendered by `HeaderAuth` or by `DecksPage`, never both, gated on
`headerCarriesAuth`. Nothing gates this work — signing in is an upgrade, not a gate,
and the localStorage-first scope below needs no account at all.

---

## What the file actually is (measured, not assumed)

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

---

## Settled 2026-08-10 (owner)

**1. Finish is modelled, not folded.** `normal` and `foil` are stored as separate
quantities per card, not summed into one. Lossless, and collapsing later is always
possible where un-collapsing is not.

The consequence to design around: **nothing in the builder consumes finish today.**
Own/don't-own, the "only cards I own" filter and playset maths all want a single
total. So the storage shape is `{normal, foil}` and it ships with a `totalOwned()`
accessor from day one — every consumer goes through it, and none hand-rolls the
sum. If consumers start summing inline, the two-field shape has bought complexity
and no benefit.

**2. The import summary names the non-Core remainder.** Of 3395 owned rows only
**1014 are in Core sets (9+)**: roughly **70% of a real collection is outside what
Inkweave shows.** Silently discarding it reads as a broken import, so the summary
says so plainly — something like "1014 Core cards imported. 2381 owned cards are
from sets 1 to 8, which Core format does not use."

---

## Scope

Ship **parser + own/don't-own + an "only cards I own" filter against localStorage
first**, deferring the `collections` migration and RLS. Two reasons: it delivers
value without a live-DB step, and a live-DB migration needs the owner's
authorization, so deferring it keeps the work runnable headless. `CollectionContext`
should be written so the storage layer swaps later without touching consumers, the
same shape `DeckContext` uses for drafts.

`replacements.ts` (PLAN item 35) is the expensive half of Phase 2 and is **not**
part of this scope. Import plus own/don't-own is the shippable slice.

---

## How to start

`#452` is an **epic**; its six tasks are unwritten. So this begins with
`/draft-issue` for the parser task, not `/implement-issue 452`.

Stay on `deck-builder`. Do not cut a `feature/` branch: this epic's commits are
unmerged to production.
