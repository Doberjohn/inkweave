# Merida - Wisp Conjurer (BECKON) Synergy Rule

Detailed documentation for the Merida rule — a direct synergy built around **Merida - Wisp Conjurer**, whose BECKON ability draws a card whenever another of your characters enters play exerted.

**Source**: `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `merida-wisp`
**Category**: `direct` (single-anchor, bidirectional)

---

## Overview

**Merida - Wisp Conjurer** (Amethyst, id 13050) carries two abilities:

> **FOCUSED ENERGY** — This character may enter play exerted to draw a card.
> **BECKON** — During your turn, whenever another character of yours enters play exerted, you may draw a card.

BECKON turns "a character of yours entered play exerted" into a repeatable draw. So Merida synergizes with any card that **pushes your characters into play exerted** — the more often it does so, the more Merida draws.

This is the engine's second **single-anchor direct rule** (after Spike Suit): one card defines the whole synergy, and the anchor is matched on ability text (`/whenever another character of yours enters play exerted/i`), not a card id, so any reprint joins for free.

Crucially, Merida's own **FOCUSED ENERGY** self-exert does **not** trigger BECKON — BECKON reads "**another** character" — so she never pairs with herself.

### Bidirectional Matching

- **Forward**: selecting Merida finds every exerted-entry enabler.
- **Reverse**: selecting an enabler finds Merida.

The explanation token-swaps so Merida always reads as the **payoff** regardless of which page you view.

### Example

Selecting **Merida - Wisp Conjurer** surfaces (top of the list):
- **The Horned King - Merciless Master** (13022) — score **8** (engine: replays your discard exerted)
- **Simba - King in the Making** (2209) — score **8** (engine: plays revealed characters exerted)
- **Powhatan's Staff** (13036, item) — score **8** (engine: the next character you play enters exerted)
- **Lilo - Escape Artist** (1201) — score **7** (reanimator: replays herself exerted from the discard)
- **Fix-It Felix, Jr. - Trusty Builder** (966) — score **5** (Bodyguard body enters play exerted)

---

## Detection

### Anchor Detection

`isBeckonAnchor(card)` tests normalized text against:

```regex
/whenever another character of yours enters play exerted/i
```

Against the current pool this matches exactly one card (Merida - Wisp Conjurer, 13050).

### Enabler Detection & Tiers

`getBeckonEnablerTier(card)` returns one of three tiers, or `null`. Order is load-bearing:

1. **Anchor self-check** — the anchor's own self-exert (FOCUSED ENERGY) never counts as an enabler.
2. **Opposing exclusion** — `/opposing[^.]{0,40}enters? play exerted/i` drops cards that make the *opponent's* characters enter exerted (removal/tempo, not a BECKON enabler: Jiminy Cricket, Figaro).
3. **`reanimator`** — `/(?:this card is in your discard|from your discard)[^.]{0,140}(?:he|she|it|they|this character) enters? play exerted/i` — replays *itself* exerted from your discard (Lilo, Stitch).
4. **`engine`** — `/they enter play exerted|the next character you play[^.]{0,80}enters? play exerted/i` — pushes *other* characters into play exerted, board-wide (Horned King, Simba, Powhatan's Staff).
5. **`self`** — `/this character (?:may )?enters? play exerted/i`, **gated on `isCharacter`** — a self-only body that enters exerted once (the Bodyguard reminder plus a few explicit bodies).

### The Item Exception

**Powhatan's Staff** (13036) is an **Item**, but it reads "the next character you play this turn enters play exerted" — it pushes a **character** into exerted. Like the Shift rule's `named-item` exception, an item is admitted here even though `type !== 'Character'`, because the trigger it feeds is about a character.

Conversely, items that read "**this item** enters play exerted" (Sapphire Chromicon, MegaBot, Potato, Vine Pod, Closet Door Portal, ...) are **excluded** — the `self` branch requires `isCharacter`, and they don't match the engine/reanimator patterns, so they drop out. An item entering exerted itself is a character-only trigger and never fires BECKON.

### Ink Compatibility

Handled centrally by the engine (`canShareDeck`) before rules run. Merida is single-ink Amethyst, so she pairs with every single-ink card and any dual-ink card containing Amethyst.

---

## Scoring

Score is set purely by the enabler tier — how much exerted-entry pressure it generates for BECKON:

| Tier | Score | Why |
|------|-------|-----|
| `engine` | **8** | Board-wide / repeatable: fires BECKON many times per game (win-condition engine). |
| `reanimator` | **7** | A body that keeps replaying *itself* exerted from the discard — one repeatable exerted entry per loop. |
| `self` | **5** | A one-shot self-only body (Bodyguard reminder) — fires BECKON exactly once. Same-deck density baseline. |

5 is the 5-baseline density floor: a Bodyguard body and Merida in the same deck is a single BECKON trigger, no compounding. Engines (8) and reanimators (7) justify themselves by firing BECKON repeatedly.

### Explanation Template

```text
{enabler} <does X>, so {Merida} draws a card each time.
```

`{enabler}` / `{Merida}` are `{A}`/`{B}` chip tokens, swapped by direction so Merida always reads as the payoff. `<does X>` is the per-tier fragment: engine → "repeatedly pushes your characters into play exerted", reanimator → "keeps replaying itself into play exerted from your discard", self → "enters play exerted".

---

## Coverage

Based on the current Core + Set 13 preview pool:
- **1 anchor** (Merida - Wisp Conjurer, 13050)
- **60 raw enablers**: **3 engine** (The Horned King 13022, Simba 2209, Powhatan's Staff 13036 [item]), **2 reanimator** (Lilo 1201, Stitch 1830), **55 self-only** bodies
- **55 deck-compatible** with Amethyst Merida (all 5 engine/reanimator + 50 of 55 self-only; 5 dual-ink bodies lack Amethyst)

Merida's synergy page score distribution (after the ink filter): **50 × 5 / 2 × 7 / 3 × 8**. The self-only pool is Bodyguard-heavy — Amber (23) and Steel (20) dominate, matching the Bodyguard tribes.

```chart
{
  "type": "bar",
  "title": "Merida BECKON — Enabler tiers (60 raw enablers)",
  "data": {
    "labels": ["engine (score 8)", "reanimator (score 7)", "self-only (score 5)"],
    "datasets": [{
      "label": "Enablers",
      "data": [3, 2, 55],
      "backgroundColor": ["#d4af37", "#6ee7a0", "#60b5f5"]
    }]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Merida - Wisp Conjurer (BECKON)')`.

| Test | What It Verifies |
|------|-----------------|
| Anchor matches by ability text | `matches()` true for Merida |
| Enablers match across tiers | engine / reanimator / self / item-engine all match |
| Exclusions | opposing-side exert + "this item enters play exerted" excluded |
| Score by tier | Horned King/Simba/Powhatan's Staff = 8, Lilo = 7, Fix-It Felix = 5 |
| No self-pair | Merida's FOCUSED ENERGY self-exert never makes her her own enabler |
| Reverse find | a self-only body returns only Merida |
| Token-swap | forward `{B} ... so {A} draws`, reverse `{A} ... so {B} draws` — Merida stays the payoff |
| Bidirectional flag | all matches have `bidirectional: true` |

---

## Design Decisions and Rationale

### Why a Single-Anchor Direct Rule?

Only one card in the pool has BECKON, and the synergy is entirely about *building around it*. Modeling it as a direct rule (not a playstyle) keeps it pair-specific — there is no "exerted-entry density", you either run Merida or you don't. The reverse direction exists so browsing a Bodyguard body or a reanimator surfaces Merida as the build-around payoff.

### Why Score by Tier Instead of a Flat Number?

A Bodyguard body triggers BECKON once (one card, one draw); the Horned King triggers it every time you replay a character from the discard. Flattening these to one score would hide the difference that actually matters to the deck. The tier map (8/7/5) tracks how many BECKON draws the enabler realistically generates.

### Why Exclude Merida Herself?

BECKON reads "**another** character of yours". Her own FOCUSED ENERGY self-exert is explicitly *not* another character, so it can't loop into a draw. The anchor self-check in `getBeckonEnablerTier` enforces this, so she never self-pairs.
