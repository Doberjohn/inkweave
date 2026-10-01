import {COLORS, INK_COLORS} from '../../../shared/constants';
import type {DeckStatus} from '../types';

/**
 * Per-dimension status → gauge color. Unlike HealthSummary's 2-way signal-dot color
 * (which collapses good+warn to amber), the ring/radar gauges need the full 3-way
 * traffic light: good → green, warn → amber, bad → red.
 */
export function dimensionColor(status: DeckStatus): string {
  if (status === 'good') return COLORS.success;
  if (status === 'warn') return INK_COLORS.Amber.border;
  return COLORS.error;
}
