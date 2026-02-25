import type {SynergyMatchDisplay} from '../types';

interface StrengthTier {
  label: string;
  color: string;
  bg: string;
}

/**
 * Map a numeric synergy score to a display tier (label + colors).
 * Accepts any number (integers from engine, decimals from community voting).
 */
export function getStrengthTier(score: number): StrengthTier {
  if (score >= 9.5) return {label: 'Build-around', color: '#fbbf24', bg: '#3d3010'};
  if (score >= 7) return {label: 'Strong', color: '#6ee7a0', bg: '#1a3d1a'};
  if (score >= 4) return {label: 'Moderate', color: '#f5d560', bg: '#3d3010'};
  return {label: 'Weak', color: '#f59090', bg: '#3d1a1a'};
}

/**
 * Returns the highest score from a list of synergies.
 * Used to assign a single score to groups containing mixed scores.
 */
export function getDominantScore(synergies: SynergyMatchDisplay[]): number {
  return Math.max(...synergies.map((s) => s.score));
}
