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

## Card examples by role

Real cards the `getHunnyRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Winnie the Pooh - Hunny Wizard (Amethyst), Rabbit - Hunny Paladin (Amber), Christopher Robin - Hunny Sage (Amethyst-Sapphire) | Carry the Hunny classification |
| **density** | Winnie the Pooh - Hunny Archmage (Amethyst), Roo - Hunny Rogue (Emerald), Owl - Hunny Ranger (Steel) | Benefit gated on other Hunny characters in play |
| **search** | Christopher Robin - Hunny Sage (Amethyst-Sapphire), The Great Book of Hunny (Sapphire) | Dig a Hunny card out of your deck |
| **buff** | Rabbit - Hunny Paladin (Amber), Tigger - Hunny Barbarian (Ruby), Magical Hunny Staff (Amethyst) | Single-target pump of a chosen Hunny |

## Scoring (5-baseline)
| Pair | Score |
|------|-------|
| search + member, search + density | 8 |
| density + density, density + member | 7 |
| buff + member | 6 |
| everything else | 5 |

## Coverage
9 members; 3 density, 2 search, 3 buff payoffs (several multi-role).
