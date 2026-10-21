-- Race 4, first session: S, at 19 waiting, sends to T20 and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('S');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('T20'));
  raise notice 'race4 S->T20: %', r.status;
  assert r.status = 'pending' and r.friend_id = t.uid('T20'), format('race 4, S->T20: %s', row_to_json(r));
end $$;
select pg_sleep(3);
commit;
