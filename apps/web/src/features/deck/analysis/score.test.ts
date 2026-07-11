import {describe, expect, it} from 'vitest';
import {scoreDeck, type ScoringConfig} from './score';
import type {
  DeckHealth,
  HealthAnalyzer,
  Vulnerability,
  VulnerabilitySeverity,
} from '../types';

// The 11 weighted analyzer ids in scoring.json (weights sum to 1.0).
const WEIGHTED_IDS = [
  'curve',
  'inkable',
  'draw',
  'removal',
  'actionsCap',
  'typeMix',
  'ruleOfEight',
  'consistency',
  'lore',
  'shiftCoverage',
  'synergyDensity',
];

function analyzer(id: string, score: number): HealthAnalyzer {
  return {id, label: id, score, status: 'good', message: `${id}: ${score}`};
}

function vuln(severity: VulnerabilitySeverity, id: string = severity): Vulnerability {
  return {id, label: id, conditionType: id, severity, message: `${id} exposure`};
}

/** A full DeckHealth with all weighted analyzers at the same score. */
function fullHealth(score: number, vulnerabilities: Vulnerability[] = []): DeckHealth {
  return {
    overall: score,
    archetype: 'midrange',
    archetypeConfidence: 0.8,
    analyzers: WEIGHTED_IDS.map((id) => analyzer(id, score)),
    vulnerabilities,
  };
}

const sumContributions = (breakdown: {contribution: number}[]): number =>
  breakdown.reduce((total, c) => total + c.contribution, 0);

describe('scoreDeck', () => {
  it('is deterministic and scores a uniform full health at its dimension level', () => {
    // All 11 weights present (Σ = 1.0), every dimension at 80, no penalty → 80.
    const result = scoreDeck(fullHealth(80));
    expect(result.score).toBe(80);
    // Same input twice → identical output (pure).
    expect(scoreDeck(fullHealth(80))).toEqual(result);
  });

  it('stamps the config version from scoring.json', () => {
    expect(scoreDeck(fullHealth(50)).configVersion).toBe('score-v1');
  });

  it('lets a custom config version flow through', () => {
    const config: ScoringConfig = {
      version: 'score-test',
      weights: {curve: 1},
      vulnerabilityPenalty: {high: 8, medium: 4, low: 1},
      vulnerabilityPenaltyCap: 20,
    };
    expect(scoreDeck(fullHealth(60), config).configVersion).toBe('score-test');
  });

  it('breakdown contributions sum to the score (glass-box invariant)', () => {
    const health = fullHealth(72, [vuln('medium'), vuln('low')]);
    // Mix dimension scores so the sum is non-trivial.
    health.analyzers[0].score = 40;
    health.analyzers[3].score = 95;
    health.analyzers[10].score = 88;
    const result = scoreDeck(health);
    expect(Math.abs(sumContributions(result.breakdown) - result.score)).toBeLessThanOrEqual(0.5);
  });

  it('produces one breakdown row per weighted analyzer plus the penalty row', () => {
    const result = scoreDeck(fullHealth(80));
    expect(result.breakdown).toHaveLength(WEIGHTED_IDS.length + 1);
    const last = result.breakdown.at(-1)!;
    expect(last.dimension).toBe('vulnerability-penalty');
    expect(Math.abs(last.contribution)).toBe(0); // no vulnerabilities → 0 penalty
  });

  it('applies the vulnerability penalty', () => {
    // Base 80, one high vuln (8 points) → 72.
    const result = scoreDeck(fullHealth(80, [vuln('high')]));
    expect(result.score).toBe(72);
    expect(result.breakdown.at(-1)!.contribution).toBe(-8);
  });

  it('caps the vulnerability penalty at the configured ceiling', () => {
    // 3 high vulns = 24 raw, capped at 20 → base 80 − 20 = 60.
    const result = scoreDeck(fullHealth(80, [vuln('high', 'a'), vuln('high', 'b'), vuln('high', 'c')]));
    expect(result.score).toBe(60);
    expect(result.breakdown.at(-1)!.contribution).toBe(-20);
  });

  it('renormalizes a partial DeckHealth back onto 0..100', () => {
    // Only 2 of the 11 analyzers present, both at 50 → renormalized base 50.
    const partial: DeckHealth = {
      overall: 50,
      archetype: 'aggro',
      archetypeConfidence: 0.5,
      analyzers: [analyzer('curve', 50), analyzer('removal', 50)],
      vulnerabilities: [],
    };
    const result = scoreDeck(partial);
    expect(result.score).toBe(50);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // 2 weighted rows + penalty row.
    expect(result.breakdown).toHaveLength(3);
  });

  it('ignores analyzers with no configured weight (they contribute 0)', () => {
    const withExtra = fullHealth(80);
    withExtra.analyzers.push(analyzer('mysteryDimension', 5));
    const result = scoreDeck(withExtra);
    // Unweighted analyzer neither scores nor appears in the breakdown.
    expect(result.score).toBe(80);
    expect(result.breakdown.some((c) => c.dimension === 'mysteryDimension')).toBe(false);
    expect(result.breakdown).toHaveLength(WEIGHTED_IDS.length + 1);
  });

  it('clamps a catastrophic deck to 0 rather than going negative', () => {
    // Very low base (all 5) with a maxed penalty would go negative → clamp to 0.
    const result = scoreDeck(fullHealth(5, [vuln('high', 'a'), vuln('high', 'b'), vuln('high', 'c')]));
    expect(result.score).toBe(0);
  });
});
