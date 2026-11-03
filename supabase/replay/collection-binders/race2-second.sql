-- Race 2, second session: once the first holds Q's fourth binder uncommitted, Q adds another.
-- It waits for the first to commit, on the trigger's lock, then goes after it.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.wait_for('race2 first');
begin;
select t.act_as('Q');
\timing on
do $$
declare
  started timestamptz := clock_timestamp();
  r record;
begin
  execute t.add_sql('Q', 'Race 2 second') into r;
  assert clock_timestamp() - started > interval '1 second',
    'race 2, second: answered at once, so it never met the first''s open transaction';
  raise notice 'race2 second: place %', r.place;
  assert r.place = 4, format('race 2, second: place %s', r.place);
end $$;
\timing off
commit;
