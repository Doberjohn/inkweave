-- Race 7, second session, a second later: T sends while its 30 old tries are still there,
-- held by P's prune. They are past their hour, so the limit must not count them.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('T');
\timing on
do $$
declare r record;
begin
  select * into r from public.send_friend_request('ZZZZ-ZZZZ');
  raise notice 'race7 T''s try: %', r.status;
  assert r.status = 'unknown' and r.friend_id is null, format('race 7, T''s try: %s', row_to_json(r));
end $$;
\timing off
commit;
