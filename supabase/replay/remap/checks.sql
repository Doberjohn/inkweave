-- #986 replay: a graduation's backup of a collection or deck goes when that row goes.
-- Each check makes its own rows and remaps its own card ids under its own label, so no
-- check leans on another's. A failed ASSERT stops the run.
\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on

\echo '== setup: players U, V, W, X, Y, Z, Q, I, J, D, E, G and H'
select t.make_user(n) from unnest(array['U', 'V', 'W', 'X', 'Y', 'Z', 'Q', 'I', 'J', 'D', 'E', 'G', 'H']) n;

-- How many backups a collection (row id: its owner) or a deck has, under any label.
create function t.backups(source text, row_id uuid) returns int language sql stable as $$
  select count(*)::int from internal.card_id_remap_backup b
   where b.source_table = $1 and b.row_id = $2::text
$$;

-- For the races: waits up to 10 s until a query finds a row, so the two sessions wait for
-- each other instead of trusting sleeps. pg_stat_activity holds one snapshot per
-- transaction unless cleared.
create function t.wait_until(probe text, what text) returns void language plpgsql as $$
declare hit boolean;
begin
  for attempt in 1..200 loop
    perform pg_stat_clear_snapshot();
    execute format('select exists (%s)', probe) into hit;
    if hit then return; end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'gave up waiting for %', what;
end $$;

-- The races' two probes: another session holds the remap's lock on the tables, or some
-- session waits for a lock on one of them.
create function t.holds_tables() returns text language sql immutable as $$
  select $q$select 1 from pg_locks l
             where l.relation = 'public.collections'::regclass and l.granted
               and l.mode = 'ShareRowExclusiveLock' and l.pid <> pg_backend_pid()$q$
$$;
create function t.waits_for_tables() returns text language sql immutable as $$
  select $q$select 1 from pg_locks l
             where l.relation in ('public.votes'::regclass, 'public.collections'::regclass,
                                  'public.decks'::regclass)
               and not l.granted$q$
$$;

\echo '== R0. the backups of rows deleted before the migration are gone, and the rest stay'
do $$
declare n int;
begin
  assert t.backups('collections', t.uid('O')) = 0, 'O''s collection is gone, and its backup outlived the migration';
  assert t.backups('collections', t.uid('C')) = 0, 'C''s backed-up collection was cleared and imported again, and its backup outlived the migration';
  select count(*) into n from internal.card_id_remap_backup where source_table = 'decks' and label = 'seed';
  assert n = 0, format('O''s deck is gone, and %s backups of it outlived the migration', n);
  assert t.backups('collections', t.uid('K')) = 1, 'the migration dropped the backup of K''s collection, which is still there';
  select count(*) into n from internal.card_id_remap_backup where source_table = 'votes' and label = 'seed';
  assert n = 1, format('the merged vote has %s backups, not 1', n);
end $$;

\echo '== R1. clearing a collection drops its backup'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('U'), '{"r1-old": {"normal": 1}}', now());
do $$ begin
  assert internal.remap_collection_card_ids('{"r1-old": "r1-new"}', 'r1') = 1, 'the remap missed U''s collection';
  assert t.backups('collections', t.uid('U')) = 1, 'the remap saved no backup of U''s collection';
end $$;
-- As U, the way the account page's Clear deletes it.
begin;
select t.act_as('U');
delete from public.collections where owner_id = t.uid('U');
commit;
do $$ begin
  assert not exists (select 1 from public.collections where owner_id = t.uid('U')), 'U''s collection is still there';
  assert t.backups('collections', t.uid('U')) = 0, 'U''s backup outlived the collection';
end $$;

\echo '== R2. deleting an account drops the backups of its collection and its decks'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('V'), '{"r2-old": {"normal": 1}}', now());
insert into public.decks (owner_id, name, cards)
values (t.uid('V'), 'R2 deck', '[{"cardId": "r2-old", "quantity": 2}]');
do $$ begin
  assert internal.remap_collection_card_ids('{"r2-old": "r2-new"}', 'r2') = 1, 'the remap missed V''s collection';
  assert internal.remap_deck_card_ids('{"r2-old": "r2-new"}', 'r2') = 1, 'the remap missed V''s deck';
