import type {Ink} from 'inkweave-synergy-engine';

// Ink color styling (vibrant on dark backgrounds)
export const INK_COLORS: Record<Ink, {bg: string; text: string; border: string}> = {
  Amber: {bg: '#3d2e10', text: '#f5c542', border: '#f59e0b'},
  Amethyst: {bg: '#2a1a45', text: '#c4a5f5', border: '#8b5cf6'},
  Emerald: {bg: '#0f2e1f', text: '#6ee7a0', border: '#10b981'},
  Ruby: {bg: '#3d1515', text: '#f87171', border: '#ef4444'},
  Sapphire: {bg: '#0f1e3d', text: '#7db5f5', border: '#3b82f6'},
  Steel: {bg: '#252530', text: '#a0a0b0', border: '#6b7280'},
};

/**
 * The game's own ink-symbol colours, for the letter chips that name each card in a synergy line
 * (ConnectionGroup, #786). They are brighter than INK_COLORS, which is tuned for badges on dark
 * surfaces, so each ink carries whichever of black or white reads better on its chip: Emerald's
 * and Sapphire's white fell short of 4.5:1 at the chips' 11px.
 */
export const INK_CHIP_COLORS: Record<Ink, {bg: string; text: string}> = {
  Amber: {bg: '#f5b202', text: '#000000'},
  Amethyst: {bg: '#81377b', text: '#ffffff'},
  Emerald: {bg: '#2a8934', text: '#000000'},
  Ruby: {bg: '#d3082f', text: '#ffffff'},
  Sapphire: {bg: '#0189c4', text: '#000000'},
  Steel: {bg: '#9fa8b4', text: '#000000'},
};

// All inks for iteration
export const ALL_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

// Ink cost values for filter buttons
export const COST_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
