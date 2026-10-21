# Friends replay

The database checks for friends (#852) and the friend-code try limit (#860), run on a local Postgres 17 instead of the Supabase project. It never connects to the project.

- `scaffold.sql` stands in for the Supabase pieces the migrations touch: the client roles and their default grants, `auth.users`, `auth.uid()` and the `internal` schema.
- `helpers.sql` adds named players, acting as one the way PostgREST does (transaction-local JWT claims, then the role), and expected errors.
- `checks.sql` runs the sequential checks, one transaction per block.
- The `race*.sql` files run the races: two sessions at once, the first holding its transaction open.

Re-run it whenever a migration changes `friend_codes`, `friendships`, `internal.friend_request_attempts` or a friends function, and add the change's checks first, so you see them fail before the migration exists. The harness lived in #852's session scratchpad until #860 moved it here.

## What you need

Postgres 17 (`initdb`, `postgres`, `psql`), matching production (17.6). On Windows, EDB's portable `postgresql-17.6-2-windows-x64-binaries.zip` from get.enterprisedb.com needs no install: extract its `pgsql/bin`, `pgsql/lib` and `pgsql/share`. Its executables are unsigned, as EDB's installed ones are.

## Run it

From the repo root, with the data folder outside the repo (`$PGDATA_DIR` here):

```bash
initdb -D "$PGDATA_DIR" -A trust -U postgres -E UTF8 --locale=C
postgres -D "$PGDATA_DIR" -p 5499 -c listen_addresses=localhost   # its own terminal
export PGOPTIONS="-c plpgsql.extra_warnings=all -c plpgsql.extra_errors=all"
psql -h localhost -p 5499 -U postgres -c "create database friends"
psql -h localhost -p 5499 -U postgres -d friends -v ON_ERROR_STOP=1 \
  -f supabase/replay/friends/scaffold.sql \
  -f supabase/migrations/20261020184645_friends.sql \
  -f supabase/migrations/20261020235319_friend_send_limit.sql \
  -f supabase/replay/friends/helpers.sql
psql -h localhost -p 5499 -U postgres -d friends -f supabase/replay/friends/checks.sql
```

Load every friends migration in order, then `helpers.sql`. `PGOPTIONS` turns PL/pgSQL's extra checks into errors for the whole replay. `checks.sql` stops at the first failed `assert` or wrong SQLSTATE, and ends with `== all sequential checks passed`.

Then the races, on the same database. Each runs its first file in the background and its second at once; the second waits a second, then calls while the first's transaction is still open:

```bash
F=supabase/replay/friends
P="psql -h localhost -p 5499 -U postgres -d friends"
$P -f $F/race-setup.sql
for n in 1 2 3; do $P -f $F/race$n-first.sql & $P -f $F/race$n-second.sql; wait; done
$P -f $F/race-verify.sql
$P -f $F/race4-setup.sql
$P -f $F/race4-first.sql & $P -f $F/race4-second.sql; wait
$P -f $F/race4-verify.sql
$P -f $F/race5-setup.sql
$P -f $F/race5-first.sql & $P -f $F/race5-second.sql; wait
$P -f $F/race5-verify.sql
```

Every second file's call waits about 2 s for the first to commit (`\timing` prints it), then answers. Each race file asserts its own answer and prints it as a NOTICE, so a wrong answer stops that file with an ERROR. The verify files then check what the race left behind; they run in their own sessions and can't see a race file's ERROR, so watch for one:

| Race | What overlaps | The second file's answer |
|------|---------------|--------------------------|
| 1 | P asks Q while Q asks P | `race1 Q->P: accepted, friend is P: true` |
| 2 | two clicks on the same code | `race2 second click: pending` |
| 3 | two first claims of a code | the first claim's code |
| 4 | the 20th and 21st requests | `race4 S->T21: too_many` |
| 5 | the 30th and 31st tries | `race5 31st try: slow_down` |

The verify files end with `== all race checks passed` (races 1 to 3), `== race 4 passed` and `== race 5 passed`. Stop the server with Ctrl+C in its terminal, then delete the data folder.

## Proving a check bites

Plant the mistake in a copy of the migration and load the copy instead. In `send_friend_request`, without the `>= 30` try-limit block check 12 fails, recording the try after the code checks fails check 15, and without the advisory lock the second files of races 4 and 5 fail their asserts (both answer `pending`). Their failed calls roll back, so the verify files still pass: the race files' ERRORs are the signal. Check 16 proves no client role gets through to `internal.friend_request_attempts`, with or without the schema opened to it; check 16b proves none holds a privilege on the table, its columns or its sequence, so any such grant fails it.
