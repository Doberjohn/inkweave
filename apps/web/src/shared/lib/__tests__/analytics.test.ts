import {describe, expect, it, vi, beforeEach} from 'vitest';
import {track} from '@vercel/analytics';
import {trackEvent} from '../analytics';

vi.mock('@vercel/analytics', () => ({track: vi.fn()}));

describe('trackEvent', () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
  });

  it('forwards a reveal_card_click event with its props to Vercel track()', () => {
    trackEvent('reveal_card_click', {cardName: 'Elsa - Snow Queen', source: 'mosaic'});
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('reveal_card_click', {
      cardName: 'Elsa - Snow Queen',
      source: 'mosaic',
    });
  });

  it('forwards a vote_submitted event with its voteType', () => {
    trackEvent('vote_submitted', {voteType: 'in_depth'});
    expect(track).toHaveBeenCalledWith('vote_submitted', {voteType: 'in_depth'});
  });
});
