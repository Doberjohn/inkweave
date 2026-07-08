// Archetype-parameterized health analyzers (#469) — Tier 2 of the deck-health
// framework. Each analyzer scores one compositional dimension against the target
// profile for the deck's archetype, returning a normalized 0..100 `score`, a
// traffic-light `status`, and a human `message` that names the gap.
//
// The classifier (`archetype.ts`) runs first; its result (or a user-declared
// `deck.gameplan`, resolved by the caller) is passed in as `archetype`. Every
// per-dimension target lives in the `TARGETS` table below, derived from
// `docs/deck-builder/PLAN.md` Part A (midrange baseline + aggro/control/ramp
// variance). Universal dimensions (rule-of-eight, consistency, shift-coverage)
// use archetype-invariant constants.
//
// NOTE: there is deliberately NO `synergyDensity` analyzer here. That dimension
// is produced later by the `deckSynergy` module from the precomputed pairwise
// JSON and merged into the analyzer list by the controller. `scoring.json`
// reserves its weight (0.14); `score.ts` renormalizes over whatever weights are
// actually present, so omitting it now is safe.
//
// Analyzer ids match the `scoring.json` weight keys (curve, inkable, draw,
// removal, actionsCap, typeMix, ruleOfEight, consistency, lore, shiftCoverage)
// so the composite scorer can weight them — NOT the dashed shorthand.

import type {Archetype, Deck, DeckStats, DeckStatus, HealthAnalyzer, LorcanaCard} from '../types';
import {
  getBaseName,
  getCardMechanics,
  getRampRoles,
  getRemovalRoles,
  getShiftBaseNames,
  getShiftType,
  hasAnyShift,
  isCharacter,
  isDeckRamp,
  isItem,
  isSong,
} from 'inkweave-synergy-engine';

// ---------------------------------------------------------------------------
// Target profiles (PLAN Part A — Tier 2)
// ---------------------------------------------------------------------------

/** Per-archetype target ranges for the archetype-varying dimensions. */
interface ArchetypeProfile {
  /** Curve center-of-mass (avg cost) ideal band. */
  curve: {min: number; max: number};
  /** Inkable share of the deck (0..1): floor is the failure threshold, ideal earns full marks. */
  inkableFloor: number;
  inkableIdeal: number;
  /** Card-draw soft target (counts scaled to 60): `floor` = official pillar, `ideal` = comfortable. */
  draw: {floor: number; ideal: number};
  /** Removal soft target (counts scaled to 60): floor + ideal band. */
  removal: {floor: number; idealMin: number; idealMax: number};
  /** Actions+Songs share cap (0..1 of the deck). */
  actionShareCap: number;
  /** Character count ideal band (scaled to 60). */
  characters: {min: number; max: number};
  /** Board-lore floor (Σ lore×qty scaled to 60) needed to race with this plan. */
  loreFloor: number;
}

/**
 * Archetype target table. Midrange is the sourced baseline (PLAN Part A Tier-2:
 * inkable 44-48/60, curve peak 2-3 / center ~3.0-3.6, draw ≥4 floor 6-10 soft,
 * removal ≥4 floor ~6-10 soft, actions ≤~25%, 22-26 characters); aggro / control
 * / ramp shift the dials per the "Variance" column (aggro tolerates 18-20
 * uninkable + lower curve + light removal + more chars + high lore; control runs
 * a higher/flatter curve + 8-12 removal + high draw + 18-20 chars + low own-lore;
 * ramp wants a high inkable base and a top-heavy payoff — its curve is validated,
 * not penalized, below). Tempo/combo interpolate between those poles.
 */
