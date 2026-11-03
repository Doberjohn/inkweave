-- Race 2, first session: Q adds a fourth binder and holds the transaction open for 3 s.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('Q');
do $$
declare r record;
begin
  execute t.add_sql('Q', 'Race 2 first') into r;
  raise notice 'race2 first: place %', r.place;
  assert r.place = 3, format('race 2, first: place %s', r.place);
end $$;
select pg_sleep(3);
commit;
