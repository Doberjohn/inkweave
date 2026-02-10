import type {SynergyStrength, SynergyMatchDisplay} from '../types';

/**
 * Strength priority ordering for determining dominant strength in a group.
 * Higher number = stronger synergy.
 */
export const STRENGTH_ORDER: Record<SynergyStrength, number> = {
  strong: 3,
  moderate: 2,
  weak: 1,
};

/**
 * Determines the dominant (strongest) synergy strength from a list of synergies.
 * Used to assign a single strength level to groups containing mixed strengths.
 *
 * @param synergies - Array of synergies to analyze
 * @returns The strongest synergy strength found in the group
 */
export function getDominantStrength(synergies: SynergyMatchDisplay[]): SynergyStrength {
  let best: SynergyStrength = 'weak';
  for (const s of synergies) {
    if (STRENGTH_ORDER[s.strength] > STRENGTH_ORDER[best]) {
      best = s.strength;
    }
  }
  return best;
}
