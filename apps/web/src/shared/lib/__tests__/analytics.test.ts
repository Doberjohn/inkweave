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
});
