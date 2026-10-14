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

A buff that grants only a keyword a second copy adds nothing to
(`/\bfloodborn characters? gain (Evasive|Alert|Rush|Ward|Bodyguard)(?=\.| until\b)/i`) does
nothing for a member that already prints that keyword, and Evasive covers Alert
(`floodbornBuffAlreadyPrinted`): Protective Aura's Evasive and Robin Hood - Created by the Vine's
Alert on Prince Phillip - Vanquisher of Foes.

## Payoff-anchored
`findSynergies` skips member-member pairs, so two plain Floodborn never synergize. This
avoids a density-5 pair between every two Floodborn characters that have no payoff role and
could share a deck, which would tag every shifted card in the game; Coverage counts the pairs it
skips.

## Card examples by role

Real cards the `getFloodbornRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Pluto - Determined Defender (Amber), Prince Phillip - Vanquisher of Foes (Emerald), Mickey Mouse - Brave Little Prince (Ruby) | A Floodborn character: the tribe's bodies (payoff-anchored, so members don't pair with each other) |
| **trigger** | Ursula - Created by the Vine (Amber), Hera - Created by the Vine (Amethyst), Maid Marian - Created by the Vine (Sapphire) | Repeating engine that fires whenever one of your Floodborn characters quests, is played or is banished |
| **buff** | Rapunzel's Tower - Taken by the Vine (Amber), Pete - Created by the Vine (Amethyst), Protective Aura (Amethyst) | Static team pump for your Floodborn characters |

## Scoring (5-baseline)
| Pair | Score | Explanation (from the payoff's page) |
|------|-------|-----|
| member + trigger | 7 | `{B} triggers {A}'s Floodborn ability.` |
| payoff + payoff | 7 | Split below |
| member + buff | 6 | `{A}'s Floodborn buff powers up {B}.` |
| member + buff whose keyword the member already prints | 5 | `{A} and {B} both go in a Floodborns deck.` |
| member + member | (not generated) | Payoff-anchored. |

`{A}` is the card whose page shows the tile and `{B}` its partner; on the member's page the tokens swap. Two payoffs split by which of them is a Floodborn character the other's ability helps, at the same 7: neither reads `{A} and {B} are both Floodborn payoffs, so they stack on your board.`; one reads as that member with the other card's buff or trigger line; each reads `{A} and {B} are both Floodborn characters, and each one's ability helps the other.`

## Cross-rule composition
Floodborn banish-triggers (Maid Marian, The Vine) are also detected by the Sacrifice
rule's `banish-trigger`. Expected composition, not a bug.

## Coverage
Every pair is a payoff with a Floodborn character or with another payoff, so every score is 6
or 7.

<!-- coverage:start coverage -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

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
| 6 | 426 | 39.3% |
| 5 | 6 | 0.6% |
<!-- coverage:end -->
