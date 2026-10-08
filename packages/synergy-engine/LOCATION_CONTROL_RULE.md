# Location Control Synergy Rule

Detailed documentation for the Location Control rules — a playstyle synergy built from 9 sub-rules using a factory pattern.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule IDs**: `location-at-payoff`, `location-play-trigger`, `location-move-trigger`, `location-buff`, `location-location-ramp`, `location-move`, `location-in-play-check`, `location-search`, `location-boost`
**Category**: `playstyle`
**Playstyle ID**: `location-control`

---

## Overview

Locations are a card type in Lorcana that occupy a unique board zone. Characters can be moved to locations (paying a move cost), and many cards interact with locations through various roles — buffing them, triggering when they're played, rewarding characters that are "at" a location, and more.

The Location Control playstyle detects cards that participate in location-based strategies and connects them with Location cards and with each other. Rather than one monolithic rule, the engine uses **9 specialized sub-rules** — one per location role — created by a factory function. All 9 merge into a single `location-control` playstyle group in the UI.

### Why 9 Rules Instead of 1?

Each role has a distinct detection pattern and a distinct score when paired with a Location. A single rule would need complex internal routing; 9 rules keep each detection/scoring path simple and independently testable. The playstyle merging layer handles combining them into one group.

---

## Location Roles

### Role Taxonomy

| Role | Score vs Location | Category | What It Does |
|------|------------------|----------|-------------|
| `at-payoff` | **7** | High-value | Gets bonuses when characters are at a location |
| `play-trigger` | **7** | High-value | Triggers effects when you **play** a location |
| `move-trigger` | **7** | High-value | Triggers effects when a character **moves onto** a location (pairs with `move`) |
| `buff` | **7** | High-value | Strengthens locations (resist, willpower, protection) |
| `location-ramp` | **7** | High-value | Reduces cost of playing/moving to locations |
| `move` | **5** | Utility | Moves characters to locations for positioning |
| `in-play-check` | **5** | Utility | Gains benefits when you have locations in play |
| `search` | **5** | Utility | Searches deck/discard for location cards |
| `boost` | **5** | Utility | Works with the Boost keyword to power up locations |

```chart
{
  "type": "bar",
  "title": "Matches per Sub-Rule (4,220 total)",
  "data": {
    "labels": ["Boost", "At Payoff", "Move", "In-Play Check", "Buff", "Ramp", "Search"],
    "datasets": [{
      "label": "Matches",
      "data": [1112, 688, 586, 546, 458, 418, 412],
      "backgroundColor": ["#60b5f5", "#6ee7a0", "#60b5f5", "#60b5f5", "#6ee7a0", "#6ee7a0", "#60b5f5"]
    }]
  }
}
```

```chart
{
  "type": "doughnut",
  "title": "Combined Score Distribution",
  "data": {
    "labels": ["Score 5 — Utility (59.5%)", "Score 7 — High-value (30.5%)", "Score 3 — Cross-synergy (10.0%)"],
    "values": [2512, 1288, 420]
  }
}
```

### Role Examples

Each role paired with a Location card, using real synergy data:

#### At Location Payoff (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Beast - Snowfield Troublemaker](https://api.lorcana.ravensburger.com/images/en/set11/118_69e8ce2687419dd03bbb0378c04f9509175b0de8.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Beast - Snowfield Troublemaker** | **Elsa's Ice Palace** |

Gets bonuses when characters are at a location.

#### Play Trigger (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Elsa - Ice Artisan](https://api.lorcana.ravensburger.com/images/en/set11/123_c4e62c081171f16d197d27b8167524141478bdda.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Elsa - Ice Artisan** | **Elsa's Ice Palace** |

Triggers effects when you **play** a location. Elsa is the only card with this role (she also has at-payoff). Cards that trigger when a character *moves onto* a location are a separate role — see Move Trigger below.

#### Move Trigger (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Taffyta Muttonfudge - Sour Speedster](https://api.lorcana.ravensburger.com/images/en/set5/117_b857847abeeb29cef2adae2b4b46033ab5e3886d.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Taffyta Muttonfudge - Sour Speedster** | **Elsa's Ice Palace** |

