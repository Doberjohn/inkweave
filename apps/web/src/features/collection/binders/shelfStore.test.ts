import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {enqueueWrite} from '../collectionWriteQueue';
import {SHELF_FULL, type ShelfLook} from './binderRepository';
import {
  createBinder,
  deleteBinder,
  follow,
  moveBinder,
  setCover,
  setMyCollection,
  snapshot,
  updateBinder,
  viewOf,
  type BinderReader,
} from './shelfStore';
import {rememberedPages} from './rememberedPages';

const repo = vi.hoisted(() => ({
  listBinders: vi.fn(),
  moveBinderRow: vi.fn(),
  deleteBinderRow: vi.fn(),
  insertBinderRow: vi.fn(),
  updateBinderRow: vi.fn(),
  getShelf: vi.fn(),
  setShelf: vi.fn(),
}));
vi.mock('./binderRepository', async (actual) => {
  const {SHELF_FULL, SHELF_DEFAULT} = await actual<typeof import('./binderRepository')>();
  return {SHELF_FULL, SHELF_DEFAULT, ...repo};
});
// The real queue, watched: each change must wait in it, as the reads do.
const queue = vi.hoisted(() => ({enqueueWrite: vi.fn()}));
vi.mock('../collectionWriteQueue', async (actual) => {
  const real = await actual<typeof import('../collectionWriteQueue')>();
  queue.enqueueWrite.mockImplementation(real.enqueueWrite);
  return queue;
});

const AMBER = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', pages: 4, cover: null, place: 0};
const EPICS = {id: 'b2', name: 'Epics', scope: 'all', rules: 'rarity=Epic', pages: 4, cover: null, place: 1};
// A gap a delete left: places needn't follow on.
const WILDS = {id: 'b3', name: 'Wilds', scope: '12', rules: '', pages: 4, cover: null, place: 4};

const READER: BinderReader = {uid: 'me', hasCollection: true, syncing: false, wanted: true};

/** What the store holds for the reader: their binders' ids in order, or its state. */
function shown(): string[] | string | undefined {
  const value = snapshot()?.value;
  return typeof value === 'string' ? value : value?.map((binder) => binder.id);
}

/** Reads the reader's shelf into the store, as collection mode does. */
async function loadShelf(look: ShelfLook = {pages: 4, cover: null}) {
  repo.listBinders.mockResolvedValue({data: [AMBER, EPICS, WILDS], error: null});
  repo.getShelf.mockResolvedValue({data: look, error: null});
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

/** A promise the test settles by hand, to look at the store while a change waits on the server. */
function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (settle = resolve));
  return {promise, settle};
}

describe('moveBinder', () => {
  it("swaps two binders' places once the server has, through the write queue", async () => {
    const answer = deferred<{data: boolean; error: null}>();
    repo.moveBinderRow.mockReturnValue(answer.promise);
    // The read after it: what the server holds once it has moved.
    const after = [AMBER, {...WILDS, place: 1}, {...EPICS, place: 4}];
    repo.listBinders.mockResolvedValue({data: after, error: null});
    const moving = moveBinder({readerId: 'me', id: 'b2', earlier: false});
    await vi.waitFor(() => expect(repo.moveBinderRow).toHaveBeenCalledExactlyOnceWith('b2', false));
    // Nothing shows before the server answers.
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
    answer.settle({data: true, error: null});
    await expect(moving).resolves.toBe('moved');
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    // Each keeps the other's place, gap and all, from the moment the server answers.
    expect(snapshot()?.value).toEqual(after);
    await vi.waitFor(() => expect(repo.listBinders).toHaveBeenCalledOnce());
  });

  it("shows the server's order after a move another device's change made otherwise", async () => {
    repo.moveBinderRow.mockResolvedValue({data: true, error: null});
    // Another device deleted Epics: the server swapped Amber with Wilds, not Epics.
    repo.listBinders.mockResolvedValue({data: [{...WILDS, place: 0}, {...AMBER, place: 4}], error: null});
    await expect(moveBinder({readerId: 'me', id: 'b1', earlier: false})).resolves.toBe('moved');
    await vi.waitFor(() => expect(shown()).toEqual(['b3', 'b1']));
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
    const answer = deferred<{data: null; error: null}>();
    repo.deleteBinderRow.mockReturnValue(answer.promise);
    const deleting = deleteBinder({readerId: 'me', id: 'b2'});
    await vi.waitFor(() => expect(repo.deleteBinderRow).toHaveBeenCalledExactlyOnceWith('b2'));
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
    answer.settle({data: null, error: null});
    await expect(deleting).resolves.toBe(true);
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    expect(shown()).toEqual(['b1', 'b3']);
  });

  it('keeps it when the delete fails', async () => {
    repo.deleteBinderRow.mockResolvedValue({data: null, error: 'Network error'});
    await expect(deleteBinder({readerId: 'me', id: 'b2'})).resolves.toBe(false);
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
  });
});

