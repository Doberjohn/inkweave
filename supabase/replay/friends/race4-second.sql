-- Race 4, second session, a second later: S sends to T21 while the 20th is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('S');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('T21'));
  raise notice 'race4 S->T21: %', r.status;
  assert r.status = 'too_many' and r.friend_id is null, format('race 4, S->T21: %s', row_to_json(r));
end $$;
\timing off
commit;
