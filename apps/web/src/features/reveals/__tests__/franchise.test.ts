import {describe, it, expect} from 'vitest';
import {matchesFranchise, FRANCHISES} from '../franchise';
import {createCard} from '../../../shared/test-utils';

// Read from the season's config so these cases never need a per-season edit.
const DEBUT = FRANCHISES[0];

describe('matchesFranchise', () => {
  it('returns true for any card when franchise is null', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, null)).toBe(true);
  });

  it('returns true when card.franchise matches the config label', () => {
    const card = createCard({id: '1', franchise: DEBUT.match});
    expect(matchesFranchise(card, DEBUT.id)).toBe(true);
  });

  it('returns false when card.franchise differs', () => {
    const card = createCard({id: '1', franchise: 'Peter Pan'});
    expect(matchesFranchise(card, DEBUT.id)).toBe(false);
  });

  it('returns false when card has no franchise and a filter is active', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, DEBUT.id)).toBe(false);
  });
});

describe('FRANCHISES', () => {
  it('gives every debut franchise a unique id', () => {
    const ids = FRANCHISES.map((f) => f.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps each id to a human label and a card.franchise match value', () => {
    for (const f of FRANCHISES) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.match.length).toBeGreaterThan(0);
    }
  });
});
