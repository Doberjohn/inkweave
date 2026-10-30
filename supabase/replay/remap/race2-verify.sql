-- After remap race 2: M's later backup has the earlier backed_up_at, and undo still puts M's
-- collection back to its first copy, since no one but the two runs wrote it.
\set ON_ERROR_STOP on
do $$
declare first_at timestamptz; last_at timestamptz; restored int; got jsonb;
begin
  select min(b.backed_up_at) filter (where b.id = (select min(id) from internal.card_id_remap_backup where label = 'race2')),
         min(b.backed_up_at) filter (where b.id = (select max(id) from internal.card_id_remap_backup where label = 'race2'))
    into first_at, last_at
    from internal.card_id_remap_backup b where b.label = 'race2';
  assert t.backups('collections', t.uid('M')) = 2, 'race 2: the two runs saved no two backups of M''s collection';
  assert last_at < first_at, format('race 2: the later backup (%s) is not the earlier now() (%s)', last_at, first_at);
  restored := internal.undo_card_id_remap('race2');
  select c.entries into got from public.collections c where c.owner_id = t.uid('M');
  assert got = '{"race2-a": {"normal": 1}, "race2-b": {"normal": 1}}',
    format('race 2: the undo left M''s collection at %s', got);
  assert restored = 1, format('race 2: the undo restored %s rows, not M''s', restored);
end $$;
\echo '== remap race 2 passed'
