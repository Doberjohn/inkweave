-- Remap race setup, after checks.sql: L has a collection on an id the race remaps.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user('L');
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('L'), '{"race-old": {"normal": 1}}', now());
