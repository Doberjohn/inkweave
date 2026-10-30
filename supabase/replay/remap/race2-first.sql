-- Remap race 2, first session: a run begins, then a second later waits for the other run's
-- lock, so it writes M's collection after that run with the earlier now().
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select pg_sleep(1);
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race2-b": "race2-b-new"}', 'race2') = 1,
    'race 2: the run that began first missed M''s collection';
end $$;
commit;
