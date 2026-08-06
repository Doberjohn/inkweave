-- Auto-assigned handles. Deck-builder Phase 4 groundwork: a public deck shows who
-- made it, so every signed-in user needs a public name from the moment they arrive.
--
-- Owner rulings (2026-08-06):
--   * the handle is assigned at FIRST SIGN-IN, not at first publish;
--   * generation + collision retry run in the DATABASE, not the client.
--
-- Two problems have to be solved before auto-assignment is safe.
--
-- PROBLEM 1 — assigning a handle currently publishes the user's real name.
--   profiles_select_public_or_own reads `handle is not null or auth.uid() = id`,
--   and RLS is ROW-level: the moment a handle exists, anon can read that row's
--   display_name and avatar_url too. Those are copied from Google/Discord OAuth
--   metadata at signup. Auto-assigning to everyone would therefore publish every
--   user's real name and profile photo as a side effect of signing in.
--
--   Fix: stop copying them. The columns stay (a user may later set a display name
--   deliberately, and avatars are a likely Phase 4+ feature), but nothing populates
--   them without an explicit act. A handle-gated row then leaks nothing, because the
--   only thing in the row is the pseudonym we just generated. This is deliberately
--   NOT a view or a column grant: keeping the row free of PII means the existing
--   one-line policy stays the whole story, with no second mechanism to keep in sync.
--
-- PROBLEM 2 — generation must not run inside the signup transaction.
--   20260710000000 left the handle null on purpose, saying that deriving or uniquing
--   one inside handle_new_user "could raise inside signup and break auth entirely".
--   That is a real failure this project has hit. So claim_handle() is a separate RPC
--   the app calls AFTER authentication, never a trigger. A user who abandons the app
--   mid-signup simply keeps a null handle until their next visit.

-- ── 1. The signup trigger stops copying OAuth PII ───────────────────────────────
--
-- Same contract as before (cannot abort a signup: on-conflict-do-nothing, no CHECK
-- it can violate, empty search_path with fully-qualified names). It now writes the
-- id and nothing else.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

comment on column public.profiles.display_name is
  'Owner-set only. Never populated from OAuth metadata: the row is world-readable '
  'once handle is set, so anything written here becomes public.';
comment on column public.profiles.avatar_url is
  'Owner-set only. See display_name.';

-- ── 2. The word lists ───────────────────────────────────────────────────────────
--
-- `{ink}_{classification}_{NNN}` (owner ruling 2026-08-06). Both word lists are the
-- GAME'S OWN vocabulary, not invented flavour: the six inks, and the card subtypes as
-- they appear in allCards.json. That matters twice over — the strip these names render
-- in is the card's classification line, and the two ink symbols sit immediately beside
-- them, so the handle speaks the same language as the thing it is printed on.
--
-- Excluded from the subtype list on purpose:
--   * character and franchise names (Tigger, Madrigal, Hunny) — the user does not
--     choose this name, so it must not assign anyone a trademarked identity;
--   * multi-word subtypes (Red Panda, Seven Dwarfs) — the CHECK allows no spaces.
--
-- 6 x 37 x 1000 = 222,000 names. A collision is a re-roll, not a failure, so the number
-- that matters is occupancy rather than the birthday bound: this stays comfortable to
-- roughly 100,000 users. Longest result is 'amethyst_musketeer_999' at 22 characters,
-- inside the 30-char CHECK and inside the ~25 characters the deck card's strip can show
-- at its smallest rendered size.
create function public.random_handle()
returns text
language plpgsql
set search_path = ''
as $$
declare
  inks constant text[] := array[
    'amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel'
  ];
  classifications constant text[] := array[
    'storyborn', 'dreamborn', 'floodborn', 'hero', 'ally', 'villain', 'song',
    'princess', 'sorcerer', 'super', 'prince', 'mentor', 'detective', 'queen',
    'alien', 'whisper', 'toy', 'king', 'inventor', 'captain', 'team', 'monster',
    'deity', 'fairy', 'vineling', 'gargoyle', 'dragon', 'ghost', 'robot',
    'pirate', 'puppy', 'giant', 'knight', 'dinosaur', 'musketeer', 'hyena', 'racer'
  ];
