import type {LorcanaCard} from '../types/card.js';
import type {SynergyRule, SynergyGroup, SynergyStrength} from '../types/synergy.js';
import type {SynergyCategory} from '../types/playstyle.js';
import {getAllRules} from './rules.js';
import {getPlaystyleById} from './playstyles.js';

// Sort order for synergy strength
const STRENGTH_ORDER: Record<SynergyStrength, number> = {
  strong: 0,
  moderate: 1,
  weak: 2,
};

// Categories display order: direct first, then playstyle
const CATEGORY_ORDER: Record<SynergyCategory, number> = {
  direct: 0,
  playstyle: 1,
};

export interface SynergyEngineOptions {
  rules?: SynergyRule[];
  maxResultsPerGroup?: number;
}

export class SynergyEngine {
  private rules: SynergyRule[];
  private maxResultsPerGroup: number;

  constructor(options: SynergyEngineOptions = {}) {
    this.rules = options.rules ?? getAllRules();
    this.maxResultsPerGroup = options.maxResultsPerGroup ?? 20;
  }

  /**
   * Derive the group key for a rule:
   * - Direct rules: each rule is its own group (keyed by rule.id)
   * - Playstyle rules: rules with the same playstyleId merge into one group
   */
  private getGroupKey(rule: SynergyRule): string {
    if (rule.category === 'playstyle') {
      return rule.playstyleId;
    }
    return rule.id;
  }

  /**
   * Derive the group label and description for a rule.
   * Playstyle rules pull from the playstyle registry; direct rules use rule metadata.
   */
  private getGroupMeta(rule: SynergyRule): {label: string; description: string} {
    if (rule.category === 'playstyle') {
      const playstyle = getPlaystyleById(rule.playstyleId);
      if (playstyle) {
        return {label: playstyle.name, description: playstyle.description};
      }
    }
    return {label: rule.name, description: rule.description};
  }

  /**
   * Find all synergies for a given card
   */
  findSynergies(card: LorcanaCard, allCards: LorcanaCard[]): SynergyGroup[] {
    const results = new Map<string, SynergyGroup>();

    for (const rule of this.rules) {
      // Check if this rule applies to the card
      if (!rule.matches(card)) continue;

      // Find synergistic cards
      const matches = rule.findSynergies(card, allCards);

      if (matches.length === 0) continue;

      const groupKey = this.getGroupKey(rule);

      // Create group if it doesn't exist
      if (!results.has(groupKey)) {
        const meta = this.getGroupMeta(rule);
        results.set(groupKey, {
          groupKey,
          category: rule.category,
          label: meta.label,
          description: meta.description,
          synergies: [],
        });
      }

      const group = results.get(groupKey)!;

      // Add matches, avoiding duplicates within the group
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

    // Sort and limit results within each group
    for (const group of results.values()) {
      group.synergies.sort((a, b) => {
        const strengthDiff = STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
        if (strengthDiff !== 0) return strengthDiff;
        return a.card.name.localeCompare(b.card.name);
      });

      group.synergies = group.synergies.slice(0, this.maxResultsPerGroup);
    }

    // Sort groups: direct first, then playstyle, then alphabetical within each category
    return Array.from(results.values()).sort((a, b) => {
      const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
      if (catDiff !== 0) return catDiff;
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Get a flat list of all synergistic cards (deduped)
   */
  findSynergiesFlat(
    card: LorcanaCard,
    allCards: LorcanaCard[],
  ): Array<{
    card: LorcanaCard;
    strength: SynergyStrength;
    explanation: string;
    category: SynergyCategory;
    groupKey: string;
  }> {
    const grouped = this.findSynergies(card, allCards);
    const seen = new Set<string>();
    const results: Array<{
      card: LorcanaCard;
      strength: SynergyStrength;
      explanation: string;
      category: SynergyCategory;
      groupKey: string;
    }> = [];

    for (const group of grouped) {
      for (const synergy of group.synergies) {
        if (!seen.has(synergy.card.id)) {
          seen.add(synergy.card.id);
          results.push({
            ...synergy,
            category: group.category,
            groupKey: group.groupKey,
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
    cardB: LorcanaCard,
  ): {
    hasSynergy: boolean;
    synergies: Array<{
      category: SynergyCategory;
      groupKey: string;
      strength: SynergyStrength;
      explanation: string;
    }>;
  } {
    const synergies: Array<{
      category: SynergyCategory;
      groupKey: string;
      strength: SynergyStrength;
      explanation: string;
    }> = [];

    for (const rule of this.rules) {
      if (!rule.matches(cardA)) continue;

      const matches = rule.findSynergies(cardA, [cardB]);
      for (const match of matches) {
        synergies.push({
          category: rule.category,
          groupKey: this.getGroupKey(rule),
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
   * Add a custom rule. Validates playstyle rules reference a registered playstyle.
   */
  addRule(rule: SynergyRule): void {
    if (rule.category === 'playstyle') {
      const playstyle = getPlaystyleById(rule.playstyleId);
      if (!playstyle) {
        throw new Error(
          `Rule "${rule.id}" references unknown playstyle "${rule.playstyleId}". Register the playstyle first.`,
        );
      }
    }
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
