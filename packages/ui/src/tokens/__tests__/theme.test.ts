import {expect, test} from 'vitest';
import {COLORS, GOLD_GLOW, SHADOWS} from '../theme';
import {contrast, over} from './contrast';

test('glowSm stays one shadow with no spread, which the card modal draws inside drop-shadow()', () => {
  // A spread or a second shadow would make the modal's whole `filter` invalid, so the lit card
  // would lose its glow without a warning.
  expect(SHADOWS.glowSm).toMatch(/^-?\d+(px)? -?\d+(px)? \d+px rgba\([^()]*\)$/);
});

test("errorText meets 4.5:1 on a menu's surface, and under its hover wash", () => {
  // A menu's Delete binder: 14px medium words, small text by WCAG's measure.
  expect(contrast(COLORS.errorText, COLORS.surfaceFloating)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(COLORS.errorText, over(GOLD_GLOW.hoverBg, COLORS.surfaceFloating))).toBeGreaterThanOrEqual(4.5);
});
