# Location Control Synergy Rule

Detailed documentation for the Location Control rules — a playstyle synergy built from 8 sub-rules using a factory pattern.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule IDs**: `location-at-payoff`, `location-play-trigger`, `location-buff`, `location-location-ramp`, `location-move`, `location-in-play-check`, `location-tutor`, `location-boost`
**Category**: `playstyle`
**Playstyle ID**: `location-control`

---

## Overview

Locations are a card type in Lorcana that occupy a unique board zone. Characters can be moved to locations (paying a move cost), and many cards interact with locations through various roles — buffing them, triggering when they're played, rewarding characters that are "at" a location, and more.

The Location Control playstyle detects cards that participate in location-based strategies and connects them with Location cards and with each other. Rather than one monolithic rule, the engine uses **8 specialized sub-rules** — one per location role — created by a factory function. All 8 merge into a single `location-control` playstyle group in the UI.

### Why 8 Rules Instead of 1?

Each role has a distinct detection pattern and a distinct score when paired with a Location. A single rule would need complex internal routing; 8 rules keep each detection/scoring path simple and independently testable. The playstyle merging layer handles combining them into one group.

---

## Location Roles

### Role Taxonomy

| Role | Score vs Location | Category | What It Does |
|------|------------------|----------|-------------|
| `at-payoff` | **7** | High-value | Gets bonuses when characters are at a location |
| `play-trigger` | **7** | High-value | Triggers effects whenever you play a location |
| `buff` | **7** | High-value | Strengthens locations (resist, willpower, protection) |
| `location-ramp` | **7** | High-value | Reduces cost of playing/moving to locations |
| `move` | **5** | Utility | Moves characters to locations for positioning |
| `in-play-check` | **5** | Utility | Gains benefits when you have locations in play |
| `tutor` | **5** | Utility | Searches deck/discard for location cards |
| `boost` | **5** | Utility | Works with the Boost keyword to power up locations |

### Why the Score Split?

**High-value roles (score 7)** provide direct, repeatable value when paired with a Location:
- At-payoff cards get ongoing stat boosts or lore bonuses
- Play-triggers fire every time you play a Location (repeatable control)
- Buffs protect your Locations from being banished
- Ramp cards let you deploy Locations faster than normal

**Utility roles (score 5)** provide enabling or conditional value:
- Move cards help position characters but don't generate value alone
- In-play-check cards get a passive bonus but don't interact with the Location directly
- Tutor cards find Locations for consistency but provide no direct board impact
- Boost cards synergize with a specific mechanic, not Locations broadly

---

## Detection Patterns

### Role Detection Architecture

```typescript
getLocationRoles(card: LorcanaCard): LocationRole[]
```

Returns all roles a card fulfills (cards can have multiple roles). Location cards themselves return an empty array — they don't have roles, they *are* the target.

### Pattern Table

| Role | Regex | Example Card Text |
|------|-------|-------------------|
| `at-payoff` | `while.{0,60}at a location\|if.{0,60}at a location\|is at a location` | "While this character is at a location, she gets +3 lore" |
| `play-trigger` | `when(ever)? you play a location\|whenever.*play a location` | "Whenever you play a location, you may exert chosen character" |
| `buff` | `your locations\|locations gain\|locations get\|location.*can't be challenged\|location gains? resist` | "Your locations get +2 willpower" |
| `location-ramp` | `\bless\b.*(?:to )?(?:play\|move).*location\|\bless\b for.*location\|play a location.*(?:from\|for free)` | "you pay 2 less for the next location you play this turn" |
| `move` | `move.*to.*location\|moves to a location\|move.*character.*location\|to the same location` | "you may move a character of yours to a location for free" |
| `in-play-check` | `if you have a location\|while you have a.*(location)\|for each location` | "For each location you have in play, this character gains Resist +1" |
| `tutor` | `search.*location card\|reveal.*location card\|return a location\|location card from` | "Search your deck for a location card" |
| `boost` | `under.*(?:characters\|character) or locations\|under.*locations\|locations with boost\|play a character or location with boost` | "Whenever you put a card under one of your characters or locations" |

