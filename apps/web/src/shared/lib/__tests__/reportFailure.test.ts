import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {_resetReportedFailures, reportFailure} from '../reportFailure';
import {loadSentry, onSentryReady, type SentryApi} from '../sentry';

vi.mock('../sentry', () => ({loadSentry: vi.fn(), onSentryReady: vi.fn()}));

const captureException = vi.fn();

/** Lets loadSentry's promise hand Sentry over. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const RLS_REFUSAL = {message: 'new row violates row-level security policy for table "collections"', code: '42501'};

const sentry = {captureException} as unknown as SentryApi;

beforeEach(() => {
  _resetReportedFailures();
  vi.mocked(loadSentry).mockResolvedValue(sentry);
  vi.mocked(onSentryReady).mockImplementation((callback) => callback(sentry));
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

  // fetch throws a TypeError when the request fails, and that reaches the repositories' catch.
  it('reports a thrown fetch failure as a network warning, with the thrown error as its cause', async () => {
    const thrown = new TypeError('Failed to fetch');

    reportFailure({area: 'collection', operation: 'save'}, thrown);
    await settle();

    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).cause).toBe(thrown);
    expect(context).toMatchObject({level: 'warning', tags: {failure: 'network'}});
  });

  // supabase-js's fetch reads the session first, and auth-js throws this when it can't refresh it.
  it("reports postgrest-js's answer for auth-js's failed fetch as a network warning", async () => {
    const answer = {message: 'AuthRetryableFetchError: Failed to fetch', code: ''};

    reportFailure({area: 'friends', operation: 'list'}, answer);
    await settle();

    expect(captureException.mock.calls[0][1].tags.failure).toBe('network');
  });

  // postgrest-js hands back an error page it can't read as JSON, a gateway's mid-outage, as the message.
  it("reports an error page as the server's warning, cut short", async () => {
    const page = `<html><body>${'Bad gateway. '.repeat(40)}</body></html>`;

    reportFailure({area: 'votes', operation: 'submit'}, {message: page});
    await settle();

    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe(`votes submit failed: ${page.slice(0, 200)}`);
    expect(context).toMatchObject({level: 'warning', tags: {failure: 'server'}});
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

  // A browser that blocks storage refuses it at every site, on every page, as the page starts.
  it('reports a storage refusal once per page, when Sentry loads of its own accord', async () => {
    const quota = new DOMException('quota', 'QuotaExceededError');

    reportFailure({area: 'collection', operation: 'read binder', storage: true}, quota);
    reportFailure({area: 'collection', operation: 'pending marker', storage: true}, quota);
    await settle();

    expect(loadSentry).not.toHaveBeenCalled();
    expect(onSentryReady).toHaveBeenCalledOnce();
    expect(captureException.mock.calls.map(([, context]) => context.tags.operation)).toEqual(['read binder']);
  });

  it('reports a thrown value that is no error as unexpected, in its own words', async () => {
    reportFailure({area: 'profile', operation: 'save name'}, 'kaput');
    await settle();

    const [error, context] = captureException.mock.calls[0];
    expect((error as Error).message).toBe('profile save name failed: kaput');
    expect(context.tags.failure).toBe('unexpected');
  });
});
