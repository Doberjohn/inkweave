-- Applied in the Supabase SQL editor like 20261013000000 (its policies and grants say
-- update and delete, so apply_migration's confirmation would never reach the owner), in one
-- transaction with its history row under the filename stamp. That row's statements hold
-- this file's text, so md5(statements[1]) matches the file.
--
-- Collection sharing (#1045): a player lets their friends see their collection, read only.
--
-- collection_sharing     the switch. A table of its own rather than a collections column, so
--                        collections keeps one reader and its #706 grants, and the sync's
--                        upsert never touches the switch. Its row goes with the collection's
--                        (on delete cascade): clearing a collection turns sharing off, and a
--                        new import starts private.
-- shared_friends()       the caller's accepted friends whose switch is on.
-- friend_collections()   those friends' collections.
--
-- No friend reads either table. Both functions check the friendship and the switch on every
-- call, so turning the switch off, or removing a friend, holds from the friend's next read.
-- The replay in supabase/replay/collection-sharing/ checks all of it.

-- ── collection_sharing ──────────────────────────────────────────────────────────

create table public.collection_sharing (
  owner_id   uuid primary key references public.collections (owner_id) on delete cascade,
  friends    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collection_sharing enable row level security;

create policy collection_sharing_select_own on public.collection_sharing
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy collection_sharing_insert_own on public.collection_sharing
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy collection_sharing_update_own on public.collection_sharing
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create trigger collection_sharing_set_updated_at
  before insert or update on public.collection_sharing
  for each row execute function public.set_updated_at();

-- The client upserts (owner_id, friends), and PostgREST puts every payload column in
-- DO UPDATE SET, so UPDATE covers owner_id too (#706). created_at and updated_at are the
-- server's. No DELETE: off is friends = false, and the row goes only with its collection.
revoke all on public.collection_sharing from anon, authenticated;
grant select on public.collection_sharing to authenticated;
grant insert (owner_id, friends) on public.collection_sharing to authenticated;
grant update (owner_id, friends) on public.collection_sharing to authenticated;
grant all on public.collection_sharing to service_role;

-- ── shared_friends() ────────────────────────────────────────────────────────────
--
-- Ids only: names come from profiles, which the Friends list already reads.
create function public.shared_friends()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.owner_id
  from public.collection_sharing s
  join public.friendships f
    on f.status = 'accepted'
   and ((f.requester_id = (select auth.uid()) and f.addressee_id = s.owner_id)
     or (f.addressee_id = (select auth.uid()) and f.requester_id = s.owner_id))
  where s.friends;
$$;
revoke execute on function public.shared_friends() from public, anon;
grant execute on function public.shared_friends() to authenticated;

-- ── friend_collections(only_friend) ─────────────────────────────────────────────
--
-- What a friend's binder draws and nothing else of the row. Every sharing friend's
-- collection, or only only_friend's. A caller who isn't that player's friend, or whose
-- friend has the switch off, gets no row, as for a friend with no collection, so the call
-- tells a stranger nothing.
create function public.friend_collections(only_friend uuid default null)
returns table (owner_id uuid, entries jsonb, schema_version smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.owner_id, c.entries, c.schema_version
  from public.collections c
  join public.collection_sharing s on s.owner_id = c.owner_id and s.friends
  join public.friendships f
    on f.status = 'accepted'
   and ((f.requester_id = (select auth.uid()) and f.addressee_id = c.owner_id)
     or (f.addressee_id = (select auth.uid()) and f.requester_id = c.owner_id))
  where friend_collections.only_friend is null or c.owner_id = friend_collections.only_friend;
$$;
revoke execute on function public.friend_collections(uuid) from public, anon;
grant execute on function public.friend_collections(uuid) to authenticated;
