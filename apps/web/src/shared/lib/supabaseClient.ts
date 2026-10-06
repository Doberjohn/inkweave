// The only module that imports supabase-js as a value (#729). supabase.ts reaches it through a
// dynamic import, so the SDK ships in this module's own chunk, `supabaseClient-*.js`, which
// the root package.json gives its own size budget. Import it statically from anywhere else
// and the SDK lands back in the entry chunk.
import {createClient, SupabaseClient, type SupabaseClientOptions} from '@supabase/supabase-js';
import type {Database} from './database.types';

export {SupabaseClient};

export function createSupabaseClient(
  url: string,
  key: string,
  auth: SupabaseClientOptions<'public'>['auth'],
): SupabaseClient<Database> {
  return createClient<Database>(url, key, {auth});
}
