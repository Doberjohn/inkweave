import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { onSentryReady } from './sentry';

export type InkweaveSupabase = SupabaseClient<Database>;

/**
 * Where supabase-js persists the session in localStorage. SessionContext reads it to decide
 * whether a visitor has a session worth restoring, so the key and the client must agree; a
 * test pins that the real supabase-js stores the session under exactly this key.
 */
export const AUTH_STORAGE_KEY = 'inkweave:auth';

export const AUTH_OPTIONS = {
  // Persist the session so a signed-in user stays signed in across reloads,
  // auto-refresh tokens, and complete the OAuth PKCE redirect on /auth/callback.
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
  storageKey: AUTH_STORAGE_KEY,
} satisfies SupabaseClientOptions<'public'>['auth'];

/*
 * supabase-js, kept off the critical path (#729). It used to be a static import, which put the
 * SDK in the entry chunk for every visitor, though most never sign in or vote. It now loads on
 * the first call that needs a client: a vote, a pair-score read, a profile call, a sign-in, or
 * SessionContext restoring a stored session.
 */

let loading: Promise<InkweaveSupabase | null> | null = null;
let envWarningLogged = false;

/**
 * Whether this build has Supabase credentials. Synchronous and download-free, for the callers
 * that only need to know if voting and auth are available at all.
 */
export function isSupabaseConfigured(): boolean {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) return true;
  // Log once in dev so missing config is visible
  if (import.meta.env.DEV && !envWarningLogged) {
    envWarningLogged = true;
    console.info(
      '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Voting features disabled',
    );
  }
  return false;
}

/**
 * Imports supabase-js and creates the client, once. Resolves to null when this build has no
 * credentials, so voting and auth degrade gracefully. Rejects when the SDK fails to download
 * (offline, a stale deploy), and forgets that attempt so the next call retries.
 */
export function loadSupabase(): Promise<InkweaveSupabase | null> {
  // Build-time constants, so builds without credentials drop the import below entirely.
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.resolve(null);

  // A local module rather than supabase-js itself, so the chunk is named after it and the
  // size budget can find it.
  loading ??= import('./supabaseClient')
    // Read the module only as `sdk.<name>` inside this callback, and never pass it on: Rolldown
    // drops the exports a dynamic import never names, but once the namespace escapes it ships
    // the whole module (this is how all of Sentry once landed in a chunk, #640).
    .then((sdk): InkweaveSupabase => {
      const client = sdk.createSupabaseClient(url, key, AUTH_OPTIONS);
      // Sentry's Supabase integration instruments the SupabaseClient class, so it covers this
      // client whether Sentry loads before or after it exists. Registered here, where supabase-js
      // is already loaded, rather than in Sentry's init, which would download it on every page.
      const clientClass = sdk.SupabaseClient;
      onSentryReady((sentry) => sentry.addSupabaseIntegration(clientClass));
      return client;
    })
    // A failed import rejects, except in production builds, where main.tsx cancels Vite's
    // preload error and the import resolves empty, so `createClient` above throws. Both land
    // here; clearing the cache lets a later call try again instead of failing forever.
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** @internal Reset singleton for testing. */
export function _resetClient(): void {
  loading = null;
  envWarningLogged = false;
}

// --- Vote types ---

export type Accuracy = -1 | 0 | 1;

export type QuickVote = {
  cardA: string;
  cardB: string;
  accuracy: Accuracy;
};

// Constrain score to 1-10
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

/**
 * The `submit_vote` RPC's arguments. A quick vote is an in-depth vote with only the accuracy
 * dimension, so read through the wider type: the fields a quick vote lacks go as undefined.
 */
function toSubmitVoteArgs(vote: QuickVote | InDepthVote) {
  const dims: Partial<InDepthVote> = vote;
  return {
    p_card_a: vote.cardA,
    p_card_b: vote.cardB,
    p_accuracy: dims.accuracy,
    p_is_real: dims.isReal,
    p_score: dims.score,
    p_would_play: dims.wouldPlay,
    p_who_carries: dims.whoCarries,
    p_difficulty: dims.difficulty,
  };
}

export async function submitVote(
  vote: QuickVote | InDepthVote,
): Promise<VoteResult> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };

  // Catch network-level exceptions (fetch rejects, DNS failures, the SDK failing to download)
  try {
    const supabase = await loadSupabase();
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.rpc('submit_vote', toSubmitVoteArgs(vote));

    if (error?.code === 'P0429') return { error: 'rate_limited' };

    // Log RPC errors with context for production debugging
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
  if (!isSupabaseConfigured()) return null;

  const [a, b] = [cardA, cardB].sort();

  try {
    const supabase = await loadSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('pair_scores')
      .select('*')
      .eq('card_a_id', a)
      .eq('card_b_id', b)
      // maybeSingle() → { data: null, error: null } for a pair with no votes yet,
      // instead of the PGRST116 error the Sentry Supabase integration captures.
      .maybeSingle();

    if (error) {
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

/**
 * Pure-function derivation of the distribution from a `pair_scores` row.
 * The accuracy columns are already in `getPairScore`'s `*` select, so
 * any caller that already has the pair score can avoid a second round-trip.
 * Returns null only when the score is null (no row for the pair yet);
 * an all-zero distribution returns {lower:0, right:0, higher:0, total:0}.
 */
export function deriveAccuracyDistribution(score: PairScore | null): AccuracyDistribution | null {
  if (!score) return null;
  const lower = score.accuracy_lower ?? 0;
  const right = score.accuracy_right ?? 0;
  const higher = score.accuracy_higher ?? 0;
  return { lower, right, higher, total: lower + right + higher };
}


