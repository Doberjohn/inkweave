-- #852 replay: Testing / Verification, Database (local replay), one check per block.
-- Every block is its own transaction; a failed ASSERT or a wrong SQLSTATE stops the run.
\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on

\echo '== setup: players A, B, C and D'
select t.make_user(n) from unnest(array['A', 'B', 'C', 'D']) n;

\echo '== 1. anon reads neither table and calls none of the functions (42501)'
begin;
select t.act_as_anon();
do $$ begin
  perform t.expect_error('select 1 from public.friend_codes', '42501');
  perform t.expect_error('select 1 from public.friendships', '42501');
  perform t.expect_error('select public.claim_friend_code()', '42501');
  perform t.expect_error($q$select * from public.send_friend_request('ABCD2345')$q$, '42501');
  perform t.expect_error($q$select public.accept_friend_request('00000000-0000-0000-0000-000000000000')$q$, '42501');
  perform t.expect_error('select public.random_friend_code()', '42501');
end $$;
commit;

\echo '== 2. claim_friend_code: 8 Crockford characters, the same code on every later call'
begin;
select t.act_as('A');
do $$
declare first_code text; second_code text;
begin
  first_code := public.claim_friend_code();
  second_code := public.claim_friend_code();
  assert first_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$', format('not a Crockford code: %s', first_code);
  assert first_code = second_code, format('the second claim changed the code: %s then %s', first_code, second_code);
end $$;
commit;

\echo '== 3. a player reads only their own code row, writes none, and cannot call random_friend_code'
begin; select t.act_as('B'); do $$ begin perform public.claim_friend_code(); end $$; commit;
begin; select t.act_as('C'); do $$ begin perform public.claim_friend_code(); end $$; commit;
begin; select t.act_as('D'); do $$ begin perform public.claim_friend_code(); end $$; commit;
begin;
select t.act_as('A');
do $$
declare n int; owners uuid[];
begin
  select count(*), array_agg(owner_id) into n, owners from public.friend_codes;
  assert n = 1 and owners[1] = t.uid('A'), format('A sees %s code rows', n);
  perform t.expect_error(format($q$insert into public.friend_codes (owner_id, code) values (%L, 'AAAAAAAA')$q$, t.uid('A')), '42501');
  perform t.expect_error($q$update public.friend_codes set code = 'AAAAAAAA'$q$, '42501');
  perform t.expect_error('select public.random_friend_code()', '42501');
end $$;
commit;

\echo '== 4. send: any case, hyphen and spaces, O as 0, I and L as 1; sending again adds nothing'
-- As the superuser, give B a code holding 0 and 1.
update public.friend_codes set code = '0123ABCD' where owner_id = t.uid('B');
begin;
select t.act_as('A');
do $$
declare r record; n int;
begin
  select * into r from public.send_friend_request(' oi23-abcd ');
  assert r.friend_id = t.uid('B') and r.status = 'pending', format('first send: %s', row_to_json(r));
  select * into r from public.send_friend_request('Ol23ABCD');
  assert r.friend_id = t.uid('B') and r.status = 'pending', format('second send: %s', row_to_json(r));
  select count(*) into n from public.friendships;
  assert n = 1, format('A sees %s rows after two sends', n);
end $$;
commit;

\echo '== 5. refusals come back as rows with no friend_id, and add nothing'
begin;
select t.act_as('A');
do $$
declare r record; mine text; typed text; before_count int; after_count int;
begin
  select count(*) into before_count from public.friendships;
  mine := public.claim_friend_code();
  select * into r from public.send_friend_request(lower(mine));
  assert r.status = 'own' and r.friend_id is null, format('own code: %s', row_to_json(r));
  foreach typed in array array['ABC', 'ABCDEFGU', 'ABCD-23456'] loop
    select * into r from public.send_friend_request(typed);
    assert r.status = 'invalid' and r.friend_id is null, format('%s: %s', typed, row_to_json(r));
  end loop;
  select * into r from public.send_friend_request(null);
  assert r.status = 'invalid' and r.friend_id is null, format('null: %s', row_to_json(r));
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  assert r.status = 'unknown' and r.friend_id is null, format('unused code: %s', row_to_json(r));
  select count(*) into after_count from public.friendships;
  assert after_count = before_count, format('refusals added rows: %s -> %s', before_count, after_count);
end $$;
commit;

\echo '== 6. the receiver sees the request, a third player does not; nobody writes rows directly'
begin;
select t.act_as('B');
do $$
declare n int;
begin
  select count(*) into n from public.friendships
   where requester_id = t.uid('A') and addressee_id = t.uid('B') and status = 'pending';
  assert n = 1, format('B sees %s pending rows from A', n);
end $$;
commit;
begin;
select t.act_as('D');
do $$
declare n int;
begin
  select count(*) into n from public.friendships;
  assert n = 0, format('D sees %s rows', n);
  perform t.expect_error(format($q$insert into public.friendships (requester_id, addressee_id) values (%L, %L)$q$, t.uid('D'), t.uid('A')), '42501');
end $$;
commit;
begin;
select t.act_as('A');
do $$ begin
  perform t.expect_error($q$update public.friendships set status = 'accepted'$q$, '42501');
