import {describe, it, expect} from 'vitest';
import {buildPool, createCoverage, namedOrder, templatePattern} from '../stats.mjs';

/** Just enough engine for the pool and pair code: every card shares a deck with every other. */
function fakeEngine(rules = []) {
  return {
    isCoreSet: (setCode) => Number(setCode) >= 9,
    transformCards: (raw) =>
      raw.map((card) => ({...card, id: String(card.id), fullName: card.name})),
    canShareDeck: () => true,
    getAllRules: () => rules,
    getInks: (card) => [card.ink],
  };
}

describe('buildPool', () => {
  const main = {
    cards: [
      {id: 1, setCode: '9'},
      {id: 2, setCode: '5'},
      {id: 3, setCode: '10'},
    ],
    sets: {},
  };
  const preview = {
    cards: [
      {id: 1, setCode: '9'},
      {id: 140, setCode: '14'},
    ],
    sets: {14: {name: 'Hyperia City'}},
  };

  it('takes the Core cards of allCards.json plus the preview cards it lacks', () => {
    const pool = buildPool({main, preview, engine: fakeEngine()});
    expect(pool.cards.map((card) => card.id)).toEqual(['1', '3', '140']);
    expect(pool.label).toBe('sets 9-10 plus the Set 14 preview');
    expect(pool.setName('14')).toBe('Hyperia City');
  });

  it('keys raw records by the transformed id', () => {
    const pool = buildPool({main, preview: null, engine: fakeEngine()});
    expect(pool.raw.get('3')).toBe(main.cards[2]);
    expect(pool.label).toBe('sets 9-10');
  });
});

describe('createCoverage pairs', () => {
  // Each tagged card pairs with every other tagged card at its own score.
  const rule = {
    id: 'tagged',
    matches: (card) => card.score !== undefined,
    findSynergies: (card, cards) =>
      cards
        .filter((other) => other.id !== card.id && other.score !== undefined)
        .map((other) => ({card: other, score: card.score, explanation: `{A} reads ${card.name}`})),
  };
  const cards = [
    {id: 1, setCode: '9', name: 'One', score: 6},
    {id: 2, setCode: '9', name: 'Two', score: 8},
    {id: 3, setCode: '9', name: 'Three', score: 6},
    {id: 4, setCode: '9', name: 'Four'},
  ];
  const engine = fakeEngine([rule]);
  const coverage = createCoverage({
    engine,
    pool: buildPool({main: {cards, sets: {}}, preview: null, engine}),
  });

  it('counts each pair once, with the better of its two readings', () => {
    const pairs = coverage.pairs('tagged');
    expect(pairs.map((pair) => pair.key)).toEqual(['1:2', '1:3', '2:3']);
    expect(pairs.map((pair) => pair.score)).toEqual([8, 6, 8]);
  });

  it("keeps the lower-id card's reading on a tie", () => {
    const tie = coverage.pairs('tagged').find((pair) => pair.key === '1:3');
    expect(tie.explanation).toBe('{A} reads One');
  });

  it("lists each card's partners as its own page does", () => {
    expect([...coverage.partners('tagged').get('2')].sort()).toEqual(['1', '3']);
    expect(coverage.partners('tagged').has('4')).toBe(false);
  });

  it('fails on a rule the engine does not have', () => {
    expect(() => coverage.pairs('missing')).toThrow('no rule "missing" in the engine');
  });

  it('fails when a role helper returns a role the spec does not list', () => {
    expect(() => coverage.roles(() => ['member', 'payoff'], ['member'])).toThrow(
      'role "payoff" is missing from the coverage spec',
    );
  });
});

describe('namedOrder', () => {
  it('follows the explanation, which may name the partner first', () => {
    const [searcher, partner] = [{id: '1'}, {id: '2'}];
    const pair = {cards: [searcher, partner], searcher, explanation: '{B} plays {A} for free.'};
    expect(namedOrder(pair)).toEqual([partner, searcher]);
  });
});

describe('templatePattern', () => {
  const pattern = templatePattern(
    "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect.",
  );

  it('matches the explanations a tunable template produces and captures each token', () => {
    const match = "{B} adds ink to your inkwell, triggering {A}'s inkwell effect.".match(pattern);
    expect(match.groups).toEqual({RAMP: '{B}', TRIGGER: '{A}'});
  });

  it('takes the template literally', () => {
    expect(pattern.test("{B} adds ink to your inkwell, triggering {A}'s inkwell effect!")).toBe(
      false,
    );
  });
});
