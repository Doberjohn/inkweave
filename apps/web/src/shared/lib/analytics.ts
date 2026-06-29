import {track} from '@vercel/analytics';

/**
 * The typed event catalog. Every custom analytics event the app sends is declared
 * here. Vercel Pro caps custom events at 2 properties, so each shape stays <= 2 props.
 */
type AnalyticsEvents = {
  reveal_card_click: {cardName: string; source: 'mosaic' | 'franchise_modal'};
  vote_submitted: {voteType: 'quick' | 'in_depth'};
  // future (#124): card_selected, filter_applied, search_query, synergy_group_viewed...
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
