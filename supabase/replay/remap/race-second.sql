-- Remap race, second session, 0.3 s later: the remap begins after L's import did and holds
-- the tables for 2 s, as remap_card_ids does, so L's write waits and lands after it.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(0.3);
begin;
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race-old": "race-new"}', 'race') = 1,
    'race: the remap missed L''s collection';
end $$;
select pg_sleep(2);
commit;
