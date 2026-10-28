import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {trackEvent} from '../../shared/lib/analytics';
import {enqueueWrite} from './collectionWriteQueue';
import {useCollectionSharing} from './useCollectionSharing';

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: {id: 'me'}, loading: false}),
}));
// The account's collection as the hook sees it, which each case sets.
const collection = vi.hoisted(() => ({hasCollection: true, syncing: false}));
vi.mock('./CollectionContext', () => ({useCollection: () => collection}));
const repo = vi.hoisted(() => ({getSharing: vi.fn(), setSharing: vi.fn()}));
vi.mock('./sharingRepository', () => repo);

beforeEach(() => {
  vi.clearAllMocks();
  collection.hasCollection = true;
  collection.syncing = false;
  repo.getSharing.mockResolvedValue({data: true, error: null});
  repo.setSharing.mockResolvedValue({data: null, error: null});
});

/** A promise the test settles by hand, to look at the switch while a write is in flight. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return {promise, resolve};
}

describe('useCollectionSharing', () => {
  it('reads the switch once the account’s copy has answered, and not before', async () => {
    collection.syncing = true;
    const {result, rerender} = renderHook(() => useCollectionSharing(true));
    expect(repo.getSharing).not.toHaveBeenCalled();

    collection.syncing = false;
    rerender();
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.on).toBe(true);
    expect(repo.getSharing).toHaveBeenCalledWith('me');
  });

  it('reads nothing with friends off', () => {
    renderHook(() => useCollectionSharing(false));
    expect(repo.getSharing).not.toHaveBeenCalled();
  });

  it('shows a write at once, then keeps it and counts it once it lands', async () => {
    repo.getSharing.mockResolvedValue({data: false, error: null});
    const write = deferred<{data: null; error: null}>();
    repo.setSharing.mockReturnValue(write.promise);
    const {result} = renderHook(() => useCollectionSharing(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.set(true));
    expect(result.current).toMatchObject({on: true, busy: true});
    await waitFor(() => expect(repo.setSharing).toHaveBeenCalledWith('me', true));
    expect(trackEvent).not.toHaveBeenCalled();

    await act(async () => write.resolve({data: null, error: null}));
    expect(result.current).toMatchObject({on: true, busy: false, writeFailed: false});
    expect(trackEvent).toHaveBeenCalledWith('collection_sharing_changed', {state: 'on'});
  });

  it('puts the switch back when a write fails, and counts nothing', async () => {
    repo.setSharing.mockResolvedValue({data: null, error: 'boom'});
    const {result} = renderHook(() => useCollectionSharing(true));
    await waitFor(() => expect(result.current.on).toBe(true));

    await act(async () => result.current.set(false));
    expect(result.current).toMatchObject({on: true, busy: false, writeFailed: true});
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('turns off with no read when the collection is cleared, and reads again for a new one', async () => {
    const {result, rerender} = renderHook(() => useCollectionSharing(true));
    await waitFor(() => expect(result.current.on).toBe(true));

    collection.hasCollection = false;
    rerender();
    expect(result.current).toMatchObject({status: 'ready', on: false});
    expect(repo.getSharing).toHaveBeenCalledTimes(1);

    // A new collection starts with no switch row, so its read answers off.
    repo.getSharing.mockResolvedValue({data: false, error: null});
    collection.hasCollection = true;
    rerender();
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.on).toBe(false);
    expect(repo.getSharing).toHaveBeenCalledTimes(2);
  });

  it('waits behind a queued collection write, such as an import’s upload, to read and to write', async () => {
    const upload = deferred<void>();
    void enqueueWrite('me', () => upload.promise);
    const {result} = renderHook(() => useCollectionSharing(true));
    await act(async () => {});
    expect(repo.getSharing).not.toHaveBeenCalled();
    await act(async () => upload.resolve());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const clear = deferred<void>();
    void enqueueWrite('me', () => clear.promise);
    act(() => result.current.set(false));
    await act(async () => {});
    expect(repo.setSharing).not.toHaveBeenCalled();
    await act(async () => clear.resolve());
    await waitFor(() => expect(repo.setSharing).toHaveBeenCalledWith('me', false));
  });

  it('says a failed read failed, and reads again on retry', async () => {
    repo.getSharing.mockResolvedValueOnce({data: null, error: 'boom'});
    const {result} = renderHook(() => useCollectionSharing(true));
    await waitFor(() => expect(result.current.status).toBe('failed'));

    // Nothing to write over while the saved value is unknown.
    act(() => result.current.set(true));
    expect(repo.setSharing).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.on).toBe(true);
  });
});
