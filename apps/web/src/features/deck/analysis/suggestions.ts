// Live add-a-card suggestion ranking (#471, Part B "Live advisor engine").
//
// Ranks candidate cards to add to a deck by two forces:
//   1. SYNERGY with the current deck (precomputed pair scores, core cards ×2),
//      plus intrinsic direct-synergy boosts the pair data may not carry yet
//      (Merida BECKON enablers, Shift targets, on-curve Songs for a Singer).
//   2. GAP-FILLING against the deck-health analyzers that are failing
//      (removal / card-draw shortfalls, curve holes).
//
// `totalScore = synergyScore + GAP_WEIGHT × gapScore`, sorted descending.
// Pure and side-effect free; the pair-score provider is injected (the controller
// wires the real precomputed fetch later). See `docs/deck-builder/PLAN.md` Part B.

import type {BeckonEnablerTier} from 'inkweave-synergy-engine';
import {
  canShareDeck,
  getBeckonEnablerTier,
  getCardMechanics,
  getKeywordValue,
  getRemovalRoles,
  getShiftBaseNames,
  hasAnyShift,
  hasKeyword,
  isBeckonAnchor,
  isSong,
} from 'inkweave-synergy-engine';
import type {Deck, DeckHealth, DeckStatus, LorcanaCard, Suggestion} from '../types';
import type {PairScore} from './deckSynergy';

/** Core-format copy ceiling; a candidate already maxed is not a suggestion. */
const MAX_COPIES = 4;
/** `deck.cards[].isCore` cards up-weight synergy this much (PLAN Part B). */
const CORE_MULTIPLIER = 2;
/** Weight on the gap term relative to raw synergy points. */
const GAP_WEIGHT = 3;
/** Curve slots we treat as fillable "holes" when the curve analyzer is failing. */
const CURVE_SLOTS = [1, 2, 3, 4, 5, 6];

/** Intrinsic synergy bonus for a BECKON enabler when the deck runs a BECKON anchor. */
const BECKON_TIER_BONUS: Record<BeckonEnablerTier, number> = {engine: 8, reanimator: 7, self: 5};
/** Intrinsic synergy bonus for a Shift target of a Shift card in the deck. */
const SHIFT_BONUS = 6;
/** Intrinsic synergy bonus for an on-curve Song when the deck runs a Singer. */
const SINGER_BONUS = 6;

/** Gap points a failing analyzer contributes when a candidate addresses it. */
function statusPoints(status: DeckStatus): number {
  if (status === 'bad') return 2;
  if (status === 'warn') return 1;
  return 0;
}

/** One resolved deck card plus its core flag. */
interface ResolvedDeckCard {
  card: LorcanaCard;
  isCore: boolean;
}

/** A Shift card in the deck and the base names it can land on. */
interface ShiftEntry {
  id: string;
  targets: Set<string>;
}

/** A Singer in the deck and its Singer value (cost ceiling it can sing for free). */
interface SingerEntry {
  id: string;
  value: number;
}

/** Deck-level facts precomputed once, then reused across every candidate. */
interface DeckContext {
  getPairScore: PairScore;
  deckCards: ResolvedDeckCard[];
  quantityById: Map<string, number>;
  beckonAnchorIds: string[];
  shiftEntries: ShiftEntry[];
  singerEntries: SingerEntry[];
  curveHoles: Set<number>;
  failing: DeckHealth['analyzers'];
}

