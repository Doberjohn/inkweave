# Location Control Synergy Rule

Detailed documentation for the Location Control rules — a playstyle synergy built from 9 sub-rules using a factory pattern.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/detection/locationControl.ts`
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

<!-- coverage:start pairs -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

Merged across the 9 sub-rules, **1,873 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Score | Pairs | Share |
|-----|-----|-----|
| 7 | 954 | 50.9% |
| 5 | 751 | 40.1% |
| 3 | 168 | 9.0% |

```chart
{
  "type": "bar",
  "title": "Pairs per sub-rule, before merging",
  "data": {
    "labels": ["Move to Location", "At Location Payoff", "Location Ramp", "Location Buff", "Location Search", "Location Play Trigger", "Location In-Play Check", "Location Move Trigger", "Location Boost"],
    "datasets": [
      {
        "label": "Pairs",
        "data": [826, 490, 413, 405, 294, 190, 159, 138, 21],
        "backgroundColor": ["#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#60b5f5", "#6ee7a0", "#60b5f5", "#6ee7a0", "#60b5f5"]
      }
    ]
  }
}
```
<!-- coverage:end -->

A pair two sub-rules both find counts once in the merged table, so the bars add up to more than its total. Green bars are the high-value sub-rules (7 with a Location), blue the utility ones (5).

### Role Examples

Each role paired with a Location card, using real synergy data:

#### At Location Payoff (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Beast - Snowfield Troublemaker](https://api.lorcana.ravensburger.com/images/en/set11/118_69e8ce2687419dd03bbb0378c04f9509175b0de8.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Beast - Snowfield Troublemaker** | **Elsa's Ice Palace** |

Gets bonuses when characters are at a location. "Your characters at locations get +1 ¤" (Russell - Senior Wilderness Explorer) is one too: it strengthens the characters at a location, not the location, so it reads as at-payoff and never as a buff.

A reward sized by the location's lore gives nothing at a location without lore, so it pairs only with locations that have some (`locationRoleReaches`): Carl Fredricksen - On the Move's "draw cards equal to that location's ◊" skips the locations with 0 ◊, where the pair still stands on his play trigger. The gate holds only while every at-payoff sentence on the card is sized that way.

#### Play Trigger (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Elsa - Ice Artisan](https://api.lorcana.ravensburger.com/images/en/set11/123_c4e62c081171f16d197d27b8167524141478bdda.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Elsa - Ice Artisan** | **Elsa's Ice Palace** |

Triggers effects when you **play** a location. Elsa also has at-payoff. Only "when(ever) you play a location" is the trigger: in Fergus - Outpost Builder's "whenever this character becomes exerted, you may play a location" the location play is the effect, which reads as location ramp. Coverage counts the cards with this role, and names them while there are only a few. Cards that trigger when a character *moves onto* a location are a separate role (see Move Trigger below).

#### Move Trigger (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Taffyta Muttonfudge - Sour Speedster](https://api.lorcana.ravensburger.com/images/en/set5/117_b857847abeeb29cef2adae2b4b46033ab5e3886d.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Taffyta Muttonfudge - Sour Speedster** | **Elsa's Ice Palace** |

Triggers effects when a character **moves onto** a location; Coverage counts the cards. Split from `play-trigger` so the move event scores as its own combo: the `move` enabler that relocates a character is what fires this payoff, so `move ↔ move-trigger` is a complementary pair.

#### Buff (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Fix-It Felix, Jr. - Niceland Steward](https://api.lorcana.ravensburger.com/images/en/set5/12_b4f3630d62cfa2c8b1d3c7fc41449757d7681489.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Fix-It Felix, Jr.** | **Elsa's Ice Palace** |

Strengthens locations (resist, willpower, protection).

A buff limited to one location classification reaches only locations of that classification (`getLocationBuffClassifications`, `locationRoleReaches`). Hyperia City Express's "Your Hyperia City locations get +2 ⛉." scores its buff 7 with the Hyperia City locations only; with any other location it still pairs at 5, through its move ability. The classification is read as the Title Case words between "your" and "locations", case-sensitively, so lowercase shapes stay global: "Your characters and locations gain Resist +1" (We'll Save Our Village). "Your characters at locations get +1 ¤" (Russell - Senior Wilderness Explorer) is no buff at all: `locations get|gain` needs locations as its subject, and that clause reads as at-payoff. A card that also buffs every location ("Your Hyperia City locations get +2 ⛉. Your locations gain Resist +1.") stays global too.

#### Location Ramp (Score 7)

| Support | Location |
|:-------:|:--------:|
| ![Elsa - Concerned Sister](https://api.lorcana.ravensburger.com/images/en/set11/125_e23d60bfee19877c41f0b62e96e8d6cfb0d6c071.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Elsa - Concerned Sister** | **Elsa's Ice Palace** |

Reduces cost of playing or moving to locations.

Three limits keep a ramp card to the locations it can reach (`locationRoleReaches`), from both sides:

- **A cost cap.** "Play a location with cost 3 or less from your discard for free" (Get to Safety!) and "play a location from your hand or discard with cost 4 or less for free" (Fergus - Outpost Builder) reach only locations up to that cost. A card that also ramps every location stays uncapped.
- **A move discount.** "pay 1 ⬡ less to move this character to a location" (Raksha - Fearless Mother) puts no location into play: it does nothing at a location that costs 0 ⬡ to move to (Carl's House - Flying High), and beside another support card it reads as a move (see Cross-Synergy).
- **One clause, one sentence.** A free location play must stay inside its clause: in "Whenever you play a location, you may move this character and up to 1 of your other characters to that location for free" (Carl Fredricksen - On the Move) the free part is the move, so Carl is no ramp card. Each shape also stays inside one sentence.

#### Move (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Goofy - Set for Adventure](https://api.lorcana.ravensburger.com/images/en/set9/74_80ca7805f07696a52675afc79ecec56b7e104fac.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Goofy - Set for Adventure** | **Elsa's Ice Palace** |

Moves characters to locations for positioning.

The mover may be named by pronoun ("move **him** to one of your locations", Colonel Hathi - On the March; "move **them** to that location", People Gonna Come Here), and it may carry a second character ("move this character and up to 1 of your other characters to that location", Carl Fredricksen - On the Move). "**move** … **to** (one of) your locations" is a move destination, not a buff, so the `buff` pattern's bare `your locations` alternative skips the move's own destination and only that: the "to" before it must be the move's first ("up to N" aside). "Give Resist +1 to your locations", even later in a move's sentence, and "remove damage from one of your locations" are still buffs. Damage-moving clauses ("move 1 damage counter from …") are stripped before the move test instead of dropping the card, so a damage move never reads as a location move, and a real mover keeps the role when "damage" appears elsewhere on the card (The Game's Afoot!, whose reminder text reads "Damage dealt to it is reduced by 2") or when another clause, in the same sentence or another, moves damage.

A move limited to one location classification reaches only locations of that classification (`getLocationMoveClassifications`, `locationRoleReaches`), the same gate as a classified buff. Chief Bogo - Police Commissioner ("move him to a Hyperia City location for free") pairs at 5 with the Hyperia City locations (Coverage counts them) and with no other location. The classification is read as the Title Case words in "to a/an/one of your … location(s)", case-sensitively, so "to a location" and "to one of your locations" stay global. The classified clause is cut as a sentence break before the "is the rest of the text still a move?" check, so a trailing "… and gain lore equal to that location's ◊" in the same sentence does not turn a classified move global.

#### In-Play Check (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![John Silver - Greedy Treasure Seeker](https://api.lorcana.ravensburger.com/images/en/set9/192_526cb592f8f52756f537457c1d84678f017c31a8.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **John Silver - Greedy Treasure Seeker** | **Elsa's Ice Palace** |

Gains benefits when you have locations in play. A check on one named location ("if you have a location named Sleepy Hollow in play", Get to Safety!) or on a card under one ("While you have a character or location in play with a card under them", Flintheart Glomgold - Scheming Billionaire and Webby Vanderquack - Knowledge Seeker) rewards no location in play, so neither reads as this role. Their tie to the cards that put cards under locations is not modeled yet.

#### Search (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Amazu's Inkcaster](https://api.lorcana.ravensburger.com/images/en/set12/134_ee36596832274c493abe3d1fed41e3c25674a648.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Amazu's Inkcaster** | **Elsa's Ice Palace** |

Searches deck or discard for location cards. A search for one named location ("reveal a Toy character card or a location card named Andy's Room", Woody - Leader of the Toys) finds only that location, so it is no location search; Named Companions pairs Woody with Andy's Room.

#### Boost (Score 5)

| Support | Location |
|:-------:|:--------:|
| ![Blessed Bagpipes](https://api.lorcana.ravensburger.com/images/en/set10/101_a15dbc3a94a5db5246656007dc448fcf18c9c09b.jpg) | ![Elsa's Ice Palace](https://api.lorcana.ravensburger.com/images/en/set5/67_ad791d04c8bc09f7282d7d3479d401197c4cab1d.jpg) |
| **Blessed Bagpipes** | **Elsa's Ice Palace** |

Works with the Boost keyword to power up locations.

A boost card whose every sentence about cards under a location says "with Boost" ("Put the top card of your deck facedown under one of your characters or locations with Boost", Recovered Page) pairs only with locations that have Boost (Scrooge's Counting House - Ebenezer's Office), not with a location that holds cards some other way (Graveyard of Christmas Future - Lonely Resting Place). Blessed Bagpipes also rewards "locations with a card under them", so it pairs with both.

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
| `at-payoff` | `while.{0,60}at a location\|if.{0,60}at a location\|is at a location\|\bcharacters at locations\b` | "While this character is at a location, she gets +3 lore" |
| `play-trigger` | `when(ever)? you play a location` | "Whenever you play a location, you may exert chosen character" |
| `buff` | `(?<!\bmove\b(?:(?!\bto\b)[^.]\|\bup to\b){0,60}\bto (?:one of )?)your locations\|(?<!\bat )locations (?:gain\|get)\b\|location.*can't be challenged\|location gains? resist` | "Your locations get +2 willpower" |
| `location-ramp` | `\bless\b[^.]*?\b(?:play\|move)\b[^.]*?\blocation\|\bless\b for[^.]*?\blocation\|play a location[^,.]*?(?:from\|for free)` | "you pay 2 less for the next location you play this turn" |
| `move` | `\bmove\b[^.]{0,40}?\b(?:characters?\|him\|her\|them)\b[^.]{0,50}?\blocation\|to the same location` | "you may move a character of yours to a location for free", "you may move him to one of your locations" |
| `in-play-check` | `if you have a location(?! named\b)\|while you have an? [^.]*?\blocation\b(?! named\b)(?![^.]*\bwith a card under\b)\|for each location` | "For each location you have in play, this character gains Resist +1" |
| `search` | `makeSearchPattern('location(?!(?:\s+cards?)?\s+named\b)(?:\s+cards?)?')`: a deck look that reveals, a search, or a return of a location card, not of one named location | "Look at the top 4 cards of your deck. You may reveal a location card" |
| `boost` | `under.*(?:characters\|character) or locations\|under.*locations\|locations with boost\|play a character or location with boost` | "Whenever you put a card under one of your characters or locations" |

