-- Fix: Fully qualify all table references when search_path = ''
create or replace function public.submit_vote(
  p_card_a text, p_card_b text,
  p_accuracy smallint default null,
  p_is_real boolean default null,
  p_score smallint default null,
  p_would_play boolean default null,
  p_who_carries text default null,
  p_difficulty smallint default null
) returns void as $$
declare
  v_card_a text; v_card_b text;
  v_ip_hash text; v_who_carries text;
  v_rate_count int;
begin
  -- Canonical pair ordering
  if p_card_a < p_card_b then
    v_card_a := p_card_a; v_card_b := p_card_b; v_who_carries := p_who_carries;
  else
    v_card_a := p_card_b; v_card_b := p_card_a;
    v_who_carries := case p_who_carries
      when 'a' then 'b' when 'b' then 'a' else p_who_carries end;
  end if;

  v_ip_hash := internal.hash_client_ip();

  -- Rate limit: max 30 distinct pairs per IP per hour
  select count(distinct (card_a_id, card_b_id)) into v_rate_count
  from public.votes
  where ip_hash = v_ip_hash and created_at > now() - interval '1 hour';

  if v_rate_count >= 30 then
    raise exception 'Rate limit exceeded' using errcode = 'P0429';
  end if;

  -- Upsert: new values enrich, never erase existing dimensions
  insert into public.votes (card_a_id, card_b_id, ip_hash,
    accuracy, is_real, score, would_play, who_carries, difficulty)
  values (v_card_a, v_card_b, v_ip_hash,
    p_accuracy, p_is_real, p_score, p_would_play, v_who_carries, p_difficulty)
  on conflict (card_a_id, card_b_id, ip_hash) do update set
    accuracy    = coalesce(excluded.accuracy, public.votes.accuracy),
    is_real     = coalesce(excluded.is_real, public.votes.is_real),
    score       = coalesce(excluded.score, public.votes.score),
    would_play  = coalesce(excluded.would_play, public.votes.would_play),
    who_carries = coalesce(excluded.who_carries, public.votes.who_carries),
    difficulty  = coalesce(excluded.difficulty, public.votes.difficulty),
    created_at  = now();
end;
$$ language plpgsql security definer set search_path = '';

grant execute on function public.submit_vote to anon;
