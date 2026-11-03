-- Applied in the Supabase SQL editor like 20261028090000 (its policies and grants say update
-- and delete, so apply_migration's confirmation would never reach the owner), in one
-- transaction with its history row under the filename stamp, whose statements hold this
-- file's text.
--
-- Binders (#1074): a player's own binders, each a name and rules over their collection,
-- on a shelf after My collection, which is the collection itself and has no row here.
--
-- collection_binders   one row per binder: its name, the sets it covers (scope), its rules
--                      (the filter params, as the address writes them), its cover card and
--                      its place on the shelf. Only its owner reads or writes it. It goes with
--                      the collection's row (on delete cascade): clearing a collection deletes
--                      its binders, and a re-import, which keeps the row, keeps them.
-- collection_shelf     My collection's cover. A table of its own, as collection_sharing is, so
--                      collections keeps its one reader and its upsert.
-- move_binder()        swaps a binder's place with its neighbour's. No client writes place.
--
-- A shelf holds 30 binders. The insert trigger and move_binder() take the same lock per owner,
-- so two tabs at once can't both pass the cap or take one place, and only the owner's own
-- calls take it. The replay in supabase/replay/collection-binders/ checks all of it.

-- ── collection_binders ──────────────────────────────────────────────────────────

create table public.collection_binders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.collections (owner_id) on delete cascade,
  name       text not null,
  scope      text not null default 'all',
  rules      text not null default '',
  cover_id   text,
  place      integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- As the shelf shows it: 1 to 30 characters, no control character or line break, and
  -- neither end blank, so no name looks empty: no space there, as String.prototype.trim counts
  -- them, and no zero-width character. The code points are named because what [[:space:]]
  -- and [[:cntrl:]] match depends on the database's locale.
  constraint collection_binders_name check (
    char_length(name) between 1 and 30
    and name !~ '[\u0001-\u001f\u007f-\u009f\u2028\u2029]'
    and name !~ '^[ \u00a0\u1680\u2000-\u200d\u202f\u205f\u2060\u3000\ufeff]'
    and name !~ '[ \u00a0\u1680\u2000-\u200d\u202f\u205f\u2060\u3000\ufeff]$'),
  -- The set picker's choices: 'all', 'promos', or one set's code ('12', 'P1', 'D23').
  constraint collection_binders_scope check (scope ~ '^[A-Za-z0-9]{1,12}$'),
  -- The app reads the params with the filters' own parser, which drops what it doesn't know,
  -- so this only bounds the row.
  constraint collection_binders_rules check (char_length(rules) <= 1000),
  constraint collection_binders_cover check (cover_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint collection_binders_place check (place >= 0),
  -- Deferrable, so it is checked at the end of each statement and move_binder() can swap two
  -- places in one update. Its index also serves the owner's reads and the cascade.
  constraint collection_binders_owner_place unique (owner_id, place) deferrable initially immediate
);

alter table public.collection_binders enable row level security;

create policy collection_binders_select_own on public.collection_binders
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy collection_binders_insert_own on public.collection_binders
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy collection_binders_update_own on public.collection_binders
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy collection_binders_delete_own on public.collection_binders
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create trigger collection_binders_set_updated_at
  before insert or update on public.collection_binders
  for each row execute function public.set_updated_at();

-- Before each insert, under the owner's lock: at most 30 binders, and the new one's place one
-- past the highest. A deleted binder leaves a gap, which the order doesn't mind. It runs as the
-- caller, so it counts what the select policy shows: every binder of the caller's own. A policy
-- that hid some of them would let the cap undercount.
--
-- A signed-in player's row must name them before the lock: the insert policy checks owner_id
-- only after this trigger, so a row naming another player would otherwise hold that player's
-- lock until the policy turned it down.
create function public.collection_binders_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  held integer;
  last_place integer;
begin
  if current_user = 'authenticated' and new.owner_id is distinct from (select auth.uid()) then
    raise exception 'A binder''s owner_id must be the signed-in player''s'
      using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('collection_binders'), hashtext(new.owner_id::text));
  select count(*), max(b.place) into held, last_place
    from public.collection_binders b
   where b.owner_id = new.owner_id;
  if held >= 30 then
    raise exception 'A shelf holds 30 binders at most' using errcode = 'check_violation';
  end if;
  new.place := coalesce(last_place + 1, 0);
  return new;
end;
$$;
revoke execute on function public.collection_binders_before_insert() from public, anon, authenticated;

create trigger collection_binders_before_insert
  before insert on public.collection_binders
  for each row execute function public.collection_binders_before_insert();

-- The client inserts a binder's name, sets, rules and cover with its owner_id, changes those
-- four by id, and deletes by id. id, place and the timestamps are the server's: a binder moves
-- only through move_binder().
revoke all on public.collection_binders from anon, authenticated;
grant select, delete on public.collection_binders to authenticated;
grant insert (owner_id, name, scope, rules, cover_id) on public.collection_binders to authenticated;
grant update (name, scope, rules, cover_id) on public.collection_binders to authenticated;
grant all on public.collection_binders to service_role;

-- ── move_binder(binder_id, earlier) ─────────────────────────────────────────────
--
-- Swaps the caller's binder with the next one before it (earlier) or after it, and says
-- whether it moved: false when it is already first or last. No such binder of the caller's is
-- P0002, and a null earlier is 22004.
--
-- Security definer because no client holds UPDATE on place; every statement names the
-- caller's own rows.
create function public.move_binder(binder_id uuid, earlier boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  here integer;
  there integer;
begin
  if uid is null then
    raise exception 'move_binder requires an authenticated caller' using errcode = '28000';
  end if;
  if move_binder.earlier is null then
    raise exception 'move_binder needs earlier: true or false' using errcode = 'null_value_not_allowed';
  end if;
  perform pg_advisory_xact_lock(hashtext('collection_binders'), hashtext(uid::text));
  select b.place into here
    from public.collection_binders b
   where b.id = move_binder.binder_id and b.owner_id = uid;
  if not found then
    raise exception 'No such binder' using errcode = 'no_data_found';
  end if;
  if move_binder.earlier then
    select max(b.place) into there
      from public.collection_binders b
     where b.owner_id = uid and b.place < here;
  else
    select min(b.place) into there
      from public.collection_binders b
     where b.owner_id = uid and b.place > here;
  end if;
  if there is null then
    return false;
  end if;
  update public.collection_binders b
     set place = case when b.place = here then there else here end
   where b.owner_id = uid and b.place in (here, there);
  return true;
end;
$$;
revoke execute on function public.move_binder(uuid, boolean) from public, anon;
grant execute on function public.move_binder(uuid, boolean) to authenticated;

-- ── collection_shelf ────────────────────────────────────────────────────────────
--
-- My collection's cover: null is the rarest card held, as for a binder with no cover_id.
create table public.collection_shelf (
  owner_id   uuid primary key references public.collections (owner_id) on delete cascade,
  cover_id   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_shelf_cover check (cover_id ~ '^[A-Za-z0-9_-]{1,40}$')
);

alter table public.collection_shelf enable row level security;

create policy collection_shelf_select_own on public.collection_shelf
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy collection_shelf_insert_own on public.collection_shelf
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy collection_shelf_update_own on public.collection_shelf
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create trigger collection_shelf_set_updated_at
  before insert or update on public.collection_shelf
  for each row execute function public.set_updated_at();

-- The client upserts (owner_id, cover_id), and PostgREST puts every payload column in
-- DO UPDATE SET, so UPDATE covers owner_id too (#706). No DELETE: no cover is a null.
revoke all on public.collection_shelf from anon, authenticated;
grant select on public.collection_shelf to authenticated;
grant insert (owner_id, cover_id) on public.collection_shelf to authenticated;
grant update (owner_id, cover_id) on public.collection_shelf to authenticated;
grant all on public.collection_shelf to service_role;
