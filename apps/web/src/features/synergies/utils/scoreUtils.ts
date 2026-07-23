import type {SynergyMatchDisplay} from '../types';
import {TIER_COLORS} from '../../../shared/constants';

export type StrengthTierLabel = 'Perfect' | 'Strong' | 'Moderate' | 'Weak';

export interface StrengthTier {
  label: StrengthTierLabel;
  /** Abbreviated label for compact displays (e.g. mobile badges). */
  shortLabel: string;
  color: string;
  bg: string;
}

/**
 * Map a numeric synergy score to a display tier (label + colors).
 * Accepts any number (integers from engine, decimals from community voting).
 */
export function getStrengthTier(score: number): StrengthTier {
  if (score >= 9.5) return {label: 'Perfect', shortLabel: 'Perf', ...TIER_COLORS.perfect};
  if (score >= 7) return {label: 'Strong', shortLabel: 'Strong', ...TIER_COLORS.strong};
  if (score >= 4) return {label: 'Moderate', shortLabel: 'Mod', ...TIER_COLORS.moderate};
  return {label: 'Weak', shortLabel: 'Weak', ...TIER_COLORS.weak};
}

/**
 * Returns the highest score from a list of synergies.
 * Used to assign a single score to groups containing mixed scores.
 */
export function getDominantScore(synergies: SynergyMatchDisplay[]): number {
  if (synergies.length === 0) return 0;
  return Math.max(...synergies.map((s) => s.score));
}
