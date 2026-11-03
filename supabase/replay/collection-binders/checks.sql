-- #1074 replay: Testing / Verification, Database (local replay), one check per block.
-- Every block is its own transaction; a failed ASSERT or a wrong SQLSTATE stops the run.
\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on

\echo '== setup: players A, B and E; A and B import a collection, E doesn''t'
select t.make_user(n) from unnest(array['A', 'B', 'E']) n;

-- The statements the app sends, as PostgREST builds them from supabase-js's calls. An upsert
-- puts every payload column in DO UPDATE SET, the conflict key included.
create function t.import_sql(who text, entries text) returns text language sql stable as $$
  select format(
    $q$insert into public.collections (owner_id, entries, imported_at, schema_version)
       values (%L, %L::jsonb, now(), 1)
       on conflict (owner_id) do update set entries = excluded.entries,
         imported_at = excluded.imported_at, owner_id = excluded.owner_id,
         schema_version = excluded.schema_version$q$,
    t.uid(who), entries)
$$;
create function t.add_sql(who text, label text, scope text default 'all', rules text default '',
                          cover text default null) returns text language sql stable as $$
  select format(
    $q$insert into public.collection_binders (owner_id, name, scope, rules, cover_id)
       values (%L, %L, %L, %L, %L) returning *$q$,
    t.uid(who), label, scope, rules, cover)
$$;
create function t.shelf_sql(who text, cover text) returns text language sql stable as $$
  select format(
    $q$insert into public.collection_shelf (owner_id, cover_id) values (%L, %L)
       on conflict ("owner_id") do update set "cover_id" = excluded."cover_id",
         "owner_id" = excluded."owner_id"$q$,
    t.uid(who), cover)
$$;

-- Read past RLS, so a check acting as one player can name another's rows. PL/pgSQL, so they
-- compile before the tables exist and a run without the migration stops at check 1.
create function t.binder_at(who text, slot integer) returns uuid language plpgsql stable
security definer set search_path = '' as $$
begin
  return (select b.id from public.collection_binders b
           where b.owner_id = t.uid(who) and b.place = slot);
end $$;
create function t.place_of(binder uuid) returns integer language plpgsql stable
security definer set search_path = '' as $$
begin
  return (select b.place from public.collection_binders b where b.id = binder);
end $$;
create function t.places(who text) returns integer[] language plpgsql stable
security definer set search_path = '' as $$
begin
  return (select coalesce(array_agg(b.place order by b.place), '{}')
            from public.collection_binders b where b.owner_id = t.uid(who));
end $$;
create function t.shelf_rows(who text) returns integer language plpgsql stable
security definer set search_path = '' as $$
begin
  return (select count(*) from public.collection_shelf s where s.owner_id = t.uid(who));
end $$;

-- A check violation from one named constraint. The 30-binder cap raises its own, under no
-- constraint name (''), so a check can't pass on the cap when it means a constraint.
create function t.expect_check(stmt text, want text) returns void language plpgsql as $$
declare
  got_state text;
  got_constraint text;
  got_message text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics got_state = returned_sqlstate, got_constraint = constraint_name,
                            got_message = message_text;
    if got_state <> '23514' or got_constraint <> want then
      raise exception 'expected 23514 on "%", got % on "%" (%) from: %',
        want, got_state, got_constraint, got_message, stmt;
    end if;
    return;
  end;
  raise exception 'expected 23514 on "%", but it succeeded: %', want, stmt;
end $$;
-- The races' barrier: wait, up to 10 s, until another session on this database names itself
-- `who`, as the first file of each race does once its open transaction holds what the race is
-- about. The snapshot is cleared each time round, or pg_stat_activity would keep its first answer.
create function t.wait_for(who text) returns void language plpgsql as $$
declare
  deadline timestamptz := clock_timestamp() + interval '10 seconds';
begin
  while clock_timestamp() < deadline loop
    perform pg_stat_clear_snapshot();
    if exists (select 1 from pg_stat_activity a
                where a.datname = current_database() and a.application_name = who) then
      return;
    end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'no session named % within 10 s', who;
