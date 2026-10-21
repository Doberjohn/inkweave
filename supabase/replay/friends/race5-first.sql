-- Race 5, first session: N's 30th try, held open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('N');
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  raise notice 'race5 30th try: %', r.status;
  assert r.status = 'unknown' and r.friend_id is null, format('race 5, the 30th try: %s', row_to_json(r));
end $$;
select pg_sleep(3);
commit;
