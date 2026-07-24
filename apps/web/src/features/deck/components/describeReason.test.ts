import {describe, expect, it} from 'vitest';
import {describeReason} from './describeReason';

describe('describeReason', () => {
  it('rewords the fixed reasons for humans', () => {
    expect(describeReason('Fills removal gap')).toBe("Adds removal you're short on");
    expect(describeReason('Fills card-draw gap')).toBe("Adds card draw you're short on");
    expect(describeReason('BECKON enabler for Merida')).toBe('Feeds your Merida engine');
    expect(describeReason('Shift target for a card in the deck')).toBe('A Shift target for your deck');
    expect(describeReason('On-curve Song for a Singer')).toBe('A song your singers can play free');
  });

  it('extracts the number from the dynamic reasons', () => {
    expect(describeReason('Fills curve hole at cost 3')).toBe('Fills a gap at 3 cost');
    expect(describeReason('Synergizes with 6 deck cards')).toBe('Works with 6 of your cards');
    expect(describeReason('Synergizes with 1 deck card')).toBe('Works with 1 of your cards');
  });

  it('passes an unknown reason through unchanged', () => {
    expect(describeReason('Something new')).toBe('Something new');
  });
});