/** Resolve the deck once into the reusable `DeckContext`. */
function buildContext(
  deck: Deck,
  getPairScore: PairScore,
  health: DeckHealth,
  getCardById: (id: string) => LorcanaCard | undefined,
): DeckContext {
  const deckCards: ResolvedDeckCard[] = [];
  const quantityById = new Map<string, number>();
  const costHistogram: Record<number, number> = {};

  for (const entry of deck.cards) {
    quantityById.set(entry.cardId, (quantityById.get(entry.cardId) ?? 0) + entry.quantity);
    const card = getCardById(entry.cardId);
    if (!card) continue;
    deckCards.push({card, isCore: entry.isCore === true});
    const bucket = Math.min(card.cost, CURVE_SLOTS.length + 1);
    costHistogram[bucket] = (costHistogram[bucket] ?? 0) + entry.quantity;
  }

  return {
    getPairScore,
    deckCards,
    quantityById,
    beckonAnchorIds: deckCards.filter((d) => isBeckonAnchor(d.card)).map((d) => d.card.id),
    shiftEntries: collectShiftEntries(deckCards),
    singerEntries: collectSingerEntries(deckCards),
    curveHoles: new Set(CURVE_SLOTS.filter((slot) => (costHistogram[slot] ?? 0) === 0)),
    failing: health.analyzers.filter((a) => a.status === 'bad' || a.status === 'warn'),
  };
}

function collectShiftEntries(deckCards: ResolvedDeckCard[]): ShiftEntry[] {
  return deckCards
    .filter((d) => hasAnyShift(d.card))
    .map((d) => ({id: d.card.id, targets: new Set(getShiftBaseNames(d.card))}));
}

function collectSingerEntries(deckCards: ResolvedDeckCard[]): SingerEntry[] {
  const entries: SingerEntry[] = [];
  for (const d of deckCards) {
    if (!hasKeyword(d.card, 'Singer')) continue;
    const value = getKeywordValue(d.card, 'Singer');
    if (value != null) entries.push({id: d.card.id, value});
  }
  return entries;
}

/** Accumulator threaded through the boost/synergy/gap passes for one candidate. */
interface Scratch {
  synergyScore: number;
  gapScore: number;
  synergizesWith: Set<string>;
  reasons: string[];
}

/** Sum the deck-synergy pair scores (core cards ×2), recording the partners. */
function addDeckSynergy(candidate: LorcanaCard, ctx: DeckContext, s: Scratch): void {
  for (const d of ctx.deckCards) {
    if (d.card.id === candidate.id) continue;
    const pair = ctx.getPairScore(candidate.id, d.card.id);
    if (pair <= 0) continue;
    s.synergyScore += pair * (d.isCore ? CORE_MULTIPLIER : 1);
    s.synergizesWith.add(d.card.id);
  }
}

/** Merida BECKON: an anchor in the deck draws off any enter-play-exerted enabler. */
function addBeckonBoost(candidate: LorcanaCard, ctx: DeckContext, s: Scratch): void {
  if (ctx.beckonAnchorIds.length === 0) return;
  const tier = getBeckonEnablerTier(candidate);
  if (tier == null) return;
  s.synergyScore += BECKON_TIER_BONUS[tier];
  for (const id of ctx.beckonAnchorIds) s.synergizesWith.add(id);
  s.reasons.push('BECKON enabler for Merida');
}

/** Shift: a Shift card in the deck wants same-named base characters. */
function addShiftBoost(candidate: LorcanaCard, ctx: DeckContext, s: Scratch): void {
  const names = getShiftBaseNames(candidate);
  const matched = ctx.shiftEntries.filter((e) => names.some((n) => e.targets.has(n)));
  if (matched.length === 0) return;
  s.synergyScore += SHIFT_BONUS;
  for (const e of matched) s.synergizesWith.add(e.id);
  s.reasons.push('Shift target for a card in the deck');
}

/** Singer: a Singer sings an on-curve Song (cost <= Singer value) for free. */
function addSingerBoost(candidate: LorcanaCard, ctx: DeckContext, s: Scratch): void {
  if (!isSong(candidate)) return;
  const singable = ctx.singerEntries.filter((e) => candidate.cost <= e.value);
  if (singable.length === 0) return;
  s.synergyScore += SINGER_BONUS;
  for (const e of singable) s.synergizesWith.add(e.id);
  s.reasons.push('On-curve Song for a Singer');
}

