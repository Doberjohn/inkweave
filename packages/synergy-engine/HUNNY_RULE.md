# Hunny Rule (playstyle, tribal)

Winnie-the-Pooh tribe (Set 13), modeled on Seven Dwarfs.

## Membership and gate
- Membership: `hasClassification('Hunny')`.
- Payoff gate: `/\bHunny (?:character|card|classification)/i`, deliberately NOT bare
  "Hunny", because abilities are named "HUNNY AURA" / "HUNNY ACTIVATION".

## Roles
- `density`: `/(?:\d+ or more other|another|your other)\s+Hunny characters?/i`
- `search`: `/search your deck for a Hunny card|Hunny card[^.]*put it into your hand/i`
- `buff`: `/chosen Hunny character/i`

## Scoring (5-baseline)
| Pair | Score |
|------|-------|
| search + member, search + density | 8 |
| density + density, density + member | 7 |
| buff + member | 6 |
| everything else | 5 |

## Coverage
9 members; 3 density, 2 search, 3 buff payoffs (several multi-role).