const INPUT = {name: 'Rares', scope: 'all', rules: 'rarity=Rare', pages: 4 as const, cover: null};
const RARES = {...INPUT, id: 'b9', place: 5};

describe('createBinder', () => {
  it('puts the new binder at the shelf\'s end once the server has it, through the write queue', async () => {
    const answer = deferred<{data: typeof RARES; error: null}>();
    repo.insertBinderRow.mockReturnValue(answer.promise);
    const creating = createBinder({readerId: 'me', input: INPUT});
    await vi.waitFor(() => expect(repo.insertBinderRow).toHaveBeenCalledExactlyOnceWith('me', INPUT));
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
    answer.settle({data: RARES, error: null});
    await expect(creating).resolves.toEqual({binder: RARES});
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    expect(shown()).toEqual(['b1', 'b2', 'b3', 'b9']);
    expect(repo.listBinders).not.toHaveBeenCalled();
  });

  it('waits for a Clear queued before it', async () => {
    const clearing = deferred<void>();
    void enqueueWrite('me', () => clearing.promise);
    repo.insertBinderRow.mockResolvedValue({data: RARES, error: null});
    const creating = createBinder({readerId: 'me', input: INPUT});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(repo.insertBinderRow).not.toHaveBeenCalled();
    clearing.settle();
    await expect(creating).resolves.toEqual({binder: RARES});
  });

  it('says the shelf is full at the cap, and reads it again to show the binders made elsewhere', async () => {
    repo.insertBinderRow.mockResolvedValue({data: null, error: SHELF_FULL});
    await expect(createBinder({readerId: 'me', input: INPUT})).resolves.toEqual({problem: 'full'});
    await vi.waitFor(() => expect(repo.listBinders).toHaveBeenCalledOnce());
  });

  it('keeps the shelf when the save fails', async () => {
    repo.insertBinderRow.mockResolvedValue({data: null, error: 'Network error'});
    await expect(createBinder({readerId: 'me', input: INPUT})).resolves.toEqual({problem: 'failed'});
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
  });
});

describe('updateBinder', () => {
  it("shows the server's row in the binder's place, and never touches the browser's storage", async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    const changed = {...EPICS, rules: 'rarity=Epic&ink=Amber'};
    repo.updateBinderRow.mockResolvedValue({data: changed, error: null});
    await expect(updateBinder({readerId: 'me', id: 'b2', patch: {rules: changed.rules}})).resolves.toEqual({binder: changed});
    expect(repo.updateBinderRow).toHaveBeenCalledExactlyOnceWith('b2', {rules: changed.rules});
    expect(snapshot()?.value).toEqual([AMBER, changed, WILDS]);
    expect(stored).not.toHaveBeenCalled();
    stored.mockRestore();
  });

  it('takes a binder the server no longer holds off the shelf', async () => {
    repo.updateBinderRow.mockResolvedValue({data: null, error: null});
    await expect(updateBinder({readerId: 'me', id: 'b2', patch: {name: 'Gold'}})).resolves.toEqual({problem: 'gone'});
    expect(shown()).toEqual(['b1', 'b3']);
  });

  it('keeps the binder as it was when the change fails', async () => {
    repo.updateBinderRow.mockResolvedValue({data: null, error: 'Network error'});
    await expect(updateBinder({readerId: 'me', id: 'b2', patch: {name: 'Gold'}})).resolves.toEqual({problem: 'failed'});
    expect(snapshot()?.value).toEqual([AMBER, EPICS, WILDS]);
  });
});

