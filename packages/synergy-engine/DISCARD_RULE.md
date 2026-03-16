# Discard Synergy Rule

Detailed documentation for the Discard rule — a playstyle synergy that detects hand-disruption strategies.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `discard`
**Category**: `playstyle`
**Playstyle ID**: `discard`

---

## Overview

The Discard archetype is a two-role strategy: **enablers** force opponents to discard cards from their hand, while **payoffs** reward you for having more cards than your opponent. Stacking enablers empties the opponent's hand; payoffs convert that advantage into lore, stats, or card advantage.

This is one of the strongest archetype patterns in Lorcana because the enablers *create* the condition that the payoffs *exploit*. Unlike Lore Denial (where all cards do the same thing), Discard has asymmetric roles that create a natural deck-building tension: you need both enablers and payoffs.

### Example

**Enabler**: Sudden Chill — "Each opponent chooses and discards a card."
**Payoff**: Pacha - Trekmate — "While you have more cards in your hand than each opponent, this character gets +2 lore."

Sudden Chill depletes the opponent's hand → Pacha's condition activates → +2 lore every quest.

---

## Role Detection

### Architecture

```typescript
getDiscardRoles(card: LorcanaCard): DiscardRole[]  // returns ['enabler'] | ['payoff'] | ['enabler', 'payoff'] | []
```

A card can be both enabler and payoff (dual-role). Detection uses a fast pre-filter (`HAS_DISCARD_KEYWORD`) before running the full pattern battery.

### Enabler Patterns (7 Families)

Each pattern targets a distinct way Lorcana cards force opponents to lose cards from hand:

| # | Pattern | Example Card Text | What It Catches |
|---|---------|-------------------|-----------------|
| 1 | `(each\|chosen) opponent (chooses and discards\|reveals their hand and discards\|discards)` | "Each opponent chooses and discards a card" | Forced discard, targeted discard, random discard |
| 2 | `have (each\|chosen) opponent choose and discard` | "you may pay 2 to have each opponent choose and discard a card" | Alternate wording of forced discard |
| 3 | `(each\|challenging) player [may] chooses and discards` | "the challenging player may choose and discard a card" | Symmetric discard, challenge-triggered discard |
| 4 | `that player discards a card at random` | "then that player discards a card at random" | Indirect random discard (e.g., post-banish trigger) |
| 5 | `more than \d+ cards in their hand.*discard` | "if they have more than 3 cards in their hand, they discard" | Hand-cap effects (force discard above a threshold) |
| 6 | `most cards in their hands choose and discard` | "The player with the most cards in their hands choose and discard 2 cards" | Comparative targeting (punishes the player with most cards) |
| 7 | `each player draws \d+ cards.*discards \d+ cards at random` | "Each player draws 3 cards, then discards 3 cards at random" | Symmetric chaos (everyone draws then discards randomly) |

### Payoff Pattern (1 Pattern)

```regex
/more\s+cards\s+in\s+your\s+hand\s+than\s+(?:each\s+)?opponents?/i
```

Matches: "While you have more cards in your hand than each opponent" — the canonical hand-size advantage condition.

### What's Excluded

The patterns are carefully scoped to avoid false positives:

| Excluded Pattern | Why |
|-----------------|-----|
| **Self-discard** ("You may choose and discard a card to draw 2 cards") | You're discarding your own cards as a cost, not disrupting the opponent |
| **Mill** (deck → discard pile) | Different strategy axis — attacks the deck, not the hand |
| **Catch-up draw** ("opponent has more cards than you") | Opposite condition — you're behind, not ahead |
| **Discard pile recursion** (return cards from discard) | Different archetype (Zombies/recursion), not hand disruption |

### Fast Pre-Filter

Before running the 7 enabler regexes, `getDiscardRoles` checks `HAS_DISCARD_KEYWORD`:

```regex
/discard|more cards in your hand/i
```

This skips the full pattern battery for the ~95% of cards that don't mention discard at all.

---

## Scoring

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| Enabler ↔ Payoff | **8** | Strong | Enabler creates the condition, payoff exploits it — the strongest archetype interaction |
| Enabler ↔ Enabler | **7** | Strong | Both disrupt the opponent's hand — density makes the strategy consistent |
| Payoff ↔ Payoff | **7** | Strong | Both reward hand-size advantage — running multiple payoffs amplifies the reward |

