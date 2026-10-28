import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadSentry} from '../../../shared/lib/sentry';
import {checkForNewVersion} from '../../../shared/lib/swUpdate';
import {onCardListFailure} from '../cardListFailure';
import {_resetCardListRequest, startCardList} from '../cardListRequest';
import {CardDataNetworkError} from '../loader';
import {_resetPreviewCardsCache} from '../previewCards';

vi.mock('../../../shared/lib/sentry', () => ({loadSentry: vi.fn()}));
vi.mock('../../../shared/lib/swUpdate', () => ({checkForNewVersion: vi.fn()}));

const captureException = vi.fn();

/** Lets loadSentry's promise hand Sentry over. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(loadSentry).mockResolvedValue({captureException} as never);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('onCardListFailure', () => {
  it('reports data the page could not read to Sentry, and looks for a newer version', async () => {
    const error = new TypeError("undefined is not an object (evaluating 'r.match')");
    onCardListFailure(error);
    await settle();

    expect(captureException).toHaveBeenCalledWith(error);
    expect(checkForNewVersion).toHaveBeenCalledTimes(1);
  });

  it('does neither for a card list that never arrived', async () => {
    onCardListFailure(new CardDataNetworkError(new TypeError('Load failed')));
    await settle();

    expect(loadSentry).not.toHaveBeenCalled();
    expect(checkForNewVersion).not.toHaveBeenCalled();
  });
});

describe('startCardList on card data it cannot read', () => {
  beforeEach(() => {
    _resetCardListRequest();
    _resetPreviewCardsCache();
    // A shape no version of the reader takes: `cards` is not a list.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('allCards')
          ? {ok: true, json: async () => ({cards: 'unreadable'})}
          : {ok: false, status: 404},
      ),
    );
  });

  it('reports the failure once, however many callers share the request', async () => {
    const callers = [startCardList(), startCardList()];
    await Promise.allSettled(callers);
    await settle();

    await expect(callers[0]).rejects.toThrow(TypeError);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(checkForNewVersion).toHaveBeenCalledTimes(1);
  });
});
