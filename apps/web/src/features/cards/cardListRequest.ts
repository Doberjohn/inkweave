import {CardDataUnavailableError, fetchCardsFromLocal, type CardDataResult} from './loader';

let request: Promise<CardDataResult> | null = null;
let loaded: CardDataResult | null = null;
let onUnreadable: (error: unknown) => void = () => {};

/**
 * What a card list whose data arrived and still failed sets off besides its error screen, which
 * catches the failure. main.tsx sets it (cardListFailure.ts), so this module never imports
 * Sentry or the service worker: admin bridges CardDataContext, which reaches it.
 */
export function whenCardListUnreadable(listener: (error: unknown) => void): void {
  onUnreadable = listener;
}

/**
 * The card list, fetched once for the page: main.tsx's hold starts it before the app renders
 * (#915), and useCardData takes the same request. A failure is forgotten, so a retry fetches
 * again, and passed on once however many callers share it.
 */
export function startCardList(): Promise<CardDataResult> {
  request ??= fetchCardsFromLocal().then(
    (result) => (loaded = result),
    (error: unknown) => {
      request = null;
      if (!(error instanceof CardDataUnavailableError)) onUnreadable(error);
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
