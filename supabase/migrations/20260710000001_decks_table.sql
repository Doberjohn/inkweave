-- decks: saved (and first-sign-in-migrated) decks, one row per deck. Deck-builder
-- Phase 1, PLAN Part B. Owner-scoped: a user reads/writes only their own rows;
-- anyone may read a row the owner explicitly marked is_public. cards is the
-- JSONB DeckCard[] from apps/web/src/features/deck/types.ts.

create table public.decks (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  gameplan       text,
  inks           text[]  not null default '{}',
  cards          jsonb   not null default '[]'::jsonb,
  is_public      boolean not null default false,
  schema_version smallint not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint decks_name_len   check (char_length(name) between 1 and 120),
  constraint decks_cards_array check (jsonb_typeof(cards) = 'array'),
  -- Archetype union from apps/web/src/features/deck/types.ts (nullable = auto-detect).
  constraint decks_gameplan_valid
    check (gameplan is null or gameplan in
      ('aggro', 'tempo', 'midrange', 'control', 'combo', 'ramp')),
  -- Validate the ink VALUES (the 6 inks never rotate) but deliberately do NOT cap
  -- the ink COUNT: the two-ink rule is advisory (PLAN line 13), so an over-ink
  -- draft must still save and surface its legality error in the app.
  constraint decks_inks_valid
    check (inks <@ array['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']::text[])
);

create index decks_owner_id_idx on public.decks (owner_id);
-- Backs the public feed lookups (Phase 4); partial keeps it small.
create index decks_public_updated_idx
  on public.decks (updated_at desc) where is_public;

alter table public.decks enable row level security;

-- Read: your own decks always; anyone (incl. anon) may read an is_public deck.
create policy decks_select_public_or_own on public.decks
  for select to anon, authenticated
  using (is_public or (select auth.uid()) = owner_id);

-- Insert: you may only create decks you own. Without this WITH CHECK an authed
-- user could forge owner_id onto a victim (authorship spoofing). Mandatory.
create policy decks_insert_own on public.decks
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Update: only your rows (USING); cannot reassign to another owner (WITH CHECK).
-- Both are stated explicitly; a lone USING is not relied on to double as the check.
create policy decks_update_own on public.decks
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy decks_delete_own on public.decks
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

-- Least privilege: anon may only SELECT (public decks); never write.
revoke insert, update, delete, truncate, references on public.decks from anon;
revoke truncate, references on public.decks from authenticated;