### Why Enabler ↔ Payoff is 8

This is the **highest score in any playstyle rule** (most playstyle pairs are 7). The extra point reflects the mechanical dependency: enablers alone just annoy the opponent; payoffs alone never activate. Together they form a complete strategy loop. This asymmetric pairing is the *reason* you build a Discard deck — it deserves a higher score than two enablers that merely stack.

### Why Not 9?

Score 9 is reserved for direct synergies where two specific cards have a unique, irreplaceable interaction (like a perfect Shift curve). Discard enabler-payoff is powerful but *fungible* — any enabler works with any payoff. Sudden Chill + Pacha isn't fundamentally different from Daisy Duck + Pacha. The synergy comes from the roles, not the specific cards.

### Explanation Templates

The rule generates role-aware explanations:

- **Enabler ↔ Payoff**: `"{enabler.fullName} depletes the opponent's hand, powering up {payoff.fullName}'s hand-size advantage"`
- **Enabler ↔ Enabler**: `"Both {card.fullName} and {other.fullName} disrupt the opponent's hand"`
- **Payoff ↔ Payoff**: `"Both {card.fullName} and {other.fullName} reward hand-size advantage over opponents"`

---

## Coverage

- ~34 enabler cards in the Core format database
- 2 payoff cards (Pacha - Trekmate, Yzma - Transformed Kitten)
- 36 total discard cards

The low payoff count is accurate to the current card pool — hand-size-advantage is a rare condition in Lorcana. Future sets may add more payoffs, which would automatically be detected by the existing pattern.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Discard Control')`.

### Role Detection Tests (12 tests)

| Test | What It Verifies |
|------|-----------------|
| Forced opponent discard → enabler | "Each opponent chooses and discards a card" |
| Targeted reveal+discard → enabler | "chosen opponent reveals their hand and discards" |
| Hand-cap → enabler | "more than 3 cards in their hand, they discard" |
| Challenging player discard → enabler | "the challenging player may choose and discard" |
| "That player discards at random" → enabler | Indirect post-banish discard trigger |
| Hand-size advantage → payoff | "more cards in your hand than each opponent" (×2 cards) |
| "Have opponent choose and discard" → enabler | Alternate wording |
| "Most cards choose and discard" → enabler | Comparative targeting |
| "Symmetric chaos draw/discard" → enabler | Draw then discard at random |
| Dual-role detection | Card with both enabler and payoff text → both roles |
| Self-discard exclusion | "You may choose and discard" → not matched |
| No text → empty roles | Cards without text produce no roles |

### Scoring Tests (6 tests)

| Test | What It Verifies |
|------|-----------------|
| Enabler ↔ Enabler → 7 | Both disruption cards score 7 |
| Enabler ↔ Payoff → 8 | Cross-role pair scores 8 |
| Payoff ↔ Payoff → 7 | Both advantage cards score 7 |
| Unrelated cards excluded | Non-discard cards produce no matches |
| Self excluded | Card doesn't synergize with itself |
| Bidirectional consistency | Forward and reverse scores are identical |

---

## Design Decisions and Rationale

### Why Two Roles Instead of One?

Early versions of the rule treated all discard cards equally (like Lore Loss does). But playtesting revealed that enablers and payoffs serve fundamentally different deck-building roles:

- **Enablers** are active: they do something to the opponent on their own
- **Payoffs** are conditional: they do nothing unless the opponent's hand is small

A deck of all payoffs never activates. A deck of all enablers works but wastes potential. The two-role model rewards the natural deck-building balance.

### Why Is "Symmetric Chaos" an Enabler?

Cards like "Each player draws 3, then discards 3 at random" affect both players equally — so why count them as opponent disruption? Because in a Discard deck, you *build around* card quality, not quantity. After the symmetric effect resolves, both players have the same hand size, but the Discard player has cards that work together (enablers + payoffs), while the opponent lost random cards. The net effect favors the Discard player.

### Why No Score Differentiation Within Enablers?

All enablers score identically when paired with each other (7) or with payoffs (8). Differentiating "quality" of discard (targeted vs. random, 1 card vs. 2) is a card potency question (#136), not a synergy question. Two mediocre enablers reinforce the strategy just as much as two powerful ones — the synergy relationship is the same.
