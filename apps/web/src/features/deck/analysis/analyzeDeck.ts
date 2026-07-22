// Advisor orchestrator (integration of #469/#470/#471): composes the pure analysis
// modules into a single DeckHealth + Deck Quality Score. Pure — the caller injects
// the pair-score provider (from precomputed synergies) and the hoser catalog, so this
// stays testable and free of fetch/React. The builder UI calls this on every edit.

import type {
  Archetype,
  Deck,
  DeckHealth,
  DeckStats,
  HealthAnalyzer,
  LorcanaCard,
  QualityScore,
} from '../types';
import {calculateDeckStats} from './deckStats';
import {classifyArchetype} from './archetype';
import {buildHealthAnalyzers} from './analyzers';
import {analyzeVulnerabilities, type HoserEntry} from './vulnerabilities';
import {aggregateDeckSynergy, type DeckSynergyResult, type PairScore} from './deckSynergy';
import {scoreDeck} from './score';

export interface DeckAnalysis {
  stats: DeckStats;
  synergy: DeckSynergyResult;
  health: DeckHealth;
  quality: QualityScore;
}

export interface AnalyzeDeckOptions {
  /** Aggregate synergy score between two cardIds (0 if none), from precomputed pairs. */
  getPairScore: PairScore;
  /** The pool-derived hoser catalog (`public/data/hosers.json`). */
  hosers: HoserEntry[];
  /** Optional user-declared gameplan; overrides the auto-detected archetype. */
  gameplan?: Archetype;
}

/** Rough status cutoffs for the synergy-density indicator (calibrated later in Phase 3). */
function synergyStatus(score: number): HealthAnalyzer['status'] {
  if (score >= 50) return 'good';
  if (score >= 25) return 'warn';
  return 'bad';
}

/**
 * Fold the aggregate synergy density into a HealthAnalyzer. Its id is `synergyDensity`
 * to line up with the `scoring.json` weight key, so the composite score picks it up.
 */
function synergyDensityAnalyzer(synergy: DeckSynergyResult): HealthAnalyzer {
  return {
    id: 'synergyDensity',
    label: 'Synergy density',
    score: synergy.overallScore,
    status: synergyStatus(synergy.overallScore),
    message:
      synergy.weakLinks.length > 0
        ? `${synergy.keyCards.length} key cards; ${synergy.weakLinks.length} weak links worth reconsidering`
        : `${synergy.keyCards.length} key cards anchoring the deck`,
    value: synergy.overallScore,
  };
}

/**
 * Run the full advisor pipeline over a deck. A declared `gameplan` overrides the
 * auto-detected archetype (and reports full confidence). `health.overall` is set to
 * the Deck Quality Score so the UI has a single "how good is this deck" number.
 */
export function analyzeDeck(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
  opts: AnalyzeDeckOptions,
): DeckAnalysis {
  const stats = calculateDeckStats(deck, getCardById);

  const detected = classifyArchetype(stats, deck, getCardById);
  const archetype = opts.gameplan ?? detected.archetype;
  const archetypeConfidence = opts.gameplan ? 1 : detected.confidence;

  const analyzers = buildHealthAnalyzers(deck, stats, getCardById, archetype);
  const synergy = aggregateDeckSynergy(deck, opts.getPairScore);
  const vulnerabilities = analyzeVulnerabilities(deck, getCardById, opts.hosers);

  const health: DeckHealth = {
    overall: 0, // replaced below with the scored result
    archetype,
    archetypeConfidence,
    analyzers: [...analyzers, synergyDensityAnalyzer(synergy)],
    vulnerabilities,
  };

  const quality = scoreDeck(health);
  health.overall = quality.score;

  return {stats, synergy, health, quality};
}
