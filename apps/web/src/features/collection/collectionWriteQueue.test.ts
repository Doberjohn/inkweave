import {afterEach, expect, it, vi} from 'vitest';
import {enqueueWrite} from './collectionWriteQueue';

const mockReport = vi.hoisted(() => vi.fn());
vi.mock('../../shared/lib/reportFailure', () => ({reportFailure: mockReport}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// A save, delete or sharing write that throws inside the queue is otherwise only a console line.
it('reports a queued write that throws', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const failure = new Error('upsert threw');

  await expect(enqueueWrite('u', () => Promise.reject(failure))).rejects.toBe(failure);

  expect(mockReport).toHaveBeenCalledWith({area: 'collection', operation: 'queued write'}, failure);
});
