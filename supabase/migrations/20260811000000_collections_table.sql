-- The imported Dreamborn collection, tied to an account (#555, epic #452).
--
-- ONE ROW PER USER, so owner_id IS the primary key rather than a surrogate id
-- with a unique index. A collection is not a list you own many of, and the PK
-- makes "at most one" a schema guarantee instead of an application convention —
-- the first-sign-in upload can then be a plain upsert with no read-then-write
-- race to reason about.
--
-- entries is the same shape the client already persists to localStorage:
--   { "<cardId>": { "normal": <int>, "foil": <int> } }
-- Stored as jsonb rather than a collection_cards row per card because nothing
-- queries inside it: the client reads the whole map on load and writes the whole
-- map on import. A 2,472-key object is ~70 KB, well inside a single row, and a
-- relational shape would cost ~2,500 rows per user for zero query benefit.

create table public.collections (
  owner_id       uuid primary key references auth.users (id) on delete cascade,
  entries        jsonb not null default '{}'::jsonb,
  -- When the user ran the import, carried from the client. Deliberately NOT
  -- server-stamped: it is a fact about their export, and it survives the
  -- localStorage -> cloud migration so an older import keeps its real date.
  imported_at    timestamptz not null,
  schema_version smallint not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- An array or scalar here would deserialize into a client shape that silently
  -- owns nothing; the map is the contract.
  constraint collections_entries_object check (jsonb_typeof(entries) = 'object')
);

alter table public.collections enable row level security;

-- Owner-only, all four verbs. Unlike `decks` there is deliberately NO public
-- read policy: a deck can be published, a collection never is. RLS is ROW-level,
-- so adding one later would expose the whole row, not a chosen column.
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

-- BEFORE INSERT OR UPDATE, not just UPDATE. `decks` shipped with update-only and
-- needed a follow-up migration (20260711000000) because on INSERT the column
-- fell back to `default now()`, which an authenticated client can override by
-- POSTing an explicit updated_at. Server-owned on every path from the start.
create trigger collections_set_updated_at
  before insert or update on public.collections
  for each row execute function public.set_updated_at();
