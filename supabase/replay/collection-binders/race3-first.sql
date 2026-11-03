-- Race 3, first session: Q adds a sixth binder and holds the transaction open for 3 s, and with
-- it the lock on Q's shelf.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('Q');
do $$
declare r record;
begin
  execute t.add_sql('Q', 'Race 3 first') into r;
  raise notice 'race3 first: place %', r.place;
  assert r.place = 5, format('race 3, first: place %s', r.place);
end $$;
-- The second file starts once it sees this name.
set application_name = 'race3 first';
select pg_sleep(3);
commit;