const TARGETS: Record<Archetype, ArchetypeProfile> = {
  aggro: {
    curve: {min: 2.2, max: 3.0},
    inkableFloor: 0.63,
    inkableIdeal: 0.7,
    draw: {floor: 4, ideal: 5},
    removal: {floor: 2, idealMin: 3, idealMax: 6},
    actionShareCap: 0.22,
    characters: {min: 24, max: 28},
    loreFloor: 26,
  },
  tempo: {
    curve: {min: 2.6, max: 3.3},
    inkableFloor: 0.7,
    inkableIdeal: 0.78,
    draw: {floor: 4, ideal: 6},
    removal: {floor: 4, idealMin: 5, idealMax: 9},
    actionShareCap: 0.25,
    characters: {min: 22, max: 26},
    loreFloor: 22,
  },
  midrange: {
    curve: {min: 3.0, max: 3.6},
    inkableFloor: 0.72,
    inkableIdeal: 0.78,
    draw: {floor: 4, ideal: 6},
    removal: {floor: 4, idealMin: 6, idealMax: 10},
    actionShareCap: 0.25,
    characters: {min: 22, max: 26},
    loreFloor: 18,
  },
  control: {
    curve: {min: 3.4, max: 4.4},
    inkableFloor: 0.75,
    inkableIdeal: 0.8,
    draw: {floor: 6, ideal: 8},
    removal: {floor: 6, idealMin: 8, idealMax: 12},
    actionShareCap: 0.28,
    characters: {min: 18, max: 22},
    loreFloor: 12,
  },
  combo: {
    curve: {min: 2.8, max: 3.8},
    inkableFloor: 0.72,
    inkableIdeal: 0.78,
    draw: {floor: 6, ideal: 9},
    removal: {floor: 2, idealMin: 3, idealMax: 8},
    actionShareCap: 0.3,
    characters: {min: 16, max: 24},
    loreFloor: 14,
  },
  ramp: {
    curve: {min: 3.6, max: 4.8},
    inkableFloor: 0.75,
    inkableIdeal: 0.82,
    draw: {floor: 4, ideal: 6},
    removal: {floor: 4, idealMin: 5, idealMax: 9},
    actionShareCap: 0.25,
    characters: {min: 20, max: 26},
    loreFloor: 16,
  },
};

/** Rule of Eight is universal: aim for ~8 interchangeable copies of the core plan. */
const RULE_OF_EIGHT = {floor: 6, ideal: 8};

/** Ramp curve-jump target (counts scaled to 60): enough ramp sources into enough big payoff bodies. */
const RAMP_CURVE_JUMP = {rampFloor: 4, payoffFloor: 6};

// ---------------------------------------------------------------------------
// Deck metrics (one resolve pass, then focused reducers)
// ---------------------------------------------------------------------------

/** A resolved deck line: the card plus how many copies. */
interface ResolvedEntry {
  card: LorcanaCard;
  quantity: number;
}

/** Everything the analyzers measure off a deck, computed once. */
interface DeckMetrics {
  /** Resolved copy count (unresolved / rotated ids are excluded). */
  total: number;
  /** Full deck size incl. unresolved ids (from `DeckStats`), for size-adherence. */
  deckSize: number;
  centroid: number;
  drawCount: number;
  removalCount: number;
  totalLore: number;
  charCount: number;
  actionCount: number;
  songCount: number;
  itemLocCount: number;
  inkableCount: number;
  /** Characters costing 5+ (the ramp payoff bodies). */
  highCostBodies: number;
  /** Inkwell-ramp / deck-ramp enablers. */
  rampEnablers: number;
  /** Deepest interchangeable package (max copies sharing a classification / keyword / role). */
  largestPackage: number;
  uniqueLines: number;
  singletonLines: number;
  shiftTotal: number;
  shiftUncovered: number;
  /** Distinct card ids in the deck (from `DeckStats`), surfaced as the consistency value. */
  uniqueCards: number;
}

/** Resolve every deck line to its card, dropping ids that no longer resolve. */
function resolveEntries(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
): ResolvedEntry[] {
  const entries: ResolvedEntry[] = [];
  for (const {cardId, quantity} of deck.cards) {
    const card = getCardById(cardId);
    if (card) entries.push({card, quantity});
  }
  return entries;
}

/** Sum copies of entries whose card matches `pred`. */
function sumWhere(entries: ResolvedEntry[], pred: (card: LorcanaCard) => boolean): number {
  return entries.reduce((sum, e) => (pred(e.card) ? sum + e.quantity : sum), 0);
}

