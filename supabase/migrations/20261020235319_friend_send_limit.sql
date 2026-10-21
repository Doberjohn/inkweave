-- Friends: at most 30 friend-code tries per player in any rolling hour (#860).
--
-- send_friend_request answers every code it gets, and cancelling a request frees its
-- place under the 20-request cap, so without a limit a script could try codes as fast
-- as the Data API answers (cubic on PR #858). Tries are counted here, in a table no
-- client role can read or change, so only time frees them.

create table internal.friend_request_attempts (
  -- A primary key, as every table here has one, and an identity, since tries have no
  -- natural key: one transaction's tries share now(). Only send_friend_request inserts,
  -- as the table's owner, so the sequence needs no grants.
  id           bigint generated always as identity primary key,
  sender_id    uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index friend_request_attempts_sender_time
  on internal.friend_request_attempts (sender_id, attempted_at);

-- Only send_friend_request reads and writes it, as its owner. The internal schema is
-- already out of the API's reach (20260330000000); this keeps the table out as well.
alter table internal.friend_request_attempts enable row level security;
revoke all on internal.friend_request_attempts from public, anon, authenticated, service_role;

-- ── send_friend_request(friend_code) ────────────────────────────────────────────
--
-- As in 20261020184645, plus the try limit. The statuses:
--   pending    sent, or already waiting      accepted   you are friends
--   invalid    not a friend code             unknown    no account has that code
--   own        your own code                 too_many   20 of your requests waiting
--   slow_down  30 tries in the last hour
-- friend_id is null for a refusal. Only real failures raise.
create or replace function public.send_friend_request(friend_code text)
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

  -- One send at a time per sender: the try limit and the pending cap below are both
  -- count-then-write, so overlapping sends would each pass them.
  perform pg_advisory_xact_lock(852, hashtext(uid::text));

  -- At most 30 tries in any rolling hour. A refused try isn't recorded, so retrying
  -- doesn't stretch the wait, and this sender's old tries are pruned on the way in.
  delete from internal.friend_request_attempts a
   where a.sender_id = uid and a.attempted_at < now() - interval '1 hour';
  if (select count(*) from internal.friend_request_attempts a where a.sender_id = uid) >= 30 then
    return query select null::uuid, 'slow_down'::text;
    return;
  end if;
  insert into internal.friend_request_attempts (sender_id) values (uid);

  if normalized !~ '^[0-9A-HJKMNP-TV-Z]{8}$' then
    return query select null::uuid, 'invalid'::text;
    return;
  end if;

  select f.owner_id into target from public.friend_codes f where f.code = normalized;
  if target = uid then
    return query select null::uuid, 'own'::text;
    return;
  end if;

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
    -- answer for every code.
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
