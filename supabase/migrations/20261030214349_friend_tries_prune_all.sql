-- Applied in the Supabase SQL editor like 20261013000000 (it deletes rows, so apply_migration's
-- confirmation would never reach the owner), in one transaction with its history row under
-- the filename stamp. That row's statements hold this file's text, so md5(statements[1])
-- matches the file.
--
-- Friends: every send prunes every sender's tries older than an hour (#986).
--
-- The privacy policy says a try is noted to stop anyone guessing codes, which needs it
-- only for the hour the limit counts, so no try is kept past that hour for its sender's
-- next send. A try outlasts its hour only until the next send by anyone: while nobody
-- sends, or after the send that was pruning it rolls back. pg_cron isn't enabled on the
-- project, so no job prunes them.

-- The tries already past their hour.
delete from internal.friend_request_attempts where attempted_at < now() - interval '1 hour';

-- Every send finds the tries past their hour, whoever made them, and the sender index
-- leads with the sender.
create index friend_request_attempts_time
  on internal.friend_request_attempts (attempted_at);

-- ── send_friend_request(friend_code) ────────────────────────────────────────────
--
-- As in 20261020235319, except the try-limit block. The statuses:
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

  -- Every sender's tries older than an hour go on the way in, so a try is kept only
  -- while the limit below counts it. Rows another send is pruning are left to it, so no
  -- send waits on another's.
  delete from internal.friend_request_attempts a
   where a.id in (select s.id from internal.friend_request_attempts s
                   where s.attempted_at < now() - interval '1 hour'
                     for update skip locked);
  -- At most 30 tries in any rolling hour. A refused try isn't recorded, so retrying
  -- doesn't stretch the wait. The count reads the hour itself, since a try another
  -- send is still pruning hasn't gone yet.
  if (select count(*) from internal.friend_request_attempts a
       where a.sender_id = uid and a.attempted_at >= now() - interval '1 hour') >= 30 then
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
