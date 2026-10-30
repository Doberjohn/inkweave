-- Applied in the Supabase SQL editor like 20261013000000 (it deletes and updates rows, so
-- apply_migration's confirmation would never reach the owner), in one transaction with its
-- history row under the filename stamp. That row's statements hold this file's text, so
-- md5(statements[1]) matches the file.
--
-- An undo spares a collection or deck changed since its graduation (#986).
--
-- undo_card_id_remap puts each row a remap changed back as it was. A player who imported
-- their collection again or edited a deck since would lose that: the import replaces the
-- row in place, so its backup stays, and the undo put the pre-remap entries over it. Now
-- such a row keeps its change and only its backup goes. The cost: after a bad remap, a
-- collection or deck changed since keeps any remapped id it still holds. Votes are undone
-- as before.

-- Put back every row a remap labelled p_label changed, as it was before, and drop its
-- backup. A row deleted since the remap stays deleted: undo never brings back a vote,
-- collection or deck someone removed, only the votes the remap itself merged away. A
-- collection or deck changed since the remap keeps its change. Collections and decks get
-- their entries and cards back, and their updated_at shows the undo, as it showed the
-- remap. Returns the rows restored. It stops, changing nothing, if a vote cast since the
-- remap sits where a restored one goes back to: a stale page that votes on the old ids
-- again, by a voter whose vote moved.
create or replace function internal.undo_card_id_remap(p_label text)
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
  --
  -- A remap stamps each collection or deck it writes with its transaction's now(), which is
  -- also its backup's backed_up_at. So a row no one wrote since still carries its last
  -- backup's backed_up_at, and a re-run's copy carries the backed_up_at of the copy before
  -- it. Any other write stamps its own transaction's now(), which differs even when that
  -- transaction began first and then waited for the remap's lock.
  if to_regclass('pg_temp.remap_undo') is not null then drop table pg_temp.remap_undo; end if;
  create temp table remap_undo on commit drop as
  select distinct on (source_table, row_id) source_table, row_id, old_row,
         bool_or(action = 'deleted') over w as remap_deleted,
         max(backed_up_at) over w as last_backup,
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
              else exists (select 1 from public.decks d where d.id = u.row_id::uuid)
            end;

  -- A collection or deck its owner imported or edited since this label's first remap keeps
  -- that write.
  delete from pg_temp.remap_undo u
  where u.written_between
     or (u.source_table = 'collections'
         and exists (select 1 from public.collections c
                     where c.owner_id = u.row_id::uuid and c.updated_at <> u.last_backup))
     or (u.source_table = 'decks'
         and exists (select 1 from public.decks d
                     where d.id = u.row_id::uuid and d.updated_at <> u.last_backup));
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
-- create or replace keeps the function's privileges; restated so this file shows them.
revoke execute on function internal.undo_card_id_remap(text)
  from public, anon, authenticated, service_role;
