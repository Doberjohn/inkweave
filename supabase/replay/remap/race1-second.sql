-- Remap race 1, second session: the remap begins once L's import has begun, and holds the
-- tables, as remap_card_ids does, until L's write waits for them.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.wait_until($q$select 1 from pg_stat_activity
                       where application_name = 'race1-import' and xact_start is not null$q$,
                    'L''s import to begin');
begin;
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race-old": "race-new"}', 'race') = 1,
    'race 1: the remap missed L''s collection';
end $$;
select t.wait_until(t.waits_for_tables(), 'L''s write to wait for the remap');
commit;
