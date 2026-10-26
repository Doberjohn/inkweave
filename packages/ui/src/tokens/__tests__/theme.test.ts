import {expect, test} from 'vitest';
import {SHADOWS} from '../theme';

test('glowSm stays one shadow with no spread, which the card modal draws inside drop-shadow()', () => {
  // A spread or a second shadow would make the modal's whole `filter` invalid, so the lit card
  // would lose its glow without a warning.
  expect(SHADOWS.glowSm).toMatch(/^-?\d+(px)? -?\d+(px)? \d+px rgba\([^()]*\)$/);
});
