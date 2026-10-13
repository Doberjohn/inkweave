# Floodborns Rule (playstyle: Floodborn matters, payoff-anchored)

The Set 13 "Vinelings" archetype. Named for the new Vineling classification, but its
membership and payoffs key on the broader **Floodborn** classification: every payoff
reads "your Floodborn characters". Most Floodborn characters have Shift, but not every
Shift card is Floodborn: the Set 13 Team-ups and some Incredibles Shift cards are Storyborn,
so membership keys on the `Floodborn` classification tag, never on the Shift keyword.

## Roles
- `member` is a Floodborn character (`isCharacter` + `hasClassification('Floodborn')`).
- `buff` is a static team pump: `/your\b[^.]*\bfloodborn characters?\b[^.]*\b(?:get|gain)\b/i`.
- `trigger` is a repeating engine: `/\bwhen(?:ever)?\b[^.]*\bfloodborn\b/i` (quest / play / banish).

A card is a **payoff** if `buff` or `trigger` matches (multi-role allowed; The Vine is all three).

## Payoff-anchored
`findSynergies` skips member-member pairs, so two plain Floodborn never synergize. This
avoids a density-5 pair between every two Floodborn characters that have no payoff role and
could share a deck, which would tag every shifted card in the game; Coverage counts the pairs it
skips.

## Card examples by role

Real cards the `getFloodbornRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Fix-It Felix, Jr. - Niceland Steward (Amber), Maleficent - Formidable Queen (Amethyst), Clarabelle - Light on Her Hooves (Emerald) | A Floodborn character: the tribe's bodies (payoff-anchored, so members don't pair with each other) |
| **trigger** | Hiro Hamada - Future Champion (Emerald), Honey Lemon - Chemistry Whiz (Sapphire), Honey Lemon - Costumed Catalyst (Emerald-Sapphire) | Repeating engine that fires whenever you play a Floodborn |
| **buff** | Rapunzel's Tower - In the Vines' Grip (Amber), Pete - Created by the Vine (Amethyst), Hiro Hamada - Armor Designer (Emerald-Sapphire) | Static team pump for your Floodborn characters |

## Scoring (5-baseline)
| Pair | Score | Why |
|------|-------|-----|
| member + trigger | 7 | The body fires the repeating payoff trigger. |
| payoff + payoff | 7 | Two payoffs stack on the same Floodborn board. |
| member + buff | 6 | The body is pumped by the team buff. |
| member + member | (not generated) | Payoff-anchored. |

## Cross-rule composition
Floodborn banish-triggers (Maid Marian, The Vine) are also detected by the Sacrifice
rule's `banish-trigger`. Expected composition, not a bug.

## Coverage
Every pair is a payoff with a Floodborn character or with another payoff, so every score is 6
or 7.

<!-- coverage:start coverage -->
Counted by `pnpm refresh-rule-coverage` over the 1,228 Core cards in the synergy pool (sets 9-14).

| Role | Cards | Cards per ink |
|----|-----|-------------|
| member | 62 | Amethyst 12, Emerald 11, Steel 11, Ruby 10, Amber 9, Sapphire 9 |
| buff | 11 | Steel 4, Amethyst 3, Ruby 2, Amber 1, Sapphire 1 |
| trigger | 10 | Steel 4, Amethyst 3, Amber 1, Emerald 1, Sapphire 1 |

Payoffs (`buff` or `trigger`): 19. Floodborn characters with no payoff role: 48. Payoff anchoring skips the 1,128 pairs among them that could share a deck.

**1,083 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Score | Pairs | Share |
|-----|-----|-----|
| 7 | 651 | 60.1% |
| 6 | 432 | 39.9% |
<!-- coverage:end -->
