import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;
let envWarningLogged = false;

/**
 * Env-gated Supabase client singleton.
 * Returns null when VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing,
 * allowing voting features to gracefully degrade.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Fix #8: Log once in dev so missing config is visible
    if (import.meta.env.DEV && !envWarningLogged) {
      envWarningLogged = true;
      console.info(
        '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — voting features disabled',
      );
    }
    return null;
  }

  client = createClient<Database>(url, key);
  return client;
}

/** @internal Reset singleton for testing. */
export function _resetClient(): void {
  client = null;
  envWarningLogged = false;
}

// --- Vote types ---

export type Accuracy = -1 | 0 | 1;

export type QuickVote = {
  cardA: string;
  cardB: string;
  accuracy: Accuracy;
};

// Fix #6: Constrain score to 1-10
export type Score = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type InDepthVote = {
  cardA: string;
  cardB: string;
  accuracy?: Accuracy;
  isReal?: boolean;
  score?: Score;
  wouldPlay?: boolean;
  whoCarries?: 'a' | 'b' | 'both' | 'neither';
  difficulty?: 1 | 2 | 3;
};

export type VoteResult = { error: null | 'rate_limited' | string };

// --- Vote submission ---

export async function submitVote(
  vote: QuickVote | InDepthVote,
): Promise<VoteResult> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase not configured' };

  // Fix #3: Catch network-level exceptions (fetch rejects, DNS failures)
  try {
    const { error } = await supabase.rpc('submit_vote', {
      p_card_a: vote.cardA,
      p_card_b: vote.cardB,
      p_accuracy: vote.accuracy ?? undefined,
      p_is_real: 'isReal' in vote ? vote.isReal ?? undefined : undefined,
      p_score: 'score' in vote ? vote.score ?? undefined : undefined,
      p_would_play:
        'wouldPlay' in vote ? vote.wouldPlay ?? undefined : undefined,
      p_who_carries:
        'whoCarries' in vote ? vote.whoCarries ?? undefined : undefined,
      p_difficulty:
        'difficulty' in vote ? vote.difficulty ?? undefined : undefined,
    });

    if (error?.code === 'P0429') return { error: 'rate_limited' };

    // Fix #4: Log RPC errors with context for production debugging
    if (error) {
      console.error('[submitVote] RPC error:', {
        code: error.code,
        message: error.message,
        pair: `${vote.cardA} / ${vote.cardB}`,
      });
    }

    return { error: error?.message ?? null };
  } catch (e) {
    console.error('[submitVote] Network error:', e);
    return { error: 'Network error' };
  }
}

// --- Score reading ---

export type PairScore = Database['public']['Views']['pair_scores']['Row'];

export async function getPairScore(
  cardA: string,
  cardB: string,
): Promise<PairScore | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [a, b] = [cardA, cardB].sort();

  try {
    const { data, error } = await supabase
      .from('pair_scores')
      .select('*')
      .eq('card_a_id', a)
      .eq('card_b_id', b)
      .single();

    if (error) {
      // PGRST116 = no rows found — expected for pairs with no votes
      if (error.code === 'PGRST116') return null;
      console.error('[getPairScore] Supabase query failed:', {
        code: error.code,
        message: error.message,
        pair: `${a} / ${b}`,
      });
      return null;
    }

    return data;
  } catch (e) {
    console.error('[getPairScore] Network error:', e);
    return null;
  }
}

// --- Accuracy distribution ---

export type AccuracyDistribution = {
  lower: number;
  right: number;
  higher: number;
  total: number;
};

export async function getAccuracyDistribution(
  cardA: string,
  cardB: string,
): Promise<AccuracyDistribution | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [a, b] = [cardA, cardB].sort();

  try {
    const { data, error } = await supabase
      .from('pair_scores')
      .select('accuracy_lower, accuracy_right, accuracy_higher')
      .eq('card_a_id', a)
      .eq('card_b_id', b)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[getAccuracyDistribution] Supabase query failed:', {
        code: error.code,
        message: error.message,
        pair: `${a} / ${b}`,
      });
      return null;
    }

    const lower = data.accuracy_lower ?? 0;
    const right = data.accuracy_right ?? 0;
    const higher = data.accuracy_higher ?? 0;

    return { lower, right, higher, total: lower + right + higher };
  } catch (e) {
    console.error('[getAccuracyDistribution] Network error:', e);
    return null;
  }
}
