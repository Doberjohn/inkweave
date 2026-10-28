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
- **Apply and verify before the PR merges** (#860). Supabase's GitHub integration links this
  project's production branch to `master`: with its "Deploy to production" option on, a merge
  hands new migrations to Supabase's deployer, outside the review and verification steps.
  Applied first, the reviewed SQL is what production runs. `apply_migration` stores the exact
  SQL it is given, so `md5(statements[1])` in `supabase_migrations.schema_migrations` must
  equal the file's md5.
- **From a cloud session, SQL that says `update` or `delete` goes through the SQL editor**
  (#748). The connector asks the owner to confirm such SQL, policies and grants included,
  and from the cloud that question never reaches them. The owner runs the file in the editor,
  in one transaction with its history row: version and name from the filename, and
  `statements` holding the file's text, so the md5 check above still holds (#1045). A paste
  from Windows keeps its CRLF line ends, in `statements` and in function bodies alike, which
  changes nothing the database runs: compare md5s with the carriage returns stripped
  (`md5(replace(statements[1], chr(13), ''))`, and the same over `pg_proc.prosrc`).
- **That deployer can't tell an applied file from a new one** (cubic on #879). The history
  table is keyed by version, and `apply_migration` records its own apply-time version
  (`20261020235319_friend_send_limit.sql` is production's `20261021074901`), so 25 of the 29
  recorded versions match no file. A deploy would stop on those, or re-run the files: a re-run
  fails on the objects a migration creates, or applies a data change twice. The `main` branch
  record has shown `MIGRATIONS_FAILED` since 2026-10-13. Reconciling the history to the
  filenames, or turning the option off, is the owner's call.
- **Replay friends changes locally first** (#860). A change to `friend_codes`, `friendships`,
  `internal.friend_request_attempts` or a friends function re-runs `supabase/replay/friends/`
  on a local Postgres 17 (its README has the commands). Add the change's checks first and
  watch them fail, then write the migration. A change to `collection_sharing`,
  `shared_friends()` or `friend_collections()`, or to what they read, re-runs
  `supabase/replay/collection-sharing/` the same way (#1045).

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
- A `serial` column's sequence needs `grant usage` for every role that inserts. Every public
  table here uses `uuid` keys. The two sequences need no grant: the identities of
  `internal.card_id_remap_backup`, written only by migrations, and
  `internal.friend_request_attempts`, written only by `send_friend_request` as the table's
  owner (#860).
- A table only migrations touch, such as `internal.card_id_remap_backup`, revokes everything,
  `service_role` included, rather than granting `service_role` all (`20261013000000`). An
  `internal` table that runtime functions read, such as `internal.rate_limit_config`, keeps
  what those functions need.
- Verify privileges from `pg_class.relacl` and `pg_attribute.attacl` with `aclexplode()`
  (#706, Step 1), never from `information_schema.table_privileges`, which hides column
  grants and `MAINTAIN`.
- Functions keep the existing pattern: `revoke execute` from `public` (and `anon`), then
  grant it to the roles that call the function, counting the readers of any view that
  calls it.
