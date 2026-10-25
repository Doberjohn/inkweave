import {useEffect, useState} from 'react';
import featuredCardIds from './featuredCardIds.json';
import {startCardList} from './cardListRequest';
import {loadCardsFromJSON, type LorcanaJSONData} from './loader';
import type {LorcanaCard} from './types';

/**
 * The homepage's curated featured cards, one per ink, in display order. featuredCardIds.json is
 * their only source (#957): scripts/precompute-synergies.mjs reads it too, and admin's Featured
 * cards page edits it by committing to master, so a change ships with the next deploy. Keep
 * exactly 6 so the desktop 6-column and mobile 3x2 grids stay symmetrical.
 */
export const FEATURED_IDS: string[] = featuredCardIds.map((entry) => entry.id);

/** The featured cards found in `cards`, in display order, skipping any without art. */
export function pickFeatured(cards: LorcanaCard[]): LorcanaCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return FEATURED_IDS.map((id) => byId.get(id)).filter(
    (c): c is LorcanaCard => c != null && !!c.imageUrl,
  );
}

const FEATURED_CARDS_PATH = '/data/featuredCards.json';
let request: Promise<LorcanaCard[] | null> | null = null;
/** The featured cards once the file has loaded them, for a first render to start from (#915). */
let loaded: LorcanaCard[] | undefined;

/** Drops the cached request, so the next caller fetches again, and resolves this one to null. */
function forgetRequest(): null {
  request = null;
  return null;
}

/**
 * The featured cards from the small file precompute writes (#641), fetched once per page. Resolves
 * null when the file is missing, fails to load or doesn't hold every featured ID (a card it
 * couldn't find, or a file from an older build), so the caller falls back to the full card list.
 * Only a missing file (a 404) or an incomplete one is kept for the page; any other failure is
 * forgotten, so the next caller tries again.
 */
export function fetchFeaturedCards(): Promise<LorcanaCard[] | null> {
  request ??= fetch(FEATURED_CARDS_PATH)
    .then((response) => {
      if (response.ok) return response.json() as Promise<LorcanaJSONData>;
      return response.status === 404 ? null : forgetRequest();
    })
    .then((data) => {
      const featured = data ? pickFeatured(loadCardsFromJSON(data)) : [];
      return featured.length === FEATURED_IDS.length ? (loaded = featured) : null;
    })
    .catch(forgetRequest);
  return request;
}

/**
 * What the home page's featured row renders from, for main.tsx's hold (#915): the small file,
 * or, when that file can't be used, the full card list, which the page otherwise leaves for
 * later (#641) but then shows the featured cards from.
 */
export async function startFeaturedCards(): Promise<unknown> {
  return (await fetchFeaturedCards()) ?? startCardList();
}

/**
 * The featured cards from the small file while `enabled`, so the homepage doesn't wait on the
 * full card list for them. `undefined` while loading, `null` when the file can't be used. A file
 * main.tsx's hold already loaded (#915) is there on the first render, when that render enables it.
 */
export function useFeaturedCardsFile(enabled: boolean): LorcanaCard[] | null | undefined {
  const [cards, setCards] = useState<LorcanaCard[] | null | undefined>(() =>
    enabled ? loaded : undefined,
  );
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchFeaturedCards().then((featured) => {
      if (live) setCards(featured);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return cards;
}

/** @internal reset for testing */
export function _resetFeaturedCardsCache(): void {
  request = null;
  loaded = undefined;
}
