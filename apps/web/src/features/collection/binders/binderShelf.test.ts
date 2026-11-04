import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {deleteBinder, follow, moveBinder, snapshot, type BinderReader} from './binderShelf';

const repo = vi.hoisted(() => ({listBinders: vi.fn(), moveBinderRow: vi.fn(), deleteBinderRow: vi.fn()}));
vi.mock('./binderRepository', () => repo);
// The real queue, watched: each change must wait in it, as the reads do.
const queue = vi.hoisted(() => ({enqueueWrite: vi.fn()}));
vi.mock('../collectionWriteQueue', async (actual) => {
  const real = await actual<typeof import('../collectionWriteQueue')>();
  queue.enqueueWrite.mockImplementation(real.enqueueWrite);
  return queue;
});

const AMBER = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', coverId: null, place: 0};
const EPICS = {id: 'b2', name: 'Epics', scope: 'all', rules: 'rarity=Epic', coverId: null, place: 1};
// A gap a delete left: places needn't follow on.
const WILDS = {id: 'b3', name: 'Wilds', scope: '12', rules: '', coverId: null, place: 4};

const READER: BinderReader = {uid: 'me', hasCollection: true, syncing: false, wanted: true};

/** What the store holds for the reader: their binders' ids in order, or its state. */
function shown(): string[] | string | undefined {
  const value = snapshot()?.value;
  return typeof value === 'string' ? value : value?.map((binder) => binder.id);
}

/** Reads the reader's shelf into the store, as collection mode does. */
async function loadShelf() {
  repo.listBinders.mockResolvedValue({data: [AMBER, EPICS, WILDS], error: null});
  const stop = follow(READER);
  await vi.waitFor(() => expect(shown()).toEqual(['b1', 'b2', 'b3']));
  stop?.();
  repo.listBinders.mockClear();
}

beforeEach(async () => {
  follow({...READER, uid: null});
  await loadShelf();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('moveBinder', () => {
  it("swaps two binders' places once the server has, through the write queue", async () => {
    repo.moveBinderRow.mockResolvedValue({data: true, error: null});
    await expect(moveBinder({readerId: 'me', id: 'b2', earlier: false})).resolves.toBe('moved');
    expect(repo.moveBinderRow).toHaveBeenCalledExactlyOnceWith('b2', false);
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    expect(shown()).toEqual(['b1', 'b3', 'b2']);
    // Each keeps the other's place, gap and all.
    expect(snapshot()?.value).toEqual([AMBER, {...WILDS, place: 1}, {...EPICS, place: 4}]);
  });

  it('keeps the order when the move fails', async () => {
    repo.moveBinderRow.mockResolvedValue({data: null, error: 'Network error'});
    await expect(moveBinder({readerId: 'me', id: 'b1', earlier: false})).resolves.toBe('failed');
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
    expect(repo.listBinders).not.toHaveBeenCalled();
  });

  it('reads the shelf again when the server found no neighbour, as after another tab moved it', async () => {
    repo.moveBinderRow.mockResolvedValue({data: false, error: null});
    repo.listBinders.mockResolvedValue({data: [EPICS, AMBER, WILDS], error: null});
    await expect(moveBinder({readerId: 'me', id: 'b1', earlier: true})).resolves.toBe('unmoved');
    await vi.waitFor(() => expect(shown()).toEqual(['b2', 'b1', 'b3']));
  });
});

describe('deleteBinder', () => {
  it('takes the binder off the shelf once the server has deleted it', async () => {
    repo.deleteBinderRow.mockResolvedValue({data: null, error: null});
    await expect(deleteBinder({readerId: 'me', id: 'b2'})).resolves.toBe(true);
    expect(repo.deleteBinderRow).toHaveBeenCalledExactlyOnceWith('b2');
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    expect(shown()).toEqual(['b1', 'b3']);
  });

  it('keeps it when the delete fails', async () => {
    repo.deleteBinderRow.mockResolvedValue({data: null, error: 'Network error'});
    await expect(deleteBinder({readerId: 'me', id: 'b2'})).resolves.toBe(false);
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
  });
});