end $$;
delete from auth.users where id = t.uid('V');
do $$
declare n int;
begin
  assert not exists (select 1 from public.collections where owner_id = t.uid('V'))
     and not exists (select 1 from public.decks where owner_id = t.uid('V')),
    'V''s collection or deck outlived the account';
  select count(*) into n from internal.card_id_remap_backup where label = 'r2';
  assert n = 0, format('%s of V''s backups outlived the account', n);
end $$;

\echo '== R3. deleting a deck drops its backup'
insert into public.decks (owner_id, name, cards)
values (t.uid('W'), 'R3 deck', '[{"cardId": "r3-old", "quantity": 2}]');
do $$
declare deck uuid := (select id from public.decks where owner_id = t.uid('W'));
begin
  assert internal.remap_deck_card_ids('{"r3-old": "r3-new"}', 'r3') = 1, 'the remap missed W''s deck';
  assert t.backups('decks', deck) = 1, 'the remap saved no backup of W''s deck';
end $$;
begin;
select t.act_as('W');
delete from public.decks where owner_id = t.uid('W');
commit;
do $$
declare n int;
begin
  assert not exists (select 1 from public.decks where owner_id = t.uid('W')), 'W''s deck is still there';
  select count(*) into n from internal.card_id_remap_backup where label = 'r3';
  assert n = 0, format('%s backups of W''s deck outlived it', n);
end $$;

\echo '== R4. an undo after a clear and a fresh import leaves the new import as it is'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('X'), '{"r4-old": {"normal": 1}}', now()),
       (t.uid('Y'), '{"r4-old": {"normal": 2}}', now());
do $$ begin
  assert internal.remap_collection_card_ids('{"r4-old": "r4-new"}', 'r4') = 2, 'the remap missed X''s or Y''s collection';
end $$;
-- X clears the collection and imports another, as the app sends them.
begin;
select t.act_as('X');
delete from public.collections where owner_id = t.uid('X');
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('X'), '{"fresh-1": {"normal": 3}}', now());
commit;
do $$
declare restored int; got jsonb;
begin
  restored := internal.undo_card_id_remap('r4');
  select entries into got from public.collections where owner_id = t.uid('X');
  assert got = '{"fresh-1": {"normal": 3}}', format('the undo wrote over X''s new import: %s', got);
  select entries into got from public.collections where owner_id = t.uid('Y');
  assert got = '{"r4-old": {"normal": 2}}', format('the undo left Y''s collection at %s', got);
  assert restored = 1, format('the undo restored %s rows, not Y''s alone', restored);
end $$;

\echo '== R5. a remap keeps the backups it saves, and a delete drops only its own row''s'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('Z'), '{"r5-old": {"normal": 1}}', now()),
       (t.uid('Q'), '{"q-1": {"normal": 1}}', now());
do $$ begin
  assert internal.remap_collection_card_ids('{"r5-old": "r5-new"}', 'r5') = 1, 'the remap missed Z''s collection';
  assert t.backups('collections', t.uid('Z')) = 1, 'the remap''s update dropped the backup it saved of Z''s collection';
end $$;
-- A merged vote's backup whose row id is Q's account id, as a vote's id never is: only a
-- collection's backup names its row by the owner.
insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
values ('r5', 'votes', t.uid('Q')::text, 'deleted', '{}');
begin;
select t.act_as('Q');
delete from public.collections where owner_id = t.uid('Q');
commit;
do $$ begin
  assert not exists (select 1 from public.collections where owner_id = t.uid('Q')), 'Q''s collection is still there';
  assert t.backups('collections', t.uid('Z')) = 1, 'Q''s clear dropped the backup of Z''s collection';
  assert t.backups('collections', t.uid('K')) = 1, 'Q''s clear dropped the backup of K''s collection';
  assert t.backups('votes', t.uid('Q')) = 1, 'Q''s clear dropped a vote''s backup';
