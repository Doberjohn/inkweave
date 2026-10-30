-- After remap race 1: L's import began before the remap and landed after it, so its
-- updated_at is earlier than the backup, and undo leaves it.
\set ON_ERROR_STOP on
do $$
declare stamped timestamptz; backed timestamptz; got jsonb;
begin
  select c.updated_at, c.entries into stamped, got from public.collections c where c.owner_id = t.uid('L');
  assert got = '{"race-fresh": {"normal": 5}}', format('race 1: L''s import did not land after the remap: %s', got);
  select b.backed_up_at into backed from internal.card_id_remap_backup b where b.label = 'race';
  assert stamped < backed, format('race 1: L''s import (%s) did not begin before the remap (%s)', stamped, backed);
  perform internal.undo_card_id_remap('race');
  select c.entries into got from public.collections c where c.owner_id = t.uid('L');
  assert got = '{"race-fresh": {"normal": 5}}', format('race 1: the undo wrote over L''s import: %s', got);
end $$;
\echo '== remap race 1 passed'
