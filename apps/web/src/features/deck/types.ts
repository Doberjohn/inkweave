// Type contract for the deck builder + live advisor (Phase 0 of the deck-builder plan).
//
// This file is TYPES-ONLY. Runtime logic lives elsewhere:
//   - `calculateDeckStats` (#459) in `analysis/deckStats.ts`
//   - the composite quality score (#462) in `analysis/score.ts`
//
// Cards are ALWAYS referenced by `cardId: string`; a `LorcanaCard` is never embedded.
// See `docs/deck-builder/PLAN.md` Part A (deck-health framework) + Part C (score/case model).

import type {LorcanaCard, Ink, CardType, PlaystyleId} from 'inkweave-synergy-engine';

// Re-export the engine card-domain types so downstream deck-analysis modules
// (#459 deckStats, #462 score, and later analyzers) resolve cards / inks /
// playstyles from this single contract file instead of reaching into the engine.
export type {LorcanaCard, Ink, CardType, PlaystyleId};

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Deck strategy archetype. Auto-detected by the classifier (curve centroid +
 * role densities + avg lore/cost) and overridable via `Deck.gameplan`.
 */
export type Archetype = 'aggro' | 'tempo' | 'midrange' | 'control' | 'combo' | 'ramp';

/** Traffic-light health verdict used by analyzers and status badges. */
export type DeckStatus = 'good' | 'warn' | 'bad';

/** How sharply a vulnerability can blow the deck out. */
export type VulnerabilitySeverity = 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Deck entity
// ---------------------------------------------------------------------------

/** A single line in a deck list: which card, how many copies, and whether it anchors the plan. */
export interface DeckCard {
  /** Engine card id (`LorcanaCard.id`). */
  cardId: string;
  /** Number of copies in the deck (Core rules cap this at 4 per unique `fullName`). */
  quantity: number;
  /** Marks a "deck core" card that seeds and up-weights synergy suggestions. */
  isCore?: boolean;
}

/**
 * A saved (or draft) deck. `schemaVersion` pins the localStorage/JSONB shape so
 * future migrations can detect and upgrade older drafts.
 */
export interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  /** Optional user-declared gameplan; when set it overrides the auto-detected archetype. */
  gameplan?: Archetype;
  /** Derived from the deck's cards; Core format allows at most 2 (dual-ink counts as both). */
  inks: Ink[];
  /** Cloud decks default to private; only relevant once persisted to Supabase. */
  isPublic?: boolean;
  /** Supabase `auth.users` id of the owner; null/undefined for anonymous local drafts. */
  ownerId?: string | null;
  createdAt: number;
  updatedAt: number;
  /** Persisted-shape version. Bump when the `Deck`/`DeckCard` shape changes. */
  schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Composition statistics (computed by #459 `calculateDeckStats`)
// ---------------------------------------------------------------------------

/** Pure compositional stats derived from a deck's cards. No opinions, just counts. */
export interface DeckStats {
  /** Sum of every `DeckCard.quantity`. */
  totalCards: number;
  /** Number of distinct `cardId`s in the deck. */
  uniqueCards: number;
  /** Copies per ink; dual-ink cards contribute to both inks. */
  inkDistribution: Partial<Record<Ink, number>>;
  /** Mana-cost histogram: cost -> copy count. Costs >= 7 are bucketed under key `7`. */
  costCurve: Record<number, number>;
  /**
   * Per-cost ink breakdown: cost bucket -> ink -> copy count. A dual-ink card
   * counts toward BOTH of its inks (same convention as `inkDistribution`), so a
   * bucket's ink counts can sum above its `costCurve` count. Drives the
   * ink-colored segments of the cost-curve strip.
   */
  costCurveByInk: Record<number, Partial<Record<Ink, number>>>;
  /** Copies per card type (Character / Action / Item / Location). */
  typeDistribution: Partial<Record<CardType, number>>;
  /** Number of distinct inks in the deck (<= 2 when legal). */
  inkCount: number;
  /** Copies that can be put into the inkwell (`inkwell === true`). */
  inkableCount: number;
  /** True when the deck satisfies every Tier-1 hard rule (size / copies / inks). */
  isLegal: boolean;
  /** Human-readable reasons the deck fails legality; empty when `isLegal`. */
  legalityErrors: string[];
  /** Non-blocking notes that don't affect legality (e.g. cardIds that no longer resolve — likely rotated out of Core). */
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Deck health (Tier-2 heuristics + Tier-3 vulnerabilities)
// ---------------------------------------------------------------------------

/** One Tier-2 soft-heuristic dimension (curve, removal, draw, ...) with its verdict. */
export interface HealthAnalyzer {
  /** Stable analyzer id, e.g. `'curve'`, `'removal'`, `'inkable-ratio'`. */
  id: string;
  /** Display label, e.g. `'Removal'`. */
  label: string;
  /** Normalized health for this dimension, 0..100. */
  score: number;
  status: DeckStatus;
  /** One-line explanation of the verdict. */
  message: string;
  /** Optional raw measured value (e.g. removal-card count) behind the score. */
  value?: number;
}

/**
 * A "what to watch for" weakness derived from the live Core pool (not a meta snapshot).
 * `conditionType` mirrors the engine's future `RemovalCondition` id but is typed as a
 * loose `string` to avoid a cross-package type cycle before `getRemovalRoles` lands (#460).
 */
export interface Vulnerability {
  /** Stable vulnerability id, e.g. `'low-strength'`. */
  id: string;
  /** Display label, e.g. `'Low-strength board'`. */
  label: string;
  /**
   * Removal-condition id this vulnerability keys on (e.g. `'low-strength'`,
   * `'evasive'`, `'bodyguard'`, `'damaged'`, `'high-cost'`, `'mass'`).
   */
  conditionType: string;
  severity: VulnerabilitySeverity;
  /** Share of your board exposed to this condition, 0..100. */
  exposurePct?: number;
  /** One-line explanation, e.g. "68% of your characters have <= 2 strength...". */
  message: string;
  /** Example answer cards from the pool that punish this condition. */
  hoserCardIds?: string[];
}

/** Aggregate deck-health report: overall grade, archetype, per-dimension analyzers, vulnerabilities. */
export interface DeckHealth {
  /** Composite health, 0..100. */
  overall: number;
  archetype: Archetype;
  /** Classifier confidence in `archetype`, 0..1. */
  archetypeConfidence: number;
  analyzers: HealthAnalyzer[];
  vulnerabilities: Vulnerability[];
}

// ---------------------------------------------------------------------------
// Live suggestions
// ---------------------------------------------------------------------------

/** A ranked add-this-card suggestion from the live advisor. */
export interface Suggestion {
  /** Engine card id of the suggested card. */
  cardId: string;
  /** Aggregate synergy strength with the current deck (core cards weighted higher). */
  synergyScore: number;
  /** How much this card fills a compositional/vulnerability gap. */
  gapScore: number;
  /** Combined ranking score (`synergyScore` + weighted `gapScore`). */
  totalScore: number;
  /** Card ids in the deck this card synergizes with (drives the explanation). */
  synergizesWith: string[];
  /** Human-readable reasons the card is suggested. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Deck Quality Score (computed by #462 `score.ts`)
// ---------------------------------------------------------------------------

/** One weighted term in the composite quality score, kept for a glass-box breakdown. */
export interface ScoreContribution {
  /** Scored dimension id (mirrors a `HealthAnalyzer.id` or coherence/penalty term). */
  dimension: string;
  /** This dimension's weight from the versioned scoring config. */
  weight: number;
  /** Normalized dimension performance, 0..1. */
  dimensionScore: number;
  /** Points this dimension contributes to the final score (`weight * dimensionScore`). */
  contribution: number;
  /** Why this dimension scored the way it did. */
  reason: string;
}

/** The composite Deck Quality Score plus its full arithmetic breakdown and config stamp. */
export interface QualityScore {
  /** Final Deck Quality Score, 0..100. */
  score: number;
  /** Per-dimension contributions that sum (with coherence/penalty) into `score`. */
  breakdown: ScoreContribution[];
  /** Version of the scoring config that produced this score (reproducibility stamp). */
  configVersion: string;
}

// ---------------------------------------------------------------------------
// Human-in-the-loop calibration (Phase 3)
// ---------------------------------------------------------------------------

/** Compact, comparable signature of a deck used for nearest-case retrieval. */
export interface DeckFingerprint {
  archetype: Archetype;
  /** Bucketed dimension scores (dimension id -> coarse bucket), for distance calc. */
  bucketedScores: Record<string, number>;
  /** Dominant playstyles present in the deck (`_playstyles.json` intersected with the deck). */
  playstyles: PlaystyleId[];
  /** Rule ids of the top key-card synergies (the deck's "shape" signature). */
  synergySignature: string[];
  inks: Ink[];
  /** Mean weighted mana cost (curve center of mass). */
  curveCentroid: number;
}

/**
 * A stored, human-labeled analysis (the calibration "memory"). Captures the analyzer's
 * output plus the creator's ground-truth score, per-dimension corrections, and notes.
 */
export interface AnalysisCase {
  id: string;
  ownerId?: string | null;
  fingerprint: DeckFingerprint;
  /** Analyzer's per-dimension scores at capture time (dimension id -> score). */
  dimensionScores: Record<string, number>;
  /** Analyzer's composite score at capture time. */
  analyzerScore: number;
  /** Creator's ground-truth score, if entered. */
  humanScore?: number;
  /** Per-dimension right/wrong verdicts with optional notes, keyed by dimension id. */
  corrections?: Record<string, {verdict: 'right' | 'wrong'; note?: string}>;
  /** Free-form reviewer notes, replayed as advice on similar future decks. */
  notes?: string;
  /** Scoring config version in effect when this case was captured. */
  configVersion: string;
  createdAt: number;
}
