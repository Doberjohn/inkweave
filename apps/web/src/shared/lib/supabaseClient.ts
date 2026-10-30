// The only module that imports the Supabase SDK as a value (#729). supabase.ts reaches it through
// a dynamic import, so the SDK ships in this module's own chunk, `supabaseClient-*.js`, which
// the root package.json gives its own size budget. Import it statically from anywhere else
// and the SDK lands back in the entry chunk.
import {GoTrueClient, type GoTrueClientOptions} from '@supabase/auth-js';
import {PostgrestClient} from '@supabase/postgrest-js';
import type {Database} from './database.types';

/** Required, not optional: omitting it would silently drop the storage key and PKCE flow. */
export type AuthOptions = Required<
  Pick<
    GoTrueClientOptions,
    'persistSession' | 'autoRefreshToken' | 'detectSessionInUrl' | 'flowType' | 'storageKey'
  >
>;

/**
 * The Supabase client, built from the two supabase-js packages the app uses (#933): auth-js for
 * sign-in and postgrest-js for tables and RPCs, without the realtime, storage and functions
 * clients `createClient` also builds. Its requests carry what supabase-js's carry: the anon key
 * as `apikey`, and as the bearer token until someone signs in, whose access token then takes its
 * place on tables and RPCs. A class, as supabase-js's is.
 */
export class SupabaseClient extends PostgrestClient<Database> {
  readonly auth: GoTrueClient;

  constructor(url: string, key: string, auth: AuthOptions) {
    const base = url.endsWith('/') ? url : `${url}/`;
    const authClient = new GoTrueClient({
      ...auth,
      url: new URL('auth/v1', base).href,
      headers: {Authorization: `Bearer ${key}`, apikey: key},
    });
    super(new URL('rest/v1', base).href, {
      schema: 'public',
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        if (!headers.has('apikey')) headers.set('apikey', key);
        if (!headers.has('Authorization')) {
          const {data} = await authClient.getSession();
          headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`);
        }
        return fetch(input, {...init, headers});
      },
    });
    this.auth = authClient;
  }
}

export function createSupabaseClient(url: string, key: string, auth: AuthOptions): SupabaseClient {
  return new SupabaseClient(url, key, auth);
}