end $$;
grant execute on all functions in schema t to anon, authenticated;

do $$
declare who text;
begin
  foreach who in array array['A', 'B'] loop
    perform t.act_as(who);
    execute t.import_sql(who, format('{"%s-1": {"normal": 1, "foil": 0}}', lower(who)));
  end loop;
  perform set_config('role', 'postgres', true);
end $$;

\echo '== 1. anon reads neither table and can''t call move_binder (42501)'
begin;
select t.act_as_anon();
do $$ begin
  perform t.expect_error('select 1 from public.collection_binders', '42501');
  perform t.expect_error('select 1 from public.collection_shelf', '42501');
  perform t.expect_error(format('select public.move_binder(%L, true)', gen_random_uuid()), '42501');
  perform t.expect_error(t.add_sql('A', 'Not mine'), '42501');
  perform t.expect_error(t.shelf_sql('A', 'card-1'), '42501');
end $$;
commit;

\echo '== 2. A adds three binders: places 0, 1 and 2, with id and timestamps from the server'
begin;
select t.act_as('A');
do $$
declare
  r record;
begin
  for i in 0..1 loop
    execute t.add_sql('A', format('Binder %s', i + 1)) into r;
    assert r.place = i, format('binder %s landed at place %s', i + 1, r.place);
    assert r.scope = 'all' and r.rules = '' and r.cover_id is null,
      format('binder %s read back as %s', i + 1, row_to_json(r));
  end loop;
  execute t.add_sql('A', 'Binder 3', '12', 'ink=amber&rarity=rare', 'card-12') into r;
  assert r.place = 2, format('binder 3 landed at place %s', r.place);
  assert r.owner_id = t.uid('A') and r.name = 'Binder 3' and r.scope = '12'
     and r.rules = 'ink=amber&rarity=rare' and r.cover_id = 'card-12',
    format('binder 3 read back as %s', row_to_json(r));
  assert r.id is not null and r.created_at is not null and r.updated_at is not null,
    format('the server filled no id or timestamps: %s', row_to_json(r));
  assert t.places('A') = '{0,1,2}', format('A''s places: %s', t.places('A'));
end $$;
commit;

\echo '== 3. E, who holds no collection, can''t add a binder (23503)'
begin;
select t.act_as('E');
do $$ begin
  perform t.expect_error(t.add_sql('E', 'Mine'), '23503');
end $$;
commit;

\echo '== 4. B reads none of A''s binders and can''t add, change or delete one; B''s own shelf starts at 0'
begin;
select t.act_as('B');
do $$
declare
  a uuid := t.binder_at('A', 0);
  n int;
  r record;
begin
  select count(*) into n from public.collection_binders;
  assert n = 0, format('B reads %s binders', n);
  perform t.expect_error(t.add_sql('A', 'Not yours'), '42501');
  update public.collection_binders set name = 'Mine now' where id = a;
  get diagnostics n = row_count;
  assert n = 0, format('B renamed %s of A''s binders', n);
  update public.collection_binders set name = 'Mine now';
  get diagnostics n = row_count;
  assert n = 0, format('B''s unfiltered rename reached %s binders', n);
  delete from public.collection_binders where id = a;
  get diagnostics n = row_count;
  assert n = 0, format('B deleted %s of A''s binders', n);
  execute t.add_sql('B', 'B''s first') into r;
  assert r.place = 0, format('B''s first binder landed at place %s', r.place);
  select count(*) into n from public.collection_binders;
  assert n = 1, format('B reads %s binders after adding one', n);
end $$;
commit;
do $$ begin
  assert t.places('A') = '{0,1,2}', format('A''s places after B: %s', t.places('A'));
  assert (select name from public.collection_binders where id = t.binder_at('A', 0)) = 'Binder 1',
    'A''s binder changed under B';
end $$;

\echo '== 5. id, place and the timestamps are the server''s; owner_id never changes (42501)'
begin;
select t.act_as('A');
do $$
declare
  a uuid := t.binder_at('A', 0);
  col text;
  val text;
  n int;
