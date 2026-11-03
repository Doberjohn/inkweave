import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {OwnBindersAsk} from './binders/binderChoices';
import type {CollectionEntries} from './collectionParser';
import {useOwnBinders} from './useOwnBinders';

const repo = vi.hoisted(() => ({listBinders: vi.fn()}));
vi.mock('./binders/binderRepository', () => repo);
// The real queue, watched: each read must wait in it.
const queue = vi.hoisted(() => ({enqueueWrite: vi.fn()}));
vi.mock('./collectionWriteQueue', async (actual) => {
  const real = await actual<typeof import('./collectionWriteQueue')>();
  queue.enqueueWrite.mockImplementation(real.enqueueWrite);
  return queue;
});

const AMBER = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: null, place: 0};
const EPICS = {id: 'b2', name: 'Epics', scope: 'all', rules: 'rarity=Epic', coverId: null, place: 1};
const SET_12 = {id: 'b3', name: 'Wilds', scope: '12', rules: '', coverId: null, place: 2};

const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-common'}),
  cardOf({id: 'amber-rare', rarity: 'Rare'}),
  cardOf({id: 'steel-epic', ink: 'Steel', rarity: 'Epic', setCode: '11'}),
];
const ENTRIES: CollectionEntries = {'amber-common': {normal: 1, foil: 0}, 'amber-rare': {normal: 1, foil: 0}};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
  document.dispatchEvent(new Event('visibilitychange'));
}

const READER: OwnBindersAsk = {uid: 'me', hasCollection: true, syncing: false, wanted: true, requested: null};
const render = (ask: Partial<OwnBindersAsk> = {}) =>
  renderHook((props: OwnBindersAsk) => useOwnBinders(props, POOL, ENTRIES), {initialProps: {...READER, ...ask}});

/** Forgets every binder between tests, which share the store: signing out does it. */
async function forgetAll() {
  const {follow} = await import('./binders/ownBinders');
  follow({...READER, uid: null});
}

beforeEach(async () => {
  await forgetAll();
  repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
});

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
});

