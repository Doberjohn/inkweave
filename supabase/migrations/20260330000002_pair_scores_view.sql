create view pair_scores as
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
