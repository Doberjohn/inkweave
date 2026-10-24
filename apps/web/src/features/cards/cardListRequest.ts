import {fetchCardsFromLocal, type CardDataResult} from './loader';

let request: Promise<CardDataResult> | null = null;
let loaded: CardDataResult | null = null;

/**
 * The card list, fetched once for the page: main.tsx's hold starts it before the app renders
 * (#915), and useCardData takes the same request. A failure is forgotten, so a retry fetches
 * again.
 */
export function startCardList(): Promise<CardDataResult> {
  request ??= fetchCardsFromLocal().then(
    (result) => (loaded = result),
    (error: unknown) => {
      request = null;
      throw error;
    },
  );
  return request;
}

/** The card list once startCardList() has resolved, so a first render can start from it. */
export function cardListIfLoaded(): CardDataResult | null {
  return loaded;
}

/** @internal reset for testing */
export function _resetCardListRequest(): void {
  request = null;
  loaded = null;
}
