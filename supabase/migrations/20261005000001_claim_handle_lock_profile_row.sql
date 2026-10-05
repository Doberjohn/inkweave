-- Applied 2026-10-05 as 20261005101427 (#705). Filename stamp and applied version
-- differ by repo convention; see the sibling migration and #706.
--
-- Close the claim_handle race.
--
-- The only change from the previous definition is `for update` on the SELECT. Without
-- it the read takes no lock, so two concurrent calls for the SAME user both see a null
-- handle, both fall through to the generate-and-update loop, and the second overwrites
-- the first. The first caller is then returned a handle the row no longer holds, which
-- ProfileContext caches client-side. Contention is nil: it is one row per user.

create or replace function public.claim_handle()
returns table(handle text, display_name text)
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- FOR UPDATE serialises concurrent claims for this user; see the header.
  select p.handle, p.display_name into cur_handle, cur_name
    from public.profiles p where p.id = uid for update;

  if cur_handle is not null then
    -- Backfill a missing display name, which is the state of every account claimed by
    -- the migration that shipped before this one. A name the user has SET is never
    -- touched: the null check is what keeps this idempotent after a rename.
    if cur_name is null then
      cur_name := public.pretty_handle(cur_handle);
      update public.profiles set display_name = cur_name where id = uid;
    end if;
    return query select cur_handle, cur_name;
    return;
  end if;

  -- 222,000 names, so a collision is a re-roll rather than a failure. Bounded at 10
  -- tries; the fallback swaps the 3-digit tail for 6 hex chars (left(s,-4) drops
  -- '_NNN'), capping the result at 25 of the 30 characters the CHECK allows.
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
$function$;

-- Idempotent here (the live ACL already excludes both), but kept so a replay onto a
-- fresh project, where a new function defaults to PUBLIC EXECUTE, is not left open.
revoke execute on function public.claim_handle() from public, anon;
