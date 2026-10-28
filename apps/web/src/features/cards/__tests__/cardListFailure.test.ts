import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadSentry} from '../../../shared/lib/sentry';
import {checkForNewVersion} from '../../../shared/lib/swUpdate';
import {onUnreadableCardList} from '../cardListFailure';
import {_resetCardListRequest, startCardList, whenCardListUnreadable} from '../cardListRequest';
import {CardDataUnavailableError} from '../loader';
import {_resetPreviewCardsCache} from '../previewCards';

vi.mock('../../../shared/lib/sentry', () => ({loadSentry: vi.fn()}));
vi.mock('../../../shared/lib/swUpdate', () => ({checkForNewVersion: vi.fn()}));

const captureException = vi.fn();

/** Lets loadSentry's promise hand Sentry over. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A fetch whose allCards.json answer is `allCards`, and every other file a 404. */
function stubCardFetch(allCards: () => Promise<unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => (url.includes('allCards') ? allCards() : Promise.resolve({ok: false, status: 404}))),
  );
}

beforeEach(() => {
  vi.mocked(loadSentry).mockResolvedValue({captureException} as never);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('onUnreadableCardList', () => {
  it('reports the failure to Sentry, and looks for a newer version', async () => {
    const error = new TypeError("undefined is not an object (evaluating 'r.match')");
    onUnreadableCardList(error);
    await settle();

    expect(captureException).toHaveBeenCalledWith(error);
    expect(checkForNewVersion).toHaveBeenCalledTimes(1);
  });
});

describe('startCardList when the card list fails', () => {
  const unreadable = vi.fn();

  beforeEach(() => {
    _resetCardListRequest();
    _resetPreviewCardsCache();
    whenCardListUnreadable(unreadable);
  });

  afterEach(() => {
    whenCardListUnreadable(() => {});
  });

  it('passes data it cannot read on once, however many callers share the request', async () => {
    // A shape no version of the reader takes: `cards` is not a list.
    stubCardFetch(async () => ({ok: true, json: async () => ({cards: 'unreadable'})}));
    const callers = [startCardList(), startCardList()];
    await Promise.allSettled(callers);

    await expect(callers[0]).rejects.toThrow(TypeError);
    expect(unreadable).toHaveBeenCalledTimes(1);
    expect(unreadable).toHaveBeenCalledWith(expect.any(TypeError));
  });

  // Try Again is the fix for both, so neither goes to Sentry nor looks for a new version.
  it.each([
    ['a server error', () => Promise.resolve({ok: false, status: 503})],
    ['no connection', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('passes nothing on for %s', async (_label, allCards) => {
    stubCardFetch(allCards);

    await expect(startCardList()).rejects.toBeInstanceOf(CardDataUnavailableError);
    expect(unreadable).not.toHaveBeenCalled();
  });
});