describe("My collection's page size and cover", () => {
  /** What the page reads of the store: My collection's once the shelf is ready. */
  const mine = () => viewOf(snapshot(), READER).myCollection;
  const TARTAN: ShelfLook = {pages: 3, cover: 'tartan'};

  it('are read with the binders, in the same queued read', async () => {
    follow({...READER, uid: null});
    await loadShelf(TARTAN);
    expect(repo.getShelf).toHaveBeenCalledWith('me');
    expect(mine()).toEqual(TARTAN);
  });

  it('show the binders at the defaults when only they fail to read', async () => {
    follow({...READER, uid: null});
    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    repo.getShelf.mockResolvedValue({data: null, error: 'Network error'});
    const stop = follow(READER);
    await vi.waitFor(() => expect(shown()).toEqual(['b1']));
    expect(mine()).toEqual({pages: 4, cover: null});
    stop?.();
  });

  it('keep the ones on show when a read again fails to read them', async () => {
    follow({...READER, uid: null});
    await loadShelf(TARTAN);
    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    repo.getShelf.mockResolvedValue({data: null, error: 'Network error'});
    viewOf(snapshot(), READER).retry();
    await vi.waitFor(() => expect(shown()).toEqual(['b1']));
    expect(mine()).toEqual(TARTAN);
  });

  it('set the cover through the write queue, and show it once the server has, the size and binders kept', async () => {
    follow({...READER, uid: null});
    await loadShelf(TARTAN);
    const answer = deferred<{data: null; error: null}>();
    repo.setShelf.mockReturnValue(answer.promise);
    const setting = setCover({readerId: 'me', id: null, cover: 'argyle'});
    await vi.waitFor(() => expect(repo.setShelf).toHaveBeenCalledExactlyOnceWith('me', {cover: 'argyle'}));
    expect(mine()).toEqual(TARTAN);
    answer.settle({data: null, error: null});
    await expect(setting).resolves.toBe('set');
    expect(queue.enqueueWrite).toHaveBeenCalledWith('me', expect.any(Function));
    expect(mine()).toEqual({pages: 3, cover: 'argyle'});
    expect(shown()).toEqual(['b1', 'b2', 'b3']);
  });

  it('set the page size alone, and show it once the server has, the cover kept', async () => {
    follow({...READER, uid: null});
    await loadShelf(TARTAN);
    repo.setShelf.mockResolvedValue({data: null, error: null});
    await expect(setMyCollection({readerId: 'me', patch: {pages: 2}})).resolves.toBe(true);
    expect(repo.setShelf).toHaveBeenCalledExactlyOnceWith('me', {pages: 2});
    expect(mine()).toEqual({pages: 2, cover: 'tartan'});
  });

  it('keep the cover they had when the save fails', async () => {
    repo.setShelf.mockResolvedValue({data: null, error: 'Network error'});
    await expect(setCover({readerId: 'me', id: null, cover: 'argyle'})).resolves.toBe('failed');
    expect(mine()).toEqual({pages: 4, cover: null});
  });

  it('stay through a change to a binder', async () => {
    follow({...READER, uid: null});
    await loadShelf(TARTAN);
    repo.deleteBinderRow.mockResolvedValue({data: null, error: null});
    await deleteBinder({readerId: 'me', id: 'b2'});
    expect(mine()).toEqual(TARTAN);
  });
});

