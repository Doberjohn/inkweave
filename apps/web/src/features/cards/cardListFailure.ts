import {loadSentry} from '../../shared/lib/sentry';
import {checkForNewVersion} from '../../shared/lib/swUpdate';
import {CardDataNetworkError} from './loader';

/**
 * What a failed card list sets off besides its error screen, which catches the failure, so
 * nothing else would report it. A network failure sets off nothing: the device is offline.
 *
 * Any other failure means the data reached the page and the page couldn't use it. The usual
 * cause is an out-of-date copy of the app, which the service worker kept, meeting data whose
 * shape changed after it was built (the slimmed card data broke copies from before #929). It goes
 * to Sentry, and the page looks for a newer version, which the update flow moves it onto.
 */
export function onCardListFailure(error: unknown): void {
  if (error instanceof CardDataNetworkError) return;
  void loadSentry().then((sentry) => sentry?.captureException(error));
  void checkForNewVersion();
}
