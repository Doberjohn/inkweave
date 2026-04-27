# Toy Synergy Rule

Detailed documentation for the Toy rule — a tribal playstyle synergy that detects Toy-Story decks (Andy's Toys + Sid's Toys sub-themes).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `toy`
**Category**: `playstyle`
**Playstyle ID**: `toy`

---

## Overview

The Toy archetype is a tight tribal playstyle: 21 Toy-classified characters and 11 cards that explicitly reward running them. The tribe is small enough that every match carries signal — unlike the removed Princess/Villain/Hero tribals (`REMOVED_RULES.md`), where uniform `moderate` strength on hundreds of pairs created noise.

Two roles structure the rule:
- **member**: card has the `Toy` classification (e.g., Woody, Buzz Lightyear, Bullseye, Alien)
- **payoff**: card text references "Toy character[s]" with an effect that rewards or scales with Toys (e.g., Sid Phillips' lore-on-banish, Pizza Planet's free move, Woody Leader's search)

A single card can hold both roles. Eight of the 21 members are also payoffs (Woody — Leader of the Toys, Alien — True Believer, Wind-Up Frog, Hand-in-the-Box, etc.). Two payoffs are *not* members: Sid Phillips (a Villain who rewards Toy-banish) and Pizza Planet (a Location).

### Sub-Themes

The tribe contains two natural deck archetypes that share the same rule:
- **Andy's Toys**: Woody/Buzz/Jessie/Bullseye/Rex — value-engine package built around Woody Leader's search and stat scaling
- **Sid's Toys**: Wind-Up Frog/Hand-in-the-Box/Bouncing Ducky/Jingle Joe + Sid Phillips — banish-recursion package that loops Toys through the discard pile for triggers

These sub-themes share enough cards (5 of 11 payoffs are Sid's Toys) that splitting them into separate rules would inflate UI complexity for a 5-card pattern. They roll into a single `toy` playstyle group.

---

## Role Detection

### Architecture

```typescript
getToyRoles(card: LorcanaCard): ToyRole[]  // returns ['member'] | ['payoff'] | ['member', 'payoff'] | []
```

### Member Detection

```typescript
hasClassification(card, 'Toy')
```

Checks the card's `classifications` array (mapped from raw `subtypes` by the card transformer, with `Song` filtered out).

### Payoff Detection

```regex
/\bToy characters?\b/i
```

Matches "Toy character" or "Toy characters" with word boundaries. The pattern is more selective than a bare `\bToys?\b` for one critical reason:

**Lorcana's `card.text` includes ability names**, not just effects. Buzz Lightyear — On the Way has an ability literally named **"WORLD'S GREATEST TOY"** whose effect has nothing to do with Toys (it's a damage trigger). A bare `\bToys?\b` regex matched this ability name as a false-positive payoff. The tightened pattern requires "Toy character[s]" — every legitimate Toy-payoff in the data uses this canonical phrasing, while flavor-text mentions of "Toy" alone do not.

### What's Excluded

| Excluded Pattern | Why |
|------------------|-----|
| **Ability-name mentions** ("WORLD'S GREATEST TOY") | Flavor, not mechanic — caught by requiring "Toy character[s]" |
| **Version-string "Toy"** ("Hand-in-the-Box - Sid's Toy" in `fullName`) | Detection runs against `text`, not `fullName` — version strings can't trigger payoff role |

---

## Tier Classification

Member ↔ Payoff scoring is driven by which effect tier the payoff card belongs to. `classifyToyPayoff(card)` returns one of four tiers:

### Tier Patterns

| Tier | Score | Detection | Example Cards |
|------|-------|-----------|---------------|
| `game-winning` | **8** | `look at the top \d+ cards.*?reveal.*?Toy character` (search) OR `Toy character.*?play this character for free` (free play) | Woody — Leader of the Toys, You've Got a Friend in Me, Hand-in-the-Box |
| `strong` | **7** | `Toy character.*?pay \d+\W+less` (cost reduction) OR `for each (?:other )?Toy character` (per-Toy scaling) OR `\d+ or more (?:other )?Toy characters` (density gate) | Bouncing Ducky, Wind-Up Frog, Alien — True Believer, Jessie — Lively Cowgirl |
| `moderate` | **6** | `Toy characters? (?:get\|gain)` (stat/keyword buff) OR `Toy characters?.*?(?:is\|was\|are\|were).*?banished` (banish trigger) | Woody — Jungle Guide, Sid Phillips, Jingle Joe |
| `minor` | **5** | (default — anything not matched above) | Pizza Planet — Spaceport |

Patterns are checked in order; the first match wins. Cost reduction beats banish trigger when both apply (e.g., Wind-Up Frog).

### Tier Distribution (Set 12 data)

| Tier | Count | Cards |
|------|-------|-------|
| game-winning | 3 | Woody Leader, YGAFIM, Hand-in-the-Box |
| strong | 4 | Jessie, Alien, Wind-Up Frog, Bouncing Ducky |
| moderate | 3 | Woody Jungle Guide, Jingle Joe, Sid Phillips |
| minor | 1 | Pizza Planet |

---

## Scoring

### Pair-Score Logic

`scoreToyPair` computes the **maximum applicable score** across all relevant role-overlap directions:

| Pair Type | Score | Why |
|-----------|-------|-----|
| Member ↔ game-winning Payoff | **8** | Search effects and free-plays scale exponentially with Toy density |
| Member ↔ strong Payoff | **7** | Cost reduction or per-Toy scaling — strong with density |
| Member ↔ moderate Payoff | **6** | Stat/keyword buffs and banish triggers |
| Member ↔ minor Payoff | **5** | Positioning tech, less density-dependent |
| Payoff ↔ Payoff (no member overlap) | **7** | Both reinforce density even when neither is itself a Toy |
| Member ↔ Member (no payoff role) | **5** | Tribal density only — every Toy added makes payoff cards stronger when drawn |

Cards with both roles compute the score in both directions and take the max. This is what makes Woody Leader (member + game-winning payoff) score 8 against another Toy regardless of whether that Toy is a member-only card or a member+payoff card — Woody's game-winning tier dominates.

### Explanation Templates

- **Member ↔ Payoff**: `"{payoff.fullName} {tier description} — including {member.fullName}"`
- **Payoff ↔ Payoff**: `"Both {a} and {b} reward running a Toy-heavy deck"`
- **Member ↔ Member**: `"{a} and {b} are both Toys — density makes payoff cards stronger"`

Tier descriptions: game-winning = "searchs and free-plays Toys"; strong = "reduces cost or scales with Toy density"; moderate = "buffs Toys or rewards their banish"; minor = "enables Toy positioning".

---

## Coverage

| Metric | Count |
|--------|-------|
| Members (Toy classification) | 21 |
| Payoffs (text references "Toy character[s]") | 11 |
| Both member AND payoff | 8 |
| Total unique cards in playstyle | 24 |
| Excluded false positive | 1 (Buzz Lightyear — On the Way's "WORLD'S GREATEST TOY" ability name) |

Predominant inks: Amber (Andy's Toys), Ruby (Sid's Toys). Mono-Amber gets the deepest member pool; mono-Ruby leans on the banish-recursion package.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Toy Tribal')`.

### Role Detection (6 tests)

| Test | What It Verifies |
|------|------------------|
| Member from classification | Buzz Member → `['member']` |
| Payoff from text | Sid Phillips → `['payoff']` |
| Both roles for member+payoff cards | Woody Leader → `['member', 'payoff']` |
| Location with Toy text → payoff | Pizza Planet → `['payoff']` |
| Skips ability-name false positive | Buzz Lightyear "WORLD'S GREATEST TOY" → `['member']` only |
| Non-Toy cards return empty | Mickey Mouse → `[]`, `isToyCard` → false |

### Rule Scoring (8 tests)

| Test | Score |
|------|-------|
| member ↔ member (true density only) | 5 |
| member ↔ game-winning payoff (search) | 8 |
| member ↔ game-winning payoff (free play) | 8 |
| member ↔ moderate payoff (buff) | 6 |
| member ↔ moderate payoff (banish trigger) | 6 |
| member ↔ minor payoff (location move) | 5 |
| payoff ↔ payoff (no member overlap) | 7 |
| Rule does not match non-Toy cards | (boolean) |

---

## Design Decisions

### Why "Toy character[s]" Instead of Bare "Toy"?

Buzz Lightyear — On the Way exposed a structural data quirk: ability names are concatenated into `card.text` alongside effect text. The ability "WORLD'S GREATEST TOY" caused a false-positive payoff classification with a bare `\bToys?\b` pattern. Tightening to `\bToy characters?\b` matches all 11 legitimate payoffs (every one uses "Toy character[s]" canonically) while excluding the ability-name false positive. This pattern shape generalizes to future tribal rules (Madrigal, Seven Dwarfs, Super, Hero).

### Why Tier-Based Scoring Instead of Uniform Strength?

The removed Hero/Villain/Princess tribals (`REMOVED_RULES.md`) all used uniform `moderate` strength regardless of effect. The result: hundreds of low-content pairs that drowned out signal. Toy uses 4 distinct tiers driven by what the card *does* — search effects rate 8 (game-winning), buffs rate 6 (moderate), positioning tech rates 5 (minor). Tier classification is the design difference that lets a small tribe (24 cards) generate meaningful synergies.

### Why Roll Sid's Toys Into the Same Rule?

Sid's Toys (Hand-in-the-Box, Wind-Up Frog, Bouncing Ducky, Jingle Joe, Sid Phillips) is a 5-card sub-tribe with a distinct theme: banish-recursion. Splitting it into its own rule would mean an extra UI playstyle group for 5 cards. The cost-benefit didn't justify the split — the cards are already correctly tiered (cost reduction → strong, banish triggers → moderate) within the unified rule.

### Why Take Max Across Score Directions Instead of Direction-Specific?

A card pair where both are member+payoff (Woody Leader ↔ Hand-in-the-Box) has *two* legitimate Member↔Payoff directions: Woody's search rewards Hand-as-member, and Hand's free-play rewards Woody-as-member. Taking the max across both directions (plus the payoff↔payoff bonus when applicable) reflects the strongest interaction in the pair. The alternative — picking a fixed direction or averaging — either under-counts strong pairs or invents fractional scores.
