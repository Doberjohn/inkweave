-- Remap race 2, second session, 0.3 s later: a run under the same label begins after the
-- first and holds the tables for 1.5 s, as remap_card_ids does.
\set ON_ERROR_STOP on
\pset tuples_only on
select pg_sleep(0.3);
begin;
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race2-a": "race2-a-new"}', 'race2') = 1,
    'race 2: the run that began second missed M''s collection';
end $$;
select pg_sleep(1.5);
commit;
