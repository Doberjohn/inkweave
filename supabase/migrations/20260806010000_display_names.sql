-- Display names. Owner ruling 2026-08-06, refining the handle work earlier the same
-- day: a deck card shows a NAME, not an id.
--
-- The split is the familiar one. `handle` stays the unique, lowercase, sluggable
-- identity — the thing a /u/:handle URL and the uniqueness index are built on. It is
-- assigned once and nothing renders it today. `display_name` is what people read, and
-- the user owns it.
--
-- On creation display_name is DERIVED from the handle rather than invented separately,
-- so a brand-new account reads as "Emerald Princess 330" instead of
-- "emerald_princess_330". Same name, written like a name.
--
-- WHAT THIS GIVES UP, deliberately: display_name has no uniqueness constraint (only the
-- 60-char cap from 20260710000000), so two accounts can display the same name. The
-- handle underneath stays unique, so the DATA is never ambiguous — but the visible
-- layer is spoofable. Accepted; it is how every product with display names works, and
-- the alternative (unique display names) makes the friendly name as scarce as the id,
-- which is the problem the split exists to solve.
--
-- The privacy property from the previous migration is UNCHANGED. display_name is still
-- never populated from OAuth metadata; it is derived from a pseudonym this system
-- generated, so a handle-gated row still exposes nothing the user did not get from us.

comment on column public.profiles.display_name is
  'The name shown on published decks. Seeded from the handle in title case at claim '
  'time, then owner-editable. NEVER populated from OAuth metadata: the row is '
  'world-readable once handle is set, so anything written here becomes public. '
  'NOT unique — public.profiles.handle is the unique identity.';

-- ── The handle, written like a name ─────────────────────────────────────────────
--
-- 'emerald_princess_330' -> 'Emerald Princess 330'. initcap treats every non-alphanumeric
-- run as a word break, so the underscores have to become spaces FIRST or the result is
-- 'Emerald_princess_330'. The trailing digits carry no letter and pass through untouched.
create function public.pretty_handle(handle text)
returns text
language sql
immutable
set search_path = ''
as $$
  select initcap(replace(handle, '_', ' '));
$$;
revoke execute on function public.pretty_handle(text) from public, anon, authenticated;

-- ── claim_handle now returns BOTH names ─────────────────────────────────────────
--
-- Dropped and recreated rather than replaced: a return type cannot be changed by
-- CREATE OR REPLACE. The client needs both in one round trip, which is the whole
-- reason for widening it — a second SELECT to fetch the name we just derived would
-- be a request that exists only because the first one under-reported.
drop function if exists public.claim_handle();

create function public.claim_handle()
returns table (handle text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := (select auth.uid());
  cur_handle text;
  cur_name   text;
  candidate  text;
begin
  if uid is null then
    raise exception 'claim_handle requires an authenticated caller'
      using errcode = '28000';
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  select p.handle, p.display_name into cur_handle, cur_name
    from public.profiles p where p.id = uid;

  if cur_handle is not null then
    -- Already has a handle. Backfill the display name if it is missing, which is the
    -- state of every account claimed by the migration that shipped before this one.
    -- A name the user has SET is never touched: the null check is what makes this
    -- idempotent for someone who deliberately renamed themselves.
    if cur_name is null then
      cur_name := public.pretty_handle(cur_handle);
      update public.profiles set display_name = cur_name where id = uid;
    end if;
    return query select cur_handle, cur_name;
    return;
  end if;

  -- 6 x 37 x 1000 = 222,000 names, so a collision is rare and a re-roll rather than a
  -- failure. Bounded at 10 tries; the fallback swaps the 3-digit tail for 6 hex chars
  -- (left(s,-4) drops '_NNN'), capping the result at 25 of the 30 the CHECK allows.
  for i in 1..10 loop
    candidate := public.random_handle();
    begin
      update public.profiles
         set handle = candidate, display_name = public.pretty_handle(candidate)
       where id = uid;
      return query select candidate, public.pretty_handle(candidate);
      return;
    exception when unique_violation then
      -- Name taken between generation and write. Try another.
    end;
  end loop;

  candidate := left(public.random_handle(), -4) || '_' || substr(md5(random()::text), 1, 6);
  update public.profiles
     set handle = candidate, display_name = public.pretty_handle(candidate)
   where id = uid;
  return query select candidate, public.pretty_handle(candidate);
end;
$$;

-- Re-granted because the DROP took the old grants with it. Advisor 0029 fires on this
-- and is accepted: an RPC whose purpose is to serve signed-in users cannot avoid it,
-- and SECURITY INVOKER would break the uniqueness retry, which must see rows the
-- caller cannot read under RLS. Advisor 0028 stays silent — anon has no grant.
revoke execute on function public.claim_handle() from public, anon;
grant execute on function public.claim_handle() to authenticated;

-- ── Backfill ────────────────────────────────────────────────────────────────────
--
-- Rows claimed before this migration have a handle and no display name. Without this
-- they would show nothing until their owner next signed in and re-ran claim_handle.
update public.profiles
   set display_name = public.pretty_handle(handle)
 where handle is not null and display_name is null;
