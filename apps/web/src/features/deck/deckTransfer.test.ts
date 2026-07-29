import {describe, expect, it} from 'vitest';
import {createCard} from '../../shared/test-utils';
import {duelsInkUrl, formatDecklist, parseDecklist, resolveDecklist} from './deckTransfer';

const pool = [
  createCard({id: '1', fullName: 'Angel - Experiment 624', setCode: '11', setNumber: 191}),
  createCard({id: '2', fullName: 'He Hurled His Thunderbolt', setCode: '10', setNumber: 197}),
  // Reprinted into Core: community lists still cite the original 2-201 printing.
  createCard({id: '3', fullName: 'Strength of a Raging Fire', setCode: '9', setNumber: 201}),
];
const getCardById = (id: string) => pool.find((c) => c.id === id);

describe('formatDecklist', () => {
  it('writes "{qty} {fullName} ({set}-{number})" per line', () => {
    const text = formatDecklist([{cardId: '1', quantity: 4}, {cardId: '2', quantity: 2}], getCardById);
    expect(text).toBe('4 Angel - Experiment 624 (11-191)\n2 He Hurled His Thunderbolt (10-197)');
  });

  it('skips cards that no longer resolve rather than emitting an unmatchable line', () => {
    const text = formatDecklist([{cardId: '1', quantity: 4}, {cardId: 'gone', quantity: 3}], getCardById);
    expect(text).toBe('4 Angel - Experiment 624 (11-191)');
  });
});

describe('duelsInkUrl', () => {
  it('base64-encodes the list into the import parameter', () => {
    const url = duelsInkUrl('4 Angel - Experiment 624 (11-191)');
    const encoded = url.replace('https://duels.ink/decks/new?import=', '');
    expect(atob(decodeURIComponent(encoded))).toBe('4 Angel - Experiment 624 (11-191)');
  });

  it('percent-encodes so base64 "+" cannot be read back as a space', () => {
    // "??>" encodes to "Pz8+", which carries the problematic "+".
    const url = duelsInkUrl('??>');
    expect(url).toContain('%2B');
    expect(url).not.toMatch(/import=.*\+/);
  });
});

describe('parseDecklist', () => {
  it('reads the Dreamborn format (no set-number ref)', () => {
    const {lines} = parseDecklist('4 Strength of a Raging Fire\n2 Mowgli - Man Cub');
    expect(lines).toEqual([
      {quantity: 4, name: 'Strength of a Raging Fire', ref: undefined, raw: '4 Strength of a Raging Fire'},
      {quantity: 2, name: 'Mowgli - Man Cub', ref: undefined, raw: '2 Mowgli - Man Cub'},
    ]);
  });

  it('reads the Duels.ink format and keeps the ref', () => {
    const {lines} = parseDecklist('4 Angel - Experiment 624 (11-191)');
    expect(lines[0]).toMatchObject({quantity: 4, name: 'Angel - Experiment 624', ref: '11-191'});
  });

  it('accepts a "4x" quantity', () => {
    const {lines} = parseDecklist('4x Bambi - Ethereal Fawn');
    expect(lines[0]).toMatchObject({quantity: 4, name: 'Bambi - Ethereal Fawn'});
  });

  it('skips blank lines and comments, and reports lines it cannot read', () => {
    const {lines, unparsed} = parseDecklist('\n// my deck\n4 Angel - Experiment 624\nnot a card line\n0 Zero Copies');
    expect(lines).toHaveLength(1);
    expect(unparsed).toEqual(['not a card line', '0 Zero Copies']);
  });
});

describe('resolveDecklist', () => {
  it('matches by name', () => {
    const {lines} = parseDecklist('4 Angel - Experiment 624 (11-191)');
    expect(resolveDecklist(lines, pool).cards).toEqual([{cardId: '1', quantity: 4}]);
  });

  it('still matches when the ref points at a different printing (reprints, enchanted)', () => {
    // The community list cites 2-201; Core carries the card as 9-201.
    const {lines} = parseDecklist('4 Strength of a Raging Fire (2-201)');
    const {cards, unmatched} = resolveDecklist(lines, pool);
    expect(cards).toEqual([{cardId: '3', quantity: 4}]);
    expect(unmatched).toEqual([]);
  });

  it('reports lines with no matching card instead of dropping them silently', () => {
    const {lines} = parseDecklist('4 Doc - Bold Knight (5-193)\n4 Angel - Experiment 624');
    const {cards, unmatched} = resolveDecklist(lines, pool);
    expect(cards).toEqual([{cardId: '1', quantity: 4}]);
    expect(unmatched).toEqual(['4 Doc - Bold Knight (5-193)']);
  });

  it('sums repeated lines for one card and clamps at 4 copies', () => {
    const {lines} = parseDecklist('3 Angel - Experiment 624\n3 Angel - Experiment 624');
    expect(resolveDecklist(lines, pool).cards).toEqual([{cardId: '1', quantity: 4}]);
  });

  it('matches case- and whitespace-insensitively', () => {
    const {lines} = parseDecklist('2  angel  -  experiment 624');
    expect(resolveDecklist(lines, pool).cards).toEqual([{cardId: '1', quantity: 2}]);
  });
});
