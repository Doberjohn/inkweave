# Seven Dwarfs Synergy Rule

Detailed documentation for the Seven Dwarfs rule — a tribal playstyle synergy that detects Seven Dwarfs decks (the Snow White / Seven Dwarfs package introduced in Set 12).

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `dwarfs`
**Category**: `playstyle`
**Playstyle ID**: `dwarfs`

---

## Overview

The Dwarfs archetype is a tight tribal playstyle: **14 Seven-Dwarfs-classified characters** plus a small set of cards that explicitly reward running them. Like the Toy rule, the tribe is small enough that every match carries signal — unlike the removed Princess/Villain/Hero tribals (`REMOVED_RULES.md`), where uniform strength on hundreds of pairs created noise.

The rule is modeled directly on the **Toy** rule: a role-driven scoring matrix where each card's roles (not regex at score time) drive the score. Membership is a **subtype lookup** — only the payoff side needs regex.

### Sub-themes

The pool spans two card generations that share the same rule:

- **Set 5 / Steel ("Knight" Dwarfs)**: Doc, Grumpy, Happy, Sleepy, Bashful, Sneezy, Dopey — their own abilities pay off *Knight* tribal, but they carry the `Seven Dwarfs` subtype, so they still count toward every density check and are valid recruit/return targets.
- **Set 12 / Amethyst (Snow White package)**: the real tribal payoffs live here — density draws (Doc - Taking Notes, Sleepy - Deep Sleeper, Don't Be Nervous), a free recruit (Right Behind You), and a bounce-for-value engine (Snow White - Merry as the Morning).

A Steel splash unlocks the set-5 members in an Amethyst payoff shell; mono-Amethyst is the most consistent build.

---

## Role Taxonomy

`getDwarfsRoles(card: LorcanaCard): DwarfsRole[]` returns:
- `[]` — not a Seven Dwarfs card
- `['member', ...]` — Seven-Dwarfs-classification card (with any payoff roles it also carries)
- `[...]` (no `member`) — non-member card whose text references "Seven Dwarfs" with a specific payoff mechanic

### Membership gate

A card enters the Dwarfs playstyle if **either**:
1. It has the `Seven Dwarfs` classification (`hasClassification(card, 'Seven Dwarfs')`), OR
2. Its text matches `DWARFS_PAYOFF_PATTERN = /\bSeven Dwarfs\b/i`

Unlike Toy (which needs the tightened `\bToy characters?\b` to dodge the "WORLD'S GREATEST TOY" ability-name false positive), bare `\bSeven Dwarfs\b` is safe: **no card in the database names an ability "Seven Dwarfs"**, so the broad gate matches exactly the 5 genuine payoff cards with zero false positives.

### Role types

| Role | Detection | Cards |
|------|-----------|-------|
| `member` | `Seven Dwarfs` classification | 14 (7 Steel set 5, 7 Amethyst set 12) |
| `density` | `/if you have (?:another \| a \| an \| \d+ or more )?Seven Dwarfs/i` — a benefit gated on Dwarfs in play | 4 (Doc - Taking Notes, Sleepy - Deep Sleeper, Right Behind You, Don't Be Nervous) |
| `recruit` | `/play a Seven Dwarfs character[^.]*for free/i` — cheat a Dwarf into play | 1 (Right Behind You) |
| `return` | `/return (?:chosen )?(?:a \| an )?Seven Dwarfs character/i` — bounce a Dwarf to hand for value | 1 (Snow White - Merry as the Morning) |

### Excluded by design: the "OR Princess" satisfier

Every Set-12 payoff is worded "Seven Dwarfs **OR Princess** character." That Princess clause is **not** modeled here — it would pull all 91 Princess cards into the rule and conflate it with the separate **Princesses** playstyle. Membership is scoped to the Seven Dwarfs subtype and Seven-Dwarfs text references only. Snow White - Merry is still included — caught by her own "Seven Dwarfs" text reference, not by being a Princess.

---

## Card examples by role

Real cards the `getDwarfsRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Sleepy - Sluggish Knight (Steel), Dopey - Drawn to Music (Amethyst), Sneezy - Noisy Knight (Steel) | Carry the Seven Dwarfs classification |
| **density** | Doc - Taking Notes (Amethyst), Sleepy - Deep Sleeper (Amethyst), Right Behind You (Amethyst) | Benefit gated on having Dwarfs in play |
| **recruit** | Right Behind You (Amethyst) | Play a Seven Dwarfs character for free |
| **return** | Snow White - Merry as the Morning (Amethyst) | Bounce a Dwarf to hand: re-buys its enter-play ability and draws |

---

## Scoring (5/7/8 matrix)

The rule uses the project-wide **5-baseline scoring convention**: 5 = neutral default (same-deck density, no compounding), 7+ = a specific mechanical interaction. Dwarfs skips the 6 slot (like Toy).

`scoreDwarfsPair(card, cardRoles, other, otherRoles)` builds a direction-agnostic context (`ctx.cross(x, y)` is true if one side has role `x` and the other has `y`, regardless of which card the user clicked) and walks the matrix highest-precedence-first.

### Matrix (highest precedence first)

| Pair shape | Score | Explanation |
|------------|-------|-------------|
| **recruit ↔ member** *or* **recruit ↔ density** | **8** | A free recruit cheats a Seven Dwarfs character onto the board. |
| **density ↔ density** | **7** | Both reward Seven Dwarfs density — the payoffs compound. |
| **density ↔ member** | **7** | The member feeds the Seven Dwarfs density payoff. |
| **return ↔ member** | **7** | Bouncing the member re-buys its enter-play ability and draws a card. |
| **Otherwise** (member ↔ member, etc.) | **5** | Same-deck density baseline. |

### Why precedence order matters

Right Behind You carries **both** `recruit` and `density`. Against a member it satisfies `cross('recruit','member')` (→8) *and* `cross('density','member')` (→7). The 8 tier is checked first so the stronger tempo line (cheat a body onto the board) wins the tie — scoring it 8, not 7.

---

## Live distribution (Set 12)

17 Seven-Dwarfs-affiliated cards (14 members + 3 non-member payoffs), 136 unique pairs:

| Score | Count | Share | Captures |
|-------|-------|-------|----------|
| **5** | 68 | 50% | member ↔ member — same-deck baseline |
| **7** | 53 | 39% | density ↔ member, density ↔ density, return ↔ member — payoff feeds / compounds |
| **8** | 15 | 11% | recruit ↔ member, recruit ↔ density — free recruit onto the board |

Role population:

| Role | Cards |
|------|-------|
| member | 14 (Doc/Grumpy/Happy/Sleepy/Bashful/Sneezy/Dopey × Steel set 5 + Amethyst set 12) |
| density | 4 (Doc - Taking Notes, Sleepy - Deep Sleeper, Right Behind You, Don't Be Nervous) |
| recruit | 1 (Right Behind You) |
| return | 1 (Snow White - Merry as the Morning) |

Predominant ink: Amethyst (all payoffs). The set-5 members are Steel — a Steel splash deepens the member pool, but `canShareDeck` already treats single-ink Steel members and Amethyst payoffs as compatible (a hypothetical Amethyst-Steel deck), so cross-ink member↔payoff pairs are not filtered out.

---

## Test coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Dwarfs Tribal')`.

### Role detection

| Test | What it verifies |
|------|------------------|
| Member from Seven Dwarfs classification | Dopey - Drawn to Music → `['member']` |
| density from "if you have another Seven Dwarfs" | Doc - Taking Notes → `['member', 'density']` |
| density on a non-member action | Don't Be Nervous → `['density']` |
| density + recruit on Right Behind You | `['density', 'recruit']` |
| return on Snow White - Merry | `['return']` |
| Princess-only card is excluded | a Princess with no Seven Dwarfs text → `[]`, `isDwarfsCard` → false |

### Rule scoring

| Test | Score |
|------|-------|
| member ↔ member (density baseline) | 5 |
| recruit ↔ member (free recruit onto board) | 8 |
| recruit+density ↔ member (precedence: 8 wins over 7) | 8 |
| density ↔ member (member feeds payoff) | 7 |
| density ↔ density (payoffs compound) | 7 |
| return ↔ member (bounce re-buys ETB) | 7 |

---

## Design decisions

### Membership = subtype, not "satisfiability"

The cleanest lever in this rule wasn't regex — it was the Princess boundary. Two coming-soon playstyles (Dwarfs, Princesses) literally share card text ("Seven Dwarfs OR Princess"). Scoping membership by the **`Seven Dwarfs` subtype** (plus Seven-Dwarfs text references) rather than by what *satisfies* the payoff keeps the two archetypes from collapsing into one.

### Set-5 Steel "Knight" Dwarfs are members

They pay off Knight tribal, not Seven Dwarfs, but they carry the subtype and satisfy every density check — so the subtype-as-membership convention (shared with Toy's `hasClassification`) includes them. They are legitimate recruit and return targets.

### recruit ↔ density = 8, like recruit ↔ member

A free recruit needs an enabling board state, but once online it converts a card into a free body — the strongest tempo line the playstyle produces. It earns 8 whether the partner is a raw member or another density payoff, because the recruit itself is what advances the tribal density.

### Skipping score 6

Like Toy, Dwarfs uses 5/7/8 with 6 deliberately empty — reserved for a future sub-tier (e.g., distinguishing a density payoff that draws from one that gains lore) if the pool grows enough to warrant it.
