-- Fix 1: Grant anon SELECT on pair_scores view (required for PostgREST)
grant select on pair_scores to anon;

-- Fix 5: Add carries_neither to view (was silently dropping 'neither' votes)
drop view pair_scores;

create view pair_scores with (security_invoker = true) as
select
  card_a_id,
  card_b_id,
  count(*)         as total_votes,
  count(score)     as score_votes,
  count(accuracy)  as accuracy_votes,

  internal.trimmed_mean(
    array_agg(score::numeric) filter (where score is not null)
  )::numeric(4,2)  as avg_score,

  avg(accuracy)::numeric(3,2)         as accuracy_sentiment,
  avg(is_real::int)::numeric(3,2)     as pct_real,
  avg(would_play::int)::numeric(3,2)  as pct_would_play,
  count(*) filter (where who_carries = 'a')       as carries_a,
  count(*) filter (where who_carries = 'b')       as carries_b,
  count(*) filter (where who_carries = 'both')    as carries_both,
  count(*) filter (where who_carries = 'neither') as carries_neither,
  avg(difficulty)::numeric(3,2)       as avg_difficulty

from votes
group by card_a_id, card_b_id;

-- Re-grant after view recreate
grant select on pair_scores to anon;

-- Fix 7: Rename misleading 'daily_salt' to 'static_salt'
update internal.rate_limit_config set key = 'static_salt' where key = 'daily_salt';

-- Update hash function to use new key name
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
$$ language plpgsql security definer stable set search_path = '';
