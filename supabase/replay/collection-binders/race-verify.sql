-- After both races: P's shelf is full at 30, and Q's five binders hold places 0 to 4.
\set ON_ERROR_STOP on
\pset tuples_only on
do $$ begin
  assert t.places('P') = array(select generate_series(0, 29)), format('race 1: P''s places %s', t.places('P'));
  assert t.places('Q') = '{0,1,2,3,4}', format('race 2: Q''s places %s', t.places('Q'));
end $$;
\echo '== all race checks passed'
