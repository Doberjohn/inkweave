-- Friends: add another account as a friend through a friend code.
--
-- friend_codes  one private code per account. Never a profiles column: profiles is
--               world-readable once a handle exists, and RLS is row-level, so a code
--               there would publish every code (20260806000000, Problem 1).
-- friendships   one row per pair, pending until the other side accepts.
--
-- Writes go through SECURITY DEFINER functions, except delete, which RLS scopes:
-- decline, cancel and remove are all the pair's row going away.

-- ── friend_codes ────────────────────────────────────────────────────────────────

create table public.friend_codes (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  -- Crockford base32 (no I, L, O or U), stored bare; the app shows it as XXXX-XXXX.
  code       text not null unique,
  created_at timestamptz not null default now(),
  constraint friend_codes_code_format check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$')
);

alter table public.friend_codes enable row level security;

create policy friend_codes_select_own on public.friend_codes
  for select to authenticated
  using ((select auth.uid()) = owner_id);

-- No client writes: a code is only ever generated (claim_friend_code below).
revoke all on public.friend_codes from anon, authenticated;
grant select on public.friend_codes to authenticated;
grant all on public.friend_codes to service_role;

-- ── friendships ─────────────────────────────────────────────────────────────────

create table public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_valid check (status in ('pending', 'accepted')),
  constraint friendships_accepted_at check ((status = 'accepted') = (accepted_at is not null))
);

-- One row per pair, whichever side asked: A->B and B->A cannot both exist.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
-- The policies read either column; the primary key already leads with requester_id.
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy friendships_select_own on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy friendships_delete_own on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

revoke all on public.friendships from anon, authenticated;
grant select, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;

-- ── random_friend_code() ────────────────────────────────────────────────────────
--
-- Eight characters from a CSPRNG. gen_random_uuid() draws on pg_strong_random and lives
-- in pg_catalog, so it resolves under search_path = '' with no extension; random() is
-- predictable, and a code is what stands between a stranger and a request. Bytes 6 and 8
-- carry the uuid's version and variant bits, so they are skipped; 256 is a multiple of
-- 32, so `% 32` adds no bias. 32^8 is about 1.1 trillion codes.
create function public.random_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  result text := '';
  i int;
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
    result := result || substr(alphabet, 1 + get_byte(bytes, i) % 32, 1);
  end loop;
  return result;
end;
$$;
revoke execute on function public.random_friend_code() from public, anon, authenticated;

-- ── claim_friend_code() ─────────────────────────────────────────────────────────
--
-- Idempotent, like claim_handle: the caller's code, made the first time it is asked
-- for. Called when the Friends section opens, never from the signup trigger, which
-- must not be able to raise (20260710000000). Two first calls at once are safe: the
-- second insert waits for the first, then does nothing, and both read the one row.
create function public.claim_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  current_code text;
begin
  if uid is null then
    raise exception 'claim_friend_code requires an authenticated caller'
      using errcode = '28000';
  end if;

  select f.code into current_code from public.friend_codes f where f.owner_id = uid;
  if current_code is not null then
    return current_code;
  end if;

  for i in 1..10 loop
    begin
      insert into public.friend_codes (owner_id, code)
      values (uid, public.random_friend_code())
      on conflict (owner_id) do nothing;
      exit;
    exception when unique_violation then
      -- Another account holds that code. Roll another.
    end;
  end loop;

  select f.code into current_code from public.friend_codes f where f.owner_id = uid;
  if current_code is null then
    raise exception 'could not generate a friend code' using errcode = 'P0001';
  end if;
  return current_code;
end;
$$;
revoke execute on function public.claim_friend_code() from public, anon;
grant execute on function public.claim_friend_code() to authenticated;

-- ── send_friend_request(friend_code) ────────────────────────────────────────────
--
-- Reads a code the way Crockford base32 is typed: any case, hyphens and spaces
-- ignored, O as 0, I and L as 1. A refusal is an answer, not an error: raised, it
-- would come back as an HTTP error (400 for P0001, 500 for any other P0 code), and
-- Sentry's Supabase integration would report each mistyped code as unhandled. So the
-- status says what happened:
--   pending    sent, or already waiting      accepted   you are friends
--   invalid    not a friend code             unknown    no account has that code
--   own        your own code                 too_many   20 of your requests waiting
-- friend_id is null for a refusal. At the cap, too_many also answers an unused code,
-- so a full sender can't keep probing which codes exist. When the other side already
-- asked you, entering their code accepts. Never a name: names come from the
-- RLS-governed profiles read, so this exposes nothing RLS hides. Only real failures
-- raise.
create function public.send_friend_request(friend_code text)
returns table (friend_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  normalized text := translate(
    upper(regexp_replace(coalesce(friend_code, ''), '[[:space:]-]', '', 'g')), 'OIL', '011');
  target uuid;
  pair public.friendships%rowtype;
begin
  if uid is null then
    raise exception 'send_friend_request requires an authenticated caller'
      using errcode = '28000';
  end if;
  if normalized !~ '^[0-9A-HJKMNP-TV-Z]{8}$' then
    return query select null::uuid, 'invalid'::text;
    return;
  end if;

  select f.owner_id into target from public.friend_codes f where f.code = normalized;
  if target = uid then
    return query select null::uuid, 'own'::text;
    return;
  end if;

  -- One send at a time per sender: without it, overlapping sends each count only the
  -- requests already committed, and all of them pass the cap below.
  perform pg_advisory_xact_lock(852, hashtext(uid::text));

  -- Twice at most: a second pass only follows an insert that lost a race with the
  -- other side's request.
  for attempt in 1..2 loop
    if target is not null then
      select * into pair from public.friendships f
       where (f.requester_id = uid and f.addressee_id = target)
          or (f.requester_id = target and f.addressee_id = uid)
       for update;

      if found then
        if pair.status = 'pending' and pair.requester_id = target then
          -- They asked you first: entering their code is a yes.
          update public.friendships f
             set status = 'accepted', accepted_at = now()
           where f.requester_id = target and f.addressee_id = uid;
          return query select target, 'accepted'::text;
        else
          -- Already friends, or your request is already waiting.
          return query select target, pair.status;
        end if;
        return;
      end if;
    end if;

    -- The cap answers before an unused code does, so a sender at the cap gets the same
    -- answer for every code and can't keep probing which codes exist.
    if (select count(*) from public.friendships f
         where f.requester_id = uid and f.status = 'pending') >= 20 then
      return query select null::uuid, 'too_many'::text;
      return;
    end if;
    if target is null then
      return query select null::uuid, 'unknown'::text;
      return;
    end if;

    begin
      insert into public.friendships (requester_id, addressee_id) values (uid, target);
      return query select target, 'pending'::text;
      return;
    exception when unique_violation then
      -- The other side asked at the same moment and wrote the pair first.
    end;
  end loop;

  raise exception 'could not send the request' using errcode = 'P0001';
end;
$$;
revoke execute on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- ── accept_friend_request(requester) ────────────────────────────────────────────
--
-- Only the addressee accepts, and only a pending request. True when one was accepted.
create function public.accept_friend_request(requester uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'accept_friend_request requires an authenticated caller'
      using errcode = '28000';
  end if;
  update public.friendships f
     set status = 'accepted', accepted_at = now()
   where f.requester_id = requester and f.addressee_id = uid and f.status = 'pending';
  return found;
end;
$$;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;
