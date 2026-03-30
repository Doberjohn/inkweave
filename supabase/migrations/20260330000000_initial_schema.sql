-- Internal schema (hidden from PostgREST API)
create schema internal;
revoke all on schema internal from anon, authenticated;

-- pgcrypto for IP hashing
create extension if not exists pgcrypto;

-- Static salt for IP hashing (v1.0)
create table internal.rate_limit_config (
  key   text primary key,
  value text not null
);
insert into internal.rate_limit_config (key, value)
values ('static_salt', encode(gen_random_bytes(32), 'hex'));

-- Non-reversible IP hash function
create or replace function internal.hash_client_ip()
returns text as $$
declare
  client_ip text;
  salt text;
begin
  client_ip := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );
  client_ip := split_part(split_part(client_ip, ',', 1), ':', 1);
  select value into salt from internal.rate_limit_config where key = 'static_salt';
  return encode(digest(client_ip || salt, 'sha256'), 'hex');
end;
$$ language plpgsql security definer stable;

-- Trimmed mean helper (drop top/bottom 10%)
create or replace function internal.trimmed_mean(arr numeric[])
returns numeric as $$
declare
  n int := array_length(arr, 1);
  trim_count int;
  sorted numeric[];
begin
  if n is null or n = 0 then return null; end if;
  if n < 3 then return (select avg(x) from unnest(arr) x); end if;
  trim_count := floor(n * 0.1);
  sorted := (select array_agg(x order by x) from unnest(arr) x);
  return (select avg(x) from unnest(sorted[trim_count + 1 : n - trim_count]) x);
end;
$$ language plpgsql immutable;
