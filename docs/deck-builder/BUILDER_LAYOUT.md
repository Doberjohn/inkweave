# Deck builder layout standard

**Status:** owner ruling, 2026-07-28. Binding until the owner changes it.

## The rule

The builder is two columns and stays two columns:

| Column | Role |
|--------|------|
| **Left** — `<section aria-label="Card pool">` | **Where cards come from.** Anything that offers, suggests, imports, or surfaces cards for adding. |
| **Right** — `<DeckPanel>` | **Your deck.** The card list and its per-row controls. Nothing else. |

Both live in the grid at [`DeckBuilderPage.tsx`](../../apps/web/src/pages/DeckBuilderPage.tsx)
(`gridTemplateColumns: DECK_PANE_COLUMNS`).

## What this means in practice

- **New features go on the LEFT.** Guided-mode suggestions, import results, "what
  pairs with this card" — they all swap or extend the left column's contents. They do
  not get their own route, their own screen, or a slice of the right column.
- **The right panel is done.** Deck header, cost curve, card list. The advisor is not
  coming back into it: it led with a 0-100 score and per-dimension numbers, which the
  owner rejected (see [the redesign spec](2026-07-24-advisor-tab-redesign-design.md)
  and the competitor research summarized there — no surveyed builder ships a deck
  score, and Magic's publisher retired theirs).
- **One slot forces honesty.** Because every new card-surfacing idea competes for the
  same left column, two of them cannot both be essential. If a feature cannot justify
  taking the left column, it is not ready.
- **No tabs to reach it.** The Cards/Analysis tab bar was removed; a mode or source
  change swaps the left column's contents in place, keeping the deck visible and
  editable throughout.

## Consequences already applied

- The per-row delete button is gone; removal is the quantity stepper's `−` at one copy
  (`setCardQuantity` drops the line at 0).
- The Cards/Analysis tabs and the deck-health cell are removed. The advisor components
  remain in the codebase, unreachable, pending a design that is not number-led.
- `useDeckAnalysis` is unwired in `DeckBuilderPage` — nothing renders the analysis, and
  it would fetch per-card pair data on every edit for an unread result.

## Open, not decided here

Guided mode's mechanics (keep/skip stream over engine-detected pairings, per the
2026-07-28 discussion) are agreed in shape but unbuilt. This document fixes only
*where* it goes: the left column.
