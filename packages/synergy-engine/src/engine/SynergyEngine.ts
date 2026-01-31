import type { LorcanaCard } from "../types/card.js";
import type {
  SynergyRule,
  GroupedSynergies,
  SynergyType,
  SynergyStrength,
} from "../types/synergy.js";
import { getAllRules } from "./rules.js";

// Labels for synergy types (for display)
const TYPE_LABELS: Record<SynergyType, string> = {
  keyword: "Keyword Synergies",
  classification: "Tribal Synergies",
  shift: "Shift Targets",
  named: "Named References",
  mechanic: "Mechanical Synergies",
  ink: "Ink Synergies",
  "cost-curve": "Cost Curve",
};

// Sort order for synergy strength
const STRENGTH_ORDER: Record<SynergyStrength, number> = {
  strong: 0,
  moderate: 1,
  weak: 2,
};

// Type priority order for display
const TYPE_ORDER: SynergyType[] = [
  "shift",
  "keyword",
  "classification",
  "mechanic",
  "named",
  "ink",
  "cost-curve",
];

export interface SynergyEngineOptions {
  rules?: SynergyRule[];
  maxResultsPerType?: number;
}

export class SynergyEngine {
  private rules: SynergyRule[];
  private maxResultsPerType: number;

  constructor(options: SynergyEngineOptions = {}) {
    this.rules = options.rules ?? getAllRules();
    this.maxResultsPerType = options.maxResultsPerType ?? 20;
  }

  /**
   * Find all synergies for a given card
   */
  findSynergies(card: LorcanaCard, allCards: LorcanaCard[]): GroupedSynergies[] {
    const results = new Map<SynergyType, GroupedSynergies>();

    for (const rule of this.rules) {
      // Check if this rule applies to the card
      if (!rule.matches(card)) continue;

      // Find synergistic cards
      const matches = rule.findSynergies(card, allCards);

      if (matches.length === 0) continue;

      // Group by type
      if (!results.has(rule.type)) {
        results.set(rule.type, {
          type: rule.type,
          label: TYPE_LABELS[rule.type],
          synergies: [],
        });
      }

      const group = results.get(rule.type)!;

      // Add matches, avoiding duplicates
      for (const match of matches) {
        const exists = group.synergies.some((s) => s.card.id === match.card.id);
        if (!exists) {
          group.synergies.push({
            card: match.card,
            strength: match.strength,
            explanation: match.explanation,
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      }
    }

    // Sort and limit results
    for (const group of results.values()) {
      // Sort by strength (strong first), then by card name
      group.synergies.sort((a, b) => {
        const strengthDiff = STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
        if (strengthDiff !== 0) return strengthDiff;
        return a.card.name.localeCompare(b.card.name);
      });

      // Limit results per type
      group.synergies = group.synergies.slice(0, this.maxResultsPerType);
    }

    // Return as array, sorted by type importance
    return TYPE_ORDER.filter((type) => results.has(type)).map((type) => results.get(type)!);
  }

  /**
   * Get a flat list of all synergistic cards (deduped)
   */
  findSynergiesFlat(
    card: LorcanaCard,
    allCards: LorcanaCard[]
  ): Array<{
    card: LorcanaCard;
    strength: SynergyStrength;
    explanation: string;
    type: SynergyType;
  }> {
    const grouped = this.findSynergies(card, allCards);
    const seen = new Set<string>();
    const results: Array<{
      card: LorcanaCard;
      strength: SynergyStrength;
      explanation: string;
      type: SynergyType;
    }> = [];

    for (const group of grouped) {
      for (const synergy of group.synergies) {
        if (!seen.has(synergy.card.id)) {
          seen.add(synergy.card.id);
          results.push({
            ...synergy,
            type: group.type,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if two specific cards have synergy
   */
  checkSynergy(
    cardA: LorcanaCard,
    cardB: LorcanaCard
  ): {
    hasSynergy: boolean;
    synergies: Array<{
      type: SynergyType;
      strength: SynergyStrength;
      explanation: string;
    }>;
  } {
    const synergies: Array<{
      type: SynergyType;
      strength: SynergyStrength;
      explanation: string;
    }> = [];

    for (const rule of this.rules) {
      if (!rule.matches(cardA)) continue;

      const matches = rule.findSynergies(cardA, [cardB]);
      for (const match of matches) {
        synergies.push({
          type: rule.type,
          strength: match.strength,
          explanation: match.explanation,
        });
      }
    }

    return {
      hasSynergy: synergies.length > 0,
      synergies,
    };
  }

  /**
   * Add a custom rule
   */
  addRule(rule: SynergyRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all registered rules
   */
  getRules(): SynergyRule[] {
    return [...this.rules];
  }
}

// Default singleton instance
export const synergyEngine = new SynergyEngine();
