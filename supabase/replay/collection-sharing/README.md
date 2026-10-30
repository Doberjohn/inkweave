# Collection sharing replay

The database checks for collection sharing (#1045): the switch (`collection_sharing`) and the two functions friends read through (`shared_friends()`, `friend_collections()`), run on a local Postgres 17 instead of the Supabase project. It never connects to the project.

It builds on the friends replay (`../friends/`): its `scaffold.sql` stands in for the Supabase pieces, its `helpers.sql` adds named players and acting as one, and the friends migrations make the friendships the functions check.

- `collections.sql` holds the pieces of `public.collections` the migration references, copied verbatim from their migrations (`set_updated_at()`, the table, its policies, trigger and grants). Copy any later change to `collections` here too.
- `checks.sql` runs the checks, one transaction per block. It makes six players (E holds no collection), friends B with A and F with B through the real friend functions, and leaves D's request to A waiting (D shares from 8b on). Its upserts are the statements PostgREST sends for the app's.

Re-run it whenever a migration changes `collection_sharing`, either function, or what they read (`collections`, `friendships`), and add the change's checks first, so you see them fail before the migration exists.

Both functions write out the same friendship and switch check, and the planted mistakes below go into both copies. A change to that check changes both, and the next migration that rewrites the functions can have `friend_collections` read `shared_friends()` instead, so the check lives in one place.

## What you need

Postgres 17 (`initdb`, `postgres`, `psql`), matching production (17.6), run as a non-root user; see `../friends/README.md` for Windows. In a Linux container without one, the npm package `@embedded-postgres/linux-x64@17.6.0-beta.15` carries 17.6's `initdb`, `pg_ctl` and `postgres` under `native/` (create the library links its `pg-symlinks.json` lists); any `psql` connects to it.

## Run it

From the repo root, with the data folder outside the repo (`$PGDATA_DIR` here):

```bash
initdb -D "$PGDATA_DIR" -A trust -U postgres -E UTF8 --locale=C
pg_ctl -D "$PGDATA_DIR" -l "$PGDATA_DIR.log" -o "-c listen_addresses=localhost -p 5499" start
export PGOPTIONS="-c plpgsql.extra_warnings=all -c plpgsql.extra_errors=all"
F=supabase/replay
psql -h localhost -p 5499 -U postgres -c "create database sharing"
psql -h localhost -p 5499 -U postgres -d sharing -v ON_ERROR_STOP=1 \
  -f $F/friends/scaffold.sql \
  -f supabase/migrations/20261020184645_friends.sql \
  -f supabase/migrations/20261020235319_friend_send_limit.sql \
  -f supabase/migrations/20261030214349_friend_tries_prune_all.sql \
  -f $F/collection-sharing/collections.sql \
  -f supabase/migrations/20261028090000_collection_sharing.sql \
  -f $F/friends/helpers.sql
psql -h localhost -p 5499 -U postgres -d sharing -f $F/collection-sharing/checks.sql
```

`checks.sql` stops at the first failed `assert` or wrong SQLSTATE, and ends with `== all sequential checks passed`. Without the collection-sharing migration it stops at once, on `relation "public.collection_sharing" does not exist`. Stop the server with `pg_ctl -D "$PGDATA_DIR" stop`, then delete the data folder.

## Proving a check bites

Plant the mistake in a copy of the migration and load the copy instead. Each of these stops the run at the check named:

| Planted mistake | Fails at |
|---|---|
| `friend_collections` drops `and s.friends` | 7 (A reads B's collection with B's switch off) |
| `shared_friends` drops `f.status = 'accepted'` | 8 (D, whose request waits, sees A) |
| `friend_collections` also returns `imported_at` | 6 (the columns) |
| `grant update` on every column | 5 (created_at is writable) |
| a `delete` grant and policy | 5 (the row can be deleted) |
| the foreign key without `on delete cascade` | 10 (clearing the collection fails) |
| `friend_collections` revoked from `public` only | 1 (anon calls it) |
| `friend_collections` drops the `only_friend` filter | 6b (`friend_collections(F)` returns A too) |
| `friend_collections` checks one side of the friendship | 6b (B misses F, who asked B) |
| the update policy's `with check` is `true` | 4 (B moves their own row onto C and turns C's on) |
| both functions lose the parentheses around the two sides, so `status` binds only to the first | 8b (A, who left D's request waiting, sees D) |