end $$;
commit;

\echo '== 7. accept: false for the sender and a third player, true for the receiver, then false'
begin;
select t.act_as('A');
do $$ begin
  assert public.accept_friend_request(t.uid('B')) = false, 'A accepted a request B never sent';
  assert public.accept_friend_request(t.uid('A')) = false, 'A accepted their own request';
end $$;
commit;
begin;
select t.act_as('D');
do $$ begin
  assert public.accept_friend_request(t.uid('A')) = false, 'D accepted a request sent to B';
end $$;
commit;
begin;
select t.act_as('B');
do $$
declare r record;
begin
  assert public.accept_friend_request(t.uid('A')) = true, 'B could not accept A''s request';
  select * into r from public.friendships where requester_id = t.uid('A') and addressee_id = t.uid('B');
  assert r.status = 'accepted' and r.accepted_at is not null, format('after the accept: %s', row_to_json(r));
  assert public.accept_friend_request(t.uid('A')) = false, 'B accepted the same request twice';
end $$;
commit;

\echo '== 8. when C has asked A, A entering C''s code accepts, and the pair keeps one row'
begin;
select t.act_as('C');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('A'));
  assert r.friend_id = t.uid('A') and r.status = 'pending', format('C asking A: %s', row_to_json(r));
end $$;
commit;
begin;
select t.act_as('A');
do $$
declare r record; n int;
begin
  select * into r from public.send_friend_request(t.code_of('C'));
  assert r.friend_id = t.uid('C') and r.status = 'accepted', format('A entering C''s code: %s', row_to_json(r));
  select count(*) into n from public.friendships
   where t.uid('C') in (requester_id, addressee_id);
  assert n = 1, format('A and C have %s rows', n);
end $$;
commit;

\echo '== 9. delete: a row you are in goes (1), a row you are outside of stays (0)'
begin;
select t.act_as('D');
do $$
declare n int;
begin
  delete from public.friendships where requester_id = t.uid('C') and addressee_id = t.uid('A');
  get diagnostics n = row_count;
  assert n = 0, format('D deleted %s rows between C and A', n);
end $$;
commit;
begin;
select t.act_as('A');
do $$
declare n int;
begin
  delete from public.friendships where requester_id = t.uid('A') and addressee_id = t.uid('B');
  get diagnostics n = row_count;
  assert n = 1, format('A deleted %s of their rows with B', n);
end $$;
commit;

\echo '== 10. with 20 requests waiting, a 21st returns too_many and adds no row'
select t.make_user('E' || i) from generate_series(1, 21) i;
insert into public.friend_codes (owner_id, code)
select t.uid('E' || i), public.random_friend_code() from generate_series(1, 21) i;
-- Check 10 tests the 20-request cap, not the try limit: clear A's earlier tries.
delete from internal.friend_request_attempts where sender_id = t.uid('A');
begin;
select t.act_as('A');
do $$
declare r record; i int; n int;
begin
  for i in 1..20 loop
    select * into r from public.send_friend_request(t.code_of('E' || i));
    assert r.status = 'pending', format('request %s: %s', i, row_to_json(r));
  end loop;
  select * into r from public.send_friend_request(t.code_of('E21'));
  assert r.status = 'too_many' and r.friend_id is null, format('the 21st: %s', row_to_json(r));
  -- At the cap an unused code gets the same answer, so a full sender learns nothing.
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  assert r.status = 'too_many' and r.friend_id is null, format('an unused code at the cap: %s', row_to_json(r));
  select count(*) into n from public.friendships where requester_id = t.uid('A') and status = 'pending';
  assert n = 20, format('A has %s requests waiting', n);
end $$;
commit;

\echo '== 10b. at the cap, entering the code of someone who asked you still accepts'
select t.make_user('X');
insert into public.friend_codes (owner_id, code) values (t.uid('X'), public.random_friend_code());
begin;
select t.act_as('X');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('A'));
  assert r.status = 'pending', format('X asking A: %s', row_to_json(r));
end $$;
commit;
begin;
select t.act_as('A');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('X'));
  assert r.friend_id = t.uid('X') and r.status = 'accepted', format('A at the cap entering X''s code: %s', row_to_json(r));
end $$;
commit;

\echo '== 11. deleting an account deletes its code and every friendship it is in'
delete from auth.users where id = t.uid('A');
do $$
declare n int;
begin
  select count(*) into n from public.friend_codes where owner_id = t.uid('A');
  assert n = 0, format('%s code rows left for A', n);
  select count(*) into n from public.friendships where t.uid('A') in (requester_id, addressee_id);
  assert n = 0, format('%s friendships left for A', n);
end $$;

