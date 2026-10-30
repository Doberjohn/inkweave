-- Remap race 2, first session: a run begins, then waits until the other run holds the
-- tables before it asks for them, so it writes M's collection after that run with the
-- earlier now().
\set ON_ERROR_STOP on
\pset tuples_only on
set application_name = 'race2-first';
begin;
select t.wait_until(t.holds_tables(), 'the other run to hold the tables');
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race2-b": "race2-b-new"}', 'race2') = 1,
    'race 2: the run that began first missed M''s collection';
end $$;
commit;
