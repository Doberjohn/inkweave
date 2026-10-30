import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {_resetReportedFailures, reportFailure} from '../reportFailure';
import {loadSentry} from '../sentry';

vi.mock('../sentry', () => ({loadSentry: vi.fn()}));

const captureException = vi.fn();

/** Lets loadSentry's promise hand Sentry over. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const RLS_REFUSAL = {message: 'new row violates row-level security policy for table "collections"', code: '42501'};

beforeEach(() => {
  _resetReportedFailures();
  vi.mocked(loadSentry).mockResolvedValue({captureException} as never);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('reportFailure', () => {
  it('reports a database refusal as an error, named and grouped by where it happened', async () => {
    reportFailure({area: 'collection', operation: 'save'}, RLS_REFUSAL);
    await settle();

    expect(captureException).toHaveBeenCalledOnce();
    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe(`collection save failed: ${RLS_REFUSAL.message}`);
    expect(context).toEqual({
      level: 'error',
      tags: {area: 'collection', operation: 'save', failure: 'database'},
      fingerprint: ['handled-failure', 'collection', 'save', 'database', '42501'],
    });
  });

  // postgrest-js answers a request that never reached the database with the fetch's own error.
  it('reports a request that never reached the database as a network warning', async () => {
    reportFailure({area: 'sharing', operation: 'read friend binder'}, {message: 'TypeError: Failed to fetch', code: ''});
    await settle();

    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({level: 'warning', tags: expect.objectContaining({failure: 'network'})}),
    );
  });

  it('sends nothing, and loads nothing, while the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    reportFailure({area: 'collection', operation: 'save'}, RLS_REFUSAL);
    await settle();

    expect(loadSentry).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a failure once per page for each place it happens', async () => {
    reportFailure({area: 'collection', operation: 'save'}, RLS_REFUSAL);
    reportFailure({area: 'collection', operation: 'save'}, RLS_REFUSAL);
    reportFailure({area: 'collection', operation: 'delete'}, RLS_REFUSAL);
    await settle();

    expect(captureException.mock.calls.map(([, context]) => context.tags.operation)).toEqual(['save', 'delete']);
  });

  it('reports the browser refusing local storage as a storage warning', async () => {
    reportFailure(
      {area: 'collection', operation: 'store binder', storage: true},
      new DOMException('quota', 'QuotaExceededError'),
    );
    await settle();

    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({level: 'warning', tags: expect.objectContaining({failure: 'storage'})}),
    );
  });

  it('reports a thrown value that is no error as unexpected, in its own words', async () => {
    reportFailure({area: 'profile', operation: 'save name'}, 'kaput');
    await settle();

    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe('profile save name failed: kaput');
    expect(context.tags.failure).toBe('unexpected');
  });
});
