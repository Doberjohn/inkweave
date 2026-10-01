import {describe, it, expect} from 'vitest';
import {rankSuggestions} from './suggestions';
import type {Deck, DeckHealth, DeckStatus, HealthAnalyzer, LorcanaCard} from '../types';
import type {PairScore} from './deckSynergy';
import {createCard} from '../../../shared/test-utils';

/** Deck from resolved cards, each tagged with its quantity / core flag. */
function makeDeck(entries: Array<{card: LorcanaCard; quantity?: number; isCore?: boolean}>): Deck {
  return {
    id: 'd',
    name: 'Deck',
    cards: entries.map((e) => ({cardId: e.card.id, quantity: e.quantity ?? 4, isCore: e.isCore})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

/** Resolve card ids from a fixed list; unknown ids return undefined. */
function resolver(cards: LorcanaCard[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (id: string) => byId.get(id);
}

function analyzer(id: string, status: DeckStatus): HealthAnalyzer {
  return {id, label: id, score: 0, status, message: `${id} ${status}`};
}

function makeHealth(analyzers: HealthAnalyzer[]): DeckHealth {
  return {overall: 50, archetype: 'midrange', archetypeConfidence: 1, analyzers, vulnerabilities: []};
}

const NO_GAPS = makeHealth([]);
const NO_SYNERGY: PairScore = () => 0;

describe('rankSuggestions', () => {
  it('boosts a removal candidate when the removal analyzer is failing', () => {
    const deckCard = createCard({id: 'deck1', ink: 'Amber'});
    const removal = createCard({id: 'rem', ink: 'Amber', text: 'Banish chosen character.'});
    const vanilla = createCard({id: 'van', ink: 'Amber'}); // no removal, no synergy

    const result = rankSuggestions({
      deck: makeDeck([{card: deckCard}]),
      candidateIds: ['rem', 'van'],
      getPairScore: NO_SYNERGY,
      health: makeHealth([analyzer('removal', 'bad')]),
      getCardById: resolver([deckCard, removal, vanilla]),
    });

    // Only the removal card earns points; the vanilla candidate scores 0 and is dropped.
    expect(result.map((s) => s.cardId)).toEqual(['rem']);
    expect(result[0].gapScore).toBeGreaterThan(0);
    expect(result[0].reasons).toContain('Fills removal gap');
  });

  it('boosts an on-curve Song when the deck runs a Singer', () => {
    const singer = createCard({id: 'singer', ink: 'Amber', keywords: ['Singer 5']});
    const onCurve = createCard({id: 'song4', ink: 'Amber', type: 'Action', classifications: ['Song'], cost: 4});
    const offCurve = createCard({id: 'song7', ink: 'Amber', type: 'Action', classifications: ['Song'], cost: 7});

    const result = rankSuggestions({
      deck: makeDeck([{card: singer}]),
      candidateIds: ['song4', 'song7'],
      getPairScore: NO_SYNERGY,
      health: NO_GAPS,
      getCardById: resolver([singer, onCurve, offCurve]),
    });

    // Only the cost-4 Song is singable by Singer 5; the cost-7 Song earns nothing.
    expect(result.map((s) => s.cardId)).toEqual(['song4']);
    expect(result[0].reasons).toContain('On-curve Song for a Singer');
    expect(result[0].synergizesWith).toContain('singer');
  });

  it('weights synergy with a core card at ×2', () => {
    const core = createCard({id: 'core', ink: 'Amber'});
    const plain = createCard({id: 'plain', ink: 'Amber'});
    const candidate = createCard({id: 'cand', ink: 'Amber'});
    // Candidate pairs at 5 with both deck cards.
    const scores: PairScore = (a, b) => (a === 'cand' || b === 'cand' ? 5 : 0);

    const result = rankSuggestions({
      deck: makeDeck([
        {card: core, isCore: true},
        {card: plain},
      ]),
      candidateIds: ['cand'],
      getPairScore: scores,
      health: NO_GAPS,
      getCardById: resolver([core, plain, candidate]),
    });

    // 5×2 (core) + 5×1 (plain) = 15, vs 10 without the core weighting.
    expect(result[0].synergyScore).toBe(15);
    expect([...result[0].synergizesWith].sort()).toEqual(['core', 'plain']);
  });

  it('excludes a candidate already at 4 copies', () => {
    const maxed = createCard({id: 'x', ink: 'Amber', text: 'Banish chosen character.'});
    const result = rankSuggestions({
      deck: makeDeck([{card: maxed, quantity: 4}]),
      candidateIds: ['x'],
      getPairScore: NO_SYNERGY,
      health: makeHealth([analyzer('removal', 'bad')]),
      getCardById: resolver([maxed]),
    });

    expect(result).toEqual([]);
  });

  it('drops an off-ink candidate that cannot share the deck', () => {
    const dual = createCard({id: 'dual', ink: 'Amber', ink2: 'Steel'});
    const ruby = createCard({id: 'ruby', ink: 'Ruby', text: 'Banish chosen character.'});

    const result = rankSuggestions({
      deck: makeDeck([{card: dual}]),
      candidateIds: ['ruby'],
      getPairScore: NO_SYNERGY,
      health: makeHealth([analyzer('removal', 'bad')]),
      getCardById: resolver([dual, ruby]),
    });

    // Ruby can't live in an Amber/Steel deck, so it's filtered despite the removal gap.
    expect(result).toEqual([]);
  });

  it('rewards a BECKON enabler when the deck runs a Merida anchor', () => {
    const anchor = createCard({
      id: 'merida',
      ink: 'Amethyst',
      text: 'BECKON Whenever another character of yours enters play exerted, draw a card.',
    });
    const enabler = createCard({
      id: 'enabler',
      ink: 'Amethyst',
      type: 'Character',
      text: 'This character enters play exerted.',
    });

    const result = rankSuggestions({
      deck: makeDeck([{card: anchor}]),
      candidateIds: ['enabler'],
      getPairScore: NO_SYNERGY,
      health: NO_GAPS,
      getCardById: resolver([anchor, enabler]),
    });

    expect(result.map((s) => s.cardId)).toEqual(['enabler']);
    expect(result[0].reasons).toContain('BECKON enabler for Merida');
    expect(result[0].synergizesWith).toContain('merida');
  });
});
