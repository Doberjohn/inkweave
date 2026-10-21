-- Race 1, second session, a second later: Q sends to P while P's insert is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('Q');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request(t.code_of('P'));
  raise notice 'race1 Q->P: %, friend is P: %', r.status, (r.friend_id = t.uid('P'))::text;
  assert r.status = 'accepted' and r.friend_id = t.uid('P'), format('race 1, Q->P: %s', row_to_json(r));
end $$;
\timing off
commit;
