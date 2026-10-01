import {COLORS, INK_COLORS} from '../../../shared/constants';

/** A Deck Quality Score band: display label + its meter/chip color. */
export interface ScoreTier {
  label: string;
  color: string;
}

/**
 * Four-band tier + color for a 0..100 Deck Quality Score. Shared by the
 * ScoreGauge (full panel) and the compact Cards-tab HealthSummary so both read
 * the same thresholds and colors.
 */
export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return {label: 'Excellent', color: COLORS.success};
  if (score >= 60) return {label: 'Strong', color: COLORS.primary};
  if (score >= 40) return {label: 'Fair', color: INK_COLORS.Amber.border};
  return {label: 'Needs work', color: COLORS.error};
}