### Exclude Patterns

Two exclusion mechanisms prevent false positives:

1. **Anti-location exclusion** (`LOCATION_PATTERNS['anti-location']`): Cards that banish or remove locations are excluded from ALL roles. Pattern: `banish (?:chosen |all )(?:item or )?location|shuffle.*location into`

2. **Damage-move stripping** (`LOCATION_PATTERNS['move-exclude']`, `stripDamageMoves`): a damage-moving clause ("move 1 damage counter from chosen character …"), up to the end of its clause (the next period, comma or semicolon, or the next "move"), is stripped from the text before the move test, both in `getLocationRoles` and in the move rule's `matches`. It therefore never reads as a location move, while a real move elsewhere on the card still counts, and "damage" in reminder text (The Game's Afoot!) or in "remove … damage" never drops a mover. Pattern: `\bmove\b[^.]{0,20}?\bdamage\b`

Location-side gates then decide which locations a matched support card pairs with. Each is applied from both directions, so a pair scores the same whichever card is selected:

1. **Boost gate** (`isBoostBeneficiaryLocation`): a `boost` card pairs only with locations that actually use cards put under them. Applied in `buildLocationDirectMatch` when the support card searches, and in the boost rule's `matches` when a location searches.
2. **Reach gates** (`locationRoleReaches`), applied in `buildLocationDirectMatch` and in `findLocationCardSynergiesForRole`:
   - a `buff` or `move` limited to one location classification ("Your Hyperia City locations get +2 ⛉.", "move him to a Hyperia City location") reaches only locations of that classification (see Buff and Move above);
   - a `location-ramp` with a cost cap reaches only locations up to the cap, and a move discount only locations that cost ink to move to (see Location Ramp);
   - an `at-payoff` sized by the location's lore reaches only locations with lore (see At Location Payoff);
   - a `boost` card that puts cards only under locations "with Boost" reaches only locations with Boost (see Boost).

