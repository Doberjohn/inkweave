-- Race 2, second session, a second later: P's second click on the same code.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('P');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('R'));
  raise notice 'race2 second click: %', r.status;
  assert r.status = 'pending' and r.friend_id = t.uid('R'), format('race 2, second click: %s', row_to_json(r));
end $$;
\timing off
commit;
