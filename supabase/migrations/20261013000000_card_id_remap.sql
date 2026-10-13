-- Move what is stored on a retired preview card id to the card's released id (#748).
--
-- During a reveal season a card carries a placeholder id (set 12 used 12<number>204, set 13
-- 13000 + number), and `pnpm graduate-set` gives it its permanent LorcanaJSON id. Votes,
-- cloud collection keys and deck cards stayed on the placeholder, which no card list holds
-- any more: by 2026-10-13, 383 votes (12% of all) counted toward no released card.
-- remap_card_ids moves them. Graduation now writes a migration per set that calls it with
-- that set's id map, and 20261013000001 and 20261013000002 do it for sets 12 and 13.
--
-- Only migrations call these functions. EXECUTE is revoked from every API role below, and
-- the internal schema is out of the API's reach anyway (20260330000000 revokes it).

-- Every row a remap changes, as it was before, so the remap can be undone
-- (undo_card_id_remap below). It holds raw votes, ip_hash included, so no API role gets
-- anything, service_role included: unlike votes, no server-side tool reads it.
create table internal.card_id_remap_backup (
  -- An identity rather than a uuid, because undo needs the order rows were saved in: a row
  -- that a re-run under the same label changes again goes back to its first copy. Only
  -- migrations insert, so the sequence needs no grants.
  id           bigint generated always as identity primary key,
  label        text not null,
  source_table text not null check (source_table in ('votes', 'collections', 'decks')),
  row_id       text not null,
  action       text not null check (action in ('updated', 'deleted')),
  old_row      jsonb not null,
  backed_up_at timestamptz not null default now()
);

alter table internal.card_id_remap_backup enable row level security;
revoke all on internal.card_id_remap_backup from public, anon, authenticated, service_role;

