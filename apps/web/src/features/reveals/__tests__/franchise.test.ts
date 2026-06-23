import {describe, it, expect} from 'vitest';
import {matchesFranchise, FRANCHISES} from '../franchise';
import {createCard} from '../../../shared/test-utils';

describe('matchesFranchise', () => {
  it('returns true for any card when franchise is null', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, null)).toBe(true);
  });

  it('returns true when card.franchise matches the config label', () => {
    const card = createCard({id: '1', franchise: 'Monsters, Inc.'});
    expect(matchesFranchise(card, 'monsters-inc')).toBe(true);
  });

  it('returns false when card.franchise differs', () => {
    const card = createCard({id: '1', franchise: 'Up'});
    expect(matchesFranchise(card, 'monsters-inc')).toBe(false);
  });

  it('returns false when card has no franchise and a filter is active', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, 'turning-red')).toBe(false);
  });
});

describe('FRANCHISES', () => {
  it('exposes three franchises covering Set 13 IPs', () => {
    expect(FRANCHISES.map((f) => f.id).sort()).toEqual(['monsters-inc', 'turning-red', 'up']);
  });

  it('maps each id to a human label and a card.franchise match value', () => {
    for (const f of FRANCHISES) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.match.length).toBeGreaterThan(0);
    }
  });
});
