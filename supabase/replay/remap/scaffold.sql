-- What the remap migration needs beyond ../friends/scaffold.sql: public.votes, which
-- remap_card_ids and undo_card_id_remap lock and look up. No check stores a vote, but R11 to
-- R13 run remap_card_ids whole, so the table has the columns remap_vote_card_ids reads, from
-- 20260330000001_votes_table.sql without its constraints.
create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  card_a_id   text not null,
  card_b_id   text not null,
  ip_hash     text not null,
  accuracy    smallint,
  is_real     boolean,
  score       smallint,
  would_play  boolean,
  who_carries text,
  difficulty  smallint,
  created_at  timestamptz not null default now()
);
