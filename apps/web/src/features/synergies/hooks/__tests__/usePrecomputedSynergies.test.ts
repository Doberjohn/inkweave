import {afterEach, describe, it, expect, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import {filterPairByGroup, usePrecomputedSynergies} from '../usePrecomputedSynergies';
import type {PrecomputedPairData} from '../usePrecomputedSynergies';

const mockCardsById: Record<string, LorcanaCard> = {};
// Stable like the real context's: the hook's fetch effect depends on it, so a fresh function
// per render would restart the fetch on every render.
const mockGetCardById = (id: string) => mockCardsById[id];

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: mockGetCardById}),
}));

/** Registers a card the mocked card database can resolve. Ids are unique per test, because
 * the hook's fetch cache is module-level and outlives each test. */
function card(id: string): LorcanaCard {
  mockCardsById[id] = {id, fullName: `Card ${id}`} as LorcanaCard;
  return mockCardsById[id];
}

/** Holds every synergy fetch until the test releases it with one partner for that card. */
function holdSynergyFetches(): (cardId: string, partnerId: string) => void {
  const pending = new Map<string, (data: unknown) => void>();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          const id = /synergies\/(\w+)\.json/.exec(url)?.[1] ?? '';
          pending.set(id, (data) =>
            resolve({ok: true, headers: {get: () => 'application/json'}, json: async () => data}),
          );
        }),
    ),
  );
  return (cardId, partnerId) =>
    pending.get(cardId)?.({
      groups: [
        {
          groupKey: 'shift-targets',
          category: 'direct',
          label: 'Shift',
          tagline: '',
          description: '',
          synergies: [{cardId: partnerId, score: 7, explanation: 'Shifts onto it'}],
        },
      ],
      pairs: {},
    });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePrecomputedSynergies', () => {
  it('reports loading from the first render with a card', () => {
    holdSynergyFetches();
    const selected = card('9101');
    const loadingByRender: boolean[] = [];

    renderHook(() => {
      const result = usePrecomputedSynergies(selected);
      loadingByRender.push(result.isLoading);
      return result;
    });

    // The fetch starts in an effect, after this first render. Reporting "settled" here let the
    // card page render its footer for a frame, under content still to arrive (#532).
    expect(loadingByRender[0]).toBe(true);
  });

  it("settles with the card's groups once its fetch resolves", async () => {
    const release = holdSynergyFetches();
    const selected = card('9201');
    card('9202');

    const {result} = renderHook(() => usePrecomputedSynergies(selected));
    release('9201', '9202');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.synergies[0].synergies[0].card.id).toBe('9202');
  });

  it("reports loading without the previous card's groups when the card changes", async () => {
    const release = holdSynergyFetches();
    const first = card('9301');
    card('9302');
    const second = card('9303');
    const renders: {cardId: string; isLoading: boolean; groups: number}[] = [];

    const {result, rerender} = renderHook(
      ({selected}) => {
        const hook = usePrecomputedSynergies(selected);
        renders.push({cardId: selected.id, isLoading: hook.isLoading, groups: hook.synergies.length});
        return hook;
      },
      {initialProps: {selected: first}},
    );
    release('9301', '9302');
    await waitFor(() => expect(result.current.synergies).toHaveLength(1));
    rerender({selected: second});

    expect(renders.find((r) => r.cardId === '9303')).toEqual({cardId: '9303', isLoading: true, groups: 0});
  });

  it('stops loading as soon as the card goes away', async () => {
    // ComparePage shows its loading state while this is true, so losing the card must not hang it.
    const release = holdSynergyFetches();
    const selected = card('9401');
    card('9402');
    const loadingWithoutCard: boolean[] = [];

    const {result, rerender} = renderHook(
      ({current}: {current: LorcanaCard | null}) => {
        const hook = usePrecomputedSynergies(current);
        if (!current) loadingWithoutCard.push(hook.isLoading);
        return hook;
      },
      {initialProps: {current: selected as LorcanaCard | null}},
    );
    release('9401', '9402');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({current: null});

    expect(loadingWithoutCard.length).toBeGreaterThan(0);
    expect(loadingWithoutCard.every((isLoading) => !isLoading)).toBe(true);
  });
});

const directConnection = (overrides: Partial<PairSynergyConnection> = {}): PairSynergyConnection => ({
  ruleId: 'shift-targets',
  ruleName: 'Shift Targets',
  category: 'direct',
  score: 9,
  explanation: 'Anna can Shift onto Anna - Heir to Arendelle',
  ...overrides,
} as PairSynergyConnection);

const playstyleConnection = (overrides: Partial<PairSynergyConnection> = {}): PairSynergyConnection => ({
  ruleId: 'location-at-payoff',
  ruleName: 'At Location',
  category: 'playstyle',
  playstyleId: 'location-control',
  score: 5,
  explanation: 'Earns extra lore at Arendelle Castle',
  ...overrides,
} as PairSynergyConnection);

describe('filterPairByGroup', () => {
  it('returns the pair unchanged when groupKey is undefined', () => {
    const pair: PrecomputedPairData = {
      connections: [directConnection({score: 9}), playstyleConnection({score: 5})],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, undefined);
    expect(result).toEqual({connections: pair.connections, aggregateScore: 9});
  });

  it('keeps only the matching direct rule and recomputes aggregateScore', () => {
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({ruleId: 'shift-targets', score: 9}),
        directConnection({ruleId: 'named-companions', ruleName: 'Named Companions', score: 6}),
        playstyleConnection({score: 5}),
      ],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'shift-targets');
    expect(result?.connections).toHaveLength(1);
    expect(result?.connections[0].ruleId).toBe('shift-targets');
    expect(result?.aggregateScore).toBe(9);
  });

  it('merges multi-role playstyle connections under the playstyle groupKey', () => {
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({score: 9}),
        playstyleConnection({ruleId: 'location-at-payoff', score: 5}),
        playstyleConnection({ruleId: 'location-buff', score: 4}),
        playstyleConnection({ruleId: 'location-move', score: 3}),
      ],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'location-control');
    expect(result?.connections).toHaveLength(3);
    expect(result?.connections.every((c) => c.category === 'playstyle')).toBe(true);
    expect(result?.aggregateScore).toBe(5);
  });

  it('returns null when no connections match the group', () => {
    const pair: PrecomputedPairData = {
      connections: [directConnection({score: 9})],
      aggregateScore: 9,
    };
    const result = filterPairByGroup(pair, 'ramp');
    expect(result).toBeNull();
  });

  it('does not match a direct ruleId against a playstyle groupKey', () => {
    // Defensive: a direct rule with id 'location-at-payoff' should NOT match
    // the 'location-control' playstyle key — playstyle filters check playstyleId only.
    const pair: PrecomputedPairData = {
      connections: [
        directConnection({ruleId: 'location-at-payoff', category: 'direct', score: 7}),
      ],
      aggregateScore: 7,
    };
    const result = filterPairByGroup(pair, 'location-control');
    expect(result).toBeNull();
  });
});