end $$;

\echo '== R6. no client role can call the trigger function or undo, or holds a privilege on the backup table'
do $$
declare who text; fn text; n int;
begin
  foreach who in array array['anon', 'authenticated', 'service_role'] loop
    foreach fn in array array['internal.drop_card_id_remap_backups()', 'internal.undo_card_id_remap(text)'] loop
      assert not has_function_privilege(who, fn, 'execute'), format('%s can call %s', who, fn);
    end loop;
  end loop;
  -- Grantee 0 is PUBLIC.
  select count(*) into n
    from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
   where c.oid = 'internal.card_id_remap_backup'::regclass
     and (a.grantee = 0 or a.grantee in (select r.oid from pg_roles r
                                          where r.rolname in ('anon', 'authenticated', 'service_role')));
  assert n = 0, format('client roles or PUBLIC hold %s privileges on internal.card_id_remap_backup', n);
end $$;

\echo '== R7. an undo after an import over the collection, with no clear, leaves the import as it is'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('I'), '{"r7-old": {"normal": 1}}', now()),
       (t.uid('J'), '{"r7-old": {"normal": 2}}', now());
do $$ begin
  assert internal.remap_collection_card_ids('{"r7-old": "r7-new"}', 'r7') = 2, 'the remap missed I''s or J''s collection';
end $$;
-- I imports again, as PostgREST sends the app's upsert: every column it sends, the key included.
begin;
select t.act_as('I');
insert into public.collections (owner_id, entries, imported_at, schema_version)
values (t.uid('I'), '{"fresh-7": {"normal": 3}}', now(), 1)
on conflict (owner_id) do update
  set owner_id = excluded.owner_id, entries = excluded.entries,
      imported_at = excluded.imported_at, schema_version = excluded.schema_version;
commit;
do $$
declare restored int; got jsonb;
begin
  restored := internal.undo_card_id_remap('r7');
  select entries into got from public.collections where owner_id = t.uid('I');
  assert got = '{"fresh-7": {"normal": 3}}', format('the undo wrote over I''s new import: %s', got);
  select entries into got from public.collections where owner_id = t.uid('J');
  assert got = '{"r7-old": {"normal": 2}}', format('the undo left J''s collection at %s', got);
  assert restored = 1, format('the undo restored %s rows, not J''s alone', restored);
end $$;

\echo '== R8. an undo after a deck edit leaves the edit as it is'
insert into public.decks (owner_id, name, cards)
values (t.uid('D'), 'R8 edited', '[{"cardId": "r8-old", "quantity": 2}]'),
       (t.uid('E'), 'R8 untouched', '[{"cardId": "r8-old", "quantity": 1}]');
do $$ begin
  assert internal.remap_deck_card_ids('{"r8-old": "r8-new"}', 'r8') = 2, 'the remap missed D''s or E''s deck';
end $$;
begin;
select t.act_as('D');
update public.decks set cards = '[{"cardId": "r8-new", "quantity": 4}]' where owner_id = t.uid('D');
commit;
do $$
declare restored int; got jsonb;
begin
  restored := internal.undo_card_id_remap('r8');
  select cards into got from public.decks where owner_id = t.uid('D');
  assert got = '[{"cardId": "r8-new", "quantity": 4}]', format('the undo wrote over D''s edit: %s', got);
  select cards into got from public.decks where owner_id = t.uid('E');
  assert got = '[{"cardId": "r8-old", "quantity": 1}]', format('the undo left E''s deck at %s', got);
  assert restored = 1, format('the undo restored %s rows, not E''s alone', restored);
end $$;

\echo '== R9. a collection a re-run saved twice under one label goes back to its first copy'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('G'), '{"r9-a": {"normal": 1}, "r9-b": {"normal": 1}}', now());
-- Each block is its own transaction, so the re-run writes G's row later than the first run.
do $$ begin
  assert internal.remap_collection_card_ids('{"r9-a": "r9-a-new"}', 'r9') = 1, 'the first run missed G''s collection';
