-- Applied 2026-10-05 as 20261005101307 (#705). The filename stamp and the applied
-- version differ here as they do for every migration in this repo: the MCP assigns its
-- own timestamp at apply time, and nothing replays these files. See #706.
--
-- Least privilege for `collections` and `profiles`.
--
-- `profiles` and `decks` each end their creating migration with table-level revokes,
-- because Supabase's default privileges grant ALL to anon and authenticated on a new
-- public table. `collections` shipped with NONE, so anon held all seven privileges on
-- it. RLS hid that for row access (the owner-only policies are PUBLIC-scoped, so
-- auth.uid() is null for anon and no row matches), but Postgres does not subject
-- TRUNCATE to RLS at all.

-- 1. collections. anon needs nothing here: unlike a deck, a collection is never public,
-- which is why this table has no public read policy.
revoke all on public.collections from anon;

-- authenticated keeps the four verbs its policies scope, minus the two no policy can
-- constrain.
revoke truncate, references on public.collections from authenticated;

-- Column-scoped writes, matching exactly what collectionRepository sends. The upsert is
-- INSERT ... ON CONFLICT DO UPDATE, so it needs both verbs. updated_at is omitted on
-- purpose: the collections_set_updated_at trigger owns it on INSERT and UPDATE, and
-- created_at should never be client-settable.
revoke insert, update on public.collections from authenticated;
grant insert (owner_id, entries, imported_at, schema_version)
  on public.collections to authenticated;
grant update (entries, imported_at, schema_version)
  on public.collections to authenticated;

-- 2. profiles. profiles_update_own constrains the ROW but the grant covered every
-- COLUMN, so an owner could rewrite their own handle, and created_at, with a direct
-- PostgREST call. The handle is permanent (owner ruling 2026-10-02) and is deliberately
-- absent from the grant below. claim_handle() is SECURITY DEFINER and so is unaffected
-- by this restriction; it still assigns handles.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
