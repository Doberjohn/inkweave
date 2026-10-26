import {afterEach, describe, it, expect, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {stepNeighbours, usePreloadSiblingSynergies} from '../usePreloadSiblingSynergies';
import type {SiblingSynergiesPreload} from '../usePreloadSiblingSynergies';
import {fetchCardSynergies} from '../usePrecomputedSynergies';

const coreIds = new Set<string>();
// Stable like the real context's, so the hook's effect runs only when its inputs change.
const mockGetCardById = (id: string) => (coreIds.has(id) ? ({id} as LorcanaCard) : undefined);

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: mockGetCardById}),
}));

/** The work waiting for the page to go idle, which a test runs with `goIdle`. */
const idleWork = new Set<() => void>();

vi.mock('inkweave-ui/lib/whenLoadedAndIdle', () => ({
  whenIdle: (callback: () => void) => {
    idleWork.add(callback);
    return () => idleWork.delete(callback);
  },
}));

/** The page goes idle: runs the work waiting for it. */
function goIdle() {
  for (const work of idleWork) work();
  idleWork.clear();
}

/** Core cards the mocked card list holds. Ids are unique per test: the fetch cache outlives each test. */
function core(...ids: string[]): string[] {
  for (const id of ids) coreIds.add(id);
  return ids;
}

/** A synergy file's answer. */
function file(data: unknown) {
  return {ok: true, status: 200, headers: {get: () => 'application/json'}, json: async () => data};
}

/** Answers every synergy fetch with an empty file, and returns the ids fetched, in order. */
function recordFetches(): string[] {
  const fetched: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetched.push(/synergies\/(\w+)\.json/.exec(url)?.[1] ?? url);
      return file({groups: [], pairs: {}});
    }),
  );
  return fetched;
}

function renderPreload(initial: SiblingSynergiesPreload) {
  return renderHook((props: SiblingSynergiesPreload) => usePreloadSiblingSynergies(props), {initialProps: initial});
}

afterEach(() => {
  idleWork.clear();
  vi.unstubAllGlobals();
});

describe('stepNeighbours', () => {
  it('names the previous and the next card, wrapping at both ends as the arrows do', () => {
    expect(stepNeighbours(['a', 'b', 'c', 'd'], 1)).toEqual(['a', 'c']);
    expect(stepNeighbours(['a', 'b', 'c', 'd'], 0)).toEqual(['d', 'b']);
    expect(stepNeighbours(['a', 'b', 'c', 'd'], 3)).toEqual(['c', 'a']);
  });

  it('names none where the arrows step nowhere: one card, or a card not in the list', () => {
    expect(stepNeighbours(['a'], 0)).toEqual([]);
    expect(stepNeighbours(['a', 'b', 'c'], -1)).toEqual([]);
  });
});

describe('usePreloadSiblingSynergies', () => {
  it("fetches the previous and the next card's synergies once the open card's have settled and the page is idle", async () => {
    const fetched = recordFetches();
    const ids = core('8101', '8102', '8103', '8104');
    const {rerender} = renderPreload({ids, index: 1, settled: false});
    goIdle();
    expect(fetched).toEqual([]);

    rerender({ids, index: 1, settled: true});
    expect(fetched).toEqual([]);
    goIdle();
    await waitFor(() => expect(fetched).toEqual(['8101', '8103']));
  });

  it("fetches only the new neighbour's synergies after a step", async () => {
    const fetched = recordFetches();
    const ids = core('8201', '8202', '8203', '8204');
    // The open card's own, as the window fetches it.
    await fetchCardSynergies('8202');
    const {rerender} = renderPreload({ids, index: 1, settled: true});
    goIdle();
    await waitFor(() => expect(fetched).toEqual(['8202', '8201', '8203']));

    rerender({ids, index: 2, settled: true});
    goIdle();
    // The card it left and the one it opened are in hand, so only the card past it is new.
    await waitFor(() => expect(fetched).toEqual(['8202', '8201', '8203', '8204']));
  });

  it('fetches nothing for a card the window steps past before the page goes idle', async () => {
    const fetched = recordFetches();
    const ids = core('8501', '8502', '8503', '8504', '8505');
    const {rerender} = renderPreload({ids, index: 1, settled: true});

    rerender({ids, index: 3, settled: true});
    goIdle();
    await waitFor(() => expect(fetched).toEqual(['8503', '8505']));
  });

  it('skips a neighbour outside Core, which has no synergy file', async () => {
    const fetched = recordFetches();
    const [first, third] = core('8301', '8303');
    renderPreload({ids: [first, '8399', third], index: 0, settled: true});
    goIdle();

    await waitFor(() => expect(fetched).toEqual(['8303']));
  });

  it("keeps a failed preload to itself, and the card's own open fetches its file", async () => {
    const synergies = {groups: [{groupKey: 'ramp', synergies: []}], pairs: {}};
    const fetchMock = vi.fn().mockResolvedValueOnce({ok: false, status: 503});
    vi.stubGlobal('fetch', fetchMock);
    renderPreload({ids: core('8401', '8402'), index: 0, settled: true});
    goIdle();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    // The rejection settles here: uncaught, it would fail the run as an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Kept, the 503 would read as no synergies for the rest of the visit.
    fetchMock.mockResolvedValue(file(synergies));
    await expect(fetchCardSynergies('8402')).resolves.toEqual(synergies);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