end $$;
do $$ begin
  assert internal.remap_collection_card_ids('{"r9-b": "r9-b-new"}', 'r9') = 1, 'the re-run missed G''s collection';
  assert t.backups('collections', t.uid('G')) = 2, 'the two runs saved no two backups of G''s collection';
end $$;
do $$
declare restored int; got jsonb;
begin
  restored := internal.undo_card_id_remap('r9');
  select entries into got from public.collections where owner_id = t.uid('G');
  assert got = '{"r9-a": {"normal": 1}, "r9-b": {"normal": 1}}', format('the undo left G''s collection at %s', got);
  assert restored = 1, format('the undo restored %s rows, not G''s', restored);
end $$;

\echo '== R10. an undo leaves a collection imported again between two runs under one label'
insert into public.collections (owner_id, entries, imported_at)
values (t.uid('H'), '{"r10-a": {"normal": 1}}', now());
do $$ begin
  assert internal.remap_collection_card_ids('{"r10-a": "r10-a-new"}', 'r10') = 1, 'the first run missed H''s collection';
end $$;
-- H imports again from a page still on a preview id, which the re-run then moves.
begin;
select t.act_as('H');
insert into public.collections (owner_id, entries, imported_at, schema_version)
values (t.uid('H'), '{"r10-b": {"normal": 4}}', now(), 1)
on conflict (owner_id) do update
  set owner_id = excluded.owner_id, entries = excluded.entries,
      imported_at = excluded.imported_at, schema_version = excluded.schema_version;
commit;
do $$ begin
  assert internal.remap_collection_card_ids('{"r10-b": "r10-b-new"}', 'r10') = 1, 'the re-run missed H''s new import';
end $$;
do $$
declare restored int; got jsonb;
begin
  restored := internal.undo_card_id_remap('r10');
  select entries into got from public.collections where owner_id = t.uid('H');
  assert got = '{"r10-b-new": {"normal": 4}}', format('the undo put H''s collection back to %s, from before the import', got);
  assert restored = 0, format('the undo restored %s rows, not none', restored);
  assert t.backups('collections', t.uid('H')) = 0, 'the undo kept H''s backups';
end $$;

