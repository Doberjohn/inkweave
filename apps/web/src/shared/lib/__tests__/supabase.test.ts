import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  loadSupabase,
  submitVote,
  getPairScore,
  deriveAccuracyDistribution,
  type PairScore,
  _resetClient,
} from '../supabase';

// Chainable mock for .from().select().eq().eq().maybeSingle()
const mockMaybeSingle = vi.fn();
const mockEq2 = vi.fn(() => ({maybeSingle: mockMaybeSingle}));
const mockEq1 = vi.fn(() => ({eq: mockEq2}));
const mockSelect = vi.fn(() => ({eq: mockEq1}));
const mockFrom = vi.fn(() => ({select: mockSelect}));
const mockRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({rpc: mockRpc, from: mockFrom})),
  SupabaseClient: class SupabaseClient {},
}));

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(),
  captureException: vi.fn(),
  startSpan: vi.fn(),
  addIntegration: vi.fn(),
  supabaseIntegration: vi.fn((options: unknown) => ({name: 'Supabase', options})),
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

describe('isSupabaseConfigured', () => {
  it('is false when env vars are missing', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('is true when both env vars are set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe('loadSupabase', () => {
  it('resolves null without creating a client when env vars are missing', async () => {
    await expect(loadSupabase()).resolves.toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates the client once and returns the same singleton', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');

    const a = await loadSupabase();
    const b = await loadSupabase();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(createClient).toHaveBeenCalledOnce();
  });

  // A failed download (or, in production, the empty module main.tsx leaves behind) must not
  // poison the cache: the next vote or sign-in tries again.
  it('retries after a failed load', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    vi.mocked(createClient).mockImplementationOnce(() => {
      throw new TypeError('createClient is not a function');
    });

    await expect(loadSupabase()).rejects.toThrow(TypeError);
    await expect(loadSupabase()).resolves.not.toBeNull();
  });
});

describe("Sentry's Supabase integration (#640)", () => {
  // Fresh copies: sentry.ts and the client singleton keep their state at module level.
  async function loadFresh() {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const supabase = await import('../supabase');
    const {loadSentry} = await import('../sentry');
    const Sentry = await import('@sentry/react');
    const {SupabaseClient} = await import('@supabase/supabase-js');
    return {loadSupabase: supabase.loadSupabase, loadSentry, Sentry, SupabaseClient};
  }

  it('is added when Sentry loads after the client exists', async () => {
    const {loadSupabase, loadSentry, Sentry, SupabaseClient} = await loadFresh();

    await loadSupabase();
    expect(Sentry.addIntegration).not.toHaveBeenCalled();

    await loadSentry();
    expect(Sentry.supabaseIntegration).toHaveBeenCalledWith({supabaseClient: SupabaseClient});
    expect(Sentry.addIntegration).toHaveBeenCalledOnce();
  });

  it('is added at once when Sentry loaded before the client', async () => {
    const {loadSupabase, loadSentry, Sentry} = await loadFresh();

    await loadSentry();
    await loadSupabase();

    expect(Sentry.addIntegration).toHaveBeenCalledOnce();
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
    mockMaybeSingle.mockResolvedValue({data: {avg_score: 7.5}, error: null});

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
    mockMaybeSingle.mockResolvedValue({data: mockData, error: null});

    const result = await getPairScore('a', 'b');
    expect(result).toEqual(mockData);

    vi.unstubAllEnvs();
  });

  it('returns null when the pair has no votes yet', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    // maybeSingle() resolves to {data: null, error: null} for zero rows — no
    // PGRST116 error, so nothing reaches the Sentry Supabase integration.
    mockMaybeSingle.mockResolvedValue({data: null, error: null});

    const result = await getPairScore('a', 'b');
    expect(result).toBeNull();

    vi.unstubAllEnvs();
  });

  it('returns null and logs on query error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
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
