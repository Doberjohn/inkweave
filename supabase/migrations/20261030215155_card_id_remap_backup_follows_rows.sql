-- Applied in the Supabase SQL editor like 20261013000000 (it deletes rows, so apply_migration's
-- confirmation would never reach the owner), in one transaction with its history row under
-- the filename stamp. That row's statements hold this file's text, so md5(statements[1])
-- matches the file.
--
-- A graduation's backup of a collection or deck goes when that row goes (#986).
--
-- remap_collection_card_ids and remap_deck_card_ids copy each row they rewrite into
-- internal.card_id_remap_backup, and only undo_card_id_remap deletes from it. The privacy
-- policy says clearing a collection deletes it, and undo never restores a row its owner
-- deleted, so the backup of a deleted row has no use. Kept, it would also let an undo after
-- a clear and a fresh import put the old entries over the new ones. Votes keep theirs: a
-- remap deletes the votes it merges, and undo needs those copies.

-- Each deleted row looks up its own backups.
create index card_id_remap_backup_row
  on internal.card_id_remap_backup (source_table, row_id);

-- Security definer: a player deleting their collection holds nothing in internal.
create function internal.drop_card_id_remap_backups()
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
  else
    raise exception 'drop_card_id_remap_backups knows no backups of %', tg_table_name;
  end if;
  return null;
end;
$$;
-- A new function defaults to PUBLIC EXECUTE. A trigger still fires after the revoke.
revoke execute on function internal.drop_card_id_remap_backups()
  from public, anon, authenticated, service_role;

-- After each deleted row, the auth.users cascade included.
create trigger collections_drop_remap_backups
  after delete on public.collections
  for each row execute function internal.drop_card_id_remap_backups();
create trigger decks_drop_remap_backups
  after delete on public.decks
  for each row execute function internal.drop_card_id_remap_backups();

-- Backups of rows already gone. After the triggers: creating them locks both tables until
-- this commits, so no row goes between this delete's read and the triggers taking over. A
-- collection is keyed by its owner, so one cleared and imported again is a new row with the
-- same key: its created_at, which only the server sets, tells it from the row backed up.
delete from internal.card_id_remap_backup b
 where (b.source_table = 'collections'
        and not exists (select 1 from public.collections c
                         where c.owner_id::text = b.row_id
                           and c.created_at = (b.old_row ->> 'created_at')::timestamptz))
    or (b.source_table = 'decks'
        and not exists (select 1 from public.decks d where d.id::text = b.row_id));