describe("the page size this browser remembers for My collection", () => {
  afterEach(() => localStorage.clear());

  it('is what each read of the row answers, a new binder\'s size with no row', async () => {
    follow({...READER, uid: null});
    await loadShelf({pages: 3, cover: null});
    expect(rememberedPages('me')).toBe(3);
    follow({...READER, uid: null});
    await loadShelf();
    expect(rememberedPages('me')).toBe(4);
  });

  it('stays when a read fails to read the row', async () => {
    follow({...READER, uid: null});
    await loadShelf({pages: 3, cover: null});
    repo.getShelf.mockClear();
    repo.getShelf.mockResolvedValue({data: null, error: 'Network error'});
    // The binders read changes, so the re-read shows once it has finished.
    repo.listBinders.mockResolvedValue({data: [AMBER], error: null});
    viewOf(snapshot(), READER).retry();
    await vi.waitFor(() => expect(shown()).toEqual(['b1']));
    expect(repo.getShelf).toHaveBeenCalledOnce();
    expect(rememberedPages('me')).toBe(3);
  });

  it('is not put back by a read a Clear overtook', async () => {
    follow({...READER, uid: null});
    const row = deferred<{data: ShelfLook; error: null}>();
    repo.getShelf.mockReturnValue(row.promise);
    follow(READER);
    await vi.waitFor(() => expect(repo.getShelf).toHaveBeenCalled());
    follow({...READER, hasCollection: false});
    row.settle({data: {pages: 2, cover: null}, error: null});
    // Every step of the read's answer has run by the next task.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rememberedPages('me')).toBeNull();
  });

  it('is not put back by a size change a Clear overtook', async () => {
    const answer = deferred<{data: null; error: null}>();
    repo.setShelf.mockReturnValue(answer.promise);
    const changing = setMyCollection({readerId: 'me', patch: {pages: 2}});
    await vi.waitFor(() => expect(repo.setShelf).toHaveBeenCalled());
    follow({...READER, hasCollection: false});
    answer.settle({data: null, error: null});
    await expect(changing).resolves.toBe(true);
    expect(rememberedPages('me')).toBeNull();
  });

  it('follows a size change once the server has it, and never a failed one', async () => {
    repo.setShelf.mockResolvedValue({data: null, error: null});
    await setMyCollection({readerId: 'me', patch: {pages: 2}});
    expect(rememberedPages('me')).toBe(2);
    repo.setShelf.mockResolvedValue({data: null, error: 'Network error'});
    await setMyCollection({readerId: 'me', patch: {pages: 3}});
    expect(rememberedPages('me')).toBe(2);
  });

  it('is forgotten once a Clear has taken the collection, and its row with it', () => {
    follow({...READER, hasCollection: false});
    expect(rememberedPages('me')).toBeNull();
  });

  it("leaves the shelf and its size to the read where the browser refuses its storage", async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    follow({...READER, uid: null});
    await loadShelf({pages: 3, cover: null});
    expect(viewOf(snapshot(), READER).myCollection).toEqual({pages: 3, cover: null});
    // What it had before stays.
    expect(rememberedPages('me')).toBe(4);
    vi.restoreAllMocks();
  });
});

describe("a binder's cover", () => {
  it("sets it as a change to the binder's row, and shows the server's row", async () => {
    const changed = {...EPICS, cover: 'tartan'};
    repo.updateBinderRow.mockResolvedValue({data: changed, error: null});
    await expect(setCover({readerId: 'me', id: 'b2', cover: 'tartan'})).resolves.toBe('set');
    expect(repo.updateBinderRow).toHaveBeenCalledExactlyOnceWith('b2', {cover: 'tartan'});
    expect(repo.setShelf).not.toHaveBeenCalled();
    expect(snapshot()?.value).toEqual([AMBER, changed, WILDS]);
  });

  it('says a binder deleted elsewhere is gone', async () => {
    repo.updateBinderRow.mockResolvedValue({data: null, error: null});
    await expect(setCover({readerId: 'me', id: 'b2', cover: 'tartan'})).resolves.toBe('gone');
  });
});
