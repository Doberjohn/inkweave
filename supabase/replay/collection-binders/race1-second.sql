-- Race 1, second session, a second later: P adds another 30th while the first is uncommitted.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(1);
begin;
select t.act_as('P');
\timing on
do $$ begin
  perform t.expect_check(t.add_sql('P', 'Race 1 second'), '');
  raise notice 'race1 second: 23514, the shelf is full';
end $$;
\timing off
commit;