Triggers effects when a character **moves onto** a location (Taffyta, Goofy). Split from `play-trigger` so the move event scores as its own combo: the `move` enabler that relocates a character is what fires this payoff, so `move ↔ move-trigger` is a complementary pair.

#### Buff (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Fix-It Felix, Jr. - Niceland Steward](https://api.lorcana.ravensburger.com/images/en/set5/12_b4f3630d62cfa2c8b1d3c7fc41449757d7681489.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Fix-It Felix, Jr.** | **Elsa's Ice Palace** |

Strengthens locations (resist, willpower, protection).

A buff limited to one location classification reaches only locations of that classification (`getLocationBuffClassifications`, `locationRoleReaches`). Hyperia City Express's "Your Hyperia City locations get +2 ⛉." scores its buff 7 with the Hyperia City locations only; with any other location it still pairs at 5, through its move ability. The classification is read as the Title Case words between "your" and "locations", case-sensitively, so lowercase shapes stay global: "Your characters and locations gain Resist +1" (We'll Save Our Village) and "Your characters at locations get +1 ¤" (Russell - Senior Wilderness Explorer). A card that also buffs every location ("Your Hyperia City locations get +2 ⛉. Your locations gain Resist +1.") stays global too.

#### Location Ramp (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Elsa - Concerned Sister](https://api.lorcana.ravensburger.com/images/en/set11/125_e23d60bfee19877c41f0b62e96e8d6cfb0d6c071.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Elsa - Concerned Sister** | **Elsa's Ice Palace** |

Reduces cost of playing or moving to locations.

#### Move (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Goofy - Set for Adventure](https://api.lorcana.ravensburger.com/images/en/set9/74_80ca7805f07696a52675afc79ecec56b7e104fac.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Goofy - Set for Adventure** | **Elsa's Ice Palace** |

Moves characters to locations for positioning.

The mover may be named by pronoun ("move **him** to one of your locations", Colonel Hathi - On the March; "move **them** to that location", People Gonna Come Here), and it may carry a second character ("move this character and up to 1 of your other characters to that location", Carl Fredricksen - On the Move). "**move** … **to** (one of) your locations" is a move destination, not a buff, so the `buff` pattern's bare `your locations` alternative skips it after a "move … to" and only there: "give Resist +1 to your locations" and "remove damage from one of your locations" are still buffs. Damage-moving clauses ("move 1 damage counter from …") are stripped before the move test instead of dropping the card, so a damage move never reads as a location move, and a real mover keeps the role when "damage" appears elsewhere on the card (The Game's Afoot!, whose reminder text reads "Damage dealt to it is reduced by 2") or when a separate sentence moves damage.

A move limited to one location classification reaches only locations of that classification (`getLocationMoveClassifications`, `locationRoleReaches`), the same gate as a classified buff. Chief Bogo - Police Commissioner ("move him to a Hyperia City location for free") pairs at 5 with the five Hyperia City locations and with no other location. The classification is read as the Title Case words in "to a/an/one of your … location(s)", case-sensitively, so "to a location" and "to one of your locations" stay global. The classified clause is cut as a sentence break before the "is the rest of the text still a move?" check, so a trailing "… and gain lore equal to that location's ◊" in the same sentence does not turn a classified move global.

#### In-Play Check (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Flintheart Glomgold - Scheming Billionaire](https://api.lorcana.ravensburger.com/images/en/set10/76_2aed0e5a593164b41c3f301621b079977eab7427.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Flintheart Glomgold** | **Elsa's Ice Palace** |

Gains benefits when you have locations in play.

#### Search (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Goldie O'Gilt - Cunning Prospector](https://api.lorcana.ravensburger.com/images/en/set10/87_90807268acf6a0f1017fcbee24b8c19361430e5c.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Goldie O'Gilt** | **Elsa's Ice Palace** |

Searches deck or discard for location cards.

