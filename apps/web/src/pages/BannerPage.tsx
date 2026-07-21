import {useEffect, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {usePrecomputedSynergies} from '../features/synergies/hooks/usePrecomputedSynergies';
import {SynergyBanner} from '../features/synergies/components/SynergyBanner';
import {COLORS} from '../shared/constants';

const MAX_GROUPS = 6;
const ROWS_PER_PAGE = 3;

/**
 * Dev/generator route: /banner/:cardId?page=N renders one page of a card's synergy-breakdown
 * banner from the live app components + precomputed synergy JSON. A card with >3 synergies
 * splits into pages of 3 (hero locked on each) so a Reddit post can be a 2-image carousel.
 * scripts/export-synergy-banner.mjs screenshots the .banner-stage element per page.
 *
 * Banner needs full-res art (card.imageUrl is only a ~367px thumbnail), so we load a one-off
 * id -> images.full map from allCards.json and gate rendering until it is ready.
 */
export function BannerPage() {
  const {cardId} = useParams<{cardId: string}>();
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const {getCardById} = useCardDataContext();
  const card = cardId ? getCardById(cardId) : undefined;
  const {synergies, isLoading} = usePrecomputedSynergies(card ?? null);
  const {fullImage, loaded} = useFullImageMap();

  const ready = card && !isLoading && loaded;

  const sorted = [...synergies].sort((a, b) => b.synergies.length - a.synergies.length).slice(0, MAX_GROUPS);
  const pageGroups = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  return (
    <div style={{minHeight: '100vh', background: '#06060a', display: 'grid', placeItems: 'center', padding: 32}}>
      {ready ? (
        <SynergyBanner card={card} groups={pageGroups} fullImage={fullImage} />
      ) : (
        <div style={{color: COLORS.textMuted}} aria-busy="true">
          Loading banner…
        </div>
      )}
    </div>
  );
}

interface RawCard {
  id: string | number;
  images?: {full?: string};
}

/** Loads a card-id -> full-res image URL map from the raw allCards.json (banner-only). */
function useFullImageMap(): {fullImage: (id: string) => string | undefined; loaded: boolean} {
  const [map, setMap] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/allCards.json')
      .then((r) => r.json())
      .then((data: {cards?: RawCard[]} | RawCard[]) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : data.cards ?? [];
        const next = new Map<string, string>();
        for (const c of arr) {
          if (c.images?.full) next.set(String(c.id), c.images.full);
        }
        setMap(next);
      })
      .catch(() => {
        if (!cancelled) setMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {fullImage: (id: string) => map?.get(String(id)), loaded: map !== null};
}