### Multi-Role Cards

A card can fulfill multiple roles simultaneously:

**Elsa - Ice Artisan**: "When you play this character and whenever you play a location, you may exert chosen character. While this character is at a location, she gets +3 lore."
→ Roles: `['at-payoff', 'play-trigger']`

The engine generates synergies for each role independently. When two sub-rules match the same card pair, the playstyle group keeps the earlier rule's match (see Creation Order).

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
buff              ✓            -         -     -     ○       ○       ✓      -
ramp              ✓            ✓         ✓     -     ✓       ✓       -      ○
move              ✓            -         ○     -     -       -       -      -
in-play-check     -            -         -     -     -       -       ✓      -
search             ✓            ✓         ✓     -     ✓       ✓       -      ○
boost             -            -         -     ○     -       -       ○      -
```

○ marks a link with no text tie (`UNTIED_LINKS` in `rules.ts`), which scores only between two high-value cards (see Cross-Synergy Scoring).

Relationships are checked **bidirectionally** — if A complements B or B complements A, the pair has cross-synergy.

Two refinements read the card text behind the roles (`cardCrossProfile` in `rules.ts`):

- **Self-only clauses** (`getSelfOnlyLocationRoles`). A character's `move`, `at-payoff` or `move-trigger` is self-only when every clause of it concerns that character alone: "move him to a location" (Arthur - Merlin's Assistant), "while this character is at a location" (Shenzi - Hyena Pack Leader), "whenever this character moves to a location" (Goofy - Set for Adventure). A link between two self-only clauses is void, since a character that moves only itself never puts another character at a location. "move him and one of your other characters" moves someone else too, and "all characters at that location get +1 ◊" (Carl Fredricksen & Russell - Intrepid Explorers) rewards everyone there, so neither is self-only.
- **A move discount reads as a move.** Raksha - Fearless Mother's discount on her own move complements what a move complements (at-payoff, buff, move-trigger), not what playing a location does. It still counts as a high-value role for the score.

### Cross-Synergy Scoring

| Condition | Score | Display Tier |
|-----------|-------|-------------|
| Both cards have high-value roles AND are complementary | **5** | Moderate |
| Complementary through a link with a text tie, but not both high-value | **3** | Weak |
| Same roles, non-complementary, or linked only with no text tie and not both high-value | **null** (no synergy) | — |

**Links with no text tie** (○ above) join two cards that share a location deck and nothing more. A boost card puts cards under a location with Boost, which a location search or play ramp rarely brings out (Scrooge McDuck - Cavern Prospector and Amazu's Inkcaster). A buff that protects your locations does nothing for the characters a mover sends there (Launchpad - Hideout Defender and Tuk Tuk - Lively Partner) or for a card's bonus for having a location in play (Launchpad and The Twins - Lost Boys). Two high-value cards linked only this way keep the same-deck 5 (Launchpad and Hyperia City Express). Any other pair linked only this way has no synergy, rather than a Weak tile with nothing behind it.

### Why Low Cross-Synergy Scores?

Two support cards without a Location in play have minimal interaction. The search can find a Location, the buff can protect it, but without the Location itself, neither card is doing its job. Score 5 for high-value pairs acknowledges the strategic alignment; score 3 for utility pairs reflects the loose thematic overlap. A 3 still needs one card to feed the other, as a search finds the location a mover sends characters to (Tuk Tuk - Lively Partner and Amazu's Inkcaster).

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
// Returns 9 rules in order:
// at-payoff, play-trigger, move-trigger, buff, location-ramp, move, in-play-check, search, boost
```

