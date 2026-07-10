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

/** A linear response window: `lo`/`hi` bound where a signal starts and finishes scoring. */
interface Ramp {
  lo: number;
  hi: number;
}

/** A triangular response window: the `[lo, hi]` plateau plus a `margin` of linear falloff. */
interface Band {
  lo: number;
  hi: number;
  margin: number;
}

/** 0 at/below `lo`, 1 at/above `hi`, linear in between (higher input scores higher). */
function rampUp(x: number, r: Ramp): number {
  if (x <= r.lo) return 0;
  if (x >= r.hi) return 1;
  return (x - r.lo) / (r.hi - r.lo);
}

/** 1 at/below `lo`, 0 at/above `hi`, linear in between (lower input scores higher). */
function rampDown(x: number, r: Ramp): number {
  if (x <= r.lo) return 1;
  if (x >= r.hi) return 0;
  return (r.hi - x) / (r.hi - r.lo);
}

/** Triangular peak: 1 inside `[lo, hi]`, linear falloff to 0 over `margin` beyond either edge. */
function band(x: number, b: Band): number {
  if (x >= b.lo && x <= b.hi) return 1;
  const d = x < b.lo ? b.lo - x : x - b.hi;
  return Math.max(0, 1 - d / b.margin);
}

/** Running per-role tallies accumulated across a deck's resolved card copies. */
interface FeatureTotals {
  resolved: number;
  cost: number;
  removal: number;
  draw: number;
  ramp: number;
  lore: number;
  chars: number;
  highCost: number;
}

/** Fold one card's copies into the running totals (mutates `totals` in place). */
function addCard(totals: FeatureTotals, card: LorcanaCard, quantity: number): void {
  totals.resolved += quantity;
  totals.cost += card.cost * quantity;
  if (getRemovalRoles(card).length > 0) totals.removal += quantity;
  if (getCardMechanics(card).includes('draw')) totals.draw += quantity;
  if (getRampRoles(card).includes('inkwell-ramp')) totals.ramp += quantity;
  if (isCharacter(card)) {
    totals.chars += quantity;
    totals.lore += (card.lore ?? 0) * quantity;
    if (card.cost >= 5) totals.highCost += quantity;
  }
}

/** Fold the deck's resolved cards into the feature vector the scorecard reads. */
function extractFeatures(deck: Deck, getCardById: (id: string) => LorcanaCard | undefined): Features {
  const totals: FeatureTotals = {
    resolved: 0,
    cost: 0,
    removal: 0,
    draw: 0,
    ramp: 0,
    lore: 0,
    chars: 0,
    highCost: 0,
  };

  for (const {cardId, quantity} of deck.cards) {
    const card = getCardById(cardId);
    if (card) addCard(totals, card, quantity);
  }

  const denom = totals.resolved || 1;
  return {
    centroid: totals.cost / denom,
    removalPer60: (totals.removal / denom) * 60,
    drawPer60: (totals.draw / denom) * 60,
    rampPer60: (totals.ramp / denom) * 60,
    lorePer60: (totals.lore / denom) * 60,
    charShare: totals.chars / denom,
    highCostShare: totals.highCost / denom,
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
      1.4 * rampDown(f.centroid, {lo: 2.9, hi: 3.7}) +
      1.2 * rampUp(f.lorePer60, {lo: 22, hi: 40}) +
      0.9 * rampDown(f.removalPer60, {lo: 4, hi: 10}) +
      0.5 * rampUp(f.charShare, {lo: 0.5, hi: 0.62}),
    // Low-mid curve with real interaction and efficient bodies.
    tempo:
      1.2 * band(f.centroid, {lo: 2.7, hi: 3.3, margin: 0.8}) +
      0.9 * band(f.removalPer60, {lo: 5, hi: 9, margin: 4}) +
      0.8 * rampUp(f.lorePer60, {lo: 16, hi: 28}) +
      0.5 * rampUp(f.drawPer60, {lo: 3, hi: 8}),
    // Balanced everything — the default fallback (baseline constant).
    midrange:
      1.2 * band(f.centroid, {lo: 3.0, hi: 3.7, margin: 0.7}) +
      0.9 * band(f.removalPer60, {lo: 5, hi: 10, margin: 4}) +
      0.7 * band(f.charShare, {lo: 0.42, hi: 0.58, margin: 0.15}) +
      0.6,
    // High curve, removal-and-draw heavy, low own-lore (wins late).
    control:
      1.5 * rampUp(f.centroid, {lo: 3.4, hi: 4.4}) +
      1.4 * rampUp(f.removalPer60, {lo: 7, hi: 12}) +
      1.0 * rampUp(f.drawPer60, {lo: 6, hi: 11}) +
      0.8 * rampDown(f.lorePer60, {lo: 30, hi: 14}),
    // Draw-forward, low interaction (a conservative signal — Inkweave has no
    // generic tutor detector yet, so combo only edges out on clear draw engines).
    combo:
      1.3 * rampUp(f.drawPer60, {lo: 7, hi: 12}) +
      0.8 * rampDown(f.removalPer60, {lo: 5, hi: 11}) +
      0.4 * rampUp(f.highCostShare, {lo: 0.05, hi: 0.15}),
    // Mana acceleration into a top-heavy payoff — the ramp enabler term dominates.
    ramp:
      1.9 * rampUp(f.rampPer60, {lo: 2, hi: 6}) +
      1.0 * rampUp(f.highCostShare, {lo: 0.08, hi: 0.2}) +
      0.8 * rampUp(f.centroid, {lo: 3.3, hi: 4.4}),
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
