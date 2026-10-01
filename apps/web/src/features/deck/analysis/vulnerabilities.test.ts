import {describe, it, expect} from 'vitest';
import {analyzeVulnerabilities, type HoserEntry} from './vulnerabilities';
import type {Deck, LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';

/** Resolve deck cardIds from a fixed card list; unknown ids return undefined. */
function makeResolver(cards: LorcanaCard[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (id: string) => byId.get(id);
}

/** Assemble a minimal Deck from [card, quantity] entries. */
function makeDeck(entries: Array<[LorcanaCard, number]>): Deck {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    cards: entries.map(([card, quantity]) => ({cardId: card.id, quantity})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

/** N distinct cards sharing the given overrides (unique id + fullName per index). */
function genCards(n: number, prefix: string, over: Partial<LorcanaCard>): LorcanaCard[] {
  return Array.from({length: n}, (_, i) =>
    createCard({id: `${prefix}-${i}`, fullName: `${prefix} ${i}`, ...over}),
  );
}

/** Shorthand for a catalog entry. */
function hoser(
  cardId: string,
  name: string,
  ink: string,
  condition: HoserEntry['condition'],
  scope: HoserEntry['scope'] = 'conditional',
): HoserEntry {
  return {cardId, name, ink, condition, scope, text: name};
}

describe('analyzeVulnerabilities', () => {
  it('flags a low-strength-heavy board as high severity with the modal threshold', () => {
    // Catalog thresholds [1, 2, 2, 3] -> modal 2. Board: 8 str<=2 copies + 2 str-7 = 80%.
    const catalog: HoserEntry[] = [
      hoser('2055', 'Sisu - Daring Visitor', 'Ruby', {type: 'low-strength', threshold: 1}),
      hoser('2263', 'Finnick - Tiny Terror', 'Emerald', {type: 'low-strength', threshold: 2}),
      hoser('2594', 'Grab Your Bow', 'Ruby', {type: 'low-strength', threshold: 2}),
      hoser('3106', 'Red Alert', 'Ruby', {type: 'low-strength', threshold: 3}),
    ];
    const weak = genCards(2, 'weak', {ink: 'Amber', strength: 2}); // 2 x4 = 8 copies
    const tough = createCard({id: 'tough', fullName: 'Tough One', ink: 'Amber', strength: 7});
    const deck = makeDeck([
      [weak[0], 4],
      [weak[1], 4],
      [tough, 2],
    ]);

    const vulns = analyzeVulnerabilities(deck, makeResolver([...weak, tough]), catalog);

    expect(vulns).toHaveLength(1);
    expect(vulns[0].id).toBe('low-strength');
    expect(vulns[0].conditionType).toBe('low-strength');
    expect(vulns[0].severity).toBe('high');
    expect(vulns[0].exposurePct).toBe(80); // 8 / 10
    expect(vulns[0].message).toContain('2 strength or less');
  });

  it('flags an evasive-heavy board', () => {
    const catalog: HoserEntry[] = [
      hoser('2218', 'The Horseman Strikes!', 'Amber', {type: 'evasive'}),
      hoser('3174', 'Windstorm', 'Steel', {type: 'evasive'}),
    ];
    const flyers = genCards(2, 'fly', {ink: 'Amber', strength: 4, keywords: ['Evasive']}); // 8
    const grounded = createCard({id: 'ground', fullName: 'Grounded', ink: 'Amber', strength: 4});
    const deck = makeDeck([
      [flyers[0], 4],
      [flyers[1], 4],
      [grounded, 4],
    ]);

    const vulns = analyzeVulnerabilities(deck, makeResolver([...flyers, grounded]), catalog);

    expect(vulns).toHaveLength(1);
    expect(vulns[0].conditionType).toBe('evasive');
    expect(vulns[0].exposurePct).toBe(67); // 8 / 12
    expect(vulns[0].severity).toBe('high');
  });

  it('returns [] for a deck exposed to none of the catalog conditions', () => {
    const catalog: HoserEntry[] = [
      hoser('2263', 'Finnick - Tiny Terror', 'Emerald', {type: 'low-strength', threshold: 2}),
      hoser('2986', 'Gaston - Superior Archer', 'Amber', {type: 'high-cost', threshold: 6}),
      hoser('3174', 'Windstorm', 'Steel', {type: 'evasive'}),
    ];
    // Beefy (str 6 > 2), cheap (cost 3 < 6), grounded (no Evasive). Nothing hits.
    const cards = genCards(15, 'beef', {ink: 'Amber', cost: 3, strength: 6});
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver(cards), catalog);

    expect(vulns).toEqual([]);
  });

  it('flags a go-wide deck as exposed to mass removal via board reliance', () => {
    const catalog: HoserEntry[] = [
      hoser('2491', 'Raging Storm', 'Amber', {type: 'mass'}, 'mass'),
      hoser('2138', 'The Mob Song', 'Steel', {type: 'mass'}, 'mass'),
    ];
    const bodies = genCards(10, 'body', {ink: 'Amber', strength: 5}); // 40 char copies
    const spells = genCards(2, 'spell', {ink: 'Amber', type: 'Action'}); // 8 non-char copies
    const deck = makeDeck([...bodies, ...spells].map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver([...bodies, ...spells]), catalog);

    expect(vulns).toHaveLength(1);
    expect(vulns[0].conditionType).toBe('mass');
    expect(vulns[0].exposurePct).toBe(83); // 40 / 48
    expect(vulns[0].severity).toBe('high');
  });

  it('does not flag a spell-heavy control deck for mass removal (below the materiality floor)', () => {
    const catalog: HoserEntry[] = [hoser('2491', 'Raging Storm', 'Amber', {type: 'mass'}, 'mass')];
    const bodies = genCards(3, 'body', {ink: 'Amber', strength: 5}); // 12 char copies
    const spells = genCards(10, 'spell', {ink: 'Amber', type: 'Action'}); // 40 non-char copies
    const deck = makeDeck([...bodies, ...spells].map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver([...bodies, ...spells]), catalog);

    expect(vulns).toEqual([]); // 12 / 52 = 23% < 25% floor
  });

  it('keeps damaged informational: capped at low severity even at full board reliance', () => {
    const catalog: HoserEntry[] = [
      hoser('2285', 'Chomp!', 'Emerald', {type: 'damaged'}),
      hoser('2807', 'Cruella De Vil - Judgmental Traveler', 'Emerald', {type: 'damaged'}),
    ];
    const cards = genCards(15, 'char', {ink: 'Amber', strength: 5}); // all characters -> 100%
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver(cards), catalog);

    expect(vulns).toHaveLength(1);
    expect(vulns[0].conditionType).toBe('damaged');
    expect(vulns[0].exposurePct).toBe(100);
    expect(vulns[0].severity).toBe('low'); // never escalates despite 100% reliance
  });

  it('returns [] for a deck with no characters (nothing to remove)', () => {
    const catalog: HoserEntry[] = [
      hoser('2263', 'Finnick - Tiny Terror', 'Emerald', {type: 'low-strength', threshold: 2}),
      hoser('2491', 'Raging Storm', 'Amber', {type: 'mass'}, 'mass'),
    ];
    const spells = genCards(15, 'spell', {ink: 'Amber', type: 'Action'});
    const deck = makeDeck(spells.map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver(spells), catalog);

    expect(vulns).toEqual([]);
  });

  it('orders example hoserCardIds by deck-ink relevance first', () => {
    const catalog: HoserEntry[] = [
      hoser('offA', 'Off Ink', 'Emerald', {type: 'low-strength', threshold: 3}),
      hoser('inR', 'In Ink', 'Ruby', {type: 'low-strength', threshold: 3}),
    ];
    const cards = genCards(4, 'r', {ink: 'Ruby', strength: 2}); // Ruby deck, all str<=3
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number]));

    const vulns = analyzeVulnerabilities(deck, makeResolver(cards), catalog);

    expect(vulns).toHaveLength(1);
    expect(vulns[0].hoserCardIds).toEqual(['inR', 'offA']); // deck-ink (Ruby) example first
    expect(vulns[0].message).toContain('In Ink'); // named example is the deck-ink one
  });

  it('sorts multiple vulnerabilities sharpest-first', () => {
    const catalog: HoserEntry[] = [
      hoser('2986', 'Gaston - Superior Archer', 'Amber', {type: 'high-cost', threshold: 5}),
      hoser('3174', 'Windstorm', 'Steel', {type: 'evasive'}),
    ];
    // 11 evasive copies (cost 3) + 4 high-cost copies (cost 6, not evasive) = 15 characters.
    const flyers = genCards(3, 'fly', {ink: 'Amber', cost: 3, strength: 4, keywords: ['Evasive']}); // 4+4+3 = 11 evasive
    const bigs = createCard({id: 'big', fullName: 'Big', ink: 'Amber', cost: 6, strength: 4}); // high-cost, no evasive
    const deck = makeDeck([
      [flyers[0], 4],
      [flyers[1], 4],
      [flyers[2], 3],
      [bigs, 4],
    ]);

    const vulns = analyzeVulnerabilities(deck, makeResolver([...flyers, bigs]), catalog);

    // evasive: 11/15 = 73% high; high-cost: 4/15 = 27% low. High sorts first.
    expect(vulns.map((v) => v.conditionType)).toEqual(['evasive', 'high-cost']);
    expect(vulns[0].severity).toBe('high');
    expect(vulns[1].severity).toBe('low');
  });
});
