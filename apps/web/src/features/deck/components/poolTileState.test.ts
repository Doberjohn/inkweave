import {describe, it, expect} from 'vitest';
import {getPoolTileState} from './poolTileState';

describe('getPoolTileState', () => {
  it('allows adding below the 4-copy limit', () => {
    expect(getPoolTileState(0)).toEqual({addDisabled: false, reason: undefined});
    expect(getPoolTileState(3)).toEqual({addDisabled: false, reason: undefined});
  });

  it('disables + at the 4-copy limit with the copy message', () => {
    expect(getPoolTileState(4)).toEqual({addDisabled: true, reason: 'Max 4 copies'});
  });

  it('stays disabled beyond the limit', () => {
    expect(getPoolTileState(5).addDisabled).toBe(true);
  });
});
