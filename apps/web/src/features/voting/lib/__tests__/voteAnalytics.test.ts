import {describe, it, expect, vi, beforeEach} from 'vitest';
import {trackVoteSubmitted, trackPairVote} from '../voteAnalytics';
import {trackEvent} from '../../../../shared/lib/analytics';
import {createVotingPair} from '../../../../shared/test-utils';

vi.mock('../../../../shared/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('voteAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackVoteSubmitted', () => {
    it('forwards all eight properties to the vote_submitted event', () => {
      trackVoteSubmitted({
        voteType: 'quick',
        cardAId: 'a',
        cardBId: 'b',
        cardAInk: 'Amber',
        cardBInk: 'Ruby',
        engineScore: 7,
        synergyCount: 3,
        userScore: 1,
      });

      expect(trackEvent).toHaveBeenCalledWith('vote_submitted', {
        voteType: 'quick',
        cardAId: 'a',
        cardBId: 'b',
        cardAInk: 'Amber',
        cardBInk: 'Ruby',
        engineScore: 7,
        synergyCount: 3,
        userScore: 1,
      });
    });

    it('passes null card and engine fields through unchanged', () => {
      trackVoteSubmitted({
        voteType: 'quick',
        cardAId: 'a',
        cardBId: 'b',
        cardAInk: null,
        cardBInk: null,
        engineScore: null,
        synergyCount: null,
        userScore: -1,
      });

      expect(trackEvent).toHaveBeenCalledWith(
        'vote_submitted',
        expect.objectContaining({
          cardAInk: null,
          cardBInk: null,
          engineScore: null,
          synergyCount: null,
          userScore: -1,
        }),
      );
    });
  });

  describe('trackPairVote', () => {
    it('derives ids, inks, engine score and synergy count from the pair', () => {
      const pair = createVotingPair({
        cardA: {id: 'card-a', ink: 'Emerald'},
        cardB: {id: 'card-b', ink: 'Sapphire'},
        aggregateScore: 9,
      });

      trackPairVote('score', pair, 8);

      expect(trackEvent).toHaveBeenCalledWith('vote_submitted', {
        voteType: 'score',
        cardAId: 'card-a',
        cardBId: 'card-b',
        cardAInk: 'Emerald',
        cardBInk: 'Sapphire',
        engineScore: 9,
        synergyCount: pair.connections.length,
        userScore: 8,
      });
    });

    it('emits a null userScore when the surface has no numeric value', () => {
      trackPairVote('in_depth', createVotingPair(), null);

      expect(trackEvent).toHaveBeenCalledWith(
        'vote_submitted',
        expect.objectContaining({voteType: 'in_depth', userScore: null}),
      );
    });
  });
});