describe('useOwnBinders: the shelf', () => {
  it('reads nothing until the account has answered and collection mode wants them', async () => {
    const {result, rerender} = render({syncing: true});
    expect(result.current.shelf?.status).toBe('idle');
    rerender({...READER, wanted: false});
    expect(result.current.shelf?.status).toBe('idle');
    expect(repo.listBinders).not.toHaveBeenCalled();

    rerender(READER);
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([AMBER]));
    expect(result.current.shelf?.status).toBe('ready');
    expect(repo.listBinders).toHaveBeenCalledWith('me');
  });

  it("waits in the collection's write queue for each read", async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('ready'));
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
  });

  it('reads once a visit, again when the tab is shown', async () => {
    const {result, unmount} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('ready'));
    unmount();
    const again = render();
    expect(again.result.current.shelf?.binders).toEqual([AMBER]);
    expect(repo.listBinders).toHaveBeenCalledOnce();

    repo.listBinders.mockResolvedValue({data: [AMBER, EPICS], error: null});
    act(() => setVisibility('visible'));
    await waitFor(() => expect(again.result.current.shelf?.binders).toEqual([AMBER, EPICS]));
  });

  it('says a first read failed, and its Try again reads again', async () => {
    repo.listBinders.mockResolvedValue({data: null, error: 'Network error'});
    const {result} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('failed'));

    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    act(() => result.current.shelf?.retry());
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([AMBER]));
  });

  it('reads again the next time collection mode wants them, after a read that failed', async () => {
    repo.listBinders.mockResolvedValue({data: null, error: 'Network error'});
    const {result, rerender} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('failed'));

    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    rerender({...READER, wanted: false});
    rerender(READER);
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([AMBER]));
  });

  it('keeps the binders on show when a re-read fails', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('ready'));
    repo.listBinders.mockResolvedValue({data: null, error: 'Network error'});
    act(() => setVisibility('visible'));
    await waitFor(() => expect(repo.listBinders).toHaveBeenCalledTimes(2));
    expect(result.current.shelf).toMatchObject({status: 'ready', binders: [AMBER]});
  });

  it('empties the shelf with no read when a Clear takes the collection', async () => {
    const {result, rerender} = render();
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([AMBER]));
    rerender({...READER, hasCollection: false});
    expect(result.current.shelf).toMatchObject({status: 'ready', binders: []});
    // An import after the Clear starts a collection with no binders: nothing to read.
    rerender(READER);
    expect(result.current.shelf).toMatchObject({status: 'ready', binders: []});
    expect(repo.listBinders).toHaveBeenCalledOnce();
  });

  it('forgets them on signing out, and another account reads its own', async () => {
    const {result, rerender} = render();
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([AMBER]));
    rerender({...READER, uid: null});
    expect(result.current.shelf?.binders).toEqual([]);

    repo.listBinders.mockResolvedValue({data: [EPICS], error: null});
    rerender({...READER, uid: 'other'});
    await waitFor(() => expect(result.current.shelf?.binders).toEqual([EPICS]));
    expect(repo.listBinders).toHaveBeenLastCalledWith('other');
  });

  it("keeps nothing in the browser's storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const {result} = render();
    await waitFor(() => expect(result.current.shelf?.status).toBe('ready'));
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('useOwnBinders: the binder ?custom= names', () => {
  it('is none with no param, and the pool stays whole', () => {
    const {result} = render();
    expect(result.current.custom.status).toBe('none');
    expect(result.current.pool).toBe(POOL);
  });

  it('loads while the shelf answers, then shows the binder over its own cards', async () => {
    const {result} = render({requested: 'b1'});
    expect(result.current.custom.status).toBe('loading');
    await waitFor(() => expect(result.current.custom.status).toBe('shown'));
    expect(result.current.pool.map((card) => card.id)).toEqual(['amber-common', 'amber-rare']);
    expect(result.current.custom).toMatchObject({binder: AMBER, narrowed: true, cover: {id: 'amber-rare'}});
  });

  it('keeps its cards while only the copies change, and its cover follows them', async () => {
    const {result, rerender} = renderHook(
      ({entries}: {entries: CollectionEntries}) => useOwnBinders({...READER, requested: 'b1'}, POOL, entries),
      {initialProps: {entries: ENTRIES}},
    );
    await waitFor(() => expect(result.current.custom.status).toBe('shown'));
    const cards = result.current.pool;

    rerender({entries: {'amber-common': {normal: 1, foil: 0}}});
    expect(result.current.pool).toBe(cards);
    expect(result.current.custom).toMatchObject({cover: {id: 'amber-common'}});
  });

  it('is not narrowed for a binder of Sets alone', async () => {
    repo.listBinders.mockResolvedValue({data: [SET_12], error: null});
    const {result} = render({requested: 'b3'});
    await waitFor(() => expect(result.current.custom).toMatchObject({status: 'shown', narrowed: false}));
    expect(result.current.pool.map((card) => card.id)).toEqual(['amber-common', 'amber-rare']);
  });

  it("is unknown for an id the reader's shelf doesn't hold", async () => {
    const {result} = render({requested: 'someone-elses'});
    await waitFor(() => expect(result.current.custom.status).toBe('unknown'));
    expect(result.current.pool).toBe(POOL);
  });

  it('fails with the shelf, and its Try again reads again', async () => {
    repo.listBinders.mockResolvedValue({data: null, error: 'Network error'});
    const {result} = render({requested: 'b1'});
    await waitFor(() => expect(result.current.custom.status).toBe('failed'));

    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    const {custom} = result.current;
    act(() => (custom.status === 'failed' ? custom.retry() : undefined));
    await waitFor(() => expect(result.current.custom.status).toBe('shown'));
  });
});

describe('loadBinders', () => {
  afterEach(() => vi.resetModules());

  // main.tsx cancels Vite's preload error in production, so a stale chunk resolves to nothing.
  it('fails an import that resolves empty, as a stale chunk does, and asks again next time', async () => {
    vi.resetModules();
    const {loadBinders} = await import('./useOwnBinders');
    await expect(loadBinders(() => Promise.resolve(undefined))).rejects.toThrow('resolved empty');

    const module = await import('./binders/ownBinders');
    await expect(loadBinders(() => Promise.resolve(module))).resolves.toBe(module);
  });
});

describe('useOwnBinders with binders off', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads no binder code, reads nothing, and keeps the whole pool', async () => {
    vi.stubEnv('VITE_SHOW_BINDERS', 'false');
    vi.resetModules();
    const {useOwnBinders: offHook} = await import('./useOwnBinders');
    const {result} = renderHook(() => offHook({...READER, requested: 'b1'}, POOL, ENTRIES));
    await act(async () => {});
    expect(result.current).toEqual({shelf: null, custom: {status: 'none'}, pool: POOL});
    expect(repo.listBinders).not.toHaveBeenCalled();
  });
});
