-- #1045 replay: Testing / Verification, Database (local replay), one check per block.
-- Every block is its own transaction; a failed ASSERT or a wrong SQLSTATE stops the run.
\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on

\echo '== setup: players A to F; each but E imports a collection'
select t.make_user(n) from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) n;

-- The statements the app sends, as PostgREST builds them from supabase-js's upserts:
-- every payload column goes in DO UPDATE SET, the conflict key included.
create function t.import_sql(who text, entries text) returns text language sql stable as $$
  select format(
    $q$insert into public.collections (owner_id, entries, imported_at, schema_version)
       values (%L, %L::jsonb, now(), 1)
       on conflict (owner_id) do update set entries = excluded.entries,
         imported_at = excluded.imported_at, owner_id = excluded.owner_id,
         schema_version = excluded.schema_version$q$,
    t.uid(who), entries)
$$;
create function t.sharing_sql(owner text, friends boolean) returns text language sql stable as $$
  select format(
    $q$insert into public.collection_sharing (owner_id, friends) values (%L, %L)
       on conflict (owner_id) do update set friends = excluded.friends,
         owner_id = excluded.owner_id$q$,
    t.uid(owner), friends)
$$;
-- What a player reads back of their own switch: true, false, or null for no row.
create function t.my_switch() returns boolean language sql stable as $$
  select s.friends from public.collection_sharing s where s.owner_id = (select auth.uid())
$$;
-- The ids a call returned, sorted, so a check compares whole answers.
create function t.ids(rows uuid[]) returns uuid[] language sql immutable as $$
  select coalesce(array_agg(x order by x), '{}') from unnest(rows) x
$$;
create function t.ids_of(variadic who text[]) returns uuid[] language sql stable as $$
  select t.ids(array(select t.uid(w) from unnest(who) w))
$$;
grant execute on all functions in schema t to anon, authenticated;

do $$
declare who text;
begin
  foreach who in array array['A', 'B', 'C', 'D', 'F'] loop
    perform t.act_as(who);
    execute t.import_sql(who, format('{"%s-1": {"normal": 1, "foil": 0}}', lower(who)));
  end loop;
  perform set_config('role', 'postgres', true);
end $$;

-- B asks A and A accepts; F asks B and B accepts, so B is the requester in one friendship
-- and the addressee in the other. D asks A, and A leaves it waiting.
begin;
select t.act_as('A');
select public.claim_friend_code();
commit;
begin;
select t.act_as('B');
select public.claim_friend_code();
select status from public.send_friend_request(t.code_of('A'));
commit;
begin;
select t.act_as('A');
select public.accept_friend_request(t.uid('B'));
commit;
begin;
select t.act_as('F');
select status from public.send_friend_request(t.code_of('B'));
commit;
begin;
select t.act_as('B');
select public.accept_friend_request(t.uid('F'));
commit;
begin;
select t.act_as('D');
select status from public.send_friend_request(t.code_of('A'));
commit;
do $$
declare n int;
begin
  select count(*) into n from public.friendships where status = 'accepted';
  assert n = 2, format('%s accepted friendships after setup', n);
  select count(*) into n from public.friendships where status = 'pending';
  assert n = 1, format('%s waiting requests after setup', n);
end $$;

\echo '== 1. anon reads no switch and calls neither function (42501)'
begin;
select t.act_as_anon();
do $$ begin
  perform t.expect_error('select 1 from public.collection_sharing', '42501');
  perform t.expect_error('select public.shared_friends()', '42501');
  perform t.expect_error('select * from public.friend_collections()', '42501');
  perform t.expect_error(format('select * from public.friend_collections(%L)', t.uid('A')), '42501');
  perform t.expect_error(format($q$insert into public.collection_sharing (owner_id, friends) values (%L, true)$q$, t.uid('A')), '42501');
end $$;
commit;

\echo '== 2. the app''s upsert turns the switch on and off; updated_at moves, created_at stays'
begin;
select t.act_as('A');
do $$ begin
  assert t.my_switch() is null, 'A has a switch row before setting it';
  execute t.sharing_sql('A', true);
  assert t.my_switch() = true, 'A reads the switch off after turning it on';
