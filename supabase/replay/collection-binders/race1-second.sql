-- Race 1, second session: once the first holds P's 30th binder uncommitted, P adds another 30th.
-- It waits for the first to commit, on the trigger's lock, then finds the shelf full.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.wait_for('race1 first');
begin;
select t.act_as('P');
\timing on
do $$
declare started timestamptz := clock_timestamp();
begin
  perform t.expect_check(t.add_sql('P', 'Race 1 second'), '');
  assert clock_timestamp() - started > interval '1 second',
    'race 1, second: answered at once, so it never met the first''s open transaction';
  raise notice 'race1 second: 23514, the shelf is full';
end $$;
\timing off
commit;
