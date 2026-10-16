# Toy Synergy Rule

Detailed documentation for the Toy rule — a tribal playstyle synergy that detects Toy-Story decks (Andy's Toys + Sid's Toys sub-themes).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/detection/toy.ts`
**Rule ID**: `toy`
**Category**: `playstyle`
**Playstyle ID**: `toy`

---

## Overview

The Toy archetype is a tight tribal playstyle: a small pool of Toy-classified characters and a few cards that explicitly reward running them (Live distribution counts both). The tribe is small enough that every match carries signal — unlike the removed Princess/Villain/Hero tribals (`REMOVED_RULES.md`), where uniform `moderate` strength on hundreds of pairs created noise.

The rule has been rebuilt around a **role-driven scoring matrix**. The original 4-tier regex classifier (`classifyToyPayoff`) was replaced by per-role detection composed across other playstyles, with scoring driven by which roles each card carries (not by regex pattern matching at score time).

### Sub-Themes

The tribe contains two natural deck archetypes that share the same rule:

- **Andy's Toys**: Woody/Buzz/Jessie/Bullseye/Rex — value-engine package built around Woody Leader's search and stat scaling
- **Sid's Toys**: Wind-Up Frog/Hand-in-the-Box/Bouncing Ducky/Jingle Joe + Sid Phillips — banish-recursion package that loops Toys through the discard pile for triggers

These sub-themes share enough cards (most of the Sid's Toys family also fits the Andy's Toys engine) that splitting them would inflate UI complexity for a pattern of a handful of cards. They roll into a single `toy` playstyle group.

---

## Role Taxonomy

`getToyRoles(card: LorcanaCard): ToyRole[]` returns one of:
- `[]` — not a Toy
- `['member', ...]` — Toy-classification card (with any specific roles it also carries)
- `[...]` (no `member`) — non-Toy card whose text references "Toy character[s]" with a specific mechanic

### Membership gate

A card enters the Toy playstyle if **either**:
1. It has the `Toy` classification (`hasClassification(card, 'Toy')`), OR
2. Its text matches `TOY_PAYOFF_PATTERN = /\bToy characters?\b/i`

The "Toy character[s]" requirement (over a bare `\bToys?\b`) is structurally important: ability names are concatenated into `card.text` alongside effect text. Buzz Lightyear — On the Way has an ability literally named **"WORLD'S GREATEST TOY"** with no Toy-related effect. The tightened pattern requires "Toy character[s]" — every legitimate Toy-payoff in the data uses this canonical phrasing, while flavor-text mentions of "Toy" alone do not.

### Role types

| Category | Roles | Detection |
|----------|-------|-----------|
| **Membership** | `member` | `Toy` classification |
| **Tribal payoffs** (specifically reward Toy density) | `search`, `banish-trigger`, `self-discount` | Toy-targeted regex / parameterized helpers |
| **Generic mechanics** (composed from other playstyles) | `draw`, `cost-reduction`, `burn`, `steal`, `targeted`, `random`, `standard`, `inkwell-ramp`, `inkwell-trigger` | Inherited regex from Lore Denial / Discard / Ramp detectors |

The **tribal vs generic** distinction is the core design axis. Tribal payoffs scale with how many Toys are in the deck. Generic mechanics happen to live on Toy cards but don't specifically reward density.

### Tribal role detection

| Role | Pattern |
|------|---------|
| `search` | `makeSearchPattern('Toy characters?(?:\\s+cards?)?')` — top-of-deck reveal / search-from-deck/discard / "return a Toy" shapes |
| `banish-trigger` | `makeBanishTriggerPattern('Toy characters?')` OR `makeBanishTriggerPattern('this character')` — "when(ever) X is/are/gets banished" with strict tense |
| `self-discount` | `you pay \d+ ⬡? less to play this` OR `play this character for free` — conditional self-cost reduction (incl. limit case "play for free") |

Live distribution names a role's cards when it has six or fewer.

The membership gate runs first, so self-banish (`when this character is banished`) only counts as a Toy banish when the carrying card is itself a Toy member — non-Toy "deathrattle" cards never enter the Toy playstyle.

### Generic role composition

Inside `getToyRoles`, each card is run through other playstyles' detectors after the membership gate clears:

```typescript
for (const r of getLoreDenialRoles(card)) roles.push(r);   // burn, steal
for (const r of getDiscardRoles(card)) {                     // targeted, random, standard
  if (r !== 'payoff') roles.push(r);                         // skip Discard's hand-size payoff (different concept)
}
for (const r of getRampRoles(card)) roles.push(r);           // inkwell-ramp, inkwell-trigger, cost-reduction
```

Then Toy-scoped patterns add the tribal roles (`search`, `banish-trigger`, `self-discount`) and the generic `draw` (literal "draw a card" — not Toy-specific but useful in tribal context).

### Retired role

The original `payoff` fallback bucket was retired once every Toy in the live database mapped onto a specific mechanic. A card can still enter the playstyle without a specific role (via `TOY_PAYOFF_PATTERN` text reference), but it will only surface in synergy results if some specific role is detected. The bucket was empty when it was retired.

---

## Card examples by role

Real cards the `getToyRoles` detector tags for each **Toy-specific** role (names from the live database; effects paraphrased). Generic roles Toy composes from other rules (`draw`, `burn`, `steal`, ramp) are owned by their own playstyles and omitted here:

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Woody - Waiting for a Friend (Amber), Buzz Lightyear - Space Ranger (Emerald), Jingle Joe - Sid's Toy (Ruby) | Carry the Toy classification: the tribe's bodies |
| **search** | Woody - Leader of the Toys (Amber), You've Got a Friend in Me (Amber) | Dig Toy characters out of your deck |
| **banish-trigger** | Rex - Protective Dinosaur (Amber), Alien - True Believer (Emerald), Pterodactyl Janie Doll - Sid's Toy (Ruby) | Fire a bonus when one of your Toys is banished (Sid's-Toys recursion) |
| **self-discount** | Bullseye - Loyal Horse (Amber), Wind-Up Frog - Sid's Toy (Ruby), Hand-in-the-Box - Sid's Toy (Ruby) | Cost less to play when a Toy condition is met |

---

## Scoring (5/7/8 matrix)

The rule uses the project-wide **5-baseline scoring convention**: 5 = neutral default (same-deck density, no compounding), 6+ = specific mechanical interaction. Toys does not use 6 — it skips straight from 5 (baseline) to 7 (tribal compounding) to 8 (peak chain).

`scoreToyPair(card, cardRoles, other, otherRoles)` is implemented as a `??`-chain of per-tier helpers (introduced + degraded findings caught by CodeScene gate when the original cascade-of-ifs version exceeded CC=21):

```typescript
return (
  tryToyPeakChain(ctx) ??
  tryToyMemberSearch(ctx) ??
  tryToyTribalCompound(ctx) ??
  tryToyMemberTribal(ctx) ??
  TOY_DECK_PAIR
);
// TOY_DECK_PAIR: 5, "{A} and {B} both go in a Toys deck."
```

### Matrix (highest precedence first)

| Pair shape | Score | Explanation |
|------------|-------|----------------------|
| **search ↔ banish-trigger** | **8** | `{A} loads a Toy, then {B} pays off when it gets banished. Peak chain.` |
| **Member ↔ search** | **8** | `{A} fetches {B} from the deck. Direct tribal access.` |
| **Tribal ↔ Tribal** (other) | **7** | When either card's text counts the other: one way, the Member ↔ Tribal line; each way, `{A} and {B} are both Toy characters, and each one's ability helps the other.` |
| **Member ↔ Tribal** | **7** | `{A} can activate {B}'s Toy ability.`, when the payoff's text counts the member |
| **Otherwise** | **5** | `{A} and {B} both go in a Toys deck.`, including a tribal pair whose texts count neither card |

