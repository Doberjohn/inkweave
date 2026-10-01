import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// The module under test calls these at import time through getSupabase().
const createClient = vi.fn(() => ({mock: 'client'}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...(args as [])),
  SupabaseClient: class {},
}));
vi.mock('./sentry', () => ({onSentryReady: vi.fn()}));

import {getSupabase, _resetClient} from './supabase';

/**
 * These guard a bug that shipped silently: `getSupabase` assigned `client` twice,
 * once with the auth options and once without, so the second call discarded PKCE,
 * session persistence and token refresh. Both forms typechecked and linted, and no
 * suite constructed a real client, so nothing observed it.
 *
 * The env is stubbed rather than inherited: a developer's `.env.local` supplies real
 * Supabase credentials to vitest, which would let these pass through the wrong path.
 */
describe('getSupabase', () => {
  beforeEach(() => {
    createClient.mockClear();
    _resetClient();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetClient();
  });

  it('constructs the client exactly once, so no later call can overwrite the configured one', () => {
    getSupabase();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('configures PKCE and a persisted session, which the OAuth callback depends on', () => {
    getSupabase();
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }),
      }),
    );
  });

  it('returns null and builds nothing when the env is absent', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    _resetClient();
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
