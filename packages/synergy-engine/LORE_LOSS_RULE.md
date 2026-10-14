# Rule 3: Lore Loss (Playstyle: Lore Denial)

Cards that make opponents lose lore reinforce the same denial strategy. The rule splits cards into two roles based on whether the lore loss is paired with a corresponding lore *gain* for you, then scores pairs by role-pair shape.

## Detection

### Base lore-loss pattern

```regex
/(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i
```

Applied against normalized card text. Handles `chosen opponent loses 1 lore`, `each opponent loses 2 lore`, `all opponents lose 1 lore`, and the variable-amount variant `opponent loses lore equal to ...`.

### Role split: Burn vs Steal

Three steal-pattern shapes elevate a card from `burn` to `steal`:

```typescript
const LORE_STEAL_PATTERNS: RegExp[] = [
  /loses?\s+\d+\s+lore\s+and\s+you\s+gain\s+\d+\s+lore/i,    // "loses 1 lore and you gain 1 lore"
  /loses?\s+\d+\s+lore\.\s*(?:you\s+)?gain\s+\d+\s+lore/i,   // "loses 1 lore. Gain 1 lore"
  /gain\s+lore\s+equal\s+to\s+(?:the\s+)?lore\s+lost/i,      // "gain lore equal to the lore lost"
];
```

`getLoreDenialRoles(card)` returns `['steal']` if any of these match, else `['burn']` if the base lore-loss pattern matches, else `[]`. Burn and steal are mutually exclusive — a card is one or the other.

### What's excluded

- **Self lore loss**: Cards where *you* lose lore — the regex requires "opponent".
- **Conditional prevention**: Cards that *prevent* lore loss — no "opponent loses" anywhere.
- **Lore gain only**: Pure lore-gain effects with no opponent-loss component.

## Card examples by role

Real cards the `getLoreDenialRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **burn** | Donald Duck - Pie Slinger (Ruby), The Witch - Wily Woodcarver (Emerald), Taffyta Muttonfudge - Crowd Favorite (Ruby) | Opponent loses lore with no upside for them: on a Shift play, when challenged, or while you hold a location |
| **steal** | The Sword Released (Ruby), LeFou - Cake Thief (Ruby-Sapphire), Thievery (Ruby) | Opponent loses lore *and* you gain it from the same effect: swings the race twice per trigger |

## Scoring (5/6/7 matrix)

The rule applies the project-wide **5-baseline scoring convention**: 5 = neutral default, bumps above 5 reflect mechanical efficiency.

| Pair | Score | Reasoning |
|------|-------|-----------|
| **burn ↔ burn** | **5** | Parallel pressure, no compounding — both push the opponent down on the same axis |
| **burn ↔ steal** | **6** | Complementary — burn applies pressure, steal closes the lore race by also gaining for you |
| **steal ↔ steal** | **7** | Double-swing engine — every steal trigger advances both axes (opponent down + you up) |

**Mechanical efficiency rationale**: every steal point swings the lore race by 2 (opponent -1, you +1) while burn only swings by 1 (opponent -1). Two steal cards compound that efficiency; two burn cards just stack pressure. The matrix encodes that asymmetry.

`scoreLoreDenialPair(roleA, roleB, cardA, cardB)` returns the score and a tailored explanation per pair shape (no longer a generic "both make the opponent lose lore" template).

### Explanation templates

`{A}` is the card whose page shows the tile and `{B}` its partner; the UI draws each as its card's chip.

| Pair | Template |
|------|----------|
| burn ↔ burn | `{A} and {B} both make opponents lose lore.` |
| burn ↔ steal | `{A} pushes opponents down. {B} pulls you up. Both ends pressed.` The burn card reads first from either page, so the tokens swap on the steal card's page. |
| steal ↔ steal | `{A} and {B} both steal lore from the opponent.` |

## Coverage

<!-- coverage:start coverage -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

| Metric | Value |
|------|-----|
| Burn cards | 12 |
| Steal cards | 6 |
| Total cards | 18 |
| Total unique pairs | 153 |
| Score range | 5-7 |
| Playstyle ID | `lore-denial` |
<!-- coverage:end -->

### Pair distribution

<!-- coverage:start distribution -->
**153 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| burn ↔ burn | 66 | 5 | 43.1% |
| burn ↔ steal | 72 | 6 | 47.1% |
| steal ↔ steal | 15 | 7 | 9.8% |
<!-- coverage:end -->

The burn ↔ steal mid-tier is structurally meaningful: most decks running lore denial mix burn and steal naturally. Pure-steal pairs are mechanically the strongest density target. Pure-burn pairs read as the deck's broad floor.

### Burn cards

<!-- coverage:start burn-cards -->
| Card | Set |
|----|---|
| Brom Bones - Burly Bully | Whispers in the Well |
| Grandma Wu - Fierce Red Panda | Attack of the Vine! |
| Lester the Possum - Park Mascot | Hyperia City |
| Lyle Tiberius Rourke - Adventurer for Hire | The Wilds Unknown |
| Nani's Payback | Winterspell |
| Olaf - Snowman of Action | Winterspell |
| Pizza Planet - Spaceport | The Wilds Unknown |
| Rapunzel - Letting Down Her Hair | Fabled |
| Red Alert | Attack of the Vine! |
| Scrooge McDuck - Ebenezer Scrooge | Winterspell |
| The Witch - Wily Woodcarver | The Wilds Unknown |
| Yzma - Choosy Customer | Attack of the Vine! |
<!-- coverage:end -->

### Steal cards

<!-- coverage:start steal-cards -->
| Card | Set |
|----|---|
| A Pirate's Life | Fabled |
| Beast - Aggressive Lord | Whispers in the Well |
| Hero Work | The Wilds Unknown |
| Negaduck - Public Enemy Number One | Winterspell |
| Prophetic Vision | Attack of the Vine! |
| Pterodactyl Janie Doll - Sid's Toy | The Wilds Unknown |
<!-- coverage:end -->

## Test coverage

Tests in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Lore Loss')`.