/** A card is an inkwell-ramp accelerant if it grows YOUR inkwell (role or deck-ramp shape). */
function isRampEnabler(card: LorcanaCard): boolean {
  return getRampRoles(card).includes('inkwell-ramp') || isDeckRamp(card);
}

/** Normalize a keyword to its base ("Shift 4" -> "shift") so numbered variants group together. */
function keywordBase(keyword: string): string {
  return keyword.replace(/\s*\d+\s*$/, '').trim().toLowerCase();
}

/**
 * Deepest "interchangeable package": the largest number of copies that share a
 * classification, a keyword, or a functional role (removal / draw). A proxy for
 * the Rule-of-Eight core plan being redundant enough to draw reliably.
 */
function largestInterchangeable(entries: ResolvedEntry[]): number {
  const groups = new Map<string, number>();
  const bump = (key: string, qty: number) => groups.set(key, (groups.get(key) ?? 0) + qty);

  for (const {card, quantity} of entries) {
    for (const cls of card.classifications ?? []) bump(`class:${cls.toLowerCase()}`, quantity);
    for (const kw of card.keywords ?? []) bump(`kw:${keywordBase(kw)}`, quantity);
    if (getRemovalRoles(card).length > 0) bump('role:removal', quantity);
    if (getCardMechanics(card).includes('draw')) bump('role:draw', quantity);
  }

  let max = 0;
  for (const count of groups.values()) if (count > max) max = count;
  return max;
}

/** Whether a Shift card has a valid target already present in the deck. */
function isShiftCovered(shift: LorcanaCard, others: LorcanaCard[]): boolean {
  const type = getShiftType(shift);
  if (!type) return false;
  switch (type.kind) {
    case 'standard': {
      const targets = new Set(getShiftBaseNames(shift).map((n) => n.toLowerCase()));
      // A real base body (not another Shift card) sharing one of the target names.
      return others.some((c) => !hasAnyShift(c) && targets.has(getBaseName(c).toLowerCase()));
    }
    case 'classification': {
      const wanted = type.classification.toLowerCase();
      return others.some((c) => (c.classifications ?? []).some((cl) => cl.toLowerCase() === wanted));
    }
    case 'named-item': {
      const wanted = type.itemName.toLowerCase();
      return others.some((c) => isItem(c) && getBaseName(c).toLowerCase() === wanted);
    }
    case 'universal':
      return others.some((c) => isCharacter(c));
  }
}

/** Count Shift cards and how many lack a same-named base target in the deck. */
function countShiftGaps(entries: ResolvedEntry[]): {total: number; uncovered: number} {
  const shifts = entries.filter((e) => hasAnyShift(e.card));
  let uncovered = 0;
  for (const {card} of shifts) {
    const others = entries.filter((e) => e.card.id !== card.id).map((e) => e.card);
    if (!isShiftCovered(card, others)) uncovered += 1;
  }
  return {total: shifts.length, uncovered};
}

/** Measure everything the analyzers need in one resolve pass plus focused reducers. */
function computeMetrics(
  deck: Deck,
  stats: DeckStats,
  getCardById: (id: string) => LorcanaCard | undefined,
): DeckMetrics {
  const entries = resolveEntries(deck, getCardById);
  const total = sumWhere(entries, () => true);
  const characters = entries.filter((e) => isCharacter(e.card));
  const shift = countShiftGaps(entries);

  return {
    total,
    deckSize: stats.totalCards,
    centroid: total > 0 ? entries.reduce((s, e) => s + e.card.cost * e.quantity, 0) / total : 0,
    drawCount: sumWhere(entries, (c) => getCardMechanics(c).includes('draw')),
    removalCount: sumWhere(entries, (c) => getRemovalRoles(c).length > 0),
    totalLore: characters.reduce((s, e) => s + (e.card.lore ?? 0) * e.quantity, 0),
    charCount: characters.reduce((s, e) => s + e.quantity, 0),
    actionCount: sumWhere(entries, (c) => c.type === 'Action'),
    songCount: sumWhere(entries, isSong),
    itemLocCount: sumWhere(entries, (c) => c.type === 'Item' || c.type === 'Location'),
    inkableCount: sumWhere(entries, (c) => Boolean(c.inkwell)),
    highCostBodies: sumWhere(entries, (c) => isCharacter(c) && c.cost >= 5),
    rampEnablers: sumWhere(entries, isRampEnabler),
    largestPackage: largestInterchangeable(entries),
    uniqueLines: entries.length,
    singletonLines: entries.filter((e) => e.quantity === 1).length,
    shiftTotal: shift.total,
    shiftUncovered: shift.uncovered,
    uniqueCards: stats.uniqueCards,
  };
}

