# inkweave-synergy-engine

Synergy detection engine for Disney Lorcana TCG cards.

## Installation

```bash
npm install inkweave-synergy-engine
```

## Usage

```typescript
import { SynergyEngine, type LorcanaCard } from "inkweave-synergy-engine";

// Create an engine instance
const engine = new SynergyEngine();

// Find synergies for a card
const card: LorcanaCard = {
  id: "elsa-1",
  name: "Elsa",
  fullName: "Elsa - Snow Queen",
  cost: 4,
  ink: "Amethyst",
  inkwell: true,
  type: "Character",
  keywords: ["Shift 5"],
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
- `maxResultsPerGroup?: number` - Max results per synergy group (default: 100)

**Methods:**
- `findSynergies(card, allCards)` - Find all synergies grouped by category/playstyle
- `findSynergiesFlat(card, allCards)` - Find synergies as flat list
- `checkSynergy(cardA, cardB)` - Check synergy between two cards
- `getPairSynergies(cardA, cardB)` - Detailed bidirectional breakdown of all synergy connections between two cards
- `getPlaystyleCards(playstyleId, allCards)` - Get all cards matching any rule in a playstyle
- `addRule(rule)` - Add a custom rule (validates playstyle references)
- `getRules()` - Get all registered rules

### SynergyCache

Cache for expensive synergy calculations. Useful for CLI tools or build scripts that make repeated engine calls.

> **Note**: The Inkweave web app does not use `SynergyCache` at runtime — synergies are pre-computed at build time via `scripts/precompute-synergies.mjs`.

```typescript
import { SynergyCache, SynergyEngine } from "inkweave-synergy-engine";

const engine = new SynergyEngine();
const cache = new SynergyCache(engine);

// Cached synergy check
const result = cache.checkSynergy(cardA, cardB);

// Bidirectional check
const biResult = cache.checkBidirectionalSynergy(cardA, cardB);
```

### Built-in Rules

The engine includes 12 built-in synergy rules across two categories:

**Direct** (pair-specific synergies):

- **Shift Targets** — Shift cards + same-named base characters (bidirectional)
- **Named Companions** — Cards referencing specific named entities, scored by effect tier

**Playstyle** (strategy-reinforcing synergies):

- **Lore Loss** (`lore-denial`) — Cards that make opponents lose lore
- **At Location Payoff** (`location-control`) — "At location" payoff effects + Locations
- **Location Play Trigger** (`location-control`) — "When you play a location" triggers
- **Location Buff** (`location-control`) — Cards that buff locations
- **Location Ramp** (`location-control`) — Reduces location play cost
- **Move to Location** (`location-control`) — Move-to-location effects
- **Location In-Play Check** (`location-control`) — "If you have a location" checks
- **Location Tutor** (`location-control`) — Location search/tutor effects
- **Location Boost** (`location-control`) — Boost mechanic on characters/locations
- **Discard** (`discard`) — Opponent discard enablers + hand-size payoffs

### Custom Rules

Create custom synergy rules:

```typescript
import { SynergyEngine, type SynergyRule, hasKeyword } from "inkweave-synergy-engine";

// Direct rule — synergy comes from the specific card pair
const directRule: SynergyRule = {
  id: "my-direct-rule",
  name: "My Direct Rule",
  category: "direct",
  description: "Detects pair-specific synergies",
  matches: (card) => hasKeyword(card, "MyKeyword"),
  findSynergies: (card, allCards) => {
    return allCards
      .filter(other => /* your logic */)
      .map(other => ({
        card: other,
        score: 7,
        explanation: "Custom synergy explanation",
      }));
  },
};

// Playstyle rule — synergy comes from card density in a strategy
// playstyleId must reference a registered playstyle
const playstyleRule: SynergyRule = {
  id: "my-playstyle-rule",
  name: "My Playstyle Rule",
  category: "playstyle",
  playstyleId: "lore-denial",
  description: "Cards that support the lore denial strategy",
  matches: (card) => /* your logic */,
  findSynergies: (card, allCards) => /* your logic */,
};

const engine = new SynergyEngine();
engine.addRule(directRule);
engine.addRule(playstyleRule);
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
  isDualInk,         // Check if card has two inks
  getInks,           // Get array of card's inks
  canShareDeck,      // Check if two cards can be in the same deck
  isCardType,        // Type-safe card type check
  getShiftType,      // Get Shift type (standard/named/any)
  hasAnyShift,       // Check if card has any Shift ability
  getNamedReferences, // Extract named entity references from card text
  classifyNamedEffect, // Classify effect tier for named companions
  NAMED_EFFECT_SCORES, // Score lookup by effect tier
  isLocationSupportCard, // Check if card supports locations
  getLocationRoles,  // Get location support roles for a card
  LOCATION_PATTERNS, // Regex patterns for location detection
  getDiscardRoles,   // Get discard roles (enabler/payoff)
  isDiscardCard,     // Check if card is a discard card
  transformCard,     // Transform JSON card data to LorcanaCard
  transformCards,    // Transform array of JSON cards
  // UI label/description constants:
  LOCATION_ROLE_CHIP_LABELS,
  LOCATION_ROLE_DESCRIPTIONS,
  LOCATION_ROLE_TOOLTIP,
  DISCARD_ROLE_CHIP_LABELS,
  DISCARD_ROLE_DESCRIPTIONS,
} from "inkweave-synergy-engine";
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
  ink2?: Ink;                // Second ink for dual-ink cards
  inkwell: boolean;
  type: CardType;
  classifications?: string[];
  text?: string;             // Full card text (used by synergy engine)
  textSections?: string[];   // Text split into ability blocks (for display)
  isSong?: boolean;          // True for Action cards with Song subtype
  moveCost?: number;
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
type SynergyCategory = "direct" | "playstyle";
type PlaystyleId = "lore-denial" | "location-control" | "discard";

// Synergy scores use a 1-10 numeric scale (see SCORING_DESIGN.md)
// Engine assigns anchor points: 1, 3, 5, 7, 9
// Community voting (#9) can nudge with decimals (e.g., 7.3)

// Rules use a discriminated union — category determines whether playstyleId is present
type SynergyRule = DirectSynergyRule | PlaystyleSynergyRule;
```

## License

MIT
