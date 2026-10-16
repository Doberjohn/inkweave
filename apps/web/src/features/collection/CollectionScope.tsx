import {Outlet} from 'react-router-dom';
import {CollectionProvider} from './CollectionContext';
import {CollectionCardsProvider} from './CollectionCardsContext';

/**
 * The collection providers, as a LAYOUT ROUTE around the two pages that use them
 * (`/browse` and `/account`), added by `router.tsx` only while `SHOW_COLLECTION`
 * is on (#553 Phase C).
 *
 * A route, NOT a wrapper in `AppLayout`. Mounted there, the whole collection data
 * layer (seven modules, about 4 kB gzip) was imported statically into the entry
 * chunk, because the flag is a constant the bundler does not fold across modules,
 * so it shipped even with the flag off. As a lazy route it loads only on the pages
 * that read a collection, and never on the home page or a card page.
 *
 * Moving between `/browse` and a card page DOES remount it, which re-reads storage,
 * re-syncs with the server once and refetches the non-Core chunks (HTTP-cached);
 * that is the price of keeping it out of every other page.
 *
 * ONE INSTANCE FOR BOTH PAGES still holds: a pathless layout route stays mounted
 * while you move between its children, so an import on `/account` is already in
 * Browse's state, with no second provider to disagree with it.
 *
 * `CollectionCardsProvider` is the non-Core VIEWING pool, kept out of
 * `CardDataProvider`'s data on purpose: nothing asking CardDataContext for cards
 * can receive a collection card, so the deck builder stays Core-only by
 * construction. It fetches nothing until collection mode asks.
 */
export function CollectionScope() {
  return (
    <CollectionProvider>
      <CollectionCardsProvider>
        <Outlet />
      </CollectionCardsProvider>
    </CollectionProvider>
  );
}
