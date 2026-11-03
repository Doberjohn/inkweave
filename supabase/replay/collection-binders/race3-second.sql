-- Race 3, second session: while the first holds Q's lock, P sends a binder that names Q as its
-- owner. It is turned down at once (42501), before the trigger would take Q's lock: had it
-- tried, it would wait on the first and give up after lock_timeout (55P03).
\set ON_ERROR_STOP on
\pset tuples_only on
select t.wait_for('race3 first');
begin;
select t.act_as('P');
set local lock_timeout = '1s';
\timing on
do $$ begin
  perform t.expect_error(t.add_sql('Q', 'Not P''s'), '42501');
  raise notice 'race3 second: 42501, without waiting on Q''s lock';
end $$;
\timing off
commit;