-- Covers (#1074): a binder's cover_id and My collection's (collection_shelf) name one card each.
\echo '== setup: players A, B, F, N, P, R and S, for the covers'
select t.make_user(n) from unnest(array['A', 'B', 'F', 'R', 'S', 'N', 'P']) n;
insert into public.collections (owner_id, entries, imported_at)
select t.uid(n), '{}', now() from unnest(array['A', 'B', 'F', 'R', 'P']) n;

-- Every binder name below is used once, so a name finds its binder.
create function t.binder(binder_name text) returns uuid language sql stable as $$
  select b.id from public.collection_binders b where b.name = binder_name
$$;
create function t.cover(binder_name text) returns text language sql stable as $$
  select b.cover_id from public.collection_binders b where b.name = binder_name
$$;
create function t.shelf_cover(who text) returns text language sql stable as $$
  select s.cover_id from public.collection_shelf s where s.owner_id = t.uid(who)
$$;
-- The keys of a backup's old_row, in order.
create function t.backup_keys(source text, row_id uuid) returns text[] language sql stable as $$
  select array_agg(k order by k)
    from internal.card_id_remap_backup b, jsonb_object_keys(b.old_row) k
   where b.source_table = $1 and b.row_id = $2::text
$$;
-- This session holds the lock that keeps writers out of both cover tables until it commits.
create function t.holds_cover_tables() returns boolean language sql stable as $$
  select count(*) = 2 from pg_locks l
   where l.pid = pg_backend_pid() and l.granted and l.mode = 'ShareRowExclusiveLock'
     and l.relation in ('public.collection_binders'::regclass, 'public.collection_shelf'::regclass)
$$;

\echo '== R11. a remap moves each binder and shelf cover on an old id, backs up the covers alone, and keeps writers out'
insert into public.collection_binders (owner_id, name, scope, rules, cover_id)
values (t.uid('A'), 'A moved', '12', 'inks=Amber', 'r11-old'),
       (t.uid('A'), 'A other', 'all', '', 'r11-other'),
       (t.uid('A'), 'A none', 'all', '', null),
       (t.uid('B'), 'B moved', 'all', '', 'r11-old');
insert into public.collection_shelf (owner_id, cover_id)
values (t.uid('A'), 'r11-old'), (t.uid('B'), null);
do $$
declare got jsonb; n int;
begin
  got := internal.remap_card_ids('{"r11-old": "r11-new"}', 'r11');
  assert got @> '{"collections": 0, "decks": 0, "binder_covers": 2, "shelf_covers": 1}',
    format('the remap returned %s', got);
  assert t.cover('A moved') = 'r11-new' and t.cover('B moved') = 'r11-new',
    format('the binder covers are %s and %s, not r11-new', t.cover('A moved'), t.cover('B moved'));
  assert t.cover('A other') = 'r11-other' and t.cover('A none') is null, 'the remap moved a cover on no old id';
  assert t.shelf_cover('A') = 'r11-new', format('A''s shelf cover is %s', t.shelf_cover('A'));
  assert t.shelf_cover('B') is null, format('B''s empty shelf cover is %s', t.shelf_cover('B'));
  select count(*) into n from internal.card_id_remap_backup where label = 'r11';
  assert n = 3, format('the remap saved %s backups, not one per cover it moved', n);
  assert t.backup_keys('collection_binders', t.binder('A moved')) = '{cover_id,id,owner_id,remapped_to}',
    format('a binder''s backup holds %s', t.backup_keys('collection_binders', t.binder('A moved')));
  assert t.backup_keys('collection_shelf', t.uid('A')) = '{cover_id,owner_id,remapped_to}',
    format('a shelf''s backup holds %s', t.backup_keys('collection_shelf', t.uid('A')));
  assert not exists (select 1 from internal.card_id_remap_backup b
                      where b.label = 'r11'
                        and (b.old_row ->> 'cover_id', b.old_row ->> 'remapped_to')
                            is distinct from ('r11-old', 'r11-new')),
    'a backup holds another cover than the one before the remap, or another than the one it gave';
  assert t.holds_cover_tables(), 'the remap left the cover tables open to writers';
end $$;

\echo '== R12. an undo puts back every cover no one picked since, a binder renamed or moved included'
insert into public.collection_binders (owner_id, name, cover_id)
values (t.uid('F'), 'F untouched', 'r12-old'),
       (t.uid('F'), 'F picked', 'r12-old'),
       (t.uid('F'), 'F cleared', 'r12-old'),
       (t.uid('R'), 'R renamed', 'r12-old'),
       (t.uid('R'), 'R moved', 'r12-old'),
       (t.uid('R'), 'R neighbour', 'r12-old');
insert into public.collection_shelf (owner_id, cover_id)
values (t.uid('F'), 'r12-old'), (t.uid('R'), 'r12-old');
do $$
declare got jsonb := internal.remap_card_ids('{"r12-old": "r12-new"}', 'r12');
begin
  assert got @> '{"binder_covers": 6, "shelf_covers": 2}', format('the remap returned %s', got);
end $$;
-- As the app sends them: F picks another cover for one binder and clears another's; R renames
-- one, moves another past its neighbour, which swaps the two, and picks another cover for My
-- collection, through the shelf's upsert.
begin;
select t.act_as('F');
update public.collection_binders set cover_id = 'f-own' where id = t.binder('F picked');
update public.collection_binders set cover_id = null where id = t.binder('F cleared');
commit;
begin;
select t.act_as('R');
update public.collection_binders set name = 'R renamed again' where id = t.binder('R renamed');
select public.move_binder(t.binder('R moved'), false);
insert into public.collection_shelf (owner_id, cover_id)
values (t.uid('R'), 'r-own')
on conflict (owner_id) do update set owner_id = excluded.owner_id, cover_id = excluded.cover_id;
commit;
do $$
declare restored int;
begin
  restored := internal.undo_card_id_remap('r12');
  assert t.cover('F untouched') = 'r12-old', format('the undo left F''s binder at %s', t.cover('F untouched'));
  assert t.shelf_cover('F') = 'r12-old', format('the undo left F''s shelf at %s', t.shelf_cover('F'));
  assert t.cover('F picked') = 'f-own', format('the undo wrote over F''s pick: %s', t.cover('F picked'));
  assert t.cover('F cleared') is null, format('the undo wrote over F''s cleared cover: %s', t.cover('F cleared'));
  assert t.cover('R renamed again') = 'r12-old', format('the undo left a renamed binder at %s', t.cover('R renamed again'));
  assert t.cover('R moved') = 'r12-old', format('the undo left a moved binder at %s', t.cover('R moved'));
  assert t.cover('R neighbour') = 'r12-old', format('the undo left the binder a move swapped at %s', t.cover('R neighbour'));
  assert t.shelf_cover('R') = 'r-own', format('the undo wrote over R''s pick: %s', t.shelf_cover('R'));
  assert restored = 5, format('the undo restored %s rows, not the five covers no one picked', restored);
  assert not exists (select 1 from internal.card_id_remap_backup where label = 'r12'), 'the undo kept r12''s backups';
  assert t.holds_cover_tables(), 'the undo left the cover tables open to writers';
end $$;

\echo '== R13. deleting a binder drops its backup, and clearing a collection or deleting an account drops its covers'''
insert into public.collections (owner_id, entries, imported_at)
select t.uid(n), '{"r13-old": {"normal": 1}}', now() from unnest(array['S', 'N']) n;
insert into public.collection_binders (owner_id, name, cover_id)
values (t.uid('S'), 'S deleted', 'r13-old'),
       (t.uid('S'), 'S kept', 'r13-old'),
       (t.uid('N'), 'N binder', 'r13-old');
insert into public.collection_shelf (owner_id, cover_id)
values (t.uid('S'), 'r13-old'), (t.uid('N'), 'r13-old');
do $$
declare got jsonb := internal.remap_card_ids('{"r13-old": "r13-new"}', 'r13');
begin
  assert got @> '{"collections": 2, "binder_covers": 3, "shelf_covers": 2}', format('the remap returned %s', got);
end $$;
-- What a backup of S's or N's names: its row, or the owner its old_row holds.
create function t.r13_backups(who text) returns int language sql stable as $$
  select count(*)::int from internal.card_id_remap_backup b
   where b.label = 'r13' and (b.row_id = t.uid(who)::text or b.old_row ->> 'owner_id' = t.uid(who)::text)
$$;
-- S deletes a binder, as the shelf's menu does.
begin;
select t.act_as('S');
delete from public.collection_binders where id = t.binder('S deleted');
commit;
do $$ begin
  assert t.binder('S deleted') is null, 'S''s binder is still there';
  assert t.r13_backups('S') = 3, format('S has %s backups, not the kept binder''s, the shelf''s and the collection''s', t.r13_backups('S'));
  assert t.backups('collection_binders', t.binder('S kept')) = 1, 'S''s delete dropped the other binder''s backup';
end $$;
-- S clears the collection, as the account page's Clear does; N deletes the account.
begin;
select t.act_as('S');
delete from public.collections where owner_id = t.uid('S');
commit;
do $$ begin
  assert not exists (select 1 from public.collection_binders where owner_id = t.uid('S'))
     and not exists (select 1 from public.collection_shelf where owner_id = t.uid('S')),
    'S''s binders or shelf outlived the collection';
  assert t.r13_backups('S') = 0, format('%s of S''s backups outlived the collection', t.r13_backups('S'));
  assert t.r13_backups('N') = 3, format('S''s clear left N %s backups, not 3', t.r13_backups('N'));
end $$;
delete from auth.users where id = t.uid('N');
do $$ begin
  assert t.r13_backups('N') = 0, format('%s of N''s backups outlived the account', t.r13_backups('N'));
end $$;

\echo '== R14. no client role can call the cover remap, or the functions it changed'
do $$
declare who text; fn text;
begin
  foreach who in array array['anon', 'authenticated', 'service_role'] loop
    foreach fn in array array['internal.remap_cover_card_ids(jsonb, text)', 'internal.remap_card_ids(jsonb, text)',
                              'internal.undo_card_id_remap(text)', 'internal.drop_card_id_remap_backups()'] loop
      assert not has_function_privilege(who, fn, 'execute'), format('%s can call %s', who, fn);
    end loop;
  end loop;
end $$;

\echo '== R15. an undo leaves a cover picked again between two runs under one label'
insert into public.collection_binders (owner_id, name, cover_id)
values (t.uid('P'), 'P binder', 'r15-a');
do $$ begin
  assert internal.remap_cover_card_ids('{"r15-a": "r15-a-new"}', 'r15') = '{"binder_covers": 1, "shelf_covers": 0}',
    'the first run missed P''s binder';
end $$;
-- P picks a cover from a page still on a preview id, which the re-run then moves.
begin;
select t.act_as('P');
update public.collection_binders set cover_id = 'r15-b' where id = t.binder('P binder');
commit;
do $$ begin
  assert internal.remap_cover_card_ids('{"r15-b": "r15-b-new"}', 'r15') = '{"binder_covers": 1, "shelf_covers": 0}',
    'the re-run missed P''s pick';
end $$;
do $$
declare restored int;
begin
  restored := internal.undo_card_id_remap('r15');
  assert t.cover('P binder') = 'r15-b-new', format('the undo put P''s cover back to %s, from before the pick', t.cover('P binder'));
  assert restored = 0, format('the undo restored %s rows, not none', restored);
  assert t.backups('collection_binders', t.binder('P binder')) = 0, 'the undo kept P''s backups';
end $$;

\echo '== R16. a map to an id no cover can hold is refused before anything moves'
insert into public.collection_binders (owner_id, name, cover_id)
values (t.uid('P'), 'P second', 'r16-old');
do $$
declare msg text;
begin
  begin
    perform internal.remap_card_ids('{"r16-old": "r16 new"}', 'r16');
  exception when others then
    msg := sqlerrm;
  end;
  assert msg like 'remap_card_ids maps r16-old to "r16 new"%',
    format('the remap answered %s', coalesce(msg, 'nothing: it took the map'));
  assert t.cover('P second') = 'r16-old', 'the refused remap moved a cover';
  assert not exists (select 1 from internal.card_id_remap_backup where label = 'r16'), 'the refused remap saved backups';
end $$;

\echo '== R17. a cover two runs under one label moved in turn goes back to its first card'
insert into public.collection_binders (owner_id, name, cover_id)
values (t.uid('P'), 'P chained', 'r17-a');
do $$ begin
  assert internal.remap_cover_card_ids('{"r17-a": "r17-b"}', 'r17') = '{"binder_covers": 1, "shelf_covers": 0}',
    'the first run missed P''s binder';
end $$;
do $$ begin
  assert internal.remap_cover_card_ids('{"r17-b": "r17-c"}', 'r17') = '{"binder_covers": 1, "shelf_covers": 0}',
    'the re-run missed P''s binder';
end $$;
do $$
declare restored int;
begin
  restored := internal.undo_card_id_remap('r17');
  assert t.cover('P chained') = 'r17-a', format('the undo put P''s cover back to %s, not its first card', t.cover('P chained'));
  assert restored = 1, format('the undo restored %s rows, not P''s binder', restored);
end $$;

\echo '== all remap checks passed'
