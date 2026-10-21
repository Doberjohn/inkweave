import type {ReactNode} from 'react';
import {Outlet} from 'react-router-dom';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {CollectionProvider} from './CollectionContext';
import {CollectionCardsProvider, useCollectionCards} from './CollectionCardsContext';
import {placementsFor} from './placeCopies';

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
 *
 * The collection sits INSIDE the viewing pool, which needs nothing from it, so it can show
 * each copy where it belongs among the printings that have loaded (#880): the Core cards with
 * their printings and promos at once, the rest once collection mode or an import asks for them.
 * A copy of a printing not loaded yet shows where it was counted until then.
 */
export function CollectionScope() {
  return (
    <CollectionCardsProvider>
      <PlacedCollectionProvider>
        <Outlet />
      </PlacedCollectionProvider>
    </CollectionCardsProvider>
  );
}

/**
 * `CollectionProvider`, told where each copy shows by the card data that has loaded (#880). The
 * collection's cards come before Core's: a printing both hold, as a Core card's Enchanted is,
 * has its pocket built from the chunk's card (`withPrintingCards` adds no card for a variant the
 * pool holds), so its copies are placed by that card too.
 */
function PlacedCollectionProvider({children}: {children: ReactNode}) {
  const {cards: coreCards} = useCardDataContext();
  const {cards, promos} = useCollectionCards();
  return (
    <CollectionProvider placements={placementsFor([...cards, ...coreCards], promos)}>
      {children}
    </CollectionProvider>
  );
}
