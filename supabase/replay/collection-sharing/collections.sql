-- The pieces of public.collections the collection-sharing migration needs, copied verbatim
-- from the migrations that made them, so the replay holds what production holds. Copy any
-- later change to collections here too, except collections_drop_remap_backups
-- (20261030215155): it writes only to internal.card_id_remap_backup, which nothing here
-- reads, and the remap replay checks it.

-- From 20260710000000_profiles_table.sql: the updated_at trigger function.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- From 20260811000000_collections_table.sql: the table, its policies and its trigger.
create table public.collections (
  owner_id       uuid primary key references auth.users (id) on delete cascade,
  entries        jsonb not null default '{}'::jsonb,
  imported_at    timestamptz not null,
  schema_version smallint not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint collections_entries_object check (jsonb_typeof(entries) = 'object')
);

alter table public.collections enable row level security;

create policy collections_select_own on public.collections
  for select
  using ((select auth.uid()) = owner_id);

create policy collections_insert_own on public.collections
  for insert
  with check ((select auth.uid()) = owner_id);

create policy collections_update_own on public.collections
  for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy collections_delete_own on public.collections
  for delete
  using ((select auth.uid()) = owner_id);

create trigger collections_set_updated_at
  before insert or update on public.collections
  for each row execute function public.set_updated_at();

-- From 20261005000002_declare_table_privileges.sql: the collections grants.
revoke all on public.collections from anon, authenticated;
grant select, delete on public.collections to authenticated;
grant insert (owner_id, entries, imported_at, schema_version)
  on public.collections to authenticated;
grant update (entries, imported_at, schema_version)
  on public.collections to authenticated;
grant all on public.collections to service_role;

-- From 20261005000003_collections_upsert_owner_id.sql: the upsert's conflict key.
grant update (owner_id) on public.collections to authenticated;