end $$;
commit;
select set_config('t.created', created_at::text, false), set_config('t.updated', updated_at::text, false)
  from public.collection_sharing where owner_id = t.uid('A');
select pg_sleep(0.01);
begin;
select t.act_as('A');
do $$ begin
  execute t.sharing_sql('A', false);
  assert t.my_switch() = false, 'A reads the switch on after turning it off';
end $$;
commit;
do $$
declare r record;
begin
  select * into r from public.collection_sharing where owner_id = t.uid('A');
  assert r.created_at = current_setting('t.created')::timestamptz, 'created_at moved';
  assert r.updated_at > current_setting('t.updated')::timestamptz, 'updated_at did not move';
end $$;

\echo '== 3. a player with no collection can''t turn it on (23503)'
begin;
select t.act_as('E');
do $$ begin
  perform t.expect_error(t.sharing_sql('E', true), '23503');
  perform t.expect_error(t.sharing_sql('E', false), '23503');
end $$;
commit;

\echo '== 4. nobody writes another player''s switch, and each reads only their own'
begin;
select t.act_as('B');
do $$
declare n int;
begin
  execute t.sharing_sql('B', false);
  perform t.expect_error(t.sharing_sql('A', true), '42501');
  perform t.expect_error(format($q$insert into public.collection_sharing (owner_id, friends) values (%L, true)$q$, t.uid('C')), '42501');
  -- B's own row, moved onto C, who has a collection and no switch row yet. With a WHERE
  -- on its columns the select policy checks the new row too; without one, only the update
  -- policy's WITH CHECK stands between B and C's switch.
  perform t.expect_error(format($q$update public.collection_sharing set owner_id = %L, friends = true where owner_id = %L$q$, t.uid('C'), t.uid('B')), '42501');
  perform t.expect_error(format($q$update public.collection_sharing set owner_id = %L, friends = true$q$, t.uid('C')), '42501');
  update public.collection_sharing set friends = true where owner_id = t.uid('A');
  get diagnostics n = row_count;
  assert n = 0, format('B changed %s of A''s switch rows', n);
  select count(*) into n from public.collection_sharing;
  assert n = 1, format('B reads %s switch rows', n);
  assert t.my_switch() = false, 'B lost their own row';
end $$;
commit;
do $$ begin
  assert (select friends from public.collection_sharing where owner_id = t.uid('A')) = false,
    'A''s switch changed under B';
end $$;

\echo '== 5. nobody writes created_at or updated_at, and nobody deletes a switch row (42501)'
begin;
select t.act_as('A');
do $$
declare n int;
begin
  perform t.expect_error($q$update public.collection_sharing set created_at = now() - interval '1 day'$q$, '42501');
  perform t.expect_error($q$update public.collection_sharing set updated_at = now() - interval '1 day'$q$, '42501');
  perform t.expect_error(format($q$insert into public.collection_sharing (owner_id, friends, updated_at) values (%L, true, now()) on conflict (owner_id) do nothing$q$, t.uid('A')), '42501');
  perform t.expect_error('delete from public.collection_sharing', '42501');
  perform t.expect_error('truncate public.collection_sharing', '42501');
  select count(*) into n from public.collection_sharing;
  assert n = 1, 'A''s switch row went';
end $$;
commit;