begin
  foreach col in array array['id', 'place', 'created_at', 'updated_at'] loop
    val := case col when 'id' then 'gen_random_uuid()' when 'place' then '7' else 'now()' end;
    perform t.expect_error(format(
      $q$insert into public.collection_binders (owner_id, name, %I) values (%L, 'Mine', %s)$q$,
      col, t.uid('A'), val), '42501');
  end loop;
  perform t.expect_error(format($q$update public.collection_binders set owner_id = %L where id = %L$q$,
    t.uid('B'), a), '42501');
  perform t.expect_error(format($q$update public.collection_binders set owner_id = owner_id where id = %L$q$,
    a), '42501');
  perform t.expect_error(format($q$update public.collection_binders set place = 7 where id = %L$q$, a), '42501');
  perform t.expect_error(format($q$update public.collection_binders set place = place where id = %L$q$, a), '42501');
  perform t.expect_error(format($q$update public.collection_binders set created_at = now() - interval '1 day' where id = %L$q$,
    a), '42501');
  perform t.expect_error(format($q$update public.collection_binders set updated_at = now() - interval '1 day' where id = %L$q$,
    a), '42501');
  perform t.expect_error('truncate public.collection_binders', '42501');
  -- The four a client does change.
  update public.collection_binders
     set name = 'Renamed', scope = 'promos', rules = 'ink=steel', cover_id = 'card-2'
   where id = a;
  get diagnostics n = row_count;
  assert n = 1, format('A''s rename changed %s rows', n);
end $$;
commit;
do $$
declare r record;
begin
  select * into r from public.collection_binders where id = t.binder_at('A', 0);
  assert r.name = 'Renamed' and r.scope = 'promos' and r.rules = 'ink=steel' and r.cover_id = 'card-2',
    format('A''s change read back as %s', row_to_json(r));
  assert t.places('A') = '{0,1,2}', format('A''s places after check 5: %s', t.places('A'));
end $$;

\echo '== 5b. the client roles hold exactly the privileges the app needs'
do $$
declare
  tbl text;
  col text;
