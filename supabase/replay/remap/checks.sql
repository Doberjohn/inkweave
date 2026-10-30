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

\echo '== all remap checks passed'