// ---------------------------------------------------------------------------
// Scoring primitives
// ---------------------------------------------------------------------------

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Scale a raw count to its 60-card-deck equivalent. */
function per60(count: number, total: number): number {
  return total > 0 ? (count / total) * 60 : 0;
}

/** DeckStatus from a 0..100 score: good ≥75, warn ≥45, else bad. */
function statusFromScore(score: number): DeckStatus {
  if (score >= 75) return 'good';
  if (score >= 45) return 'warn';
  return 'bad';
}

/**
 * "Meet the floor, reward the ideal" curve: 100 at/above `ideal`, 55 at `floor`
 * (the just-acceptable line), linearly interpolated between, and dropping toward
 * 0 as the value falls below the floor.
 */
function floorIdeal(value: number, floor: number, ideal: number): number {
  if (ideal <= floor) return value >= ideal ? 100 : 0;
  if (value >= ideal) return 100;
  if (value >= floor) return 55 + (45 * (value - floor)) / (ideal - floor);
  return floor > 0 ? (55 * value) / floor : 0;
}

/** 100 inside `[min, max]`, linear falloff to 0 over `margin` beyond either edge. */
function bandScore(value: number, min: number, max: number, margin: number): number {
  if (value >= min && value <= max) return 100;
  const d = value < min ? min - value : value - max;
  return clamp(100 - (100 * d) / margin, 0, 100);
}

/** 100 at/below `cap`, linear falloff to 0 over `margin` above it. */
function capScore(value: number, cap: number, margin: number): number {
  if (value <= cap) return 100;
  return clamp(100 - (100 * (value - cap)) / margin, 0, 100);
}

/** Removal band scoring: reward the ideal window, still credit the floor, mildly dock overload. */
function removalScore(per: number, r: ArchetypeProfile['removal']): number {
  if (per >= r.idealMin && per <= r.idealMax) return 100;
  if (per > r.idealMax) return clamp(100 - 8 * (per - r.idealMax), 70, 100);
  if (per >= r.floor) return 55 + (45 * (per - r.floor)) / (r.idealMin - r.floor);
  return r.floor > 0 ? (55 * per) / r.floor : 0;
}

/** Size-adherence penalty for consistency: competitive decks run exactly 60. */
function sizeAdherencePenalty(deckSize: number): number {
  if (deckSize === 60) return 0;
  if (deckSize < 60) return Math.min(25, (60 - deckSize) * 1.5);
  return Math.min(25, (deckSize - 60) * 3);
}

/** Assemble a HealthAnalyzer, clamping + rounding the score and deriving its status. */
function mk(id: string, label: string, rawScore: number, message: string, value: number): HealthAnalyzer {
  const score = Math.round(clamp(rawScore, 0, 100));
  return {id, label, score, status: statusFromScore(score), message, value};
}

// ---------------------------------------------------------------------------
// Per-dimension analyzers
// ---------------------------------------------------------------------------

/**
 * Ramp special case: the curve analyzer STOPS penalizing a top-heavy gap and
 * instead validates the curve-jump payoff — enough ramp sources feeding enough
 * high-cost bodies to actually cash the acceleration in.
 */
