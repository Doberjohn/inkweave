// Deck Quality Score (#462) — the transparent, versioned composite scorer.
//
// This is a GLASS BOX: every point in the final `score` traces back to a
// weighted health dimension or the vulnerability penalty, and the returned
// `breakdown` carries that arithmetic verbatim (contribution + reason per term).
// No ML, no hidden fudge factors. Pure and deterministic: same `DeckHealth` +
// same `ScoringConfig` always yields the same `QualityScore`.
//
// See `docs/deck-builder/PLAN.md` Part A (Composite) + Part C (score/case model).

import scoringConfig from './scoring.json';
import type {
  DeckHealth,
  QualityScore,
  ScoreContribution,
  VulnerabilitySeverity,
} from '../types';

/**
 * The versioned scoring config: per-dimension weights (keyed by `HealthAnalyzer.id`)
 * plus the vulnerability-penalty schedule. Mirrors `scoring.json`. Weights are
 * expected to sum to 1.0 for a full `DeckHealth`, but the scorer renormalizes by
 * whatever weights are actually present so a partial health still scores on 0..100.
 */
export interface ScoringConfig {
  /** Reproducibility stamp copied onto every `QualityScore.configVersion`. */
  version: string;
  /** Dimension weight by analyzer id. Weights for a full deck sum to 1.0. */
  weights: Record<string, number>;
  /** Points subtracted per vulnerability, by severity. */
  vulnerabilityPenalty: Record<VulnerabilitySeverity, number>;
  /** Upper bound on the total vulnerability penalty (points). */
  vulnerabilityPenaltyCap: number;
}

/** Stable dimension id for the single vulnerability-penalty breakdown row. */
const VULNERABILITY_DIMENSION = 'vulnerability-penalty';

/** Default config imported from the versioned `scoring.json`. */
const DEFAULT_CONFIG = scoringConfig as ScoringConfig;

/** Clamp a number into the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Summed, capped vulnerability penalty for a deck.
 * `Σ penalty[severity]`, floored so a config entry can never be negative,
 * then capped at `vulnerabilityPenaltyCap`.
 */
function computeVulnerabilityPenalty(health: DeckHealth, config: ScoringConfig): number {
  const raw = health.vulnerabilities.reduce(
    (sum, v) => sum + Math.max(0, config.vulnerabilityPenalty[v.severity] ?? 0),
    0,
  );
  return Math.min(raw, config.vulnerabilityPenaltyCap);
}

/** Human-readable summary of the applied vulnerability penalty. */
function penaltyReason(health: DeckHealth, applied: number, config: ScoringConfig): string {
  if (health.vulnerabilities.length === 0) return 'No vulnerabilities detected.';
  const counts = health.vulnerabilities.reduce<Record<string, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1;
    return acc;
  }, {});
  const parts = (['high', 'medium', 'low'] as const)
    .filter((sev) => counts[sev])
    .map((sev) => `${counts[sev]} ${sev}`);
  const capped = applied >= config.vulnerabilityPenaltyCap ? ` (capped at ${config.vulnerabilityPenaltyCap})` : '';
  return `${health.vulnerabilities.length} vulnerabilit${health.vulnerabilities.length === 1 ? 'y' : 'ies'} (${parts.join(', ')}) subtract ${applied} point${applied === 1 ? '' : 's'}${capped}.`;
}

/**
 * Compute the transparent Deck Quality Score.
 *
 * Formula:
 *   base       = ( Σ over weighted analyzers of weight × (score/100) ) / presentWeightSum × 100
 *   penalty    = min( Σ vulnerabilityPenalty[severity], cap )
 *   scoreRaw   = base − penalty
 *   score      = round( clamp(scoreRaw, 0, 100) )
 *
 * `base` is renormalized by `presentWeightSum` (the sum of the config weights for
 * the analyzers actually supplied), so a partial `DeckHealth` still lands on 0..100.
 * Analyzers with no configured weight contribute 0 and are excluded from both the
 * numerator and `presentWeightSum` (they do not appear in the breakdown).
 *
 * The returned `breakdown` holds one `ScoreContribution` per weighted analyzer
 * (its renormalized `contribution` in points) plus one row for the vulnerability
 * penalty. Invariant: `Σ breakdown.contribution` equals `score` within rounding
 * (exactly so whenever `scoreRaw` did not clamp).
 *
 * Pure and deterministic.
 */
export function scoreDeck(health: DeckHealth, config: ScoringConfig = DEFAULT_CONFIG): QualityScore {
  const weighted = health.analyzers.filter((a) => typeof config.weights[a.id] === 'number');
  const presentWeightSum = weighted.reduce((sum, a) => sum + config.weights[a.id], 0);

  // Renormalization factor: maps the weighted sum back onto a 0..100 scale using
  // only the weights present. Guarded against the no-weighted-analyzer degenerate.
  const norm = presentWeightSum > 0 ? 100 / presentWeightSum : 0;

  const analyzerContributions: ScoreContribution[] = weighted.map((a) => {
    const weight = config.weights[a.id];
    const dimensionScore = a.score / 100;
    return {
      dimension: a.id,
      weight,
      dimensionScore,
      // Renormalized points this dimension puts into `base`. Σ of these == base.
      contribution: weight * dimensionScore * norm,
      reason: a.message,
    };
  });

  const base = analyzerContributions.reduce((sum, c) => sum + c.contribution, 0);
  const penalty = computeVulnerabilityPenalty(health, config);
  const scoreRaw = base - penalty;
  const score = Math.round(clamp(scoreRaw, 0, 100));

  const penaltyContribution: ScoreContribution = {
    dimension: VULNERABILITY_DIMENSION,
    // -1 weight: the penalty is a subtractive term. weight × dimensionScore × 100 == contribution.
    weight: -1,
    dimensionScore: penalty / 100,
    contribution: -penalty,
    reason: penaltyReason(health, penalty, config),
  };

  return {
    score,
    breakdown: [...analyzerContributions, penaltyContribution],
    configVersion: config.version,
  };
}