| Test | Score |
|------|-------|
| Match with lore loss text (burn + steal fixtures) | (boolean) |
| No false positives on cards without lore loss | (boolean) |
| Match for variable-amount variant | (boolean) |
| burn ↔ burn pair (parallel pressure baseline) | 5 |
| burn ↔ steal pair (complementary pressure + race-close) | 6 |
| steal ↔ steal pair (double-swing engine) | 7 |
| Selected card excluded from its own synergies | (boolean) |
| All matches marked as bidirectional | (boolean) |

## Design decisions

### Why a tiered matrix instead of uniform 7?

The original rule scored every pair at 7 (uniform "Strong"). That treated burn↔burn and steal↔steal identically despite real mechanical differences. The tiered matrix is more honest about efficiency: every steal trigger swings the lore race by 2 (opponent down + you up), while burn only swings by 1. A pair of steals compounds that efficiency; a pair of burns just stacks pressure.

### Why 5 is the floor (not 6 or 7)

The project-wide convention anchors **5 = same-axis density**. Anything above 5 must justify itself with a specific mechanical interaction. The old uniform-7 leaked weight to pairs that didn't earn it — burn↔burn doesn't compound, it just stacks, so it sits at the floor.

### Per-pair explanations

The synergy results page now teaches the gameplan instead of repeating "both make the opponent lose lore" generically. A burn↔steal pair reads "{A} pushes opponents down. {B} pulls you up. Both ends pressed.", which tells players the deck's win condition more clearly than a generic membership confirmation.

### Future tuning levers

- **Magnitude tiering**: differentiate "loses 1 lore" from "loses 3 lore" via regex extraction. Currently flat — community voting may surface this as worth encoding.
- **Recurrence tiering**: distinguish repeating triggers ("whenever this character quests") from one-shot effects ("when you play this character"). Currently uniform.
- **Cross-archetype synergy**: some denial cards also fit other archetypes (Taffyta = Location Control + Lore Denial). Cross-archetype value could boost scores in playstyle-aware UI views.