/** Score how much a candidate fixes each FAILING analyzer, prepending the reasons. */
function addGapFilling(candidate: LorcanaCard, ctx: DeckContext, s: Scratch): void {
  for (const analyzer of ctx.failing) {
    const points = statusPoints(analyzer.status);
    if (analyzer.id === 'removal' && getRemovalRoles(candidate).length > 0) {
      s.gapScore += points;
      s.reasons.push('Fills removal gap');
    } else if (analyzer.id === 'draw' && getCardMechanics(candidate).includes('draw')) {
      s.gapScore += points;
      s.reasons.push('Fills card-draw gap');
    } else if (analyzer.id === 'curve' && ctx.curveHoles.has(candidate.cost)) {
      s.gapScore += points;
      s.reasons.push(`Fills curve hole at cost ${candidate.cost}`);
    }
  }
}

/** A candidate is out if it's maxed or can't legally share the deck's inks. */
function isEligible(candidate: LorcanaCard, ctx: DeckContext): boolean {
  if ((ctx.quantityById.get(candidate.id) ?? 0) >= MAX_COPIES) return false;
  return ctx.deckCards.every((d) => canShareDeck(candidate, d.card));
}

/** Score one eligible candidate, or null when it earns no points. */
function scoreCandidate(candidate: LorcanaCard, ctx: DeckContext): Suggestion | null {
  if (!isEligible(candidate, ctx)) return null;

  const s: Scratch = {synergyScore: 0, gapScore: 0, synergizesWith: new Set(), reasons: []};
  addGapFilling(candidate, ctx, s);
  addDeckSynergy(candidate, ctx, s);
  addBeckonBoost(candidate, ctx, s);
  addShiftBoost(candidate, ctx, s);
  addSingerBoost(candidate, ctx, s);

  const totalScore = s.synergyScore + GAP_WEIGHT * s.gapScore;
  if (totalScore <= 0) return null;

  if (s.reasons.length === 0 && s.synergizesWith.size > 0) {
    const n = s.synergizesWith.size;
    s.reasons.push(`Synergizes with ${n} deck card${n === 1 ? '' : 's'}`);
  }

  return {
    cardId: candidate.id,
    synergyScore: s.synergyScore,
    gapScore: s.gapScore,
    totalScore,
    synergizesWith: [...s.synergizesWith],
    reasons: s.reasons,
  };
}

/** Inputs for {@link rankSuggestions}, bundled so the call reads by name. */
export interface RankSuggestionsInput {
  deck: Deck;
  /** Candidate card ids to rank; assumed pre-filtered to the deck's inks. */
  candidateIds: string[];
  /** Precomputed pair-score provider (the controller wires the real fetch). */
  getPairScore: PairScore;
  health: DeckHealth;
  getCardById: (id: string) => LorcanaCard | undefined;
}

/**
 * Rank `candidateIds` as add-this-card suggestions for `deck`.
 *
 * Candidates are assumed pre-filtered to the deck's inks, but each is still
 * `canShareDeck`-guarded against every deck card and dropped if already at 4
 * copies. Each survivor earns `synergyScore` (Σ deck pair scores, core cards ×2,
 * plus BECKON/Shift/Singer intrinsic boosts) and `gapScore` (points per failing
 * analyzer it addresses). `totalScore = synergyScore + GAP_WEIGHT × gapScore`;
 * candidates that earn nothing are dropped. Sorted by `totalScore` descending,
 * ties broken by card id for a stable order.
 *
 * Pure and deterministic given the same inputs (incl. `getPairScore`).
 */
export function rankSuggestions({
  deck,
  candidateIds,
  getPairScore,
  health,
  getCardById,
}: RankSuggestionsInput): Suggestion[] {
  const ctx = buildContext(deck, getPairScore, health, getCardById);

  return [...new Set(candidateIds)]
    .map((id) => getCardById(id))
    .filter((card): card is LorcanaCard => card != null)
    .map((card) => scoreCandidate(card, ctx))
    .filter((sug): sug is Suggestion => sug != null)
    .sort((a, b) => b.totalScore - a.totalScore || a.cardId.localeCompare(b.cardId));
}
