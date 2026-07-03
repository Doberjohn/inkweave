import type {DimensionFill} from './voteAnalyticsTypes';

export interface DimensionRow {
  label: string;
  pct: number;
}

const ORDER: Array<[keyof DimensionFill, string]> = [
  ['score', 'Synergy score'],
  ['accuracy', 'Accuracy'],
  ['isReal', 'Is real'],
  ['wouldPlay', 'Would play'],
  ['difficulty', 'Difficulty'],
];

/** Percentage of total votes that filled each dimension, in display order. */
export function dimensionStats(fill: DimensionFill | null, totalVotes: number): DimensionRow[] {
  if (!fill || totalVotes <= 0) return [];
  return ORDER.map(([key, label]) => ({
    label,
    pct: Math.round((fill[key] / totalVotes) * 1000) / 10,
  }));
}
