// Pure projection of a deck's cost histogram onto the fixed columns the
// CostCurveStrip renders. Kept React-free so the bucket math is unit-testable on
// its own (mirrors previewGeometry.ts / poolTileState.ts). The strip itself
// (CostCurveStrip.tsx) is the cost-curve mini-chart + ink split of the
// DeckStatsBar (#468) — NOT the #472 advisor panel, which is a separate surface.

import type {Ink} from '../types';
import {ALL_INKS} from '../../../shared/constants';

/**
 * Costs at or above this collapse into one top bucket. Mirrors deckStats'
 * (non-exported) COST_CURVE_CAP so both agree on where "7+" starts.
 */
export const COST_CURVE_CAP = 7;

/**
 * One ink's share of a bucket's bar: the copies carrying that ink, plus that
 * ink's band height. The two have DIFFERENT denominators — a dual-ink card
 * counts toward both of its inks (deckStats' tallyCard), so `count`s can sum
 * above the bar's own card count while `pct`s still sum to 100.
 */
export interface InkSegment {
  ink: Ink;
  /** Share of this bucket's ink units, 0..100. */
  pct: number;
  /** Copies carrying this ink in this bucket; always >= 1. Not a share of the bar. */
  count: number;
}

/** One rendered column of the cost curve: which bucket, its label, copies, bar height, ink split. */
export interface CurveColumn {
  /** Mana-cost bucket (0..COST_CURVE_CAP); the cap bucket is the "7+" top bucket. */
  bucket: number;
  /** Axis label: "7+" for the cap bucket, otherwise the plain number. */
  label: string;
  /** Copies of cards in this bucket. */
  count: number;
  /** Bar height as a 0..100 percent of the chart area (mapped to px by the component). */
  heightPct: number;
  /** Ink composition of the bar, in fixed ALL_INKS order; empty when no inks resolve. */
  segments: InkSegment[];
}

/**
 * Split one bucket's ink counts into fixed-order segments whose percentages sum
 * to 100 (empty when the bucket has no resolved inks). Fixed ALL_INKS order so a
 * given ink keeps the same colour and stacking position across every render,
 * never repainting as the deck changes.
 */
export function inkSegments(byInk: Partial<Record<Ink, number>> | undefined): InkSegment[] {
  if (!byInk) return [];
  const present = ALL_INKS.filter((ink) => (byInk[ink] ?? 0) > 0);
  const total = present.reduce((sum, ink) => sum + (byInk[ink] ?? 0), 0);
  if (total <= 0) return [];
  return present.map((ink) => ({ink, pct: ((byInk[ink] ?? 0) / total) * 100, count: byInk[ink] ?? 0}));
}

/**
 * Height of one bar as a 0..100 percent of the tallest bar, given this bucket's
 * `count` and the deck's busiest bucket `maxCount`. Returning a *relative*
 * magnitude (not pixels) keeps this pure and lets the component own the pixel
 * budget + label headroom.
 */
export function barHeightPct(count: number, maxCount: number): number {
  if (maxCount <= 0) return 0; // empty deck — nothing to scale against
  // Linear against the busiest bucket: the tallest bar fills the strip and the
  // rest read proportionally, so the curve's SHAPE is legible at any deck size.
  // No % floor — the component's minHeight:2 already keeps a nonzero bar visible.
  return Math.max(0, Math.min(100, (count / maxCount) * 100));
}

/**
 * Project the sparse `costCurve` (cost -> copies; a missing bucket means 0
 * copies) onto ordered columns, each carrying its ink split from
 * `costCurveByInk`. Bar height comes from the physical `costCurve` count (the
 * curve is card count per cost); ink segments only partition that height.
 * Always covers 1..COST_CURVE_CAP; prepends a 0-cost column only when 0-cost
 * cards are actually present, so the axis stays clean without ever dropping them.
 */
export function toColumns(
  costCurve: Record<number, number>,
  costCurveByInk: Record<number, Partial<Record<Ink, number>>>,
): CurveColumn[] {
  const buckets = costCurve[0] ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7];
  const counts = buckets.map((b) => costCurve[b] ?? 0);
  const maxCount = Math.max(0, ...counts);
  return buckets.map((bucket, i) => ({
    bucket,
    label: bucket === COST_CURVE_CAP ? `${COST_CURVE_CAP}+` : String(bucket),
    count: counts[i],
    heightPct: barHeightPct(counts[i], maxCount),
    segments: inkSegments(costCurveByInk[bucket]),
  }));
}

/** Total copies represented by the curve; the strip hides itself when this is 0. */
export function totalCopies(costCurve: Record<number, number>): number {
  return Object.values(costCurve).reduce((sum, n) => sum + n, 0);
}
