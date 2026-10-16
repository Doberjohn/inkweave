import type {
  LorcanaCard,
  PlaystyleId,
  SynergyCategory,
  SynergyGroup,
  SynergyMatch,
  SynergyMatchDisplay,
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

/** Swap the {A} and {B} chip tokens, so a line written from one card's side reads from the other's. */
function swapChipTokens(explanation: string): string {
  return explanation.replace(/\{([AB])\}/g, (_token, side: string) =>
    side === 'A' ? '{B}' : '{A}',
  );
}

/** Aggregate pair score: max of all connection scores (avoids inflation). */
function computeAggregateScore(connections: PairSynergyConnection[]): number {
  if (connections.length === 0) return 0;
  return Math.max(...connections.map((c) => c.score));
}

/** A group's matches, best first: highest score, then card name. */
function compareMatches(a: SynergyMatchDisplay, b: SynergyMatchDisplay): number {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  return a.card.name.localeCompare(b.card.name);
}

/** Groups in display order: direct first, then playstyle, then alphabetical within each category. */
function compareGroups(a: SynergyGroup, b: SynergyGroup): number {
  const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (catDiff !== 0) return catDiff;
  return a.label.localeCompare(b.label);
}

/** Add a rule's matches to its group, skipping cards the group already holds. */
function addMatches(group: SynergyGroup, rule: SynergyRule, matches: SynergyMatch[]): void {
  for (const match of matches) {
    if (group.synergies.some((s) => s.card.id === match.card.id)) continue;
    group.synergies.push({
      card: match.card,
      score: match.score,
      explanation: match.explanation,
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }
}

/** A rule's match as a pair connection, its explanation read from the pair's first card. */
function toConnection(rule: SynergyRule, match: SynergyMatch, reverse: boolean): PairSynergyConnection {
  const base = {
    ruleId: rule.id,
    ruleName: rule.name,
    score: match.score,
    explanation: reverse ? swapChipTokens(match.explanation) : match.explanation,
  };
  return rule.category === 'playstyle'
    ? {...base, category: 'playstyle' as const, playstyleId: rule.playstyleId}
    : {...base, category: 'direct' as const};
}

/** Keep each rule's strongest connection: a later match replaces an earlier one only if it scores higher. */
function keepStrongest(
  connections: Map<string, PairSynergyConnection>,
  rule: SynergyRule,
  matches: SynergyMatch[],
  reverse: boolean,
): void {
  for (const match of matches) {
    const existing = connections.get(rule.id);
    if (!existing || match.score > existing.score) {
      connections.set(rule.id, toConnection(rule, match, reverse));
    }
  }
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
   * Derive the group label, tagline, and description for a rule.
   * Playstyle rules pull from the playstyle registry; direct rules use rule metadata
   * (their description is already a one-sentence summary, so it doubles as the tagline).
   */
  private getGroupMeta(rule: SynergyRule): {label: string; tagline: string; description: string} {
    if (rule.category === 'playstyle') {
      const playstyle = getPlaystyleById(rule.playstyleId);
      if (playstyle) {
        return {
          label: playstyle.name,
          tagline: playstyle.tagline,
          description: playstyle.tagline,
        };
      }
    }
    return {label: rule.name, tagline: rule.description, description: rule.description};
  }

  /** The group a rule's matches go into, created the first time one of its rules matches. */
  private groupFor(groups: Map<string, SynergyGroup>, rule: SynergyRule): SynergyGroup {
    const groupKey = this.getGroupKey(rule);
    const existing = groups.get(groupKey);
    if (existing) return existing;
    const meta = this.getGroupMeta(rule);
    const group: SynergyGroup = {
      groupKey,
      category: rule.category,
      label: meta.label,
      tagline: meta.tagline,
      description: meta.description,
      synergies: [],
    };
    groups.set(groupKey, group);
    return group;
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
      if (!rule.matches(card)) continue;
      const matches = rule.findSynergies(card, compatibleCards);
      if (matches.length > 0) addMatches(this.groupFor(results, rule), rule, matches);
    }

    // Sort and limit results within each group
    for (const group of results.values()) {
      group.synergies = group.synergies.sort(compareMatches).slice(0, this.maxResultsPerGroup);
    }

    return Array.from(results.values()).sort(compareGroups);
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
   * Every explanation reads from cardA's side: {A} is cardA and {B} is cardB, so a line from
   * the reverse pass, which names its own searcher (cardB) {A}, has its tokens swapped.
   */
  getPairSynergies(cardA: LorcanaCard, cardB: LorcanaCard): DetailedPairSynergy {
    const connectionMap = new Map<string, PairSynergyConnection>();
    this.collectConnections(connectionMap, cardA, cardB, false);
    this.collectConnections(connectionMap, cardB, cardA, true);

    const connections = Array.from(connectionMap.values()).sort((a, b) => b.score - a.score);
    const aggregateScore = computeAggregateScore(connections);

    return {cardA, cardB, connections, aggregateScore};
  }

  /** One pass of getPairSynergies: every rule `source` meets, matched against `target`. */
  private collectConnections(
    connections: Map<string, PairSynergyConnection>,
    source: LorcanaCard,
    target: LorcanaCard,
    reverse: boolean,
  ): void {
    for (const rule of this.rules) {
      if (rule.matches(source)) keepStrongest(connections, rule, rule.findSynergies(source, [target]), reverse);
    }
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
