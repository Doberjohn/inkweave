import {describe, it, expect, vi, afterEach} from 'vitest';
import {AUTH_OPTIONS, AUTH_STORAGE_KEY} from '../supabase';
import {createSupabaseClient} from '../supabaseClient';
import {fakeAccessToken} from '../../test-utils';

/*
  SessionContext skips downloading the Supabase SDK unless localStorage holds AUTH_STORAGE_KEY
  (#729). That only works while its auth client (auth-js) persists the session under exactly
  that key, an internal detail an SDK upgrade could change: every returning user would then look
  anonymous and be silently signed out. This runs the REAL client (no module mock) with the app's
  own auth options and checks where the session lands.
*/

const URL_BASE = 'https://pin.placeholder.supabase.co';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Supabase session storage key', () => {
  it('persists the session under AUTH_STORAGE_KEY', async () => {
    // setSession validates the token by fetching the user; answer that one call.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({id: 'u1', aud: 'authenticated', role: 'authenticated'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
    );
    const client = createSupabaseClient(URL_BASE, 'pin-anon-key', {
      ...AUTH_OPTIONS,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });

    const {error} = await client.auth.setSession({access_token: fakeAccessToken(), refresh_token: 'r1'});

    expect(error).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain('"refresh_token":"r1"');
  });
});
