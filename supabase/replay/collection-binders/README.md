# Collection binders replay

The database checks for binders (#1074): a player's own binders (`collection_binders`), the trigger that caps a shelf at 30 and places each new binder at its end, `move_binder()`, and My collection's cover (`collection_shelf`), run on a local Postgres 17 instead of the Supabase project. It never connects to the project.

It builds on two other replays. The friends replay (`../friends/`) gives `scaffold.sql`, which stands in for the Supabase pieces, and `helpers.sql`, which adds named players, acting as one and expected errors. The collection-sharing replay (`../collection-sharing/`) gives `collections.sql`, the pieces of `public.collections` the binders hang off.

- `checks.sql` runs the checks, one transaction per block, numbered as in #1074's Testing / Verification. It makes three players (E holds no collection). Its writes are the statements PostgREST sends for the app's: `insert ... returning *` for a new binder, `update` and `delete` by id, `select public.move_binder(...)`, and the shelf's upsert, which puts every payload column in `do update set`. It also defines the helpers the race files use, so the races run after it, on the same database.
- `race-setup.sql`, `race1-*.sql` to `race3-*.sql` and `race-verify.sql` run the races: two sessions at once, the first holding its transaction open.

Re-run it whenever a migration changes `collection_binders`, `collection_shelf`, their trigger or `move_binder()`, or what they hang off (`collections`), and add the change's checks first, so you see them fail before the migration exists.

## What you need

Postgres 17 (`initdb`, `pg_ctl`, `postgres`, `psql`), matching production (17.6), run as a non-root user; see `../friends/README.md` for Windows. In a Linux container without one, the npm package `@embedded-postgres/linux-x64@17.6.0-beta.15` carries 17.6's `initdb`, `pg_ctl` and `postgres` under `native/` (create the library links its `pg-symlinks.json` lists); any `psql` connects to it.

## Run it

From the repo root, with the data folder outside the repo (`$PGDATA_DIR` here):

```bash
initdb -D "$PGDATA_DIR" -A trust -U postgres -E UTF8 --locale=C
pg_ctl -D "$PGDATA_DIR" -l "$PGDATA_DIR.log" -o "-c listen_addresses=localhost -p 5499" start
export PGOPTIONS="-c plpgsql.extra_warnings=all -c plpgsql.extra_errors=all"
F=supabase/replay
P="psql -h localhost -p 5499 -U postgres -d binders"
psql -h localhost -p 5499 -U postgres -c "create database binders"
$P -v ON_ERROR_STOP=1 \
  -f $F/friends/scaffold.sql \
  -f $F/collection-sharing/collections.sql \
  -f supabase/migrations/20261103064319_collection_binders.sql \
  -f $F/friends/helpers.sql
$P -f $F/collection-binders/checks.sql
$P -f $F/collection-binders/race-setup.sql
for n in 1 2 3; do $P -f $F/collection-binders/race$n-first.sql & $P -f $F/collection-binders/race$n-second.sql; wait; done
$P -f $F/collection-binders/race-verify.sql
```

`checks.sql` stops at the first failed `assert` or wrong SQLSTATE, and ends with `== all sequential checks passed`. Without the binders migration it stops at check 1, on `relation "public.collection_binders" does not exist`.

Each race's first file names its session (`application_name`) once its insert is in and its transaction open, then holds it 3 s; the second file waits for that name (`t.wait_for`, from `checks.sql`) before it starts, so the two always overlap. In races 1 and 2 the second file's insert then waits about 3 s for the first to commit (`\timing` prints it), on the lock the insert trigger takes per owner, and asserts that it waited. In race 3 a player sends a binder naming the player whose lock the first file holds, under a 1 s `lock_timeout`, and is turned down at once, without touching that lock. Each race file asserts its own answer and prints it as a NOTICE, so a wrong answer stops that file with an ERROR. `race-verify.sql` then checks what the races left behind and ends with `== all race checks passed`; it runs in its own session and can't see a race file's ERROR, so watch for one:

| Race | What overlaps | The second file's answer |
|------|---------------|--------------------------|
| 1 | two 30th binders on P's shelf of 29 | `race1 second: 23514, the shelf is full` |
| 2 | two binders on Q's shelf of three | `race2 second: place 4` |
| 3 | Q's sixth binder, and P's insert naming Q | `race3 second: 42501, without waiting on Q's lock` |

Stop the server with `pg_ctl -D "$PGDATA_DIR" stop`, then delete the data folder.

## Proving a check bites

Plant the mistake in a copy of the migration and load the copy instead. Each of these stops the run at the check named. Checks 5b and 5c read the privileges and the function's settings straight from the catalog, so two mistakes stop there first; the second column names the check that catches the same mistake by what a player can do, which you see by running `checks.sql` without 5b and 5c.

| Planted mistake | Fails at | Without 5b and 5c |
|---|---|---|
| `collection_binders`' foreign key without `on delete cascade` | 11 (clearing the collection fails) | 11 |
| `collection_shelf`'s foreign key without `on delete cascade` | 11 | 11 |
| `grant insert` adds `place` | 5 (a client sets a place) | 5 |
| `grant update` on every column | 5 (`owner_id` and `place` are writable) | 5 |
| the binders' select policy's `using` is `true` | 4 (B reads A's binders) | 4 |
| the shelf's select policy's `using` is `true` | 10 (B reads A's cover) | 10 |
| the cap reads `> 30` | 7 (a 31st binder lands, alone or in one insert of many), and race 1's second file | 7 |
| the trigger takes no lock | race 1's second file gets `23505`, race 2's second file gets `23505` and `race-verify.sql` fails | the same |
| the trigger takes the lock before checking `owner_id` | race 3's second file (`55P03`: it waited on Q's lock) | the same |
| the name check is `name = btrim(name)` and `!~ '[[:cntrl:]]'` again | 6 (a lone no-break space is a name) | 6 |
| the name's ends leave out the zero-width characters | 6 (`Name` and a zero-width joiner is a name) | 6 |
| only the name's start is checked | 6 (`Name` and a no-break space is a name) | 6 |
| the control characters stop at ASCII | 6 (a C1 next-line character passes) | 6 |
| the unique constraint isn't deferrable | 8 (the swap fails with `23505`) | 8 |
| `move_binder` is `security invoker` | 5c | 8 (`42501` on `place`) |
| `move_binder`'s first read drops `b.owner_id = uid` | 8 (B's call on A's binder doesn't get `P0002`) | 8 |
| `move_binder`'s update drops `b.owner_id = uid` | 8 (A's swap moves B's binder too) | 8 |
| `move_binder` drops its null check on `earlier` | 8 (a null moves the binder later) | 8 |
| `move_binder` finds the binder before with `min` instead of `max`, so it takes the first place rather than the nearest | 8 | 8 |
| `move_binder` revoked from `public` only | 1 (anon calls it) | 1 |
| `collection_shelf`'s update grant leaves out `owner_id` | 5b | 10 (the owner's upsert fails `42501`) |