begin
  return inks[1 + floor(random() * array_length(inks, 1))::int]
      || '_'
      || classifications[1 + floor(random() * array_length(classifications, 1))::int]
      || '_'
      || lpad(floor(random() * 1000)::int::text, 3, '0');
end;
$$;
revoke execute on function public.random_handle() from public, anon, authenticated;

-- ── 3. claim_handle() ───────────────────────────────────────────────────────────
--
-- Idempotent: returns the caller's existing handle untouched if they have one, so a
-- client may call it on every load without a guard and without ever changing a name
-- the user has already seen or chosen.
--
-- The retry loop is the reason this is server-side. profiles_handle_lower_key is the
-- ONLY authority on availability (20260710000000 is explicit that a read-then-insert
-- pre-check is a TOCTOU bug), so the only correct algorithm is write-and-catch-23505.
-- Doing that from the client would mean a round trip per collision on a shared
-- namespace; here it is one statement.
--
-- The loop is bounded rather than infinite: after 10 tries it swaps the 3-digit tail
-- for 6 hex characters (16.7M suffixes), which cannot realistically collide. Note it
-- REPLACES the digits rather than appending — appending would make the longest name
-- 'amethyst_musketeer_999_a1b2c3d4' at 31 characters and violate the 30-char CHECK,
-- turning the last-resort path into a guaranteed failure. Replacing caps it at 25.
create function public.claim_handle()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := (select auth.uid());
  existing  text;
  candidate text;
begin
  if uid is null then
    raise exception 'claim_handle requires an authenticated caller'
      using errcode = '28000';
  end if;

  -- The row normally exists (on_auth_user_created made it). Create it if not, so a
  -- user who predates the trigger is not permanently handle-less.
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  select handle into existing from public.profiles where id = uid;
  if existing is not null then
    return existing;
  end if;

  for i in 1..10 loop
    candidate := public.random_handle();
    begin
      update public.profiles set handle = candidate where id = uid;
      return candidate;
    exception when unique_violation then
      -- Name taken between generation and write. Try another.
    end;
  end loop;

  -- left(s, -4) drops the '_NNN' tail, so this stays '{ink}_{classification}_{hex}'
  -- and reads like every other handle. md5 rather than pgcrypto's gen_random_bytes:
  -- md5 lives in pg_catalog, which stays resolvable under `search_path = ''`, so this
  -- carries no extension dependency.
  candidate := left(public.random_handle(), -4) || '_' || substr(md5(random()::text), 1, 6);
  update public.profiles set handle = candidate where id = uid;
  return candidate;
end;
$$;

-- SECURITY DEFINER + Supabase's default grants would leave this callable by anon via
-- /rest/v1/rpc. It raises on a null auth.uid() anyway, but the grant is removed so the
-- function is not reachable at all without a session.
--
-- ADVISOR NOTE, verified against the live linter after this migration ran: advisor 0028
-- (anon can execute a SECURITY DEFINER function) is silent, which is the revoke working.
-- Advisor 0029 (SIGNED-IN users can) DOES fire on claim_handle, and is accepted: an RPC
-- whose whole purpose is to be called by authenticated users cannot avoid it without
-- becoming SECURITY INVOKER, and invoker would break the function, since it writes a
-- handle that must be unique across rows the caller cannot see under RLS.
revoke execute on function public.claim_handle() from public, anon;
grant execute on function public.claim_handle() to authenticated;

-- Changing a handle later needs no RPC: profiles_update_own already permits it, the
-- CHECK enforces the format (23514) and profiles_handle_lower_key enforces uniqueness
-- (23505). The client maps those two codes to messages. Only the initial assignment
-- needs the retry loop, because only it picks the name.
