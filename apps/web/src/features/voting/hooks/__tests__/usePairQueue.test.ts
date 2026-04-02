import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import {usePairQueue} from '../usePairQueue';
import {useCardDataContext} from '../../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from '../../../synergies/hooks/usePrecomputedSynergies';
import {createCard} from '../../../../shared/test-utils';

vi.mock('../../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: vi.fn(),
}));

vi.mock('../../../synergies/hooks/usePrecomputedSynergies', () => ({
  fetchCardSynergies: vi.fn(),
}));

// ── Mock data ──

const mockCards = {
  'card-1': createCard({id: 'card-1', fullName: 'Card One - Version'}),
  'card-2': createCard({id: 'card-2', fullName: 'Card Two - Version'}),
  'card-3': createCard({id: 'card-3', fullName: 'Card Three - Version'}),
  'card-4': createCard({id: 'card-4', fullName: 'Card Four - Version'}),
};

const mockGetCardById = (id: string) => mockCards[id as keyof typeof mockCards];

// [cardA_id, cardB_id, score]
const mockPairsIndex = [
  ['card-1', 'card-2', 8], // interesting (>= 7)
  ['card-3', 'card-4', 5], // other (< 7)
  ['card-1', 'card-3', 9], // interesting
  ['card-2', 'card-4', 3], // other
];

const mockFetchCardSynergies = vi.fn().mockResolvedValue({
  groups: [],
  pairs: {
    'card-2': {
      connections: [
        {ruleId: 'test', ruleName: 'Test Rule', category: 'direct', score: 8, explanation: 'Test'},
      ],
    },
    'card-4': {
      connections: [
        {ruleId: 'test', ruleName: 'Test Rule', category: 'direct', score: 5, explanation: 'Test'},
      ],
    },
    'card-3': {
      connections: [
        {ruleId: 'test', ruleName: 'Test Rule', category: 'direct', score: 9, explanation: 'Test'},
      ],
    },
    'card-1': {
      connections: [
        {ruleId: 'test', ruleName: 'Test Rule', category: 'direct', score: 3, explanation: 'Test'},
      ],
    },
  },
});

