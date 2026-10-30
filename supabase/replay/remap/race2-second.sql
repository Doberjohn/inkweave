-- Remap race 2, second session: a run under the same label begins once the first has
-- begun, and holds the tables, as remap_card_ids does, until the first waits for them.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.wait_until($q$select 1 from pg_stat_activity
                       where application_name = 'race2-first' and xact_start is not null$q$,
                    'the first run to begin');
begin;
lock table public.votes, public.collections, public.decks in share row exclusive mode;
do $$ begin
  assert internal.remap_collection_card_ids('{"race2-a": "race2-a-new"}', 'race2') = 1,
    'race 2: the run that began second missed M''s collection';
end $$;
select t.wait_until(t.waits_for_tables(), 'the first run to wait for the tables');
commit;
