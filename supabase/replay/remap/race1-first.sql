-- Remap race 1, first session: L's import begins, then reaches the collection a second later,
-- while the remap holds it. Its transaction began first, so its now() is the earlier one.
\set ON_ERROR_STOP on
\pset tuples_only on
begin;
select t.act_as('L');
select pg_sleep(1);
insert into public.collections (owner_id, entries, imported_at, schema_version)
values (t.uid('L'), '{"race-fresh": {"normal": 5}}', now(), 1)
on conflict (owner_id) do update
  set owner_id = excluded.owner_id, entries = excluded.entries,
      imported_at = excluded.imported_at, schema_version = excluded.schema_version;
commit;