#### Boost (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Blessed Bagpipes](https://api.lorcana.ravensburger.com/images/en/set10/101_a15dbc3a94a5db5246656007dc448fcf18c9c09b.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Blessed Bagpipes** | **Elsa's Ice Palace** |

Works with the Boost keyword to power up locations.

---

### Why the Score Split?

**High-value roles (score 7)** provide direct, repeatable value when paired with a Location:
- At-payoff cards get ongoing stat boosts or lore bonuses
- Play-triggers fire every time you play a Location (repeatable control)
- Buffs protect your Locations from being banished
- Ramp cards let you deploy Locations faster than normal

**Utility roles (score 5)** provide enabling or conditional value:
- Move cards help position characters but don't generate value alone
- In-play-check cards get a passive bonus but don't interact with the Location directly
- Search cards find Locations for consistency but provide no direct board impact
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
| `buff` | `(?<!\bmove\b[^.]{0,60}\bto (?:one of )?)your locations\|locations gain\|locations get\|location.*can't be challenged\|location gains? resist` | "Your locations get +2 willpower" |
| `location-ramp` | `\bless\b.*(?:to )?(?:play\|move).*location\|\bless\b for.*location\|play a location.*(?:from\|for free)` | "you pay 2 less for the next location you play this turn" |
| `move` | `\bmove\b[^.]{0,40}?\b(?:characters?\|him\|her\|them)\b[^.]{0,50}?\blocation\|to the same location` | "you may move a character of yours to a location for free", "you may move him to one of your locations" |
| `in-play-check` | `if you have a location\|while you have a.*(location)\|for each location` | "For each location you have in play, this character gains Resist +1" |
| `search` | `search.*location card\|reveal.*location card\|return a location\|location card from` | "Search your deck for a location card" |
| `boost` | `under.*(?:characters\|character) or locations\|under.*locations\|locations with boost\|play a character or location with boost` | "Whenever you put a card under one of your characters or locations" |

### Exclude Patterns

Two exclusion mechanisms prevent false positives:

1. **Anti-location exclusion** (`LOCATION_PATTERNS['anti-location']`): Cards that banish or remove locations are excluded from ALL roles. Pattern: `banish (?:chosen |all )(?:item or )?location|shuffle.*location into`

2. **Damage-move stripping** (`LOCATION_PATTERNS['move-exclude']`, `stripDamageMoves`): a damage-moving clause ("move 1 damage counter from chosen character …"), through the end of its sentence, is stripped from the text before the move test, both in `getLocationRoles` and in the move rule's `matches`. It therefore never reads as a location move, while a real move elsewhere on the card still counts, and "damage" in reminder text (The Game's Afoot!) or in "remove … damage" never drops a mover. Pattern: `\bmove\b[^.]{0,20}?\bdamage\b`

Two location-side gates then decide which locations a matched support card pairs with. Each is applied from both directions, so a pair scores the same whichever card is selected:

1. **Boost gate** (`isBoostBeneficiaryLocation`): a `boost` card pairs only with locations that actually use cards put under them. Applied in `buildLocationDirectMatch` when the support card searches, and in the boost rule's `matches` when a location searches.
2. **Classified buff/move gate** (`locationRoleReaches`): a `buff` or `move` limited to one location classification ("Your Hyperia City locations get +2 ⛉.", "move him to a Hyperia City location") pairs only with locations of that classification. Applied in `buildLocationDirectMatch` and in `findLocationCardSynergiesForRole`. See Buff and Move above.

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
               at-payoff  play-trigger  buff  ramp  move  in-play  search  boost
at-payoff         -            -         ✓     -     ✓       -       ✓      -
play-trigger      -            -         -     -     -       -       ✓      -
buff              ✓            -         -     -     ✓       ✓       ✓      -
ramp              ✓            ✓         ✓     -     ✓       ✓       -      ✓
move              ✓            -         ✓     -     -       -       -      -
in-play-check     -            -         -     -     -       -       ✓      -
search             ✓            ✓         ✓     -     ✓       ✓       -      ✓
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