Order matters for deduplication — when the engine merges results from all 9 rules into the `location-control` playstyle group, earlier rules' matches take priority for the same card pair.

---

## UI Integration

### Role Chips

The engine exports labels for UI display:

```typescript
LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string>
// { 'at-payoff': 'At Location', 'play-trigger': 'Trigger', buff: 'Buff',
//   'location-ramp': 'Location Ramp', 'in-play-check': 'While in Play', ... }
// Labels are single-sourced from the mechanics catalog (STRUCTURAL_MECHANICS in
// utils/mechanics.ts) via mechanicLabel(), so the carousel tiles and these chips
// always agree. Rename a label there, not in rules.ts.
```

### Pair lines

Each match carries its own line, which names both cards with the `{A}`/`{B}` chips (`{A}` is the card whose page shows the tile). `LOCATION_ROLE_LINES` in `rules.ts` holds three per role:

| Pair | Line (move) |
|------|-------------|
| support card beside a Location (`withLocation`) | `{A} moves characters to {B}.` |
| two support cards, only the searcher in this role (`general`) | `{A} moves characters to locations.` |
| two support cards, both in this role (`both`) | `{A} and {B} both move characters to locations.` |

The support card reads first from either page: on the Location's page the line is `{B} moves characters to {A}.` The synergy modal draws the tokens as card chips, and a tile's tooltip writes in the card names.

