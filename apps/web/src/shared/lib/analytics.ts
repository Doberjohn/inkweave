import {track} from '@vercel/analytics';
import type {CardType, Ink} from 'inkweave-synergy-engine';
import {capturePostHog} from './posthog';

/**
 * The typed event catalog. Every custom analytics event the app sends is declared
 * here. Each shape keeps to 8 properties or fewer. Vercel Pro plus Web Analytics Plus
 * allowed 8 (#124 recorded a cap of 2 on plain Pro); the team had Plus from 2026-07-02
 * to 2026-08-29, and on plain Pro since, 7 and 8 property events still arrive whole
 * (checked 2026-10-21). UTM breakdowns need Plus, so campaign data comes from PostHog.
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
  // A card detail was opened from a discovery surface: a grid, featured cards or a search pick.
  // `source` is the originating page, `playstyle_guide` for a key card in a playstyle page's guide
  // (#995), `mobile_sheet` for the mobile search sheet, and `binder` or `friend_binder` for a pocket
  // in collection mode's binder, your own or a friend's. Reveals and synergy clicks are NOT
  // card_selected; they have their own events (reveal_card_click, synergy_card_clicked).
  card_selected: {
    cardId: string;
    cardName: string;
    source:
      | 'browse'
      | 'binder'
      | 'friend_binder'
      | 'home'
      | 'playstyle'
      | 'playstyle_guide'
      | 'playstyle_gallery'
      | 'ink_hub'
      | 'mobile_sheet';
    ink: Ink;
    type: CardType;
  };
  // A card was clicked from within another card's synergy results (following a synergy),
  // in the card modal or on a card page.
  synergy_card_clicked: {
    sourceCardId: string;
    clickedCardId: string;
    clickedCardName: string;
    clickedCardInk: Ink;
    groupKey: string | null;
    surface: 'modal' | 'card_page';
  };
  // A playstyle tile was opened from the gallery.
  playstyle_opened: {playstyleId: string; playstyleName: string};
  // A pair was skipped on the /vote page.
  vote_skipped: {cardAId: string; cardBId: string; engineScore: number};
  // A search was submitted (navigates to /browse). `query` is the trimmed term.
  search_submitted: {query: string; source: 'home' | 'gallery' | 'mobile_sheet'};
  // An ink, type or cost filter turned on or off, one event per value. `via` is `inline` for a
  // control on the page that applies at once (the toolbar's and the docked panel's buttons, a chip's
  // ×, the panel's Clear all) and `dialog` for a Filters dialog or sheet's Apply. The other facets
  // (keyword, set, classification, inkwell, rarity) are not tracked here.
  filter_applied: {facet: 'ink' | 'type' | 'cost'; value: string; action: 'add' | 'remove'; via: 'inline' | 'dialog'};
  // The card-list sort order changed on browse/playstyle-detail.
  sort_changed: {sortOrder: string; previousSort: string};
  // A synergy group was isolated (chip) or expanded (show-all), in the card modal or on a card page.
  synergy_group_viewed: {
    sourceCardId: string;
    groupKey: string;
    action: 'isolate' | 'show_all';
    surface: 'modal' | 'card_page';
  };
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
  // Sign-in (#882). `surface` is where the dialog opened; decks and deck_builder are the
  // deck builder's DecksPage and DeckBuilderPage (#451). Never an account id, email or handle.
  sign_in_started: {
    provider: 'google' | 'discord';
    surface: 'header' | 'account' | 'collection' | 'decks' | 'deck_builder';
  };
  // The dialog opened, before any provider press: started over shown is a surface's sign-in rate.
  sign_in_shown: {surface: 'header' | 'account' | 'collection' | 'decks' | 'deck_builder'};
  // /auth/callback saw the new session. `provider` is the session's own; anything else is `other`.
  sign_in_completed: {provider: 'google' | 'discord' | 'other'};
  // The start failed in the dialog, or the callback gave up. `reason` comes from the OAuth error
  // the provider sent back: access_denied is `cancelled`, none at all is `timeout`.
  sign_in_failed: {
    provider: 'google' | 'discord' | null;
    stage: 'start' | 'callback';
    reason: 'error' | 'cancelled' | 'timeout';
  };
  // Collection mode (#553, #883), behind SHOW_COLLECTION. Enums and counts only: never a
  // card ref, a file name or a CSV row. `replacing`: the collection already held a copy.
  collection_mode_toggled: {state: 'on' | 'off'};
  // An empty collection made for a player with nothing to import, once the account held none.
  collection_started: {surface: 'browse' | 'account'};
  // A start that made no collection: the account didn't answer, another account's unsaved copy
  // holds this browser, or the browser refused the write. One per attempt.
  collection_start_failed: {surface: 'browse' | 'account'; reason: 'unreachable' | 'held' | 'storage'};
  // The import dialog opened. `empty_binder` is the empty binder's cover, apart from Browse's gear.
  collection_import_opened: {surface: 'browse' | 'account' | 'empty_binder'; replacing: boolean};
  collection_imported: {
    surface: 'browse' | 'account' | 'empty_binder';
    replacing: boolean;
    cards: number;
    copies: number;
    unidentified: number;
    ambiguous: number;
    unparsed: number;
  };
  collection_import_failed: {
    surface: 'browse' | 'account' | 'empty_binder';
    replacing: boolean;
    reason: 'not_ready' | 'unreadable' | 'no_cards' | 'storage';
  };
  collection_deleted: {cards: number};
  // A count set by hand (#826): a pocket's stripe or the card window's, on the grid, in your binder
  // or a friend's, whose window keeps your own copies. At most one per card per binder view
  // (`useKeptCards`). `newCard`: the card held no copies in either finish before.
  collection_copies_changed: {
    surface: 'pocket' | 'window';
    mode: 'grid' | 'binder' | 'friend_binder';
    finish: 'normal' | 'foil';
    change: 'add' | 'remove';
    newCard: boolean;
  };
  // A pick that changed what the binder shows: its set (a set code, `all` or `promos`), Show, the
  // headline Owned and Missing ask of, or the foil pointer's Master set. Never a card or a handle.
  binder_view_changed: {control: 'set' | 'show' | 'axis' | 'foil_pointer'; value: string; friend: boolean};
  // The first turn of each kind in one opening of a binder: a disc, a page dragged across, or the
  // spread map. `page` is a phone's lone page.
  binder_page_turned: {method: 'arrow' | 'drag' | 'map'; layout: 'spread' | 'page'};
  // Friends (#852, #884), behind SHOW_FRIENDS. Never a friend code, name, handle or id.
  // `result` on a send is send_friend_request's answer: pending, accepted, a refusal, or failed.
  friend_code_copied: {result: 'copied' | 'blocked'};
  friend_request_sent: {
    result: 'pending' | 'accepted' | 'invalid' | 'unknown' | 'own' | 'too_many' | 'slow_down' | 'failed';
  };
  // A row's action finished: removing a received request is `decline`, a sent one `cancel`.
  friend_action: {action: 'accept' | 'decline' | 'cancel' | 'remove'; ok: boolean};
  // Collection sharing, behind SHOW_COLLECTION and SHOW_FRIENDS. Never an id,
  // handle or name, as with the friends events.
  collection_sharing_changed: {state: 'on' | 'off'};
  // `from`: where the binder was reached, `/account`'s friends list, a row of Friends who have it,
  // or its address alone (a shared link, a new tab, a bookmark).
  friend_binder_opened: {
    result: 'shown' | 'not_sharing' | 'failed';
    from: 'friends_list' | 'friends_who_have_it' | 'link';
  };
  // Friends who have it, behind SHOW_COLLECTION and SHOW_FRIENDS: where it was opened from.
  // Never an id, handle or name.
  friends_who_have_it_opened: {from: 'badge' | 'window'};
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
