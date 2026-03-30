create table votes (
  id            uuid default gen_random_uuid() primary key,
  card_a_id     text not null,
  card_b_id     text not null,
  ip_hash       text not null,

  accuracy      smallint check (accuracy in (-1, 0, 1)),
  is_real       boolean,
  score         smallint check (score between 1 and 10),
  would_play    boolean,
  who_carries   text check (who_carries in ('a', 'b', 'both', 'neither')),
  difficulty    smallint check (difficulty in (1, 2, 3)),

  created_at    timestamptz default now() not null,

  constraint pair_ordering check (card_a_id < card_b_id),
  constraint has_vote check (
    accuracy is not null or is_real is not null or score is not null
    or would_play is not null or who_carries is not null or difficulty is not null
  )
);

create unique index idx_votes_unique_pair_ip on votes (card_a_id, card_b_id, ip_hash);
create index idx_votes_pair on votes (card_a_id, card_b_id);
create index idx_votes_rate on votes (ip_hash, created_at);

alter table votes enable row level security;
