-- Test-only helpers for the #852 replay: named users, and acting as one the way
-- PostgREST does (transaction-local JWT claims, then the role).
create schema t;
grant usage on schema t to anon, authenticated;

create table t.users (name text primary key, id uuid not null);
grant select on t.users to anon, authenticated;

create function t.uid(who text) returns uuid language sql stable as $$
  select id from t.users where name = who
$$;

create function t.make_user(who text) returns uuid language plpgsql as $$
declare new_id uuid;
begin
  insert into auth.users default values returning id into new_id;
  insert into t.users values (who, new_id);
  return new_id;
end $$;

create function t.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', t.uid(who), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function t.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- A player's code, as a friend who was handed it would type it. Security definer
-- because the code table is owner-only; plpgsql so it compiles before the table exists.
create function t.code_of(who text) returns text language plpgsql stable security definer
set search_path = '' as $$
begin
  return (select f.code from public.friend_codes f where f.owner_id = t.uid(who));
end $$;

-- Run a statement as the current role and insist it fails with one SQLSTATE. The
-- "it succeeded" raise sits outside the handler: RAISE defaults to P0001, so inside it
-- a success would pass as the expected failure whenever the expected state is P0001.
create function t.expect_error(stmt text, state text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate <> state then
      raise exception 'expected SQLSTATE %, got % (%) from: %', state, sqlstate, sqlerrm, stmt;
    end if;
    return;
  end;
  raise exception 'expected SQLSTATE %, but it succeeded: %', state, stmt;
end $$;
