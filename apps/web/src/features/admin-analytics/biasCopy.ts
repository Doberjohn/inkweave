export type GapDirection = 'over' | 'under' | 'neutral';

export interface BiasCopy {
  direction: GapDirection;
  read: string;
}

/** Gaps within +/- this band read as well-calibrated. */
const NEUTRAL_BAND = 0.25;

/**
 * Interpret meanGap (community avg minus engine score) into a direction and a
 * plain-English sentence. Negative = engine rates higher than the community
 * (over-rates); positive = engine rates lower (under-rates).
 */
export function biasCopy(meanGap: number | null): BiasCopy {
  if (meanGap == null) {
    return {direction: 'neutral', read: 'Not enough scored votes yet to assess calibration.'};
  }
  const magnitude = Math.abs(meanGap).toFixed(2);
  if (meanGap <= -NEUTRAL_BAND) {
    return {direction: 'over', read: `The engine rates pairs about ${magnitude} points higher than the community on average.`};
  }
  if (meanGap >= NEUTRAL_BAND) {
    return {direction: 'under', read: `The engine rates pairs about ${magnitude} points lower than the community on average.`};
  }
  return {direction: 'neutral', read: 'The engine is well-calibrated against community votes.'};
}
