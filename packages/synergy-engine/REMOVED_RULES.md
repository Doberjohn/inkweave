# Removed Synergy Rules

Rules removed to simplify the engine. Full implementations preserved here for future re-implementation.

## Rules Overview

| ID               | Name                        | Type           | Description                                                        |
|------------------|-----------------------------|----------------|--------------------------------------------------------------------|
| ~~singer-songs~~ | ~~Singer + Songs~~          | ~~keyword~~    | **Re-implemented** in `rules.ts` as Rule 5 with numeric scoring and bidirectional matching |
| evasive-quest    | Evasive + Quest Triggers    | keyword        | Evasive characters safely trigger "when quests" abilities          |
| princess-tribal  | Princess Synergies          | classification | Princess characters + cards referencing "Princess character"       |
| villain-tribal   | Villain Synergies           | classification | Villain characters + cards referencing "Villain character"         |
| hero-tribal      | Hero Synergies              | classification | Hero characters + cards referencing "Hero character"               |
| challenger-buffs | Challenger + Strength Buffs | keyword        | Challenger characters paired with strength buff cards              |
| exert-synergies  | Exert Synergies             | mechanic       | Cards that exert opponents + cards that benefit from exerted state |
| draw-engine      | Card Draw Synergies         | mechanic       | Draw effects + "when you draw" payoffs                             |
| ink-ramp         | Ink Ramp                    | mechanic       | Ink acceleration + expensive cards (cost 6+)                       |
| ward-aggro       | Ward + Aggression           | keyword        | Ward characters paired with challenge/ready effects                |

## Helper Functions Used

These helpers from `src/utils/cardHelpers.ts` are used by the removed rules:

- `textContains(card, pattern)` — search card text for string or regex
- `hasKeyword(card, keyword)` — check if card has a keyword (e.g., "Singer", "Evasive")
- `hasClassification(card, classification)` — check if card has a classification (e.g., "Princess")
- `getKeywordValue(card, keyword)` — extract numeric value from keyword (e.g., "Singer 5" -> 5)
- `isSong(card)` — check if card has "Song" classification
- `hasNegativeTargeting(card, classification)` — detect "banish/exert chosen X character" patterns

## Full Rule Implementations

### Singer + Songs (keyword)

```typescript
{
  id: 'singer-songs',
    name
:
  'Singer + Songs',
    type
:
  'keyword',
    description
:
  'Characters with Singer can use their cost to play Songs',

    matches
:
  (card) => hasKeyword(card, 'Singer'),

    findSynergies
:
  (card, allCards) => {
    const singerValue = getKeywordValue(card, 'Singer') ?? card.cost;

    return allCards
      .filter((other) => isSong(other) && other.cost <= singerValue)
      .map(
        (song): SynergyMatch => ({
          card: song,
          strength: song.cost >= singerValue - 1 ? 'strong' : 'moderate',
          explanation: `${card.name} (Singer ${singerValue}) can play ${song.name} (cost ${song.cost}) for free`,
          bidirectional: true,
        }),
      );
  },
}
,
```

**Strength logic:** strong when song cost is within 1 of Singer value (maximum value extraction), moderate otherwise.

### Evasive + Quest Triggers (keyword)

```typescript
{
  id: 'evasive-quest',
    name
:
  'Evasive + Quest Triggers',
    type
:
  'keyword',
    description
:
  'Evasive characters can safely trigger quest abilities',

    matches
:
  (card) => hasKeyword(card, 'Evasive'),

    findSynergies
:
  (card, allCards) => {
    return allCards
      .filter(
        (other) =>
          other.id !== card.id &&
          (textContains(other, 'when this character quests') ||
            textContains(other, /whenever .* quests/i) ||
            textContains(other, 'gains evasive')),
      )
      .map(
        (other): SynergyMatch => ({
          card: other,
          strength: 'moderate',
          explanation: `${card.name}'s Evasive allows safe questing to trigger ${other.name}'s ability`,
          bidirectional: false,
        }),
      );
  },
}
,
```

### Princess Tribal (classification)