function analyzeRampCurve(m: DeckMetrics): HealthAnalyzer {
  const rampCov = clamp(per60(m.rampEnablers, m.total) / RAMP_CURVE_JUMP.rampFloor, 0, 1);
  const payoffCov = clamp(per60(m.highCostBodies, m.total) / RAMP_CURVE_JUMP.payoffFloor, 0, 1);
  const score = 100 * Math.min(rampCov, payoffCov);
  const message =
    score >= 75
      ? `Ramp plan holds up: ${m.rampEnablers} ramp source(s) into ${m.highCostBodies} high-cost payoff bodies.`
      : `Curve-jump incomplete: ${m.rampEnablers} ramp source(s) and ${m.highCostBodies} big bodies, want more of each to justify the gap.`;
  return mk('curve', 'Curve', score, message, m.highCostBodies);
}

function analyzeCurve(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  if (archetype === 'ramp') return analyzeRampCurve(m);
  const score = bandScore(m.centroid, t.curve.min, t.curve.max, 1.2);
  const centroid = Math.round(m.centroid * 10) / 10;
  const message =
    score >= 75
      ? `Curve centers at ${centroid} avg cost, on plan for ${archetype}.`
      : `Curve centers at ${centroid} avg cost; ${archetype} wants ${t.curve.min} to ${t.curve.max}.`;
  return mk('curve', 'Curve', score, message, centroid);
}

function analyzeInkable(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const ratio = m.total > 0 ? m.inkableCount / m.total : 0;
  const score =
    ratio > 0.94 ? capScore(ratio, 0.94, 0.2) : floorIdeal(ratio, t.inkableFloor, t.inkableIdeal);
  const pct = Math.round(ratio * 100);
  const message =
    score >= 75
      ? `${m.inkableCount} inkable (${pct}% of deck), a reliable inkwell.`
      : `${m.inkableCount} inkable (${pct}%); ${archetype} wants about ${Math.round(t.inkableFloor * 100)}%+.`;
  return mk('inkable', 'Inkable Ratio', score, message, m.inkableCount);
}

function analyzeDraw(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const score = floorIdeal(per60(m.drawCount, m.total), t.draw.floor, t.draw.ideal);
  const message =
    score >= 75
      ? `${m.drawCount} card-draw source(s), enough to refuel a ${archetype} plan.`
      : `Only ${m.drawCount} cards draw, aim for ${t.draw.ideal}+.`;
  return mk('draw', 'Card Draw', score, message, m.drawCount);
}

function analyzeRemoval(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const per = per60(m.removalCount, m.total);
  const score = removalScore(per, t.removal);
  let message: string;
  if (score >= 75) {
    message = `${m.removalCount} removal card(s), interaction on plan for ${archetype}.`;
  } else if (per > t.removal.idealMax) {
    message = `${m.removalCount} removal card(s), heavy for ${archetype} (target ${t.removal.idealMin} to ${t.removal.idealMax}).`;
  } else {
    message = `Only ${m.removalCount} removal card(s), ${archetype} wants ${t.removal.idealMin} to ${t.removal.idealMax}.`;
  }
  return mk('removal', 'Removal', score, message, m.removalCount);
}

function analyzeActions(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const share = m.total > 0 ? m.actionCount / m.total : 0;
  const score = capScore(share, t.actionShareCap, 0.2);
  const pct = Math.round(share * 100);
  const songs = m.songCount > 0 ? ` incl. ${m.songCount} song(s)` : '';
  const message =
    score >= 75
      ? `${m.actionCount} actions/songs (${pct}% of deck)${songs}, within the ${archetype} budget.`
      : `${m.actionCount} actions/songs (${pct}%)${songs}, over the ~${Math.round(t.actionShareCap * 100)}% cap.`;
  return mk('actionsCap', 'Actions & Songs', score, message, m.actionCount);
}