### Exclude Patterns

Two exclusion mechanisms prevent false positives:

1. **Anti-location exclusion** (`LOCATION_PATTERNS['anti-location']`): Cards that banish or remove locations are excluded from ALL roles. Pattern: `banish (?:chosen |all )(?:item or )?location|shuffle.*location into`

2. **Move-specific exclusion** (`LOCATION_PATTERNS['move-exclude']`): Cards mentioning "move" in a damage context (e.g., "move damage") are excluded from the move role. Pattern: `move.*damage`

### Multi-Role Cards

A card can fulfill multiple roles simultaneously:

**Elsa - Ice Artisan**: "When you play this character and whenever you play a location, you may exert chosen character. While this character is at a location, she gets +3 lore."
→ Roles: `['at-payoff', 'play-trigger']`

The engine generates synergies for each role independently. Deduplication in the playstyle merging layer keeps only the highest-scoring match per card pair.

---

## Synergy Types

### Type 1: Support Card ↔ Location

When a Location card is selected, the engine finds all support cards matching each role. When a support card is selected, the engine finds all Location cards.

Score is determined by the support card's role (see Role Taxonomy table above).

### Type 2: Cross-Synergy (Support ↔ Support)

Two support cards can synergize if their roles are **complementary** — meaning one card enables or amplifies what the other card does.

### Complementary Role Matrix

```
               at-payoff  play-trigger  buff  ramp  move  in-play  tutor  boost
at-payoff         -            -         ✓     -     ✓       -       ✓      -
play-trigger      -            -         -     -     -       -       ✓      -
buff              ✓            -         -     -     ✓       ✓       ✓      -
ramp              ✓            ✓         ✓     -     ✓       ✓       -      ✓
move              ✓            -         ✓     -     -       -       -      -
in-play-check     -            -         -     -     -       -       ✓      -
tutor             ✓            ✓         ✓     -     ✓       ✓       -      ✓
boost             -            -         -     -     -       -       ✓      -
```

Relationships are checked **bidirectionally** — if A complements B or B complements A, the pair has cross-synergy.

### Cross-Synergy Scoring

| Condition | Score | Display Tier |
|-----------|-------|-------------|
| Both cards have high-value roles AND are complementary | **5** | Moderate |
| Complementary but not both high-value | **3** | Weak |
| Same roles, or non-complementary | **null** (no synergy) | — |

### Why Low Cross-Synergy Scores?

Two support cards without a Location in play have minimal interaction. The tutor can find a Location, the buff can protect it, but without the Location itself, neither card is doing its job. Score 5 for high-value pairs acknowledges the strategic alignment; score 3 for utility pairs reflects the loose thematic overlap.

---

## Factory Pattern

### Architecture

```typescript
function createLocationRule(
  id: string,
  name: string,
  role: LocationRole,
  pattern: RegExp,
  excludePattern?: RegExp,
): SynergyRule
```

Each call produces a complete `SynergyRule` with:
- `matches()`: Returns true for Location cards OR cards matching the role's pattern (excluding anti-location and optional exclude pattern)
- `findSynergies()`: Routes to either `findLocationCardSynergiesForRole` (for Locations) or `findLocationSupportSynergies` (for support cards)

### Creation Order

```typescript
createLocationRules(): SynergyRule[]
// Returns 8 rules in order:
// at-payoff, play-trigger, buff, location-ramp, move, in-play-check, tutor, boost
```

Order matters for deduplication — when the engine merges results from all 8 rules into the `location-control` playstyle group, earlier rules' matches take priority for the same card pair.

---

## UI Integration

### Role Chips

The engine exports labels and descriptions for UI display:

```typescript
LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string>
// { 'at-payoff': 'Payoff', 'play-trigger': 'Trigger', buff: 'Buff', ... }

LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, (cardName: string) => string>
// { 'at-payoff': (name) => `${name} gets bonuses when characters are at a location`, ... }
```

