import type {LorcanaCard, SynergyCategory} from '../types';
import type {SynergyEngine} from './SynergyEngine.js';
// Create default cache with default engine
import {synergyEngine} from './SynergyEngine.js';

export interface CachedSynergyResult {
  hasSynergy: boolean;
  synergies: Array<{
    category: SynergyCategory;
    groupKey: string;
    score: number;
    explanation: string;
  }>;
}

/**
 * Cache for synergy calculations between card pairs.
 * Significantly improves performance for deck analysis and suggestions
 * by avoiding redundant synergy checks.
 */
export class SynergyCache {
  private cache = new Map<string, CachedSynergyResult>();
  private maxSize = 10000; // Prevent unbounded growth
  private engine: SynergyEngine;

  constructor(engine: SynergyEngine) {
    this.engine = engine;
  }

  /**
   * Get cache key for a card pair (order matters for directional synergies)
   */
  private getKey(cardA: LorcanaCard, cardB: LorcanaCard): string {
    return `${cardA.id}:${cardB.id}`;
  }

  /**
   * Check synergy between two cards, using cache if available.
   */
  checkSynergy(cardA: LorcanaCard, cardB: LorcanaCard): CachedSynergyResult {
    const key = this.getKey(cardA, cardB);

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Compute and cache the result
    const result = this.engine.checkSynergy(cardA, cardB);
    const cachedResult: CachedSynergyResult = {
      hasSynergy: result.hasSynergy,
      synergies: result.synergies.map((s) => ({
        category: s.category,
        groupKey: s.groupKey,
        score: s.score,
        explanation: s.explanation,
      })),
    };

    // Evict old entries if cache is too large
    if (this.cache.size >= this.maxSize) {
      // Delete first 1000 entries (oldest)
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 1000);
      for (const k of keysToDelete) {
        this.cache.delete(k);
      }
    }

    this.cache.set(key, cachedResult);
    return cachedResult;
  }

  /**
   * Check synergy in both directions and return combined result.
   * Useful for deck analysis where we care about any synergy between two cards.
   */
  checkBidirectionalSynergy(
    cardA: LorcanaCard,
    cardB: LorcanaCard,
  ): {
    hasSynergy: boolean;
    forward: CachedSynergyResult;
    reverse: CachedSynergyResult;
    bestSynergy: {score: number; explanation: string} | null;
  } {
    const forward = this.checkSynergy(cardA, cardB);
    const reverse = this.checkSynergy(cardB, cardA);
    const hasSynergy = forward.hasSynergy || reverse.hasSynergy;

    let bestSynergy: {score: number; explanation: string} | null = null;
    if (hasSynergy) {
      const allSynergies = [...forward.synergies, ...reverse.synergies];
      bestSynergy = allSynergies.reduce(
        (best, syn) => {
          return !best || syn.score > best.score ? syn : best;
        },
        null as {score: number; explanation: string} | null,
      );
    }

    return {hasSynergy, forward, reverse, bestSynergy};
  }

  /**
   * Clear the entire cache. Call when game mode changes or cards are reloaded.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): {size: number; maxSize: number} {
    return {size: this.cache.size, maxSize: this.maxSize};
  }
}

export const synergyCache = new SynergyCache(synergyEngine);