---

## Coverage

<!-- coverage:start coverage -->
**45 Location cards** (Ruby 12, Steel 10, Amber 6, Amethyst 6, Emerald 6, Sapphire 5). By classification: Hyperia City 5, Hunny 1.

| Role | Cards | Cards per ink |
|----|-----|-------------|
| at-payoff | 8 | Ruby 5, Emerald 3, Steel 1 |
| play-trigger | 3 (Carl Fredricksen - On the Move, Ellie Fredricksen - Loving Wife, Elsa - Ice Artisan) | Ruby 2, Emerald 1 |
| move-trigger | 2 (Arthur - Merlin's Assistant, Goofy - Set for Adventure) | Emerald 1, Steel 1 |
| buff | 7 | Steel 7 |
| location-ramp | 6 | Ruby 4, Steel 2 |
| move | 14 | Ruby 6, Steel 6, Emerald 2 |
| in-play-check | 3 (John Silver - Greedy Treasure Seeker, Raya - Determined Explorer, The Twins - Lost Boys) | Steel 3 |
| search | 4 (Amazu's Inkcaster, Closet Door Portal, Pocahontas - Steadfast Traveler, The Cold Never Bothered Me) | Ruby 2, Sapphire 1, Steel 1 |
| boost | 14 | Amber 3, Emerald 3, Ruby 3, Sapphire 3, Amethyst 2 |

Cards with a role: 49. Cards with more than one: 11.
<!-- coverage:end -->

Location cards hold no role: they are what every role pairs with.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/locationControl.test.ts`: `describe('Location Synergy Rules')`, then 24 tests for the classified buff/move gate, move detection and the fixed misreads. Buff: Hyperia City Express scores 7 with a Hyperia City location and 5 with any other, from both sides; a buff-only card has no match outside its classification; and We'll Save Our Village and a mixed buff still reach every location. Move: Chief Bogo scores 5 with a Hyperia City location and has no match with any other, from both sides; a classified move keeps its classification when the same sentence names "that location" again; People Gonna Come Here's "move them to that location" is a move; Colonel Hathi's "move him to one of your locations" is a global move, not a buff; The Game's Afoot! keeps its move despite "Damage" in its reminder text; a move written after a damage-moving clause, in the next sentence or the same one, is a move, while a damage-moving clause alone never is; Carl Fredricksen's two-character move is a move; and "Give Resist +1 to your locations" stays a buff (7 with any location), even after a move in the same sentence. Misreads, each on the card's real text: Woody's named location, Flintheart's card under a location and Get to Safety!'s named location give no role; Get to Safety!'s capped play pairs with a cost-3 location and not a cost-4 one, from both sides; Carl Fredricksen - On the Move is no ramp card and Fergus no play trigger; Raksha's move discount scores 7 with a location that costs ink to move to and 5 (her move) with one that doesn't, and pairs with a location buff but not with an in-play check; two self-only clauses never link (Arthur and Shenzi, Raksha and Goofy) while a mover of another character does (Goofy and Shenzi, Arthur and Goofy) and so does a reward for every character at the location (Raksha and Carl Fredricksen & Russell); Recovered Page pairs with a Boost location but not with Graveyard of Christmas Future, which Blessed Bagpipes still pairs with; Russell - Senior Wilderness Explorer is an at-payoff that skips John Silver; and Carl's lore-sized reward skips a location without lore. Two support cards linked only with no text tie don't pair: Scrooge McDuck - Cavern Prospector and Amazu's Inkcaster, from both sides, and Launchpad - Hideout Defender with Tuk Tuk - Lively Partner, from both sides, or with The Twins - Lost Boys. Tuk Tuk and Amazu's Inkcaster keep their 3, and Launchpad and Hyperia City Express their 5.

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

### Cross-Synergy Tests (14 tests)

| Test | Score | Roles |
|------|-------|-------|
| at-payoff + buff → 5 | Both high-value, complementary |
| at-payoff + move → 3 | One high-value, complementary |
| search + buff → 3 | One utility, complementary |
| move + search → 3 | Both utility, complementary |
| Same roles → null | No cross-synergy for identical roles |
| Non-complementary → null | e.g., at-payoff + in-play-check |
| buff + move and buff → 5 | Both high-value, linked only with no text tie |
| No text tie → null | e.g., boost + search, buff + move |

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

Move cost doesn't influence synergy scores. It only gates a move discount (Raksha - Fearless Mother), which does nothing at a location that costs 0 ⬡ to move to. See `SCORING_DESIGN.md` for the full rationale.

### Why Exclude Anti-Location Cards Entirely?

Cards that banish or remove locations ("banish chosen location") could theoretically synergize with location strategies as removal tools. But in practice, these cards *counter* location strategies — you wouldn't include "banish chosen location" in your own location deck. Excluding them prevents confusing results.

### Why 9 Rules Instead of Pattern-Based Grouping?

An alternative design would use one rule that detects all location patterns and scores based on which pattern matched. The 9-rule approach was chosen because:

1. Each rule has its own `matches()` function that can be independently tested
2. Adding a new role means adding one `createLocationRule()` call, not modifying a complex switch statement
3. The factory pattern keeps each rule's detection and scoring logic isolated
4. The playstyle merging layer handles combining them, so the complexity doesn't leak into the UI

### Why Bidirectional Complementary Checks?

The complementary role matrix isn't symmetric by design. "Search complements at-payoff" (search finds locations that at-payoff needs) but "at-payoff" also "complements search" is debatable — at-payoff doesn't help search do its job. The bidirectional check (`A→B || B→A`) errs on the side of inclusion: if *either* direction has a meaningful interaction, the pair gets cross-synergy. This matches the user expectation that "these cards work together in a location deck."
