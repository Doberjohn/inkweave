# Card id remap replay

The database checks for a graduation's backups (#986): what `internal.card_id_remap_backup` keeps of the collections and decks `internal.remap_card_ids` (#748) rewrites, and what `internal.undo_card_id_remap` puts back. Run on a local Postgres 17 instead of the Supabase project; it never connects to the project.

It builds on the friends replay (`../friends/`): its `scaffold.sql` stands in for the Supabase pieces, and its `helpers.sql` adds named players and acting as one.

- `scaffold.sql` adds `public.votes`, which the remap and undo lock and look up, as a table with an id alone: the checks remap collections and decks only.
- `grants.sql` holds production's grants on `decks` and `collections`, copied from `20261005000002_declare_table_privileges.sql`, which can't load here, so players clear, delete and import as production lets them.
- `seed.sql` runs before the backups migration and leaves what graduations left before it: the backups of a collection and a deck deleted since, of a collection cleared and imported again, of a collection still there, and a merged vote's backup.
- `checks.sql` runs the checks R0 to R10. Each makes its own rows and remaps its own card ids under its own label, so no check leans on another's.
- `race-setup.sql`, `race-first.sql`, `race-second.sql` and `race-verify.sql` run after it: an import whose transaction begins before a remap's and whose write waits for the remap's lock, so its `updated_at` is earlier than the backup's `backed_up_at`, and an undo must still leave it.

Re-run it whenever a migration changes `internal.card_id_remap_backup`, the remap or undo functions, or the delete paths of `collections` and `decks`, and add the change's checks first, so you see them fail before the migration exists.

## What you need

Postgres 17 (`initdb`, `postgres`, `psql`), matching production (17.6), as `../friends/README.md` describes.

## Run it

From the repo root, with the server from the friends README running on port 5499:

```bash
export PGOPTIONS="-c plpgsql.extra_warnings=all -c plpgsql.extra_errors=all"
F=supabase/replay
M=supabase/migrations
psql -h localhost -p 5499 -U postgres -c "drop database if exists remap"
psql -h localhost -p 5499 -U postgres -c "create database remap"
psql -h localhost -p 5499 -U postgres -d remap -v ON_ERROR_STOP=1 \
  -f $F/friends/scaffold.sql \
  -f $F/remap/scaffold.sql \
  -f $M/20260710000000_profiles_table.sql \
  -f $M/20260710000001_decks_table.sql \
  -f $M/20260711000000_decks_updated_at_server_owned.sql \
  -f $M/20260811000000_collections_table.sql \
  -f $F/remap/grants.sql \
  -f $M/20261005000003_collections_upsert_owner_id.sql \
  -f $M/20261013000000_card_id_remap.sql \
  -f $F/friends/helpers.sql \
  -f $F/remap/seed.sql \
  -f $M/20261030215155_card_id_remap_backup_follows_rows.sql \
  -f $M/20261030222011_undo_card_id_remap_spares_changed_rows.sql
psql -h localhost -p 5499 -U postgres -d remap -f $F/remap/checks.sql
psql -h localhost -p 5499 -U postgres -d remap -f $F/remap/race-setup.sql
psql -h localhost -p 5499 -U postgres -d remap -f $F/remap/race-first.sql &
psql -h localhost -p 5499 -U postgres -d remap -f $F/remap/race-second.sql; wait
psql -h localhost -p 5499 -U postgres -d remap -f $F/remap/race-verify.sql
```

`profiles_table` is there for `public.set_updated_at()`, which the decks and collections triggers call. `checks.sql` stops at the first failed `assert`, and ends with `== all remap checks passed`; `race-verify.sql` ends with `== remap race passed`.

| Check | What it proves |
|---|---|
| R0 | the migration drops the backups of the collection and deck deleted before it and of the collection imported again, and keeps the other collection's and the vote's |
| R1 | clearing a collection, as its owner, drops its backup |
| R2 | deleting an account drops the backups of its collection and its deck |
| R3 | deleting a deck, as its owner, drops its backup |
| R4 | an undo after a clear and a fresh import leaves the new import, and restores the other collection |
| R5 | a remap keeps the backup it saves, though it updates the row, and a clear drops no other collection's backup, nor a vote's that names the same id |
| R6 | no client role can call the trigger function or undo, and neither they nor PUBLIC hold a privilege on the backup table |
| R7 | an undo after an import over a collection, with no clear between, leaves the import, and restores the other collection |
| R8 | an undo after a deck edit leaves the edit, and restores the other deck |
| R9 | an undo of a collection a re-run saved twice under one label puts back its first copy, though the re-run wrote it after the first backup |
| R10 | an undo leaves a collection imported again between two runs under one label, though the re-run then remapped the import |
| race | an undo leaves an import that began before the remap and landed after it |

Without the backups migration, R0 stops the run. To watch R0 to R4 each fail (and R6 on the missing function), run a copy of `checks.sql` without its `\set ON_ERROR_STOP on` line: each check makes its own rows, so the rest still run. Without the undo migration, R7, R8, R10 and the race fail.

## Proving a check bites

Plant the mistake in a copy of the backups or undo migration and load the copy instead. Each of these stops the run at the check named; the copy without `ON_ERROR_STOP` shows the later ones too:

| Planted mistake | Fails at |
|---|---|
| no `decks_drop_remap_backups` trigger | R2 (V's deck), then R3 |
| the collections trigger fires `after delete or update` | R1 (the remap's own update drops its backup), then R4 and R5 |
| `grant execute` on the trigger function to `authenticated` | R6 |
| the opening delete drops every collection backup, gone row or not | R0 (K's backup is gone) |
| the opening delete matches a collection by its owner alone | R0 (C's backup stays) |
| the trigger's collection delete drops the `source_table` filter | R5 (the vote's backup is gone) |
| undo spares a row by its first backup, `min(backed_up_at)` | R9 (the re-run's own write spares G's collection) |
| undo spares a row whose `updated_at` is `>` its last backup, not `<>` | the race |
| undo's spare drops `written_between` | R10 |
| undo's spare drops its collections clause | R7, and the race |
| undo's spare drops its decks clause | R8 |
| `grant execute` on undo to `authenticated` | R6 |