-- Votes: re-key each vote on an old id, and merge it into the vote its voter already holds
-- on the released pair, if any. Part of remap_card_ids, which validates and locks first.
create function internal.remap_vote_card_ids(p_map jsonb, p_label text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_moved  int;
  v_merged int;
begin
  -- Each vote on an old id, re-keyed and put back in pair order: the smaller id first,
  -- compared as text the way submit_vote and the pair_ordering check compare, with
  -- who_carries flipped whenever the pair turns round.
  if to_regclass('pg_temp.remap_votes') is not null then drop table pg_temp.remap_votes; end if;
  create temp table remap_votes on commit drop as
  select r.id, r.ip_hash, true as moved,
         least(r.new_a, r.new_b) as card_a_id,
         greatest(r.new_a, r.new_b) as card_b_id,
         case when r.new_a < r.new_b then r.who_carries
              else case r.who_carries when 'a' then 'b' when 'b' then 'a' else r.who_carries end
         end as who_carries,
         r.accuracy, r.is_real, r.score, r.would_play, r.difficulty, r.created_at
  from (
    select v.*,
           coalesce(p_map ->> v.card_a_id, v.card_a_id) as new_a,
           coalesce(p_map ->> v.card_b_id, v.card_b_id) as new_b
    from public.votes v
    where p_map ? v.card_a_id or p_map ? v.card_b_id
  ) r;

  select count(*) into v_moved from pg_temp.remap_votes;

  if exists (select 1 from pg_temp.remap_votes where card_a_id = card_b_id) then
    raise exception 'remap_card_ids would pair a card with itself in vote %',
      (select id from pg_temp.remap_votes where card_a_id = card_b_id limit 1);
  end if;

  -- A voter holds one vote per pair (idx_votes_unique_pair_ip), so a moved vote that lands
  -- on a pair its voter already voted on joins that vote. No old id is also a new one, so
  -- the votes already on the new pairs are never among the moved ones.
  insert into pg_temp.remap_votes (id, ip_hash, moved, card_a_id, card_b_id, who_carries,
                                   accuracy, is_real, score, would_play, difficulty, created_at)
  select v.id, v.ip_hash, false, v.card_a_id, v.card_b_id, v.who_carries,
         v.accuracy, v.is_real, v.score, v.would_play, v.difficulty, v.created_at
  from public.votes v
  where (v.card_a_id, v.card_b_id, v.ip_hash) in
        (select card_a_id, card_b_id, ip_hash from pg_temp.remap_votes);

  -- One vote per voter and pair, merged the way submit_vote merges a re-vote: the newer
  -- answers win and the older fill the gaps. The merged vote keeps the newer created_at,
  -- so the move neither trips the vote rate limit nor reshuffles the weekly trends. The
  -- vote already on the pair survives, else the newest moved one.
  if to_regclass('pg_temp.remap_merged') is not null then drop table pg_temp.remap_merged; end if;
  create temp table remap_merged on commit drop as
  select (array_agg(id order by moved, created_at desc, id))[1] as keep_id,
         card_a_id, card_b_id,
         (array_agg(accuracy order by created_at desc, id)
            filter (where accuracy is not null))[1] as accuracy,
         (array_agg(is_real order by created_at desc, id)
            filter (where is_real is not null))[1] as is_real,
         (array_agg(score order by created_at desc, id)
            filter (where score is not null))[1] as score,
         (array_agg(would_play order by created_at desc, id)
            filter (where would_play is not null))[1] as would_play,
         (array_agg(who_carries order by created_at desc, id)
            filter (where who_carries is not null))[1] as who_carries,
         (array_agg(difficulty order by created_at desc, id)
            filter (where difficulty is not null))[1] as difficulty,
         max(created_at) as created_at
  from pg_temp.remap_votes
  group by card_a_id, card_b_id, ip_hash;

  -- The votes merged into another go first, which frees their pairs before the survivors
  -- move onto them.
  with gone as (
    delete from public.votes v
    using pg_temp.remap_votes r
    where v.id = r.id
      and r.id not in (select keep_id from pg_temp.remap_merged)
    returning v.*
  )
  insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
  select p_label, 'votes', g.id::text, 'deleted', to_jsonb(g) from gone g;
  get diagnostics v_merged = row_count;

  with changed as (
    select m.*, to_jsonb(v) as old_row
    from pg_temp.remap_merged m
    join public.votes v on v.id = m.keep_id
    where (v.card_a_id, v.card_b_id, v.accuracy, v.is_real, v.score, v.would_play,
           v.who_carries, v.difficulty, v.created_at)
      is distinct from
          (m.card_a_id, m.card_b_id, m.accuracy, m.is_real, m.score, m.would_play,
           m.who_carries, m.difficulty, m.created_at)
  ),
  saved as (
    insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
    select p_label, 'votes', c.keep_id::text, 'updated', c.old_row from changed c
  )
  update public.votes v
     set card_a_id = c.card_a_id, card_b_id = c.card_b_id, accuracy = c.accuracy,
         is_real = c.is_real, score = c.score, would_play = c.would_play,
         who_carries = c.who_carries, difficulty = c.difficulty, created_at = c.created_at
    from changed c
   where v.id = c.keep_id;

  return jsonb_build_object('votes_moved', v_moved, 'votes_merged', v_merged);
end;
$function$;

-- Collections: rename each old key. A collection that holds both ids for a card keeps the
-- larger count per finish: both entries stand for the same copies, counted twice, not
-- copies to add up. Part of remap_card_ids.
create function internal.remap_collection_card_ids(p_map jsonb, p_label text)
returns int
language plpgsql
set search_path to ''
as $function$
declare
  v_count int;
begin
  with target as (
    select c.*
    from public.collections c
    where c.entries ?| array(select jsonb_object_keys(p_map))
  ),
  remapped as (
    select t.owner_id,
           (select jsonb_object_agg(k.card_id, k.entry)
            from (
              select coalesce(p_map ->> e.key, e.key) as card_id,
                     case when count(*) = 1 then (array_agg(e.value))[1]
                          -- A finish neither entry counts keeps what it had, never a null.
                          else (array_agg(e.value order by p_map ? e.key, e.key))[1]
                               || jsonb_strip_nulls(jsonb_build_object(
                                    'normal', max(case when jsonb_typeof(e.value -> 'normal') = 'number'
                                                       then (e.value ->> 'normal')::numeric end),
                                    'foil', max(case when jsonb_typeof(e.value -> 'foil') = 'number'
                                                     then (e.value ->> 'foil')::numeric end)))
                     end as entry
              from jsonb_each(t.entries) e
              group by 1
            ) k) as entries
    from target t
  ),
  saved as (
    insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
    select p_label, 'collections', t.owner_id::text, 'updated', to_jsonb(t) from target t
  )
  update public.collections c
     set entries = r.entries
    from remapped r
   where c.owner_id = r.owner_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Decks: re-point each card on an old id, in place. A deck that lists both ids for a card
-- keeps one entry, where the first of them stood, with the larger quantity, as a
-- collection does. Part of remap_card_ids.
create function internal.remap_deck_card_ids(p_map jsonb, p_label text)
returns int
language plpgsql
set search_path to ''
as $function$
declare
  v_count int;
begin
  with target as (
    select d.*
    from public.decks d
    where exists (select 1 from jsonb_array_elements(d.cards) c where p_map ? (c ->> 'cardId'))
  ),
  remapped as (
    select t.id,
           (select jsonb_agg(k.card order by k.pos)
            from (
              select min(e.pos) as pos,
                     case when count(*) = 1 and not bool_or(e.mapped) then (array_agg(e.card))[1]
                          else (array_agg(e.card order by e.mapped, e.pos))[1]
                               || jsonb_build_object('cardId', e.card_id)
                               || case when count(*) = 1 then '{}'::jsonb
                                       else jsonb_strip_nulls(jsonb_build_object('quantity',
                                              max(case when jsonb_typeof(e.card -> 'quantity') = 'number'
                                                       then (e.card ->> 'quantity')::numeric end)))
                                  end
                     end as card
              from (
                select c.card, c.pos,
                       coalesce(p_map ? (c.card ->> 'cardId'), false) as mapped,
                       -- A card without a cardId keeps a group of its own.
                       coalesce(p_map ->> (c.card ->> 'cardId'), c.card ->> 'cardId', '#' || c.pos)
                         as card_id
                from jsonb_array_elements(t.cards) with ordinality c(card, pos)
              ) e
              group by e.card_id
            ) k) as cards
    from target t
  ),
  saved as (
    insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
    select p_label, 'decks', t.id::text, 'updated', to_jsonb(t) from target t
  )
  update public.decks d
     set cards = r.cards
    from remapped r
   where d.id = r.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Move every vote, cloud collection key and deck card on an old id in p_map to its new id.
-- p_map is a JSON object of old id to new id, both strings; p_label names the run in the
-- backup table. Returns what it changed. Safe to run again: a second run finds nothing left
-- on the old ids, and moves any vote that landed on one since.
create function internal.remap_card_ids(p_map jsonb, p_label text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  if p_label is null or btrim(p_label) = '' then
    raise exception 'remap_card_ids needs a label for its backup rows';
  end if;
  if jsonb_typeof(p_map) is distinct from 'object' or p_map = '{}'::jsonb then
    raise exception 'remap_card_ids needs a non-empty JSON object of old id to new id';
  end if;
  if exists (select 1 from jsonb_each(p_map) m
             where jsonb_typeof(m.value) <> 'string' or m.value #>> '{}' = '') then
    raise exception 'remap_card_ids maps every old id to a new id, as a non-empty string';
  end if;
  -- An id that is both old and new (a chain, or an id mapped to itself) would make the
  -- result depend on the order rows are visited in.
  if exists (select 1 from jsonb_each_text(p_map) m where p_map ? m.value) then
    raise exception 'remap_card_ids found an id that is both old and new';
  end if;

  -- Writers wait until the remap commits, so no vote lands between the read and the write.
  -- Readers, pair_scores among them, carry on.
  lock table public.votes, public.collections, public.decks in share row exclusive mode;

  v_result := internal.remap_vote_card_ids(p_map, p_label)
    || jsonb_build_object(
         'collections', internal.remap_collection_card_ids(p_map, p_label),
         'decks', internal.remap_deck_card_ids(p_map, p_label));
  raise notice 'remap_card_ids (%): %', p_label, v_result;
  return v_result;
end;
$function$;

-- Put back every row a remap labelled p_label changed, as it was before, and drop its
-- backup. Whatever changed in those rows since the remap is lost. A row deleted since the
-- remap stays deleted: undo never brings back a vote, collection or deck someone removed,
-- only the votes the remap itself merged away. Collections and decks get their entries and
-- cards back, and their updated_at shows the undo, as it showed the remap. Returns the rows
-- restored. It stops, changing nothing, if a vote cast since the remap sits where a restored
-- one goes back to: a stale page that votes on the old ids again, by a voter whose vote moved.
create function internal.undo_card_id_remap(p_label text)
returns int
language plpgsql
set search_path to ''
as $function$
declare
  v_count  int;
  v_detail text;
begin
  lock table public.votes, public.collections, public.decks in share row exclusive mode;

  -- Each row's first copy: a re-run under the same label can save a row twice.
  if to_regclass('pg_temp.remap_undo') is not null then drop table pg_temp.remap_undo; end if;
  create temp table remap_undo on commit drop as
  select distinct on (source_table, row_id) source_table, row_id, old_row,
         bool_or(action = 'deleted') over (partition by source_table, row_id) as remap_deleted
  from internal.card_id_remap_backup
  where label = p_label
  order by source_table, row_id, id;

  select count(*) into v_count from pg_temp.remap_undo;
  if v_count = 0 then
    raise exception 'undo_card_id_remap found no backup labelled %', p_label;
  end if;

  delete from pg_temp.remap_undo u
  where not u.remap_deleted
    and not case u.source_table
              when 'votes' then exists (select 1 from public.votes v where v.id = u.row_id::uuid)
              when 'collections' then exists (select 1 from public.collections c
                                              where c.owner_id = u.row_id::uuid)
              else exists (select 1 from public.decks d where d.id = u.row_id::uuid)
            end;
  select count(*) into v_count from pg_temp.remap_undo;

  -- A changed vote goes back by replacing its current version; a merged-away one returns.
  delete from public.votes v
  using pg_temp.remap_undo u
  where u.source_table = 'votes' and v.id = u.row_id::uuid;
  begin
    insert into public.votes
    select (jsonb_populate_record(null::public.votes, u.old_row)).*
    from pg_temp.remap_undo u
    where u.source_table = 'votes';
  exception when unique_violation then
    get stacked diagnostics v_detail = pg_exception_detail;
    raise exception 'undo_card_id_remap cannot restore %: a newer vote holds a pair a restored vote returns to (%)',
      p_label, v_detail
      using hint = 'Merge or delete that vote by hand, then undo again.';
  end;

  update public.collections c
     set entries = u.old_row -> 'entries'
    from pg_temp.remap_undo u
   where u.source_table = 'collections' and c.owner_id = u.row_id::uuid;

  update public.decks d
     set cards = u.old_row -> 'cards'
    from pg_temp.remap_undo u
   where u.source_table = 'decks' and d.id = u.row_id::uuid;

  delete from internal.card_id_remap_backup where label = p_label;
  return v_count;
end;
$function$;

-- A new function defaults to PUBLIC EXECUTE, so each one is closed explicitly.
revoke execute on function
  internal.remap_card_ids(jsonb, text),
  internal.remap_vote_card_ids(jsonb, text),
  internal.remap_collection_card_ids(jsonb, text),
  internal.remap_deck_card_ids(jsonb, text),
  internal.undo_card_id_remap(text)
from public, anon, authenticated, service_role;
