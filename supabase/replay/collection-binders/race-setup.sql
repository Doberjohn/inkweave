-- Players for the race checks: P holds 29 binders, one short of the cap; Q holds three.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user(n) from unnest(array['P', 'Q']) n;
insert into public.collections (owner_id, imported_at)
select t.uid(n), now() from unnest(array['P', 'Q']) n;
-- One statement each, so the trigger places each row after the ones before it.
insert into public.collection_binders (owner_id, name)
select t.uid('P'), format('P %s', g) from generate_series(1, 29) g;
insert into public.collection_binders (owner_id, name)
select t.uid('Q'), format('Q %s', g) from generate_series(1, 3) g;
do $$ begin
  assert t.places('P') = array(select generate_series(0, 28)), format('P''s places: %s', t.places('P'));
  assert t.places('Q') = '{0,1,2}', format('Q''s places: %s', t.places('Q'));
end $$;
