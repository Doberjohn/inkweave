-- Harden the community-votes data layer (2026-09-25).
--
-- 1. Column-level read access on public.votes.
--    anon and authenticated held Supabase's default full table grants
--    (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER), and the
--    read_votes policy is `using (true)`, so the public anon key could read
--    every raw vote row, ip_hash included. Nothing in the app needs that:
--    writes go through submit_vote() (SECURITY DEFINER, owned by postgres),
--    and reads go through the security_invoker pair_scores view, which only
--    touches the eight columns granted below. id, ip_hash and created_at stop
--    being readable, and direct writes lose their grants (RLS already blocked
--    them). service_role is unaffected (the admin vote analytics use it).
--
-- 2. IPv6-safe client-IP parsing in internal.hash_client_ip().
--    The old port strip, split_part(ip, ':', 1), cut an IPv6 address down to
--    its first hextet (and an IPv4-mapped address to an empty string), so
--    every such voter sharing it collapsed into one ip_hash: one rate limit,
--    counted as one voter, overwriting each other's votes on the same pair.
--    IPv4 addresses hash exactly as before, so existing IPv4 voters keep their
--    identity. IPv6 voters get distinct hashes from now on; history that was
--    merged cannot be split retroactively.
--
-- 3. A client IP that cannot be forged.
--    The function trusted the FIRST x-forwarded-for entry, which is whatever
--    the client sends: a request carrying a fake X-Forwarded-For got a fresh
--    identity, bypassing the rate limit and the one-vote-per-pair rule.
--    Probed live on 2026-09-25: a forged header arrived as the first entry,
--    while cf-connecting-ip (set by Cloudflare; a client-sent one is rejected
--    at the edge) and the LAST x-forwarded-for entry held the real address.
--    The IP now comes from cf-connecting-ip, then the last x-forwarded-for
--    entry. For an honest client all three agree, so its hash is unchanged.

revoke all on table public.votes from anon, authenticated;

grant select (card_a_id, card_b_id, score, accuracy, is_real, would_play, difficulty, who_carries)
  on table public.votes to anon, authenticated;

create or replace function internal.hash_client_ip()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  headers json;
  xff_parts text[];
  client_ip text;
  salt text;
begin
  headers := coalesce(current_setting('request.headers', true), '{}')::json;
  xff_parts := string_to_array(headers->>'x-forwarded-for', ',');
  -- cf-connecting-ip cannot be forged; the LAST x-forwarded-for entry is the
  -- one the edge appended (the first is client-controlled).
  client_ip := coalesce(
    headers->>'cf-connecting-ip',
    xff_parts[array_length(xff_parts, 1)],
    'unknown'
  );
  client_ip := lower(btrim(client_ip));

  if client_ip ~ '^\[[0-9a-f:.]+\](:[0-9]+)?$' then
    -- Bracketed IPv6 with an optional port, e.g. [2001:db8::1]:443
    client_ip := substring(client_ip from '^\[([0-9a-f:.]+)\]');
  elsif client_ip ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+$' then
    -- IPv4 with a port, e.g. 203.0.113.7:51234
    client_ip := split_part(client_ip, ':', 1);
  end if;
  -- Anything else (bare IPv4, bare IPv6, 'unknown') is hashed as-is.

  select value into salt from internal.rate_limit_config where key = 'static_salt';
  return encode(extensions.digest(client_ip || salt, 'sha256'), 'hex');
end;
$function$;
