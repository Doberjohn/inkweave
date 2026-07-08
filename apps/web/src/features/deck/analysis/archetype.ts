// Archetype classifier (#469) — the FIRST step of the archetype-parameterized
// deck-health advisor. Given a deck's composition, it deterministically detects
// which of the six strategies (`aggro | tempo | midrange | control | combo |
// ramp`) the card choices actually describe, so the health analyzers can load
// the matching target profile.
//
// This is PURE AUTO-DETECT. A user-declared `deck.gameplan` overrides the result,
// but that override is applied by the CALLER (the advisor controller), not here.
//
// The scorecard reads four signal families off the resolved cards:
//   - curve center-of-mass (average mana cost),
//   - role densities (removal / draw / ramp counts, scaled to a 60-card deck),
//   - lore output + character share (threat / racing density),
//   - top-end body share (the ramp payoff signal).
// Each archetype scores as a weighted sum of how well those signals match its
// signature; the top score wins and `confidence` is the normalized margin over
// the runner-up. See `docs/deck-builder/PLAN.md` Part A (Tier 2).

import type {Archetype, Deck, DeckStats, LorcanaCard} from '../types';
import {getCardMechanics, getRampRoles, getRemovalRoles, isCharacter} from 'inkweave-synergy-engine';

/** The measured feature vector a deck presents to the scorecard. */
interface Features {
  /** Average mana cost over the resolved cards (curve center of mass). */
  centroid: number;
  /** Opponent-removal cards, scaled to a 60-card deck. */
  removalPer60: number;
  /** Card-draw sources, scaled to a 60-card deck. */
  drawPer60: number;
  /** Inkwell-ramp / deck-ramp enablers, scaled to a 60-card deck. */
  rampPer60: number;
  /** Total board lore (Σ lore×qty over characters), scaled to a 60-card deck. */
  lorePer60: number;
  /** Character copies as a share of the deck, 0..1 (threat density). */
  charShare: number;
  /** Cost-5+ character copies as a share of the deck, 0..1 (ramp payoff). */
  highCostShare: number;
}

/** Scale a raw count to its 60-card-deck equivalent. */
function per60(count: number, total: number): number {
  return total > 0 ? (count / total) * 60 : 0;
}

/** 0 at/below `lo`, 1 at/above `hi`, linear in between (higher input scores higher). */
function rampUp(x: number, lo: number, hi: number): number {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  return (x - lo) / (hi - lo);
}

/** 1 at/below `lo`, 0 at/above `hi`, linear in between (lower input scores higher). */
function rampDown(x: number, lo: number, hi: number): number {
  if (x <= lo) return 1;
  if (x >= hi) return 0;
  return (hi - x) / (hi - lo);
}

/** Triangular peak: 1 inside `[lo, hi]`, linear falloff to 0 over `margin` beyond either edge. */
function band(x: number, lo: number, hi: number, margin: number): number {
  if (x >= lo && x <= hi) return 1;
  const d = x < lo ? lo - x : x - hi;
  return Math.max(0, 1 - d / margin);
}

/** Fold the deck's resolved cards into the feature vector the scorecard reads. */
function extractFeatures(deck: Deck, getCardById: (id: string) => LorcanaCard | undefined): Features {
  let resolved = 0;
  let cost = 0;
  let removal = 0;
  let draw = 0;
  let ramp = 0;
  let lore = 0;
  let chars = 0;
  let highCost = 0;

  for (const {cardId, quantity} of deck.cards) {
    const card = getCardById(cardId);
    if (!card) continue;
    resolved += quantity;
    cost += card.cost * quantity;
    if (getRemovalRoles(card).length > 0) removal += quantity;
    if (getCardMechanics(card).includes('draw')) draw += quantity;
    if (getRampRoles(card).includes('inkwell-ramp')) ramp += quantity;
    if (isCharacter(card)) {
      chars += quantity;
      lore += (card.lore ?? 0) * quantity;
      if (card.cost >= 5) highCost += quantity;
    }
  }

  const denom = resolved || 1;
  return {
    centroid: cost / denom,
    removalPer60: per60(removal, denom),
    drawPer60: per60(draw, denom),
    rampPer60: per60(ramp, denom),
    lorePer60: per60(lore, denom),
    charShare: chars / denom,
    highCostShare: highCost / denom,
  };
}

