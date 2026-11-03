-- Race 1, first session: P adds a 30th binder and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('P');
do $$
declare r record;
begin
  execute t.add_sql('P', 'Race 1 first') into r;
  raise notice 'race1 first: place %', r.place;
  assert r.place = 29, format('race 1, first: place %s', r.place);
end $$;
-- The second file starts once it sees this name.
set application_name = 'race1 first';
select pg_sleep(3);
commit;
