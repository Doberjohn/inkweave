import {describe, expect, it, vi, beforeEach} from 'vitest';
import {track} from '@vercel/analytics';
import {trackEvent} from '../analytics';
import {capturePostHog} from '../posthog';

vi.mock('@vercel/analytics', () => ({track: vi.fn()}));
vi.mock('../posthog', () => ({capturePostHog: vi.fn()}));

/** Every event goes to Vercel and to PostHog, with the same name and props (#827). */
function expectSentToBoth(name: string, props: object) {
  expect(track).toHaveBeenCalledWith(name, props);
  expect(capturePostHog).toHaveBeenCalledWith(name, props);
}

describe('trackEvent', () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
    vi.mocked(capturePostHog).mockClear();
  });

  it('forwards a reveal_card_click event with its props to Vercel track() and PostHog', () => {
    const props = {
      cardName: 'Elsa - Snow Queen',
      cardId: '13001',
      source: 'mosaic',
      ink: 'Amber',
      type: 'Character',
      rarity: 'Legendary',
      franchise: 'Frozen',
    } as const;
    trackEvent('reveal_card_click', props);
    expect(track).toHaveBeenCalledTimes(1);
    expect(capturePostHog).toHaveBeenCalledTimes(1);
    expectSentToBoth('reveal_card_click', props);
  });

  it('forwards a vote_submitted event with its enriched props', () => {
    const props = {
      voteType: 'in_depth',
      cardAId: '13001',
      cardBId: '13002',
      cardAInk: 'Amber',
      cardBInk: 'Ruby',
      engineScore: 8,
      synergyCount: 2,
      userScore: 7,
    } as const;
    trackEvent('vote_submitted', props);
    expectSentToBoth('vote_submitted', props);
  });

  it('forwards a card_selected event', () => {
    const props = {
      cardId: '13001',
      cardName: 'Elsa - Snow Queen',
      source: 'browse',
      ink: 'Amber',
      type: 'Character',
    } as const;
    trackEvent('card_selected', props);
    expectSentToBoth('card_selected', props);
  });

  it('forwards a synergy_card_clicked event', () => {
    const props = {
      sourceCardId: '13001',
      clickedCardId: '13002',
      clickedCardName: 'Anna - Heir to Arendelle',
      clickedCardInk: 'Amber',
      groupKey: 'singer',
      surface: 'modal',
    } as const;
    trackEvent('synergy_card_clicked', props);
    expectSentToBoth('synergy_card_clicked', props);
  });

  it('forwards a playstyle_opened event', () => {
    const props = {playstyleId: 'singer', playstyleName: 'Singer'} as const;
    trackEvent('playstyle_opened', props);
    expectSentToBoth('playstyle_opened', props);
  });

  it('forwards a vote_skipped event', () => {
    const props = {cardAId: '13001', cardBId: '13002', engineScore: 7} as const;
    trackEvent('vote_skipped', props);
    expectSentToBoth('vote_skipped', props);
  });

  it('forwards a search_submitted event', () => {
    const props = {query: 'elsa', source: 'home'} as const;
    trackEvent('search_submitted', props);
    expectSentToBoth('search_submitted', props);
  });

  it('forwards a filter_applied event', () => {
    const props = {facet: 'ink', value: 'Amber', action: 'add'} as const;
    trackEvent('filter_applied', props);
    expectSentToBoth('filter_applied', props);
  });

  it('forwards a sort_changed event', () => {
    const props = {sortOrder: 'cost', previousSort: 'newest'} as const;
    trackEvent('sort_changed', props);
    expectSentToBoth('sort_changed', props);
  });

  it('forwards a synergy_group_viewed event', () => {
    const props = {
      sourceCardId: '13001',
      groupKey: 'singer',
      action: 'isolate',
      surface: 'card_page',
    } as const;
    trackEvent('synergy_group_viewed', props);
    expectSentToBoth('synergy_group_viewed', props);
  });

  it('forwards a card_printing_view event', () => {
    const props = {
      cardId: '1938',
      printingId: '2141',
      rarity: 'Enchanted',
      surface: 'card_page',
    } as const;
    trackEvent('card_printing_view', props);
    expectSentToBoth('card_printing_view', props);
  });

  it('forwards a sign_in_started event', () => {
    const props = {provider: 'google', surface: 'header'} as const;
    trackEvent('sign_in_started', props);
    expectSentToBoth('sign_in_started', props);
  });

  it('forwards a sign_in_completed event', () => {
    const props = {provider: 'discord'} as const;
    trackEvent('sign_in_completed', props);
    expectSentToBoth('sign_in_completed', props);
  });

  it('forwards a sign_in_failed event', () => {
    const props = {provider: null, stage: 'callback', reason: 'cancelled'} as const;
    trackEvent('sign_in_failed', props);
    expectSentToBoth('sign_in_failed', props);
  });

  it('forwards a collection_mode_toggled event', () => {
    const props = {state: 'on'} as const;
    trackEvent('collection_mode_toggled', props);
    expectSentToBoth('collection_mode_toggled', props);
  });

  it('forwards a collection_imported event', () => {
    const props = {
      surface: 'browse',
      replacing: false,
      cards: 1204,
      copies: 3561,
      unidentified: 2,
      ambiguous: 1,
      unparsed: 0,
    } as const;
    trackEvent('collection_imported', props);
    expectSentToBoth('collection_imported', props);
  });

  it('forwards a collection_import_failed event', () => {
    const props = {surface: 'account', replacing: true, reason: 'no_cards'} as const;
    trackEvent('collection_import_failed', props);
    expectSentToBoth('collection_import_failed', props);
  });

  it('forwards a collection_deleted event', () => {
    const props = {cards: 1204} as const;
    trackEvent('collection_deleted', props);
    expectSentToBoth('collection_deleted', props);
  });
});
