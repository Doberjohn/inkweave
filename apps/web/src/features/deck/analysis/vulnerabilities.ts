// "What to watch for" (#470) — the Tier-3 vulnerabilities analyzer.
//
// Pool-derived, meta-free. Given the auto-derived hoser catalog (produced by
// #461 into `public/data/hosers.json`), this measures how EXPOSED a deck is to
// each removal CONDITION the current Core pool can punish, and surfaces only the
// sharp ones. No hardcoded card names in the logic (survives rotation): the
// example cards named in each message come straight from the passed catalog.
//
// See `docs/deck-builder/PLAN.md` Part A Tier 3.

import type {Deck, Ink, LorcanaCard, Vulnerability, VulnerabilitySeverity} from '../types';
import {getInks, hasKeyword, isCharacter} from 'inkweave-synergy-engine';

/**
 * One entry of the pool-derived hoser catalog (`public/data/hosers.json`).
 * `condition.type` is one of the six Core removal conditions; `threshold` is
 * present for the stat-gated ones (`low-strength <=N`, `high-cost >=N`).
 */
export interface HoserEntry {
  cardId: string;
  name: string;
  ink: string;
  condition: {type: string; threshold?: number};
  scope: 'mass' | 'conditional';
  text: string;
}

// ---------------------------------------------------------------------------
// Exposure / severity cutoffs (documented, tunable)
// ---------------------------------------------------------------------------
//
// `exposurePct` is a 0..100 share. Two families of metric feed it:
//   - stat / keyword conditions (low-strength, high-cost, evasive, bodyguard):
//     share = matching character copies / total character copies. "How much of
//     my board can this removal actually hit."
//   - board-reliance conditions (mass, damaged): share = character copies /
//     total (resolved) deck copies. A go-wide, character-dense deck is more
//     exposed to a sweeper than a spell-heavy control deck.
//
// Severity ladder (applied to the rounded share):
//   >= 60  -> high    (the majority of your board folds to it)
//   >= 35  -> medium
//   >= 25  -> low     (materiality floor; below this the deck isn't meaningfully exposed)
//   <  25  -> dropped (not emitted)
//
// `damaged` is capped at `low` no matter the share: your board being damaged is
// dynamic (the opponent has to chip you first, healing/high willpower mitigate),
// so it's informational, not a structural weakness like a low-strength curve.
const MATERIAL_EXPOSURE = 25;
const MEDIUM_EXPOSURE = 35;
const HIGH_EXPOSURE = 60;

/** Max example catalog cards attached to each vulnerability. */
const MAX_EXAMPLES = 3;

/** The six pool removal conditions, in a stable canonical order. */
const TYPE_ORDER = [
  'low-strength',
  'high-cost',
  'evasive',
  'bodyguard',
  'mass',
  'damaged',
] as const;
type ConditionType = (typeof TYPE_ORDER)[number];

const KNOWN_TYPES = new Set<string>(TYPE_ORDER);

/** Display label per condition type. */
const LABELS: Record<ConditionType, string> = {
  'low-strength': 'Low-strength board',
  'high-cost': 'High-cost board',
  evasive: 'Evasive-heavy board',
  bodyguard: 'Bodyguard-reliant board',
  mass: 'Go-wide board',
  damaged: 'Damage-vulnerable board',
};

/** Severity ordering for output sorting (sharpest first). */
const SEVERITY_RANK: Record<VulnerabilitySeverity, number> = {high: 3, medium: 2, low: 1};

// ---------------------------------------------------------------------------
// Deck context
// ---------------------------------------------------------------------------

/** The deck reduced to what the exposure math needs: characters (with copies) + inks. */
interface DeckContext {
  characterEntries: Array<{card: LorcanaCard; quantity: number}>;
  /** Total character COPIES (quantity-weighted). Denominator for stat/keyword shares. */
  characterCopies: number;
  /** Total resolved COPIES of any type. Denominator for board-reliance shares. */
  totalResolvedCopies: number;
  /** Inks the deck actually plays (dual-ink cards contribute both). */
  deckInks: Set<Ink>;
}

function buildDeckContext(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
): DeckContext {
  const characterEntries: Array<{card: LorcanaCard; quantity: number}> = [];
  const deckInks = new Set<Ink>();
  let characterCopies = 0;
  let totalResolvedCopies = 0;

  for (const {cardId, quantity} of deck.cards) {
    const card = getCardById(cardId);
    if (!card) continue; // unresolved (rotated out of Core) — nothing to measure

    totalResolvedCopies += quantity;
    for (const ink of getInks(card)) deckInks.add(ink);

    if (isCharacter(card)) {
      characterEntries.push({card, quantity});
      characterCopies += quantity;
    }
  }

  return {characterEntries, characterCopies, totalResolvedCopies, deckInks};
}

// ---------------------------------------------------------------------------
// Exposure math
// ---------------------------------------------------------------------------

/** Quantity-weighted share (0..100) of the deck's characters matching `predicate`. */
function matchShare(ctx: DeckContext, predicate: (c: LorcanaCard) => boolean): number {
  const matched = ctx.characterEntries.reduce(
    (sum, e) => sum + (predicate(e.card) ? e.quantity : 0),
    0,
  );
  return (matched / ctx.characterCopies) * 100; // characterCopies > 0 is guaranteed by the caller
}

/** Share (0..100) of the whole deck that is characters — the "board reliance" of the deck. */
function boardReliance(ctx: DeckContext): number {
  return ctx.totalResolvedCopies > 0 ? (ctx.characterCopies / ctx.totalResolvedCopies) * 100 : 0;
}