\echo '== 12. at most 30 tries an hour: the 31st answers slow_down and sends nothing'
select t.make_user(n) from unnest(array['L', 'M']) n;
insert into public.friend_codes (owner_id, code)
select t.uid(n), public.random_friend_code() from unnest(array['L', 'M']) n;
begin;
select t.act_as('L');
do $$
declare r record; i int; n int;
begin
  for i in 1..30 loop
    select * into r from public.send_friend_request('ZZZZ-ZZZZ');
    assert r.status = 'unknown', format('try %s: %s', i, row_to_json(r));
  end loop;
  select * into r from public.send_friend_request(t.code_of('M'));
  assert r.status = 'slow_down' and r.friend_id is null, format('the 31st try: %s', row_to_json(r));
  select count(*) into n from public.friendships where requester_id = t.uid('L');
  assert n = 0, format('the refused try sent %s requests', n);
end $$;
commit;

\echo '== 13. a refused try is not recorded, cancelling frees nothing, an hour frees tries'
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('L');
  assert n = 30, format('L has %s recorded tries after a refused one', n);
end $$;
update internal.friend_request_attempts set attempted_at = attempted_at - interval '61 minutes'
 where sender_id = t.uid('L');
begin;
select t.act_as('L');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('M'));
  assert r.status = 'pending', format('an hour later: %s', row_to_json(r));
  delete from public.friendships where requester_id = t.uid('L');
end $$;
commit;
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('L');
  assert n = 1, format('after the prune and a cancel, L has %s recorded tries', n);
end $$;

\echo '== 14. claiming a code and accepting a request are not tries'
begin;
select t.act_as('M');
do $$ begin
  perform public.claim_friend_code();
  perform public.accept_friend_request(t.uid('L'));
end $$;
commit;
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('M');
  assert n = 0, format('M has %s recorded tries', n);
end $$;

\echo '== 15. every answer is a try: a malformed code, your own code and the code of someone who asked you all count'
begin;
select t.act_as('L');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('M'));
  assert r.status = 'pending', format('L asking M: %s', row_to_json(r));
end $$;
commit;
begin;
select t.act_as('M');
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ABC');
  assert r.status = 'invalid', format('a malformed code: %s', row_to_json(r));
  select * into r from public.send_friend_request(t.code_of('M'));
  assert r.status = 'own', format('your own code: %s', row_to_json(r));
  select * into r from public.send_friend_request(t.code_of('L'));
  assert r.status = 'accepted', format('L''s code after L asked: %s', row_to_json(r));
end $$;
commit;
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('M');
  assert n = 3, format('M has %s recorded tries after invalid, own and accepted', n);
end $$;

\echo '== 16. no client role reads or writes the try table, not even with the schema opened to it'
begin;
do $$
declare
  stmts text[] := array[
    'select 1 from internal.friend_request_attempts',
    format('insert into internal.friend_request_attempts (sender_id) values (%L)', t.uid('M')),
    'update internal.friend_request_attempts set attempted_at = now()',
    'delete from internal.friend_request_attempts'];
  opened boolean; who text; stmt text;
begin
  foreach opened in array array[false, true] loop
    -- The second pass opens the schema, so the table's own revoke is what refuses:
    -- service_role bypasses RLS, so only the missing grant stops it.
    if opened then
      grant usage on schema internal to anon, authenticated, service_role;
    end if;
    foreach who in array array['anon', 'authenticated', 'service_role'] loop
      foreach stmt in array stmts loop
        begin
          perform set_config('role', who, true);
          execute stmt;
          raise exception 'HOLE: % ran it (schema opened: %): %', who, opened, stmt;
        exception when insufficient_privilege then
          null;
        end;
      end loop;
    end loop;
  end loop;
end $$;
rollback;

-- Check 16 can't tell a missing grant from RLS refusing an insert (both 42501), and it
-- writes one column only, so this reads the privileges themselves.
\echo '== 16b. no client role holds a privilege on the try table, its columns or its sequence'
do $$
declare who text;
begin
  foreach who in array array['anon', 'authenticated', 'service_role'] loop
    assert not has_table_privilege(who, 'internal.friend_request_attempts',
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
           format('%s holds a privilege on internal.friend_request_attempts', who);
    assert not has_any_column_privilege(who, 'internal.friend_request_attempts',
             'SELECT, INSERT, UPDATE, REFERENCES'),
           format('%s holds a column privilege on internal.friend_request_attempts', who);
    assert not has_sequence_privilege(who, 'internal.friend_request_attempts_id_seq',
             'USAGE, SELECT, UPDATE'),
           format('%s holds a privilege on internal.friend_request_attempts_id_seq', who);
  end loop;
end $$;

\echo '== 17. a send prunes every sender''s tries older than an hour, not only its own'
select t.make_user(n) from unnest(array['F', 'G']) n;
insert into internal.friend_request_attempts (sender_id, attempted_at)
values (t.uid('F'), now() - interval '2 hours');
begin;
select t.act_as('G');
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  assert r.status = 'unknown', format('G''s try: %s', row_to_json(r));
end $$;
commit;
do $$
declare n int;
begin
  select count(*) into n from internal.friend_request_attempts where sender_id = t.uid('F');
  assert n = 0, format('F''s two-hour-old try outlived G''s send: %s left', n);
  select count(*) into n from internal.friend_request_attempts where attempted_at < now() - interval '1 hour';
  assert n = 0, format('%s tries older than an hour outlived a send', n);
end $$;

\echo '== all sequential checks passed'
