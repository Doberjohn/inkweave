# Hunny Rule (playstyle, tribal)

Winnie-the-Pooh tribe (Set 13), modeled on Seven Dwarfs.

## Membership and gate
- Membership: `hasClassification('Hunny')`.
- Payoff gate: `/\bHunny (?:character|card|classification)/i`, deliberately NOT bare
  "Hunny", because abilities are named "HUNNY AURA" / "HUNNY ACTIVATION".
- A Hunny character (`countsAsHunnyCharacter`): a member that is a character, or one that gives
  a character of yours the Hunny classification (`/\bthe Hunny classification\b/i`, Magical
  Hunny Staff's GIFT OF THE HIVE). Big Book of Hunny and Hundred Acre Wood - Hunny Campsite carry
  the classification without being characters: a search for a "Hunny card" finds them, but the
  density and buff payoffs count or choose Hunny characters, so the 7 and 6 tiers drop their
  member role.

## Roles
- `density`: `/(?:\d+ or more other|another|your other)\s+Hunny characters?/i`
- `search`: `/search your deck for a Hunny card|Hunny card[^.]*put it into your hand/i`
- `buff`: `/chosen Hunny character/i`, or a location's pump of the Hunny characters there:
  `/\bHunny characters (?:get|gain)\b[^.]*\bwhile here\b/i` (Hundred Acre Wood - Hunny Campsite)

## Card examples by role

Real cards the `getHunnyRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Winnie the Pooh - Hunny Wizard (Amethyst), Rabbit - Hunny Paladin (Amber), Christopher Robin - Hunny Sage (Amethyst-Sapphire) | Carry the Hunny classification |
| **density** | Winnie the Pooh - Hunny Archmage (Amethyst), Roo - Hunny Rogue (Emerald), Owl - Hunny Ranger (Steel) | Benefit gated on other Hunny characters in play |
| **search** | Christopher Robin - Hunny Sage (Amethyst-Sapphire), Big Book of Hunny (Sapphire) | Dig a Hunny card out of your deck |
| **buff** | Rabbit - Hunny Paladin (Amber), Magical Hunny Staff (Amethyst), Hundred Acre Wood - Hunny Campsite (Sapphire) | Pump a chosen Hunny character, or every Hunny character at the location |

## Scoring (5-baseline)
| Pair | Score | Explanation (from the first card's page) |
|------|-------|-------------|
| search + member, search + density | 8 | `{A} can reveal {B} from your deck.` When each can find the other: `{A} and {B} can each reveal the other from your deck.` |
| density + member | 7 | `{B} activates {A}'s Hunny ability.` A payoff that buffs your other Hunny characters (Gopher - Hunny Cook) reads `{A}'s Hunny buff powers up {B}.` |
| density + density | 5 or 7 | What each card's ability counts of the other (`scorePayoffPair`, shared with Floodborns, Items and the classification tribes): each, `{A} and {B} are both Hunny characters, and each one's ability helps the other.`; one, the density + member line. Two that count neither would sit at the same-deck 5, since two payoffs on one board don't multiply each other; no such pair exists today. |
| buff + member | 6 | `{A}'s Hunny buff powers up {B}.` When each buffs the other: `{A} and {B} can each buff the other.` |
| everything else | 5 | `{A} and {B} both go in a Hunny deck.` |

In the 7 and 6 rows, `member` means a Hunny character (see Membership and gate). The search
row reaches every Hunny card.

`{A}` is the card whose page shows the tile and `{B}` its partner; a line names each card in its role, so on the other card's page the tokens swap.

## Coverage

<!-- coverage:start coverage -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

| Role | Cards | Cards per ink |
|----|-----|-------------|
| member | 16 | Amethyst 6, Sapphire 6, Amber 2, Emerald 2, Ruby 1, Steel 1 |
| density | 4 (Gopher - Hunny Cook, Owl - Hunny Ranger, Roo - Hunny Rogue, Winnie the Pooh - Hunny Archmage) | Emerald 2, Amethyst 1, Steel 1 |
| search | 2 (Big Book of Hunny, Christopher Robin - Hunny Sage) | Sapphire 2, Amethyst 1 |
| buff | 5 (Eeyore - Hunny Scholar, Hundred Acre Wood - Hunny Campsite, Magical Hunny Staff, Rabbit - Hunny Paladin, Tigger - Hunny Barbarian) | Sapphire 2, Amber 1, Amethyst 1, Ruby 1 |

Cards with a role: 16. Cards with more than one: 11.

**108 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Score | Pairs | Share |
|-----|-----|-----|
| 8 | 23 | 21.3% |
| 7 | 39 | 36.1% |
| 6 | 37 | 34.3% |
| 5 | 9 | 8.3% |
<!-- coverage:end -->
