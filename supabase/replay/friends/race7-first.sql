-- Race 7, first session: P sends, and its prune holds T's 30 old tries for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('P');
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  raise notice 'race7 P''s try: %', r.status;
  assert r.status = 'unknown' and r.friend_id is null, format('race 7, P''s try: %s', row_to_json(r));
end $$;
select pg_sleep(3);
commit;
