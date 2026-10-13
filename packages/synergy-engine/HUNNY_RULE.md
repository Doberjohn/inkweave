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
| **search** | Christopher Robin - Hunny Sage (Amethyst-Sapphire), Big Book of Hunny (Sapphire) | Dig a Hunny card out of your deck |
| **buff** | Rabbit - Hunny Paladin (Amber), Tigger - Hunny Barbarian (Ruby), Magical Hunny Staff (Amethyst) | Single-target pump of a chosen Hunny |

## Scoring (5-baseline)
| Pair | Score |
|------|-------|
| search + member, search + density | 8 |
| density + density, density + member | 7 |
| buff + member | 6 |
| everything else | 5 |

## Coverage

<!-- coverage:start coverage -->
Counted by `pnpm refresh-rule-coverage` over the 1,228 Core cards in the synergy pool (sets 9-14).

| Role | Cards | Cards per ink |
|----|-----|-------------|
| member | 16 | Amethyst 6, Sapphire 6, Amber 2, Emerald 2, Ruby 1, Steel 1 |
| density | 4 (Gopher - Hunny Cook, Owl - Hunny Ranger, Roo - Hunny Rogue, Winnie the Pooh - Hunny Archmage) | Emerald 2, Amethyst 1, Steel 1 |
| search | 2 (Big Book of Hunny, Christopher Robin - Hunny Sage) | Sapphire 2, Amethyst 1 |
| buff | 4 (Eeyore - Hunny Scholar, Magical Hunny Staff, Rabbit - Hunny Paladin, Tigger - Hunny Barbarian) | Amber 1, Amethyst 1, Ruby 1, Sapphire 1 |

Cards with a role: 16. Cards with more than one: 10.

**108 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Score | Pairs | Share |
|-----|-----|-----|
| 8 | 23 | 21.3% |
| 7 | 43 | 39.8% |
| 6 | 28 | 25.9% |
| 5 | 14 | 13.0% |
<!-- coverage:end -->