begin
  foreach tbl in array array['public.collection_binders', 'public.collection_shelf'] loop
    assert not has_table_privilege('anon', tbl,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
           format('anon holds a privilege on %s', tbl);
    assert not has_any_column_privilege('anon', tbl, 'SELECT, INSERT, UPDATE, REFERENCES'),
           format('anon holds a column privilege on %s', tbl);
    assert has_table_privilege('authenticated', tbl, 'SELECT'),
           format('authenticated can''t read %s', tbl);
    assert not has_table_privilege('authenticated', tbl, 'INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
           format('authenticated holds a table-wide write on %s', tbl);
    assert has_table_privilege('service_role', tbl,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'),
           format('service_role lacks a privilege on %s', tbl);
  end loop;
  assert has_table_privilege('authenticated', 'public.collection_binders', 'DELETE'),
         'authenticated can''t delete a binder';
  assert not has_table_privilege('authenticated', 'public.collection_shelf', 'DELETE'),
         'authenticated can delete the shelf row';
  foreach col in array array['owner_id', 'name', 'scope', 'rules', 'cover_id'] loop
    assert has_column_privilege('authenticated', 'public.collection_binders', col, 'INSERT'),
           format('authenticated can''t insert a binder''s %s', col);
  end loop;
  foreach col in array array['name', 'scope', 'rules', 'cover_id'] loop
    assert has_column_privilege('authenticated', 'public.collection_binders', col, 'UPDATE'),
           format('authenticated can''t change a binder''s %s', col);
  end loop;
  foreach col in array array['id', 'place', 'created_at', 'updated_at'] loop
    assert not has_column_privilege('authenticated', 'public.collection_binders', col, 'INSERT'),
           format('authenticated can insert a binder''s %s', col);
  end loop;
  foreach col in array array['id', 'owner_id', 'place', 'created_at', 'updated_at'] loop
    assert not has_column_privilege('authenticated', 'public.collection_binders', col, 'UPDATE'),
           format('authenticated can change a binder''s %s', col);
  end loop;
  foreach col in array array['owner_id', 'cover_id'] loop
    assert has_column_privilege('authenticated', 'public.collection_shelf', col, 'INSERT')
       and has_column_privilege('authenticated', 'public.collection_shelf', col, 'UPDATE'),
           format('authenticated can''t upsert the shelf''s %s', col);
  end loop;
  foreach col in array array['created_at', 'updated_at'] loop
    assert not has_column_privilege('authenticated', 'public.collection_shelf', col, 'INSERT')
       and not has_column_privilege('authenticated', 'public.collection_shelf', col, 'UPDATE'),
           format('authenticated can write the shelf''s %s', col);
  end loop;
end $$;

\echo '== 5c. move_binder is security definer with an empty search_path; of the client roles, only authenticated runs it, and neither runs the trigger function'
do $$
declare p record;
begin
  select prosecdef, proconfig, pg_get_userbyid(proowner) as owner into p
    from pg_proc where oid = 'public.move_binder(uuid, boolean)'::regprocedure;
  assert p.prosecdef, 'move_binder is not security definer';
  assert p.proconfig = array['search_path=""'], format('move_binder runs with %s', p.proconfig);
  assert p.owner = 'postgres', format('move_binder is owned by %s', p.owner);
  assert has_function_privilege('authenticated', 'public.move_binder(uuid, boolean)', 'EXECUTE'),
         'authenticated can''t run move_binder';
  assert not has_function_privilege('anon', 'public.move_binder(uuid, boolean)', 'EXECUTE'),
         'anon can run move_binder';
  assert not has_function_privilege('anon', 'public.collection_binders_before_insert()', 'EXECUTE')
     and not has_function_privilege('authenticated', 'public.collection_binders_before_insert()', 'EXECUTE'),
         'a client role can run the trigger function';
end $$;

\echo '== 6. names, scopes, rules and covers hold their shapes (23514)'
begin;
select t.act_as('A');
do $$
declare
  s text;
  n int := cardinality(t.places('A'));
begin
  perform t.expect_check(t.add_sql('A', ''), 'collection_binders_name');
  perform t.expect_check(t.add_sql('A', repeat('x', 31)), 'collection_binders_name');
  perform t.expect_check(t.add_sql('A', ' Leading space'), 'collection_binders_name');
  perform t.expect_check(t.add_sql('A', 'Trailing space '), 'collection_binders_name');
  perform t.expect_check(t.add_sql('A', E'Tab\there'), 'collection_binders_name');
  perform t.expect_check(t.add_sql('A', E'Line\nbreak'), 'collection_binders_name');
  -- No end blank, whatever the space or zero-width character, and no line break or control
  -- character anywhere, past ASCII too.
  foreach s in array array[
    E'\u00a0', E'\u3000', E'\u200b', E'\u00a0Name', E'Name\u00a0', E'\u1680Name', E'\u2002Name',
    E'Name\u202f', E'Name\u205f', E'Name\u200d', E'\u2060Name', E'\ufeffName',
    E'Del\u007fete', E'Next\u0085line', E'Line\u2028separator', E'Paragraph\u2029separator'] loop
    perform t.expect_check(t.add_sql('A', s), 'collection_binders_name');
  end loop;
  execute t.add_sql('A', repeat('x', 30));
  execute t.add_sql('A', repeat('ü', 30));
  -- Inside a name, spaces and joiners are the player's: a no-break space, two spaces, the
  -- joiner in a family emoji, and a heart's variation selector at the end.
  foreach s in array array[E'Red\u00a0Panda', 'Two  spaces', E'Family \U0001F468\u200d\U0001F469',
                           E'Love \u2764\ufe0f'] loop
    execute t.add_sql('A', s);
  end loop;
  foreach s in array array['all', 'promos', '12', 'P1', 'D23'] loop
    execute t.add_sql('A', 'Scope ' || s, s);
  end loop;
  perform t.expect_check(t.add_sql('A', 'Set scope', 'Set 12'), 'collection_binders_scope');
  perform t.expect_check(t.add_sql('A', 'Empty scope', ''), 'collection_binders_scope');
  execute t.add_sql('A', 'Rules at the cap', 'all', repeat('a', 1000));
  perform t.expect_check(t.add_sql('A', 'Rules past the cap', 'all', repeat('a', 1001)), 'collection_binders_rules');
  perform t.expect_check(t.add_sql('A', 'Spaced cover', 'all', '', 'card 1'), 'collection_binders_cover');
  perform t.expect_check(t.add_sql('A', 'Empty cover', 'all', '', ''), 'collection_binders_cover');
  -- A change can't get past them either.
  perform t.expect_check(format($q$update public.collection_binders set name = '' where id = %L$q$,
    t.binder_at('A', 0)), 'collection_binders_name');
  perform t.expect_check(format($q$update public.collection_binders set name = %L where id = %L$q$,
    E'Name\u00a0', t.binder_at('A', 0)), 'collection_binders_name');
  perform t.expect_check(format($q$update public.collection_binders set cover_id = 'a b' where id = %L$q$,
    t.binder_at('A', 0)), 'collection_binders_cover');
  assert cardinality(t.places('A')) = n + 12,
    format('A holds %s binders after check 6, not %s', cardinality(t.places('A')), n + 12);
end $$;
commit;

\echo '== 7. A''s 30th binder lands and the 31st gets 23514, alone or in one insert of many'
begin;
select t.act_as('A');
do $$
declare n int;
begin
  select count(*) into n from public.collection_binders;
  -- One insert of many rows, as PostgREST sends an array, stops at the cap and lands none.
  perform t.expect_check(format(
    $q$insert into public.collection_binders (owner_id, name)
       select %L, 'Bulk ' || g from generate_series(1, %s) g returning *$q$,
    t.uid('A'), 31 - n), '');
  assert (select count(*) from public.collection_binders) = n, 'part of the bulk insert landed';
  while n < 29 loop
    execute t.add_sql('A', format('Filler %s', n));
    n := n + 1;
  end loop;
  execute t.add_sql('A', 'Thirtieth');
  perform t.expect_check(t.add_sql('A', 'Thirty-first'), '');
  select count(*) into n from public.collection_binders;
  assert n = 30, format('A holds %s binders', n);
end $$;
commit;
do $$ begin
  assert t.places('A') = array(select generate_series(0, 29)), format('A''s places: %s', t.places('A'));
end $$;

\echo '== 8. move_binder swaps neighbours, stops at either end, steps over a gap, moves only the caller''s and takes no null'
select set_config('t.b0', t.binder_at('A', 0)::text, false),
       set_config('t.b1', t.binder_at('A', 1)::text, false);
select set_config('t.u0', (select updated_at from public.collection_binders where id = current_setting('t.b0')::uuid)::text, false),
       set_config('t.u1', (select updated_at from public.collection_binders where id = current_setting('t.b1')::uuid)::text, false);
select pg_sleep(0.01);
begin;
select t.act_as('A');
do $$
declare
  b0 uuid := current_setting('t.b0')::uuid;
  b1 uuid := current_setting('t.b1')::uuid;
begin
  assert public.move_binder(b0, false), 'later on the first binder didn''t move it';
  assert t.place_of(b0) = 1 and t.place_of(b1) = 0,
    format('after the swap: first at %s, second at %s', t.place_of(b0), t.place_of(b1));
  assert not public.move_binder(b1, true), 'earlier on the first binder moved it';
  assert not public.move_binder(t.binder_at('A', 29), false), 'later on the last binder moved it';
  assert t.places('A') = array(select generate_series(0, 29)), format('A''s places: %s', t.places('A'));
end $$;
commit;
do $$
declare
  b0 uuid := current_setting('t.b0')::uuid;
  b1 uuid := current_setting('t.b1')::uuid;
begin
  assert (select updated_at from public.collection_binders where id = b0) > current_setting('t.u0')::timestamptz,
    'the first binder''s updated_at didn''t move';
  assert (select updated_at from public.collection_binders where id = b1) > current_setting('t.u1')::timestamptz,
    'the second binder''s updated_at didn''t move';
end $$;
begin;
select t.act_as('A');
do $$
declare
  b4 uuid := t.binder_at('A', 4);
  b6 uuid := t.binder_at('A', 6);
  n int;
begin
  delete from public.collection_binders where id = t.binder_at('A', 5);
  get diagnostics n = row_count;
  assert n = 1, format('A''s delete took %s rows', n);
  assert public.move_binder(b4, false), 'later across the gap didn''t move it';
  assert t.place_of(b4) = 6 and t.place_of(b6) = 4,
    format('later across the gap: moved one at %s, its neighbour at %s', t.place_of(b4), t.place_of(b6));
  assert public.move_binder(b4, true), 'earlier across the gap didn''t move it';
  assert t.place_of(b4) = 4 and t.place_of(b6) = 6,
    format('earlier across the gap: moved one at %s, its neighbour at %s', t.place_of(b4), t.place_of(b6));
end $$;
commit;
begin;
select t.act_as('B');
do $$ begin
  perform t.expect_error(format('select public.move_binder(%L, true)', t.binder_at('A', 1)), 'P0002');
  perform t.expect_error(format('select public.move_binder(%L, false)', t.binder_at('A', 1)), 'P0002');
  perform t.expect_error(format('select public.move_binder(%L, true)', gen_random_uuid()), 'P0002');
  perform t.expect_error('select public.move_binder(null, true)', 'P0002');
end $$;
commit;
begin;
select t.act_as('A');
do $$ begin
  perform t.expect_error(format('select public.move_binder(%L, null)', t.binder_at('A', 1)), '22004');
end $$;
commit;
do $$ begin
  assert t.place_of(current_setting('t.b0')::uuid) = 1, 'B''s call moved A''s binder';
  assert t.places('B') = '{0}', format('B''s places: %s', t.places('B'));
end $$;

\echo '== 9. a deleted binder leaves its place empty; the next one goes past the highest'
begin;
select t.act_as('A');
do $$
declare
  r record;
  n int;
begin
  delete from public.collection_binders where id = t.binder_at('A', 10);
  get diagnostics n = row_count;
  assert n = 1, format('A''s delete took %s rows', n);
  execute t.add_sql('A', 'After the gaps') into r;
  assert r.place = 30, format('the new binder landed at place %s', r.place);
  select count(*) into n from public.collection_binders;
  assert n = 29, format('A holds %s binders', n);
end $$;
commit;

\echo '== 10. My collection''s cover: the owner''s upsert sets and changes it; nobody else''s does'
begin;
select t.act_as('B');
do $$ begin
  -- Before A has a row, B's upsert is a plain insert onto A's shelf.
  perform t.expect_error(t.shelf_sql('A', 'card-9'), '42501');
end $$;
commit;
do $$ begin
  assert t.shelf_rows('A') = 0, 'B''s upsert made A a shelf row';
end $$;
begin;
select t.act_as('A');
do $$
declare n int;
begin
  select count(*) into n from public.collection_shelf;
  assert n = 0, format('A reads %s shelf rows before setting a cover', n);
  execute t.shelf_sql('A', 'card-1');
  assert (select cover_id from public.collection_shelf where owner_id = t.uid('A')) = 'card-1',
    'A''s cover didn''t land';
end $$;
commit;
select set_config('t.created', created_at::text, false), set_config('t.updated', updated_at::text, false)
  from public.collection_shelf where owner_id = t.uid('A');
select pg_sleep(0.01);
begin;
select t.act_as('A');
do $$ begin
  execute t.shelf_sql('A', 'card-2');
  assert (select cover_id from public.collection_shelf where owner_id = t.uid('A')) = 'card-2',
    'A''s cover didn''t change';
  perform t.expect_check(t.shelf_sql('A', 'card 3'), 'collection_shelf_cover');
  perform t.expect_error(format($q$update public.collection_shelf set created_at = now() where owner_id = %L$q$,
    t.uid('A')), '42501');
  perform t.expect_error(format($q$update public.collection_shelf set updated_at = now() where owner_id = %L$q$,
    t.uid('A')), '42501');
  perform t.expect_error('delete from public.collection_shelf', '42501');
  perform t.expect_error('truncate public.collection_shelf', '42501');
end $$;
commit;
do $$
declare r record;
begin
  select * into r from public.collection_shelf where owner_id = t.uid('A');
  assert r.created_at = current_setting('t.created')::timestamptz, 'the shelf row''s created_at moved';
  assert r.updated_at > current_setting('t.updated')::timestamptz, 'the shelf row''s updated_at didn''t move';
end $$;
begin;
select t.act_as('B');
do $$
declare n int;
begin
  select count(*) into n from public.collection_shelf;
  assert n = 0, format('B reads %s shelf rows', n);
  perform t.expect_error(t.shelf_sql('A', 'card-9'), '42501');
  update public.collection_shelf set cover_id = 'card-9' where owner_id = t.uid('A');
  get diagnostics n = row_count;
  assert n = 0, format('B changed %s of A''s shelf rows', n);
end $$;
commit;
begin;
select t.act_as('E');
do $$ begin
  perform t.expect_error(t.shelf_sql('E', 'card-1'), '23503');
end $$;
commit;
do $$ begin
  assert (select cover_id from public.collection_shelf where owner_id = t.uid('A')) = 'card-2',
    'A''s cover changed under B';
  assert t.shelf_rows('B') = 0 and t.shelf_rows('E') = 0, 'B or E holds a shelf row';
end $$;
begin;
select t.act_as('A');
do $$ begin
  execute t.shelf_sql('A', null);
  assert (select cover_id from public.collection_shelf where owner_id = t.uid('A')) is null,
    'a null didn''t clear A''s cover';
end $$;
commit;

\echo '== 11. clearing the collection deletes its binders and shelf row; a re-import keeps them'
begin;
select t.act_as('A');
do $$
declare n int;
begin
  execute t.shelf_sql('A', 'card-4');
  delete from public.collections where owner_id = t.uid('A');
  select count(*) into n from public.collection_binders;
  assert n = 0, format('%s of A''s binders outlived the collection', n);
  select count(*) into n from public.collection_shelf;
  assert n = 0, 'A''s shelf row outlived the collection';
end $$;
commit;
begin;
select t.act_as('A');
do $$
declare n int;
begin
  execute t.import_sql('A', '{"a-2": {"normal": 0, "foil": 2}}');
  select count(*) into n from public.collection_binders;
  assert n = 0, format('a new collection came with %s binders', n);
  select count(*) into n from public.collection_shelf;
  assert n = 0, 'a new collection came with a shelf row';
end $$;
commit;
begin;
select t.act_as('A');
do $$
declare r record;
begin
  execute t.add_sql('A', 'Kept') into r;
  assert r.place = 0, format('the first binder of a new collection landed at place %s', r.place);
  execute t.shelf_sql('A', 'card-5');
  execute t.import_sql('A', '{"a-3": {"normal": 3, "foil": 0}}');
  assert t.places('A') = '{0}', format('a re-import left places %s', t.places('A'));
  assert (select cover_id from public.collection_shelf) = 'card-5', 'a re-import dropped the cover';
end $$;
commit;

\echo '== 12. deleting an account removes its collection, its binders and its shelf row'
delete from auth.users where id = t.uid('A');
do $$
declare n int;
begin
  select count(*) into n from public.collections where owner_id = t.uid('A');
  assert n = 0, 'A''s collection outlived the account';
  assert t.places('A') = '{}', format('A''s binders outlived the account: %s', t.places('A'));
  assert t.shelf_rows('A') = 0, 'A''s shelf row outlived the account';
  assert t.places('B') = '{0}', format('B''s binders went with A: %s', t.places('B'));
end $$;

\echo '== all sequential checks passed'
