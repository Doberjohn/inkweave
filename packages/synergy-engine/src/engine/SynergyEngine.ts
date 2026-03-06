import type {
  LorcanaCard,
  PlaystyleId,
  SynergyCategory,
  SynergyGroup,
  SynergyRule,
  PairSynergyConnection,
  DetailedPairSynergy,
} from '../types';
import {canShareDeck} from '../utils/cardHelpers.js';
import {getAllRules} from './rules.js';
import {getPlaystyleById} from './playstyles.js';

// Categories display order: direct first, then playstyle
const CATEGORY_ORDER: Record<SynergyCategory, number> = {
  direct: 0,
  playstyle: 1,
};

/** Aggregate pair score: max of all connection scores (avoids inflation). */
function computeAggregateScore(connections: PairSynergyConnection[]): number {
  if (connections.length === 0) return 0;
  return Math.max(...connections.map((c) => c.score));
}

export interface SynergyEngineOptions {
  rules?: SynergyRule[];
  maxResultsPerGroup?: number;
}

export class SynergyEngine {
  private rules: SynergyRule[];
  private maxResultsPerGroup: number;

  constructor(options: SynergyEngineOptions = {}) {
    this.rules = options.rules ?? getAllRules();
    this.maxResultsPerGroup = options.maxResultsPerGroup ?? 100;
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

    // Ink compatibility filter: exclude cards that can't share a deck.
    // canShareDeck handles all cases (single+single always true, dual checks ink overlap).
    const compatibleCards = allCards.filter((other) => canShareDeck(card, other));

    for (const rule of this.rules) {
      // Check if this rule applies to the card
      if (!rule.matches(card)) continue;

      // Find synergistic cards
      const matches = rule.findSynergies(card, compatibleCards);

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
            score: match.score,
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
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
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
    score: number;
    explanation: string;
    category: SynergyCategory;
    groupKey: string;
  }> {
    const grouped = this.findSynergies(card, allCards);
    const seen = new Set<string>();
    const results: Array<{
      card: LorcanaCard;
      score: number;
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
      score: number;
      explanation: string;
    }>;
  } {
    const synergies: Array<{
      category: SynergyCategory;
      groupKey: string;
      score: number;
      explanation: string;
    }> = [];

    for (const rule of this.rules) {
      if (!rule.matches(cardA)) continue;

      const matches = rule.findSynergies(cardA, [cardB]);
      for (const match of matches) {
        synergies.push({
          category: rule.category,
          groupKey: this.getGroupKey(rule),
          score: match.score,
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
   * Get a detailed breakdown of all synergy connections between two specific cards.
   * Runs rules bidirectionally and deduplicates by ruleId (keeps highest score).
   */
  getPairSynergies(cardA: LorcanaCard, cardB: LorcanaCard): DetailedPairSynergy {
    const connectionMap = new Map<string, PairSynergyConnection>();

    const collectConnections = (source: LorcanaCard, target: LorcanaCard) => {
      for (const rule of this.rules) {
        if (!rule.matches(source)) continue;
        const matches = rule.findSynergies(source, [target]);
        for (const match of matches) {
          const existing = connectionMap.get(rule.id);
          if (!existing || match.score > existing.score) {
            const base = {
              ruleId: rule.id,
              ruleName: rule.name,
              score: match.score,
              explanation: match.explanation,
            };
            connectionMap.set(
              rule.id,
              rule.category === 'playstyle'
                ? {...base, category: 'playstyle' as const, playstyleId: rule.playstyleId}
                : {...base, category: 'direct' as const},
            );
          }
        }
      }
    };

    collectConnections(cardA, cardB);
    collectConnections(cardB, cardA);

    const connections = Array.from(connectionMap.values()).sort((a, b) => b.score - a.score);
    const aggregateScore = computeAggregateScore(connections);

    return {cardA, cardB, connections, aggregateScore};
  }

  /**
   * Get all cards that match any rule in a given playstyle.
   * Returns deduplicated cards sorted by name.
   */
  getPlaystyleCards(playstyleId: PlaystyleId, allCards: LorcanaCard[]): LorcanaCard[] {
    const playstyleRules = this.rules.filter(
      (r) => r.category === 'playstyle' && r.playstyleId === playstyleId,
    );
    if (playstyleRules.length === 0) return [];

    const seen = new Set<string>();
    const result: LorcanaCard[] = [];

    for (const card of allCards) {
      if (seen.has(card.id)) continue;
      if (playstyleRules.some((rule) => rule.matches(card))) {
        seen.add(card.id);
        result.push(card);
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
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
