-- Race 2, first session: P sends to R and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('P');
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('R'));
  raise notice 'race2 first click: %', r.status;
  assert r.status = 'pending' and r.friend_id = t.uid('R'), format('race 2, first click: %s', row_to_json(r));
end $$;
select pg_sleep(3);
commit;
