# Named Companions Synergy Rule

Detailed documentation for the Named Companions rule — the second direct synergy rule in Inkweave's engine.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `named-companions`
**Category**: `direct` (pair-specific, not density-based)

---

## Overview

Many Lorcana cards reference other cards by name — "characters named Anna", "item named Microbots", "a card named Pull the Lever!". The Named Companions rule detects these references and finds all cards in the database that match the referenced name.

Unlike Shift (which scores on tempo), Named Companions scores on **effect power** — what the referencing card *does* with the named companion.

### Forward-Only Matching

The rule only fires **forward**: the card with "named X" in its text triggers the match. The targets (cards actually named X) don't trigger reverse matches. This is intentional — the referencing card is the one that benefits from the companion, not the other way around.

### Example

Selecting **Anna - Trusting Sister** ("While you have a character named Elsa in play, this character gains Evasive") finds:
- **Elsa - Snow Queen** (cost 3) — score 7 (strong: keyword grant)
- **Elsa - Ice Maker** (cost 7) — score 7 (strong: keyword grant)
- Every other card with base name "Elsa"

---

## Name Extraction

### Architecture

Name extraction is a two-step process:

1. **Fast pre-filter**: `HAS_NAMED` regex (`/\bnamed\b/i`) skips cards without "named" entirely
2. **Full extraction**: `NAMED_PATTERN` regex captures everything after "named" until a terminator

### The Terminator Approach

Rather than listing all possible card names (which change with every set), the regex captures *everything* after "named" and stops when it hits a game-mechanic word that clearly belongs to rules text:

```
Terminators: in, can, can't, may, get, gain, here, for, from, at, on,
             you, your, their, this, that, challenge, has, have, is, are,
             move, cost, comma, and/or + lowercase verb
```

This handles names with:
- Periods: "Mr. Smee"
- Lowercase articles: "Queen of Hearts", "Pull the Lever!"
- Hyphens: "Fix-It Felix"
- Exclamation marks: "Pull the Lever!", "Wrong Lever!"
- Possessives: "Maurice's Machine"

### Pre-Processing

Before scanning, every Shift reminder is stripped, whatever its cost: `(You may pay 5 ⬡ to play this on top of one of your characters named Elsa.)` or `(You may remove 2 ink drops to play this on top of one of your characters named Baymax.)`. A Shift target belongs to Shift Targets, not here. The strip (`SHIFT_REMINDER` in `cardHelpers.ts`) is keyed on the reminder's own wording, "to play this on top of", rather than on the keyword, so a Shift cost of any shape is covered. The earlier strip required a digit after "Shift", so it missed the ink-drop Shift of Baymax - Amped Up and scored that card's own Shift target as a companion.

### Conjunction Handling

The extractor splits multi-name references:

- **"both X and Y"**: `"named both Chip and Dale"` → `["Chip", "Dale"]`
- **"X or Y"** (both capitalized): `"named Miss Bianca or Bernard"` → `["Miss Bianca", "Bernard"]`
- **"X and Y"** (both capitalized): similar split

If the second word after "and/or" starts lowercase (e.g., "named Anna and draw a card"), it's treated as game text, not a second name.

### Exclusions

Generic game terms are filtered out: "card", "character", "item", "location", "action". These appear in text like "the named card, put it into your hand" and aren't real card names.

---

## Effect Classification

### Architecture

```typescript
classifyNamedEffect(card: LorcanaCard): NamedEffectTier
```

Scans the card's **entire text** (not just the "named" clause) to determine what the card does with the companion. Returns one of five tiers.

### Tier Definitions

| Tier | Score | Triggers | Real Card Examples |
|------|-------|----------|--------------------|
| **Game-winning** | 8 | Free play (`play.*for free`), draw 2+ cards, deck search | Yzma - On Edge (search deck for named card) |
| **Strong** | 7 | Cost reduction (`cost X less`), keyword grants (Rush, Evasive, Bodyguard, Singer) | Anna - Trusting Sister (gains Evasive) |
| **Moderate** | 6 | Stat boosts (+strength/willpower/lore), Resist, Support, can't be challenged | Elsa - Ice Artisan (+2 strength to named Elsa) |
| **Minor** | 5 | Everything else | Cards with minor conditional effects |
| **Hostile** | 4 | Banish/exert the named target (within 40-char window of "named") | Cards that banish a named character |

### Classification Order

The classifier checks tiers **from most extreme inward**: hostile first, then game-winning, strong, moderate. This prevents a card that both banishes *and* buffs from being classified as moderate — the hostile relationship takes priority.

### Why Whole-Text Classification?

