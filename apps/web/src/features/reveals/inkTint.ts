import type {Ink} from 'inkweave-synergy-engine';
import {INK_COLORS} from '../../shared/constants';

/**
 * The reveals design tints everything with `rgba(inkRGB, α)` built from each
 * ink's canonical colour — which is exactly `INK_COLORS[ink].border` (the same
 * hex the design handoff lists as the "border = canonical RGB"). These helpers
 * derive those tints from the theme so the colours stay single-sourced.
 */

/** "245, 158, 11" — the ink's canonical RGB triplet (from its theme border hex). */
export function inkRgb(ink: Ink): string {
  const hex = INK_COLORS[ink].border.replace('#', '');
  const n = parseInt(hex, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** `rgba(r, g, b, α)` tint for the ink. */
export function inkRgba(ink: Ink, alpha: number): string {
  return `rgba(${inkRgb(ink)}, ${alpha})`;
}

/** `rgb(r, g, b)` solid for the ink. */
export function inkRgbSolid(ink: Ink): string {
  return `rgb(${inkRgb(ink)})`;
}