function analyzeTypeMix(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const score = bandScore(per60(m.charCount, m.total), t.characters.min, t.characters.max, 8);
  const message =
    score >= 75
      ? `${m.charCount} characters plus ${m.actionCount} actions and ${m.itemLocCount} items/locations, a healthy mix.`
      : `${m.charCount} characters; ${archetype} wants ${t.characters.min} to ${t.characters.max} (${m.actionCount} actions, ${m.itemLocCount} items/locations).`;
  return mk('typeMix', 'Card Types', score, message, m.charCount);
}

function analyzeRuleOfEight(m: DeckMetrics): HealthAnalyzer {
  const score = floorIdeal(m.largestPackage, RULE_OF_EIGHT.floor, RULE_OF_EIGHT.ideal);
  const message =
    score >= 75
      ? `Deepest interchangeable package is ${m.largestPackage} cards, redundant enough to draw reliably.`
      : `Deepest interchangeable package is only ${m.largestPackage} cards, aim for 8+ so you draw your plan.`;
  return mk('ruleOfEight', 'Rule of Eight', score, message, m.largestPackage);
}

function analyzeConsistency(m: DeckMetrics): HealthAnalyzer {
  const singletonShare = m.uniqueLines > 0 ? m.singletonLines / m.uniqueLines : 0;
  const score = clamp(100 - 55 * singletonShare - sizeAdherencePenalty(m.deckSize), 0, 100);
  const message =
    score >= 75
      ? `${m.uniqueLines} distinct cards with few singletons, draws stay consistent.`
      : `${m.singletonLines} singleton(s) across ${m.uniqueLines} lines, favor 4-ofs for consistency.`;
  return mk('consistency', 'Consistency', score, message, m.uniqueCards);
}

function analyzeLore(m: DeckMetrics, archetype: Archetype, t: ArchetypeProfile): HealthAnalyzer {
  const score = floorIdeal(per60(m.totalLore, m.total), t.loreFloor, t.loreFloor + 12);
  const message =
    score >= 75
      ? `${m.totalLore} board lore, enough to race as ${archetype}.`
      : `${m.totalLore} board lore, low for ${archetype} (want about ${t.loreFloor}+ scaled to 60).`;
  return mk('lore', 'Lore Output', score, message, m.totalLore);
}

function analyzeShiftCoverage(m: DeckMetrics): HealthAnalyzer {
  if (m.shiftTotal === 0) {
    return mk('shiftCoverage', 'Shift Coverage', 100, 'No Shift cards, nothing to cover.', 0);
  }
  const covered = m.shiftTotal - m.shiftUncovered;
  const score = (100 * covered) / m.shiftTotal;
  const message =
    m.shiftUncovered === 0
      ? `All ${m.shiftTotal} Shift card(s) have a same-named base in the deck.`
      : `${m.shiftUncovered} of ${m.shiftTotal} Shift card(s) have no base target, add their base version.`;
  return mk('shiftCoverage', 'Shift Coverage', score, message, m.shiftUncovered);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build one archetype-parameterized `HealthAnalyzer` per compositional dimension.
 *
 * `archetype` selects the target profile from `TARGETS` (the caller passes either
 * the auto-detected archetype from `classifyArchetype` or the user's declared
 * `deck.gameplan`). Ramp special-cases the `curve` analyzer to validate the
 * curve-jump payoff instead of penalizing the gap. Pure and deterministic.
 *
 * The `synergyDensity` dimension is intentionally not built here (see file header).
 */
export function buildHealthAnalyzers(
  deck: Deck,
  stats: DeckStats,
  getCardById: (id: string) => LorcanaCard | undefined,
  archetype: Archetype,
): HealthAnalyzer[] {
  const m = computeMetrics(deck, stats, getCardById);
  const t = TARGETS[archetype];
  return [
    analyzeCurve(m, archetype, t),
    analyzeInkable(m, archetype, t),
    analyzeDraw(m, archetype, t),
    analyzeRemoval(m, archetype, t),
    analyzeActions(m, archetype, t),
    analyzeTypeMix(m, archetype, t),
    analyzeRuleOfEight(m),
    analyzeConsistency(m),
    analyzeLore(m, archetype, t),
    analyzeShiftCoverage(m),
  ];
}
