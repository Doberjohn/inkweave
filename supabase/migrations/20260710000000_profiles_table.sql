-- profiles: one row per auth user, holding PUBLIC IDENTITY ONLY (handle,
-- display_name, avatar_url). Never mirror auth.users PII (email, provider
-- tokens) here. Deck-builder Phase 1, PLAN Part B.
--
-- Visibility is handle-gated: a profile becomes world-readable only once the
-- user publishes a @handle (a Phase 4 action). Until then only the owner sees
-- their own row, so the OAuth-derived display name is not exposed to anon
-- scrapers before opt-in. Nothing in Phase 1 reads other users' profiles.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Handle is optional in v1 (set at profile publish, PLAN Part E.5). When set it
  -- must be a 3-30 char slug; case-insensitive uniqueness is the index below.
  constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_len
    check (display_name is null or char_length(display_name) <= 60)
);

-- Case-insensitive handle uniqueness (blocks Alice vs alice impersonation), but
-- only across rows that HAVE a handle, so unlimited rows keep a null handle (the
-- v1 default). This index is the ONLY authority on availability: the app must
-- treat a 23505 as handle-taken, never a read-then-insert TOCTOU pre-check.
create unique index profiles_handle_lower_key
  on public.profiles (lower(handle))
  where handle is not null;

alter table public.profiles enable row level security;

-- Read: a published (handle set) profile is world-visible; owners always see own row.
create policy profiles_select_public_or_own on public.profiles
  for select to anon, authenticated
  using (handle is not null or (select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No DELETE policy: profile lifecycle rides the auth.users ON DELETE CASCADE.

-- Generic updated_at stamper, reused by later owner-scoped tables (decks).
-- SECURITY INVOKER (a plain trigger, no cross-table access) but search_path is
-- still pinned to '' per the repo's function-search_path advisor discipline.
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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile whenever an auth user is created. SECURITY DEFINER so
-- it can write public.profiles from inside the auth signup transaction; empty
-- search_path with fully-qualified names to preempt function_search_path_mutable.
-- Handle is deliberately left null (deriving/uniquing it here could raise inside
-- signup and break auth entirely). display_name / avatar_url are copied from the
-- OAuth metadata (Google + Discord populate these under varying keys). nullif +
-- on-conflict-do-nothing make the insert incapable of aborting a signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
-- EXECUTE revoked so this SECURITY DEFINER function is NOT anon-callable via
-- /rest/v1/rpc (which would trip advisor 0028/0029, as submit_vote does). A
-- trigger still fires after the revoke.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Least privilege: Supabase default privileges already grant ALL to anon +
-- authenticated on new public tables, and RLS is the row gate. Strip the write
-- grants anon must never hold, and delete from authenticated (lifecycle is the
-- auth.users cascade, not an API delete).
revoke insert, update, delete, truncate, references on public.profiles from anon;
revoke delete, truncate, references on public.profiles from authenticated;