On every page `{A}` is the card whose page shows the tile and `{B}` its partner. Each line above is written as the page of the card it names first (the search, the member) shows it. A sentence keeps its order of roles from either page, so on the other card's page its tokens swap: on Woody - Leader of the Toys' page, the You've Got a Friend in Me line reads `{B} fetches {A} from the deck.` The search reads first even when the member has a search of its own: next to You've Got a Friend in Me, Woody is the Toy the song fetches.

The 7 lines follow what the payoff's text counts (`toyAbilityCounts`), not its tag: a text that names Toy characters counts any Toy, and one that names a character counts that card, team halves included (Bullseye - Loyal Horse's discount needs Woody or Jessie, which Woody & Buzz Lightyear meets through its first half). Rex - Protective Dinosaur and Pterodactyl Janie Doll hold Toy payoff roles for their own banish, which counts no other Toy. Their pairs sit at the same-deck 5 unless the partner's text counts them: next to Jingle Joe - Sid's Toy, whose ability counts Toy characters, they score 7 and read `{A} can activate {B}'s Toy ability.` A 7 needs that count, since the same-deck line names no link between the cards. Bullseye - Loyal Horse scores 7 only with a Woody or a Jessie.

The "otherwise" bucket covers Member↔Member, Member↔generic, and Generic↔generic pairs. Generic mechanics' actual cross-card synergies (draw↔draw, burn↔steal) are owned by their own playstyles (Lore Denial, Discard, Ramp) — Toys gives them only the deck-share floor to avoid double-counting.

