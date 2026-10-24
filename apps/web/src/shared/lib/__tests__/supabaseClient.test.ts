import {describe, it, expect, vi, afterEach} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import type {Database} from '../database.types';
import {AUTH_OPTIONS} from '../supabase';
import {createSupabaseClient, type AuthOptions, type SupabaseClient} from '../supabaseClient';
import {fakeAccessToken} from '../../test-utils';

/*
  The app builds its Supabase client from auth-js and postgrest-js (#933), not with supabase-js's
  createClient, which also builds the realtime, storage and functions clients the app never uses.
  These run the app's calls through both clients against one recorded fetch: they must send the
  same requests (method, URL, body and headers) signed out, signed in and signed out again. The
  one header set aside is X-Client-Info, in which supabase-js reports its own name and version.
*/

const URL_BASE = 'https://pin.placeholder.supabase.co';
const KEY = 'pin-anon-key';

/** The app's auth options, less the session storage, timers and URL check no test here needs. */
const AUTH: AuthOptions = {
  ...AUTH_OPTIONS,
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

interface SentRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Records every request, answering each as Supabase would, as far as the calls below need. */
function recordRequests(): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const headers = Object.fromEntries(request.headers);
    delete headers['x-client-info'];
    sent.push({method: request.method, url: request.url, headers, body: await request.text()});
    const path = new URL(request.url).pathname;
    if (path === '/auth/v1/user') return Response.json({id: 'u1', aud: 'authenticated'});
    if (path === '/auth/v1/logout') return new Response(null, {status: 204});
    return Response.json(path.startsWith('/rest/v1/rpc/') ? null : []);
  });
  return sent;
}

const VOTE = {p_card_a: 'a', p_card_b: 'b', p_accuracy: 1};

/** The calls the app makes: a vote and a pair score signed out, its account calls signed in. */
async function useAsTheAppDoes(
  client: Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>,
  token: string,
) {
  await client
    .from('pair_scores')
    .select('*')
    .eq('card_a_id', 'a')
    .eq('card_b_id', 'b')
    .maybeSingle();
  await client.rpc('submit_vote', VOTE);
  await client.auth.setSession({access_token: token, refresh_token: 'r1'});
  await client
    .from('collections')
    .upsert(
      {owner_id: 'u1', entries: {}, imported_at: '2026-10-23T00:00:00.000Z', schema_version: 1},
      {onConflict: 'owner_id'},
    );
  await client
    .from('profiles')
    .update({display_name: 'Ink'})
    .eq('id', 'u1')
    .select('display_name')
    .maybeSingle();
  await client.rpc('claim_handle');
  await client.from('friendships').delete().eq('requester_id', 'u1').eq('addressee_id', 'u2');
  await client.auth.signOut();
  await client.rpc('submit_vote', VOTE);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Supabase client (#933)', () => {
  it('sends the requests supabase-js sends', async () => {
    const sent = recordRequests();
    // One token for both: a second one could fall in the next second and expire a second later.
    const token = fakeAccessToken();
    // Its own storage key, so auth-js sees two clients rather than one created twice.
    const supabaseJs = createClient<Database>(URL_BASE, KEY, {
      auth: {...AUTH, storageKey: 'supabase-js'},
    });
    await useAsTheAppDoes(supabaseJs, token);
    const fromSupabaseJs = sent.splice(0);

    await useAsTheAppDoes(createSupabaseClient(URL_BASE, KEY, AUTH), token);

    expect(sent).toHaveLength(9);
    expect(sent).toEqual(fromSupabaseJs);
  });

  it('sends the anon key as the bearer token until sign-in, then the access token', async () => {
    const sent = recordRequests();
    const client = createSupabaseClient(URL_BASE, KEY, AUTH);
    const token = fakeAccessToken();

    await client.rpc('submit_vote', VOTE);
    await client.auth.setSession({access_token: token, refresh_token: 'r1'});
    await client.rpc('claim_handle');

    expect(
      sent.map(({url, headers}) => [new URL(url).pathname, headers.apikey, headers.authorization]),
    ).toEqual([
      ['/rest/v1/rpc/submit_vote', KEY, `Bearer ${KEY}`],
      ['/auth/v1/user', KEY, `Bearer ${token}`],
      ['/rest/v1/rpc/claim_handle', KEY, `Bearer ${token}`],
    ]);
  });
});
