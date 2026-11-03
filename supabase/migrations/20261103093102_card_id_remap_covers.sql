-- Applied in the Supabase SQL editor like 20261030215155 (it replaces the functions that
-- update and delete rows, so apply_migration's confirmation would never reach the owner), in
-- one transaction with its history row under the filename stamp, whose statements hold this
-- file's text. It needs 20261103064319 first.
--
-- A graduation moves binder covers too (#1074).
--
-- A binder's cover_id and My collection's (collection_shelf.cover_id) each name one card, and
-- a player can pick a card still on its preview id. remap_card_ids now moves those covers to
-- the released id with the votes, collection keys and deck cards, so a cover outlives its
-- card's graduation, and undo_card_id_remap puts them back. Each cover it moves gets a backup
-- like any other row, holding the cover alone: the binder's name and rules are the player's
-- words, and the undo never needs them. A binder or shelf that goes takes its backups with it,
-- as a collection or deck does (20261030215155).

alter table internal.card_id_remap_backup
  drop constraint card_id_remap_backup_source_table_check,
  add constraint card_id_remap_backup_source_table_check check (
    source_table in ('votes', 'collections', 'decks', 'collection_binders', 'collection_shelf'));

-- Covers: point each binder's and shelf's cover on an old id at its new id. A backup holds the
-- row's key, its cover and its updated_at, which undo reads to tell a row changed since. Part
-- of remap_card_ids, which validates and locks first.
create function internal.remap_cover_card_ids(p_map jsonb, p_label text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_binders int;
  v_shelves int;
begin
  with target as (
    select b.id, b.owner_id, b.cover_id, b.updated_at
    from public.collection_binders b
    where p_map ? b.cover_id
  ),
  saved as (
    insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
    select p_label, 'collection_binders', t.id::text, 'updated', to_jsonb(t) from target t
  )
  update public.collection_binders b
     set cover_id = p_map ->> t.cover_id
    from target t
   where b.id = t.id;
  get diagnostics v_binders = row_count;

  with target as (
    select s.owner_id, s.cover_id, s.updated_at
    from public.collection_shelf s
    where p_map ? s.cover_id
  ),
  saved as (
    insert into internal.card_id_remap_backup (label, source_table, row_id, action, old_row)
    select p_label, 'collection_shelf', t.owner_id::text, 'updated', to_jsonb(t) from target t
  )
  update public.collection_shelf s
     set cover_id = p_map ->> t.cover_id
    from target t
   where s.owner_id = t.owner_id;
  get diagnostics v_shelves = row_count;

  return jsonb_build_object('binder_covers', v_binders, 'shelf_covers', v_shelves);
end;
$function$;

-- Move every vote, cloud collection key, deck card and binder or shelf cover on an old id in
-- p_map to its new id. p_map is a JSON object of old id to new id, both strings; p_label names
-- the run in the backup table. Returns what it changed. Safe to run again: a second run finds
-- nothing left on the old ids, and moves anything that landed on one since.
create or replace function internal.remap_card_ids(p_map jsonb, p_label text)
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

  -- Writers wait until the remap commits, so nothing lands between the read and the write.
  -- Readers, pair_scores among them, carry on. The order matches a collection's delete, which
  -- reaches the binders and the shelf last, through its cascade.
  lock table public.votes, public.collections, public.decks,
             public.collection_binders, public.collection_shelf
    in share row exclusive mode;

  v_result := internal.remap_vote_card_ids(p_map, p_label)
    || jsonb_build_object(
         'collections', internal.remap_collection_card_ids(p_map, p_label),
         'decks', internal.remap_deck_card_ids(p_map, p_label))
    || internal.remap_cover_card_ids(p_map, p_label);
  raise notice 'remap_card_ids (%): %', p_label, v_result;
  return v_result;
end;
$function$;

-- Put back every row a remap labelled p_label changed, as it was before, and drop its
-- backup. A row deleted since the remap stays deleted: undo never brings back a vote,
-- collection, deck, binder or shelf someone removed, only the votes the remap itself merged
-- away. A collection, deck, binder or shelf changed since the remap keeps its change, a binder
-- moved or renamed included. Collections and decks get their entries and cards back, binders
-- and shelves their covers, and their updated_at shows the undo, as it showed the remap.
-- Returns the rows restored. It stops, changing nothing, if no backup carries p_label: a
-- mistyped label, or one that moved no vote and whose other rows have all been deleted since.
-- It stops too if a vote cast since the remap sits where a restored one goes back to: a stale
-- page that votes on the old ids again, by a voter whose vote moved.
create or replace function internal.undo_card_id_remap(p_label text)
returns int
language plpgsql
set search_path to ''
as $function$
declare
  v_count  int;
  v_detail text;
begin
  lock table public.votes, public.collections, public.decks,
             public.collection_binders, public.collection_shelf
    in share row exclusive mode;

  -- Each row's first copy: a re-run under the same label can save a row twice.
  --
  -- A remap stamps each row other than a vote with its transaction's now(), which is also its
  -- backup's backed_up_at. So a row no one wrote since still carries its last backup's
  -- backed_up_at, and a re-run's copy carries the backed_up_at of the copy before it. Any
  -- other write stamps its own transaction's now(), which differs even when that transaction
  -- began first and then waited for the remap's lock. Last and before go by id, not by time:
  -- a run that began first and waited for another's lock writes after it with the earlier
  -- now().
  if to_regclass('pg_temp.remap_undo') is not null then drop table pg_temp.remap_undo; end if;
  create temp table remap_undo on commit drop as
  select distinct on (source_table, row_id) source_table, row_id, old_row,
         bool_or(action = 'deleted') over w as remap_deleted,
         first_value(backed_up_at) over (w order by id desc) as last_backup,
         coalesce(bool_or(written_between) over w, false) as written_between
  from (select b.*,
               b.source_table <> 'votes'
                 and (b.old_row ->> 'updated_at')::timestamptz
                     <> lag(b.backed_up_at) over (partition by b.source_table, b.row_id
                                                  order by b.id) as written_between
        from internal.card_id_remap_backup b
        where b.label = p_label) b
  window w as (partition by source_table, row_id)
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
              when 'decks' then exists (select 1 from public.decks d where d.id = u.row_id::uuid)
              when 'collection_binders' then exists (select 1 from public.collection_binders b
                                                     where b.id = u.row_id::uuid)
              when 'collection_shelf' then exists (select 1 from public.collection_shelf s
                                                   where s.owner_id = u.row_id::uuid)
            end;

  -- A row its owner wrote since this label's first remap keeps that write.
  delete from pg_temp.remap_undo u
  where u.written_between
     or (u.source_table = 'collections'
         and exists (select 1 from public.collections c
                     where c.owner_id = u.row_id::uuid and c.updated_at <> u.last_backup))
     or (u.source_table = 'decks'
         and exists (select 1 from public.decks d
                     where d.id = u.row_id::uuid and d.updated_at <> u.last_backup))
     or (u.source_table = 'collection_binders'
         and exists (select 1 from public.collection_binders b
                     where b.id = u.row_id::uuid and b.updated_at <> u.last_backup))
     or (u.source_table = 'collection_shelf'
         and exists (select 1 from public.collection_shelf s
                     where s.owner_id = u.row_id::uuid and s.updated_at <> u.last_backup));
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

  update public.collection_binders b
     set cover_id = u.old_row ->> 'cover_id'
    from pg_temp.remap_undo u
   where u.source_table = 'collection_binders' and b.id = u.row_id::uuid;

  update public.collection_shelf s
     set cover_id = u.old_row ->> 'cover_id'
    from pg_temp.remap_undo u
   where u.source_table = 'collection_shelf' and s.owner_id = u.row_id::uuid;

  delete from internal.card_id_remap_backup where label = p_label;
  return v_count;
end;
$function$;

-- Security definer: a player deleting a binder, or clearing their collection, holds nothing in
-- internal. A shelf goes only with its collection, through the cascade.
create or replace function internal.drop_card_id_remap_backups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'collections' then
    delete from internal.card_id_remap_backup b
     where b.source_table = 'collections' and b.row_id = old.owner_id::text;
  elsif tg_table_name = 'decks' then
    delete from internal.card_id_remap_backup b
     where b.source_table = 'decks' and b.row_id = old.id::text;
  elsif tg_table_name = 'collection_binders' then
    delete from internal.card_id_remap_backup b
     where b.source_table = 'collection_binders' and b.row_id = old.id::text;
  elsif tg_table_name = 'collection_shelf' then
    delete from internal.card_id_remap_backup b
     where b.source_table = 'collection_shelf' and b.row_id = old.owner_id::text;
  else
    raise exception 'drop_card_id_remap_backups knows no backups of %', tg_table_name;
  end if;
  return null;
end;
$$;

-- After each deleted row, the collection's cascade and the auth.users cascade included.
create trigger collection_binders_drop_remap_backups
  after delete on public.collection_binders
  for each row execute function internal.drop_card_id_remap_backups();
create trigger collection_shelf_drop_remap_backups
  after delete on public.collection_shelf
  for each row execute function internal.drop_card_id_remap_backups();

-- A new function defaults to PUBLIC EXECUTE, so the new one is closed explicitly. create or
-- replace keeps the others' privileges; restated so this file shows them.
revoke execute on function
  internal.remap_cover_card_ids(jsonb, text),
  internal.remap_card_ids(jsonb, text),
  internal.undo_card_id_remap(text),
  internal.drop_card_id_remap_backups()
from public, anon, authenticated, service_role;
