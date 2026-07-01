# Floodborns Rule (playstyle: Floodborn matters, payoff-anchored)

The Set 13 "Vinelings" archetype. Named for the new Vineling classification, but its
membership and payoffs key on the broader **Floodborn** classification: every payoff
reads "your Floodborn characters", and every Shift card in the game is Floodborn.

## Roles
- `member` is a Floodborn character (`isCharacter` + `hasClassification('Floodborn')`).
- `buff` is a static team pump: `/your\b[^.]*\bfloodborn characters?\b[^.]*\b(?:get|gain)\b/i`.
- `trigger` is a repeating engine: `/\bwhen(?:ever)?\b[^.]*\bfloodborn\b/i` (quest / play / banish).

A card is a **payoff** if `buff` or `trigger` matches (multi-role allowed; The Vine is all three).

## Payoff-anchored
`findSynergies` skips member-member pairs, so two plain Floodborn never synergize. This
avoids ~6,400 density-5 pairs that would tag every shifted card in the game.

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
12 payoffs (7 buff + 6 trigger, The Vine in both) against 122 Floodborn in the merged
preview pool, plus the payoff-vs-payoff pairs. All synergies score 6 or 7.
