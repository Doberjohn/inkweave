import {useEffect, useState} from 'react';
import featuredCardIds from './featuredCardIds.json';
import {loadCardsFromJSON, type LorcanaJSONData} from './loader';
import type {LorcanaCard} from './types';

/**
 * The homepage's curated featured cards, one per ink. The list lives in featuredCardIds.json so
 * scripts/precompute-synergies.mjs can read it too; keep exactly 6 so the desktop 6-column and
 * mobile 3x2 grids stay symmetrical.
 */
export const DEFAULT_FEATURED_IDS: string[] = featuredCardIds.map((entry) => entry.id);

/**
 * The featured IDs from the build-time env var, falling back to the defaults. Vite inlines env
 * vars at build time, so changing this on Vercel requires a redeploy (the intended workflow).
 * Keep in step with resolveFeaturedIds in scripts/featured-cards.mjs.
 */
export function resolveFeaturedIds(raw: string | undefined): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_FEATURED_IDS;
}

export const FEATURED_IDS = resolveFeaturedIds(import.meta.env.VITE_FEATURED_CARD_IDS);

/** The featured cards found in `cards`, in display order, skipping any without art. */
export function pickFeatured(cards: LorcanaCard[]): LorcanaCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return FEATURED_IDS.map((id) => byId.get(id)).filter(
    (c): c is LorcanaCard => c != null && !!c.imageUrl,
  );
}

const FEATURED_CARDS_PATH = '/data/featuredCards.json';
let request: Promise<LorcanaCard[] | null> | null = null;

/**
 * The featured cards from the small file precompute writes (#641), fetched once per page. Resolves
 * null when the file is missing or doesn't hold every featured ID (an env override the script
 * didn't see), so the caller falls back to the full card list.
 */
export function fetchFeaturedCards(): Promise<LorcanaCard[] | null> {
  request ??= fetch(FEATURED_CARDS_PATH)
    .then((response) => (response.ok ? (response.json() as Promise<LorcanaJSONData>) : null))
    .then((data) => {
      const featured = data ? pickFeatured(loadCardsFromJSON(data)) : [];
      return featured.length === FEATURED_IDS.length ? featured : null;
    })
    .catch(() => null);
  return request;
}

/**
 * The featured cards from the small file while `enabled`, so the homepage doesn't wait on the
 * full card list for them. `undefined` while loading, `null` when the file can't be used.
 */
export function useFeaturedCardsFile(enabled: boolean): LorcanaCard[] | null | undefined {
  const [cards, setCards] = useState<LorcanaCard[] | null | undefined>(undefined);
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
}
