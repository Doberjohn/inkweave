import {track} from '@vercel/analytics';
import type {CardType, Ink} from 'inkweave-synergy-engine';
import {capturePostHog} from './posthog';

/**
 * The typed event catalog. Every custom analytics event the app sends is declared
 * here. The team is on Vercel Pro + Web Analytics Plus, which allows up to 8
 * properties per custom event (plain Pro caps at 2), so each shape stays <= 8 props.
 * Vercel constraints: values must be string | number | boolean | null (no nested
 * objects/arrays), and every event name, key, and value must be <= 255 chars.
 * Every event goes to PostHog too (#827), which allows more, but Vercel's limits
 * bind each shape while both run.
 */
type AnalyticsEvents = {
  reveal_card_click: {
    cardName: string;
    cardId: string;
    source: 'mosaic' | 'franchise_modal' | 'special_printings';
    ink: Ink;
    type: CardType;
    /** The clicked card's rarity; for a special printing, the printing's (Epic, Enchanted, Iconic). */
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
  // A search was submitted (navigates to /browse). `query` is the trimmed term.
  search_submitted: {query: string; source: 'home' | 'gallery' | 'mobile_sheet'};
  // A single card filter facet was toggled from the toolbar (ink/type/cost).
  // Bulk dialog facets (keyword/set/classification/inkwell) are not tracked here.
  filter_applied: {facet: 'ink' | 'type' | 'cost'; value: string; action: 'add' | 'remove'};
  // The card-list sort order changed on browse/playstyle-detail.
  sort_changed: {sortOrder: string; previousSort: string};
  // A synergy group was isolated (chip) or expanded (show-all) inside the card modal.
  synergy_group_viewed: {sourceCardId: string; groupKey: string; action: 'isolate' | 'show_all'};
  // A visitor settled on an alternate printing (#625): a pill pick, or the art strip at rest
  // after a swipe. Printings a swipe only passes through don't count (#653). `rarity` is the
  // printing's printed one, so a printing that keeps its base card's rarity sends that (#796).
  // `printingId` tells apart printings that share a rarity, such as a card's promos (#805).
  card_printing_view: {
    cardId: string;
    printingId: string;
    rarity: string;
    surface: 'card_page' | 'modal';
  };
  // Collection mode (#553, #883), behind SHOW_COLLECTION. Enums and counts only: never a
  // card ref, a file name or a CSV row. `replacing`: the account already had a collection.
  collection_mode_toggled: {state: 'on' | 'off'};
  collection_imported: {
    surface: 'browse' | 'account';
    replacing: boolean;
    cards: number;
    copies: number;
    unidentified: number;
    ambiguous: number;
    unparsed: number;
  };
  collection_import_failed: {
    surface: 'browse' | 'account';
    replacing: boolean;
    reason: 'not_ready' | 'unreadable' | 'no_cards' | 'storage';
  };
  collection_deleted: {cards: number};
};

/**
 * Fire-and-forget custom event, sent to Vercel Web Analytics and PostHog. The generic
 * constraint makes a wrong event name or prop shape a compile error, not a
 * silently-broken event. No-ops in dev (Vercel logs instead of sending, PostHog never
 * loads). Vercel collects only in production with <Analytics/> mounted; PostHog only in
 * production builds with a key, once it has loaded (shared/lib/posthog.ts).
 */
export function trackEvent<E extends keyof AnalyticsEvents>(
  name: E,
  props: AnalyticsEvents[E],
): void {
  track(name, props);
  capturePostHog(name, props);
}
