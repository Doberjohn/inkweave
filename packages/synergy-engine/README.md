# lorcana-synergy-engine

Synergy detection engine for Disney Lorcana TCG cards.

## Installation

```bash
npm install lorcana-synergy-engine
```

## Usage

```typescript
import { SynergyEngine, type LorcanaCard } from "lorcana-synergy-engine";

// Create an engine instance
const engine = new SynergyEngine();

// Find synergies for a card
const card: LorcanaCard = {
  id: "ariel-1",
  name: "Ariel",
  fullName: "Ariel - Spectacular Singer",
  cost: 5,
  ink: "Amethyst",
  inkwell: true,
  type: "Character",
  keywords: ["Singer 5"],
};

const allCards: LorcanaCard[] = [/* your card database */];
const synergies = engine.findSynergies(card, allCards);

// Check synergy between two specific cards
const result = engine.checkSynergy(cardA, cardB);
if (result.hasSynergy) {
  console.log("Cards synergize:", result.synergies);
}
```

## API

### SynergyEngine

Main class for detecting card synergies.

```typescript
const engine = new SynergyEngine(options?: SynergyEngineOptions);
```

**Options:**
- `rules?: SynergyRule[]` - Custom rules (defaults to built-in rules)
- `maxResultsPerType?: number` - Max results per synergy type (default: 20)

**Methods:**
- `findSynergies(card, allCards)` - Find all synergies grouped by type
- `findSynergiesFlat(card, allCards)` - Find synergies as flat list
- `checkSynergy(cardA, cardB)` - Check synergy between two cards
- `addRule(rule)` - Add a custom rule
- `getRules()` - Get all registered rules

### SynergyCache

Cache for expensive synergy calculations.

```typescript
import { SynergyCache, SynergyEngine } from "lorcana-synergy-engine";

const engine = new SynergyEngine();
const cache = new SynergyCache(engine);

// Cached synergy check
const result = cache.checkSynergy(cardA, cardB);

// Bidirectional check
const biResult = cache.checkBidirectionalSynergy(cardA, cardB);
```

### Built-in Rules

The engine includes 10 built-in synergy rules:

1. **Singer + Songs** - Singer keyword plays Songs at reduced cost
2. **Evasive + Quest** - Evasive characters trigger quest abilities safely
3. **Shift Targets** - Floodborn cards shift onto same-named characters
4. **Princess Tribal** - Princess classification synergies
5. **Villain Tribal** - Villain classification synergies
6. **Hero Tribal** - Hero classification synergies
7. **Challenger + Buffs** - Challengers benefit from strength boosts
8. **Exert Synergies** - Exert effects + exerted-enemy benefits
9. **Draw Engine** - Draw triggers + "when you draw" effects
10. **Ink Ramp** - Ink acceleration + high-cost cards
11. **Ward + Aggression** - Ward protects against removal

### Custom Rules

Create custom synergy rules:

```typescript
import { SynergyEngine, type SynergyRule, hasKeyword } from "lorcana-synergy-engine";

const customRule: SynergyRule = {
  id: "my-rule",
  name: "My Custom Rule",
  type: "mechanic",
  description: "Detects custom synergies",
  matches: (card) => hasKeyword(card, "MyKeyword"),
  findSynergies: (card, allCards) => {
    return allCards
      .filter(other => /* your logic */)
      .map(other => ({
        card: other,
        strength: "strong",
        explanation: "Custom synergy explanation",
      }));
  },
};

const engine = new SynergyEngine();
engine.addRule(customRule);
```

### Utility Functions

Helper functions for building custom rules:

```typescript
import {
  textContains,      // Check card text for pattern
  hasKeyword,        // Check for keyword (prefix match)
  hasKeywordExact,   // Check for keyword (exact match)
  hasClassification, // Check classification
  getBaseName,       // Get base name for Shift matching
  getKeywordValue,   // Get numeric keyword value (e.g., "Singer 5" -> 5)
  isSong,            // Check if card is a Song
  isCharacter,       // Check if card is a Character
  isAction,          // Check if card is an Action
  isItem,            // Check if card is an Item
  isLocation,        // Check if card is a Location
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
} from "lorcana-synergy-engine";
```

## Types

```typescript
interface LorcanaCard {
  id: string;
  name: string;
  version?: string;
  fullName: string;
  cost: number;
  ink: Ink;
  inkwell: boolean;
  type: CardType;
  classifications?: string[];
  text?: string;
  strength?: number;
  willpower?: number;
  lore?: number;
  keywords?: string[];
  imageUrl?: string;
  setCode?: string;
  setNumber?: number;
}

type Ink = "Amber" | "Amethyst" | "Emerald" | "Ruby" | "Sapphire" | "Steel";
type CardType = "Character" | "Action" | "Item" | "Location";
type SynergyType = "keyword" | "classification" | "shift" | "named" | "mechanic" | "ink" | "cost-curve";
type SynergyStrength = "weak" | "moderate" | "strong";
```

## License

MIT