/**
 * Score each archetype from the feature vector. Every term is a weighted signal
 * match (0..1); the weights encode how load-bearing that signal is for the
 * archetype. `midrange` carries a small constant so a balanced, signal-less deck
 * defaults to it rather than to a noisy runner-up.
 */
function scoreArchetypes(f: Features): Record<Archetype, number> {
  return {
    // Fast, front-loaded, lore-forward, light on removal.
    aggro:
      1.4 * rampDown(f.centroid, 2.9, 3.7) +
      1.2 * rampUp(f.lorePer60, 22, 40) +
      0.9 * rampDown(f.removalPer60, 4, 10) +
      0.5 * rampUp(f.charShare, 0.5, 0.62),
    // Low-mid curve with real interaction and efficient bodies.
    tempo:
      1.2 * band(f.centroid, 2.7, 3.3, 0.8) +
      0.9 * band(f.removalPer60, 5, 9, 4) +
      0.8 * rampUp(f.lorePer60, 16, 28) +
      0.5 * rampUp(f.drawPer60, 3, 8),
    // Balanced everything — the default fallback (baseline constant).
    midrange:
      1.2 * band(f.centroid, 3.0, 3.7, 0.7) +
      0.9 * band(f.removalPer60, 5, 10, 4) +
      0.7 * band(f.charShare, 0.42, 0.58, 0.15) +
      0.6,
    // High curve, removal-and-draw heavy, low own-lore (wins late).
    control:
      1.5 * rampUp(f.centroid, 3.4, 4.4) +
      1.4 * rampUp(f.removalPer60, 7, 12) +
      1.0 * rampUp(f.drawPer60, 6, 11) +
      0.8 * rampDown(f.lorePer60, 30, 14),
    // Draw-forward, low interaction (a conservative signal — Inkweave has no
    // generic tutor detector yet, so combo only edges out on clear draw engines).
    combo:
      1.3 * rampUp(f.drawPer60, 7, 12) +
      0.8 * rampDown(f.removalPer60, 5, 11) +
      0.4 * rampUp(f.highCostShare, 0.05, 0.15),
    // Mana acceleration into a top-heavy payoff — the ramp enabler term dominates.
    ramp:
      1.9 * rampUp(f.rampPer60, 2, 6) +
      1.0 * rampUp(f.highCostShare, 0.08, 0.2) +
      0.8 * rampUp(f.centroid, 3.3, 4.4),
  };
}

/**
 * Auto-detect a deck's archetype from its composition.
 *
 * Deterministic and pure: the same `stats` + `deck` + resolver always yield the
 * same result. Returns the top-scoring archetype plus a `confidence` in `0..1`
 * (the normalized margin between the top score and the runner-up — a blowout
 * near 1, a coin-flip near 0). An empty deck defaults to `midrange` at 0
 * confidence. `stats` provides the deck-size guard; the feature densities are
 * measured over the resolved cards.
 *
 * A user-declared `deck.gameplan` is NOT consulted here — the caller applies
 * that override on top of this auto-detection.
 */
export function classifyArchetype(
  stats: DeckStats,
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
): {archetype: Archetype; confidence: number} {
  if (stats.totalCards === 0) return {archetype: 'midrange', confidence: 0};

  const features = extractFeatures(deck, getCardById);
  const scores = scoreArchetypes(features);
  const ranked = (Object.entries(scores) as Array<[Archetype, number]>).sort(
    (a, b) => b[1] - a[1],
  );

  const [topArchetype, topScore] = ranked[0];
  const runnerUp = ranked[1][1];
  const confidence = topScore > 0 ? Math.min(1, Math.max(0, (topScore - runnerUp) / topScore)) : 0;

  return {archetype: topArchetype, confidence};
}