The classifier doesn't try to isolate which effect applies to the named companion specifically. Most cards with "named X" revolve their entire design around that companion — the named reference IS the card's purpose. Scanning the whole text is simpler and more robust than trying to parse clause boundaries.

---

## Scoring

| Effect Tier | Score | Display Tier |
|-------------|-------|-------------|
| Game-winning | 8 | Strong |
| Strong | 7 | Strong |
| Moderate | 6 | Moderate |
| Minor | 5 | Moderate |
| Hostile | 4 | Moderate |

Scores are mapped via `NAMED_EFFECT_SCORES` in `cardHelpers.ts`.

```chart
{
  "type": "bar",
  "title": "Named Companions — Effect Tier Distribution (148 matches)",
  "data": {
    "labels": ["Hostile (4)", "Minor (5)", "Moderate (6)", "Strong (7)", "Game-winning (8)"],
    "datasets": [{
      "label": "Matches",
      "data": [0, 59, 31, 42, 16],
      "backgroundColor": ["#f59090", "#60b5f5", "#60b5f5", "#6ee7a0", "#6ee7a0"]
    }]
  }
}
```

### Why Not Higher Scores?

Named companion synergies cap at 8 (not 9-10) because they're **one-sided dependencies**. Card A needs Card B, but Card B doesn't necessarily need Card A. Compare with Shift, where both cards participate in the combo equally. A Shift pair where both cards are dedicated to each other (gap=1, both inkable) earns 9; a named companion where one card passively benefits deserves less.

---

## Coverage

- 44 cards with named references in the Core pool (1,124 cards: sets 9 to 13 plus the Set 14 previews)
- 38 unique referenced names
- 34 of 38 names match a card. The 4 misses are extraction gaps, not missing cards: "Mor'du. ROOTED BY FEAR", "Buzz Lightyear was banished", "Kevin or an item card" and "Belle’s City Guide or an action card"
- 40 cards have a Companions group. The other 4 find no target: three reference only an extraction gap above, and Alien - True Believer names the only Alien in the pool, itself

```chart
{
  "type": "doughnut",
  "title": "Group Sizes — Cards by Number of Targets",
  "data": {
    "labels": ["1-4 targets (57.5%)", "5-9 targets (40.0%)", "10-14 targets (2.5%)", "15+ targets (0.0%)"],
    "values": [23, 16, 1, 0]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Named Companions')`.

### Matching Tests

| Test | What It Verifies |
|------|-----------------|
| Match cards that reference named entities | Forward detection: "named Elsa" triggers match |
| Not match cards without named references | Cards without "named" in text don't match |
| Ignore the character named in an ink-drop Shift reminder | "named Baymax" in Baymax - Amped Up's "(You may remove 2 ink drops to play this on top of ...)" is a Shift target, not a companion |

### Synergy Tests

| Test | What It Verifies |
|------|-----------------|
| Find all cards with the referenced name | All Elsa variants found when Anna references "named Elsa" |
| Not include the source card itself | Self-synergy excluded |
| Score based on effect tier | Keyword grant (Anna) → 7; stat boost (Elsa buff) → 6 |
| Handle cards referencing multiple names | "named Miss Bianca or Bernard" → finds both |
| Handle exclamation-mark names | "named Pull the Lever!" and "named Wrong Lever!" both extracted |
| Mark synergies as bidirectional | All matches flagged as bidirectional |
| Return empty for non-referencing cards | Cards without "named" produce no synergies |

---

## Design Decisions and Rationale

### Why Forward-Only?

If both directions fired, selecting "Elsa - Snow Queen" would produce Named Companion synergies for every card that references Elsa. But Elsa herself doesn't benefit from Anna being in play — Anna benefits from Elsa. The synergy is asymmetric. Forward-only matching keeps results relevant to the selected card.

Note: `bidirectional: true` is still set on matches (for deduplication in the engine), but the rule's `matches()` function only returns `true` for the referencing card.

### Why Terminator-Based Regex Instead of a Name Dictionary?

A dictionary approach would require updating a lookup table every time a new set releases new card names. The terminator approach works with any name — including names from future sets — because it stops at game-mechanic words, not at known names. The tradeoff is occasional misreads on unusual card text: 4 of the 38 names extracted today match no card (see Coverage), so those references find no companion.

### Why 40-Character Window for Hostile Detection?

The hostile tier checks `banish.{0,40}named|named.{0,40}banish` to ensure the banish effect is in the same clause as the named reference. Without the distance limit, a card that says "Banish chosen character. If you have a character named X, draw a card" would be misclassified as hostile — the banish targets any character, not specifically the named one.
