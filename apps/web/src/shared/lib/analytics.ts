import {track} from '@vercel/analytics';
import type {CardType, Ink} from 'inkweave-synergy-engine';

/**
 * The typed event catalog. Every custom analytics event the app sends is declared
 * here. The team is on Vercel Pro + Web Analytics Plus, which allows up to 8
 * properties per custom event (plain Pro caps at 2), so each shape stays <= 8 props.
 * Vercel constraints: values must be string | number | boolean | null (no nested
 * objects/arrays), and every event name, key, and value must be <= 255 chars.
 */
type AnalyticsEvents = {
  reveal_card_click: {
    cardName: string;
    cardId: string;
    source: 'mosaic' | 'franchise_modal';
    ink: Ink;
    type: CardType;
    rarity: string | null;
    franchise: string | null;
  };
  // One shape across all three vote surfaces (modal thumbs, /vote one-click score,
  // in-depth form). `userScore` meaning depends on voteType — see voteAnalytics.ts.
  vote_submitted: {
    voteType: 'quick' | 'score' | 'in_depth';
    cardAId: string;
    cardBId: string;
    cardAInk: Ink | null;
    cardBInk: Ink | null;
    engineScore: number | null;
    synergyCount: number | null;
    userScore: number | null;
  };
  // A card detail was opened from a discovery surface (grid/featured/search).
  // `source` is the originating page. Reveals and synergy clicks are NOT card_selected —
  // they have their own events (reveal_card_click, synergy_card_clicked).
  card_selected: {
    cardId: string;
    cardName: string;
    source: 'browse' | 'home' | 'playstyle' | 'playstyle_gallery';
    ink: Ink;
    type: CardType;
  };
  // A card was clicked from within another card's synergy results (following a synergy).
  synergy_card_clicked: {
    sourceCardId: string;
    clickedCardId: string;
    clickedCardName: string;
    clickedCardInk: Ink;
    groupKey: string | null;
  };
  // A playstyle tile was opened from the gallery.
  playstyle_opened: {playstyleId: string; playstyleName: string};
  // A pair was skipped on the /vote page.
  vote_skipped: {cardAId: string; cardBId: string; engineScore: number};
  // future (#124): filter_applied, search_query, synergy_group_viewed...
};

/**
 * Fire-and-forget custom event. The generic constraint makes a wrong event name or
 * prop shape a compile error, not a silently-broken event. No-ops in dev (Vercel
 * logs instead of sending); only collects in production with <Analytics/> mounted.
 */
export function trackEvent<E extends keyof AnalyticsEvents>(
  name: E,
  props: AnalyticsEvents[E],
): void {
  track(name, props);
}
