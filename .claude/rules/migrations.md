---
description: Supabase migration workflow for Inkweave (MCP-driven, no CLI).
paths:
  - "supabase/migrations/**"
---

# Supabase migration conventions

When editing a file under `supabase/migrations/`:

- Use the Supabase **MCP tools** for all DB operations; do NOT use the local Supabase CLI.
- Workflow after a schema change:
  1. `apply_migration` (via MCP)
  2. verify with `list_tables` / `execute_sql`
  3. `generate_typescript_types` (regenerate types)
  4. `get_advisors` (security check)

## Declare privileges in the migration that creates the object

A migration that creates or recreates a table or view states that object's privileges
itself: `revoke all` from `anon` and `authenticated`, grant them exactly what the RLS
policies and the app need, and `grant all` to `service_role`. A `drop view` plus
`create view` counts, because it resets the view's privileges (`create or replace view`
keeps them). The pattern is `20261005000002_declare_table_privileges.sql` plus
`20261005000003_collections_upsert_owner_id.sql`, which adds the `owner_id` grant the
first one missed (#706).

Never rely on Supabase's default privileges. They are being withdrawn: projects created since
2026-05-30 no longer get automatic `SELECT`, `INSERT`, `UPDATE` or `DELETE` on new tables (or
`USAGE` on new sequences), and from 2026-10-30 neither do new tables on this project. A table
whose migration grants nothing is unreachable through the Data API.

- A table-level `revoke` also removes that privilege from every column, so re-grant column
  privileges after the reset.
- A column-scoped `UPDATE` grant must cover every column the client upserts, the conflict
  key included. PostgREST's upsert puts every payload column in `do update set`, and
  Postgres checks `UPDATE` on each one when the statement starts, conflict or not. Probe
  with the SQL the client really sends, not a hand-written equivalent (#706).
- A `security_invoker` view reads its base tables with the caller's privileges, so its
  readers need `SELECT` on every base column it reads. That is how `votes` serves
  `pair_scores`.
- Every view's readers need `EXECUTE` on each function the view calls, whatever its
  `security_invoker` setting. `pair_scores` readers reach `internal.trimmed_mean` only
  through the default `PUBLIC` grant, so revoking that one from `public` needs an explicit
  grant to `anon` and `authenticated` in the same migration.
- A `serial` column's sequence needs `grant usage` for every role that inserts. Every table
  here uses `uuid` keys, so there is no such sequence today.
- Verify privileges from `pg_class.relacl` and `pg_attribute.attacl` with `aclexplode()`
  (#706, Step 1), never from `information_schema.table_privileges`, which hides column
  grants and `MAINTAIN`.
- Functions keep the existing pattern: `revoke execute` from `public` (and `anon`), then
  grant it to the roles that call the function, counting the readers of any view that
  calls it.
