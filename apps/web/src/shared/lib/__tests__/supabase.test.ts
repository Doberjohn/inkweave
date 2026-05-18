import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  getSupabase,
  submitVote,
  getPairScore,
  deriveAccuracyDistribution,
  type PairScore,
  _resetClient,
} from '../supabase';

// Chainable mock for .from().select().eq().eq().single()
const mockSingle = vi.fn();
const mockEq2 = vi.fn(() => ({single: mockSingle}));
const mockEq1 = vi.fn(() => ({eq: mockEq2}));
const mockSelect = vi.fn(() => ({eq: mockEq1}));
const mockFrom = vi.fn(() => ({select: mockSelect}));
const mockRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({rpc: mockRpc, from: mockFrom})),
}));

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();
  // Override .env.local values so "not configured" tests work
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSupabase', () => {
  it('returns null when env vars are missing', () => {
    expect(getSupabase()).toBeNull();
  });

  it('returns a client when env vars are set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');

    const client = getSupabase();
    expect(client).not.toBeNull();

    vi.unstubAllEnvs();
  });

  it('returns the same singleton on repeated calls', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');

    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);

    vi.unstubAllEnvs();
  });
});

describe('submitVote', () => {
  it('returns error when Supabase is not configured', async () => {
    const result = await submitVote({cardA: 'a', cardB: 'b', accuracy: 0});
    expect(result).toEqual({error: 'Supabase not configured'});
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls submit_vote RPC with quick vote params', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockResolvedValue({error: null});

    await submitVote({cardA: 'card_x', cardB: 'card_y', accuracy: -1});

    expect(mockRpc).toHaveBeenCalledWith('submit_vote', {
      p_card_a: 'card_x',
      p_card_b: 'card_y',
      p_accuracy: -1,
      p_is_real: undefined,
      p_score: undefined,
      p_would_play: undefined,
      p_who_carries: undefined,
      p_difficulty: undefined,
    });

    vi.unstubAllEnvs();
  });

  it('calls submit_vote RPC with in-depth vote params', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockResolvedValue({error: null});

    await submitVote({
      cardA: 'a',
      cardB: 'b',
      accuracy: 1,
      isReal: true,
      score: 8,
      wouldPlay: false,
      whoCarries: 'both',
      difficulty: 2,
    });

    expect(mockRpc).toHaveBeenCalledWith('submit_vote', {
      p_card_a: 'a',
      p_card_b: 'b',
      p_accuracy: 1,
      p_is_real: true,
      p_score: 8,
      p_would_play: false,
      p_who_carries: 'both',
      p_difficulty: 2,
    });

    vi.unstubAllEnvs();
  });

  it('returns rate_limited for P0429 error code', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockResolvedValue({
      error: {code: 'P0429', message: 'Rate limit exceeded'},
    });

    const result = await submitVote({cardA: 'a', cardB: 'b', accuracy: 0});
    expect(result).toEqual({error: 'rate_limited'});

    vi.unstubAllEnvs();
  });

  it('returns error message for other errors', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockResolvedValue({
      error: {code: '42P01', message: 'relation does not exist'},
    });

    const result = await submitVote({cardA: 'a', cardB: 'b', accuracy: 0});
    expect(result).toEqual({error: 'relation does not exist'});

    vi.unstubAllEnvs();
  });

  it('returns null error on success', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockResolvedValue({error: null});

    const result = await submitVote({cardA: 'a', cardB: 'b', accuracy: 0});
    expect(result).toEqual({error: null});

    vi.unstubAllEnvs();
  });

  it('catches network exceptions and returns structured error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockRpc.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await submitVote({cardA: 'a', cardB: 'b', accuracy: 0});
    expect(result).toEqual({error: 'Network error'});

    vi.unstubAllEnvs();
  });
});

describe('getPairScore', () => {
  it('returns null when Supabase is not configured', async () => {
    const result = await getPairScore('a', 'b');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries pair_scores view with canonical pair order', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockSingle.mockResolvedValue({data: {avg_score: 7.5}});

    // Pass in reverse order; should sort to (aaa, zzz)
    await getPairScore('zzz', 'aaa');

    expect(mockFrom).toHaveBeenCalledWith('pair_scores');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq1).toHaveBeenCalledWith('card_a_id', 'aaa');
    expect(mockEq2).toHaveBeenCalledWith('card_b_id', 'zzz');

    vi.unstubAllEnvs();
  });

  it('returns data from the view', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const mockData = {
      card_a_id: 'a',
      card_b_id: 'b',
      total_votes: 10,
      score_votes: 8,
      avg_score: 7.25,
    };
    mockSingle.mockResolvedValue({data: mockData});

    const result = await getPairScore('a', 'b');
    expect(result).toEqual(mockData);

    vi.unstubAllEnvs();
  });

  it('returns null for PGRST116 (no rows found)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    mockSingle.mockResolvedValue({
      data: null,
      error: {code: 'PGRST116', message: 'No rows found'},
    });

    const result = await getPairScore('a', 'b');
    expect(result).toBeNull();

    vi.unstubAllEnvs();
  });

  it('returns null and logs on query error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSingle.mockResolvedValue({
      data: null,
      error: {code: '42P01', message: 'relation does not exist'},
    });

    const result = await getPairScore('a', 'b');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[getPairScore] Supabase query failed:',
      expect.objectContaining({code: '42P01'}),
    );

    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe('deriveAccuracyDistribution', () => {
  it('returns null when score is null', () => {
    expect(deriveAccuracyDistribution(null)).toBeNull();
  });

  it('returns distribution with computed total', () => {
    const score = {accuracy_lower: 3, accuracy_right: 10, accuracy_higher: 2} as unknown as PairScore;
    expect(deriveAccuracyDistribution(score)).toEqual({lower: 3, right: 10, higher: 2, total: 15});
  });

  it('coerces null column values to zero', () => {
    const score = {accuracy_lower: null, accuracy_right: null, accuracy_higher: null} as unknown as PairScore;
    expect(deriveAccuracyDistribution(score)).toEqual({lower: 0, right: 0, higher: 0, total: 0});
  });
});
