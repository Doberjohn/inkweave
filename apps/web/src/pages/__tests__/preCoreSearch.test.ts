import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {createCard} from '../../shared/test-utils';

const {loadPreCoreSearchCards} = vi.hoisted(() => ({loadPreCoreSearchCards: vi.fn()}));
vi.mock('../../features/collection/collectionChunks', () => ({loadPreCoreSearchCards}));

// The cards are kept at module level for the visit, so each test starts from a fresh copy.
async function freshSearch() {
  vi.resetModules();
  return import('../preCoreSearch');
}

const onHumanLegs = createCard({id: '1', name: 'Ariel', fullName: 'Ariel - On Human Legs', setCode: '1'});
// Lets the mocked dynamic import settle.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('usePreCoreSearchCards', () => {
  beforeEach(() => {
    loadPreCoreSearchCards.mockReset();
  });

  it('loads nothing until a search asks', async () => {
    const {usePreCoreSearchCards} = await freshSearch();

    const {result} = renderHook(() => usePreCoreSearchCards(false));
    await flush();

    expect(loadPreCoreSearchCards).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({cards: [], isLoading: false});
  });

  it('is loading from the first render a search asks, before its effect starts the load', async () => {
    loadPreCoreSearchCards.mockReturnValue(new Promise(() => {}));
    const {usePreCoreSearchCards} = await freshSearch();
    const rendered: boolean[] = [];

    renderHook(() => {
      const search = usePreCoreSearchCards(true);
      rendered.push(search.isLoading);
      return search;
    });

    // That render paints before the effect runs: a search only sets 1-8 match would flash
    // "No cards match your filters." in between.
    expect(rendered[0]).toBe(true);
  });

  it('loads the cards once and keeps them for the visit, so a later Browse asks for nothing', async () => {
    loadPreCoreSearchCards.mockResolvedValue([onHumanLegs]);
    const {usePreCoreSearchCards} = await freshSearch();

    const first = renderHook(() => usePreCoreSearchCards(true));
    expect(first.result.current.isLoading).toBe(true);
    await waitFor(() => expect(first.result.current.cards).toEqual([onHumanLegs]));
    expect(first.result.current.byId.get('1')).toBe(onHumanLegs);
    first.unmount();

    const later = renderHook(() => usePreCoreSearchCards(true));
    expect(later.result.current).toMatchObject({cards: [onHumanLegs], isLoading: false});
    expect(loadPreCoreSearchCards).toHaveBeenCalledTimes(1);
  });

  it('after a failed load, keeps no cards and tries again only when a new search starts', async () => {
    loadPreCoreSearchCards.mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValue([onHumanLegs]);
    const {usePreCoreSearchCards} = await freshSearch();
    const {result, rerender} = renderHook(({wanted}) => usePreCoreSearchCards(wanted), {
      initialProps: {wanted: true},
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cards).toEqual([]);
    rerender({wanted: true});
    expect(loadPreCoreSearchCards).toHaveBeenCalledTimes(1);

    rerender({wanted: false});
    rerender({wanted: true});
    await waitFor(() => expect(result.current.cards).toEqual([onHumanLegs]));
    expect(loadPreCoreSearchCards).toHaveBeenCalledTimes(2);
  });
});