/** Raw exposure share (0..100) of the deck to one removal condition. */
function computeExposure(type: ConditionType, threshold: number | undefined, ctx: DeckContext): number {
  switch (type) {
    case 'low-strength':
      return matchShare(ctx, (c) => c.strength != null && c.strength <= (threshold ?? 0));
    case 'high-cost':
      return matchShare(ctx, (c) => c.cost >= (threshold ?? Infinity));
    case 'evasive':
      return matchShare(ctx, (c) => hasKeyword(c, 'Evasive'));
    case 'bodyguard':
      return matchShare(ctx, (c) => hasKeyword(c, 'Bodyguard'));
    case 'mass':
    case 'damaged':
      return boardReliance(ctx);
  }
}

/** Map a rounded exposure share to a severity, or null when the deck isn't materially exposed. */
function severityFor(type: ConditionType, exposurePct: number): VulnerabilitySeverity | null {
  if (exposurePct < MATERIAL_EXPOSURE) return null;
  if (type === 'damaged') return 'low'; // informational: damage is dynamic, never a structural high
  if (exposurePct >= HIGH_EXPOSURE) return 'high';
  if (exposurePct >= MEDIUM_EXPOSURE) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

/** Group catalog entries by their (known) condition type, preserving catalog order. */
function groupByType(hosers: HoserEntry[]): Map<ConditionType, HoserEntry[]> {
  const byType = new Map<ConditionType, HoserEntry[]>();
  for (const entry of hosers) {
    const type = entry.condition.type;
    if (!KNOWN_TYPES.has(type)) continue;
    const list = byType.get(type as ConditionType) ?? [];
    list.push(entry);
    byType.set(type as ConditionType, list);
  }
  return byType;
}

/**
 * The representative threshold for a stat-gated condition: the MOST COMMON one
 * across the catalog's entries of that type (ties broken toward the lower, more
 * conservative threshold). Undefined for keyword / board-reliance conditions.
 */
function modalThreshold(entries: HoserEntry[]): number | undefined {
  const counts = new Map<number, number>();
  for (const e of entries) {
    const t = e.condition.threshold;
    if (t != null) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  let best: number | undefined;
  let bestCount = -1;
  for (const [threshold, count] of counts) {
    if (count > bestCount || (count === bestCount && threshold < (best ?? Infinity))) {
      best = threshold;
      bestCount = count;
    }
  }
  return best;
}

/** Up to `MAX_EXAMPLES` catalog cards for a condition, deck-ink matches preferred. */
function pickExamples(entries: HoserEntry[], deckInks: Set<Ink>): HoserEntry[] {
  const inInk = entries.filter((e) => deckInks.has(e.ink as Ink));
  const offInk = entries.filter((e) => !deckInks.has(e.ink as Ink));
  return [...inInk, ...offInk].slice(0, MAX_EXAMPLES);
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

function buildMessage(
  type: ConditionType,
  threshold: number | undefined,
  pct: number,
  exampleName: string | undefined,
): string {
  const eg = exampleName ? ` (e.g. ${exampleName})` : '';
  switch (type) {
    case 'low-strength':
      return `${pct}% of your characters have ${threshold ?? 0} strength or less; exposed to low-strength removal${eg}.`;
    case 'high-cost':
      return `${pct}% of your characters cost ${threshold ?? 0} or more; exposed to high-cost removal${eg}.`;
    case 'evasive':
      return `${pct}% of your characters have Evasive; exposed to Evasive-hate removal${eg}.`;
    case 'bodyguard':
      return `${pct}% of your characters have Bodyguard; exposed to Bodyguard-punishing removal${eg}.`;
    case 'mass':
      return `${pct}% of your deck is characters; a go-wide board is exposed to board sweepers${eg}.`;
    case 'damaged':
      return `${pct}% of your deck is characters; once they take chip damage, damage-based removal can pick them off${eg}.`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the deck's "what to watch for" vulnerabilities from the pool-derived
 * hoser catalog. For each removal CONDITION present in `hosers`, measure the
 * deck's exposure over its characters (stat/keyword share) or over its board
 * reliance (mass / damaged), and emit a `Vulnerability` only when that exposure
 * is material (>= 25%). Results are sorted sharpest-first (severity, then share).
 *
 * A deck with no resolvable characters is never exposed to creature removal, so
 * it returns `[]`. Pure and deterministic given the same deck + catalog.
 */
export function analyzeVulnerabilities(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
  hosers: HoserEntry[],
): Vulnerability[] {
  const ctx = buildDeckContext(deck, getCardById);
  if (ctx.characterCopies === 0) return [];

  const byType = groupByType(hosers);
  const out: Vulnerability[] = [];

  for (const type of TYPE_ORDER) {
    const entries = byType.get(type);
    if (!entries || entries.length === 0) continue;

    const threshold = modalThreshold(entries);
    const exposurePct = Math.round(computeExposure(type, threshold, ctx));
    const severity = severityFor(type, exposurePct);
    if (!severity) continue;

    const examples = pickExamples(entries, ctx.deckInks);
    out.push({
      id: type,
      label: LABELS[type],
      conditionType: type,
      severity,
      exposurePct,
      message: buildMessage(type, threshold, exposurePct, examples[0]?.name),
      hoserCardIds: examples.map((e) => e.cardId),
    });
  }

  return out.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      (b.exposurePct ?? 0) - (a.exposurePct ?? 0) ||
      TYPE_ORDER.indexOf(a.conditionType as ConditionType) -
        TYPE_ORDER.indexOf(b.conditionType as ConditionType),
  );
}