Two support cards without a Location in play have minimal interaction. The search can find a Location, the buff can protect it, but without the Location itself, neither card is doing its job. Score 5 for high-value pairs acknowledges the strategic alignment; score 3 for utility pairs reflects the loose thematic overlap.

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
// at-payoff, play-trigger, buff, location-ramp, move, in-play-check, search, boost
```

Order matters for deduplication — when the engine merges results from all 8 rules into the `location-control` playstyle group, earlier rules' matches take priority for the same card pair.

---

## UI Integration

### Role Chips

The engine exports labels and descriptions for UI display:

```typescript
LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string>
// { 'at-payoff': 'At Location', 'play-trigger': 'Trigger', buff: 'Buff',
//   'location-ramp': 'Location Ramp', 'in-play-check': 'While in Play', ... }
// Labels are single-sourced from the mechanics catalog (STRUCTURAL_MECHANICS in
// utils/mechanics.ts) via mechanicLabel(), so the carousel tiles and these chips
// always agree. Rename a label there, not in rules.ts.

LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, (cardName: string, locationName: string) => string>
// { 'at-payoff': (name, loc) => `${name} gets bonuses when characters are at ${loc}`, ... }
```

These are used in the synergy detail modal and vote screen to explain *why* a card is in the Location Control group. The `locationName` parameter is the name of the Location card in the pair (or "locations" if neither card is a Location).

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Location Synergy Rules')`. The classified buff/move gate and move detection are tested in `packages/synergy-engine/src/__tests__/locationControl.test.ts` (14 tests). Buff: Hyperia City Express scores 7 with a Hyperia City location and 5 with any other, from both sides; a buff-only card has no match outside its classification; and We'll Save Our Village, Russell - Senior Wilderness Explorer and a mixed buff still reach every location. Move: Chief Bogo scores 5 with a Hyperia City location and has no match with any other, from both sides; a classified move keeps its classification when the same sentence names "that location" again; People Gonna Come Here's "move them to that location" is a move; Colonel Hathi's "move him to one of your locations" is a global move, not a buff; The Game's Afoot! keeps its move despite "Damage" in its reminder text; a move written after a damage-moving clause is a move, while a damage-moving clause alone never is; Carl Fredricksen's two-character move is a move; and "Give Resist +1 to your locations" stays a buff (7 with any location).

### Role Detection Tests (5 tests)

| Test | What It Verifies |
|------|-----------------|
| Elsa Ice Artisan → at-payoff + play-trigger | Multi-role detection |
| Transport Pod → move | Move role detection |
| Islands I Pulled → search | Search role detection |
| John Silver → in-play-check | "for each location" detection |
| Felix Steward → buff | "Your locations get" detection |
| Location and unrelated cards → empty | Locations return no roles; unrelated text returns no roles |

### Location ↔ Support Tests (4 tests)

| Test | What It Verifies |
|------|-----------------|
| Location selected → finds all support cards | Agrabah finds Elsa, Transport Pod, John Silver, Islands, Felix |
| Support card selected → finds Locations | Elsa finds Agrabah and Motunui |
| Correct scores by role | at-payoff=7, move=5, search=5 |
| Unrelated card → no location synergies | Anna (no location text) produces no location-control group |

### Cross-Synergy Tests (6 tests)

| Test | Score | Roles |
|------|-------|-------|
| at-payoff + buff → 5 | Both high-value, complementary |
| at-payoff + move → 3 | One high-value, complementary |
| search + buff → 3 | One utility, complementary |
| move + search → 3 | Both utility, complementary |
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

The complementary role matrix isn't symmetric by design. "Search complements at-payoff" (search finds locations that at-payoff needs) but "at-payoff" also "complements search" is debatable — at-payoff doesn't help search do its job. The bidirectional check (`A→B || B→A`) errs on the side of inclusion: if *either* direction has a meaningful interaction, the pair gets cross-synergy. This matches the user expectation that "these cards work together in a location deck."
