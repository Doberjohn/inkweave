-- Loaded after helpers.sql and before the backups migration: what graduations left behind
-- before it. O's collection and deck were remapped, then deleted, so their backups outlived
-- them. C's collection was remapped, then cleared and imported again, so its backup is of a
-- row that is gone. K's collection was remapped and is still there, and a remap merged away
-- a vote, whose backup is all that is left of it. Check R0 reads what the migration kept.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user(n) from unnest(array['O', 'C', 'K']) n;
insert into public.collections (owner_id, entries, imported_at)
select t.uid(n), '{"seed-old": {"normal": 1}}', now() from unnest(array['O', 'C', 'K']) n;
insert into public.decks (owner_id, name, cards)
values (t.uid('O'), 'Seed deck', '[{"cardId": "seed-old", "quantity": 2}]');
select internal.remap_collection_card_ids('{"seed-old": "seed-new"}', 'seed');
select internal.remap_deck_card_ids('{"seed-old": "seed-new"}', 'seed');
insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
values ('seed', 'votes', gen_random_uuid()::text, 'deleted', '{}');
delete from public.collections where owner_id = t.uid('O');
delete from public.decks where owner_id = t.uid('O');
-- Each statement is its own transaction, so the new row's created_at is later.
delete from public.collections where owner_id = t.uid('C');
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('C'), '{"seed-new": {"normal": 1}}', now());
