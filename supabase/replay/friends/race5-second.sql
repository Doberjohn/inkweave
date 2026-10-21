-- Race 5, second session, a second later: N's 31st try while the 30th is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('N');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('O'));
  raise notice 'race5 31st try: %', r.status;
  assert r.status = 'slow_down' and r.friend_id is null, format('race 5, the 31st try: %s', row_to_json(r));
end $$;
\timing off
commit;
