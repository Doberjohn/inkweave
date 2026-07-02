import {describe, expect, it, vi, beforeEach} from 'vitest';
import {track} from '@vercel/analytics';
import {trackEvent} from '../analytics';

vi.mock('@vercel/analytics', () => ({track: vi.fn()}));

describe('trackEvent', () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
  });

  it('forwards a reveal_card_click event with its props to Vercel track()', () => {
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
    expect(track).toHaveBeenCalledWith('reveal_card_click', props);
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
    expect(track).toHaveBeenCalledWith('vote_submitted', props);
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
    expect(track).toHaveBeenCalledWith('card_selected', props);
  });

  it('forwards a synergy_card_clicked event', () => {
    const props = {
      sourceCardId: '13001',
      clickedCardId: '13002',
      clickedCardName: 'Anna - Heir to Arendelle',
      clickedCardInk: 'Amber',
      groupKey: 'singer',
    } as const;
    trackEvent('synergy_card_clicked', props);
    expect(track).toHaveBeenCalledWith('synergy_card_clicked', props);
  });

  it('forwards a playstyle_opened event', () => {
    const props = {playstyleId: 'singer', playstyleName: 'Singer'} as const;
    trackEvent('playstyle_opened', props);
    expect(track).toHaveBeenCalledWith('playstyle_opened', props);
  });

  it('forwards a vote_skipped event', () => {
    const props = {cardAId: '13001', cardBId: '13002', engineScore: 7} as const;
    trackEvent('vote_skipped', props);
    expect(track).toHaveBeenCalledWith('vote_skipped', props);
  });
});