\echo '== 5b. the client roles hold exactly the privileges the app needs'
do $$
declare col text;
begin
  assert not has_table_privilege('anon', 'public.collection_sharing',
           'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
         'anon holds a privilege on collection_sharing';
  assert not has_any_column_privilege('anon', 'public.collection_sharing', 'SELECT, INSERT, UPDATE, REFERENCES'),
         'anon holds a column privilege on collection_sharing';
  assert has_table_privilege('authenticated', 'public.collection_sharing', 'SELECT'),
         'authenticated can''t read collection_sharing';
  assert not has_table_privilege('authenticated', 'public.collection_sharing',
           'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
         'authenticated holds a table-wide write on collection_sharing';
  foreach col in array array['owner_id', 'friends'] loop
    assert has_column_privilege('authenticated', 'public.collection_sharing', col, 'INSERT')
       and has_column_privilege('authenticated', 'public.collection_sharing', col, 'UPDATE'),
           format('authenticated can''t upsert %s', col);
  end loop;
  foreach col in array array['created_at', 'updated_at'] loop
    assert not has_column_privilege('authenticated', 'public.collection_sharing', col, 'INSERT')
       and not has_column_privilege('authenticated', 'public.collection_sharing', col, 'UPDATE'),
           format('authenticated can write %s', col);
  end loop;
  assert has_table_privilege('service_role', 'public.collection_sharing',
           'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
         'service_role lacks a privilege on collection_sharing';
end $$;

\echo '== 5c. both functions are security definer with an empty search_path; authenticated runs them, anon doesn''t'
do $$
declare f text; p record;
begin
  foreach f in array array['public.shared_friends()', 'public.friend_collections(uuid)'] loop
    select prosecdef, proconfig into p from pg_proc where oid = f::regprocedure;
    assert p.prosecdef, format('%s is not security definer', f);
    assert p.proconfig = array['search_path=""'], format('%s runs with %s', f, p.proconfig);
    assert has_function_privilege('authenticated', f, 'EXECUTE'), format('authenticated can''t run %s', f);
    assert not has_function_privilege('anon', f, 'EXECUTE'), format('anon can run %s', f);
  end loop;
end $$;

\echo '== 6. A shares and B is A''s friend: B sees A, and only owner_id, entries and schema_version'
begin;
select t.act_as('A');
do $$ begin execute t.sharing_sql('A', true); end $$;
commit;
begin;
select t.act_as('B');
do $$
declare got uuid[]; cols text[]; r record;
begin
  got := t.ids(array(select public.shared_friends()));
  assert got = t.ids_of('A'), format('B''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections()));
  assert got = t.ids_of('A'), format('B''s friend_collections(): %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
  assert got = t.ids_of('A'), format('B''s friend_collections(A): %s', got);
  select * into r from public.friend_collections(t.uid('A'));
  assert r.entries = '{"a-1": {"normal": 1, "foil": 0}}'::jsonb, format('A''s entries: %s', r.entries);
  assert r.schema_version = 1, format('A''s schema_version: %s', r.schema_version);
  select array_agg(k order by k) into cols
    from public.friend_collections(t.uid('A')) fc, jsonb_object_keys(to_jsonb(fc)) k;
  assert cols = array['entries', 'owner_id', 'schema_version'], format('columns: %s', cols);
end $$;
commit;

\echo '== 6b. B as the addressee: with F sharing too, the argument picks one friend'
begin;
select t.act_as('F');
do $$ begin execute t.sharing_sql('F', true); end $$;
commit;
begin;
select t.act_as('B');
do $$
declare got uuid[];
begin
  got := t.ids(array(select public.shared_friends()));
  assert got = t.ids_of('A', 'F'), format('B''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections()));
  assert got = t.ids_of('A', 'F'), format('B''s friend_collections(): %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('F'))));
  assert got = t.ids_of('F'), format('B''s friend_collections(F): %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('C'))));
  assert got = '{}', format('B''s friend_collections(C): %s', got);
end $$;
commit;

\echo '== 7. it goes one way: A gets nothing of B''s while B''s switch is off'
begin;
select t.act_as('A');
do $$
declare got uuid[];
begin
  got := t.ids(array(select public.shared_friends()));
  assert got = '{}', format('A''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections()));
  assert got = '{}', format('A''s friend_collections(): %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('B'))));
  assert got = '{}', format('A''s friend_collections(B): %s', got);
end $$;
commit;

\echo '== 8. C, no friend of A''s, gets nothing, nor does D, whose request to A waits'
do $$
declare who text; got uuid[];
begin
  foreach who in array array['C', 'D'] loop
    perform t.act_as(who);
    got := t.ids(array(select public.shared_friends()));
    assert got = '{}', format('%s''s sharing friends: %s', who, got);
    got := t.ids(array(select owner_id from public.friend_collections()));
    assert got = '{}', format('%s''s friend_collections(): %s', who, got);
    got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
    assert got = '{}', format('%s''s friend_collections(A): %s', who, got);
    perform set_config('role', 'postgres', true);
  end loop;
end $$;

\echo '== 8b. D turns the switch on: A, who left D''s request waiting, still gets nothing of D''s'
begin;
select t.act_as('D');
do $$ begin execute t.sharing_sql('D', true); end $$;
commit;
begin;
select t.act_as('A');
do $$
declare got uuid[];
begin
  got := t.ids(array(select public.shared_friends()));
  assert got = '{}', format('A''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections()));
  assert got = '{}', format('A''s friend_collections(): %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('D'))));
  assert got = '{}', format('A''s friend_collections(D): %s', got);
end $$;
commit;

\echo '== 9. A turns the switch off: B''s next calls return nothing of A''s'
begin;
select t.act_as('A');
do $$ begin execute t.sharing_sql('A', false); end $$;
commit;
begin;
select t.act_as('B');
do $$
declare got uuid[];
begin
  got := t.ids(array(select public.shared_friends()));
  assert got = t.ids_of('F'), format('B''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
  assert got = '{}', format('B''s friend_collections(A): %s', got);
end $$;
commit;

\echo '== 10. A clears their collection: the switch goes with it, and a new import starts with none'
begin;
select t.act_as('A');
do $$ begin execute t.sharing_sql('A', true); end $$;
delete from public.collections where owner_id = t.uid('A');
do $$ begin
  assert t.my_switch() is null, 'A''s switch outlived their collection';
end $$;
commit;
begin;
select t.act_as('A');
do $$ begin
  execute t.import_sql('A', '{"a-2": {"normal": 0, "foil": 2}}');
  assert t.my_switch() is null, 'a new import came with a switch row';
end $$;
commit;
begin;
select t.act_as('B');
do $$
declare got uuid[];
begin
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
  assert got = '{}', format('B''s friend_collections(A) after A cleared: %s', got);
end $$;
commit;

\echo '== 10b. re-importing keeps the switch as it was'
begin;
select t.act_as('A');
do $$ begin
  execute t.sharing_sql('A', true);
  execute t.import_sql('A', '{"a-3": {"normal": 3, "foil": 0}}');
  assert t.my_switch() = true, 'a re-import turned the switch off';
end $$;
commit;

\echo '== 11. B removes the friendship: B gets nothing of A''s, with A''s switch on'
begin;
select t.act_as('B');
do $$
declare got uuid[];
begin
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
  assert got = t.ids_of('A'), format('B''s friend_collections(A) before the removal: %s', got);
  delete from public.friendships where t.uid('A') in (requester_id, addressee_id);
  got := t.ids(array(select public.shared_friends()));
  assert got = t.ids_of('F'), format('B''s sharing friends: %s', got);
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('A'))));
  assert got = '{}', format('B''s friend_collections(A): %s', got);
end $$;
commit;

\echo '== 12. deleting an account removes its collection, its switch and its friendships'
begin;
select t.act_as('B');
do $$
declare got uuid[];
begin
  got := t.ids(array(select owner_id from public.friend_collections(t.uid('F'))));
  assert got = t.ids_of('F'), format('B''s friend_collections(F) before the deletion: %s', got);
end $$;
commit;
delete from auth.users where id = t.uid('F');
do $$
declare n int;
begin
  select count(*) into n from public.collections where owner_id = t.uid('F');
  assert n = 0, 'F''s collection outlived the account';
  select count(*) into n from public.collection_sharing where owner_id = t.uid('F');
  assert n = 0, 'F''s switch outlived the account';
  select count(*) into n from public.friendships where t.uid('F') in (requester_id, addressee_id);
  assert n = 0, 'F''s friendships outlived the account';
end $$;

\echo '== all sequential checks passed'