```typescript
{
  id: 'princess-tribal',
    name
:
  'Princess Synergies',
    type
:
  'classification',
    description
:
  'Cards that benefit Princess characters',

    matches
:
  (card) =>
    hasClassification(card, 'Princess') ||
    (textContains(card, /princess character/i) && !hasNegativeTargeting(card, 'Princess')),

    findSynergies
:
  (card, allCards) => {
    if (hasClassification(card, 'Princess')) {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            textContains(other, /princess character/i) &&
            !hasClassification(other, 'Princess') &&
            !hasNegativeTargeting(other, 'Princess'),
        )
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${other.name} benefits Princess characters like ${card.name}`,
            bidirectional: true,
          }),
        );
    } else {
      return allCards
        .filter((other) => other.id !== card.id && hasClassification(other, 'Princess'))
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${card.name} benefits ${other.name} (Princess)`,
            bidirectional: true,
          }),
        );
    }
  },
}
,
```

**Key pattern:** Uses `hasNegativeTargeting` to exclude cards that harm the classification (e.g., "exert chosen Princess
character"). The Villain and Hero tribals follow the exact same pattern.

### Villain Tribal (classification)

Same pattern as Princess Tribal — replace "Princess" with "Villain" throughout.

```typescript
{
  id: 'villain-tribal',
    name
:
  'Villain Synergies',
    type
:
  'classification',
    description
:
  'Cards that benefit Villain characters',

    matches
:
  (card) =>
    hasClassification(card, 'Villain') ||
    (textContains(card, /villain character/i) && !hasNegativeTargeting(card, 'Villain')),

    findSynergies
:
  (card, allCards) => {
    if (hasClassification(card, 'Villain')) {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            textContains(other, /villain character/i) &&
            !hasClassification(other, 'Villain') &&
            !hasNegativeTargeting(other, 'Villain'),
        )
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${other.name} benefits Villain characters like ${card.name}`,
            bidirectional: true,
          }),
        );
    } else {
      return allCards
        .filter((other) => other.id !== card.id && hasClassification(other, 'Villain'))
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${card.name} benefits ${other.name} (Villain)`,
            bidirectional: true,
          }),
        );
    }
  },
}
,
```

### Hero Tribal (classification)

Same pattern as Princess/Villain — replace with "Hero".

```typescript
{
  id: 'hero-tribal',
    name
:
  'Hero Synergies',
    type
:
  'classification',
    description
:
  'Cards that benefit Hero characters',

    matches
:
  (card) =>
    hasClassification(card, 'Hero') ||
    (textContains(card, /hero character/i) && !hasNegativeTargeting(card, 'Hero')),

    findSynergies
:
  (card, allCards) => {
    if (hasClassification(card, 'Hero')) {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            textContains(other, /hero character/i) &&
            !hasClassification(other, 'Hero') &&
            !hasNegativeTargeting(other, 'Hero'),
        )
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${other.name} benefits Hero characters like ${card.name}`,
            bidirectional: true,
          }),
        );
    } else {
      return allCards
        .filter((other) => other.id !== card.id && hasClassification(other, 'Hero'))
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'moderate',
            explanation: `${card.name} benefits ${other.name} (Hero)`,
            bidirectional: true,
          }),
        );
    }
  },
}
,
```

### Challenger + Strength Buffs (keyword)

```typescript
{
  id: 'challenger-buffs',
    name
:
  'Challenger + Strength Buffs',
    type
:
  'keyword',
    description
:
  'Challenger characters benefit from strength buffs',

    matches
:
  (card) => hasKeyword(card, 'Challenger'),

    findSynergies
:
  (card, allCards) => {
    return allCards
      .filter(
        (other) =>
          other.id !== card.id &&
          (textContains(other, /\+\d+\s*(strength|\{S\})/i) ||
            textContains(other, /gets? \+/i) ||
            textContains(other, /gains? \+/i)),
      )
      .map(
        (other): SynergyMatch => ({
          card: other,
          strength: 'moderate',
          explanation: `${other.name} can buff ${card.name}'s Challenger attacks`,
          bidirectional: false,
        }),
      );
  },
}
,
```

### Exert Synergies (mechanic)

```typescript
{
  id: 'exert-synergies',
    name
:
  'Exert Synergies',
    type
:
  'mechanic',
    description
:
  'Cards that interact with exerted characters',

    matches
:
  (card) => textContains(card, 'exert') || textContains(card, 'exerted'),

    findSynergies
:
  (card, allCards) => {
    const exertsOthers =
      textContains(card, 'exert chosen') ||
      textContains(card, 'exert an opposing') ||
      textContains(card, 'exert target');

    if (exertsOthers) {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            (textContains(other, 'exerted character') || textContains(other, /if .* exerted/i)),
        )
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'strong',
            explanation: `${card.name} exerts opponents, enabling ${other.name}'s effects`,
            bidirectional: true,
          }),
        );
    }

    return [];
  },
}
,
```

**Note:** Only fires in one direction — card must be the one that exerts others. "Exerted character" payoffs don't find
exerters (reverse not implemented).

### Card Draw Synergies (mechanic)

```typescript
{
  id: 'draw-engine',
    name
:
  'Card Draw Synergies',
    type
:
  'mechanic',
    description
:
  'Cards that enable or benefit from drawing',

    matches
:
  (card) => textContains(card, 'draw') && !textContains(card, 'withdraw'),

    findSynergies
:
  (card, allCards) => {
    const drawsCards =
      textContains(card, 'draw a card') ||
      textContains(card, 'draw 2') ||
      textContains(card, 'draw cards');

    if (drawsCards) {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            (textContains(other, 'whenever you draw') ||
              textContains(other, 'when you draw') ||
              textContains(other, 'for each card you drew')),
        )
        .map(
          (other): SynergyMatch => ({
            card: other,
            strength: 'strong',
            explanation: `${card.name}'s draw triggers ${other.name}'s ability`,
            bidirectional: true,
          }),
        );
    }

    return [];
  },
}
,
```

**Note:** Excludes "withdraw" false positives. Only fires when the card actively draws — "when you draw" payoffs don't
find drawers (reverse not implemented).

### Ink Ramp (mechanic)

```typescript
{
  id: 'ink-ramp',
    name
:
  'Ink Ramp',
    type
:
  'mechanic',
    description
:
  'Cards that accelerate ink production pair with expensive cards',

    matches
:
  (card) =>
    textContains(card, /gain .* ink/i) ||
    textContains(card, /add .* to your inkwell/i) ||
    textContains(card, /put .* into your inkwell/i),

    findSynergies
:
  (card, allCards) => {
    return allCards
      .filter((other) => other.id !== card.id && other.cost >= 6)
      .slice(0, 10)
      .map(
        (other): SynergyMatch => ({
          card: other,
          strength: other.cost >= 8 ? 'strong' : 'moderate',
          explanation: `${card.name}'s ink ramp helps play ${other.name} (cost ${other.cost}) earlier`,
          bidirectional: false,
        }),
      );
  },
}
,
```

**Note:** Capped at 10 results. Strong for cost 8+, moderate for cost 6-7.

### Ward + Aggression (keyword)

```typescript
{
  id: 'ward-aggro',
    name
:
  'Ward + Aggression',
    type
:
  'keyword',
    description
:
  'Ward characters are safer for aggressive plays',

    matches
:
  (card) => hasKeyword(card, 'Ward'),

    findSynergies
:
  (card, allCards) => {
    return allCards
      .filter(
        (other) =>
          other.id !== card.id &&
          (textContains(other, 'challenge') ||
            hasKeyword(other, 'Challenger') ||
            textContains(other, 'ready')),
      )
      .map(
        (other): SynergyMatch => ({
          card: other,
          strength: 'moderate',
          explanation: `${card.name}'s Ward makes it a safer target for ${other.name}'s effects`,
          bidirectional: false,
        }),
      );
  },
}
,
```

## Removed Tests

### Princess Tribal Tests (6 tests)

1. `should match Princess characters` — Belle with Princess classification
2. `should match cards that mention 'Princess character' without negative targeting` — Royal Decree with Princess text
3. `should NOT match cards with 'Princess' only in ability name` — Bashful with "IMPRESS THE PRINCESS" ability name
4. `should NOT match cards with negative Princess targeting` — Prince Achmed who exerts Princess characters
5. `should NOT find synergy between Princess and negative targeting card` — Belle vs Prince Achmed
6. `should find synergy between Princess and card mentioning 'Princess character'` — Belle + Royal Gathering

### Villain Tribal Tests (2 tests)

1. `should NOT match cards that negatively target Villains` — anti-villain action
2. `should match cards with positive Villain effects` — Villain's Scheme buff

### Singer + Songs Tests (2 tests)

1. `should match characters with Singer keyword` — Ariel with Singer 5
2. `should find songs that cost <= Singer value` — Ariel + cheap song (found) vs expensive song (not found)

### Exert Synergies Tests (1 test)

1. `should find synergy between exert effects and exerted-character benefits` — Controller + Punisher

### Card Helper Tests (kept — these test utility functions, not rules)

- `hasNegativeTargeting` tests (2)
- `hasPositiveClassificationEffect` tests (2)
