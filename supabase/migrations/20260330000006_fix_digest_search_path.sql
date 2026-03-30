-- Fix: Fully qualify digest() from pgcrypto (installed in extensions schema)
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
  return encode(extensions.digest(client_ip || salt, 'sha256'), 'hex');
end;
$$ language plpgsql security definer stable set search_path = '';