These are used in the synergy detail modal to explain *why* a card is in the Location Control group.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Location Synergy Rules')`.

### Role Detection Tests (5 tests)

| Test | What It Verifies |
|------|-----------------|
| Elsa Ice Artisan → at-payoff + play-trigger | Multi-role detection |
| Transport Pod → move | Move role detection |
| Islands I Pulled → tutor | Tutor role detection |
| John Silver → in-play-check | "for each location" detection |
| Felix Steward → buff | "Your locations get" detection |
| Location and unrelated cards → empty | Locations return no roles; unrelated text returns no roles |

### Location ↔ Support Tests (4 tests)

| Test | What It Verifies |
|------|-----------------|
| Location selected → finds all support cards | Agrabah finds Elsa, Transport Pod, John Silver, Islands, Felix |
| Support card selected → finds Locations | Elsa finds Agrabah and Motunui |
| Correct scores by role | at-payoff=7, move=5, tutor=5 |
| Unrelated card → no location synergies | Anna (no location text) produces no location-control group |

### Cross-Synergy Tests (6 tests)

| Test | Score | Roles |
|------|-------|-------|
| at-payoff + buff → 5 | Both high-value, complementary |
| at-payoff + move → 3 | One high-value, complementary |
| tutor + buff → 3 | One utility, complementary |
| move + tutor → 3 | Both utility, complementary |
| Same roles → null | No cross-synergy for identical roles |
| Non-complementary → null | e.g., at-payoff + in-play-check |

### Boost & Ramp Tests (4 tests)

| Test | What It Verifies |
|------|-----------------|
| Webby's Diary → boost role | "put a card under...characters or locations" detection |
| Boost card finds Locations | Webby's Diary synergizes with Agrabah |
| Boost score = 5 | Utility-tier scoring |
| Elsa Concerned → location-ramp, score 7 | "pay 2 less for the next location" detection |

### Anti-Location Exclusion Tests (2 tests)

| Test | What It Verifies |
|------|-----------------|
| Launchpad (banish location) → no roles | Anti-location cards excluded from all roles |
| Location + anti-location card → no synergies | Engine produces no location-control group |

---

## Design Decisions and Rationale

### Why Not Score by Location Move Cost?

Location move cost (how much ink to move a character there) was considered as a scoring factor: cheap locations = higher synergy with move cards. This was excluded because:

1. Move cost is a one-time payment, not an ongoing cost difference
2. The difference between moveCost=1 and moveCost=2 is marginal
3. It would complicate scoring for minimal user value

Move cost is stored on `LorcanaCard` for data completeness but doesn't influence synergy scores. See `SCORING_DESIGN.md` for the full rationale.

### Why Exclude Anti-Location Cards Entirely?

Cards that banish or remove locations ("banish chosen location") could theoretically synergize with location strategies as removal tools. But in practice, these cards *counter* location strategies — you wouldn't include "banish chosen location" in your own location deck. Excluding them prevents confusing results.

### Why 8 Rules Instead of Pattern-Based Grouping?

An alternative design would use one rule that detects all location patterns and scores based on which pattern matched. The 8-rule approach was chosen because:

1. Each rule has its own `matches()` function that can be independently tested
2. Adding a new role means adding one `createLocationRule()` call, not modifying a complex switch statement
3. The factory pattern keeps each rule's detection and scoring logic isolated
4. The playstyle merging layer handles combining them, so the complexity doesn't leak into the UI

### Why Bidirectional Complementary Checks?

The complementary role matrix isn't symmetric by design. "Tutor complements at-payoff" (tutor finds locations that at-payoff needs) but "at-payoff" also "complements tutor" is debatable — at-payoff doesn't help tutor do its job. The bidirectional check (`A→B || B→A`) errs on the side of inclusion: if *either* direction has a meaningful interaction, the pair gets cross-synergy. This matches the user expectation that "these cards work together in a location deck."
