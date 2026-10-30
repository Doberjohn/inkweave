-- Race 6, second session, a second later: Q sends while P's prune holds Q's old try. Q's
-- send must not wait on it: the lock timeout turns a wait into an error.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
set local lock_timeout = '500ms';
select t.act_as('Q');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  raise notice 'race6 Q''s try: %', r.status;
  assert r.status = 'unknown' and r.friend_id is null, format('race 6, Q''s try: %s', row_to_json(r));
end $$;
\timing off
commit;
