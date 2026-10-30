-- Remap race 2 setup, after race 1: M has a collection on two ids, which two runs under one
-- label remap.
\set ON_ERROR_STOP on
\pset tuples_only on
select t.make_user('M');
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('M'), '{"race2-a": {"normal": 1}, "race2-b": {"normal": 1}}', now());