### Why search is special

Search is the only mechanic that converts a deck slot into immediate tribal density. The search cards (Live distribution names them) are rare and game-winning when present. Member ↔ search and search ↔ banish-trigger are the only pairs that earn 8.

---

## Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**29 Toy-affiliated cards**. **398 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| member ↔ search | 43 | 8 | 10.8% |
| search ↔ banish-trigger | 10 | 8 | 2.5% |
| tribal ↔ tribal | 33 | 7 | 8.3% |
| member ↔ tribal | 103 | 7 | 25.9% |
| tribal ↔ member or tribal, no text counting the other card | 47 | 5 | 11.8% |
| member ↔ member, member ↔ generic, generic ↔ generic | 162 | 5 | 40.7% |

Role population (roles no card holds are left out):

| Role | Cards | Cards per ink |
|----|-----|-------------|
| member | 26 | Amber 11, Emerald 9, Ruby 7 |
| search | 2 (Woody - Leader of the Toys, You've Got a Friend in Me) | Amber 2 |
| draw | 4 (Babyhead - Leader of Sid's Toys, Buzz Lightyear - On the Way, Jessie - Lively Cowgirl, Woody - Jungle Guide) | Amber 2, Emerald 1, Ruby 1 |
| banish-trigger | 5 (Alien - True Believer, Jingle Joe - Sid's Toy, Pterodactyl Janie Doll - Sid's Toy, Rex - Protective Dinosaur, Sid Phillips - Toy Surgeon) | Ruby 3, Amber 1, Emerald 1 |
| self-discount | 4 (Bouncing Ducky - Sid's Toy, Bullseye - Loyal Horse, Hand-in-the-Box - Sid's Toy, Wind-Up Frog - Sid's Toy) | Ruby 3, Amber 1 |
| burn (Lore Denial) | 1 (Pizza Planet - Spaceport) | Emerald 1 |
| steal (Lore Denial) | 1 (Pterodactyl Janie Doll - Sid's Toy) | Ruby 1 |
| targeted (Discard) | 1 (Lenny - Toy Binoculars) | Emerald 1 |
| cost-reduction (Ramp) | 1 (Hamm - Piggy Bank) | Amber 1 |
<!-- coverage:end -->

Andy's Toys lean Amber and Sid's Toys Ruby (the Cards per ink column shows the split). Mono-Amber gets the deepest member pool; mono-Ruby leans on the banish-recursion package.

---

## Test coverage

Tests live in `packages/synergy-engine/src/__tests__/toy.test.ts` under `describe('Toy Tribal')`.

### Role detection

| Test | What it verifies |
|------|------------------|
| Member from Toy classification | Buzz Member → `['member']` |
| banish-trigger from "whenever a Toy character is banished" | Sid Phillips → `['banish-trigger']` |
| banish-trigger from self-banish on Toy member | Alien → `['member', 'banish-trigger']` |
| self-discount on Toy member with conditional cost reduction | Wind-Up Frog → `['member', 'self-discount']` |
| self-discount when condition is non-Toy (named gate) | Bullseye → `['member', 'self-discount']` |
| Hand-in-the-Box (free-play via discard) is self-discount | `['member', 'self-discount']` (the "for free" limit case) |
| Member + specific mechanic for hybrid Toy cards | Woody Leader → `['member', 'search']` |
| Skips ability-name false positives | Buzz Lightyear "WORLD'S GREATEST TOY" → `['member']` |
| Non-Toy cards return empty | Mickey Mouse → `[]`, `isToyCard` → false |

### Rule scoring

| Test | Score |
|------|-------|
| pure member ↔ pure member (density only) | 5 |
| member ↔ search (search fetches a tribal member) | 8 |
| search ↔ banish-trigger (peak tribal chain) | 8 |
| member ↔ banish-trigger (member feeds the trigger) | 7 |
| member ↔ self-discount (member activates discount density) | 7 |
| tribal ↔ tribal (multiple density rewards compound) | 7 |
| a payoff that counts no other Toy (Rex - Protective Dinosaur) ↔ member or payoff (`toy.test.ts`) | 5 |
| member ↔ generic mechanic (deck-share, no tribal compounding) | 5 |
| Rule does not match non-Toy cards | (boolean) |

---

## Design decisions

### Tribal vs Generic role split

The most important design choice is whether each role rewards Toy density or just happens to live on Toy cards. Tribal payoffs (search, banish-trigger, self-discount) scale with member count — every additional Toy in the deck makes them stronger. Generic mechanics (draw, cost-reduction, burn, steal, etc.) are deck-shared but don't specifically compound. Scoring this asymmetry is what makes the matrix honest: a Toys deck's actual synergy is the tribal-density loop, not the incidental mechanics on its members.

### Why search ↔ banish-trigger gets 8 (not just 7 like other Tribal↔Tribal pairs)

Different tribal roles that share a temporal chain (search loads board → banish-trigger pays off when Toy dies) compound stronger than two of the same payoff. The matrix elevates this specific peak chain because it's the strongest mechanical line the playstyle can produce.

### Member ↔ generic = 5, not higher

Counterintuitive but correct: a Toy that happens to draw a card doesn't *combo* with another Toy that ramps. They share the deck. Their actual mechanic synergy lives in *Card Draw* (if it existed) or *Ramp* — not Toys. The Toys rule shouldn't double-count generic-mechanic interactions that other rules already score.

### Generic ↔ generic in Toys = 5

Two non-tribal mechanics inside the Toys playstyle (e.g., Pizza Planet's `burn` ↔ Pterodactyl Janie Doll's `steal`) already synergize via the *Lore Denial* rule (burn↔steal = 6). Toys giving them an extra bump would inflate. Let the right rule own the right synergy.

### Skipping score = 6

Toys uses 5/7/8 with the 6 slot deliberately empty. The unused tier is reserved for future sub-classification (e.g., banish-trigger ↔ self-discount where the discount specifically conditions on banish events — currently collapsed into 7).

### Edge case: Wind-Up Frog ↔ Sid Phillips

Both fire from the *exact same trigger event* (a Toy being banished). One Toy death satisfies Sid's "gain 2 lore" trigger AND Wind-Up Frog's "now I cost 2 less" condition. Mechanically this looks like an 8 — same trigger event, two simultaneous payoffs. The matrix collapses it to 7 (Tribal↔Tribal) because the role taxonomy doesn't distinguish "self-discount conditioned on banish" from "self-discount conditioned on named character presence" (Bullseye). If a future audit reveals this pair deserves the 8, sub-classify self-discount and re-tier.

### Why retire `payoff` instead of keeping a generic fallback

The original `payoff` role caught any card whose text mentioned Toys but didn't match a specific mechanic. After this rewrite, every Toy card in the live database mapped onto a specific role — payoff went to zero. Keeping it as a "just in case" bucket invites silent misclassification. Empty buckets should be retired so future cards force you to add a real mechanic detection rather than fall through to a generic catch-all.
