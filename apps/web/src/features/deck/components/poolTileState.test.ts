import {describe, it, expect} from 'vitest';
import {getPoolTileState} from './poolTileState';
import {createCard} from '../../../shared/test-utils';

describe('getPoolTileState', () => {
  it('allows an on-ink card below the copy limit', () => {
    const state = getPoolTileState(createCard({ink: 'Amber'}), ['Amber'], 0);
    expect(state).toEqual({offInk: false, addDisabled: false, reason: undefined});
  });

  it('disables + at 4 copies with the copy message', () => {
    const state = getPoolTileState(createCard({ink: 'Amber'}), ['Amber'], 4);
    expect(state.offInk).toBe(false);
    expect(state.addDisabled).toBe(true);
    expect(state.reason).toBe('Max 4 copies');
  });

  it('marks a card off-ink when it would be a 3rd ink', () => {
    const state = getPoolTileState(createCard({ink: 'Ruby'}), ['Amber', 'Steel'], 0);
    expect(state.offInk).toBe(true);
    expect(state.addDisabled).toBe(true);
    expect(state.reason).toBe("Can't have more than two ink colors in your deck");
  });

  it('keeps a dual-ink card on-ink when both of its inks already fit the deck', () => {
    const dual = createCard({ink: 'Amber', ink2: 'Steel'});
    const state = getPoolTileState(dual, ['Amber', 'Steel'], 0);
    expect(state.offInk).toBe(false);
    expect(state.addDisabled).toBe(false);
  });

  it('marks a dual-ink card off-ink when it introduces a 3rd ink', () => {
    const dual = createCard({ink: 'Ruby', ink2: 'Emerald'}); // Amber + Ruby + Emerald = 3
    const state = getPoolTileState(dual, ['Amber'], 0);
    expect(state.offInk).toBe(true);
  });

  it('treats an empty deck (no inks yet) as all-addable', () => {
    const state = getPoolTileState(createCard({ink: 'Ruby'}), [], 0);
    expect(state.offInk).toBe(false);
    expect(state.addDisabled).toBe(false);
  });

  it('surfaces the ink message over the copy message when both limits apply', () => {
    const state = getPoolTileState(createCard({ink: 'Ruby'}), ['Amber', 'Steel'], 4);
    expect(state.addDisabled).toBe(true);
    expect(state.reason).toBe("Can't have more than two ink colors in your deck");
  });
});
