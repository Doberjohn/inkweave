-- Fix 1: Pin search_path on all functions
alter function internal.hash_client_ip() set search_path = '';
alter function internal.trimmed_mean(numeric[]) set search_path = '';
alter function public.submit_vote(text, text, smallint, boolean, smallint, boolean, text, smallint) set search_path = '';

-- Fix 2: Add SELECT policy so pair_scores view can use security_invoker
create policy "read_votes" on votes for select using (true);

-- Fix 3: Recreate view with security_invoker = true
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
  count(*) filter (where who_carries = 'a')    as carries_a,
  count(*) filter (where who_carries = 'b')    as carries_b,
  count(*) filter (where who_carries = 'both') as carries_both,
  avg(difficulty)::numeric(3,2)       as avg_difficulty

from votes
group by card_a_id, card_b_id;
