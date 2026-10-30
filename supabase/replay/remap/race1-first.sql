-- Remap race 1, first session: L's import begins, then waits until the remap holds the
-- tables before it writes, so its write waits for the remap's commit. Its transaction began
-- first, so its now() is the earlier one.
\set ON_ERROR_STOP on
\pset tuples_only on
set application_name = 'race1-import';
begin;
select t.wait_until(t.holds_tables(), 'the remap to hold the tables');
select t.act_as('L');
insert into public.collections (owner_id, entries, imported_at, schema_version)
values (t.uid('L'), '{"race-fresh": {"normal": 5}}', now(), 1)
on conflict (owner_id) do update
  set owner_id = excluded.owner_id, entries = excluded.entries,
      imported_at = excluded.imported_at, schema_version = excluded.schema_version;
commit;