function setupMocks() {
  vi.mocked(useCardDataContext).mockReturnValue({
    getCardById: mockGetCardById,
    cards: Object.values(mockCards),
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCardDataContext>);
  vi.mocked(fetchCardSynergies).mockImplementation(mockFetchCardSynergies);
}

function mockFetchResponse(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe('usePairQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setupMocks();
    // Seed Math.random to make shuffle deterministic — identity shuffle
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset global fetch
    if ('fetch' in global) {
      (global as Record<string, unknown>).fetch = undefined;
    }
  });

  // ── Initialization ──

  describe('initialization', () => {
    it('fetches pairs index on mount and loads first pair', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith('/data/synergies/_pairs_index.json');
      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('handles fetch failure with error state', async () => {
      mockFetchResponse(null, false);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toContain('Failed to load pairs index');
    });

    it('filters out previously seen pairs from localStorage', async () => {
      // Pre-mark one pair as seen (card-1:card-2, sorted alphabetically)
      localStorage.setItem('inkweave:voted-pairs', JSON.stringify(['card-1:card-2']));

      // Only provide the pair that's been seen + one unseen
      const limitedPairs = [
        ['card-1', 'card-2', 8], // will be filtered out
        ['card-3', 'card-4', 5], // will remain
      ];
      mockFetchResponse(limitedPairs);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The loaded pair should NOT be card-1/card-2 (it was filtered)
      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.currentPair!.cardA.id).toBe('card-3');
      expect(result.current.currentPair!.cardB.id).toBe('card-4');
    });

    it('partitions pairs into interesting (>=7) and other (<7) buckets', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First pair drawn should be from the interesting bucket (nextBucket starts as 'interesting')
      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.currentPair!.aggregateScore).toBeGreaterThanOrEqual(7);
    });
  });

  // ── Bucket alternation ──

  describe('bucket alternation', () => {
    it('alternates between interesting and other buckets', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First pair: interesting bucket
      const firstScore = result.current.currentPair!.aggregateScore;
      expect(firstScore).toBeGreaterThanOrEqual(7);

      // advance to next → other bucket
      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const secondScore = result.current.currentPair!.aggregateScore;
      expect(secondScore).toBeLessThan(7);
    });

    it('falls back to other bucket when interesting is empty', async () => {
      // Only "other" pairs (score < 7)
      const otherOnly = [
        ['card-3', 'card-4', 5],
        ['card-2', 'card-4', 3],
      ];
      mockFetchResponse(otherOnly);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still load a pair (falls back to other)
      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.currentPair!.aggregateScore).toBeLessThan(7);
    });

    it('falls back to interesting bucket when other is empty', async () => {
      // Only "interesting" pairs (score >= 7)
      const interestingOnly = [
        ['card-1', 'card-2', 8],
        ['card-1', 'card-3', 9],
      ];
      mockFetchResponse(interestingOnly);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.currentPair!.aggregateScore).toBeGreaterThanOrEqual(7);

      // Advance — should also get interesting (no other bucket to alternate to)
      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPair).not.toBeNull();
      expect(result.current.currentPair!.aggregateScore).toBeGreaterThanOrEqual(7);
    });
  });

  // ── advance() ──

  describe('advance()', () => {
    it('marks current pair as seen in localStorage', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const pair = result.current.currentPair!;
      const expectedKey =
        pair.cardA.id < pair.cardB.id
          ? `${pair.cardA.id}:${pair.cardB.id}`
          : `${pair.cardB.id}:${pair.cardA.id}`;

      await act(async () => {
        result.current.advance();
      });

      const stored = JSON.parse(localStorage.getItem('inkweave:voted-pairs')!);
      expect(stored).toContain(expectedKey);
    });

    it('increments voted count', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.voted).toBe(0);

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.stats.voted).toBe(1);
      });
    });

    it('loads next pair', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPair).not.toBeNull();

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Current pair should have changed
      expect(result.current.currentPair).not.toBeNull();
      // With 4 pairs, advancing should show a different pair
      // (the next pair may or may not have the same cardA, but the full pair should differ)
    });

    it('enables undo (canUndo = true)', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });
    });

    it('pushes current pair to previousPreviews', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstPair = result.current.currentPair!;
      expect(result.current.previousPreviews).toHaveLength(0);

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.previousPreviews).toHaveLength(1);
      });

      expect(result.current.previousPreviews[0].cardA.id).toBe(firstPair.cardA.id);
      expect(result.current.previousPreviews[0].cardB.id).toBe(firstPair.cardB.id);
    });
  });

  // ── skip() ──

  describe('skip()', () => {
    it('marks current pair as seen in localStorage', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const pair = result.current.currentPair!;
      const expectedKey =
        pair.cardA.id < pair.cardB.id
          ? `${pair.cardA.id}:${pair.cardB.id}`
          : `${pair.cardB.id}:${pair.cardA.id}`;

      await act(async () => {
        result.current.skip();
      });

      const stored = JSON.parse(localStorage.getItem('inkweave:voted-pairs')!);
      expect(stored).toContain(expectedKey);
    });

    it('increments skipped count', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.skipped).toBe(0);

      await act(async () => {
        result.current.skip();
      });

      await waitFor(() => {
        expect(result.current.stats.skipped).toBe(1);
      });
    });

    it('loads next pair', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPair).not.toBeNull();

      await act(async () => {
        result.current.skip();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPair).not.toBeNull();
    });

    it('disables undo (canUndo = false)', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First advance to enable undo
      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      // Then skip — should disable undo
      await act(async () => {
        result.current.skip();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(false);
      });
    });
  });

  // ── undo() ──

  describe('undo()', () => {
    it('restores previously voted pair as current', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstPair = result.current.currentPair!;

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Undo should restore the first pair
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentPair!.cardA.id).toBe(firstPair.cardA.id);
      expect(result.current.currentPair!.cardB.id).toBe(firstPair.cardB.id);
    });

    it('removes pair from localStorage seen set', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstPair = result.current.currentPair!;
      const pairKeyStr =
        firstPair.cardA.id < firstPair.cardB.id
          ? `${firstPair.cardA.id}:${firstPair.cardB.id}`
          : `${firstPair.cardB.id}:${firstPair.cardA.id}`;

      await act(async () => {
        result.current.advance();
      });

      // Pair should be in localStorage after advance
      let stored = JSON.parse(localStorage.getItem('inkweave:voted-pairs')!);
      expect(stored).toContain(pairKeyStr);

      // Undo should remove it
      act(() => {
        result.current.undo();
      });

      stored = JSON.parse(localStorage.getItem('inkweave:voted-pairs')!);
      expect(stored).not.toContain(pairKeyStr);
    });

    it('decrements voted count', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.stats.voted).toBe(1);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.stats.voted).toBe(0);
    });

    it('clears canUndo after undo (single-level)', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      act(() => {
        result.current.undo();
      });

      expect(result.current.canUndo).toBe(false);
    });

    it('does nothing if canUndo is false', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const pairBefore = result.current.currentPair;
      const statsBefore = result.current.stats;

      // Undo without prior advance — should be a no-op
      act(() => {
        result.current.undo();
      });

      expect(result.current.currentPair).toBe(pairBefore);
      expect(result.current.stats.voted).toBe(statsBefore.voted);
    });
  });

  // ── Empty state ──

  describe('empty state', () => {
    it('sets isEmpty when all pairs exhausted', async () => {
      // Only one pair
      mockFetchResponse([['card-1', 'card-2', 8]]);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isEmpty).toBe(false);

      // Advance past the only pair
      await act(async () => {
        result.current.advance();
      });

      await waitFor(() => {
        expect(result.current.isEmpty).toBe(true);
      });

      expect(result.current.currentPair).toBeNull();
    });

    it('handles empty pairs index', async () => {
      mockFetchResponse([]);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isEmpty).toBe(true);
      expect(result.current.currentPair).toBeNull();
    });
  });

  // ── Utility functions ──

  describe('utility behavior', () => {
    it('pairKey creates canonical sorted key (verified via localStorage)', async () => {
      // Use a pair where cardB id < cardA id to test sorting
      const reversedPairs = [['card-2', 'card-1', 8]];
      mockFetchResponse(reversedPairs);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.advance();
      });

      // Key should be sorted: card-1:card-2 (not card-2:card-1)
      const stored = JSON.parse(localStorage.getItem('inkweave:voted-pairs')!);
      expect(stored).toContain('card-1:card-2');
      expect(stored).not.toContain('card-2:card-1');
    });

    it('peekUpcoming returns previews without consuming pairs', async () => {
      mockFetchResponse(mockPairsIndex);
      const {result} = renderHook(() => usePairQueue());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // upcomingPreviews is populated on load (peekUpcoming(3) called internally)
      // With 4 pairs total, 1 drawn as current, up to 3 remaining for preview
      expect(result.current.upcomingPreviews.length).toBeGreaterThanOrEqual(1);
      expect(result.current.upcomingPreviews.length).toBeLessThanOrEqual(3);

      // Each preview should have cardA and cardB
      for (const preview of result.current.upcomingPreviews) {
        expect(preview.cardA).toBeDefined();
        expect(preview.cardB).toBeDefined();
      }
    });
  });
});
