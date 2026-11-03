-- Race 2, second session, a second later: Q adds another binder while the first is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('Q');
\timing on
do $$
declare r record;
begin
  execute t.add_sql('Q', 'Race 2 second') into r;
  raise notice 'race2 second: place %', r.place;
  assert r.place = 4, format('race 2, second: place %s', r.place);
end $$;
\timing off
commit;
