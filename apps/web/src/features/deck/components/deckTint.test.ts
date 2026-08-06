import {describe, expect, it} from 'vitest';
import {COLORS, INK_COLORS} from '../../../shared/constants';
import {deckTint} from './deckTint';

describe('deckTint', () => {
  it('runs ink A to ink B for a two-ink deck', () => {
    expect(deckTint(['Amber', 'Emerald'])).toBe(
      `linear-gradient(135deg, ${INK_COLORS.Amber.bg} 0%, ${INK_COLORS.Emerald.bg} 100%)`,
    );
  });

  it('is flat for a mono-ink deck', () => {
    // Same colour at both stops: a gradient that renders as one tint, with no
    // second code path to keep in step with the first.
    expect(deckTint(['Ruby'])).toBe(
      `linear-gradient(135deg, ${INK_COLORS.Ruby.bg} 0%, ${INK_COLORS.Ruby.bg} 100%)`,
    );
  });

  it('gives a deck with no inks the plain surface, not a colour identity', () => {
    expect(deckTint([])).toBe(COLORS.surface);
  });

  it('ignores a third ink rather than throwing', () => {
    // Three inks is illegal in Core, but a draft can hold one mid-edit and a
    // list must still render it.
    expect(deckTint(['Amber', 'Emerald', 'Ruby'])).toBe(deckTint(['Amber', 'Emerald']));
  });
});
