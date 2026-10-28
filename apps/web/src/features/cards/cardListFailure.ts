import {loadSentry} from '../../shared/lib/sentry';
import {checkForNewVersion} from '../../shared/lib/swUpdate';

/**
 * What a card list sets off when its data arrived and the page couldn't use it (main.tsx hands it
 * to whenCardListUnreadable). The usual cause is an out-of-date copy of the app, which the service
 * worker kept, meeting data whose shape changed after it was built: nothing ties the card data to
 * the version that reads it. The failure goes to Sentry, since the error screen catches it and
 * nothing else would report it, and the page looks for a newer version, which the update flow
 * moves it onto.
 */
export function onUnreadableCardList(error: unknown): void {
  void loadSentry().then((sentry) => sentry?.captureException(error));
  void checkForNewVersion();
}
